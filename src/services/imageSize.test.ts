import { fitWithin, MAX_PHOTO_SIDE } from './imageSize';

describe('fitWithin', () => {
  it('uses 2048 px as the longest allowed side', () => {
    expect(MAX_PHOTO_SIDE).toBe(2048);
  });

  it('keeps an image that already fits, never upscaling it', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600, resized: false });
    expect(fitWithin(2048, 1000)).toEqual({ width: 2048, height: 1000, resized: false });
  });

  it('scales a landscape image so the width becomes 2048', () => {
    expect(fitWithin(4096, 3072)).toEqual({ width: 2048, height: 1536, resized: true });
  });

  it('scales a portrait image so the height becomes 2048', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1536, height: 2048, resized: true });
  });

  it('rounds the shorter side and keeps it at least 1 px', () => {
    expect(fitWithin(4001, 3001)).toEqual({ width: 2048, height: 1536, resized: true });
    expect(fitWithin(40000, 10)).toEqual({ width: 2048, height: 1, resized: true });
  });

  it('honors a custom limit', () => {
    expect(fitWithin(1000, 500, 100)).toEqual({ width: 100, height: 50, resized: true });
  });
});
