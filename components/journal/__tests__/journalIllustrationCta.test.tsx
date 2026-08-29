/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  resolveJournalIllustrationAccess,
  resolveJournalIllustrationCta,
  resolveJournalIllustrationSidecar,
  shouldReplaceExistingImage,
  shouldShowCompletedJournalReading,
} from '@/lib/journalIllustrationPolicy';
import en from '@/lib/i18n/en';
import { TID } from '@/lib/testIDs';
import type { UserTier } from '@/constants/limits';

jest.mock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, unknown>) => {
    const { testID, onPress, accessibilityRole, disabled, ...rest } = props;
    return {
      ...rest,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(disabled ? { disabled: true } : {}),
    };
  };
  const createElement = (tag: string) => {
    const MockNativeElement = ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement(tag, toDomProps(props), children);
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };

  return {
    ActivityIndicator: () => <span data-testid="activity-indicator" />,
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.web ?? options.default,
    },
    Pressable: createElement('button'),
    StyleSheet: { create: <T extends Record<string, unknown>>(styles: T) => styles, hairlineWidth: 1 },
    Text: createElement('span'),
    View: createElement('div'),
  };
});

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    createAnimatedComponent: (Component: unknown) => Component,
  },
  createAnimatedComponent: (Component: unknown) => Component,
  cubicBezier: (...points: number[]) => `cubic-bezier(${points.join(', ')})`,
  Easing: { bezier: () => (value: unknown) => value },
  useReducedMotion: () => false,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    text: { secondary: '#aaa' },
    status: { danger: { icon: '#f66' } },
    action: { primaryText: '#111' },
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { textPrimary: '#fff', textSecondary: '#aaa', textOnAccentSurface: '#111' },
    mode: 'dark',
    shadows: { lg: {} },
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const BUNDLED_REQUEST_ID = '3f73ab45-9a14-4db9-94a3-d24724457d9e';
const INTERPRETATION = 'The ocean is a rehearsal for leaving.';

function JournalIllustrationFixture({
  tier,
  canGenerateImageNow,
  isAnalyzed,
  analysisStatus,
  imageUrl,
  analysisRequestId,
  imageGenerationFailed,
  imageJobStatus,
  generateDreamImage,
}: {
  tier: UserTier;
  canGenerateImageNow: boolean;
  isAnalyzed: boolean;
  analysisStatus?: 'none' | 'pending' | 'done' | 'failed';
  imageUrl?: string;
  analysisRequestId?: string;
  imageGenerationFailed?: boolean;
  imageJobStatus?: 'queued' | 'running';
  generateDreamImage: (clientRequestId?: string) => void;
}) {
  const { ImageRetry } = require('../ImageRetry');
  const access = resolveJournalIllustrationAccess({
    tier,
    canGenerateImageNow,
    isAnalyzed,
    imageUrl,
    analysisRequestId,
  });
  const sidecar = resolveJournalIllustrationSidecar({
    imageUrl,
    imageGenerationFailed,
    imageJobStatus,
  });
  const cta = resolveJournalIllustrationCta({
    sidecar,
    isAnalyzed,
    allowed: access.allowed,
    reason: access.reason,
    tier,
  });
  const showReading = shouldShowCompletedJournalReading(analysisStatus, isAnalyzed);

  return (
    <div>
      {showReading ? (
        <span data-testid="journal-interpretation">{INTERPRETATION}</span>
      ) : null}
      {cta === 'illustrate' ? (
        <button
          data-testid={TID.Button.JournalIllustrate}
          onClick={() => generateDreamImage(access.bundledRequestId)}
        >
          {en['journal.detail.image.generate_action']}
        </button>
      ) : null}
      {cta === 'retry' ? (
        <ImageRetry onRetry={() => generateDreamImage(access.bundledRequestId)} />
      ) : null}
      {cta === 'quota' ? (
        <span data-testid="journal-image-quota">
          {en['journal.detail.image.quota_exceeded_message']}
        </span>
      ) : null}
    </div>
  );
}

