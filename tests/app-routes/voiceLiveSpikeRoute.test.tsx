/**
 * @jest-environment jsdom
 */
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { VOICE_LIVE_SPIKE_TEST_IDS } from '@/lib/voiceLiveSpikeHost';
import { withDevFlag } from '@/tests/setDevFlag';

jest.mock('@/components/dev/VoiceLiveSpikeHost', () => ({
  VoiceLiveSpikeHost: () => <div data-testid="mock-voice-live-host" />,
}));

const Route = require('@/app/dev/voice-live-spike').default as typeof import('@/app/dev/voice-live-spike').default;

describe('voice live spike route', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns null outside __DEV__', () => {
    const restore = withDevFlag(false);
    const { container } = render(<Route />);
    expect(container.firstChild).toBeNull();
    expect(document.querySelector(`[testid="${VOICE_LIVE_SPIKE_TEST_IDS.screen}"]`)).toBeNull();
    restore();
  });

  it('mounts the isolated host in __DEV__', () => {
    const restore = withDevFlag(true);
    render(<Route />);
    expect(document.querySelector(`[testid="${VOICE_LIVE_SPIKE_TEST_IDS.screen}"]`)).toBeTruthy();
    restore();
  });
});
