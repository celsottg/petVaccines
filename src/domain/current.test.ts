import { splitCurrent, vaccineKey } from './current';

describe('vaccineKey', () => {
  it('treats free names that differ only in case, accents or spaces as the same vaccine', () => {
    const key = vaccineKey({ catalogId: null, vaccineName: 'antirrabica' });
    expect(vaccineKey({ catalogId: null, vaccineName: ' ANTIRRÁBICA ' })).toBe(key);
    expect(vaccineKey({ catalogId: null, vaccineName: 'Antirrabica' })).toBe(key);
    expect(vaccineKey({ catalogId: null, vaccineName: 'antirrábica ' })).toBe(key);
  });

  it('uses the catalog id when there is one, ignoring the name', () => {
    expect(vaccineKey({ catalogId: 'br-dog-rabies', vaccineName: 'Raiva' })).toBe(
      vaccineKey({ catalogId: 'br-dog-rabies', vaccineName: 'Antirrábica' }),
    );
  });

  it('does not collide a catalog id with a free name of the same text', () => {
    expect(vaccineKey({ catalogId: 'v10', vaccineName: 'x' })).not.toBe(
      vaccineKey({ catalogId: null, vaccineName: 'v10' }),
    );
  });

  it('treats different free names as different vaccines', () => {
    expect(vaccineKey({ catalogId: null, vaccineName: 'V8' })).not.toBe(
      vaccineKey({ catalogId: null, vaccineName: 'V10' }),
    );
  });
});

type Rec = { id: string; catalogId: string | null; vaccineName: string; appliedOn: string; createdAt: string };

const rec = (id: string, vaccineName: string, appliedOn: string, createdAt = `${appliedOn}T12:00:00.000Z`, catalogId: string | null = null): Rec => ({
  id,
  catalogId,
  vaccineName,
  appliedOn,
  createdAt,
});

const ids = (list: Rec[]) => list.map((r) => r.id);

describe('splitCurrent', () => {
  it('keeps the most recent application of each vaccine as current', () => {
    const list = [
      rec('rabies-2024', 'Antirrábica', '2024-11-28'),
      rec('rabies-2025', 'antirrabica', '2025-12-02'),
      rec('v10-2026', 'V10', '2026-03-18'),
    ];
    const { current, previous } = splitCurrent(list);
    expect(ids(current)).toEqual(['rabies-2025', 'v10-2026']);
    expect(ids(previous)).toEqual(['rabies-2024']);
  });

  it('does not depend on the input order', () => {
    const list = [
      rec('v10-2026', 'V10', '2026-03-18'),
      rec('rabies-2025', 'Antirrábica', '2025-12-02'),
      rec('rabies-2024', 'Antirrábica', '2024-11-28'),
    ];
    const { current, previous } = splitCurrent(list);
    expect(ids(current).sort()).toEqual(['rabies-2025', 'v10-2026']);
    expect(ids(previous)).toEqual(['rabies-2024']);
  });

  it('breaks a tie on appliedOn with the most recent createdAt', () => {
    const list = [
      rec('later', 'V10', '2026-03-18', '2026-03-18T15:00:00.000Z'),
      rec('earlier', 'V10', '2026-03-18', '2026-03-18T09:00:00.000Z'),
    ];
    const { current, previous } = splitCurrent(list);
    expect(ids(current)).toEqual(['later']);
    expect(ids(previous)).toEqual(['earlier']);
  });

  it('groups catalog records by catalog id even when names differ', () => {
    const list = [
      rec('old', 'Raiva', '2024-11-28', undefined, 'br-dog-rabies'),
      rec('new', 'Antirrábica', '2025-12-02', undefined, 'br-dog-rabies'),
    ];
    expect(ids(splitCurrent(list).current)).toEqual(['new']);
  });

  it('returns empty lists for an empty input', () => {
    expect(splitCurrent([])).toEqual({ current: [], previous: [] });
  });
});
