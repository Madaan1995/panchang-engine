# HANDOFF.md — Panchang Engine

_Filled in by Claude at the end of the autonomous build._

## Status
The core library computes, for any location, date and IANA timezone: sunrise/sunset and
moonrise/moonset (typed error at polar latitudes), the six panchanga elements with their
start/end times (kshaya and vriddhi flagged), Rahu Kaal, Yamaganda, Gulika, Abhijit,
Brahma muhurta, day and night choghadiya, the lunar month in amanta and purnimanta
systems with adhik maas, dates for 10 festivals, and muhurat windows for 4 ceremonies.
The Next.js app serves the API-key-authenticated, metered `/api/v1/{panchang,festivals,muhurat,cities}`
endpoints (Postgres for keys and usage) and a phone-friendly `/` page that renders from the
same core report. `npm run check` (typecheck, lint, 178 hermetic tests) passes, the 2
Postgres integration tests pass, and `docker compose up` from a clean clone brings up the
database and the app, applies migrations, seeds a dev key and serves both the page and the
API (verified in the build container; see "Shortcuts" for the one sandbox-only caveat).
**All astronomy conventions and all religious rule data are UNVERIFIED**: nothing has yet
been compared with an authoritative panchang.

## Run it
```bash
cp .env.example .env
docker compose up        # Postgres 16 + app on http://localhost:3000 (app runs migrate + seed on start)
```
Without Docker for the app (database only in Docker, or any local Postgres 16):
```bash
cp .env.example .env
docker compose up -d db
npm ci
npm run db:migrate && npm run db:seed
npm run dev              # http://localhost:3000
npm test                 # hermetic: no database, no network
npm run test:db          # Postgres integration tests (uses DATABASE_URL_TEST)
```
Try the API with the seeded development key from `.env`:
```bash
curl -H "Authorization: Bearer pk_live_dev_local_only_change_me" "http://localhost:3000/api/v1/panchang?city=montreal-ca&date=2026-03-08"
```
Create a real key (plaintext is printed once, only the hash is stored):
```bash
npm run key:create -- --name "PurohitDesk" --plan pro
```

## Done
| Feature | Where | Tests |
|---|---|---|
| Lahiri ayanamsa (documented, cited) | `src/core/ayanamsa.ts` | definitional anchor value, precession-rate and monotonicity properties |
| Sun/Moon tropical + sidereal longitudes | `src/core/positions.ts` | cross-checked vs astronomy-engine `GeoMoon`/`MoonPhase` |
| `sunTimes` / `moonTimes`, polar typed error | `src/core/riseSet.ts` | rise/set altitude re-derived with `Equator`/`Horizon`; Tromsø midnight sun + polar night; null moonrise days |
| Tithi, paksha, nakshatra + pada, yoga, karana, vara | `elements.ts`, `vara.ts` | formula properties; fixed karana positions; ±5 min around 24 new/full moons; "2 a.m. Tuesday is Monday" |
| Transitions (kshaya/vriddhi) | `transitions.ts`, `rootFinder.ts` | **24-lunation cross-check vs `SearchMoonPhase` (≤ 60 s; max 46.4 s)**; boundary value within 0.01°; strictly increasing, +1 mod N; kshaya and vriddhi found over a year |
| Day timings, choghadiya | `dayTimings.ts`, `data/day-timings.json`, `data/choghadiya.json` | equal-part math; table structure; **Montreal DST spring-forward/fall-back** (offsets, round-trip, equal durations, ±1 h sunrise jump) |
| Lunar month, adhik maas | `lunarCalendar.ts` | naming rule; Shukla agreement; Krishna +1; adhik ⇔ no sankranti; 6–8 adhik per 19 years |
| Festivals (10) | `festivals.ts`, `data/festivals.json`, `data/observance-windows.json` | found once per year in 4 cities × 4 years; month/paksha consistency; Diwali internal-consistency test; window definitions |
| Muhurat finder (4 ceremonies) | `muhurat.ts`, `data/muhurat-rules/*.json` | windows re-checked independently; rule flips exactly at every boundary; named causes match transitions; 366-day limit |
| City list (116) + search | `cities.ts`, `data/cities.json` | IANA validity, longitude/offset sanity, accent-insensitive search |
| API: auth, metering, quota, validation, errors | `src/server/*`, `src/app/api/v1/*` | 401/400 (with zod issues)/404/422/429, usage rows, `conventions` block, rate-limit headers; PgStore against real Postgres |
| Web page `/` | `src/web/*`, `src/app/page.tsx` | page report equals API report; SSR HTML contains picker (default Montreal) and all sections; mobile viewport; checked visually at 390 px width with no horizontal scroll |
| Reference-fixture harness | `tests/reference-fixtures.test.ts`, `tests/fixtures/reference/` | schema-checks every file; compares entries marked `"verified": true` (none yet) |

