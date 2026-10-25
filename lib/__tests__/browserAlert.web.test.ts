/** @jest-environment jsdom */
import { Alert, Platform } from 'react-native';
import { installBrowserAlert, showBrowserAlert } from '@/lib/browserAlert';

const browser = (answer = true) => ({ alert: jest.fn(), confirm: jest.fn(() => answer) });

it('shows a message alone, and runs its only button once it is closed', () => {
  const dialogs = browser();
  showBrowserAlert(dialogs, 'Error', 'The dream could not be saved.');
  expect(dialogs.alert).toHaveBeenCalledWith('Error\n\nThe dream could not be saved.');

  const done = jest.fn();
  showBrowserAlert(dialogs, 'Account deleted', undefined, [{ text: 'OK', onPress: done }]);
  expect(dialogs.alert).toHaveBeenLastCalledWith('Account deleted');
  expect(done).toHaveBeenCalledTimes(1);
  expect(dialogs.confirm).not.toHaveBeenCalled();
});

it('asks a choice: OK takes the action, Cancel the cancelling button', () => {
  const signUp = jest.fn();
  const keepWriting = jest.fn();
  const buttons = [
    { text: 'Create an account', onPress: signUp },
    { text: 'Keep writing', style: 'cancel' as const, onPress: keepWriting },
  ];
  const yes = browser(true);
  showBrowserAlert(yes, 'Guest recording limit reached', 'Create a free account to add this dream.', buttons);
  expect(yes.confirm).toHaveBeenCalledWith('Guest recording limit reached\n\nCreate a free account to add this dream.');
  expect(signUp).toHaveBeenCalledTimes(1);
  expect(keepWriting).not.toHaveBeenCalled();

  showBrowserAlert(browser(false), 'Guest recording limit reached', undefined, buttons);
  expect(keepWriting).toHaveBeenCalledTimes(1);
  expect(signUp).toHaveBeenCalledTimes(1);
  expect(yes.alert).not.toHaveBeenCalled();
});

it('takes the last action on OK, and reports a dismissal when nothing cancels', () => {
  const first = jest.fn();
  const last = jest.fn();
  const onDismiss = jest.fn();
  const buttons = [{ text: 'Later', onPress: first }, { text: 'Open settings', onPress: last }];
  showBrowserAlert(browser(true), 'Microphone', undefined, buttons, { onDismiss });
  expect(last).toHaveBeenCalledTimes(1);
  showBrowserAlert(browser(false), 'Microphone', undefined, buttons, { onDismiss });
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();
});

it('routes Alert.alert through the browser once installed on the web', () => {
  const original = Alert.alert;
  jest.replaceProperty(Platform, 'OS', 'web');
  const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
  try {
    installBrowserAlert();
    Alert.alert('Too long', 'Shorten the text to save it.');
    expect(alert).toHaveBeenCalledWith('Too long\n\nShorten the text to save it.');
  } finally {
    Alert.alert = original;
    jest.restoreAllMocks();
  }
});

it('leaves Alert.alert to the platform on a phone', () => {
  const original = Alert.alert;
  jest.replaceProperty(Platform, 'OS', 'ios');
  try {
    installBrowserAlert();
    expect(Alert.alert).toBe(original);
  } finally {
    jest.restoreAllMocks();
  }
});
