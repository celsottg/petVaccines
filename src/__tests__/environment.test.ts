// Task 1, Step 3: os testes rodam no fuso do público do app (Brasil).
describe('test environment', () => {
  it('runs in the America/Sao_Paulo timezone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Sao_Paulo');
    expect(process.env.TZ).toBe('America/Sao_Paulo');
  });

  it('keeps the local day at 22:30 while UTC is already the next day', () => {
    const d = new Date(2026, 10, 12, 22, 30);
    expect(d.getDate()).toBe(12);
    expect(d.toISOString().slice(0, 10)).toBe('2026-11-13');
  });

  it('is not affected by the host timezone (offset is UTC-3 in November)', () => {
    expect(new Date(2026, 10, 12, 12, 0).getTimezoneOffset()).toBe(180);
  });
});
