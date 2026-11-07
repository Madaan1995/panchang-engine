# DECISIONS.md — judgment calls made during the autonomous build

Each entry: the decision, why, and what a human may want to revisit.

## Process

- **Branch.** Work happens on `autobuild` as the user requested. The remote had no
  commits at all, so there was no `main` to branch from. `chore: add build kit` is the
  root commit of `autobuild`; at the end, `main` is created pointing at that root commit
  so the pull request `autobuild → main` shows the whole build.

## Dependencies and licences

All direct dependencies are MIT, Apache-2.0, BSD or ISC (checked with `npm view <pkg> license`).

| Package | Version | Licence | Why |
|---|---|---|---|
| astronomy-engine | 2.1.19 | MIT | Sun/Moon positions, rise/set, moon phases (spec) |
| luxon | 3.7.2 | MIT | IANA timezone and DST handling (spec) |
| zod | 4.6.7 | MIT | Request validation (spec) |
| next | 16.4.5 | MIT | API route handlers + web page (spec) |
| react, react-dom | 19.3.1 | MIT | Required by Next.js |
| drizzle-orm | 0.45.4 | Apache-2.0 | Postgres access (spec) |
| pg | 8.23.1 | MIT | Postgres driver used by Drizzle |
| typescript | 5.9.3 | Apache-2.0 | Language. 5.x rather than 7.x because typescript-eslint supports `<6.1` |
| vitest | 4.1.12 | MIT | Tests (spec). 4.x rather than 5.x because 5.x requires Node ≥ 22.12 and the spec says Node 20+ |
| fast-check | 4.10.2 | MIT | Property-based tests (spec allows) |
| eslint | 9.39.5 | MIT | Lint |
| typescript-eslint | 8.72.1 | MIT | TypeScript lint rules |
| drizzle-kit | 0.31.11 | MIT | Generates SQL migration files from the Drizzle schema |
| tsx | 4.23.15 | MIT | Runs the TypeScript CLI scripts (migrate, seed, create key) |
| @types/* | — | MIT | Type definitions |

- **`.npmrc` sets `legacy-peer-deps=true`.** npm 10.9 crashes (`Cannot read properties of
  null (reading 'edgesOut')`) while resolving vitest's optional peer
  `@vitest/browser-playwright`. Legacy peer resolution avoids it; the project does not
  use any of vitest's optional browser peers. Revisit when upgrading npm.

## Tooling

- **Core purity is enforced by lint.** `eslint.config.mjs` forbids `Date.now()`,
  `new Date()` with no arguments, Luxon `DateTime.now/local`, `Date#getHours`-style
  local-time accessors and I/O imports inside `src/core`.
- **Tests run with `TZ=Pacific/Chatham`** (set in `vitest.config.mts`). It is an
  unusual +12:45/+13:45 zone, so any accidental use of the system timezone in code under
  test produces visibly wrong results instead of passing by coincidence on a UTC CI box.

## Astronomy layer

- **Rise/set definition.** astronomy-engine `SearchRiseSet`: the upper limb touches the
  geometric horizon with a fixed 34′ of refraction (for the Sun: centre ≈ 50′ below the
  horizon). Observer at the location's elevation, standing on the ground (no horizon dip).
  A test re-derives this from astronomy-engine's independent `Equator`/`Horizon`
  functions. Note: astronomy-engine's `Horizon(..., 'normal')` refraction model gives
  ≈37′ at the horizon, not 34′, so the two must not be mixed.
- **`sunTimes` throws `NoSunriseSunsetError` (with `condition: 'MIDNIGHT_SUN' | 'POLAR_NIGHT'`)**
  rather than returning a union type. The spec says "return a typed error"; a typed
  exception keeps every normal caller simple and the API maps it to HTTP 422.
  Sunset is "the first sunset after that day's sunrise", which is the evening of the
  same day everywhere except near the polar circles.
- **Positions are geocentric** (`SunPosition` apparent Sun, `EclipticGeoMoon`), on the
  true ecliptic/equinox of date. Panchang elements are properties of the moment, not of
  the observer; only rise/set times are topocentric.
- **Time representation.** Core functions take and return `Date` instants (UTC
  milliseconds) and `YYYY-MM-DD` local dates interpreted in the location's IANA zone via
  Luxon. Zoned ISO strings are produced only by `src/core/format.ts`.

## Panchanga elements

- **Karana mapping.** Half-tithi index k = floor(elongation / 6°) ∈ 0..59. k=0 Kimstughna,
  k=1..56 the seven movable karanas (Bava … Vishti) cycling, k=57 Shakuni, 58 Chatushpada,
  59 Naga. Karana `number` in outputs is k+1 (1..60).
- **Names.** English transliteration without diacritics plus Devanagari. Names are not
  religious rules, so they are in `src/core/names.ts` rather than `data/`.

## Transitions

- **Kshaya / vriddhi flags** are computed per panchang day: `kshaya` = starts after this
  sunrise and ends at or before the next sunrise; `vriddhi` = current at this sunrise and
  still current at the next sunrise.
- **Root-finder tolerance is 1 ms**; output times are rounded to whole seconds in
  `format.ts`. Boundaries returned by the finder are always on the "new element" side,
  so evaluating the element at a returned boundary gives the element that starts there.
- **Nakshatra segments report `pada: 1`** in their `info` because a segment is the whole
  nakshatra; the pada at a given instant comes from `elementsAtInstant`.
- **New/full-moon cross-check margin.** Our tithi uses the *apparent* Sun
  (`SunPosition`, aberration included), as drik panchangas do. astronomy-engine's
  `MoonPhase`/`SearchMoonPhase` use the *geometric* Sun. The ≈20.5″ difference shifts
  Amavasya/Purnima ends by ~30–46 s (max 46.4 s over 24 lunations from Jan 2025), inside
  the spec's 60 s. A second test runs our root finder on `MoonPhase` itself and matches
  `SearchMoonPhase` within 1 s, showing the residual is the convention, not the finder.

## Day timings

- **Brahma muhurta = the 2 night-muhurtas ending at sunrise**, exactly as SPEC §4 says
  (≈ 96 minutes before sunrise to sunrise). Some traditions use only the 14th muhurta
  (ending one muhurta before sunrise); `nightMuhurtasEndingAtSunrise` in
  `data/day-timings.json` is editable but the current code always ends at sunrise.
- **Muhurta and segment indices live in `data/day-timings.json`** with a provenance block,
  because they are traditional rules rather than astronomy.
