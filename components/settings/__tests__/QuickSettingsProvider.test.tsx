/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QuickSettingsProvider } from '../QuickSettingsProvider';
import { useQuickSettings } from '@/context/QuickSettingsContext';

let mockPath = '/journal';
let mockUser: any = null;
let mockAuthLoading = false;
let mockPlusActive = false;
let mockSubscriptionLoading = false;
let mockReduced = false;
let mockHardwareBack: (() => boolean) | undefined;
const mockPush = jest.fn();
const mockThemeSelect = jest.fn();
const mockLanguageSelect = jest.fn();
const mockLayoutSelect = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: any[]) => mockPush(...args) }, usePathname: () => mockPath }));
jest.mock('react-native', () => {
  const React = require('react');
  const element = (tag: string) => function MockNativeElement({ children, onPress, testID, accessibilityLabel, accessibilityRole, accessibilityState, disabled }: any) { return React.createElement(tag, {
    onClick: onPress, 'data-testid': testID, 'aria-label': accessibilityLabel, role: accessibilityRole, disabled,
    'aria-checked': accessibilityState?.checked,
  }, children); };
  return { View: element('div'), ScrollView: element('div'), Text: element('span'), Pressable: element('button'),
    Platform: { OS: 'web' }, Keyboard: { dismiss: jest.fn() }, useWindowDimensions: () => ({ width: 390 }),
    BackHandler: { addEventListener: (_: string, fn: () => boolean) => { mockHardwareBack = fn; return { remove: jest.fn() }; } },
  };
});
jest.mock('react-native-drawer-layout', () => ({ Drawer: ({ open, renderDrawerContent }: any) => open ? renderDrawerContent() : null }));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, loading: mockAuthLoading }) }));
jest.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isActive: mockPlusActive, loading: mockSubscriptionLoading }) }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'light' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({ getNoctaliaDesignTokens: () => ({ text: {}, screen: {}, action: {} }) }));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../useSettingsPreferences', () => {
  const preference = (values: string[], select: (...args: any[]) => any) => ({
    title: values[0], currentLabel: values[0], select,
    options: values.map((value, i) => ({ value, label: value, current: i === 0 })),
  });
  return {
    useThemeSettingsPreference: () => preference(['light', 'dark'], mockThemeSelect),
    useLanguageSettingsPreference: () => preference(['auto', 'fr'], mockLanguageSelect),
    useJournalLayoutSettingsPreference: () => preference(['cards', 'compact'], mockLayoutSelect),
  };
});
function Page() {
  const open = useQuickSettings();
  return <><button onClick={open}>Open quick settings</button><input aria-label="Search" defaultValue="garden" /></>;
}
afterEach(() => { cleanup(); jest.clearAllMocks(); mockPath = '/journal'; mockReduced = false; mockUser = null; mockAuthLoading = false; mockPlusActive = false; mockSubscriptionLoading = false; });

