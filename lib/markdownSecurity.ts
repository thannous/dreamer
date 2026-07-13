export const MAX_MARKDOWN_INPUT_LENGTH = 50_000;

export const SECURE_MARKDOWN_OPTIONS = Object.freeze({
  html: false,
  linkify: false,
  typographer: false,
});

export function shouldRenderMarkdown(value: string): boolean {
  return value.length <= MAX_MARKDOWN_INPUT_LENGTH;
}
