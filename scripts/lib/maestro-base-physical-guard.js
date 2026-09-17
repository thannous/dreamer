#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('yaml');
const { isEmulatorSerial } = require('../android-device-lock');

const PRODUCTION_ANDROID_APP_ID = 'com.tanuki75.noctalia';

const DESTRUCTIVE_COMMAND_KEYS = new Set([
  'clearState',
  'clearKeychain',
  'clearAppState',
  'uninstallApp',
]);

const UNANALYZABLE_COMMAND_KEYS = new Set([
  'runScript',
  'evalScript',
]);

const RUN_FLOW_KEYS = new Set(['runFlow', 'addFlow', 'retry']);

// Maestro's aliases differ between the flow config and individual commands.
// packageName is not an appId alias; accepting arbitrary extension fields here
// could exempt a command that Maestro actually runs against the base app.
const ROOT_IDENTITY_KEYS = new Set(['appId', '_appId', 'url']);
const LAUNCH_IDENTITY_KEYS = new Set(['appId', 'url']);
const COMMAND_IDENTITY_KEYS = new Set(['appId']);

function isPhysicalAndroidDevice(serial) {
  return Boolean(String(serial || '').trim()) && !isEmulatorSerial(serial);
}

function isBaseAndroidIdentity(identity) {
  return String(identity?.appId || '').trim() === PRODUCTION_ANDROID_APP_ID;
}

function shouldGuardBasePhysicalSelection(_options, devices) {
  const selected = Array.isArray(devices) ? devices.filter(Boolean) : [];
  if (!selected.length) return false;
  return selected.some((serial) => isPhysicalAndroidDevice(serial));
}

function mappingKey(node) {
  if (!yaml.isPair(node) && !(node && node.key)) return '';
  const key = node.key;
  if (yaml.isScalar(key)) return String(key.value ?? '');
  if (yaml.isAlias(key)) return '';
  return '';
}

function isExplicitFalse(node) {
  if (!yaml.isScalar(node)) return false;
  const value = node.value;
  if (value === false) return true;
  return String(value).trim().toLowerCase() === 'false';
}

function isExplicitBooleanNode(node) {
  if (!yaml.isScalar(node)) return false;
  if (node.value === true || node.value === false) return true;
  const text = String(node.value ?? '').trim().toLowerCase();
  return text === 'true' || text === 'false';
}

function isDynamicString(value) {
  const text = String(value ?? '');
  return text.includes('${') || text.includes('{{');
}

function isLaunchAppOptionPath(path) {
  if (!Array.isArray(path)) return false;
  return path.some((entry) => {
    if (entry === 'launchApp') return true;
    if (yaml.isPair(entry) && yaml.isScalar(entry.key)) {
      return String(entry.key.value ?? '') === 'launchApp';
    }
    return false;
  });
}

function isBenignLaunchAppFlag(key, valueNode, path) {
  return (key === 'clearState' || key === 'clearKeychain')
    && isLaunchAppOptionPath(path)
    && isExplicitFalse(valueNode);
}

function isForbiddenCommandName(name) {
  return DESTRUCTIVE_COMMAND_KEYS.has(name) || UNANALYZABLE_COMMAND_KEYS.has(name);
}

function classifyAppId(value) {
  if (value == null) return 'inherit';
  if (typeof value !== 'string') return 'unresolved';
  const text = value.trim();
  if (!text || isDynamicString(text)) return 'unresolved';
  if (text === PRODUCTION_ANDROID_APP_ID) return 'base';
  // Web URLs and invalid/dynamic identities are not proven Android companions.
  if (text !== value || !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(text)) {
    return 'unresolved';
  }
  return 'companion';
}

function classifyAppIdNode(node) {
  if (!node || yaml.isAlias(node) || !yaml.isScalar(node)) return 'unresolved';
  return classifyAppId(node.value);
}

function isProtectedIdentity(identity) {
  return identity !== 'companion';
}

function extractRootAppId(documents) {
  // Only the first document is the flow config. Do not let a later mapping
  // replace its identity. A null url uses appId in Maestro's YamlConfig.
  const contents = documents[0]?.contents;
  if (!yaml.isMap(contents)) return 'inherit';
  const pairs = contents.items.filter((pair) => ROOT_IDENTITY_KEYS.has(mappingKey(pair)));
  const targets = pairs.filter((pair) => !(
    mappingKey(pair) === 'url' && yaml.isScalar(pair.value) && pair.value.value == null
  ));
  if (targets.length > 1) return 'unresolved';
  return targets.length ? classifyAppIdNode(targets[0].value) : 'inherit';
}

