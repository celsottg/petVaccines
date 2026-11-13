import { sampleBackup } from './fixture';
import { BackupError, checkEntries, checkFiles, parseBackupJson } from './validate';

const PET_PHOTO = '33333333-3333-4333-8333-333333333333.jpg';
const PROOF = '44444444-4444-4444-8444-444444444444.jpg';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (failure) {
    expect(failure).toBeInstanceOf(BackupError);
    return (failure as BackupError).code;
  }
  return undefined;
};
const parse = (value: unknown) => parseBackupJson(typeof value === 'string' ? value : JSON.stringify(value));

describe('parseBackupJson', () => {
  it('returns the data of a valid backup', () => {
    expect(parse(sampleBackup())).toEqual(sampleBackup());
  });

  it('rejects text that is not JSON', () => {
    expect(codeOf(() => parse('{ nao é json'))).toBe('INVALID_JSON');
  });

  it.each([[{ hello: 'world' }], [[1, 2]], ['"text"'], [{ ...sampleBackup(), format: 'other' }], [{ ...sampleBackup(), schemaVersion: 'x' }], [{ ...sampleBackup(), schemaVersion: 0 }]])(
    'rejects JSON that is not this app\'s backup: %j',
    (value) => {
      expect(codeOf(() => parse(value))).toBe('NOT_A_BACKUP');
    },
  );

  it('tells a backup from a newer version apart, before validating its content', () => {
    expect(codeOf(() => parse({ format: 'petvaccines-backup', schemaVersion: 2, anything: 'new' }))).toBe('NEWER_VERSION');
  });

  it('flags a supported backup whose content is invalid, keeping the first issue for diagnostics', () => {
    const data = sampleBackup();
    data.attachments[0].file = '../../evil.jpg';
    try {
      parse(data);
      throw new Error('should have thrown');
    } catch (failure) {
      expect(failure).toBeInstanceOf(BackupError);
      expect((failure as BackupError).code).toBe('INVALID_BACKUP');
      expect((failure as BackupError).issue).toEqual({ message: 'invalid_file', path: 'attachments.0.file' });
    }
  });

  it('flags a backup with a dangling reference as invalid', () => {
    const data = sampleBackup();
    data.vaccinations[0].pet_id = '77777777-7777-4777-8777-777777777777';
    expect(codeOf(() => parse(data))).toBe('INVALID_BACKUP');
  });
});

describe('checkEntries', () => {
  it('accepts data.json, photos and pets files and the two folders', () => {
    expect(() => checkEntries([`data.json`, `photos/${PROOF}`, `pets/${PET_PHOTO}`], ['photos', 'pets'])).not.toThrow();
  });

  it.each([
    '../x.jpg',
    '/etc/x',
    'photos/../x.jpg',
    'photos/sub/x.jpg',
    'other/x.jpg',
    'data.json.bak',
    'photos/x.png',
    'photos/AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA.jpg',
    `${PROOF}`,
    'readme.txt',
    `pets/${PROOF}.png`,
    `photos\\${PROOF}`,
  ])('rejects the hostile path %s', (path) => {
    expect(codeOf(() => checkEntries([path], []))).toBe('UNSAFE_ENTRY');
  });

  it.each(['other', 'photos/sub', '../x', 'Photos'])('rejects the folder %s', (dir) => {
    expect(codeOf(() => checkEntries([], [dir]))).toBe('UNSAFE_ENTRY');
  });
});

describe('checkFiles', () => {
  const data = sampleBackup();

  it('returns the referenced files missing from the zip, without throwing', () => {
    expect(checkFiles(data, ['data.json', `photos/${PROOF}`])).toEqual({ missing: [PET_PHOTO] });
    expect(checkFiles(data, ['data.json'])).toEqual({ missing: [PET_PHOTO, PROOF] });
  });

  it('ignores files in the zip that nothing references', () => {
    const extra = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg';
    expect(checkFiles(data, ['data.json', `photos/${PROOF}`, `pets/${PET_PHOTO}`, `photos/${extra}`])).toEqual({ missing: [] });
  });

  it('does not take a file from the wrong folder', () => {
    expect(checkFiles(data, [`pets/${PROOF}`, `photos/${PET_PHOTO}`]).missing).toEqual([PET_PHOTO, PROOF]);
  });

  it('throws UNSAFE_ENTRY for an entry outside the allowed set', () => {
    expect(codeOf(() => checkFiles(data, ['../x.jpg']))).toBe('UNSAFE_ENTRY');
    expect(codeOf(() => checkFiles(data, ['outra-pasta/x.jpg']))).toBe('UNSAFE_ENTRY');
  });
});
