/** A staged example inside the scroll scene, never a modal or a live AI request. */
export function createDreamAnalysisDemo(pin, cards) {
  const lang = document.documentElement.lang.slice(0, 2);
  const strings = {
    en: ['Example analysis', 'Exploring this dream…', 'A possible reading', 'A question to explore', 'What in your life feels connected to this scene?'],
    fr: ['Exemple d’analyse', 'Exploration de ce rêve…', 'Une lecture possible', 'Une question à explorer', 'Qu’est-ce qui, dans ta vie, fait écho à cette scène ?'],
    de: ['Beispielanalyse', 'Diesen Traum erkunden…', 'Eine mögliche Deutung', 'Eine Frage zum Nachdenken', 'Was in deinem Leben erinnert dich an diese Szene?'],
    es: ['Ejemplo de análisis', 'Explorando este sueño…', 'Una posible lectura', 'Una pregunta para explorar', '¿Qué parte de tu vida te recuerda a esta escena?'],
    it: ['Esempio di analisi', 'Esplorazione del sogno…', 'Una possibile lettura', 'Una domanda da esplorare', 'Che cosa nella tua vita ti ricorda questa scena?'],
    pt: ['Exemplo de análise', 'Explorando este sonho…', 'Uma leitura possível', 'Uma pergunta para explorar', 'O que na sua vida se conecta a esta cena?'],
  };
  const readings = {
    en: [
      'A familiar house with an unknown staircase could evoke discovering something new in yourself. The closed door invites curiosity: what feels close, but not yet accessible?',
      'Flying effortlessly above the harbour could evoke freedom or a change of perspective. The joy in this account may be a useful starting point for your own associations.',
      'The shift from falling to floating could suggest a change in how uncertainty feels. Does letting go bring relief anywhere in your life right now?',
    ],
    fr: [
      'Une maison familière avec un escalier inconnu peut évoquer une part de toi à découvrir. La porte fermée invite à la curiosité : qu’est-ce qui semble proche, mais encore inaccessible ?',
      'Survoler le port sans effort peut évoquer la liberté ou un changement de perspective. La joie de ce récit peut être un point de départ pour tes propres associations.',
      'Le passage de la chute au flottement peut évoquer un autre rapport à l’incertitude. Y a-t-il un endroit dans ta vie où lâcher prise apporte du soulagement ?',
    ],
    de: ['Das vertraute Haus mit einer unbekannten Treppe könnte eine neue Seite an dir darstellen. Was fühlt sich nah, aber noch unerreichbar an?', 'Der mühelose Flug könnte Freiheit oder einen Perspektivwechsel ausdrücken. Welche eigenen Erinnerungen verbindest du mit dieser Freude?', 'Der Wechsel vom Fallen zum Schweben könnte einen anderen Umgang mit Unsicherheit ausdrücken. Wo könnte Loslassen erleichternd sein?'],
    es: ['La casa familiar con una escalera desconocida podría evocar algo nuevo en ti. ¿Qué parece cercano, pero todavía inaccesible?', 'Volar sin esfuerzo podría evocar libertad o un cambio de perspectiva. ¿Con qué asocias la alegría de este relato?', 'Pasar de caer a flotar podría evocar una relación distinta con la incertidumbre. ¿Dónde podría aliviarte soltar el control?'],
    it: ['La casa familiare con una scala sconosciuta potrebbe evocare un nuovo lato di te. Che cosa sembra vicino, ma ancora inaccessibile?', 'Volare senza sforzo potrebbe evocare libertà o un cambio di prospettiva. A che cosa associ la gioia di questo racconto?', 'Il passaggio dalla caduta al galleggiamento potrebbe evocare un diverso rapporto con l’incertezza. Dove potresti trovare sollievo lasciando andare?'],
    pt: ['A casa familiar com uma escada desconhecida pode evocar algo novo em você. O que parece próximo, mas ainda inacessível?', 'Voar sem esforço pode evocar liberdade ou uma mudança de perspectiva. A que você associa a alegria deste relato?', 'A passagem da queda à flutuação pode evocar outra relação com a incerteza. Onde abrir mão do controle poderia trazer alívio?'],
  };
  const labels = strings[lang] || strings.en;
  const candidates = [0, 1, 8].map((index, reading) => ({ card: cards.querySelectorAll('.oh-dream')[index], reading })).filter(item => item.card);
  if (!candidates.length) return { update() {}, destroy() {} };
  // Select once per visit; reversing the scroll retains the same account.
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  const root = document.createElement('article');
  root.className = 'oh-analysis-demo';
  root.hidden = true;
  root.innerHTML = '<div class="oh-analysis-account"><img alt=""><div><h3></h3><p class="oh-analysis-excerpt"></p></div></div><div class="oh-analysis-body"><p class="oh-analysis-label"></p><p class="oh-analysis-status"></p><div class="oh-analysis-insight"><h4></h4><p></p></div><div class="oh-analysis-question"><h4></h4><p></p></div></div>';
  root.querySelector('img').src = selected.card.querySelector('.oh-dream-img').src;
  root.querySelector('h3').textContent = selected.card.querySelector('.oh-dream-title').textContent;
  root.querySelector('.oh-analysis-excerpt').textContent = selected.card.querySelector('.oh-dream-excerpt').textContent;
  root.querySelector('.oh-analysis-label').textContent = labels[0];
  const status = root.querySelector('.oh-analysis-status');
  status.textContent = labels[1];
  const insight = root.querySelector('.oh-analysis-insight');
  insight.querySelector('h4').textContent = labels[2];
  const question = root.querySelector('.oh-analysis-question');
  question.querySelector('h4').textContent = labels[3];
  question.querySelector('p').textContent = labels[4];
  const words = (readings[lang] || readings.en)[selected.reading].split(/(\s+)/).map(word => {
    const span = document.createElement('span'); span.textContent = word;
    insight.querySelector('p').append(span); return span;
  });
  pin.append(root);
  const clamp = x => Math.min(1, Math.max(0, x));
  let origin = null;
  return {
    update(p) {
      const visible = p > 0.18 && p < 0.56;
      if (!visible) { root.hidden = true; origin = null; return; }
      root.hidden = false;
      if (!origin) {
        root.style.transform = 'none';
        const source = selected.card.getBoundingClientRect();
        const destination = root.getBoundingClientRect();
        origin = {
          x: source.left + source.width / 2 - destination.left - destination.width / 2,
          y: source.top + source.height / 2 - destination.top - destination.height / 2,
          scale: Math.max(0.3, Math.min(0.85, source.width / Math.max(1, destination.width))),
        };
      }
      const enter = clamp((p - 0.18) / 0.055);
      const exit = clamp((p - 0.48) / 0.08);
      // Offset coordinates remain stable through this entry, avoiding a moving target.
      root.style.transform = `translate3d(${origin.x * (1 - enter)}px, ${origin.y * (1 - enter)}px, 0) scale(${origin.scale + enter * (1 - origin.scale)})`;
      root.style.opacity = String(enter * (1 - exit));
      const written = clamp((p - 0.25) / 0.16);
      status.hidden = written > 0;
      insight.style.opacity = written > 0 ? '1' : '0';
      words.forEach((word, i) => { word.style.opacity = i / words.length < written ? '1' : '0'; });
      insight.setAttribute('aria-hidden', String(written === 0));
      question.style.opacity = String(clamp((p - 0.41) / 0.04));
      question.setAttribute('aria-hidden', String(p < 0.41));
    },
    destroy() { root.remove(); },
  };
}
