const fs = require('fs');
const path = require('path');

const BASE = '/mnt/c/Users/thann/WebstormProjects/dreamer/docs';

function fixTypeA(filePath, lang) {
  const full = path.join(BASE, filePath);
  let c = fs.readFileSync(full, 'utf8');
  if (c.includes('og:image:width')) return false;
  const url = `https://noctalia.app/img/og/noctalia-${lang}-1200x630.jpg`;
  const search = `<meta property="og:image" content="${url}">`;
  if (!c.includes(search)) { console.log('WARN:', filePath); return false; }
  c = c.replace(search, search + '\n    <meta property="og:image:width" content="1200">\n    <meta property="og:image:height" content="630">');
  fs.writeFileSync(full, c);
  return true;
}

function fixTypeB(filePath, lang) {
  const full = path.join(BASE, filePath);
  let c = fs.readFileSync(full, 'utf8');
  if (c.includes('og:image:width')) return false;
  const url = `https://noctalia.app/img/og/noctalia-${lang}-1200x630.jpg`;
  const search = `<meta content="${url}" property="og:image"/>`;
  if (!c.includes(search)) { console.log('WARN:', filePath); return false; }
  c = c.replace(search, search + '\n<meta content="1200" property="og:image:width"/>\n<meta content="630" property="og:image:height"/>');
  fs.writeFileSync(full, c);
  return true;
}

function fixRoot(filePath) {
  const full = path.join(BASE, filePath);
  let c = fs.readFileSync(full, 'utf8');
  if (c.includes('og:image:width')) return false;
  const search = '<meta property="og:image" content="https://noctalia.app/img/og/noctalia-en-1200x630.jpg">';
  if (!c.includes(search)) { console.log('WARN:', filePath); return false; }
  c = c.replace(search, search + '\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">');
  fs.writeFileSync(full, c);
  return true;
}

const typeA = {
  en: ['en/terms.html','en/privacy-policy.html','en/legal-notice.html','en/index.html','en/account-deletion.html','en/about.html','en/guides/dream-symbols-dictionary.html'],
  fr: ['fr/suppression-compte.html','fr/politique-confidentialite.html','fr/mentions-legales.html','fr/index.html','fr/guides/dictionnaire-symboles-reves.html','fr/cgu.html','fr/a-propos.html'],
  es: ['es/terminos.html','es/sobre.html','es/politica-privacidad.html','es/index.html','es/guides/diccionario-simbolos-suenos.html','es/eliminacion-cuenta.html','es/aviso-legal.html'],
  de: ['de/ueber-uns.html','de/konto-loeschen.html','de/index.html','de/impressum.html','de/guides/traumsymbole-lexikon.html','de/datenschutz.html','de/agb.html'],
  it: ['it/termini.html','it/privacy-policy.html','it/note-legali.html','it/index.html','it/guides/dizionario-simboli-sogni.html','it/eliminazione-account.html','it/chi-siamo.html']
};

const typeB = {
  en: ['en/blog/lucid-dreaming.html','en/blog/dream-meanings.html','en/blog/dream-journal.html'],
  fr: ['fr/blog/signification-des-reves.html','fr/blog/reve-lucide.html','fr/blog/journal-de-reves.html'],
  es: ['es/blog/suenos-lucidos.html','es/blog/significado-de-suenos.html','es/blog/diario-de-suenos.html'],
  de: ['de/blog/traumtagebuch-erinnerung-methoden-und-routinen.html','de/blog/traumbedeutungen-interpretation-symbole.html','de/blog/klares-traeumen-anleitungen-und-techniken.html'],
  it: ['it/blog/sogni-lucidi-guide-e-tecniche.html','it/blog/significati-dei-sogni-interpretazione-e-simboli.html','it/blog/dream-journal-richiamo-metodi-e-routine.html']
};

const counts = {en:0,fr:0,es:0,de:0,it:0,root:0};

for (const [lang, files] of Object.entries(typeA)) {
  for (const f of files) {
    if (fixTypeA(f, lang)) { counts[lang]++; console.log('FIXED:', f); }
  }
}

for (const [lang, files] of Object.entries(typeB)) {
  for (const f of files) {
    if (fixTypeB(f, lang)) { counts[lang]++; console.log('FIXED:', f); }
  }
}

if (fixRoot('index.html')) { counts.root = 1; console.log('FIXED: index.html'); }

console.log('\n=== SUMMARY ===');
let total = 0;
for (const lang of ['en','fr','es','de','it']) {
  console.log(`${lang}: ${counts[lang]} files fixed`);
  total += counts[lang];
}
console.log(`root: ${counts.root} file fixed`);
total += counts.root;
console.log(`TOTAL: ${total} files fixed`);
