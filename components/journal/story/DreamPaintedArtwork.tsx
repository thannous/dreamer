import { Image, type ImageSource } from 'expo-image';
import React, { useMemo } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import { useTranslation } from '@/hooks/useTranslation';
import { TID } from '@/lib/testIDs';

import { paintSettle } from './dreamStoryMotion';

/**
 * Act III's landing in the page: the illustration that has just been painted appears
 * where its canvas was, framed, and settles once. It does not jump to the cover above
 * the reader; the cover is how a later visit opens. Pressing it opens the full view.
 */
export function DreamPaintedArtwork({ source, onOpen, onError }: {
  source: ImageSource | null;
  onOpen: () => void;
  onError: () => void;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const settle = useMemo(() => paintSettle(reduced), [reduced]);

  return (
    <PressableScale
      testID={TID.Button.JournalIllustrationExpand}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={t('journal.detail.image.expand_accessibility')}
      className="overflow-hidden rounded-lg border border-line bg-ink"
      style={{ aspectRatio: 4 / 5 }}
    >
      <Animated.View testID={TID.Component.DreamPaintedArtwork} style={[{ width: '100%', height: '100%' }, settle] as StyleProp<ViewStyle>}>
        <Image source={source} contentFit="cover" onError={onError} style={{ width: '100%', height: '100%' }}
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} />
      </Animated.View>
    </PressableScale>
  );
}
