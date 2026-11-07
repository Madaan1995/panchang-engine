import { beforeEach, describe, expect, it } from 'vitest';
import { handleApiRequest, type ApiDeps, type Endpoint } from '@/server/api';
import { MockBillingProvider } from '@/server/billing';
import { generateApiKey } from '@/server/keys';
import { MemoryStore } from '@/server/store';

const NOW = new Date(Date.UTC(2026, 10, 7, 15));

let store: MemoryStore;
let deps: ApiDeps;
let key: string;

beforeEach(async () => {
  store = new MemoryStore();
  deps = { keys: store, usage: store, billing: new MockBillingProvider({ free: 1000, tiny: 2 }), now: () => NOW };
  const k = generateApiKey();
  await store.create({ name: 'test', keyPrefix: k.prefix, keyHash: k.hash, plan: 'free' });
  key = k.plaintext;
});

async function call(endpoint: Endpoint, query: string, auth: string | null = `Bearer ${key}`) {
  const headers: Record<string, string> = auth === null ? {} : { authorization: auth };
  const res = await handleApiRequest(endpoint, new Request(`http://localhost/api/v1/${endpoint}?${query}`, { headers }), deps);
  return { res, body: (await res.json()) as Record<string, unknown> };
}

describe('API authentication', () => {
  it('401 without a key, with a malformed header, or with a wrong key — and no usage row', async () => {
    for (const auth of [null, 'Basic abc', 'Bearer pk_live_nope']) {
      const { res, body } = await call('cities', 'q=mon', auth);
      expect(res.status).toBe(401);
      expect((body.error as { code: string }).code).toBe('unauthorized');
    }
    expect(store.events).toHaveLength(0);
  });
});

describe('GET /api/v1/panchang', () => {
  it('200 by city with a conventions block and zoned times; appends a usage row', async () => {
    const { res, body } = await call('panchang', 'city=montreal-ca&date=2026-03-08');
    expect(res.status).toBe(200);
    expect(body.conventions).toMatchObject({ ayanamsa: { id: 'lahiri' }, monthSystem: 'purnimanta' });
    expect((body.sun as { sunrise: string }).sunrise).toMatch(/^2026-03-08T0\d:\d\d:\d\d-04:00$/);
    expect(res.headers.get('x-ratelimit-limit')).toBe('1000');
    expect(store.events).toEqual([{ apiKeyId: 1, endpoint: '/api/v1/panchang', status: 200, createdAt: NOW }]);
  });

  it('200 by lat/lon/tz; date defaults to today in the location zone', async () => {
    const { res, body } = await call('panchang', 'lat=28.6139&lon=77.209&tz=Asia/Kolkata&monthSystem=amanta');
    expect(res.status).toBe(200);
    expect(body.date).toBe('2026-11-07'); // 15:00 UTC = 20:30 IST on 7 Nov
    expect((body.conventions as { monthSystem: string }).monthSystem).toBe('amanta');
  });

  it('400 with zod issue details for invalid input; the call is metered with status 400', async () => {
    const { res, body } = await call('panchang', 'lat=999&lon=0&tz=UTC');
    expect(res.status).toBe(400);
    const err = body.error as { code: string; issues: { path: string[] }[] };
    expect(err.code).toBe('invalid_request');
    expect(err.issues.some((i) => i.path[0] === 'lat')).toBe(true);
    expect(store.events.at(-1)!.status).toBe(400);
  });

  it('404 for an unknown city', async () => {
    const { res, body } = await call('panchang', 'city=atlantis-xx');
    expect(res.status).toBe(404);
    expect((body.error as { code: string }).code).toBe('not_found');
  });

  it('422 with a typed error where the Sun does not rise', async () => {
    const { res, body } = await call('panchang', 'lat=78.22&lon=15.65&tz=Arctic/Longyearbyen&date=2026-12-21');
    expect(res.status).toBe(422);
    expect((body.error as { code: string }).code).toBe('no_sunrise_sunset');
  });
});

describe('quota', () => {
  it('429 with a clear message once the monthly quota is used; 429s are metered but not billed', async () => {
    store.keys[0]!.plan = 'tiny';
    expect((await call('cities', 'q=a')).res.status).toBe(200);
    expect((await call('cities', 'q=b')).res.status).toBe(200);
    const { res, body } = await call('cities', 'q=c');
    expect(res.status).toBe(429);
    expect((body.error as { message: string }).message).toMatch(/Monthly quota exceeded: 2 of 2/);
    expect(res.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(store.events.map((e) => e.status)).toEqual([200, 200, 429]);
  });
});

describe('other endpoints', () => {
  it('GET /festivals returns 10 festivals with provenance', async () => {
    const { res, body } = await call('festivals', 'year=2026&city=toronto-ca');
    expect(res.status).toBe(200);
    expect((body.festivals as unknown[]).length).toBe(10);
  });

  it('GET /festivals 400 without a year', async () => {
    expect((await call('festivals', 'city=toronto-ca')).res.status).toBe(400);
  });

  it('GET /muhurat returns windows with reasons and the UNVERIFIED disclaimer', async () => {
    const { res, body } = await call('muhurat', 'ceremony=griha-pravesh&from=2026-05-01&to=2026-05-31&city=montreal-ca');
    expect(res.status).toBe(200);
    expect(body.disclaimer).toMatch(/^UNVERIFIED/);
    expect(((body.windows as { reasons: string[] }[])[0]?.reasons.length ?? 0)).toBeGreaterThan(0);
  });

  it('GET /muhurat 400 for a range over 366 days or an unknown ceremony', async () => {
    expect((await call('muhurat', 'ceremony=vivah&from=2026-01-01&to=2027-01-02&city=montreal-ca')).res.status).toBe(400);
    expect((await call('muhurat', 'ceremony=party&from=2026-01-01&to=2026-01-02&city=montreal-ca')).res.status).toBe(400);
  });

  it('GET /cities searches the bundled list', async () => {
    const { res, body } = await call('cities', 'q=brampton');
    expect(res.status).toBe(200);
    expect((body.cities as { id: string }[]).map((c) => c.id)).toEqual(['brampton-ca']);
  });
});
