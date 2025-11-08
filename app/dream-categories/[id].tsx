import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useDreams } from '@/context/DreamsContext';
import { Fonts } from '@/constants/theme';

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dreams } = useDreams();
  const dream = dreams.find((d) => d.id === Number(id));

  if (!dream) {
    return (
      <LinearGradient colors={['#131022', '#4A3B5F']} style={styles.container}>
        <Text style={styles.errorText}>Dream not found.</Text>
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
    <LinearGradient colors={['#131022', '#4A3B5F']} style={styles.gradient}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#CFCFEA" />
          </Pressable>
          <Text style={styles.headerTitle}>Explore Your Dream</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Dream Title */}
        <View style={styles.dreamTitleContainer}>
          <Text style={styles.dreamTitle}>{dream.title}</Text>
          <Text style={styles.dreamSubtitle}>
            Choose a theme to explore deeper insights
          </Text>
        </View>

        {/* Category Cards */}
        <View style={styles.categoriesContainer}>
          {CATEGORIES.map((category) => (
            <Pressable
              key={category.id}
              style={({ pressed }) => [
                styles.categoryCard,
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
                <Text style={styles.categoryTitle}>{category.title}</Text>
                <Text style={styles.categoryDescription}>{category.description}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#9b92c9" />
            </Pressable>
          ))}
        </View>

        {/* Free Chat Option */}
        <Pressable
          style={({ pressed }) => [
            styles.freeChatButton,
            pressed && styles.freeChatButtonPressed,
          ]}
          onPress={() => handleCategoryPress('general')}
        >
          <MaterialCommunityIcons name="chat-processing-outline" size={24} color="#CFCFEA" />
          <Text style={styles.freeChatText}>Ask anything about this dream</Text>
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
    color: '#CFCFEA',
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
    color: '#CFCFEA',
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
    backgroundColor: 'rgba(140, 158, 255, 0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(207, 207, 234, 0.2)',
  },
  dreamTitle: {
    fontSize: 24,
    fontFamily: Fonts.lora.bold,
    color: '#CFCFEA',
    marginBottom: 8,
    lineHeight: 32,
  },
  dreamSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.regular,
    color: '#9b92c9',
    lineHeight: 20,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 22, 53, 0.8)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(207, 207, 234, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
    color: '#CFCFEA',
    marginBottom: 6,
  },
  categoryDescription: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
    color: '#9b92c9',
    lineHeight: 18,
  },
  freeChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#6c4ef7',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 18,
    borderRadius: 14,
    shadowColor: '#6c4ef7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  freeChatButtonPressed: {
    opacity: 0.8,
  },
  freeChatText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
    color: '#CFCFEA',
  },
});