## Stubbed / mocked (the 20% that's yours)
| Area | Current mock | Interface to implement | Where |
|---|---|---|---|
| Auth | Real bearer-key auth with hashed keys; no signup, no revocation command (set `revoked_at` in SQL) | `KeyStore` | `src/server/store.ts`, `src/server/auth.ts` |
| Payments | `MockBillingProvider`: fixed quota per plan name (free 1,000 / starter 50,000 / pro 500,000 per month, placeholders) | `BillingProvider` | `src/server/billing.ts`, wired in `src/server/deps.ts` |
| Prod database | local Postgres | connection via `DATABASE_URL` | `.env` |
| Deployment | none; Dockerfile is a dev/demo image (full `node_modules`, runs migrations + seed on start) | — | `Dockerfile`, `docker-compose.yml` |
| Geocoding | bundled city list only | — | `data/cities.json`, `src/core/cities.ts` |
| Reference data | empty template | fill `tests/fixtures/reference/*.json` | `tests/fixtures/reference/README.md` |

## Values and rules still UNVERIFIED
| Item | Current value / rule | Where | How to verify |
|---|---|---|---|
| Lahiri ayanamsa | True 23°15′00.658″ at 1956-03-21 0h ET + IAU 2006 precession, nutation IAU 2000B. Gives mean 23°51′25.36″ at J2000.0 and true 24°13′18″ on 2026-01-01 (computed, not checked) | `src/core/ayanamsa.ts` | Compare nakshatra/yoga end times and sankranti times with a reference panchang; compare ayanamsa with the Indian Astronomical Ephemeris |
| Sunrise definition | Upper limb, 34′ refraction, ground level | `src/core/riseSet.ts` | Confirm the reference panchang uses the same; differences of 1–2 min usually mean a different definition |
| Apparent vs geometric Sun for tithi | Apparent (≈20.5″ aberration ⇒ ~30–46 s vs astronomy-engine moon phases) | `src/core/positions.ts` | Compare tithi end times with reference |
| Rahu Kaal / Yamaganda / Gulika weekday segments | Rahu [8,2,7,5,6,4,3], Yamaganda [5,4,3,2,1,7,6], Gulika [7,6,5,4,3,2,1] (Sun…Sat) | `data/day-timings.json` | Priest / reference panchang; fill `provenance` |
| Abhijit, Brahma muhurta | 8th of 15 day-muhurtas; 2 night-muhurtas ending at sunrise (per SPEC) | `data/day-timings.json` | Priest |
| Choghadiya sequences | 7 day + 7 night tables | `data/choghadiya.json` | Priest / reference |
| Observance windows | Pradosh = first 3 night-muhurtas; Nishita = 8th night-muhurta; Aparahna = 4th of 5 day parts | `data/observance-windows.json` | Priest |
| Festival rules (all 10) | month/paksha/tithi/rule as in file | `data/festivals.json` | Priest; fill each `provenance` |
| **Diwali month — SPEC appears reversed** | Encoded as amanta Ashvin = purnimanta Kartika Amavasya; SPEC says Kartika (amanta) / Ashvin (purnimanta). Reasoning in `DECISIONS.md` | `data/festivals.json`, `tests/festivals.test.ts` | Human decision |
| Rule approximations | Ram Navami & Ganesh Chaturthi use sunrise (traditionally Madhyahna); Karva Chauth uses Pradosh (traditionally moonrise); Bhadra avoidance not modelled | `data/festivals.json` | Priest; may need new rule types in code |
| Festival day-selection rule | Max window coverage, ties → earlier day, fallback flagged | `src/core/festivals.ts` | Compare computed dates with reference calendars |
| Computed 2026 festival dates, Montreal (for checking) | Maha Shivaratri 02-15, Holika Dahan 03-02, Ram Navami 03-26, Raksha Bandhan 08-27, Janmashtami 09-03, Ganesh Chaturthi 09-14, Navratri 10-11, Dussehra 10-20, Karva Chauth 10-28, Diwali 11-08 | `GET /api/v1/festivals?year=2026&city=montreal-ca` | Compare with a Canadian temple calendar |
| Adhik months detected (for checking) | Ashvin 2020, Shravana 2023, Jyeshtha 2026, Chaitra 2029, Bhadrapada 2031 | `src/core/lunarCalendar.ts` | Compare with a reference |
| Lunar month naming & purnimanta adhik handling | See ARCHITECTURE.md | `src/core/lunarCalendar.ts` | Reference panchang |
| Kshaya masa | Not flagged | `src/core/lunarCalendar.ts` | Decide whether to add |
| Karana fixed positions | Kimstughna k=0; Shakuni 57; Chatushpada 58; Naga 59 | `src/core/elements.ts` | Reference panchang |
| Muhurat rule sets (4) | Placeholder tithi/nakshatra/weekday lists, excludes Rahu/Yama/Gulika + Vishti, 15-min minimum | `data/muhurat-rules/*.json` | Priest; fill `provenance` |
| City coordinates | Approximate city centres (4 decimals) | `data/cities.json` | Gazetteer |
| Plan quotas | 1,000 / 50,000 / 500,000 | `src/server/billing.ts` | Pricing decision |

