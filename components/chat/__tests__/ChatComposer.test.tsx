/* @jest-environment jsdom */

import React, { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ChatComposer, type ChatComposerHandle } from '@/components/chat/ChatComposer';
import { TID } from '@/lib/testIDs';

jest.mock('@/components/chat/Composer', () => ({
  Composer: {
    Root: ({
      value,
      onChangeText,
      onSend,
      children,
      testID,
      sendTestID,
    }: {
      value: string;
      onChangeText: (text: string) => void;
      onSend: (text?: string) => void;
      children: React.ReactNode;
      testID: string;
      sendTestID: string;
    }) => (
      <div>
        <input
          data-testid={testID}
          value={value}
          onChange={(event) => onChangeText(event.currentTarget.value)}
        />
        <button data-testid={sendTestID} onClick={() => onSend()} />
        <button data-testid="voice-send" onClick={() => onSend('  Dicté  ')} />
        {children}
      </div>
    ),
    Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Footer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Input: () => null,
    MicButton: () => null,
    SendButton: () => null,
  },
}));

afterEach(cleanup);

describe('ChatComposer', () => {
  it('keeps typing updates within the composer while sending the current draft', () => {
    const parentRender = jest.fn();
    const listRender = jest.fn();
    const headerRender = jest.fn();
    const onSendText = jest.fn();
    const composerRef = createRef<ChatComposerHandle>();

    function ListProbe() {
      listRender();
      return <div data-testid="message-list" />;
    }
    function HeaderProbe() {
      headerRender();
      return <div data-testid="message-header" />;
    }
    function ScreenProbe() {
      parentRender();
      return (
        <>
          <ListProbe />
          <ChatComposer
            ref={composerRef}
            onSendText={onSendText}
            placeholder="Message"
            isLoading={false}
            isDisabled={false}
            transcriptionLocale="fr-FR"
            footer={null}
            header={<HeaderProbe />}
          />
        </>
      );
    }

    render(<ScreenProbe />);
    fireEvent.change(screen.getByTestId(TID.Chat.Input), { target: { value: 'Un' } });
    fireEvent.change(screen.getByTestId(TID.Chat.Input), { target: { value: 'Un rêve' } });

    expect((screen.getByTestId(TID.Chat.Input) as HTMLInputElement).value).toBe('Un rêve');
    expect(parentRender).toHaveBeenCalledTimes(1);
    expect(listRender).toHaveBeenCalledTimes(1);
    expect(headerRender).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId(TID.Chat.Send));
    expect(onSendText).toHaveBeenCalledWith('Un rêve');

    fireEvent.click(screen.getByTestId('voice-send'));
    expect(onSendText).toHaveBeenLastCalledWith('Dicté');

    act(() => composerRef.current?.clearSentText('Un rêve'));
    expect((screen.getByTestId(TID.Chat.Input) as HTMLInputElement).value).toBe('');
  });

  it('preserves a newer draft when an earlier send is cleared', () => {
    const composerRef = createRef<ChatComposerHandle>();
    render(
      <ChatComposer
        ref={composerRef}
        onSendText={jest.fn()}
        placeholder="Message"
        isLoading={false}
        isDisabled={false}
        transcriptionLocale="fr-FR"
        footer={null}
        header={null}
      />
    );

    fireEvent.change(screen.getByTestId(TID.Chat.Input), { target: { value: 'Premier' } });
    fireEvent.change(screen.getByTestId(TID.Chat.Input), { target: { value: 'Nouveau' } });
    act(() => composerRef.current?.clearSentText('Premier'));

    expect((screen.getByTestId(TID.Chat.Input) as HTMLInputElement).value).toBe('Nouveau');
  });
});
