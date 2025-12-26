import { describe, expect, it } from 'vitest';

import { splitLabelText } from '@/lib/pieLabelUtils';

describe('pieLabelUtils', () => {
  it('[B] Given a long label When splitting Then it caps line count and line length', () => {
    // Given
    const label = 'Recurring Nightmare With Supercalifragilisticexpialidocious Words';

    // When
    const lines = splitLabelText(label, { maxCharsPerLine: 10, maxLines: 3 });

    // Then
    expect(lines.length).toBeLessThanOrEqual(3);
    lines.forEach((line) => {
      expect(line.length).toBeLessThanOrEqual(10);
    });
  });

  it('[E] Given an empty/whitespace label When splitting Then it returns a single empty line', () => {
    // Given
    const label = '   ';

    // When
    const lines = splitLabelText(label, { maxCharsPerLine: 10, maxLines: 3 });

    // Then
    expect(lines).toEqual(['']);
  });
});

