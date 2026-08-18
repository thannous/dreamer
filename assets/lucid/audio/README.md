# Lucid Trainer notification cues

These three original cue timbres are generated locally with FFmpeg. Each has
three native amplitude variants (`very_low`, `low`, and `gentle`) so the app
does not pretend that notification volume can be changed at runtime. All nine
files are mono, 16 kHz, 16-bit PCM WAV files lasting 1.2 seconds (about 38 KB
each; about 338 KB total). Their peaks range from -33.6 to -23.5 dBFS, and every
cue is faded in/out to avoid a sharp onset.

They are used twice:

- by `expo-audio` for the conscious preview;
- by the `expo-notifications` config plugin as native notification sounds.

The selected volume is mapped to the same amplitude band for native scheduling
and preview (the preview is capped at the `low` band). Notification playback
still follows the device notification volume; the UI says so explicitly.
Replacing a sound or changing the `expo-notifications` sound list requires a
new native build.

Generation filters:

- rain: low-amplitude pink noise, 250 ms fade-in, 400 ms fade-out;
- ocean: low-amplitude 392 Hz tone, 300 ms fade-in, 450 ms fade-out;
- brown noise: low-amplitude brown noise filtered to 90–900 Hz, 250 ms fade-in,
  400 ms fade-out.
