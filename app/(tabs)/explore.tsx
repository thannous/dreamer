import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { RitualPickerSheet } from '@/components/ritual/RitualPickerSheet';
import { ScreenContainer } from '@/components/ScreenContainer';
import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DESKTOP_BREAKPOINT, getBottomNavigationLayout } from '@/constants/layout';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { RITUALS, type RitualId } from '@/lib/inspirationRituals';
import { isSleepSoundsAvailable } from '@/lib/sleepSoundsFeature';
import { TID } from '@/lib/testIDs';
import { getRitualPreference, saveRitualPreference } from '@/services/storageService';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

type ExplorerCardProps = {
  icon: IconName;
  title: string;
  body: string;
  testID: string;
  onPress: () => void;
};

function ExplorerCard({ icon, title, body, testID, onPress }: ExplorerCardProps) {
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      className="min-h-[120px] flex-row items-center gap-4 rounded-[20px] border border-line bg-ink-soft p-4 active:opacity-[0.78]"
    >
      <View
        className="h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border"
        style={{
          backgroundColor: noctalia.surface.raised,
          borderColor: noctalia.surface.border,
        }}
      >
        <IconSymbol name={icon} size={24} color={noctalia.accent.text} />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-[18px] leading-[24px] font-display-semibold text-ivory">
          {title}
        </Text>
        <Text className="text-[14px] leading-[20px] font-sans text-ivory-muted">
          {body}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={noctalia.text.secondary} />
    </Pressable>
  );
}

export default function ExploreScreen() {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selectedRitualId, setSelectedRitualId] = useState<RitualId>('starter');
  const [pickerVisible, setPickerVisible] = useState(false);
  const preferenceRevision = useRef(0);
  const changeRitualRef = useRef<View>(null);
  const wasPickerVisible = useRef(false);
  const screenFocused = useRef(false);

  useEffect(() => {
    const shouldRestore = wasPickerVisible.current && !pickerVisible;
    wasPickerVisible.current = pickerVisible;
    if (!shouldRestore) return;
    // Wait for the native modal window to detach before restoring both
    // keyboard and screen-reader focus to the control that opened it.
    const timer = setTimeout(() => {
      if (!screenFocused.current) return;
      const trigger = changeRitualRef.current;
      if (!trigger) return;
      trigger.focus();
      if (Platform.OS !== 'web') {
        const node = findNodeHandle(trigger);
        if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [pickerVisible]);
  const isDesktopLayout = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  const navigationLayout = getBottomNavigationLayout(width, height, fontScale);
  const scrollHeader = navigationLayout.compact && navigationLayout.largeText && !isDesktopLayout;
  const navigationClearance = navigationLayout.barHeight + Math.max(insets.bottom, navigationLayout.minimumBottomInset);
  const scrollBottomPadding = isDesktopLayout
    ? ThemeLayout.spacing.xl
    : (scrollHeader ? 0 : navigationClearance) + ThemeLayout.spacing.lg;
  const sleepSoundsAvailable = isSleepSoundsAvailable(Platform.OS);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      screenFocused.current = true;
      const revision = preferenceRevision.current;

      void getRitualPreference()
        .then((preferredRitualId) => {
          if (!active || revision !== preferenceRevision.current) return;
          const preferredRitual = RITUALS.find((ritual) => ritual.id === preferredRitualId);
          setSelectedRitualId(preferredRitual?.id ?? 'starter');
        })
        .catch(() => {
          if (active && revision === preferenceRevision.current) setSelectedRitualId('starter');
        });

      return () => {
        active = false;
        screenFocused.current = false;
      };
    }, []),
  );

  const ritual = RITUALS.find((entry) => entry.id === selectedRitualId) ?? RITUALS[0];
  const header = (
    <NoctaliaScreenHeader
      titleKey="explore.title"
      actions={[
        {
          icon: 'gear',
          onPress: () => router.push('/(tabs)/settings'),
          accessibilityLabel: t('nav.settings'),
          testID: TID.Button.HeaderExploreSettings,
        },
      ]}
    />
  );

  return (
    <View className="flex-1 bg-ink" testID={TID.Screen.Explore}>
      <AtmosphericBackground variant="subtle" />
      {!scrollHeader ? header : null}
      <ScrollView
        className="flex-1"
        // In short windows the header must scroll with the resources, and the
        // viewport must end above navigation. The header already owns top safe
        // area padding; avoid automatically adding that inset a second time.
        style={scrollHeader ? { marginBottom: navigationClearance } : undefined}
        contentInsetAdjustmentBehavior={scrollHeader ? 'never' : 'automatic'}
        contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {scrollHeader ? header : null}
        <ScreenContainer key="resources">
          <View className="gap-4 px-4 pt-4">
            <Text className="text-[15px] leading-[22px] font-sans text-ivory-muted">
              {t('explore.intro')}
            </Text>
            <ExplorerCard
              icon="book.closed.fill"
              title={t('explore.symbols.title')}
              body={t('explore.symbols.body')}
              testID={TID.Button.ExplorerSymbols}
              onPress={() => router.push('/symbol-dictionary')}
            />
            <ExplorerCard
              icon="sparkles"
              title={t('explore.guides.title')}
              body={t('explore.guides.body')}
              testID={TID.Button.ExplorerGuides}
              onPress={() => router.push('/dream-guides')}
            />
            <View className="gap-4 rounded-[20px] border border-line bg-ink-soft p-4">
              <View className="flex-row items-center gap-4">
                <View accessible={false} className="h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border"
                  style={{ backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border }}>
                  <IconSymbol name="moon.stars.fill" size={24} color={noctalia.accent.text} />
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text accessibilityRole="header" className="font-display-semibold text-[18px] leading-[24px] text-ivory">
                    {t('explore.ritual.title')}
                  </Text>
                  <Text className="font-sans text-[14px] leading-[20px] text-ivory-muted">
                    {t('explore.ritual.body')}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => router.push(`/ritual/${ritual.id}`)} accessibilityRole="button"
                accessibilityLabel={t('explore.ritual.open', { ritual: t(ritual.labelKey) })}
                testID={TID.Button.ExplorerRitual}
                className="min-h-14 items-center justify-center rounded-[16px] bg-champagne px-4 py-4">
                <Text className="text-center font-sans-bold text-[15px] text-on-champagne">
                  {t('explore.ritual.open', { ritual: t(ritual.labelKey) })}
                </Text>
              </Pressable>
              <Pressable ref={changeRitualRef} focusable onPress={() => setPickerVisible(true)} accessibilityRole="button"
                testID="explorer-change-ritual" className="min-h-12 items-center justify-center rounded-[16px] border border-line px-4 py-3">
                <Text className="text-center font-sans-medium text-[15px] text-ivory">{t('explore.ritual.change')}</Text>
              </Pressable>
            </View>
            {sleepSoundsAvailable ? (
              <ExplorerCard
                icon="speaker.wave.2.fill"
                title={t('explore.sleep_sounds.title')}
                body={t('explore.sleep_sounds.body')}
                testID={TID.Button.ExplorerSleepSounds}
                onPress={() => router.push('/sleep-sounds')}
              />
            ) : null}
          </View>
        </ScreenContainer>
      </ScrollView>
      {pickerVisible ? <RitualPickerSheet currentId={selectedRitualId}
        onClose={() => setPickerVisible(false)}
        onConfirm={async (id) => {
          await saveRitualPreference(id);
          preferenceRevision.current++;
          setSelectedRitualId(id);
          setPickerVisible(false);
        }} /> : null}
    </View>
  );
}
