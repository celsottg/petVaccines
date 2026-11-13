// Regras da Task 2 funcionando juntas, nos cenários do Review Focus.
import { splitCurrent } from './current';
import { todayLocal } from './dates';
import { suggestNextDue } from './nextDose';
import { getStatus, worstStatus } from './status';

describe('Review Focus 1 — virada do dia no fuso do Brasil', () => {
  it('às 22:00 do dia do vencimento, a vacina é "vence em breve", não "vencida"', () => {
    const now = new Date('2026-11-13T01:00:00Z'); // 22:00 em UTC-3; em UTC já é dia 13
    const today = todayLocal(now);
    expect(today).toBe('2026-11-12');
    expect(getStatus('2026-11-12', today, 30)).toBe('due_soon');
    // com a data UTC (o erro que o teste existe para evitar) ela apareceria vencida um dia antes
    expect(getStatus('2026-11-12', now.toISOString().slice(0, 10), 30)).toBe('overdue');
  });

  it('à 00:00 do dia seguinte ela passa a vencida', () => {
    const today = todayLocal(new Date('2026-11-13T03:00:00Z'));
    expect(getStatus('2026-11-12', today, 30)).toBe('overdue');
  });
});

describe('Fluxo: registrar, reforçar e calcular o selo do pet', () => {
  const today = '2026-11-12';
  const mk = (id: string, name: string, appliedOn: string, interval = 365) => ({
    id,
    catalogId: null,
    vaccineName: name,
    appliedOn,
    createdAt: `${appliedOn}T12:00:00.000Z`,
    nextDueOn: suggestNextDue(appliedOn, interval),
  });

  it('a aplicação antiga (vencida) não conta depois do reforço; o selo do pet considera só as vigentes', () => {
    const list = [
      mk('rabies-2024', 'Antirrabica', '2024-11-28'), // próxima: 2025-11-28, vencida
      mk('rabies-2026', 'ANTIRRÁBICA ', today), // reforço de hoje, próxima: 2027-11-12
      mk('v10', 'V10', '2026-01-10'), // próxima: 2027-01-10
    ];
    const { current } = splitCurrent(list);
    expect(current.map((r) => r.id)).toEqual(['rabies-2026', 'v10']);
    const statuses = current.map((r) => getStatus(r.nextDueOn, today, 30));
    expect(statuses).toEqual(['ok', 'ok']);
    expect(worstStatus(statuses)).toBe('ok');
  });

  it('sem o reforço, a mesma vacina deixa o pet com selo "vencida"', () => {
    const { current } = splitCurrent([mk('rabies-2024', 'Antirrábica', '2024-11-28'), mk('v10', 'V10', '2026-01-10')]);
    const statuses = current.map((r) => getStatus(r.nextDueOn, today, 30));
    expect(worstStatus(statuses)).toBe('overdue');
  });

  it('próxima dose sugerida a partir de hoje nasce "em dia"', () => {
    const next = suggestNextDue(today, 365);
    expect(next).toBe('2027-11-12');
    expect(getStatus(next, today, 30)).toBe('ok');
  });
});
