import { act, renderHook } from '@testing-library/react-native';

import { exportPetPdf } from '@/services/exportPdf';

import { useExportPdf } from './useExportPdf';

jest.mock('@/services/exportPdf', () => ({ exportPetPdf: jest.fn(), SHARING_UNAVAILABLE: 'SHARING_UNAVAILABLE' }));

const exportMock = jest.mocked(exportPetPdf);

describe('useExportPdf', () => {
  beforeEach(() => jest.clearAllMocks());

  it('runs the export once when start is called twice in a row', async () => {
    let finish!: () => void;
    exportMock.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result } = await renderHook(() => useExportPdf('pet-1'));

    await act(async () => {
      void result.current.start();
      void result.current.start();
    });
    expect(result.current.exporting).toBe(true);
    await act(async () => finish());

    expect(exportMock).toHaveBeenCalledTimes(1);
    expect(exportMock).toHaveBeenCalledWith('pet-1');
    expect(result.current.exporting).toBe(false);
  });

  it('unlocks after a failure so a retry runs again', async () => {
    exportMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);
    const { result } = await renderHook(() => useExportPdf('pet-1'));

    await act(async () => result.current.start());
    expect(result.current.error).toBe('Não foi possível gerar o PDF. Tente novamente.');
    await act(async () => result.current.start());

    expect(exportMock).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeUndefined();
  });
});
