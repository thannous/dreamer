#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LANGS = ['en', 'fr', 'es', 'de', 'it'];
const TODAY = '2026-05-04';
const ARTICLE_ID = 'blog.exam-dreams-meaning';
const ARTICLE_DIR = path.join(ROOT, 'docs-src', 'content', 'blog', ARTICLE_ID);

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function writeJson(relPath, data) {
  fs.writeFileSync(path.join(ROOT, relPath), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function splitSource(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Invalid source front matter');
  return { meta: JSON.parse(match[1]), body: match[2] };
}

function joinSource(meta, body) {
  return `---\n${JSON.stringify(meta, null, 2)}\n---\n${body}`;
}

function readSource(relPath) {
  return splitSource(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function writeSource(relPath, meta, body) {
  fs.writeFileSync(path.join(ROOT, relPath), joinSource(meta, body), 'utf8');
}

function parseJsonLd(meta) {
  return (meta.jsonLd || []).map((entry) => JSON.parse(entry));
}

function serializeJsonLd(list) {
  return list.map((entry) => JSON.stringify(entry, null, 2));
}

function upsertJsonLd(meta, schemaType, data) {
  const list = parseJsonLd(meta);
  const index = list.findIndex((entry) => entry['@type'] === schemaType);
  if (index >= 0) list[index] = data;
  else list.push(data);
  meta.jsonLd = serializeJsonLd(list);
}

function updateBlogPosting(meta, fields) {
  const list = parseJsonLd(meta);
  const posting = list.find((entry) => entry['@type'] === 'BlogPosting');
  if (!posting) return;
  Object.assign(posting, fields);
  if (fields.headline) posting.headline = fields.headline;
  if (fields.description) posting.description = fields.description;
  if (fields.url) {
    posting.url = fields.url;
    posting.mainEntityOfPage = { '@type': 'WebPage', '@id': fields.url };
  }
  posting.dateModified = TODAY;
  meta.jsonLd = serializeJsonLd(list);
}

function updateMeta(meta, { title, description, ogTitle = title, ogDescription = description }) {
  meta.title = title;
  meta.description = description;
  meta.ogTitle = ogTitle;
  meta.ogDescription = ogDescription;
  meta.twitterTitle = ogTitle;
  meta.twitterDescription = ogDescription;
  meta.modifiedTime = TODAY;
}

function replaceQuickAnswer(body, text) {
  return body.replace(
    /(<section[^>]*aria-labelledby="quick-answer-title"[\s\S]*?<p class="text-purple-100\/80 leading-relaxed">)[\s\S]*?(<\/p>\s*<\/section>)/,
    `$1${text}$2`
  );
}

function insertOnce(body, marker, html, beforeNeedle) {
  if (body.includes(marker)) return body;
  const index = body.indexOf(beforeNeedle);
  if (index === -1) throw new Error(`Missing insertion point: ${beforeNeedle}`);
  return `${body.slice(0, index)}${html}\n${body.slice(index)}`;
}

function buildVisibleFaq(faq, lang) {
  const heading = {
    en: 'Frequently asked questions',
    fr: 'Questions fréquentes',
    es: 'Preguntas frecuentes',
    de: 'Häufige Fragen',
    it: 'Domande frequenti'
  }[lang] || 'FAQ';
  const cards = faq.map(([question, answer]) => `
<div class="glass-panel rounded-xl p-5 border border-white/10">
<h3 class="font-serif text-lg text-dream-cream mb-2">${question}</h3>
<p class="text-sm text-gray-300 leading-relaxed">${answer}</p>
</div>`).join('\n');
  return `
<!-- GSC Visible FAQ -->
<section class="glass-panel rounded-2xl p-6 my-10 border border-white/10">
<h2 class="font-serif text-2xl text-dream-cream mb-4">${heading}</h2>
<div class="grid gap-4">${cards}
</div>
</section>
`;
}

function updateSymbols() {
  const files = ['data/dream-symbols.json', 'docs/data/dream-symbols.json'];
  for (const relPath of files) {
    const data = readJson(relPath);
    const byId = new Map(data.symbols.map((symbol) => [symbol.id, symbol]));

    Object.assign(byId.get('door').es, {
      shortDescription: 'Soñar con puertas habla de oportunidades, cambios y límites. Una puerta cerrada señala bloqueo o decisión pendiente; una puerta abierta sugiere acceso, permiso o un nuevo comienzo.',
      askYourself: [
        '¿Qué puerta quiero abrir o cerrar en mi vida?',
        '¿Estoy evitando una decisión, una conversación o un cambio?',
        '¿La puerta del sueño era de mi casa, desconocida, abierta o cerrada?'
      ],
      seoTitle: 'Puerta',
      faq: [
        {
          question: '¿Qué significa soñar con puertas?',
          answer: 'Soñar con puertas suele relacionarse con oportunidades, decisiones y cambios de etapa. La interpretación depende de si la puerta estaba abierta, cerrada, bloqueada o si intentabas cruzarla.'
        },
        {
          question: '¿Qué significa soñar con abrir una puerta cerrada?',
          answer: 'Abrir una puerta cerrada en sueños indica que estás intentando superar un bloqueo, acceder a una oportunidad o resolver algo que antes parecía inaccesible.'
        },
        {
          question: '¿Qué significa soñar con la puerta abierta de tu casa?',
          answer: 'Una puerta abierta en casa puede señalar vulnerabilidad, confianza o una situación personal que está demasiado expuesta. También puede simbolizar bienvenida y apertura emocional.'
        }
      ]
    });

    Object.assign(byId.get('door').it, {
      shortDescription: 'Sognare una porta parla di passaggi, opportunità e confini personali. Una porta aperta indica accesso o cambiamento; una porta chiusa segnala ostacoli o una decisione rimandata.',
      askYourself: [
        'Quale passaggio sto per attraversare?',
        'Sto cercando di aprire o chiudere una fase della mia vita?',
        'La porta era di casa, aperta, chiusa o difficile da aprire?'
      ],
      faq: [
        {
          question: 'Cosa significa sognare una porta?',
          answer: 'Sognare una porta indica spesso una transizione, una scelta o un confine personale. Il significato cambia se la porta è aperta, chiusa, bloccata o collegata alla casa.'
        },
        {
          question: 'Cosa significa sognare la porta di casa aperta?',
          answer: 'La porta di casa aperta può riflettere vulnerabilità, fiducia o qualcosa della vita privata che senti esposto. In alcuni sogni indica anche disponibilità al cambiamento.'
        },
        {
          question: 'Cosa significa sognare una porta che si apre?',
          answer: 'Una porta che si apre suggerisce possibilità, accesso a una nuova fase o una soluzione che inizia a diventare disponibile.'
        }
      ]
    });

    Object.assign(byId.get('bridge').es, {
      shortDescription: 'Soñar con un puente habla de transición, decisiones y paso entre dos etapas. Un puente roto o peligroso refleja miedo a que el cambio falle o a no poder cruzar.',
      askYourself: [
        '¿Qué etapa estoy intentando cruzar?',
        '¿El puente se veía firme, roto, alto o sobre agua?',
        '¿Tengo miedo de avanzar o de dejar algo atrás?'
      ],
      seoTitle: 'Puente',
      faq: [
        {
          question: '¿Qué significa soñar con un puente?',
          answer: 'Un puente en sueños representa un paso entre dos etapas, una conexión o una decisión de avance. Cruzarlo suele hablar de cambio; no poder cruzarlo señala duda o bloqueo.'
        },
        {
          question: '¿Qué significa soñar con un puente roto?',
          answer: 'Soñar con un puente roto indica miedo a que una transición no funcione, una relación dañada o la sensación de que falta apoyo para llegar al otro lado.'
        },
        {
          question: '¿Qué significa soñar con un puente y agua?',
          answer: 'El agua añade carga emocional al sueño. Un puente sobre agua puede mostrar que intentas atravesar una emoción intensa sin dejar que te arrastre.'
        }
      ]
    });

    Object.assign(byId.get('forest').es, {
      shortDescription: 'Soñar con un bosque refleja exploración interior, incertidumbre y contacto con lo desconocido. Un bosque oscuro señala miedo o confusión; uno verde puede indicar crecimiento.',
      askYourself: [
        '¿Me sentía perdido, curioso o protegido en el bosque?',
        '¿El bosque era oscuro, verde, grande o de noche?',
        '¿Qué parte de mi vida se siente incierta ahora?'
      ],
      seoTitle: 'Bosque',
      faq: [
        {
          question: '¿Qué significa soñar con un bosque?',
          answer: 'Soñar con un bosque suele simbolizar entrar en una zona desconocida de tu vida o de tu mundo interior. Puede hablar de búsqueda, miedo, crecimiento o necesidad de orientación.'
        },
        {
          question: '¿Qué significa soñar con un bosque oscuro?',
          answer: 'Un bosque oscuro refleja incertidumbre, miedo a lo desconocido o una etapa en la que no ves claro el camino. No siempre es negativo: también puede marcar el inicio de una exploración profunda.'
        },
        {
          question: '¿Qué significa soñar con un bosque verde?',
          answer: 'Un bosque verde suele asociarse con crecimiento, recuperación y conexión natural. Puede indicar que algo interno está madurando aunque todavía no esté completamente claro.'
        }
      ]
    });

    Object.assign(byId.get('wolf').es, {
      shortDescription: 'Soñar con lobos habla de instinto, amenaza, protección y pertenencia. Un lobo puede reflejar intuición; muchos lobos apuntan a grupo, presión social o necesidad de apoyo.',
      askYourself: [
        '¿El lobo me atacaba, me protegía o solo me observaba?',
        '¿Era un lobo solo o una manada de lobos?',
        '¿Qué instinto estoy ignorando en mi vida despierta?'
      ],
      seoTitle: 'Lobo',
      faq: [
        {
          question: '¿Qué significa soñar con lobos?',
          answer: 'Soñar con lobos puede hablar de instinto, protección, amenaza o pertenencia a un grupo. La interpretación depende de si los lobos atacan, acompañan, persiguen o aparecen como manada.'
        },
        {
          question: '¿Qué significa soñar con un lobo?',
          answer: 'Un solo lobo suele representar intuición, independencia o una fuerza instintiva que necesitas escuchar. Si el lobo da miedo, puede señalar desconfianza o una amenaza percibida.'
        },
        {
          question: '¿Qué significa soñar con lobos que atacan?',
          answer: 'Lobos que atacan reflejan presión, miedo, conflicto o una emoción instintiva que se siente fuera de control. También pueden simbolizar sentirte rodeado por críticas o expectativas.'
        }
      ]
    });

    writeJson(relPath, data);
  }

  const extendedFiles = ['data/dream-symbols-extended.json', 'docs/data/dream-symbols-extended.json'];
  for (const relPath of extendedFiles) {
    const data = readJson(relPath);
    Object.assign(data.symbols.door.es, {
      fullInterpretation: '<p>Soñar con puertas suele aparecer cuando estás ante una decisión, una oportunidad o un límite personal. La puerta marca un antes y un después: cruzarla, abrirla o cerrarla muestra cómo te relacionas con el cambio.</p>\n<p>Una puerta cerrada no siempre significa rechazo; puede señalar una respuesta que aún no tienes, una conversación pendiente o una etapa que requiere preparación. Si sueñas con abrir una puerta cerrada, el sueño apunta a una búsqueda activa de salida, permiso o acceso.</p>\n<p>Cuando la puerta pertenece a tu casa, el símbolo se vuelve más íntimo. Una puerta abierta de casa puede hablar de confianza, vulnerabilidad o sensación de exposición. Muchas puertas sugieren varias opciones a la vez y la necesidad de elegir con calma.</p>',
      variations: [
        { context: 'Puerta cerrada', meaning: 'Bloqueo, límite, decisión pendiente o acceso que todavía requiere preparación.' },
        { context: 'Abrir una puerta cerrada', meaning: 'Intento de superar un obstáculo, entrar en una nueva etapa o resolver algo inaccesible.' },
        { context: 'Puerta abierta de casa', meaning: 'Vulnerabilidad, confianza, bienvenida o vida privada demasiado expuesta.' },
        { context: 'Muchas puertas', meaning: 'Varias opciones, caminos posibles o dificultad para decidir.' }
      ]
    });
    Object.assign(data.symbols.door.it, {
      fullInterpretation: '<p>Sognare una porta indica spesso un passaggio tra due fasi della vita. La porta separa ciò che conosci da ciò che puoi scoprire: aprirla, chiuderla o restare davanti alla soglia mostra il tuo rapporto con il cambiamento.</p>\n<p>Una porta chiusa può segnalare un ostacolo, una decisione rimandata o qualcosa a cui non ti senti ancora pronto ad accedere. Una porta che si apre, invece, suggerisce possibilità, permesso e movimento.</p>\n<p>Se la porta è quella di casa, il sogno riguarda più direttamente la sicurezza personale. Una porta di casa aperta può indicare fiducia, vulnerabilità o la sensazione che qualcosa di privato sia troppo esposto.</p>',
      variations: [
        { context: 'Porta di casa aperta', meaning: 'Vulnerabilità, fiducia o una parte della vita privata che senti esposta.' },
        { context: 'Porta che si apre', meaning: 'Accesso, occasione disponibile o nuova fase che inizia.' },
        { context: 'Porta chiusa', meaning: 'Limite, ostacolo o decisione non ancora pronta.' },
        { context: 'Non riuscire ad aprire una porta', meaning: 'Frustrazione, blocco o bisogno di trovare un modo diverso per avanzare.' }
      ]
    });
    Object.assign(data.symbols.bridge.es, {
      fullInterpretation: '<p>Soñar con un puente habla de transición: pasar de una etapa a otra, conectar dos partes de tu vida o decidir si avanzas. El puente es importante porque no es el destino, sino el paso.</p>\n<p>Un puente roto, inestable o peligroso suele reflejar miedo a que el cambio falle. Puede apuntar a una relación dañada, un proyecto que no tiene suficiente apoyo o una decisión que todavía no se siente segura.</p>\n<p>Cuando el puente aparece sobre agua, el sueño mezcla transición y emoción. Cruzar sobre agua indica que intentas mantener dirección mientras atraviesas incertidumbre, ansiedad o sentimientos intensos.</p>',
      variations: [
        { context: 'Puente roto', meaning: 'Miedo a que una transición falle, conexión dañada o falta de apoyo.' },
        { context: 'Cruzar un puente', meaning: 'Avance, decisión tomada y disposición a dejar una etapa atrás.' },
        { context: 'Puente sobre agua', meaning: 'Cambio atravesado con emoción intensa o miedo a perder el control.' },
        { context: 'Puente peligroso', meaning: 'Duda, inseguridad o sensación de que el camino actual no es estable.' }
      ]
    });
    Object.assign(data.symbols.forest.es, {
      fullInterpretation: '<p>Soñar con un bosque suele indicar que estás entrando en una zona menos conocida de tu vida interior. El bosque puede ser misterio, miedo, crecimiento o búsqueda de dirección según la luz, el camino y la emoción del sueño.</p>\n<p>Un bosque oscuro concentra la idea de incertidumbre: no ves todo el camino, pero algo te invita a mirar más profundo. Si te pierdes, el sueño puede hablar de confusión o de demasiadas decisiones abiertas.</p>\n<p>Un bosque verde, claro o vivo suele tener un tono más reparador. Puede reflejar crecimiento, recuperación emocional y contacto con una parte más natural de ti.</p>',
      variations: [
        { context: 'Bosque oscuro', meaning: 'Incertidumbre, miedo a lo desconocido o exploración interior profunda.' },
        { context: 'Bosque verde', meaning: 'Crecimiento, recuperación, vitalidad y conexión con lo natural.' },
        { context: 'Perderse en un bosque', meaning: 'Confusión, falta de dirección o necesidad de una guía interna.' },
        { context: 'Caminar por un bosque', meaning: 'Proceso de búsqueda, introspección o avance gradual.' }
      ]
    });
    Object.assign(data.symbols.wolf.es, {
      fullInterpretation: '<p>Soñar con lobos conecta con el instinto, la amenaza, la protección y la pertenencia. Un lobo puede ser peligroso, pero también puede representar intuición, fuerza y fidelidad a la propia naturaleza.</p>\n<p>Si aparece un solo lobo, mira si te observaba, te guiaba o te atacaba. Puede simbolizar independencia, desconfianza o una voz interna que necesitas escuchar. Una manada de lobos, en cambio, habla de grupo, presión social, familia o necesidad de apoyo.</p>\n<p>Cuando los lobos atacan o persiguen, el sueño suele reflejar miedo, conflicto o sensación de estar rodeado por expectativas. Si el lobo protege, puede representar una fuerza interna que empieza a defenderte.</p>',
      variations: [
        { context: 'Un lobo', meaning: 'Independencia, intuición, vigilancia o fuerza instintiva.' },
        { context: 'Muchos lobos', meaning: 'Grupo, pertenencia, presión social o necesidad de apoyo.' },
        { context: 'Lobos que atacan', meaning: 'Conflicto, miedo, amenaza percibida o emoción instintiva desbordada.' },
        { context: 'Lobo protector', meaning: 'Defensa interna, aliado simbólico o confianza en el instinto.' }
      ]
    });
    writeJson(relPath, data);
  }
}

const articleCorrections = [
  {
    relPath: 'docs-src/content/blog/blog.water-dreams-meaning/es.md',
    title: 'Soñar con agua o inundaciones: significado según el sueño | Noctalia',
    description: 'Qué significa soñar con agua, inundaciones, agua de mar, casa inundada o ahogarse, y cómo leerlo según tus emociones.',
    headline: 'Soñar con agua o inundaciones: significado según el sueño',
    url: 'https://noctalia.app/es/blog/suenos-de-agua',
    quickAnswer: 'Soñar con agua suele hablar de emociones. Si el agua está tranquila, puede indicar calma; si se desborda, el sueño apunta a estrés, saturación o pérdida de control. Soñar con inundaciones señala emociones que ya no caben en su lugar habitual, especialmente si el agua entra en casa, viene del mar o arrastra objetos.',
    faq: [
      ['¿Qué significa soñar con agua?', 'Soñar con agua representa emociones, recuerdos y estados internos. El significado cambia según si el agua está limpia, sucia, tranquila, profunda o desbordada.'],
      ['¿Qué significa soñar con inundaciones?', 'Soñar con inundaciones indica emociones, estrés o cambios que se sienten difíciles de contener. Puede aparecer cuando una situación familiar, laboral o afectiva te supera.'],
      ['¿Qué significa soñar con inundaciones de agua de mar?', 'El agua de mar añade profundidad emocional e incertidumbre. Una inundación de agua de mar puede mostrar que emociones antiguas o muy intensas están entrando en tu vida consciente.'],
      ['¿Qué significa soñar con una casa inundada?', 'La casa representa tu mundo íntimo. Una casa inundada sugiere que preocupaciones, conflictos o emociones intensas están invadiendo tu espacio de seguridad.']
    ],
    block: `
<!-- GSC SEO Update: water and flood intent -->
<section class="glass-panel rounded-2xl p-6 my-10 border border-dream-salmon/15 bg-white/5">
<h2 class="font-serif text-2xl text-dream-cream mb-4">Soñar con inundaciones: cuando el agua se desborda</h2>
<p class="text-purple-100/80 leading-relaxed mb-4">Si llegaste buscando <strong>qué significa soñar con inundaciones</strong>, el punto central es la pérdida de contención. El sueño no habla solo de agua: habla de una emoción, responsabilidad o cambio que empieza a ocupar demasiado espacio.</p>
<div class="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Inundación en casa</h3><p>Se relaciona con familia, intimidad o seguridad personal afectada por estrés acumulado.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Inundación de agua de mar</h3><p>Apunta a emociones profundas, recuerdos o incertidumbre que llegan con fuerza.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Agua limpia</h3><p>Puede indicar liberación emocional, claridad o una limpieza necesaria.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Agua sucia</h3><p>Sugiere cansancio, confusión o emociones mezcladas que todavía necesitan orden.</p></div>
</div>
<p class="text-sm text-purple-200/70 mt-4">Para una lectura más específica, revisa también <a class="text-dream-salmon hover:underline" href="../simbolos/inundacion">soñar con inundación</a> y <a class="text-dream-salmon hover:underline" href="../simbolos/agua">soñar con agua</a>.</p>
</section>
`
  },
  {
    relPath: 'docs-src/content/blog/blog.flying-dreams-meaning/es.md',
    title: 'Soñar que vuelas: significado de volar en sueños | Noctalia',
    description: 'Qué significa soñar que vuelas, volar alto, volar a voluntad o elevarte en el aire, y cómo cambia según la emoción del sueño.',
    headline: 'Soñar que vuelas: significado de volar en sueños',
    url: 'https://noctalia.app/es/blog/suenos-de-volar',
    quickAnswer: 'Soñar que vuelas suele indicar libertad, deseo de superar límites o necesidad de tomar distancia. Si vuelas con facilidad, habla de confianza y control; si te cuesta mantenerte en el aire, puede reflejar dudas, presión o miedo a no poder sostener una meta.',
    faq: [
      ['¿Qué significa soñar que vuelas?', 'Soñar que vuelas suele simbolizar libertad, perspectiva y deseo de superar una limitación. La emoción del sueño determina si se vive como expansión, escape o control.'],
      ['¿Qué significa soñar que vuelo alto?', 'Volar alto puede representar ambición, confianza y necesidad de ver una situación desde más distancia. Si da miedo, puede señalar presión por expectativas demasiado altas.'],
      ['¿Qué significa soñar con volar a voluntad?', 'Volar a voluntad se relaciona con control, autonomía y a veces sueño lúcido. Indica que sientes más capacidad para decidir cómo moverte ante una situación.'],
      ['¿Qué significa soñar que te elevas en el aire?', 'Elevarte en el aire puede indicar alivio, deseo de escapar de una carga o una sensación de crecimiento personal que todavía está empezando.']
    ],
    block: `
<!-- GSC SEO Update: flying exact-match scenarios -->
<section class="glass-panel rounded-2xl p-6 my-10 border border-dream-salmon/15 bg-white/5">
<h2 class="font-serif text-2xl text-dream-cream mb-4">Soñar que vuelas: variantes más buscadas</h2>
<p class="text-purple-100/80 leading-relaxed mb-4">La pregunta no es solo si vuelas, sino <strong>cómo</strong>. El significado cambia si vuelas alto, si controlas el vuelo, si apenas te elevas o si intentas escapar.</p>
<ul class="space-y-3 text-gray-300">
<li><strong class="text-dream-cream">Volar alto:</strong> ambición, perspectiva, confianza o presión por llegar demasiado lejos.</li>
<li><strong class="text-dream-cream">Volar a voluntad:</strong> autonomía, control y posible relación con <a class="text-dream-salmon hover:underline" href="guia-suenos-lucidos-principiantes">sueños lúcidos</a>.</li>
<li><strong class="text-dream-cream">Elevarte en el aire:</strong> alivio, distancia emocional o inicio de una etapa de crecimiento.</li>
<li><strong class="text-dream-cream">No poder volar bien:</strong> dudas, miedo a fallar o sensación de que algo limita tu avance.</li>
</ul>
</section>
`
  },
  {
    relPath: 'docs-src/content/blog/blog.death-dreams-meaning/es.md',
    title: 'Soñar con muerte: qué significa si mueres o matas a alguien | Noctalia',
    description: 'Soñar con muerte no suele ser literal. Descubre qué significa soñar que mueres, que matas a alguien o que alguien cercano muere.',
    headline: 'Soñar con muerte: qué significa si mueres o matas a alguien',
    url: 'https://noctalia.app/es/blog/suenos-de-muerte',
    quickAnswer: 'Soñar con muerte casi nunca predice una muerte real. Suele hablar de final, cambio, miedo a perder algo o transformación. Si sueñas que mueres, el foco suele ser una etapa personal que termina; si sueñas que matas a alguien, puede reflejar rechazo de una parte de ti, ira o necesidad de cortar un patrón.',
    faq: [
      ['¿Qué significa soñar que me muero?', 'Soñar que te mueres suele simbolizar transformación, cierre de una etapa o miedo ante un cambio importante. No debe leerse como una predicción literal.'],
      ['¿Qué significa soñar que matas a alguien?', 'Soñar que matas a alguien puede reflejar enojo, necesidad de cortar un vínculo, rechazo de una conducta o deseo de terminar con una dinámica interna.'],
      ['¿Qué significa soñar que alguien muere?', 'Soñar que alguien muere suele señalar miedo a la pérdida, cambios en la relación o transformación de lo que esa persona representa para ti.'],
      ['¿Los sueños de muerte son malos?', 'No necesariamente. Aunque pueden asustar, muchas veces marcan transición, duelo simbólico, renovación o necesidad de aceptar un cambio.']
    ],
    block: `
<!-- GSC SEO Update: death high-position scenarios -->
<section class="glass-panel rounded-2xl p-6 my-10 border border-dream-salmon/15 bg-white/5">
<h2 class="font-serif text-2xl text-dream-cream mb-4">Si sueñas que mueres, matas a alguien o alguien muere</h2>
<p class="text-purple-100/80 leading-relaxed mb-4">Estas variantes aparecen con mucha ansiedad, pero el lenguaje onírico suele ser simbólico. La muerte marca un corte: algo termina, cambia o necesita dejar de ocupar el mismo lugar.</p>
<div class="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Me muero</h3><p>Transformación personal, cierre de identidad antigua o miedo a un cambio inevitable.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Mato a alguien</h3><p>Necesidad de cortar un patrón, enojo reprimido o rechazo de una parte simbólica.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Alguien muere</h3><p>Miedo a perder, cambio en el vínculo o transformación de lo que esa persona representa.</p></div>
</div>
</section>
`
  },
  {
    relPath: 'docs-src/content/blog/blog.precognitive-dreams-science/en.md',
    title: 'Precognitive dreams and confirmation bias: what science says | Noctalia',
    description: 'A clear scientific look at precognitive dreams, confirmation bias, coincidence, memory, and why some dreams feel like they predicted the future.',
    headline: 'Precognitive dreams and confirmation bias: what science says',
    url: 'https://noctalia.app/en/blog/precognitive-dreams-science',
    quickAnswer: 'Precognitive dreams can feel convincing, but mainstream science explains most cases through confirmation bias, coincidence, memory reconstruction, probability, and selective attention. A dream journal helps separate what was written before an event from what the mind connects afterward.',
    faq: [
      ['Are precognitive dreams real?', 'People do report dreams that later seem connected to real events, but mainstream science has not confirmed reliable dream-based prediction. Most cases can be explained by chance, memory, and interpretation after the fact.'],
      ['What is confirmation bias in precognitive dreams?', 'Confirmation bias is the tendency to notice dream details that match later events while ignoring the many dreams that do not. It makes coincidences feel more meaningful than they may be.'],
      ['Can a dream journal test a precognitive dream?', 'A dated dream journal can help because it records details before an event happens. It does not prove prediction by itself, but it reduces memory distortion and makes comparison more honest.']
    ],
    block: `
<!-- GSC SEO Update: confirmation bias intent -->
<section class="glass-panel rounded-2xl p-6 my-10 border border-dream-salmon/15 bg-white/5">
<h2 class="font-serif text-2xl text-dream-cream mb-4">Confirmation bias in precognitive dreams</h2>
<p class="text-purple-100/80 leading-relaxed mb-4">The strongest scientific explanation for many apparent precognitive dreams is <strong>confirmation bias</strong>: we remember the dream that seems to match an event and forget the many dreams that did not match anything.</p>
<ul class="space-y-3 text-gray-300">
<li><strong class="text-dream-cream">Selective attention:</strong> vivid details stand out after something similar happens.</li>
<li><strong class="text-dream-cream">Memory reconstruction:</strong> the remembered dream can shift after the event.</li>
<li><strong class="text-dream-cream">Probability:</strong> with many dreams over many nights, some partial matches are expected.</li>
<li><strong class="text-dream-cream">Dream journals:</strong> dated notes help compare the original dream with the later event more fairly.</li>
</ul>
</section>
`
  }
];

function updateArticleCorrections() {
  for (const item of articleCorrections) {
    const { meta, body } = readSource(item.relPath);
    updateMeta(meta, { title: item.title, description: item.description });
    updateBlogPosting(meta, {
      headline: item.headline,
      description: item.description,
      url: item.url
    });
    upsertJsonLd(meta, 'FAQPage', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: item.faq.map(([question, answer]) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer }
      }))
    });
    let nextBody = replaceQuickAnswer(body, item.quickAnswer);
    nextBody = insertOnce(nextBody, item.block.trim().split('\n')[0], item.block, '<figure');
    const lang = item.relPath.match(/\/([a-z]{2})\.md$/)?.[1] || 'en';
    nextBody = insertOnce(nextBody, '<!-- GSC Visible FAQ -->', buildVisibleFaq(item.faq, lang), '<figure');
    writeSource(item.relPath, meta, nextBody);
  }
}