describe('journal illustration CTA', () => {
  afterEach(() => {
    cleanup();
  });

  it('passes replaceExistingImage=false for a first analysis', () => {
    expect(shouldReplaceExistingImage('first')).toBe(false);
  });

  it('shows the Illustrate CTA after text analysis when no image exists', () => {
    const generateDreamImage = jest.fn();
    render(
      <JournalIllustrationFixture
        tier="guest"
        canGenerateImageNow
        isAnalyzed
        analysisStatus="done"
        analysisRequestId={BUNDLED_REQUEST_ID}
        generateDreamImage={generateDreamImage}
      />
    );

    expect(screen.getByTestId(TID.Button.JournalIllustrate).textContent).toBe(
      en['journal.detail.image.generate_action']
    );
    fireEvent.click(screen.getByTestId(TID.Button.JournalIllustrate));
    expect(generateDreamImage).toHaveBeenCalledWith(BUNDLED_REQUEST_ID);
  });

  it('lets a guest illustrate when analysis is exhausted but image remaining', () => {
    const generateDreamImage = jest.fn();
    render(
      <JournalIllustrationFixture
        tier="guest"
        canGenerateImageNow
        isAnalyzed
        analysisStatus="done"
        generateDreamImage={generateDreamImage}
      />
    );

    expect(screen.getByTestId(TID.Button.JournalIllustrate)).toBeTruthy();
    expect(screen.queryByTestId('journal-image-quota')).toBeNull();
  });

  it('blocks a guest with image-specific copy when the image pool is exhausted', () => {
    render(
      <JournalIllustrationFixture
        tier="guest"
        canGenerateImageNow={false}
        isAnalyzed
        analysisStatus="done"
        generateDreamImage={jest.fn()}
      />
    );

    expect(screen.queryByTestId(TID.Button.JournalIllustrate)).toBeNull();
    expect(screen.getByTestId('journal-image-quota').textContent).toBe(
      en['journal.detail.image.quota_exceeded_message']
    );
    expect(en['journal.detail.image.quota_exceeded_message'].toLowerCase()).toContain('illustration');
    expect(en['journal.detail.image.quota_exceeded_message'].toLowerCase()).not.toContain('interpretation');
  });

  it('lets authenticated free illustrate with a valid bundle even if analysis remaining is zero', () => {
    const generateDreamImage = jest.fn();
    render(
      <JournalIllustrationFixture
        tier="free"
        canGenerateImageNow={false}
        isAnalyzed
        analysisStatus="done"
        analysisRequestId={BUNDLED_REQUEST_ID}
        generateDreamImage={generateDreamImage}
      />
    );

    fireEvent.click(screen.getByTestId(TID.Button.JournalIllustrate));
    expect(generateDreamImage).toHaveBeenCalledWith(BUNDLED_REQUEST_ID);
  });

  it('never hides a completed interpretation behind pending or failed image state', () => {
    const pending = render(
      <JournalIllustrationFixture
        tier="plus"
        canGenerateImageNow
        isAnalyzed
        analysisStatus="done"
        imageJobStatus="running"
        generateDreamImage={jest.fn()}
      />
    );
    expect(pending.getByTestId('journal-interpretation').textContent).toBe(INTERPRETATION);
    pending.unmount();

    render(
      <JournalIllustrationFixture
        tier="plus"
        canGenerateImageNow
        isAnalyzed
        analysisStatus="done"
        imageGenerationFailed
        generateDreamImage={jest.fn()}
      />
    );
    expect(screen.getByTestId('journal-interpretation').textContent).toBe(INTERPRETATION);
  });

  it('keeps retry available after a failed illustration job', () => {
    const generateDreamImage = jest.fn();
    render(
      <JournalIllustrationFixture
        tier="free"
        canGenerateImageNow={false}
        isAnalyzed
        analysisStatus="done"
        analysisRequestId={BUNDLED_REQUEST_ID}
        imageGenerationFailed
        generateDreamImage={generateDreamImage}
      />
    );

    fireEvent.click(screen.getByTestId(TID.Button.JournalImageRetry));
    expect(generateDreamImage).toHaveBeenCalledWith(BUNDLED_REQUEST_ID);
  });
});
