import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ProgressiveSilence } from '@/components/atmosphere/ProgressiveSilence';
import { Screen } from '@/components/atmosphere/Screen';
import { Button, Card, Chip, GlassCard, Rule, Sheet, Text } from '@/components/ui';
import type { ThemePreference } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

const PREFERENCES: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'auto', label: 'Auto' },
];

const DURATIONS = ['5 min', '10 min', '15 min', '20 min'];

/**
 * Design-foundations reference: renders every foundation piece so light/dark
 * parity, the token wiring and the breath can be judged at a glance.
 *
 * Not part of the product flow — reachable only from the L1 placeholder home,
 * and removed in L8. Nothing here is production UI.
 */
export default function FoundationsScreen() {
  const { mode, preference, setPreference } = useTheme();
  const [duration, setDuration] = useState('10 min');
  const [silence, setSilence] = useState(true);

  return (
    <Screen variant="immersive">
      <ScrollView
        contentContainerClassName="px-gutter pb-16 pt-4 gap-8"
        showsVerticalScrollIndicator={false}>
        <View className="gap-2">
          <Text variant="overline">Noctalia Meditation</Text>
          <Text variant="display">Le calme avant{'\n'}la nuit</Text>
          <Text variant="bodySm">
            Lot L0 — fondations. Thème actif : {mode === 'dark' ? 'nuit' : 'papier'}.
            {'\n'}Le halo et le filet doré respirent à 5,5 s — inspiration, expiration.
          </Text>
        </View>

        <View className="gap-3">
          <Text variant="h2">Thème</Text>
          <Rule className="self-start" />
          <View className="flex-row gap-2">
            {PREFERENCES.map((item) => (
              <Chip
                key={item.value}
                label={item.label}
                selected={preference === item.value}
                onPress={() => setPreference(item.value)}
              />
            ))}
          </View>
        </View>

        <GlassCard featured>
          <Text variant="overline">Pratique du jour</Text>
          <Text variant="h1" className="mt-2">
            Descendre le souffle
          </Text>
          <Text variant="bodySm" className="mt-2">
            10 min · Camille · Sommeil
          </Text>
          <Text variant="quote" className="mt-4">
            « On ne force pas le sommeil, on lui laisse la place. »
          </Text>
          <Button label="Commencer" className="mt-6" />
        </GlassCard>

        <View className="gap-3">
          <Text variant="h2">Durée</Text>
          <View className="flex-row flex-wrap gap-2">
            {DURATIONS.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={duration === item}
                onPress={() => setDuration(item)}
              />
            ))}
          </View>
        </View>

        <View className="gap-3">
          <Text variant="h2">Échelle typographique</Text>
          <Card>
            <Text variant="display">Display · Fraunces</Text>
            <Text variant="h1" className="mt-2">
              H1 · Fraunces
            </Text>
            <Text variant="h2" className="mt-2">
              H2 · Fraunces
            </Text>
            <Text variant="h3" className="mt-2">
              H3 · Space Grotesk Medium
            </Text>
            <Text variant="body" className="mt-2">
              Body · Space Grotesk, le texte courant de l&apos;interface.
            </Text>
            <Text variant="bodySm" className="mt-2">
              Body small · texte secondaire.
            </Text>
            <Text variant="caption" className="mt-2">
              Caption · métadonnées.
            </Text>
            <Text variant="quote" className="mt-3">
              Quote · Lora italique.
            </Text>
          </Card>
        </View>

        <View className="gap-3">
          <Text variant="h2">Boutons</Text>
          <Button label="Primaire" />
          <Button label="Secondaire" variant="secondary" />
          <Button label="Discret" variant="ghost" />
          <Button label="Chargement" loading />
          <Button label="Désactivé" disabled />
        </View>

        <View className="gap-3">
          <Text variant="h2">Surfaces</Text>
          <Card>
            <Text variant="h3">Card</Text>
            <Text variant="bodySm" className="mt-1">
              Surface opaque, bordure hairline.
            </Text>
          </Card>
          <Card>
            <Text variant="h3">Card, partout ailleurs</Text>
            <Text variant="bodySm" className="mt-1">
              Le verre est une texture d&apos;appui : une surface héros par écran,
              jamais dans une liste qui défile.
            </Text>
          </Card>
        </View>

        <View className="gap-3">
          <Text variant="h2">Silence progressif</Text>
          <Rule className="self-start" />
          <Text variant="bodySm">
            Pendant une séance, les commandes s&apos;effacent après quelques
            secondes sans geste. Un toucher les rappelle.
          </Text>
          <Card>
            <ProgressiveSilence active={silence} delayMs={4000}>
              <View className="gap-2">
                <Text variant="overline">Commandes</Text>
                <Text variant="h3">Ceci s&apos;efface tout seul</Text>
                <Text variant="bodySm">
                  Touchez la carte pour les faire revenir.
                </Text>
              </View>
            </ProgressiveSilence>
            <View className="mt-4 flex-row gap-2">
              <Chip
                label={silence ? 'Séance en cours' : 'En pause'}
                selected={silence}
                onPress={() => setSilence((value) => !value)}
              />
            </View>
          </Card>
        </View>

        <View className="gap-3">
          <Text variant="h2">Sheet</Text>
          <View className="overflow-hidden rounded-t-[28px]">
            <Sheet title="Minuteur de fondu">
              <Text variant="bodySm" className="mb-4 text-center">
                La séance s&apos;éteint doucement à la fin du minuteur.
              </Text>
              <View className="flex-row justify-center gap-2">
                {['5', '10', '15', '30'].map((value) => (
                  <Chip key={value} label={`${value} min`} selected={value === '15'} />
                ))}
              </View>
            </Sheet>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
