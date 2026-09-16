import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { IllustrationQualityPreference } from '../IllustrationQualityPreference';
import { getHdImageQuota } from '@/services/hdImageQuota';
import { getIllustrationResolution, saveIllustrationResolution } from '@/services/illustrationPreferences';

let mockPlus = true;
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
jest.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ status: { tier: mockPlus ? 'plus' : 'free', isActive: true } }) }));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/ui/BottomSheet', () => ({ BottomSheet: ({ visible, children }: any) => visible ? children : null }));
jest.mock('@/services/hdImageQuota', () => ({ getHdImageQuota: jest.fn() }));
jest.mock('@/services/illustrationPreferences', () => ({ getIllustrationResolution: jest.fn(), saveIllustrationResolution: jest.fn() }));
const allowance = jest.mocked(getHdImageQuota);
const preference = jest.mocked(getIllustrationResolution);
const save = jest.mocked(saveIllustrationResolution);
beforeEach(() => {
  jest.clearAllMocks(); mockPlus = true;
  preference.mockResolvedValue('1K'); save.mockResolvedValue();
  allowance.mockResolvedValue({ used: 0, limit: 15, remaining: 15, resetsAt: '2026-10-01T00:00:00Z' });
});

it('keeps standard by default and saves 4K only after an explicit Plus selection', async () => {
  const view = render(<IllustrationQualityPreference />);
  fireEvent.press(view.getByTestId('settings-illustration-quality'));
  await waitFor(() => expect(view.getByTestId('settings-illustration-4K').props.accessibilityState.disabled).toBe(false));
  expect(save).not.toHaveBeenCalled();
  expect(view.getByTestId('settings-illustration-1K').props.accessibilityState.checked).toBe(true);
  fireEvent.press(view.getByTestId('settings-illustration-4K'));
  await waitFor(() => expect(save).toHaveBeenCalledWith('owner', '4K'));
});

it.each(['free', 'exhausted', 'offline'])('keeps HD unavailable for %s while standard stays available', async reason => {
  if (reason === 'free') mockPlus = false;
  if (reason === 'exhausted') allowance.mockResolvedValue({ used: 15, limit: 15, remaining: 0, resetsAt: '2026-10-01T00:00:00Z' });
  if (reason === 'offline') allowance.mockRejectedValue(new Error('offline'));
  const view = render(<IllustrationQualityPreference />);
  fireEvent.press(view.getByTestId('settings-illustration-quality'));
  await waitFor(() => expect(preference).toHaveBeenCalled());
  fireEvent.press(view.getByTestId('settings-illustration-4K'));
  expect(save).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('settings-illustration-1K'));
  await waitFor(() => expect(save).toHaveBeenCalledWith('owner', '1K'));
});
