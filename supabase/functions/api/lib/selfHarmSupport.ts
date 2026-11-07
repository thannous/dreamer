import type { AiLanguage } from './aiLanguage.ts';

// Deterministic mention detection, not a diagnosis or a risk score. An explicit
// mention in a dream, quotation, negation or about somebody else also gets help.
// Do not infer risk from unrelated sadness, death imagery or a medical question.
const SELF_HARM_MENTIONS = [
  /\b(?:suicid\w*|suizid\w*|selbstmord\w*|selbsttot\w*|selbstverletz\w*|automutil\w*|autolesion\w*|scarifications?)\b/,
  /\bself[\s-]*(?:harm\w*|injur\w*|mutilat\w*)\b/,
  /\b(?:kill|hurt|harm|cut|burn|injure|hang)\s+(?:myself|yourself|himself|herself|themselves|ourselves)\b/,
  /\b(?:killing|hurting|harming|harmed|cutting|burning|burned|burnt|injuring|injured|hanging)\s+(?:myself|yourself|himself|herself|themselves|ourselves)\b/,
  /\b(?:cut|cutting|slit|slitting)\s+(?:my|your|his|her|their|our)\s+wrists?\b/,
  /\b(?:end|take)\s+(?:my|your|his|her|their|our|my own|your own)\s+life\b/,
  /\b(?:want to die|wish i (?:was|were) dead|(?:don t|do not|no longer) want to (?:live|be alive))\b/,
  /\b(?:me|te|se|nous|vous)\s+(?:faire du mal|blesser|scarifier|mutiler|tuer|pendre)\b/,
  /\b(?:me|te|se)\s+(?:scarifi\w*|mutil\w*|(?:coupe\w*|brule\w*|bless\w*)\s+(?:volontairement|expres|intentionnellement)|(?:coupe\w*|taill\w*)\s+les\s+(?:veines|poignets))\b/,
  /\b(?:veux mourir|veut mourir|envie de mourir|(?:veux|veut) (?:plus|pas|pas continuer a) vivre|mettre fin a (?:mes|ses|tes) jours|(?:en )?finir avec (?:ma|sa|ta) vie)\b/,
  /\b(?:me|te|se)\s+(?:corto|corta|cortar|machucar|machuco|ferir|quemo|queimar|mutilar|mutilo|matar)\b/,
  /\b(?:hacerme dano|hacerte dano|hacerse dano|lastimarme|lastimarse|cortarme|cortarse|matarme|matarse|quiero morir|no quiero vivir|quero morrer|nao quero viver|tirar (?:a )?(?:minha|propria) vida)\b/,
  /\b(?:me|te|se)\s+(?:(?:estoy|estas|esta|estou|esta)\s+)?(?:cortando|machucando|ferindo|quero matar|quiero matar)\b/,
  /\b(?:mich|dich|sich)\s+(?:selbst\s+)?(?:verletzen|umbringen|toten|ritzen)\b/,
  /\b(?:verletze|verletzt|ritze|ritzt)\s+(?:mich|dich|sich)(?:\s+selbst)?\b/,
  /\b(?:will sterben|nicht mehr leben|mir das leben nehmen)\b/,
  /\b(?:farmi del male|farti del male|farsi del male|tagliarmi|tagliarsi|uccidermi|uccidersi|voglio morire|non voglio vivere|togliermi la vita)\b/,
  /\b(?:farmi male|farti male|farsi male|mi taglio|mi ferisco)\b/,
] as const;

