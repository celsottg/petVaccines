/** Longest side, in pixels, of a stored photo (spec section 7). */
export const MAX_PHOTO_SIDE = 2048;

export interface FittedSize {
  width: number;
  height: number;
  /** False when the image already fits, so it must not be scaled at all. */
  resized: boolean;
}

/** Scales a size down so its longer side is at most `max`, keeping the ratio; never scales up. */
export function fitWithin(width: number, height: number, max: number = MAX_PHOTO_SIDE): FittedSize {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height, resized: false };
  const ratio = max / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    resized: true,
  };
}
