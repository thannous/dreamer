import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoctaliaScreenHeader } from '@/components/NoctaliaScreenHeader';
import { FullMoonSeal } from '@/components/ui/FullMoonSeal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useQuota } from '@/hooks/useQuota';
import { useTranslation } from '@/hooks/useTranslation';
import { requestAiConsent } from '@/lib/aiConsent';
import { CONTACT_EMAIL, openContactMail } from '@/lib/contact';
import { isMockModeEnabled } from '@/lib/env';
import { nearestFullMoon } from '@/lib/fullMoon';
import { moonLetterTarget } from '@/lib/moonLetter';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { withFirstDayOrdinal } from '@/lib/quotaReset';
import { TID } from '@/lib/testIDs';
import { fetchMoonLetter, type MoonLetterResult } from '@/services/moonLetterService';

const SYNODIC_MONTH_MS = 29.530588861 * 24 * 60 * 60 * 1000;
/** While another request writes the letter, look again this often, for as long as the api holds it. */
const WRITING_RETRY_MS = 4000;
const WRITING_RETRIES = 45;

type State =
  | { kind: 'loading' }
  | { kind: 'consent' }
  | { kind: 'error' }
  | { kind: 'loaded'; result: MoonLetterResult };

/**
 * The full moon letter: once per lunar cycle, a reading of the dreams noted since the
 * previous full moon. Plus reads all of it; a free account reads its opening sentence, the
 * rest stays on the server. Earlier letters are listed below it.
 */
