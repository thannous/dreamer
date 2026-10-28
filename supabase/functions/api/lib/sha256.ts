const encoder = new TextEncoder();

/** Lowercase hex SHA-256 of the text's UTF-8 bytes. Stored hashes are compared in this exact form. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
