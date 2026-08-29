import type { LucidTrainerState } from '@/lib/lucid/model';
import { createInitialLucidTrainerState } from '@/lib/lucid/domain';

const NOW = Date.UTC(2026, 7, 28, 9, 0, 0);

const mockWrite = jest.fn();
const mockCreate = jest.fn();
const mockIsAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();
const mockExportJson = jest.fn();
const mockExportCsv = jest.fn();

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(_directory: unknown, name: string) {
      this.uri = `file:///cache/${name}`;
    }
    create = mockCreate;
    write = mockWrite;
  },
  Paths: { cache: 'file:///cache' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock('@/services/lucidTrainerStorage', () => {
  const actual = jest.requireActual('@/services/lucidTrainerStorage');
  return {
    ...actual,
    exportLucidTrainerJson: (...args: unknown[]) => mockExportJson(...args),
    exportLucidTrainerCsv: (...args: unknown[]) => mockExportCsv(...args),
  };
});

const { shareLucidTrainerExport } = require('@/services/lucidTrainerExport') as typeof import('@/services/lucidTrainerExport');

function state(): LucidTrainerState {
  return createInitialLucidTrainerState({ now: NOW, timeZone: 'Europe/Paris', locale: 'fr' });
}

describe('shareLucidTrainerExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockImplementation(() => undefined);
    mockWrite.mockImplementation(() => undefined);
    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    mockExportJson.mockReturnValue('{"exportVersion":2}');
    mockExportCsv.mockReturnValue('record_type\r\n');
  });

  it('shares JSON serialized from trainer state only', async () => {
    const current = state();
    await expect(shareLucidTrainerExport(current, 'json')).resolves.toEqual({
      uri: expect.stringMatching(/noctalia-lucid-export-.*\.json$/),
      shared: true,
    });
    expect(mockExportJson).toHaveBeenCalledWith(current);
    expect(mockExportCsv).not.toHaveBeenCalled();
    expect(mockWrite).toHaveBeenCalledWith('{"exportVersion":2}');
    expect(mockShareAsync).toHaveBeenCalledTimes(1);
  });

  it('shares CSV serialized from trainer state only', async () => {
    const current = state();
    await expect(shareLucidTrainerExport(current, 'csv')).resolves.toMatchObject({ shared: true });
    expect(mockExportCsv).toHaveBeenCalledWith(current);
    expect(mockExportJson).not.toHaveBeenCalled();
    expect(mockWrite).toHaveBeenCalledWith('record_type\r\n');
    expect(mockShareAsync).toHaveBeenCalledTimes(1);
  });
});
