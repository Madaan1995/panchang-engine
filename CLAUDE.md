# CLAUDE.md — Autonomous build rules

You are building this project unattended. A human takes over at the end, so optimize for a codebase they can understand and extend. The human is an experienced data engineer but new to web app development: favour plain, explicit code over clever abstractions, and comment the *why* of any astronomy or calendar rule.

## Sources of truth
- `SPEC.md` — what to build. Never edit it. If it is ambiguous, pick the simplest reading, record it in `DECISIONS.md`, and continue.
- `PROGRESS.md` — your task list. On the first run, generate it from `SPEC.md` as small, independently testable checklist items, following the spec's **Build order**.

## The loop (one item per iteration)
1. Read `PROGRESS.md` and pick the next unchecked item.
2. Implement it.
3. Run `npm run typecheck && npm run lint && npm test`. All must pass.
4. Commit with a conventional message (`feat:`, `fix:`, `test:`, `chore:`), one item per commit. Push the branch.
5. Check the item off in `PROGRESS.md` with a one-line note.

## Definition of done (per item)
- Acceptance criteria from `SPEC.md` covered by automated tests.
- The check command above passes from a clean checkout.

## Hard rules
- Never delete, skip or weaken a test to make it pass. If a test is wrong, fix it and explain why in `DECISIONS.md`. Never loosen a numeric tolerance without recording the before/after values and the reason.
- **Never invent reference data.** Do not write "expected" panchang values from memory into tests as if they were verified. Correctness tests must be either (a) internal cross-checks against independent `astronomy-engine` functions, (b) mathematical/property checks, or (c) reference fixtures marked `verified: false` that the human will confirm. Say which in each test name.
- Core calculation code is pure: no I/O, no `Date.now()`, no system timezone. Time and location are always parameters.
- Only MIT / Apache-2.0 / BSD / ISC dependencies. No Swiss Ephemeris, no AGPL/GPL.
- Religious rules live in `data/` as JSON with `provenance`, never hard-coded in logic.
- No secrets in code or commits. Config via env vars; keep `.env.example` current.
- Database changes go in migration files only.
- No network calls in tests.
- Commit the lockfile. Add a dependency only if it removes real work; note it and its licence in `DECISIONS.md`.
- If blocked (credentials, network, a human decision), log it under **Blocked** in `PROGRESS.md` and move to the next item.

## Stop condition
When every item is done or only blocked items remain:
1. Write `ARCHITECTURE.md`: modules, data flow, every calculation convention and its source, and the reason behind each major choice.
2. Fill in `HANDOFF.md` from the template, including a table of every value or rule still marked UNVERIFIED.
3. Confirm `docker compose up` runs the app and database from a clean clone.
4. Final commit: `chore: handoff`.