it.each([false, true])('closes with Android Back without remounting the page (reduced motion=%s)', (reduced) => {
  mockReduced = reduced;
  render(<QuickSettingsProvider><Page /></QuickSettingsProvider>);
  const input = screen.getByRole('textbox');
  fireEvent.click(screen.getByText('Open quick settings'));
  expect(screen.getByTestId('quick-settings.drawer')).toBeTruthy();
  act(() => { expect(mockHardwareBack?.()).toBe(true); });
  expect(screen.queryByTestId('quick-settings.drawer')).toBeNull();
  expect(screen.getByRole('textbox')).toBe(input);
  expect((input as HTMLInputElement).value).toBe('garden');
});
it('uses the shared preference controllers and closes before opening full settings', () => {
  render(<QuickSettingsProvider><Page /></QuickSettingsProvider>);
  fireEvent.click(screen.getByText('Open quick settings'));
  fireEvent.click(screen.getByTestId('quick-settings.theme.dark'));
  fireEvent.click(screen.getByTestId('quick-settings.journal.compact'));
  fireEvent.click(screen.getByTestId('quick-settings.language'));
  fireEvent.click(screen.getByTestId('quick-settings.language.fr'));
  expect(mockThemeSelect).toHaveBeenCalledWith('dark');
  expect(mockLayoutSelect).toHaveBeenCalledWith('compact');
  expect(mockLanguageSelect).toHaveBeenCalledWith('fr');
  fireEvent.click(screen.getByTestId('quick-settings.all'));
  expect(mockPush).toHaveBeenCalledWith('/settings');
  expect(screen.queryByTestId('quick-settings.drawer')).toBeNull();
});
it('dismisses with Escape and when navigation changes', () => {
  const view = render(<QuickSettingsProvider><Page /></QuickSettingsProvider>);
  fireEvent.click(screen.getByText('Open quick settings'));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByTestId('quick-settings.drawer')).toBeNull();
  fireEvent.click(screen.getByText('Open quick settings'));
  mockPath = '/settings';
  view.rerender(<QuickSettingsProvider><Page /></QuickSettingsProvider>);
  expect(screen.queryByTestId('quick-settings.drawer')).toBeNull();
});


it('shows a guest profile and opens the existing sign-in sheet directly', () => {
  render(<QuickSettingsProvider><Page /></QuickSettingsProvider>);
  fireEvent.click(screen.getByText('Open quick settings'));
  expect(screen.getByText('settings.account.status.guest')).toBeTruthy();
  fireEvent.click(screen.getByTestId('quick-settings.signin'));
  expect(mockPush).toHaveBeenCalledWith('/settings?section=account&auth=signin');
  expect(screen.queryByTestId('quick-settings.drawer')).toBeNull();
});
it.each([
  [{ full_name: '  Camille Martin  ' }, 'Camille Martin'],
  [{ name: 'Camille' }, 'Camille'],
  [{ display_name: 'Cam' }, 'Cam'],
  [{ full_name: 42, name: ' ' }, 'camille'],
])('shows the authenticated name with safe email fallback (%j)', (metadata, expected) => {
  mockUser = { email: 'camille@example.test', user_metadata: metadata };
  render(<QuickSettingsProvider><Page /></QuickSettingsProvider>);
  fireEvent.click(screen.getByText('Open quick settings'));
  expect(screen.getByText(expected as string)).toBeTruthy();
  expect(screen.getByText('camille@example.test')).toBeTruthy();
  expect(screen.queryByTestId('quick-settings.signin')).toBeNull();
  fireEvent.click(screen.getByTestId('quick-settings.profile'));
  expect(mockPush).toHaveBeenCalledWith('/settings?section=account');
});
it.each([false, true])('opens the existing subscription surface with the correct member label (Plus=%s)', (active) => {
  mockUser = { email: 'camille@example.test' };
  mockPlusActive = active;
  render(<QuickSettingsProvider><Page /></QuickSettingsProvider>);
  fireEvent.click(screen.getByText('Open quick settings'));
  expect(screen.getByText(active ? 'settings.quick.subscription' : 'settings.quick.upgrade')).toBeTruthy();
  if (active) expect(screen.queryByText('settings.quick.upgrade')).toBeNull();
  fireEvent.click(screen.getByTestId('quick-settings.plus'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'settings' } });
  expect(screen.queryByTestId('quick-settings.drawer')).toBeNull();
});
it('disables account and upgrade actions while identity and entitlement are loading', () => {
  mockAuthLoading = true;
  mockSubscriptionLoading = true;
  render(<QuickSettingsProvider><Page /></QuickSettingsProvider>);
  fireEvent.click(screen.getByText('Open quick settings'));
  fireEvent.click(screen.getByTestId('quick-settings.signin'));
  fireEvent.click(screen.getByTestId('quick-settings.plus'));
  expect(mockPush).not.toHaveBeenCalled();
  expect(screen.getByText('settings.quick.loading')).toBeTruthy();
});
