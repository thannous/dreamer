import React from 'react';
import { render } from '@testing-library/react-native';
import { MarkdownText } from '../MarkdownText';

jest.mock('react-native-fit-image', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return function MockFitImage(props: Record<string, unknown>) {
    return ReactModule.createElement(View, props);
  };
});

jest.mock('expo-linking', () => ({
  canOpenURL: jest.fn(async () => true),
  openURL: jest.fn(async () => undefined),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accent: '#7c5cff',
      backgroundSecondary: '#222222',
      divider: '#444444',
      textPrimary: '#ffffff',
      textSecondary: '#cccccc',
    },
  }),
}));

describe('MarkdownText', () => {
  it('renders the supported chat Markdown shapes with the secured parser', () => {
    const source = [
      '# Heading',
      '',
      '**Bold** and *emphasis* with [a link](https://example.com).',
      '',
      '- First item',
      '- Second item',
      '',
      '```ts',
      'const value = 1;',
      '```',
    ].join('\n');

    const view = render(<MarkdownText>{source}</MarkdownText>);
    const tree = JSON.stringify(view.toJSON());

    expect(tree).toContain('Heading');
    expect(tree).toContain('Bold');
    expect(tree).toContain('emphasis');
    expect(tree).toContain('a link');
    expect(tree).toContain('First item');
    expect(tree).toContain('Second item');
    expect(tree).toContain('const value = 1;');
  });
});
