/**
 * Mock expo-file-system for testing purposes
 * Provides minimal implementations needed for service tests
 */
export class File {
  constructor(public uri: string) {}

  base64(): string | Promise<string> {
    return 'mock-base64-content';
  }
}

export function readAsStringAsync(uri: string, options?: { encoding?: string }): Promise<string> {
  return Promise.resolve('mock-base64-content');
}

export function getInfoAsync(uri: string): Promise<{ exists: boolean; size: number }> {
  return Promise.resolve({ exists: true, size: 1000 });
}

export function deleteAsync(uri: string): Promise<void> {
  return Promise.resolve();
}

export function makeDirectoryAsync(uri: string, options?: { intermediates?: boolean }): Promise<void> {
  return Promise.resolve();
}

export function moveAsync(options: { from: string; to: string }): Promise<void> {
  return Promise.resolve();
}

export function copyAsync(options: { from: string; to: string }): Promise<void> {
  return Promise.resolve();
}