## Shortcuts and tech debt
- **Quota check is count-then-insert, not atomic** (`src/server/metering.ts`, `src/server/api.ts`): concurrent calls can exceed a quota by a few calls. Fix with a per-key monthly counter row and `UPDATE … RETURNING`, or `SELECT … FOR UPDATE`.
- **Usage rows are written synchronously** in the request path. At high volume, batch them or move them to a queue.
- **No caching.** Reports are deterministic for (date, location, options); responses could be cached (keep metering in front of the cache).
- **Only `lahiri` ayanamsa and one rise/set definition** are implemented; the option plumbing (`ayanamsa` enum, `conventions` block) is ready for more.
- **Day-level recomputation:** `muhurat.ts` and `report.ts` call `sunTimes` several times for the same day (about 0.6 s per year of muhurat search). Fine now; memoise if the API gets busy.
- **The Docker image is a development image** (dev dependencies installed, `tsx` runs migrations at start). Use a multi-stage build and a separate migration job for production.
- **Docker verification caveat:** the build container's network goes through a proxy, so the image was built with a throwaway variant of the Dockerfile that adds the proxy CA and host networking. The committed `Dockerfile` itself is unchanged and needs nothing special on a normal machine.
- **`npm audit`**: 0 issues in runtime dependencies; 11 moderate in dev tooling (drizzle-kit's esbuild, typescript-eslint's minimatch).
- **`.npmrc` sets `legacy-peer-deps=true`** to avoid an npm 10.9 resolver crash on vitest's optional peers (see DECISIONS.md).
- **Commit hygiene:** commit 47b5b19 (muhurat finder) contained a type error that the build's commit helper failed to catch; it was fixed in d97bb87. The Dockerfile and compose app service landed in commit 24d6f0a (the fixture-harness commit) instead of their own commit.

## Blocked items
None. Nothing needed credentials or a human decision to proceed. The items above that need
a human (reference data, the Diwali month question, priest review, pricing, Stripe,
deployment) were left as UNVERIFIED data or stubs rather than blocking the build.

## Suggested first enhancements
1. **Verify against a reference panchang**: fill `tests/fixtures/reference/` with ~20 dates × Montreal, Toronto and Vancouver (sunrise, tithi/nakshatra at sunrise and end times, Rahu Kaal, month). This settles the ayanamsa and sunrise convention questions.
2. **Settle the Diwali month question** and have a priest review `data/festivals.json`, `data/observance-windows.json` and `data/muhurat-rules/*.json`; fill every `provenance`. Add `madhyahna` and `moonrise` observance rules and Bhadra avoidance if the review asks for them.
3. **Make quota enforcement atomic** and add a key-revocation CLI (`revoked_at` already exists).
4. **Replace `MockBillingProvider` with Stripe** (plan lookup by customer) and add the customer/key mapping.
5. **Production deployment**: multi-stage Dockerfile, migrations as a release step, response caching, and a monitoring hook on 5xx/429 rates.
