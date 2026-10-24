import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useDreamMedia } from '@/hooks/useDreamMedia';
import { useTranslation } from '@/hooks/useTranslation';
import type { DreamAnalysis } from '@/lib/types';
import type { DreamAnniversary } from '@/lib/dreamAnniversary';
import { getDreamRouteParams } from '@/lib/dreamRoute';
import { getDreamThumbnailCacheKey, getDreamThumbnailUri } from '@/lib/imageUtils';
import { TID } from '@/lib/testIDs';

const FACE = 64;

/** The dream's first sentence, cut on a word when it runs long. */
function opening(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const end = clean.search(/[.!?…](\s|$)/);
  const sentence = end > 20 ? clean.slice(0, end + 1) : clean;
  return sentence.length > max ? `${sentence.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : sentence;
}

/**
 * The dream noted on this date a month or a year ago, on that day only: its painting, its
 * name and its first words, opening its page.
 */
export function HomeAnniversaryCard({ anniversary }: { anniversary: DreamAnniversary | { dream: DreamAnalysis; span: 'rediscovery' } }) {
  const { colors, mode } = useTheme();
  const ink = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const { dream, span } = anniversary;
  const media = useDreamMedia(dream, { variant: 'thumbnail' });
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const thumbnail = getDreamThumbnailUri({
    thumbnailUrl: media.thumbnailUrl,
    imageUrl: media.imageUrl,
    imageUpdatedAt: dream.imageUpdatedAt,
    analysisRequestId: dream.analysisRequestId,
    analyzedAt: dream.analyzedAt,
    id: dream.id,
  })?.trim();
  // The journal cards' cache entry: a dream's image downloads once for both screens.
  const cacheKey = getDreamThumbnailCacheKey(media);
  const source = useMemo(() => thumbnail ? { uri: thumbnail, cacheKey } : undefined, [cacheKey, thumbnail]);
  const label = t(span === 'rediscovery' ? 'home.rediscovery.title' : span === 'year' ? 'home.anniversary.year' : 'home.anniversary.month');
  const title = dream.title?.trim() || t('journal.detail.untitled_dream');
  // None when the name already is that opening, as for a dream not yet read.
  const first = opening(dream.transcript ?? '');
  const excerpt = first.startsWith(title.replace(/…$/, '')) ? '' : first;

  return (
    <Pressable onPress={() => router.push({ pathname: '/journal/[id]', params: getDreamRouteParams(dream) })}
      accessibilityRole="button" accessibilityLabel={[label, title, excerpt].filter(Boolean).join('. ')}
      testID={span === 'rediscovery' ? 'home.rediscovery' : TID.Button.HomeAnniversary}
      className="min-h-[88px] flex-row items-center gap-4 border-t border-line py-4 active:opacity-70">
      {/* expo-image and the ring's colours take native props. */}
      <View style={{
        width: FACE, height: FACE, borderRadius: FACE / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: ink.surface.border, backgroundColor: ink.surface.raised,
      }}>
        {source && thumbnail !== failedUri ? <Image source={source} contentFit="cover" cachePolicy="memory-disk"
          priority="low" recyclingKey={`${dream.id}:${thumbnail}`} transition={0} onError={() => setFailedUri(thumbnail ?? null)}
          style={{ width: '100%', height: '100%' }} />
          : <IconSymbol name="moon.stars.fill" size={24} color={ink.accent.text} />}
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text maxFontSizeMultiplier={1.4}
          className="font-sans-medium text-overline uppercase text-ivory-muted">{label}</Text>
        <Text numberOfLines={2} maxFontSizeMultiplier={1.3}
          className="font-display-semibold text-h2 leading-[26px] text-ivory">{title}</Text>
        {excerpt ? <Text numberOfLines={2} maxFontSizeMultiplier={1.4}
          className="font-serif-italic text-body-sm leading-[19px] text-ivory-muted">
          {t('home.today.dream_excerpt', { text: excerpt })}
        </Text> : null}
      </View>
      <IconSymbol name="chevron.right" size={18} color={ink.text.tertiary} />
    </Pressable>
  );
}
