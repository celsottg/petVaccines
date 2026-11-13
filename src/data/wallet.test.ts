import { archivePet } from './pets';
import { createTestDb } from './testDb';
import { newPet } from './testHelpers';
import type { Vaccination } from './types';
import { createVaccination } from './vaccinations';
import { buildVaccinationDetail, buildWallet, filterWallet } from './wallet';

const TODAY = '2026-11-12';

function setup(species: 'dog' | 'cat' = 'dog') {
  const db = createTestDb();
  const pet = newPet(db, { species });
  const vaccinate = (vaccineName: string, appliedOn: string, nextDueOn: string | null = null) =>
    createVaccination(db, { petId: pet.id, vaccineName, appliedOn, nextDueOn });
  return { db, pet, vaccinate };
}

const names = (entries: { vaccination: Vaccination }[]) => entries.map((e) => e.vaccination.vaccineName);

describe('buildWallet', () => {
  it('puts the current record of each vaccine first and the earlier applications under previous', () => {
    const { pet, vaccinate } = setup();
    const old = vaccinate('Antirrábica', '2024-11-28', '2025-11-28');
    const recent = vaccinate('antirrabica', '2025-12-02', '2026-12-02');
    const other = vaccinate('V10', '2026-03-18', '2027-03-18');

    const wallet = buildWallet(pet, [old, recent, other], new Set(), 30, TODAY);

    expect(names(wallet.current)).toEqual(['antirrabica', 'V10']);
    expect(names(wallet.previous)).toEqual(['Antirrábica']);
  });

  it('matches a free name to the catalog of the pet species when picking the current record', () => {
    const { db, pet, vaccinate } = setup('dog');
    const free = vaccinate('Antirrábica', '2025-01-01', '2026-01-01');
    const fromCatalog = createVaccination(db, {
      petId: pet.id,
      catalogId: 'br-dog-rabies',
      vaccineName: 'Antirrábica',
      appliedOn: '2026-11-12',
    });

    const wallet = buildWallet(pet, [free, fromCatalog], new Set(), 30, TODAY);

    expect(wallet.current.map((e) => e.vaccination.id)).toEqual([fromCatalog.id]);
    expect(wallet.previous.map((e) => e.vaccination.id)).toEqual([free.id]);
  });

  it('gives a status only to current records, from the due date', () => {
    const { pet, vaccinate } = setup();
    const records = [
      vaccinate('Overdue', '2025-01-01', '2026-11-11'),
      vaccinate('Soon', '2025-01-01', '2026-12-12'),
      vaccinate('Fine', '2025-01-01', '2026-12-13'),
      vaccinate('Open ended', '2025-01-01'),
      vaccinate('Overdue', '2024-01-01', '2025-01-01'),
    ];

    const wallet = buildWallet(pet, records, new Set(), 30, TODAY);

    expect(wallet.current.map((e) => [e.vaccination.vaccineName, e.status])).toEqual([
      ['Overdue', 'overdue'],
      ['Soon', 'due_soon'],
      ['Fine', 'ok'],
      ['Open ended', 'ok'],
    ]);
    expect(wallet.previous.map((e) => e.status)).toEqual([null]);
  });

  it('lists the most urgent due dates first and records without a next dose last', () => {
    const { pet, vaccinate } = setup();
    const records = [
      vaccinate('No next dose', '2026-01-01'),
      vaccinate('Later', '2026-01-01', '2027-06-01'),
      vaccinate('Sooner', '2026-01-01', '2026-12-01'),
    ];
    expect(names(buildWallet(pet, records, new Set(), 30, TODAY).current)).toEqual(['Sooner', 'Later', 'No next dose']);
  });

  it('lists previous applications from the newest to the oldest', () => {
    const { pet, vaccinate } = setup();
    const records = [
      vaccinate('V10', '2023-01-01'),
      vaccinate('V10', '2025-01-01'),
      vaccinate('V10', '2024-01-01'),
      vaccinate('V10', '2026-01-01'),
    ];
    const wallet = buildWallet(pet, records, new Set(), 30, TODAY);
    expect(wallet.previous.map((e) => e.vaccination.appliedOn)).toEqual(['2025-01-01', '2024-01-01', '2023-01-01']);
  });

  it('has no status at all for an archived pet', () => {
    const { db, pet, vaccinate } = setup();
    const record = vaccinate('V10', '2025-01-01', '2026-01-01');
    archivePet(db, pet.id, 'deceased', null);
    const archived = { ...pet, status: 'archived' as const };

    const wallet = buildWallet(archived, [record], new Set(), 30, TODAY);

    expect(wallet.current.map((e) => e.status)).toEqual([null]);
  });

  it('flags the records that have at least one attachment', () => {
    const { pet, vaccinate } = setup();
    const withProof = vaccinate('V10', '2026-01-01');
    const without = vaccinate('Giárdia', '2026-01-01');

    const wallet = buildWallet(pet, [withProof, without], new Set([withProof.id]), 30, TODAY);

    expect(wallet.current.map((e) => [e.vaccination.vaccineName, e.hasAttachments])).toEqual([
      ['V10', true],
      ['Giárdia', false],
    ]);
  });
});

describe('filterWallet', () => {
  function walletWithAllStatuses() {
    const { pet, vaccinate } = setup();
    const records = [
      vaccinate('Overdue', '2025-01-01', '2026-11-11'),
      vaccinate('Soon', '2025-01-01', '2026-12-01'),
      vaccinate('Fine', '2025-01-01', '2027-12-01'),
      vaccinate('Overdue', '2024-01-01', '2025-01-01'),
    ];
    return buildWallet(pet, records, new Set(), 30, TODAY);
  }

  it('keeps everything for "all"', () => {
    const wallet = walletWithAllStatuses();
    expect(filterWallet(wallet, 'all')).toBe(wallet);
  });

  it.each([
    ['overdue', ['Overdue']],
    ['due_soon', ['Soon']],
  ] as const)('keeps only the current records that are %s, and hides previous applications', (filter, expected) => {
    const filtered = filterWallet(walletWithAllStatuses(), filter);
    expect(names(filtered.current)).toEqual(expected);
    expect(filtered.previous).toEqual([]);
  });
});

describe('buildVaccinationDetail', () => {
  it('reports the status of a current record', () => {
    const { pet, vaccinate } = setup();
    const record = vaccinate('V10', '2026-01-01', '2026-11-20');

    expect(buildVaccinationDetail(pet, record, [record], true, 30, TODAY)).toMatchObject({
      isCurrent: true,
      status: 'due_soon',
      hasAttachments: true,
    });
  });

  it('has no status for a previous application', () => {
    const { pet, vaccinate } = setup();
    const old = vaccinate('V10', '2025-01-01', '2025-12-01');
    const recent = vaccinate('V10', '2026-01-01', '2027-01-01');

    expect(buildVaccinationDetail(pet, old, [old, recent], false, 30, TODAY)).toMatchObject({
      isCurrent: false,
      status: null,
    });
  });

  it('has no status for an archived pet', () => {
    const { pet, vaccinate } = setup();
    const record = vaccinate('V10', '2025-01-01', '2026-01-01');

    const detail = buildVaccinationDetail({ ...pet, status: 'archived' }, record, [record], false, 30, TODAY);

    expect(detail).toMatchObject({ isCurrent: true, status: null });
  });
});
