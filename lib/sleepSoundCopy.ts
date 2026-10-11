import type { SleepSoundId } from '@/lib/sleepSounds';

type SupportedLanguage = 'en' | 'fr' | 'es' | 'de' | 'it' | 'pt';

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
  downloadError: string;
  sounds: Record<SleepSoundId, { title: string; description: string; story: string }>;
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
    downloadError: 'Connect to the internet once to download this sound. It then plays offline.',
    sounds: {
      rain: { title: 'Gentle rain', description: 'Soft, steady rainfall',
        story: 'Rain falls on the forest. A lantern stays lit by the path. There is nothing left to do tonight.' },
      ocean: { title: 'Night waves', description: 'Slow waves on a distant shore',
        story: 'The moon rests on the water. Waves come in slowly, then draw back. Breathe at their pace.' },
      'brown-noise': { title: 'Brown noise', description: 'A deep, even sound veil',
        story: 'Mist rises from the lake and covers the sounds of the house. One low, steady hush until you fall asleep.' },
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
    downloadError: 'Connecte-toi une première fois pour télécharger ce son. Il fonctionnera ensuite hors ligne.',
    sounds: {
      rain: { title: 'Pluie douce', description: 'Une pluie légère et régulière',
        story: 'Il pleut sur la forêt. Une lanterne reste allumée au bord du chemin. Ce soir, tu n’as plus rien à faire.' },
      ocean: { title: 'Vagues nocturnes', description: 'Des vagues lentes sur une rive lointaine',
        story: 'La lune se pose sur l’eau. Les vagues arrivent lentement, puis repartent. Respire à leur rythme.' },
      'brown-noise': { title: 'Bruit brun', description: 'Un voile sonore profond et uniforme',
        story: 'La brume monte du lac et couvre les bruits de la maison. Un souffle grave, toujours le même, jusqu’au sommeil.' },
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
    downloadError: 'Conéctate una vez para descargar este sonido. Después funcionará sin conexión.',
    sounds: {
      rain: { title: 'Lluvia suave', description: 'Lluvia ligera y constante',
        story: 'Llueve sobre el bosque. Una linterna sigue encendida junto al camino. Esta noche ya no tienes nada que hacer.' },
      ocean: { title: 'Olas nocturnas', description: 'Olas lentas en una orilla lejana',
        story: 'La luna se posa sobre el agua. Las olas llegan despacio y se retiran. Respira a su ritmo.' },
      'brown-noise': { title: 'Ruido marrón', description: 'Un manto sonoro profundo y uniforme',
        story: 'La bruma sube del lago y cubre los ruidos de la casa. Un murmullo grave y constante hasta que te duermas.' },
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
    downloadError: 'Verbinde dich einmal mit dem Internet, um diesen Klang zu laden. Danach läuft er offline.',
    sounds: {
      rain: { title: 'Sanfter Regen', description: 'Leichter, gleichmäßiger Regen',
        story: 'Regen fällt auf den Wald. Am Weg brennt noch eine Laterne. Heute Abend gibt es nichts mehr zu tun.' },
      ocean: { title: 'Nächtliche Wellen', description: 'Langsame Wellen an einem fernen Ufer',
        story: 'Der Mond liegt auf dem Wasser. Die Wellen kommen langsam und ziehen sich zurück. Atme in ihrem Takt.' },
      'brown-noise': { title: 'Braunes Rauschen', description: 'Ein tiefer, gleichmäßiger Klangteppich',
        story: 'Nebel steigt vom See auf und deckt die Geräusche des Hauses zu. Ein tiefes, gleichmäßiges Rauschen, bis du einschläfst.' },
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
    downloadError: 'Connettiti una volta per scaricare questo suono. Poi funzionerà anche offline.',
    sounds: {
      rain: { title: 'Pioggia leggera', description: 'Una pioggia dolce e regolare',
        story: 'Piove sul bosco. Una lanterna resta accesa lungo il sentiero. Stasera non c’è più niente da fare.' },
      ocean: { title: 'Onde notturne', description: 'Onde lente su una riva lontana',
        story: 'La luna si posa sull’acqua. Le onde arrivano piano, poi si ritirano. Respira al loro ritmo.' },
      'brown-noise': { title: 'Rumore marrone', description: 'Un velo sonoro profondo e uniforme',
        story: 'La nebbia sale dal lago e copre i rumori della casa. Un fruscio grave e costante, fino al sonno.' },
    },
  },
  pt: {
    entryTitle: 'Sons para dormir',
    entryBody: 'Escolha um som suave e deixe que ele termine aos poucos.',
    screenTitle: 'Sons para dormir',
    screenSubtitle: 'Uma paisagem sonora tranquila para acompanhar você até o sono.',
    chooseSound: 'Escolha um ambiente',
    chooseDuration: 'Tempo de reprodução',
    minutes: 'min',
    play: 'Iniciar ambiente',
    pause: 'Pausar',
    resume: 'Retomar',
    loading: 'Preparando o som…',
    volumeHint: 'Mantenha o volume baixo e confortável.',
    backgroundHint: 'O som continua com a tela bloqueada e termina automaticamente.',
    error: 'Não foi possível iniciar o ambiente. Tente novamente.',
    downloadError: 'Liga-te uma vez à internet para descarregar este som. Depois funciona sem ligação.',
    sounds: {
      rain: { title: 'Chuva suave', description: 'Uma chuva leve e constante',
        story: 'Chove sobre a floresta. Uma lanterna continua acesa à beira do caminho. Esta noite, não há mais nada a fazer.' },
      ocean: { title: 'Ondas noturnas', description: 'Ondas lentas em uma praia distante',
        story: 'A lua repousa sobre a água. As ondas chegam devagar e depois recuam. Respire no ritmo delas.' },
      'brown-noise': { title: 'Ruído marrom', description: 'Um som profundo e uniforme',
        story: 'A névoa sobe do lago e cobre os ruídos da casa. Um som grave e constante até você adormecer.' },
    },
  },
};

export function getSleepSoundCopy(language: string | null | undefined): SleepSoundCopy {
  const supported = language?.toLowerCase().split('-')[0] as SupportedLanguage | undefined;
  return supported && supported in COPY ? COPY[supported] : COPY.en;
}
