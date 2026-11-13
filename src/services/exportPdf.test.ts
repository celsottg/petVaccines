import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { addAttachment } from '@/data/attachments';
import { archivePet, createPet } from '@/data/pets';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { pets } from '@/db/schema';

import { exportPetPdf, PET_NOT_FOUND, SHARING_UNAVAILABLE } from './exportPdf';
import { fakeFs } from './fakeFileSystem';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testDb').createTestDb() }));
jest.mock('expo-file-system', () => jest.requireActual('./fakeFileSystem').fakeModule);
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const print = jest.mocked(Print.printToFileAsync);
const isAvailable = jest.mocked(Sharing.isAvailableAsync);
const share = jest.mocked(Sharing.shareAsync);

const GENERATED = 'file:///cache/Print/random-name.pdf';
const SHARED = 'file:///cache/carteira-thor-2026-11-13.pdf';

/** Same day in UTC and in São Paulo would hide a UTC bug: 22:30 local is already the 14th in UTC. */
beforeAll(() => jest.useFakeTimers({ now: new Date(2026, 10, 13, 22, 30) }));
afterAll(() => jest.useRealTimers());

beforeEach(() => {
  jest.clearAllMocks();
  fakeFs.reset();
  db.delete(pets).run();
  isAvailable.mockResolvedValue(true);
  print.mockImplementation(async () => {
    fakeFs.addFile(GENERATED, 5000);
    return { uri: GENERATED, numberOfPages: 1 };
  });
  share.mockResolvedValue(undefined);
});

function wallet() {
  const pet = createPet(db, { name: 'Thor', species: 'dog' });
  const old = createVaccination(db, { petId: pet.id, vaccineName: 'Antirrábica', appliedOn: '2025-03-01' });
  const recent = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-03-18', batch: 'L1' });
  return { pet, old, recent };
}

function photo(vaccinationId: string, id: string, options: { base64?: string; missing?: boolean } = {}) {
  const file = `${id}.jpg`;
  addAttachment(db, { id, vaccinationId, file, sizeBytes: 10, width: 10, height: 10 });
  if (!options.missing) fakeFs.addFile(`file:///docs/photos/${file}`, 10, { base64: options.base64 ?? 'QUJD' });
}

const printedHtml = () => (print.mock.calls[0][0] as { html: string }).html;

describe('exportPetPdf', () => {
  it('prints the card built from the stored data, shares it under a readable name and cleans up', async () => {
    const { old, recent } = wallet();
    photo(recent.id, '11111111-1111-4111-8111-111111111111', { base64: 'RECENT' });
    photo(old.id, '22222222-2222-4222-8222-222222222222', { base64: 'OLD' });
    let existedWhenShared = false;
    share.mockImplementation(async () => {
      existedWhenShared = fakeFs.has(SHARED);
    });

    await exportPetPdf(createdPetId());

    expect(print).toHaveBeenCalledTimes(1);
    const html = printedHtml();
    expect(html).toContain('Thor');
    expect(html.indexOf('V10')).toBeLessThan(html.indexOf('Antirrábica'));
    expect(html).toContain('<img src="data:image/jpeg;base64,RECENT"');
    expect(html).toContain('<img src="data:image/jpeg;base64,OLD"');
    expect(html).toContain('Registro declaratório feito pelo tutor.');
    expect(html).toContain('Gerado em 13/11/2026');
    expect(print.mock.calls[0][0]).toMatchObject({ width: 595, height: 842 });

    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith(SHARED, expect.objectContaining({ mimeType: 'application/pdf' }));
    expect(existedWhenShared).toBe(true);
    // Neither the random file nor the renamed one is left behind.
    expect(fakeFs.has(GENERATED)).toBe(false);
    expect(fakeFs.has(SHARED)).toBe(false);
  });

  it('exports an archived wallet and says so in the header', async () => {
    const { pet } = wallet();
    archivePet(db, pet.id, 'deceased', '2026-02-01');

    await exportPetPdf(pet.id);

    expect(printedHtml()).toContain('Carteira encerrada');
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('puts a line in place of a photo whose file is missing, and still exports', async () => {
    const { recent } = wallet();
    photo(recent.id, '11111111-1111-4111-8111-111111111111', { missing: true });
    photo(recent.id, '22222222-2222-4222-8222-222222222222', { base64: 'GOOD' });

    await exportPetPdf(createdPetId());

    const html = printedHtml();
    expect(html).toContain('Não foi possível incluir esta foto.');
    expect(html).toContain('data:image/jpeg;base64,GOOD');
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('puts the same line in place of a photo that cannot be read', async () => {
    const { recent } = wallet();
    const id = '11111111-1111-4111-8111-111111111111';
    photo(recent.id, id);
    fakeFs.addFile(`file:///docs/photos/${id}.jpg`, 10); // exists, but has no readable content

    await exportPetPdf(createdPetId());

    expect(printedHtml()).toContain('Não foi possível incluir esta foto.');
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('replaces a leftover file with the same name from an earlier export', async () => {
    wallet();
    fakeFs.addFile(SHARED, 1);

    await exportPetPdf(createdPetId());

    expect(share).toHaveBeenCalledWith(SHARED, expect.anything());
    expect(fakeFs.has(SHARED)).toBe(false);
  });

  it('rejects and shares nothing when printing fails, without leaving files behind', async () => {
    wallet();
    print.mockRejectedValue(new Error('print failed'));

    await expect(exportPetPdf(createdPetId())).rejects.toThrow('print failed');

    expect(share).not.toHaveBeenCalled();
    expect(fakeFs.names('file:///cache')).toEqual([]);
  });

  it('reports that sharing is unavailable before doing any work', async () => {
    wallet();
    isAvailable.mockResolvedValue(false);

    await expect(exportPetPdf(createdPetId())).rejects.toThrow(SHARING_UNAVAILABLE);

    expect(print).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
  });

  it('rejects for an unknown pet', async () => {
    await expect(exportPetPdf('missing')).rejects.toThrow(PET_NOT_FOUND);
    expect(print).not.toHaveBeenCalled();
  });

  it('removes the generated files even when the share sheet fails', async () => {
    wallet();
    share.mockRejectedValue(new Error('share failed'));

    await expect(exportPetPdf(createdPetId())).rejects.toThrow('share failed');

    expect(fakeFs.names('file:///cache')).toEqual([]);
  });

  it('does not fail when a generated file cannot be deleted afterwards', async () => {
    wallet();
    print.mockImplementation(async () => {
      fakeFs.addFile(GENERATED, 5000, { failDelete: true });
      return { uri: GENERATED, numberOfPages: 1 };
    });

    await expect(exportPetPdf(createdPetId())).resolves.toBeUndefined();
  });

  it('names the file after the pet with accents removed', async () => {
    const pet = createPet(db, { name: 'Mel da Conceição', species: 'cat' });
    createVaccination(db, { petId: pet.id, vaccineName: 'V4', appliedOn: '2026-01-01' });

    await exportPetPdf(pet.id);

    expect(share).toHaveBeenCalledWith('file:///cache/carteira-mel-da-conceicao-2026-11-13.pdf', expect.anything());
  });
});

function createdPetId(): string {
  return db.select().from(pets).all()[0].id;
}
