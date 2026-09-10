/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockRequest = jest.fn();
const mockReplace = jest.fn();
const mockAlert = jest.fn();
jest.mock('@/lib/authReturnIntent', () => ({ requestAuthReturn: (destination: string) => mockRequest(destination) }));
jest.mock('@/lib/navigationIntents', () => ({ clearReturnToPaywallIntent: jest.fn() }));
jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native', () => ({
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
  Pressable: ({ children, onPress, disabled }: React.PropsWithChildren<{ onPress: () => void; disabled: boolean }>) => <button onClick={onPress} disabled={disabled}>{children}</button>,
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
const { SignInToOpenDream } = require('../SignInToOpenDream');

afterEach(() => { cleanup(); jest.clearAllMocks(); });
it('waits for durable destination storage before opening sign-in', async () => {
  let saved!: () => void;
  mockRequest.mockReturnValue(new Promise<void>((resolve) => { saved = resolve; }));
  render(<SignInToOpenDream destination="/journal/1700000000000?remoteId=42" />);
  fireEvent.click(screen.getByRole('button'));
  expect(mockRequest).toHaveBeenCalledWith('/journal/1700000000000?remoteId=42');
  expect(mockReplace).not.toHaveBeenCalled();
  saved();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/settings'));
});
it('keeps the original screen and offers a retry when destination storage fails', async () => {
  mockRequest.mockRejectedValue(new Error('disk unavailable'));
  render(<SignInToOpenDream destination="/journal/42" />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(mockAlert).toHaveBeenCalled());
  expect(mockReplace).not.toHaveBeenCalled();
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
});
