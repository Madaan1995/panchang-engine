/**
 * HTTP API handlers, independent of Next.js so they can be unit-tested with
 * plain `Request` objects and an in-memory store. The Next.js route files in
 * src/app/api/v1/* are one-line wrappers around `handleApiRequest`.
 *
 * Request pipeline for every /api/v1 endpoint:
 *   1. Authenticate `Authorization: Bearer <key>`      → 401 if missing/invalid
 *   2. Check the key's monthly quota                      → 429 if exhausted
 *   3. Validate the query string with zod                 → 400 with issue details
 *   4. Resolve the location (city id or lat/lon/tz)       → 404 for an unknown city
 *   5. Compute with the core library                      → 200 (422 if no sunrise/sunset)
 *   6. Append a usage row (key, endpoint, time, status) for steps 2–5.
 */
import { ZodError, type ZodType } from 'zod';
import { searchCities } from '@/core/cities';
import { MAX_RANGE_DAYS, rangeLengthDays, UnknownCeremonyError } from '@/core/muhurat';
import { festivalsReport, muhuratReport, panchangReport } from '@/core/report';
import { NoSunriseSunsetError } from '@/core/riseSet';
import { InvalidInputError } from '@/core/time';
import { authenticate } from './auth';
import type { BillingProvider } from './billing';
import { checkQuota, type QuotaStatus } from './metering';
import type { KeyStore, UsageStore } from './store';
import {
  calcOptions,
  citiesQuery,
  festivalsQuery,
  muhuratQuery,
  NotFoundError,
  panchangQuery,
  queryObject,
  resolveLocation,
  todayIn,
} from './validation';

export interface ApiDeps {
  keys: KeyStore;
  usage: UsageStore;
  billing: BillingProvider;
  /** Injected clock: used for metering timestamps and the default `date`. */
  now: () => Date;
}

export type Endpoint = 'panchang' | 'festivals' | 'muhurat' | 'cities';

export const ENDPOINT_PATHS: Record<Endpoint, string> = {
  panchang: '/api/v1/panchang',
  festivals: '/api/v1/festivals',
  muhurat: '/api/v1/muhurat',
  cities: '/api/v1/cities',
};

interface ErrorBody {
  error: { code: string; message: string; issues?: { path: (string | number)[]; message: string; code: string }[] };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function errorResponse(status: number, code: string, message: string, issues?: ErrorBody['error']['issues']): Response {
  return json(status, { error: { code, message, ...(issues ? { issues } : {}) } } satisfies ErrorBody);
}

function rateLimitHeaders(q: QuotaStatus): Record<string, string> {
  return {
    'x-ratelimit-limit': String(q.limit),
    'x-ratelimit-remaining': String(q.remaining),
    'x-ratelimit-reset': q.resetsAt.toISOString(),
  };
}

function parse<T>(schema: ZodType<T>, url: URL): T {
  return schema.parse(queryObject(url));
}

/** Steps 3–5: validate, resolve, compute. Throws typed errors that `toErrorResponse` maps. */
function compute(endpoint: Endpoint, url: URL, now: Date): unknown {
  switch (endpoint) {
    case 'panchang': {
      const q = parse(panchangQuery, url);
      const location = resolveLocation(q);
      return panchangReport(q.date ?? todayIn(location.timezone, now), location, calcOptions(q));
    }
    case 'festivals': {
      const q = parse(festivalsQuery, url);
      return festivalsReport(q.year, resolveLocation(q), calcOptions(q));
    }
    case 'muhurat': {
      const q = parse(muhuratQuery, url);
      const days = rangeLengthDays({ from: q.from, to: q.to });
      if (days < 1 || days > MAX_RANGE_DAYS) {
        throw new InvalidInputError(`from..to must cover 1 to ${MAX_RANGE_DAYS} days (got ${days})`);
      }
      return muhuratReport(q.ceremony, { from: q.from, to: q.to }, resolveLocation(q), calcOptions(q));
    }
    case 'cities': {
      const q = parse(citiesQuery, url);
      return { cities: searchCities(q.q, q.limit) };
    }
  }
}

function toErrorResponse(e: unknown): Response {
  if (e instanceof ZodError) {
    return errorResponse(
      400,
      'invalid_request',
      'The query string is invalid. See `issues` for details.',
      e.issues.map((i) => ({ path: i.path as (string | number)[], message: i.message, code: i.code })),
    );
  }
  if (e instanceof InvalidInputError || e instanceof UnknownCeremonyError) return errorResponse(400, 'invalid_request', e.message);
  if (e instanceof NotFoundError) return errorResponse(404, 'not_found', e.message);
  if (e instanceof NoSunriseSunsetError) return errorResponse(422, 'no_sunrise_sunset', e.message);
  if (e instanceof RangeError) return errorResponse(400, 'invalid_request', e.message);
  console.error(e);
  return errorResponse(500, 'internal_error', 'Unexpected server error.');
}

export async function handleApiRequest(endpoint: Endpoint, request: Request, deps: ApiDeps): Promise<Response> {
  // 1. Authenticate. Unauthenticated calls are not metered (there is no key to bill).
  const auth = await authenticate(request.headers.get('authorization'), deps.keys);
  if (!auth.ok) return errorResponse(auth.status, 'unauthorized', auth.message);

  const now = deps.now();
  const meter = (status: number) =>
    deps.usage.record({ apiKeyId: auth.key.id, endpoint: ENDPOINT_PATHS[endpoint], status, createdAt: now });

  // 2. Quota.
  const quota = await checkQuota(auth.key, deps.usage, deps.billing, now);
  if (!quota.allowed) {
    await meter(429);
    const res = errorResponse(429, 'quota_exceeded', quota.message as string);
    for (const [k, v] of Object.entries(rateLimitHeaders(quota))) res.headers.set(k, v);
    return res;
  }

  // 3–5. Compute.
  let response: Response;
  try {
    response = json(200, compute(endpoint, new URL(request.url), now));
  } catch (e) {
    response = toErrorResponse(e);
  }
  for (const [k, v] of Object.entries(rateLimitHeaders(quota))) response.headers.set(k, v);

  // 6. Meter.
  await meter(response.status);
  return response;
}
