#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const symbolUpdate = {
  en: {
    slug: 'hospital',
    name: 'Hospital',
    shortDescription:
      'A hospital dream often points to healing, vulnerability, health anxiety, or a need to accept help before stress becomes urgent.',
    askYourself: [
      'What part of my life is asking for care or recovery?',
      'Am I trying to handle stress, illness, or emotional pain without enough support?',
      'Did the dream feel like emergency, relief, waiting, or fear?'
    ],
    faq: [
      {
        question: 'What does it mean to dream about a hospital?',
        answer:
          'Dreaming about a hospital usually suggests that something needs care, healing, or closer attention. It may point to physical health worries, emotional exhaustion, family concern, or a situation where you need support rather than control.'
      },
      {
        question: 'What does it mean to dream that you are in a hospital?',
        answer:
          'Being in a hospital in a dream often reflects vulnerability and recovery. The dream may be showing that you need rest, guidance, treatment, or help processing a stressful period.'
      },
      {
        question: 'What does a dream about doctors, nurses, or sick people in a hospital mean?',
        answer:
          'Doctors and nurses can symbolize guidance, care, or the part of you that knows what needs to be repaired. Sick people may reflect worry for others or a neglected part of your own wellbeing.'
      }
    ]
  },
  fr: {
    slug: 'hopital',
    name: 'Hôpital',
    seoTitle: 'Hôpital',
    shortDescription:
      "Rêver d'hôpital évoque souvent un besoin de guérison, une inquiétude de santé, une période de vulnérabilité ou l'urgence de demander de l'aide.",
    askYourself: [
      "Quelle partie de ma vie demande du soin ou du repos ?",
      "Est-ce que je porte seul une fatigue, une peur ou une douleur émotionnelle ?",
      "Le rêve ressemblait-il à une urgence, une attente, un soulagement ou une peur ?"
    ],
    faq: [
      {
        question: "Que signifie rêver d'un hôpital ?",
        answer:
          "Rêver d'un hôpital indique souvent qu'une situation demande de l'attention, du soin ou une forme de réparation. Le rêve peut parler de santé, mais aussi de fatigue émotionnelle, d'inquiétude pour un proche ou d'un besoin d'accompagnement."
      },
      {
        question: "Que signifie rêver d'être à l'hôpital ?",
        answer:
          "Être à l'hôpital dans un rêve renvoie souvent à la vulnérabilité et à la récupération. Votre inconscient peut signaler que vous avez besoin de repos, de soutien ou d'un temps pour guérir."
      },
      {
        question: "Que signifient les médecins, infirmières ou malades dans un rêve d'hôpital ?",
        answer:
          "Les soignants peuvent symboliser l'aide, le diagnostic ou la partie de vous qui sait quoi réparer. Les personnes malades peuvent représenter une inquiétude pour autrui ou un aspect de votre bien-être que vous négligez."
      }
    ]
  },
  es: {
    slug: 'hospital',
    name: 'Hospital',
    seoTitle: 'Hospital',
    shortDescription:
      'Soñar con hospital suele hablar de sanación, preocupación por la salud, vulnerabilidad o necesidad de pedir ayuda antes de que el estrés se vuelva urgente.',
    askYourself: [
      '¿Qué parte de mi vida necesita sanación, descanso o atención?',
      '¿Estoy cargando solo con estrés, miedo o dolor emocional?',
      '¿El sueño se sentía como emergencia, espera, alivio o miedo?'
    ],
    faq: [
      {
        question: '¿Qué significa soñar con hospital?',
        answer:
          'Soñar con hospital suele indicar que algo en tu vida necesita atención, cuidado o sanación. Puede relacionarse con preocupaciones de salud, cansancio emocional, miedo por un familiar o una situación en la que necesitas apoyo.'
      },
      {
        question: '¿Qué significa soñar que estás en un hospital?',
        answer:
          'Estar en un hospital en sueños suele reflejar vulnerabilidad, recuperación o necesidad de ayuda. El sueño puede aparecer cuando estás agotado, preocupado o intentando resolver algo que requiere cuidado.'
      },
      {
        question: '¿Qué significa soñar con hospital y doctores, enfermeras o enfermos?',
        answer:
          'Los doctores y enfermeras pueden simbolizar guía, diagnóstico o apoyo. Ver enfermos en un hospital puede reflejar preocupación por otros, miedo a la fragilidad o una parte de tu bienestar que necesita atención.'
      }
    ]
  },
  de: {
    slug: 'krankenhaus',
    name: 'Krankenhaus',
    shortDescription:
      'Ein Krankenhaus im Traum weist oft auf Heilung, Verletzlichkeit, Gesundheitsangst oder den Wunsch nach Unterstützung hin.',
    askYourself: [
      'Welcher Bereich meines Lebens braucht Pflege oder Erholung?',
      'Trage ich Stress, Angst oder emotionale Belastung allein?',
      'Fühlte sich der Traum wie Notfall, Warten, Erleichterung oder Furcht an?'
    ],
    faq: [
      {
        question: 'Was bedeutet ein Krankenhaus im Traum?',
        answer:
          'Ein Krankenhaus im Traum deutet meist darauf hin, dass etwas Aufmerksamkeit, Heilung oder Unterstützung braucht. Es kann um Gesundheit gehen, aber auch um seelische Erschöpfung, Sorge um Angehörige oder den Wunsch nach Hilfe.'
      },
      {
        question: 'Was bedeutet es, im Traum selbst im Krankenhaus zu sein?',
        answer:
          'Selbst im Krankenhaus zu sein steht oft für Verletzlichkeit und Erholung. Der Traum kann zeigen, dass Sie Ruhe, Begleitung oder eine bewusstere Fürsorge für sich brauchen.'
      },
      {
        question: 'Was bedeuten Ärzte, Pflegekräfte oder kranke Menschen im Krankenhaustraum?',
        answer:
          'Ärzte und Pflegekräfte können Hilfe, Orientierung oder Diagnose symbolisieren. Kranke Menschen können Sorge um andere oder einen vernachlässigten Teil des eigenen Wohlbefindens darstellen.'
      }
    ]
  },
  it: {
    slug: 'ospedale',
    name: 'Ospedale',
    shortDescription:
      'Sognare un ospedale parla spesso di guarigione, vulnerabilità, preoccupazioni di salute o bisogno di accettare aiuto.',
    askYourself: [
      'Quale parte della mia vita ha bisogno di cura o recupero?',
      'Sto affrontando stress, paura o dolore emotivo senza abbastanza sostegno?',
      'Il sogno sembrava un’emergenza, un’attesa, un sollievo o una paura?'
    ],
    faq: [
      {
        question: 'Cosa significa sognare un ospedale?',
        answer:
          'Sognare un ospedale indica spesso che qualcosa richiede attenzione, cura o guarigione. Può riguardare la salute, ma anche stanchezza emotiva, preoccupazione per una persona cara o bisogno di supporto.'
      },
      {
        question: 'Cosa significa sognare di essere in ospedale?',
        answer:
          'Essere in ospedale in sogno richiama vulnerabilità e recupero. Può indicare che hai bisogno di riposo, aiuto o tempo per affrontare una situazione stressante.'
      },
      {
        question: 'Cosa significano medici, infermieri o malati in un sogno di ospedale?',
        answer:
          'Medici e infermieri possono rappresentare guida, diagnosi o sostegno. I malati possono riflettere preoccupazione per gli altri o una parte del tuo benessere che stai trascurando.'
      }
    ]
  },
  relatedSymbols: ['house', 'school', 'deceased-person', 'blood', 'body', 'child'],
  relatedArticles: {
    de: '',
    it: ''
  }
};

