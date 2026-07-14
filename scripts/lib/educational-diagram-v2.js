#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FONT_DIR = path.join(REPO_ROOT, 'docs-src', 'static', 'fonts');
const OUTPUT_DIR = path.join(
  REPO_ROOT,
  'docs-src',
  'image-sources',
  'pilot-2026-07-v2',
  'educational'
);

const DESKTOP = Object.freeze({ width: 1200, height: 900, suffix: '' });
const MOBILE = Object.freeze({ width: 800, height: 1067, suffix: '-mobile' });

const COLORS = Object.freeze({
  canvas: '#0A0612',
  surface: '#171020',
  elevated: '#241831',
  cream: '#FFF7ED',
  muted: '#CEC3DA',
  salmon: '#FDA481',
  salmonSoft: '#FFCCB5',
  lilac: '#B9A4FF',
  line: '#FFFFFF',
});

const DIAGRAMS = [
  {
    stem: 'lucid-dreaming-method-en',
    locale: 'en',
    template: 'sequence',
    kicker: 'LUCID DREAMING · BEGINNER ROUTINE',
    title: ['A calmer route to lucid dreaming'],
    mobileTitle: ['A calmer route to', 'lucid dreaming'],
    deck: ['Build recall and awareness before dream control.'],
    mobileDeck: ['Build recall first. Control can wait.'],
    items: [
      { label: 'Reality check', question: ['Pause. Ask: am I dreaming?'], prompt: ['Repeat during ordinary moments.'] },
      { label: 'Dream journal', question: ['Record the first fragments.'], prompt: ['Look for recurring dream signs.'] },
      { label: 'MILD', question: ['Rehearse noticing one sign.'], prompt: ['Pair recognition with intention.'] },
      { label: 'WBTB', question: ['Use selectively after 5–6 hours.'], prompt: ['Skip it when sleep feels fragile.'] },
    ],
    footer: 'Protect sleep quality; consistency matters more than intensity.',
    titleA11y: 'A calmer beginner route to lucid dreaming',
    description: 'Four steps: reality checks, dream journaling, MILD rehearsal and selective WBTB practice.',
  },
  {
    stem: 'lucid-dreaming-method-es',
    locale: 'es',
    template: 'sequence',
    kicker: 'SUEÑOS LÚCIDOS · RUTINA INICIAL',
    title: ['Una ruta serena hacia el sueño lúcido'],
    mobileTitle: ['Una ruta serena hacia', 'el sueño lúcido'],
    deck: ['Refuerza el recuerdo y la atención antes del control.'],
    mobileDeck: ['Primero recuerda. El control puede esperar.'],
    items: [
      { label: 'Test de realidad', question: ['Párate: ¿estoy soñando?'], prompt: ['Repítelo en momentos cotidianos.'] },
      { label: 'Diario', question: ['Anota los primeros fragmentos.'], prompt: ['Busca señales recurrentes.'] },
      { label: 'MILD', question: ['Ensaya reconocer una señal.'], prompt: ['Une reconocimiento e intención.'] },
      { label: 'WBTB', question: ['Úsalo tras 5–6 horas, a veces.'], prompt: ['Evítalo si altera tu descanso.'] },
    ],
    footer: 'Protege el descanso; la constancia importa más.',
    titleA11y: 'Una ruta serena para iniciarse en los sueños lúcidos',
    description: 'Cuatro pasos: test de realidad, diario, ensayo MILD y práctica WBTB selectiva.',
  },
  {
    stem: 'dream-journal-fields-en',
    locale: 'en',
    template: 'checklist',
    kicker: 'DREAM JOURNAL · WAKE-UP CHECKLIST',
    title: ['Five details worth saving at wake-up'],
    mobileTitle: ['Five details to save', 'at wake-up'],
    deck: ['Capture the dream before interpretation edits the memory.'],
    mobileDeck: ['Capture first. Interpret later.'],
    items: [
      { label: 'Scene', question: ['Where were you?'] },
      { label: 'People', question: ['Who was present?'] },
      { label: 'Emotion', question: ['What feeling stayed with you?'] },
      { label: 'Senses', question: ['Color, sound, texture?'] },
      { label: 'Waking context', question: ['What happened recently?'] },
    ],
    footer: 'Add the date, then write before checking your phone.',
    titleA11y: 'Five details worth saving in a dream journal at wake-up',
    description: 'A five-part checklist for recording scene, people, emotion, senses and waking context.',
  },
  {
    stem: 'dream-journal-fields-es',
    locale: 'es',
    template: 'checklist',
    kicker: 'DIARIO DE SUEÑOS · LISTA AL DESPERTAR',
    title: ['Cinco detalles que conviene guardar'],
    mobileTitle: ['Cinco detalles que', 'conviene guardar'],
    deck: ['Registra el sueño antes de que la interpretación cambie el recuerdo.'],
    mobileDeck: ['Primero registra. Después interpreta.'],
    items: [
      { label: 'Escena', question: ['¿Dónde estabas?'] },
      { label: 'Personas', question: ['¿Quién aparecía?'] },
      { label: 'Emoción', question: ['¿Qué sensación permaneció?'] },
      { label: 'Sentidos', question: ['¿Color, sonido, textura?'] },
      { label: 'Contexto', question: ['¿Qué ocurrió recientemente?'] },
    ],
    footer: 'Añade la fecha y escribe antes de mirar el móvil.',
    titleA11y: 'Cinco detalles que conviene guardar en un diario de sueños',
    description: 'Lista de escena, personas, emoción, sentidos y contexto al despertar.',
  },
  {
    stem: 'dream-interpretation-timeline-en',
    locale: 'en',
    template: 'sequence',
    kicker: 'DREAM INTERPRETATION · FOUR LENSES',
    title: ['Dream frameworks can overlap'],
    mobileTitle: ['Dream frameworks', 'can overlap'],
    deck: ['Traditions coexist; this is a map of lenses, not a verdict.'],
    mobileDeck: ['A map of lenses, not one final verdict.'],
    items: [
      { label: 'Ancient worlds', question: ['Ritual, omen and sacred message.'], prompt: ['Mesopotamia · Egypt · Greece'] },
      { label: 'Cultural traditions', question: ['Meaning shaped by community.'], prompt: ['Religious and local frameworks'] },
      { label: 'Depth psychology', question: ['Dreams as inner expression.'], prompt: ['Freud · Jung · 20th century'] },
      { label: 'Sleep science', question: ['Dreaming as brain and experience.'], prompt: ['Cognition · emotion · memory'] },
    ],
    footer: 'Personal meaning and sleep science can be considered together.',
    titleA11y: 'Dream interpretation frameworks overlap rather than replace one another',
    description: 'Four overlapping lenses: ancient worlds, cultural traditions, depth psychology and sleep science.',
  },
  {
    stem: 'pregnancy-context-map-en',
    locale: 'en',
    template: 'matrix',
    kicker: 'PREGNANCY DREAMS · CONTEXT MAP',
    title: ['Start with context, not prediction'],
    mobileTitle: ['Start with context,', 'not prediction'],
    deck: ['The same pregnancy image can carry very different feelings.'],
    mobileDeck: ['The same image can carry different feelings.'],
    items: [
      { label: 'Situation', question: ['Pregnant, trying, observing?'], prompt: ['Name your real-life position.'] },
      { label: 'Emotion', question: ['Joy, fear, grief, surprise?'], prompt: ['Notice intensity and contrast.'] },
      { label: 'Dream scene', question: ['Pregnancy, birth, baby, test?'], prompt: ['Describe before interpreting.'] },
      { label: 'Recent context', question: ['Change, care, responsibility?'], prompt: ['Recall events and conversations.'] },
    ],
    footer: 'Dreams are not medical diagnoses or predictions.',
    titleA11y: 'A context-first way to reflect on pregnancy dreams',
    description: 'A non-diagnostic reflection matrix using situation, emotion, dream scene and recent context.',
  },
  {
    stem: 'water-context-matrix-es',
    locale: 'es',
    template: 'matrix',
    kicker: 'SUEÑOS CON AGUA · MATRIZ DE CONTEXTO',
    title: ['El agua cambia la pregunta'],
    mobileTitle: ['El agua cambia', 'la pregunta'],
    deck: ['Observa su estado y tu emoción antes de asignar significado.'],
    mobileDeck: ['Observa primero. El significado viene después.'],
    items: [
      { label: 'Clara', question: ['¿Qué podías ver con claridad?'], prompt: ['Calma · exposición · comprensión'] },
      { label: 'Turbia', question: ['¿Qué resultaba confuso?'], prompt: ['Duda · carga · incertidumbre'] },
      { label: 'Tranquila', question: ['¿Pausa o estancamiento?'], prompt: ['Descanso · espera · contención'] },
      { label: 'Desbordada', question: ['¿Qué superaba tus límites?'], prompt: ['Intensidad · pérdida de control'] },
    ],
    footer: 'Pregunta también dónde estaba el agua y qué hacías.',
    titleA11y: 'El estado del agua cambia la pregunta en un sueño',
    description: 'Matriz de agua clara, turbia, tranquila o desbordada según emoción y contexto.',
  },
  {
    stem: 'flying-context-matrix-en',
    locale: 'en',
    template: 'matrix',
    kicker: 'FLYING DREAMS · CONTEXT MATRIX',
    title: ['Begin with how the flight felt'],
    mobileTitle: ['Begin with how', 'the flight felt'],
    deck: ['Emotion and control offer more context than a fixed meaning.'],
    mobileDeck: ['Emotion and control come before meaning.'],
    items: [
      { label: 'Freedom', question: ['Light, open, effortless?'], prompt: ['Where do you want more space?'] },
      { label: 'Control', question: ['Could you steer or change height?'], prompt: ['What feels manageable now?'] },
      { label: 'Escape', question: ['Leaving pressure or danger?'], prompt: ['Which boundary needs attention?'] },
      { label: 'Falling', question: ['Unstable or losing lift?'], prompt: ['Where does support feel thin?'] },
    ],
    footer: 'Several themes can coexist; felt experience is the starting point.',
    titleA11y: 'A reflection matrix for how a flying dream felt',
    description: 'Four possible lenses for flying dreams: freedom, control, escape and falling.',
  },
  {
    stem: 'flying-context-matrix-es',
    locale: 'es',
    template: 'matrix',
    kicker: 'SUEÑOS DE VOLAR · MATRIZ DE CONTEXTO',
    title: ['Empieza por cómo se sentía el vuelo'],
    mobileTitle: ['Empieza por cómo', 'se sentía el vuelo'],
    deck: ['La emoción y el control aportan más que un significado fijo.'],
    mobileDeck: ['Emoción y control vienen antes del significado.'],
    items: [
      { label: 'Libertad', question: ['¿Ligero, abierto, sin esfuerzo?'], prompt: ['¿Dónde deseas más espacio?'] },
      { label: 'Control', question: ['¿Podías dirigir o cambiar altura?'], prompt: ['¿Qué puedes manejar ahora?'] },
      { label: 'Huida', question: ['¿Dejabas presión o peligro?'], prompt: ['¿Qué límite necesita atención?'] },
      { label: 'Caída', question: ['¿Inestable o sin impulso?'], prompt: ['¿Dónde falta apoyo?'] },
    ],
    footer: 'Pueden coexistir varios temas; empieza por lo que sentías.',
    titleA11y: 'Matriz de reflexión sobre cómo se sentía un sueño de volar',
    description: 'Cuatro enfoques para sueños de volar: libertad, control, huida y caída.',
  },
  {
    stem: 'symbol-interpretation-flow-en',
    locale: 'en',
    template: 'sequence',
    kicker: 'DREAM SYMBOLS · REFLECTION GUIDE',
    title: ['A symbol is a question—not an answer'],
    mobileTitle: ['A symbol is a question—', 'not an answer'],
    deck: ['Use dictionaries as prompts, then return to lived experience.'],
    mobileDeck: ['Use a dictionary as a prompt, not a verdict.'],
    items: [
      { label: 'Image', question: ['What exactly appeared?'], prompt: ['Describe before assigning meaning.'] },
      { label: 'Emotion', question: ['How did it feel?'], prompt: ['Name the feeling and intensity.'] },
      { label: 'Context', question: ['What is personal here?'], prompt: ['Connect memory, culture and events.'] },
      { label: 'Pattern', question: ['Does it recur?'], prompt: ['Compare dreams before concluding.'] },
    ],
    footer: 'No dream symbol has one universal meaning.',
    titleA11y: 'A four-step process for exploring a dream symbol',
    description: 'A four-step reflection process using image, emotion, personal context and recurring pattern.',
  },
];

