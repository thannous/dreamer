import { Composer } from '@/components/chat/Composer';
import { computeNextInputAfterSend } from '@/lib/chat/composerUtils';
import { TID } from '@/lib/testIDs';
import React, { forwardRef, useImperativeHandle, useState } from 'react';

export type ChatComposerHandle = {
  clearSentText: (sentText: string) => void;
};

type ChatComposerProps = {
  onSendText: (text: string) => void;
  placeholder: string;
  isLoading: boolean;
  isDisabled: boolean;
  transcriptionLocale: string;
  footer: React.ReactNode;
  header: React.ReactNode;
};

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  { onSendText, placeholder, isLoading, isDisabled, transcriptionLocale, footer, header },
  ref
) {
  const [draft, setDraft] = useState('');

  useImperativeHandle(ref, () => ({
    clearSentText: (sentText) => {
      setDraft((current) => computeNextInputAfterSend(current, sentText));
    },
  }), []);

  return (
    <Composer.Root
      value={draft}
      onChangeText={setDraft}
      onSend={(text) => onSendText(text?.trim() || draft.trim())}
      placeholder={placeholder}
      isLoading={isLoading}
      isDisabled={isDisabled}
      transcriptionLocale={transcriptionLocale}
      testID={TID.Chat.Input}
      micTestID={TID.Chat.Mic}
      sendTestID={TID.Chat.Send}
    >
      <Composer.Footer>{footer}</Composer.Footer>
      <Composer.Header>{header}</Composer.Header>
      <Composer.Body>
        <Composer.Input />
        <Composer.MicButton />
        <Composer.SendButton />
      </Composer.Body>
    </Composer.Root>
  );
});
