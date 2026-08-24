import type { DreamAnalysis, DreamTheme, DreamType } from '@/lib/types';

type AsoDreamSeed = {
  title: string;
  transcript: string;
  interpretation: string;
  reflectionQuestions: string[];
  theme: DreamTheme;
  dreamType: DreamType;
  emotions: string[];
  daysAgo: number;
  favorite?: boolean;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const seeds: AsoDreamSeed[] = [
  {
    title: 'Le pont rouge sur la rivière',
    transcript:
      'Je marchais au bord d’une rivière calme sous une grande lune dorée. Un pont rouge reliait les deux rives. En le traversant, j’ai ressenti à la fois de la sérénité et une curiosité très vive pour ce qui m’attendait de l’autre côté.',
    interpretation:
      'Le pont peut être regardé comme une image de passage. La rivière, la lumière et le calme de la scène donnent surtout des repères pour revenir à ce que tu as ressenti, sans imposer une signification unique.',
    reflectionQuestions: [
      'Qu’est-ce qui semblait t’attendre de l’autre côté du pont ?',
      'Le calme de la rivière ressemblait-il à une émotion connue au réveil ?',
    ],
    theme: 'calm',
    dreamType: 'Symbolic Dream',
    emotions: ['Sérénité', 'Curiosité', 'Tendresse'],
    daysAgo: 1,
    favorite: true,
  },
  {
    title: 'La forêt qui chantait',
    transcript:
      'Dans une forêt éclairée par la lune, les arbres chantaient doucement. Je suivais le son jusqu’à une clairière où je me sentais parfaitement à ma place.',
    interpretation:
      'La forêt et la musique peuvent servir de points de départ pour observer le besoin de lien, de calme ou d’appartenance présent dans ce souvenir.',
    reflectionQuestions: ['Quelle voix attirait le plus ton attention ?', 'À quoi ressemblait ce sentiment d’être à ta place ?'],
    theme: 'mystical',
    dreamType: 'Symbolic Dream',
    emotions: ['Joie', 'Sérénité', 'Tendresse'],
    daysAgo: 3,
  },
  {
    title: 'Les escaliers de verre',
    transcript:
      'Je montais un escalier transparent au-dessus des nuages. Chaque marche faisait apparaître une nouvelle étoile et je continuais malgré un léger vertige.',
    interpretation:
      'La hauteur et la transparence invitent à regarder ensemble l’élan d’avancer et l’inquiétude qui l’accompagne.',
    reflectionQuestions: ['Qu’est-ce qui te donnait envie de continuer ?', 'Le vertige était-il excitant ou inquiétant ?'],
    theme: 'surreal',
    dreamType: 'Lucid Dream',
    emotions: ['Curiosité', 'Inquiétude', 'Joie'],
    daysAgo: 5,
    favorite: true,
  },
  {
    title: 'La barque sous la lune',
    transcript:
      'Une petite barque avançait seule sur un lac sombre. La lune se reflétait sur l’eau et le silence me rassurait au lieu de m’effrayer.',
    interpretation:
      'Le contraste entre l’obscurité et le sentiment de sécurité peut aider à préciser ce qui rendait cette solitude apaisante.',
    reflectionQuestions: ['Où pensais-tu que la barque allait ?', 'Qu’est-ce qui rendait le silence rassurant ?'],
    theme: 'calm',
    dreamType: 'Recurring Dream',
    emotions: ['Sérénité', 'Solitude', 'Confiance'],
    daysAgo: 8,
  },
  {
    title: 'Le jardin suspendu',
    transcript:
      'Je découvrais un jardin au-dessus des nuages. Des fleurs bleues s’ouvraient sur mon passage et une chaleur douce suivait chacun de mes pas.',
    interpretation:
      'Les fleurs, la hauteur et la chaleur forment une scène très sensorielle. Elles peuvent être explorées comme des traces de joie et de légèreté.',
    reflectionQuestions: ['Quelle fleur te reste en mémoire ?', 'La hauteur changeait-elle ta façon de marcher ?'],
    theme: 'surreal',
    dreamType: 'Lucid Dream',
    emotions: ['Émerveillement', 'Joie', 'Sérénité'],
    daysAgo: 11,
    favorite: true,
  },
  {
    title: 'Le phare dans la brume',
    transcript:
      'Je cherchais un chemin dans une brume épaisse. La lumière régulière d’un phare revenait toujours et m’aidait à ne pas me perdre.',
    interpretation:
      'La brume et la lumière peuvent être relues comme deux sensations opposées : l’incertitude et le repère.',
    reflectionQuestions: ['La lumière semblait-elle proche ?', 'Que ressentais-tu entre deux passages du faisceau ?'],
    theme: 'noir',
    dreamType: 'Symbolic Dream',
    emotions: ['Inquiétude', 'Soulagement', 'Curiosité'],
    daysAgo: 14,
  },
  {
    title: 'La maison aux fenêtres ouvertes',
    transcript:
      'Toutes les fenêtres d’une vieille maison étaient ouvertes sur des paysages différents : la mer, une forêt, une ville et un ciel étoilé.',
    interpretation:
      'Les fenêtres offrent plusieurs directions sans demander d’en choisir une immédiatement. Le rêve peut être relu à partir de celle qui attirait le plus ton regard.',
    reflectionQuestions: ['Quelle fenêtre as-tu regardée en premier ?', 'Avais-tu envie de rester dans la maison ou de sortir ?'],
    theme: 'mystical',
    dreamType: 'Symbolic Dream',
    emotions: ['Curiosité', 'Joie', 'Hésitation'],
    daysAgo: 17,
  },
  {
    title: 'La pluie d’étoiles',
    transcript:
      'Des étoiles tombaient lentement dans la mer sans faire de bruit. J’en ai gardé une dans mes mains quelques secondes avant qu’elle disparaisse.',
    interpretation:
      'La brièveté de l’étoile et le calme de la mer donnent une piste pour explorer ce que tu voulais retenir dans cet instant.',
    reflectionQuestions: ['Pourquoi voulais-tu garder cette étoile ?', 'Comment as-tu vécu sa disparition ?'],
    theme: 'mystical',
    dreamType: 'Lucid Dream',
    emotions: ['Émerveillement', 'Tendresse', 'Tristesse'],
    daysAgo: 20,
    favorite: true,
  },
  {
    title: 'Le train sans destination',
    transcript:
      'Je voyageais dans un train presque vide. Les panneaux changeaient de nom à chaque gare et je ne savais pas où descendre.',
    interpretation:
      'Le mouvement du train et l’absence de destination peuvent servir à observer la tension entre avancer et choisir.',
    reflectionQuestions: ['Qu’est-ce qui t’empêchait de descendre ?', 'Le voyage te semblait-il long ?'],
    theme: 'noir',
    dreamType: 'Recurring Dream',
    emotions: ['Inquiétude', 'Confusion', 'Solitude'],
    daysAgo: 24,
  },
  {
    title: 'La plage au lever du jour',
    transcript:
      'Je marchais pieds nus sur une plage vide au lever du jour. Les vagues effaçaient mes traces au fur et à mesure.',
    interpretation:
      'Le rythme des vagues et les traces qui disparaissent peuvent être explorés comme une sensation de recommencement ou de lâcher-prise.',
    reflectionQuestions: ['La disparition des traces était-elle apaisante ?', 'Que regardais-tu à l’horizon ?'],
    theme: 'calm',
    dreamType: 'Symbolic Dream',
    emotions: ['Sérénité', 'Soulagement', 'Tendresse'],
    daysAgo: 28,
  },
  {
    title: 'Le musée des souvenirs',
    transcript:
      'Je visitais un musée où chaque salle contenait un souvenir précis. Certaines portes étaient ouvertes, d’autres restaient fermées.',
    interpretation:
      'Les salles et les portes donnent une structure au souvenir. Elles peuvent aider à repérer ce que tu avais envie de revisiter ou de laisser fermé.',
    reflectionQuestions: ['Quelle salle était la plus lumineuse ?', 'Y avait-il une porte que tu voulais ouvrir ?'],
    theme: 'mystical',
    dreamType: 'Symbolic Dream',
    emotions: ['Nostalgie', 'Curiosité', 'Inquiétude'],
    daysAgo: 32,
  },
  {
    title: 'La ville sous l’eau',
    transcript:
      'Je nageais entre des immeubles sous l’eau. Tout semblait ralenti et je pouvais respirer normalement, comme si cet endroit m’était familier.',
    interpretation:
      'La ville immergée associe un décor quotidien à une sensation impossible. Le contraste peut être relu à partir du calme ressenti dans la scène.',
    reflectionQuestions: ['Qu’est-ce qui rendait la ville familière ?', 'La lenteur te rassurait-elle ?'],
    theme: 'surreal',
    dreamType: 'Lucid Dream',
    emotions: ['Sérénité', 'Émerveillement', 'Curiosité'],
    daysAgo: 36,
  },
  {
    title: 'La porte au milieu du champ',
    transcript:
      'Une porte bleue se tenait seule au milieu d’un champ. Lorsque je l’ai ouverte, j’ai retrouvé la rivière de mon rêve précédent.',
    interpretation:
      'La porte et le retour de la rivière relient deux souvenirs. Cette continuité peut être observée sans décider à l’avance ce qu’elle signifie.',
    reflectionQuestions: ['Reconnaissais-tu immédiatement la rivière ?', 'Qu’espérais-tu trouver derrière la porte ?'],
    theme: 'mystical',
    dreamType: 'Recurring Dream',
    emotions: ['Curiosité', 'Sérénité', 'Joie'],
    daysAgo: 40,
  },
  {
    title: 'Le sentier de lanternes',
    transcript:
      'Un sentier de lanternes traversait une forêt sombre. À chaque pas, une nouvelle lumière s’allumait devant moi.',
    interpretation:
      'Le sentier montre uniquement la prochaine étape. Il peut être relu comme une façon progressive d’avancer dans l’inconnu.',
    reflectionQuestions: ['Voyais-tu la fin du sentier ?', 'Que ressentais-tu quand une lanterne s’allumait ?'],
    theme: 'calm',
    dreamType: 'Symbolic Dream',
    emotions: ['Confiance', 'Sérénité', 'Curiosité'],
    daysAgo: 45,
  },
];

export function getAsoStoreDreamsWithTimestamps(now = Date.now()): DreamAnalysis[] {
  return seeds.map((seed, index) => {
    const id = now - seed.daysAgo * DAY_IN_MS - index * 60_000;
    return {
      id,
      title: seed.title,
      transcript: seed.transcript,
      interpretation: seed.interpretation,
      reflectionQuestions: seed.reflectionQuestions,
      symbols: [
        { name: 'Eau', meaning: 'Un élément récurrent à rapprocher du calme et du mouvement de la scène.' },
        { name: 'Passage', meaning: 'Un repère visuel qui relie plusieurs souvenirs sans leur imposer un sens.' },
      ],
      emotions: seed.emotions.map((name) => ({
        name,
        insight: `Cette émotion aide à préciser l’atmosphère de « ${seed.title} » sans la résumer.`,
      })),
      shareableQuote: '',
      theme: seed.theme,
      dreamType: seed.dreamType,
      imageUrl: '',
      chatHistory: [],
      isFavorite: seed.favorite ?? false,
      imageGenerationFailed: false,
      isAnalyzed: true,
      analyzedAt: id + 10 * 60_000,
      analysisStatus: 'done',
      promptVersion: 'aso-store-fr-v1',
      hasPerson: false,
      hasAnimal: false,
    };
  });
}
