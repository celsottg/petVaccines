import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import BackupScreen from '@/app/backup';
import HomeScreen from '@/app/index';
import { getSettings, setSetting } from '@/data/settings';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { attachments, pets, settings, vaccinations } from '@/db/schema';
import { exportBackup } from '@/services/backup/export';
import { SHARING_UNAVAILABLE } from '@/services/sharingError';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));
jest.mock('@/services/backup/export', () => ({ exportBackup: jest.fn() }));

const exportMock = jest.mocked(exportBackup);
const routes = { index: HomeScreen, backup: BackupScreen, settings: () => null, 'pets/new': () => null, archived: () => null };
const renderBackup = () => renderRouter(routes, { initialUrl: '/backup' });
const runButton = () => screen.getByRole('button', { name: 'Fazer backup agora' });

const PET = '11111111-1111-4111-8111-111111111111';
const VAC = '22222222-2222-4222-8222-222222222222';

/** Only the clock is fake: the router and the test library need real timers. */
const REAL = ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] as const;

function addPet(id: string, createdAt: string, photoFile: string | null = null) {
  db.insert(pets).values({ id, name: 'Thor', species: 'dog', photoFile, createdAt, updatedAt: createdAt }).run();
}
function addVaccination(id: string, petId: string, createdAt: string) {
  db.insert(vaccinations).values({ id, petId, vaccineName: 'V10', appliedOn: '2026-10-01', createdAt, updatedAt: createdAt }).run();
}

beforeAll(() => jest.useFakeTimers({ now: new Date(2026, 10, 12, 10), doNotFake: [...REAL] }));
afterAll(() => jest.useRealTimers());

beforeEach(() => {
  jest.clearAllMocks();
  db.delete(pets).run();
  db.delete(settings).run();
  exportMock.mockResolvedValue({ missingPhotos: 0 });
});

describe('Backup screen', () => {
  it('is reached from the Backup link on Meus pets', async () => {
    await renderRouter(routes, { initialUrl: '/' });

    await fireEvent.press(screen.getByRole('link', { name: 'Backup' }));

    expect(screen).toHavePathname('/backup');
  });

  it('says there was no backup yet, counts all vaccinations and shows the content of a backup made now', async () => {
    addPet(PET, '2026-10-01T10:00:00.000Z', '33333333-3333-4333-8333-333333333333.jpg');
    addVaccination(VAC, PET, '2026-10-02T10:00:00.000Z');
    db.insert(attachments).values({ id: '44444444-4444-4444-8444-444444444444', vaccinationId: VAC, file: '44444444-4444-4444-8444-444444444444.jpg', sizeBytes: 1, width: 1, height: 1, createdAt: '2026-10-02T10:00:00.000Z' }).run();

    await renderBackup();

    expect(screen.getByText('Nenhum backup feito ainda')).toBeOnTheScreen();
    expect(screen.getByText('1 vacina nova')).toBeOnTheScreen();
    expect(screen.getByText('1 pet · 1 vacina · 2 fotos')).toBeOnTheScreen();
  });

  it('shows when the last backup was made and the vaccinations registered since', async () => {
    addPet(PET, '2026-10-01T10:00:00.000Z');
    addVaccination(VAC, PET, '2026-10-02T10:00:00.000Z');
    addVaccination('55555555-5555-4555-8555-555555555555', PET, '2026-11-05T10:00:00.000Z');
    addVaccination('66666666-6666-4666-8666-666666666666', PET, '2026-11-06T10:00:00.000Z');
    setSetting(db, 'last_backup_at', '2026-10-27T15:00:00.000Z');

    await renderBackup();

    expect(screen.getByText('27/10/2026 (há 16 dias)')).toBeOnTheScreen();
    expect(screen.getByText('2 vacinas novas')).toBeOnTheScreen();
  });

  it('says no vaccination is new when nothing was registered since the backup', async () => {
    setSetting(db, 'last_backup_at', '2026-11-12T08:00:00.000Z');

    await renderBackup();

    expect(screen.getByText('Nenhuma vacina nova')).toBeOnTheScreen();
    expect(screen.getByText(/hoje/)).toBeOnTheScreen();
  });

  it('does not offer to import a backup yet', async () => {
    await renderBackup();

    expect(screen.queryByText(/Importar/)).toBeNull();
    expect(screen.queryByText('Restaurar')).toBeNull();
  });

  it('exports once even when the button is tapped twice, shows it is busy and then confirms', async () => {
    let finish!: (value: { missingPhotos: number }) => void;
    exportMock.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    await renderBackup();

    await fireEvent.press(runButton());
    await fireEvent.press(screen.getByRole('button', { name: 'Gerando backup…' }));

    expect(screen.getByRole('button', { name: 'Gerando backup…' })).toBeBusy();
    await act(async () => finish({ missingPhotos: 0 }));

    expect(exportMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Backup gerado/)).toBeOnTheScreen();
    expect(screen.queryByText(/não foi encontrada|não foram encontradas/)).toBeNull();
  });

  it('tells how many photos could not be included', async () => {
    exportMock.mockResolvedValue({ missingPhotos: 2 });
    await renderBackup();

    await fireEvent.press(runButton());

    expect(await screen.findByText('2 fotos não foram encontradas e ficaram fora do backup.')).toBeOnTheScreen();
  });

  it('shows an error and lets the tutor retry', async () => {
    exportMock.mockRejectedValueOnce(new Error('boom'));
    await renderBackup();

    await fireEvent.press(runButton());
    expect(await screen.findByText('Não foi possível gerar o backup. Tente novamente.')).toBeOnTheScreen();
    await fireEvent.press(runButton());

    expect(exportMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/Backup gerado/)).toBeOnTheScreen();
    expect(screen.queryByText('Não foi possível gerar o backup. Tente novamente.')).toBeNull();
  });

  it('says so when the device cannot share files', async () => {
    exportMock.mockRejectedValueOnce(new Error(SHARING_UNAVAILABLE));
    await renderBackup();

    await fireEvent.press(runButton());

    expect(await screen.findByText('Este aparelho não permite compartilhar arquivos.')).toBeOnTheScreen();
  });

  it('starts with the saved warning period and stores a new one', async () => {
    setSetting(db, 'backup_warning_days', 21);
    await renderBackup();
    const field = screen.getByLabelText('Avisar quando o backup tiver mais de (dias)');
    expect(field.props.value).toBe('21');

    await fireEvent.changeText(field, '30');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar prazo' }));

    expect(getSettings(db).backupWarningDays).toBe(30);
    expect(screen.getByText('Prazo salvo.')).toBeOnTheScreen();
  });

  it.each(['0', '366', '', '1.5', 'abc'])('rejects the warning period %j and stores nothing', async (text) => {
    await renderBackup();

    await fireEvent.changeText(screen.getByLabelText('Avisar quando o backup tiver mais de (dias)'), text);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar prazo' }));

    expect(screen.getByText('Informe um número inteiro de 1 a 365.')).toBeOnTheScreen();
    expect(getSettings(db).backupWarningDays).toBe(14);
    expect(db.select().from(settings).all()).toEqual([]);
  });
});

