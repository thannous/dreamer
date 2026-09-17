import * as Crypto from 'expo-crypto';

import {
  MAX_LUCID_MORNING_VOICE_DURATION_MS,
  MAX_LUCID_MORNING_VOICE_TITLE_LENGTH,
  assertLucidMorningVoiceNote,
  canLucidMorningVoiceCapture,
  classifyLucidMorningVoiceFailure,
  createIdleLucidMorningVoiceCaptureState,
  createLucidMorningVoiceNote,
  createLucidMorningVoiceNoteId,
  extensionFromLucidMorningVoiceUri,
  isLocalLucidMorningVoiceUri,
  isLucidMorningVoiceNote,
  linkLucidMorningVoiceNoteToExperiment,
  mimeTypeForLucidMorningVoiceExtension,
  parseLucidMorningVoiceNote,
  renameLucidMorningVoiceNote,
  transitionLucidMorningVoiceCapture,
  withLucidMorningVoiceNoteTranscript,
  LucidMorningVoiceNoteError,
  type LucidMorningVoiceCaptureState,
  type LucidMorningVoiceNote,
} from '@/lib/lucid/morningVoiceNote';

const NOW = Date.UTC(2026, 7, 28, 7, 15, 0);

function recordingDraft(overrides: Partial<LucidMorningVoiceNote> = {}): LucidMorningVoiceNote {
  return createLucidMorningVoiceNote({
    id: 'mvn_recording_draft01',
    userScope: 'guest',
    status: 'draft',
    title: 'Morning capture',
    transcript: null,
    durationMs: 1_200,
    mimeType: 'audio/mp4',
    extension: '.m4a',
    uri: 'file:///data/user/0/app/files/lucid/morning-voice/mvn_recording_draft01.m4a',
    createdAt: NOW,
    updatedAt: NOW,
    recoverable: true,
    now: NOW,
    ...overrides,
  });
}

function apply(
  events: Parameters<typeof transitionLucidMorningVoiceCapture>[1][],
  start: LucidMorningVoiceCaptureState = createIdleLucidMorningVoiceCaptureState()
): LucidMorningVoiceCaptureState {
  return events.reduce(
    (state, event) =>
      transitionLucidMorningVoiceCapture(state, event, { noteId: 'mvn_recording_draft01' }),
    start
  );
}

