import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';

interface SubjectPropositionProps {
  subjectType: 'person' | 'animal';
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * A non-intrusive card/banner that proposes adding reference photos
 * for a detected subject (person or animal) in the dream.
 */
export function SubjectProposition({
  subjectType,
  onAccept,
  onDismiss,
}: SubjectPropositionProps) {
  const { t } = useTranslation();
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  const iconName = subjectType === 'person' ? 'person.fill' : 'pawprint.fill';
  const title = t(`subject_proposition.title_${subjectType}`);
  const message = t(`subject_proposition.message_${subjectType}`);

  return (
    <View
      className="flex-row items-start gap-2 rounded-lg border border-line bg-ink-raised p-4"
      style={shadows.md}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-champagne">
        <IconSymbol name={iconName} size={20} color={noctalia.action.primaryText} />
      </View>

      <View className="flex-1">
        <Text className="mb-1 font-sans-bold text-[16px] text-ivory">{title}</Text>
        <Text className="mb-4 font-sans text-body-sm text-ivory-muted">{message}</Text>

        <View className="flex-row items-center gap-4">
          <PressableScale
            onPress={onAccept}
            className="rounded-md border border-champagne-soft bg-champagne px-4 py-2"
          >
            <Text className="font-sans-bold text-[14px] text-on-champagne">
              {t('subject_proposition.accept')}
            </Text>
          </PressableScale>

          <Pressable onPress={onDismiss} className="py-2" hitSlop={8}>
            <Text className="font-sans text-[14px] text-ivory-muted">
              {t('subject_proposition.skip')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default SubjectProposition;
