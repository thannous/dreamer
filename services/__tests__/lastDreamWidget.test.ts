import type { DreamAnalysis } from '@/lib/types';

// The widget sits on the home screen, outside the app: it must never keep another
// dreamer's dream after a sign-out, never put back an older state once a newer one is
// laid, and never hand the widgets' settings a null, which they cannot store.

const mockFiles = new Set<string>();
let mockOffline = false;
let mockHoldDownload: Promise<void> | null = null;

jest.mock('expo-file-system', () => {
  const uriOf = (parts: unknown[]) => parts.map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri)).join('/');
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = uriOf(parts);
    }
    get name() {
      return this.uri.split('/').pop() ?? '';
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    async move(target: File) {
      mockFiles.delete(this.uri);
      mockFiles.add(target.uri);
      this.uri = target.uri;
    }
    static async downloadFileAsync(_url: string, destination: File) {
      if (mockHoldDownload) await mockHoldDownload;
      if (mockOffline) throw new Error('offline');
      mockFiles.add(destination.uri);
      return destination;
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = uriOf(parts);
    }
    get exists() {
      return true;
    }
    list() {
      return [...mockFiles].filter((uri) => uri.startsWith(`${this.uri}/`)).map((uri) => new File(uri));
    }
  }
  return { File, Directory, Paths: { cache: new Directory('file:///cache') } };
});
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  manipulateAsync: async (uri: string) => {
    const sized = `${uri}.sized`;
    mockFiles.add(sized);
    return { uri: sized };
  },
}));
jest.mock('@/lib/dreamMediaDiskCache', () => ({
  resolveWithDiskCache: async (dream: { id: number }) => ({ imageStatus: 'ready', imageUrl: `https://paintings/${dream.id}` }),
}));
const mockUpdateSnapshot = jest.fn();
jest.mock('@/services/noctaliaWidgets', () => ({
  getNoctaliaWidgets: () => ({ lastDream: { updateSnapshot: mockUpdateSnapshot }, directory: 'file:///group' }),
  appLink: (path: string) => `noctalia://${path}`,
}));

type Service = typeof import('../lastDreamWidget');
const launch = (): Service => {
  let service: Service | undefined;
  jest.isolateModules(() => {
    service = require('../lastDreamWidget');
  });
  return service!;
};

const dream = (id: number): DreamAnalysis => ({
  id,
  transcript: 'x',
  title: `Dream ${id}`,
  interpretation: '',
  shareableQuote: '',
  imageUrl: `https://paintings/${id}`,
  chatHistory: [],
  dreamType: 'Symbolic Dream',
});
const update = (painted: DreamAnalysis | null, userId: string | null) => ({
  dream: painted,
  userId,
  title: painted?.title ?? '',
  date: painted ? 'Monday 19 October' : null,
  empty: 'Your next painted dream will appear here.',
});
const laid = () => mockUpdateSnapshot.mock.calls.map(([props]) => props as Record<string, unknown>);
const paintings = () => [...mockFiles].filter((uri) => uri.startsWith('file:///group/'));

beforeEach(() => {
  mockFiles.clear();
  mockOffline = false;
  mockHoldDownload = null;
  mockUpdateSnapshot.mockClear();
});

it('clears another dreamer’s dream after a sign-out, even when the next painting cannot be fetched', async () => {
  const service = launch();
  expect(await service.updateLastDreamWidget(update(dream(10), 'alice'))).toBe(true);
  expect(laid()[0]).toMatchObject({ title: 'Dream 10', url: 'noctalia://journal/10' });

  mockOffline = true;
  expect(await service.updateLastDreamWidget(update(dream(5), null))).toBe(false);

  expect(laid()[1]).toEqual({ url: 'noctalia://recording', empty: 'Your next painted dream will appear here.' });
  expect(paintings()).toEqual([]);
  expect(laid().every((props) => !Object.values(props).includes(null))).toBe(true);
});

it('keeps the dreamer’s older dream while a newer painting waits for the network', async () => {
  const service = launch();
  await service.updateLastDreamWidget(update(dream(10), 'alice'));
  mockOffline = true;

  expect(await service.updateLastDreamWidget(update(dream(12), 'alice'))).toBe(false);

  expect(laid()).toHaveLength(1);
  expect(paintings()).toHaveLength(1);
});

it('lays the latest state last when a painting is still downloading', async () => {
  const service = launch();
  let release!: () => void;
  mockHoldDownload = new Promise((resolve) => {
    release = resolve;
  });

  const painting = service.updateLastDreamWidget(update(dream(10), 'alice'));
  const signedOut = service.updateLastDreamWidget(update(null, null));
  release();

  expect(await painting).toBe(false);
  expect(await signedOut).toBe(true);
  expect(laid()).toEqual([{ url: 'noctalia://recording', empty: 'Your next painted dream will appear here.' }]);
  expect(paintings()).toEqual([]);
});