const article = {
  en: {
    slug: 'exam-dreams-meaning',
    title: 'Exam dreams meaning: fail, pass or unprepared | Noctalia',
    h1: 'Exam dreams: meaning when you fail, pass or feel unprepared',
    description: 'What exam dreams mean, from failing a test to passing one, arriving unprepared, or facing finals season stress.',
    label: 'Interpretation',
    topic: 'Topic: Dream meanings',
    topicHref: 'dream-meanings',
    home: 'Home',
    resources: 'Resources',
    published: 'Published May 4, 2026',
    read: '5 min read',
    authorLine: 'Founder & Publication Director',
    editorial: 'Our editorial process',
    quickTitle: 'Quick answer',
    quick: 'Dreaming about an exam usually reflects fear of evaluation, pressure to perform, perfectionism, or feeling unprepared. During finals season or before a work review, the dream often mirrors real stress. Passing the exam suggests confidence or relief; failing often points to fear of judgment rather than actual failure.',
    intro: 'You sit down, turn the page, and realize you did not study. Or you pass an exam with surprising ease. Exam dreams are common because they turn evaluation anxiety into a simple scene: someone is testing you, and you are not sure you are ready.',
    sections: [
      ['Why exam dreams happen', 'Exam dreams appear when your mind is processing performance pressure. The test may represent school, work, family expectations, a relationship decision, or your own inner critic. What matters is not the exam itself, but the feeling of being measured.'],
      ['Dreaming you did not study', 'This is the classic unprepared dream. It often appears before deadlines, finals, interviews, presentations, or any situation where you fear being exposed as not ready enough.'],
      ['Dreaming you pass an exam', 'Passing an exam in a dream can point to relief, growing confidence, or a sense that you have already done enough preparation. It may also show that a challenge feels less threatening than it did before.'],
      ['Dreaming you fail an exam', 'Failing in the dream usually reflects fear of judgment. It does not mean you will fail in real life; it means your mind is rehearsing the feeling of not meeting a standard.'],
      ['Dreaming about finals', 'At the beginning of May, exam and finals dreams can intensify because calendars, revision, pressure, and comparison become more visible. The dream is often a stress signal, not a prophecy.']
    ],
    faq: [
      ['What does it mean to dream about an exam?', 'It usually means you feel evaluated, judged, or under pressure to perform. The exam can symbolize school, work, family expectations, or personal standards.'],
      ['What does it mean to dream you did not study for an exam?', 'It reflects feeling unprepared, exposed, or worried that you have missed something important before a deadline or challenge.'],
      ['What does it mean to dream you pass an exam?', 'It can suggest confidence, relief, readiness, or the sense that you have handled a difficult test better than expected.'],
      ['What does it mean to dream you fail an exam?', 'It usually points to fear of judgment or perfectionism, not a literal prediction that you will fail.']
    ],
    links: [['exam symbol', '../symbols/exam'], ['anxiety dreams', 'anxiety-dreams-meaning'], ['recurring dreams', 'recurring-dreams-meaning']]
  },
  fr: {
    slug: 'rever-examen-signification',
    title: 'Rêver d’examen : échec, réussite, révisions | Noctalia',
    h1: 'Rêver d’examen : signification si vous échouez, réussissez ou n’avez pas révisé',
    description: 'Découvrez ce que signifie rêver d’examen, de révisions oubliées, de réussite, d’échec ou de stress avant les examens de fin d’année.',
    label: 'Interprétation',
    topic: 'Thème : Signification des rêves',
    topicHref: 'signification-des-reves',
    home: 'Accueil',
    resources: 'Ressources',
    published: 'Publié le 4 mai 2026',
    read: '5 min de lecture',
    authorLine: 'Fondateur et directeur de publication',
    editorial: 'Notre processus éditorial',
    quickTitle: 'Réponse rapide',
    quick: 'Rêver d’examen reflète souvent la peur d’être évalué, le perfectionnisme, la pression de réussir ou le sentiment de ne pas être prêt. En période d’examens, le rêve amplifie souvent un stress réel. Réussir l’examen évoque la confiance; échouer parle surtout de peur du jugement.',
    intro: 'Vous vous asseyez, retournez la feuille, et réalisez que vous n’avez pas révisé. Ou au contraire, vous réussissez sans effort. Les rêves d’examen transforment une pression diffuse en une scène très claire : quelqu’un vous évalue, et vous ne savez pas si vous êtes prêt.',
    sections: [
      ['Pourquoi rêve-t-on d’examen ?', 'Ces rêves apparaissent quand l’esprit traite une pression de performance. L’examen peut représenter l’école, le travail, une décision, une relation ou votre critique intérieur.'],
      ['Rêver de ne pas avoir révisé', 'Ce scénario traduit souvent le sentiment d’être exposé ou insuffisamment préparé avant une échéance, un entretien, une présentation ou une période de partiels.'],
      ['Rêver de réussir un examen', 'Réussir l’examen peut indiquer un soulagement, une confiance qui revient ou le sentiment d’avoir fait assez d’efforts.'],
      ['Rêver d’échouer à un examen', 'L’échec dans le rêve parle surtout de peur du jugement. Il ne prédit pas un échec réel; il montre l’angoisse de ne pas atteindre un standard.'],
      ['Rêves d’examen en mai', 'Début mai, ces rêves peuvent augmenter avec les examens, les révisions et la comparaison aux autres. Le rêve sert souvent de signal de stress.']
    ],
    faq: [
      ['Que signifie rêver d’un examen ?', 'Cela indique souvent que vous vous sentez évalué, jugé ou sous pression. L’examen peut représenter l’école, le travail ou vos propres attentes.'],
      ['Que signifie rêver de ne pas avoir révisé ?', 'Ce rêve reflète un sentiment d’impréparation, de peur d’être démasqué ou d’avoir oublié quelque chose d’important.'],
      ['Que signifie rêver de réussir un examen ?', 'Cela peut signaler confiance, soulagement ou sentiment d’être prêt pour une épreuve réelle ou symbolique.'],
      ['Que signifie rêver d’échouer à un examen ?', 'Cela renvoie généralement à la peur du jugement ou au perfectionnisme, pas à une prédiction littérale.']
    ],
    links: [['rêver d’examen', '../symboles/examen'], ['rêves d’anxiété', 'reves-anxiete-signification'], ['rêves récurrents', 'signification-reves-recurrents']]
  },
  es: {
    slug: 'sonar-con-examen-significado',
    title: 'Soñar con examen: aprobar, reprobar o no estudiar | Noctalia',
    h1: 'Soñar con un examen: significado si no estudiaste, apruebas o repruebas',
    description: 'Qué significa soñar con examen, examen final, aprobar, reprobar o no haber estudiado, especialmente en época de finales.',
    label: 'Interpretación',
    topic: 'Tema: Significado de sueños',
    topicHref: 'significado-de-suenos',
    home: 'Inicio',
    resources: 'Recursos',
    published: 'Publicado el 4 de mayo de 2026',
    read: '5 min de lectura',
    authorLine: 'Fundador y Director de publicación',
    editorial: 'Nuestro proceso editorial',
    quickTitle: 'Respuesta rápida',
    quick: 'Soñar con un examen suele reflejar miedo a ser evaluado, presión por rendir, perfeccionismo o sensación de no estar preparado. En época de finales, el sueño puede intensificarse por estrés real. Aprobar el examen apunta a confianza o alivio; reprobar suele hablar de miedo al juicio, no de un fracaso literal.',
    intro: 'Te sientas, miras la hoja y descubres que no estudiaste. O sueñas que apruebas con una calma inesperada. Los sueños de examen son frecuentes porque convierten la presión de ser evaluado en una escena concreta: alguien te pone a prueba y no sabes si estás listo.',
    sections: [
      ['Por qué sueñas con exámenes', 'Soñar con examen aparece cuando tu mente procesa presión de rendimiento. El examen puede representar escuela, trabajo, familia, una decisión importante o tu propio crítico interno.'],
      ['Soñar con un examen y no haber estudiado', 'Es el escenario más común. Indica miedo a no estar preparado, a que te descubran una falta o a llegar tarde a una responsabilidad importante.'],
      ['Soñar que apruebas un examen', 'Aprobar en sueños puede reflejar confianza, alivio o la sensación de que ya hiciste lo necesario. También puede aparecer cuando una situación empieza a sentirse manejable.'],
      ['Soñar que repruebas un examen', 'Reprobar suele hablar de miedo al juicio o perfeccionismo. No significa que vayas a fallar: muestra cómo se siente tu mente ante una expectativa alta.'],
      ['Soñar con examen final', 'A comienzos de mayo, los sueños de examen final pueden intensificarse por calendarios, estudio, comparación y presión académica. El sueño es una señal de estrés, no una sentencia.']
    ],
    faq: [
      ['¿Qué significa soñar con un examen?', 'Suele significar que te sientes evaluado, juzgado o bajo presión. El examen puede representar estudios, trabajo, familia o expectativas personales.'],
      ['¿Qué significa soñar con un examen y no haber estudiado?', 'Refleja miedo a no estar preparado, a olvidar algo importante o a que una fecha límite llegue antes de sentirte listo.'],
      ['¿Qué significa soñar que apruebas un examen?', 'Puede indicar confianza, alivio, preparación o la sensación de que superaste mejor de lo esperado una prueba real o simbólica.'],
      ['¿Qué significa soñar que repruebas un examen?', 'Normalmente apunta a miedo al juicio, perfeccionismo o presión interna, no a una predicción de fracaso.']
    ],
    links: [['soñar con examen', '../simbolos/examen'], ['sueños de ansiedad', 'suenos-de-ansiedad-significado'], ['sueños recurrentes', 'significado-suenos-recurrentes']]
  },
  de: {
    slug: 'pruefungstraum-bedeutung',
    title: 'Prüfungstraum: nicht gelernt, bestanden, durchgefallen | Noctalia',
    h1: 'Prüfungstraum Bedeutung: nicht gelernt, bestanden oder durchgefallen',
    description: 'Was Prüfungsträume bedeuten, wenn Sie nicht gelernt haben, bestehen, durchfallen oder in der Prüfungszeit unter Druck stehen.',
    label: 'Deutung',
    topic: 'Thema: Traumbedeutung',
    topicHref: 'traumbedeutungen-interpretation-symbole',
    home: 'Start',
    resources: 'Ressourcen',
    published: 'Veröffentlicht am 4. Mai 2026',
    read: '5 Min. Lesezeit',
    authorLine: 'Gründer und Herausgeber',
    editorial: 'Unser redaktioneller Prozess',
    quickTitle: 'Kurze Antwort',
    quick: 'Von einer Prüfung zu träumen weist meist auf Bewertungsangst, Leistungsdruck, Perfektionismus oder das Gefühl hin, nicht vorbereitet zu sein. In der Prüfungszeit kann sich dieser Traum verstärken. Bestehen steht für Erleichterung; Durchfallen zeigt eher Angst vor Urteil als reales Scheitern.',
    intro: 'Sie sitzen vor der Aufgabe und merken, dass Sie nicht gelernt haben. Oder Sie bestehen überraschend leicht. Prüfungsträume machen abstrakten Druck sichtbar: Jemand prüft Sie, und Sie wissen nicht, ob Sie bereit sind.',
    sections: [
      ['Warum Prüfungsträume entstehen', 'Sie entstehen, wenn der Geist Leistungsdruck verarbeitet. Die Prüfung kann Schule, Arbeit, Familie, eine Entscheidung oder den inneren Kritiker darstellen.'],
      ['Nicht gelernt haben', 'Dieser Traum zeigt das Gefühl, unvorbereitet, bloßgestellt oder einer wichtigen Aufgabe nicht gewachsen zu sein.'],
      ['Eine Prüfung bestehen', 'Bestehen kann Erleichterung, wachsende Sicherheit oder das Gefühl zeigen, genug vorbereitet zu sein.'],
      ['Durch eine Prüfung fallen', 'Durchfallen steht meist für Angst vor Bewertung und Perfektionismus. Es ist keine Vorhersage, sondern ein Stressbild.'],
      ['Prüfungszeit im Mai', 'Anfang Mai nehmen Prüfungsdruck, Termine und Vergleich zu. Der Traum ist oft ein Stresssignal.']
    ],
    faq: [
      ['Was bedeutet ein Prüfungstraum?', 'Er deutet häufig darauf hin, dass Sie sich bewertet fühlen oder unter Leistungsdruck stehen.'],
      ['Was bedeutet es, im Traum nicht gelernt zu haben?', 'Es spiegelt Angst vor mangelnder Vorbereitung, Vergessen oder Bloßstellung wider.'],
      ['Was bedeutet es, eine Prüfung zu bestehen?', 'Es kann Vertrauen, Erleichterung und innere Bereitschaft anzeigen.'],
      ['Was bedeutet es, durch eine Prüfung zu fallen?', 'Es verweist meist auf Bewertungsangst oder Perfektionismus, nicht auf ein tatsächliches Scheitern.']
    ],
    links: [['Prüfung im Traum', '../traumsymbole/pruefung'], ['Angstträume', 'angsttraeume-bedeutung'], ['wiederkehrende Träume', 'wiederkehrende-traeume-bedeuten-ihre-verborgenen-botschaften-verstehen']]
  },
  it: {
    slug: 'sognare-esame-significato',
    title: 'Sognare un esame: non studiato, passare, fallire | Noctalia',
    h1: 'Sognare un esame: significato se non hai studiato, passi o fallisci',
    description: 'Cosa significa sognare un esame, non aver studiato, superarlo, fallire o sentire la pressione della stagione degli esami.',
    label: 'Interpretazione',
    topic: 'Tema: Significato dei sogni',
    topicHref: 'significati-dei-sogni-interpretazione-e-simboli',
    home: 'Home',
    resources: 'Risorse',
    published: 'Pubblicato il 4 maggio 2026',
    read: '5 min di lettura',
    authorLine: 'Fondatore e direttore editoriale',
    editorial: 'Il nostro processo editoriale',
    quickTitle: 'Risposta rapida',
    quick: 'Sognare un esame riflette spesso paura del giudizio, pressione da prestazione, perfezionismo o sensazione di non essere pronti. Nel periodo degli esami il sogno può intensificarsi. Superarlo indica fiducia o sollievo; fallire parla soprattutto di paura di essere valutati.',
    intro: 'Ti siedi, guardi il foglio e capisci di non aver studiato. Oppure superi l’esame con sorprendente facilità. I sogni d’esame trasformano la pressione in una scena chiara: qualcuno ti valuta e non sai se sei pronto.',
    sections: [
      ['Perché sogni un esame', 'Il sogno appare quando la mente elabora pressione, aspettative o paura di non essere abbastanza. L’esame può rappresentare scuola, lavoro, famiglia o autocritica.'],
      ['Non aver studiato', 'Indica sensazione di impreparazione, paura di dimenticare qualcosa o timore di essere scoperto.'],
      ['Superare un esame', 'Può indicare sollievo, fiducia e la percezione di aver fatto abbastanza.'],
      ['Fallire un esame', 'Di solito riflette paura del giudizio e perfezionismo, non una previsione letterale.'],
      ['Periodo degli esami', 'All’inizio di maggio scadenze, studio e confronto possono rendere questi sogni più frequenti.']
    ],
    faq: [
      ['Cosa significa sognare un esame?', 'Significa spesso sentirsi valutati, sotto pressione o giudicati in una situazione reale o simbolica.'],
      ['Cosa significa sognare di non aver studiato?', 'Riflette paura di non essere pronti, di aver dimenticato qualcosa o di non soddisfare le aspettative.'],
      ['Cosa significa sognare di superare un esame?', 'Può indicare fiducia, sollievo e senso di preparazione.'],
      ['Cosa significa sognare di fallire un esame?', 'Rimanda a paura del giudizio o perfezionismo, più che a un vero fallimento futuro.']
    ],
    links: [['sognare un esame', '../simboli/esame'], ['sogni d’ansia', 'sogni-ansia-significato'], ['sogni ricorrenti', 'significato-dei-sogni-ricorrenti-comprendere-i-loro-messaggi-nascosti']]
  }
};