let fontCssCache;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fontDataUrl(fileName) {
  const bytes = fs.readFileSync(path.join(FONT_DIR, fileName));
  return `data:font/woff2;base64,${bytes.toString('base64')}`;
}

function embeddedFontCss() {
  if (fontCssCache) return fontCssCache;
  fontCssCache = [
    `@font-face{font-family:'Noctalia Fraunces';src:url('${fontDataUrl('Fraunces-Variable.woff2')}') format('woff2');font-weight:100 900;font-style:normal;}`,
    `@font-face{font-family:'Noctalia Outfit';src:url('${fontDataUrl('Outfit-Regular.woff2')}') format('woff2');font-weight:400;font-style:normal;}`,
    `@font-face{font-family:'Noctalia Outfit';src:url('${fontDataUrl('Outfit-Bold.woff2')}') format('woff2');font-weight:700;font-style:normal;}`,
  ].join('');
  return fontCssCache;
}

function svgText(lines, { x, y, className, lineHeight, anchor = 'start' }) {
  const values = Array.isArray(lines) ? lines : [lines];
  const tspans = values
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join('');
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${className}">${tspans}</text>`;
}

function documentShell(diagram, viewport, body) {
  const { width, height } = viewport;
  const titleId = `${diagram.stem}${viewport.suffix}-title`;
  const descId = `${diagram.stem}${viewport.suffix}-desc`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${titleId} ${descId}" data-template="${diagram.template}" data-release="pilot-2026-07-v2">
  <title id="${titleId}">${escapeXml(diagram.titleA11y)}</title>
  <desc id="${descId}">${escapeXml(diagram.description)}</desc>
  <defs>
    <radialGradient id="halo" cx="82%" cy="4%" r="92%"><stop offset="0" stop-color="${COLORS.lilac}" stop-opacity=".16"/><stop offset=".48" stop-color="${COLORS.salmon}" stop-opacity=".055"/><stop offset="1" stop-color="${COLORS.canvas}" stop-opacity="0"/></radialGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${COLORS.salmonSoft}"/><stop offset="1" stop-color="${COLORS.salmon}"/></linearGradient>
    <style>${embeddedFontCss()}
      .display{font-family:'Noctalia Fraunces',Georgia,serif;font-weight:600;fill:${COLORS.cream};letter-spacing:-.018em}
      .sans{font-family:'Noctalia Outfit',Arial,sans-serif;fill:${COLORS.cream}}
      .kicker{font-family:'Noctalia Outfit',Arial,sans-serif;font-weight:700;fill:${COLORS.salmon};letter-spacing:.16em}
      .deck{font-family:'Noctalia Outfit',Arial,sans-serif;font-weight:400;fill:${COLORS.muted}}
      .label{font-family:'Noctalia Outfit',Arial,sans-serif;font-weight:700;fill:${COLORS.cream}}
      .body{font-family:'Noctalia Outfit',Arial,sans-serif;font-weight:400;fill:${COLORS.cream}}
      .muted{font-family:'Noctalia Outfit',Arial,sans-serif;font-weight:400;fill:${COLORS.muted}}
      .number{font-family:'Noctalia Outfit',Arial,sans-serif;font-weight:700;fill:${COLORS.canvas}}
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="${COLORS.canvas}"/>
  <rect width="${width}" height="${height}" fill="url(#halo)"/>
  <path d="M${Math.round(width * 0.58)} 0H${width}V${Math.round(height * 0.23)}C${Math.round(width * 0.82)} ${Math.round(height * 0.18)} ${Math.round(width * 0.74)} ${Math.round(height * 0.08)} ${Math.round(width * 0.58)} 0Z" fill="${COLORS.lilac}" opacity=".025"/>
${body}
</svg>
`;
}

function renderHeader(diagram, viewport) {
  const mobile = viewport === MOBILE;
  const x = mobile ? 44 : 72;
  const kickerY = mobile ? 58 : 55;
  const titleY = mobile ? 115 : 116;
  const titleLines = mobile ? diagram.mobileTitle : diagram.title;
  const titleSize = mobile ? 49 : 58;
  const titleLineHeight = mobile ? 54 : 62;
  const deckY = titleY + (titleLines.length - 1) * titleLineHeight + (mobile ? 52 : 55);
  const deck = mobile ? diagram.mobileDeck : diagram.deck;
  return [
    `<circle cx="${x + 7}" cy="${kickerY - 6}" r="5" fill="${COLORS.salmon}"/>`,
    `<text x="${x + 24}" y="${kickerY}" class="kicker" font-size="${mobile ? 17 : 18}">${escapeXml(diagram.kicker)}</text>`,
    svgText(titleLines, { x, y: titleY, className: 'display', lineHeight: titleLineHeight }).replace('class="display"', `class="display" font-size="${titleSize}"`),
    svgText(deck, { x, y: deckY, className: 'deck', lineHeight: mobile ? 31 : 33 }).replace('class="deck"', `class="deck" font-size="${mobile ? 26 : 28}"`),
  ].join('\n');
}

function renderFooter(diagram, viewport) {
  const mobile = viewport === MOBILE;
  const x = mobile ? 44 : 72;
  const width = viewport.width - x * 2;
  const y = mobile ? 970 : 758;
  const height = mobile ? 64 : 78;
  const fontSize = mobile ? 23 : 24;
  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${mobile ? 16 : 18}" fill="${COLORS.surface}" stroke="${COLORS.line}" stroke-opacity=".11"/>
    <rect x="${x}" y="${y}" width="5" height="${height}" rx="2.5" fill="${COLORS.salmon}"/>
    <text x="${x + 27}" y="${y + Math.round(height / 2) + 8}" class="muted" font-size="${fontSize}">${escapeXml(diagram.footer)}</text>
  </g>`;
}

