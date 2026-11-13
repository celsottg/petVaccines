import { petFromBackup, petToBackup, vaccinationFromBackup, vaccinationToBackup, attachmentFromBackup, attachmentToBackup } from './rows';
import { sampleBackup } from './fixture';

describe('backup row mapping', () => {
  it('uses the database column names and a boolean for reminders_enabled', () => {
    const backup = sampleBackup();
    const vaccination = vaccinationFromBackup(backup.vaccinations[0]);
    expect(vaccination).toMatchObject({ petId: backup.vaccinations[0].pet_id, vaccineName: 'Antirrábica', remindersEnabled: true });
    expect(Object.keys(vaccinationToBackup(vaccination)).sort()).toEqual(Object.keys(backup.vaccinations[0]).sort());
  });

  it('round-trips pets, vaccinations and attachments', () => {
    const backup = sampleBackup();
    expect(backup.pets.map((row) => petToBackup(petFromBackup(row)))).toEqual(backup.pets);
    expect(backup.vaccinations.map((row) => vaccinationToBackup(vaccinationFromBackup(row)))).toEqual(backup.vaccinations);
    expect(backup.attachments.map((row) => attachmentToBackup(attachmentFromBackup(row)))).toEqual(backup.attachments);
  });
});
