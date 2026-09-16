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
  const [typing, setTyping] = useState(false);
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
    setTyping(false);
    props.onVoice();
  };

  const mute = async () => {
    setSwitching(true);
    try { await props.onMute(); } finally { setSwitching(false); }
  };
  const writeAnswer = async () => {
    setSwitching(true);
    try {
      if (listening) await props.onMute();
      setTyping(true);
    } finally {
      setSwitching(false);
    }
  };
  const submitAnswer = async () => {
    setSwitching(true);
    try {
      await props.onAnswerSubmit();
      setTyping(false);
      Keyboard.dismiss();
    } finally {
      setSwitching(false);
    }
  };
  const editingAnswer = typing || !props.voiceSupported;
  const submitDisabled = locked || props.loading || !answer.trim();
  const showAnswerEditor = editingAnswer || answer.length > 0;

  return (
    <View style={styles.container} testID="recording-conversation">
      <View style={styles.questionBlock}>
        <Text accessibilityLiveRegion="polite" style={[styles.question, { color: tokens.text.primary }]} testID="recording-conversation-question">
          {props.loading ? t('recording.conversation.thinking')
            : props.done ? t('recording.conversation.ready')
            : props.question ?? t(props.storyTranscript.trim() ? 'dream_recall.question.what_else' : 'recording.conversation.welcome')}
        </Text>
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
      {!props.done ? (
        <View style={styles.replyArea}>
          {!showAnswerEditor ? (
            <View style={styles.voiceControls}>
              <Pressable
                testID={TID.Button.RecordToggle}
                onPress={listening ? mute : props.onVoice}
                disabled={locked || props.loading}
                accessibilityRole="button"
                accessibilityLabel={voiceLabel}
                accessibilityState={{ disabled: locked || props.loading, busy: preparing }}
              >
                <View
                  // Keep the native icon parent stable as disabled opacity changes.
                  collapsable={false}
                  style={[styles.mic, { backgroundColor: tokens.action.primary, opacity: locked || props.loading ? 0.5 : 1 }]}
                >
                  <IconSymbol name={listening ? 'stop.fill' : 'mic.fill'} size={32} color={tokens.action.primaryText} />
                </View>
              </Pressable>
              <Pressable
                onPress={writeAnswer}
                disabled={locked || props.loading}
                accessibilityRole="button"
                accessibilityLabel={t('recording.conversation.type')}
                style={[styles.secondaryButton, { borderColor: tokens.surface.border, opacity: locked || props.loading ? 0.5 : 1 }]}
                testID="recording-conversation-type"
              >
                <IconSymbol name="pencil" size={22} color={tokens.accent.text} />
              </Pressable>
            </View>
          ) : null}
          {showAnswerEditor ? (
            <View style={styles.answerSection}>
              <Text style={[styles.small, { color: tokens.text.secondary }]}>{t('recording.conversation.current_answer')}</Text>
              <RecordingTextInput
                key={typing ? 'editing' : 'preview'}
                compact
                autoFocus={typing}
                value={answer}
                onChange={props.onAnswerChange}
                disabled={locked || props.loading || listening}
                instructionText=""
                lengthWarning=""
                voiceSupported={props.voiceSupported && editingAnswer}
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
                      accessibilityLabel={t('recording.conversation.stop')}
                      accessibilityState={{ disabled: submitDisabled, busy: switching }}
                      style={[styles.editorAction, { backgroundColor: tokens.action.primary, borderColor: tokens.action.primary, opacity: submitDisabled ? 0.4 : 1 }]}
                      testID="recording-conversation-submit"
                    >
                      <IconSymbol name="arrow.up" size={24} color={tokens.action.primaryText} />
                    </Pressable>
                  </>
                }
                placeholder={t('recording.conversation.answer_placeholder')}
                inputAccessibilityLabel={t('recording.conversation.answer_placeholder')}
                inputTestID="recording-conversation-answer"
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {props.storyTranscript.trim() ? (
        <View style={[styles.recap, { backgroundColor: tokens.surface.raised, borderColor: tokens.surface.border }]}>
          <View style={styles.recapHeader}>
            <Pressable
              onPress={props.onReview}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={t('recording.tell.edit')}
              accessibilityState={{ disabled: locked }}
              style={styles.recapEdit}
            >
              <Text style={[styles.small, { color: tokens.text.secondary }]}>{t('recording.conversation.your_story')}</Text>
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
  restartButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  recapEdit: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  questionBlock: { gap: 8 },
  question: { fontSize: 25, lineHeight: 33, fontWeight: '500', letterSpacing: -0.4 },
  hint: { fontSize: 15, lineHeight: 22 },
  answerSection: { width: '100%', gap: 8 },
  replyArea: { width: '100%', alignItems: 'center', gap: 16 },
  voiceControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  mic: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  editorAction: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  recap: { width: '100%', minHeight: 144, borderRadius: 22, borderWidth: 1, padding: 18, gap: 14 },
  recapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  small: { fontSize: 15, lineHeight: 21, flexShrink: 1 },
  story: { fontSize: 16, lineHeight: 24, fontFamily: Fonts.lora.regularItalic },
});
