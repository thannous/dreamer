import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { AI_LANGUAGES } from './aiLanguage.ts';
import { mentionsSelfHarm, SELF_HARM_SUPPORT, selfHarmSupportReply } from './selfHarmSupport.ts';

// The web journey cannot safely demonstrate absence of a backend provider call
// or cover the multilingual detection boundary. Keep that corpus here.
Deno.test('explicit self-harm mentions in all six languages receive support', () => {
  for (const message of [
    'Je pense à l’automutilation.', 'Je veux me faire du mal.', 'Je veux me tuer.',
    'Je ne veux plus vivre.', 'Mon ami parle de suicide.', 'Je ne veux pas me suicider.',
    'Dans mon rêve, je me scarifiais.', 'Des idées SUICIDAIRES', 'auto\u200bmutilation',
    'I have thoughts of self-harm.', 'I hurt myself.', 'I want to kill myself.',
    'I want to end my life.', "I don’t want to live.", 'I wish I were dead.',
    'I dreamed about self injury.', 'She wants to hurt herself.',
    'Tengo ideas de autolesión.', 'Quiero hacerme daño.', 'Quiero morir.', 'No quiero vivir.',
    'Ich denke an Selbstverletzung.', 'Ich will mich umbringen.', 'Ich will nicht mehr leben.',
    'Ich denke an Suizid.', 'Voglio farmi del male.', 'Penso al suicidio.', 'Voglio morire.',
    'Quero me machucar.', 'Penso em automutilação.', 'Não quero viver.', 'Quero tirar minha vida.',
    'Je me coupe volontairement.', 'Je me brûle volontairement.', 'J’ai envie de mourir.',
    'I am cutting myself.', 'I harmed myself.', 'I want to slit my wrists.',
    'Mi taglio per farmi male.', 'Me estoy cortando.', 'Me quiero matar.',
    'Ich verletze mich selbst.', 'Estou me machucando.',
  ]) assertEquals(mentionsSelfHarm(message), true, message);
});

Deno.test('a first person or ambiguous wish to die keeps support next to threats from others', () => {
  for (const message of [
    'Je voulais me tuer.', 'Je vais me tuer.', 'J’ai essayé de me tuer.', 'J’ai envie de me tuer.',
    'Je veux qu’il vienne me tuer.', 'Tu veux te tuer ?', 'Il veut se tuer.', 'Ma mère voulait se tuer.',
    'Un homme voulait me tuer et j’ai envie de mourir.', 'Dans le rêve, je voulais me faire du mal.',
    'Quería matarme.', 'En el sueño quería matarme.', 'Intento matarme.', 'Él quería matarse.',
    'Queria me matar.', 'No sonho eu queria me matar.', 'Ele queria se matar.',
    'Wollte mich umbringen.', 'Im Traum wollte ich mich umbringen.', 'Er sagt, ich soll mich umbringen.',
    'Er will sich umbringen.', 'Volevo uccidermi.', 'Voglio farmi del male.', 'Lui voleva uccidersi.',
    // Imperatives share the third person form: quoted or not, they keep the support.
    'Je lui ai dit : va te tuer.', 'Va te pendre.', 'Va me tuer.', 'Prova a farti del male.', 'Cerca di farti del male.',
    'Tenta te matar.', 'Vai te matar.', 'Intenta hacerte daño.', 'Trata de hacerte daño.',
    // A second person object can be reflexive: "você" with "te", or a quoted imperative.
    'Você quer te matar?', 'Você tentou te machucar?', 'Ele disse: você vai te matar.', 'Il voulait te tuer.',
    'Er will dich umbringen.', 'Lui vuole farti del male.', 'Quiere hacerte daño.',
    // A verb in between can make the harm the speaker's own.
    'Quiere verme hacerme daño.', 'Lui vuole vedermi farmi del male.', 'Il veut me voir me faire du mal.',
  ]) assertEquals(mentionsSelfHarm(message), true, message);
});

Deno.test('another person threatening the dreamer is a nightmare, not self-harm', () => {
  for (const message of [
    'Dans mon rêve, un homme voulait me tuer.', 'Quelqu’un essayait de me tuer, pourquoi ?',
    'Quelqu’un essaie de me tuer.', 'Ils voulaient nous tuer.', 'Il allait me faire du mal.',
    'Le monstre a essayé de me tuer.', 'Mon père veut me tuer dans ce rêve.',
    'Alguien quería matarme en el sueño.', 'Un hombre intentaba hacerme daño.', 'Me persigue y quiere matarme.',
    'Ele queria me matar no sonho.', 'Alguém tentou me machucar.', 'Um homem queria me matar.',
    'Er wollte mich umbringen.', 'Im Traum wollte er mich töten.', 'Jemand will mich verletzen.',
    'Qualcuno voleva uccidermi.', 'Voleva farmi del male.', 'Un uomo cercava di uccidermi.',
    'Il va me tuer.', 'Qualcuno cerca di uccidermi.', 'Alguien intenta matarme.', 'Ele vai me matar.',
    'Il voulait vraiment me tuer.', 'Il cherche à me tuer.', 'Quiere de verdad matarme.', 'Voleva davvero uccidermi.',
  ]) assertEquals(mentionsSelfHarm(message), false, message);
});

Deno.test('ordinary distress and dream imagery do not become a self-harm diagnosis', () => {
  for (const message of [
    'Je suis triste.', 'Est-ce une dépression ?', 'Je rêve de la mort de mon père.',
    'Je coupe mes cheveux.', 'Je me suis fait mal au genou en courant.',
    'I cut my hair myself.', 'I am dead tired.', 'You hurt my feelings.',
    'The theme was rebirth after death.',
    'Je vais scarifier la pelouse.',
  ]) {
    assertEquals(mentionsSelfHarm(message), false, message);
  }
  // The product decision is mention-based, including prevention discussions.
  assertEquals(mentionsSelfHarm('My dream is about a suicide prevention charity.'), true);
});

Deno.test('support is fixed by language and never infers a country from locale', () => {
  for (const language of AI_LANGUAGES) {
    assertEquals(selfHarmSupportReply('self-harm', language), SELF_HARM_SUPPORT[language]);
    assertEquals(selfHarmSupportReply('suicide', language), SELF_HARM_SUPPORT[language]);
    assertEquals(SELF_HARM_SUPPORT[language].includes('[3114](tel:3114)'), true);
    assertEquals(SELF_HARM_SUPPORT[language].includes('[https://3114.fr/](https://3114.fr/)'), true);
    assertEquals(SELF_HARM_SUPPORT[language].includes('oai_link_source'), false);
  }
  assertEquals(selfHarmSupportReply('automutilation', 'fr-CA'), SELF_HARM_SUPPORT.fr);
  assertEquals(selfHarmSupportReply('suicide', 'pt_BR'), SELF_HARM_SUPPORT.pt);
  assertEquals(selfHarmSupportReply('self-harm', '__proto__'), SELF_HARM_SUPPORT.en);
  assertEquals(selfHarmSupportReply('An ordinary dream', 'fr'), null);
});
