import { useEffect, useRef, useState } from 'react';

import { t } from '@/i18n';
import { discardFiles } from '@/services/discardFiles';
import type { PhotoOptions, PhotoSource, PreparedPhoto } from '@/services/photos';

/**
 * Runs one photo pick at a time: `prepare` asks for the permission and processes
 * the image, `onPhoto` receives the stored file. A cancelled pick does nothing; a
 * refused permission or a processing failure becomes a message, never a crash.
 */
export function usePhotoPicker(
  prepare: (source: PhotoSource, options: PhotoOptions) => Promise<PreparedPhoto | null>,
  onPhoto: (photo: PreparedPhoto) => void,
) {
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [message, setMessage] = useState<string>();

  async function pick(source: PhotoSource) {
    if (busy.current) return;
    busy.current = true;
    setMessage(undefined);
    try {
      const photo = await prepare(source, { onPermissionDenied: () => setMessage(t('photos.errors.cameraDenied')) });
      if (photo) {
        // Left the screen while the photo was processing: nothing will use the file.
        if (mounted.current) onPhoto(photo);
        else discardFiles([photo.file]);
      }
    } catch {
      setMessage(t('photos.errors.failed'));
    } finally {
      busy.current = false;
    }
  }

  return { pick, message };
}
