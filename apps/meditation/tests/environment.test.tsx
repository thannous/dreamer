import '@/global.css';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';
import { Uniwind, useUniwind } from 'uniwind';

import { StorageKey } from '@/services/storageService';

/**
 * The harness itself: component tests lean on these three guarantees, so they
 * are asserted rather than assumed.
 */
describe('test environment', () => {
  it('renders `className` without the Metro-compiled stylesheet', () => {
    render(
      <View className="flex-1 items-center">
        <Text className="text-body">Bonsoir</Text>
      </View>
    );

    expect(screen.getByText('Bonsoir')).toBeTruthy();
  });

  it('resolves `uniwind` to the stub, so the theme can be driven', () => {
    const Probe = () => <Text>{useUniwind().theme}</Text>;

    Uniwind.setTheme('dark');
    render(<Probe />);

    expect(screen.getByText('dark')).toBeTruthy();
    Uniwind.setTheme('light');
  });

  it('starts each test from an empty store', async () => {
    await expect(AsyncStorage.getAllKeys()).resolves.toEqual([]);
    await AsyncStorage.setItem(StorageKey.onboarding, '{}');
  });

  it('does not inherit the store written by the previous test', async () => {
    await expect(AsyncStorage.getAllKeys()).resolves.toEqual([]);
  });
});
