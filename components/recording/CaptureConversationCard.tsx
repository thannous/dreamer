import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';
import { DREAM_STORY, entrance, recapLineDelay, recapSettled } from '@/components/journal/story/dreamStoryMotion';
import { useTheme } from '@/context/ThemeContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTranslation } from '@/hooks/useTranslation';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TID } from '@/lib/testIDs';

type Props = {
  text: string;
  /** The account was woven from the narrator's words by the formatter, not only gathered. */
  woven?: boolean;
  disabled: boolean;
  pending: boolean;
  saved: boolean;
  onChange: (text: string) => void;
  onSave: () => void | Promise<void>;
  onExit: () => void;
  onOpen: () => void;
};

const paragraphsOf = (text: string) => text.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean);

/** A node that plays its one-time entrance while the page is being told, and is at rest after. */
function Told({ motion, className, testID, children }: {
  motion: CSSStyle | null; className?: string; testID?: string; children?: React.ReactNode;
}) {
  return <Animated.View testID={testID} className={className} style={motion as StyleProp<ViewStyle>}>{children}</Animated.View>;
}

/**
 * The threshold of the dream story: the narrator's words become one page before the dream
 * enters the journal. The page is told once when it appears — the card settles, a star
 * lights between two threads, then the account arrives paragraph by paragraph — and is at
 * rest afterwards, through edits, added details and the saved state. Under reduce motion
 * everything fades in together, without travel.
 */
