import { clampScale, clampTranslation, MAX_ZOOM } from './zoom';

describe('clampScale', () => {
  it('never goes below the fitted size or above the maximum', () => {
    expect(clampScale(0.4)).toBe(1);
    expect(clampScale(2.5)).toBe(2.5);
    expect(clampScale(50)).toBe(MAX_ZOOM);
  });
});

describe('clampTranslation', () => {
  it('does not move an image that is not zoomed in', () => {
    expect(clampTranslation(120, 400, 1)).toBe(0);
  });

  it('lets a zoomed image move only as far as its edges', () => {
    // At 2x a 400 px wide view shows half the image: the edges allow 200 px each way.
    expect(clampTranslation(150, 400, 2)).toBe(150);
    expect(clampTranslation(999, 400, 2)).toBe(200);
    expect(clampTranslation(-999, 400, 2)).toBe(-200);
  });
});
