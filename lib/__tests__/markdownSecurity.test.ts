import {
  MAX_MARKDOWN_INPUT_LENGTH,
  SECURE_MARKDOWN_OPTIONS,
  shouldRenderMarkdown,
} from '@/lib/markdownSecurity';

describe('markdown security policy', () => {
  it('disables HTML, fuzzy linkification and smart typography', () => {
    expect(SECURE_MARKDOWN_OPTIONS).toEqual({
      html: false,
      linkify: false,
      typographer: false,
    });
  });

  it('falls back to plain text before parsing oversized input', () => {
    expect(shouldRenderMarkdown('a'.repeat(MAX_MARKDOWN_INPUT_LENGTH))).toBe(true);
    expect(shouldRenderMarkdown('a'.repeat(MAX_MARKDOWN_INPUT_LENGTH + 1))).toBe(false);
  });
});