export function CaptureConversationCard(props: Props) {
  const { colors, mode } = useTheme();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const paragraphs = useMemo(() => paragraphsOf(props.text), [props.text]);
  const [tellingTime] = useState(() => recapSettled(paragraphs.length));
  const [told, setTold] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTold(true), tellingTime);
    return () => clearTimeout(timer);
  }, [tellingTime]);

  const motion = useMemo(() => {
    const play = (style: CSSStyle) => (told ? null : style);
    return {
      card: play(entrance({ from: [{ translateY: 14 }, { scale: 0.98 }], to: [{ translateY: 0 }, { scale: 1 }] }, DREAM_STORY.recapCard, 0, reduced)),
      thread: play(entrance({ from: [{ scaleX: 0.15 }], to: [{ scaleX: 1 }] }, DREAM_STORY.recapThread, DREAM_STORY.recapStar, reduced)),
      star: play(entrance({ from: [{ scale: 0.6 }], to: [{ scale: 1 }] }, DREAM_STORY.starIgnite, DREAM_STORY.recapStar, reduced)),
      title: play(entrance({ from: [{ translateY: 6 }], to: [{ translateY: 0 }] }, DREAM_STORY.recapCard, DREAM_STORY.recapTitle, reduced)),
      line: (index: number) => play(entrance({ from: [{ translateY: 8 }], to: [{ translateY: 0 }] }, DREAM_STORY.recapLine, recapLineDelay(index), reduced)),
      actions: play(entrance(null, DREAM_STORY.recapCard, recapLineDelay(paragraphs.length), reduced)),
    };
  }, [paragraphs.length, reduced, told]);

  const saveDisabled = props.disabled || props.pending || !props.text.trim() || editing;
  return <Told motion={motion.card} testID="capture-review-card" className="w-full gap-4 rounded-2xl border border-line bg-ink-raised px-5 pb-5 pt-4">
    <View className="flex-row items-start gap-2">
      <View className="flex-1 gap-2">
        <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
          className="h-4 flex-row items-center gap-2">
          <Told motion={motion.thread} className="h-px w-7 bg-champagne opacity-40" />
          <Told motion={motion.star} className="h-2 w-2 rounded-full bg-champagne" />
          <Told motion={motion.thread} className="h-px w-7 bg-champagne opacity-40" />
        </View>
        <Told motion={motion.title}>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" testID="capture-review-title"
            className="font-display-medium text-[22px] leading-7 text-ivory">
            {t('recording.chat.ready')}
          </Text>
          {props.woven && !props.saved ? (
            <Text testID="capture-review-woven" className="mt-1 font-sans text-[13px] leading-5 text-ivory-muted">
              {t('recording.chat.woven_note')}
            </Text>
          ) : null}
        </Told>
      </View>
      {!props.saved ? <Pressable accessibilityRole="button" accessibilityLabel={t('recording.review.exit')} onPress={props.onExit}
        disabled={props.disabled} className="-m-2.5 min-h-11 min-w-11 items-center justify-center" testID="capture-review-exit">
        <IconSymbol name="xmark" size={18} color={tokens.text.secondary} />
      </Pressable> : <IconSymbol name="checkmark.circle.fill" size={22} color={tokens.text.primary} />}
    </View>

    {editing && !props.saved ? <TextInput
      testID="capture-review-text" accessibilityLabel={t('recording.review.title')}
      value={props.text} onChangeText={props.onChange} multiline autoFocus editable={!props.disabled}
      className="max-h-[260px] min-h-[120px] rounded-[10px] border border-line p-2.5 font-serif text-[17px] leading-7 text-ivory"
      style={{ textAlignVertical: 'top' }}
    /> : <View testID="capture-review-narrative" className="gap-3">
      {paragraphs.map((paragraph, index) => (
        <Told key={index} motion={motion.line(index)}>
          <Text selectable className="font-serif text-[17px] leading-7 text-ivory">{paragraph}</Text>
        </Told>
      ))}
    </View>}

    <Told motion={motion.actions} className="gap-3">
      {!props.saved ? <>
        <Pressable onPress={() => { if (editing) Keyboard.dismiss(); setEditing(!editing); }} disabled={props.disabled}
          accessibilityRole="button" accessibilityLabel={t(editing ? 'common.done' : 'recording.chat.edit')}
          className="min-h-11 flex-row items-center gap-2.5" testID={editing ? 'capture-review-edit-done' : 'capture-review-edit'}>
          <IconSymbol name={editing ? 'checkmark' : 'pencil'} size={20} color={tokens.text.primary} />
          <Text className="font-sans-medium text-[14px] leading-5 text-ivory">{t(editing ? 'common.done' : 'recording.chat.edit')}</Text>
        </Pressable>
        {props.pending ? <Text className="font-sans text-[13px] leading-[18px] text-ivory-muted">{t('recording.chat.pending_hint')}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={t('recording.button.save_dream')}
          accessibilityState={{ disabled: saveDisabled, busy: props.disabled }} disabled={saveDisabled}
          onPress={() => { void props.onSave(); }} testID={TID.Button.SaveDream}
          className="min-h-[52px] flex-row items-center justify-between gap-3 rounded-[14px] bg-champagne px-4 py-3"
          style={{ opacity: saveDisabled ? 0.45 : 1 }}>
          <Text className="shrink font-sans-medium text-[16px] leading-[23px] text-on-champagne">{t('recording.button.save_dream')}</Text>
          {props.disabled ? <ActivityIndicator color={tokens.action.primaryText} /> : <IconSymbol name="arrow.right" size={22} color={tokens.action.primaryText} />}
        </Pressable>
      </> : <>
        <Pressable onPress={props.onOpen} disabled={props.disabled} accessibilityRole="button" testID="capture-review-open"
          className="min-h-11 flex-row items-center gap-2.5">
          <IconSymbol name="book.fill" size={20} color={tokens.text.primary} />
          <Text className="font-sans-medium text-[14px] leading-5 text-ivory">{t('recording.chat.open')}</Text>
        </Pressable>
        <View className="min-h-[52px] flex-row items-center justify-between gap-3 rounded-[14px] bg-champagne px-4 py-3" testID="capture-review-confirmed">
          <Text accessibilityLiveRegion="polite" className="shrink font-sans-medium text-[16px] leading-[23px] text-on-champagne" testID="capture-review-saved">{t('recording.chat.saved')}</Text>
          <IconSymbol name="checkmark" size={22} color={tokens.action.primaryText} />
        </View>
      </>}
      {/* True before and after saving; kept in both states so a double tap never lands on a shifted control. */}
      <Text className="text-center font-sans text-[13px] leading-5 text-ivory-muted">{t('recording.chat.next_hint')}</Text>
    </Told>
  </Told>;
}
