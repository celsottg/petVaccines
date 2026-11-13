import { backupSchema, CURRENT_SCHEMA_VERSION } from './schema';
import { sampleBackup } from './fixture';

const accepts = (data: unknown) => backupSchema.safeParse(data).success;
// Deep copy so a test can break one field without touching the shared sample.
const clone = () => JSON.parse(JSON.stringify(sampleBackup())) as ReturnType<typeof sampleBackup> & Record<string, any>;

describe('backupSchema', () => {
  it('accepts a valid backup', () => {
    expect(accepts(sampleBackup())).toBe(true);
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });

  it('accepts empty lists', () => {
    expect(accepts({ ...clone(), pets: [], vaccinations: [], attachments: [] })).toBe(true);
  });

  it('rejects a wrong format', () => {
    expect(accepts({ ...clone(), format: 'other-app' })).toBe(false);
  });

  it('rejects another schemaVersion', () => {
    expect(accepts({ ...clone(), schemaVersion: 2 })).toBe(false);
  });

  it.each(['../evil.jpg', '..\\evil.jpg', 'a/b.jpg', 'photo.jpg', '44444444-4444-4444-8444-444444444444.png', '44444444-4444-4444-8444-444444444444.jpg.exe', '44444444-4444-4444-8444-444444444444.tar.jpg'])(
    'rejects the file name %s',
    (file) => {
      const pet = clone();
      pet.pets[0].photo_file = file;
      expect(accepts(pet)).toBe(false);
      const attachment = clone();
      attachment.attachments[0].file = file;
      expect(accepts(attachment)).toBe(false);
    },
  );

  it('rejects an id that is not a UUID', () => {
    const data = clone();
    data.pets[0].id = 'pet-1';
    expect(accepts(data)).toBe(false);
  });

  it('rejects an impossible date', () => {
    const data = clone();
    data.vaccinations[0].applied_on = '2026-02-30';
    expect(accepts(data)).toBe(false);
  });

  it('rejects an instant that is not ISO 8601 UTC', () => {
    const data = clone();
    data.exportedAt = '12/11/2026';
    expect(accepts(data)).toBe(false);
  });

  it('rejects an unknown enum value', () => {
    const data = clone();
    (data.pets[0] as Record<string, unknown>).species = 'bird';
    expect(accepts(data)).toBe(false);
  });

  it('rejects an unknown key in a row', () => {
    const data = clone();
    (data.vaccinations[0] as Record<string, unknown>).extra = 1;
    expect(accepts(data)).toBe(false);
  });

  it('rejects an unknown key in settings', () => {
    const data = clone();
    (data.settings as Record<string, unknown>).last_backup_at = '2026-11-01T00:00:00.000Z';
    expect(accepts(data)).toBe(false);
  });

  it('rejects a missing required field', () => {
    const data = clone();
    delete (data.vaccinations[0] as Partial<(typeof data.vaccinations)[0]>).vaccine_name;
    expect(accepts(data)).toBe(false);
  });

  it('rejects a reminders_enabled that is not a boolean', () => {
    const data = clone();
    (data.vaccinations[0] as Record<string, unknown>).reminders_enabled = 1;
    expect(accepts(data)).toBe(false);
  });

  it('rejects out-of-range settings', () => {
    const data = clone();
    data.settings.backup_warning_days = 0;
    expect(accepts(data)).toBe(false);
  });
});
