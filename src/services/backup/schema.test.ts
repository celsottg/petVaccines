import { backupSchema, CURRENT_SCHEMA_VERSION, inspectBackupHeader } from './schema';
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

const ids = {
  petB: '55555555-5555-4555-8555-555555555555',
  vaccinationB: '66666666-6666-4666-8666-666666666666',
  attachmentB: '77777777-7777-4777-8777-777777777777',
};
const issueOf = (data: unknown) => {
  const result = backupSchema.safeParse(data);
  return result.success ? undefined : result.error.issues.map((issue) => ({ message: issue.message, path: issue.path.join('.') }));
};

describe('backupSchema strictness (format is permanent)', () => {
  it('rejects an unknown top-level key', () => {
    expect(accepts({ ...clone(), extra: true })).toBe(false);
  });

  it('rejects an unknown key in a pet row and in an attachment row', () => {
    const pet = clone();
    (pet.pets[0] as Record<string, unknown>).nickname = 'x';
    expect(accepts(pet)).toBe(false);
    const attachment = clone();
    (attachment.attachments[0] as Record<string, unknown>).extra = 1;
    expect(accepts(attachment)).toBe(false);
  });

  it.each([
    ['pet id', (d: ReturnType<typeof clone>) => (d.pets[0].id = 'x')],
    ['pet_id', (d: ReturnType<typeof clone>) => (d.vaccinations[0].pet_id = 'x')],
    ['vaccination_id', (d: ReturnType<typeof clone>) => (d.attachments[0].vaccination_id = 'x')],
    ['attachment id', (d: ReturnType<typeof clone>) => (d.attachments[0].id = 'x')],
    ['uppercase id', (d: ReturnType<typeof clone>) => (d.pets[0].id = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA')],
    ['uppercase photo_file', (d: ReturnType<typeof clone>) => (d.pets[0].photo_file = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA.jpg')],
    ['uppercase attachment file', (d: ReturnType<typeof clone>) => (d.attachments[0].file = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA.jpg')],
    ['negative size_bytes', (d: ReturnType<typeof clone>) => (d.attachments[0].size_bytes = -1)],
  ])('rejects %s', (_name, change) => {
    const data = clone();
    change(data);
    expect(accepts(data)).toBe(false);
  });

  it('accepts ids generated by the app (lowercase v4 UUIDs)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const id = require('node:crypto').randomUUID() as string;
    const data = clone();
    data.pets[0].id = id;
    data.vaccinations[0].pet_id = id;
    data.pets[0].photo_file = `${id}.jpg`;
    expect(accepts(data)).toBe(true);
  });
});

describe('backupSchema settings', () => {
  it.each([[[]], [[7, 7]], [[-1]], [[366]], [[1.5]]])('rejects reminder_offsets_days %j', (offsets) => {
    const data = clone();
    data.settings.reminder_offsets_days = offsets as number[];
    expect(accepts(data)).toBe(false);
  });
  it.each([0, 366, 1.5])('rejects due_soon_days %j', (value) => {
    const data = clone();
    data.settings.due_soon_days = value;
    expect(accepts(data)).toBe(false);
  });
  it('accepts the bounds', () => {
    const data = clone();
    data.settings = { backup_warning_days: 365, due_soon_days: 1, reminder_offsets_days: [365, 0] };
    expect(accepts(data)).toBe(true);
  });
});

describe('backupSchema integrity', () => {
  it('rejects a vaccination whose pet is not in the file', () => {
    const data = clone();
    data.vaccinations[0].pet_id = ids.petB;
    expect(issueOf(data)).toEqual([{ message: 'unknown_pet', path: 'vaccinations.0.pet_id' }]);
  });
  it('rejects an attachment whose vaccination is not in the file', () => {
    const data = clone();
    data.attachments[0].vaccination_id = ids.vaccinationB;
    expect(issueOf(data)).toEqual([{ message: 'unknown_vaccination', path: 'attachments.0.vaccination_id' }]);
  });
  it('rejects duplicated ids within each list', () => {
    const data = clone();
    data.pets = data.pets.slice(0, 1);
    data.vaccinations = data.vaccinations.slice(0, 1);
    data.pets.push({ ...data.pets[0], photo_file: null });
    data.vaccinations.push({ ...data.vaccinations[0] });
    data.attachments.push({ ...data.attachments[0], file: `${ids.attachmentB}.jpg` });
    expect(issueOf(data)).toEqual(
      expect.arrayContaining([
        { message: 'duplicate_id', path: 'pets.1.id' },
        { message: 'duplicate_id', path: 'vaccinations.1.id' },
        { message: 'duplicate_id', path: 'attachments.1.id' },
      ]),
    );
  });
  it('rejects a file name used twice across pets and attachments', () => {
    const data = clone();
    data.pets[0].photo_file = data.attachments[0].file;
    expect(issueOf(data)).toEqual([{ message: 'duplicate_file', path: 'attachments.0.file' }]);
  });
  it('rejects more than 3 attachments on one vaccination', () => {
    const data = clone();
    for (let i = 1; i <= 3; i += 1) {
      const id = `7777777${i}-7777-4777-8777-777777777777`;
      data.attachments.push({ ...data.attachments[0], id, file: `${id}.jpg` });
    }
    expect(issueOf(data)).toEqual([{ message: 'too_many_attachments', path: 'attachments.3.vaccination_id' }]);
  });
  it('rejects an active pet that carries archive data', () => {
    const data = clone();
    data.pets[0].archived_reason = 'other';
    data.pets[0].archived_on = '2026-01-01';
    expect(issueOf(data)).toEqual([
      { message: 'active_pet_archived', path: 'pets.0.archived_reason' },
      { message: 'active_pet_archived', path: 'pets.0.archived_on' },
    ]);
  });
  it('accepts an archived pet with reason and date', () => {
    const data = clone();
    data.pets[0].status = 'archived';
    data.pets[0].archived_reason = 'deceased';
    data.pets[0].archived_on = '2026-01-01';
    expect(accepts(data)).toBe(true);
  });
});

describe('inspectBackupHeader', () => {
  it('tells a supported backup, a newer one and a non-backup apart', () => {
    expect(inspectBackupHeader({ format: 'petvaccines-backup', schemaVersion: 1 })).toEqual({ kind: 'supported' });
    expect(inspectBackupHeader({ format: 'petvaccines-backup', schemaVersion: 2, anything: 1 })).toEqual({ kind: 'newer', schemaVersion: 2 });
    expect(inspectBackupHeader({ format: 'other', schemaVersion: 2 })).toEqual({ kind: 'not_backup' });
    expect(inspectBackupHeader({ format: 'petvaccines-backup' })).toEqual({ kind: 'not_backup' });
    expect(inspectBackupHeader({ format: 'petvaccines-backup', schemaVersion: 0 })).toEqual({ kind: 'not_backup' });
    expect(inspectBackupHeader({ format: 'petvaccines-backup', schemaVersion: '2' })).toEqual({ kind: 'not_backup' });
    expect(inspectBackupHeader(null)).toEqual({ kind: 'not_backup' });
    expect(inspectBackupHeader([1])).toEqual({ kind: 'not_backup' });
  });
});
