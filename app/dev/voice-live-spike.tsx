import React from 'react';
import { View } from 'react-native';

import { VoiceLiveSpikeHost } from '@/components/dev/VoiceLiveSpikeHost';
import { VOICE_LIVE_SPIKE_TEST_IDS } from '@/lib/voiceLiveSpikeHost';

export default function VoiceLiveSpikeRoute() {
  if (typeof __DEV__ === 'undefined' || __DEV__ !== true) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} testID={VOICE_LIVE_SPIKE_TEST_IDS.screen}>
      <VoiceLiveSpikeHost />
    </View>
  );
}
