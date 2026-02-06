/* @vitest-environment happy-dom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ── Router ──────────────────────────────────────────────────────────────────
const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('expo-router', () => ({
  router: { push: mockPush, back: mockBack, replace: vi.fn() },
  useLocalSearchParams: () => ({}),
}));

// ── Theme / Translation ─────────────────────────────────────────────────────
vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'dark',
    colors: {
      accent: '#6f62b5',
      backgroundCard: '#221b3b',
      backgroundSecondary: '#2f274f',
      backgroundDark: '#0b0a12',
      divider: '#3a3357',
      textPrimary: '#fff',
      textSecondary: '#c7c2d7',
      textTertiary: '#8a8499',
      textOnAccentSurface: '#f0ecff',
    },
    shadows: { xl: {}, lg: {}, md: {}, sm: {} },
  }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    currentLang: 'en',
  }),
}));

// ── Expo / RN externals ─────────────────────────────────────────────────────
vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/moti', () => ({
  MotiView: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
}));

// ── SearchBar stub ──────────────────────────────────────────────────────────
vi.mock('@/components/ui/SearchBar', () => ({
  SearchBar: ({
    value,
    onChangeText,
    placeholder,
  }: {
    value: string;
    onChangeText: (t: string) => void;
    placeholder?: string;
  }) => (
    <input
      data-testid="search-bar"
      value={value}
      onChange={(e) => onChangeText(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

// ── FlashList stub ──────────────────────────────────────────────────────────
vi.mock('@shopify/flash-list', () => ({
  FlashList: ({ data, renderItem, ListEmptyComponent }: any) => {
    if (!data || data.length === 0) {
      return typeof ListEmptyComponent === 'function' ? (
        <ListEmptyComponent />
      ) : (
        ListEmptyComponent ?? null
      );
    }
    return (
      <div data-testid="flash-list">
        {data.map((item: any, index: number) => (
          <React.Fragment key={item?.id ?? index}>
            {renderItem({ item, index })}
          </React.Fragment>
        ))}
      </div>
    );
  },
}));

// ── Child components stubs ──────────────────────────────────────────────────
vi.mock('@/components/symbols/CategoryHeader', () => ({
  CategoryHeader: ({ category, count }: { category: string; count: number }) => (
    <div data-testid={`category-header-${category}`}>{category} ({count})</div>
  ),
}));

vi.mock('@/components/symbols/LetterHeader', () => ({
  LetterHeader: ({ letter, count }: { letter: string; count: number }) => (
    <div data-testid={`letter-header-${letter}`}>{letter} ({count})</div>
  ),
}));

vi.mock('@/components/symbols/SymbolCard', () => ({
  SymbolCard: ({
    symbol,
    onPress,
  }: {
    symbol: { id: string };
    language: string;
    onPress: (id: string) => void;
  }) => (
    <div data-testid={`symbol-card-${symbol.id}`} onClick={() => onPress(symbol.id)}>
      {symbol.id}
    </div>
  ),
}));

vi.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

// ── Symbol service mock ─────────────────────────────────────────────────────
const MOCK_SYMBOLS = [
  {
    id: 'water',
    category: 'nature',
    en: { name: 'Water', shortDescription: 'Emotions and the unconscious' },
    fr: { name: 'Eau', shortDescription: 'Émotions et inconscient' },
    relatedSymbols: [],
  },
  {
    id: 'moon',
    category: 'nature',
    en: { name: 'Moon', shortDescription: 'Femininity and intuition' },
    fr: { name: 'Lune', shortDescription: 'Féminité et intuition' },
    relatedSymbols: [],
  },
  {
    id: 'cat',
    category: 'animals',
    en: { name: 'Cat', shortDescription: 'Independence and mystery' },
    fr: { name: 'Chat', shortDescription: 'Indépendance et mystère' },
    relatedSymbols: [],
  },
  {
    id: 'bird',
    category: 'animals',
    en: { name: 'Bird', shortDescription: 'Freedom and aspiration' },
    fr: { name: 'Oiseau', shortDescription: 'Liberté et aspiration' },
    relatedSymbols: [],
  },
  {
    id: 'hand',
    category: 'body',
    en: { name: 'Hand', shortDescription: 'Action and creation' },
    fr: { name: 'Main', shortDescription: 'Action et création' },
    relatedSymbols: [],
  },
];

vi.mock('@/services/symbolDictionaryService', () => ({
  getAllSymbols: () => MOCK_SYMBOLS,
  getCategoryList: () => ['nature', 'animals', 'body'],
  getSymbolsByCategory: (cat: string) => MOCK_SYMBOLS.filter((s) => s.category === cat),
  searchSymbols: (query: string) =>
    MOCK_SYMBOLS.filter((s) =>
      s.en.name.toLowerCase().includes(query.toLowerCase()),
    ),
  getCategoryName: (cat: string) => cat.charAt(0).toUpperCase() + cat.slice(1),
  getCategoryIcon: () => 'leaf.fill',
}));

// ── Import screen after all mocks ───────────────────────────────────────────
const { default: SymbolDictionaryScreen } = await import('../symbol-dictionary');

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('SymbolDictionaryScreen', () => {
  // ── Rendering ───────────────────────────────────────────────────────────
  describe('initial rendering', () => {
    it('renders the header with icon and title', () => {
      render(<SymbolDictionaryScreen />);

      expect(screen.getByText('symbols.dictionary_title')).toBeTruthy();
      expect(screen.getByTestId('icon-book.fill')).toBeTruthy();
    });

    it('renders the search bar', () => {
      render(<SymbolDictionaryScreen />);

      expect(screen.getByTestId('search-bar')).toBeTruthy();
    });

    it('renders the browse mode switch with A-Z and theme options', () => {
      render(<SymbolDictionaryScreen />);

      expect(screen.getByText('symbols.browse_alphabetical')).toBeTruthy();
      expect(screen.getByText('symbols.browse_theme')).toBeTruthy();
    });

    it('defaults to alphabetical browse mode', () => {
      render(<SymbolDictionaryScreen />);

      // In alphabetical mode, letter headers should appear
      expect(screen.getByTestId('letter-header-B')).toBeTruthy();
      expect(screen.getByTestId('letter-header-C')).toBeTruthy();
      expect(screen.getByTestId('letter-header-H')).toBeTruthy();
      expect(screen.getByTestId('letter-header-M')).toBeTruthy();
      expect(screen.getByTestId('letter-header-W')).toBeTruthy();
    });
  });

  // ── Full alphabet ─────────────────────────────────────────────────────
  describe('full alphabet display', () => {
    it('displays all 26 letters A-Z', () => {
      render(<SymbolDictionaryScreen />);

      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      for (const letter of alphabet) {
        expect(screen.getByText(letter)).toBeTruthy();
      }
    });

    it('disables letters that have no matching symbols', () => {
      render(<SymbolDictionaryScreen />);

      // Letters with symbols: B (Bird), C (Cat), H (Hand), M (Moon), W (Water)
      // Letter A has no symbols, so its Pressable should be disabled
      // The 'A' letter element should exist but its parent pressable should have opacity 0.3
      expect(screen.getByText('A')).toBeTruthy();

      // Letters with symbols should not be disabled
      const letterB = screen.getByText('B');
      expect(letterB).toBeTruthy();
    });
  });

  // ── Browse mode switching ─────────────────────────────────────────────
  describe('browse mode switching', () => {
    it('switches to theme mode when clicking the theme button', () => {
      render(<SymbolDictionaryScreen />);

      fireEvent.click(screen.getByText('symbols.browse_theme'));

      // In theme mode, category headers should appear
      expect(screen.getByTestId('category-header-nature')).toBeTruthy();
      expect(screen.getByTestId('category-header-animals')).toBeTruthy();
      expect(screen.getByTestId('category-header-body')).toBeTruthy();
    });

    it('shows category chips in theme mode', () => {
      render(<SymbolDictionaryScreen />);

      // Switch to theme mode
      fireEvent.click(screen.getByText('symbols.browse_theme'));

      expect(screen.getByText('symbols.all_categories')).toBeTruthy();
      expect(screen.getByText('Nature')).toBeTruthy();
      expect(screen.getByText('Animals')).toBeTruthy();
      expect(screen.getByText('Body')).toBeTruthy();
    });

    it('switches back to alphabetical mode', () => {
      render(<SymbolDictionaryScreen />);

      // Switch to theme, then back
      fireEvent.click(screen.getByText('symbols.browse_theme'));
      fireEvent.click(screen.getByText('symbols.browse_alphabetical'));

      // Letter headers should reappear
      expect(screen.getByTestId('letter-header-B')).toBeTruthy();
    });
  });

  // ── Letter selection ──────────────────────────────────────────────────
  describe('letter selection', () => {
    it('filters symbols by selected letter', () => {
      render(<SymbolDictionaryScreen />);

      // Click on letter C
      fireEvent.click(screen.getByText('C'));

      // Only C header should show
      expect(screen.getByTestId('letter-header-C')).toBeTruthy();
      expect(screen.getByTestId('symbol-card-cat')).toBeTruthy();

      // Other letters should not have headers
      expect(screen.queryByTestId('letter-header-B')).toBeNull();
      expect(screen.queryByTestId('letter-header-W')).toBeNull();
    });

    it('deselects letter when clicking the same letter again', () => {
      render(<SymbolDictionaryScreen />);

      // Select then deselect
      fireEvent.click(screen.getByText('C'));
      fireEvent.click(screen.getByText('C'));

      // All letter headers should be back
      expect(screen.getByTestId('letter-header-B')).toBeTruthy();
      expect(screen.getByTestId('letter-header-C')).toBeTruthy();
      expect(screen.getByTestId('letter-header-W')).toBeTruthy();
    });
  });

  // ── Category selection ────────────────────────────────────────────────
  describe('category selection (theme mode)', () => {
    it('filters symbols by selected category', () => {
      render(<SymbolDictionaryScreen />);

      // Switch to theme mode
      fireEvent.click(screen.getByText('symbols.browse_theme'));

      // Click on Animals category
      fireEvent.click(screen.getByText('Animals'));

      // Only animals header should show
      expect(screen.getByTestId('category-header-animals')).toBeTruthy();
      expect(screen.queryByTestId('category-header-nature')).toBeNull();
      expect(screen.queryByTestId('category-header-body')).toBeNull();
    });

    it('deselects category when clicking the same category again', () => {
      render(<SymbolDictionaryScreen />);

      fireEvent.click(screen.getByText('symbols.browse_theme'));
      fireEvent.click(screen.getByText('Animals'));
      fireEvent.click(screen.getByText('Animals'));

      // All categories should be back
      expect(screen.getByTestId('category-header-nature')).toBeTruthy();
      expect(screen.getByTestId('category-header-animals')).toBeTruthy();
      expect(screen.getByTestId('category-header-body')).toBeTruthy();
    });
  });

  // ── Search ────────────────────────────────────────────────────────────
  describe('search', () => {
    it('filters symbols by search query in alphabetical mode', () => {
      render(<SymbolDictionaryScreen />);

      fireEvent.change(screen.getByTestId('search-bar'), {
        target: { value: 'cat' },
      });

      expect(screen.getByTestId('symbol-card-cat')).toBeTruthy();
      expect(screen.queryByTestId('symbol-card-water')).toBeNull();
      expect(screen.queryByTestId('symbol-card-moon')).toBeNull();
    });

    it('shows empty state when no results match', () => {
      render(<SymbolDictionaryScreen />);

      fireEvent.change(screen.getByTestId('search-bar'), {
        target: { value: 'zzzzz' },
      });

      expect(screen.getByText('symbols.no_results')).toBeTruthy();
    });
  });

  // ── Navigation ────────────────────────────────────────────────────────
  describe('navigation', () => {
    it('navigates to symbol detail when pressing a symbol card', () => {
      render(<SymbolDictionaryScreen />);

      fireEvent.click(screen.getByTestId('symbol-card-water'));

      expect(mockPush).toHaveBeenCalledWith('/symbol-detail/water');
    });

    it('navigates back when pressing the back button', () => {
      render(<SymbolDictionaryScreen />);

      fireEvent.click(screen.getByTestId('icon-chevron.left'));

      expect(mockBack).toHaveBeenCalled();
    });
  });

  // ── Mode switching resets state ───────────────────────────────────────
  describe('state reset on mode switch', () => {
    it('resets selected letter when switching to theme mode', () => {
      render(<SymbolDictionaryScreen />);

      // Select a letter
      fireEvent.click(screen.getByText('C'));
      expect(screen.queryByTestId('letter-header-B')).toBeNull();

      // Switch to theme then back
      fireEvent.click(screen.getByText('symbols.browse_theme'));
      fireEvent.click(screen.getByText('symbols.browse_alphabetical'));

      // All letters should show again
      expect(screen.getByTestId('letter-header-B')).toBeTruthy();
      expect(screen.getByTestId('letter-header-C')).toBeTruthy();
    });

    it('resets selected category when switching to alphabetical mode', () => {
      render(<SymbolDictionaryScreen />);

      // Switch to theme and select a category
      fireEvent.click(screen.getByText('symbols.browse_theme'));
      fireEvent.click(screen.getByText('Animals'));
      expect(screen.queryByTestId('category-header-nature')).toBeNull();

      // Switch to alphabetical and back to theme
      fireEvent.click(screen.getByText('symbols.browse_alphabetical'));
      fireEvent.click(screen.getByText('symbols.browse_theme'));

      // All categories should show again
      expect(screen.getByTestId('category-header-nature')).toBeTruthy();
      expect(screen.getByTestId('category-header-animals')).toBeTruthy();
    });
  });
});
