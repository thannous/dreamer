import { Fonts } from '@/constants/theme';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { TID } from '@/lib/testIDs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Category = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
};

const CATEGORIES: Category[] = [
  {
    id: 'symbols',
    title: 'Symbols',
    description: 'Explore the symbolic meanings and hidden messages in your dream',
    icon: 'creation',
    color: '#8C9EFF',
  },
  {
    id: 'emotions',
    title: 'Emotions',
    description: 'Understand the emotional landscape and feelings from your dream',
    icon: 'heart-pulse',
    color: '#FF6B9D',
  },
  {
    id: 'growth',
    title: 'Personal Growth',
    description: 'Discover insights and lessons for your personal development',
    icon: 'sprout',
    color: '#4CAF50',
  },
];

export default function DreamCategoriesScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dreams } = useDreams();
  const { colors, shadows, mode } = useTheme();
  const dream = dreams.find((d) => d.id === Number(id));

  const gradientColors = mode === 'dark'
    ? (['#131022', '#4A3B5F'] as const)
    : ([colors.backgroundSecondary, colors.backgroundDark] as const);

  if (!dream) {
    return (
      <LinearGradient colors={gradientColors} style={styles.container}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>{t('dream_categories.not_found.title')}</Text>
      </LinearGradient>
    );
  }

  const handleCategoryPress = (categoryId: string) => {
    router.push({
      pathname: `/dream-chat/[id]`,
      params: { id: id, category: categoryId },
    });
  };

  return (
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('dream_categories.explore_title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Dream Title */}
        <View style={[styles.dreamTitleContainer, {
          backgroundColor: mode === 'dark' ? 'rgba(140, 158, 255, 0.15)' : 'rgba(212, 165, 116, 0.15)',
          borderColor: colors.divider
        }]}>
          <Text style={[styles.dreamTitle, { color: colors.textPrimary }]}>{dream.title}</Text>
          <Text style={[styles.dreamSubtitle, { color: colors.textSecondary }]}>
            Choose a theme to explore deeper insights
          </Text>
        </View>

        {/* Category Cards */}
        <View style={styles.categoriesContainer}>
          {CATEGORIES.map((category) => (
            <Pressable
              testID={TID.Button.DreamCategory(category.id)}
              key={category.id}
              style={({ pressed }) => [
                styles.categoryCard,
                shadows.lg,
                { backgroundColor: colors.backgroundCard, borderColor: colors.divider },
                pressed && styles.categoryCardPressed,
              ]}
              onPress={() => handleCategoryPress(category.id)}
            >
              <View style={[styles.iconContainer, { backgroundColor: `${category.color}20` }]}>
                <MaterialCommunityIcons
                  name={category.icon}
                  size={40}
                  color={category.color}
                />
              </View>
              <View style={styles.categoryContent}>
                <Text style={[styles.categoryTitle, { color: colors.textPrimary }]}>{category.title}</Text>
                <Text style={[styles.categoryDescription, { color: colors.textSecondary }]}>{category.description}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>

        {/* Free Chat Option */}
        <Pressable
          style={({ pressed }) => [
            styles.freeChatButton,
            shadows.xl,
            { backgroundColor: colors.accent },
            pressed && styles.freeChatButtonPressed,
          ]}
          onPress={() => handleCategoryPress('general')}
        >
          <MaterialCommunityIcons name="chat-processing-outline" size={24} color={colors.textPrimary} />
          <Text style={[styles.freeChatText, { color: colors.textPrimary }]}>{t('dream_categories.free_chat_prompt')}</Text>
        </Pressable>
      </ScrollView>
    </LinearGradient>
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
    // color: set dynamically
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 48,
  },
  dreamTitleContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginHorizontal: 16,
    marginBottom: 24,
    // backgroundColor and borderColor: set dynamically
    borderRadius: 16,
    borderWidth: 1,
  },
  dreamTitle: {
    fontSize: 24,
    fontFamily: Fonts.lora.bold,
    // color: set dynamically
    marginBottom: 8,
    lineHeight: 32,
  },
  dreamSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    // color: set dynamically
    lineHeight: 20,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor and borderColor: set dynamically
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    // shadow: applied via theme shadows.lg
  },
  categoryCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  categoryContent: {
    flex: 1,
    marginRight: 8,
  },
  categoryTitle: {
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
    marginBottom: 6,
  },
  categoryDescription: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
    // color: set dynamically
    lineHeight: 18,
  },
  freeChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    // backgroundColor: set dynamically
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 18,
    borderRadius: 14,
    // shadow: applied via theme shadows.xl
  },
  freeChatButtonPressed: {
    opacity: 0.8,
  },
  freeChatText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
    // color: set dynamically
  },
});
