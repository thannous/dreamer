import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
  Platform,
  Linking,
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

const isWeb = Platform.OS === 'web';

export function ReferenceImagePicker({
  subjectType,
  onImagesSelected,
  maxImages = 2,
}: ReferenceImagePickerProps) {
  const { t } = useTranslation();
  const { colors, shadows } = useTheme();

  const showPermissionDeniedAlert = useCallback(
    (titleKey: string, messageKey: string, canAskAgain: boolean) => {
      if (canAskAgain) {
        Alert.alert(t(titleKey), t(messageKey));
      } else {
        Alert.alert(t(titleKey), t('reference_image.permission_denied_permanently'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('reference_image.open_settings'),
            onPress: () => Linking.openSettings(),
          },
        ]);
      }
    },
    [t]
  );

  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const processSelectedAssets = useCallback(
    async (assets: { uri: string }[]) => {
      const newImages: SelectedImage[] = [];
      for (const asset of assets) {
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

        const referenceImages: ReferenceImage[] = allImages.map((img) => ({
          uri: img.uri,
          mimeType: img.mimeType,
          type: subjectType,
        }));
        onImagesSelected(referenceImages);
      }
    },
    [maxImages, selectedImages, subjectType, onImagesSelected, t]
  );

  const handlePickImages = useCallback(async () => {
    try {
      setIsLoading(true);
      const ImagePicker = await import('expo-image-picker');

      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showPermissionDeniedAlert(
          'reference_image.permission_title',
          'reference_image.permission_message',
          canAskAgain
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

      await processSelectedAssets(result.assets);
    } catch (error) {
      if (__DEV__) {
        console.error('[ReferenceImagePicker] Pick error:', error);
      }
      Alert.alert(t('common.error_title'), t('reference_image.pick_error'));
    } finally {
      setIsLoading(false);
    }
  }, [maxImages, selectedImages, t, processSelectedAssets, showPermissionDeniedAlert]);

  const handleTakePhoto = useCallback(async () => {
    try {
      setIsLoading(true);
      const ImagePicker = await import('expo-image-picker');

      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showPermissionDeniedAlert(
          'reference_image.camera_permission_title',
          'reference_image.camera_permission_message',
          canAskAgain
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
        cameraType: ImagePicker.CameraType.front,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      await processSelectedAssets(result.assets);
    } catch (error) {
      if (__DEV__) {
        console.error('[ReferenceImagePicker] Camera error:', error);
      }
      Alert.alert(t('common.error_title'), t('reference_image.pick_error'));
    } finally {
      setIsLoading(false);
    }
  }, [t, processSelectedAssets, showPermissionDeniedAlert]);

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
          <>
            {!isWeb && (
              <Pressable
                onPress={handleTakePhoto}
                disabled={isLoading}
                accessibilityLabel={t('reference_image.take_photo')}
                accessibilityRole="button"
                style={[
                  styles.addButton,
                  { borderColor: colors.divider, backgroundColor: colors.backgroundSecondary },
                  isLoading && styles.addButtonDisabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.textSecondary} />
                ) : (
                  <Ionicons name="camera-outline" size={28} color={colors.textSecondary} />
                )}
              </Pressable>
            )}
            <Pressable
              onPress={handlePickImages}
              disabled={isLoading}
              accessibilityLabel={t('reference_image.pick_from_gallery')}
              accessibilityRole="button"
              style={[
                styles.addButton,
                { borderColor: colors.divider, backgroundColor: colors.backgroundSecondary },
                isLoading && styles.addButtonDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textSecondary} />
              ) : (
                <Ionicons name="images-outline" size={28} color={colors.textSecondary} />
              )}
            </Pressable>
          </>
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
  hint: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    marginTop: ThemeLayout.spacing.sm,
  },
});

export default ReferenceImagePicker;