const extendedUpdate = {
  en: {
    fullInterpretation:
      '<p>Hospitals in dreams are strong symbols of healing, vulnerability, and the need for care. Because a hospital is where problems are examined and treated, a hospital dream often appears when your mind is trying to process stress, health worries, emotional wounds, or a situation that has become too heavy to manage alone.</p>\n<p>If you dream that you are in a hospital, the central theme is usually recovery. You may need rest, support, clearer boundaries, or a practical plan to deal with something you have been postponing. The dream does not automatically predict illness; more often, it asks what needs attention before it becomes urgent.</p>\n<p>Dreaming about doctors, nurses, medical rooms, or tests can point to diagnosis and guidance. Your subconscious may be looking for an answer, a second opinion, or permission to accept help. A crowded hospital or a hospital full of sick people can reflect emotional overload, family worry, or the sense that many problems are asking for care at once.</p>\n<p>The emotional tone matters. A calm hospital can suggest that healing is possible and support is available. A chaotic emergency room may show anxiety, pressure, or a problem that feels immediate. An abandoned hospital can reveal fear of being unsupported when you most need care.</p>',
    variations: [
      {
        context: 'Being in a hospital',
        meaning:
          'Often reflects vulnerability, recovery, or the need to accept help instead of trying to stay in control.'
      },
      {
        context: 'Hospital with doctors or nurses',
        meaning:
          'Suggests guidance, diagnosis, or support. You may be looking for clarity about a health, emotional, or family concern.'
      },
      {
        context: 'Hospital full of sick people',
        meaning:
          'Can symbolize emotional overload, worry for others, or the feeling that many issues need attention at the same time.'
      },
      {
        context: 'Visiting someone in hospital',
        meaning:
          'May represent concern for a loved one, empathy, or awareness that a relationship needs care.'
      },
      {
        context: 'Emergency room',
        meaning:
          'Points to an urgent issue, a crisis feeling, or a problem you can no longer postpone.'
      },
      {
        context: 'Abandoned hospital',
        meaning:
          'Can express fear of not finding support, mistrust of help, or a neglected part of your wellbeing.'
      },
      {
        context: 'Working in a hospital',
        meaning:
          'May show your role as caregiver, mediator, or the person others rely on when things are difficult.'
      }
    ]
  },
  fr: {
    fullInterpretation:
      "<p>Rêver d'hôpital parle souvent de guérison, de vulnérabilité et de besoin de soin. Comme l'hôpital est un lieu où l'on examine et traite ce qui ne va pas, il apparaît fréquemment quand votre esprit tente de comprendre une fatigue, une inquiétude de santé, une blessure émotionnelle ou une situation devenue trop lourde à porter seul.</p>\n<p>Si vous rêvez que vous êtes à l'hôpital, le thème principal est généralement la récupération. Vous avez peut-être besoin de repos, de soutien, de limites plus claires ou d'un plan concret pour traiter ce que vous repoussez. Le rêve n'annonce pas forcément une maladie; il demande plutôt ce qui a besoin d'attention avant de devenir urgent.</p>\n<p>Les médecins, infirmières, chambres ou examens médicaux évoquent souvent le diagnostic et l'accompagnement. Votre inconscient peut chercher une réponse, un avis extérieur ou l'autorisation d'accepter de l'aide. Un hôpital rempli de malades peut refléter une surcharge émotionnelle, une inquiétude familiale ou l'impression que trop de problèmes réclament du soin en même temps.</p>\n<p>L'ambiance du rêve compte beaucoup. Un hôpital calme peut indiquer que la guérison est possible et que du soutien existe. Des urgences chaotiques signalent plutôt la pression, l'anxiété ou une situation qui semble immédiate. Un hôpital abandonné peut révéler la peur de ne pas être aidé au moment où vous en avez besoin.</p>",
    variations: [
      {
        context: "Être à l'hôpital",
        meaning:
          "Reflète souvent la vulnérabilité, la récupération ou le besoin d'accepter de l'aide au lieu de tout contrôler."
      },
      {
        context: 'Hôpital avec médecins ou infirmières',
        meaning:
          "Suggère un besoin de guidance, de diagnostic ou de soutien face à une inquiétude de santé, émotionnelle ou familiale."
      },
      {
        context: 'Hôpital rempli de malades',
        meaning:
          "Peut symboliser une surcharge émotionnelle, l'inquiétude pour plusieurs personnes ou trop de problèmes à gérer à la fois."
      },
      {
        context: "Visiter quelqu'un à l'hôpital",
        meaning:
          "Peut représenter l'inquiétude pour un proche, l'empathie ou la conscience qu'une relation demande du soin."
      },
      {
        context: "Service d'urgence",
        meaning:
          "Indique un problème pressant, une sensation de crise ou une situation que vous ne pouvez plus repousser."
      },
      {
        context: 'Hôpital abandonné',
        meaning:
          "Peut exprimer la peur de manquer de soutien, une méfiance envers l'aide ou une part négligée de votre bien-être."
      },
      {
        context: "Travailler dans un hôpital",
        meaning:
          "Peut montrer votre rôle de soignant, de médiateur ou de personne sur qui les autres comptent dans les moments difficiles."
      }
    ]
  },
  es: {
    fullInterpretation:
      '<p>Soñar con hospital suele hablar de sanación, vulnerabilidad y necesidad de cuidado. Como el hospital es el lugar donde se examina y se trata lo que duele, este sueño aparece a menudo cuando tu mente intenta procesar estrés, preocupación por la salud, heridas emocionales o una situación que ya pesa demasiado para llevarla en soledad.</p>\n<p>Si sueñas que estás en un hospital, el tema central suele ser recuperación. Puede que necesites descanso, apoyo, límites más claros o un plan concreto para atender algo que has estado evitando. No significa necesariamente enfermedad; muchas veces pregunta qué necesita atención antes de convertirse en una urgencia.</p>\n<p>Soñar con hospital y doctores, enfermeras, camillas o exámenes médicos apunta a diagnóstico y guía. Tu subconsciente puede estar buscando una respuesta, una segunda opinión o permiso para aceptar ayuda. Un hospital lleno de enfermos o de gente puede reflejar sobrecarga emocional, preocupación familiar o la sensación de que muchos problemas necesitan cuidado al mismo tiempo.</p>\n<p>El ambiente del sueño cambia la interpretación. Un hospital tranquilo puede sugerir que la sanación es posible y que hay apoyo disponible. Una sala de emergencias caótica señala ansiedad, presión o un problema que se siente inmediato. Un hospital abandonado puede revelar miedo a no recibir ayuda cuando más la necesitas.</p>',
    variations: [
      {
        context: 'Estar en un hospital',
        meaning:
          'Suele reflejar vulnerabilidad, recuperación o necesidad de aceptar ayuda en vez de intentar controlarlo todo.'
      },
      {
        context: 'Hospital con doctores o enfermeras',
        meaning:
          'Sugiere guía, diagnóstico o apoyo. Puedes estar buscando claridad sobre una preocupación de salud, emocional o familiar.'
      },
      {
        context: 'Hospital lleno de enfermos',
        meaning:
          'Puede simbolizar sobrecarga emocional, preocupación por otras personas o la sensación de que demasiados asuntos piden cuidado a la vez.'
      },
      {
        context: 'Visitar a alguien en el hospital',
        meaning:
          'Puede representar preocupación por un ser querido, empatía o conciencia de que una relación necesita atención.'
      },
      {
        context: 'Sala de emergencias',
        meaning:
          'Señala un problema urgente, una sensación de crisis o algo que ya no conviene posponer.'
      },
      {
        context: 'Hospital abandonado',
        meaning:
          'Puede expresar miedo a no encontrar apoyo, desconfianza hacia la ayuda o una parte descuidada de tu bienestar.'
      },
      {
        context: 'Trabajar en un hospital',
        meaning:
          'Puede mostrar tu papel de cuidador, mediador o persona en la que otros se apoyan cuando algo se complica.'
      }
    ]
  },
  de: {
    fullInterpretation:
      '<p>Ein Krankenhaus im Traum steht häufig für Heilung, Verletzlichkeit und den Wunsch nach Fürsorge. Als Ort, an dem Beschwerden untersucht und behandelt werden, erscheint es oft, wenn Ihre Psyche Stress, Gesundheitsängste, emotionale Wunden oder eine belastende Situation verarbeitet.</p>\n<p>Wenn Sie träumen, selbst im Krankenhaus zu sein, geht es meist um Erholung. Vielleicht brauchen Sie Ruhe, Unterstützung, klarere Grenzen oder einen konkreten Umgang mit etwas, das Sie aufgeschoben haben. Der Traum sagt nicht automatisch Krankheit voraus; er fragt eher, was Aufmerksamkeit braucht, bevor es dringend wird.</p>\n<p>Ärzte, Pflegekräfte, Untersuchungen oder Krankenzimmer verweisen auf Diagnose und Orientierung. Ihr Unterbewusstsein sucht möglicherweise eine Antwort, eine zweite Meinung oder die Erlaubnis, Hilfe anzunehmen. Ein Krankenhaus voller kranker Menschen kann emotionale Überlastung, Sorge um Angehörige oder zu viele gleichzeitige Probleme spiegeln.</p>\n<p>Die Stimmung im Traum ist entscheidend. Ein ruhiges Krankenhaus kann zeigen, dass Heilung möglich ist und Unterstützung vorhanden ist. Eine chaotische Notaufnahme deutet auf Druck, Angst oder ein akutes Thema hin. Ein verlassenes Krankenhaus kann die Sorge ausdrücken, ausgerechnet im Bedarfsfall keine Hilfe zu bekommen.</p>',
    variations: [
      {
        context: 'Selbst im Krankenhaus sein',
        meaning:
          'Steht oft für Verletzlichkeit, Erholung oder die Notwendigkeit, Hilfe anzunehmen statt alles kontrollieren zu wollen.'
      },
      {
        context: 'Krankenhaus mit Ärzten oder Pflegekräften',
        meaning:
          'Deutet auf Orientierung, Diagnose oder Unterstützung bei gesundheitlichen, emotionalen oder familiären Sorgen hin.'
      },
      {
        context: 'Krankenhaus voller kranker Menschen',
        meaning:
          'Kann emotionale Überlastung, Sorge um andere oder das Gefühl symbolisieren, dass zu viele Dinge gleichzeitig Aufmerksamkeit brauchen.'
      },
      {
        context: 'Jemanden im Krankenhaus besuchen',
        meaning:
          'Kann Fürsorge für eine nahestehende Person oder das Bewusstsein zeigen, dass eine Beziehung Pflege braucht.'
      },
      {
        context: 'Notaufnahme',
        meaning:
          'Weist auf ein dringendes Thema, Krisengefühl oder ein Problem hin, das Sie nicht länger aufschieben sollten.'
      },
      {
        context: 'Verlassenes Krankenhaus',
        meaning:
          'Kann Angst vor fehlender Unterstützung, Misstrauen gegenüber Hilfe oder vernachlässigtes Wohlbefinden ausdrücken.'
      },
      {
        context: 'In einem Krankenhaus arbeiten',
        meaning:
          'Zeigt möglicherweise Ihre Rolle als Helfer, Vermittler oder verlässliche Person in schwierigen Situationen.'
      }
    ]
  },
  it: {
    fullInterpretation:
      '<p>Sognare un ospedale richiama spesso guarigione, vulnerabilità e bisogno di cura. Poiché l’ospedale è il luogo in cui si osserva e si tratta ciò che fa male, questo sogno compare spesso quando la mente sta elaborando stress, preoccupazioni di salute, ferite emotive o una situazione diventata troppo pesante da gestire da soli.</p>\n<p>Se sogni di essere in ospedale, il tema centrale è di solito il recupero. Potresti aver bisogno di riposo, sostegno, confini più chiari o un piano concreto per affrontare qualcosa che stai rimandando. Il sogno non predice automaticamente una malattia; più spesso chiede cosa ha bisogno di attenzione prima che diventi urgente.</p>\n<p>Medici, infermieri, stanze o esami medici indicano diagnosi e orientamento. Il tuo subconscio potrebbe cercare una risposta, un secondo parere o il permesso di accettare aiuto. Un ospedale pieno di malati può riflettere sovraccarico emotivo, preoccupazione familiare o la sensazione che troppe questioni richiedano cura allo stesso tempo.</p>\n<p>L’atmosfera del sogno è importante. Un ospedale tranquillo può suggerire che la guarigione è possibile e che il supporto esiste. Un pronto soccorso caotico segnala ansia, pressione o un problema percepito come immediato. Un ospedale abbandonato può rivelare la paura di non trovare aiuto quando serve.</p>',
    variations: [
      {
        context: 'Essere in ospedale',
        meaning:
          'Riflette spesso vulnerabilità, recupero o bisogno di accettare aiuto invece di controllare tutto da soli.'
      },
      {
        context: 'Ospedale con medici o infermieri',
        meaning:
          'Suggerisce guida, diagnosi o supporto rispetto a una preoccupazione di salute, emotiva o familiare.'
      },
      {
        context: 'Ospedale pieno di malati',
        meaning:
          'Può simboleggiare sovraccarico emotivo, preoccupazione per gli altri o troppe questioni che chiedono cura insieme.'
      },
      {
        context: 'Visitare qualcuno in ospedale',
        meaning:
          'Può rappresentare preoccupazione per una persona cara, empatia o consapevolezza che una relazione ha bisogno di attenzione.'
      },
      {
        context: 'Pronto soccorso',
        meaning:
          'Indica un tema urgente, una sensazione di crisi o qualcosa che non conviene più rimandare.'
      },
      {
        context: 'Ospedale abbandonato',
        meaning:
          'Può esprimere paura di non trovare sostegno, sfiducia nell’aiuto o una parte trascurata del tuo benessere.'
      },
      {
        context: 'Lavorare in ospedale',
        meaning:
          'Può mostrare il tuo ruolo di caregiver, mediatore o persona su cui gli altri fanno affidamento nei momenti difficili.'
      }
    ]
  }
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function writeJson(relativePath, data) {
  fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function updateSymbolsFile(relativePath) {
  const data = readJson(relativePath);
  const symbol = data.symbols.find((entry) => entry.id === 'hospital');
  if (!symbol) {
    throw new Error(`Missing hospital symbol in ${relativePath}`);
  }

  for (const lang of ['en', 'fr', 'es', 'de', 'it']) {
    symbol[lang] = {
      ...symbol[lang],
      ...symbolUpdate[lang]
    };
  }
  symbol.relatedSymbols = symbolUpdate.relatedSymbols;
  symbol.relatedArticles = symbolUpdate.relatedArticles;

  writeJson(relativePath, data);
}

function updateExtendedFile(relativePath) {
  const data = readJson(relativePath);
  if (!data.symbols) data.symbols = {};
  data.symbols.hospital = extendedUpdate;
  writeJson(relativePath, data);
}

for (const file of ['data/dream-symbols.json', 'docs/data/dream-symbols.json']) {
  updateSymbolsFile(file);
}

for (const file of ['data/dream-symbols-extended.json', 'docs/data/dream-symbols-extended.json']) {
  updateExtendedFile(file);
}

console.log('Updated hospital symbol SEO content in data/ and docs/data/.');