function mappingIdentity(node, keys, fileIdentity) {
  const pairs = node.items.filter((pair) => keys.has(mappingKey(pair)));
  // Conflicting aliases are order-sensitive in deserialization. Refuse them
  // instead of guessing which value wins, including null/non-null pairs.
  if (pairs.length > 1) return 'unresolved';
  if (node.items.some((pair) => (
    ['appId', '_appId', 'url', 'packageName'].includes(mappingKey(pair))
    && !keys.has(mappingKey(pair))
  ))) {
    return 'unresolved';
  }
  if (!pairs.length) return fileIdentity;
  const identity = classifyAppIdNode(pairs[0].value);
  // Command appId ?: flow appId: null must never be a companion exemption.
  return identity === 'inherit' ? fileIdentity : identity;
}

function identityFromLaunchApp(path, fileIdentity) {
  if (!Array.isArray(path)) return fileIdentity;
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const entry = path[index];
    if (!yaml.isPair(entry) || mappingKey(entry) !== 'launchApp') continue;
    if (!yaml.isMap(entry.value)) return 'unresolved';
    return mappingIdentity(entry.value, LAUNCH_IDENTITY_KEYS, fileIdentity);
  }
  return fileIdentity;
}

function identityFromPath(path, fileIdentity) {
  return identityFromLaunchApp(path, fileIdentity);
}

function scalarCommandTarget(value, fileIdentity) {
  if (value === true || value === false) return fileIdentity;
  if (value == null) return fileIdentity;
  if (typeof value !== 'string') return 'unresolved';
  const text = value.trim();
  if (!text) return fileIdentity;
  const lower = text.toLowerCase();
  if (lower === 'true' || lower === 'false') return fileIdentity;
  return classifyAppId(text);
}

function commandTargetIdentity(valueNode, path, fileIdentity) {
  if (isLaunchAppOptionPath(path)) {
    // These are boolean flags, not commands with their own target. Invalid
    // scalar/map values cannot redirect the flag to an exempt companion.
    if (!isExplicitBooleanNode(valueNode)) return 'unresolved';
    return identityFromLaunchApp(path, fileIdentity);
  }
  if (!valueNode) return fileIdentity;
  if (yaml.isAlias(valueNode)) return 'unresolved';
  if (yaml.isScalar(valueNode)) return scalarCommandTarget(valueNode.value, fileIdentity);
  if (yaml.isMap(valueNode)) {
    return mappingIdentity(valueNode, COMMAND_IDENTITY_KEYS, fileIdentity);
  }
  return 'unresolved';
}

function locate(doc, node, relative) {
  const lineCounter = doc?.options?.lineCounter;
  const offset = Array.isArray(node?.key?.range)
    ? node.key.range[0]
    : Array.isArray(node?.range)
      ? node.range[0]
      : Array.isArray(node?.value?.range)
        ? node.value.range[0]
        : undefined;
  if (lineCounter && typeof offset === 'number') {
    const pos = lineCounter.linePos(offset);
    if (pos?.line) return `${relative}:${pos.line}`;
  }
  return relative;
}

function stayInsideRoot(rootDir, absolutePath) {
  const root = fs.realpathSync(rootDir);
  const absolute = path.resolve(absolutePath);
  let resolved;
  try {
    resolved = fs.realpathSync(absolutePath);
  } catch {
    resolved = path.resolve(absolutePath);
  }
  const relative = path.relative(root, resolved).replace(/\\/g, '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) {
    return { ok: false, relative: relative || absolutePath, resolved };
  }
  // Normalize an alias of the repository root (e.g. macOS /tmp), but refuse
  // symlinks inside it. Maestro resolves children relative to the lexical
  // parent; following realpath here could inspect a different sibling flow.
  const fromRealRoot = path.relative(root, absolute);
  const lexicalRoot = !fromRealRoot.startsWith(`..${path.sep}`) && fromRealRoot !== '..'
    && !path.isAbsolute(fromRealRoot) ? root : path.resolve(rootDir);
  const expected = path.resolve(root, path.relative(lexicalRoot, absolute));
  if (resolved !== expected) {
    return { ok: false, relative, resolved, reason: 'Maestro flow symlinks are unanalyzable' };
  }
  return { ok: true, relative, resolved };
}

