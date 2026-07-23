/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { OnboardingContextValue } from '@/context/OnboardingContext';
import type { OnboardingEvent, OnboardingState } from '@/lib/onboardingState';
import { TID } from '@/lib/testIDs';

const mockContinueForSession = jest.fn();
const mockGetProductAnalyticsPreference = jest.fn();
const mockReload = jest.fn();
const mockReplace = jest.fn();
const mockSetProductAnalyticsEnabled = jest.fn();
const mockTrackProductEvent = jest.fn().mockResolvedValue(undefined);
const mockTransition = jest.fn();
const mockUseOnboarding = jest.fn();

const buildState = (overrides: Partial<OnboardingState> = {}): OnboardingState => ({
  schemaVersion: 1,
  experienceVersion: 2,
  status: 'in_progress',
  step: 'intro',
  selectedPath: null,
  completionReason: null,
  pendingRecordingIntent: null,
  startedAt: 1,
  completedAt: null,
  updatedAt: 1,
  ...overrides,
});

const buildCompletedState = (
  path: 'analyze' | 'memory' | 'dictionary'
): OnboardingState => ({
  ...buildState({
    status: 'completed',
    step: null,
    selectedPath: path,
    completionReason: path,
    completedAt: 2,
  }),
  pendingRecordingIntent:
    path === 'dictionary'
      ? null
      : {
          entryId: `entry-${path}`,
          intent: path === 'memory' ? 'remembered' : 'fresh',
          source: 'onboarding',
          postSave: path === 'memory' ? 'journal_first' : 'confirm_analysis',
          phase: 'capture',
          createdAt: 1,
          expiresAt: 10_000,
        },
});

const renderOnboarding = (
  stateOverrides: Partial<OnboardingState> = {},
  contextOverrides: Partial<OnboardingContextValue> = {}
) => {
  mockUseOnboarding.mockReturnValue({
    state: buildState(stateOverrides),
    loading: false,
    error: null,
    scope: 'guest',
    transition: mockTransition,
    continueForSession: mockContinueForSession,
    reload: mockReload,
    ...contextOverrides,
  });

  return render(<OnboardingScreen />);
};

jest.doMock('expo-router', () => ({
  router: { replace: mockReplace },
}));

jest.doMock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({ uri: 'asset://onboarding-background' }),
  },
}));

jest.doMock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      onPress,
      onLayout,
      accessibilityRole,
      accessibilityLabel,
      accessibilityHint,
      accessibilityState,
      accessibilityLiveRegion,
      accessible,
      importantForAccessibility,
      contentContainerStyle,
      contentInsetAdjustmentBehavior,
      resizeMode,
      source,
      style,
      ...rest
    } = props;
    return {
      ...rest,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
      ...(accessibilityHint ? { 'aria-description': accessibilityHint } : {}),
      ...(accessibilityState?.checked !== undefined
        ? { 'aria-checked': accessibilityState.checked }
        : {}),
      ...(accessibilityLiveRegion ? { 'aria-live': accessibilityLiveRegion } : {}),
    };
  };
  const createElement = (tag: string) => {
    const MockNativeElement = React.forwardRef(
      (
        {
          children,
          ...props
        }: {
          children?: React.ReactNode;
          [key: string]: any;
        },
        ref: React.ForwardedRef<HTMLElement>
      ) => React.createElement(tag, { ...toDomProps(props), ref }, children)
    );
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };

  return {
    __esModule: true,
    AccessibilityInfo: {
      announceForAccessibility: jest.fn(),
      setAccessibilityFocus: jest.fn(),
    },
    ActivityIndicator: () => <span data-testid="activity-indicator" />,
    Image: createElement('img'),
    Platform: {
      OS: 'web',
      select: (values: Record<string, any>) => values?.web ?? values?.default,
    },
    Pressable: createElement('button'),
    ScrollView: createElement('div'),
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T) => styles,
      hairlineWidth: 1,
    },
    Switch: ({
      accessibilityLabel,
      disabled,
      onValueChange,
      value,
    }: {
      accessibilityLabel?: string;
      disabled?: boolean;
      onValueChange?: (value: boolean) => void;
      value: boolean;
    }) => (
      <input
        aria-label={accessibilityLabel}
        checked={value}
        disabled={disabled}
        onChange={(event) => onValueChange?.(event.currentTarget.checked)}
        type="checkbox"
      />
    ),
    Text: createElement('span'),
    View: createElement('div'),
    findNodeHandle: () => 1,
  };
});

jest.doMock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.doMock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <span data-testid="icon-symbol" />,
}));

jest.doMock('@/components/ui/StandardBottomSheet', () => ({
  StandardBottomSheet: ({
    children,
    testID,
    visible,
  }: {
    children?: React.ReactNode;
    testID?: string;
    visible: boolean;
  }) => (visible ? <div data-testid={testID}>{children}</div> : null),
}));

jest.doMock('@/context/OnboardingContext', () => ({
  useOnboarding: () => mockUseOnboarding(),
}));