function makeAuthorAbout(lang) {
  return {
    en: '/en/about',
    fr: '/fr/a-propos',
    es: '/es/sobre',
    de: '/de/ueber-uns',
    it: '/it/chi-siamo'
  }[lang];
}

const examSourceLabels = {
  en: { title: 'Sources', note: 'These references support the links between waking concerns, test anxiety, sleep quality and dream emotions.' },
  fr: { title: 'Sources', note: 'Ces références appuient le lien entre préoccupations éveillées, anxiété d’examen, qualité du sommeil et émotions des rêves.' },
  es: { title: 'Fuentes', note: 'Estas referencias apoyan la relación entre preocupaciones diurnas, ansiedad ante los exámenes, calidad del sueño y emociones oníricas.' },
  de: { title: 'Quellen', note: 'Diese Quellen stützen den Zusammenhang zwischen Wachleben, Prüfungsangst, Schlafqualität und Traumemotionen.' },
  it: { title: 'Fonti', note: 'Queste fonti supportano il legame tra preoccupazioni diurne, ansia da esame, qualità del sonno ed emozioni nei sogni.' }
};

const examSources = [
  ['Adams, Mushkat & Minkel (2022), test anxiety, sleep quality and mood', 'https://doi.org/10.1177/00332941211025268'],
  ['Schredl (2003), continuity between waking activities and dream activities', 'https://doi.org/10.1016/S1053-8100(02)00072-7'],
  ['Schredl & Reinhard (2010), waking mood and dream emotions', 'https://doi.org/10.2190/IC.29.3.f'],
  ['Schredl (2024), continuity between waking life and dreaming', 'https://doi.org/10.1177/02762366241254818']
];

