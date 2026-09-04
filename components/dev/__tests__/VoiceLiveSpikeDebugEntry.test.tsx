/**
 * @jest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { VOICE_LIVE_SPIKE_TEST_IDS } from '@/lib/voiceLiveSpikeHost';
import { withDevFlag } from '@/tests/setDevFlag';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/services/voiceLiveSpikeStorage', () => ({
  loadDebugEnabled: jest.fn(async () => false),
  loadFeatureEnabled: jest.fn(async () => false),
  saveDebugEnabled: jest.fn(async () => undefined),
  saveFeatureEnabled: jest.fn(async () => undefined),
}));

const { VoiceLiveSpikeDebugEntry } =
  require('../VoiceLiveSpikeDebugEntry') as typeof import('../VoiceLiveSpikeDebugEntry');

describe('VoiceLiveSpikeDebugEntry', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing outside __DEV__', () => {
    const restore = withDevFlag(false);
    render(<VoiceLiveSpikeDebugEntry />);
    expect(document.querySelector(`[testid="${VOICE_LIVE_SPIKE_TEST_IDS.debugEntry}"]`)).toBeNull();
    restore();
  });

  it('exposes the prototype entry in __DEV__', () => {
    const restore = withDevFlag(true);
    render(<VoiceLiveSpikeDebugEntry />);
    expect(document.querySelector(`[testid="${VOICE_LIVE_SPIKE_TEST_IDS.debugEntry}"]`)).toBeTruthy();
    restore();
  });
});
