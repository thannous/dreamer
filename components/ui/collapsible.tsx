import { PropsWithChildren, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { colors, mode } = useTheme();
  const noctalia = getNoctaliaDesignTokens(colors, mode);

  return (
    <ThemedView
      className="border-b-line py-2.5"
      // `hairlineWidth` is device-dependent (1 / PixelRatio); no class can express it.
      style={{ borderBottomWidth: StyleSheet.hairlineWidth }}
    >
      <TouchableOpacity
        className="flex-row items-center gap-1.5"
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: isOpen }}
      >
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          color={noctalia.text.secondary}
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        />

        <ThemedText type="defaultSemiBold" className="text-ivory">
          {title}
        </ThemedText>
      </TouchableOpacity>
      {isOpen && <ThemedView className="mt-2.5 ml-6">{children}</ThemedView>}
    </ThemedView>
  );
}
