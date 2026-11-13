// Pure helpers for ZoomableImage. They run inside gesture worklets on the UI thread.

export const MAX_ZOOM = 5;

/** Keeps the zoom between the fitted size (1) and `MAX_ZOOM`. */
export function clampScale(scale: number): number {
  'worklet';
  return Math.min(MAX_ZOOM, Math.max(1, scale));
}

/** Limits a pan offset on one axis so the zoomed image never leaves a gap at its edges. */
export function clampTranslation(offset: number, viewSize: number, scale: number): number {
  'worklet';
  const max = (viewSize * (scale - 1)) / 2;
  return Math.min(max, Math.max(-max, offset));
}
