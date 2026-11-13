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

## Contributing

Contributions are very welcome, including non-code ones: suggesting vaccines for the catalog, reviewing texts and translating. Read the [contributing guide](CONTRIBUTING.en.md) and the [code of conduct](CODE_OF_CONDUCT.md).

## License

[GPLv3](LICENSE).
