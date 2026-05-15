#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TODAY = '2026-05-04';

function abs(relPath) {
  return path.join(ROOT, relPath);
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(abs(relPath), 'utf8'));
}

function writeJson(relPath, data) {
  fs.writeFileSync(abs(relPath), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function splitSource(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Invalid front matter');
  return { meta: JSON.parse(match[1]), body: match[2] };
}

function joinSource(meta, body) {
  return `---\n${JSON.stringify(meta, null, 2)}\n---\n${body}`;
}

function readSource(relPath) {
  return splitSource(fs.readFileSync(abs(relPath), 'utf8'));
}

function writeSource(relPath, meta, body) {
  fs.writeFileSync(abs(relPath), joinSource(meta, body), 'utf8');
}

function parseJsonLd(meta) {
  return (meta.jsonLd || []).map((entry) => JSON.parse(entry));
}

function serializeJsonLd(entries) {
  return entries.map((entry) => JSON.stringify(entry, null, 2));
}

function updateMeta(meta, { title, description }) {
  meta.title = title;
  meta.description = description;
  meta.ogTitle = title;
  meta.ogDescription = description;
  meta.twitterTitle = title;
  meta.twitterDescription = description;
  meta.modifiedTime = TODAY;
}

function updateBlogPosting(meta, { headline, description, url }) {
  const list = parseJsonLd(meta);
  const posting = list.find((entry) => entry['@type'] === 'BlogPosting');
  if (posting) {
    posting.headline = headline;
    posting.description = description;
    posting.dateModified = TODAY;
    if (url) {
      posting.url = url;
      posting.mainEntityOfPage = { '@type': 'WebPage', '@id': url };
    }
  }
  meta.jsonLd = serializeJsonLd(list);
}

function updateFaq(meta, faq) {
  const list = parseJsonLd(meta);
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer }
    }))
  };
  const index = list.findIndex((entry) => entry['@type'] === 'FAQPage');
  if (index >= 0) list[index] = faqSchema;
  else list.push(faqSchema);
  meta.jsonLd = serializeJsonLd(list);
}

