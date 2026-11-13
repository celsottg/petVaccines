# Vacinas do Pet privacy policy

[🇧🇷 Português](privacy-policy.md) · 🇺🇸 English

This is the English version of the [Portuguese policy](privacy-policy.md); both say the same thing.

**Effective date:** [FILL IN: date this version takes effect, before publishing]

## In short

Vacinas do Pet **does not collect, send or share any of your data**. There is no account, no login and no app server. Everything you record stays **only on your device**. The app has no ads, no tracking and no analytics tools.

## Who publishes the app

Vacinas do Pet is an open source app, licensed under the GPL-3.0, maintained by the project on GitHub: <https://github.com/celsottg/petVaccines>. Publisher on the store: [FILL IN: publisher name exactly as in the Play Console]. Anyone can read the code to check what is written here.

## What data stays on the device

Everything you type or photograph in the app is stored only in the app's internal storage on your device:

- pet data: name, species, breed, sex, date of birth, profile photo and, if applicable, the reason and date the card was closed;
- vaccination records: vaccine name, dates, batch, brand, clinic, notes and the **veterinarian's name and license number (CRMV)**, when you type them;
- photos of vaccination receipts;
- your preferences (the "due soon" window, how long before the due date reminders arrive, the backup warning window) and the date of the last backup.

The app does not send this data to anyone and has no way to read it from outside the device.

## Device permissions

**What the app asks you for, and when.**

- **Camera.** Requested when you tap **Tirar foto** (Take photo), to photograph a vaccination receipt or a pet's photo. The photo is stored on your device. If you refuse, the app keeps working and you can choose a photo from the gallery.
- **Notifications.** On Android 13 or later, requested after you save the first vaccination that has a next-dose date, to warn you of the due date. On earlier versions the system does not ask. Reminders are **local notifications**, scheduled by the device itself at 09:00: there is no server-based (push) notification service and nothing leaves the device. A reminder's text contains the pet's name and the vaccine name and is shown according to your device's notification and lock-screen settings. If you refuse, the app keeps working, without reminders.
- **Photo gallery.** The app does not request access to your gallery while you use it. When you tap **Escolher da galeria** (Choose from gallery), the system photo picker opens and hands the app only the image you chose.

**What the installed app declares without asking you.** Android shows the list of permissions an app declares, including ones that never trigger a question. From the declarations of the libraries the app uses, this is the expected list; it will be checked against the production build before the release:

- `INTERNET`: declared by the app's framework and by file and image libraries. The app's code makes no network request.
- `ACCESS_NETWORK_STATE`: declared by the image library. The app only displays images that are on the device itself.
- Legacy storage access (`READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE`, applying only on Android 12 and earlier): declared by the photo and file libraries. The app's code does not request them.
- `RECEIVE_BOOT_COMPLETED` and `POST_NOTIFICATIONS`: declared by the notifications library, so that scheduled reminders survive a device restart and so that notifications can be shown.
- `VIBRATE`: declared by the framework's base template, used by the system for notifications; the app's code does not trigger vibration.
- `SYSTEM_ALERT_WINDOW`: also comes from the framework's base template; the app's code does not use it.

The app does not use location, microphone, contacts or any other device feature to collect information.

## Photos

Each photo you add is scaled down (the longer side is at most 2048 pixels) and saved again as a JPEG on the device itself. The app is designed to keep only that new copy, without the original photo's metadata, including location (GPS). The original photo stays where it was (for example, in your gallery) and the app does not change it.

## PDF and backup: what leaves the device and when

- **PDF of the card.** It is generated on the device when you tap **Exportar PDF** (Export PDF). It includes the pet's data, the vaccinations and the receipt photos.
- **Backup file.** It is a `.zip` file generated on the device when you tap **Fazer backup agora** (Back up now). It contains **all the app's data and all the photos** and **is not encrypted**: anyone who has the file can read its contents.
- Both files leave the device **only if you choose**, in the system share menu (for example, e-mail, WhatsApp, Google Drive or Files). From then on the file is under the control of the app or person that received it, and this policy does not apply to them. Choose carefully where you send it and where you keep the backup.
- When you **restore** a backup, you choose the file with the system picker and the app reads it on the device itself. Nothing is sent.

## How to delete your data

Uninstalling the app or clearing its data in Android settings deletes the pets, vaccinations, photos and preferences from the device. The app keeps no copy on a server and does not allow the Android system to copy its data to the cloud, so the data can only be recovered from a backup file that **you** have kept. PDF and backup files you already sent elsewhere are not deleted along with the app.

## Links that leave the app

The only link in the app that opens something outside it is the code repository link, in **Ajustes e sobre** (Settings and about). It opens in the system browser when you tap **Abrir o repositório no navegador** (Open the repository in the browser). From then on, browsing is up to your browser and the site opened, GitHub, which has its own policy. The app makes no other network requests and works normally in airplane mode.

## Children

The app is not directed at children. Since it collects no one's data, no children's data is collected.

## Contact

For questions, corrections or requests about this policy, open an issue at <https://github.com/celsottg/petVaccines/issues>.

## Changes to this policy

When this policy changes, the effective date at the top is updated and the document's change history stays public in the repository. This version will be available at the same address given in the app's store listing.
