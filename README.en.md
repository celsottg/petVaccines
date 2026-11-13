# Vacinas do Pet

[🇧🇷 Português](README.md) · 🇺🇸 English

An open source mobile app to keep the vaccination card of dogs and cats, with a photo of the receipt for each dose and reminders for the next one.

- **100% local:** no account, no login, no server. Data stays on your device and the app works in airplane mode.
- **No ads, tracking or analytics.**
- Built with [Expo](https://expo.dev) and React Native, for Android and iOS.

> **Status:** in development (MVP). See the [MVP design](docs/superpowers/specs/2026-11-12-pet-vaccines-design.md) and the [implementation plan](docs/superpowers/plans/2026-11-12-pet-vaccines-mvp.md) (both in Portuguese).

The app interface is in Brazilian Portuguese for now; the project is structured to support other languages and countries.

## Features

- Pet profiles (dogs and cats), with photo.
- Vaccination records: date, next dose, batch, brand, veterinarian, license number (CRMV), clinic and notes.
- Up to 3 receipt photos per record.
- Status of each vaccine: up to date, due soon, overdue.
- Next dose suggestion from a Brazilian vaccine catalog.
- Local notification reminders 7 days before and on the due date.
- PDF export of the card and backup to a `.zip` file.

> Records are declared by the pet owner. They do not replace the vaccination card issued by the veterinarian.

> **Vaccine catalog:** the initial content (`src/catalog/br.json`) is still awaiting veterinary review and must not be treated as clinical advice before the first release.

## Running

Requirements: [Node.js](https://nodejs.org) LTS and an Android/iOS emulator or a device.

```bash
git clone https://github.com/celsottg/petVaccines.git
cd petVaccines
npm ci
npx expo run:android   # or: npx expo run:ios
```

The app uses native libraries that are not in Expo Go, so it runs in a [development build](https://docs.expo.dev/develop/development-builds/introduction/). You can also build it in the cloud with `npx eas-cli@latest build --profile development`.

### Useful commands

| Command | What it does |
|---|---|
| `npm test` | tests (Jest), in the `America/Sao_Paulo` timezone |
| `npm run lint` | lint (ESLint) |
| `npm run typecheck` | type check (TypeScript) |
| `npx expo start` | development server |

## Backup file

A backup is a `petvaccines-backup-YYYY-MM-DD.zip` file built on the device (nothing goes through a server). It contains:

- `data.json`: plain, readable JSON you can open in any editor. It has `format` (`petvaccines-backup`), `schemaVersion`, `appVersion`, `exportedAt`, the lists `pets`, `vaccinations` and `attachments`, and the `settings` object (only `backup_warning_days`, `due_soon_days` and `reminder_offsets_days`). Each list row uses the database column names in snake_case (`pet_id`, `applied_on`, `next_due_on`...), and optional fields are present with `null`. Archived pets are included.
- `photos/<file>`: proof photos; the name is the `file` value of the row in `attachments` (`<uuid>.jpg`).
- `pets/<file>`: pet profile photos; the name is the pet's `photo_file` value (`<uuid>.jpg`).

Integrity rules, checked by the schema itself: every vaccination points to a pet in the file, every attachment to a vaccination in the file, ids are unique, file names are not repeated, a vaccination has at most 3 attachments and an active pet carries no archive data.

The format is defined by a single Zod schema in `src/services/backup/schema.ts`. Versioning rule: `schemaVersion` only goes up when the format changes, and a newer app must keep reading backups from older versions, converting them on read.

## Contributing

Contributions are very welcome, including non-code ones: suggesting vaccines for the catalog, reviewing texts and translating. Read the [contributing guide](CONTRIBUTING.en.md) and the [code of conduct](CODE_OF_CONDUCT.md).

## License

[GPLv3](LICENSE).

### How to restore a backup

Go to **Backup > Restaurar (Restore) > Importar backup de um arquivo (Import a backup file)** and choose the `.zip`. The app extracts it into a temporary folder, validates it and shows a summary (backup date, pets, vaccinations, photos, app version) before changing anything.

- **It replaces everything.** On confirmation, the pets, vaccinations, photos and preferences on the device are swapped for the backup's, and what was there before cannot be recovered. There is no merging. On an empty device the wording is neutral.
- **Atomic.** The database is replaced in a single transaction. If anything fails, the previous data stays as it was.
- **Missing photos.** A photo named in `data.json` but absent from the `.zip` does not block the restore: the rest is imported and the app says how many were left out.
- **Backup from a newer app version.** The app asks you to update it and imports nothing. Backups from earlier versions are still accepted.
- **Invalid or tampered file.** A `.zip` that is not an app backup, has invalid JSON, content outside the format or unexpected entries is refused without touching the data.
- After a restore the stale-backup warning does not show (the data equals the backup) and reminders are rescheduled.
