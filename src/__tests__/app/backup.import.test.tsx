import { act, fireEvent } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { unzip } from 'react-native-zip-archive';

import BackupScreen from '@/app/backup';
import { addAttachment } from '@/data/attachments';
import { createPet } from '@/data/pets';
import { getSettings, setSetting } from '@/data/settings';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { attachments, pets, settings, vaccinations } from '@/db/schema';
import { fakeFs } from '@/services/fakeFileSystem';
import { sampleBackup } from '@/services/backup/fixture';
import * as backupImport from '@/services/backup/import';
import type { BackupData } from '@/services/backup/schema';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));
jest.mock('expo-file-system', () => jest.requireActual('@/services/fakeFileSystem').fakeModule);
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('react-native-zip-archive', () => ({ unzip: jest.fn(), zip: jest.fn() }));

const unzipMock = jest.mocked(unzip);
const pickerMock = jest.mocked(DocumentPicker.getDocumentAsync);

const ZIP = 'file:///cache/picked.zip';
const PET_PHOTO = '33333333-3333-4333-8333-333333333333.jpg';
const PROOF = '44444444-4444-4444-8444-444444444444.jpg';
const routes = { index: () => null, backup: BackupScreen, settings: () => null };
const renderBackup = () => renderRouter(routes, { initialUrl: '/backup' });
const importButton = () => screen.getByRole('button', { name: 'Importar backup de um arquivo' });

let zipContent: Record<string, string | number>;
let alertSpy: jest.SpyInstance;

const withData = (data: BackupData = sampleBackup()) => ({
  'data.json': JSON.stringify(data),
  [`pets/${PET_PHOTO}`]: 10,
  [`photos/${PROOF}`]: 10,
});

