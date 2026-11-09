import type { Device } from '@e2e-dev/mobile';
import type { TestFixtures } from 'e2e';

export async function openNativeLink(
  { device, screen, platform }: Pick<TestFixtures, 'screen' | 'platform'> & { device: Device },
  url: string,
) {
  await device.openLink(url);
  if (platform !== 'ios') return;
  // Safari asks before returning a custom URL to Noctalia. As in Dreamer's
  // native journeys, approve only this visible app-opening confirmation.
  const promptName = url.startsWith('noctaliameditation:')
    ? /^(Ouvrir dans|Open (?:this page )?in).*(Méditation|Meditation)/
    : /^(Ouvrir dans|Open (?:this page )?in).*Noctalia Lucid/;
  const prompt = screen.getByText(promptName, { visible: true });
  if (await prompt.count() > 0) {
    await screen.getByRole('button', /^(Ouvrir|Open)$/, { visible: true }).tap();
  }
}
