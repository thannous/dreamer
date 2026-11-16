import { describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native-reanimated', () => ({}));
jest.mock('react-native-worklets', () => ({}));
jest.mock('@/components/motion', () => ({ DURATION: {}, EASING: {} }));
jest.mock('@/constants/noctaliaDesign', () => ({}));
jest.mock('@/context/ThemeContext', () => ({}));
jest.mock('react-native', () => ({ Text: () => null }));

const { readableToastDuration } = require('../Toast');

describe('readableToastDuration', () => {
  it('keeps short confirmations brief and gives long messages time to be read', () => {
    expect(readableToastDuration('Achats restaurés.')).toBe(2520);
    const nothingToRestore = 'Aucun abonnement actif retrouvé. Vérifie que tu utilises le compte associé à ton achat.';
    expect(readableToastDuration(nothingToRestore)).toBeGreaterThanOrEqual(6000);
    expect(readableToastDuration('OK')).toBe(2200);
    expect(readableToastDuration('x'.repeat(500))).toBe(8000);
  });
});
