import { backupAgeDays, shouldWarnBackup } from './backupWarning';

const now = new Date('2026-11-12T12:00:00Z');
const base = { lastBackupAt: null, lastChangeAt: null, firstRecordAt: null, now, warningDays: 14 };

describe('shouldWarnBackup', () => {
  it('warns when the backup is 16 days old and something changed since', () => {
    expect(
      shouldWarnBackup({ ...base, lastBackupAt: '2026-10-27T12:00:00Z', lastChangeAt: '2026-11-10T12:00:00Z' }),
    ).toBe(true);
  });
  it('does not warn when nothing changed after the backup', () => {
    expect(
      shouldWarnBackup({ ...base, lastBackupAt: '2026-10-27T12:00:00Z', lastChangeAt: '2026-10-20T12:00:00Z' }),
    ).toBe(false);
  });
  it('does not warn when the backup is only 10 days old', () => {
    expect(
      shouldWarnBackup({ ...base, lastBackupAt: '2026-11-02T12:00:00Z', lastChangeAt: '2026-11-10T12:00:00Z' }),
    ).toBe(false);
  });
  it('warns when there was never a backup and the first record is 20 days old', () => {
    expect(shouldWarnBackup({ ...base, firstRecordAt: '2026-10-23T12:00:00Z' })).toBe(true);
  });
  it('does not warn when there was never a backup and the first record is recent', () => {
    expect(shouldWarnBackup({ ...base, firstRecordAt: '2026-11-05T12:00:00Z' })).toBe(false);
  });
  it('does not warn when there was never a backup and there are no records', () => {
    expect(shouldWarnBackup(base)).toBe(false);
  });
  it('does not warn exactly at the limit (14 days), only after it', () => {
    const input = { ...base, lastBackupAt: '2026-10-29T12:00:00Z', lastChangeAt: '2026-11-10T12:00:00Z' };
    expect(shouldWarnBackup(input)).toBe(false);
    expect(shouldWarnBackup({ ...input, lastBackupAt: '2026-10-28T12:00:00Z' })).toBe(true);
  });
  it('counts local calendar days, so a late-evening backup does not shift the day', () => {
    // 2026-10-29T01:00Z is 22:00 on 28/10 in Sao Paulo: 15 local days before 12/11.
    const input = { ...base, lastBackupAt: '2026-10-29T01:00:00Z', lastChangeAt: '2026-11-10T12:00:00Z' };
    expect(shouldWarnBackup(input)).toBe(true);
  });
  it('does not count a change made exactly at the backup instant as new', () => {
    const at = '2026-10-01T12:00:00Z';
    expect(shouldWarnBackup({ ...base, lastBackupAt: at, lastChangeAt: at })).toBe(false);
  });
  it('does not warn when never backed up and the first record is exactly 14 days old', () => {
    expect(shouldWarnBackup({ ...base, firstRecordAt: '2026-10-29T12:00:00Z' })).toBe(false);
    expect(shouldWarnBackup({ ...base, firstRecordAt: '2026-10-28T12:00:00Z' })).toBe(true);
  });
  it('treats a missing last change as nothing new after a backup', () => {
    expect(shouldWarnBackup({ ...base, lastBackupAt: '2026-10-01T12:00:00Z' })).toBe(false);
  });
});

describe('backupAgeDays', () => {
  it('is the number of local days between the instant and now', () => {
    expect(backupAgeDays('2026-10-27T12:00:00Z', now)).toBe(16);
  });
});