function renderSequenceCard(item, index, x, y, width, height, mobile) {
  const badge = mobile ? 46 : 48;
  const labelX = x + (mobile ? 82 : 84);
  const bodyX = mobile ? labelX : x + 30;
  const questionY = y + (mobile ? 91 : 110);
  const promptY = questionY + (mobile ? 33 : 38);
  const questionLines = item.question || [];
  const promptLines = item.prompt || [];
  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${mobile ? 18 : 20}" fill="${COLORS.surface}" stroke="${COLORS.line}" stroke-opacity=".13"/>
    <path d="M${x + 1} ${y + height - 1}H${x + width - 1}" stroke="${COLORS.lilac}" stroke-opacity=".24"/>
    <circle cx="${x + 29 + badge / 2}" cy="${y + 27 + badge / 2}" r="${badge / 2}" fill="url(#accent)"/>
    <text x="${x + 29 + badge / 2}" y="${y + 27 + badge / 2 + (mobile ? 9 : 9)}" text-anchor="middle" class="number" font-size="${mobile ? 26 : 27}">${index + 1}</text>
    <text x="${labelX}" y="${y + (mobile ? 63 : 61)}" class="label" font-size="${mobile ? 29 : 29}">${escapeXml(item.label)}</text>
    ${svgText(questionLines, { x: bodyX, y: questionY, className: 'body', lineHeight: mobile ? 31 : 32 }).replace('class="body"', `class="body" font-size="${mobile ? 27 : 27}"`)}
    ${promptLines.length ? svgText(promptLines, { x: bodyX, y: promptY + (questionLines.length - 1) * (mobile ? 31 : 32), className: 'muted', lineHeight: mobile ? 29 : 30 }).replace('class="muted"', `class="muted" font-size="${mobile ? 24 : 24}"`) : ''}
  </g>`;
}

function renderSequence(diagram, viewport) {
  const mobile = viewport === MOBILE;
  const cards = [];
  if (mobile) {
    const x = 44;
    const yStart = 280;
    const width = 712;
    const height = 154;
    diagram.items.forEach((item, index) => {
      cards.push(renderSequenceCard(item, index, x, yStart + index * 166, width, height, true));
    });
  } else {
    const positions = [
      [72, 240],
      [612, 240],
      [72, 477],
      [612, 477],
    ];
    diagram.items.forEach((item, index) => {
      const [x, y] = positions[index];
      cards.push(renderSequenceCard(item, index, x, y, 516, 205, false));
    });
    cards.unshift(`<path d="M588 343h24M330 445v32M870 445v32M588 580h24" fill="none" stroke="${COLORS.lilac}" stroke-width="3" stroke-linecap="round" opacity=".5"/>`);
  }
  return documentShell(diagram, viewport, [renderHeader(diagram, viewport), cards.join('\n'), renderFooter(diagram, viewport)].join('\n'));
}

function matrixGlyph(index, x, y, mobile) {
  const size = mobile ? 42 : 44;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const rotations = [0, 90, 180, 270];
  return `<g transform="rotate(${rotations[index]} ${cx} ${cy})">
    <circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="${COLORS.elevated}" stroke="${COLORS.lilac}" stroke-opacity=".42"/>
    <path d="M${cx - 10} ${cy + 2}Q${cx} ${cy - 11} ${cx + 10} ${cy + 2}Q${cx} ${cy + 11} ${cx - 10} ${cy + 2}Z" fill="none" stroke="${COLORS.salmonSoft}" stroke-width="3" stroke-linejoin="round"/>
  </g>`;
}

function renderMatrixCard(item, index, x, y, width, height, mobile) {
  const labelX = x + (mobile ? 83 : 92);
  const questionY = y + (mobile ? 91 : 112);
  const promptY = questionY + (mobile ? 34 : 39);
  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${mobile ? 18 : 20}" fill="${COLORS.surface}" stroke="${COLORS.line}" stroke-opacity=".13"/>
    <rect x="${x}" y="${y}" width="5" height="${height}" rx="2.5" fill="${index % 2 ? COLORS.lilac : COLORS.salmon}" opacity=".88"/>
    ${matrixGlyph(index, x + (mobile ? 24 : 30), y + (mobile ? 22 : 25), mobile)}
    <text x="${labelX}" y="${y + (mobile ? 55 : 57)}" class="label" font-size="${mobile ? 29 : 29}">${escapeXml(item.label)}</text>
    ${svgText(item.question, { x: x + (mobile ? 26 : 30), y: questionY, className: 'body', lineHeight: mobile ? 31 : 32 }).replace('class="body"', `class="body" font-size="${mobile ? 27 : 27}"`)}
    ${svgText(item.prompt || [], { x: x + (mobile ? 26 : 30), y: promptY + ((item.question || []).length - 1) * (mobile ? 31 : 32), className: 'muted', lineHeight: mobile ? 29 : 30 }).replace('class="muted"', `class="muted" font-size="${mobile ? 24 : 24}"`)}
  </g>`;
}

