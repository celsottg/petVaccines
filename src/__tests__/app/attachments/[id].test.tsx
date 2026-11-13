import { fireEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';

import ViewerScreen from '@/app/attachments/[id]';
import VaccinationDetailScreen from '@/app/vaccinations/[id]/index';
import { archivePet } from '@/data/pets';
import { newAttachment, newPet, newVaccination } from '@/data/testHelpers';
import { db } from '@/db/client';
import { attachments, pets, settings } from '@/db/schema';
import { deleteFiles } from '@/services/files';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));
jest.mock('@/services/files', () => ({
  photoUri: (file: string) => `file:///docs/photos/${file}`,
  petPhotoUri: (file: string) => `file:///docs/pets/${file}`,
  deleteFiles: jest.fn().mockResolvedValue(undefined),
}));

// Pinch and pan run on the native gesture thread and cannot run under Jest; the
// clamping rules they use are unit-tested in zoom.test.ts and the gestures are checked on a device.
jest.mock('@/components/ZoomableImage', () => {
  const { Image } = jest.requireActual('expo-image');
  return { ZoomableImage: ({ uri, label }: { uri: string; label: string }) => <Image accessibilityLabel={label} source={{ uri }} /> };
});

const routes = {
  index: () => null,
  'vaccinations/[id]/index': VaccinationDetailScreen,
  'vaccinations/[id]/edit': () => <View testID="edit-vaccination" />,
  'vaccinations/new': () => <View testID="new-vaccination" />,
  'attachments/[id]': ViewerScreen,
};
const renderViewer = (id: string) => renderRouter(routes, { initialUrl: `/attachments/${id}` });

describe('Visualizador de comprovante screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.delete(pets).run();
    db.delete(settings).run();
  });

  it('shows the photo full screen with its position among the record photos', async () => {
    const vaccination = newVaccination(db, newPet(db).id, 'Antirrábica');
    newAttachment(db, vaccination.id);
    const second = newAttachment(db, vaccination.id);

    await renderViewer(second.id);

    expect(screen.getByLabelText('Foto 2 de 2 do comprovante de Antirrábica')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Excluir foto' })).toBeOnTheScreen();
  });

  it('keeps the photo when the confirmation is cancelled', async () => {
    const attachment = newAttachment(db, newVaccination(db, newPet(db).id).id);
    await renderViewer(attachment.id);

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir foto' }));
    expect(screen.getByText('Excluir esta foto?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(db.select().from(attachments).all()).toHaveLength(1);
    expect(deleteFiles).not.toHaveBeenCalled();
    expect(screen.queryByText('Excluir esta foto?')).toBeNull();
  });

  it('deletes the row and then the file after confirming, and returns to the record', async () => {
    const vaccination = newVaccination(db, newPet(db).id);
    const attachment = newAttachment(db, vaccination.id);
    await renderViewer(attachment.id);

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir foto' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));

    expect(db.select().from(attachments).all()).toEqual([]);
    expect(deleteFiles).toHaveBeenCalledTimes(1);
    expect(deleteFiles).toHaveBeenCalledWith([attachment.file]);
    expect(screen).toHavePathname(`/vaccinations/${vaccination.id}`);
  });

  it('is read-only for an archived pet: the photo opens but cannot be deleted', async () => {
    const pet = newPet(db);
    const attachment = newAttachment(db, newVaccination(db, pet.id, 'V10').id);
    archivePet(db, pet.id, 'other', null);

    await renderViewer(attachment.id);

    expect(screen.getByLabelText('Foto 1 de 1 do comprovante de V10')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Excluir foto' })).toBeNull();
  });

  it('shows "not found" for a photo that does not exist', async () => {
    await renderViewer('00000000-0000-4000-8000-00000000dead');

    expect(screen.getByText('Não encontramos este item')).toBeOnTheScreen();
  });
});
