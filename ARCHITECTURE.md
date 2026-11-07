# ARCHITECTURE.md — Panchang Engine

A pure TypeScript calculation library (`src/core`), a metered HTTP API and a small web
page (Next.js App Router), and Postgres for API keys and usage. This document covers the
modules, how data flows, every calculation convention with its source, and why the major
choices were made. Smaller judgment calls are in `DECISIONS.md`.

## Layout

```
data/                     Editable rule data (JSON, each with provenance) — never hard-coded in logic
  day-timings.json        Rahu Kaal / Yamaganda / Gulika weekday table, Abhijit & Brahma muhurta indices
  choghadiya.json         Day and night choghadiya sequences per weekday
  festivals.json          10 festival rules (amanta month, paksha, tithi, observance rule)
  observance-windows.json Definitions of sunrise / Nishita / Pradosh / Aparahna windows
  muhurat-rules/*.json    One rule set per ceremony (griha-pravesh, vivah, namkaran, mundan)
  cities.json             ~116 bundled cities (lat/lon/IANA zone)
src/core/                 PURE library: no I/O, no clock, no system timezone (enforced by ESLint)
src/server/               API pipeline, auth, metering, billing stub, Postgres access
src/web/                  Page model + presentational React component for "/"
src/app/                  Next.js: "/" page and /api/v1/* route files (thin wrappers)
drizzle/                  Generated SQL migrations (+ drizzle-kit metadata)
scripts/                  CLI: migrate, seed, create API key
tests/                    Hermetic tests (`npm test`) incl. fixtures/reference for human-verified data
tests-db/                 Postgres integration tests (`npm run test:db`)
```

## Core library modules (`src/core`), bottom-up

| Module | Responsibility |
|---|---|
| `angles.ts` | `normalizeDegrees` to [0°, 360°), signed differences across the 0°/360° seam |
| `time.ts`, `format.ts`, `types.ts` | Local dates in an IANA zone (Luxon), zoned ISO output |
| `ayanamsa.ts` | Lahiri ayanamsa (UNVERIFIED), tropical → sidereal |
| `positions.ts` | Sun and Moon longitudes at an instant (astronomy-engine) |
| `riseSet.ts` | `sunTimes`, `moonTimes`, typed polar error |
| `names.ts` | English + Devanagari names of every element |
| `elements.ts` | Tithi/paksha, nakshatra/pada, yoga, karana at an instant |
| `vara.ts` | Panchang date and vara of an instant (weekday of the governing sunrise) |
| `angleFunctions.ts` | The increasing angle behind each element, as a function of time |
| `rootFinder.ts` | Finds when such an angle crosses a target (marching + Illinois regula falsi) |
| `transitions.ts` | Start/end of every element over a panchang day; kshaya/vriddhi flags |
| `dayTimings.ts` | Rahu Kaal, Yamaganda, Gulika, Abhijit, Brahma muhurta, choghadiya |
| `lunarCalendar.ts` | Amanta/purnimanta month names, adhik maas |
| `data.ts`, `muhuratRules.ts`, `cities.ts` | Load + zod-validate the `data/` files |
| `festivals.ts` | Festival dates from rule data |
| `muhurat.ts` | Muhurat windows for a ceremony and date range |
| `conventions.ts`, `report.ts` | JSON-ready reports (zoned ISO strings + `conventions` block) |

## Data flow

```
             ┌─────────────── src/core (pure) ───────────────┐
 date, loc → │ positions → elements → transitions ─┐          │
             │ riseSet ─→ vara, dayTimings ─────────┼→ report │ → JSON (zoned ISO)
             │ lunarCalendar, festivals, muhurat ───┘          │
             └───────────────────────────────────────────────┘
                        ▲                          ▲
   GET /api/v1/* → src/server/api.ts               │
      1 auth (KeyStore) → 2 quota (UsageStore + BillingProvider)
      → 3 zod validation → 4 resolve city/lat-lon-tz → 5 core report
      → 6 append usage row → Response
   GET /  → src/web/pageModel.ts → same core report → PanchangView (SSR, no DB)
```

The API handlers are plain `Request → Response` functions taking their dependencies
(`ApiDeps`: key store, usage store, billing provider, clock). Next.js route files only
inject the production dependencies (`src/server/deps.ts`). Tests inject an in-memory store
and a fixed clock, so `npm test` needs no database or network.

## Calculation conventions and sources

