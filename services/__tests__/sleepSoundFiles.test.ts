/**
 * Isolation test: an app update that renames the cached loops can only be exercised
 * across two installed builds, with the network cut, which no E2E journey covers.
 * The failure it guards is an offline listener losing a sound they already had.
 * Stalled downloads and captive-portal pages need a network no E2E run controls either.
 */
import { SLEEP_SOUNDS, type SleepSoundId } from '@/lib/sleepSounds';
import { ensureSleepSoundFile } from '@/services/sleepSoundFiles';

const mockFiles = new Set<string>();
const mockDownload = jest.fn();
/** First bytes of each file; an MP4/M4A container names itself `ftyp` at byte 4. */
const mockHeaders = new Map<string, string>();
const M4A_HEADER = '\0\0\0\x20ftyp';

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
    open() {
      const header = mockHeaders.get(this.uri) ?? M4A_HEADER;
      return {
        readBytesSync: (length: number) =>
          Uint8Array.from(header.slice(0, length), (char) => char.charCodeAt(0)),
        close: () => {},
      };
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    static downloadFileAsync(...args: unknown[]) {
      return mockDownload(...args);
    }
  }
  return { Directory: MockDirectory, File: MockFile, FileMode: { ReadOnly: 'r' }, Paths: { document: 'doc' } };
});

const getSleepSound = (id: SleepSoundId) => SLEEP_SOUNDS.find((sound) => sound.id === id)!;

const DIR = 'doc/sleep-sounds';

const downloadsTo = (header = M4A_HEADER) => async (_url: string, partial: { uri: string }) => {
  mockFiles.add(partial.uri);
  mockHeaders.set(partial.uri, header);
  return partial;
};

beforeEach(() => {
  mockFiles.clear();
  mockHeaders.clear();
  mockDownload.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
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

  mockDownload.mockImplementationOnce(downloadsTo());
  await expect(ensureSleepSoundFile(rain)).resolves.toBe(`${DIR}/rain-v2.m4a`);
  expect([...mockFiles]).toEqual([`${DIR}/rain-v2.m4a`]);
});

it('refuses a page served instead of the loop, so the next try downloads it again', async () => {
  mockDownload.mockImplementationOnce(downloadsTo('<!DOCTYPE html>'));

  await expect(ensureSleepSoundFile(getSleepSound('ocean'))).rejects.toThrow('Not an audio file');
  expect([...mockFiles]).toEqual([]);

  mockDownload.mockImplementationOnce(downloadsTo());
  await expect(ensureSleepSoundFile(getSleepSound('ocean'))).resolves.toBe(`${DIR}/ocean-waves.m4a`);
});

it('drops a page an earlier build cached under the loop name and downloads the sound', async () => {
  mockFiles.add(`${DIR}/ocean-waves.m4a`);
  mockHeaders.set(`${DIR}/ocean-waves.m4a`, '<!DOCTYPE html>');
  mockDownload.mockImplementationOnce(downloadsTo());

  await expect(ensureSleepSoundFile(getSleepSound('ocean'))).resolves.toBe(`${DIR}/ocean-waves.m4a`);
  expect(mockDownload).toHaveBeenCalledTimes(1);
  expect(mockHeaders.get(`${DIR}/ocean-waves.m4a.part`)).toBe(M4A_HEADER);
});

it('joins a download already in flight instead of starting a second one', async () => {
  let finish: () => void = () => {};
  mockDownload.mockImplementationOnce(
    (url: string, partial: { uri: string }) =>
      new Promise((resolve) => {
        finish = () => resolve(downloadsTo()(url, partial));
      }),
  );

  const first = ensureSleepSoundFile(getSleepSound('brown-noise'));
  const retry = ensureSleepSoundFile(getSleepSound('brown-noise'));
  finish();

  await expect(Promise.all([first, retry])).resolves.toEqual([
    `${DIR}/brown-noise.m4a`,
    `${DIR}/brown-noise.m4a`,
  ]);
  expect(mockDownload).toHaveBeenCalledTimes(1);
});

it('cancels a download that stops receiving data', async () => {
  jest.useFakeTimers();
  let progress: () => void = () => {};
  mockDownload.mockImplementationOnce(
    (_url: string, _partial: unknown, options: { signal: AbortSignal; onProgress: () => void }) =>
      new Promise((_resolve, reject) => {
        progress = options.onProgress;
        options.signal.addEventListener('abort', () => reject(new Error('AbortError')));
      }),
  );

  const request = ensureSleepSoundFile(getSleepSound('ocean'));
  const outcome = request.catch((error: Error) => error.message);
  await Promise.resolve();

  // Slow but alive: each chunk restarts the 20 s allowance.
  jest.advanceTimersByTime(15_000);
  progress();
  jest.advanceTimersByTime(15_000);
  progress();
  jest.advanceTimersByTime(19_999);
  await Promise.resolve();
  expect(mockDownload).toHaveBeenCalledTimes(1);

  jest.advanceTimersByTime(1);
  await expect(outcome).resolves.toBe('AbortError');
});
