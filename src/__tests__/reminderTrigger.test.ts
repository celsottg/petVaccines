/// <reference types="node" />
import fs from 'fs';
import path from 'path';

// Constraint: the sync of the scheduled reminders has ONE trigger (the useReminderSync hook in src/data).
// Screens and components never call it, so a new screen or an import cannot forget or duplicate it.

const root = path.resolve(__dirname, '..');

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

describe('reminder sync trigger', () => {
  it('is not imported or called from src/app or src/components', () => {
    const offenders = [...sources(path.join(root, 'app')), ...sources(path.join(root, 'components'))].filter((file) =>
      /\b(syncReminders|requestReminderSync)\b/.test(fs.readFileSync(file, 'utf8')),
    );
    expect(offenders.map((file) => path.relative(root, file))).toEqual([]);
  });

  it('is requested by useReminderSync', () => {
    expect(fs.readFileSync(path.join(root, 'data/useReminderSync.ts'), 'utf8')).toMatch(/requestReminderSync/);
  });
});
