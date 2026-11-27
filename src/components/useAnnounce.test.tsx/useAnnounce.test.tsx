import { renderHook } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';

import { useAnnounce } from './useAnnounce';

describe('useAnnounce', () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});

  beforeEach(() => {
    announce.mockClear();
    Platform.OS = 'ios';
  });

  afterAll(() => {
    announce.mockRestore();
  });

  it('announces a new message on iOS', async () => {
    const { rerender } = await renderHook(({ message }: { message?: string }) => useAnnounce(message), {
      initialProps: { message: undefined as string | undefined },
    });
    rerender({ message: 'Backup gerado.' });
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Backup gerado.');
  });

  it('does not announce on Android', async () => {
    Platform.OS = 'android';
    const { rerender } = await renderHook(({ message }: { message?: string }) => useAnnounce(message), {
      initialProps: { message: undefined as string | undefined },
    });
    rerender({ message: 'Backup gerado.' });
    expect(announce).not.toHaveBeenCalled();
  });

  it('does not repeat the same message', async () => {
    const { rerender } = await renderHook(({ message }: { message?: string }) => useAnnounce(message), {
      initialProps: { message: 'Backup gerado.' },
    });
    expect(announce).toHaveBeenCalledTimes(1);
    rerender({ message: 'Backup gerado.' });
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('announces when the message changes', async () => {
    const { rerender } = await renderHook(({ message }: { message?: string }) => useAnnounce(message), {
      initialProps: { message: 'Backup gerado.' },
    });
    expect(announce).toHaveBeenCalledTimes(1);
    rerender({ message: 'Prazo salvo.' });
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith('Prazo salvo.');
  });
});