beforeEach(() => {
  jest.clearAllMocks();
  fakeFs.reset();
  fakeFs.addDir('file:///cache');
  fakeFs.addFile(ZIP, 100);
  db.delete(pets).run();
  db.delete(settings).run();
  zipContent = withData();
  pickerMock.mockResolvedValue({ canceled: false, assets: [{ uri: ZIP, name: 'backup.zip', lastModified: 0 }] });
  unzipMock.mockImplementation(async (_source, target) => {
    fakeFs.addDir(target);
    for (const [path, content] of Object.entries(zipContent)) {
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i += 1) fakeFs.addDir(`${target}/${parts.slice(0, i).join('/')}`);
      fakeFs.addFile(`${target}/${path}`, 10, typeof content === 'string' ? { text: content } : {});
    }
    return target;
  });
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

function existingPet() {
  const pet = createPet(db, { name: 'Antigo', species: 'dog' });
  const vaccination = createVaccination(db, { petId: pet.id, vaccineName: 'Antiga', appliedOn: '2026-01-01' });
  addAttachment(db, { id: '88888888-8888-4888-8888-888888888881', vaccinationId: vaccination.id, file: '88888888-8888-4888-8888-888888888881.jpg', sizeBytes: 1, width: 1, height: 1 });
  fakeFs.addFile('file:///docs/photos/88888888-8888-4888-8888-888888888881.jpg');
  setSetting(db, 'due_soon_days', 99);
}

describe('Backup screen: restore', () => {
  it('shows the Restaurar section with its hint', async () => {
    await renderBackup();

    expect(screen.getByText('Restaurar')).toBeOnTheScreen();
    expect(importButton()).toBeOnTheScreen();
    expect(screen.getByText(/Use ao trocar de celular/)).toBeOnTheScreen();
  });

  it('does nothing when the picker is cancelled', async () => {
    pickerMock.mockResolvedValue({ canceled: true, assets: null });
    await renderBackup();

    await fireEvent.press(importButton());

    expect(unzipMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Restaurar este backup?')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['a file that is not a backup', { 'data.json': '{"a":1}' }, 'Este arquivo não é um backup do Vacinas do Pet. Escolha outro arquivo.'],
    ['text that is not JSON', { 'data.json': '{ nope' }, 'Não foi possível ler este backup: o conteúdo está danificado. Escolha outro arquivo.'],
    ['a newer version', { 'data.json': JSON.stringify({ format: 'petvaccines-backup', schemaVersion: 2 }) }, 'Este backup foi feito por uma versão mais nova do app. Atualize o Vacinas do Pet e tente de novo.'],
    ['an invalid body', { 'data.json': JSON.stringify({ ...sampleBackup(), pets: 5 }) }, 'Este backup está danificado ou foi alterado e não pode ser restaurado. Nada foi alterado neste aparelho.'],
    ['an unexpected entry', { ...withData(), 'evil.sh': 'x' }, 'Este arquivo tem itens que um backup do app não tem, então não foi aberto. Nada foi alterado neste aparelho.'],
  ])('shows the message for %s and lets the tutor choose another file', async (_name, content, message) => {
    existingPet();
    zipContent = content;
    await renderBackup();

    await fireEvent.press(importButton());

    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(screen.queryByText('Restaurar este backup?')).toBeNull();
    expect(db.select().from(pets).all().map((p) => p.name)).toEqual(['Antigo']);

    zipContent = withData();
    await fireEvent.press(importButton());

    expect(await screen.findByText('Restaurar este backup?')).toBeOnTheScreen();
    expect(screen.queryByText(message)).toBeNull();
  });

  it('says the file could not be read when extraction fails for another reason', async () => {
    unzipMock.mockRejectedValueOnce(new Error('disk full'));
    await renderBackup();

    await fireEvent.press(importButton());

    expect(await screen.findByText('Não foi possível ler o arquivo. Tente de novo ou escolha outro.')).toBeOnTheScreen();
  });

  it('shows a busy state while reading', async () => {
    let finish!: (value: { canceled: true; assets: null }) => void;
    pickerMock.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    await renderBackup();

    await fireEvent.press(importButton());

    expect(screen.getByRole('button', { name: 'Lendo o arquivo…' })).toBeBusy();
    await act(async () => finish({ canceled: true, assets: null }));
    expect(importButton()).not.toBeBusy();
  });

  it('summarises the backup before changing anything, with a neutral confirmation on an empty device', async () => {
    await renderBackup();

    await fireEvent.press(importButton());

    expect(await screen.findByText('Restaurar este backup?')).toBeOnTheScreen();
    expect(screen.getByText(/Backup de 12\/11\/2026, feito pelo app na versão 1\.0\.0\./)).toBeOnTheScreen();
    expect(screen.getByText(/Contém 2 pets, 2 vacinas e 2 fotos\./)).toBeOnTheScreen();
    expect(screen.getByText(/Este aparelho ainda não tem dados/)).toBeOnTheScreen();
    expect(screen.queryByText(/não poderá ser recuperado/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Restaurar' })).toBeOnTheScreen();
    expect(db.select().from(pets).all()).toEqual([]);
  });

  it('warns plainly that existing data will be lost, with the counts, and styles the confirm as destructive', async () => {
    existingPet();
    await renderBackup();

    await fireEvent.press(importButton());

    expect(await screen.findByText(/Tudo o que está neste aparelho agora \(1 pet e 1 vacina\) será substituído pelo conteúdo do backup e não poderá ser recuperado\./)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Substituir tudo' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Restaurar' })).toBeNull();
  });

  it('tells how many photos are missing in the summary and after the restore', async () => {
    zipContent = { 'data.json': JSON.stringify(sampleBackup()) };
    await renderBackup();

    await fireEvent.press(importButton());
    expect(await screen.findByText(/2 fotos citadas no backup não estão no arquivo e ficarão de fora\./)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Restaurar' }));

    await act(async () => {});
    expect(alertSpy).toHaveBeenCalledWith('Backup restaurado', expect.stringContaining('2 fotos citadas'));
  });

  it('changes nothing and removes the extracted files when the tutor cancels', async () => {
    existingPet();
    await renderBackup();
    await fireEvent.press(importButton());
    await screen.findByText('Restaurar este backup?');

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Restaurar este backup?')).toBeNull();
    expect(db.select().from(pets).all().map((p) => p.name)).toEqual(['Antigo']);
    expect(getSettings(db).dueSoonDays).toBe(99);
    expect(fakeFs.hasDir('file:///cache/petvaccines-import-staging')).toBe(false);
    expect(fakeFs.has('file:///docs/photos/88888888-8888-4888-8888-888888888881.jpg')).toBe(true);
  });

  it('replaces the data on confirmation, announces it and returns to Meus pets', async () => {
    existingPet();
    await renderBackup();
    await fireEvent.press(importButton());
    await screen.findByText('Restaurar este backup?');

    await fireEvent.press(screen.getByRole('button', { name: 'Substituir tudo' }));

    await act(async () => {});
    expect(db.select().from(pets).all().map((p) => p.name).sort()).toEqual(['Mimi', 'Thor']);
    expect(db.select().from(vaccinations).all()).toHaveLength(2);
    expect(db.select().from(attachments).all().map((a) => a.file)).toEqual([PROOF]);
    expect(getSettings(db)).toMatchObject({ dueSoonDays: 30, lastBackupAt: '2026-11-12T14:03:00.000Z', lastChangeAt: '2026-11-12T14:03:00.000Z' });
    expect(fakeFs.names('file:///docs/photos')).toEqual([PROOF]);
    expect(alertSpy).toHaveBeenCalledWith('Backup restaurado', 'Seus pets, vacinas e fotos foram restaurados.');
    expect(screen).toHavePathname('/');
  });

  it('imports once when the confirm button is tapped twice', async () => {
    await renderBackup();
    await fireEvent.press(importButton());
    await screen.findByText('Restaurar este backup?');
    const apply = jest.spyOn(backupImport, 'applyBackup');
    const confirm = screen.getByRole('button', { name: 'Restaurar' });

    await act(async () => {
      fireEvent.press(confirm);
      fireEvent.press(confirm);
    });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(db.select().from(pets).all()).toHaveLength(2);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    apply.mockRestore();
  });

  it('says nothing was changed when the restore fails, and keeps the old data', async () => {
    existingPet();
    await renderBackup();
    await fireEvent.press(importButton());
    await screen.findByText('Restaurar este backup?');
    jest.spyOn(db, 'transaction').mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Substituir tudo' }));

    expect(await screen.findByText('Não foi possível restaurar o backup. Nada foi alterado neste aparelho.')).toBeOnTheScreen();
    expect(db.select().from(pets).all().map((p) => p.name)).toEqual(['Antigo']);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(screen).toHavePathname('/backup');
    expect(importButton()).toBeOnTheScreen();
  });
});
