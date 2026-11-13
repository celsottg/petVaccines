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

describe('vaccineKey — casos adicionais', () => {
  it('une as três grafias do Review Focus 2: "Antirrabica", "antirrábica " e "ANTIRRÁBICA"', () => {
    const keys = ['Antirrabica', 'antirrábica ', 'ANTIRRÁBICA'].map((vaccineName) =>
      vaccineKey({ catalogId: null, vaccineName }),
    );
    expect(new Set(keys).size).toBe(1);
  });

  it('trata acento composto (NFC) e decomposto (NFD) como o mesmo texto', () => {
    const nfc = 'Antirrábica'.normalize('NFC');
    const nfd = 'Antirrábica'.normalize('NFD');
    expect(nfc).not.toBe(nfd);
    expect(vaccineKey({ catalogId: null, vaccineName: nfc })).toBe(vaccineKey({ catalogId: null, vaccineName: nfd }));
  });

  it.each([
    ['Giárdia', 'giardia'],
    ['LEPTOSPIROSE', 'leptospirose'],
    ['Gripe Canina', 'gripe canina'],
    ['Polivalente (V10)', 'POLIVALENTE (V10)'],
    ['ÁÉÍÓÚ ÃÕ Ç ÜÂÊÔ', 'aeiou ao c uaeo'],
  ])('"%s" e "%s" são a mesma vacina', (a, b) => {
    expect(vaccineKey({ catalogId: null, vaccineName: a })).toBe(vaccineKey({ catalogId: null, vaccineName: b }));
  });

  it('remove espaços, tabulações e quebras de linha nas pontas', () => {
    expect(vaccineKey({ catalogId: null, vaccineName: '\t V10 \n' })).toBe(
      vaccineKey({ catalogId: null, vaccineName: 'V10' }),
    );
  });

  it('mantém os espaços internos: só as pontas são ignoradas (spec)', () => {
    expect(vaccineKey({ catalogId: null, vaccineName: 'gripe canina' })).not.toBe(
      vaccineKey({ catalogId: null, vaccineName: 'gripecanina' }),
    );
  });

  it('não lança erro com nome vazio ou só com espaços', () => {
    expect(() => vaccineKey({ catalogId: null, vaccineName: '' })).not.toThrow();
    expect(vaccineKey({ catalogId: null, vaccineName: '   ' })).toBe(vaccineKey({ catalogId: null, vaccineName: '' }));
  });

  it('distingue ids de catálogo diferentes, inclusive a mesma vacina em espécies diferentes', () => {
    expect(vaccineKey({ catalogId: 'br-dog-rabies', vaccineName: 'Antirrábica' })).not.toBe(
      vaccineKey({ catalogId: 'br-cat-rabies', vaccineName: 'Antirrábica' }),
    );
  });

  it('um registro do catálogo e um de nome livre com o mesmo texto NÃO são a mesma vacina (spec: mesmo catalog_id, ou nome livre sem catalog_id)', () => {
    expect(vaccineKey({ catalogId: 'br-dog-rabies', vaccineName: 'Antirrábica' })).not.toBe(
      vaccineKey({ catalogId: null, vaccineName: 'Antirrábica' }),
    );
  });

  it('o prefixo isola as origens mesmo quando o texto imita o outro prefixo', () => {
    expect(vaccineKey({ catalogId: null, vaccineName: 'catalog:v10' })).not.toBe(
      vaccineKey({ catalogId: 'v10', vaccineName: 'x' }),
    );
    expect(vaccineKey({ catalogId: 'name:v10', vaccineName: 'x' })).not.toBe(
      vaccineKey({ catalogId: null, vaccineName: 'v10' }),
    );
  });

  it('é idempotente: mesmo registro, mesma chave', () => {
    const v = { catalogId: null, vaccineName: ' Antirrábica ' };
    expect(vaccineKey(v)).toBe(vaccineKey({ ...v }));
  });
});

