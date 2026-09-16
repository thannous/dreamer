import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTranslation } from '@/hooks/useTranslation';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TID } from '@/lib/testIDs';
import type { MicButtonStatus } from './MicButton';
import { RecordingTextInput } from './RecordingTextInput';

type Props = {
  transcript: string;
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
  onAnswerChange: (text: string) => void;
  onAnswerSubmit: () => void;
};

export function RecordingConversation(props: Props) {
  const { colors, mode } = useTheme();
  const tokens = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const [typing, setTyping] = useState(false);
  const [answer, setAnswer] = useState('');
  const [switching, setSwitching] = useState(false);
  const hasText = Boolean(props.transcript.trim());
  const listening = props.voiceStatus === 'recording';
  const preparing = props.voiceStatus === 'preparing';
  const locked = props.disabled || preparing || switching;
  const voiceLabel = preparing ? t('recording.status.preparing.title')
    : listening ? t('recording.conversation.stop')
    : hasText ? t('recording.conversation.reply') : t('recording.conversation.begin');
  const continueWithVoice = () => {
    // Typed edits have already been persisted through onAnswerChange.
    Keyboard.dismiss();
    setTyping(false);
    setAnswer('');
    props.onVoice();
  };

  return (
    <View style={styles.container} testID="recording-conversation">
      <View style={styles.questionBlock}>
        <View style={styles.speaker}>
          <IconSymbol name="sparkles" size={22} color={tokens.accent.text} />
          <Text style={[styles.speakerName, { color: tokens.text.secondary }]}>Noctalia</Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={[styles.question, { color: tokens.text.primary }]} testID="recording-conversation-question">
          {listening ? t('recording.conversation.listening') : props.loading ? t('recording.conversation.thinking')
            : props.done ? t('recording.conversation.ready')
            : props.question ?? t(hasText ? 'dream_recall.question.what_else' : 'recording.conversation.welcome')}
        </Text>
        {props.unavailable ? (
          <Text style={[styles.hint, { color: tokens.text.secondary }]}>
            {t('recording.conversation.offline')}
          </Text>
        ) : null}
      </View>
      {props.loading ? <ActivityIndicator color={tokens.accent.text} accessibilityLabel={t('recording.conversation.thinking')} /> : null}
      <View style={styles.replyArea}>
        <View style={!typing && props.voiceSupported ? styles.voiceControls : styles.typedReply}>
        {props.voiceSupported && !typing && !props.done ? (
          <Pressable
            testID={TID.Button.RecordToggle}
            onPress={props.onVoice}
            disabled={locked || props.loading}
            accessibilityRole="button"
            accessibilityLabel={voiceLabel}
            accessibilityState={{ disabled: locked || props.loading, busy: preparing }}
            style={styles.voiceAction}
          >
            <View
              // Keep the icon's native parent stable when saving/loading changes opacity.
              // Fabric can otherwise reparent it while the recording screen is removed.
              collapsable={false}
              style={[styles.mic, { backgroundColor: tokens.action.primary, opacity: locked || props.loading ? 0.5 : 1 }]}
            >
              <IconSymbol name={listening ? 'stop.fill' : 'mic.fill'} size={32} color={tokens.action.primaryText} />
            </View>
            <Text style={[styles.voiceLabel, { color: tokens.text.primary }]}>{voiceLabel}</Text>
          </Pressable>
        ) : null}
        {(typing || !props.voiceSupported) && !props.done ? (
          <View style={styles.typedReply}>
            <RecordingTextInput
              compact
              autoFocus={typing}
              value={answer}
              onChange={(text) => { setAnswer(text); props.onAnswerChange(text); }}
              disabled={locked || props.loading}
              instructionText=""
              lengthWarning=""
              voiceSupported={props.voiceSupported}
              voiceStatus={props.voiceStatus}
              switchToVoiceLabel={t('recording.conversation.reply_voice')}
              onSwitchToVoice={continueWithVoice}
              placeholder={t('recording.conversation.answer_placeholder')}
              inputAccessibilityLabel={t('recording.conversation.answer_placeholder')}
              inputTestID="recording-conversation-answer"
            />
            <Pressable
              disabled={locked || props.loading || !answer.trim()}
              accessibilityRole="button" onPress={() => { props.onAnswerSubmit(); setAnswer(''); setTyping(false); }}
              style={[styles.link, (locked || props.loading || !answer.trim()) && { opacity: 0.4 }]} testID="recording-conversation-submit"
            ><Text style={[styles.small, { color: tokens.accent.text }]}>{t('recording.conversation.send')}</Text></Pressable>
            {props.voiceSupported ? (
              <Pressable accessibilityRole="button" disabled={locked || props.loading} style={styles.link}
                onPress={continueWithVoice}>
                <Text style={[styles.small, { color: tokens.text.secondary }]}>{t('recording.conversation.reply_voice')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : !props.done ? (
          <View style={styles.secondaryActions}>
            <Pressable
              onPress={async () => {
                setSwitching(true);
                try {
                  if (listening) await props.onMute();
                  setTyping(true);
                  setAnswer('');
                } finally {
                  setSwitching(false);
                }
              }}
              disabled={locked || props.loading}
              accessibilityRole="button"
              accessibilityLabel={t('recording.conversation.type')}
              style={[styles.secondaryButton, { backgroundColor: tokens.surface.raised }]}
              testID="recording-conversation-type"
            >
              <IconSymbol name="pencil" size={20} color={tokens.text.secondary} />
            </Pressable>
            {listening ? (
              <Pressable
                onPress={async () => {
                  setSwitching(true);
                  try { await props.onMute(); } finally { setSwitching(false); }
                }}
                disabled={locked}
                accessibilityRole="button"
                accessibilityLabel={t('recording.conversation.mute')}
                style={[styles.secondaryButton, { backgroundColor: tokens.surface.raised }]}
                testID="recording-conversation-mute"
              >
                <IconSymbol name="mic.slash.fill" size={20} color={tokens.text.secondary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        </View>
      </View>
      {hasText ? (
        <View style={styles.recap}>
          <View style={styles.recapHeader}>
            <Text style={[styles.small, { color: tokens.text.secondary }]}>{t('recording.conversation.your_story')}</Text>
            <Pressable accessibilityRole="button" disabled={locked} onPress={props.onReview} style={styles.link} testID="recording-review-transcript">
              <Text style={[styles.small, { color: tokens.accent.text }]}>{t('recording.conversation.review')}</Text>
            </Pressable>
          </View>
          <View style={[styles.bubble, { backgroundColor: tokens.surface.raised }]}>
            <Text numberOfLines={4} style={[styles.story, { color: tokens.text.primary }]} testID="recording-voice-preview">{props.transcript}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 512, alignSelf: 'center', gap: 28, paddingTop: 12 },
  recap: { alignSelf: 'flex-end', width: '86%' },
  recapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  small: { fontSize: 15, lineHeight: 21 },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  bubble: { borderRadius: 22, padding: 18 },
  story: { fontSize: 16, lineHeight: 24 },
  questionBlock: { gap: 14, paddingHorizontal: 8 },
  speaker: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  speakerName: { fontSize: 15, lineHeight: 22 },
  question: { fontSize: 25, lineHeight: 33, fontWeight: '500', letterSpacing: -0.4 },
  hint: { fontSize: 15, lineHeight: 22 },
  replyArea: { alignItems: 'center', gap: 14, paddingVertical: 6 },
  voiceAction: { alignItems: 'center', gap: 10, flexShrink: 1 },
  mic: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  voiceLabel: { fontSize: 16, lineHeight: 23, fontWeight: '500', textAlign: 'center' },
  voiceControls: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  secondaryActions: { alignItems: 'center', gap: 10 },
  secondaryButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  typedReply: { width: '100%', gap: 8 },
});
