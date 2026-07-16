/* @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

type HardwareBackHandler = (event: { timeStamp: number; type: string }) => boolean;
type HardwareBackEvent = Parameters<HardwareBackHandler>[0];

let hardwareBackHandler: HardwareBackHandler | undefined;

jest.doMock('react-native', () => {
  const toDomProps = (props: Record<string, any>) => {
    const {
      accessibilityLabel,
      accessibilityRole,
      children,
      contentContainerStyle,
      onPress,
      showsVerticalScrollIndicator,
      style,
      testID,
      ...rest
    } = props;
    const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style;
    const normalizedStyle = Object.assign(
      {},
      ...(Array.isArray(resolvedStyle) ? resolvedStyle : [resolvedStyle]).filter(
        (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object'
      )
    );
    return {
      ...rest,
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(resolvedStyle ? { style: normalizedStyle } : {}),
      ...(testID ? { 'data-testid': testID } : {}),
      children,
    };
  };
  const createElement = (tag: string) => {
    const MockNativeElement = ({ children, ...props }: Record<string, any>) =>
      React.createElement(tag, toDomProps({ ...props, children }));
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };

  return {
    BackHandler: {
      addEventListener: jest.fn((_eventName: string, handler: HardwareBackHandler) => {
        hardwareBackHandler = handler;
        return {
          remove: () => {
            if (hardwareBackHandler === handler) hardwareBackHandler = undefined;
          },
        };
      }),
    },
    Platform: { OS: 'android', select: (values: Record<string, any>) => values.android ?? values.default },
    Pressable: createElement('button'),
    ScrollView: createElement('div'),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Switch: ({ onValueChange, testID, value }: Record<string, any>) => (
      <input
        checked={Boolean(value)}
        data-testid={testID}
        onChange={() => onValueChange?.(!value)}
        readOnly={!onValueChange}
        role="switch"
        type="checkbox"
      />
    ),
    Text: createElement('span'),
    useWindowDimensions: () => ({ width: 402, height: 874, scale: 3, fontScale: 1 }),
    View: createElement('div'),
  };
});

const { BackHandler } = require('react-native');

const selectTheme = jest.fn(async () => {});
const selectLanguage = jest.fn(async () => {});
const selectJournalLayout = jest.fn(async () => {});
const restartRecordingGuide = jest.fn(async () => {});
const toggleWeekday = jest.fn(async () => {});
const setWeekdayTime = jest.fn(async () => {});
const openSubscription = jest.fn();
let notificationsUnsupported = true;
let weekdayEnabled = false;

function preference(
  title: string,
  value: string,
  select: (value: never) => Promise<void>
) {
  return {
    title,
    description: `${title}.description`,
    value,
    currentLabel: `${title}.${value}`,
    options: [
      {
        value,
        label: `${title}.${value}`,
        description: `${title}.${value}.description`,
        current: true,
      },
      {
        value: 'other',
        label: `${title}.other`,
        description: `${title}.other.description`,
        current: false,
      },
    ],
    loading: false,
    saving: false,
    error: false,
    set: select,
    select,
  };
}

jest.doMock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.doMock('@/components/settings/useSettingsPreferences', () => ({
  useSettingsPreferences: () => ({
    theme: preference('theme', 'auto', selectTheme as never),
    language: preference('language', 'fr', selectLanguage as never),
    journalLayout: preference('layout', 'cards', selectJournalLayout as never),
    recording: {
      title: 'settings.onboarding.title',
      description: 'settings.onboarding.description',
      actionLabel: 'settings.onboarding.restart',
      actionHint: 'settings.onboarding.restart_hint',
      testID: 'btn.recording.onboarding.restart',
      loading: false,
      saving: false,
      error: false,
      restart: restartRecordingGuide,
      replay: restartRecordingGuide,
    },
  }),
}));

jest.doMock('@/components/settings/useNotificationSettingsController', () => ({
  getDateFromTime: () => new Date(2026, 6, 14, 7, 0),
  useNotificationSettingsController: () => ({
    settings: {
      weekdayEnabled,
      weekdayTime: '07:00',
      weekendEnabled: false,
      weekendTime: '10:00',
    },
    hasPermissions: false,
    isLoading: false,
    unsupported: notificationsUnsupported,
    notificationsEnabled: weekdayEnabled,
    toggleWeekday,
    toggleWeekend: jest.fn(async () => {}),
    setWeekdayTime,
    setWeekendTime: jest.fn(async () => {}),
    sendTest: jest.fn(async () => {}),
    nextReminderText: 'notifications.next',
  }),
}));

jest.doMock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'dark',
    colors: {
      accent: '#D4A574',
      accentDark: '#9A6332',
      accentLight: '#EAD4B4',
      backgroundCard: '#0D0B1C',
      backgroundSecondary: '#192344',
      backgroundDark: '#03040D',
      divider: '#514637',
      overlay: 'rgba(0,0,0,.4)',
      textPrimary: '#FFF9EF',
      textSecondary: '#B7AEC9',
      textTertiary: '#8E84A7',
      textOnAccentSurface: '#3B2412',
      navbarBg: '#050510',
      navbarBorder: '#514637',
      navbarTextActive: '#FFF9EF',
      navbarTextInactive: '#AFA7BB',
    },
  }),
}));

jest.doMock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { SettingsFieldGroup } = require('../SettingsFieldGroup');

const baseProps = {
  account: <div data-testid="slot-account" />,
  bottomPadding: 72,
  onOpenSubscription: openSubscription,
  quota: <div data-testid="slot-quota" />,
  returningGuestBlocked: false,
  subscriptionSubtitle: 'Explore without limits',
  subscriptionTitle: 'Noctalia Plus',
};

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  hardwareBackHandler = undefined;
  notificationsUnsupported = true;
  weekdayEnabled = false;
});

describe('SettingsFieldGroup', () => {
  it('renders the mock-aligned account, experience, rituals and Plus cards', () => {
    render(<SettingsFieldGroup {...baseProps} />);

    expect(screen.getByTestId('slot-account')).toBeTruthy();
    expect(screen.getByTestId('settings-section-preferences')).toBeTruthy();
    expect(screen.getByTestId('settings-section-notifications')).toBeTruthy();
    expect(screen.getByTestId('settings-section-subscription')).toBeTruthy();
    expect(screen.getByTestId('settings-section-quota')).toBeTruthy();
    expect(screen.getByTestId('slot-quota')).toBeTruthy();
    expect(screen.getByText('settings.section.experience')).toBeTruthy();
    expect(screen.getByText('settings.section.rituals')).toBeTruthy();
    expect(screen.getByText('Noctalia Plus')).toBeTruthy();
  });

  it('keeps the returning guest barrier to account and language', () => {
    render(<SettingsFieldGroup {...baseProps} returningGuestBlocked />);

    expect(screen.getByTestId('slot-account')).toBeTruthy();
    expect(screen.getByTestId('settings-language-choice')).toBeTruthy();
    expect(screen.queryByTestId('settings-theme-choice')).toBeNull();
    expect(screen.queryByTestId('settings-journal-layout-choice')).toBeNull();
    expect(screen.queryByTestId('btn.recording.onboarding.restart')).toBeNull();
    expect(screen.queryByTestId('settings-section-notifications')).toBeNull();
    expect(screen.queryByTestId('settings-section-subscription')).toBeNull();
    expect(screen.queryByTestId('settings-section-quota')).toBeNull();
  });

  it('opens the theme sheet and persists the selected option', () => {
    render(<SettingsFieldGroup {...baseProps} />);

    fireEvent.click(screen.getByTestId('settings-theme-choice'));
    expect(screen.getByTestId('settings-theme-choice.sheet')).toBeTruthy();
    fireEvent.click(screen.getByTestId('settings-theme-choice.option.other'));

    expect(selectTheme).toHaveBeenCalledWith('other');
  });

  it('consumes Android hardware back while closing an open preference sheet', async () => {
    render(<SettingsFieldGroup {...baseProps} />);

    fireEvent.click(screen.getByTestId('settings-theme-choice'));
    expect(BackHandler.addEventListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function)
    );

    act(() => {
      expect(hardwareBackHandler?.({
        timeStamp: 0,
        type: 'hardwareBackPress',
      } as HardwareBackEvent)).toBe(true);
    });

    expect(screen.queryByTestId('settings-theme-choice.sheet')).toBeNull();
    await waitFor(() => expect(hardwareBackHandler).toBeUndefined());
  });

  it('forwards reminder changes and keeps the reminder time visible', () => {
    notificationsUnsupported = false;
    weekdayEnabled = true;

    render(<SettingsFieldGroup {...baseProps} />);

    expect(screen.getByTestId('settings-notifications-weekday-time').textContent).toContain('07:00');
    fireEvent.click(screen.getByTestId('settings-notifications-reminder-toggle'));
    expect(toggleWeekday).toHaveBeenCalledWith(false);
  });

  it('opens the Noctalia Plus flow from the compact promo card', () => {
    render(<SettingsFieldGroup {...baseProps} />);

    fireEvent.click(screen.getByTestId('settings-section-subscription'));
    expect(openSubscription).toHaveBeenCalledTimes(1);
  });

  it('replays the recording onboarding from the experience card', () => {
    render(<SettingsFieldGroup {...baseProps} />);

    expect(screen.getByText('settings.onboarding.restart').style.maxWidth).toBe('48%');
    fireEvent.click(screen.getByTestId('btn.recording.onboarding.restart'));

    expect(restartRecordingGuide).toHaveBeenCalledTimes(1);
  });
});
