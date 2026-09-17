import { fromMarkdown } from 'mdast-util-from-markdown';

export const MAX_MARKDOWN_INPUT_LENGTH = 50_000;

export function shouldRenderMarkdown(value: string): boolean {
  return value.length <= MAX_MARKDOWN_INPUT_LENGTH;
}

export function isAllowedMarkdownUrl(url: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(url.trim()) && !/[\u0000-\u001f\u007f]/.test(url);
}

type MarkdownNode = {
  type: string;
  position?: { start: { offset?: number }; end: { offset?: number } };
  children?: MarkdownNode[];
  url?: string;
  identifier?: string;
  alt?: string | null;
  value?: string;
};

const literal = (text: string): string => text.replace(/[\\`*_{}[\]()#+.!<>~|\-]/g, '\\$&');
const nodeText = (node: MarkdownNode): string => node.value ?? node.alt ?? node.children?.map(nodeText).join('') ?? '';

/**
 * Native rendering stays fast for ordinary prose. Only content containing media,
 * HTML or explicit links needs this syntax-aware policy pass. Source offsets keep
 * all other Markdown (including code fences and incomplete streams) untouched.
 */
export function sanitizeMarkdown(source: string): string {
  if (!/!\[|<|]\s*(?:\(|\[|:)/.test(source)) return source;
  const tree = fromMarkdown(source);
  const definitions = new Map<string, string>();
  const walk = (node: MarkdownNode, visit: (node: MarkdownNode) => void) => {
    visit(node);
    node.children?.forEach((child) => walk(child, visit));
  };
  walk(tree, (node) => {
    if (node.type === 'definition' && node.identifier && node.url && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, node.url);
    }
  });
  const edits: { start: number; end: number; text: string }[] = [];
  const sanitize = (node: MarkdownNode) => {
    const url = node.type === 'linkReference' ? definitions.get(node.identifier ?? '') : node.url;
    const blocked = node.type === 'image' || node.type === 'imageReference' || node.type === 'html'
      || ((node.type === 'link' || node.type === 'linkReference') && url != null && !isAllowedMarkdownUrl(url));
    if (blocked && node.position?.start.offset != null && node.position.end.offset != null) {
      edits.push({ start: node.position.start.offset, end: node.position.end.offset,
        text: node.type === 'html' ? '' : literal(nodeText(node)) });
    } else {
      node.children?.forEach(sanitize);
    }
  };
  sanitize(tree);
  let result = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
}
