# Contributing

[🇧🇷 Português](CONTRIBUTING.md) · 🇺🇸 English

Thanks for wanting to help **Vacinas do Pet**! This guide explains how to open issues, run the project and send changes. Two ways of contributing need no programming: [proposing a vaccine for the catalog](#proposing-a-vaccine-for-the-catalog) and [translating the app](#translating-the-app).

By taking part, you agree to our [code of conduct](CODE_OF_CONDUCT.md).

## Opening an issue

Use the templates at [Issues → New issue](https://github.com/celsottg/petVaccines/issues/new/choose):

- **Bug:** something does not work as it should.
- **Suggestion:** an improvement or a new feature.
- **Catalog vaccine:** add or fix a vaccine.

Issues are written in Portuguese, but feel free to write in English if you are not comfortable with it. Search for a similar issue first. Issues labeled **good first issue** are a good place to start.

## Running the project

Requirements: [Node.js](https://nodejs.org) LTS and an Android/iOS emulator or a device.

```bash
npm ci
npx expo run:android   # or: npx expo run:ios
```

The app uses native libraries that are not in Expo Go, so it runs in a *development build*. The `android/` and `ios/` folders are generated; do not edit them by hand. Native settings live in `app.json`.

Before opening a pull request, run:

```bash
npm test            # tests
npm run lint        # lint
npm run typecheck   # types
```

### Code layout

- `src/app/`: screens (Expo Router routes).
- `src/domain/`: pure business rules, no React or database. Every new rule gets a test here.
- `src/data/`, `src/db/`: SQLite database and data access.
- `src/services/`: photos, notifications, PDF and backup.
- `src/catalog/`: vaccine catalog per country.
- `src/i18n/`: interface texts. **No text is hardcoded in the screens.**
- `src/theme/`: colors, spacing and typography.

Code (identifiers, tables, files and commits) is in English; the interface is in Portuguese.

## Commit convention

We use [Conventional Commits](https://www.conventionalcommits.org/en/), which lets us generate versions and the changelog automatically:

```
<type>(<optional scope>): <description in English, imperative mood>
```

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`. Examples:

```
feat(vaccinations): add booster shortcut
fix(reminders): skip reminders whose time already passed
docs: explain how to translate the app
```

## Pull requests

1. Create a branch from `main`.
2. Make the change, with tests when it makes sense.
3. Run the three verification commands.
4. Open the pull request and fill in the template. GitHub Actions runs lint, type check and tests automatically.

## Proposing a vaccine for the catalog

You **don't need to code**. Open an issue with the **Catalog vaccine** template and tell us:

- the vaccine name as it appears on the card;
- the species (dog or cat);
- the usual booster interval (for example, 1 year);
- a source, such as the package leaflet, veterinary guidance or a technical reference.

A maintainer turns the proposal into code. If you want to do it yourself, the catalog lives in `src/catalog/br.json`; each vaccine has a stable `id` (for example `br-dog-rabies`) that is never reused. The catalog content is reviewed by a veterinarian before each release.

## Translating the app

Also **no coding needed**. All texts live in one file per language under `src/i18n/` (Portuguese is `pt-BR.json`).

- **On GitHub, in the browser:** open `src/i18n/pt-BR.json`, copy its content, translate only the texts to the right of the `:` (keep the keys on the left and anything inside `{{ }}` unchanged) and open an issue with the **Suggestion** template pasting the translation. Or create the new file (for example `en.json`) with GitHub's *Add file* button, which opens the pull request for you.
- **Reviewing texts:** found a typo or a confusing text? Open an issue or edit `pt-BR.json` on GitHub.

Example:

```json
{ "pets": { "add": "Adicionar pet" } }
```

becomes, in English:

```json
{ "pets": { "add": "Add pet" } }
```

## Releasing

Only the repository owner cuts releases. The full procedure, with the criteria that must pass first, is in [docs/release-checklist.md](docs/release-checklist.md) (in Portuguese). The version and changelog part uses [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version), configured in `.versionrc.cjs`:

```bash
npm run release -- --dry-run        # shows what would be done, changing nothing
npm run release                     # bumps the version, updates CHANGELOG.md, commits and tags
npm run release -- --first-release  # first release only: does not change the version (already 1.0.0)
git push --follow-tags origin main
```

The command reads the Conventional Commits since the last tag: `fix` bumps the patch, `feat` the minor, and `feat!` (or a `BREAKING CHANGE:` footer) the major. It bumps the version in `package.json`, `package-lock.json` and `expo.version` in `app.json` together, writes `CHANGELOG.md` with Portuguese section titles and creates the `chore(release): X.Y.Z` commit and the `vX.Y.Z` tag. It pushes nothing to GitHub or the store. The Android `versionCode` is managed by EAS.

## Questions

Open an issue with the **Suggestion** template and describe your question.
