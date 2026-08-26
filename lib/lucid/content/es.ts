import type { LucidTrainerContent } from './types';

const content = {
  locale: 'es',
  chrome: {
    appName: 'Noctalia Lucid Trainer',
    tagline: 'Entrena tu atención sin descuidar el sueño.',
    tabs: { today: 'Hoy', programs: 'Programas', night: 'Noche', progress: 'Progreso', settings: 'Ajustes' },
    common: {
      continue: 'Continuar', back: 'Atrás', save: 'Guardar', cancel: 'Cancelar', done: 'Listo', retry: 'Reintentar', skipTonight: 'Omitir esta noche', optional: 'Opcional', offlineReady: 'Disponible sin conexión', loading: 'Cargando tu entrenamiento…', error: 'No se ha podido cargar. Tu entrenamiento guardado sigue en este dispositivo.',
    },
  },
  onboarding: {
    title: 'Crea una práctica de sueños lúcidos compatible con tu descanso',
    intro: 'Lucid Trainer desarrolla la atención durante el día, la preparación al acostarte y la reflexión por la mañana. Puede haber o no un sueño lúcido: la práctica es el objetivo.',
    wellbeingNotice: 'Es una herramienta de bienestar y autoobservación, no una atención sanitaria. Protege primero el sueño y detén cualquier ejercicio que te cause angustia o un cansancio inusual.',
    goalTitle: '¿Qué quieres practicar?',
    goals: [
      { id: 'first_lucid_dream', title: 'Observar mejor', description: 'Desarrolla una atención deliberada y reconoce detalles inusuales mientras avanzas hacia una primera experiencia lúcida.' },
      { id: 'improve_recall', title: 'Recordar sueños', description: 'Refuerza el hábito de la mañana antes de añadir técnicas nocturnas.' },
      { id: 'more_frequent_lucidity', title: 'Explorar la lucidez con más frecuencia', description: 'Practica métodos basados en la evidencia sin esperar un resultado fijo.' },
      { id: 'stabilize_lucidity', title: 'Mantener la lucidez con calma', description: 'Practica una respuesta tranquila tras reconocer un sueño, sin prometer experiencias más largas.' },
    ],
    experienceTitle: '¿Qué experiencia tienes?',
    experienceLevels: [
      { id: 'beginner', title: 'Principiante', description: 'Nunca he seguido una práctica estructurada de sueños lúcidos.' },
      { id: 'occasional', title: 'Ocasional', description: 'He probado algunos ejercicios o he tenido sueños lúcidos aislados.' },
      { id: 'experienced', title: 'Habitual', description: 'Ya registro mis sueños y quiero una rutina más constante.' },
    ],
    reminderTitle: 'Elige un ritmo realista',
    reminderExplanation: 'Empieza con pocos recordatorios que tengan sentido. Más avisos no hacen que una prueba de realidad sea más atenta.',
    sleepScheduleTitle: 'Indica tu horario habitual de sueño',
    sleepScheduleExplanation: 'La hora de acostarte y de despertar mantiene la preparación y las señales nocturnas opcionales dentro del intervalo elegido. Puedes cambiarlas o pausarlas cuando quieras.',
    permissionsTitle: 'Permisos solo cuando sean útiles',
    notificationPermission: 'Las notificaciones solo se solicitan después de crear un recordatorio. Si las rechazas, el entrenamiento sigue disponible con indicaciones manuales.',
    audioPermission: 'El audio nocturno está desactivado al principio. Escúchalo despierto, ajusta un volumen bajo y un temporizador y decide después si quieres activarlo. No se necesita el micrófono.',
    accessibilityTitle: 'Adapta la experiencia',
    accessibilityBody: 'Se admiten el tamaño de texto del sistema, los lectores de pantalla, la reducción de movimiento y las apariencias dinámica, clara u oscura. Los pasos esenciales nunca dependen solo del color o de una animación.',
    consentTitle: 'Tú controlas tus decisiones',
    consentItems: [
      'El entrenamiento funciona sin conexión y sin una cuenta.',
      'Las analíticas de producto son mínimas y opcionales.',
      'Conectar Noctalia y transferir un breve resumen matinal son decisiones separadas y revocables.',
      'Puedes exportar o eliminar tus datos de entrenamiento desde los ajustes.',
    ],
    finishAction: 'Crear mi plan de entrenamiento',
  },
  programs: {
    mild: {
      id: 'mild', title: 'MILD', expandedName: 'Inducción mnemónica de sueños lúcidos',
      summary: 'Ensaya una intención clara de reconocer un sueño futuro con una escena recordada y una señal onírica personal.',
      evidenceNote: 'MILD es uno de los métodos cognitivos más estudiados, pero la calidad de los estudios y los resultados individuales varían.',
      evidenceReferenceIds: ['ildis-2020', 'tan-fan-2023', 'stumbrys-2012'],
      prerequisites: ['Mantén una oportunidad de sueño estable.', 'Ten preparado un sueño reciente o una escena imaginada para el ensayo.', 'Acepta registrar un resultado breve por la mañana, incluso si no recuerdas nada.'],
      stopRules: ['Pausa la práctica nocturna tras dormir mal o sentir mucho cansancio durante el día.', 'Vuelve a practicar solo al acostarte si un despertar dificulta volver a dormir.', 'Detente y busca apoyo adecuado si los ejercicios causan angustia o confunden las experiencias de sueño y vigilia.'],
      sessions: [
        {
          id: 'mild-01', session: 1, title: 'Define una intención precisa', objective: 'Comprende MILD y elige una intención breve y creíble.', durationMinutes: 10,
          steps: ['Lee una vez el resumen del método.', 'Escribe: «Cuando esté soñando, tengo la intención de darme cuenta».', 'Repite despacio la intención tres veces, concentrándote en recordarla y no en forzar un resultado.'], caution: 'Practica despierto hoy; no reduzcas tu tiempo de sueño para completar la sesión.', reflectionPrompt: '¿Qué palabras hicieron que la intención pareciera clara y tranquila?',
        },
        {
          id: 'mild-02', session: 2, title: 'Encuentra una señal onírica', objective: 'Identifica un detalle recurrente o inusual que pueda activar la conciencia.', durationMinutes: 12,
          steps: ['Revisa un sueño reciente o usa una escena imaginada neutra.', 'Elige un lugar, suceso, persona o sensación extraños.', 'Imagínate observando esa señal y deteniéndote para preguntar si estás soñando.'], caution: 'Elige una escena neutra si recordar un sueño te resulta desagradable.', reflectionPrompt: '¿Qué señal sería más fácil de reconocer sin esfuerzo?',
        },
        {
          id: 'mild-03', session: 3, title: 'Entrena la memoria prospectiva', objective: 'Practica recordar una intención cuando aparezca una señal futura.', durationMinutes: 8,
          steps: ['Elige tres señales cotidianas para hoy, como abrir una puerta.', 'Cuando aparezca cada una, haz una pausa y recuerda tu intención lúcida antes de mirar la aplicación.', 'Marca la señal como observada; los olvidos son datos útiles, no fracasos.'], caution: 'Usa las señales solo en momentos seguros, nunca al conducir o manejar maquinaria.', reflectionPrompt: '¿Qué contexto te ayudó a recordar sin una notificación?',
        },
        {
          id: 'mild-04', session: 4, title: 'Ensaya el momento de reconocimiento', objective: 'Relaciona la intención, la señal onírica y una respuesta tranquila.', durationMinutes: 12,
          steps: ['Recuerda desde el principio la escena elegida.', 'Al llegar a la señal, imagina que notas: «Esto es un sueño».', 'Imagínate mirando alrededor con calma y repite la intención una vez.'], caution: 'Haz un ensayo breve y detente si las imágenes te activan cerca de la hora de dormir.', reflectionPrompt: '¿Qué acción tranquila te ayudaría a orientarte en la escena imaginada?',
        },
        {
          id: 'mild-05', session: 5, title: 'Usa MILD al acostarte', objective: 'Completa una secuencia MILD poco perturbadora antes del sueño habitual.', durationMinutes: 10,
          steps: ['Prepara el registro de la mañana antes de meterte en la cama.', 'Recuerda la escena, observa la señal y repite tu intención.', 'Suelta el ejercicio y deja que el sueño llegue con normalidad.'], caution: 'Si la repetición te mantiene despierto, detén el ejercicio y vuelve a tu rutina habitual de descanso.', reflectionPrompt: '¿La secuencia resultó relajante, neutra o activadora?',
        },
        {
          id: 'mild-06', session: 6, title: 'Práctica opcional tras un despertar natural', objective: 'Prueba MILD después de un despertar espontáneo sin programar una pérdida de sueño.', durationMinutes: 6,
          steps: ['Hazlo solo tras un despertar natural si queda suficiente tiempo para dormir.', 'Recuerda el fragmento de sueño reciente o reutiliza tu escena practicada.', 'Repite la intención una o dos veces y da prioridad a volver a dormir.'], caution: 'Omite esta sesión si has dormido poco o los despertares suelen desvelarte.', reflectionPrompt: '¿Con qué rapidez te relajaste al terminar el ejercicio?',
        },
        {
          id: 'mild-07', session: 7, title: 'Revisa y adapta', objective: 'Elige un ritmo MILD sostenible a partir de tus observaciones.', durationMinutes: 15,
          steps: ['Compara recuerdo, calidad del sueño y notas de lucidez de toda la semana.', 'Conserva la versión más breve que no haya alterado tu sueño.', 'Planifica dos o tres noches de práctica, con noches de recuperación entre intentos exigentes.'], caution: 'No aumentes la frecuencia para compensar una semana sin lucidez.', reflectionPrompt: '¿Qué parte merece continuar aunque no haya un sueño lúcido?',
        },
      ],
    },
    ssild: {
      id: 'ssild', title: 'SSILD', expandedName: 'Sueño lúcido iniciado por los sentidos',
      summary: 'Desplaza una atención relajada entre la vista, el oído y las sensaciones corporales sin intentar crear una experiencia.',
      evidenceNote: 'SSILD ofrece resultados prometedores en estudios de campo, pero tiene menos replicaciones independientes que MILD.',
      evidenceReferenceIds: ['ildis-2020', 'tan-fan-2023'],
      prerequisites: ['Siéntete cómodo observando sensaciones sin juzgarlas.', 'Aprende a detenerte y volver al descanso normal si la atención requiere esfuerzo.', 'Deja todas las instrucciones esenciales disponibles sin conexión antes de acostarte.'],
      stopRules: ['Detén los ciclos si aumentan la vigilia o el malestar.', 'Omite la práctica tras un despertar si el tiempo de sueño es limitado.', 'Elige un ejercicio diurno de conexión con el entorno si las sensaciones internas te inquietan.'],
      sessions: [
        {
          id: 'ssild-01', session: 1, title: 'Observa sin producir', objective: 'Aprende a prestar atención pasiva a un sentido cada vez.', durationMinutes: 9,
          steps: ['Siéntate cómodamente durante el día.', 'Observa la oscuridad visual o la luz ambiental durante un minuto.', 'Escucha los sonidos y después nota el contacto y la temperatura, dejando que cada experiencia sea corriente.'], caution: 'Mantén los ojos abiertos si cerrarlos te resulta incómodo o desorientador.', reflectionPrompt: '¿Qué sentido fue más fácil de observar sin esfuerzo?',
        },
        {
          id: 'ssild-02', session: 2, title: 'Aprende ciclos rápidos', objective: 'Pasa suavemente por la vista, el sonido y el cuerpo.', durationMinutes: 8,
          steps: ['Dedica unos segundos relajados a la vista.', 'Pasa a los sonidos durante unos segundos.', 'Pasa a las sensaciones corporales y repite cuatro ciclos sin contar con precisión.'], caution: 'No contengas la respiración, fuerces la vista ni busques sensaciones extrañas.', reflectionPrompt: '¿Pudiste desplazar la atención sin comprobar si ocurría algo especial?',
        },
        {
          id: 'ssild-03', session: 3, title: 'Aprende ciclos lentos', objective: 'Mantén una atención suave en los tres sentidos.', durationMinutes: 12,
          steps: ['Descansa la atención en la vista durante unos veinte segundos.', 'Pasa al oído y después al cuerpo durante periodos parecidos y sin rigidez.', 'Completa cuatro ciclos lentos y termina antes de que concentrarte se convierta en esfuerzo.'], caution: 'Calcula el tiempo aproximadamente; mirar el reloj puede activarte más.', reflectionPrompt: '¿En qué momento la observación relajada empezó a exigir esfuerzo?',
        },
        {
          id: 'ssild-04', session: 4, title: 'Construye la secuencia completa', objective: 'Combina ciclos rápidos y lentos en una rutina conocida.', durationMinutes: 14,
          steps: ['Completa cuatro ciclos rápidos.', 'Completa cuatro ciclos lentos.', 'Termina con una respiración normal y amplía la atención a todo el cuerpo.'], caution: 'Es un ensayo despierto; mantén sin cambios tu horario habitual de sueño.', reflectionPrompt: '¿Qué señal sencilla te recordará mantener una actitud pasiva?',
        },
        {
          id: 'ssild-05', session: 5, title: 'Prueba una versión al acostarte', objective: 'Usa una secuencia breve sin retrasar el sueño.', durationMinutes: 8,
          steps: ['Colócate en tu postura habitual para dormir.', 'Completa dos ciclos rápidos y dos lentos.', 'Detente de forma deliberada y deja llegar el sueño, aunque la secuencia parezca incompleta.'], caution: 'Si la secuencia retrasa el sueño, elimínala de la noche y conserva solo la práctica diurna.', reflectionPrompt: '¿La versión breve respetó tu rutina de descanso?',
        },
        {
          id: 'ssild-06', session: 6, title: 'Secuencia opcional tras un despertar', objective: 'Prueba la secuencia completa después de un despertar natural si las condiciones son adecuadas.', durationMinutes: 10,
          steps: ['Confirma que queda tiempo suficiente para dormir y que estás tranquilo.', 'Completa cuatro ciclos rápidos y entre cuatro y seis lentos.', 'Termina el ejercicio y vuelve a dormir sin evaluarlo.'], caution: 'Omítelo tras dormir mal, durante una enfermedad o antes de un día que requiera máxima atención.', reflectionPrompt: '¿Pudiste volver a dormir cómodamente?',
        },
        {
          id: 'ssild-07', session: 7, title: 'Elige una dosis sostenible', objective: 'Adapta SSILD según tus notas de sueño y experiencia, no por presión de resultados.', durationMinutes: 15,
          steps: ['Revisa el cumplimiento, la calidad del sueño, el recuerdo y la lucidez.', 'Elige práctica diurna, al acostarte o tras algún despertar ocasional.', 'Programa noches de recuperación y conserva la versión menos perturbadora que te resulte adecuada.'], caution: 'Una semana neutra es un resultado válido; no añadas ciclos o despertares de forma automática.', reflectionPrompt: '¿Qué versión fue lo bastante tranquila como para repetirla?',
        },
      ],
    },
    wbtb: {
      id: 'wbtb', title: 'WBTB', expandedName: 'Despertar y volver a la cama',
      summary: 'Usa un despertar planificado o natural al final de la noche, un intervalo breve y tranquilo y el regreso al sueño con una técnica cognitiva elegida.',
      evidenceNote: 'WBTB suele combinarse con MILD o SSILD. Como interrumpe el sueño, debe ser ocasional y quedar supeditado a las necesidades de descanso.',
      evidenceReferenceIds: ['ildis-2020', 'tan-fan-2023', 'aasm-srs-2015'],
      prerequisites: ['Reserva tiempo para tu oportunidad normal de sueño y para el breve despertar.', 'Elige una mañana sin obligaciones tempranas que exijan una atención crítica.', 'Decide qué técnica tranquila usarás antes de poner una alarma.'],
      stopRules: ['Cancela el intento si has perdido sueño, estás enfermo, sientes un cansancio inusual o te despiertas repetidamente.', 'Termina antes el intervalo si te activas demasiado.', 'Pausa WBTB si empeoran la calidad del sueño o tu funcionamiento diurno.'],
      sessions: [
        {
          id: 'wbtb-01', session: 1, title: 'Comprueba si estás preparado', objective: 'Decide cuándo omitir WBTB antes de planificar una alarma.', durationMinutes: 10,
          steps: ['Revisa tu oportunidad de sueño reciente y tu atención durante el día.', 'Anota las obligaciones y necesidades de seguridad de la mañana siguiente.', 'Escribe una regla clara para cancelar esta noche.'], caution: 'Esta sesión no incluye un despertar nocturno; no pruebes WBTB si ya te falta sueño.', reflectionPrompt: '¿Qué señal indicará que omitirlo es la decisión responsable?',
        },
        {
          id: 'wbtb-02', session: 2, title: 'Diseña un despertar discreto', objective: 'Prepara una alarma opcional que reduzca las interrupciones.', durationMinutes: 10,
          steps: ['Elige una noche ocasional con suficiente tiempo en la cama.', 'Selecciona una alarma suave y una forma sencilla de apagarla.', 'Prepara luz tenue e instrucciones sin conexión antes de acostarte.'], caution: 'No duermas con auriculares ni uses un volumen que pueda sobresaltarte o despertar a otras personas.', reflectionPrompt: '¿Puedes cancelar la configuración sin perder progreso?',
        },
        {
          id: 'wbtb-03', session: 3, title: 'Ensaya el intervalo despierto durante el día', objective: 'Aprende una secuencia breve y poco estimulante antes de usarla de noche.', durationMinutes: 12,
          steps: ['Practica levantarte despacio y usar luz tenue.', 'Lee una ficha breve de la técnica sin abrir otras aplicaciones.', 'Vuelve a la cama y respira con calma durante dos minutos.'], caution: 'Este ensayo diurno sustituye hoy a un intento nocturno.', reflectionPrompt: '¿Qué parte podría estimularte innecesariamente por la noche?',
        },
        {
          id: 'wbtb-04', session: 4, title: 'Elige la técnica complementaria', objective: 'Combina WBTB con un método conocido en lugar de improvisar.', durationMinutes: 10,
          steps: ['Elige la intención MILD o la secuencia SSILD que ya has practicado.', 'Deja solo esa instrucción junto a la cama.', 'Fija un intervalo despierto máximo y un punto para detenerte.'], caution: 'No combines varios métodos ni prolongues la vigilia para perseguir un resultado.', reflectionPrompt: '¿Qué única técnica es más fácil de realizar con calma?',
        },
        {
          id: 'wbtb-05', session: 5, title: 'Primera noche opcional', objective: 'Realiza un intento WBTB prudente protegiendo el sueño.', durationMinutes: 15,
          steps: ['Al despertar, reevalúa el cansancio y cancela si las condiciones han cambiado.', 'Permanece con luz tenue solo durante el breve intervalo previsto.', 'Completa la técnica elegida, vuelve a la cama y suelta el objetivo.'], caution: 'Detente inmediatamente si te encuentras mal o demasiado despierto; prioriza volver a descansar.', reflectionPrompt: '¿Cuánto alteró la secuencia tu sueño, independientemente del resultado del sueño?',
        },
        {
          id: 'wbtb-06', session: 6, title: 'Protege el día siguiente', objective: 'Usa tu funcionamiento diurno como señal de seguridad para otros intentos.', durationMinutes: 8,
          steps: ['Valora con sinceridad la calidad del sueño y tu atención.', 'No repitas WBTB esta noche.', 'Si tienes somnolencia, evita conducir o realizar tareas peligrosas y sigue tu plan de seguridad habitual.'], caution: 'Los datos de entrenamiento nunca son más importantes que la seguridad inmediata o el descanso necesario.', reflectionPrompt: '¿Afectó el intento a tu concentración, ánimo o energía?',
        },
        {
          id: 'wbtb-07', session: 7, title: 'Define un ritmo ocasional', objective: 'Decide si WBTB debe formar parte de tu plan.', durationMinutes: 15,
          steps: ['Compara el sueño, el tiempo para volver a dormir, el recuerdo y la lucidez.', 'Conserva WBTB solo si la alteración fue baja.', 'Elige una frecuencia máxima prudente con noches de recuperación o desactívalo.'], caution: 'No programes WBTB como una obligación diaria; desactivarlo también es un plan completo.', reflectionPrompt: '¿El posible beneficio justifica para ti interrumpir el sueño?',
        },
      ],
    },
  },
  realityChecks: {
    title: 'Pruebas de realidad atentas',
    intro: 'Una buena prueba interrumpe brevemente el piloto automático: observa el contexto, comprueba un detalle estable e imagina reconocer la misma discrepancia en un sueño.',
    qualityPrinciples: ['Haz una pausa antes de actuar.', 'Formula la pregunta con incertidumbre genuina.', 'Usa dos indicios, no solo una costumbre.', 'Termina con una intención tranquila para el siguiente sueño.'],
    exercises: [
      { id: 'text', title: 'Lee dos veces', description: 'Lee una frase corta, aparta la mirada y vuelve a leerla para comprobar si se mantiene estable.' },
      { id: 'time', title: 'Mira la hora dos veces', description: 'Mira la hora, aparta la vista y compárala sin prisas.' },
      { id: 'hands', title: 'Observa tus manos', description: 'Cuenta los dedos y observa forma, textura y continuidad sin intentar provocar una anomalía.' },
      { id: 'context', title: 'Reconstruye el contexto', description: 'Pregúntate cómo has llegado y nombra los dos últimos acontecimientos que recuerdes.' },
    ],
    contextTitle: 'Asocia las pruebas a contextos significativos',
    contextExamples: ['Después de observar algo sorprendente', 'Al entrar en una habitación conocida', 'Cuando se calme una emoción intensa', 'Cuando aparezca despierto una señal onírica personal recurrente'],
    reminderSafety: 'Descarta los recordatorios cuando necesites atender a otra cosa. Nunca hagas una prueba al conducir, cruzar una calle o manejar maquinaria.',
    completionPrompt: '¿Qué indicio has comprobado realmente?',
  },
  nightSignals: {
    title: 'Señales de audio nocturnas opcionales',
    intro: 'Una señal es una invitación suave, no una orden. Su temporizador no conoce tu fase de sueño sin una detección validada por separado; usa tiempos prudentes y valórala por su impacto en tu descanso.',
    optionalLabel: 'Desactivadas al principio',
    setupSteps: ['Escucha el sonido exacto estando completamente despierto.', 'Empieza con el volumen claramente audible más bajo.', 'Elige un temporizador breve con parada automática.', 'Confirma que mañana dispones de una oportunidad normal de recuperación.'],
    safeguards: ['No duermas con cascos o auriculares.', 'No uses señales si molestan a una pareja, un niño o un animal.', 'Omítelas tras dormir mal, durante una enfermedad o con cansancio inusual.', 'Deja de usar una señal si te despierta o sobresalta repetidamente.'],
    previewAction: 'Escuchar despierto', timerLabel: 'Temporizador de parada automática', volumeLabel: 'Volumen suave de la señal', stopAction: 'Detener todas las señales nocturnas',
  },
  morningReview: {
    title: 'Registro de la mañana', intro: 'Anota lo ocurrido antes de interpretarlo. Una noche sin recuerdo o sin lucidez también aporta datos útiles.',
    fields: { technique: 'Técnica utilizada', preparation: 'Preparación completada', dreamRecall: 'Recuerdo del sueño', lucidity: 'Conciencia durante el sueño', sleepQuality: 'Calidad percibida del sueño', personalFactors: 'Factores personales', notes: 'Notas breves' },
    noRecallAction: 'Registrar que no hay recuerdo', saveOfflineNote: 'Primero se guarda en este dispositivo. La sincronización opcional puede realizarse después.', neutralOutcome: 'No tener un sueño lúcido es un resultado habitual. Prioriza el sueño y la práctica atenta.',
  },
  weeklyReview: {
    title: 'Revisión semanal', intro: 'Compara métodos sin convertir una muestra personal pequeña en una conclusión científica.',
    metrics: ['Sesiones completadas', 'Sueños recordados', 'Momentos lúcidos registrados', 'Calidad media percibida del sueño', 'Tiempo necesario para volver a dormir', 'Técnicas omitidas por seguridad'],
    adaptationRules: ['Conserva un método solo si encaja con tu sueño y tu vida cotidiana.', 'Reduce la práctica nocturna si baja la calidad del sueño.', 'Cambia una variable cada vez para comparar con más claridad.', 'Elige el método menos perturbador cuando las observaciones sean parecidas.'],
    coachingNote: 'El acompañamiento sin conexión aplica estas reglas explícitas. Una IA opcional puede resumir tus notas, pero las recomendaciones esenciales no dependen de ella.',
  },
  science: {
    title: 'Ciencia y límites',
    definition: 'Un sueño lúcido es aquel en el que una persona se da cuenta de que sueña mientras el sueño continúa. Conciencia y control son distintos; el control puede ser parcial o inexistente.',
    evidenceSummary: 'La investigación describe el sueño lúcido como un fenómeno del sueño REM y estudia MILD, SSILD y sus combinaciones con WBTB. Los resultados varían y muchos estudios se basan en autoinformes.',
    uncertainty: 'Ningún método permite predecir si una persona tendrá un sueño lúcido ni cuándo. La evidencia sobre efectos a largo plazo e interrupciones frecuentes del sueño sigue siendo limitada.',
    sleepPriority: 'Protege un sueño suficiente y regular. El consenso de AASM y SRS recomienda que los adultos sanos duerman al menos siete horas de forma habitual, aunque las necesidades individuales pueden variar.',
    boundaries: ['Sin afirmaciones asistenciales ni evaluación clínica', 'Sin expectativa de controlar los sueños', 'Sin instrucciones para reducir el sueño necesario', 'No sustituye al apoyo profesional'],
    supportAdvice: 'Pausa el entrenamiento y consulta a un profesional sanitario adecuado si tienes problemas persistentes de sueño, angustia intensa, confusión entre los sueños y la vigilia o preocupaciones sobre tu bienestar mental.',
    referencesTitle: 'Fuentes y lecturas',
  },
  privacy: {
    title: 'Privacidad y tus datos',
    localFirst: 'Los planes, registros y preferencias se guardan primero en el dispositivo para que la experiencia esencial funcione sin conexión.',
    optionalSync: 'La sincronización de cuenta es opcional y resistente; muestra claramente cambios pendientes, fallidos o en conflicto.',
    minimalTransfer: 'Al conectar Noctalia solo se transfiere lo que apruebes, como la técnica y un resultado matinal breve. El texto de los sueños permanece separado salvo que elijas otra cosa expresamente en Noctalia.',
    analytics: 'Las analíticas mínimas de producto permanecen desactivadas hasta que das tu consentimiento y nunca incluyen textos de sueños, notas libres ni audio.',
    sensitiveData: 'Los valores locales sensibles usan la protección de plataforma adecuada para su finalidad; las credenciales de cuenta nunca se guardan en archivos de contenido.',
    exportDelete: 'Puedes exportar una copia legible o eliminar los datos locales y sincronizados desde la gestión de datos.',
    consentControl: 'Puedes revisar o retirar el consentimiento sin bloquear el entrenamiento sin conexión.',
  },
  settings: {
    title: 'Ajustes', reminders: 'Recordatorios de pruebas de realidad', sleepWindow: 'Horario habitual de sueño', nightSignals: 'Señales de audio nocturnas', permissions: 'Permisos', accessibility: 'Accesibilidad y movimiento', language: 'Idioma', appearance: 'Apariencia dinámica, clara, oscura o del sistema', privacy: 'Privacidad y analíticas', dataManagement: 'Exportar y eliminar datos', subscription: 'Noctalia Plus y compras', noctaliaConnection: 'Conexión con Noctalia', scienceAndLimits: 'Ciencia y límites', help: 'Ayuda y seguridad', about: 'Acerca de Lucid Trainer',
  },
} as const satisfies LucidTrainerContent;

export default content;
