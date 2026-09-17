import {
  MAX_MARKDOWN_INPUT_LENGTH,
  sanitizeMarkdown,
  isAllowedMarkdownUrl,
  shouldRenderMarkdown,
} from '@/lib/markdownSecurity';

describe('markdown security policy', () => {
  it('retains formatting and safe links without rewriting code examples', () => {
    const source = '# Titre\n\n**Gras** et *italique*\n\n- Liste\n\n[Site](https://example.com)\n\n`![image](https://example.com/pixel)`\n\n```html\n<img src="https://example.com">\n```';
    expect(sanitizeMarkdown(source)).toBe(source);
  });

  it('removes remote images, HTML and unsafe links including references', () => {
    const source = '![Photo](https://example.com/pixel)\n\n![Autre][image]\n\n[Ouvrir](javascript:alert%281%29)\n\n[Référence][bad]\n\n<img src="https://example.com/track">\n\n[image]: https://example.com/image\n[bad]: data:text/html,bad';
    const result = sanitizeMarkdown(source);
    expect(result).toContain('Photo\n\nAutre');
    expect(result).toContain('Ouvrir\n\nRéférence');
    expect(result).not.toContain('![');
    expect(result).not.toContain('<img');
    expect(result).not.toContain('[Ouvrir]');
    expect(result).not.toContain('[Référence]');
  });

  it('does not mistake unmatched code markers for protection around an image', () => {
    expect(sanitizeMarkdown('`unclosed\n\n![Photo](https://example.com/pixel)')).not.toContain('![');
    expect(sanitizeMarkdown('```invalid`fence\n![Photo](https://example.com/pixel)')).not.toContain('![');
    expect(sanitizeMarkdown('> ```\n> ![literal](https://example.com)\n> ```')).toContain('![literal]');
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'file:///private/file', 'intent:app', 'https:\n//example.com'])('blocks unsafe link %s', (url) => {
    expect(isAllowedMarkdownUrl(url)).toBe(false);
  });

  it.each(['https://example.com', 'http://example.com', 'mailto:hello@example.com', 'tel:+33123456789'])('allows deliberate navigation to %s', (url) => {
    expect(isAllowedMarkdownUrl(url)).toBe(true);
  });

  it('falls back to plain text before parsing oversized input', () => {
    expect(shouldRenderMarkdown('a'.repeat(MAX_MARKDOWN_INPUT_LENGTH))).toBe(true);
    expect(shouldRenderMarkdown('a'.repeat(MAX_MARKDOWN_INPUT_LENGTH + 1))).toBe(false);
  });
});
