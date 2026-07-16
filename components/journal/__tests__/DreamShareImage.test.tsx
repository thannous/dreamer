/* @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import React from 'react';

import { DreamShareImage } from '@/components/journal/DreamShareImage';
import type { DreamAnalysis } from '@/lib/types';

jest.mock('expo-image', () => ({
  Image: () => <img alt="Dream" />,
}));

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Image: () => <img alt="Noctalia" />,
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.web ?? options.default,
    },
    StyleSheet: {
      absoluteFill: { position: 'absolute' },
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    View: React.forwardRef(function MockView(
      { children }: { children?: React.ReactNode },
      ref: React.ForwardedRef<HTMLDivElement>
    ) {
      return <div ref={ref}>{children}</div>;
    }),
  };
});

describe('DreamShareImage', () => {
  it('always displays the Noctalia attribution', () => {
    const dream: DreamAnalysis = {
      id: 1,
      transcript: 'Un rêve',
      title: 'Titre du rêve',
      interpretation: '',
      shareableQuote: '',
      imageUrl: '',
      chatHistory: [],
      dreamType: 'Symbolic Dream',
    };

    render(
      <DreamShareImage
        dream={dream}
        t={(key) =>
          key === 'journal.detail.share_image.footer' ? 'Créé avec Noctalia.app' : key
        }
      />
    );

    expect(screen.getByText('Créé avec Noctalia.app')).toBeTruthy();
  });
});
