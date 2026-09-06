import { projectLucidObservations, localLucidSignId, lucidObservationSourceId } from '../observations';
import { extractLucidDreamSignCandidates, reconcileLucidDreamSignDecisions } from '../dreamSigns';
import { buildLucidDreamAtlas } from '../dreamAtlas';
import { selectLucidMildRehearsalSource } from '../guidedRitual';
import { isLucidExperiment, isLucidPersistedDreamSignDecision, type LucidExperiment } from '../model';
import { selectLucidDreamRehearsalScene } from '../dreamRehearsal';

const observation = (id: string, occurredAt: number, text: string): LucidExperiment => ({
  id, occurredAt, updatedAt: occurredAt, technique: null, preparationMinutes: null,
  result: null, lucidityLevel: null, recallLevel: null, sleepQuality: null, factors: [],
  recallText: text, captureMode: 'write', cueOutcome: 'indeterminate',
});

describe('autonomous Lucid observations', () => {
  it.each([
    ['a'.repeat(64), 0],
    ['b'.repeat(128), 0.5],
    ['nom avec espaces:夢:🌙', Number.MIN_VALUE],
    ['colon:identifier', 8_640_000_000_000_000],
    ['fraction', 1_700_000_000_000.5],
  ])('keeps accepted observation %s usable through evidence, confirmation, atlas and rehearsal', (id, timestamp) => {
    const input = [observation(String(id), Number(timestamp), 'A mirror floated'), observation('second-' + String(id).slice(0, 100), Number(timestamp), 'The mirror floated')];
    expect(input.every(isLucidExperiment)).toBe(true);
    const sources = projectLucidObservations(input);
    expect(sources.every(source => source.id.length <= 64)).toBe(true);
    expect(new Set(sources.map(source => source.id)).size).toBe(2);
    const candidate = extractLucidDreamSignCandidates(sources).find(item => item.id === 'sign:mirror')!;
    const localCandidate = { ...candidate, id: localLucidSignId(candidate.id) };
    const decision = { id: localCandidate.id, decision: 'confirmed' as const, sourceDreamIds: candidate.sourceDreamIds, updatedAt: Number(timestamp) };
    expect(isLucidPersistedDreamSignDecision(decision)).toBe(true);
    const [sign] = reconcileLucidDreamSignDecisions([localCandidate], [decision]);
    const atlas = buildLucidDreamAtlas({ signs: [sign], dreams: sources });
    expect(atlas.nodes[0].sourceDreamIds).toHaveLength(2);
    expect(atlas.nodes[0].lastAppearanceAt).toBe(Number(timestamp));
    const active = [{ ...sign, label: sign.displayLabel }];
    expect(selectLucidMildRehearsalSource(sources, active)).not.toBeNull();
    expect(selectLucidDreamRehearsalScene(sources, active, sources[0].id, sign.id).status).toBe('ready');
    expect(projectLucidObservations(JSON.parse(JSON.stringify(input))).map(source => source.id)).toEqual(sources.map(source => source.id));
  });

  it('cannot inherit the confirmation of a legacy local-prefixed phrase', () => {
    expect(localLucidSignId('sign:mirror')).toBe('sign:lucid:mirror');
    expect(localLucidSignId('sign:mirror')).not.toBe('sign:local_mirror');
  });
  it('retains full text, notes, voice linkage and provenance across serialization without Journal fields', () => {
    const input = [{ ...observation('a', 100, 'Mirror '.repeat(300)), notes: 'My own note', voiceCapture: 'local_note' as const }];
    const [source] = projectLucidObservations(JSON.parse(JSON.stringify(input)));
    expect(source.transcript).toBe('Mirror '.repeat(300).trim() + '\n\nMy own note');
    expect(source.provenance).toEqual({ kind: 'lucid_observation', experimentId: 'a' });
    expect(source.id).toBe(lucidObservationSourceId('a', 100));
    expect(source).not.toHaveProperty('interpretation');
    expect(source.voiceCapture).toBe('local_note');
  });
  it('feeds evidence, atlas and rehearsal from local source ids without colliding with Journal timestamps', () => {
    const sources = projectLucidObservations([observation('a', 100, 'A mirror floated'), observation('b', 101, 'The mirror floated')]);
    const candidate = extractLucidDreamSignCandidates(sources).find(item => item.id === 'sign:mirror')!;
    expect(candidate.sourceDreamIds).toEqual([lucidObservationSourceId('a', 100), lucidObservationSourceId('b', 101)]);
    const sign = { ...candidate, decision: 'confirmed' as const, displayLabel: candidate.label };
    const atlas = buildLucidDreamAtlas({ signs: [sign], dreams: sources });
    expect(atlas.nodes[0].lastAppearanceAt).toBe(101);
    expect(selectLucidMildRehearsalSource(sources, [{ ...candidate, label: candidate.label }])?.dreamId).toBe(lucidObservationSourceId('b', 101));
  });
  it('keeps audio-only captures retrievable and omits genuinely empty check-ins', () => {
    expect(projectLucidObservations([{ ...observation('voice', 100, ''), voiceCapture: 'local_note' }, observation('empty', 101, '')]).map(item => item.id)).toEqual([lucidObservationSourceId('voice', 100)]);
  });
});
