'use strict';
/* global __dirname */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const YAML = require('yaml');
const { TI429_BASE_FLOWS, EMPTY_EDITOR_FLOW, EMPTY_EDITOR_SELECTOR, RUN_ID_EXPRESSION, UNIQUE_SENTINELS, inspectTi429DataPreservation } = require('./maestro-ti429-flow-contract');

const ROOT = path.resolve(__dirname, '../..');
const WRITE_FLOW = 'maestro/release-write-tell.yml';
const HELPER = `maestro/${EMPTY_EDITOR_FLOW}`;
let fixture;

function read(relative, root = fixture) {
  return YAML.parseAllDocuments(fs.readFileSync(path.join(root, relative), 'utf8')).map((doc) => doc.toJS());
}

function edit(relative, change) {
  const documents = read(relative);
  change(documents[1], documents[0]);
  fs.writeFileSync(path.join(fixture, relative), documents.map((doc) => YAML.stringify(doc)).join('---\n'));
}

beforeEach(() => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'ti429-preservation-'));
  for (const relative of [...TI429_BASE_FLOWS, HELPER, 'maestro/subflows/open-release-recording.yml', 'maestro/subflows/ensure-recording-text.yml']) {
    fs.mkdirSync(path.dirname(path.join(fixture, relative)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, relative), path.join(fixture, relative));
  }
});

afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }));

