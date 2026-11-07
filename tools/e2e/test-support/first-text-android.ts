import { execFileSync } from 'node:child_process';
import { test } from '@e2e-dev/mobile';
import { expect } from 'e2e';

const appId = 'com.tanuki75.noctalia';

/** Prepare just the opt-in first-launch case, inside the native runner's device lock. */
export const firstTextAndroid = test.extend<{ keyboardShown: () => boolean }>({
  keyboardShown: async ({ platform }, provide) => {
    const serial = process.env.E2E_DEVICE;
    const expectedAvd = process.env.E2E_AVD_NAME?.trim();
    if (platform !== 'android' || process.env.E2E_FIRST_TEXT_ANDROID !== '1' ||
      process.env.E2E_NATIVE_MOCK_MODE !== 'true' || !serial?.match(/^emulator-\d+$/) || !expectedAvd) {
      throw new Error('The French input fixture requires an identified mock Release on an explicitly owned Android emulator.');
    }
    const adb = (...args: string[]) => execFileSync(process.env.ADB_BIN || 'adb',
      ['-s', serial, ...args], { encoding: 'utf8', timeout: 15_000 }).trim();
    const [actualAvd] = adb('emu', 'avd', 'name').split(/\r?\n/);
    if (actualAvd !== expectedAvd) throw new Error('The serial now belongs to a different AVD.');
    const shell = (...args: string[]) => adb('shell', ...args);
    const locales = () => {
      const result = shell('cmd', 'locale', 'get-app-locales', appId);
      const value = result.match(/ are \[([a-zA-Z0-9,-]*)\]$/);
      if (!value) throw new Error('Android did not identify the installed app locales.');
      return value[1];
    };
    const setLocales = (value: string) => shell('cmd', 'locale', 'set-app-locales', appId, ...(value ? ['--locales', value] : []));
    const previousLocale = locales();
    const previousSize = shell('settings', 'get', 'system', 'font_scale');
    const previousIme = shell('settings', 'get', 'secure', 'show_ime_with_hard_keyboard');
    const airplane = () => shell('settings', 'get', 'global', 'airplane_mode_on') === '1';
    const setAirplane = (enabled: boolean) => shell('cmd', 'connectivity', 'airplane-mode', enabled ? 'enable' : 'disable');
    const wifi = () => {
      const state = shell('cmd', 'wifi', 'status').match(/^Wi-?Fi is (enabled|disabled)\b/im);
      if (!state) throw new Error('Android did not report its Wi-Fi state.');
      return state[1] === 'enabled';
    };
    const previousAirplane = airplane();
    const previousWifi = wifi();
    const restore = (scope: string, key: string, value: string) => value === 'null'
      ? shell('settings', 'delete', scope, key) : shell('settings', 'put', scope, key, value);

    try {
      // Host-only preparation keeps app.open() as the first recorded journey step.
      if (!previousAirplane) setAirplane(true);
      shell('svc', 'wifi', 'disable');
      await expect.poll(airplane).toBe(true);
      await expect.poll(wifi).toBe(false);
      shell('settings', 'put', 'system', 'font_scale', '2.0');
      shell('settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1');
      setLocales('fr-FR');
      if (locales() !== 'fr-FR' || Number(shell('settings', 'get', 'system', 'font_scale')) !== 2) {
        throw new Error('French and 200% system text must be active before opening the app.');
      }
      await provide(() => {
        const value = shell('dumpsys', 'input_method').match(/\bmInputShown=(true|false)\b/);
        if (!value) throw new Error('Android did not expose the current IME visibility.');
        return value[1] === 'true';
      });
    } finally {
      // Try every restoration even if one Android service rejects a command.
      const errors: unknown[] = [];
      for (const action of [
        () => setLocales(previousLocale),
        () => restore('system', 'font_scale', previousSize),
        () => restore('secure', 'show_ime_with_hard_keyboard', previousIme),
        async () => {
          if (airplane() !== previousAirplane) setAirplane(previousAirplane);
          await expect.poll(airplane).toBe(previousAirplane);
        },
        async () => {
          if (wifi() !== previousWifi) shell('svc', 'wifi', previousWifi ? 'enable' : 'disable');
          await expect.poll(wifi).toBe(previousWifi);
        },
      ]) {
        try { await action(); } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, 'Could not restore the emulator settings');
    }
  },
});
