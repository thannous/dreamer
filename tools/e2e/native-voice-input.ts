import { connect } from 'node:http2';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { once } from 'node:events';

/** Public synthetic speech, generated locally; no user recording or expected-text injection. */
export const voiceFixtureUrl = new URL('../../assets/qa/dreamer-dictation-en.wav', import.meta.url);
export const voiceFixtureText = 'I walked beside a blue lighthouse. A golden boat crossed the quiet sea. I counted seven windows before I woke up.';

export function voiceInputUnavailable(platform: string): string | false {
  if (platform !== 'android') {
    return 'A verified audio loopback into the iOS Simulator microphone is not configured; this is not a passed dictation test.';
  }
  if (!process.env.E2E_VOICE_ANDROID_GRPC_PORT) {
    return 'Requires the owned Android emulator gRPC microphone input (E2E_VOICE_ANDROID_GRPC_PORT).';
  }
  return false;
}

function varint(value: number): Buffer {
  const bytes: number[] = [];
  do {
    const next = value % 128;
    value = Math.floor(value / 128);
    bytes.push(next | (value ? 128 : 0));
  } while (value);
  return Buffer.from(bytes);
}

function bytesField(field: number, bytes: Buffer): Buffer {
  return Buffer.concat([varint(field * 8 + 2), varint(bytes.length), bytes]);
}

function integerField(field: number, value: number): Buffer {
  return Buffer.concat([varint(field * 8), varint(value)]);
}

function microphonePcm(): Buffer {
  const wav = readFileSync(voiceFixtureUrl);
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('The voice fixture must be a RIFF WAV file.');
  }
  let formatValid = false;
  let pcm: Buffer | undefined;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const size = wav.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > wav.length) throw new Error('Truncated voice WAV fixture.');
    const kind = wav.toString('ascii', offset, offset + 4);
    if (kind === 'fmt ' && size >= 16) {
      formatValid = wav.readUInt16LE(start) === 1 && wav.readUInt16LE(start + 2) === 1
        && wav.readUInt32LE(start + 4) === 16000 && wav.readUInt16LE(start + 14) === 16;
    }
    if (kind === 'data') pcm = wav.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (!formatValid || !pcm?.length || pcm.length % 2 !== 0) {
    throw new Error('Voice input requires nonempty PCM16 mono 16kHz audio.');
  }
  // This is audio silence around the real speech, not a wait for UI state.
  return Buffer.concat([Buffer.alloc(16_000), pcm, Buffer.alloc(16_000)]);
}

/**
 * The installed Android emulator API documents EmulatorController.injectAudio:
 * client streaming AudioPacket { format: AudioFormat, audio: bytes }. Its default
 * delivery mode blocks at the microphone's consumption rate. Every 100ms packet
 * fits its 300ms buffer. No app hook, speech event or text result is substituted.
 *
 * The caller must bind the loopback port to the same owned E2E_DEVICE in its run
 * preparation. The bearer token stays private and is never an evidence field.
 */
export async function injectAndroidMicrophone(): Promise<void> {
  if (!/^emulator-\d+$/.test(process.env.E2E_DEVICE ?? '')) {
    throw new Error('Microphone injection requires the explicitly owned Android emulator.');
  }
  const port = Number(process.env.E2E_VOICE_ANDROID_GRPC_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('E2E_VOICE_ANDROID_GRPC_PORT must be the owned emulator loopback gRPC port.');
  }
  const pcm = microphonePcm();
  const source = readFileSync(voiceFixtureUrl);
  console.info(`Synthetic microphone fixture sha256=${createHash('sha256').update(source).digest('hex')} sampleRate=16000 channels=1 pcmBytes=${pcm.length}`);
  const tokenFile = process.env.E2E_VOICE_ANDROID_GRPC_TOKEN_FILE;
  const token = tokenFile ? readFileSync(tokenFile, 'utf8').trim() : undefined;
  if (token !== undefined && (!token || /[\r\n]/.test(token))) throw new Error('Invalid emulator gRPC token file.');
  const session = connect(`http://127.0.0.1:${port}`);
  // Handle connection errors on the request too, without an unhandled session event.
  let connectionError: Error | undefined;
  session.on('error', error => { connectionError = error; });
  const request = session.request({
    ':method': 'POST', ':path': '/android.emulation.control.EmulatorController/injectAudio',
    'content-type': 'application/grpc', te: 'trailers',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  });
  let grpcStatus: string | undefined;
  let httpStatus: number | undefined;
  request.on('response', headers => {
    httpStatus = Number(headers[':status']);
    if (headers['grpc-status'] !== undefined) grpcStatus = String(headers['grpc-status']);
  });
  request.on('trailers', headers => { grpcStatus = String(headers['grpc-status']); });
  request.resume();
  request.setTimeout(30_000, () => request.destroy(new Error('Emulator microphone injection timed out.')));
  const completed = once(request, 'end');
  // Register before sending to avoid a rejected promise while awaiting backpressure.
  void completed.catch(() => {});
  try {
    const format = Buffer.concat([integerField(1, 16000), integerField(2, 0), integerField(3, 1)]);
    for (let offset = 0; offset < pcm.length; offset += 3200) {
      const packet = Buffer.concat([bytesField(1, format), bytesField(3, pcm.subarray(offset, offset + 3200))]);
      const envelope = Buffer.alloc(5);
      envelope.writeUInt32BE(packet.length, 1);
      if (!request.write(Buffer.concat([envelope, packet]))) await once(request, 'drain');
    }
    request.end();
    await completed;
    if (connectionError) throw connectionError;
    if (httpStatus !== 200 || grpcStatus !== '0') {
      throw new Error(`Emulator microphone injection failed (HTTP ${httpStatus}, gRPC ${grpcStatus ?? 'missing'}).`);
    }
  } finally {
    request.destroy();
    session.destroy();
  }
}
