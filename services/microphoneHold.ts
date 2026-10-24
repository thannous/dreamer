let holds = 0;

/**
 * Marks the microphone as recording until the returned release runs, which it does once.
 * Android records without a dictation session when speech recognition is missing, so the
 * dictation state alone cannot tell the app's cues to leave the audio session alone.
 */
export function holdMicrophone(): () => void {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
  };
}

/** Whether a recording of the app's holds the microphone now. */
export function isMicrophoneHeld(): boolean {
  return holds > 0;
}
