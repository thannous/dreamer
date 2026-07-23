/* @jest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ReferenceImagePicker } from '@/components/journal/ReferenceImagePicker';

const mockAlert = jest.fn();
const mockOpenSettings = jest.fn();
const mockGetPendingResult = jest.fn();
const mockRequestMediaLibraryPermission = jest.fn();
const mockRequestCameraPermission = jest.fn();
const mockLaunchImageLibrary = jest.fn();
const mockLaunchCamera = jest.fn();
const mockManipulateImage = jest.fn();
const mockLoadCamera = jest.fn();
const mockLoadImagePicker = jest.fn();
const mockLoadImageManipulator = jest.fn();
const mockGetCameraPermission = jest.fn();
const mockRequestNativeCameraPermission = jest.fn();
const mockTakePicture = jest.fn();
const mockPressHandlers = new Map<string, () => void | Promise<void>>();

function createDeferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {
    promise,
    resolve: (value: T) => resolve?.(value),
  };
}

const MockCameraView = React.forwardRef(function MockCameraView(
  {
    facing,
    onCameraReady,
    onMountError,
  }: {
    facing?: string;
    onCameraReady?: () => void;
    onMountError?: (error: { message: string }) => void;
  },
  ref: React.ForwardedRef<{ takePictureAsync: typeof mockTakePicture }>
) {
  React.useImperativeHandle(ref, () => ({
    takePictureAsync: mockTakePicture,
  }));

  return (
    <>
      <button
        data-facing={facing}
        data-testid="mock-camera-ready"
        onClick={onCameraReady}
      >
        Camera ready
      </button>
      <button
        data-testid="mock-camera-mount-error"
        onClick={() => onMountError?.({ message: 'Camera failed to mount' })}
      >
        Camera mount error
      </button>
    </>
  );
});

const mockCameraModule = {
  Camera: {
    getCameraPermissionsAsync: mockGetCameraPermission,
    requestCameraPermissionsAsync: mockRequestNativeCameraPermission,
  },
  CameraView: MockCameraView,
};

const mockImagePicker = {
  CameraType: {
    back: 'back',
    front: 'front',
  },
  MediaTypeOptions: {
    Images: 'Images',
  },
  getPendingResultAsync: mockGetPendingResult,
  launchCameraAsync: mockLaunchCamera,
  launchImageLibraryAsync: mockLaunchImageLibrary,
  requestCameraPermissionsAsync: mockRequestCameraPermission,
  requestMediaLibraryPermissionsAsync: mockRequestMediaLibraryPermission,
};

const mockImageManipulator = {
  SaveFormat: {
    WEBP: 'webp',
  },
  manipulateAsync: mockManipulateImage,
};

jest.mock('react-native', () => {
  const React = require('react');

  return {
    ActivityIndicator: () => <span data-testid="activity-indicator" />,
    Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
    Linking: { openSettings: () => mockOpenSettings() },
    Modal: ({
      children,
      visible,
    }: {
      children?: React.ReactNode;
      visible?: boolean;
    }) => (visible ? <div role="dialog">{children}</div> : null),
    Platform: {
      OS: 'android',
      select: (options: Record<string, unknown>) => options.android ?? options.default,
    },
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
      testID,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void | Promise<void>;
      testID?: string;
    }) => {
      if (testID && onPress) {
        mockPressHandlers.set(testID, onPress);
      }
      return (
        <button
          aria-label={accessibilityLabel}
          data-testid={testID}
          disabled={disabled}
          onClick={onPress}
        >
          {typeof children === 'function' ? children({ pressed: false }) : children}
        </button>
      );
    },
    StyleSheet: {
      absoluteFill: { position: 'absolute' },
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  };
});

jest.mock('expo-image', () => ({
  Image: ({ source }: { source: { uri: string } }) => (
    <img alt="reference preview" src={source.uri} />
  ),
}));

jest.mock('@/lib/referenceImagePlatform', () => ({
  loadExpoCameraModule: () => mockLoadCamera(),
  loadExpoImageManipulatorModule: () => mockLoadImageManipulator(),
  loadExpoImagePickerModule: () => mockLoadImagePicker(),
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    surface: {
      border: '#333',
      raised: '#111',
      soft: '#222',
    },
    text: {
      primary: '#fff',
      secondary: '#aaa',
    },
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {},
    mode: 'dark',
    shadows: { sm: {} },
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (!params) return key;
      return `${key}:${Object.values(params).join('/')}`;
    },
  }),
}));

describe('ReferenceImagePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPressHandlers.clear();
    mockGetPendingResult.mockResolvedValue(null);
    mockGetCameraPermission.mockResolvedValue({
      canAskAgain: true,
      granted: true,
    });
    mockRequestNativeCameraPermission.mockResolvedValue({
      canAskAgain: true,
      granted: true,
    });
    mockTakePicture.mockResolvedValue({ uri: 'file://native-camera.jpg' });
    mockLoadCamera.mockResolvedValue(mockCameraModule);
    mockLoadImagePicker.mockResolvedValue(mockImagePicker);
    mockLoadImageManipulator.mockResolvedValue(mockImageManipulator);
    mockRequestCameraPermission.mockResolvedValue({
      canAskAgain: true,
      status: 'granted',
    });
    mockRequestMediaLibraryPermission.mockResolvedValue({
      canAskAgain: true,
      status: 'granted',
    });
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [],
      canceled: true,
    });
    mockLaunchCamera.mockResolvedValue({
      assets: [],
      canceled: true,
    });
    mockManipulateImage.mockImplementation(async (uri: string) => ({
      base64: 'c21hbGw=',
      uri: `${uri}.webp`,
    }));
  });

  afterEach(cleanup);

  async function openReadyNativeCamera() {
    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.take_photo' })
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByTestId('mock-camera-ready'));
    const captureButton = within(dialog).getByTestId(
      'reference-image-camera-capture'
    ) as HTMLButtonElement;
    await waitFor(() => expect(captureButton.disabled).toBe(false));
    return { captureButton, dialog };
  }

  it('offers system settings after a permanent gallery permission refusal', async () => {
    mockRequestMediaLibraryPermission.mockResolvedValue({
      canAskAgain: false,
      status: 'denied',
    });
    render(
      <ReferenceImagePicker
        subjectType="person"
        onImagesSelected={jest.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.pick_from_gallery' })
    );

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledTimes(1);
    });
    const [title, message, actions] = mockAlert.mock.calls[0];
    expect(title).toBe('reference_image.permission_title');
    expect(message).toBe('reference_image.permission_denied_permanently');
    const openSettingsAction = (actions as { text: string; onPress?: () => void }[])
      .find((action) => action.text === 'reference_image.open_settings');

    openSettingsAction?.onPress?.();
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('compresses gallery images, emits only the allowed count, and hides add at the limit', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [
        { uri: 'file://first.jpg' },
        { uri: 'file://second.jpg' },
        { uri: 'file://third.jpg' },
      ],
      canceled: false,
    });
    const onImagesSelected = jest.fn();
    render(
      <ReferenceImagePicker
        subjectType="animal"
        maxImages={2}
        onImagesSelected={onImagesSelected}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.pick_from_gallery' })
    );

    await waitFor(() => {
      expect(onImagesSelected).toHaveBeenCalledWith([
        {
          mimeType: 'image/webp',
          type: 'animal',
          uri: 'file://first.jpg.webp',
        },
        {
          mimeType: 'image/webp',
          type: 'animal',
          uri: 'file://second.jpg.webp',
        },
      ]);
    });
    expect(mockManipulateImage).toHaveBeenCalledTimes(2);
    expect(mockManipulateImage).toHaveBeenNthCalledWith(
      1,
      'file://first.jpg',
      [{ resize: { height: 512, width: 512 } }],
      { base64: true, compress: 0.7, format: 'webp' }
    );
    expect(mockManipulateImage).toHaveBeenNthCalledWith(
      2,
      'file://second.jpg',
      [{ resize: { height: 512, width: 512 } }],
      { base64: true, compress: 0.7, format: 'webp' }
    );
    expect(screen.getAllByAltText('reference preview')).toHaveLength(2);
    expect(screen.getByText('reference_image.selected_count:2/2')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'reference_image.pick_from_gallery' })
    ).toBeNull();
  });

  it('removes a selected image and emits the remaining selection', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [
        { uri: 'file://first.jpg' },
        { uri: 'file://second.jpg' },
      ],
      canceled: false,
    });
    const onImagesSelected = jest.fn();
    render(
      <ReferenceImagePicker
        subjectType="person"
        maxImages={3}
        onImagesSelected={onImagesSelected}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.pick_from_gallery' })
    );
    await waitFor(() => expect(screen.getAllByAltText('reference preview')).toHaveLength(2));

    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.remove_photo:1' })
    );

    expect(screen.getAllByAltText('reference preview')).toHaveLength(1);
    expect(onImagesSelected).toHaveBeenLastCalledWith([
      {
        mimeType: 'image/webp',
        type: 'person',
        uri: 'file://second.jpg.webp',
      },
    ]);
  });

  it('keeps the selection unchanged and explains when compression fails', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [{ uri: 'file://broken.jpg' }],
      canceled: false,
    });
    mockManipulateImage.mockRejectedValue(new Error('unsupported image'));
    const onImagesSelected = jest.fn();
    render(
      <ReferenceImagePicker
        subjectType="animal"
        onImagesSelected={onImagesSelected}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.pick_from_gallery' })
    );

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'reference_image.compression_error_title',
        'reference_image.compression_error_message'
      );
    });
    expect(onImagesSelected).not.toHaveBeenCalled();
    expect(screen.queryByAltText('reference preview')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'reference_image.pick_from_gallery' })
    ).toBeTruthy();
  });

  it('rejects a compressed image when its size payload is missing', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [{ uri: 'file://missing-size.jpg' }],
      canceled: false,
    });
    mockManipulateImage.mockResolvedValue({
      uri: 'file://missing-size.jpg.webp',
    });
    const onImagesSelected = jest.fn();

    render(
      <ReferenceImagePicker
        subjectType="person"
        onImagesSelected={onImagesSelected}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.pick_from_gallery' })
    );

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'reference_image.compression_error_title',
        'reference_image.compression_error_message'
      );
    });
    expect(onImagesSelected).not.toHaveBeenCalled();
  });

  it('recovers and compresses an Android pending picker result once', async () => {
    mockGetPendingResult.mockResolvedValue({
      assets: [{ uri: 'file://pending.jpg' }],
      canceled: false,
    });
    const onImagesSelected = jest.fn();

    render(
      <ReferenceImagePicker
        subjectType="person"
        onImagesSelected={onImagesSelected}
      />
    );

    await waitFor(() => {
      expect(onImagesSelected).toHaveBeenCalledWith([
        {
          mimeType: 'image/webp',
          type: 'person',
          uri: 'file://pending.jpg.webp',
        },
      ]);
    });
    expect(mockManipulateImage).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText('reference preview')).toBeTruthy();
  });

  it('falls back to ImagePicker camera when expo-camera is unavailable', async () => {
    mockLoadCamera.mockRejectedValue(new Error('camera module unavailable'));
    mockLaunchCamera.mockResolvedValue({
      assets: [{ uri: 'file://fallback-camera.jpg' }],
      canceled: false,
    });
    const onImagesSelected = jest.fn();

    render(
      <ReferenceImagePicker
        subjectType="animal"
        onImagesSelected={onImagesSelected}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.take_photo' })
    );

    await waitFor(() => {
      expect(onImagesSelected).toHaveBeenCalledWith([
        {
          mimeType: 'image/webp',
          type: 'animal',
          uri: 'file://fallback-camera.jpg.webp',
        },
      ]);
    });
    expect(mockRequestCameraPermission).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText('reference preview')).toBeTruthy();
  });

  it('captures with expo-camera after permission and readiness, then closes the modal', async () => {
    mockGetCameraPermission.mockResolvedValue({
      canAskAgain: true,
      granted: false,
    });
    const onImagesSelected = jest.fn();
    render(
      <ReferenceImagePicker
        subjectType="animal"
        onImagesSelected={onImagesSelected}
      />
    );

    const { captureButton, dialog } = await openReadyNativeCamera();
    expect(within(dialog).getByTestId('mock-camera-ready').getAttribute('data-facing')).toBe('back');
    expect(mockRequestNativeCameraPermission).toHaveBeenCalledTimes(1);

    fireEvent.click(captureButton);

    await waitFor(() => {
      expect(onImagesSelected).toHaveBeenCalledWith([
        {
          mimeType: 'image/webp',
          type: 'animal',
          uri: 'file://native-camera.jpg.webp',
        },
      ]);
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(mockTakePicture).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText('reference preview')).toBeTruthy();
  });

  it('reports a camera permission API failure as a technical error', async () => {
    mockGetCameraPermission.mockRejectedValue(new Error('permission service unavailable'));
    render(
      <ReferenceImagePicker
        subjectType="person"
        onImagesSelected={jest.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.take_photo' })
    );

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'common.error_title',
        'reference_image.pick_error'
      );
    });
    expect(mockRequestNativeCameraPermission).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the modal and explains when the native camera fails to mount', async () => {
    render(
      <ReferenceImagePicker
        subjectType="person"
        onImagesSelected={jest.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.take_photo' })
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByTestId('mock-camera-mount-error'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockAlert).toHaveBeenCalledWith(
      'common.error_title',
      'reference_image.pick_error'
    );
  });

  it('rejects synchronous reentry into the capture handler', async () => {
    const photo = createDeferred<{ uri: string }>();
    mockTakePicture.mockReturnValue(photo.promise);
    const onImagesSelected = jest.fn();
    render(
      <ReferenceImagePicker
        subjectType="person"
        onImagesSelected={onImagesSelected}
      />
    );

    await openReadyNativeCamera();
    const captureHandler = mockPressHandlers.get('reference-image-camera-capture');
    expect(captureHandler).toBeTruthy();
    act(() => {
      void captureHandler?.();
      void captureHandler?.();
    });
    expect(mockTakePicture).toHaveBeenCalledTimes(1);

    await act(async () => {
      photo.resolve({ uri: 'file://single-capture.jpg' });
    });
    await waitFor(() => {
      expect(onImagesSelected).toHaveBeenCalledWith([
        {
          mimeType: 'image/webp',
          type: 'person',
          uri: 'file://single-capture.jpg.webp',
        },
      ]);
    });
    expect(mockTakePicture).toHaveBeenCalledTimes(1);
  });

  it('drops a delayed capture when the camera modal is closed', async () => {
    const photo = createDeferred<{ uri: string }>();
    mockTakePicture.mockReturnValue(photo.promise);
    const onImagesSelected = jest.fn();
    render(
      <ReferenceImagePicker
        subjectType="person"
        onImagesSelected={onImagesSelected}
      />
    );

    const { captureButton, dialog } = await openReadyNativeCamera();
    fireEvent.click(captureButton);
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'common.cancel' })
    );

    await act(async () => {
      photo.resolve({ uri: 'file://closed-camera.jpg' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onImagesSelected).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('drops a delayed capture when the picker becomes inactive', async () => {
    const photo = createDeferred<{ uri: string }>();
    mockTakePicture.mockReturnValue(photo.promise);
    const onImagesSelected = jest.fn();
    const { rerender } = render(
      <ReferenceImagePicker
        active
        subjectType="person"
        onImagesSelected={onImagesSelected}
      />
    );

    const { captureButton } = await openReadyNativeCamera();
    fireEvent.click(captureButton);
    rerender(
      <ReferenceImagePicker
        active={false}
        subjectType="person"
        onImagesSelected={onImagesSelected}
      />
    );

    await act(async () => {
      photo.resolve({ uri: 'file://inactive-camera.jpg' });
    });
    expect(onImagesSelected).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('drops a delayed capture after unmount', async () => {
    const photo = createDeferred<{ uri: string }>();
    mockTakePicture.mockReturnValue(photo.promise);
    const onImagesSelected = jest.fn();
    const view = render(
      <ReferenceImagePicker
        subjectType="person"
        onImagesSelected={onImagesSelected}
      />
    );

    const { captureButton } = await openReadyNativeCamera();
    fireEvent.click(captureButton);
    view.unmount();

    await act(async () => {
      photo.resolve({ uri: 'file://unmounted-camera.jpg' });
    });
    expect(onImagesSelected).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('coalesces two camera openings while the module is loading', async () => {
    const cameraModule = createDeferred<typeof mockCameraModule>();
    mockLoadCamera.mockReturnValue(cameraModule.promise);
    render(
      <ReferenceImagePicker
        subjectType="person"
        onImagesSelected={jest.fn()}
      />
    );
    const openCameraButton = screen.getByRole('button', {
      name: 'reference_image.take_photo',
    });

    act(() => {
      openCameraButton.click();
      openCameraButton.click();
    });
    expect(mockLoadCamera).toHaveBeenCalledTimes(1);

    await act(async () => {
      cameraModule.resolve(mockCameraModule);
    });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  });

  it('does not resurrect a removed image when a later compression completes', async () => {
    mockLaunchImageLibrary.mockResolvedValueOnce({
      assets: [{ uri: 'file://first.jpg' }],
      canceled: false,
    });
    const onImagesSelected = jest.fn();
    render(
      <ReferenceImagePicker
        subjectType="person"
        maxImages={3}
        onImagesSelected={onImagesSelected}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.pick_from_gallery' })
    );
    await waitFor(() => expect(screen.getByAltText('reference preview')).toBeTruthy());

    const secondCompression = createDeferred<{
      base64: string;
      uri: string;
    }>();
    mockLaunchImageLibrary.mockResolvedValueOnce({
      assets: [{ uri: 'file://second.jpg' }],
      canceled: false,
    });
    mockManipulateImage.mockReturnValueOnce(secondCompression.promise);
    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.pick_from_gallery' })
    );
    await waitFor(() => expect(mockManipulateImage).toHaveBeenCalledTimes(2));

    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.remove_photo:1' })
    );
    secondCompression.resolve({
      base64: 'c21hbGw=',
      uri: 'file://second.jpg.webp',
    });

    await waitFor(() => {
      expect(onImagesSelected).toHaveBeenLastCalledWith([
        {
          mimeType: 'image/webp',
          type: 'person',
          uri: 'file://second.jpg.webp',
        },
      ]);
    });
    expect(screen.getAllByAltText('reference preview')).toHaveLength(1);
  });
});