function renderMatrix(diagram, viewport) {
  const mobile = viewport === MOBILE;
  const cards = [];
  if (mobile) {
    diagram.items.forEach((item, index) => {
      cards.push(renderMatrixCard(item, index, 44, 280 + index * 166, 712, 154, true));
    });
  } else {
    const positions = [
      [72, 240],
      [612, 240],
      [72, 477],
      [612, 477],
    ];
    diagram.items.forEach((item, index) => {
      const [x, y] = positions[index];
      cards.push(renderMatrixCard(item, index, x, y, 516, 205, false));
    });
    cards.unshift(`<circle cx="600" cy="458" r="24" fill="${COLORS.canvas}" stroke="${COLORS.lilac}" stroke-width="2"/><circle cx="600" cy="458" r="6" fill="${COLORS.salmon}"/>`);
  }
  return documentShell(diagram, viewport, [renderHeader(diagram, viewport), cards.join('\n'), renderFooter(diagram, viewport)].join('\n'));
}

function renderNotebookPanel(diagram) {
  return `<g>
    <rect x="72" y="239" width="344" height="493" rx="24" fill="${COLORS.elevated}" stroke="${COLORS.line}" stroke-opacity=".12"/>
    <rect x="116" y="281" width="256" height="328" rx="18" fill="${COLORS.cream}"/>
    <path d="M163 281v328" stroke="${COLORS.salmon}" stroke-opacity=".55" stroke-width="3"/>
    <g stroke="#6A5C72" stroke-opacity=".48" stroke-width="2">
      <path d="M190 353h145M190 405h145M190 457h145M190 509h145M190 561h145"/>
    </g>
    <circle cx="139" cy="353" r="5" fill="${COLORS.lilac}"/><circle cx="139" cy="405" r="5" fill="${COLORS.lilac}"/><circle cx="139" cy="457" r="5" fill="${COLORS.lilac}"/><circle cx="139" cy="509" r="5" fill="${COLORS.lilac}"/><circle cx="139" cy="561" r="5" fill="${COLORS.lilac}"/>
    <text x="112" y="664" class="label" font-size="27">Capture first.</text>
    <text x="112" y="699" class="muted" font-size="24">Interpret later.</text>
  </g>`;
}

