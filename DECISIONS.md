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

## Lunar calendar

- **Month naming rule:** amanta month = (sidereal sign of the Sun at the new moon that
  starts the month) + 1, so Sun in Meena → Chaitra. This makes the adhik month take the
  name of the following nija month, which is the standard convention.
- **The month of a panchang day is evaluated at local sunrise**, like the tithi.
- **Purnimanta Krishna paksha** = next amanta month's name, except inside an adhik amanta
  month, where both halves keep the adhik name (the adhik lunation is inserted between
  the two halves of the nija purnimanta month).
- **Kshaya masa** (a lunation with two sankrantis, very rare) is not flagged; with the
  naming rule above the following month simply skips a name. Flagged in HANDOFF.md.

## Festivals

- **SPEC discrepancy — Diwali month (needs human confirmation).** SPEC §6 says "Diwali
  falls on Amavasya of Kartika (amanta) / Ashvin (purnimanta)". As far as I can tell this
  is reversed: in amanta reckoning the Krishna paksha belongs to the same month as the
  preceding Shukla paksha, and Kartika Shukla Pratipada (Govardhan Puja / Bali Pratipada /
  Gujarati New Year) is the day *after* Diwali, so Diwali is the last day of **amanta
  Ashvin**. In purnimanta reckoning the Krishna paksha is named after the following month,
  so the same day is **purnimanta Kartika** Amavasya (the usual North Indian statement).
  `data/festivals.json` encodes Diwali as amanta Ashvin Krishna 15, and the consistency
  test asserts amanta Ashvin / purnimanta Kartika. SPEC.md is not edited. If the human
  disagrees, change one line in `data/festivals.json` and the test.
- **Festival months are written in amanta** (`"monthSystem": "amanta"` at the top of the
  file) and `tithi` is the number within the paksha (Krishna 15 = Amavasya), which is how
  rules are usually stated. Festivals are only matched in nija (non-adhik) months.
- **Observance decision rule:** the festival is on the panchang day whose deciding window
  (sunrise instant, Nishita, Pradosh, Aparahna) is covered most by the tithi; ties go to the
  earlier day; if no window is touched, the day containing most of the tithi is used and
  `fallbackUsed` is set. This is a simplification of the classical decision texts.
- **Window definitions** (in `data/observance-windows.json`): Pradosh = first 3 of 15 night
  muhurtas after sunset; Nishita (for `tithi_at_midnight`) = 8th night muhurta; Aparahna =
  4th of 5 day parts.
- **Spec rule set has no Madhyahna or moonrise rule.** Ram Navami and Ganesh Chaturthi are
  traditionally decided at Madhyahna and Karva Chauth at moonrise; they use sunrise /
  sunrise / Pradosh respectively, with a note in `regionNotes`. Bhadra (Vishti) avoidance
  for Holika Dahan and Raksha Bandhan is not modelled.

## Muhurat finder

- **Rule-file format.** Tithis are listed per paksha (`{"shukla": [2,3,5], "krishna": [2]}`),
  nakshatras and weekdays by English name; zod validates names against the name tables, so
  a typo fails at startup. Excluded periods: `rahuKaal`, `yamaganda`, `gulika`; excluded
  karanas by name (e.g. `Vishti`, a.k.a. Bhadra).
- **`timeOfDay`** (`day` = sunrise→sunset, `anytime` = sunrise→next sunrise) and
  **`minimumWindowMinutes`** (default 15) were added to each rule file so slivers between
  two transitions are not reported as muhurats. Both are editable data.
- **Contents of the four rule files are placeholders** from commonly published lists, not
  checked against a source. Lagna, lunar-month/season restrictions (Chaturmas etc.),
  planetary combustion and personal charts are out of scope.
- **Adjacent qualifying pieces are merged** into one window even if the tithi or nakshatra
  changes inside it (both allowed); the window lists every tithi/nakshatra it spans.
- **Range limit:** `from`..`to` inclusive, at most 366 days.

## Database

- **Migrations are generated SQL files** in `drizzle/` (`npm run db:generate` from
  `src/server/db/schema.ts`) and applied with Drizzle's migrator (`npm run db:migrate`),
  which records applied files in `drizzle.__drizzle_migrations`. Never edit the database
  or an applied migration by hand.
- **`npm test` never touches a database** (hermetic; storage is behind interfaces with an
  in-memory implementation). Postgres integration tests live in `tests-db/` and run with
  `npm run test:db` against `DATABASE_URL_TEST`.
- **Scripts load `.env` with `process.loadEnvFile`**, so `engines.node` is `>=20.12`
  instead of adding `dotenv`.
- **Docker compose.** Postgres 16 (alpine image). Credentials in `docker-compose.yml` are
  local-development only.

## API keys and metering

- **Key format `pk_live_` + 32 random bytes (base64url).** Stored as hex SHA-256 only, plus
  a 12-character display prefix. A fast hash is fine because keys are 256-bit random; a
  slow password hash would add latency to every call without adding security.
- **CLI:** `npm run key:create -- --name "<label>" [--plan <plan>] [--quota <n>]` prints the
  plaintext once. `npm run db:seed` inserts `SEED_API_KEY` (development only) if set.
