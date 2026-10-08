/**
 * Store showcase journal for mock mode.
 *
 * Selected with `EXPO_PUBLIC_MOCK_SHOWCASE=fr|en` to capture App Store and Play
 * screenshots and the demo video: a coherent, localized journal whose images are the
 * bundled symbol illustrations instead of placeholder photos. Default mock mode keeps
 * `PREDEFINED_DREAMS`, which covers every product state for QA.
 */
import { Image } from 'react-native';

import type { DreamAnalysis } from '@/lib/types';

type ShowcaseDream = Omit<DreamAnalysis, 'id' | 'imageUrl' | 'thumbnailUrl'> & { art: number };
type ShowcaseLanguage = 'fr' | 'en';

const ART = {
  house: require('@/assets/images/symbols/house.webp'),
  flying: require('@/assets/images/symbols/flying.webp'),
  forest: require('@/assets/images/symbols/forest.webp'),
  stairs: require('@/assets/images/symbols/stairs.webp'),
  wolf: require('@/assets/images/symbols/wolf.webp'),
  key: require('@/assets/images/symbols/key.webp'),
};

const base = {
  analysisStatus: 'done',
  isAnalyzed: true,
  imageGenerationFailed: false,
  imageSource: 'ai',
  hasPerson: false,
  hasAnimal: false,
  isFavorite: false,
} satisfies Partial<DreamAnalysis>;

