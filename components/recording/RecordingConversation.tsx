import { MarkdownText } from '@/components/ui/MarkdownText';
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTranslation } from '@/hooks/useTranslation';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TID } from '@/lib/testIDs';
import type { MicButtonStatus } from './MicButton';
import { RecordingTextInput } from './RecordingTextInput';
import { CaptureConversationCard } from './CaptureConversationCard';
import { parseCaptureEditableDraft } from '@/lib/captureEditableDraft';
import { Fonts } from '@/constants/theme';

type Props = {
  compact?: boolean;
  finishDisabled?: boolean;
  review?: { source: string; text: string };
  saved?: boolean;
  onReviewChange?: (text: string) => void;
  onSave?: () => void | Promise<void>;
  onExitReview?: () => void;
  onOpenSaved?: () => void;
  onNewCapture?: () => void;
  transcript: string;
  answer: string;
  storyTranscript: string;
  question: string | null;
  loading: boolean;
  unavailable: boolean;
  done: boolean;
  needsDecision?: boolean;
  onContinueQuestions?: () => void | Promise<void>;
  onFinish?: () => void;
  disabled: boolean;
  voiceSupported: boolean;
  voiceStatus: MicButtonStatus;
  onVoice: () => void;
  onMute: () => Promise<void>;
  onReview: () => void;
  onRestart: () => void;
  onAnswerChange: (text: string) => void;
  onAnswerSubmit: () => void | Promise<void>;
};