function makeArticleSource(lang, c) {
  const url = `https://noctalia.app/${lang}/blog/${c.slug}`;
  const image = 'https://noctalia.app/img/blog/anxiety-dreams-meaning.webp';
  const about = makeAuthorAbout(lang);
  const meta = {
    pageId: ARTICLE_ID,
    layout: 'blogArticle',
    lang,
    slug: c.slug,
    title: c.title,
    description: c.description,
    robots: 'max-image-preview:large',
    themeColor: '#0a0514',
    htmlClass: 'scroll-smooth blog-article',
    bodyClass: 'bg-dream-dark text-white antialiased selection:bg-dream-salmon selection:text-dream-dark overflow-x-hidden',
    bodyStyle: 'background-color: #0a0514;',
    mainClass: 'pt-32 pb-20 px-4',
    ogType: 'article',
    ogTitle: c.title,
    ogDescription: c.description,
    ogImage: image,
    ogImageAlt: c.h1,
    twitterCard: 'summary_large_image',
    twitterTitle: c.title,
    twitterDescription: c.description,
    twitterImage: image,
    twitterImageAlt: c.h1,
    publishedTime: TODAY,
    modifiedTime: TODAY,
    author: 'Thanh Chau',
    prevPath: '',
    nextPath: '',
    preloadImage: '/img/blog/anxiety-dreams-meaning.webp',
    jsonLd: serializeJsonLd([
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: c.h1,
        description: c.description,
        image: { '@type': 'ImageObject', url: image, width: 1200, height: 630 },
        author: [
          {
            '@type': 'Person',
            '@id': `https://noctalia.app${about}#person`,
            name: 'Thanh Chau',
            jobTitle: 'Founder & Publication Director',
            url: `https://noctalia.app${about}`,
            worksFor: { '@type': 'Organization', '@id': 'https://noctalia.app/#organization', name: 'Noctalia', url: 'https://noctalia.app' }
          },
          { '@type': 'Organization', '@id': 'https://noctalia.app/#organization', name: 'Noctalia', url: 'https://noctalia.app', logo: { '@type': 'ImageObject', url: 'https://noctalia.app/logo/logo_noctalia.png' } }
        ],
        publisher: { '@type': 'Organization', name: 'Noctalia', url: 'https://noctalia.app', logo: { '@type': 'ImageObject', url: 'https://noctalia.app/logo/logo_noctalia.png' } },
        datePublished: TODAY,
        dateModified: TODAY,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        inLanguage: lang,
        isAccessibleForFree: true,
        timeRequired: 'PT5M',
        url
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: c.faq.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer }
        }))
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: c.home, item: `https://noctalia.app/${lang}/` },
          { '@type': 'ListItem', position: 2, name: c.resources, item: `https://noctalia.app/${lang}/blog/` },
          { '@type': 'ListItem', position: 3, name: c.h1, item: url }
        ]
      }
    ]),
    activeNav: 'resources'
  };

  const cards = c.sections.map(([title, text]) => `
<div class="dream-card glass-panel rounded-xl p-6 border border-transparent">
<h3 class="font-serif text-lg text-dream-cream mb-3">${title}</h3>
<p class="text-sm text-gray-300 leading-relaxed">${text}</p>
</div>`).join('\n');
  const faqHtml = c.faq.map(([question, answer]) => `
<div class="glass-panel rounded-xl p-5 border border-white/10">
<h3 class="font-serif text-lg text-dream-cream mb-2">${question}</h3>
<p class="text-sm text-gray-300 leading-relaxed">${answer}</p>
</div>`).join('\n');
  const linksHtml = c.links.map(([label, href]) => `<a class="text-dream-salmon hover:underline" href="${href}">${label}</a>`).join(' · ');
  const sourceCopy = examSourceLabels[lang] || examSourceLabels.en;
  const sourcesHtml = examSources.map(([label, href]) => `<li><a class="text-dream-salmon hover:underline" href="${href}" rel="nofollow noopener noreferrer" target="_blank">${label}</a></li>`).join('\n');

  const body = `<article class="max-w-5xl mx-auto">
<nav aria-label="Breadcrumb" class="text-sm text-purple-200/60 mb-8">
<ol class="flex items-center gap-2 flex-wrap" itemscope="" itemtype="https://schema.org/BreadcrumbList">
<li itemprop="itemListElement" itemscope="" itemtype="https://schema.org/ListItem"><a class="hover:text-dream-salmon transition-colors" href="/${lang}/" itemprop="item"><span itemprop="name">${c.home}</span></a><meta content="1" itemprop="position"></li>
<li class="text-purple-400">/</li>
<li itemprop="itemListElement" itemscope="" itemtype="https://schema.org/ListItem"><a class="hover:text-dream-salmon transition-colors" href="/${lang}/blog/" itemprop="item"><span itemprop="name">${c.resources}</span></a><meta content="2" itemprop="position"></li>
<li class="text-purple-400">/</li>
<li itemprop="itemListElement" itemscope="" itemtype="https://schema.org/ListItem"><span class="text-dream-cream" itemprop="name">${c.h1}</span><meta content="3" itemprop="position"></li>
</ol>
</nav>
<header class="mb-12">
<div class="flex flex-wrap items-center gap-3 mb-6">
<span class="text-xs font-mono text-dream-salmon border border-dream-salmon/30 rounded-full px-3 py-1 uppercase">${c.label}</span>
<a class="text-xs font-mono text-purple-200/70 border border-white/10 rounded-full px-3 py-1 hover:text-white hover:border-dream-salmon/30 transition-colors" href="${c.topicHref}">${c.topic}</a>
<span aria-hidden="true" class="w-full sm:hidden"></span>
<span class="text-sm text-purple-300/60">${c.published}</span>
<span class="text-sm text-purple-300/60">${c.read}</span>
</div>
<h1 class="font-serif text-3xl md:text-5xl mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white via-dream-lavender to-purple-400/50 leading-tight">${c.h1}</h1>
<p class="text-lg text-purple-200/80 leading-relaxed">${c.intro}</p>
</header>
<div class="flex items-center gap-3 mb-8 text-sm text-purple-200/70">
<div class="w-10 h-10 rounded-full bg-dream-salmon/10 flex items-center justify-center flex-shrink-0"><i class="w-5 h-5 text-dream-salmon" data-lucide="pen-tool"></i></div>
<div><span class="text-dream-cream font-medium">Thanh Chau</span><span class="block text-xs text-purple-300/60">${c.authorLine} · <a class="text-dream-salmon hover:underline" href="${about}">${c.editorial}</a></span></div>
</div>
<section aria-labelledby="quick-answer-title" class="glass-panel rounded-2xl p-6 mb-8 border border-dream-salmon/20 bg-white/5">
<h2 class="font-serif text-xl text-dream-cream mb-3" id="quick-answer-title">${c.quickTitle}</h2>
<p class="text-purple-100/80 leading-relaxed">${c.quick}</p>
</section>
<figure class="mb-12 rounded-2xl overflow-hidden">
<img alt="${c.h1}" class="w-full h-auto" fetchpriority="high" height="630" loading="eager" sizes="(max-width: 768px) 100vw, 1200px" src="../../img/blog/anxiety-dreams-meaning.webp" srcset="../../img/blog/anxiety-dreams-meaning-480w.webp 480w, ../../img/blog/anxiety-dreams-meaning-800w.webp 800w, ../../img/blog/anxiety-dreams-meaning-1200w.webp 1200w" width="1200">
</figure>
<div class="grid md:grid-cols-2 gap-6 my-12">${cards}
</div>
<section class="glass-panel rounded-2xl p-6 my-10 border border-white/10">
<h2 class="font-serif text-2xl text-dream-cream mb-4">FAQ</h2>
<div class="grid gap-4">${faqHtml}
</div>
</section>
<section class="glass-panel rounded-2xl p-6 my-10 border border-white/10" id="sources">
<h2 class="font-serif text-2xl text-dream-cream mb-4">${sourceCopy.title}</h2>
<p class="text-sm text-purple-200/70 mb-4">${sourceCopy.note}</p>
<ul class="space-y-2 text-sm text-gray-300">${sourcesHtml}
</ul>
</section>
<p class="text-sm text-purple-200/70 mt-10">${linksHtml}</p>
</article>
`;

  return joinSource(meta, body);
}

