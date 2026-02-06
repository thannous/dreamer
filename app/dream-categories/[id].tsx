import { FlatGlassCard, GlassCard } from '@/components/inspiration/GlassCard';
import { PageHeaderContent } from '@/components/inspiration/PageHeader';
import { Fonts } from '@/constants/theme';
import { useDreams } from '@/context/DreamsContext';
import { ScrollPerfProvider } from '@/context/ScrollPerfContext';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { useScrollIdle } from '@/hooks/useScrollIdle';
import { useTranslation } from '@/hooks/useTranslation';
import { isCategoryExplored } from '@/lib/chatCategoryUtils';
import { isDreamExplored } from '@/lib/dreamUsage';
import { MotiView } from '@/lib/moti';
import { TID } from '@/lib/testIDs';
import type { DreamChatCategory } from '@/lib/types';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

type CategoryId = Exclude<DreamChatCategory, 'general'>;

type Category = {
  id: CategoryId;
  titleKey: string;
  descriptionKey: string;
  icon: Parameters<typeof IconSymbol>[0]['name'];
  color: string;
};

const CATEGORIES: Category[] = [
  {
    id: 'symbols',
    titleKey: 'dream_categories.symbols.title',
    descriptionKey: 'dream_categories.symbols.description',
    icon: 'sparkles',
    color: '#8C9EFF',
  },
  {
    id: 'emotions',
    titleKey: 'dream_categories.emotions.title',
    descriptionKey: 'dream_categories.emotions.description',
    icon: 'heart.fill',
    color: '#FF6B9D',
  },
  {
    id: 'growth',
    titleKey: 'dream_categories.growth.title',
    descriptionKey: 'dream_categories.growth.description',
    icon: 'leaf.fill',
    color: '#4CAF50',
  },
];

export default function DreamCategoriesScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dreams } = useDreams();
  const { colors, shadows, mode } = useTheme();
  const scrollPerf = useScrollIdle();
  useClearWebFocus();
  const dream = dreams.find((d) => d.id === Number(id));
  const hasExistingChat = isDreamExplored(dream);

  const gradientColors = mode === 'dark'
    ? (['#131022', '#4A3B5F'] as const)
    : ([colors.backgroundSecondary, colors.backgroundDark] as const);

  if (!dream) {
    return (
      <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
        <LinearGradient colors={gradientColors} style={styles.container}>
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>{t('dream_categories.not_found.title')}</Text>
        </LinearGradient>
      </ScrollPerfProvider>
    );
  }

  const handleCategoryPress = (categoryId: string) => {
    router.push({
      pathname: `/dream-chat/[id]`,
      params: { id: id, category: categoryId },
    });
  };

  const availableCategories = CATEGORIES.filter((category) => !isCategoryExplored(dream.chatHistory, category.id));

  return (
    <ScrollPerfProvider isScrolling={scrollPerf.isScrolling}>
      <LinearGradient colors={gradientColors} style={styles.gradient}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          onScrollBeginDrag={scrollPerf.onScrollBeginDrag}
          onScrollEndDrag={scrollPerf.onScrollEndDrag}
          onMomentumScrollBegin={scrollPerf.onMomentumScrollBegin}
          onMomentumScrollEnd={scrollPerf.onMomentumScrollEnd}
        >
          {/* Animated Header with GradientText */}
          <PageHeaderContent titleKey="dream_categories.explore_title" />

          {/* Dream Title — Glass Card with integrated back button */}
          <FlatGlassCard style={styles.dreamTitleCard} animationDelay={100}>
            <View style={styles.dreamTitleRow}>
              <Pressable
                onPress={() => router.back()}
                style={[styles.backButton, {
                  backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                }]}
              accessibilityRole="button"
              accessibilityLabel={t('journal.back_button')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IconSymbol name="chevron.left" size={20} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.dreamTitleContent}>
              <Text style={[styles.dreamTitle, { color: colors.textPrimary }]}>{dream.title}</Text>
              <Text style={[styles.dreamSubtitle, { color: colors.textSecondary }]}>
                  {t('dream_categories.subtitle')}
                </Text>
              </View>
            </View>
          </FlatGlassCard>

          {/* Category Cards — Vertical GlassCards */}
          <View style={styles.categoriesContainer}>
            {availableCategories.map((category, index) => (
              <GlassCard
                key={category.id}
                testID={TID.Button.DreamCategory(category.id)}
                onPress={() => handleCategoryPress(category.id)}
                animationDelay={200 + index * 120}
                style={styles.categoryCard}
              >
                <MotiView
                  from={{ translateY: 0 }}
                  animate={{ translateY: -1 }}
                  transition={{
                    type: 'timing',
                    duration: 3000,
                    loop: true,
                    repeatReverse: true,
                  }}
                >
                  <View style={[styles.iconRing, { borderColor: category.color }]}>
                    <IconSymbol name={category.icon} size={24} color={category.color} />
                  </View>
                </MotiView>
                <Text style={[styles.categoryTitle, { color: colors.textPrimary }]}>
                  {t(category.titleKey)}
                </Text>
                <Text style={[styles.categoryDescription, { color: colors.textSecondary }]}>
                  {t(category.descriptionKey)}
                </Text>
              </GlassCard>
            ))}
          </View>

          {/* Free Chat — Solid accent button */}
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 200 + availableCategories.length * 120 + 80 }}
          >
            <Pressable
              onPress={() => (hasExistingChat ? router.push(`/dream-chat/${id}`) : handleCategoryPress('general'))}
              testID={TID.Button.DreamFreeChat}
              style={[styles.freeChatButton, shadows.md, {
                backgroundColor: colors.accent,
                borderColor: mode === 'dark' ? 'rgba(140, 158, 255, 0.3)' : 'rgba(212, 165, 116, 0.3)',
              }]}
            >
              <IconSymbol name="bubble.left.and.bubble.right.fill" size={22} color={colors.textPrimary} />
              <Text style={[styles.freeChatText, { color: colors.textPrimary }]}>
                {hasExistingChat ? t('dream_categories.view_chat') : t('dream_categories.free_chat_prompt')}
              </Text>
            </Pressable>
          </MotiView>
        </ScrollView>
      </LinearGradient>
    </ScrollPerfProvider>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  dreamTitleCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  dreamTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  dreamTitleContent: {
    flex: 1,
  },
  dreamTitle: {
    fontSize: 22,
    fontFamily: Fonts.fraunces.semiBold,
    marginBottom: 6,
    lineHeight: 30,
  },
  dreamSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    lineHeight: 20,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },
  categoryCard: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  iconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontFamily: Fonts.fraunces.medium,
    textAlign: 'center',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 12,
    fontFamily: Fonts.spaceGrotesk.regular,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  freeChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
  },
  freeChatText: {
    fontSize: 17,
    fontFamily: Fonts.fraunces.medium,
    letterSpacing: 0.5,
  },
});