export function RecordingConversation(props: Props) {
  const { colors, mode } = useTheme();
  const tokens = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const [switching, setSwitching] = useState(false);
  const thread = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const sections = useMemo(() => parseCaptureEditableDraft(props.storyTranscript).sections, [props.storyTranscript]);
  const hasStory = sections.some(section => Boolean(section.text.trim()));
  const listening = props.voiceStatus === 'recording';
  const preparing = props.voiceStatus === 'preparing';
  const locked = props.disabled || preparing || switching || !!props.saved;
  const voiceLabel = preparing ? t('recording.status.preparing.title')
    : listening ? t('recording.conversation.mute')
    : hasStory ? t('recording.conversation.reply') : t('recording.conversation.begin');
  const submitDisabled = locked || props.loading || !props.answer.trim();
  const submit = async () => {
    setSwitching(true);
    try { await props.onAnswerSubmit(); Keyboard.dismiss(); } finally { setSwitching(false); }
  };
  const onVoice = async () => {
    Keyboard.dismiss();
    if (listening) {
      setSwitching(true);
      try { await props.onMute(); } finally { setSwitching(false); }
    } else { props.onVoice(); }
  };
  const currentQuestion = props.loading ? t('recording.conversation.thinking')
    : props.review ? t('recording.chat.gathered')
    : props.done ? t('recording.conversation.ready')
    : props.needsDecision ? t('recording.conversation.edited')
    : props.question ?? t(hasStory ? 'dream_recall.question.what_else' : 'recording.conversation.welcome');
  return <View style={[styles.container, props.compact && styles.compact]} testID="recording-conversation">
    <ScrollView ref={thread} style={[styles.thread, props.compact && styles.threadCompact]}
      contentContainerStyle={styles.messages} scrollEnabled={!props.compact} nestedScrollEnabled
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} testID="capture-chat-thread"
      onScroll={({ nativeEvent }) => { nearBottom.current = nativeEvent.contentSize.height - nativeEvent.contentOffset.y - nativeEvent.layoutMeasurement.height < 48; }}
      scrollEventThrottle={32}
      onContentSizeChange={() => { if (nearBottom.current) thread.current?.scrollToEnd({ animated: false }); }}>
      {hasStory ? <MarkdownText style={[styles.question, { color: tokens.text.primary }]}>{t('recording.conversation.welcome')}</MarkdownText> : null}
      {sections.map((section, index) => section.text.trim() ? <React.Fragment key={index}>
        {section.question ? <MarkdownText style={[styles.question, { color: tokens.text.primary }]}>{section.question}</MarkdownText> : null}
        <Pressable onPress={props.onReview} disabled={locked || !!props.review} accessibilityRole="button" accessibilityLabel={t('recording.tell.edit')}
          style={[styles.bubble, { backgroundColor: tokens.surface.raised, borderColor: tokens.surface.border }]} testID="capture-chat-user">
          <Text selectable style={[styles.message, { color: tokens.text.primary }]} testID={index === 0 ? 'recording-voice-preview' : undefined}>{section.text.trim()}</Text>
        </Pressable>
      </React.Fragment> : null)}
      <MarkdownText accessibilityLiveRegion="polite" style={[styles.question, { color: tokens.text.primary }]} testID="recording-conversation-question">{currentQuestion}</MarkdownText>
      {props.loading ? <ActivityIndicator color={tokens.text.primary} accessibilityLabel={t('recording.conversation.thinking')} /> : null}
      {props.unavailable && !props.review ? <Text style={[styles.hint, { color: tokens.text.secondary }]}>{t('recording.conversation.offline')}</Text> : null}
      {props.review ? <CaptureConversationCard text={props.review.text} disabled={props.disabled || listening || preparing}
        pending={Boolean(props.answer.trim())} saved={!!props.saved} onChange={props.onReviewChange ?? (() => {})}
        onSave={props.onSave ?? (() => {})} onExit={props.onExitReview ?? (() => {})} onOpen={props.onOpenSaved ?? (() => {})}
        /> : null}
    </ScrollView>
    {props.needsDecision && !props.review ? <Pressable onPress={() => { void props.onContinueQuestions?.(); }} disabled={locked || props.loading}
      accessibilityRole="button" style={styles.secondary} testID="recording-conversation-continue-questions">
      <Text style={[styles.hint, { color: tokens.text.primary }]}>{t('recording.conversation.continue_questions')}</Text>
    </Pressable> : null}
    {!props.review && (hasStory || props.answer.trim()) ? <View style={styles.tools}>
      <Pressable onPress={props.onRestart} disabled={locked} accessibilityRole="button" accessibilityLabel={t('recording.conversation.restart')}
        style={styles.tool} testID="recording-conversation-restart"><IconSymbol name="trash" size={18} color={tokens.text.secondary} /></Pressable>
      {props.onFinish ? <Pressable onPress={props.onFinish} disabled={locked || props.loading || props.finishDisabled} accessibilityRole="button"
        style={styles.secondary} testID="recording-conversation-finish"><Text style={[styles.hint, { color: tokens.text.primary }]}>{t('recording.conversation.done')}</Text></Pressable> : null}
    </View> : null}
    {listening ? <Text accessibilityLiveRegion="polite" style={[styles.hint, { color: tokens.text.secondary }]} testID="recording-listening-status">{t('recording.conversation.listening')}</Text> : null}
    {props.saved ? <Pressable onPress={props.onNewCapture} disabled={props.disabled} accessibilityRole="button"
      style={[styles.newCapture, { borderColor: tokens.surface.border }]} testID="capture-review-new">
      <Text style={[styles.message, { color: tokens.text.primary }]}>{t('recording.chat.new')}</Text>
    </Pressable> : <RecordingTextInput chat compact autoFocus={false} value={props.answer} onChange={props.onAnswerChange}
      disabled={locked || props.loading || listening} instructionText="" lengthWarning="" voiceSupported={props.voiceSupported}
      voiceStatus={props.voiceStatus} switchToVoiceLabel={t('recording.conversation.reply_voice')} onSwitchToVoice={() => { void onVoice(); }}
      placeholder={t(props.review ? 'recording.chat.add_detail' : 'recording.conversation.answer_placeholder')}
      inputAccessibilityLabel={t('recording.conversation.answer_placeholder')} inputTestID="recording-conversation-answer"
      footerActions={<>
        {props.voiceSupported ? <Pressable onPress={() => { void onVoice(); }} disabled={locked || props.loading}
          accessibilityRole="button" accessibilityLabel={voiceLabel} accessibilityState={{ disabled: locked || props.loading, busy: preparing }}
          style={[styles.control, { borderColor: tokens.surface.border, opacity: locked || props.loading ? 0.4 : 1 }]} testID={TID.Button.RecordToggle}>
          <IconSymbol name={listening ? 'stop.fill' : 'mic.fill'} size={20} color={tokens.text.primary} />
        </Pressable> : null}
        <Pressable onPress={() => { void submit(); }} disabled={submitDisabled} accessibilityRole="button"
          accessibilityLabel={t('recording.chat.send')} accessibilityState={{ disabled: submitDisabled, busy: switching }}
          style={[styles.control, { backgroundColor: tokens.action.primary, borderColor: tokens.action.primary, opacity: submitDisabled ? 0.4 : 1 }]}
          testID="recording-conversation-submit"><IconSymbol name="arrow.up" size={22} color={tokens.action.primaryText} /></Pressable>
      </>} />}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, width: '100%', maxWidth: 512, alignSelf: 'center', gap: 10 },
  compact: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  thread: { flex: 1, minHeight: 0 },
  threadCompact: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  messages: { gap: 18, paddingTop: 6, paddingBottom: 12 },
  question: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 16, lineHeight: 24 },
  bubble: { maxWidth: '86%', alignSelf: 'flex-end', borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14 },
  message: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 16, lineHeight: 24 },
  hint: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 13, lineHeight: 20 },
  tools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tool: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  newCapture: { minHeight: 82, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  control: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