// "Someone wanted to kill me" is a threat from another person, a common
// nightmare, not self-harm. Outside English the same object pronoun is also the
// reflexive one ("me tuer", "matarme", "mich umbringen"), so a phrase is only
// set aside when its verb or its subject is unambiguously somebody else.
// Ambiguous forms keep the support ("quería matarme", "wollte mich umbringen"),
// and so does a third person harming themselves ("il veut se tuer").
const OTHER_PERSON_THREATS = [
  // fr: il voulait me tuer, quelqu'un essaie de me tuer, ils vont nous faire du mal
  /\b(?:(?:il|elle|on|ils|elles|quelqu un|quelqu une|(?:un|une|le|la|l|mon|ma)\s+(?:homme|femme|type|inconnu|inconnue|monstre|tueur|tueuse|voleur|pere|mere|frere|soeur|ex|patron|loup|chien|demon))\s+(?:essaie|essaye|essaient|essayent|tente|tentent|cherche|cherchent)|voulait|voulaient|veut|veulent|va|vont|allait|allaient|venait|venaient|essayait|essayaient|tentait|tentaient|cherchait|cherchaient|menacait|menacaient|(?:a|ont|avait|avaient) (?:voulu|essaye|tente|cherche|failli|menace))\s+(?:\w+\s+)?(?:de\s+|d\s+)?(?:me|te|nous|vous)\s+(?:faire du mal|blesser|tuer|pendre|mutiler)\b/g,
  // es: quiere matarme, alguien quería matarme, un hombre intentaba hacerme daño
  /\b(?:(?:alguien|el|ella|ellos|ellas|(?:un|una|el|la|mi|su)\s+(?:hombre|mujer|tipo|chico|chica|senor|senora|desconocido|desconocida|extrano|extrana|asesino|asesina|monstruo|ladron|padre|madre|hermano|hermana|novio|novia|ex|jefe|jefa|lobo|perro|demonio))\s+(?:queria|querian|intentaba|intentaban|iba a|iban a|trataba de|trataban de|intento|trato de)|quiere|quieren|quiso|quisieron|intenta|intentan|intentaron|trata de|tratan de|va a|van a)\s+(?:\w+\s+)?(?:matar(?:me|te)|hacer(?:me|te) dano|lastimar(?:me|te)|cortar(?:me|te))\b/g,
  // pt: quer me matar, ele queria me matar, alguém tentou me machucar
  /\b(?:(?:alguem|ele|ela|eles|elas|voce|(?:um|uma|o|a|meu|minha|seu|sua)\s+(?:homem|mulher|cara|rapaz|moca|senhor|senhora|desconhecido|desconhecida|estranho|estranha|assassino|assassina|monstro|ladrao|pai|mae|irmao|irma|namorado|namorada|ex|chefe|lobo|cachorro|demonio))\s+(?:queria|queriam|tentava|tentavam|ia|iam|quis|quiseram)|quer|querem|tenta|tentam|tentou|tentaram|vai|vao)\s+(?:\w+\s+)?(?:me|te)\s+(?:matar|machucar|ferir|cortar|mutilar|queimar)\b/g,
  // de: er wollte mich umbringen, im Traum wollte er mich töten, jemand will mich verletzen
  /\b(?:er|sie|es|jemand|man|einer|der mann|die frau|ein mann|eine frau|ein fremder|eine fremde|der morder|ein morder|ein monster|mein vater|meine mutter|mein bruder|meine schwester|mein ex|meine ex)\s+(?:\w+\s+)?(?:mich|dich)\s+(?:verletzen|umbringen|toten)\b/g,
  // it: voleva uccidermi, qualcuno cercava di farmi del male
  /\b(?:voleva|volevano|vuole|vogliono|cercava|cercavano|cerca|cercano|provava|provavano|prova|provano|tentava|tentavano|tenta|tentano|stava per|stavano per|sta per|stanno per|(?:ha|hanno|aveva|avevano) (?:cercato|provato|tentato|voluto))\s+(?:\w+\s+)?(?:di\s+|a\s+)?(?:uccider(?:mi|ti)|far(?:mi|ti) (?:del )?male|tagliar(?:mi|ti))\b/g,
] as const;