| Convention | Definition used | Source / note | Status |
|---|---|---|---|
| Ephemeris | astronomy-engine 2.1.19: Sun from VSOP87, Moon from the Improved Lunar Ephemeris (Brown) | astronomy-engine docs | — |
| Positions | Geocentric; Sun **apparent** (light-time/aberration), Moon geocentric; true ecliptic & equinox of date | `SunPosition`, `EclipticGeoMoon` | — |
| Ayanamsa | Lahiri: true ayanamsa 23°15′00.658″ at 1956-03-21 0h ET (JD 2435553.5), converted to mean by removing IAU 2000B nutation, advanced by IAU 2006 general precession p_A; true ayanamsa = mean + Δψ | Report of the Calendar Reform Committee (1955) / Indian Astronomical Ephemeris; Capitaine et al. 2003; IERS Conventions 2010 eq. 5.40 | **UNVERIFIED** |
| Sidereal longitude | tropical (true of date) − true ayanamsa, normalised to [0°, 360°) | SPEC §1 | — |
| Sunrise/sunset | Upper limb on the geometric horizon with fixed 34′ refraction (Sun centre ≈ 50′ below horizon); observer at ground level at the given elevation | astronomy-engine `SearchRiseSet` | Convention to confirm against reference source |
| Moonrise/moonset | Same, with topocentric parallax; null when absent on the local date | astronomy-engine | — |
| Panchang day | Local sunrise → next local sunrise; vara = weekday of that sunrise | SPEC §2 | — |
| Tithi | floor(elongation / 12°) + 1; 1–15 Shukla, 16–30 Krishna | SPEC §2 | — |
| Nakshatra, pada | floor(moon_sid / 13°20′) + 1; pada = quarter (3°20′) | SPEC §2 | — |
| Yoga | floor(((sun_sid + moon_sid) mod 360°) / 13°20′) + 1 | SPEC §2 | — |
| Karana | half-tithi k = floor(elongation / 6°): k=0 Kimstughna; 1–56 Bava…Vishti ×8; 57 Shakuni; 58 Chatushpada; 59 Naga | Classical scheme (Surya Siddhanta tradition) | — |
| Transitions | Root of (angle − boundary) to 1 ms; outputs rounded to the second | `rootFinder.ts` | Cross-checked |
| Rahu Kaal etc. | Day split into 8; segment per weekday from `data/day-timings.json` | Common published tables | **UNVERIFIED** data |
| Abhijit | 8th of 15 day-muhurtas | SPEC §4 | — |
| Brahma muhurta | 2 night-muhurtas (night/15 each) ending at sunrise; night = previous sunset → sunrise | SPEC §4 | — |
| Choghadiya | 8 day + 8 night equal segments, sequences from `data/choghadiya.json` | Common published tables | **UNVERIFIED** data |
| Lunar month | Amanta month named (Sun's sidereal sign at the starting new moon) + 1; Chaitra ⇔ Sun in Meena. Purnimanta: Krishna paksha takes the next month's name (except inside an adhik lunation) | Reingold & Dershowitz, *Calendrical Calculations* | Convention |
| Adhik maas | Lunation with no sankranti (Sun in the same sidereal sign at both new moons) | Standard rule | — |
| Festivals | Day whose deciding window (sunrise / Nishita / Pradosh / Aparahna) the tithi covers most; ties → earlier day; fallback → day containing most of the tithi | Simplification of Dharmasindhu-style rules | **UNVERIFIED** |
| Muhurat | Pieces between all transitions and period edges; keep pieces where every inclusion rule holds and no exclusion applies; merge neighbours; drop < `minimumWindowMinutes` | `muhurat.ts` | Rules **UNVERIFIED** |
| Timezones | Luxon with IANA zones; durations computed on UTC instants, never on wall-clock times | SPEC stack | — |

## How correctness is tested (no invented reference data)

Every test name says which kind of check it is:

- **Cross-checks against independent astronomy-engine functions** — Moon longitude vs
  `Ecliptic(GeoMoon)`; elongation vs `MoonPhase`; rise/set altitude re-derived with
  `Equator`/`Horizon`; Amavasya/Purnima ends vs `SearchMoonPhase` over 24 lunations
  (max 46.4 s, explained by the apparent-vs-geometric Sun; a control test running our root
  finder on `MoonPhase` itself agrees within 1 s).
- **Mathematical/property checks** (fast-check) — formulas, boundary values within 0.01°,
  monotonic transitions, tithi +1 mod 30, equal-length segments, DST offsets and
  round-trips, adhik ⇔ no sankranti, 6–8 adhik months per 19 years, muhurat windows
  re-evaluated independently and shown to flip exactly at each boundary.
- **Reference fixtures** (`tests/fixtures/reference/`) — empty template only; the harness
  compares entries the human marks `"verified": true`.

## Why the major choices

- **astronomy-engine, not Swiss Ephemeris**: MIT licence (Swiss Ephemeris is AGPL or
  commercial), pure JS with no data files, accuracy of the order of an arcminute or better
  for the Sun and Moon, which is seconds to a couple of minutes for panchang times.
- **Pure core with explicit time/location parameters**: everything is deterministic and
  testable; the API and the page share one code path (`report.ts`); ESLint forbids
  `Date.now()`, argument-less `new Date()`, local-time accessors and I/O imports in
  `src/core`. Tests run with `TZ=Pacific/Chatham` to expose accidental system-zone use.
- **Root finding instead of rate approximations**: each element boundary is solved
  exactly on the real angular function, so kshaya/vriddhi fall out naturally and accuracy
  is limited only by the ephemeris.
- **Rules as validated JSON data**: priests and the human can edit rules without touching
  code; zod validation means a typo fails at startup and in tests rather than producing
  wrong dates. Each file has a provenance block.
- **Hashed API keys (SHA-256)**: keys are 256-bit random, so a fast hash is safe and keeps
  per-request auth cheap. Plaintext is printed once by the CLI.
- **Storage behind interfaces** (`KeyStore`, `UsageStore`, `BillingProvider`): hermetic
  unit tests, and Stripe/another database can be swapped in without touching handlers.
- **Drizzle with generated SQL migrations**: schema in TypeScript, reviewable SQL files in
  `drizzle/`, applied in order by Drizzle's migrator.
- **Server-rendered page with a GET form**: works on any phone without client JavaScript,
  shareable URLs for SEO, and it never touches the database (not metered).
