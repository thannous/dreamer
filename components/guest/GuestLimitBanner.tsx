import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useDreams } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { GUEST_DREAM_LIMIT } from '@/constants/limits';
import { Fonts } from '@/constants/theme';
import { getLocalDreamRecordingCount } from '@/services/quota/GuestDreamCounter';
import { router } from 'expo-router';

export const GuestLimitBanner: React.FC = () => {
  const { user } = useAuth();
  const { dreams } = useDreams();
  const { colors, shadows } = useTheme();
  const { t } = useTranslation();
  const [guestRecordedTotal, setGuestRecordedTotal] = useState(0);

  const isGuest = !user;
  useEffect(() => {
    if (!isGuest) {
      setGuestRecordedTotal(0);
      return;
    }
    let cancelled = false;
    getLocalDreamRecordingCount()
      .then((count) => {
        if (!cancelled) setGuestRecordedTotal(count);
      })
      .catch(() => {
        // Best-effort
      });
    return () => {
      cancelled = true;
    };
  }, [isGuest, dreams.length]);

  const used = useMemo(
    () => (isGuest ? Math.min(Math.max(dreams.length, guestRecordedTotal), GUEST_DREAM_LIMIT) : 0),
    [dreams.length, guestRecordedTotal, isGuest]
  );
  const progress = useMemo(() => (isGuest ? used / GUEST_DREAM_LIMIT : 0), [used, isGuest]);

  if (!isGuest || used === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundCard }, shadows.md]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('guest.limit.banner.title', { limit: GUEST_DREAM_LIMIT })}
        </Text>
        <Text style={[styles.counter, { color: colors.textSecondary }]}>
          {t('guest.limit.banner.counter', { used, limit: GUEST_DREAM_LIMIT })}
        </Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {used >= GUEST_DREAM_LIMIT ? t('guest.limit.banner.reached') : t('guest.limit.banner.hint')}
      </Text>
      <View style={[styles.progressBar, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} />
      </View>
      <Pressable style={[styles.cta, { backgroundColor: colors.accent }]} onPress={() => router.push('/(tabs)/settings')}>
        <Text style={styles.ctaText}>{t('guest.limit.banner.cta')}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    position: 'relative',
    zIndex: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
  counter: {
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.medium,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.spaceGrotesk.regular,
  },
  progressBar: {
    height: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  cta: {
    marginTop: 2,
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.spaceGrotesk.bold,
  },
});