function extractRunFlowTarget(valueNode) {
  if (yaml.isAlias(valueNode)) {
    return { ok: false, reason: 'runFlow alias is unanalyzable' };
  }
  if (yaml.isScalar(valueNode)) {
    const target = String(valueNode.value ?? '');
    if (!target.trim() || isDynamicString(target)) {
      return { ok: false, reason: 'dynamic-or-empty-runFlow' };
    }
    return { ok: true, target };
  }
  if (yaml.isMap(valueNode)) {
    let fileValue = null;
    let hasInlineCommands = false;
    for (const pair of valueNode.items) {
      const key = mappingKey(pair);
      if (key === 'file') fileValue = pair.value;
      if (key === 'when' || key === 'commands') hasInlineCommands = true;
    }
    if (fileValue) {
      if (yaml.isAlias(fileValue) || !yaml.isScalar(fileValue)) {
        return { ok: false, reason: 'dynamic-or-empty-runFlow' };
      }
      const target = String(fileValue.value ?? '');
      if (!target.trim() || isDynamicString(target)) {
        return { ok: false, reason: 'dynamic-or-empty-runFlow' };
      }
      return { ok: true, target };
    }
    if (hasInlineCommands) {
      return { ok: true, inline: true };
    }
    return { ok: false, reason: 'runFlow target is missing, dynamic, or unresolvable' };
  }
  return { ok: false, reason: 'runFlow target is missing, dynamic, or unresolvable' };
}

function collectDocumentIssues(doc, relative) {
  const issues = [];
  const runFlowTargets = [];
  if (doc.errors?.length) {
    for (const error of doc.errors) {
      issues.push(`${relative}: YAML parse error (${error.message})`);
    }
    return { issues, runFlowTargets };
  }

  yaml.visit(doc, {
    Alias() {
      issues.push(`${relative}: YAML alias/cycle is unanalyzable`);
      return yaml.visit.BREAK;
    },
    Scalar(key, scalar, path) {
      if (typeof key !== 'number') return;
      const name = String(scalar.value ?? '').trim();
      if (!isForbiddenCommandName(name)) return;
      const at = locate(doc, scalar, relative);
      if (UNANALYZABLE_COMMAND_KEYS.has(name)) {
        issues.push(`${at}: ${name} cannot be analyzed on a physical base device`);
        return;
      }
      const identity = identityFromPath(path, doc.fileIdentity);
      if (!isProtectedIdentity(identity)) return;
      issues.push(`${at}: ${name} is destructive on the physical base app`);
    },
    Pair(_, pair, path) {
      const key = mappingKey(pair);
      const at = locate(doc, pair, relative);
      if (UNANALYZABLE_COMMAND_KEYS.has(key)) {
        issues.push(`${at}: ${key} cannot be analyzed on a physical base device`);
        return;
      }
      if (DESTRUCTIVE_COMMAND_KEYS.has(key) && !isBenignLaunchAppFlag(key, pair.value, path)) {
        const identity = commandTargetIdentity(pair.value, path, doc.fileIdentity);
        if (!isProtectedIdentity(identity)) return;
        issues.push(`${at}: ${key} is destructive on the physical base app`);
        return;
      }
      if (!RUN_FLOW_KEYS.has(key)) return;
      const extracted = extractRunFlowTarget(pair.value);
      if (!extracted.ok) {
        issues.push(`${at}: ${extracted.reason}`);
        return;
      }
      if (extracted.target) {
        runFlowTargets.push({ target: extracted.target, at });
      }
    },
  });

  return { issues, runFlowTargets };
}