describe('backup warning banner on Meus pets', () => {
  const staleData = () => {
    addPet(PET, '2026-10-01T10:00:00.000Z');
    addVaccination(VAC, PET, '2026-10-02T10:00:00.000Z');
    setSetting(db, 'last_backup_at', '2026-10-27T15:00:00.000Z');
    setSetting(db, 'last_change_at', '2026-11-10T10:00:00.000Z');
  };

  it('warns with the age of the backup and the vaccinations registered since', async () => {
    addPet(PET, '2026-10-01T10:00:00.000Z');
    addVaccination(VAC, PET, '2026-11-02T10:00:00.000Z');
    addVaccination('55555555-5555-4555-8555-555555555555', PET, '2026-11-03T10:00:00.000Z');
    setSetting(db, 'last_backup_at', '2026-10-27T15:00:00.000Z');
    setSetting(db, 'last_change_at', '2026-11-10T10:00:00.000Z');

    await renderRouter(routes, { initialUrl: '/' });

    expect(screen.getByText('Seu último backup tem 16 dias')).toBeOnTheScreen();
    expect(screen.getByText('Você registrou 2 vacinas desde então. Elas só existem neste aparelho.')).toBeOnTheScreen();
    expect(screen.getByRole('summary')).toBeOnTheScreen();
  });

  it('says there was no backup when there never was one', async () => {
    addPet(PET, '2026-10-01T10:00:00.000Z');
    addVaccination(VAC, PET, '2026-10-02T10:00:00.000Z');

    await renderRouter(routes, { initialUrl: '/' });

    expect(screen.getByText('Você ainda não fez backup')).toBeOnTheScreen();
    expect(screen.getByText('Você registrou 1 vacina. Ela só existe neste aparelho.')).toBeOnTheScreen();
  });

  it('opens the backup screen from its button', async () => {
    staleData();
    await renderRouter(routes, { initialUrl: '/' });

    await fireEvent.press(screen.getByRole('button', { name: 'Fazer backup agora' }));

    expect(screen).toHavePathname('/backup');
  });

  it('is hidden when there is no data', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.queryByRole('summary')).toBeNull();
  });

  it('is hidden when nothing changed after the last backup', async () => {
    staleData();
    setSetting(db, 'last_change_at', '2026-10-20T10:00:00.000Z');

    await renderRouter(routes, { initialUrl: '/' });

    expect(screen.queryByRole('summary')).toBeNull();
  });

  it('disappears after a backup made on the backup screen, and returns when data changes after enough days', async () => {
    staleData();
    exportMock.mockImplementation(async () => {
      db.transaction((tx) => setSetting(tx, 'last_backup_at', new Date().toISOString()));
      return { missingPhotos: 0 };
    });
    await renderRouter(routes, { initialUrl: '/' });
    expect(screen.getByRole('summary')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Fazer backup agora' }));
    await fireEvent.press(runButton());
    expect(await screen.findByText(/Backup gerado/)).toBeOnTheScreen();
    await act(async () => router.back());

    expect(screen).toHavePathname('/');
    expect(screen.queryByRole('summary')).toBeNull();

    jest.setSystemTime(new Date(2026, 11, 2, 10)); // 20 days after the backup
    try {
      await act(async () => {
        createVaccination(db, { petId: PET, vaccineName: 'Gripe', appliedOn: '2026-12-01' });
      });

      expect(screen.getByText('Seu último backup tem 20 dias')).toBeOnTheScreen();
      expect(screen.getByText('Você registrou 1 vacina desde então. Ela só existe neste aparelho.')).toBeOnTheScreen();
    } finally {
      jest.setSystemTime(new Date(2026, 10, 12, 10));
    }
  });

  it('uses the warning period of the settings', async () => {
    staleData();
    setSetting(db, 'backup_warning_days', 30);

    await renderRouter(routes, { initialUrl: '/' });

    expect(screen.queryByRole('summary')).toBeNull();
  });
});
