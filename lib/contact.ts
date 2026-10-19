import { Alert, Linking } from 'react-native';

export const CONTACT_EMAIL = 'contact@noctalia.app';

export function buildContactMailto(subject?: string, body?: string): string {
  const query = [
    subject ? `subject=${encodeURIComponent(subject)}` : null,
    // RFC 6068 writes line breaks in a mailto body as CRLF.
    body ? `body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}` : null,
  ].filter(Boolean).join('&');
  return `mailto:${CONTACT_EMAIL}${query ? `?${query}` : ''}`;
}

/** Opens a message to the contact address; without a mail app, shows the address instead. */
export async function openContactMail(options: {
  subject?: string;
  body?: string;
  unavailableTitle: string;
  unavailableMessage: string;
}): Promise<void> {
  try {
    await Linking.openURL(buildContactMailto(options.subject, options.body));
  } catch {
    Alert.alert(options.unavailableTitle, options.unavailableMessage);
  }
}
