import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Announce a status message to screen readers on iOS.
 *
 * `accessibilityLiveRegion` is Android-only, so VoiceOver never hears the
 * messages shown with it. This hook calls
 * `AccessibilityInfo.announceForAccessibility` when a new message appears.
 * On Android it does nothing, because the live region already announces
 * there — announcing again would repeat the message.
 */
export function useAnnounce(message?: string | null) {
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (message && message !== previous.current && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(message);
    }
    previous.current = message;
  }, [message]);
}
