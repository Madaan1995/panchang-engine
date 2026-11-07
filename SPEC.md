# SPEC.md — Panchang Engine

## Problem and users
Hindu priests, temples and families outside India need accurate panchang data (tithi, nakshatra, auspicious and inauspicious periods) and muhurat windows **for their own city and timezone**, including daylight-saving changes. Most sources are tuned for India, and correct local times for Montreal, Toronto or Vancouver are easy to get wrong.

This project is a calculation engine plus a paid API and a small web page:
- **Core library** (pure TypeScript): computes the panchang and finds muhurat windows for any location, date and timezone.
- **HTTP API**: API-key authenticated, metered per call, for temple websites and apps (first consumer: PurohitDesk).
- **Web page**: today's panchang for a chosen city, as a demo and SEO entry point.

Calculation results are astronomical computations under stated conventions. Religious rule sets (which tithis suit a ceremony) are **editable data with a provenance field**, never presented as authoritative.

## Stack
- TypeScript (strict), Node 20+
- `astronomy-engine` (MIT) for Sun/Moon positions, rise/set and moon phases
- Next.js (App Router) for the API route handlers and the web page
- Postgres 16 for API keys and usage metering (Drizzle ORM, SQL migration files). In cloud sessions use the preinstalled PostgreSQL (`service postgresql start`); locally via `docker compose`.
- Vitest for tests; `fast-check` allowed for property-based tests
- zod for request validation
- Luxon (or Temporal polyfill) for timezone and DST handling, never manual UTC offsets

## Licensing rule (hard)
Only MIT / Apache-2.0 / BSD / ISC dependencies. **Do not use Swiss Ephemeris or any AGPL/GPL code**; this is a commercial product. Record each dependency's licence in `DECISIONS.md`.

## Conventions (defaults; all configurable per request)
- Ayanamsa: **Lahiri (Chitrapaksha)**. Implement it as a documented function; cite the formula's source in a code comment. Mark it `UNVERIFIED` until the human checks it against reference data.
- Lunar month system: **purnimanta** default (common in North India), **amanta** supported via a `monthSystem` option.
- Day boundary: a panchang "day" runs sunrise to next sunrise, using the upper limb of the Sun with standard refraction. Document the exact rise/set definition used.
- All input and output times are timezone-aware ISO 8601 in the location's IANA zone.

## Build order
1. Astronomy layer: sidereal Sun and Moon longitudes, sunrise/sunset/moonrise/moonset for a location
2. Panchanga elements at an instant: tithi, paksha, nakshatra (with pada), yoga, karana, vara
3. Transition finder: start/end times of each element (root finding on angular functions)
4. Day timings: Rahu Kaal, Yamaganda, Gulika Kaal, Abhijit muhurat, Brahma muhurta, choghadiya (day and night)
5. Lunar calendar: month name, paksha, adhik (leap) month detection, both month systems
6. Festivals: rule-driven data, about 10 major festivals
7. Muhurat finder
8. API, API keys, metering
9. Web page
10. Docs and handoff

## Features and acceptance criteria

