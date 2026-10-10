import React from 'react';
import { View } from 'react-native';

import { Text } from './Text';

/**
 * Noctalia Dreams' framed tag (the « ANIMAUX » of a symbol page): a fact about
 * the thing on screen, never a control.
 */
export function Tag({ label, testID }: { label: string; testID?: string }) {
  return (
    <View
      className="self-start rounded-[4px] border border-champagne-text px-2 py-1"
      testID={testID}>
      <Text variant="overline">{label}</Text>
    </View>
  );
}