jest.doMock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'dark',
    colors: {
      accent: '#6f62b5',
      accentDark: '#55479c',
      accentLight: '#988de0',
      backgroundCard: '#221b3b',
      backgroundSecondary: '#2f274f',
      backgroundDark: '#0b0a12',
      divider: '#3a3357',
      overlay: 'rgba(0,0,0,.4)',
      textPrimary: '#fff',
      textSecondary: '#c7c2d7',
      textTertiary: '#9a93b4',
      textOnAccentSurface: '#fff',
      navbarBg: '#0b0a12',
      navbarBorder: '#3a3357',
      navbarTextActive: '#fff',
      navbarTextInactive: '#9a93b4',
    },
  }),
}));

jest.doMock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.doMock('@/lib/analytics', () => ({
  trackProductEvent: mockTrackProductEvent,
}));

jest.doMock('@/lib/productAnalytics', () => ({
  getProductAnalyticsPreference: mockGetProductAnalyticsPreference,
  isProductAnalyticsAvailable: () => true,
  setProductAnalyticsEnabled: mockSetProductAnalyticsEnabled,
}));

const { default: OnboardingScreen } = require('@/app/onboarding');

describe('Onboarding screen', () => {
  beforeEach(() => {
    mockGetProductAnalyticsPreference.mockResolvedValue('disabled');
    mockReload.mockResolvedValue(buildState());
    mockSetProductAnalyticsEnabled.mockResolvedValue(undefined);
    mockTransition.mockImplementation(async (event: OnboardingEvent) => {
      if (event.type === 'SKIP') {
        return buildState({
          status: 'skipped',
          step: null,
          completionReason: 'skip',
          completedAt: 2,
        });
      }
      if (event.type === 'COMPLETE') {
        return buildCompletedState(event.path ?? 'analyze');
      }
      if (event.type === 'SELECT_PATH') {
        return buildState({ step: 'path', selectedPath: event.path });
      }
      return buildState({ step: event.type === 'GO_TO_STEP' ? event.step : 'intro' });
    });
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('skips onboarding and opens recording', async () => {
    renderOnboarding();

    fireEvent.click(screen.getByTestId(TID.Button.OnboardingSkip));

    await waitFor(() => {
      expect(mockTransition).toHaveBeenCalledWith({ type: 'SKIP' });
      expect(mockReplace).toHaveBeenCalledWith('/recording');
    });
  });

  it('keeps the remembered-dream choice through completion and opens its recording intent', async () => {
    renderOnboarding({ step: 'path', selectedPath: 'analyze' });

    fireEvent.click(screen.getByTestId(TID.Button.OnboardingPath('memory')));
    await waitFor(() => {
      expect(mockTransition).toHaveBeenCalledWith({ type: 'SELECT_PATH', path: 'memory' });
    });

    fireEvent.click(screen.getByTestId(TID.Button.OnboardingPrimary));

    await waitFor(() => {
      expect(mockTransition).toHaveBeenCalledWith({ type: 'COMPLETE', path: 'memory' });
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/recording',
        params: {
          entryId: 'entry-memory',
          intent: 'remembered',
          source: 'onboarding',
          postSave: 'journal',
        },
      });
    });
  });

  it('opens the symbol dictionary after choosing the dictionary path', async () => {
    renderOnboarding({ step: 'path', selectedPath: 'analyze' });

    fireEvent.click(screen.getByTestId(TID.Button.OnboardingPath('dictionary')));
    fireEvent.click(screen.getByTestId(TID.Button.OnboardingPrimary));

    await waitFor(() => {
      expect(mockTransition).toHaveBeenCalledWith({ type: 'COMPLETE', path: 'dictionary' });
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/symbol-dictionary',
        params: { source: 'onboarding' },
      });
    });
  });

  it('lets the user continue this session when persisting a skip fails', async () => {
    mockTransition.mockRejectedValueOnce(new Error('storage unavailable'));
    renderOnboarding();

    fireEvent.click(screen.getByTestId(TID.Button.OnboardingSkip));

    const continueButton = await screen.findByTestId(TID.Button.OnboardingContinueSession);
    fireEvent.click(continueButton);

    expect(mockContinueForSession).toHaveBeenCalledWith('skip');
    expect(mockReplace).toHaveBeenCalledWith('/recording');
  });

  it('loads and enables the optional analytics preference from the privacy sheet', async () => {
    renderOnboarding();

    fireEvent.click(screen.getByTestId(TID.Button.OnboardingPrivacy));

    const analyticsSwitch = await screen.findByRole('checkbox', {
      name: 'onboarding.privacy.toggle_label',
    });
    fireEvent.click(analyticsSwitch);

    await waitFor(() => {
      expect(mockGetProductAnalyticsPreference).toHaveBeenCalledTimes(1);
      expect(mockSetProductAnalyticsEnabled).toHaveBeenCalledWith(true);
    });
  });
});