### 1. Astronomy layer
- `sunTimes(date, location)` returns sunrise and sunset; `moonTimes` returns moonrise and moonset, either of which may be absent on a given day (return null, don't throw).
- Locations where the Sun doesn't rise or set on a date (polar) return a typed error, not a wrong time.
- Sidereal longitude = tropical longitude − ayanamsa, normalised to [0°, 360°).

### 2. Panchanga elements
- Tithi = floor((moon − sun) / 12°) + 1 over 1..30; tithis 1–15 Shukla, 16–30 Krishna.
- Nakshatra = floor(moon_sidereal / (360°/27)) + 1; pada = quarter within it.
- Yoga = floor(((sun_sidereal + moon_sidereal) mod 360°) / (360°/27)) + 1.
- Karana: 60 half-tithis mapped to the 11 karanas (4 fixed, 7 repeating), with the fixed ones in the correct positions.
- Vara is the weekday **at local sunrise**, so 2 a.m. Tuesday local time is still Monday's panchang.
- Names returned in English transliteration plus Sanskrit (Devanagari) for each element.

### 3. Transitions
- For a panchang day, return every element's start and end, including elements that start and end within the day (kshaya tithi) and ones spanning two sunrises (vriddhi tithi).
- **Cross-check test (independent of the root finder):** across 24 consecutive lunations, the computed end of Amavasya (tithi 30) equals `astronomy-engine`'s new-moon time, and the end of Purnima (tithi 15) equals its full-moon time, within 60 seconds.
- At every computed transition instant, the angular function equals the boundary value within 0.01°.
- Property test: transitions are strictly increasing; tithi numbers advance by exactly 1 mod 30.

### 4. Day timings
- Rahu Kaal, Yamaganda, Gulika: day (sunrise→sunset) split into 8 equal parts; the segment index per weekday comes from a documented lookup table.
- Abhijit muhurat: 8th of 15 equal day-muhurtas. Brahma muhurta: the 2 muhurtas (each 1/15 of night) ending at sunrise, where night = previous sunset to sunrise.
- Choghadiya: 8 day and 8 night segments with the standard weekday sequences, as a data table.
- **DST test:** for Montreal (America/Toronto) on the spring-forward and fall-back dates of a given year, all times are correct local wall-clock times, and no segment has a negative or doubled duration.

### 5. Lunar calendar
- Month name per purnimanta and amanta for any date; both systems agree on the month of Shukla paksha dates.
- Adhik maas detected when a lunar month contains no solar sankranti; returned as a flag.

### 6. Festivals
- Festivals defined in `data/festivals.json`: name, month, paksha, tithi, observance rule (`tithi_at_sunrise` | `tithi_at_midnight` | `tithi_during_pradosh` | `tithi_during_aparahna`), region notes, and `provenance` (who verified, source, date; empty until the human verifies).
- At least: Diwali (Lakshmi Puja), Janmashtami, Ram Navami, Maha Shivaratri, Holi (Holika Dahan), Navratri start, Dussehra, Karva Chauth, Raksha Bandhan, Ganesh Chaturthi.
- `festivals(year, location)` returns local dates and the deciding time window.
- Internal consistency test: Diwali falls on Amavasya of Kartika (amanta) / Ashvin (purnimanta). This is **not** a correctness proof; the human's reference fixtures are.

### 7. Muhurat finder
- Rule sets in `data/muhurat-rules/*.json` per ceremony (e.g. griha pravesh, vivah, namkaran, mundan): allowed tithis, nakshatras, weekdays, and excluded periods (Rahu Kaal, Yamaganda, Gulika, specific karanas such as Vishti/Bhadra). Every file has `provenance` and a header `UNVERIFIED — rules must be reviewed by a priest`.
- `findMuhurats(ceremony, dateRange, location)` returns windows where all inclusion rules hold and no exclusion applies, with the reason each window qualifies.
- Window boundaries align to the element transitions that create them (tested).
- Range limited to 366 days per call.

### 8. API
- `GET /api/v1/panchang?date=&lat=&lon=&tz=` (or `&city=`), `GET /api/v1/festivals?year=&...`, `GET /api/v1/muhurat?ceremony=&from=&to=&...`, `GET /api/v1/cities?q=`
- Bundled city list (`data/cities.json`, ~100 cities with lat/lon/IANA tz, emphasising Canadian, US, UK and Indian cities with large Hindu communities).
- Auth: `Authorization: Bearer <key>`. Keys stored **hashed** (never plaintext); a CLI script creates keys and prints the plaintext once.
- Metering: each authenticated call appends a usage row (key, endpoint, timestamp, status). Monthly quota per key; over quota → 429 with a clear message.
- Invalid input → 400 with zod error detail. Unknown city → 404.
- Responses include a `conventions` block (ayanamsa, month system, rise definition) so consumers know exactly what they got.

### 9. Web page
- `/` shows today's panchang for a city picker (defaults to Montreal), works on a phone, no login, not metered.
- Page renders from the same core library functions, not a separate code path.

## External services (stub behind interfaces)
| Service | Purpose | Mock behaviour |
|---|---|---|
| Billing (Stripe) | Paid plans | `BillingProvider` interface; mock assigns a fixed quota per plan name |
| Geocoding | City lookup beyond the bundled list | Not built; bundled list only |

## Out of scope
- Real billing, signup flow, customer dashboard
- Horoscope / kundli / birth charts
- Languages beyond English + Devanagari names
- Deployment

## Reserved for the human (the 20%)
- Verify ~20 dates × 3 cities against an authoritative panchang; record them in `tests/fixtures/reference/*.json` with source and date checked
- Confirm or adjust the ayanamsa implementation against those fixtures
- Have a priest review festival rules and muhurat rule sets; fill in `provenance`
- Stripe integration, pricing, deployment, PurohitDesk integration
