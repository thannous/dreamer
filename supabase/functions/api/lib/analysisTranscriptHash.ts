/** Binds one analysis authorization to the exact transcript bytes supplied. */
export async function hashAnalysisTranscript(transcript: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(transcript));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