describe('TI-429 non-destructive base-app flow contract (static, no device)', () => {
  it.each(TI429_BASE_FLOWS)('accepts the reviewed preservation commands in %s', (flow) => {
    expect(inspectTi429DataPreservation(fixture, flow)).toEqual([]);
  });

  it.each([
    { launchApp: { clearState: true } },
    { launchApp: { stopApp: false, permissions: { all: 'allow' } } },
    { launchApp: {} },
    { clearState: true },
    { setAirplaneMode: 'disabled' },
    { eraseText: 100 },
    { tapOn: { id: 'btn.auth.signOut' } },
    { tapOn: { id: 'btn.dream.delete' } },
    { tapOn: { text: 'Delete' } },
    { runFlow: 'subflows/unreviewed.yml' },
    { runScript: 'unreviewed.js' },
  ])('rejects unsafe or unreviewed command %j', (command) => {
    edit(WRITE_FLOW, (commands) => commands.push(command));
    expect(inspectTi429DataPreservation(fixture, WRITE_FLOW).length).toBeGreaterThan(0);
  });

  it.each([
    undefined,
    { assertVisible: '0 characters' },
    { runFlow: { when: { visible: 'Maybe' }, file: EMPTY_EDITOR_FLOW } },
  ])('rejects a missing or conditional pre-input check %j', (replacement) => {
    edit(WRITE_FLOW, (commands) => {
      const index = commands.findIndex((command) => command.inputText);
      commands.splice(index - 1, 1, ...(replacement ? [replacement] : []));
    });
    expect(inspectTi429DataPreservation(fixture, WRITE_FLOW)).toEqual(expect.arrayContaining([
      expect.stringContaining('immediate unconditional ready-empty-editor'),
    ]));
  });

  it('does not reuse the first empty-editor check for later inputs', () => {
    edit(WRITE_FLOW, (commands) => commands.push({ inputText: 'another dream' }));
    expect(inspectTi429DataPreservation(fixture, WRITE_FLOW)).toEqual(expect.arrayContaining([
      expect.stringContaining('immediate unconditional ready-empty-editor'),
    ]));
  });

  it('rejects callbacks, even when they would otherwise run harmless commands', () => {
    edit(WRITE_FLOW, (_, header) => { header.onFlowComplete = [{ launchApp: { stopApp: false } }]; });
    expect(inspectTi429DataPreservation(fixture, WRITE_FLOW)).toEqual(expect.arrayContaining([
      expect.stringContaining('flow callbacks are not allowed'),
    ]));
  });

  it.each(['enabled', 'count', 'screen', 'optional'])('rejects weakening the helper %s condition', (change) => {
    edit(HELPER, (commands) => {
      const selector = commands[2].extendedWaitUntil.visible;
      if (change === 'enabled') delete selector.containsDescendants[0].enabled;
      if (change === 'count') selector.containsDescendants[1].containsDescendants[0].text = '.*';
      if (change === 'screen') delete selector.id;
      if (change === 'optional') selector.optional = true;
    });
    expect(inspectTi429DataPreservation(fixture, WRITE_FLOW)).toEqual(expect.arrayContaining([
      expect.stringContaining('ready/zero-raw-character editor precondition was changed'),
    ]));
  });

  it('inspects dependencies and refuses an input added to an existing navigation helper', () => {
    edit('maestro/subflows/open-release-recording.yml', (commands) => commands.push({ inputText: 'overwrite' }));
    expect(inspectTi429DataPreservation(fixture, WRITE_FLOW)).toEqual(expect.arrayContaining([
      expect.stringContaining('immediate unconditional ready-empty-editor'),
    ]));
  });

  it('counts exact zero characters in all six locales, never an existing whitespace-only draft', () => {
    const pattern = new RegExp(EMPTY_EDITOR_SELECTOR.containsDescendants[1].containsDescendants[0].text);
    for (const label of ['caractères', 'characters', 'caracteres', 'Zeichen', 'caratteri']) {
      expect(pattern.test(`0 ${label}`)).toBe(true);
      for (const count of [1, 10, 100]) expect(pattern.test(`${count} ${label}`)).toBe(false);
    }
    expect(read(HELPER)[1][2].extendedWaitUntil.visible).toEqual(EMPTY_EDITOR_SELECTOR);
  });

  it('preserves exact short fragments and guards all three guest saves', () => {
    const short = read('maestro/release-short-fragments.yml')[1].filter((command) => command.inputText);
    expect(short.map((command) => command.inputText)).toEqual(['Porte rouge', 'maman', 'loup blanc']);
    const guest = read('maestro/release-guest-unlimited.yml')[1];
    expect(guest.filter((command) => command.runFlow === EMPTY_EDITOR_FLOW)).toHaveLength(3);
    const proof = guest.findIndex((command) => command.assertVisible === 'Guest|Invité|Gast|Invitado|Ospite|Visitante');
    expect(proof).toBeGreaterThan(-1);
    expect(proof).toBeLessThan(guest.findIndex((command) => command.inputText));
  });

  it('kills only after the synthetic draft persisted, then saves the restored story additively', () => {
    const commands = read('maestro/release-draft-kill-relaunch.yml')[1];
    const kill = commands.indexOf('killApp');
    const persisted = commands.findIndex((command) => String(command.extendedWaitUntil?.visible).includes('Draft saved on this device'));
    const screenshot = commands.findIndex((command) => command.takeScreenshot);
    const save = commands.findIndex((command) => command.tapOn?.id === 'btn.saveDream');
    expect(persisted).toBeGreaterThan(commands.findIndex((command) => command.inputText));
    expect(kill).toBeGreaterThan(persisted);
    expect(commands[kill - 2]).toEqual({ assertVisible: { id: 'input.dreamTranscript', text: '^Draft kill relaunch sentinel$' } });
    expect(screenshot).toBeGreaterThan(kill);
    expect(save).toBeGreaterThan(screenshot);
    expect(commands.at(-1)).toEqual({ assertVisible: 'Draft kill relaunch sentinel' });
    expect(commands[save + 1].extendedWaitUntil.visible.id).toBe('component.transcriptCard');
  });

  it.each(['analysis-interrupt', 'journal-trends-deeplinks'])('does not type into existing journal searches in %s', (name) => {
    const text = fs.readFileSync(path.join(fixture, `maestro/release-${name}.yml`), 'utf8');
    expect(text).not.toContain('input.searchDreams');
    expect(text).not.toContain('index: 0');
    expect(text).toContain('containsDescendants:');
  });

  it.each(Object.keys(UNIQUE_SENTINELS))('binds all recovery probes to the current run in %s', (flow) => {
    const [header, commands] = read(flow);
    expect(header.env).toEqual({ TI429_RUN_ID: RUN_ID_EXPRESSION });
    const sentinel = UNIQUE_SENTINELS[flow];
    const literals = [];
    function collect(value) {
      if (typeof value === 'string') literals.push(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    }
    collect(commands);
    const probes = literals.filter((value) => value.includes(sentinel.split(' ${')[0]));
    expect(probes.length).toBeGreaterThanOrEqual(5);
    expect(probes.every((value) => value === sentinel)).toBe(true);
    const oldStory = sentinel.replace('${TI429_RUN_ID}', '1700000000000-123456789');
    const currentStory = sentinel.replace('${TI429_RUN_ID}', '1700000000001-987654321');
    for (const probe of probes) {
      const selector = new RegExp(`^${probe.replace('${TI429_RUN_ID}', '1700000000001-987654321')}$`);
      expect(selector.test(currentStory)).toBe(true);
      expect(selector.test(oldStory)).toBe(false);
    }
  });

  it.each(Object.keys(UNIQUE_SENTINELS))('rejects fallback to an old static story in %s', (flow) => {
    edit(flow, (commands) => {
      commands.push({ assertVisible: UNIQUE_SENTINELS[flow].replace(' ${TI429_RUN_ID}', '') });
    });
    expect(inspectTi429DataPreservation(fixture, flow)).toEqual(expect.arrayContaining([
      expect.stringContaining("every story probe must use this run's unique sentinel"),
    ]));
  });

  it.each([undefined, { TI429_RUN_ID: 'constant' }, { TI429_RUN_ID: '${OTHER_VARIABLE}' }])('rejects a missing, constant or unreviewed run identity %j', (env) => {
    const flow = 'maestro/release-journal-trends-deeplinks.yml';
    edit(flow, (_, header) => { header.env = env; });
    expect(inspectTi429DataPreservation(fixture, flow)).toEqual(expect.arrayContaining([
      expect.stringContaining('generate one unique TI429_RUN_ID'),
    ]));
  });
});
