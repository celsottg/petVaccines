# Vacinas do Pet privacy policy

[🇧🇷 Português](privacy-policy.md) · 🇺🇸 English

The app interface is in Brazilian Portuguese. This is the English version of the [Portuguese policy](privacy-policy.md); both say the same thing.

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

## Device permissions and what they are for

- **Camera.** Requested only when you tap **Tirar foto** (Take photo), to photograph a vaccination receipt or a pet's photo. The photo is stored on your device. If you refuse, the app keeps working and you can choose a photo from the gallery.
- **Photo library.** The app uses the system photo picker when you tap **Escolher da galeria** (Choose from gallery). The app only receives the image you choose, and does not ask permission to see your gallery.
- **Notifications.** Requested after you save the first vaccination that has a next-dose date, to warn you of the due date. Reminders are **local notifications**, scheduled by the device itself at 09:00: there is no server-based (push) notification service and nothing leaves the device. A reminder's text contains the pet's name and the vaccine name and is shown according to your device's notification and lock-screen settings. If you refuse the permission, the app keeps working, without reminders.

The app does not use location, microphone, contacts or any other device feature to collect information.

## Photos

Each photo you add is scaled down (the longer side is at most 2048 pixels) and saved again as a JPEG on the device itself. The app is designed to keep only that new copy, without the original photo's metadata, including location (GPS). The original photo stays where it was (for example, in your gallery) and the app does not change it.

## PDF and backup: what leaves the device and when

- **PDF of the card.** It is generated on the device when you tap **Exportar PDF** (Export PDF). It includes the pet's data, the vaccinations and the receipt photos.
- **Backup file.** It is a `.zip` file generated on the device when you tap **Fazer backup agora** (Back up now). It contains **all the app's data and all the photos** and **is not encrypted**: anyone who has the file can read its contents.
- Both files leave the device **only if you choose**, in the system share menu (for example, e-mail, WhatsApp, Google Drive or Files). From then on the file is under the control of the app or person that received it, and this policy does not apply to them. Choose carefully where you send it and where you keep the backup.
- When you **restore** a backup, you choose the file with the system picker and the app reads it on the device itself. Nothing is sent.

## Android system backup

Android may, when the system backup feature is turned on on your device, copy app data to your Google account. This is done by the operating system and controlled by you in the device settings, not by Vacinas do Pet, which has no access to that copy and does not send it.
<!-- Remove this section if android.allowBackup becomes false in app.json. -->

## How to delete your data

Uninstalling the app or clearing its data in Android settings deletes the pets, vaccinations, photos and preferences from the device. The app keeps no copy on a server, so the data can only be recovered from a backup file that **you** have kept (or from a system copy, if one exists, as described in the previous section). PDF and backup files you already sent elsewhere are not deleted along with the app.

## Links that leave the app

The only link in the app that opens something outside it is the code repository link, in **Ajustes e sobre** (Settings and about). It opens in the system browser when you tap **Abrir o repositório no navegador** (Open the repository in the browser). From then on, browsing is up to your browser and the site opened, GitHub, which has its own policy. The app makes no other network requests and works normally in airplane mode.

## Children

The app is not directed at children. Since it collects no one's data, no children's data is collected.

## Contact

For questions, corrections or requests about this policy, open an issue at <https://github.com/celsottg/petVaccines/issues>.

## Changes to this policy

When this policy changes, the effective date at the top is updated and the document's change history stays public in the repository. This version will be available at the same address given in the app's store listing.