const SHOWCASE: Record<ShowcaseLanguage, ShowcaseDream[]> = {
  fr: [
    {
      ...base,
      art: ART.house,
      title: 'La maison aux pièces inconnues',
      transcript: "J'étais dans la maison de mon enfance, mais elle avait des pièces que je n'avais jamais vues. Une porte dorée s'ouvrait sur un salon baigné de lune. Je n'avais pas peur : je voulais tout visiter.",
      interpretation: "Une maison familière qui révèle des pièces cachées évoque souvent des parts de toi encore peu explorées. La lumière douce et l'absence de peur suggèrent une curiosité tranquille plutôt qu'une inquiétude.",
      shareableQuote: 'Il reste des pièces en nous que la nuit ouvre doucement.',
      symbols: [
        { name: 'Maison', meaning: 'Ton espace intérieur, ce que tu connais de toi.' },
        { name: 'Porte dorée', meaning: 'Une possibilité nouvelle qui semble précieuse.' },
        { name: 'Lune', meaning: 'Une lumière intime, intuitive, sans éblouir.' },
      ],
      emotions: [
        { name: 'Curiosité', insight: "Tu avances sans hésiter : l'inconnu t'attire plus qu'il ne t'inquiète." },
        { name: 'Nostalgie', insight: "La maison d'enfance relie ce rêve à des souvenirs anciens." },
        { name: 'Calme', insight: 'Rien ne presse dans ce rêve, il laisse de la place pour regarder.' },
      ],
      reflectionQuestions: [
        "Quelle part de ta vie ressemble à une pièce que tu n'as pas encore ouverte ?",
        'Qu’est-ce qui t’a donné envie de tout visiter ?',
      ],
      theme: 'mystical',
      dreamType: 'Symbolic Dream',
      isFavorite: true,
      chatHistory: [
        { id: 'showcase-fr-1-user', role: 'user', text: 'Pourquoi je me sentais si calme ?', meta: { category: 'emotions' } },
        { id: 'showcase-fr-1-model', role: 'model', text: "Le calme vient peut-être de la maison elle-même : un lieu sûr où même l'inconnu reste accueillant. Qu'est-ce qui, en ce moment, te donne ce sentiment de sécurité ?", meta: { category: 'emotions' } },
      ],
    },
    {
      ...base,
      art: ART.flying,
      title: 'Je volais au-dessus des nuages',
      transcript: "Je me suis rendu compte que je rêvais et j'ai décidé de m'envoler. L'air était tiède, les nuages brillaient sous moi. Plus je souriais, plus je montais.",
      interpretation: "Prendre conscience du rêve puis choisir de voler raconte un désir de liberté et de maîtrise. L'élan lié au sourire relie ta légèreté intérieure à ta capacité d'avancer.",
      shareableQuote: 'Certaines nuits, il suffit de sourire pour prendre de la hauteur.',
      symbols: [
        { name: 'Voler', meaning: "Liberté, recul, envie de s'élever au-dessus des contraintes." },
        { name: 'Nuages', meaning: 'Une distance douce avec le quotidien.' },
      ],
      emotions: [
        { name: 'Liberté', insight: 'Tu choisis toi-même de décoller, le rêve te donne la main.' },
        { name: 'Émerveillement', insight: 'La lumière sous toi transforme le vol en contemplation.' },
      ],
      reflectionQuestions: ['Dans quel domaine aimerais-tu prendre un peu de hauteur ?'],
      theme: 'surreal',
      dreamType: 'Lucid Dream',
      chatHistory: [],
    },
    {
      ...base,
      art: ART.forest,
      title: 'La forêt qui chantait',
      transcript: "Je marchais dans une forêt violette. Chaque arbre fredonnait une note différente et, ensemble, ils formaient une mélodie que je connaissais sans savoir d'où.",
      interpretation: "Une forêt vivante et musicale peut représenter un ensemble d'intuitions qui s'accordent. Reconnaître la mélodie suggère un souvenir ou une évidence qui cherche à revenir.",
      shareableQuote: 'Les arbres connaissaient déjà la chanson que je cherchais.',
      symbols: [
        { name: 'Forêt', meaning: "L'inconscient, un territoire riche à explorer." },
        { name: 'Musique', meaning: "Une harmonie, des éléments qui s'accordent." },
      ],
      emotions: [
        { name: 'Émerveillement', insight: 'La forêt t’accueille plutôt qu’elle ne t’égare.' },
        { name: 'Familiarité', insight: 'La mélodie connue relie ce rêve à quelque chose de personnel.' },
      ],
      reflectionQuestions: ['Quelle mélodie, quel souvenir te revient en y repensant ?'],
      theme: 'calm',
      dreamType: 'Fantastical Dream',
      chatHistory: [],
    },
    {
      ...base,
      art: ART.stairs,
      title: "L'escalier qui ne finissait pas",
      transcript: "Encore ce rêve : je monte un escalier en spirale vers une lumière. Cette fois, j'ai remarqué que les marches portaient des dates.",
      interpretation: "Un escalier récurrent suggère un passage, une progression par étapes. Les dates sur les marches invitent à relier ce rêve aux moments clés de ton parcours.",
      shareableQuote: 'Chaque marche portait une date, et chacune me rapprochait de la lumière.',
      symbols: [
        { name: 'Escalier', meaning: 'Progression, transition, effort vers un objectif.' },
        { name: 'Lumière', meaning: 'Un but ou une clarté que tu pressens.' },
      ],
      emotions: [
        { name: 'Persévérance', insight: 'Tu continues de monter même quand la fin reste invisible.' },
        { name: 'Attente', insight: 'Le rêve revient, comme pour vérifier où tu en es.' },
      ],
      reflectionQuestions: ['Quelles dates as-tu reconnues sur les marches ?'],
      theme: 'mystical',
      dreamType: 'Recurring Dream',
      chatHistory: [],
    },
    {
      ...base,
      art: ART.wolf,
      title: 'Le loup au bord du lac',
      transcript: "Un loup argenté m'attendait au bord d'un lac immobile. Il ne m'a pas attaqué ; il m'a simplement regardé, puis il a marché devant moi comme pour me guider.",
      interpretation: "Un loup qui guide plutôt qu'il ne menace évoque l'instinct, la loyauté et la confiance en ton intuition. Le lac immobile ajoute une note de calme et de réflexion.",
      shareableQuote: "Le loup ne m'a pas fait peur : il connaissait le chemin.",
      symbols: [
        { name: 'Loup', meaning: 'Instinct, intuition, force tranquille.' },
        { name: 'Lac', meaning: 'Émotions calmes, introspection.' },
      ],
      emotions: [
        { name: 'Confiance', insight: 'Tu acceptes de suivre une présence sauvage sans crainte.' },
        { name: 'Sérénité', insight: "L'eau immobile installe une atmosphère paisible." },
      ],
      reflectionQuestions: ['À quel moment récent as-tu suivi ton instinct ?'],
      theme: 'noir',
      dreamType: 'Symbolic Dream',
      hasAnimal: true,
      chatHistory: [],
    },
    {
      ...base,
      art: ART.key,
      title: 'La clé sous la pluie',
      transcript: "Il pleuvait sur une ville déserte. Dans une flaque, je trouvais une petite clé ancienne, tiède dans ma main, et je savais qu'elle ouvrait quelque chose d'important.",
      interpretation: "Trouver une clé évoque une solution ou un accès nouveau. Sous la pluie, ce rêve associe une période un peu grise à la promesse d'une ouverture.",
      shareableQuote: 'Même sous la pluie, une petite clé peut tout changer.',
      symbols: [
        { name: 'Clé', meaning: 'Une solution, un accès, une réponse.' },
        { name: 'Pluie', meaning: 'Un nettoyage, une émotion qui passe.' },
      ],
      emotions: [{ name: 'Espoir', insight: 'La clé tiède rend la scène plus chaleureuse qu’inquiétante.' }],
      reflectionQuestions: ['Que voudrais-tu ouvrir en ce moment ?'],
      theme: 'calm',
      dreamType: 'Symbolic Dream',
      chatHistory: [],
    },
  ],
  en: [
    {
      ...base,
      art: ART.house,
      title: 'The house with unknown rooms',
      transcript: 'I was in my childhood home, but it had rooms I had never seen. A golden door opened onto a living room bathed in moonlight. I was not afraid: I wanted to explore every room.',
      interpretation: 'A familiar house revealing hidden rooms often points to parts of yourself you have not explored yet. The soft light and the absence of fear suggest calm curiosity rather than worry.',
      shareableQuote: 'Some rooms inside us only open at night.',
      symbols: [
        { name: 'House', meaning: 'Your inner space, what you know of yourself.' },
        { name: 'Golden door', meaning: 'A new possibility that feels precious.' },
        { name: 'Moon', meaning: 'A gentle, intuitive light.' },
      ],
      emotions: [
        { name: 'Curiosity', insight: 'You move forward without hesitation; the unknown draws you in.' },
        { name: 'Nostalgia', insight: 'The childhood home ties this dream to older memories.' },
        { name: 'Calm', insight: 'Nothing rushes you here, there is room to look around.' },
      ],
      reflectionQuestions: ['Which part of your life feels like a room you have not opened yet?'],
      theme: 'mystical',
      dreamType: 'Symbolic Dream',
      isFavorite: true,
      chatHistory: [
        { id: 'showcase-en-1-user', role: 'user', text: 'Why did I feel so calm?', meta: { category: 'emotions' } },
        { id: 'showcase-en-1-model', role: 'model', text: 'The calm may come from the house itself: a safe place where even the unknown feels welcoming. What gives you that sense of safety lately?', meta: { category: 'emotions' } },
      ],
    },
    {
      ...base,
      art: ART.flying,
      title: 'Flying above the clouds',
      transcript: 'I realised I was dreaming and decided to fly. The air was warm and the clouds glowed below me. The more I smiled, the higher I rose.',
      interpretation: 'Becoming aware of the dream and choosing to fly speaks of a wish for freedom and agency. Rising with a smile links your lightness to your ability to move forward.',
      shareableQuote: 'Some nights, a smile is enough to rise.',
      symbols: [{ name: 'Flying', meaning: 'Freedom, perspective, rising above constraints.' }],
      emotions: [
        { name: 'Freedom', insight: 'You chose to take off; the dream followed your lead.' },
        { name: 'Wonder', insight: 'The light below turns flight into contemplation.' },
      ],
      reflectionQuestions: ['Where would you like a little more perspective?'],
      theme: 'surreal',
      dreamType: 'Lucid Dream',
      chatHistory: [],
    },
    {
      ...base,
      art: ART.forest,
      title: 'The singing forest',
      transcript: 'I walked through a violet forest. Each tree hummed a different note and together they formed a melody I knew without knowing why.',
      interpretation: 'A living, musical forest can represent intuitions falling into harmony. Recognising the melody suggests a memory trying to come back.',
      shareableQuote: 'The trees already knew the song I was looking for.',
      symbols: [{ name: 'Forest', meaning: 'The unconscious, a rich territory to explore.' }],
      emotions: [{ name: 'Wonder', insight: 'The forest welcomes you rather than losing you.' }],
      reflectionQuestions: ['Which melody or memory comes back when you think of it?'],
      theme: 'calm',
      dreamType: 'Fantastical Dream',
      chatHistory: [],
    },
    {
      ...base,
      art: ART.stairs,
      title: 'The staircase that never ended',
      transcript: 'This dream again: I climb a spiral staircase toward a light. This time, I noticed dates written on the steps.',
      interpretation: 'A recurring staircase suggests a passage made of stages. The dates invite you to connect it with key moments of your path.',
      shareableQuote: 'Every step carried a date, and each one brought me closer to the light.',
      symbols: [{ name: 'Stairs', meaning: 'Progress, transition, effort toward a goal.' }],
      emotions: [{ name: 'Perseverance', insight: 'You keep climbing even when the end is out of sight.' }],
      reflectionQuestions: ['Which dates did you recognise on the steps?'],
      theme: 'mystical',
      dreamType: 'Recurring Dream',
      chatHistory: [],
    },
    {
      ...base,
      art: ART.wolf,
      title: 'The wolf by the lake',
      transcript: 'A silver wolf waited for me by a still lake. It did not attack; it simply looked at me, then walked ahead as if to guide me.',
      interpretation: 'A wolf that guides rather than threatens evokes instinct, loyalty and trust in your intuition. The still lake adds calm and reflection.',
      shareableQuote: 'The wolf did not scare me: it knew the way.',
      symbols: [{ name: 'Wolf', meaning: 'Instinct, intuition, quiet strength.' }],
      emotions: [{ name: 'Trust', insight: 'You follow a wild presence without fear.' }],
      reflectionQuestions: ['When did you last follow your instinct?'],
      theme: 'noir',
      dreamType: 'Symbolic Dream',
      hasAnimal: true,
      chatHistory: [],
    },
    {
      ...base,
      art: ART.key,
      title: 'The key in the rain',
      transcript: 'It was raining over an empty city. In a puddle I found a small old key, warm in my hand, and I knew it opened something important.',
      interpretation: 'Finding a key evokes a solution or a new access. In the rain, the dream pairs a grey period with the promise of an opening.',
      shareableQuote: 'Even in the rain, a small key can change everything.',
      symbols: [{ name: 'Key', meaning: 'A solution, an access, an answer.' }],
      emotions: [{ name: 'Hope', insight: 'The warm key makes the scene comforting rather than worrying.' }],
      reflectionQuestions: ['What would you like to open right now?'],
      theme: 'calm',
      dreamType: 'Symbolic Dream',
      chatHistory: [],
    },
  ],
};

export function getShowcaseLanguage(): ShowcaseLanguage | null {
  // Literal access so Metro inlines it into the bundle.
  const value = process.env.EXPO_PUBLIC_MOCK_SHOWCASE;
  return value === 'fr' || value === 'en' ? value : null;
}

/** The showcase journal for the configured language, or null outside showcase mode. */
export function getShowcaseDreams(): Omit<DreamAnalysis, 'id'>[] | null {
  const language = getShowcaseLanguage();
  if (!language) return null;
  return SHOWCASE[language].map(({ art, ...dream }) => {
    const uri = Image.resolveAssetSource(art)?.uri ?? '';
    return { ...dream, imageUrl: uri, thumbnailUrl: uri };
  });
}
