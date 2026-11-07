# HANDOFF.md — <Project name>

_Filled in by Claude at the end of the autonomous build._

## Status
<One paragraph: what works end to end right now.>

## Run it
```bash
cp .env.example .env
docker compose up        # or open in devcontainer
npm run db:migrate && npm run db:seed
npm test
```

## Done
<Feature list with test coverage notes.>

## Stubbed / mocked (the 20% that's yours)
| Area | Current mock | Interface to implement | Where |
|---|---|---|---|
| Auth | <mock session> | <file/interface> | <path> |
| Payments | | | |
| Prod database | local Postgres | connection via `DATABASE_URL` | `.env` |
| Deployment | none | | |

## Shortcuts and tech debt
<Anything done quickly that should be revisited, with file paths.>

## Blocked items
<Copied from PROGRESS.md, with what's needed to unblock each.>

## Suggested first enhancements
<3–5 concrete next steps, in order.>
