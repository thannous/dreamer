import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { Action as ImageManipulatorAction } from 'expo-image-manipulator';

import { Fonts } from '@/constants/theme';
import { ThemeLayout } from '@/constants/journalTheme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import type { ReferenceImage } from '@/lib/types';

interface ReferenceImagePickerProps {
  subjectType: 'person' | 'animal';
  onImagesSelected: (images: ReferenceImage[]) => void;
  maxImages?: number;
}

interface SelectedImage {
  uri: string;
  mimeType: string;
}

const MAX_COMPRESSED_SIZE_BYTES = 1.5 * 1024 * 1024; // 1.5MB decoded payload
const MAX_DIMENSION = 512;
const WEBP_QUALITY = 0.7;

const estimateBase64Bytes = (base64: string): number => {
  const sanitized = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((sanitized.length * 3) / 4) - padding);
};

/**
 * Compress image using expo-image-manipulator.
 * Returns the compressed URI and mimeType.
 */
async function compressImage(uri: string): Promise<{ uri: string; mimeType: string } | null> {
  try {
    const manipulator = await import('expo-image-manipulator');

    const actions: ImageManipulatorAction[] = [
      { resize: { width: MAX_DIMENSION, height: MAX_DIMENSION } },
    ];

    const result = await manipulator.manipulateAsync(uri, actions, {
      compress: WEBP_QUALITY,
      format: manipulator.SaveFormat.WEBP,
      base64: true,
    });

    // Validate base64 size
    const base64 = result.base64 ?? '';
    const estimatedBytes = estimateBase64Bytes(base64);
    if (estimatedBytes > MAX_COMPRESSED_SIZE_BYTES) {
      if (__DEV__) {
        console.warn('[ReferenceImagePicker] Compressed image too large:', estimatedBytes);
      }
      return null;
    }

    return {
      uri: result.uri,
      mimeType: 'image/webp',
    };
  } catch (error) {
    if (__DEV__) {
      console.error('[ReferenceImagePicker] Image compression failed:', error);
    }
    return null;
  }
}

export function ReferenceImagePicker({
  subjectType,
  onImagesSelected,
  maxImages = 2,
}: ReferenceImagePickerProps) {
  const { t } = useTranslation();
  const { colors, shadows } = useTheme();

  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handlePickImages = useCallback(async () => {
    try {
      setIsLoading(true);
      const ImagePicker = await import('expo-image-picker');

      // Request permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('reference_image.permission_title'),
          t('reference_image.permission_message')
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: maxImages > 1,
        selectionLimit: maxImages - selectedImages.length,
        allowsEditing: false,
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      // Compress each selected image
      const newImages: SelectedImage[] = [];
      for (const asset of result.assets) {
        const compressed = await compressImage(asset.uri);
        if (compressed) {
          newImages.push(compressed);
        } else {
          Alert.alert(
            t('reference_image.compression_error_title'),
            t('reference_image.compression_error_message')
          );
        }
      }

      if (newImages.length > 0) {
        const allImages = [...selectedImages, ...newImages].slice(0, maxImages);
        setSelectedImages(allImages);

        // Notify parent with full reference images
        const referenceImages: ReferenceImage[] = allImages.map((img) => ({
          uri: img.uri,
          mimeType: img.mimeType,
          type: subjectType,
        }));
        onImagesSelected(referenceImages);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[ReferenceImagePicker] Pick error:', error);
      }
      Alert.alert(t('common.error_title'), t('reference_image.pick_error'));
    } finally {
      setIsLoading(false);
    }
  }, [maxImages, selectedImages, subjectType, onImagesSelected, t]);

  const handleRemoveImage = useCallback(
    (index: number) => {
      const newImages = selectedImages.filter((_, i) => i !== index);
      setSelectedImages(newImages);

      const referenceImages: ReferenceImage[] = newImages.map((img) => ({
        uri: img.uri,
        mimeType: img.mimeType,
        type: subjectType,
      }));
      onImagesSelected(referenceImages);
    },
    [selectedImages, subjectType, onImagesSelected]
  );

  const canAddMore = selectedImages.length < maxImages;
  const iconName = subjectType === 'person' ? 'person-outline' : 'paw-outline';

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {t(`reference_image.title_${subjectType}`)}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t('reference_image.subtitle')}
      </Text>

      <View style={styles.imagesRow}>
        {selectedImages.map((image, index) => (
          <View key={`${image.uri}-${index}`} style={styles.imageWrapper}>
            <Image
              source={{ uri: image.uri }}
              style={[styles.preview, { borderColor: colors.divider }]}
              contentFit="cover"
            />
            <Pressable
              onPress={() => handleRemoveImage(index)}
              style={[styles.removeButton, shadows.sm, { backgroundColor: colors.backgroundCard }]}
              hitSlop={8}
            >
              <Ionicons name="close" size={16} color={colors.textPrimary} />
            </Pressable>
          </View>
        ))}

        {canAddMore && (
          <Pressable
            onPress={handlePickImages}
            disabled={isLoading}
            style={[
              styles.addButton,
              { borderColor: colors.divider, backgroundColor: colors.backgroundSecondary },
              isLoading && styles.addButtonDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textSecondary} />
            ) : (
              <>
                <Ionicons name={iconName} size={28} color={colors.textSecondary} />
                <Ionicons name="add" size={16} color={colors.textSecondary} style={styles.plusIcon} />
              </>
            )}
          </Pressable>
        )}
      </View>

      {selectedImages.length > 0 && (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t('reference_image.selected_count', { count: selectedImages.length, max: maxImages })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: ThemeLayout.spacing.md,
  },
  title: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
    marginBottom: ThemeLayout.spacing.xs,
  },
  subtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: ThemeLayout.spacing.md,
  },
  imagesRow: {
    flexDirection: 'row',
    gap: ThemeLayout.spacing.sm,
    flexWrap: 'wrap',
  },
  imageWrapper: {
    position: 'relative',
  },
  preview: {
    width: 80,
    height: 80,
    borderRadius: ThemeLayout.borderRadius.md,
    borderWidth: 1,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 80,
    height: 80,
    borderRadius: ThemeLayout.borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  plusIcon: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  hint: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    marginTop: ThemeLayout.spacing.sm,
  },
});

export default ReferenceImagePicker;
