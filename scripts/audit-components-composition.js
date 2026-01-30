#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Audits `components/` for prop-shape "composition smells", focused on:
 * - boolean prop proliferation
 * - prefixed prop groups (primaryX/secondaryY...) suggesting compound components or action objects
 * - render props (renderHeader/renderFooter...) suggesting children/compound components
 *
 * Usage:
 *   node scripts/audit-components-composition.js
 *   node scripts/audit-components-composition.js --json
 *   node scripts/audit-components-composition.js --min-booleans=2
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function parseArg(prefix) {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function walkFiles(dirAbs) {
  const results = [];
  const stack = [dirAbs];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue;
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (full.endsWith('.tsx') || full.endsWith('.ts')) results.push(full);
    }
  }
  return results;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function isPascalCase(name) {
  return /^[A-Z][A-Za-z0-9_]*$/.test(name);
}

function getNodeText(sourceFile, node) {
  return sourceFile.text.slice(node.getStart(sourceFile), node.getEnd());
}

function getIdentifierName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isStringLiteral(node)) return node.text;
  return null;
}

function hasExportModifier(node) {
  const modifiers = node.modifiers;
  if (!modifiers) return false;
  return modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function collectTypeDecls(sourceFile) {
  /** @type {Map<string, ts.Node>} */
  const map = new Map();
  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      map.set(node.name.text, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return map;
}

function extractBooleanPropsFromTypeNode(typeNode, decls) {
  /** @type {Set<string>} */
  const booleans = new Set();
  /** @type {Set<string>} */
  const renderProps = new Set();
  /** @type {Set<string>} */
  const propNames = new Set();

  const visitType = (node) => {
    if (!node) return;

    if (ts.isTypeReferenceNode(node)) {
      const typeName = getIdentifierName(node.typeName);
      if (!typeName) return;
      const decl = decls.get(typeName);
      if (decl) visitTypeDecl(decl);
      return;
    }

    if (ts.isIntersectionTypeNode(node) || ts.isUnionTypeNode(node)) {
      for (const t of node.types) visitType(t);
      return;
    }

    if (ts.isTypeLiteralNode(node)) {
      for (const m of node.members) {
        if (!ts.isPropertySignature(m)) continue;
        const name = getIdentifierName(m.name);
        if (!name) continue;
        propNames.add(name);
        if (name.startsWith('render') && /^[A-Z]/.test(name.slice('render'.length))) {
          renderProps.add(name);
        }
        if (m.type && m.type.kind === ts.SyntaxKind.BooleanKeyword) {
          booleans.add(name);
        }
      }
      return;
    }
  };

  const visitTypeDecl = (decl) => {
    if (ts.isInterfaceDeclaration(decl)) {
      for (const m of decl.members) {
        if (!ts.isPropertySignature(m)) continue;
        const name = getIdentifierName(m.name);
        if (!name) continue;
        propNames.add(name);
        if (name.startsWith('render') && /^[A-Z]/.test(name.slice('render'.length))) {
          renderProps.add(name);
        }
        if (m.type && m.type.kind === ts.SyntaxKind.BooleanKeyword) {
          booleans.add(name);
        }
      }
      return;
    }
    if (ts.isTypeAliasDeclaration(decl)) {
      visitType(decl.type);
      return;
    }
  };

  visitType(typeNode);

  return {
    booleanProps: [...booleans].sort(),
    renderProps: [...renderProps].sort(),
    propNames: [...propNames].sort(),
  };
}

function findFirstFunctionLikeInExpression(expr) {
  if (!expr) return null;
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) return expr;
  if (ts.isCallExpression(expr)) {
    for (const arg of expr.arguments) {
      const found = findFirstFunctionLikeInExpression(arg);
      if (found) return found;
    }
  }
  return null;
}

function extractPropsTypeFromReactFC(typeNode) {
  if (!typeNode) return null;
  // React.FC<Props> / FC<Props> / React.ComponentType<Props>
  if (ts.isTypeReferenceNode(typeNode) && typeNode.typeArguments && typeNode.typeArguments.length) {
    const name = getIdentifierName(typeNode.typeName);
    if (name === 'FC' || name === 'ComponentType') {
      return typeNode.typeArguments[0] ?? null;
    }
    if (ts.isQualifiedName(typeNode.typeName)) {
      const right = typeNode.typeName.right.text;
      if (right === 'FC' || right === 'ComponentType') {
        return typeNode.typeArguments[0] ?? null;
      }
    }
  }
  return null;
}

function findComponentCandidates(sourceFile) {
  /** @type {{ name: string; node: ts.Node; paramType: ts.TypeNode | null }[]} */
  const results = [];

  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && isPascalCase(node.name.text) && hasExportModifier(node)) {
      const param = node.parameters[0];
      results.push({ name: node.name.text, node, paramType: param?.type ?? null });
    }

    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const name = decl.name.text;
        if (!isPascalCase(name)) continue;
        const init = decl.initializer;
        if (!init) continue;
        const fn = findFirstFunctionLikeInExpression(init);
        if (!fn) continue;
        const param = fn.parameters[0];
        const propsTypeFromParam = param?.type ?? null;
        const propsTypeFromAnnotation = extractPropsTypeFromReactFC(decl.type);
        results.push({ name, node: decl, paramType: propsTypeFromParam ?? propsTypeFromAnnotation ?? null });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return results;
}

