import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Share, Alert, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useDreams } from '@/context/DreamsContext';
import { useTranslation } from '@/hooks/useTranslation';
import { Fonts } from '@/constants/theme';

export default function JournalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dreamId = useMemo(() => Number(id), [id]);
  const { dreams, deleteDream, toggleFavorite } = useDreams();
  const { t } = useTranslation();

  const dream = dreams.find((d) => d.id === dreamId);
  if (!dream) {
    return (
      <LinearGradient colors={['#131022', '#4A3B5F']} style={styles.container}>
        <Text style={{ color: '#CFCFEA', fontSize: 18 }}>Dream not found.</Text>
        <Pressable onPress={() => router.replace('/(tabs)/journal')} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  const onShare = async () => {
    try {
      await Share.share({ message: `"${dream.shareableQuote}" - From my dream journal.` });
    } catch (e) {
      Alert.alert('Share failed');
    }
  };

  const onDelete = async () => {
    Alert.alert(
      'Delete Dream',
      'Are you sure you want to delete this dream?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDream(dream.id);
            router.replace('/(tabs)/journal');
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={['#131022', '#4A3B5F']} style={styles.gradient}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Premium Header with Glassmorphism */}
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.headerButton}>
              <Ionicons name="arrow-back" size={24} color="#CFCFEA" />
            </Pressable>
            <Text style={styles.headerTitle}>Dream Analysis</Text>
            <Pressable onPress={onShare} style={styles.headerButton}>
              <Ionicons name="share-outline" size={22} color="#CFCFEA" />
            </Pressable>
          </View>
        </View>

        {/* Dream Image */}
        <View style={styles.imageContainer}>
          <View style={styles.imageFrame}>
            <Image source={{ uri: dream.imageUrl }} style={styles.dreamImage} resizeMode="cover" />
            <View style={styles.imageOverlay} />
          </View>
        </View>

        {/* Content Card - Overlaps image */}
        <View style={styles.contentCard}>
          {/* Premium Metadata Card */}
          <View style={styles.metadataCard}>
            <View style={styles.metadataHeader}>
              <View style={styles.dateContainer}>
                <Ionicons name="calendar-outline" size={16} color="#8C9EFF" />
                <Text style={styles.dateText}>
                  {new Date(dream.id).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <View style={styles.timeContainer}>
                <Ionicons name="time-outline" size={16} color="#8C9EFF" />
                <Text style={styles.timeText}>
                  {new Date(dream.id).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.metadataTitle}>{dream.title}</Text>
            {dream.dreamType && (
              <View style={styles.metadataRow}>
                <Ionicons name="moon-outline" size={18} color="#CFCFEA" />
                <Text style={styles.metadataLabel}>Dream Type:</Text>
                <Text style={styles.metadataValue}>{dream.dreamType}</Text>
              </View>
            )}
            {dream.theme && (
              <View style={styles.metadataRow}>
                <Ionicons name="color-palette-outline" size={18} color="#CFCFEA" />
                <Text style={styles.metadataLabel}>Theme:</Text>
                <Text style={styles.metadataValue}>{dream.theme}</Text>
              </View>
            )}
          </View>

          {/* Quote */}
          <View style={styles.quoteBox}>
            <Text style={styles.quote}>
              &quot;{dream.shareableQuote}&quot;
            </Text>
          </View>

          <Text style={styles.interpretation}>{dream.interpretation}</Text>

          {/* Action Buttons */}
          <Pressable style={styles.exploreButton} onPress={() => {
            router.push(`/dream-categories/${dream.id}`);
          }}>
            <Ionicons name="sparkles" size={24} color="#CFCFEA" />
            <Text style={styles.exploreButtonText}>Explore Dream Further</Text>
          </Pressable>

          {/* Additional Actions */}
          <View style={styles.actionsRow}>
            <Pressable onPress={() => toggleFavorite(dream.id)} style={styles.actionButton}>
              <Ionicons
                name={dream.isFavorite ? 'heart' : 'heart-outline'}
                size={24}
                color={dream.isFavorite ? '#F59E0B' : '#CFCFEA'}
              />
              <Text style={styles.actionButtonText}>
                {dream.isFavorite ? 'Favorited' : 'Favorite'}
              </Text>
            </Pressable>
            <Pressable onPress={onDelete} style={styles.actionButton}>
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
              <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Delete</Text>
            </Pressable>
          </View>

          {/* Transcript Section */}
          <View style={styles.transcriptSection}>
            <Text style={styles.transcriptTitle}>Original Transcript</Text>
            <Text style={styles.transcript}>{dream.transcript}</Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6c4ef7',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#CFCFEA',
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: 'rgba(19, 16, 34, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(207, 207, 234, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerButton: {
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
    letterSpacing: -0.015,
  },
  shareText: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
    color: '#CFCFEA',
    letterSpacing: 0.015,
  },
  imageContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 100,
    paddingBottom: 12,
  },
  imageFrame: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    aspectRatio: 2 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  dreamImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: 'rgba(140, 158, 255, 0.05)',
  },
  contentCard: {
    marginTop: -160,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'rgba(74, 59, 95, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  // Premium Metadata Card with Glassmorphism
  metadataCard: {
    backgroundColor: 'rgba(140, 158, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(207, 207, 234, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  metadataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dateText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
    color: '#8C9EFF',
    letterSpacing: 0.3,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.medium,
    color: '#8C9EFF',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(207, 207, 234, 0.2)',
    marginVertical: 12,
  },
  metadataTitle: {
    fontSize: 24,
    fontFamily: Fonts.lora.bold,
    color: '#CFCFEA',
    marginBottom: 12,
    lineHeight: 32,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  metadataLabel: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
    color: '#CFCFEA',
    opacity: 0.7,
  },
  metadataValue: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
    color: '#CFCFEA',
    textTransform: 'capitalize',
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.lora.bold,
    color: '#CFCFEA',
    marginBottom: 12,
    lineHeight: 36,
  },
  interpretation: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.regular,
    color: '#8C9EFF',
    lineHeight: 24,
    marginBottom: 16,
  },
  quoteBox: {
    borderLeftWidth: 4,
    borderLeftColor: '#8C9EFF',
    paddingLeft: 16,
    paddingVertical: 8,
    marginVertical: 16,
  },
  quote: {
    fontSize: 18,
    fontFamily: Fonts.lora.regularItalic,
    color: '#CFCFEA',
    lineHeight: 28,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6c4ef7',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#6c4ef7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(140, 158, 255, 0.3)',
  },
  exploreButtonText: {
    fontSize: 17,
    fontFamily: Fonts.spaceGrotesk.bold,
    color: '#CFCFEA',
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(140, 158, 255, 0.15)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(207, 207, 234, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
    color: '#CFCFEA',
  },
  transcriptSection: {
    marginTop: 24,
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(140, 158, 255, 0.2)',
    backgroundColor: 'rgba(19, 16, 34, 0.3)',
    borderRadius: 12,
    marginHorizontal: -16,
  },
  transcriptTitle: {
    fontSize: 18,
    fontFamily: Fonts.spaceGrotesk.bold,
    color: '#CFCFEA',
    marginBottom: 12,
  },
  transcript: {
    fontSize: 15,
    fontFamily: Fonts.spaceGrotesk.regular,
    color: '#8C9EFF',
    lineHeight: 24,
    opacity: 0.9,
  },
});
