import { vi } from 'vitest';

// Silence missing native driver warnings in tests.
vi.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

process.env.EXPO_PUBLIC_MOCK_MODE = process.env.EXPO_PUBLIC_MOCK_MODE ?? 'false';
