import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { getIllustrationResolution, saveIllustrationResolution, type IllustrationResolution } from '@/services/illustrationPreferences';
import { getHdImageQuota, type HdImageQuota } from '@/services/hdImageQuota';
import { isHdIllustrationsEnabled } from '@/lib/env';

const resolutions: IllustrationResolution[] = ['1K', '2K', '4K'];

export function IllustrationQualityPreference() {
  return isHdIllustrationsEnabled() ? <EnabledIllustrationQualityPreference /> : null;
}

function EnabledIllustrationQualityPreference() {
  const { user } = useAuth();
  const { status } = useSubscription();
  const { t } = useTranslation();
  const plus = Boolean(user?.id && status?.tier === 'plus' && status.isActive);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<{ owner?: string; resolution: IllustrationResolution; quota: HdImageQuota | null; error: boolean }>({ resolution: '1K', quota: null, error: false });
  const [saving, setSaving] = useState(false);
  const current = state.owner === user?.id && plus ? state.resolution : '1K';
  const quota = state.owner === user?.id && plus ? state.quota : null;

  useFocusEffect(useCallback(() => {
    let active = true;
    const owner = user?.id;
    void Promise.allSettled([getIllustrationResolution(owner), plus && visible ? getHdImageQuota() : Promise.resolve(null)])
      .then(([preference, allowance]) => {
        if (!active) return;
        setState({ owner, resolution: preference.status === 'fulfilled' ? preference.value : '1K',
          quota: allowance.status === 'fulfilled' ? allowance.value : null,
          error: preference.status === 'rejected' || allowance.status === 'rejected' });
      });
    return () => { active = false; };
  }, [plus, user?.id, visible]));

  const select = async (resolution: IllustrationResolution) => {
    if (!user?.id || saving || (resolution !== '1K' && (!plus || !quota || quota.remaining < 1))) return;
    const owner = user.id;
    setSaving(true);
    try {
      await saveIllustrationResolution(owner, resolution);
      setState(previous => ({ ...previous, owner, resolution, error: false }));
      setVisible(false);
    } catch {
      setState(previous => ({ ...previous, error: true }));
    } finally { setSaving(false); }
  };

  return <>
    <Pressable accessibilityRole="button" onPress={() => setVisible(true)}
      className="min-h-[60px] w-full flex-row items-center gap-4" testID="settings-illustration-quality">
      <View className="flex-1 gap-1">
        <Text className="font-sans text-[15px] text-ivory">{t('settings.illustration.title')}</Text>
        <Text className="font-sans text-caption text-ivory-muted">{t('settings.illustration.summary')}</Text>
      </View>
      <Text className="font-sans text-[15px] text-ivory-muted">{t(`settings.illustration.${current}`)}</Text>
    </Pressable>
    <BottomSheet visible={visible} onClose={() => setVisible(false)} testID="settings-illustration-sheet">
      <View className="gap-4 px-gutter py-6">
        <Text className="font-display-semibold text-[23px] text-ivory">{t('settings.illustration.title')}</Text>
        <Text className="font-sans text-body-sm text-ivory-muted">{t('settings.illustration.description')}</Text>
        {plus && quota ? <Text accessibilityLiveRegion="polite" className="font-sans text-body-sm text-ivory-muted">
          {t('settings.illustration.remaining', { count: quota.remaining })}{' '}
          {t('settings.illustration.resets', { date: new Date(quota.resetsAt).toLocaleDateString() })}
        </Text> : !state.error ? <Text className="font-sans text-body-sm text-ivory-muted">{t(plus ? 'settings.illustration.loading' : 'settings.illustration.plus')}</Text> : null}
        {state.error ? <Text accessibilityRole="alert" className="font-sans text-body-sm text-ivory-muted">{t('settings.illustration.error')}</Text> : null}
        <View accessibilityRole="radiogroup">
          {resolutions.map(resolution => {
            const disabled = saving || (resolution !== '1K' && (!plus || !quota || quota.remaining < 1));
            return <Pressable key={resolution} accessibilityRole="radio"
              accessibilityState={{ checked: current === resolution, disabled }} disabled={disabled}
              onPress={() => { void select(resolution); }} testID={`settings-illustration-${resolution}`}
              className={`min-h-[60px] justify-center rounded-lg border px-4 py-3 my-1 ${current === resolution ? 'border-champagne bg-ink-active' : 'border-line bg-ink-card'} ${disabled ? 'opacity-50' : ''}`}>
              <Text className="font-sans text-[16px] text-ivory">{t(`settings.illustration.${resolution}`)}</Text>
            </Pressable>;
          })}
        </View>
      </View>
    </BottomSheet>
  </>;
}
