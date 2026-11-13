import * as ImagePicker from 'expo-image-picker';

import { fakeFs } from './fakeFileSystem';
import { preparePetPhoto, preparePhoto } from './photos';

jest.mock('expo-file-system', () => jest.requireActual('./fakeFileSystem').fakeModule);
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockContext = { resize: jest.fn(), renderAsync: jest.fn() };
const mockSaveAsync = jest.fn();
// The real (rotation-applied) size of the image behind the picked uri; resize actions apply to it in order.
let mockReal = { width: 0, height: 0 };
function mockResize({ width, height }: { width?: number; height?: number }) {
  const ratio = width ? width / mockReal.width : (height as number) / mockReal.height;
  mockReal = { width: Math.round(mockReal.width * ratio), height: Math.round(mockReal.height * ratio) };
  return mockContext;
}
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (...args: unknown[]) => mockManipulate(...args) },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));
const mockManipulate = jest.fn();

const picker = jest.mocked(ImagePicker);
const PHOTOS = 'file:///docs/photos';
const PETS = 'file:///docs/pets';
const ORIGINAL = 'file:///cache/ImagePicker/original.heic';

function pick(width: number, height: number, real = { width, height }) {
  mockReal = { ...real };
  fakeFs.addFile(ORIGINAL, 9_000_000);
  const result = { canceled: false, assets: [{ uri: ORIGINAL, width, height }] } as ImagePicker.ImagePickerResult;
  picker.launchCameraAsync.mockResolvedValue(result);
  picker.launchImageLibraryAsync.mockResolvedValue(result);
}

beforeEach(() => {
  jest.clearAllMocks();
  fakeFs.reset();
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as ImagePicker.PermissionResponse);
  mockManipulate.mockReturnValue(mockContext);
  mockContext.resize.mockImplementation(mockResize);
  mockContext.renderAsync.mockImplementation(async () => ({ ...mockReal, saveAsync: mockSaveAsync }));
  mockSaveAsync.mockImplementation(async () => {
    fakeFs.addFile('file:///cache/ImageManipulator/out.jpg', 345_678);
    return { uri: 'file:///cache/ImageManipulator/out.jpg', ...mockReal };
  });
});

describe('preparePhoto', () => {
  it('asks for the camera permission only when the camera is chosen, and returns null when denied', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as ImagePicker.PermissionResponse);
    const onPermissionDenied = jest.fn();

    await expect(preparePhoto('camera', { onPermissionDenied })).resolves.toBeNull();

    expect(onPermissionDenied).toHaveBeenCalledTimes(1);
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('opens the library without a permission request (system picker)', async () => {
    pick(1000, 800);

    await preparePhoto('library');

    expect(picker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  });

  it.each(['camera', 'library'] as const)('does not ask the %s picker for EXIF and takes a single image', async (source) => {
    pick(1000, 800);

    await preparePhoto(source);

    const launch = source === 'camera' ? picker.launchCameraAsync : picker.launchImageLibraryAsync;
    const options = launch.mock.calls[0][0];
    expect(options).toEqual(expect.objectContaining({ exif: false, mediaTypes: ['images'], allowsEditing: false }));
    expect(options).not.toHaveProperty('allowsMultipleSelection', true);
  });

  it('returns null when the user cancels', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

    await expect(preparePhoto('library')).resolves.toBeNull();

    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('resizes a landscape photo so the width is 2048 and a portrait one so the height is 2048', async () => {
    pick(4096, 3072);
    await preparePhoto('library');
    expect(mockContext.resize).toHaveBeenLastCalledWith({ width: 2048 });

    pick(3000, 4000);
    await preparePhoto('library');
    expect(mockContext.resize).toHaveBeenLastCalledWith({ height: 2048 });
  });

  it('never upscales a photo that already fits', async () => {
    pick(800, 600);

    await preparePhoto('library');

    expect(mockContext.resize).not.toHaveBeenCalled();
  });

  it('re-encodes as JPEG with quality 0.8 and stores the manipulator output as photos/<id>.jpg', async () => {
    pick(4096, 3072);

    const photo = await preparePhoto('camera');

    expect(mockManipulate).toHaveBeenCalledWith(ORIGINAL);
    expect(mockSaveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8 });
    expect(photo).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      file: expect.stringMatching(/^[0-9a-f-]{36}\.jpg$/),
      sizeBytes: 345_678,
      width: 2048,
      height: 1536,
    });
    expect(photo?.file).toBe(`${photo?.id}.jpg`);
    // Only the processed copy is kept: the picker's original and the temporary output are gone.
    expect(fakeFs.names(PHOTOS)).toEqual([photo?.file]);
    expect(fakeFs.has(ORIGINAL)).toBe(false);
    expect(fakeFs.has('file:///cache/ImageManipulator/out.jpg')).toBe(false);
  });

  it('enforces 2048 px on the image actually produced when the picker reports swapped dimensions', async () => {
    // The picker says 4000x3000 but the rotation-applied image is 3000x4000.
    pick(4000, 3000, { width: 3000, height: 4000 });

    const photo = await preparePhoto('camera');

    expect(Math.max(photo?.width ?? 0, photo?.height ?? 0)).toBeLessThanOrEqual(2048);
    expect(photo).toEqual(expect.objectContaining({ width: 1536, height: 2048 }));
  });

  it('resizes an image the picker reported as small when it is really larger than the limit', async () => {
    pick(1000, 800, { width: 4000, height: 3000 });

    const photo = await preparePhoto('library');

    expect(photo).toEqual(expect.objectContaining({ width: 2048, height: 1536 }));
  });

  it('does not resize twice when the first resize already fits', async () => {
    pick(4096, 3072);

    await preparePhoto('library');

    expect(mockContext.resize).toHaveBeenCalledTimes(1);
  });

  it('never deletes a picked original that lives outside the cache (the user own library file)', async () => {
    const library = 'file:///storage/DCIM/photo.jpg';
    fakeFs.addFile(library, 9_000_000);
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: library, width: 800, height: 600 }],
    } as ImagePicker.ImagePickerResult);

    await preparePhoto('library');

    expect(fakeFs.has(library)).toBe(true);
    expect(fakeFs.has('file:///cache/ImageManipulator/out.jpg')).toBe(false);
  });

  it('leaves no file behind and throws when processing fails', async () => {
    pick(4096, 3072);
    mockContext.renderAsync.mockRejectedValue(new Error('out of memory'));

    await expect(preparePhoto('library')).rejects.toThrow('out of memory');

    expect(fakeFs.names(PHOTOS)).toEqual([]);
    expect(fakeFs.names('file:///cache/ImageManipulator')).toEqual([]);
  });
});

describe('preparePetPhoto', () => {
  it('stores the processed photo under pets/', async () => {
    pick(3000, 4000);

    const photo = await preparePetPhoto('library');

    expect(fakeFs.names(PETS)).toEqual([photo?.file]);
    expect(fakeFs.names(PHOTOS)).toEqual([]);
  });
});
