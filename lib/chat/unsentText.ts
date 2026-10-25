/** Only explicit composer input belongs in a draft, including when a send is retried. */
export function restoreUnsentChatText(
  composer: { restoreUnsentText: (text: string) => void } | null,
  userText?: string,
): void {
  if (userText !== undefined) composer?.restoreUnsentText(userText);
}
