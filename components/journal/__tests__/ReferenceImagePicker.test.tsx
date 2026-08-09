/* @jest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const mockLoadImagePicker = jest.fn();
const mockLoadImageManipulator = jest.fn();

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
    mockGetPendingResult.mockResolvedValue(null);
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

  it('captures with the ImagePicker system camera and compresses the result', async () => {
    mockLaunchCamera.mockResolvedValue({
      assets: [{ uri: 'file://system-camera.jpg' }],
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
          uri: 'file://system-camera.jpg.webp',
        },
      ]);
    });
    expect(mockRequestCameraPermission).toHaveBeenCalledTimes(1);
    expect(mockLaunchCamera).toHaveBeenCalledWith({
      allowsEditing: false,
      cameraType: 'back',
      quality: 0.9,
    });
    expect(screen.getByAltText('reference preview')).toBeTruthy();
  });

  it('offers system settings after a permanent camera permission refusal', async () => {
    mockRequestCameraPermission.mockResolvedValue({
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
      screen.getByRole('button', { name: 'reference_image.take_photo' })
    );

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledTimes(1);
    });
    const [title, message, actions] = mockAlert.mock.calls[0];
    expect(title).toBe('reference_image.camera_permission_title');
    expect(message).toBe('reference_image.permission_denied_permanently');
    const openSettingsAction = (actions as { text: string; onPress?: () => void }[])
      .find((action) => action.text === 'reference_image.open_settings');

    openSettingsAction?.onPress?.();
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
    expect(mockLaunchCamera).not.toHaveBeenCalled();
  });

  it('reports a camera permission API failure as a technical error', async () => {
    mockRequestCameraPermission.mockRejectedValue(new Error('permission service unavailable'));
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
    expect(mockLaunchCamera).not.toHaveBeenCalled();
  });

  it('coalesces two camera openings while permission is pending', async () => {
    const permission = createDeferred<{ canAskAgain: boolean; status: string }>();
    mockRequestCameraPermission.mockReturnValue(permission.promise);
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
    await waitFor(() => expect(mockRequestCameraPermission).toHaveBeenCalledTimes(1));

    await act(async () => {
      permission.resolve({ canAskAgain: true, status: 'granted' });
    });
    await waitFor(() => expect(mockLaunchCamera).toHaveBeenCalledTimes(1));
  });

  it('drops a delayed capture when the picker becomes inactive', async () => {
    const photo = createDeferred<{
      assets: { uri: string }[];
      canceled: boolean;
    }>();
    mockLaunchCamera.mockReturnValue(photo.promise);
    const onImagesSelected = jest.fn();
    const { rerender } = render(
      <ReferenceImagePicker
        active
        subjectType="person"
        onImagesSelected={onImagesSelected}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'reference_image.take_photo' })
    );
    await waitFor(() => expect(mockLaunchCamera).toHaveBeenCalledTimes(1));
    rerender(
      <ReferenceImagePicker
        active={false}
        subjectType="person"
        onImagesSelected={onImagesSelected}
      />
    );

    await act(async () => {
      photo.resolve({
        assets: [{ uri: 'file://inactive-camera.jpg' }],
        canceled: false,
      });
    });
    expect(onImagesSelected).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
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
