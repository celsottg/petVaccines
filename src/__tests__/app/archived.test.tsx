import { fireEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

import ArchivedScreen from '@/app/archived';
import WalletScreen from '@/app/pets/[petId]/index';
import { archivePet } from '@/data/pets';
import { newPet, newVaccination } from '@/data/testHelpers';
import { db } from '@/db/client';
import { pets, settings } from '@/db/schema';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));

const renderArchived = () =>
  renderRouter({ archived: ArchivedScreen, 'pets/[petId]/index': WalletScreen, index: () => null }, { initialUrl: '/archived' });
const allPets = () => db.select().from(pets).all();

describe('Carteiras encerradas screen', () => {
  beforeEach(() => {
    db.delete(pets).run();
    db.delete(settings).run();
  });

  it('shows a message when there are no archived pets', async () => {
    newPet(db, { name: 'Thor' });

    await renderArchived();

    expect(screen.getByText('Nenhuma carteira encerrada.')).toBeOnTheScreen();
    expect(screen.queryByText('Thor')).toBeNull();
  });

  it('lists only archived pets with the reason and date, and no due-date badge', async () => {
    newPet(db, { name: 'Thor' });
    const bolinha = newPet(db, { name: 'Bolinha', breed: 'Shih-tzu' });
    newVaccination(db, bolinha.id);
    archivePet(db, bolinha.id, 'deceased', '2026-11-12');
    const mia = newPet(db, { name: 'Mia', species: 'cat' });
    archivePet(db, mia.id, 'rehomed', null);

    await renderArchived();

    expect(screen.queryByText('Thor')).toBeNull();
    expect(screen.getByText('Bolinha')).toBeOnTheScreen();
    expect(screen.getByText('Faleceu em 12/11/2026')).toBeOnTheScreen();
    expect(screen.getByText('Mudou de tutor')).toBeOnTheScreen();
    expect(screen.queryByText(/vence|vencida|em dia|Sem vacinas/)).toBeNull();
  });

  it('reactivates a pet, clearing the reason and date', async () => {
    const pet = newPet(db, { name: 'Bolinha' });
    archivePet(db, pet.id, 'deceased', '2026-11-12');
    await renderArchived();

    await fireEvent.press(screen.getByRole('button', { name: 'Reativar a carteira de Bolinha' }));

    expect(allPets()[0]).toMatchObject({ status: 'active', archivedReason: null, archivedOn: null });
    expect(screen.queryByText('Bolinha')).toBeNull();
    expect(screen.getByText('Nenhuma carteira encerrada.')).toBeOnTheScreen();
  });

  it('opens the wallet of a pet in read-only mode', async () => {
    const pet = newPet(db, { name: 'Bolinha' });
    newVaccination(db, pet.id);
    archivePet(db, pet.id, 'deceased', null);
    await renderArchived();

    await fireEvent.press(screen.getByRole('button', { name: /^Bolinha/ }));

    expect(screen).toHavePathname(`/pets/${pet.id}`);
    expect(screen.getByRole('button', { name: /^Antirrábica/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Nova vacina' })).toBeNull();
  });
});