function analyzeActionGroups(booleanProps, allPropNames) {
  const prefixes = ['primary', 'secondary', 'tertiary', 'link'];
  const found = new Set();
  for (const prefix of prefixes) {
    const hasAny = allPropNames.some((p) => p.startsWith(prefix) && p.length > prefix.length && /[A-Z]/.test(p[prefix.length]));
    if (hasAny) found.add(prefix);
  }
  const hasGroupedActions = found.size >= 2 && allPropNames.some((p) => p === 'primaryLabel' || p === 'secondaryLabel');
  const booleanInGroup = booleanProps.some((p) => prefixes.some((pref) => p.startsWith(pref)));
  return { actionPrefixes: [...found].sort(), hasGroupedActions, booleanInGroup };
}

function scoreFinding({ booleanProps, renderProps, actionPrefixes, variantishBooleans }) {
  let score = 0;
  score += booleanProps.length;
  score += renderProps.length * 2;
  score += actionPrefixes.length >= 2 ? 2 : 0;
  score += variantishBooleans.length;
  return score;
}

function classifyFinding({ booleanProps, renderProps, actionPrefixes, variantishBooleans }) {
  const commonStateNames = new Set([
    'visible',
    'disabled',
    'loading',
    'selected',
    'active',
  ]);

  const stateLike = booleanProps.length > 0 && booleanProps.every((p) => {
    if (commonStateNames.has(p)) return true;
    if (/^(is|has|can|should)[A-Z_]/.test(p)) return true;
    if (/(Disabled|Loading|Visible|Selected|Active)$/.test(p)) return true;
    return false;
  });

  if (renderProps.length > 0) return 'refactor';
  if (actionPrefixes.length >= 2) return 'review';
  if (variantishBooleans.length >= 2) return 'refactor';
  if (booleanProps.length >= 3 && !stateLike) return 'review';
  if (booleanProps.length >= 2 && variantishBooleans.length >= 1) return 'review';
  if (booleanProps.length >= 2 && !stateLike) return 'review';
  return 'ok';
}

function main() {
  const json = process.argv.includes('--json');
  const minBooleans = Number(parseArg('--min-booleans=') ?? '1');
  if (!Number.isFinite(minBooleans) || minBooleans < 0) {
    console.error('Invalid --min-booleans value');
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const componentsDir = path.join(repoRoot, 'components');
  if (!fs.existsSync(componentsDir)) {
    console.error('No components/ directory found at repo root.');
    process.exit(1);
  }

  const files = walkFiles(componentsDir);
  /** @type {any[]} */
  const findings = [];

  for (const fileAbs of files) {
    const rel = toPosix(path.relative(repoRoot, fileAbs));
    const sourceText = fs.readFileSync(fileAbs, 'utf8');
    const kind = fileAbs.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(rel, sourceText, ts.ScriptTarget.Latest, true, kind);

    const decls = collectTypeDecls(sourceFile);
    const candidates = findComponentCandidates(sourceFile);

    for (const c of candidates) {
      if (!c.paramType) continue;

      const { booleanProps, renderProps, propNames } = extractBooleanPropsFromTypeNode(c.paramType, decls);
      if (booleanProps.length < minBooleans && renderProps.length === 0) continue;

      const variantishBooleans = booleanProps.filter((p) => /^(show|hide|enable|disable|wrap|compact|reverse)/.test(p));
      const { actionPrefixes } = analyzeActionGroups(booleanProps, propNames);

      const classification = classifyFinding({ booleanProps, renderProps, actionPrefixes, variantishBooleans });
      const score = scoreFinding({ booleanProps, renderProps, actionPrefixes, variantishBooleans });

      findings.push({
        file: rel,
        component: c.name,
        booleanProps,
        renderProps,
        actionPrefixes,
        variantishBooleans,
        classification,
        score,
      });
    }
  }

  findings.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || a.component.localeCompare(b.component));

  if (json) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2));
    return;
  }

  const byClass = {
    refactor: findings.filter((f) => f.classification === 'refactor'),
    review: findings.filter((f) => f.classification === 'review'),
    ok: findings.filter((f) => f.classification === 'ok'),
  };

  console.log(`# Component composition audit (heuristic)\n`);
  console.log(`- Files scanned: ${files.length}`);
  console.log(`- Findings (minBooleans=${minBooleans}): ${findings.length}`);
  console.log(`- Refactor: ${byClass.refactor.length}, Review: ${byClass.review.length}, OK: ${byClass.ok.length}\n`);

  const printTable = (title, rows) => {
    if (!rows.length) return;
    console.log(`## ${title}\n`);
    console.log(`| Component | File | Boolean props | Notes |`);
    console.log(`| --- | --- | --- | --- |`);
    for (const r of rows) {
      const bools = r.booleanProps.join(', ') || '-';
      const notes = [
        r.renderProps.length ? `render props: ${r.renderProps.join(', ')}` : null,
        r.actionPrefixes.length >= 2 ? `action groups: ${r.actionPrefixes.join('/')}` : null,
        r.variantishBooleans.length ? `variant-ish: ${r.variantishBooleans.join(', ')}` : null,
      ].filter(Boolean).join('; ') || '-';
      console.log(`| ${r.component} | \`${r.file}\` | ${bools} | ${notes} |`);
    }
    console.log('');
  };

  printTable('Refactor candidates', byClass.refactor);
  printTable('Review candidates', byClass.review);
  printTable('Looks OK (still has booleans)', byClass.ok);
}

main();
