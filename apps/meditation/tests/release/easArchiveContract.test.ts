import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, '../..');

function activeIgnoreRules(filePath: string): string[] {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

describe('EAS archive contract', () => {
  it('excludes local native projects so app.json drives the managed production prebuild', () => {
    const projectIgnoreRules = activeIgnoreRules(path.join(PROJECT_ROOT, '.easignore'));
    const repositoryEasIgnoreRules = activeIgnoreRules(
      path.join(REPOSITORY_ROOT, '.easignore')
    );

    expect(projectIgnoreRules).toEqual(
      expect.arrayContaining([
        '/android',
        '/ios',
        '/apps/meditation/android',
        '/apps/meditation/ios',
      ])
    );
    expect(repositoryEasIgnoreRules).toEqual(
      expect.arrayContaining(['/apps/meditation/android', '/apps/meditation/ios'])
    );
  });
});
