import type { SleepSoundId } from '@/lib/sleepSounds';

type SupportedLanguage = 'en' | 'fr' | 'es' | 'de' | 'it';

export type SleepSoundCopy = {
  entryTitle: string;
  entryBody: string;
  screenTitle: string;
  screenSubtitle: string;
  chooseSound: string;
  chooseDuration: string;
  minutes: string;
  play: string;
  pause: string;
  resume: string;
  loading: string;
  volumeHint: string;
  backgroundHint: string;
  error: string;
  sounds: Record<SleepSoundId, { title: string; description: string }>;
};

const COPY: Record<SupportedLanguage, SleepSoundCopy> = {
  en: {
    entryTitle: 'Sleep ambience',
    entryBody: 'Choose a gentle sound and let it fade out on its own.',
    screenTitle: 'Evening ambience',
    screenSubtitle: 'A quiet soundscape to accompany you into sleep.',
    chooseSound: 'Choose an ambience',
    chooseDuration: 'Listening time',
    minutes: 'min',
    play: 'Start ambience',
    pause: 'Pause',
    resume: 'Resume',
    loading: 'Preparing sound…',
    volumeHint: 'Keep the volume low and comfortable.',
    backgroundHint: 'The sound keeps playing when your screen locks, then fades out automatically.',
    error: 'The ambience could not start. Please try again.',
    sounds: {
      rain: { title: 'Gentle rain', description: 'Soft, steady rainfall' },
      ocean: { title: 'Night waves', description: 'Slow waves on a distant shore' },
      'brown-noise': { title: 'Brown noise', description: 'A deep, even sound veil' },
    },
  },
  fr: {
    entryTitle: 'Ambiance pour dormir',
    entryBody: 'Choisis un son doux et laisse-le s’éteindre progressivement.',
    screenTitle: 'Ambiances du soir',
    screenSubtitle: 'Un paysage sonore calme pour accompagner ton endormissement.',
    chooseSound: 'Choisir une ambiance',
    chooseDuration: 'Durée d’écoute',
    minutes: 'min',
    play: 'Lancer l’ambiance',
    pause: 'Mettre en pause',
    resume: 'Reprendre',
    loading: 'Préparation du son…',
    volumeHint: 'Garde un volume bas et confortable.',
    backgroundHint: 'Le son continue écran verrouillé, puis s’éteint progressivement tout seul.',
    error: 'Impossible de lancer l’ambiance. Réessaie dans un instant.',
    sounds: {
      rain: { title: 'Pluie douce', description: 'Une pluie légère et régulière' },
      ocean: { title: 'Vagues nocturnes', description: 'Des vagues lentes sur une rive lointaine' },
      'brown-noise': { title: 'Bruit brun', description: 'Un voile sonore profond et uniforme' },
    },
  },
  es: {
    entryTitle: 'Ambiente para dormir',
    entryBody: 'Elige un sonido suave y deja que se desvanezca solo.',
    screenTitle: 'Ambientes nocturnos',
    screenSubtitle: 'Un paisaje sonoro tranquilo para acompañarte al dormir.',
    chooseSound: 'Elegir un ambiente',
    chooseDuration: 'Tiempo de escucha',
    minutes: 'min',
    play: 'Iniciar ambiente',
    pause: 'Pausar',
    resume: 'Continuar',
    loading: 'Preparando el sonido…',
    volumeHint: 'Mantén un volumen bajo y cómodo.',
    backgroundHint: 'El sonido sigue con la pantalla bloqueada y se desvanece automáticamente.',
    error: 'No se pudo iniciar el ambiente. Inténtalo de nuevo.',
    sounds: {
      rain: { title: 'Lluvia suave', description: 'Lluvia ligera y constante' },
      ocean: { title: 'Olas nocturnas', description: 'Olas lentas en una orilla lejana' },
      'brown-noise': { title: 'Ruido marrón', description: 'Un manto sonoro profundo y uniforme' },
    },
  },
  de: {
    entryTitle: 'Einschlafklänge',
    entryBody: 'Wähle einen sanften Klang, der langsam von selbst verklingt.',
    screenTitle: 'Abendliche Klänge',
    screenSubtitle: 'Eine ruhige Klanglandschaft, die dich in den Schlaf begleitet.',
    chooseSound: 'Klang auswählen',
    chooseDuration: 'Hördauer',
    minutes: 'Min.',
    play: 'Klang starten',
    pause: 'Pausieren',
    resume: 'Fortsetzen',
    loading: 'Klang wird vorbereitet…',
    volumeHint: 'Wähle eine niedrige, angenehme Lautstärke.',
    backgroundHint: 'Der Klang läuft bei gesperrtem Bildschirm weiter und blendet automatisch aus.',
    error: 'Der Klang konnte nicht gestartet werden. Versuche es erneut.',
    sounds: {
      rain: { title: 'Sanfter Regen', description: 'Leichter, gleichmäßiger Regen' },
      ocean: { title: 'Nächtliche Wellen', description: 'Langsame Wellen an einem fernen Ufer' },
      'brown-noise': { title: 'Braunes Rauschen', description: 'Ein tiefer, gleichmäßiger Klangteppich' },
    },
  },
  it: {
    entryTitle: 'Atmosfera per dormire',
    entryBody: 'Scegli un suono delicato e lascia che svanisca da solo.',
    screenTitle: 'Atmosfere della sera',
    screenSubtitle: 'Un paesaggio sonoro tranquillo per accompagnarti nel sonno.',
    chooseSound: 'Scegli un’atmosfera',
    chooseDuration: 'Durata di ascolto',
    minutes: 'min',
    play: 'Avvia atmosfera',
    pause: 'Pausa',
    resume: 'Riprendi',
    loading: 'Preparazione del suono…',
    volumeHint: 'Mantieni un volume basso e confortevole.',
    backgroundHint: 'Il suono continua a schermo bloccato e svanisce automaticamente.',
    error: 'Impossibile avviare l’atmosfera. Riprova.',
    sounds: {
      rain: { title: 'Pioggia leggera', description: 'Una pioggia dolce e regolare' },
      ocean: { title: 'Onde notturne', description: 'Onde lente su una riva lontana' },
      'brown-noise': { title: 'Rumore marrone', description: 'Un velo sonoro profondo e uniforme' },
    },
  },
};

export function getSleepSoundCopy(language: string | null | undefined): SleepSoundCopy {
  const supported = language?.toLowerCase().split('-')[0] as SupportedLanguage | undefined;
  return supported && supported in COPY ? COPY[supported] : COPY.en;
}
