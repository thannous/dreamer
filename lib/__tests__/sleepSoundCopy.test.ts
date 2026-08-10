import { getSleepSoundCopy } from '@/lib/sleepSoundCopy';

describe('getSleepSoundCopy', () => {
  it.each([
    ['en', 'Evening ambience', 'Gentle rain', 'Night waves', 'Brown noise'],
    ['fr', 'Ambiances du soir', 'Pluie douce', 'Vagues nocturnes', 'Bruit brun'],
    ['es', 'Ambientes nocturnos', 'Lluvia suave', 'Olas nocturnas', 'Ruido marrón'],
    ['de', 'Abendliche Klänge', 'Sanfter Regen', 'Nächtliche Wellen', 'Braunes Rauschen'],
    ['it', 'Atmosfere della sera', 'Pioggia leggera', 'Onde notturne', 'Rumore marrone'],
    ['pt', 'Sons para dormir', 'Chuva suave', 'Ondas noturnas', 'Ruído marrom'],
  ])(
    'returns complete %s copy',
    (language, screenTitle, rainTitle, oceanTitle, brownNoiseTitle) => {
      const copy = getSleepSoundCopy(language);

      expect(copy.screenTitle).toBe(screenTitle);
      expect(copy.sounds).toEqual(
        expect.objectContaining({
          rain: expect.objectContaining({ title: rainTitle }),
          ocean: expect.objectContaining({ title: oceanTitle }),
          'brown-noise': expect.objectContaining({ title: brownNoiseTitle }),
        })
      );
      expect(copy.play).toBeTruthy();
      expect(copy.pause).toBeTruthy();
      expect(copy.error).toBeTruthy();
    }
  );

  it('normalizes regional locale tags and casing', () => {
    expect(getSleepSoundCopy('FR-fr').screenTitle).toBe('Ambiances du soir');
    expect(getSleepSoundCopy('es-MX').screenTitle).toBe('Ambientes nocturnos');
    expect(getSleepSoundCopy('pt-BR').screenTitle).toBe('Sons para dormir');
  });

  it.each([undefined, null, '', 'ja'])('falls back to English for %p', (language) => {
    const copy = getSleepSoundCopy(language);

    expect(copy.screenTitle).toBe('Evening ambience');
    expect(copy.sounds.rain.title).toBe('Gentle rain');
  });
});