function createExamArticles() {
  ensureDir(ARTICLE_DIR);
  for (const lang of LANGS) {
    fs.writeFileSync(path.join(ARTICLE_DIR, `${lang}.md`), makeArticleSource(lang, article[lang]), 'utf8');
  }
}

function updateBlogIndexes() {
  const card = {
    en: ['New', 'Interpretation', '5 min read', 'Exam dreams: meaning when you fail, pass or feel unprepared', 'A seasonal guide for finals stress, unprepared test dreams and fear of judgment.', 'exam-dreams-meaning'],
    fr: ['Nouveau', 'Interprétation', '5 min de lecture', 'Rêver d’examen : réussir, échouer ou ne pas avoir révisé', 'Un guide de saison pour comprendre les rêves d’examen et la peur d’être évalué.', 'rever-examen-signification'],
    es: ['Nuevo', 'Interpretación', '5 min de lectura', 'Soñar con un examen: aprobar, reprobar o no haber estudiado', 'Una guía de temporada para interpretar sueños de examen durante época de finales.', 'sonar-con-examen-significado'],
    de: ['Neu', 'Deutung', '5 Min. Lesezeit', 'Prüfungstraum: nicht gelernt, bestanden oder durchgefallen', 'Ein saisonaler Leitfaden für Prüfungsstress und Bewertungsangst im Traum.', 'pruefungstraum-bedeutung'],
    it: ['Nuovo', 'Interpretazione', '5 min di lettura', 'Sognare un esame: passare, fallire o non aver studiato', 'Una guida stagionale per capire sogni d’esame e paura del giudizio.', 'sognare-esame-significato']
  };

  for (const lang of LANGS) {
    const relPath = `docs-src/content/blog/blog.index/${lang}.md`;
    const { meta, body } = readSource(relPath);
    const [badge, category, read, title, desc, slug] = card[lang];
    const schemas = parseJsonLd(meta);
    const itemList = schemas.find((schema) => schema['@type'] === 'ItemList');
    if (itemList && !itemList.itemListElement.some((item) => item.url.endsWith(`/${slug}`))) {
      itemList.itemListElement.unshift({
        '@type': 'ListItem',
        position: 1,
        url: `https://noctalia.app/${lang}/blog/${slug}`,
        name: title
      });
      itemList.itemListElement.forEach((item, index) => {
        item.position = index + 1;
      });
      itemList.numberOfItems = itemList.itemListElement.length;
      meta.jsonLd = serializeJsonLd(schemas);
    }

    const marker = '<!-- Article - Exam Dreams Seasonal -->';
    if (body.includes(marker)) {
      writeSource(relPath, meta, body);
      continue;
    }

    const newCard = `${marker}
<article class="article-card glass-panel rounded-2xl overflow-hidden group" data-category="interpretación" data-reading-time="5" data-title="${title}">
<a class="block" href="${slug}">
<div class="aspect-video overflow-hidden bg-dream-purple/30">
<img alt="${title}" class="article-image w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-500" height="450" loading="lazy" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" src="../../img/blog/anxiety-dreams-meaning.webp" srcset="../../img/blog/anxiety-dreams-meaning-480w.webp 480w, ../../img/blog/anxiety-dreams-meaning-800w.webp 800w, ../../img/blog/anxiety-dreams-meaning-1200w.webp 1200w" width="800">
</div>
<div class="p-6">
<div class="flex items-center gap-3 mb-3">
<span class="text-xs font-mono bg-dream-salmon/20 text-dream-salmon border border-dream-salmon/30 rounded-full px-3 py-1 uppercase">${badge}</span>
<span class="text-xs font-mono text-dream-salmon border border-dream-salmon/30 rounded-full px-2 py-1 uppercase">${category}</span>
<span class="text-xs text-purple-300/60">${read}</span>
</div>
<h2 class="font-serif text-xl md:text-2xl mb-3 text-dream-cream group-hover:text-white transition-colors">${title}</h2>
<p class="text-sm text-gray-400 line-clamp-2">${desc}</p>
</div>
</a>
</article>
`;
    const nextBody = body.replace(
      /(<section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="articles-grid" id="articlesGrid">\n)/,
      `$1${newCard}`
    );
    writeSource(relPath, meta, nextBody);
  }
}

function updateFeaturedConfig() {
  const relPath = 'docs-src/config/site.config.json';
  const config = readJson(relPath);
  const featured = config.seoLinking.featuredBlogEntries;
  if (!featured.includes(ARTICLE_ID)) {
    featured.unshift(ARTICLE_ID);
    config.seoLinking.featuredBlogEntries = featured.slice(0, 5);
  }
  writeJson(relPath, config);
}

function main() {
  updateSymbols();
  updateArticleCorrections();
  createExamArticles();
  updateBlogIndexes();
  updateFeaturedConfig();
  console.log('[seo-may] Updated SEO corrections and created exam article in 5 languages.');
}

main();
