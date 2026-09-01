/**
 * @jest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { VOICE_LIVE_SPIKE_HOST_LABEL, VOICE_LIVE_SPIKE_TEST_IDS } from '@/lib/voiceLiveSpikeHost';

const mockUseVoiceLiveSpikeHost = jest.fn();

jest.mock('@/hooks/useVoiceLiveSpikeHost', () => ({
  useVoiceLiveSpikeHost: () => mockUseVoiceLiveSpikeHost(),
}));

jest.mock('@/hooks/useRecordingSession', () => ({
  useRecordingSession: () => ({
    isRecording: false,
    startRecording: jest.fn(),
    stopRecording: jest.fn(async () => ({ transcript: '' })),
  }),
}));

const { VoiceLiveSpikeHost } = require('../VoiceLiveSpikeHost') as typeof import('../VoiceLiveSpikeHost');

describe('VoiceLiveSpikeHost', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockUseVoiceLiveSpikeHost.mockReset();
  });

  it('does not mount the operational host when the flag is off', () => {
    mockUseVoiceLiveSpikeHost.mockReturnValue({
      available: false,
      operational: false,
      label: VOICE_LIVE_SPIKE_HOST_LABEL,
      snapshot: null,
      ingestCapturedSpeech: jest.fn(),
      bargeIn: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      goOffline: jest.fn(),
      goOnline: jest.fn(),
      completeUtterance: jest.fn(),
    });

    render(<VoiceLiveSpikeHost />);
    expect(document.querySelector(`[testid="${VOICE_LIVE_SPIKE_TEST_IDS.unavailable}"]`)).toBeTruthy();
    expect(document.querySelector(`[testid="${VOICE_LIVE_SPIKE_TEST_IDS.host}"]`)).toBeNull();
  });

  it('does not mount the operational host when the runtime is not __DEV__', () => {
    mockUseVoiceLiveSpikeHost.mockReturnValue({
      available: false,
      operational: false,
      label: VOICE_LIVE_SPIKE_HOST_LABEL,
      snapshot: null,
      ingestCapturedSpeech: jest.fn(),
      bargeIn: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      goOffline: jest.fn(),
      goOnline: jest.fn(),
      completeUtterance: jest.fn(),
    });

    render(<VoiceLiveSpikeHost />);
    expect(document.querySelector(`[testid="${VOICE_LIVE_SPIKE_TEST_IDS.host}"]`)).toBeNull();
  });
});
