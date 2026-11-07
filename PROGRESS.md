# PROGRESS.md — Panchang Engine build log

Generated from `SPEC.md` (Build order). One item = one commit. Each item is done
when its acceptance criteria are covered by tests and
`npm run typecheck && npm run lint && npm test` passes.

## 0. Setup
- [x] 0.1 Project scaffold: TypeScript strict, ESLint (with core-purity guard), Vitest, check scripts — `chore: scaffold project`

## 1. Astronomy layer
- [x] 1.1 Angle helpers + Lahiri ayanamsa function (documented, cited, UNVERIFIED) — Lahiri via 1956 anchor + IAU 2006 precession, property tests (`feat: add angle helpers and Lahiri ayanamsa`)
- [x] 1.2 Tropical and sidereal Sun/Moon longitudes at an instant — geocentric true-of-date longitudes, cross-checked vs GeoMoon/MoonPhase (`feat: add Sun and Moon tropical/sidereal longitudes`)
- [x] 1.3 `sunTimes(date, location)` with typed polar error — SearchRiseSet upper limb + 34′ refraction, typed polar error (`feat: add sunrise/sunset with typed polar error`)
- [x] 1.4 `moonTimes(date, location)` with nullable rise/set — moonrise/moonset nullable per local date (`feat: add moonrise/moonset with null for absent events`)

## 2. Panchanga elements at an instant
- [x] 2.1 Name tables (English transliteration + Devanagari) — English + Devanagari tables with structural tests (`feat: add element name tables in English and Devanagari`)
- [x] 2.2 Tithi/paksha, nakshatra/pada, yoga, karana at an instant — spec formulas + karana fixed positions, cross-checked vs moon phases (`feat: compute tithi, nakshatra, yoga and karana at an instant`)
- [x] 2.3 Vara at local sunrise (`elementsAt(instant, location)`) — vara = weekday of the sunrise that starts the panchang day (`feat: compute vara at local sunrise`)

## 3. Transitions
- [x] 3.1 Angle-crossing root finder — marching + Illinois regula falsi, 100 ms tolerance (`feat: add angle-crossing root finder for element boundaries`)
- [x] 3.2 Day transitions for every element (kshaya and vriddhi handled) — contiguous segments sunrise→next sunrise with kshaya/vriddhi flags (`feat: find start and end of every element in a panchang day`)
- [x] 3.3 Cross-check vs astronomy-engine new/full moons (24 lunations), boundary-value and property tests — 24 lunations within 60 s (max ~46 s, aberration), 0.01° boundary + monotonic property tests (`test: cross-check tithi transitions against astronomy-engine moon phases`)

## 4. Day timings
- [x] 4.1 Rahu Kaal / Yamaganda / Gulika from a data table — 8-part day split, weekday segment table in data/day-timings.json (UNVERIFIED) (`feat: add Rahu Kaal, Yamaganda and Gulika from a data table`)
- [x] 4.2 Abhijit muhurat and Brahma muhurta — 8th of 15 day-muhurtas; 2 night-muhurtas ending at sunrise (`feat: add Abhijit muhurat and Brahma muhurta`)
- [x] 4.3 Choghadiya (day + night) from a data table — 8 day + 8 night segments from data/choghadiya.json (UNVERIFIED) (`feat: add day and night choghadiya from a data table`)
- [x] 4.4 DST tests for Montreal spring-forward and fall-back days — tz-derived 2026 change dates; offsets, round-trip, equal durations, ±1 h sunrise jump (`test: add Montreal DST tests for day timings`)

## 5. Lunar calendar
- [ ] 5.1 Lunar month name in amanta and purnimanta systems
- [ ] 5.2 Adhik maas detection

## 6. Festivals
- [ ] 6.1 `data/festivals.json` (10 festivals) + observance-window data
- [ ] 6.2 `festivals(year, location)` + Diwali internal-consistency test

## 7. Muhurat finder
- [ ] 7.1 Muhurat rule sets in `data/muhurat-rules/*.json`
- [ ] 7.2 `findMuhurats(ceremony, dateRange, location)` with boundary-alignment tests and 366-day limit

## 8. API
- [ ] 8.1 Bundled city list + lookup
- [ ] 8.2 Request validation (zod) and response builders with `conventions` block
- [ ] 8.3 Postgres schema, SQL migrations, migrate/seed scripts, docker compose
- [ ] 8.4 API keys: hashing, CLI to create keys, bearer auth
- [ ] 8.5 Metering, monthly quota, `BillingProvider` mock
- [ ] 8.6 Route handlers: panchang, festivals, muhurat, cities (400/404/429 behaviour)

## 9. Web page
- [ ] 9.1 `/` today's panchang with city picker, mobile friendly, uses core library

## 10. Docs and handoff
- [ ] 10.1 ARCHITECTURE.md, HANDOFF.md, docker compose verification

## Blocked
_None yet._
