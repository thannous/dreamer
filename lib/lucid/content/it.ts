import type { LucidTrainerContent } from './types';

const content = {
  locale: 'it',
  chrome: {
    appName: 'Noctalia Lucid Trainer',
    tagline: 'Allena la consapevolezza proteggendo il sonno.',
    tabs: { today: 'Oggi', journal: 'Diario', programs: 'Percorsi', night: 'Notte', progress: 'Insight', settings: 'Profilo' },
    common: {
      continue: 'Continua', back: 'Indietro', save: 'Salva', cancel: 'Annulla', done: 'Fatto', retry: 'Riprova', skipTonight: 'Salta questa notte', optional: 'Facoltativo', offlineReady: 'Disponibile offline', loading: 'Caricamento del tuo allenamento…', error: 'Impossibile caricare questo contenuto. L’allenamento salvato resta su questo dispositivo.',
    },
  },
  onboarding: {
    title: 'Crea una pratica di sogno lucido adatta al tuo sonno',
    intro: 'Lucid Trainer sviluppa l’attenzione di giorno, la preparazione prima di dormire e la riflessione al mattino. Un sogno lucido può verificarsi oppure no: l’obiettivo è la pratica.',
    wellbeingNotice: 'Questo è uno strumento di benessere e auto-osservazione, non un servizio sanitario. Proteggi prima di tutto il sonno e interrompi gli esercizi che causano disagio o stanchezza insolita.',
    goalTitle: 'Che cosa vuoi allenare?',
    goals: [
      { id: 'first_lucid_dream', title: 'Notare di più', description: 'Sviluppa un’attenzione intenzionale e riconosci i dettagli insoliti mentre ti avvicini a una prima esperienza lucida.' },
      { id: 'improve_recall', title: 'Ricordare i sogni', description: 'Consolida l’abitudine del mattino prima di aggiungere tecniche notturne.' },
      { id: 'more_frequent_lucidity', title: 'Esplorare più spesso la lucidità', description: 'Pratica metodi basati sulla ricerca senza aspettarti un risultato prestabilito.' },
      { id: 'stabilize_lucidity', title: 'Restare lucidi con calma', description: 'Allena una risposta calma dopo aver riconosciuto un sogno, senza promettere esperienze più lunghe.' },
    ],
    experienceTitle: 'Qual è la tua esperienza?',
    experienceLevels: [
      { id: 'beginner', title: 'Principiante', description: 'Non ho mai seguito una pratica strutturata per il sogno lucido.' },
      { id: 'occasional', title: 'Occasionale', description: 'Ho provato qualche esercizio o avuto singoli sogni lucidi.' },
      { id: 'experienced', title: 'Regolare', description: 'Registro già i sogni e desidero una routine più costante.' },
    ],
    reminderTitle: 'Scegli un ritmo realistico',
    reminderExplanation: 'Inizia con pochi promemoria significativi. Più avvisi non rendono più attento un test di realtà.',
    sleepScheduleTitle: 'Imposta il tuo intervallo di sonno abituale',
    sleepScheduleExplanation: 'Gli orari in cui vai a letto e ti svegli mantengono preparazione e segnali notturni facoltativi nell’intervallo scelto. Puoi modificarli o sospenderli quando vuoi.',
    permissionsTitle: 'Autorizzazioni solo quando servono',
    notificationPermission: 'Le notifiche vengono richieste solo dopo aver creato un promemoria. Se rifiuti, l’allenamento resta disponibile con indicazioni manuali.',
    audioPermission: 'L’audio notturno è inizialmente disattivato. Ascoltalo da sveglio, imposta un volume basso e un timer, poi decidi se attivarlo. Il microfono non serve.',
    accessibilityTitle: 'Adatta l’esperienza',
    accessibilityBody: 'Sono supportati dimensione del testo di sistema, lettori di schermo, movimento ridotto e aspetto dinamico, chiaro o scuro. I passaggi essenziali non dipendono mai solo dal colore o dalle animazioni.',
    consentTitle: 'Le tue scelte restano sotto il tuo controllo',
    consentItems: [
      'L’allenamento funziona offline senza account.',
      'Le analisi di prodotto sono minime e facoltative.',
      'Collegare Noctalia e trasferire un breve riepilogo mattutino sono scelte separate e revocabili.',
      'Puoi esportare o eliminare i dati di allenamento dalle impostazioni.',
    ],
    finishAction: 'Crea il mio piano di allenamento',
  },
  programs: {
    mild: {
      id: 'mild', title: 'MILD', expandedName: 'Induzione mnemonica dei sogni lucidi',
      summary: 'Ripeti una chiara intenzione di riconoscere un sogno futuro usando una scena ricordata e un segnale onirico personale.',
      evidenceNote: 'MILD è tra i metodi cognitivi più studiati, ma la qualità degli studi e i risultati individuali variano.',
      evidenceReferenceIds: ['ildis-2020', 'tan-fan-2023', 'stumbrys-2012'],
      prerequisites: ['Mantieni una possibilità di sonno stabile.', 'Tieni pronto un sogno recente o una scena immaginata da ripetere mentalmente.', 'Accetta di registrare un breve esito al mattino, anche in assenza di ricordi.'],
      stopRules: ['Sospendi la pratica notturna dopo una notte difficile o in caso di marcata stanchezza diurna.', 'Torna alla pratica prima di dormire se un risveglio rende difficile riaddormentarti.', 'Interrompi e cerca un sostegno adeguato se gli esercizi causano disagio o confondono esperienze di sogno e veglia.'],
      sessions: [
        {
          id: 'mild-01', session: 1, title: 'Formula un’intenzione precisa', objective: 'Comprendi MILD e scegli un’intenzione breve e credibile.', durationMinutes: 10,
          steps: ['Leggi una volta il riepilogo del metodo.', 'Scrivi: «Quando starò sognando, intendo accorgermene».', 'Ripeti lentamente l’intenzione tre volte, concentrandoti sul ricordarla anziché forzare un risultato.'], caution: 'Esercitati da sveglio oggi; non ridurre il sonno per completare la sessione.', reflectionPrompt: 'Quali parole hanno reso l’intenzione chiara e tranquilla?',
        },
        {
          id: 'mild-02', session: 2, title: 'Trova un segnale onirico', objective: 'Individua un dettaglio ricorrente o insolito che possa richiamare la consapevolezza.', durationMinutes: 12,
          steps: ['Rivedi un sogno recente o usa una scena immaginata neutra.', 'Scegli un luogo, evento, persona o sensazione insoliti.', 'Immagina di notare il segnale e fermarti a chiederti se stai sognando.'], caution: 'Scegli una scena neutra se ricordare un sogno ti mette a disagio.', reflectionPrompt: 'Quale segnale sarebbe più facile da riconoscere senza sforzo?',
        },
        {
          id: 'mild-03', session: 3, title: 'Allena la memoria prospettica', objective: 'Esercitati a ricordare un’intenzione quando compare un segnale futuro.', durationMinutes: 8,
          steps: ['Scegli tre segnali quotidiani per oggi, come aprire una porta.', 'Quando compare ciascun segnale, fermati e ricorda l’intenzione lucida prima di controllare l’app.', 'Segna il segnale notato; quelli mancati sono osservazioni utili, non insuccessi.'], caution: 'Usa i segnali solo in momenti sicuri, mai mentre guidi o utilizzi macchinari.', reflectionPrompt: 'Quale contesto ti ha aiutato a ricordare senza una notifica?',
        },
        {
          id: 'mild-04', session: 4, title: 'Ripeti il momento del riconoscimento', objective: 'Collega intenzione, segnale onirico e risposta calma.', durationMinutes: 12,
          steps: ['Richiama dall’inizio la scena scelta.', 'Al segnale onirico, immagina di notare: «Questo è un sogno».', 'Immagina di guardarti attorno con calma, poi ripeti una volta l’intenzione.'], caution: 'Mantieni breve la ripetizione e fermati se le immagini ti attivano vicino all’ora di dormire.', reflectionPrompt: 'Quale azione calma ti aiuterebbe a orientarti nella scena immaginata?',
        },
        {
          id: 'mild-05', session: 5, title: 'Usa MILD prima di dormire', objective: 'Completa una sequenza MILD poco disturbante prima del sonno abituale.', durationMinutes: 10,
          steps: ['Prepara il controllo mattutino prima di entrare a letto.', 'Richiama la scena, nota il segnale e ripeti l’intenzione.', 'Lascia andare l’esercizio e permetti al sonno di arrivare normalmente.'], caution: 'Se la ripetizione ti mantiene sveglio, interrompila e torna alla tua consueta routine serale.', reflectionPrompt: 'La sequenza è stata rilassante, neutra o attivante?',
        },
        {
          id: 'mild-06', session: 6, title: 'Pratica facoltativa dopo un risveglio naturale', objective: 'Prova MILD dopo un risveglio spontaneo senza programmare una perdita di sonno.', durationMinutes: 6,
          steps: ['Usa solo un risveglio naturale se resta abbastanza tempo per dormire.', 'Ricorda il frammento appena sognato o riprendi la scena già praticata.', 'Formula l’intenzione una o due volte, poi dai priorità al riaddormentarti.'], caution: 'Salta la sessione dopo un sonno insufficiente o se i risvegli di solito ti tengono sveglio.', reflectionPrompt: 'Quanto rapidamente ti sei rilassato dopo aver terminato l’esercizio?',
        },
        {
          id: 'mild-07', session: 7, title: 'Rivedi e adatta', objective: 'Scegli un ritmo MILD sostenibile a partire dalle tue osservazioni.', durationMinutes: 15,
          steps: ['Confronta ricordo, qualità del sonno e note sulla lucidità della settimana.', 'Mantieni la versione più breve che non ha disturbato il sonno.', 'Pianifica due o tre notti di pratica lasciando notti di recupero dopo i tentativi più impegnativi.'], caution: 'Non aumentare la frequenza per compensare una settimana senza lucidità.', reflectionPrompt: 'Quale parte vale la pena mantenere anche senza un sogno lucido?',
        },
      ],
    },
    ssild: {
      id: 'ssild', title: 'SSILD', expandedName: 'Sogno lucido avviato dai sensi',
      summary: 'Sposta l’attenzione rilassata tra vista, udito e sensazioni corporee senza cercare di creare un’esperienza.',
      evidenceNote: 'SSILD ha mostrato risultati promettenti in studi sul campo, ma ha meno repliche indipendenti rispetto a MILD.',
      evidenceReferenceIds: ['ildis-2020', 'tan-fan-2023'],
      prerequisites: ['Osserva le sensazioni senza giudicarle.', 'Impara a fermarti e tornare al normale riposo se l’attenzione diventa faticosa.', 'Rendi disponibili offline tutte le istruzioni essenziali prima di dormire.'],
      stopRules: ['Interrompi i cicli se aumentano lo stato di allerta o il disagio.', 'Salta la pratica dopo un risveglio quando il tempo per dormire è limitato.', 'Scegli invece un esercizio di orientamento durante il giorno se le sensazioni interne ti turbano.'],
      sessions: [
        {
          id: 'ssild-01', session: 1, title: 'Osserva senza produrre', objective: 'Impara l’attenzione passiva, un senso alla volta.', durationMinutes: 9,
          steps: ['Siediti comodamente durante il giorno.', 'Nota per un minuto l’oscurità visiva o la luce ambientale.', 'Nota i suoni, poi il contatto e la temperatura, lasciando che ogni esperienza resti ordinaria.'], caution: 'Tieni gli occhi aperti se chiuderli ti mette a disagio o ti disorienta.', reflectionPrompt: 'Quale senso è stato più facile da osservare senza sforzo?',
        },
        {
          id: 'ssild-02', session: 2, title: 'Impara i cicli rapidi', objective: 'Passa con leggerezza tra vista, suoni e corpo.', durationMinutes: 8,
          steps: ['Dedica qualche secondo rilassato alla vista.', 'Passa ai suoni per alcuni secondi.', 'Passa alle sensazioni corporee e ripeti quattro cicli senza contare con precisione.'], caution: 'Non trattenere il respiro, non affaticare gli occhi e non cercare sensazioni insolite.', reflectionPrompt: 'Sei riuscito a spostare l’attenzione senza controllare se accadeva qualcosa di speciale?',
        },
        {
          id: 'ssild-03', session: 3, title: 'Impara i cicli lenti', objective: 'Mantieni un’attenzione delicata attraverso i tre sensi.', durationMinutes: 12,
          steps: ['Lascia riposare l’attenzione sulla vista per circa venti secondi.', 'Passa all’udito e poi al corpo per intervalli simili e non rigidi.', 'Completa quattro cicli lenti e termina prima che concentrarti diventi un lavoro.'], caution: 'Stima i tempi; controllare l’orologio può rendere l’esercizio più attivante.', reflectionPrompt: 'Quando l’osservazione rilassata ha iniziato a richiedere sforzo?',
        },
        {
          id: 'ssild-04', session: 4, title: 'Costruisci la sequenza completa', objective: 'Combina cicli rapidi e lenti in una routine familiare.', durationMinutes: 14,
          steps: ['Completa quattro cicli rapidi.', 'Completa quattro cicli lenti.', 'Termina con un respiro normale e allarga l’attenzione a tutto il corpo.'], caution: 'Questa è una prova da sveglio; non modificare i tuoi normali orari di sonno.', reflectionPrompt: 'Quale semplice segnale ti ricorderà di restare passivo?',
        },
        {
          id: 'ssild-05', session: 5, title: 'Prova una versione prima di dormire', objective: 'Usa una sequenza breve senza ritardare il sonno.', durationMinutes: 8,
          steps: ['Sistemati nella tua abituale posizione per dormire.', 'Completa due cicli rapidi e due lenti.', 'Fermati intenzionalmente e lascia arrivare il sonno, anche se la sequenza sembra incompleta.'], caution: 'Se la sequenza ritarda il sonno, rimuovila dalla sera e mantieni solo la pratica diurna.', reflectionPrompt: 'La versione breve ha rispettato la tua routine di rilassamento?',
        },
        {
          id: 'ssild-06', session: 6, title: 'Sequenza facoltativa dopo un risveglio', objective: 'Prova la sequenza completa dopo un risveglio naturale quando le condizioni sono adatte.', durationMinutes: 10,
          steps: ['Conferma che resti abbastanza tempo per dormire e di sentirti tranquillo.', 'Completa quattro cicli rapidi seguiti da quattro a sei cicli lenti.', 'Termina l’esercizio e torna a dormire senza valutarlo.'], caution: 'Salta dopo una notte difficile, durante una malattia o prima di una giornata che richiede massima attenzione.', reflectionPrompt: 'Sei riuscito a riaddormentarti comodamente?',
        },
        {
          id: 'ssild-07', session: 7, title: 'Scegli una dose sostenibile', objective: 'Adatta SSILD dalle note su sonno ed esperienza, non dalla pressione del risultato.', durationMinutes: 15,
          steps: ['Rivedi completamento, qualità del sonno, ricordo e lucidità.', 'Scegli una pratica diurna, prima di dormire o dopo un risveglio occasionale.', 'Programma notti di recupero e mantieni la versione meno disturbante che ritieni adatta.'], caution: 'Una settimana neutra è un esito valido; non aggiungere automaticamente cicli o risvegli.', reflectionPrompt: 'Quale versione era abbastanza tranquilla da ripetere?',
        },
      ],
    },
    wbtb: {
      id: 'wbtb', title: 'WBTB', expandedName: 'Svegliarsi e tornare a letto',
      summary: 'Usa un risveglio programmato o naturale nella parte finale della notte, un breve intervallo tranquillo e il ritorno al sonno con una tecnica cognitiva scelta.',
      evidenceNote: 'WBTB è spesso abbinato a MILD o SSILD. Poiché interrompe il sonno, dovrebbe restare occasionale e subordinato al bisogno di riposo.',
      evidenceReferenceIds: ['ildis-2020', 'tan-fan-2023', 'aasm-srs-2015'],
      prerequisites: ['Riserva abbastanza tempo per la tua normale opportunità di sonno e per il breve risveglio.', 'Scegli una mattina senza impegni precoci che richiedano attenzione critica.', 'Decidi quale tecnica tranquilla userai prima di impostare una sveglia.'],
      stopRules: ['Annulla dopo perdita di sonno, malattia, stanchezza insolita o risvegli ripetuti.', 'Termina presto l’intervallo se diventi troppo vigile.', 'Sospendi WBTB se la qualità del sonno o il funzionamento diurno peggiorano.'],
      sessions: [
        {
          id: 'wbtb-01', session: 1, title: 'Controlla la preparazione', objective: 'Decidi quando saltare WBTB prima di programmare una sveglia.', durationMinutes: 10,
          steps: ['Rivedi la tua recente opportunità di sonno e l’attenzione diurna.', 'Elenca gli impegni e le esigenze di sicurezza del mattino successivo.', 'Scrivi una chiara regola di annullamento per stanotte.'], caution: 'Questa sessione non prevede risvegli notturni; non provare WBTB se sei già in debito di sonno.', reflectionPrompt: 'Quale segnale renderà responsabile la scelta di saltare?',
        },
        {
          id: 'wbtb-02', session: 2, title: 'Progetta un risveglio discreto', objective: 'Prepara una sveglia facoltativa che riduca al minimo il disturbo.', durationMinutes: 10,
          steps: ['Scegli una notte occasionale con abbastanza tempo a letto.', 'Seleziona una sveglia delicata e un modo semplice per spegnerla.', 'Prepara una luce soffusa e istruzioni offline prima di dormire.'], caution: 'Non dormire con cuffie o auricolari e non usare un volume che possa spaventare te o altre persone.', reflectionPrompt: 'La configurazione può essere annullata senza perdere progressi?',
        },
        {
          id: 'wbtb-03', session: 3, title: 'Prova l’intervallo di veglia di giorno', objective: 'Impara una sequenza breve e poco stimolante prima di usarla di notte.', durationMinutes: 12,
          steps: ['Esercitati ad alzarti lentamente e a usare luce soffusa.', 'Leggi una breve scheda della tecnica senza aprire altre app.', 'Torna a letto e respira con calma per due minuti.'], caution: 'Questa prova diurna sostituisce oggi un tentativo notturno.', reflectionPrompt: 'Quale parte potrebbe creare stimoli inutili di notte?',
        },
        {
          id: 'wbtb-04', session: 4, title: 'Scegli la tecnica abbinata', objective: 'Abbina WBTB a un solo metodo familiare anziché improvvisare.', durationMinutes: 10,
          steps: ['Scegli l’intenzione MILD o la sequenza SSILD già praticata.', 'Lascia vicino al letto solo quella istruzione.', 'Imposta un intervallo massimo di veglia e un punto di arresto.'], caution: 'Non combinare più metodi e non prolungare la veglia per inseguire un risultato.', reflectionPrompt: 'Quale singola tecnica è più semplice da eseguire con calma?',
        },
        {
          id: 'wbtb-05', session: 5, title: 'Prima notte facoltativa', objective: 'Esegui un tentativo WBTB prudente proteggendo il sonno.', durationMinutes: 15,
          steps: ['Al risveglio, rivaluta la stanchezza e annulla se le condizioni sono cambiate.', 'Resta con luce soffusa solo per il breve intervallo pianificato.', 'Completa la tecnica scelta, torna a letto e lascia andare l’obiettivo.'], caution: 'Fermati subito se ti senti male o troppo sveglio; dai priorità al ritorno al riposo.', reflectionPrompt: 'Quanto è stata disturbante l’intera sequenza, indipendentemente dall’esito del sogno?',
        },
        {
          id: 'wbtb-06', session: 6, title: 'Proteggi il giorno seguente', objective: 'Usa il funzionamento diurno come segnale di sicurezza per i tentativi futuri.', durationMinutes: 8,
          steps: ['Valuta con sincerità qualità del sonno e attenzione.', 'Non ripetere WBTB questa notte.', 'Se hai sonnolenza, evita di guidare o svolgere attività pericolose e segui il tuo consueto piano di sicurezza.'], caution: 'I dati di allenamento non hanno mai la precedenza sulla sicurezza immediata o sul riposo necessario.', reflectionPrompt: 'Il tentativo ha influito su concentrazione, umore o energia?',
        },
        {
          id: 'wbtb-07', session: 7, title: 'Definisci un ritmo occasionale', objective: 'Decidi se WBTB debba far parte del tuo piano.', durationMinutes: 15,
          steps: ['Confronta sonno, tempo per riaddormentarti, ricordo e lucidità.', 'Mantieni WBTB solo se il disturbo è rimasto basso.', 'Scegli una frequenza massima prudente con notti di recupero oppure disattivalo.'], caution: 'Non programmare WBTB come obbligo quotidiano; disattivarlo costituisce un piano completo.', reflectionPrompt: 'Il possibile beneficio giustifica per te l’interruzione del sonno?',
        },
      ],
    },
  },
  realityChecks: {
    title: 'Test di realtà attenti',
    intro: 'Un buon test interrompe brevemente il pilota automatico: nota il contesto, verifica un dettaglio stabile e immagina di riconoscere la stessa incongruenza in un sogno.',
    qualityPrinciples: ['Fermati prima di agire.', 'Poni la domanda con autentica incertezza.', 'Usa due indizi, non solo l’abitudine.', 'Termina con un’intenzione calma per il prossimo sogno.'],
    exercises: [
      { id: 'text', title: 'Leggi due volte', description: 'Leggi una breve frase, distogli lo sguardo, poi rileggila e nota se resta stabile.' },
      { id: 'time', title: 'Controlla due volte l’ora', description: 'Guarda l’ora, distogli lo sguardo e poi confrontala senza fretta.' },
      { id: 'hands', title: 'Osserva le mani', description: 'Conta le dita e nota forma, consistenza e continuità senza tentare di provocare anomalie.' },
      { id: 'context', title: 'Ricostruisci il contesto', description: 'Chiediti come sei arrivato qui e nomina gli ultimi due eventi che ricordi.' },
    ],
    contextTitle: 'Associa i test a contesti significativi',
    contextExamples: ['Dopo aver notato qualcosa di sorprendente', 'Entrando in una stanza familiare', 'Quando un’emozione forte si è calmata', 'Quando da sveglio compare un segnale onirico personale ricorrente'],
    reminderSafety: 'Ignora i promemoria quando la tua attenzione serve altrove. Non fare mai un test mentre guidi, attraversi la strada o utilizzi macchinari.',
    completionPrompt: 'Quale indizio hai verificato davvero?',
  },
  nightSignals: {
    title: 'Segnali audio notturni facoltativi',
    intro: 'Un segnale è un invito discreto, non un comando. Senza un rilevamento validato separatamente, il timer non conosce la tua fase di sonno: usa tempi prudenti e valutalo in base all’impatto sul riposo.',
    optionalLabel: 'Disattivati all’inizio',
    setupSteps: ['Ascolta il suono esatto mentre sei completamente sveglio.', 'Inizia dal volume più basso chiaramente udibile.', 'Scegli un timer breve con arresto automatico.', 'Verifica che domani sia possibile un normale recupero.'],
    safeguards: ['Non dormire con cuffie o auricolari.', 'Non usare segnali se disturbano partner, bambini o animali.', 'Evitali dopo una notte difficile, in caso di malattia o stanchezza insolita.', 'Interrompi un segnale se ti sveglia o spaventa ripetutamente.'],
    previewAction: 'Ascolta da sveglio', timerLabel: 'Timer di arresto automatico', volumeLabel: 'Volume delicato del segnale', stopAction: 'Interrompi tutti i segnali notturni',
  },
  morningReview: {
    title: 'Controllo del mattino', intro: 'Registra ciò che è accaduto prima di interpretarlo. Anche una notte senza ricordi o lucidità offre dati utili.',
    fields: { technique: 'Tecnica utilizzata', preparation: 'Preparazione completata', dreamRecall: 'Ricordo del sogno', lucidity: 'Consapevolezza durante il sogno', sleepQuality: 'Qualità percepita del sonno', personalFactors: 'Fattori personali', notes: 'Note brevi' },
    noRecallAction: 'Registra nessun ricordo', saveOfflineNote: 'Salvato prima su questo dispositivo. La sincronizzazione facoltativa può avvenire in seguito.', neutralOutcome: 'Non avere un sogno lucido è un esito comune. Il sonno e la qualità della pratica restano prioritari.',
  },
  weeklyReview: {
    title: 'Riepilogo settimanale', intro: 'Confronta i metodi senza trasformare un piccolo campione personale in una conclusione scientifica.',
    metrics: ['Sessioni completate', 'Sogni ricordati', 'Momenti lucidi registrati', 'Qualità media percepita del sonno', 'Tempo necessario per riaddormentarsi', 'Tecniche saltate per sicurezza'],
    adaptationRules: ['Mantieni un metodo solo se si adatta al sonno e alla vita quotidiana.', 'Riduci la pratica notturna se la qualità del sonno peggiora.', 'Cambia una sola variabile alla volta per un confronto più chiaro.', 'Preferisci il metodo meno disturbante quando le osservazioni sono simili.'],
    coachingNote: 'Il coaching offline applica queste regole esplicite. Un’IA facoltativa può riassumere le note, ma le raccomandazioni essenziali non dipendono da essa.',
  },
  science: {
    title: 'Scienza e limiti',
    definition: 'Un sogno lucido è un sogno in cui una persona si rende conto di sognare mentre il sogno continua. Consapevolezza e controllo sono distinti; il controllo può essere parziale o assente.',
    evidenceSummary: 'La ricerca descrive il sogno lucido come un fenomeno del sonno REM e studia MILD, SSILD e le loro combinazioni con WBTB. I risultati variano e molti studi si basano su autovalutazioni.',
    uncertainty: 'Nessun metodo può prevedere se o quando una persona avrà un sogno lucido. Le prove sugli effetti a lungo termine e sulle frequenti interruzioni del sonno restano limitate.',
    sleepPriority: 'Proteggi un sonno sufficiente e regolare. Il consenso AASM/SRS raccomanda agli adulti sani almeno sette ore di sonno regolare, pur riconoscendo che i bisogni individuali variano.',
    boundaries: ['Nessuna affermazione assistenziale o valutazione clinica', 'Nessuna aspettativa di controllo del sogno', 'Nessuna istruzione per ridurre il sonno necessario', 'Non sostituisce il sostegno professionale'],
    supportAdvice: 'Sospendi l’allenamento e rivolgiti a un professionista sanitario adeguato in caso di problemi di sonno persistenti, forte disagio, confusione tra sogno e veglia o preoccupazioni per il tuo benessere mentale.',
    referencesTitle: 'Fonti e approfondimenti',
  },
  privacy: {
    title: 'Privacy e dati',
    localFirst: 'Piani, controlli e preferenze vengono salvati prima localmente, così le funzioni essenziali sono disponibili offline.',
    optionalSync: 'La sincronizzazione dell’account è facoltativa e resiliente; mostra con chiarezza modifiche in attesa, non riuscite o in conflitto.',
    minimalTransfer: 'Collegando Noctalia viene trasferito solo ciò che approvi, per esempio la tecnica e un breve esito mattutino. Il testo dei sogni resta separato, salvo una tua scelta esplicita in Noctalia.',
    analytics: 'Le analisi minime di prodotto restano disattivate fino al consenso e non includono mai testo dei sogni, note libere o audio.',
    sensitiveData: 'I valori locali sensibili usano la protezione della piattaforma adatta allo scopo; le credenziali dell’account non vengono mai salvate nei file di contenuto.',
    exportDelete: 'Puoi esportare una copia leggibile o eliminare i dati locali e sincronizzati dalla gestione dei dati.',
    consentControl: 'Puoi rivedere o revocare il consenso senza bloccare l’allenamento offline.',
  },
  settings: {
    title: 'Impostazioni', reminders: 'Promemoria dei test di realtà', sleepWindow: 'Intervallo di sonno abituale', nightSignals: 'Segnali audio notturni', permissions: 'Autorizzazioni', accessibility: 'Accessibilità e movimento', language: 'Lingua', appearance: 'Aspetto dinamico, chiaro, scuro o di sistema', privacy: 'Privacy e analisi', dataManagement: 'Esporta ed elimina i dati', subscription: 'Noctalia Plus e acquisti', noctaliaConnection: 'Collegamento a Noctalia', scienceAndLimits: 'Scienza e limiti', help: 'Aiuto e sicurezza', about: 'Informazioni su Lucid Trainer',
  },
} as const satisfies LucidTrainerContent;

export default content;
