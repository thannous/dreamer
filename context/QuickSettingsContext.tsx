import { createContext, useContext } from 'react';
import { router } from 'expo-router';

export const QuickSettingsContext = createContext<() => void>(() => router.push('/settings'));
export const useQuickSettings = () => useContext(QuickSettingsContext);
