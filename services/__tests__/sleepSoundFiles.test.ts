/**
 * Isolation test: an app update that renames the cached loops can only be exercised
 * across two installed builds, with the network cut, which no E2E journey covers.
 * The failure it guards is an offline listener losing a sound they already had.
 */
import { SLEEP_SOUNDS, type SleepSoundId } from '@/lib/sleepSounds';
import { ensureSleepSoundFile } from '@/services/sleepSoundFiles';

const mockFiles = new Set<string>();
const mockDownload = jest.fn();

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

jest.mock('expo-file-system', () => {
  class MockDirectory {
    uri: string;
    constructor(base: string, name: string) {
      this.uri = `${base}/${name}`;
    }
    create() {}
  }
  class MockFile {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}/${name}`;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    move(target: MockFile) {
      mockFiles.delete(this.uri);
      mockFiles.add(target.uri);
      this.uri = target.uri;
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    static downloadFileAsync(...args: unknown[]) {
      return mockDownload(...args);
    }
  }
  return { Directory: MockDirectory, File: MockFile, Paths: { document: 'doc' } };
});

const getSleepSound = (id: SleepSoundId) => SLEEP_SOUNDS.find((sound) => sound.id === id)!;

const DIR = 'doc/sleep-sounds';

beforeEach(() => {
  mockFiles.clear();
  mockDownload.mockReset();
});

it('keeps an unchanged recording cached under its old name without downloading it', async () => {
  mockFiles.add(`${DIR}/ocean.m4a`);

  await expect(ensureSleepSoundFile(getSleepSound('ocean'))).resolves.toBe(`${DIR}/ocean-waves.m4a`);
  expect(mockDownload).not.toHaveBeenCalled();
  expect([...mockFiles]).toEqual([`${DIR}/ocean-waves.m4a`]);
});

it('plays the older recording offline and replaces it once the new one downloads', async () => {
  const rain = { ...getSleepSound('rain'), remoteUrl: 'https://noctalia.app/audio/sleep/rain-v2.m4a' };
  mockFiles.add(`${DIR}/rain.m4a`);

  mockDownload.mockRejectedValueOnce(new Error('offline'));
  await expect(ensureSleepSoundFile(rain)).resolves.toBe(`${DIR}/rain.m4a`);

  mockDownload.mockImplementationOnce(async (_url: string, partial: { uri: string }) => {
    mockFiles.add(partial.uri);
    return partial;
  });
  await expect(ensureSleepSoundFile(rain)).resolves.toBe(`${DIR}/rain-v2.m4a`);
  expect([...mockFiles]).toEqual([`${DIR}/rain-v2.m4a`]);
});
