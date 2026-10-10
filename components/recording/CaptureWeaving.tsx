import React from 'react';
import { View } from 'react-native';

import { WaitingStars } from '@/components/journal/story/WaitingStars';

/** While the answers are woven into one account: the dream story's waiting stars. */
export function CaptureWeaving() {
  return <View className="self-start px-1"><WaitingStars testID="capture-weaving" /></View>;
}
