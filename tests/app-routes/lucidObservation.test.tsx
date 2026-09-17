/* @jest-environment jsdom */
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { LucidExperiment } from '@/lib/lucid/model';
import { projectLucidObservations, lucidObservationSourceId } from '@/lib/lucid/observations';
import LucidObservationScreen from '@/app/lucid/observation';

const mockPush = jest.fn();
const mockText = 'A long remembered scene. '.repeat(100);
let mockId = lucidObservationSourceId('morning', 100);
const mockExperiments: LucidExperiment[] = [{
  id: 'morning', occurredAt: 100, updatedAt: 100, technique: null, preparationMinutes: null,
  result: null, lucidityLevel: null, recallLevel: null, sleepQuality: null, factors: [],
  recallText: mockText, notes: 'My own association', voiceCapture: 'local_note',
}];
let mockObservations = projectLucidObservations(mockExperiments, new Set(['morning']));
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) }, useLocalSearchParams: () => ({ id: mockId }) }));
jest.mock('react-native', () => jest.requireActual('../react-native-stub'));
jest.mock('@/context/LucidTrainerContext', () => ({ useLucidTrainer: () => ({ observations: mockObservations, loading: false, content: { locale: 'en', chrome: { common: { back: 'Back', loading: 'Loading' } } } }) }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'light' }) }));
jest.mock('@/constants/lucidTheme', () => ({ getLucidPalette: () => ({ text: '#fff', textSecondary: '#ddd' }), LucidSpace: { lg: 16 }, LucidType: { body: [16, 24] } }));
jest.mock('@/components/lucid/LucidUI', () => ({
  LucidScreen: ({ children, title }: { children: React.ReactNode; title: string }) => <main><h1>{title}</h1>{children}</main>,
  LucidCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  LucidButton: ({ label, onPress }: { label: string; onPress: () => void }) => <button onClick={onPress}>{label}</button>,
  LucidIconAction: () => null,
}));
afterEach(() => { cleanup(); mockObservations = projectLucidObservations(mockExperiments, new Set(['morning'])); mockId = lucidObservationSourceId('morning', 100); jest.clearAllMocks(); });
it('retrieves the complete local capture and keeps voice access inside Lucid', () => {
  render(<LucidObservationScreen />);
  expect(screen.getByText((_, element) => element?.textContent === mockText.trim() + '\n\nMy own association')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Open local voice notes' }));
  expect(mockPush).toHaveBeenCalledWith('/lucid/morning-voice');
});
it('does not substitute another observation when an id is unavailable', () => {
  mockId = 'lucid:100:other-account';
  render(<LucidObservationScreen />);
  expect(screen.getByText('This observation is not available in this account.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Open local voice notes' })).toBeNull();
});

it('keeps synced text but hides voice access when this device has no linked audio', () => {
  mockObservations = projectLucidObservations(mockExperiments);
  render(<LucidObservationScreen />);
  expect(screen.getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === mockText.trim() + '\n\nMy own association')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Open local voice notes' })).toBeNull();
});