export function MoonLetterScreen() {
  const { t, currentLang } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const insets = useSafeAreaInsets();
  const { formatDate, locale } = useLocaleFormatting();
  const { user } = useAuth();
  const { tier } = useQuota();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ fullMoonAt?: string }>();
  const named = typeof params.fullMoonAt === 'string' && params.fullMoonAt ? params.fullMoonAt : undefined;
  // Which letter the screen shows is settled when it opens.
  const [openedAt] = useState(() => Date.now());
  const asked = useMemo(() => moonLetterTarget(named, openedAt), [named, openedAt]);
  const [state, setState] = useState<State>({ kind: 'loading' });
  // Each request, and how many times in a row it found the letter being written.
  const [attempt, setAttempt] = useState({ count: 0, writing: 0 });

  const signedIn = Boolean(user);
  // The api knows the account's plan; only the mock letter asks the app.
  const mockPlus = isMockModeEnabled() && tier === 'plus';
  const askConsent = useEffectEvent(() => requestAiConsent(t));
  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    void (async () => {
      setState((current) => (current.kind === 'loaded' ? current : { kind: 'loading' }));
      // This cycle's letter may be written now: the dreams go to the AI only with consent.
      if (!asked && !(await askConsent())) {
        if (!controller.signal.aborted) setState({ kind: 'consent' });
        return;
      }
      try {
        const result = await fetchMoonLetter({ lang: currentLang, fullMoonAt: asked, mockPlus, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (result.reason === 'writing' && attempt.writing < WRITING_RETRIES) {
          timer = setTimeout(() => setAttempt((value) => ({ count: value.count + 1, writing: value.writing + 1 })), WRITING_RETRY_MS);
          return;
        }
        setState({ kind: 'loaded', result });
      } catch {
        if (!controller.signal.aborted) setState({ kind: 'error' });
      }
    })();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [asked, attempt, currentLang, mockPlus, signedIn]);

  const retry = useCallback(() => setAttempt((value) => ({ count: value.count + 1, writing: 0 })), []);
  const back = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/')), []);
  const day = useCallback((iso: string) => withFirstDayOrdinal(formatDate(Date.parse(iso), { day: 'numeric', month: 'long' }), locale), [formatDate, locale]);

  const result = state.kind === 'loaded' ? state.result : null;
  const letter = result?.letter ?? null;
  const fullMoonAt = result?.fullMoonAt ?? asked;
  const paragraphs = letter?.body ? letter.body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean) : [];

  // Back from the paywall with Plus, the letter opens whole.
  const locked = Boolean(letter?.locked);
  useEffect(() => (locked ? navigation.addListener('focus', retry) : undefined), [locked, navigation, retry]);

  // The reference lets us find the reported letter.
  const report = useCallback(() => {
    if (!letter) return;
    void openContactMail({
      subject: t('journal.detail.report.subject'),
      body: t('moon_letter.report.body', { reference: letter.fullMoonAt }),
      unavailableTitle: t('journal.detail.report.button'),
      unavailableMessage: t('contact.mail_unavailable', { email: CONTACT_EMAIL }),
    });
  }, [letter, t]);

  const message = (text: string, action?: { label: string; onPress: () => void; testID: string }) => (
    <View className="gap-4 rounded-[20px] border border-line bg-ink-card p-5">
      <Text className="font-sans text-body leading-[24px] text-ivory">{text}</Text>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" testID={action.testID}
          className="min-h-[48px] items-center justify-center rounded-full bg-champagne px-5 active:opacity-80">
          <Text className="font-sans-bold text-body text-on-champagne">{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-ink" testID={TID.Screen.MoonLetter}>
      <NoctaliaScreenHeader titleKey="moon_letter.title" actions={[{
        icon: 'chevron.left',
        accessibilityLabel: t('navigation.back'),
        testID: TID.Button.MoonLetterBack,
        onPress: back,
      }]} />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        <View className="gap-6 px-6 pt-4">
          <View className="flex-row items-center gap-3">
            <FullMoonSeal size={40} />
            {fullMoonAt ? (
              <Text className="font-sans-medium text-overline uppercase text-ivory-muted">
                {t('moon_letter.date', { date: day(fullMoonAt) })}
              </Text>
            ) : null}
          </View>

          {!signedIn ? message(t('moon_letter.account_needed'))
            : state.kind === 'loading' ? (
              <View className="flex-row items-center gap-3 py-6" testID={TID.Text.MoonLetterLoading}>
                <ActivityIndicator color={noctalia.accent.text} />
                <Text className="flex-1 font-serif-italic text-body leading-[24px] text-ivory-muted">{t('moon_letter.loading')}</Text>
              </View>
            ) : state.kind === 'consent' ? message(t('moon_letter.consent_needed'), { label: t('moon_letter.consent_cta'), onPress: retry, testID: TID.Button.MoonLetterRetry })
            : state.kind === 'error' ? message(t('moon_letter.error'), { label: t('moon_letter.retry'), onPress: retry, testID: TID.Button.MoonLetterRetry })
            : letter ? (
              <View className="gap-5" testID={TID.Component.MoonLetter}>
                <Text className="font-serif text-[22px] leading-[32px] text-ivory" testID={TID.Text.MoonLetterOpening}>{letter.opening}</Text>
                {letter.locked ? (
                  <View className="gap-4 border-t border-line pt-5">
                    <Text className="font-sans text-body leading-[24px] text-ivory-muted">{t('moon_letter.locked.body')}</Text>
                    <Pressable onPress={() => router.push(buildPaywallHref('direct'))} accessibilityRole="button"
                      testID={TID.Button.MoonLetterPlus}
                      className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-champagne px-5 active:opacity-80">
                      <IconSymbol name="sparkles" size={18} color={noctalia.action.primaryText} />
                      <Text className="font-sans-bold text-body text-on-champagne">{t('moon_letter.locked.cta')}</Text>
                    </Pressable>
                  </View>
                ) : paragraphs.map((paragraph, index) => (
                  <Text key={index} className="font-serif text-body leading-[27px] text-ivory">{paragraph}</Text>
                ))}
                <Text className="font-sans text-caption text-ivory-muted">
                  {t('moon_letter.footer', { count: letter.dreamCount })}
                </Text>
                <Pressable onPress={report} accessibilityRole="link" testID={TID.Button.MoonLetterReport}
                  hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
                  className="min-h-[44px] flex-row items-center gap-1.5 self-start active:opacity-70">
                  <IconSymbol name="flag" size={15} color={noctalia.text.tertiary} />
                  <Text className="font-sans text-[13px] text-ivory-muted">{t('journal.detail.report.button')}</Text>
                </Pressable>
              </View>
            ) : result?.reason === 'too_few_dreams' ? message(
              t('moon_letter.too_few', {
                min: result.minDreams,
                count: result.dreamCount ?? 0,
                date: day(new Date(nearestFullMoon(Date.parse(result.fullMoonAt) + SYNODIC_MONTH_MS)).toISOString()),
              }),
              { label: t('moon_letter.too_few_cta'), onPress: () => router.push('/recording'), testID: TID.Button.MoonLetterRecord },
            )
            : result?.reason === 'writing' ? message(t('moon_letter.still_writing'), { label: t('moon_letter.retry'), onPress: retry, testID: TID.Button.MoonLetterRetry })
            : message(t('moon_letter.not_written'))}

          {result && result.previous.length > 0 ? (
            <View className="gap-1 pt-4">
              <Text className="pb-2 font-sans-medium text-overline uppercase text-ivory-muted">{t('moon_letter.previous')}</Text>
              {result.previous.map((entry) => (
                <Pressable key={entry.fullMoonAt} accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/moon-letter', params: { fullMoonAt: entry.fullMoonAt } })}
                  testID={`${TID.Button.MoonLetterPrevious}.${entry.fullMoonAt}`}
                  className="min-h-[64px] flex-row items-center gap-3 border-t border-line py-4 active:opacity-70">
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="font-sans-medium text-caption text-ivory-muted">{t('moon_letter.date', { date: day(entry.fullMoonAt) })}</Text>
                    <Text numberOfLines={2} className="font-serif text-body leading-[22px] text-ivory">{entry.opening}</Text>
                  </View>
                  <IconSymbol name="chevron.right" size={18} color={noctalia.text.tertiary} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