function renderChecklistRow(item, index, x, y, width, height, mobile) {
  const numberX = x + (mobile ? 27 : 25);
  const labelX = x + (mobile ? 78 : 75);
  const labelY = y + (mobile ? 49 : 38);
  const questionY = y + (mobile ? 88 : 70);
  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${mobile ? 17 : 16}" fill="${COLORS.surface}" stroke="${COLORS.line}" stroke-opacity=".12"/>
    <circle cx="${numberX + 19}" cy="${y + (mobile ? 42 : 38)}" r="19" fill="${COLORS.elevated}" stroke="${COLORS.salmon}" stroke-opacity=".72"/>
    <text x="${numberX + 19}" y="${y + (mobile ? 50 : 46)}" text-anchor="middle" class="label" font-size="22">${index + 1}</text>
    <text x="${labelX}" y="${labelY}" class="label" font-size="${mobile ? 28 : 26}">${escapeXml(item.label)}</text>
    ${svgText(item.question, { x: labelX, y: questionY, className: 'muted', lineHeight: mobile ? 28 : 28 }).replace('class="muted"', `class="muted" font-size="${mobile ? 25 : 24}"`)}
  </g>`;
}

function renderChecklist(diagram, viewport) {
  const mobile = viewport === MOBILE;
  const rows = [];
  if (mobile) {
    diagram.items.forEach((item, index) => {
      rows.push(renderChecklistRow(item, index, 44, 276 + index * 132, 712, 120, true));
    });
  } else {
    diagram.items.forEach((item, index) => {
      rows.push(renderChecklistRow(item, index, 448, 239 + index * 99, 680, 85, false));
    });
  }
  return documentShell(
    diagram,
    viewport,
    [renderHeader(diagram, viewport), mobile ? '' : renderNotebookPanel(diagram), rows.join('\n'), renderFooter(diagram, viewport)].join('\n')
  );
}

function renderDiagram(diagram, viewport) {
  if (diagram.template === 'sequence') return renderSequence(diagram, viewport);
  if (diagram.template === 'matrix') return renderMatrix(diagram, viewport);
  if (diagram.template === 'checklist') return renderChecklist(diagram, viewport);
  throw new Error(`Unknown diagram template: ${diagram.template}`);
}

function expectedSources() {
  const outputs = [];
  for (const diagram of DIAGRAMS) {
    for (const viewport of [DESKTOP, MOBILE]) {
      outputs.push({
        diagram,
        viewport,
        fileName: `${diagram.stem}${viewport.suffix}.svg`,
        contents: renderDiagram(diagram, viewport),
      });
    }
  }
  return outputs;
}

function validateDefinitions() {
  if (DIAGRAMS.length !== 10) throw new Error(`Expected 10 diagram definitions, received ${DIAGRAMS.length}`);
  const stems = new Set();
  for (const diagram of DIAGRAMS) {
    if (stems.has(diagram.stem)) throw new Error(`Duplicate diagram stem: ${diagram.stem}`);
    stems.add(diagram.stem);
    if (!['en', 'es'].includes(diagram.locale)) throw new Error(`${diagram.stem}: unsupported locale ${diagram.locale}`);
    const expectedItems = diagram.template === 'checklist' ? 5 : 4;
    if (diagram.items.length !== expectedItems) {
      throw new Error(`${diagram.stem}: ${diagram.template} requires ${expectedItems} items`);
    }
    const visibleWords = [
      ...diagram.mobileTitle,
      ...diagram.mobileDeck,
      ...diagram.items.flatMap((item) => [item.label, ...(item.question || [])]),
    ].join(' ').trim().split(/\s+/).length;
    if (visibleWords > 58) throw new Error(`${diagram.stem}: mobile composition is too dense (${visibleWords} words)`);
  }
}

function writeSources(outputs) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const output of outputs) {
    fs.writeFileSync(path.join(OUTPUT_DIR, output.fileName), output.contents);
  }
}

function checkSources(outputs) {
  const errors = [];
  for (const output of outputs) {
    const outputPath = path.join(OUTPUT_DIR, output.fileName);
    if (!fs.existsSync(outputPath)) {
      errors.push(`missing ${output.fileName}`);
      continue;
    }
    const actual = fs.readFileSync(outputPath, 'utf8');
    if (actual !== output.contents) errors.push(`stale or non-deterministic ${output.fileName}`);
    const dimension = `width="${output.viewport.width}" height="${output.viewport.height}"`;
    if (!actual.includes(dimension)) errors.push(`wrong dimensions in ${output.fileName}`);
    if (!actual.includes("font-family:'Noctalia Fraunces'")) errors.push(`missing Fraunces in ${output.fileName}`);
    if (!actual.includes("font-family:'Noctalia Outfit'")) errors.push(`missing Outfit in ${output.fileName}`);
  }
  if (errors.length) throw new Error(`Educational diagram v2 validation failed:\n- ${errors.join('\n- ')}`);
}

function generateEducationalDiagramSources({ checkOnly = false } = {}) {
  validateDefinitions();
  const outputs = expectedSources();
  if (checkOnly) checkSources(outputs);
  else {
    writeSources(outputs);
    checkSources(outputs);
  }
  const desktopCount = outputs.filter((output) => output.viewport === DESKTOP).length;
  const mobileCount = outputs.filter((output) => output.viewport === MOBILE).length;
  return {
    conceptCount: DIAGRAMS.length,
    desktopCount,
    mobileCount,
    outputDir: OUTPUT_DIR,
  };
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const report = generateEducationalDiagramSources({ checkOnly });
  console.log(
    `Educational diagrams v2 ${checkOnly ? 'checked' : 'generated'}: ` +
      `${report.desktopCount} desktop, ${report.mobileCount} mobile, ` +
      `${report.conceptCount} localized concepts.`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  COLORS,
  DESKTOP,
  DIAGRAMS,
  MOBILE,
  OUTPUT_DIR,
  expectedSources,
  generateEducationalDiagramSources,
  renderDiagram,
  validateDefinitions,
};
