import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';

import HomeScreen from '@/app/index';
import EditPetScreen from '@/app/pets/[petId]/edit';
import WalletScreen from '@/app/pets/[petId]/index';
import { archivePet, createPet } from '@/data/pets';
import { newAttachment, newPet } from '@/data/testHelpers';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { pets, settings, vaccinations } from '@/db/schema';
import { deleteFiles } from '@/services/files';
import { preparePetPhoto } from '@/services/photos';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));
jest.mock('@/services/files', () => ({
  photoUri: (file: string) => `file:///docs/photos/${file}`,
  petPhotoUri: (file: string) => `file:///docs/pets/${file}`,
  deleteFiles: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/photos', () => ({ preparePetPhoto: jest.fn() }));

let photoSeq = 0;
const prepared = () => {
  photoSeq += 1;
  const id = `00000000-0000-4000-8000-${String(photoSeq).padStart(12, '0')}`;
  return { id, file: `${id}.jpg`, sizeBytes: 5000, width: 1200, height: 1200 };
};
const choosePhoto = async (button: string, source: 'Tirar foto' | 'Escolher da galeria' = 'Escolher da galeria') => {
  await fireEvent.press(screen.getByRole('button', { name: button }));
  await fireEvent.press(screen.getByRole('button', { name: source }));
};

const routes = {
  index: HomeScreen,
  'pets/[petId]/index': WalletScreen,
  'pets/[petId]/edit': EditPetScreen,
  'pets/[petId]/archive': () => <View testID="archive" />,
  archived: () => <View />,
};
const renderEdit = (petId: string) => renderRouter(routes, { initialUrl: `/pets/${petId}/edit` });
const allPets = () => db.select().from(pets).all();

describe('Editar pet screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.delete(pets).run();
    db.delete(settings).run();
  });

  it('loads the pet into the form', async () => {
    const pet = createPet(db, { name: 'Mia', species: 'cat', breed: 'Siamês', sex: 'female', birthOn: '2023-08-10' });

    await renderEdit(pet.id);

    expect(screen.getByLabelText('Nome').props.value).toBe('Mia');
    expect(screen.getByRole('radio', { name: 'Gato' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Fêmea' })).toBeSelected();
    expect(screen.getByLabelText('Raça (opcional)').props.value).toBe('Siamês');
    expect(screen.getByLabelText('Data de nascimento (opcional)').props.value).toBe('10/08/2023');
  });

  it('saves the changes and returns to the wallet of the pet', async () => {
    const pet = newPet(db, { name: 'Rex', breed: 'Poodle' });
    await renderEdit(pet.id);

    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Max');
    await fireEvent.changeText(screen.getByLabelText('Raça (opcional)'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(allPets()).toEqual([expect.objectContaining({ id: pet.id, name: 'Max', breed: null })]);
    expect(screen).toHavePathname(`/pets/${pet.id}`);
    expect(screen.getAllByText('Max').length).toBeGreaterThan(0);
  });

  it('keeps the existing photo reference, since updatePet replaces every field', async () => {
    const pet = createPet(db, { name: 'Rex', species: 'dog', photoFile: 'rex-photo.jpg' });
    await renderEdit(pet.id);

    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Max');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(allPets()[0]).toMatchObject({ name: 'Max', photoFile: 'rex-photo.jpg' });
  });

  it('does not save an empty name', async () => {
    const pet = newPet(db, { name: 'Rex' });
    await renderEdit(pet.id);

    await fireEvent.changeText(screen.getByLabelText('Nome'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Informe o nome do pet.')).toBeOnTheScreen();
    expect(allPets()[0].name).toBe('Rex');
  });

  it('opens the archive screen from "Dar baixa"', async () => {
    const pet = newPet(db);
    await renderEdit(pet.id);

    await fireEvent.press(screen.getByRole('button', { name: 'Dar baixa' }));

    expect(screen).toHavePathname(`/pets/${pet.id}/archive`);
  });

  it('asks for confirmation before deleting, and keeps the pet on cancel', async () => {
    const pet = newPet(db, { name: 'Rex' });
    await renderEdit(pet.id);

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir pet' }));
    expect(screen.getByText('Excluir Rex?')).toBeOnTheScreen();
    expect(allPets()).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Excluir Rex?')).toBeNull();
    expect(allPets()).toHaveLength(1);
  });

  it('deletes the pet and its vaccinations after confirming, then returns to Meus pets', async () => {
    const pet = newPet(db, { name: 'Rex' });
    createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });
    await renderEdit(pet.id);

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir pet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));

    expect(allPets()).toEqual([]);
    expect(db.select().from(vaccinations).all()).toEqual([]);
    expect(screen).toHavePathname('/');
    expect(screen.getByText('Nenhum pet cadastrado')).toBeOnTheScreen();
  });

  it('keeps the pet and shows a message when deleting fails', async () => {
    const pet = newPet(db, { name: 'Rex' });
    await renderEdit(pet.id);
    const dismissTo = jest.spyOn(router, 'dismissTo');
    const failing = jest.spyOn(db, 'transaction').mockImplementation(() => {
      throw new Error('disk full');
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir pet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));

    expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toBeOnTheScreen();
    expect(dismissTo).not.toHaveBeenCalled();
    failing.mockRestore();
    dismissTo.mockRestore();
    expect(allPets()).toHaveLength(1);
  });

  it('shows a way back to Meus pets when the pet does not exist', async () => {
    await renderEdit('missing-pet');

    expect(screen.getByText('Não encontramos este item')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar para Meus pets' }));
    expect(screen).toHavePathname('/');
  });

  it('does not show "not found" after a successful delete while navigation is pending', async () => {
    const pet = newPet(db, { name: 'Rex' });
    await renderEdit(pet.id);
    jest.spyOn(router, 'dismissTo').mockImplementation(() => {});

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir pet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));

    expect(allPets()).toEqual([]);
    expect(screen.queryByText('Não encontramos este item')).toBeNull();
    jest.restoreAllMocks();
  });

  it('does not edit, archive or delete a pet with the wallet closed', async () => {
    const pet = newPet(db, { name: 'Rex' });
    archivePet(db, pet.id, 'other', null);
    const before = allPets()[0];

    await renderEdit(pet.id);

    expect(screen.getByText('Não encontramos este item')).toBeOnTheScreen();
    for (const name of ['Salvar', 'Dar baixa', 'Excluir pet']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(allPets()[0]).toEqual(before);
  });
  describe('photo', () => {
    it('shows the current photo and keeps it when other fields change', async () => {
      const pet = createPet(db, { name: 'Mia', species: 'cat', photoFile: 'mia.jpg' });
      await renderEdit(pet.id);

      expect(screen.getByLabelText('Foto de Mia')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Trocar foto' })).toBeOnTheScreen();
      await fireEvent.changeText(screen.getByLabelText('Nome'), 'Mia Maria');
      await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

      expect(allPets()[0]).toMatchObject({ name: 'Mia Maria', photoFile: 'mia.jpg' });
      expect(deleteFiles).not.toHaveBeenCalled();
    });

    it('replaces the photo and deletes the old file only after the save', async () => {
      const photo = prepared();
      jest.mocked(preparePetPhoto).mockResolvedValue(photo);
      const pet = createPet(db, { name: 'Mia', species: 'cat', photoFile: 'mia.jpg' });
      await renderEdit(pet.id);

      await choosePhoto('Trocar foto');
      expect(deleteFiles).not.toHaveBeenCalled();
      expect(allPets()[0].photoFile).toBe('mia.jpg');
      await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

      expect(allPets()[0].photoFile).toBe(photo.file);
      expect(deleteFiles).toHaveBeenCalledTimes(1);
      expect(deleteFiles).toHaveBeenCalledWith(['mia.jpg']);
    });

    it('removes the photo on save and deletes its file', async () => {
      const pet = createPet(db, { name: 'Mia', species: 'cat', photoFile: 'mia.jpg' });
      await renderEdit(pet.id);

      await fireEvent.press(screen.getByRole('button', { name: 'Remover foto' }));
      expect(deleteFiles).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

      expect(allPets()[0].photoFile).toBeNull();
      expect(deleteFiles).toHaveBeenCalledWith(['mia.jpg']);
    });

    it('leaves the current photo alone when the user leaves without saving a new one', async () => {
      const photo = prepared();
      jest.mocked(preparePetPhoto).mockResolvedValue(photo);
      const pet = createPet(db, { name: 'Mia', species: 'cat', photoFile: 'mia.jpg' });
      await renderEdit(pet.id);
      await choosePhoto('Trocar foto');

      await screen.unmount();

      expect(deleteFiles).toHaveBeenCalledTimes(1);
      expect(deleteFiles).toHaveBeenCalledWith([photo.file]);
      expect(allPets()[0].photoFile).toBe('mia.jpg');
    });

    it('deletes the pet photo and every proof photo of its vaccinations from disk with the pet', async () => {
      const pet = createPet(db, { name: 'Rex', species: 'dog', photoFile: 'rex.jpg' });
      const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });
      const proof = newAttachment(db, record.id);
      await renderEdit(pet.id);

      await fireEvent.press(screen.getByRole('button', { name: 'Excluir pet' }));
      expect(deleteFiles).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));

      expect(allPets()).toEqual([]);
      expect(deleteFiles).toHaveBeenCalledTimes(1);
      expect(deleteFiles).toHaveBeenCalledWith(expect.arrayContaining(['rex.jpg', proof.file]));
    });
  });

});
