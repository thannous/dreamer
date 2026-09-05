'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { parseAllDocuments } = require('yaml');
const { analyzeMaestroFlowsForBasePhysical } = require('./maestro-base-physical-guard');

const TI429_BASE_FLOWS = [
  'write-tell', 'draft-kill-relaunch', 'short-fragments', 'long-fragment',
  'analysis-interrupt', 'image-independent', 'journal-trends-deeplinks', 'guest-unlimited',
].map((name) => `maestro/release-${name}.yml`);
const EMPTY_EDITOR_FLOW = 'subflows/ti429-ready-empty-editor.yml';
const RUN_ID_EXPRESSION = '${Date.now() + "-" + Math.floor(Math.random() * 1000000000)}';
const UNIQUE_SENTINELS = {
  'maestro/release-analysis-interrupt.yml': 'Analysis interrupt sentinel ${TI429_RUN_ID} silver orchard',
  'maestro/release-journal-trends-deeplinks.yml': 'Trends deeplink sentinel ${TI429_RUN_ID} quiet harbour',
};
const SHARED_FLOWS = new Set([
  EMPTY_EDITOR_FLOW, 'subflows/open-release-recording.yml', 'subflows/ensure-recording-text.yml',
]);
const MODE_READY = { id: 'btn.recording.inputMode.text', enabled: true };
const EMPTY_EDITOR_SELECTOR = {
  id: 'screen.recording',
  containsDescendants: [
    MODE_READY,
    {
      id: 'component.recording.draftProgress',
      containsDescendants: [{ text: '^0 (caractères|characters|caracteres|Zeichen|caratteri)$' }],
    },
    { id: 'input.dreamTranscript', enabled: true },
  ],
};
const EMPTY_EDITOR_COMMANDS = [
  { extendedWaitUntil: { visible: { id: 'screen.recording', containsDescendants: [MODE_READY] }, timeout: 15000 } },
  { tapOn: { id: 'btn.recording.inputMode.text' } },
  { extendedWaitUntil: { visible: EMPTY_EDITOR_SELECTOR, timeout: 15000 } },
  { tapOn: { id: 'input.dreamTranscript' } },
];
const ALLOWED_COMMANDS = new Set([
  'launchApp', 'runFlow', 'extendedWaitUntil', 'assertVisible', 'assertNotVisible',
  'tapOn', 'inputText', 'hideKeyboard', 'scrollUntilVisible', 'takeScreenshot',
  'openLink', 'pressKey', 'killApp',
]);

function readFlow(filePath) {
  const documents = parseAllDocuments(fs.readFileSync(filePath, 'utf8'));
  if (documents.length !== 2 || documents.some((document) => document.errors.length)) {
    throw new Error('expected two valid Maestro YAML documents');
  }
  return documents.map((document) => document.toJS({ maxAliasCount: 0 }));
}

// This is a regression contract for these eight authored flows, not a general
// Maestro sandbox. The runner's physical-device graph guard remains independent.
function inspectTi429DataPreservation(rootDir, flow) {
  if (!TI429_BASE_FLOWS.includes(flow)) return [];
  const issues = analyzeMaestroFlowsForBasePhysical([flow], { rootDir });
  if (issues.length) return issues;
  const visited = new Set();
  function inspectFile(relative) {
    if (visited.has(relative)) return;
    visited.add(relative);
    let header;
    let commands;
    try {
      [header, commands] = readFlow(path.join(rootDir, relative));
    } catch (error) {
      issues.push(`${relative}: ${error.message}`);
      return;
    }
    if (!header || typeof header !== 'object' || header.onFlowStart || header.onFlowComplete) {
      issues.push(`${relative}: flow callbacks are not allowed in the preservation contract`);
    }
    const sentinel = UNIQUE_SENTINELS[relative];
    if (sentinel && !isDeepStrictEqual(header?.env, { TI429_RUN_ID: RUN_ID_EXPRESSION })) {
      issues.push(`${relative}: generate one unique TI429_RUN_ID in the flow header`);
    }
    if (!sentinel && header?.env) {
      issues.push(`${relative}: unreviewed flow environment`);
    }
    function inspectSentinel(value) {
      if (typeof value === 'string' && value.includes(sentinel.split(' ${')[0]) && value !== sentinel) {
        issues.push(`${relative}: every story probe must use this run's unique sentinel`);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(inspectSentinel);
      }
    }
    if (sentinel) inspectSentinel(commands);
    if (relative === `maestro/${EMPTY_EDITOR_FLOW}` && !isDeepStrictEqual(commands, EMPTY_EDITOR_COMMANDS)) {
      issues.push(`${relative}: ready/zero-raw-character editor precondition was changed`);
    }
    function inspectCommands(sequence) {
      if (!Array.isArray(sequence)) {
        issues.push(`${relative}: expected a command list`);
        return;
      }
      sequence.forEach((command, index) => {
        const keys = command && typeof command === 'object' ? Object.keys(command) : [];
        const name = typeof command === 'string' ? command : keys[0];
        const value = command?.[name];
        if (!ALLOWED_COMMANDS.has(name) || (typeof command !== 'string' && keys.length !== 1)) {
          issues.push(`${relative}: unsupported preservation command ${name}`);
          return;
        }
        if (name === 'launchApp' && !isDeepStrictEqual(value, { stopApp: false })) {
          issues.push(`${relative}: launchApp must only set stopApp: false`);
        }
        if (name === 'inputText' && (!isDeepStrictEqual(sequence[index - 1], { runFlow: EMPTY_EDITOR_FLOW }) || typeof value !== 'string' || (value.includes('${') && value !== sentinel))) {
          issues.push(`${relative}: every synthetic inputText needs an immediate unconditional ready-empty-editor check`);
        }
        if (name === 'tapOn' && (!value?.id || /(?:delete|clear|signOut|auth\.|purchase|illustrate)/i.test(value.id))) {
          issues.push(`${relative}: destructive/auth/purchase or unscoped tap is forbidden`);
        }
        if ((name === 'killApp' || name === 'pressKey') && !['maestro/release-draft-kill-relaunch.yml', 'maestro/release-analysis-interrupt.yml'].includes(relative)) {
          issues.push(`${relative}: process interruption is reserved for the two lifecycle flows`);
        }
        if (name === 'runFlow') {
          if (typeof value === 'string' && SHARED_FLOWS.has(value)) {
            inspectFile(`maestro/${value}`);
          } else if (value && typeof value === 'object' && Object.keys(value).every((key) => ['when', 'commands'].includes(key))) {
            inspectCommands(value.commands);
          } else {
            issues.push(`${relative}: unreviewed subflow reference or options`);
          }
        }
      });
    }
    inspectCommands(commands);
  }
  inspectFile(flow);
  return [...new Set(issues)];
}

module.exports = { TI429_BASE_FLOWS, EMPTY_EDITOR_FLOW, EMPTY_EDITOR_SELECTOR, RUN_ID_EXPRESSION, UNIQUE_SENTINELS, inspectTi429DataPreservation };
