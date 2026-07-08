import { describe, expect, it } from '@jest/globals';

import {
  getLiveRecordingActivationInsight,
  getRecordingActivationInsight,
} from '@/lib/recordingActivationInsight';

describe('getRecordingActivationInsight', () => {
  it('stays hidden when the user has not added a useful fragment yet', () => {
    expect(getRecordingActivationInsight({ transcript: '' })).toBeNull();
    expect(getRecordingActivationInsight({ transcript: 'eau' })).toBeNull();
  });

  it('detects early personal signals from a current dream fragment', () => {
    const insight = getRecordingActivationInsight({
      transcript: 'Je suis dans une maison avec ma mere, j ai peur et je vois une porte bleue.',
    });

    expect(insight).toEqual({
      tone: 'signals',
      signalIds: ['emotion', 'place', 'person', 'symbol'],
      charCount: 75,
    });
  });

  it('turns a remembered dream into an anchor before text is long', () => {
    const insight = getRecordingActivationInsight({
      transcript: 'Toujours la meme route.',
      captureIntent: 'remembered',
      rememberedKind: 'recurring',
      strongestFragment: 'place',
    });

    expect(insight).toEqual({
      tone: 'memory',
      signalIds: ['memory', 'recurrence', 'place'],
      charCount: 23,
    });
  });

  it('detects Spanish first-read signals without requiring i18n routing', () => {
    const insight = getRecordingActivationInsight({
      transcript: 'Estoy en una casa con mi madre, tengo miedo y veo una puerta bajo el agua.',
    });

    expect(insight).toEqual(expect.objectContaining({
      tone: 'signals',
      signalIds: ['emotion', 'place', 'person', 'symbol'],
    }));
  });

  it('detects Italian first-read signals with exact word boundaries', () => {
    const insight = getRecordingActivationInsight({
      transcript: 'Sono in una scuola con mio fratello, provo paura e apro una porta luminosa.',
    });

    expect(insight).toEqual(expect.objectContaining({
      tone: 'signals',
      signalIds: ['emotion', 'place', 'person', 'symbol'],
    }));
  });

  it('detects German first-read signals after accent normalization', () => {
    const insight = getRecordingActivationInsight({
      transcript: 'Ich bin in einem Haus mit meiner Mutter, habe Angst und sehe einen Schlüssel im Wasser.',
    });

    expect(insight).toEqual(expect.objectContaining({
      tone: 'signals',
      signalIds: ['emotion', 'place', 'person', 'symbol'],
    }));
  });

  it('does not promote substring-only matches into noisy signals', () => {
    const insight = getRecordingActivationInsight({
      transcript: 'El casamiento menciona keynotes, firefly lights and a roommate in a vague morning story.',
    });

    expect(insight).toEqual(expect.objectContaining({
      tone: 'fragment',
      signalIds: [],
    }));
  });
});

describe('getLiveRecordingActivationInsight', () => {
  it('stays hidden for short fresh fragments without a signal', () => {
    expect(getLiveRecordingActivationInsight({
      transcript: 'Je marche dans quelque chose de flou.',
    })).toBeNull();
  });

  it('shows fresh signal previews before save when a concrete signal appears', () => {
    const insight = getLiveRecordingActivationInsight({
      transcript: 'Je suis dans une maison et je ressens une peur immense.',
    });

    expect(insight).toEqual({
      tone: 'signals',
      signalIds: ['emotion', 'place'],
      charCount: 55,
    });
  });

  it('waits for a longer fresh fragment when there are no concrete signals', () => {
    expect(getLiveRecordingActivationInsight({
      transcript: 'Je marche lentement dans quelque chose de flou, sans vraiment comprendre ce qui arrive.',
    })).toEqual({
      tone: 'fragment',
      signalIds: [],
      charCount: 87,
    });
  });

  it('keeps remembered previews hidden until the user adds a meaningful remembered cue', () => {
    expect(getLiveRecordingActivationInsight({
      transcript: '',
      captureIntent: 'remembered',
      rememberedKind: 'old',
    })).toBeNull();

    expect(getLiveRecordingActivationInsight({
      transcript: '',
      captureIntent: 'remembered',
      rememberedKind: 'old',
      strongestFragment: 'place',
    })).toEqual({
      tone: 'memory',
      signalIds: ['memory', 'place'],
      charCount: 0,
    });
  });
});
