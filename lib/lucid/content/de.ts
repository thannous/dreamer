import type { LucidTrainerContent } from './types';

const content = {
  locale: 'de',
  chrome: {
    appName: 'Noctalia Lucid Trainer',
    tagline: 'Trainiere deine Aufmerksamkeit und schütze dabei deinen Schlaf.',
    tabs: { today: 'Heute', programs: 'Programme', night: 'Nacht', progress: 'Fortschritt', settings: 'Einstellungen' },
    common: {
      continue: 'Weiter', back: 'Zurück', save: 'Speichern', cancel: 'Abbrechen', done: 'Fertig', retry: 'Erneut versuchen', skipTonight: 'Heute Nacht auslassen', optional: 'Optional', offlineReady: 'Offline verfügbar', loading: 'Dein Training wird geladen…', error: 'Dieser Inhalt konnte nicht geladen werden. Dein gespeichertes Training bleibt auf diesem Gerät.',
    },
  },
  onboarding: {
    title: 'Entwickle eine Klartraumpraxis, die zu deinem Schlaf passt',
    intro: 'Lucid Trainer fördert Aufmerksamkeit am Tag, Vorbereitung vor dem Schlafen und Reflexion am Morgen. Ein Klartraum kann auftreten oder ausbleiben – das Üben selbst ist das Ziel.',
    wellbeingNotice: 'Dies ist ein Werkzeug für Wohlbefinden und Selbstbeobachtung, keine medizinische Versorgung. Schütze zuerst deinen Schlaf und beende jede Übung, die dich belastet oder ungewöhnlich müde macht.',
    goalTitle: 'Was möchtest du üben?',
    goals: [
      { id: 'first_lucid_dream', title: 'Mehr wahrnehmen', description: 'Entwickle bewusste Aufmerksamkeit und erkenne ungewöhnliche Einzelheiten auf dem Weg zu einer ersten klaren Erfahrung.' },
      { id: 'improve_recall', title: 'Träume erinnern', description: 'Festige zuerst die Morgenroutine, bevor du Nachttechniken ergänzt.' },
      { id: 'more_frequent_lucidity', title: 'Klarheit häufiger erkunden', description: 'Übe forschungsbasierte Methoden, ohne ein festes Ergebnis zu erwarten.' },
      { id: 'stabilize_lucidity', title: 'Ruhiger klar bleiben', description: 'Übe eine ruhige Reaktion nach dem Erkennen eines Traums, ohne längere Erfahrungen zu versprechen.' },
    ],
    experienceTitle: 'Welche Erfahrung hast du?',
    experienceLevels: [
      { id: 'beginner', title: 'Neu', description: 'Ich habe noch keine strukturierte Klartraumpraxis verfolgt.' },
      { id: 'occasional', title: 'Gelegentlich', description: 'Ich habe einzelne Übungen ausprobiert oder vereinzelte Klarträume erlebt.' },
      { id: 'experienced', title: 'Regelmäßig', description: 'Ich halte Träume bereits fest und möchte eine beständigere Routine.' },
    ],
    reminderTitle: 'Wähle einen realistischen Rhythmus',
    reminderExplanation: 'Beginne mit wenigen sinnvollen Erinnerungen. Mehr Hinweise machen einen Realitätscheck nicht aufmerksamer.',
    sleepScheduleTitle: 'Lege dein übliches Schlaffenster fest',
    sleepScheduleExplanation: 'Schlafens- und Aufstehzeit halten Vorbereitung und optionale Nachtsignale in dem von dir gewählten Zeitraum. Du kannst sie jederzeit ändern oder pausieren.',
    permissionsTitle: 'Berechtigungen nur bei Bedarf',
    notificationPermission: 'Benachrichtigungen werden erst angefragt, nachdem du eine Erinnerung erstellt hast. Bei Ablehnung bleibt das Training mit manuellen Hinweisen nutzbar.',
    audioPermission: 'Nacht-Audio ist zunächst ausgeschaltet. Höre es dir im Wachzustand an, stelle eine leise Lautstärke und einen Timer ein und entscheide dann über die Aktivierung. Das Mikrofon wird nicht benötigt.',
    accessibilityTitle: 'Passe die Nutzung an',
    accessibilityBody: 'Systemschriftgröße, Screenreader, reduzierte Bewegungen sowie helles und dunkles Design werden unterstützt. Wesentliche Schritte beruhen nie allein auf Farbe oder Animation.',
    consentTitle: 'Du behältst die Kontrolle',
    consentItems: [
      'Das Training funktioniert offline und ohne Konto.',
      'Produktanalysen sind sparsam und optional.',
      'Noctalia zu verbinden und eine kurze Morgenzusammenfassung zu übertragen sind getrennte, widerrufbare Entscheidungen.',
      'Du kannst deine Trainingsdaten in den Einstellungen exportieren oder löschen.',
    ],
    finishAction: 'Meinen Trainingsplan erstellen',
  },
  programs: {
    mild: {
      id: 'mild', title: 'MILD', expandedName: 'Mnemonische Induktion von Klarträumen',
      summary: 'Übe die klare Absicht, einen zukünftigen Traum zu erkennen, anhand einer erinnerten Szene und eines persönlichen Traumzeichens.',
      evidenceNote: 'MILD gehört zu den besser untersuchten kognitiven Methoden, doch Studienqualität und individuelle Ergebnisse unterscheiden sich.',
      evidenceReferenceIds: ['ildis-2020', 'tan-fan-2023', 'stumbrys-2012'],
      prerequisites: ['Sorge für eine gleichbleibende Schlafmöglichkeit.', 'Halte einen aktuellen Traum oder eine vorgestellte Szene für die mentale Probe bereit.', 'Sei bereit, morgens ein kurzes Ergebnis festzuhalten, auch wenn du dich an keinen Traum erinnerst.'],
      stopRules: ['Pausiere Nachtübungen nach schlechtem Schlaf oder deutlicher Tagesmüdigkeit.', 'Kehre zu Übungen vor dem Einschlafen zurück, wenn du nach einem Erwachen schwer wieder einschläfst.', 'Beende die Übungen und suche passende Unterstützung, wenn sie dich belasten oder Traum- und Wacherlebnisse verschwimmen lassen.'],
      sessions: [
        {
          id: 'mild-01', session: 1, title: 'Eine klare Absicht formulieren', objective: 'Verstehe MILD und wähle eine kurze, glaubhafte Absicht.', durationMinutes: 10,
          steps: ['Lies die Zusammenfassung der Methode einmal.', 'Schreibe: „Wenn ich träume, nehme ich mir vor, es zu bemerken.“', 'Sprich die Absicht dreimal langsam und konzentriere dich auf das Erinnern statt darauf, ein Ergebnis zu erzwingen.'], caution: 'Übe heute im Wachzustand; verkürze deinen Schlaf nicht, um die Einheit abzuschließen.', reflectionPrompt: 'Welche Worte ließen die Absicht klar und ruhig wirken?',
        },
        {
          id: 'mild-02', session: 2, title: 'Ein Traumzeichen finden', objective: 'Erkenne ein wiederkehrendes oder ungewöhnliches Detail als möglichen Aufmerksamkeitshinweis.', durationMinutes: 12,
          steps: ['Sieh dir einen aktuellen Traum an oder nutze eine neutrale vorgestellte Szene.', 'Wähle einen ungewöhnlichen Ort, Vorgang, Menschen oder eine Empfindung.', 'Stelle dir vor, das Zeichen zu bemerken und innezuhalten: Träume ich?'], caution: 'Wähle eine neutrale Szene, wenn eine Traumerinnerung unangenehm ist.', reflectionPrompt: 'Welches Zeichen könntest du ohne Anstrengung am ehesten erkennen?',
        },
        {
          id: 'mild-03', session: 3, title: 'Prospektives Gedächtnis trainieren', objective: 'Übe, dich beim Auftreten eines späteren Hinweises an eine Absicht zu erinnern.', durationMinutes: 8,
          steps: ['Wähle für heute drei alltägliche Hinweise, etwa das Öffnen einer Tür.', 'Halte bei jedem Hinweis kurz inne und erinnere dich an deine Klartraumabsicht, bevor du die App ansiehst.', 'Markiere den bemerkten Hinweis; ausgelassene Hinweise sind nützliche Beobachtungen, keine Fehlschläge.'], caution: 'Nutze Hinweise nur in sicheren Momenten, nie beim Fahren oder Bedienen von Geräten.', reflectionPrompt: 'Welcher Kontext half dir, dich ohne Benachrichtigung zu erinnern?',
        },
        {
          id: 'mild-04', session: 4, title: 'Den Erkennungsmoment proben', objective: 'Verbinde Absicht, Traumzeichen und eine ruhige Reaktion.', durationMinutes: 12,
          steps: ['Erinnere dich von Anfang an an deine gewählte Szene.', 'Stelle dir beim Traumzeichen vor, dass du bemerkst: „Das ist ein Traum.“', 'Sieh dich in der Vorstellung ruhig um und wiederhole dann einmal deine Absicht.'], caution: 'Halte die Probe kurz und höre auf, wenn die Vorstellung vor dem Schlafengehen aktivierend wirkt.', reflectionPrompt: 'Welche ruhige Handlung würde dir helfen, dich in der vorgestellten Szene zu orientieren?',
        },
        {
          id: 'mild-05', session: 5, title: 'MILD vor dem Einschlafen anwenden', objective: 'Führe vor deinem normalen Schlaf eine möglichst wenig störende MILD-Sequenz durch.', durationMinutes: 10,
          steps: ['Bereite deinen Morgen-Check-in vor, bevor du ins Bett gehst.', 'Erinnere die Szene, bemerke das Zeichen und wiederhole deine Absicht.', 'Lass die Übung los und den Schlaf normal kommen.'], caution: 'Wenn die Wiederholung dich wach hält, beende sie und kehre zu deiner üblichen Abendroutine zurück.', reflectionPrompt: 'Wirkte die Sequenz beruhigend, neutral oder aktivierend?',
        },
        {
          id: 'mild-06', session: 6, title: 'Optionale Übung nach natürlichem Erwachen', objective: 'Probiere MILD nach spontanem Erwachen, ohne Schlafverlust einzuplanen.', durationMinutes: 6,
          steps: ['Nutze nur ein natürliches Erwachen, wenn noch genügend Schlafzeit bleibt.', 'Erinnere das eben geträumte Fragment oder verwende deine geübte Szene.', 'Setze die Absicht ein- oder zweimal und priorisiere dann das Wiedereinschlafen.'], caution: 'Lass diese Einheit nach zu wenig Schlaf oder bei häufigen Einschlafproblemen nach dem Erwachen aus.', reflectionPrompt: 'Wie schnell bist du nach dem Ende der Übung wieder zur Ruhe gekommen?',
        },
        {
          id: 'mild-07', session: 7, title: 'Auswerten und anpassen', objective: 'Wähle anhand deiner Beobachtungen einen nachhaltigen MILD-Rhythmus.', durationMinutes: 15,
          steps: ['Vergleiche Traumerinnerung, Schlafqualität und Klarheitsnotizen der Woche.', 'Behalte die kürzeste Variante, die deinen Schlaf nicht gestört hat.', 'Plane zwei oder drei Übungsnächte und lasse nach anspruchsvollen Versuchen Erholungsnächte frei.'], caution: 'Erhöhe die Häufigkeit nicht, um eine Woche ohne Klartraum auszugleichen.', reflectionPrompt: 'Welcher Teil lohnt sich auch dann, wenn kein Klartraum auftritt?',
        },
      ],
    },
    ssild: {
      id: 'ssild', title: 'SSILD', expandedName: 'Durch Sinneswahrnehmung eingeleiteter Klartraum',
      summary: 'Lenke entspannte Aufmerksamkeit nacheinander auf Sehen, Hören und Körperempfindungen, ohne ein Erlebnis erzeugen zu wollen.',
      evidenceNote: 'SSILD zeigt vielversprechende Ergebnisse aus Feldstudien, wurde aber seltener unabhängig repliziert als MILD.',
      evidenceReferenceIds: ['ildis-2020', 'tan-fan-2023'],
      prerequisites: ['Beobachte Empfindungen möglichst ohne Bewertung.', 'Wisse, wie du aufhörst und zur normalen Ruhe zurückkehrst, wenn Aufmerksamkeit anstrengend wird.', 'Halte alle wesentlichen Anweisungen vor dem Schlafengehen offline bereit.'],
      stopRules: ['Beende die Zyklen, wenn sie Wachheit oder Unbehagen verstärken.', 'Lass Übungen nach dem Erwachen aus, wenn die Schlafzeit begrenzt ist.', 'Wähle stattdessen tagsüber eine orientierende Übung, wenn innere Empfindungen beunruhigen.'],
      sessions: [
        {
          id: 'ssild-01', session: 1, title: 'Beobachten, ohne etwas zu erzeugen', objective: 'Lerne passive Aufmerksamkeit für jeweils einen Sinn.', durationMinutes: 9,
          steps: ['Setze dich tagsüber bequem hin.', 'Nimm eine Minute lang visuelle Dunkelheit oder Umgebungslicht wahr.', 'Achte dann auf Geräusche, Kontakt und Temperatur und lass jede Wahrnehmung alltäglich sein.'], caution: 'Lass die Augen offen, wenn das Schließen unangenehm oder desorientierend ist.', reflectionPrompt: 'Welcher Sinn ließ sich am leichtesten ohne Anstrengung beobachten?',
        },
        {
          id: 'ssild-02', session: 2, title: 'Schnelle Zyklen lernen', objective: 'Wechsle leicht zwischen Sehen, Hören und Körper.', durationMinutes: 8,
          steps: ['Gib dem Sehen einige entspannte Sekunden.', 'Wechsle für ein paar Sekunden zu Geräuschen.', 'Wechsle zu Körperempfindungen und wiederhole vier Zyklen, ohne genau zu zählen.'], caution: 'Halte nicht die Luft an, strenge die Augen nicht an und suche nicht nach ungewöhnlichen Empfindungen.', reflectionPrompt: 'Konntest du die Aufmerksamkeit verschieben, ohne nach etwas Besonderem zu suchen?',
        },
        {
          id: 'ssild-03', session: 3, title: 'Langsame Zyklen lernen', objective: 'Halte sanfte Aufmerksamkeit über alle drei Sinne.', durationMinutes: 12,
          steps: ['Lass deine Aufmerksamkeit etwa zwanzig Sekunden beim Sehen ruhen.', 'Wechsle für ähnlich lockere Zeiträume zum Hören und dann zu Körperempfindungen.', 'Schließe vier langsame Zyklen ab und höre auf, bevor Konzentration zur Arbeit wird.'], caution: 'Schätze die Zeit nur ungefähr; häufiges Uhrenschauen kann die Übung aktivierender machen.', reflectionPrompt: 'Wann wurde die entspannte Beobachtung anstrengend?',
        },
        {
          id: 'ssild-04', session: 4, title: 'Die vollständige Abfolge aufbauen', objective: 'Verbinde schnelle und langsame Zyklen zu einer vertrauten Routine.', durationMinutes: 14,
          steps: ['Führe vier schnelle Zyklen durch.', 'Führe vier langsame Zyklen durch.', 'Beende die Abfolge mit einem normalen Atemzug und erweitere die Aufmerksamkeit auf den ganzen Körper.'], caution: 'Dies ist eine Probe im Wachzustand; ändere deinen normalen Schlafplan nicht.', reflectionPrompt: 'Welcher einfache Hinweis erinnert dich daran, passiv zu bleiben?',
        },
        {
          id: 'ssild-05', session: 5, title: 'Eine Variante beim Einschlafen testen', objective: 'Nutze eine verkürzte Abfolge, ohne den Schlaf hinauszuzögern.', durationMinutes: 8,
          steps: ['Lege dich in deine übliche Schlafposition.', 'Führe zwei schnelle und zwei langsame Zyklen durch.', 'Beende die Übung bewusst und lass den Schlaf zu, auch wenn die Abfolge unvollständig wirkt.'], caution: 'Wenn die Abfolge das Einschlafen verzögert, übe sie nur noch tagsüber.', reflectionPrompt: 'Hat die kurze Variante deine Abendruhe geschützt?',
        },
        {
          id: 'ssild-06', session: 6, title: 'Optionale Abfolge nach dem Erwachen', objective: 'Probiere die vollständige Abfolge nach natürlichem Erwachen unter passenden Bedingungen.', durationMinutes: 10,
          steps: ['Prüfe, ob genug Schlafzeit bleibt und du dich ruhig fühlst.', 'Führe vier schnelle und anschließend vier bis sechs langsame Zyklen durch.', 'Beende die Übung und schlafe weiter, ohne sie auszuwerten.'], caution: 'Lass sie nach schlechtem Schlaf, bei Krankheit oder vor einem Tag mit höchstem Aufmerksamkeitsbedarf aus.', reflectionPrompt: 'Konntest du bequem wieder einschlafen?',
        },
        {
          id: 'ssild-07', session: 7, title: 'Ein nachhaltiges Maß wählen', objective: 'Passe SSILD anhand von Schlaf- und Erfahrungsnotizen an, nicht aus Ergebnisdruck.', durationMinutes: 15,
          steps: ['Prüfe Abschluss, Schlafqualität, Erinnerung und Klarheit.', 'Wähle Übung am Tag, beim Einschlafen oder gelegentlich nach dem Erwachen.', 'Plane Erholungsnächte und behalte die am wenigsten störende Variante, die sich passend anfühlt.'], caution: 'Eine neutrale Woche ist ein gültiges Ergebnis; ergänze nicht automatisch Zyklen oder Erwachen.', reflectionPrompt: 'Welche Variante war ruhig genug, um sie zu wiederholen?',
        },
      ],
    },
    wbtb: {
      id: 'wbtb', title: 'WBTB', expandedName: 'Aufwachen und zurück ins Bett',
      summary: 'Nutze ein geplantes oder natürliches spätes Erwachen, eine kurze ruhige Wachphase und das Wiedereinschlafen mit einer gewählten kognitiven Technik.',
      evidenceNote: 'WBTB wird häufig mit MILD oder SSILD verbunden. Weil es den Schlaf unterbricht, sollte es gelegentlich bleiben und den Schlafbedürfnissen untergeordnet sein.',
      evidenceReferenceIds: ['ildis-2020', 'tan-fan-2023', 'aasm-srs-2015'],
      prerequisites: ['Plane genug Zeit für deine normale Schlafmöglichkeit und das kurze Erwachen ein.', 'Wähle einen Morgen ohne frühe sicherheitskritische Aufgaben.', 'Lege vor dem Stellen eines Weckers fest, welche ruhige Technik du nutzt.'],
      stopRules: ['Sage den Versuch bei Schlafmangel, Krankheit, ungewöhnlicher Müdigkeit oder wiederholtem Erwachen ab.', 'Beende die Wachphase früh, wenn du zu wach wirst.', 'Pausiere WBTB, wenn Schlafqualität oder Funktionsfähigkeit am Tag nachlassen.'],
      sessions: [
        {
          id: 'wbtb-01', session: 1, title: 'Bereitschaft prüfen', objective: 'Entscheide schon vor der Weckerplanung, wann WBTB ausgelassen werden sollte.', durationMinutes: 10,
          steps: ['Prüfe deine jüngste Schlafmöglichkeit und Aufmerksamkeit am Tag.', 'Liste Pflichten und Sicherheitsanforderungen des nächsten Morgens auf.', 'Schreibe eine klare Absageregel für heute Nacht.'], caution: 'Diese Einheit enthält kein nächtliches Erwachen; versuche WBTB nicht bei bestehendem Schlafdefizit.', reflectionPrompt: 'Welches Zeichen macht das Auslassen zur verantwortungsvollen Wahl?',
        },
        {
          id: 'wbtb-02', session: 2, title: 'Ein ruhiges Erwachen planen', objective: 'Bereite einen optionalen Wecker mit möglichst geringer Störung vor.', durationMinutes: 10,
          steps: ['Wähle eine gelegentliche Nacht mit genügend Bettzeit.', 'Wähle einen sanften Wecker und eine einfache Möglichkeit, ihn auszuschalten.', 'Bereite gedämpftes Licht und Offline-Anweisungen vor dem Schlafen vor.'], caution: 'Schlafe nicht mit Kopf- oder Ohrhörern und nutze keine Lautstärke, die dich oder andere erschrecken könnte.', reflectionPrompt: 'Lässt sich die Einrichtung abbrechen, ohne Trainingsfortschritt zu verlieren?',
        },
        {
          id: 'wbtb-03', session: 3, title: 'Die Wachphase tagsüber proben', objective: 'Lerne eine kurze, reizarme Abfolge, bevor du sie nachts nutzt.', durationMinutes: 12,
          steps: ['Übe, langsam aufzustehen und gedämpftes Licht zu verwenden.', 'Lies eine kurze Technikkarte, ohne andere Apps zu öffnen.', 'Kehre ins Bett zurück und atme zwei Minuten ruhig.'], caution: 'Diese Probe am Tag ersetzt heute einen Nachtversuch.', reflectionPrompt: 'Welcher Teil könnte nachts unnötig aktivieren?',
        },
        {
          id: 'wbtb-04', session: 4, title: 'Die Begleittechnik wählen', objective: 'Verbinde WBTB mit einer vertrauten Methode, statt zu improvisieren.', durationMinutes: 10,
          steps: ['Wähle die bereits geübte MILD-Absicht oder SSILD-Abfolge.', 'Lege nur diese Anweisung ans Bett.', 'Setze eine maximale Wachzeit und einen Abbruchpunkt fest.'], caution: 'Kombiniere nicht mehrere Methoden und verlängere das Wachsein nicht auf der Suche nach einem Ergebnis.', reflectionPrompt: 'Welche einzelne Technik lässt sich am leichtesten ruhig ausführen?',
        },
        {
          id: 'wbtb-05', session: 5, title: 'Optionale erste Nacht', objective: 'Führe einen vorsichtigen WBTB-Versuch mit Schutz des Schlafs durch.', durationMinutes: 15,
          steps: ['Bewerte beim Erwachen deine Müdigkeit neu und sage ab, wenn sich die Bedingungen geändert haben.', 'Bleibe nur für die geplante kurze Zeit bei gedämpftem Licht wach.', 'Führe die gewählte Technik aus, kehre ins Bett zurück und lass das Ziel los.'], caution: 'Höre sofort auf, wenn du dich unwohl oder zu wach fühlst, und kehre möglichst zur Ruhe zurück.', reflectionPrompt: 'Wie störend war die gesamte Abfolge, unabhängig vom Traumergebnis?',
        },
        {
          id: 'wbtb-06', session: 6, title: 'Den folgenden Tag schützen', objective: 'Nutze deine Tagesform als Sicherheitssignal für spätere Versuche.', durationMinutes: 8,
          steps: ['Bewerte Schlafqualität und Aufmerksamkeit ehrlich.', 'Führe heute Nacht keinen weiteren WBTB-Versuch durch.', 'Vermeide bei Schläfrigkeit das Fahren und gefährliche Tätigkeiten und befolge deinen üblichen Sicherheitsplan.'], caution: 'Trainingsdaten haben nie Vorrang vor unmittelbarer Sicherheit oder notwendiger Erholung.', reflectionPrompt: 'Hat der Versuch Konzentration, Stimmung oder Energie beeinflusst?',
        },
        {
          id: 'wbtb-07', session: 7, title: 'Einen gelegentlichen Rhythmus festlegen', objective: 'Entscheide, ob WBTB überhaupt in deinen Plan gehört.', durationMinutes: 15,
          steps: ['Vergleiche Schlaf, Wiedereinschlafzeit, Erinnerung und Klarheit.', 'Behalte WBTB nur bei geringer Störung.', 'Wähle eine vorsichtige Höchstfrequenz mit Erholungsnächten oder deaktiviere es.'], caution: 'Plane WBTB nicht als tägliche Pflicht; es zu deaktivieren ist ebenfalls ein vollständiger Plan.', reflectionPrompt: 'Rechtfertigt der mögliche Nutzen für dich die Schlafunterbrechung?',
        },
      ],
    },
  },
  realityChecks: {
    title: 'Aufmerksame Realitätschecks',
    intro: 'Ein sinnvoller Check unterbricht kurz den Autopiloten: Nimm den Kontext wahr, prüfe ein stabiles Detail und stelle dir vor, dieselbe Abweichung im Traum zu erkennen.',
    qualityPrinciples: ['Halte vor dem Handeln kurz inne.', 'Stelle die Frage mit echter Offenheit.', 'Nutze zwei Hinweise statt nur Gewohnheit.', 'Beende den Check mit einer ruhigen Absicht für den nächsten Traum.'],
    exercises: [
      { id: 'text', title: 'Zweimal lesen', description: 'Lies eine kurze Zeile, sieh weg und lies sie erneut, um ihre Beständigkeit zu prüfen.' },
      { id: 'time', title: 'Zeit zweimal prüfen', description: 'Sieh auf die Uhr, blicke weg und vergleiche dann ohne Eile.' },
      { id: 'hands', title: 'Hände betrachten', description: 'Zähle die Finger und beachte Form, Struktur und Kontinuität, ohne eine Auffälligkeit erzwingen zu wollen.' },
      { id: 'context', title: 'Kontext zurückverfolgen', description: 'Frage dich, wie du hierhergekommen bist, und nenne die letzten zwei Ereignisse, an die du dich erinnerst.' },
    ],
    contextTitle: 'Verbinde Checks mit bedeutsamen Situationen',
    contextExamples: ['Nachdem dir etwas Überraschendes auffällt', 'Beim Betreten eines vertrauten Raums', 'Nachdem ein starkes Gefühl abgeklungen ist', 'Wenn tagsüber ein wiederkehrendes persönliches Traumzeichen auftritt'],
    reminderSafety: 'Ignoriere Hinweise, wenn deine Aufmerksamkeit anderswo gebraucht wird. Führe nie einen Check beim Fahren, Überqueren einer Straße oder Bedienen von Geräten durch.',
    completionPrompt: 'Welchen Hinweis hast du tatsächlich geprüft?',
  },
  nightSignals: {
    title: 'Optionale nächtliche Audiosignale',
    intro: 'Ein Signal ist ein leiser Hinweis, kein Befehl. Ohne separat validierte Erfassung kennt sein Timer deine Schlafphase nicht. Nutze vorsichtige Zeiten und bewerte es nach seiner Wirkung auf deinen Schlaf.',
    optionalLabel: 'Standardmäßig aus',
    setupSteps: ['Höre dir den genauen Klang im vollständig wachen Zustand an.', 'Beginne mit der niedrigsten noch deutlich hörbaren Lautstärke.', 'Wähle einen kurzen Timer mit automatischem Ende.', 'Prüfe, ob morgen normale Erholung möglich ist.'],
    safeguards: ['Schlafe nicht mit Kopf- oder Ohrhörern.', 'Nutze keine Signale, wenn sie Partner, Kinder oder Tiere stören.', 'Lass Signale nach schlechtem Schlaf, bei Krankheit oder ungewöhnlicher Müdigkeit aus.', 'Beende ein Signal, wenn es dich wiederholt weckt oder erschreckt.'],
    previewAction: 'Im Wachzustand anhören', timerLabel: 'Timer mit automatischem Ende', volumeLabel: 'Sanfte Signallautstärke', stopAction: 'Alle Nachtsignale stoppen',
  },
  morningReview: {
    title: 'Morgen-Check-in', intro: 'Halte zuerst fest, was geschehen ist, und deute es später. Auch eine Nacht ohne Erinnerung oder Klarheit liefert nützliche Trainingsdaten.',
    fields: { technique: 'Verwendete Technik', preparation: 'Vorbereitung abgeschlossen', dreamRecall: 'Traumerinnerung', lucidity: 'Bewusstsein im Traum', sleepQuality: 'Wahrgenommene Schlafqualität', personalFactors: 'Persönliche Faktoren', notes: 'Kurze Notizen' },
    noRecallAction: 'Keine Erinnerung eintragen', saveOfflineNote: 'Zuerst auf diesem Gerät gespeichert. Eine optionale Synchronisierung kann später erfolgen.', neutralOutcome: 'Kein Klartraum ist ein übliches Ergebnis. Schlaf und aufmerksames Üben bleiben die Prioritäten.',
  },
  weeklyReview: {
    title: 'Wochenrückblick', intro: 'Vergleiche Methoden, ohne aus einer kleinen persönlichen Stichprobe eine wissenschaftliche Schlussfolgerung zu ziehen.',
    metrics: ['Abgeschlossene Einheiten', 'Erinnerte Träume', 'Erfasste klare Momente', 'Durchschnittlich wahrgenommene Schlafqualität', 'Zeit bis zum Wiedereinschlafen', 'Aus Sicherheitsgründen ausgelassene Techniken'],
    adaptationRules: ['Behalte eine Methode nur, wenn sie zu Schlaf und Alltag passt.', 'Verringere Nachtübungen, wenn die Schlafqualität sinkt.', 'Ändere jeweils nur eine Variable für einen klareren Vergleich.', 'Bevorzuge bei ähnlichen Beobachtungen die am wenigsten störende Methode.'],
    coachingNote: 'Das Offline-Coaching wendet diese transparenten Regeln an. Optionale KI kann deine Notizen zusammenfassen, doch die wesentlichen Empfehlungen hängen nicht von ihr ab.',
  },
  science: {
    title: 'Wissenschaft und Grenzen',
    definition: 'Ein Klartraum ist ein Traum, in dem eine Person während des fortdauernden Traums erkennt, dass sie träumt. Bewusstsein und Kontrolle sind verschieden; Kontrolle kann teilweise oder gar nicht vorhanden sein.',
    evidenceSummary: 'Die Forschung beschreibt Klarträumen als Phänomen des REM-Schlafs und untersucht MILD, SSILD und deren Kombination mit WBTB. Ergebnisse unterscheiden sich, und viele Studien beruhen auf Selbstauskünften.',
    uncertainty: 'Keine Methode kann vorhersagen, ob oder wann eine Person einen Klartraum erlebt. Die Evidenz zu Langzeitwirkungen und häufigen Schlafunterbrechungen ist begrenzt.',
    sleepPriority: 'Schütze ausreichenden, regelmäßigen Schlaf. Der Konsens von AASM und SRS empfiehlt gesunden Erwachsenen regelmäßig mindestens sieben Stunden Schlaf; individuelle Bedürfnisse können abweichen.',
    boundaries: ['Keine Aussage über Behandlung oder klinische Bewertung', 'Keine Erwartung von Traumkontrolle', 'Keine Anleitung, notwendigen Schlaf zu verkürzen', 'Kein Ersatz für professionelle Unterstützung'],
    supportAdvice: 'Pausiere das Training und wende dich an eine geeignete Gesundheitsfachperson, wenn du anhaltende Schlafprobleme, starke Belastung, Verwirrung zwischen Traum und Wachsein oder Sorgen um dein psychisches Wohlbefinden hast.',
    referencesTitle: 'Quellen und weiterführende Literatur',
  },
  privacy: {
    title: 'Datenschutz und deine Daten',
    localFirst: 'Trainingspläne, Check-ins und Einstellungen werden zuerst lokal gespeichert, damit die Kernfunktionen offline verfügbar bleiben.',
    optionalSync: 'Die Kontosynchronisierung ist optional und robust; ausstehende, fehlgeschlagene oder widersprüchliche Änderungen werden klar angezeigt.',
    minimalTransfer: 'Bei einer Verbindung mit Noctalia wird nur das von dir genehmigte Element übertragen, etwa Technik und kurzes Morgenergebnis. Traumtexte bleiben getrennt, sofern du in Noctalia nichts anderes auswählst.',
    analytics: 'Minimale Produktanalysen bleiben bis zur Einwilligung ausgeschaltet und enthalten nie Traumtexte, Freitextnotizen oder Audio.',
    sensitiveData: 'Sensible lokale Werte nutzen den für ihren Zweck geeigneten Plattformschutz; Anmeldedaten werden nie in Inhaltsdateien gespeichert.',
    exportDelete: 'In der Datenverwaltung kannst du eine lesbare Kopie exportieren oder lokale und synchronisierte Trainingsdaten löschen.',
    consentControl: 'Du kannst eine Einwilligung prüfen oder widerrufen, ohne das Offline-Training zu blockieren.',
  },
  settings: {
    title: 'Einstellungen', reminders: 'Erinnerungen für Realitätschecks', sleepWindow: 'Übliches Schlaffenster', nightSignals: 'Nächtliche Audiosignale', permissions: 'Berechtigungen', accessibility: 'Barrierefreiheit und Bewegung', language: 'Sprache', appearance: 'Helles, dunkles oder Systemdesign', privacy: 'Datenschutz und Analyse', dataManagement: 'Daten exportieren und löschen', subscription: 'Noctalia Plus und Käufe', noctaliaConnection: 'Verbindung zu Noctalia', scienceAndLimits: 'Wissenschaft und Grenzen', help: 'Hilfe und Sicherheit', about: 'Über Lucid Trainer',
  },
} as const satisfies LucidTrainerContent;

export default content;
