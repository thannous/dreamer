const path = require('path');

const lucide = require(path.join(__dirname, '..', '..', 'docs', 'js', 'lucide.min.js'));

const ICONS = lucide.icons || {};

function toLucideExportName(name) {
  return String(name || '').replace(/(\w)(\w*)(_|-|\s*)/g, (_match, first, rest) => {
    return `${first.toUpperCase()}${rest.toLowerCase()}`;
  });
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseAttributes(rawAttributes) {
  const attributes = new Map();
  const pattern = /([:@\w.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;

  while ((match = pattern.exec(rawAttributes))) {
    attributes.set(match[1], match[2] ?? match[3] ?? match[4] ?? '');
  }

  return attributes;
}

function serializeAttributes(attributes) {
  return Array.from(attributes.entries())
    .map(([key, value]) => {
      if (value === '') return ` ${key}`;
      return ` ${key}="${escapeAttribute(value)}"`;
    })
    .join('');
}

function mergeClasses(iconName, existingClass) {
  const classes = ['lucide', `lucide-${iconName}`, ...String(existingClass || '').split(/\s+/)]
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(classes)).join(' ');
}

function renderIconNode([tag, attributes]) {
  return `<${tag}${serializeAttributes(new Map(Object.entries(attributes || {})))}></${tag}>`;
}

function renderIconSvg(iconName, iconNodes, originalAttributes) {
  const attributes = new Map([
    ['xmlns', 'http://www.w3.org/2000/svg'],
    ['width', originalAttributes.get('width') || '24'],
    ['height', originalAttributes.get('height') || '24'],
    ['viewBox', originalAttributes.get('viewBox') || '0 0 24 24'],
    ['fill', originalAttributes.get('fill') || 'none'],
    ['stroke', originalAttributes.get('stroke') || 'currentColor'],
    ['stroke-width', originalAttributes.get('stroke-width') || '2'],
    ['stroke-linecap', originalAttributes.get('stroke-linecap') || 'round'],
    ['stroke-linejoin', originalAttributes.get('stroke-linejoin') || 'round'],
    ['data-lucide', iconName],
    ['class', mergeClasses(iconName, originalAttributes.get('class'))],
  ]);

  if (!originalAttributes.has('aria-hidden')) {
    attributes.set('aria-hidden', 'true');
  }
  if (!originalAttributes.has('focusable')) {
    attributes.set('focusable', 'false');
  }

  for (const [key, value] of originalAttributes.entries()) {
    if (
      [
        'class',
        'data-lucide',
        'width',
        'height',
        'viewBox',
        'fill',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
      ].includes(key)
    ) {
      continue;
    }
    attributes.set(key, value);
  }

  return `<svg${serializeAttributes(attributes)}>${iconNodes.map(renderIconNode).join('')}</svg>`;
}

function inlineLucideIcons(html) {
  return String(html).replace(/<i\b([^>]*)>\s*<\/i>/g, (tag, rawAttributes) => {
    const attributes = parseAttributes(rawAttributes);
    const iconName = attributes.get('data-lucide');

    if (!iconName) {
      return tag;
    }

    const exportName = toLucideExportName(iconName);
    const iconNodes = ICONS[exportName];

    if (!iconNodes) {
      throw new Error(`[lucide-inline] Unknown Lucide icon "${iconName}" in ${tag}`);
    }

    return renderIconSvg(iconName, iconNodes, attributes);
  });
}

module.exports = {
  inlineLucideIcons,
  toLucideExportName,
};
