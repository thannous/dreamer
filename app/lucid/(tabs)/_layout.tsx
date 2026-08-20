import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useMemo, type ComponentProps } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { LucidGlass } from '@/components/lucid/LucidGlass';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Le libellé d'onglet suit l'agrandissement système, mais pas au-delà de 1,2 :
// la barre est le seul élément permanent de l'interface, elle ne peut pas doubler
// de hauteur parce qu'un réglage le demande. Le même plafond borne le texte et
// la barre qui le porte, sinon l'un des deux déborde de l'autre.
const TAB_LABEL_MAX_FONT_SCALE = 1.2;
// Plafond de hauteur. Les écrans réservent `Math.max(insets.bottom, 20) + 92`
// sous leur contenu, la barre occupe `Math.max(insets.bottom, 10) + hauteur` :
// la collision se produirait à 92, on s'arrête à 84 pour garder une marge.
const TAB_BAR_MAX_HEIGHT = 84;

export default function LucidTabsLayout() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { content } = useLucidTrainer();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const labels = content.chrome.tabs;
  const compact = width < 370;
  // Hauteur de barre. Deux principes : iOS pose ses onglets plus haut qu'Android
  // (49pt + libellé contre 56dp Material), et la hauteur suit le fontScale —
  // figée à 70, elle rognait le libellé dès le premier cran d'agrandissement.
  // La barre grandit exactement autant que le texte qu'elle porte, jamais plus.
  const tabBarHeight = Math.min(
    Math.round((Platform.OS === 'ios' ? (compact ? 64 : 70) : compact ? 60 : 66) * Math.min(fontScale, TAB_LABEL_MAX_FONT_SCALE)),
    TAB_BAR_MAX_HEIGHT
  );

  // Expo Router applies each Screen's options in an effect. Keep the option
  // objects stable so applying them cannot trigger a setOptions/render loop.
  const tabOptions = useMemo(() => {
    const screen = (title: string, icon: IconName, testID: string) => ({
      title,
      tabBarButton: (props: ComponentProps<typeof HapticTab>) => (
        <HapticTab {...props} testID={testID} accessibilityLabel={title} />
      ),
      // L'icône reste seule dans son emplacement : c'est le navigateur qui empile
      // le libellé dessous, lui seul connaît la hauteur disponible.
      tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
        <Ionicons name={focused ? icon : (`${icon}-outline` as IconName)} size={22} color={color} />
      ),
      // Le libellé est repris au navigateur pour une raison : il le rend sans
      // plafond d'agrandissement. À 360 dp un onglet mesure 65px, où « Einstellungen »
      // tient déjà au pixel près ; à 200 % de taille système il pousserait la barre
      // hors de l'écran. `maxFontSizeMultiplier` borne le texte, `flexShrink` le
      // laisse céder dans son emplacement au lieu d'élargir la barre.
      tabBarLabel: ({ color }: { color: ColorValue }) => (
        <Text numberOfLines={1} maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE} style={[styles.tabLabel, { color }]}>{title}</Text>
      ),
    });

    return {
      today: screen(labels.today, 'sparkles', 'lucid-tab-today'),
      programs: screen(labels.programs, 'map', 'lucid-tab-programs'),
      night: screen(labels.night, 'moon', 'lucid-tab-night'),
      progress: screen(labels.progress, 'stats-chart', 'lucid-tab-progress'),
      settings: screen(labels.settings, 'settings', 'lucid-tab-settings'),
    };
  }, [labels.night, labels.programs, labels.progress, labels.settings, labels.today]);

  const navigatorOptions = useMemo(
    () => ({
      headerShown: false,
      sceneStyle: { backgroundColor: palette.background },
      tabBarShowLabel: true,
      tabBarActiveTintColor: palette.accentStrong,
      tabBarInactiveTintColor: palette.textMuted,
      tabBarHideOnKeyboard: true,
      tabBarButton: HapticTab,
      // La barre flottait déjà au-dessus du contenu avec un overlay à 0,86 :
      // c'était du verre qui s'ignorait. `tabBarBackground` le rend explicite,
      // avec flou sur iOS et l'overlay seul partout ailleurs.
      tabBarBackground: () => <LucidGlass pointerEvents="none" radius={24} style={StyleSheet.absoluteFill as never} />,
      tabBarItemStyle: styles.tabBarItem,
      tabBarStyle: {
        position: 'absolute' as const,
        left: width > 760 ? (width - 720) / 2 : 12,
        right: width > 760 ? (width - 720) / 2 : 12,
        bottom: Math.max(insets.bottom, 10),
        height: tabBarHeight,
        paddingTop: 7,
        paddingBottom: 6,
        paddingHorizontal: 4,
        backgroundColor: 'transparent',
        borderTopColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 24,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: mode === 'dark' ? 0.38 : 0.12,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        ...(Platform.OS === 'web' ? { maxWidth: 720, alignSelf: 'center' as const } : {}),
      },
    }),
    [
      insets.bottom,
      mode,
      palette.accentStrong,
      palette.background,
      palette.textMuted,
      tabBarHeight,
      width,
    ]
  );

  return (
    <Tabs screenOptions={navigatorOptions}>
      <Tabs.Screen name="index" options={tabOptions.today} />
      <Tabs.Screen name="programs" options={tabOptions.programs} />
      <Tabs.Screen name="night" options={tabOptions.night} />
      <Tabs.Screen name="progress" options={tabOptions.progress} />
      <Tabs.Screen name="settings" options={tabOptions.settings} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Un onglet cède de la largeur à ses voisins au lieu d'élargir la barre : aucune
  // largeur figée ici, les cinq emplacements se partagent la place disponible.
  tabBarItem: { height: '100%', flexShrink: 1 },
  // Palier « overline » : 11/14. En dessous (10pt) le libellé passait sous les 11pt
  // des HIG et les 12sp de Material, sur l'élément le plus permanent de l'app.
  tabLabel: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 11, lineHeight: 14, textAlign: 'center', flexShrink: 1 },
});
