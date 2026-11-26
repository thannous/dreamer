import { Alert, Platform } from 'react-native';

/**
 * A silent account (made by a purchase without registering) has nothing to sign back in
 * with. Signing in to another account from it leaves its journal behind, so the person is
 * asked first, in words that say so. Resolves to their answer.
 */
export function askAccountSwitch(t: (key: string) => string): Promise<boolean> {
  const title = t('settings.account.switch.title');
  const message = t('settings.account.switch.message');
  if (Platform.OS === 'web') {
    // react-native-web's Alert is a no-op: the browser's own dialog asks there.
    return Promise.resolve(
      typeof window !== 'undefined' && typeof window.confirm === 'function' && window.confirm(`${title}\n\n${message}`),
    );
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: t('settings.account.switch.confirm'), style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
