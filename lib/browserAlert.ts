import { Alert, Platform, type AlertButton, type AlertOptions } from 'react-native';

type BrowserDialogs = { alert(message: string): void; confirm(message: string): boolean };

/**
 * Shows one app alert with the browser's own dialogs. A message, or a single button, is an
 * alert; a choice is a confirmation whose OK takes the action and whose Cancel the cancelling
 * button. With several actions, OK takes the last one, which iOS also shows as the preferred.
 */
export function showBrowserAlert(
  browser: BrowserDialogs,
  title: string,
  message?: string | null,
  buttons?: AlertButton[],
  options?: AlertOptions,
): void {
  const text = message ? `${title}\n\n${message}` : title;
  const choices = buttons ?? [];
  if (choices.length <= 1) {
    browser.alert(text);
    choices[0]?.onPress?.();
    return;
  }
  const cancel = choices.find((button) => button.style === 'cancel');
  const actions = choices.filter((button) => button !== cancel);
  if (browser.confirm(text)) actions[actions.length - 1]?.onPress?.();
  else if (cancel) cancel.onPress?.();
  else options?.onDismiss?.();
}

/**
 * react-native-web ships Alert.alert as a function that does nothing, so in a browser the
 * app's messages and confirmations went unseen and their actions never ran. Called once at
 * startup, this routes every Alert.alert through the browser's dialogs instead.
 */
export function installBrowserAlert(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  Alert.alert = (title, message, buttons, options) => showBrowserAlert(window, title ?? '', message, buttons, options);
}
