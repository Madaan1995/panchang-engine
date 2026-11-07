# Panchang Engine

Panchang (tithi, nakshatra, yoga, karana, vara, Rahu Kaal, choghadiya, lunar month,
festivals, muhurat) computed for **any city and timezone, including daylight saving**, as:

- a pure TypeScript library (`src/core`),
- a metered, API-key-authenticated HTTP API (`/api/v1/panchang`, `/festivals`, `/muhurat`, `/cities`),
- a phone-friendly web page (`/`).

```bash
cp .env.example .env
docker compose up        # http://localhost:3000
npm test                 # hermetic test suite
```

- `HANDOFF.md`: status, how to run it, what is mocked, and every UNVERIFIED value.
- `ARCHITECTURE.md`: modules, data flow, calculation conventions and their sources.
- `DECISIONS.md`: judgment calls made during the build.
- `SPEC.md`: the original specification.

Calculation results are astronomical computations under stated conventions. Religious
rules are editable data in `data/` with a provenance field and are **not** authoritative
until a priest has reviewed them.
