import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useClearWebFocus } from '@/hooks/useClearWebFocus';
import { Link } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ModalScreen() {
  useClearWebFocus();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  return (
    <View style={[styles.screen, { backgroundColor: noctalia.screen.background }]}>
      <AtmosphericBackground />
      <View
        style={[
          styles.card,
          {
            backgroundColor: noctalia.surface.raised,
            borderColor: noctalia.surface.borderStrong,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: noctalia.surface.soft }]}>
          <IconSymbol name="sparkles" size={24} color={noctalia.accent.base} />
        </View>
        <Text style={[styles.title, { color: noctalia.text.primary }]}>
          Noctalia
        </Text>
        <Text style={[styles.body, { color: noctalia.text.secondary }]}>
          Reviens à ton espace pour continuer l’exploration de tes rêves.
        </Text>
        <Link
          href="/"
          dismissTo
          style={[
            styles.link,
            {
              backgroundColor: noctalia.action.primary,
              color: noctalia.action.primaryText,
              borderColor: noctalia.action.primaryBorder,
            },
          ]}
        >
          Retour à l’accueil
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  iconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  title: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 30,
    lineHeight: 36,
  },
  body: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
    textAlign: 'center',
  },
  link: {
    borderRadius: 18,
    borderWidth: 1,
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 16,
    marginTop: 8,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingVertical: 13,
    textAlign: 'center',
  },
});