export function mentionsSelfHarm(message: string): boolean {
  const normalized = message.normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '').toLowerCase()
    .replace(/[’'`]/g, ' ').replace(/\s+/g, ' ');
  const withoutThreats = OTHER_PERSON_THREATS.reduce((text, pattern) => text.replace(pattern, ' # '), normalized);
  return SELF_HARM_MENTIONS.some(pattern => pattern.test(withoutThreats));
}

// Verified with the local-hotline directory on 2026-11-06. Locale is not
// location: France is always named explicitly, including in the French copy.
// Plain links: the tracking suffix the directory added could break the tel: link.
const FRANCE_PHONE = '[3114](tel:3114)';
const FRANCE_WEBSITE = '[https://3114.fr/](https://3114.fr/)';

export const SELF_HARM_SUPPORT: Readonly<Record<AiLanguage, string>> = {
  fr: `Ce message évoque l’automutilation ou le suicide. Même si cela concerne un rêve ou une autre personne, je préfère faire une pause dans l’interprétation pour partager des ressources d’aide. Noctalia ne remplace pas une aide humaine ou un service d’urgence.

Si tu risques de te faire du mal maintenant ou si tu es déjà blessé·e, contacte les services d’urgence de ton pays ou rends-toi aux urgences. Si possible, rapproche-toi d’une personne de confiance et éloigne-toi de ce qui pourrait te blesser.

En France, tu peux appeler le ${FRANCE_PHONE}, gratuitement, 24 h/24 et 7 j/7, pour toi ou pour quelqu’un qui t’inquiète. Plus d’informations : ${FRANCE_WEBSITE}. Dans un autre pays, contacte une ligne de crise locale ou un professionnel de santé.`,
  en: `This message mentions self-harm or suicide. Even if it concerns a dream or someone else, I’ll pause the interpretation to share support resources. Noctalia cannot replace human support or emergency care.

If you might hurt yourself now or are already injured, contact your local emergency services or go to an emergency department. If possible, reach out to someone you trust and move away from anything you could use to hurt yourself.

In France, call ${FRANCE_PHONE}, free, 24/7, for yourself or someone you’re worried about. More information: ${FRANCE_WEBSITE}. In another country, contact a local crisis line or a healthcare professional.`,
  es: `Este mensaje menciona autolesiones o suicidio. Aunque se trate de un sueño o de otra persona, voy a pausar la interpretación para compartir recursos de ayuda. Noctalia no sustituye el apoyo humano ni los servicios de urgencias.

Si podrías hacerte daño ahora o ya tienes una lesión, contacta con los servicios de emergencia de tu país o acude a urgencias. Si puedes, busca a alguien de confianza y aléjate de lo que podría hacerte daño.

En Francia, puedes llamar al ${FRANCE_PHONE}, gratis, las 24 horas, todos los días, para ti o para alguien que te preocupa. Más información: ${FRANCE_WEBSITE}. En otro país, contacta con una línea de crisis local o un profesional de la salud.`,
  de: `Diese Nachricht erwähnt Selbstverletzung oder Suizid. Auch wenn es um einen Traum oder eine andere Person geht, pausiere ich die Deutung, um Hilfsangebote zu nennen. Noctalia ersetzt weder menschliche Unterstützung noch medizinische Notfallhilfe.

Wenn du dir jetzt etwas antun könntest oder bereits verletzt bist, wende dich an den örtlichen Rettungsdienst oder eine Notaufnahme. Suche nach Möglichkeit eine vertraute Person auf und entferne dich von Dingen, mit denen du dich verletzen könntest.

In Frankreich erreichst du die ${FRANCE_PHONE} kostenlos rund um die Uhr, für dich oder jemanden, um den du dir Sorgen machst. Weitere Informationen: ${FRANCE_WEBSITE}. In einem anderen Land wende dich an einen örtlichen Krisendienst oder medizinisches Fachpersonal.`,
  it: `Questo messaggio menziona autolesionismo o suicidio. Anche se riguarda un sogno o un’altra persona, metto in pausa l’interpretazione per condividere risorse di aiuto. Noctalia non sostituisce il sostegno umano o i servizi di emergenza.

Se rischi di farti del male adesso o hai già una ferita, contatta i servizi di emergenza del tuo paese o vai al pronto soccorso. Se puoi, cerca una persona fidata e allontanati da ciò che potrebbe farti male.

In Francia puoi chiamare il ${FRANCE_PHONE}, gratis, 24 ore su 24, tutti i giorni, per te o per qualcuno che ti preoccupa. Altre informazioni: ${FRANCE_WEBSITE}. In un altro paese, contatta una linea di crisi locale o un professionista sanitario.`,
  pt: `Esta mensagem menciona automutilação ou suicídio. Mesmo que seja sobre um sonho ou outra pessoa, vou pausar a interpretação para compartilhar recursos de apoio. O Noctalia não substitui o apoio humano nem os serviços de emergência.

Se você pode se machucar agora ou já está ferido, procure o serviço de emergência do seu país ou vá a um pronto-socorro. Se possível, procure alguém de confiança e afaste-se do que poderia machucar você.

Na França, ligue para ${FRANCE_PHONE}, gratuitamente, 24 horas por dia, todos os dias, para você ou alguém com quem se preocupa. Mais informações: ${FRANCE_WEBSITE}. Em outro país, procure uma linha de apoio em crise local ou um profissional de saúde.`,
};

export function selfHarmSupportReply(message: string, language: string): string | null {
  if (!mentionsSelfHarm(message)) return null;
  const base = language.toLowerCase().split(/[-_]/)[0];
  return Object.hasOwn(SELF_HARM_SUPPORT, base)
    ? SELF_HARM_SUPPORT[base as AiLanguage]
    : SELF_HARM_SUPPORT.en;
}