function collectMaestroFlowIssues(absoluteFlow, { rootDir, visited }) {
  const inside = stayInsideRoot(rootDir, absoluteFlow);
  if (!inside.ok) {
    return [`${inside.relative}: ${inside.reason || 'Maestro flow must stay inside the repository'}`];
  }
  const inheritedIdentity = visited.inheritedIdentity || 'unresolved';
  const stack = visited.stack || (visited.stack = new Set());
  const done = visited.done || (visited.done = new Set());
  const cycleKey = inside.resolved;
  const doneKey = `${inside.resolved}|${inheritedIdentity}`;
  if (stack.has(cycleKey)) {
    return [`${inside.relative}: runFlow cycle is unanalyzable`];
  }
  if (done.has(doneKey)) return [];

  if (!fs.existsSync(inside.resolved) || !fs.statSync(inside.resolved).isFile()) {
    return [`${inside.relative}: missing Maestro flow`];
  }

  const source = fs.readFileSync(inside.resolved, 'utf8');
  const lineCounter = new yaml.LineCounter();
  let documents;
  try {
    documents = yaml.parseAllDocuments(source, {
      lineCounter,
      prettyErrors: true,
      uniqueKeys: true,
      maxAliasCount: 0,
      merge: false,
    });
  } catch (error) {
    return [`${inside.relative}: YAML parse error (${error instanceof Error ? error.message : error})`];
  }

  const issues = [];
  const flowDir = path.dirname(inside.resolved);
  const declaredIdentity = extractRootAppId(documents);
  const fileIdentity = declaredIdentity === 'inherit' ? inheritedIdentity : declaredIdentity;
  stack.add(cycleKey);
  for (const doc of documents) {
    doc.options = { ...(doc.options || {}), lineCounter };
    doc.fileIdentity = fileIdentity;
    const collected = collectDocumentIssues(doc, inside.relative);
    issues.push(...collected.issues);
    for (const ref of collected.runFlowTargets) {
      // Maestro normalizes relative references, but passes absolute ones to
      // the filesystem unchanged. Removing /../ before a symlink is resolved
      // could make the guard read a different file. Refuse that ambiguity.
      if (path.isAbsolute(ref.target) && path.normalize(ref.target) !== ref.target) {
        issues.push(`${ref.at}: non-normalized absolute flow path is unanalyzable`);
        continue;
      }
      const candidate = path.resolve(flowDir, ref.target);
      const nested = stayInsideRoot(rootDir, candidate);
      if (!nested.ok) {
        issues.push(`${ref.at}: ${nested.reason || 'external-or-dynamic-runFlow'}`);
        continue;
      }
      issues.push(...collectMaestroFlowIssues(nested.resolved, {
        rootDir,
        visited: {
          stack,
          done,
          inheritedIdentity: fileIdentity,
        },
      }));
    }
  }
  stack.delete(cycleKey);
  done.add(doneKey);
  return Array.from(new Set(issues));
}

function analyzeMaestroFlowsForBasePhysical(flows, { rootDir } = {}) {
  const visited = { stack: new Set(), done: new Set(), inheritedIdentity: 'unresolved' };
  const issues = [];
  for (const flow of flows) {
    const absolute = path.isAbsolute(flow) ? flow : path.join(rootDir, flow);
    issues.push(...collectMaestroFlowIssues(absolute, { rootDir, visited }));
  }
  return Array.from(new Set(issues));
}

function formatBasePhysicalGuardError(issues) {
  return [
    'Refusing Maestro execution on a physical device with the base app identity com.tanuki75.noctalia.',
    'Destructive or unanalyzable commands were found before Metro, input setup, or test commands:',
    ...issues.map((issue) => `  - ${issue}`),
    'No bypass flag exists for this guard. Use an emulator or a statically non-destructive flow on the base app.',
  ].join('\n');
}

function assertBasePhysicalMaestroGuard({
  options,
  devices,
  flows,
  rootDir,
} = {}) {
  if (!shouldGuardBasePhysicalSelection(options, devices)) {
    return { guarded: false, issues: [] };
  }
  const issues = analyzeMaestroFlowsForBasePhysical(flows, { rootDir });
  if (issues.length) {
    throw new Error(formatBasePhysicalGuardError(issues));
  }
  return { guarded: true, issues: [] };
}

function assertReleaseTi429StaysOnBase(options) {
  if (String(options?.suite || '') !== 'release-ti429') return;
  if (options?.sideBySideQa || options?.appId !== PRODUCTION_ANDROID_APP_ID) {
    throw new Error(
      'release-ti429 must target the base app com.tanuki75.noctalia / noctalia; --side-by-side-qa and QA retargeting are refused because the expected proof is the real base package.'
    );
  }
}

module.exports = {
  PRODUCTION_ANDROID_APP_ID,
  analyzeMaestroFlowsForBasePhysical,
  assertBasePhysicalMaestroGuard,
  assertReleaseTi429StaysOnBase,
  formatBasePhysicalGuardError,
  isBaseAndroidIdentity,
  isPhysicalAndroidDevice,
  shouldGuardBasePhysicalSelection,
};
