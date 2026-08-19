import { BlurView } from 'expo-blur';
import React, { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { getLucidPalette } from '@/constants/lucidTheme';
import { useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/**
 * Surface de verre du Lucid Trainer.
 *
 * Même matériau que `components/inspiration/GlassCard.tsx` côté Noctalia — c'est
 * ce qui fait la parenté entre les deux apps — mais teinté par la palette jade.
 *
 * Trois règles, dans cet ordre :
 *
 * 1. L'OPACITÉ EST LE VRAI DESIGN, LE FLOU EST LE BONUS. `BlurView` ne floute
 *    que sur iOS ; Lucid est publié Android d'abord. La surface doit donc être
 *    complète et lisible sans flou, exactement comme GlassCard le fait déjà.
 * 2. JAMAIS SOUS DU TEXTE DE CONTENU. Une surface translucide pose son texte sur
 *    un fond variable : le même libellé passe de 6:1 à 2:1 selon ce qui défile
 *    dessous. Le verre est un matériau de chrome — barres, pastilles, éléments
 *    qui flottent — pas un matériau de carte.
 * 3. IL S'EFFACE QUAND ON LE DEMANDE. `prefersReducedMotion` coupe le flou et
 *    rend la surface opaque.
 *
 * Le filet supérieur clair n'est pas décoratif : c'est lui qui donne au panneau
 * son épaisseur, et c'est la seule chose qui distingue du verre d'un aplat.
 */
export function LucidGlass({
  children,
  style,
  radius = 24,
  pointerEvents,
  testID,
}: {
  children?: ReactNode;
  style?: ViewStyle;
  radius?: number;
  pointerEvents?: 'auto' | 'none' | 'box-none';
  testID?: string;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const reduceEffects = usePrefersReducedMotion();
  const shouldBlur = Platform.OS === 'ios' && !reduceEffects;

  return (
    <View
      pointerEvents={pointerEvents}
      testID={testID}
      style={[
        styles.root,
        {
          borderRadius: radius,
          // Sans flou — Android, web, reduce motion — l'overlay porte seul la
          // surface. Avec flou il reste, mais laisse passer ce qu'il floute.
          backgroundColor: shouldBlur ? 'transparent' : palette.overlay,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      {shouldBlur ? (
        <BlurView
          intensity={mode === 'dark' ? 28 : 18}
          tint={mode === 'dark' ? 'dark' : 'light'}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {/* Teinte de la palette par-dessus le flou : le verre prend la couleur du
          module au lieu du gris neutre que rend un blur seul. */}
      {shouldBlur ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: palette.overlay, opacity: 0.55 }]} />
      ) : null}
      {/* Le filet de lumière du haut donne l'épaisseur. */}
      <View
        pointerEvents="none"
        style={[
          styles.sheen,
          { backgroundColor: mode === 'dark' ? 'rgba(232, 242, 241, 0.10)' : 'rgba(255, 255, 255, 0.65)' },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
});
