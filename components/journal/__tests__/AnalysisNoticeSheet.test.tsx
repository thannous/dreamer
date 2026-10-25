import React from 'react';
import { fireEvent, render } from '@testing-library/react-native-legacy';
import { AnalysisNoticeSheet } from '../JournalDetailSheets';

jest.mock('@/components/ui/StandardBottomSheet', () => ({ StandardBottomSheet: () => null }));
jest.mock('@/components/motion', () => ({ PressableScale: require('react-native').Pressable }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/ui/BottomSheet', () => ({ BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? children : null }));
jest.mock('@/constants/noctaliaDesign', () => ({ getNoctaliaDesignTokens: () => ({
  status: { success: {}, warning: {}, danger: {} }, surface: {}, text: {}, accent: {},
}) }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark', shadows: { xl: {} } }) }));
jest.mock('@/components/ui/BottomSheetActions', () => ({
  BottomSheetActions: ({ children }: { children: React.ReactNode }) => children,
  BottomSheetPrimaryAction: ({ label, onPress }: { label: string; onPress: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable accessibilityRole="button" onPress={onPress}><Text>{label}</Text></Pressable>;
  },
}));

it('shows the unavailable message and an actionable Retry instead of an empty notice', () => {
  const retry = jest.fn();
  const message = 'Le service d’analyse est momentanément indisponible.';
  const view = render(<AnalysisNoticeSheet visible onClose={jest.fn()} onRetry={retry}
    notice={{ title: 'Analyse', message, tone: 'error', retryable: true }} />);
  expect(view.getByText(message)).toBeTruthy();
  fireEvent.press(view.getByText('error.try_again'));
  expect(retry).toHaveBeenCalledTimes(1);
});
