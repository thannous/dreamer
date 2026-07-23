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
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import type { Action as ImageManipulatorAction } from 'expo-image-manipulator';
import type { CameraType, CameraView as ExpoCameraView } from 'expo-camera';

import { REFERENCE_IMAGES } from '@/constants/appConfig';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import {
  loadExpoCameraModule,
  loadExpoImageManipulatorModule,
  loadExpoImagePickerModule,
  type ExpoCameraModule,
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

type CameraPermission = {
  granted: boolean;
  canAskAgain: boolean;
};

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
  const cameraRef = useRef<ExpoCameraView | null>(null);
  const mountedRef = useRef(true);
  const activeRef = useRef(active);
  const lifecycleEpochRef = useRef(0);
  const cameraEpochRef = useRef(0);
  const operationSequenceRef = useRef(0);
  const operationInFlightRef = useRef<number | null>(null);
  const captureSequenceRef = useRef(0);
  const captureInFlightRef = useRef<number | null>(null);
  const selectedImagesRef = useRef<SelectedImage[]>([]);
  const onImagesSelectedRef = useRef(onImagesSelected);
  const subjectTypeRef = useRef(subjectType);
  const [expoCamera, setExpoCamera] = useState<ExpoCameraModule | null>(null);
  const [cameraPermission, setCameraPermission] = useState<CameraPermission | null>(null);

  useEffect(() => {
    onImagesSelectedRef.current = onImagesSelected;
    subjectTypeRef.current = subjectType;
  }, [onImagesSelected, subjectType]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      lifecycleEpochRef.current += 1;
      cameraEpochRef.current += 1;
      operationInFlightRef.current = null;
      captureInFlightRef.current = null;
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
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraFacing: CameraType = subjectType === 'person' ? 'front' : 'back';
  const canAddMore = selectedImages.length < maxImages;

  useLayoutEffect(() => {
    activeRef.current = active;
    if (active) {
      return;
    }

    lifecycleEpochRef.current += 1;
    cameraEpochRef.current += 1;
    operationInFlightRef.current = null;
    captureInFlightRef.current = null;
    // Closing the parent sheet invalidates native work even though the picker stays mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCameraVisible(false);
    setIsCameraReady(false);
    setIsCapturing(false);
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

  const loadExpoCamera = useCallback(async (): Promise<ExpoCameraModule | null> => {
    if (expoCamera) {
      return expoCamera;
    }

    try {
      const camera = await loadExpoCameraModule();
      if (mountedRef.current && activeRef.current) {
        setExpoCamera(camera);
      }
      return camera;
    } catch (error) {
      if (__DEV__) {
        console.warn('[ReferenceImagePicker] expo-camera unavailable:', error);
      }
      return null;
    }
  }, [expoCamera]);

  const ensureCameraPermission = useCallback(async (camera: ExpoCameraModule) => {
    const existing = await camera.Camera.getCameraPermissionsAsync();
    if (existing.granted) {
      const permission = { granted: true, canAskAgain: existing.canAskAgain };
      if (mountedRef.current && activeRef.current) {
        setCameraPermission(permission);
      }
      return permission;
    }

    const requested = await camera.Camera.requestCameraPermissionsAsync();
    const permission = { granted: requested.granted, canAskAgain: requested.canAskAgain };
    if (mountedRef.current && activeRef.current) {
      setCameraPermission(permission);
    }
    return permission;
  }, []);

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

  const closeCamera = useCallback(() => {
    cameraEpochRef.current += 1;
    captureInFlightRef.current = null;
    setIsCameraVisible(false);
    setIsCameraReady(false);
    setIsCapturing(false);
  }, []);

  const handleCapture = useCallback(async () => {
    if (
      !cameraRef.current
      || !isCameraReady
      || isCapturing
      || captureInFlightRef.current !== null
      || !activeRef.current
    ) {
      return;
    }

    const captureId = ++captureSequenceRef.current;
    captureInFlightRef.current = captureId;
    const lifecycleEpoch = lifecycleEpochRef.current;
    const cameraEpoch = cameraEpochRef.current;
    let processingStarted = false;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (
        !isLifecycleCurrent(lifecycleEpoch)
        || cameraEpochRef.current !== cameraEpoch
        || captureInFlightRef.current !== captureId
      ) {
        return;
      }
      if (!photo?.uri) {
        throw new Error('Missing photo uri');
      }

      setIsCameraVisible(false);
      setIsCameraReady(false);
      setIsLoading(true);
      processingStarted = true;
      await processSelectedAssets([{ uri: photo.uri }], lifecycleEpoch);
    } catch (error) {
      if (
        !isLifecycleCurrent(lifecycleEpoch)
        || cameraEpochRef.current !== cameraEpoch
        || captureInFlightRef.current !== captureId
      ) {
        return;
      }
      if (__DEV__) {
        console.error('[ReferenceImagePicker] Capture error:', error);
      }
      Alert.alert(t('common.error_title'), t('reference_image.pick_error'));
    } finally {
      if (captureInFlightRef.current === captureId) {
        captureInFlightRef.current = null;
        if (mountedRef.current) {
          setIsCapturing(false);
          if (processingStarted) {
            setIsLoading(false);
          }
        }
      }
    }
  }, [isCameraReady, isCapturing, isLifecycleCurrent, processSelectedAssets, t]);

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

  const handleTakePhotoWithImagePicker = useCallback(async (lifecycleEpoch: number) => {
    if (!canAddMore || !isLifecycleCurrent(lifecycleEpoch)) {
      return;
    }

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
  }, [
    canAddMore,
    isLifecycleCurrent,
    processSelectedAssets,
    showPermissionDeniedAlert,
    subjectType,
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
      const camera = await loadExpoCamera();
      if (!isLifecycleCurrent(lifecycleEpoch)) {
        return;
      }
      if (!camera) {
        await handleTakePhotoWithImagePicker(lifecycleEpoch);
        return;
      }

      const permission = cameraPermission?.granted
        ? cameraPermission
        : await ensureCameraPermission(camera);
      if (!isLifecycleCurrent(lifecycleEpoch)) {
        return;
      }
      if (!permission?.granted) {
        showPermissionDeniedAlert(
          'reference_image.camera_permission_title',
          'reference_image.camera_permission_message',
          permission?.canAskAgain ?? false
        );
        return;
      }

      cameraEpochRef.current += 1;
      setIsCameraReady(false);
      setIsCameraVisible(true);
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
    cameraPermission,
    ensureCameraPermission,
    handleTakePhotoWithImagePicker,
    isLifecycleCurrent,
    loadExpoCamera,
    showPermissionDeniedAlert,
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

  const CameraView = expoCamera?.CameraView;

  const handleCameraMountError = useCallback(
    (error: { message: string }) => {
      if (__DEV__) {
        console.error('[ReferenceImagePicker] Camera mount error:', error);
      }
      closeCamera();
      if (mountedRef.current && activeRef.current) {
        Alert.alert(t('common.error_title'), t('reference_image.pick_error'));
      }
    },
    [closeCamera, t]
  );

  return (
    <View style={styles.container}>
      {isCameraVisible && CameraView && (
        <Modal
          visible={isCameraVisible}
          animationType="slide"
          onRequestClose={closeCamera}
        >
          <View style={styles.cameraModal}>
            <CameraView
              ref={cameraRef}
              style={styles.cameraView}
              facing={cameraFacing}
              onCameraReady={() => setIsCameraReady(true)}
              onMountError={handleCameraMountError}
            />
            {!isCameraReady && (
              <View style={styles.cameraLoading}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            <View style={styles.cameraTopBar}>
              <Pressable
                onPress={closeCamera}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                style={styles.cameraCloseButton}
              >
                <IconSymbol name="xmark" size={20} color="#fff" />
              </Pressable>
            </View>
            <View style={styles.cameraControls}>
              <Pressable
                onPress={handleCapture}
                disabled={!isCameraReady || isCapturing}
                accessibilityRole="button"
                accessibilityLabel={t('reference_image.take_photo')}
                testID="reference-image-camera-capture"
                style={[
                  styles.cameraCaptureButton,
                  (!isCameraReady || isCapturing) && styles.cameraCaptureButtonDisabled,
                ]}
              >
                <View style={styles.cameraCaptureInner} />
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      <Text style={[styles.title, { color: noctalia.text.primary }]}>
        {t(`reference_image.title_${subjectType}`)}
      </Text>
      <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>
        {t('reference_image.subtitle')}
      </Text>

      <View style={styles.imagesRow}>
        {selectedImages.map((image, index) => (
          <View key={`${image.uri}-${index}`} style={styles.imageWrapper}>
            <Image
              source={{ uri: image.uri }}
              style={[styles.preview, { borderColor: noctalia.surface.border }]}
              contentFit="cover"
            />
            <Pressable
              onPress={() => handleRemoveImage(index)}
              style={[styles.removeButton, shadows.sm, { backgroundColor: noctalia.surface.raised }]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('reference_image.remove_photo', { index: index + 1 })}
              accessibilityHint={t('reference_image.remove_photo_hint')}
            >
              <IconSymbol name="xmark" size={16} color={noctalia.text.primary} />
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
                  { borderColor: noctalia.surface.border, backgroundColor: noctalia.surface.soft },
                  isLoading && styles.addButtonDisabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={noctalia.text.secondary} />
                ) : (
                  <IconSymbol name="camera" size={28} color={noctalia.text.secondary} />
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
                { borderColor: noctalia.surface.border, backgroundColor: noctalia.surface.soft },
                isLoading && styles.addButtonDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={noctalia.text.secondary} />
              ) : (
                <IconSymbol name="photo.on.rectangle" size={28} color={noctalia.text.secondary} />
              )}
            </Pressable>
          </>
        )}
      </View>

      {selectedImages.length > 0 && (
        <Text style={[styles.hint, { color: noctalia.text.secondary }]}>
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
  cameraModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraView: {
    flex: 1,
  },
  cameraLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cameraTopBar: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  cameraCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCaptureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  cameraCaptureButtonDisabled: {
    opacity: 0.6,
  },
  cameraCaptureInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
});

export default ReferenceImagePicker;