function replaceH1(body, h1) {
  return body.replace(
    /(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/,
    `$1\n                    ${h1}\n                $2`
  );
}

function replaceQuickAnswer(body, answer) {
  return body.replace(
    /(<section[^>]*aria-labelledby="quick-answer-title"[\s\S]*?<p class="text-purple-100\/80 leading-relaxed">)[\s\S]*?(<\/p>\s*<\/section>)/,
    `$1${answer}$2`
  );
}

function upsertBlock(body, marker, html, beforeNeedle = '<figure') {
  if (body.includes(marker)) {
    const markerEnd = body.indexOf('\n', body.indexOf(marker));
    const insertionPoint = markerEnd === -1 ? body.indexOf(marker) + marker.length : markerEnd + 1;
    const afterMarker = body.slice(insertionPoint);
    const sectionMatch = afterMarker.match(/^\s*<section[\s\S]*?<\/section>/);
    if (sectionMatch) {
      return `${body.slice(0, insertionPoint)}${html}\n${afterMarker.slice(sectionMatch[0].length)}`;
    }
    return `${body.slice(0, insertionPoint)}${html}\n${body.slice(insertionPoint)}`;
  }
  const index = body.indexOf(beforeNeedle);
  if (index === -1) throw new Error(`Missing insertion point ${beforeNeedle}`);
  return `${body.slice(0, index)}${html}\n${body.slice(index)}`;
}

function faqHtml(faq, heading = 'Preguntas frecuentes') {
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
</section>`;
}

function updateSymbols() {
  const updates = {
    door: {
      es: {
        seoTitle: 'puertas abiertas o cerradas',
        shortDescription: 'Soñar con puertas habla de oportunidades, cambios y límites. Una puerta cerrada señala bloqueo o decisión pendiente; una puerta abierta sugiere acceso, permiso o un nuevo comienzo.',
        askYourself: [
          '¿Qué puerta quiero abrir o cerrar en mi vida?',
          '¿Estoy evitando una decisión, una conversación o un cambio?',
          '¿La puerta del sueño era de mi casa, desconocida, abierta o cerrada?'
        ],
        faq: [
          ['¿Qué significa soñar con puertas?', 'Soñar con puertas suele relacionarse con oportunidades, decisiones y cambios de etapa. La interpretación depende de si la puerta estaba abierta, cerrada, bloqueada o si intentabas cruzarla.'],
          ['¿Qué significa soñar con abrir una puerta cerrada?', 'Abrir una puerta cerrada en sueños indica que estás intentando superar un bloqueo, acceder a una oportunidad o resolver algo que antes parecía inaccesible.'],
          ['¿Qué significa soñar con la puerta abierta de tu casa?', 'Una puerta abierta en casa puede señalar vulnerabilidad, confianza o una situación personal que está demasiado expuesta. También puede simbolizar bienvenida y apertura emocional.'],
          ['¿Qué significa soñar con una puerta que no puedes abrir?', 'Suele mostrar frustración, miedo al rechazo o una oportunidad que requiere preparación, paciencia o una llave simbólica antes de avanzar.']
        ]
      },
      it: {
        seoTitle: 'una porta aperta o chiusa',
        shortDescription: 'Sognare una porta parla di passaggi, opportunità e confini personali. Una porta aperta indica accesso o cambiamento; una porta chiusa segnala ostacoli o una decisione rimandata.',
        faq: [
          ['Cosa significa sognare una porta?', 'Sognare una porta indica spesso una transizione, una scelta o un confine personale. Il significato cambia se la porta è aperta, chiusa, bloccata o collegata alla casa.'],
          ['Cosa significa sognare la porta di casa aperta?', 'La porta di casa aperta può riflettere vulnerabilità, fiducia o qualcosa della vita privata che senti esposto. In alcuni sogni indica anche disponibilità al cambiamento.'],
          ['Cosa significa sognare una porta che si apre?', 'Una porta che si apre suggerisce possibilità, accesso a una nuova fase o una soluzione che inizia a diventare disponibile.']
        ]
      }
    },
    hospital: {
      es: {
        seoTitle: 'hospital, doctores o enfermos',
        shortDescription: 'Soñar con hospital suele hablar de sanación, salud, enfermos, doctores y necesidad de apoyo. Puede aparecer cuando el estrés, la preocupación o el cansancio piden atención.',
        faq: [
          ['¿Qué significa soñar con hospital?', 'Soñar con hospital suele indicar que algo en tu vida necesita atención, cuidado o sanación. Puede relacionarse con preocupaciones de salud, cansancio emocional, miedo por un familiar o una situación en la que necesitas apoyo.'],
          ['¿Qué significa soñar que estás en un hospital?', 'Estar en un hospital en sueños suele reflejar vulnerabilidad, recuperación o necesidad de ayuda. El sueño puede aparecer cuando estás agotado, preocupado o intentando resolver algo que requiere cuidado.'],
          ['¿Qué significa soñar con hospital y doctores?', 'Los doctores pueden simbolizar diagnóstico, guía o una parte de ti que busca una respuesta clara. El sueño sugiere mirar el problema con más cuidado en vez de ignorarlo.'],
          ['¿Qué significa soñar con enfermos en un hospital?', 'Ver enfermos puede reflejar preocupación por otros, miedo a la fragilidad o una parte de tu propio bienestar que necesita atención.']
        ]
      }
    },
    bridge: {
      es: {
        seoTitle: 'puentes rotos o sobre agua',
        shortDescription: 'Soñar con un puente habla de transición, decisiones y paso entre dos etapas. Un puente roto, alto o sobre agua refleja miedo al cambio o a no poder cruzar.',
        faq: [
          ['¿Qué significa soñar con un puente?', 'Un puente en sueños representa un paso entre dos etapas, una conexión o una decisión de avance. Cruzarlo suele hablar de cambio; no poder cruzarlo señala duda o bloqueo.'],
          ['¿Qué significa soñar con un puente roto?', 'Soñar con un puente roto indica miedo a que una transición no funcione, una relación dañada o la sensación de que falta apoyo para llegar al otro lado.'],
          ['¿Qué significa soñar con un puente y agua?', 'El agua añade carga emocional al sueño. Un puente sobre agua puede mostrar que intentas atravesar una emoción intensa sin dejar que te arrastre.'],
          ['¿Qué significa soñar con cruzar un puente?', 'Cruzar un puente suele indicar avance, decisión tomada o disposición a dejar una etapa atrás para entrar en otra.']
        ]
      }
    },
    forest: {
      es: {
        seoTitle: 'un bosque oscuro o verde',
        shortDescription: 'Soñar con un bosque refleja exploración interior, incertidumbre y contacto con lo desconocido. Un bosque oscuro señala miedo o confusión; uno verde puede indicar crecimiento.',
        faq: [
          ['¿Qué significa soñar con un bosque?', 'Soñar con un bosque suele simbolizar entrar en una zona desconocida de tu vida o de tu mundo interior. Puede hablar de búsqueda, miedo, crecimiento o necesidad de orientación.'],
          ['¿Qué significa soñar con un bosque oscuro?', 'Un bosque oscuro refleja incertidumbre, miedo a lo desconocido o una etapa en la que no ves claro el camino. No siempre es negativo: también puede marcar el inicio de una exploración profunda.'],
          ['¿Qué significa soñar con un bosque verde?', 'Un bosque verde suele asociarse con crecimiento, recuperación y conexión natural. Puede indicar que algo interno está madurando aunque todavía no esté completamente claro.']
        ]
      }
    },
    wolf: {
      es: {
        seoTitle: 'lobos, manadas o ataques',
        shortDescription: 'Soñar con lobos habla de instinto, amenaza, protección y pertenencia. Un lobo puede reflejar intuición; una manada o lobos que atacan señalan presión o conflicto.',
        faq: [
          ['¿Qué significa soñar con lobos?', 'Soñar con lobos puede hablar de instinto, protección, amenaza o pertenencia a un grupo. La interpretación depende de si los lobos atacan, acompañan, persiguen o aparecen como manada.'],
          ['¿Qué significa soñar con un lobo?', 'Un solo lobo suele representar intuición, independencia o una fuerza instintiva que necesitas escuchar. Si el lobo da miedo, puede señalar desconfianza o una amenaza percibida.'],
          ['¿Qué significa soñar con lobos que atacan?', 'Lobos que atacan reflejan presión, miedo, conflicto o una emoción instintiva que se siente fuera de control. También pueden simbolizar sentirte rodeado por críticas o expectativas.'],
          ['¿Qué significa soñar con una manada de lobos?', 'Una manada de lobos habla de grupo, familia, presión social o necesidad de apoyo. El tono cambia según si la manada protege, observa o amenaza.']
        ]
      }
    },
    dog: {
      it: {
        seoTitle: 'un cane che attacca o morde',
        shortDescription: 'Sognare un cane parla di fiducia, protezione e legami. Un cane che attacca o morde segnala conflitto, minaccia percepita o lealtà ferita.',
        askYourself: [
          'Il cane era amichevole, aggressivo o protettivo?',
          'Mi attaccava, mi mordeva o difendeva qualcuno?',
          'Quale rapporto di fiducia sembra fragile in questo momento?'
        ],
        faq: [
          ['Cosa significa sognare un cane?', 'Sognare un cane riguarda spesso fiducia, lealtà, protezione e relazioni. Il significato cambia molto se il cane è affettuoso, aggressivo, randagio o ferito.'],
          ['Cosa significa sognare un cane che ti attacca?', 'Un cane che attacca può indicare conflitto, paura di essere tradito o una minaccia percepita in una relazione. Può anche mostrare rabbia o difesa che non hai ancora espresso.'],
          ['Cosa significa sognare un cane che morde?', 'Il morso di un cane segnala una ferita nella fiducia, una parola aggressiva o una relazione che da protettiva è diventata dolorosa.'],
          ['Cosa significa sognare un cane che ti protegge?', 'Un cane protettivo indica sostegno, alleati fedeli o una parte istintiva di te che cerca sicurezza.']
        ]
      }
    },
    flood: {
      es: {
        seoTitle: 'inundaciones y agua que se desborda',
        shortDescription: 'Soñar con inundación indica emociones que se desbordan, estrés acumulado o cambios repentinos. La casa, el agua limpia o sucia y tu reacción cambian el significado.',
        faq: [
          ['¿Qué significa soñar con inundación?', 'Soñar con inundación suele indicar emociones, estrés o cambios que se sienten difíciles de contener. Puede aparecer cuando una situación familiar, laboral o afectiva te supera.'],
          ['¿Qué significa soñar con inundación en casa?', 'Una casa inundada sugiere que preocupaciones, conflictos o emociones intensas están invadiendo tu espacio de seguridad e intimidad.'],
          ['¿Qué significa soñar con inundación de agua limpia?', 'El agua limpia puede indicar liberación emocional, claridad o una limpieza necesaria después de un periodo de tensión.'],
          ['¿Qué significa soñar con inundación de agua sucia?', 'El agua sucia señala confusión, cansancio o emociones mezcladas que todavía necesitan orden.']
        ]
      }
    }
  };

  for (const relPath of ['data/dream-symbols.json', 'docs/data/dream-symbols.json']) {
    const data = readJson(relPath);
    const byId = new Map(data.symbols.map((symbol) => [symbol.id, symbol]));
    for (const [id, langUpdates] of Object.entries(updates)) {
      const symbol = byId.get(id);
      if (!symbol) continue;
      for (const [lang, update] of Object.entries(langUpdates)) {
        symbol[lang] = symbol[lang] || {};
        const next = { ...update };
        if (next.faq) next.faq = next.faq.map(([question, answer]) => ({ question, answer }));
        Object.assign(symbol[lang], next);
      }
    }
    const hospital = byId.get('hospital');
    if (hospital) {
      hospital.relatedSymbols = ['house', 'death', 'blood', 'accident', 'child', 'pregnancy'];
    }
    writeJson(relPath, data);
  }

  for (const relPath of ['data/dream-symbols-extended.json', 'docs/data/dream-symbols-extended.json']) {
    const data = readJson(relPath);
    if (data.symbols.dog?.it) {
      data.symbols.dog.it.fullInterpretation = '<p>Sognare un cane parla prima di tutto di fiducia, lealtà e protezione. Il cane può rappresentare una relazione fedele, un alleato o la parte istintiva che ti avverte quando qualcosa non va.</p><p>Quando nel sogno il cane attacca, ringhia o morde, il simbolo cambia tono: può indicare conflitto, una fiducia ferita, paura di essere tradito o rabbia che non ha ancora trovato parole. Non significa che una persona ti farà del male; mostra dove una relazione si sente meno sicura.</p><p>Un cane che protegge, invece, indica sostegno e difesa. Può rappresentare una persona affidabile o una risorsa interna che ti aiuta a mettere confini.</p>';
      data.symbols.dog.it.variations = [
        { context: 'Cane che attacca', meaning: 'Conflitto, minaccia percepita o rabbia che chiede attenzione.' },
        { context: 'Cane che morde', meaning: 'Fiducia ferita, parole aggressive o relazione diventata dolorosa.' },
        { context: 'Cane amichevole', meaning: 'Lealtà, amicizia affidabile e bisogno di vicinanza.' },
        { context: 'Cane che ti protegge', meaning: 'Sostegno, sicurezza e istinto protettivo.' }
      ];
    }
    if (data.symbols.flood?.es) {
      data.symbols.flood.es.variations = [
        { context: 'Inundación en casa', meaning: 'Emociones o conflictos que invaden tu intimidad y sensación de seguridad.' },
        { context: 'Inundación de agua limpia', meaning: 'Liberación emocional, claridad o limpieza después de una etapa intensa.' },
        { context: 'Inundación de agua sucia', meaning: 'Confusión, cansancio emocional o problemas mezclados que necesitan orden.' },
        { context: 'Escapar de una inundación', meaning: 'Búsqueda de salida, límites y recuperación de control.' }
      ];
    }
    writeJson(relPath, data);
  }
}

function updateArticle(relPath, config) {
  const { meta, body } = readSource(relPath);
  updateMeta(meta, config);
  updateBlogPosting(meta, {
    headline: config.headline,
    description: config.description,
    url: config.url
  });
  if (config.faq) updateFaq(meta, config.faq);
  let next = replaceH1(body, config.h1 || config.headline);
  if (config.quickAnswer) next = replaceQuickAnswer(next, config.quickAnswer);
  if (config.block) next = upsertBlock(next, config.marker, config.block, config.beforeNeedle || '<figure');
  if (config.faq) next = upsertBlock(next, '<!-- GSC Visible FAQ -->', faqHtml(config.faq, config.faqHeading || 'Preguntas frecuentes'), config.faqBeforeNeedle || '<div class="prose');
  writeSource(relPath, meta, next);
}

function updateArticles() {
  updateArticle('docs-src/content/blog/blog.death-dreams-meaning/es.md', {
    title: 'Soñar con muerte: significado emocional, cambio y duelo | Noctalia',
    description: 'Soñar con muerte no suele ser una predicción. Lee qué significa soñar con tu muerte, un familiar muerto, un funeral o matar a alguien.',
    headline: 'Soñar con muerte: significado emocional, cambio y duelo',
    h1: 'Soñar con muerte: significado emocional, cambio y duelo',
    url: 'https://noctalia.app/es/blog/suenos-de-muerte',
    quickAnswer: 'Soñar con muerte casi nunca predice una muerte real. Suele hablar de final, cambio, duelo, miedo a perder algo o transformación. Si sueñas con tu propia muerte, el foco suele ser una etapa personal que termina; si muere un familiar, puede reflejar miedo, separación o cambios en ese vínculo.',
    marker: '<!-- GSC SEO Update: death high-position scenarios -->',
    block: `
<!-- GSC SEO Update: death high-position scenarios -->
<section class="glass-panel rounded-2xl p-6 my-10 border border-dream-salmon/15 bg-white/5">
<h2 class="font-serif text-2xl text-dream-cream mb-4">Soñar con muerte no suele anunciar una muerte real</h2>
<p class="text-purple-100/80 leading-relaxed mb-4">La lectura más útil es simbólica: una etapa termina, una relación cambia, una identidad se transforma o una emoción de duelo necesita espacio. Por eso esta página prioriza los escenarios que más busca la gente.</p>
<div class="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Soñar con tu propia muerte</h3><p>Se relaciona con transformación personal, cierre de ciclo o miedo ante una decisión grande.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Soñar con la muerte de un familiar</h3><p>Puede reflejar miedo a perder, distancia emocional o cambios en el rol que esa persona ocupa para ti.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Soñar con un funeral</h3><p>Habla de despedida simbólica, aceptación o necesidad de cerrar una etapa con más claridad.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Soñar que matas a alguien</h3><p>Suele señalar ira, rechazo de una dinámica o deseo de cortar con un patrón interno.</p></div>
</div>
<p class="text-sm text-purple-200/70 mt-4">También puedes ampliar con <a class="text-dream-salmon hover:underline" href="../simbolos/muerte">soñar con muerte</a> y <a class="text-dream-salmon hover:underline" href="../simbolos/persona-fallecida">soñar con una persona fallecida</a>.</p>
</section>`,
    faq: [
      ['¿Qué significa soñar con muerte?', 'Soñar con muerte suele simbolizar cambio, final de etapa, duelo o transformación. No debe leerse como una predicción literal.'],
      ['¿Qué significa soñar con la muerte de un familiar?', 'Puede reflejar miedo a perder a esa persona, cambios en la relación o una preocupación emocional que todavía no has procesado.'],
      ['¿Qué significa soñar con tu propia muerte?', 'Normalmente habla de una identidad, etapa o hábito que termina. También puede aparecer en momentos de transición intensa.'],
      ['¿Qué significa soñar con un funeral?', 'Un funeral en sueños suele indicar despedida simbólica, necesidad de cierre o aceptación de un cambio.']
    ]
  });

  updateArticle('docs-src/content/blog/blog.flying-dreams-meaning/es.md', {
    title: 'Soñar que vuelas: significado de volar alto, bajo o con miedo | Noctalia',
    description: 'Qué significa soñar que vuelas, si vuelas alto, bajo, con miedo o sin control. Interpreta el sueño según libertad, escape y confianza.',
    headline: 'Soñar que vuelas: significado de volar alto, bajo o con miedo',
    h1: 'Soñar que vuelas: significado de volar alto, bajo o con miedo',
    url: 'https://noctalia.app/es/blog/suenos-de-volar',
    quickAnswer: 'Soñar que vuelas suele relacionarse con libertad, perspectiva y deseo de superar límites. Si vuelas con facilidad, el sueño apunta a confianza; si vuelas con miedo o pierdes altura, puede reflejar ansiedad, falta de control o necesidad de escapar de presión.',
    marker: '<!-- GSC SEO Update: flying exact-match scenarios -->',
    block: `
<!-- GSC SEO Update: flying exact-match scenarios -->
<section class="glass-panel rounded-2xl p-6 my-10 border border-dream-salmon/15 bg-white/5">
<h2 class="font-serif text-2xl text-dream-cream mb-4">Soñar que vuelas: escenarios más comunes</h2>
<p class="text-purple-100/80 leading-relaxed mb-4">La clave no es solo volar, sino cómo lo haces: con libertad, miedo, altura, caída o sensación de control.</p>
<div class="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Volar alto</h3><p>Confianza, perspectiva y sensación de estar por encima de un problema.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Volar bajo</h3><p>Deseo de avanzar, pero con prudencia o miedo a perder estabilidad.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Volar con miedo</h3><p>Libertad mezclada con ansiedad, responsabilidad o falta de control.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">No poder controlar el vuelo</h3><p>Impulso de escapar sin tener claro hacia dónde ir.</p></div>
</div>
</section>`,
    faq: [
      ['¿Qué significa soñar que vuelas?', 'Suele simbolizar libertad, perspectiva, ambición o deseo de superar límites. El tono emocional del vuelo cambia la interpretación.'],
      ['¿Qué significa soñar que vuelas alto?', 'Volar alto indica confianza, visión amplia o sensación de avance. También puede señalar aspiraciones elevadas.'],
      ['¿Qué significa soñar que vuelas con miedo?', 'Volar con miedo mezcla deseo de libertad con ansiedad, falta de control o presión por una decisión importante.'],
      ['¿Qué significa soñar que vuelas y caes?', 'Puede mostrar miedo a perder control después de avanzar, inseguridad o temor a que una oportunidad no se sostenga.']
    ]
  });

  updateArticle('docs-src/content/blog/blog.precognitive-dreams-science/en.md', {
    title: 'Precognitive dreams, confirmation bias and coincidence | Noctalia',
    description: 'Why precognitive dreams feel real: confirmation bias, coincidence, memory reconstruction, probability and how a dream journal keeps the test honest.',
    headline: 'Precognitive dreams, confirmation bias and coincidence',
    h1: 'Precognitive dreams, confirmation bias and coincidence',
    url: 'https://noctalia.app/en/blog/precognitive-dreams-science',
    quickAnswer: 'Precognitive dreams can feel convincing, but mainstream science explains most cases through confirmation bias, coincidence, memory reconstruction, probability and selective attention. A dated dream journal helps separate what was written before an event from what the mind connects afterward.',
    marker: '<!-- GSC SEO Update: confirmation bias intent -->',
    block: `
<!-- GSC SEO Update: confirmation bias intent -->
<section class="glass-panel rounded-2xl p-6 my-10 border border-dream-salmon/15 bg-white/5">
<h2 class="font-serif text-2xl text-dream-cream mb-4">Why confirmation bias makes precognitive dreams feel real</h2>
<p class="text-purple-100/80 leading-relaxed mb-4">The strongest scientific explanation for many apparent precognitive dreams is confirmation bias: we remember the dream that seems to match an event and forget the many dreams that did not match anything.</p>
<ul class="space-y-3 text-sm text-gray-300">
<li><strong class="text-dream-cream">Selective memory:</strong> hits feel vivid, misses vanish.</li>
<li><strong class="text-dream-cream">Coincidence:</strong> many dreams across many nights create occasional matches.</li>
<li><strong class="text-dream-cream">Memory reconstruction:</strong> the remembered dream can shift after the event.</li>
<li><strong class="text-dream-cream">Dream journals:</strong> dated notes help compare the original dream with the later event more fairly.</li>
</ul>
</section>`,
    faqHeading: 'Frequently asked questions',
    faq: [
      ['Are precognitive dreams real?', 'People do report dreams that later seem connected to real events, but mainstream science has not confirmed reliable dream-based prediction. Most cases can be explained by chance, memory, and interpretation after the fact.'],
      ['What is confirmation bias in precognitive dreams?', 'Confirmation bias is the tendency to notice dream details that match later events while ignoring the many dreams that do not. It makes coincidences feel more meaningful than they may be.'],
      ['Can a dream journal test a precognitive dream?', 'A dated dream journal can help because it records details before an event happens. It does not prove prediction by itself, but it reduces memory distortion and makes comparison more honest.']
    ]
  });

  updateArticle('docs-src/content/blog/blog.dream-journal-guide/en.md', {
    title: 'Dream journal guide: how to start and remember dreams | Noctalia',
    description: 'Start a dream journal that actually sticks. Learn what to write, when to record dreams, how to improve recall and how to spot recurring symbols.',
    headline: 'Dream journal guide: how to start and remember dreams',
    h1: 'Dream journal guide: how to start and remember dreams',
    url: 'https://noctalia.app/en/blog/dream-journal-guide',
    quickAnswer: 'A dream journal works best when you record something immediately after waking: a scene, feeling, person, symbol or even “no dream remembered.” Keep the notebook or phone nearby, wake slowly, capture fragments first, then add interpretation later.',
    marker: '<!-- GSC SEO Update: dream journal answer block -->',
    block: `
<!-- GSC SEO Update: dream journal answer block -->
<section class="glass-panel rounded-2xl p-6 my-10 border border-dream-salmon/15 bg-white/5">
<h2 class="font-serif text-2xl text-dream-cream mb-4">What to write in a dream journal</h2>
<div class="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Dream fragments</h3><p>Write images, places, people and phrases before trying to make them coherent.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Emotions</h3><p>Record the feeling first; it often explains the dream better than the plot.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Symbols</h3><p>Note repeated objects or animals, then compare them with the <a class="text-dream-salmon hover:underline" href="../guides/dream-symbols-dictionary">dream symbols dictionary</a>.</p></div>
<div class="glass-panel rounded-xl p-4"><h3 class="text-dream-cream font-medium mb-2">Waking links</h3><p>Add one sentence about what in your day, stress or relationships might connect.</p></div>
</div>
</section>`,
    faqHeading: 'Frequently asked questions',
    faq: [
      ['How do I start a dream journal?', 'Keep your journal or phone beside the bed, set an intention before sleep, wake slowly, and record fragments before you analyze anything.'],
      ['What should I write in a dream journal?', 'Write the scene, emotion, people, symbols, colors, body sensations and any waking-life connection. Even a few words are useful.'],
      ['How long does it take to improve dream recall?', 'Most people notice better recall after one to two weeks of consistent recording, especially when they write immediately after waking.'],
      ['What if I cannot remember any dreams?', 'Write “no dream remembered” and one waking feeling. This keeps the habit active and trains the mind to treat dreams as worth remembering.']
    ]
  });

  updateArticle('docs-src/content/blog/blog.how-to-remember-dreams/en.md', {
    title: 'How to remember dreams: 10 recall techniques that work | Noctalia',
    description: 'Learn how to remember your dreams with simple recall techniques: wake slowly, record fragments, use intention, REM timing and a dream journal.',
    headline: 'How to remember dreams: 10 recall techniques that work',
    h1: 'How to remember dreams: 10 recall techniques that work',
    url: 'https://noctalia.app/en/blog/how-to-remember-dreams',
    quickAnswer: 'To remember dreams, wake slowly, stay still for a few seconds, replay the last feeling or image, then record fragments immediately. A consistent dream journal, a clear bedtime intention and enough REM sleep make recall much easier.',
    marker: '<!-- GSC SEO Update: recall quick checklist -->',
    block: `
<!-- GSC SEO Update: recall quick checklist -->
<section class="glass-panel rounded-2xl p-6 my-10 border border-dream-salmon/15 bg-white/5">
<h2 class="font-serif text-2xl text-dream-cream mb-4">Fastest way to remember a dream tomorrow morning</h2>
<ol class="space-y-3 text-sm text-gray-300 list-decimal pl-5">
<li>Before sleep, say: “I will remember one dream.”</li>
<li>Keep your journal or phone within reach.</li>
<li>When you wake, do not move immediately.</li>
<li>Search for the last emotion, image or place.</li>
<li>Record fragments first; interpretation can wait.</li>
</ol>
<p class="text-sm text-purple-200/70 mt-4">For the full habit, pair this with the <a class="text-dream-salmon hover:underline" href="dream-journal-guide">dream journal guide</a>.</p>
</section>`,
    faqHeading: 'Frequently asked questions',
    faq: [
      ['Why do I forget dreams so quickly?', 'Dream memories fade fast because waking attention, movement and light interrupt the fragile transition from REM sleep to waking memory.'],
      ['What is the best way to remember dreams?', 'Wake slowly, stay still, recall the last image or feeling, then write fragments immediately in a dream journal.'],
      ['Does keeping a dream journal improve recall?', 'Yes. Consistent recording trains attention and makes dream memories easier to catch over time.'],
      ['When should I record my dreams?', 'Record them immediately after waking, before checking your phone or starting the day.']
    ]
  });
}

function updateHomeBrandSignals() {
  const home = {
    en: {
      title: 'Noctalia: Dream Journal with AI Interpretation',
      description: 'Noctalia is a private dream journal app for recording dreams, exploring symbols, generating dream images and understanding nightly patterns.'
    },
    fr: {
      title: 'Noctalia : journal de rêves avec interprétation IA',
      description: 'Noctalia est une application privée de journal de rêves pour enregistrer vos rêves, explorer les symboles et comprendre vos nuits.'
    },
    es: {
      title: 'Noctalia: diario de sueños con interpretación IA',
      description: 'Noctalia es una app privada de diario de sueños para registrar sueños, explorar símbolos, generar imágenes y entender tus noches.'
    },
    de: {
      title: 'Noctalia: Traumtagebuch mit KI-Deutung',
      description: 'Noctalia ist eine private Traumtagebuch-App zum Aufzeichnen von Träumen, Erkunden von Symbolen und Verstehen nächtlicher Muster.'
    },
    it: {
      title: 'Noctalia: diario dei sogni con interpretazione IA',
      description: 'Noctalia è un diario dei sogni privato per registrare sogni, esplorare simboli, generare immagini e capire le tue notti.'
    }
  };
  for (const [lang, copy] of Object.entries(home)) {
    const relPath = `docs-src/content/pages/page.home/${lang}.md`;
    const { meta, body } = readSource(relPath);
    updateMeta(meta, copy);
    const list = parseJsonLd(meta);
    for (const entry of list) {
      const graph = entry['@graph'];
      if (Array.isArray(graph)) {
        const website = graph.find((item) => item['@type'] === 'WebSite');
        if (website) {
          website.name = 'Noctalia';
          website.alternateName = ['Noctalia dream journal', 'Noctalia app'];
          website.url = 'https://noctalia.app';
        }
        const org = graph.find((item) => item['@type'] === 'Organization');
        if (org) {
          org.name = 'Noctalia';
          org.alternateName = ['Noctalia Dream Journal'];
        }
      }
    }
    meta.jsonLd = serializeJsonLd(list);
    writeSource(relPath, meta, body);
  }
}

function updateGuideData() {
  const dict = readJson('docs/data/dictionary-content.json');
  Object.assign(dict.en, {
    page_title: 'Dream Symbols Dictionary A-Z: meanings, themes and examples | Noctalia',
    meta_description: 'Use Noctalia’s dream symbols dictionary to explore A-Z meanings for water, teeth, falling, animals, death, doors and recurring dream themes.',
    h1_text: 'Dream Symbols Dictionary A-Z',
    intro_paragraph: 'Use this A-Z dream symbols dictionary as a starting point for interpretation. Search common symbols, compare meanings by theme, then connect each image to the emotion and context of your own dream.'
  });
  Object.assign(dict.fr, {
    page_title: 'Dictionnaire des symboles de rêves A-Z | Noctalia',
    meta_description: 'Parcourez le dictionnaire des symboles de rêves Noctalia: eau, chute, animaux, mort, maison, porte et thèmes récurrents.',
    h1_text: 'Dictionnaire des symboles de rêves A-Z',
    intro_paragraph: 'Parcourez ce dictionnaire des symboles de rêves de A à Z comme point de départ. Cherchez un symbole, comparez les thèmes proches, puis reliez le sens à l’émotion et au contexte de votre propre rêve.'
  });
  Object.assign(dict.de, {
    page_title: 'Traumsymbole-Lexikon A-Z: Bedeutung häufiger Träume | Noctalia',
    meta_description: 'Nutze das Noctalia Traumsymbole-Lexikon von A bis Z: Wasser, Fallen, Tiere, Tod, Haus, Tür und wiederkehrende Traumthemen.',
    h1_text: 'Traumsymbole-Lexikon von A bis Z',
    intro_paragraph: 'Nutzen Sie dieses Traumsymbole-Lexikon von A bis Z als Ausgangspunkt. Suchen Sie ein Symbol, vergleichen Sie verwandte Themen und verbinden Sie die Deutung mit der Emotion und dem Kontext Ihres Traums.'
  });
  writeJson('docs/data/dictionary-content.json', dict);

  const curation = readJson('docs/data/curation-pages.json');
  const common = curation.pages.find((page) => page.id === 'most-common-dream-symbols');
  if (common) {
    Object.assign(common.en, {
      title: 'Most common dream symbols: 20 meanings with examples',
      metaDescription: 'Explore the 20 most common dream symbols and meanings, from water, teeth and falling to animals, death, doors and houses, with practical examples.',
      intro: 'These are the dream symbols people search and report most often. Start with the quick meaning, then use the example scenarios to separate a general symbol from the specific emotion and situation in your dream.'
    });
  }
  writeJson('docs/data/curation-pages.json', curation);
}

function main() {
  updateSymbols();
  updateArticles();
  updateHomeBrandSignals();
  updateGuideData();
  console.log('[fix-gsc-seo-errors] updated SEO source files');
}

main();
