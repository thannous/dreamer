export function truncateLabelLine(text: string, allowedLength: number): string {
  if (text.length <= allowedLength) return text;
  return `${text.slice(0, Math.max(allowedLength - 1, 1))}…`;
}

type SplitLabelTextOptions = {
  maxCharsPerLine: number;
  maxLines: number;
};

export function splitLabelText(label: string, options: SplitLabelTextOptions): string[] {
  const sanitized = label.trim();
  if (!sanitized) return [''];

  const words = sanitized.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  const pushLine = () => {
    if (!currentLine) return;
    lines.push(currentLine);
    currentLine = '';
  };

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= options.maxCharsPerLine) {
      currentLine = candidate;
      return;
    }

    pushLine();
    currentLine =
      word.length > options.maxCharsPerLine ? truncateLabelLine(word, options.maxCharsPerLine) : word;
    if (lines.length >= options.maxLines) {
      currentLine = truncateLabelLine(currentLine, options.maxCharsPerLine);
    }
  });

  pushLine();

  if (!lines.length) {
    lines.push(truncateLabelLine(sanitized, options.maxCharsPerLine));
  }

  if (lines.length > options.maxLines) {
    const limited = lines.slice(0, options.maxLines);
    limited[options.maxLines - 1] = truncateLabelLine(
      `${limited[options.maxLines - 1]} ${lines.slice(options.maxLines).join(' ')}`.trim(),
      options.maxCharsPerLine,
    );
    return limited;
  }

  return lines;
}

