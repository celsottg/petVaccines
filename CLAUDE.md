# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Vacinas do Pet": an open-source, 100% local (no account, server, ads or analytics) Expo/React Native app that stores dog/cat vaccination records with proof photos and local reminders. The project is in the MVP phase; the design spec and implementation plan live in `docs/superpowers/specs/` and `docs/superpowers/plans/`. Check them before building new features, since much of the planned structure (see below) doesn't exist yet. `AGENTS.md` also applies (Expo docs must be fetched for the installed SDK version, which is 58, rather than trusting memory).

## Commands

```bash
npm test                          # Jest (jest-expo preset)
npx jest path/to/file.test.tsx    # single test file
npx jest -t "test name"           # single test by name
npm run lint                      # expo lint (ESLint flat config)
npm run typecheck                 # tsc --noEmit
npx expo start                    # dev server
npx expo run:android | run:ios    # build and run the dev client
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, typecheck and `npm test -- --ci`. Run all three before declaring work done.

- The app uses native modules, so it needs a development build; Expo Go does not work.
- `android/` and `ios/` are generated (CNG). Never edit them by hand; configure through `app.json` and config plugins.
- `jest/globalSetup.js` forces `TZ=America/Sao_Paulo` so date rules are tested against the UTC-3 local-day rollover. Don't depend on the machine's timezone in tests.

## Architecture

- Expo Router, routes in `src/app/` only; non-route code stays outside it. The `@/*` alias maps to `src/*`.
- Intended layering (from CONTRIBUTING.md): `src/domain/` pure business rules (no React, no DB; every new rule gets tests here), `src/data/` + `src/db/` SQLite access, `src/services/` photos/notifications/PDF/backup, `src/catalog/` per-country vaccine catalog, `src/i18n/`, `src/theme/`. Only `app`, `domain`, `i18n` and `theme` exist so far.
- Screen tests live in `src/__tests__/app/`, mirroring the route path, because every file under `src/app/` becomes a route. Other tests sit next to the file they test (`src/domain/status.test.ts`).
- Domain rules (`src/domain/`):
  - Dates: calendar dates are `IsoDate` text (`YYYY-MM-DD`); instants are ISO 8601 UTC strings. Get "today" with `todayLocal()` (device local date), never `new Date().toISOString().slice(0, 10)`, which is a day ahead after 21:00 in UTC-3. Do date math only through `addDays`/`diffDays` (`dates.ts`), which compute at 12:00 UTC so DST can't shift a day.
  - Status (`status.ts`): `getStatus(nextDueOn, today, dueSoonDays)` → `overdue` from the day after the due date, `due_soon` from today up to `dueSoonDays` days ahead (inclusive), otherwise `ok` (also when there is no next dose). `worstStatus` picks the worst for a pet's badge.
  - Same vaccine (`current.ts`): always compare vaccines with `vaccineKey()` (catalog id, or the free name without accents/case/spaces), never by raw name. `splitCurrent()` returns the current record per vaccine (latest `appliedOn`, ties broken by latest `createdAt`) and the previous ones, both in input order; only current records get status badges and reminders.
  - `suggestNextDue(appliedOn, boosterIntervalDays)` (`nextDose.ts`) adds days, not years.
- i18n: `src/i18n/index.ts` creates an isolated i18next instance (pt-BR only for now) and is imported first in `_layout.tsx`. All UI strings go in `src/i18n/pt-BR.json`; `src/__tests__/app/no-hardcoded-text.test.ts` fails on hardcoded text in screens.
- Theme: `useTheme()` from `@/theme` returns the palette for the current color scheme plus spacing/radius/typography tokens. Status colors (`ok`, `dueSoon`, `overdue`, `neutral`) are semantic. Don't hardcode colors in components.
- `src/__tests__/projectConfig.test.ts` and `environment.test.ts` guard project configuration, so config changes (app.json, package.json) may need those tests updated.

## Conventions

- Code, identifiers, DB tables, files and commit messages are in English; the UI and issues are in Portuguese.
- Conventional Commits: `<type>(<scope>): <imperative description in English>` (used to generate versions/changelog).
- License is GPL-3.0-only.
