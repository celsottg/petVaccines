import { firstRecordAt } from './firstRecordAt';

describe('firstRecordAt', () => {
  it('is the earliest creation instant', () => {
    expect(firstRecordAt([{ createdAt: '2026-10-05T00:00:00.000Z' }, { createdAt: '2026-10-01T00:00:00.000Z' }])).toBe(
      '2026-10-01T00:00:00.000Z',
    );
  });
  it('is null without records', () => {
    expect(firstRecordAt([])).toBeNull();
  });
});
