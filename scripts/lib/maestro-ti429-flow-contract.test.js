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

  it.each([
    ['mode enabled', (selector) => { delete selector.containsDescendants[0].enabled; }],
    ['mode disabled', (selector) => { selector.containsDescendants[0].enabled = false; }],
    ['progress ID', (selector) => { selector.containsDescendants.splice(1, 1); }],
    ['counter ID missing', (selector) => { delete selector.containsDescendants[2].id; }],
    ['counter ID wrong', (selector) => { selector.containsDescendants[2].id = 'input.dreamTranscript'; }],
    ['counter text missing', (selector) => { delete selector.containsDescendants[2].text; }],
    ['counter wildcard', (selector) => { selector.containsDescendants[2].text = '.*'; }],
    ['counter broad zero', (selector) => { selector.containsDescendants[2].text = '.*0.*'; }],
    ['counter unanchored zero', (selector) => { selector.containsDescendants[2].text = '0 (caractères|characters|caracteres|Zeichen|caratteri)'; }],
    ['input enabled', (selector) => { delete selector.containsDescendants[3].enabled; }],
    ['input disabled', (selector) => { selector.containsDescendants[3].enabled = false; }],
    ['screen ID missing', (selector) => { delete selector.id; }],
    ['foreign screen', (selector) => { selector.id = 'screen.journal'; }],
    ['optional', (selector) => { selector.optional = true; }],
    ['counter nested in flattened wrapper', (selector) => {
      selector.containsDescendants[1].containsDescendants = [selector.containsDescendants.splice(2, 1)[0]];
    }],
  ])('rejects weakening or changing the helper %s condition', (_, change) => {
    edit(HELPER, (commands) => {
      change(commands[2].extendedWaitUntil.visible);
    });
    expect(inspectTi429DataPreservation(fixture, WRITE_FLOW)).toEqual(expect.arrayContaining([
      expect.stringContaining('ready/zero-raw-character editor precondition was changed'),
    ]));
  });

  it.each([
    { text: '^0 (caractères|characters|caracteres|Zeichen|caratteri)$' },
    { id: 'component.recording.draftProgress.count', text: '^0 (caractères|characters|caracteres|Zeichen|caratteri)$' },
  ])('rejects an unscoped counter precondition %j', (selector) => {
    edit(HELPER, (commands) => { commands[2].extendedWaitUntil.visible = selector; });
    expect(inspectTi429DataPreservation(fixture, WRITE_FLOW)).toEqual(expect.arrayContaining([
      expect.stringContaining('ready/zero-raw-character editor precondition was changed'),
    ]));
  });

  it.each([
    { id: 'screen.recording', containsDescendants: [{ id: 'btn.recording.inputMode.text' }] },
    { id: 'screen.recording', containsDescendants: [{ id: 'btn.recording.inputMode.text', enabled: false }] },
    { id: 'btn.recording.inputMode.text', enabled: true },
    { id: 'screen.journal', containsDescendants: [{ id: 'btn.recording.inputMode.text', enabled: true }] },
  ])('rejects bypassing the initial scoped hydration check %j', (selector) => {
    edit(HELPER, (commands) => { commands[0].extendedWaitUntil.visible = selector; });
    expect(inspectTi429DataPreservation(fixture, WRITE_FLOW)).toEqual(expect.arrayContaining([
      expect.stringContaining('ready/zero-raw-character editor precondition was changed'),
    ]));
  });

  it.each(['btn.recording.inputMode.text', 'input.dreamTranscript'])('rejects replacing the %s tap with a coordinate fallback', (id) => {
    edit(HELPER, (commands) => {
      commands.find((command) => command.tapOn?.id === id).tapOn = { point: '50%,50%' };
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
    expect(EMPTY_EDITOR_SELECTOR).toEqual({
      id: 'screen.recording',
      containsDescendants: [
        { id: 'btn.recording.inputMode.text', enabled: true },
        { id: 'component.recording.draftProgress' },
        { id: 'component.recording.draftProgress.count', text: '^0 (caractères|characters|caracteres|Zeichen|caratteri)$' },
        { id: 'input.dreamTranscript', enabled: true },
      ],
    });
    const pattern = new RegExp(EMPTY_EDITOR_SELECTOR.containsDescendants[2].text);
    for (const label of ['caractères', 'characters', 'caracteres', 'Zeichen', 'caratteri']) {
      expect(pattern.test(`0 ${label}`)).toBe(true);
      for (const count of [1, 10, 100]) expect(pattern.test(`${count} ${label}`)).toBe(false);
      expect(pattern.test(`dream text: 0 ${label}`)).toBe(false);
      expect(pattern.test(`0 ${label} in my dream`)).toBe(false);
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
