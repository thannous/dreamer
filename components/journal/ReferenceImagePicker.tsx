import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Text,
  View,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import type { Action as ImageManipulatorAction } from 'expo-image-manipulator';

import { REFERENCE_IMAGES } from '@/constants/appConfig';
import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import {
  loadExpoImageManipulatorModule,
  loadExpoImagePickerModule,
} from '@/lib/referenceImagePlatform';
import type { ReferenceImage } from '@/lib/types';

interface ReferenceImagePickerProps {
  subjectType: 'person' | 'animal';
  onImagesSelected: (images: ReferenceImage[]) => void;
  maxImages?: number;
  active?: boolean;
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
    const manipulator = await loadExpoImageManipulatorModule();

    const actions: ImageManipulatorAction[] = [
      { resize: { width: MAX_DIMENSION, height: MAX_DIMENSION } },
    ];

    const result = await manipulator.manipulateAsync(uri, actions, {
      compress: WEBP_QUALITY,
      format: manipulator.SaveFormat.WEBP,
      base64: true,
    });

    // Validate base64 size
    const base64 = result.base64;
    if (!base64) {
      if (__DEV__) {
        console.warn('[ReferenceImagePicker] Compressed image is missing size data');
      }
      return null;
    }
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

/** expo-image is not a Uniwind component, so the preview box stays an object. */
const PREVIEW_IMAGE_STYLE = { width: 80, height: 80, borderRadius: 12, borderWidth: 1 } as const;

const ADD_BUTTON_CLASS =
  'h-20 w-20 items-center justify-center rounded-md border-2 border-dashed border-line bg-ink-soft';

export function ReferenceImagePicker({
  subjectType,
  onImagesSelected,
  maxImages = REFERENCE_IMAGES.MAX_UPLOADS,
  active = true,
}: ReferenceImagePickerProps) {
  const { t } = useTranslation();
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const pendingHandledRef = useRef(false);
  const mountedRef = useRef(true);
  const activeRef = useRef(active);
  const lifecycleEpochRef = useRef(0);
  const operationSequenceRef = useRef(0);
  const operationInFlightRef = useRef<number | null>(null);
  const selectedImagesRef = useRef<SelectedImage[]>([]);
  const onImagesSelectedRef = useRef(onImagesSelected);
  const subjectTypeRef = useRef(subjectType);

  useEffect(() => {
    onImagesSelectedRef.current = onImagesSelected;
    subjectTypeRef.current = subjectType;
  }, [onImagesSelected, subjectType]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      lifecycleEpochRef.current += 1;
      operationInFlightRef.current = null;
    };
  }, []);

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
  const canAddMore = selectedImages.length < maxImages;

  useLayoutEffect(() => {
    activeRef.current = active;
    if (active) {
      return;
    }

    lifecycleEpochRef.current += 1;
    operationInFlightRef.current = null;
    // Closing the parent sheet invalidates native work even though the picker stays mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(false);
  }, [active]);

  const isLifecycleCurrent = useCallback(
    (epoch: number) =>
      mountedRef.current
      && activeRef.current
      && lifecycleEpochRef.current === epoch,
    []
  );

  const commitSelection = useCallback(
    (update: (current: SelectedImage[]) => SelectedImage[], epoch: number) => {
      if (!isLifecycleCurrent(epoch)) {
        return;
      }

      const nextImages = update(selectedImagesRef.current);
      selectedImagesRef.current = nextImages;
      setSelectedImages(nextImages);
      onImagesSelectedRef.current(
        nextImages.map((image) => ({
          uri: image.uri,
          mimeType: image.mimeType,
          type: subjectTypeRef.current,
        }))
      );
    },
    [isLifecycleCurrent]
  );

  const processSelectedAssets = useCallback(
    async (assets: { uri: string }[], epoch = lifecycleEpochRef.current) => {
      if (!isLifecycleCurrent(epoch)) {
        return;
      }

      const remainingSlots = Math.max(0, maxImages - selectedImagesRef.current.length);
      const newImages: SelectedImage[] = [];
      for (const asset of assets.slice(0, remainingSlots)) {
        const compressed = await compressImage(asset.uri);
        if (!isLifecycleCurrent(epoch)) {
          return;
        }
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
        commitSelection(
          (current) => [...current, ...newImages].slice(0, maxImages),
          epoch
        );
      }
    },
    [commitSelection, isLifecycleCurrent, maxImages, t]
  );

  useEffect(() => {
    if (Platform.OS !== 'android' || !active) {
      return;
    }
    if (pendingHandledRef.current) {
      return;
    }
    pendingHandledRef.current = true;

    let isMounted = true;
    const lifecycleEpoch = lifecycleEpochRef.current;

    const checkPendingResult = async () => {
      try {
        const ImagePicker = await loadExpoImagePickerModule();
        const pendingResult = await ImagePicker.getPendingResultAsync();

        if (
          !isMounted
          || !isLifecycleCurrent(lifecycleEpoch)
          || !pendingResult
          || !('canceled' in pendingResult)
        ) {
          return;
        }

        if (pendingResult.canceled || pendingResult.assets.length === 0) {
          return;
        }

        setIsLoading(true);
        await processSelectedAssets(pendingResult.assets, lifecycleEpoch);
      } catch (error) {
        if (__DEV__ && isMounted && isLifecycleCurrent(lifecycleEpoch)) {
          console.error('[ReferenceImagePicker] Pending result error:', error);
        }
      } finally {
        if (isMounted && isLifecycleCurrent(lifecycleEpoch)) {
          setIsLoading(false);
        }
      }
    };

    void checkPendingResult();

    return () => {
      isMounted = false;
    };
  }, [active, isLifecycleCurrent, processSelectedAssets]);

  const handlePickImages = useCallback(async () => {
    if (!canAddMore || operationInFlightRef.current !== null || !activeRef.current) {
      return;
    }

    const operationId = ++operationSequenceRef.current;
    operationInFlightRef.current = operationId;
    const lifecycleEpoch = lifecycleEpochRef.current;
    try {
      setIsLoading(true);
      const ImagePicker = await loadExpoImagePickerModule();
      if (!isLifecycleCurrent(lifecycleEpoch)) {
        return;
      }

      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!isLifecycleCurrent(lifecycleEpoch)) {
        return;
      }
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

      if (
        !isLifecycleCurrent(lifecycleEpoch)
        || result.canceled
        || !result.assets?.length
      ) {
        return;
      }

      await processSelectedAssets(result.assets, lifecycleEpoch);
    } catch (error) {
      if (!isLifecycleCurrent(lifecycleEpoch)) {
        return;
      }
      if (__DEV__) {
        console.error('[ReferenceImagePicker] Pick error:', error);
      }
      Alert.alert(t('common.error_title'), t('reference_image.pick_error'));
    } finally {
      if (operationInFlightRef.current === operationId) {
        operationInFlightRef.current = null;
        if (isLifecycleCurrent(lifecycleEpoch)) {
          setIsLoading(false);
        }
      }
    }
  }, [
    canAddMore,
    isLifecycleCurrent,
    maxImages,
    processSelectedAssets,
    selectedImages.length,
    showPermissionDeniedAlert,
    t,
  ]);

  const handleTakePhoto = useCallback(async () => {
    if (!canAddMore || operationInFlightRef.current !== null || !activeRef.current) {
      return;
    }

    const operationId = ++operationSequenceRef.current;
    operationInFlightRef.current = operationId;
    const lifecycleEpoch = lifecycleEpochRef.current;
    try {
      setIsLoading(true);
      const ImagePicker = await loadExpoImagePickerModule();
      if (!isLifecycleCurrent(lifecycleEpoch)) {
        return;
      }

      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (!isLifecycleCurrent(lifecycleEpoch)) {
        return;
      }
      if (status !== 'granted') {
        showPermissionDeniedAlert(
          'reference_image.camera_permission_title',
          'reference_image.camera_permission_message',
          canAskAgain
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
        cameraType:
          subjectType === 'person' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
      });
      if (
        !isLifecycleCurrent(lifecycleEpoch)
        || result.canceled
        || !result.assets?.length
      ) {
        return;
      }

      await processSelectedAssets(result.assets, lifecycleEpoch);
    } catch (error) {
      if (!isLifecycleCurrent(lifecycleEpoch)) {
        return;
      }
      if (__DEV__) {
        console.error('[ReferenceImagePicker] Camera permission error:', error);
      }
      Alert.alert(t('common.error_title'), t('reference_image.pick_error'));
    } finally {
      if (operationInFlightRef.current === operationId) {
        operationInFlightRef.current = null;
        if (isLifecycleCurrent(lifecycleEpoch)) {
          setIsLoading(false);
        }
      }
    }
  }, [
    canAddMore,
    isLifecycleCurrent,
    processSelectedAssets,
    showPermissionDeniedAlert,
    subjectType,
    t,
  ]);

  const handleRemoveImage = useCallback(
    (index: number) => {
      const lifecycleEpoch = lifecycleEpochRef.current;
      commitSelection(
        (current) => current.filter((_, currentIndex) => currentIndex !== index),
        lifecycleEpoch
      );
    },
    [commitSelection]
  );

  return (
    <View className="py-4">
      <Text className="mb-1 font-sans-bold text-[16px] text-ivory">
        {t(`reference_image.title_${subjectType}`)}
      </Text>
      <Text className="mb-4 font-sans text-body-sm text-ivory-muted">
        {t('reference_image.subtitle')}
      </Text>

      <View className="flex-row flex-wrap gap-2">
        {selectedImages.map((image, index) => (
          <View key={`${image.uri}-${index}`} className="relative">
            <Image
              source={{ uri: image.uri }}
              style={[PREVIEW_IMAGE_STYLE, { borderColor: noctalia.surface.border }]}
              contentFit="cover"
            />
            <PressableScale
              onPress={() => handleRemoveImage(index)}
              className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-ink-raised"
              style={shadows.sm}
              accessibilityRole="button"
              accessibilityLabel={t('reference_image.remove_photo', { index: index + 1 })}
              accessibilityHint={t('reference_image.remove_photo_hint')}
            >
              <IconSymbol name="xmark" size={16} color={noctalia.text.primary} />
            </PressableScale>
          </View>
        ))}

        {canAddMore && (
          <>
            {!isWeb && (
              <PressableScale
                onPress={handleTakePhoto}
                disabled={isLoading}
                accessibilityLabel={t('reference_image.take_photo')}
                accessibilityRole="button"
                className={`${ADD_BUTTON_CLASS} ${isLoading ? 'opacity-60' : ''}`}
              >
                {isLoading ? (
                  <ActivityIndicator color={noctalia.text.secondary} />
                ) : (
                  <IconSymbol name="camera" size={28} color={noctalia.text.secondary} />
                )}
              </PressableScale>
            )}
            <PressableScale
              onPress={handlePickImages}
              disabled={isLoading}
              accessibilityLabel={t('reference_image.pick_from_gallery')}
              accessibilityRole="button"
              className={`${ADD_BUTTON_CLASS} ${isLoading ? 'opacity-60' : ''}`}
            >
              {isLoading ? (
                <ActivityIndicator color={noctalia.text.secondary} />
              ) : (
                <IconSymbol name="photo.on.rectangle" size={28} color={noctalia.text.secondary} />
              )}
            </PressableScale>
          </>
        )}
      </View>

      {selectedImages.length > 0 && (
        <Text className="mt-2 font-sans text-[12px] text-ivory-muted">
          {t('reference_image.selected_count', { count: selectedImages.length, max: maxImages })}
        </Text>
      )}
    </View>
  );
}

export default ReferenceImagePicker;
