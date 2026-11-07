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
