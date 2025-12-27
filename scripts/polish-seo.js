const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');

const ALT_TEXT_MAPPING = {
  // FR Slugs
  'comment-se-souvenir-de-ses-reves': 'Personne écrivant dans son journal pour améliorer la mémoire des rêves',
  'guide-cauchemars': 'Atmosphère mystérieuse et sombre évoquant le monde des cauchemars',
  'guide-incubation-reves': 'Chambre sereine favorisant la pratique de l\'incubation de rêves',
  'guide-journal-reves': 'Journal de rêves ouvert sur une table de chevet avec un stylo',
  'guide-paralysie-sommeil': 'Illustration évocatrice d\'un réveil nocturne lié à la paralysie du sommeil',
  'guide-reve-lucide-debutant': 'Paysage fantastique illustrant la conscience au sein d\'un rêve lucide',
  'histoire-interpretation-reves': 'Temple antique sous un ciel étoilé symbolisant l\'histoire de l\'interprétation des rêves',
  'pourquoi-nous-revons-science': 'Représentation schématique du cerveau en activité pendant le sommeil',
  'reves-de-chute': 'Image abstraite d\'une sensation de chute à travers un ciel nuageux',
  'reves-de-grossesse': 'Symbolisme de la renaissance et des nouveaux départs dans les rêves',
  'reves-de-mort': 'Forêt brumeuse illustrant le concept de transformation symbolique de la mort',
  'reves-dents-qui-tombent': 'Illustration métaphorique du stress et de la perte de contrôle',
  'reves-de-serpents': 'Serpent dans les herbes hautes, symbole universel de transformation',
  'reves-de-voler': 'Perspective aérienne évoquant la liberté du vol onirique',
  'reves-eau': 'Surface d\'eau calme reflétant les émotions du subconscient',
  'reves-etre-poursuivi': 'Couloir sombre illustrant la sensation d\'être poursuivi en rêve',
  'reves-ex-partenaire': 'Silhouette contemplative évoquant les souvenirs et les relations passées',
  'reves-premonitoires-science': 'Horloge brisée et galaxies illustrant le temps et les rêves prémonitoires',
  'reves-sante-mentale': 'Visage serein en harmonie avec son univers onirique',
  'signification-reves-recurrents': 'Motif en spirale illustrant la répétition des thèmes oniriques',
  'sommeil-paradoxal-reves': 'Graphique d\'ondes cérébrales typiques du sommeil paradoxal',

  // EN Slugs
  'being-chased-dreams': 'Dark corridor illustrating the feeling of being chased in a dream',
  'death-dreams-meaning': 'Foggy forest representing transformation and the symbolic meaning of death',
  'dream-incubation-guide': 'Peaceful bedroom setup for practicing dream incubation',
  'dream-interpretation-history': 'Ancient temple under a starry sky representing dream history',
  'dream-journal-guide': 'Open dream journal with a pen on a wooden bedside table',
  'dreams-about-ex': 'Reflective silhouette symbolizing memories of past relationships',
  'dreams-mental-health': 'Person in peaceful contemplation of their inner mental landscape',
  'falling-dreams-meaning': 'Abstract visual of a person falling through soft clouds',
  'flying-dreams-meaning': 'Wide sky view representing the freedom and thrill of flying in dreams',
  'how-to-remember-dreams': 'Individual writing down dream details upon waking',
  'lucid-dreaming-beginners-guide': 'Surreal and vibrant landscape showing the power of lucidity',
  'precognitive-dreams-science': 'Merging of clock and space imagery representing premonitions',
  'pregnancy-dreams-meaning': 'Soft light and symbols representing growth and new beginnings',
  'recurring-dreams-meaning': 'Recursive patterns illustrating the nature of repeating dreams',
  'rem-sleep-dreams': 'Visual representation of REM sleep brain activity and eye movement',
  'sleep-paralysis-guide': 'Deep purple and blue atmosphere depicting the state of sleep paralysis',
  'snake-dreams-meaning': 'Artistic depiction of a snake, representing ancient wisdom or transformation',
  'stop-nightmares-guide': 'Dawn light breaking through darkness, symbolizing freedom from nightmares',
  'teeth-falling-out-dreams': 'Symbolic imagery depicting vulnerability and personal change',
  'water-dreams-meaning': 'Vast ocean surface representing the depths of the emotional subconscious',
  'why-we-dream-science': 'Glowing neural connections inside a human brain silhouette',

  // ES Slugs
  'como-recordar-suenos': 'Persona anotando sus sueños en un diario al despertar',
  'guia-diario-suenos': 'Diario de sueños abierto con una pluma sobre una mesa de noche',
  'guia-incubacion-suenos': 'Dormitorio tranquilo preparado para la práctica de incubación',
  'guia-paralisis-sueno': 'Habitación en penumbra que evoca la experiencia de parálisis del sueño',
  'guia-pesadillas': 'Atmósfera misteriosa que representa el mundo de las pesadillas',
  'guia-suenos-lucidos-principiantes': 'Paisaje fantástico que ilustra el control en los sueños lúcidos',
  'historia-interpretacion-suenos': 'Templo antiguo bajo un cielo estrellado que muestra la historia onírica',
  'por-que-sonamos-ciencia': 'Imagen de actividad cerebral y redes neuronales durante el sueño',
  'significado-suenos-recurrentes': 'Patrón repetitivo que ilustra la naturaleza de los sueños recurrentes',
  'sueno-rem-suenos': 'Gráfico de actividad cerebral característica del sueño REM',
  'suenos-con-ex': 'Silueta reflexiva que evoca recuerdos de relaciones pasadas',
  'suenos-con-serpientes': 'Serpiente en la naturaleza, símbolo de sabiduría y cambio',
  'suenos-de-agua': 'Superficie de agua en calma que refleja las emociones profundas',
  'suenos-de-caer': 'Representación abstracta de la sensación de caer entre nubes',
  'suenos-de-embarazo': 'Luz suave que simboliza crecimiento y nuevos comienzos',
  'suenos-de-muerte': 'Bosque con niebla que representa el cambio y el renacimiento',
  'suenos-de-volar': 'Vista aérea que captura la libertad de volar en los sueños',
  'suenos-dientes-caen': 'Imagen simbólica que representa estrés y vulnerabilidad',
  'suenos-premonitorios-ciencia': 'Reloj y galaxias fusionados, símbolo de los sueños premonitorios',
  'suenos-salud-mental': 'Rostro sereno en equilibrio con su mundo interior',
  'suenos-ser-perseguido': 'Pasillo oscuro que ilustra la vivencia de ser perseguido',
};

