import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { RITUALS, type RitualId } from '@/lib/inspirationRituals';

const ORDER: RitualId[] = ['starter', 'memory', 'lucid'];

export function RitualPickerSheet({ currentId, onClose, onConfirm }: {
  currentId: RitualId;
  onClose: () => void;
  onConfirm: (id: RitualId) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const palette = getNoctaliaDesignTokens(colors, mode);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(currentId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const close = () => { if (!inFlight.current) onClose(); };
  const confirm = async () => {
    if (inFlight.current) return;
    if (draft === currentId) { onClose(); return; }
    inFlight.current = true;
    setSaving(true);
    setError(false);
    try {
      await onConfirm(draft);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <View className="flex-1 justify-end" style={{ backgroundColor: palette.surface.overlay }}>
        <Pressable onPress={close} disabled={saving} accessibilityRole="button"
          accessibilityLabel={t('common.cancel')} testID="ritual-picker-backdrop" className="absolute inset-0" />
        <View accessibilityViewIsModal testID="ritual-picker" className="rounded-t-[28px] border-t border-line bg-ink-solid">
          <ScrollView style={{ maxHeight: Math.max(160, (height - insets.top - insets.bottom) * 0.85 - 40) }}
            contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
            <View className="mb-5 h-1 w-10 self-center rounded-full bg-line" />
            <View className="mb-3 flex-row items-start gap-3">
              <Text accessibilityRole="header" className="flex-1 font-display-semibold text-[24px] text-ivory">{t('explore.ritual.change')}</Text>
              <Pressable onPress={close} disabled={saving} accessibilityRole="button" accessibilityLabel={t('common.cancel')}
                testID="ritual-picker-close" className="min-h-12 min-w-12 items-center justify-center rounded-full">
                <IconSymbol name="xmark" size={24} color={palette.text.primary} />
              </Pressable>
            </View>
            <Text className="mb-5 font-sans text-[15px] text-ivory-muted">{t('explore.ritual.choose_hint')}</Text>
            <View className="mb-6 gap-3">
              {ORDER.map(id => {
                const ritual = RITUALS.find(item => item.id === id)!;
                return (
                  <Pressable key={id} onPress={() => setDraft(id)} disabled={saving}
                    accessibilityRole="radio" accessibilityState={{ checked: draft === id, disabled: saving }}
                    accessibilityLabel={`${t(ritual.labelKey)}. ${t(`explore.ritual.description.${id}`)}${id === currentId ? `. ${t('explore.ritual.current')}` : ''}`}
                    testID={`ritual-choice-${id}`}
                    className={`min-h-24 flex-row items-center gap-4 rounded-[20px] border p-4 ${draft === id ? 'border-champagne-soft bg-ink-soft' : 'border-line bg-ink'}`}>
                    <View className="h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-line bg-ink-soft">
                      <IconSymbol name={id === 'starter' ? 'moon.stars.fill' : id === 'memory' ? 'book.closed.fill' : 'sparkles'} size={26} color={palette.accent.text} />
                    </View>
                    <View className="flex-1 gap-2">
                      <View className="flex-row flex-wrap items-center justify-between gap-2">
                        <Text className="font-display-semibold text-[20px] text-ivory">{t(ritual.labelKey)}</Text>
                        {id === currentId ? <View className="rounded-full border border-line bg-ink-soft px-3 py-1"><Text className="font-sans-medium text-[13px] text-ivory-muted">{t('explore.ritual.current')}</Text></View> : null}
                      </View>
                      <Text className="font-sans text-[15px] text-ivory-muted">{t(`explore.ritual.description.${id}`)}</Text>
                    </View>
                    <View accessible={false} className={`h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${draft === id ? 'border-champagne-soft' : 'border-line'}`}>
                      {draft === id ? <View className="h-3.5 w-3.5 rounded-full bg-champagne" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="mb-4 font-sans text-[15px] text-ivory">{t('explore.ritual.save_error')}</Text> : null}
            <Pressable onPress={() => void confirm()} disabled={saving}
              accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }}
              testID="ritual-picker-confirm" className="min-h-14 items-center justify-center rounded-[20px] bg-champagne px-5 py-4">
              <Text className="text-center font-sans-bold text-[16px] text-on-champagne">{t(saving ? 'explore.ritual.saving' : 'explore.ritual.confirm')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
