import { MarkdownText } from '@/components/ui/MarkdownText';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTranslation } from '@/hooks/useTranslation';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TID } from '@/lib/testIDs';
import type { MicButtonStatus } from './MicButton';
import { RecordingTextInput } from './RecordingTextInput';
import { Fonts } from '@/constants/theme';

type Props = {
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
  const answer = props.answer;
  const [switching, setSwitching] = useState(false);
  const hasText = Boolean(props.transcript.trim());
  const listening = props.voiceStatus === 'recording';
  const preparing = props.voiceStatus === 'preparing';
  const locked = props.disabled || preparing || switching;
  const voiceLabel = preparing ? t('recording.status.preparing.title')
    : listening ? t('recording.conversation.mute')
    : hasText ? t('recording.conversation.reply') : t('recording.conversation.begin');
  const continueWithVoice = () => {
    // Typed edits have already been persisted through onAnswerChange.
    Keyboard.dismiss();
    props.onVoice();
  };

  const mute = async () => {
    setSwitching(true);
    try { await props.onMute(); } finally { setSwitching(false); }
  };
  const submitAnswer = async () => {
    setSwitching(true);
    try {
      await props.onAnswerSubmit();
      Keyboard.dismiss();
    } finally {
      setSwitching(false);
    }
  };
  const submitDisabled = locked || props.loading || !answer.trim();

  return (
    <View style={styles.container} testID="recording-conversation">
      <View style={styles.questionBlock}>
        <MarkdownText accessibilityLiveRegion="polite" style={[styles.question, { color: tokens.text.primary }]} testID="recording-conversation-question">
          {props.loading ? t('recording.conversation.thinking')
            : props.done ? t('recording.conversation.ready')
            : props.needsDecision ? t('recording.conversation.edited')
            : props.question ?? t(props.storyTranscript.trim() ? 'dream_recall.question.what_else' : 'recording.conversation.welcome')}
        </MarkdownText>
        {listening ? (
          <Text accessibilityLiveRegion="polite" style={[styles.hint, { color: tokens.text.secondary }]} testID="recording-listening-status">
            {t('recording.conversation.listening')}
          </Text>
        ) : null}
        {props.unavailable ? (
          <Text style={[styles.hint, { color: tokens.text.secondary }]}>
            {t('recording.conversation.offline')}
          </Text>
        ) : null}
      </View>
      {props.loading ? <ActivityIndicator color={tokens.accent.text} accessibilityLabel={t('recording.conversation.thinking')} /> : null}
      {props.needsDecision ? (
        <View style={styles.choiceArea}>
          <Text style={[styles.hint, { color: tokens.text.secondary }]}>{t('recording.conversation.edited_hint')}</Text>
          <Pressable onPress={() => { void props.onContinueQuestions?.(); }} disabled={locked || props.loading}
            accessibilityRole="button" accessibilityState={{ disabled: locked || props.loading }}
            style={[styles.choiceButton, { borderColor: tokens.surface.border }]}
            testID="recording-conversation-continue-questions">
            <Text style={[styles.small, { color: tokens.text.primary }]}>{t('recording.conversation.continue_questions')}</Text>
          </Pressable>
        </View>
      ) : null}
      {!props.done && !props.needsDecision ? (
        <View style={styles.replyArea}>
          <View style={styles.answerSection}>
            <RecordingTextInput
              compact
              autoFocus={false}
              value={answer}
              onChange={props.onAnswerChange}
              disabled={locked || props.loading || listening}
              instructionText=""
              lengthWarning=""
              voiceSupported={props.voiceSupported}
              voiceStatus={props.voiceStatus}
              switchToVoiceLabel={t('recording.conversation.reply_voice')}
              onSwitchToVoice={continueWithVoice}
              footerActions={
                <>
                  {props.voiceSupported ? (
                    <Pressable
                      onPress={listening ? mute : continueWithVoice}
                      disabled={locked || props.loading}
                      accessibilityRole="button"
                      accessibilityLabel={voiceLabel}
                      accessibilityState={{ disabled: locked || props.loading, busy: preparing }}
                      style={[styles.editorAction, { borderColor: tokens.surface.border, opacity: locked || props.loading ? 0.4 : 1 }]}
                      testID={TID.Button.RecordToggle}
                    >
                      <IconSymbol name={listening ? 'stop.fill' : 'mic.fill'} size={22} color={tokens.text.primary} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={submitAnswer}
                    disabled={submitDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={t('recording.conversation.send')}
                    accessibilityState={{ disabled: submitDisabled, busy: switching }}
                    style={[styles.editorAction, styles.continueButton, { backgroundColor: tokens.action.primary, borderColor: tokens.action.primary, opacity: submitDisabled ? 0.4 : 1 }]}
                    testID="recording-conversation-submit"
                  >
                    <Text style={[styles.small, { color: tokens.action.primaryText }]}>{t('recording.conversation.send')}</Text>
                    <IconSymbol name="arrow.right" size={20} color={tokens.action.primaryText} />
                  </Pressable>
                </>
              }
              placeholder={t('recording.conversation.answer_placeholder')}
              inputAccessibilityLabel={t('recording.conversation.answer_placeholder')}
              inputTestID="recording-conversation-answer"
            />
          </View>
        </View>
      ) : null}
      {!props.done && props.storyTranscript.trim() && props.onFinish ? (
        <Pressable onPress={props.onFinish} disabled={locked} accessibilityRole="button"
          accessibilityState={{ disabled: locked }} style={styles.finishButton} testID="recording-conversation-finish">
          <Text style={[styles.small, { color: tokens.accent.text }]}>{t('recording.conversation.done')}</Text>
        </Pressable>
      ) : null}
      {props.storyTranscript.trim() ? (
        <View style={[styles.recap, { borderTopColor: tokens.surface.border }]}>
          <View style={styles.recapHeader}>
            <Pressable
              onPress={props.onReview}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={t('recording.tell.edit')}
              accessibilityState={{ disabled: locked }}
              style={styles.recapEdit}
            >
              <Text style={[styles.storyTitle, { color: tokens.text.primary }]}>{t('recording.conversation.your_story')}</Text>
              <IconSymbol name="pencil" size={20} color={tokens.accent.text} />
            </Pressable>
            <Pressable
              onPress={props.onRestart}
              accessibilityLabel={t('recording.conversation.restart')}
              disabled={locked}
              accessibilityRole="button"
              accessibilityState={{ disabled: locked }}
              style={[styles.restartButton, { opacity: locked ? 0.4 : 1 }]}
              testID="recording-conversation-restart"
            >
              <IconSymbol name="trash" size={20} color={tokens.text.secondary} />
            </Pressable>
          </View>
          <Pressable
            onPress={props.onReview}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={t('recording.tell.edit')}
            accessibilityState={{ disabled: locked }}
            testID="recording-review-transcript"
          >
            <Text style={[styles.story, { color: tokens.text.primary }]} testID="recording-voice-preview">{props.storyTranscript}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 512, alignSelf: 'center', gap: 20, paddingTop: 4 },
  choiceArea: { gap: 12 },
  choiceButton: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, alignItems: 'center' },
  finishButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  continueButton: { width: 'auto', minWidth: 48, flexDirection: 'row', gap: 8, paddingHorizontal: 14, flexShrink: 1 },
  restartButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  recapEdit: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  questionBlock: { gap: 8 },
  question: { fontSize: 25, lineHeight: 33, fontWeight: '500', letterSpacing: -0.4 },
  hint: { fontSize: 15, lineHeight: 22 },
  answerSection: { width: '100%', gap: 8 },
  replyArea: { width: '100%', alignItems: 'center', gap: 16 },
  editorAction: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  recap: { width: '100%', borderTopWidth: 1, marginTop: 8, paddingTop: 16, paddingBottom: 8, gap: 12 },
  storyTitle: { fontSize: 22, lineHeight: 29, fontFamily: Fonts.lora.regular, flexShrink: 1 },
  recapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  small: { fontSize: 15, lineHeight: 21, flexShrink: 1 },
  story: { fontSize: 17, lineHeight: 28, fontFamily: Fonts.lora.regular },
});