const EXTRA_LINKS = {
  fr: [
    { terms: ['santé mentale', 'bien-être psychologique', 'impact psychologique'], slug: 'reves-sante-mentale' },
    { terms: ['cauchemars récurrents', 'fréquence des cauchemars'], slug: 'guide-cauchemars' },
  ],
  en: [
    { terms: ['mental health', 'psychological well-being', 'psychological impact'], slug: 'dreams-mental-health' },
    { terms: ['recurring nightmares', 'nightmare frequency'], slug: 'stop-nightmares-guide' },
  ],
  es: [
    { terms: ['salud mental', 'bienestar psicológico', 'impacto psicológico'], slug: 'suenos-salud-mental' },
    { terms: ['pesadillas recurrentes', 'frecuencia de las pesadillas'], slug: 'guia-pesadillas' },
  ],
};

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function polishFile(absPath, lang, slug) {
  let content = fs.readFileSync(absPath, 'utf8');
  let modified = false;

  // 1. Update Alt Text for the main blog image
  // Improved regex: find alt="..." and capture its content properly even with apostrophes
  const altRegex = new RegExp(`(<img[^>]*src=["'][^"']*${slug}\\.webp["'][^>]*alt=)(["'])(.*?)\\2`, 'is');
  if (ALT_TEXT_MAPPING[slug]) {
    const match = content.match(altRegex);
    if (match && match[3] !== ALT_TEXT_MAPPING[slug]) {
      // Group 1: <img...alt=, Group 2: quote char, Group 3: old alt
      const newTagPart = `${match[1]}${match[2]}${ALT_TEXT_MAPPING[slug]}${match[2]}`;
      content = content.replace(match[0], newTagPart);
      modified = true;
    }
  }

  // 2. Denser Linking
  const mapping = EXTRA_LINKS[lang];
  if (mapping) {
    const pRegex = /<p\b[^>]*>(?:(?!<\/p>).)*?<\/p>/gis;
    let fileModifiedByLinks = false;

    // We'll process each paragraph and try to inject missing links
    content = content.replace(pRegex, (paragraph) => {
      // Skip if already contains a link
      if (paragraph.includes('<a ') || paragraph.includes('</a>')) return paragraph;

      let newParagraph = paragraph;
      for (const item of mapping) {
        if (item.slug === slug) continue;

        const linkTag = `<a href="${item.slug}" class="text-dream-salmon hover:underline">`;
        const closeTag = '</a>';

        for (const term of item.terms) {
          const termRegex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
          if (termRegex.test(newParagraph)) {
            newParagraph = newParagraph.replace(termRegex, (m) => `${linkTag}${m}${closeTag}`);
            fileModifiedByLinks = true;
            return newParagraph; // One link per paragraph is enough
          }
        }
      }
      return newParagraph;
    });

    if (fileModifiedByLinks) {
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(absPath, content, 'utf8');
  }
  return modified;
}

function main() {
  const langs = ['fr', 'en', 'es'];
  let count = 0;

  for (const lang of langs) {
    const dir = path.join(DOCS_DIR, lang, 'blog');
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith('.html') || file === 'index.html') continue;
      const slug = path.basename(file, '.html');
      const absPath = path.join(dir, file);
      
      if (polishFile(absPath, lang, slug)) {
        console.log(`Polished ${lang}/blog/${file}`);
        count++;
      }
    }
  }
  console.log(`\nPolishing complete. ${count} files updated.`);
}

main();
