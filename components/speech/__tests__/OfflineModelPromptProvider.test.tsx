/* @jest-environment jsdom */
import React, { useContext } from 'react';
import { act, render, screen } from '@testing-library/react';

import { OfflineModelCheckContext } from '@/context/OfflineModelCheckContext';
import { OfflineModelPromptProvider } from '../OfflineModelPromptProvider';

const mockProbes = new Map<string, () => Promise<void>>();
let mockClose!: () => void;
jest.mock('@/services/nativeSpeechRecognition', () => ({
  ensureOfflineSttModel: (locale: string, show: () => Promise<void>) => new Promise<boolean>((resolve) => {
    mockProbes.set(locale, async () => {
      if (locale !== 'en-US') await show();
      resolve(locale === 'en-US');
    });
  }),
}));
jest.mock('../OfflineModelDownloadSheet', () => ({
  OfflineModelDownloadSheet: ({ visible, locale, onClose }: { visible: boolean; locale: string; onClose: () => void }) => {
    mockClose = onClose;
    return visible ? <p>{locale}</p> : null;
  },
}));

it('shows only the latest selection across settings, delayed probes and download completions', async () => {
  let check!: (locale: string) => Promise<boolean>;
  function Settings() {
    check = useContext(OfflineModelCheckContext)!;
    return null;
  }
  const view = render(<OfflineModelPromptProvider><Settings /></OfflineModelPromptProvider>);
  const first = check('fr-FR');
  const second = check('it-IT');
  act(() => { void mockProbes.get('it-IT')!(); });
  await act(async () => { await mockProbes.get('fr-FR')!(); });
  await first;
  expect(screen.getByText('it-IT')).toBeTruthy();
  const finishItalianDownload = mockClose;

  let third!: Promise<boolean>;
  act(() => { third = check('pt-BR'); });
  await second;
  act(() => { void mockProbes.get('pt-BR')!(); });
  act(finishItalianDownload);
  expect(screen.getByText('pt-BR')).toBeTruthy();

  let installed!: Promise<boolean>;
  act(() => { installed = check('en-US'); });
  await act(async () => { await mockProbes.get('en-US')!(); });
  await third;
  await expect(installed).resolves.toBe(true);
  expect(screen.queryByText('pt-BR')).toBeNull();

  const leaving = check('de-DE');
  act(() => { void mockProbes.get('de-DE')!(); });
  expect(screen.getByText('de-DE')).toBeTruthy();
  view.unmount();
  await leaving;
  await expect(check('en-US')).resolves.toBe(false);
});