describe('splitCurrent — casos adicionais', () => {
  it('Review Focus 2: o reforço com grafia diferente substitui a aplicação anterior', () => {
    const list = [
      rec('a', 'Antirrabica', '2024-11-28'),
      rec('b', 'antirrábica ', '2025-11-27'),
      rec('c', 'ANTIRRÁBICA', '2026-11-12'),
    ];
    const { current, previous } = splitCurrent(list);
    expect(ids(current)).toEqual(['c']);
    expect(ids(previous)).toEqual(['a', 'b']);
  });

  it('desempate por createdAt vale também quando o mais recente vem DEPOIS na lista', () => {
    const list = [
      rec('earlier', 'V10', '2026-03-18', '2026-03-18T09:00:00.000Z'),
      rec('later', 'V10', '2026-03-18', '2026-03-18T15:00:00.000Z'),
    ];
    const { current, previous } = splitCurrent(list);
    expect(ids(current)).toEqual(['later']);
    expect(ids(previous)).toEqual(['earlier']);
  });

  it('desempate entre três registros no mesmo dia escolhe o createdAt mais recente, em qualquer ordem', () => {
    const a = rec('a', 'V10', '2026-03-18', '2026-03-18T09:00:00.000Z');
    const b = rec('b', 'V10', '2026-03-18', '2026-03-18T15:00:00.000Z');
    const c = rec('c', 'V10', '2026-03-18', '2026-03-18T12:00:00.000Z');
    for (const order of [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]]) {
      expect(ids(splitCurrent(order).current)).toEqual(['b']);
    }
  });

  it('appliedOn tem prioridade sobre createdAt: uma aplicação antiga cadastrada depois NÃO vira a vigente', () => {
    const list = [
      rec('recent-applied', 'V10', '2026-03-18', '2026-03-18T12:00:00.000Z'),
      rec('backdated', 'V10', '2025-01-10', '2026-11-12T12:00:00.000Z'), // esquecida e lançada hoje
    ];
    const { current, previous } = splitCurrent(list);
    expect(ids(current)).toEqual(['recent-applied']);
    expect(ids(previous)).toEqual(['backdated']);
  });

  it('compara datas de anos diferentes corretamente (2025-12-02 < 2026-01-05)', () => {
    const list = [rec('new', 'V10', '2026-01-05'), rec('old', 'V10', '2025-12-02')];
    expect(ids(splitCurrent(list).current)).toEqual(['new']);
  });

  it('com 3 ou mais aplicações da mesma vacina, só uma é vigente e as outras ficam em previous na ordem da entrada', () => {
    const list = [
      rec('2024', 'Antirrábica', '2024-11-28'),
      rec('2026', 'Antirrábica', '2026-11-12'),
      rec('2025', 'Antirrábica', '2025-11-27'),
    ];
    const { current, previous } = splitCurrent(list);
    expect(ids(current)).toEqual(['2026']);
    expect(ids(previous)).toEqual(['2024', '2025']);
  });

  it('mantém a ordem da entrada em current e em previous', () => {
    const list = [
      rec('v10-old', 'V10', '2025-03-18'),
      rec('rabies', 'Antirrábica', '2026-01-10'),
      rec('v10-new', 'V10', '2026-03-18'),
      rec('rabies-old', 'Antirrábica', '2025-01-10'),
      rec('giardia', 'Giárdia', '2026-02-01'),
    ];
    const { current, previous } = splitCurrent(list);
    expect(ids(current)).toEqual(['rabies', 'v10-new', 'giardia']);
    expect(ids(previous)).toEqual(['v10-old', 'rabies-old']);
  });

  it('registros de vacinas diferentes são todos vigentes', () => {
    const list = [rec('a', 'V10', '2026-01-01'), rec('b', 'Antirrábica', '2026-01-01'), rec('c', 'Giárdia', '2026-01-01')];
    const { current, previous } = splitCurrent(list);
    expect(ids(current)).toEqual(['a', 'b', 'c']);
    expect(previous).toEqual([]);
  });

  it('um único registro é vigente', () => {
    const list = [rec('only', 'V10', '2026-01-01')];
    expect(splitCurrent(list)).toEqual({ current: list, previous: [] });
  });

  it('registro do catálogo e de nome livre com o mesmo texto são vacinas separadas (cada uma tem a sua vigente)', () => {
    const list = [
      rec('free', 'Antirrábica', '2025-01-01'),
      rec('catalog', 'Antirrábica', '2026-01-01', undefined, 'br-dog-rabies'),
    ];
    const { current, previous } = splitCurrent(list);
    expect(ids(current)).toEqual(['free', 'catalog']);
    expect(previous).toEqual([]);
  });

  it('duplicata exata (mesmo appliedOn e createdAt) é determinística: vale o primeiro da entrada', () => {
    const list = [rec('first', 'V10', '2026-03-18'), rec('second', 'V10', '2026-03-18')];
    const { current, previous } = splitCurrent(list);
    expect(ids(current)).toEqual(['first']);
    expect(ids(previous)).toEqual(['second']);
  });

  it('não altera a lista de entrada e devolve os mesmos objetos (sem cópias)', () => {
    const list = [rec('b', 'V10', '2025-01-01'), rec('a', 'V10', '2026-01-01')];
    const snapshot = JSON.stringify(list);
    const { current, previous } = splitCurrent(list);
    expect(JSON.stringify(list)).toBe(snapshot);
    expect(current[0]).toBe(list[1]);
    expect(previous[0]).toBe(list[0]);
  });

  it('preserva campos extras do registro (tipo genérico)', () => {
    const list = [{ ...rec('x', 'V10', '2026-01-01'), nextDueOn: '2027-01-01', petId: 'p1' }];
    expect(splitCurrent(list).current[0].nextDueOn).toBe('2027-01-01');
  });

  it('propriedade: current e previous particionam a entrada e há exatamente uma vigente por vacina', () => {
    const names = ['V10', 'Antirrábica', 'antirrabica ', 'Giárdia', 'Gripe Canina'];
    const list: Rec[] = [];
    for (let i = 0; i < 60; i++) {
      const day = String((i * 7) % 28 + 1).padStart(2, '0');
      const month = String((i * 5) % 12 + 1).padStart(2, '0');
      list.push(rec(`r${i}`, names[i % names.length], `${2022 + (i % 5)}-${month}-${day}`, `2026-01-01T00:${String(i).padStart(2, '0')}:00.000Z`));
    }
    const { current, previous } = splitCurrent(list);
    expect(current.length + previous.length).toBe(list.length);
    expect(new Set([...ids(current), ...ids(previous)]).size).toBe(list.length);
    const keys = current.map(vaccineKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(new Set(list.map(vaccineKey)).size);
    for (const p of previous) {
      const winner = current.find((c) => vaccineKey(c) === vaccineKey(p))!;
      expect(winner.appliedOn >= p.appliedOn).toBe(true);
    }
  });
});