describe('Lucid morning voice-note domain', () => {
  it('creates a valid local recording draft without cloud or upload fields', () => {
    const note = recordingDraft();
    expect(note.status).toBe('draft');
    expect(note.recoverable).toBe(true);
    expect(note.experimentId).toBeNull();
    expect(note.transcript).toBeNull();
    expect(note.uri.startsWith('file://')).toBe(true);
    expect(isLucidMorningVoiceNote(note)).toBe(true);
    expect(JSON.stringify(note)).not.toMatch(/upload|cloud|sync|remoteUrl/i);
    expect('upload' in note).toBe(false);
    expect('cloud' in note).toBe(false);
    expect('sync' in note).toBe(false);
  });

  it('uses collision-resistant default ids and injectable entropy', () => {
    const injected = createLucidMorningVoiceNoteId(NOW, 'local');
    const again = createLucidMorningVoiceNoteId(NOW, 'local');
    expect(injected).toBe(again);
    expect(injected).toBe(`mvn_${NOW.toString(36)}_local`);
    expect(injected.length).toBeLessThanOrEqual(64);

    const uuids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
    jest.mocked(Crypto.randomUUID).mockImplementation(() => uuids.shift() ?? '33333333-3333-4333-8333-333333333333');
    const first = createLucidMorningVoiceNoteId(NOW);
    const second = createLucidMorningVoiceNoteId(NOW);
    expect(first).not.toBe(second);
    expect(first).toContain('11111111-1111-4111-8111-111111111111');
    expect(second).toContain('22222222-2222-4222-8222-222222222222');
    expect(first).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/);
    expect(second).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/);
    expect(first.length).toBeLessThanOrEqual(64);
    expect(isLucidMorningVoiceNote({ ...recordingDraft(), id: first })).toBe(true);
  });

  it('pauses and resumes from recording, then stops to ready', () => {
    const paused = apply(['create', 'request_permission', 'permission_granted', 'pause']);
    expect(paused.phase).toBe('paused');
    expect(canLucidMorningVoiceCapture('resume', paused.phase)).toBe(true);

    const recording = transitionLucidMorningVoiceCapture(paused, 'resume');
    expect(recording.phase).toBe('recording');

    const readyCapture = apply(['stop', 'persist_ready'], recording);
    expect(readyCapture.phase).toBe('stopped');
    expect(readyCapture.errorReason).toBeNull();

    const ready = createLucidMorningVoiceNote({
      ...recordingDraft(),
      status: 'ready',
      recoverable: false,
      durationMs: 4_800,
    });
    expect(ready.status).toBe('ready');
    expect(ready.recoverable).toBe(false);
    expect(ready.durationMs).toBe(4_800);
  });

  it('accepts a zero-duration interrupted draft and rejects a zero-duration ready note', () => {
    const draft = recordingDraft({ durationMs: 0, status: 'draft', recoverable: true });
    expect(draft.durationMs).toBe(0);
    expect(draft.status).toBe('draft');
    expect(() =>
      createLucidMorningVoiceNote({
        ...recordingDraft(),
        status: 'ready',
        recoverable: false,
        durationMs: 0,
      })
    ).toThrow(expect.objectContaining({ reason: 'invalid_duration' }));
  });

  it('turns an interruption into a recoverable draft', () => {
    const interrupted = apply([
      'create',
      'request_permission',
      'permission_granted',
      'interrupt',
    ]);
    expect(interrupted.phase).toBe('interrupted');
    expect(interrupted.errorReason).toBe('interrupted');

    const recoverable = transitionLucidMorningVoiceCapture(interrupted, 'persist_draft');
    expect(recoverable.phase).toBe('recoverable');

    const draft = recordingDraft({ recoverable: true, status: 'draft', durationMs: 0 });
    expect(draft.recoverable).toBe(true);
    expect(draft.status).toBe('draft');
    expect(draft.durationMs).toBe(0);
  });

  it('renames, edits optional multiline transcript, then links an experiment id', () => {
    const renamed = renameLucidMorningVoiceNote(
      recordingDraft(),
      '  Recalled\n  dream  ',
      NOW + 1
    );
    expect(renamed.title).toBe('Recalled dream');
    expect(renamed.updatedAt).toBeGreaterThan(renamed.createdAt);

    const withTranscript = withLucidMorningVoiceNoteTranscript(
      renamed,
      '  I noticed\nmy   hands  ',
      NOW + 2
    );
    expect(withTranscript.transcript).toBe('I noticed my hands');
    const cleared = withLucidMorningVoiceNoteTranscript(withTranscript, '   ', NOW + 3);
    expect(cleared.transcript).toBeNull();
    expect(() =>
      withLucidMorningVoiceNoteTranscript(cleared, 'bad\u0007control', NOW + 4)
    ).toThrow(expect.objectContaining({ reason: 'invalid_metadata' }));

    const linked = linkLucidMorningVoiceNoteToExperiment(
      cleared,
      'exp_morning_link01',
      NOW + 4
    );
    expect(linked.experimentId).toBe('exp_morning_link01');
  });

  it('keeps updatedAt monotonic even when now is older', () => {
    const later = renameLucidMorningVoiceNote(recordingDraft(), 'Later title', NOW + 50);
    expect(later.updatedAt).toBe(NOW + 50);
    const renamed = renameLucidMorningVoiceNote(later, 'Still later', NOW + 10);
    expect(renamed.updatedAt).toBe(NOW + 50);
    const linked = linkLucidMorningVoiceNoteToExperiment(renamed, 'exp_morning_link02', NOW);
    expect(linked.updatedAt).toBe(NOW + 50);
    const transcribed = withLucidMorningVoiceNoteTranscript(linked, 'kept', NOW + 1);
    expect(transcribed.updatedAt).toBe(NOW + 50);
  });

  it('rejects impossible transitions and invalid capture details', () => {
    expect(() =>
      transitionLucidMorningVoiceCapture(createIdleLucidMorningVoiceCaptureState(), 'pause')
    ).toThrow(LucidMorningVoiceNoteError);
    try {
      transitionLucidMorningVoiceCapture(createIdleLucidMorningVoiceCaptureState(), 'resume');
    } catch (error) {
      expect(error).toBeInstanceOf(LucidMorningVoiceNoteError);
      expect((error as LucidMorningVoiceNoteError).reason).toBe('invalid_transition');
    }
    expect(canLucidMorningVoiceCapture('persist_ready', 'recording')).toBe(false);
    expect(() =>
      transitionLucidMorningVoiceCapture(createIdleLucidMorningVoiceCaptureState(), 'create', {
        noteId: 'bad',
      })
    ).toThrow(expect.objectContaining({ reason: 'invalid_id' }));
    expect(() =>
      transitionLucidMorningVoiceCapture(
        { phase: 'created', noteId: 'mvn_recording_draft01', errorReason: null },
        'fail',
        { errorReason: 'not-a-reason' as never }
      )
    ).toThrow(expect.objectContaining({ reason: 'invalid_metadata' }));
  });

  it('enforces duration, title and timestamp bounds', () => {
    expect(() =>
      createLucidMorningVoiceNote({
        ...recordingDraft(),
        status: 'ready',
        recoverable: false,
        durationMs: 0,
      })
    ).toThrow(expect.objectContaining({ reason: 'invalid_duration' }));
    expect(() =>
      createLucidMorningVoiceNote({
        ...recordingDraft(),
        durationMs: MAX_LUCID_MORNING_VOICE_DURATION_MS + 1,
      })
    ).toThrow(LucidMorningVoiceNoteError);
    expect(() =>
      createLucidMorningVoiceNote({ ...recordingDraft(), title: '   ' })
    ).toThrow(expect.objectContaining({ reason: 'invalid_title' }));
    expect(() =>
      createLucidMorningVoiceNote({
        ...recordingDraft(),
        title: 'x'.repeat(MAX_LUCID_MORNING_VOICE_TITLE_LENGTH + 1),
      })
    ).toThrow(LucidMorningVoiceNoteError);
    expect(() =>
      createLucidMorningVoiceNote({
        ...recordingDraft(),
        createdAt: NOW + 10,
        updatedAt: NOW,
      })
    ).toThrow(expect.objectContaining({ reason: 'invalid_metadata' }));
  });

  it('rejects unsafe URIs and mismatched MIME/extension/URI suffixes', () => {
    expect(isLocalLucidMorningVoiceUri('https://cdn.example/note.m4a')).toBe(false);
    expect(isLocalLucidMorningVoiceUri('content://media/external/audio/1')).toBe(false);
    expect(() =>
      createLucidMorningVoiceNote({
        ...recordingDraft(),
        uri: 'https://example.com/voice.m4a',
      })
    ).toThrow(expect.objectContaining({ reason: 'invalid_uri' }));
    expect(
      parseLucidMorningVoiceNote({
        ...recordingDraft(),
        mimeType: 'application/octet-stream',
      })
    ).toBeNull();
    expect(
      parseLucidMorningVoiceNote({
        ...recordingDraft(),
        extension: '.exe',
      })
    ).toBeNull();
    expect(
      parseLucidMorningVoiceNote({
        ...recordingDraft(),
        extension: '.wav',
        mimeType: 'audio/mp4',
      })
    ).toBeNull();
    expect(
      parseLucidMorningVoiceNote({
        ...recordingDraft(),
        uri: 'file:///tmp/note.caf',
        extension: '.m4a',
        mimeType: 'audio/mp4',
      })
    ).toBeNull();
    expect(() =>
      createLucidMorningVoiceNote({
        ...recordingDraft(),
        uri: 'file:///tmp/note.caf',
        extension: '.m4a',
        mimeType: 'audio/mp4',
      })
    ).toThrow(expect.objectContaining({ reason: 'invalid_uri' }));
    expect(extensionFromLucidMorningVoiceUri('file:///tmp/note.caf')).toBe('.caf');
    expect(mimeTypeForLucidMorningVoiceExtension('.caf')).toBe('audio/x-caf');
  });

  it('recovers from corrupted persisted data instead of accepting it', () => {
    expect(parseLucidMorningVoiceNote('{not-json')).toBeNull();
    expect(parseLucidMorningVoiceNote(null)).toBeNull();
    expect(
      parseLucidMorningVoiceNote({
        ...recordingDraft(),
        version: 99,
      })
    ).toBeNull();
    expect(
      parseLucidMorningVoiceNote({
        ...recordingDraft(),
        uploadUrl: 'https://example.com/note.m4a',
      })
    ).toBeNull();
    expect(
      parseLucidMorningVoiceNote({
        ...recordingDraft(),
        status: 'ready',
        recoverable: true,
      })
    ).toBeNull();
    expect(() => assertLucidMorningVoiceNote({ id: 'bad' })).toThrow(
      expect.objectContaining({ reason: 'invalid_metadata' })
    );
  });

  it('classifies storage and recorder failures without inventing cloud sync', () => {
    expect(classifyLucidMorningVoiceFailure(new Error('ENOSPC: no space left'))).toBe(
      'storage_full'
    );
    expect(classifyLucidMorningVoiceFailure(new Error('media services reset'))).toBe(
      'interrupted'
    );
    expect(classifyLucidMorningVoiceFailure(new Error('permission denied'))).toBe(
      'permission_denied'
    );
    expect(
      classifyLucidMorningVoiceFailure(new LucidMorningVoiceNoteError('persistence_failed'))
    ).toBe('persistence_failed');
  });
});
