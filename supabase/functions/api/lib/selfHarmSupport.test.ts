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
    assertEquals(SELF_HARM_SUPPORT[language].includes('tel:3114?oai_link_source=model_response_hotline'), true);
    assertEquals(SELF_HARM_SUPPORT[language].includes('https://3114.fr/?oai_link_source=model_response_hotline'), true);
  }
  assertEquals(selfHarmSupportReply('automutilation', 'fr-CA'), SELF_HARM_SUPPORT.fr);
  assertEquals(selfHarmSupportReply('suicide', 'pt_BR'), SELF_HARM_SUPPORT.pt);
  assertEquals(selfHarmSupportReply('self-harm', '__proto__'), SELF_HARM_SUPPORT.en);
  assertEquals(selfHarmSupportReply('An ordinary dream', 'fr'), null);
});
