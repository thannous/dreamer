import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { type CSSStyle } from 'react-native-reanimated';

import { DURATION, EASE, PressableScale } from '@/components/motion';
import { LucidGuideOrb } from '@/components/lucid/LucidGuideOrb';
import { LucidButton, LucidIconAction, LucidOverline, LucidPill, LucidProgressBar, LucidScreen } from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidIcon, LucidRadius, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useDreamsData } from '@/context/DreamsContext';
import {
  useLucidTrainer,
  type LucidGuidedRitualMutationInput,
} from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidGuidedRitualSound } from '@/hooks/useLucidGuidedRitualSound';
import { useLucidReducedMotion } from '@/hooks/useLucidReducedMotion';
import {
  createLucidGuidedRitualPlan,
  selectLucidMildRehearsalSource,
  type LucidGuidedRitualPhaseId,
  type LucidGuidedRitualPlan,
  type LucidMildRehearsalSource,
} from '@/lib/lucid/guidedRitual';
import type { LucidTrainerContent } from '@/lib/lucid/content';
import type {
  LucidGuidedRitualProgress,
  LucidTechnique,
} from '@/lib/lucid/model';
import { closeLucidRoute } from '@/lib/lucid/routes';
import {
  canUseLucidWbtb,
  evaluateLucidSafetyPolicyFromState,
  evaluateLucidSessionAccess,
} from '@/lib/lucid/safety';

const COPY = {
  en: { guided: 'Guided practice', step: 'Step', reflect: 'After the practice', caution: 'Keep in mind', complete: 'Complete session', done: 'Session completed', invalid: 'Session unavailable', locked: 'This session opens after the previous one. The calendar is only a suggestion.', backToProgram: 'Back to program', stepsChecked: 'Steps checked:', progress: 'Practice progress', personalCue: 'Your confirmed MILD cue' },
  fr: { guided: 'Pratique guidée', step: 'Étape', reflect: 'Après la pratique', caution: 'À garder en tête', complete: 'Terminer la séance', done: 'Séance terminée', invalid: 'Séance indisponible', locked: "Cette séance s'ouvre après la précédente. Le calendrier n’est qu’une suggestion.", backToProgram: 'Retour au programme', stepsChecked: 'Étapes cochées :', progress: 'Progression de la pratique', personalCue: 'Ton indice MILD confirmé' },
  es: { guided: 'Práctica guiada', step: 'Paso', reflect: 'Después de la práctica', caution: 'Ten en cuenta', complete: 'Completar sesión', done: 'Sesión completada', invalid: 'Sesión no disponible', locked: 'Esta sesión se abre después de la anterior. El calendario es solo una sugerencia.', backToProgram: 'Volver al programa', stepsChecked: 'Pasos marcados:', progress: 'Progreso de la práctica', personalCue: 'Tu señal MILD confirmada' },
  de: { guided: 'Geführte Übung', step: 'Schritt', reflect: 'Nach der Übung', caution: 'Beachte', complete: 'Einheit abschließen', done: 'Einheit abgeschlossen', invalid: 'Einheit nicht verfügbar', locked: 'Diese Einheit öffnet sich nach der vorherigen. Der Kalender ist nur ein Vorschlag.', backToProgram: 'Zurück zum Programm', stepsChecked: 'Abgehakte Schritte:', progress: 'Übungsfortschritt', personalCue: 'Dein bestätigtes MILD-Zeichen' },
  it: { guided: 'Pratica guidata', step: 'Passaggio', reflect: 'Dopo la pratica', caution: 'Da ricordare', complete: 'Completa sessione', done: 'Sessione completata', invalid: 'Sessione non disponibile', locked: 'Questa sessione si apre dopo la precedente. Il calendario è solo un suggerimento.', backToProgram: 'Torna al programma', stepsChecked: 'Passi spuntati:', progress: 'Progresso della pratica', personalCue: 'Il tuo segnale MILD confermato' },
} as const;

type GuidedPhaseCopy = Readonly<Record<LucidGuidedRitualPhaseId, Readonly<{
  title: string;
  body: string;
}>>>;

const GUIDED_EN = {
  eyebrow: 'Tonight’s intention',
  start: 'Begin the ritual',
  resume: 'Resume where I stopped',
  preparing: 'Preparing your ritual…',
  phase: 'Phase',
  of: 'of',
  approximately: 'About',
  minutes: 'minutes',
  secondaryTechnique: 'Technique',
  reduced: 'Shortened to protect sleep',
  replacement: 'Recovery ritual tonight',
  missingTitle: 'Prepare one personal cue first',
  missingBody: 'MILD needs a recent journal dream and a dream sign you confirmed yourself.',
  missingAction: 'Open dream signs',
  saveAndClose: 'Save progress and close',
  saveError: 'Your progress could not be saved. Try again before closing.',
  mildDream: 'Recent dream',
  confirmedSign: 'Confirmed sign',
  intentionStart: 'If I notice',
  intentionEnd: 'I will recognize that I am dreaming.',
  objective: {
    remember_and_recognize: 'Recognize a familiar sign inside your next dream.',
    notice_the_senses: 'Let sight, sound and sensation become quiet anchors.',
    protect_sleep: 'Release the technique and protect tonight’s sleep.',
  },
  phases: {
    mild_intention: { title: 'Set one intention', body: 'Let the sentence feel calm, precise and believable.' },
    mild_recall: { title: 'Return to the dream', body: 'Recall the scene without trying to change it yet.' },
    mild_recognize: { title: 'Notice the sign', body: 'Imagine recognizing this detail as evidence that you are dreaming.' },
    mild_rehearse: { title: 'Rehearse recognition', body: 'Repeat the intention gently while the scene stays vivid.' },
    mild_release: { title: 'Let the dream come', body: 'Drop the effort. Keep only the intention as you settle.' },
    ssild_settle: { title: 'Settle', body: 'Do nothing to create an experience.' },
    ssild_sight: { title: 'Sight', body: 'Notice the darkness behind your eyelids.' },
    ssild_sound: { title: 'Sound', body: 'Notice the nearest and farthest sound.' },
    ssild_body: { title: 'Sensation', body: 'Notice weight, warmth and contact.' },
    ssild_slow_cycle: { title: 'One slow cycle', body: 'Sight. Sound. Sensation. No forcing.' },
    ssild_release: { title: 'Release', body: 'Stop checking. Let sleep continue.' },
    recovery_settle: { title: 'Nothing to achieve', body: 'Tonight, sleep matters more than practice.' },
    recovery_release: { title: 'Return to rest', body: 'Soften the breath and let the technique go.' },
  } satisfies GuidedPhaseCopy,
} as const;

const GUIDED_COPY = {
  en: GUIDED_EN,
  fr: {
    ...GUIDED_EN,
    eyebrow: 'Intention de ce soir', start: 'Commencer le rituel', resume: 'Reprendre où je me suis arrêté', preparing: 'Préparation du rituel…', phase: 'Phase', of: 'sur', approximately: 'Environ', minutes: 'minutes', secondaryTechnique: 'Technique', reduced: 'Raccourci pour protéger le sommeil', replacement: 'Rituel de récupération ce soir', missingTitle: 'Préparez d’abord un repère personnel', missingBody: 'MILD nécessite un rêve récent du journal et un signe onirique que vous avez confirmé.', missingAction: 'Ouvrir les signes oniriques', saveAndClose: 'Enregistrer et fermer', saveError: 'Votre progression n’a pas pu être enregistrée. Réessayez avant de fermer.', mildDream: 'Rêve récent', confirmedSign: 'Signe confirmé', intentionStart: 'Si je remarque', intentionEnd: 'je reconnaîtrai que je rêve.',
    objective: { remember_and_recognize: 'Reconnaître un signe familier dans votre prochain rêve.', notice_the_senses: 'Laisser la vue, l’ouïe et les sensations devenir des repères calmes.', protect_sleep: 'Relâcher la technique et protéger votre sommeil cette nuit.' },
    phases: {
      mild_intention: { title: 'Poser une intention', body: 'Laissez la phrase devenir calme, précise et crédible.' }, mild_recall: { title: 'Revenir au rêve', body: 'Rappelez la scène sans chercher encore à la modifier.' }, mild_recognize: { title: 'Reconnaître le signe', body: 'Imaginez reconnaître ce détail comme l’indice que vous rêvez.' }, mild_rehearse: { title: 'Répéter la reconnaissance', body: 'Répétez doucement l’intention en gardant la scène présente.' }, mild_release: { title: 'Laisser venir le rêve', body: 'Relâchez l’effort. Gardez seulement l’intention.' }, ssild_settle: { title: 'S’apaiser', body: 'Ne cherchez à produire aucune expérience.' }, ssild_sight: { title: 'Vue', body: 'Remarquez l’obscurité derrière vos paupières.' }, ssild_sound: { title: 'Ouïe', body: 'Remarquez le son le plus proche puis le plus lointain.' }, ssild_body: { title: 'Sensations', body: 'Remarquez le poids, la chaleur et les points de contact.' }, ssild_slow_cycle: { title: 'Un cycle lent', body: 'Vue. Ouïe. Sensations. Sans forcer.' }, ssild_release: { title: 'Relâcher', body: 'Cessez de vérifier. Laissez le sommeil continuer.' }, recovery_settle: { title: 'Rien à réussir', body: 'Ce soir, le sommeil compte plus que la pratique.' }, recovery_release: { title: 'Revenir au repos', body: 'Adoucissez le souffle et laissez partir la technique.' },
    } satisfies GuidedPhaseCopy,
  },
  es: {
    ...GUIDED_EN,
    eyebrow: 'Intención de esta noche', start: 'Comenzar el ritual', resume: 'Retomar donde lo dejé', preparing: 'Preparando el ritual…', phase: 'Fase', of: 'de', approximately: 'Unos', minutes: 'minutos', secondaryTechnique: 'Técnica', reduced: 'Acortado para proteger el sueño', replacement: 'Ritual de recuperación esta noche', missingTitle: 'Prepara primero una señal personal', missingBody: 'MILD necesita un sueño reciente del diario y una señal onírica confirmada por ti.', missingAction: 'Abrir señales oníricas', saveAndClose: 'Guardar y cerrar', saveError: 'No se pudo guardar tu progreso. Inténtalo de nuevo antes de cerrar.', mildDream: 'Sueño reciente', confirmedSign: 'Señal confirmada', intentionStart: 'Si noto', intentionEnd: 'reconoceré que estoy soñando.',
    objective: { remember_and_recognize: 'Reconoce una señal familiar dentro de tu próximo sueño.', notice_the_senses: 'Deja que vista, oído y sensaciones sean anclas tranquilas.', protect_sleep: 'Suelta la técnica y protege el sueño de esta noche.' },
    phases: {
      mild_intention: { title: 'Fija una intención', body: 'Deja que la frase sea tranquila, precisa y creíble.' }, mild_recall: { title: 'Vuelve al sueño', body: 'Recuerda la escena sin intentar cambiarla.' }, mild_recognize: { title: 'Reconoce la señal', body: 'Imagina reconocer este detalle como prueba de que sueñas.' }, mild_rehearse: { title: 'Ensaya el reconocimiento', body: 'Repite suavemente la intención con la escena presente.' }, mild_release: { title: 'Deja llegar el sueño', body: 'Suelta el esfuerzo. Conserva solo la intención.' }, ssild_settle: { title: 'Calma', body: 'No intentes producir ninguna experiencia.' }, ssild_sight: { title: 'Vista', body: 'Nota la oscuridad tras los párpados.' }, ssild_sound: { title: 'Oído', body: 'Nota el sonido más cercano y el más lejano.' }, ssild_body: { title: 'Sensación', body: 'Nota peso, calor y contacto.' }, ssild_slow_cycle: { title: 'Un ciclo lento', body: 'Vista. Oído. Sensación. Sin forzar.' }, ssild_release: { title: 'Suelta', body: 'Deja de comprobar. Permite que siga el sueño.' }, recovery_settle: { title: 'Nada que lograr', body: 'Esta noche, dormir importa más que practicar.' }, recovery_release: { title: 'Vuelve al descanso', body: 'Suaviza la respiración y suelta la técnica.' },
    } satisfies GuidedPhaseCopy,
  },
  de: {
    ...GUIDED_EN,
    eyebrow: 'Absicht für heute Abend', start: 'Ritual beginnen', resume: 'An der letzten Stelle fortsetzen', preparing: 'Ritual wird vorbereitet…', phase: 'Phase', of: 'von', approximately: 'Etwa', minutes: 'Minuten', secondaryTechnique: 'Technik', reduced: 'Zum Schutz des Schlafs verkürzt', replacement: 'Heute Erholungsritual', missingTitle: 'Bereite zuerst einen persönlichen Hinweis vor', missingBody: 'MILD braucht einen aktuellen Traum und ein selbst bestätigtes Traumzeichen.', missingAction: 'Traumzeichen öffnen', saveAndClose: 'Speichern und schließen', saveError: 'Dein Fortschritt konnte nicht gespeichert werden. Versuche es vor dem Schließen erneut.', mildDream: 'Aktueller Traum', confirmedSign: 'Bestätigtes Zeichen', intentionStart: 'Wenn ich', intentionEnd: 'erkenne ich, dass ich träume.',
    objective: { remember_and_recognize: 'Erkenne im nächsten Traum ein vertrautes Zeichen.', notice_the_senses: 'Lass Sehen, Hören und Empfinden zu ruhigen Ankern werden.', protect_sleep: 'Lass die Technik los und schütze heute deinen Schlaf.' },
    phases: {
      mild_intention: { title: 'Eine Absicht setzen', body: 'Lass den Satz ruhig, klar und glaubwürdig werden.' }, mild_recall: { title: 'Zum Traum zurückkehren', body: 'Erinnere die Szene, ohne sie zu verändern.' }, mild_recognize: { title: 'Das Zeichen erkennen', body: 'Stell dir vor, dieses Detail als Traumhinweis zu erkennen.' }, mild_rehearse: { title: 'Erkennen proben', body: 'Wiederhole die Absicht sanft mit der Szene vor Augen.' }, mild_release: { title: 'Den Traum kommen lassen', body: 'Lass die Anstrengung los. Behalte nur die Absicht.' }, ssild_settle: { title: 'Ankommen', body: 'Versuche keine Erfahrung zu erzeugen.' }, ssild_sight: { title: 'Sehen', body: 'Nimm die Dunkelheit hinter den Lidern wahr.' }, ssild_sound: { title: 'Hören', body: 'Nimm den nächsten und fernsten Klang wahr.' }, ssild_body: { title: 'Empfinden', body: 'Nimm Gewicht, Wärme und Kontakt wahr.' }, ssild_slow_cycle: { title: 'Ein langsamer Zyklus', body: 'Sehen. Hören. Empfinden. Ohne Druck.' }, ssild_release: { title: 'Loslassen', body: 'Hör auf zu prüfen. Lass den Schlaf weitergehen.' }, recovery_settle: { title: 'Nichts erreichen', body: 'Heute ist Schlaf wichtiger als Übung.' }, recovery_release: { title: 'Zur Ruhe zurück', body: 'Lass den Atem weich werden und die Technik gehen.' },
    } satisfies GuidedPhaseCopy,
  },
  it: {
    ...GUIDED_EN,
    eyebrow: 'Intenzione di stasera', start: 'Inizia il rituale', resume: 'Riprendi da dove eri', preparing: 'Preparazione del rituale…', phase: 'Fase', of: 'di', approximately: 'Circa', minutes: 'minuti', secondaryTechnique: 'Tecnica', reduced: 'Ridotto per proteggere il sonno', replacement: 'Rituale di recupero stasera', missingTitle: 'Prepara prima un segnale personale', missingBody: 'MILD richiede un sogno recente e un segnale onirico confermato da te.', missingAction: 'Apri i segnali onirici', saveAndClose: 'Salva e chiudi', saveError: 'Non è stato possibile salvare i progressi. Riprova prima di chiudere.', mildDream: 'Sogno recente', confirmedSign: 'Segnale confermato', intentionStart: 'Se noto', intentionEnd: 'riconoscerò che sto sognando.',
    objective: { remember_and_recognize: 'Riconosci un segnale familiare nel prossimo sogno.', notice_the_senses: 'Lascia che vista, udito e sensazioni diventino ancore tranquille.', protect_sleep: 'Lascia andare la tecnica e proteggi il sonno di stanotte.' },
    phases: {
      mild_intention: { title: 'Forma un’intenzione', body: 'Lascia che la frase sia calma, precisa e credibile.' }, mild_recall: { title: 'Torna al sogno', body: 'Ricorda la scena senza provare a cambiarla.' }, mild_recognize: { title: 'Riconosci il segnale', body: 'Immagina di riconoscere questo dettaglio come prova del sogno.' }, mild_rehearse: { title: 'Prova il riconoscimento', body: 'Ripeti piano l’intenzione mantenendo viva la scena.' }, mild_release: { title: 'Lascia arrivare il sogno', body: 'Lascia lo sforzo. Conserva solo l’intenzione.' }, ssild_settle: { title: 'Calma', body: 'Non cercare di produrre alcuna esperienza.' }, ssild_sight: { title: 'Vista', body: 'Nota il buio dietro le palpebre.' }, ssild_sound: { title: 'Udito', body: 'Nota il suono più vicino e quello più lontano.' }, ssild_body: { title: 'Sensazioni', body: 'Nota peso, calore e contatto.' }, ssild_slow_cycle: { title: 'Un ciclo lento', body: 'Vista. Udito. Sensazioni. Senza forzare.' }, ssild_release: { title: 'Lascia andare', body: 'Smetti di controllare. Lascia continuare il sonno.' }, recovery_settle: { title: 'Nulla da ottenere', body: 'Stasera il sonno conta più della pratica.' }, recovery_release: { title: 'Torna al riposo', body: 'Ammorbidisci il respiro e lascia la tecnica.' },
    } satisfies GuidedPhaseCopy,
  },
} as const;

const GUIDED_PHASE_ICONS: Readonly<Record<LucidGuidedRitualPhaseId, React.ComponentProps<typeof Ionicons>['name']>> = {
  mild_intention: 'moon-outline', mild_recall: 'images-outline', mild_recognize: 'eye-outline', mild_rehearse: 'sparkles-outline', mild_release: 'cloudy-night-outline', ssild_settle: 'moon-outline', ssild_sight: 'eye-outline', ssild_sound: 'ear-outline', ssild_body: 'body-outline', ssild_slow_cycle: 'sync-outline', ssild_release: 'cloudy-night-outline', recovery_settle: 'shield-checkmark-outline', recovery_release: 'bed-outline',
};

const PROGRAM_ART: Readonly<Record<LucidTechnique, number>> = {
  mild: require('../../../../assets/images/lucid/program-mild-destination.png'),
  ssild: require('../../../../assets/images/lucid/program-ssild-destination.png'),
  wbtb: require('../../../../assets/images/lucid/program-wbtb-destination.png'),
};

function isTechnique(value: string | string[] | undefined): value is LucidTechnique {
  return value === 'mild' || value === 'ssild' || value === 'wbtb';
}

function sessionFallback(program: string | string[] | undefined): Href {
  return isTechnique(program) ? `/lucid/program/${program}` : '/lucid/(tabs)/programs';
}

export default function LucidSessionScreen() {
  const params = useLocalSearchParams<{ program: string; session: string }>();
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { dreams } = useDreamsData();
  const reduceMotion = useLucidReducedMotion();
  const {
    state,
    content,
    activeDreamSigns = [],
    completeProgramSession,
    updateGuidedRitual,
    completeGuidedRitualSession,
  } = useLucidTrainer();
  const copy = COPY[content.locale];
  const sessionNumber = Number(params.session);
  const valid = isTechnique(params.program) && Number.isInteger(sessionNumber) && sessionNumber >= 1 && sessionNumber <= content.programs[params.program].sessions.length;
  const technique = valid && isTechnique(params.program) ? params.program : null;
  const program = technique ? content.programs[technique] : null;
  const session = program?.sessions[sessionNumber - 1];
  const programProgress = valid && isTechnique(params.program)
    ? state!.progress.find((item) => item.technique === params.program)
    : undefined;
  const access = evaluateLucidSessionAccess({
    sessionNumber,
    sessionCount: program?.sessions.length ?? 0,
    exerciseId: session?.id,
    progress: programProgress,
  });
  const safetyPolicy = evaluateLucidSafetyPolicyFromState(state);
  const guidedPlanResult = technique
    ? createLucidGuidedRitualPlan(technique, safetyPolicy)
    : { status: 'blocked' as const, reason: 'unsupported_technique' as const };
  const mildSource = useMemo(
    () => selectLucidMildRehearsalSource(dreams, activeDreamSigns),
    [activeDreamSigns, dreams]
  );
  const wbtbBlocked =
    isTechnique(params.program) &&
    params.program === 'wbtb' &&
    !canUseLucidWbtb(safetyPolicy) &&
    access.reason !== 'completed';
  const alreadyDone = access.reason === 'completed';
  const [checked, setChecked] = useState<boolean[]>(() => session?.steps.map(() => false) ?? []);
  const [saving, setSaving] = useState(false);
  const progress = useMemo(() => checked.length ? checked.filter(Boolean).length / checked.length : 0, [checked]);
  const close = () => closeLucidRoute(router, sessionFallback(params.program));

  if (!program || !session || !technique || !access.allowed || wbtbBlocked) {
    const locked = access.reason === 'sequential_lock';
    return (
      <LucidScreen
        title={copy.invalid}
        subtitle={locked ? copy.locked : undefined}
        trailing={<LucidIconAction label={content.chrome.common.back} icon="close" onPress={close} />}
      >
        <LucidButton
          label={locked ? copy.backToProgram : content.chrome.common.back}
          onPress={close}
          testID="lucid-session-unavailable-back"
        />
      </LucidScreen>
    );
  }

  if (
    !alreadyDone &&
    (technique === 'mild' || technique === 'ssild') &&
    guidedPlanResult.status === 'ready'
  ) {
    return (
      <GuidedRitualSession
        activeDreamSource={mildSource}
        close={close}
        completeSession={() =>
          completeGuidedRitualSession(
            technique,
            session.id,
            session.session,
            program.sessions.length
          )
        }
        content={content}
        exerciseId={session.id}
        plan={guidedPlanResult}
        progress={programProgress?.guidedRitual}
        reduceMotion={reduceMotion}
        sessionCount={program.sessions.length}
        sessionNumber={session.session}
        soundEnabled={
          guidedPlanResult.soundAllowed && state?.preferences.audioCuesEnabled === true
        }
        techniqueLabel={program.title}
        update={updateGuidedRitual}
      />
    );
  }

  const finish = async () => {
    setSaving(true);
    try {
      await completeProgramSession(technique, session.id, session.session, program.sessions.length);
      // Terminer une séance est une validation rare : elle mérite le retour que
      // le corps perçoit sans regarder. Jamais seul — l'alerte reste.
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(copy.done, session.reflectionPrompt, [{ text: content.chrome.common.done, onPress: close }]);
    } finally { setSaving(false); }
  };

  const checkedCount = alreadyDone ? session.steps.length : checked.filter(Boolean).length;

  return (
    <LucidScreen
      testID="lucid-session"
      footer={
        <LucidButton
          label={alreadyDone ? copy.done : copy.complete}
          icon="checkmark-circle"
          disabled={!alreadyDone && progress < 1}
          disabledReason={`${copy.stepsChecked} ${checkedCount} / ${checked.length}`}
          loading={saving}
          onPress={() => alreadyDone ? close() : void finish()}
          testID="lucid-session-complete"
        />
      }
    >
      <View style={styles.hero}>
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          cachePolicy="memory-disk"
          contentFit="cover"
          source={PROGRAM_ART[technique]}
          style={StyleSheet.absoluteFill}
          testID="lucid-session-art"
        />
        <LinearGradient
          colors={[`${palette.backgroundDeep}B3`, 'transparent', `${palette.backgroundDeep}8C`, palette.backgroundDeep]}
          locations={[0, 0.28, 0.55, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroContent}>
          <View style={styles.heroTopRow}>
            <LucidOverline text={`${program.title} · ${copy.guided}`} />
            <LucidIconAction label={content.chrome.common.back} icon="close" onPress={close} />
          </View>
          <View style={styles.heroCopy}>
            <View style={styles.meta}>
              <LucidPill label={`${session.durationMinutes} min`} tone="neutral" icon="time-outline" />
              <LucidPill label={`${session.session} / ${program.sessions.length}`} tone="neutral" icon="calendar-outline" />
            </View>
            <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{session.title}</Text>
            <Text style={[styles.objective, { color: palette.textSecondary }]}>{session.objective}</Text>
          </View>
        </View>
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressCopy}>
          <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>{copy.progress}</Text>
          <Text style={[styles.progressValue, { color: palette.accent }]}>{checkedCount} / {session.steps.length}</Text>
        </View>
        <LucidProgressBar
          value={alreadyDone ? 1 : progress}
          accessibilityLabel={`${copy.progress}, ${checkedCount} / ${session.steps.length}`}
        />
      </View>

      {technique === 'mild' && activeDreamSigns.length > 0 ? (
        <View
          accessible
          accessibilityLabel={`${copy.personalCue}: ${activeDreamSigns[0].label}`}
          style={[styles.personalCue, { backgroundColor: palette.accentSoft, borderColor: palette.accent }]}
          testID="lucid-session-personal-dream-sign"
        >
          <Ionicons name="shapes-outline" size={LucidIcon.md} color={palette.accent} />
          <View style={styles.personalCueCopy}>
            <LucidOverline text={copy.personalCue} tone="accent" />
            <Text style={[styles.personalCueText, { color: palette.text }]}>{activeDreamSigns[0].label}</Text>
          </View>
        </View>
      ) : null}

      <View accessibilityRole="list" style={[styles.steps, { borderColor: palette.border }]}>
        {session.steps.map((stepText, index) => {
          const done = alreadyDone || checked[index];
          return (
            <PressableScale
              key={`${session.id}-${index}`}
              accessibilityLabel={`${copy.step} ${index + 1}: ${stepText}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done, disabled: alreadyDone }}
              disabled={alreadyDone}
              onPress={() => setChecked((values) => values.map((value, itemIndex) => itemIndex === index ? !value : value))}
              style={[styles.stepRow, index > 0 && { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth }]}
              testID={`lucid-session-step-${index + 1}`}
              transitionProperties={['backgroundColor']}
            >
              <View style={[styles.check, { backgroundColor: done ? palette.accent : 'transparent', borderColor: done ? palette.accent : palette.borderInteractive }]}>
                {done ? <Ionicons name="checkmark" size={LucidIcon.sm} color={palette.backgroundDeep} /> : <Text style={[styles.checkNumber, { color: palette.textSecondary }]}>{index + 1}</Text>}
              </View>
              <Text style={[styles.stepText, { color: done ? palette.textSecondary : palette.text }]}>{stepText}</Text>
            </PressableScale>
          );
        })}
      </View>

      <View accessible accessibilityLabel={`${copy.caution}. ${session.caution}`} style={[styles.notice, { backgroundColor: palette.amberSoft }]}>
        <Ionicons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name="shield-checkmark-outline" size={LucidIcon.md} color={palette.amber} />
        <View style={styles.noticeCopy}>
          <LucidOverline text={copy.caution} tone="amber" />
          <Text style={[styles.noticeText, { color: palette.textSecondary }]}>{session.caution}</Text>
        </View>
      </View>

      {alreadyDone || progress === 1 ? (
        <View style={[styles.reflectionBlock, { borderTopColor: palette.border }]} testID="lucid-session-reflection">
          <LucidOverline text={copy.reflect} tone="accent" />
          <Text style={[styles.reflection, { color: palette.text }]}>{session.reflectionPrompt}</Text>
        </View>
      ) : null}
    </LucidScreen>
  );
}

type GuidedCopy = (typeof GUIDED_COPY)[keyof typeof GUIDED_COPY];

export function getLucidGuidedPhaseMotion(reduceMotion: boolean): CSSStyle {
  return {
    animationName: {
      from: {
        opacity: 0,
        ...(reduceMotion ? null : { transform: [{ translateY: 8 }] }),
      },
      to: {
        opacity: 1,
        ...(reduceMotion ? null : { transform: [{ translateY: 0 }] }),
      },
    },
    animationDuration: DURATION.fast,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  };
}

function guidedPhaseBody(
  copy: GuidedCopy,
  phaseId: LucidGuidedRitualPhaseId,
  source: LucidMildRehearsalSource | null
): string {
  const base = copy.phases[phaseId].body;
  if (!source) return base;

  const intention = `${copy.intentionStart} ${source.signLabel}, ${copy.intentionEnd}`;
  if (phaseId === 'mild_recall') {
    return `${source.dreamTitle || copy.mildDream}. ${source.dreamExcerpt}`;
  }
  if (phaseId === 'mild_recognize') {
    return `${base} ${copy.confirmedSign}: ${source.signLabel}.`;
  }
  if (phaseId === 'mild_intention' || phaseId === 'mild_rehearse') {
    return `${base} ${intention}`;
  }
  return base;
}

function GuidedRitualSession({
  activeDreamSource,
  close,
  completeSession,
  content,
  exerciseId,
  plan,
  progress,
  reduceMotion,
  sessionCount,
  sessionNumber,
  soundEnabled,
  techniqueLabel,
  update,
}: {
  activeDreamSource: LucidMildRehearsalSource | null;
  close: () => void;
  completeSession: () => Promise<void>;
  content: LucidTrainerContent;
  exerciseId: string;
  plan: LucidGuidedRitualPlan;
  progress?: LucidGuidedRitualProgress;
  reduceMotion: boolean;
  sessionCount: number;
  sessionNumber: number;
  soundEnabled: boolean;
  techniqueLabel: string;
  update: (
    input: LucidGuidedRitualMutationInput
  ) => Promise<LucidGuidedRitualProgress>;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const copy = GUIDED_COPY[content.locale];
  const sessionId = `${plan.technique}:${exerciseId}`;
  const [optimisticProgress, setOptimisticProgress] = useState<LucidGuidedRitualProgress>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const { playTransition, stop } = useLucidGuidedRitualSound(soundEnabled);

  const currentProgress =
    optimisticProgress?.sessionId === sessionId &&
    (!progress || optimisticProgress.updatedAt > progress.updatedAt)
      ? optimisticProgress
      : progress;

  const matchingProgress =
    currentProgress?.sessionId === sessionId ? currentProgress : undefined;
  const compatibleProgress =
    matchingProgress?.mode === plan.mode &&
    matchingProgress.stepCount === plan.phases.length
      ? matchingProgress
      : undefined;
  const activeProgress =
    compatibleProgress?.status === 'in_progress' ? compatibleProgress : undefined;
  const canResume = compatibleProgress?.status === 'abandoned';
  const needsMildSource = plan.technique === 'mild' && plan.mode !== 'replacement';
  const phase = activeProgress ? plan.phases[activeProgress.stepIndex] : undefined;
  const mutationBase = useMemo<Omit<LucidGuidedRitualMutationInput, 'action'>>(
    () => ({
      technique: plan.technique,
      exerciseId,
      sessionNumber,
      sessionCount,
    }),
    [exerciseId, plan.technique, sessionCount, sessionNumber]
  );

  const startOrResume = useCallback(async () => {
    if (busyRef.current || (needsMildSource && !activeDreamSource)) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = await update({
        ...mutationBase,
        action: matchingProgress ? 'resume' : 'start',
      });
      setOptimisticProgress(saved);
      const firstPhase = plan.phases[saved.stepIndex];
      if (firstPhase) {
        AccessibilityInfo.announceForAccessibility(copy.phases[firstPhase.id].title);
      }
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      void playTransition();
    } catch {
      setError(copy.saveError);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [
    activeDreamSource,
    copy.phases,
    copy.saveError,
    matchingProgress,
    mutationBase,
    needsMildSource,
    plan.phases,
    playTransition,
    update,
  ]);

  const advanceOrComplete = useCallback(async () => {
    if (!activeProgress || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (activeProgress.stepIndex === activeProgress.stepCount - 1) {
        await completeSession();
        await stop();
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        close();
        return;
      }

      const saved = await update({ ...mutationBase, action: 'advance' });
      setOptimisticProgress(saved);
      const nextPhase = plan.phases[saved.stepIndex];
      if (nextPhase) {
        AccessibilityInfo.announceForAccessibility(copy.phases[nextPhase.id].title);
      }
      void playTransition();
    } catch {
      setError(copy.saveError);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [
    activeProgress,
    close,
    completeSession,
    copy.phases,
    copy.saveError,
    mutationBase,
    plan.phases,
    playTransition,
    stop,
    update,
  ]);

  const saveAndClose = useCallback(async () => {
    if (!activeProgress) {
      close();
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = await update({ ...mutationBase, action: 'abandon' });
      setOptimisticProgress(saved);
      await stop();
      close();
    } catch {
      setError(copy.saveError);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [activeProgress, close, copy.saveError, mutationBase, stop, update]);

  useEffect(() => {
    if (!activeProgress || !phase) return;
    const elapsedMs = Math.max(0, Date.now() - activeProgress.stepStartedAt);
    const remainingMs = Math.max(0, phase.durationSeconds * 1_000 - elapsedMs);
    const timer = setTimeout(() => {
      void advanceOrComplete();
    }, remainingMs);
    return () => clearTimeout(timer);
  }, [activeProgress, advanceOrComplete, phase]);

  if (!activeProgress || !phase) {
    const modeNotice =
      plan.mode === 'replacement'
        ? copy.replacement
        : plan.mode === 'reduced'
          ? copy.reduced
          : null;
    const blockedByMissingSource = needsMildSource && !activeDreamSource;
    return (
      <LucidScreen
        contentStyle={styles.guidedScreenContent}
        eyebrow={copy.eyebrow}
        footer={
          <LucidButton
            icon={blockedByMissingSource ? 'shapes-outline' : 'moon-outline'}
            label={blockedByMissingSource ? copy.missingAction : canResume ? copy.resume : copy.start}
            loading={busy}
            onPress={() => {
              if (blockedByMissingSource) router.push('/lucid/dream-signs' as Href);
              else void startOrResume();
            }}
            testID={blockedByMissingSource ? 'lucid-guided-open-signs' : 'lucid-guided-start'}
          />
        }
        testID="lucid-guided-intro"
        title={copy.objective[plan.objective]}
        trailing={
          <LucidIconAction
            icon="close"
            label={content.chrome.common.cancel}
            onPress={close}
          />
        }
      >
        <View style={styles.guidedIntroMeta}>
          <LucidPill label={`${copy.secondaryTechnique} · ${techniqueLabel}`} tone="neutral" icon="sparkles-outline" />
          <LucidPill
            label={`${copy.approximately} ${Math.ceil(plan.totalDurationSeconds / 60)} ${copy.minutes}`}
            tone="neutral"
            icon="time-outline"
          />
        </View>
        {modeNotice ? (
          <View
            accessible
            accessibilityLabel={modeNotice}
            style={[styles.guidedNotice, { backgroundColor: palette.amberSoft }]}
          >
            <Ionicons name="shield-checkmark-outline" size={LucidIcon.md} color={palette.amber} />
            <Text style={[styles.guidedNoticeText, { color: palette.textSecondary }]}>{modeNotice}</Text>
          </View>
        ) : null}
        {blockedByMissingSource ? (
          <View style={[styles.guidedSourceCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text accessibilityRole="header" style={[styles.guidedSourceTitle, { color: palette.text }]}>{copy.missingTitle}</Text>
            <Text style={[styles.guidedBody, { color: palette.textSecondary }]}>{copy.missingBody}</Text>
          </View>
        ) : activeDreamSource ? (
          <MildSourceCard copy={copy} palette={palette} source={activeDreamSource} />
        ) : null}
        {error ? <Text accessibilityLiveRegion="assertive" style={[styles.guidedError, { color: palette.danger }]}>{error}</Text> : null}
      </LucidScreen>
    );
  }

  const phaseCopy = copy.phases[phase.id];

  return (
    <LucidScreen
      contentStyle={styles.guidedScreenContent}
      eyebrow={copy.eyebrow}
      testID="lucid-guided-active"
      trailing={
        <LucidIconAction
          icon="close"
          label={copy.saveAndClose}
          onPress={() => void saveAndClose()}
        />
      }
    >
      <View style={styles.guidedActiveMeta}>
        <LucidPill label={`${copy.secondaryTechnique} · ${techniqueLabel}`} tone="neutral" icon="sparkles-outline" />
        <Text style={[styles.guidedPhaseCount, { color: palette.textSecondary }]}>{`${copy.phase} ${activeProgress.stepIndex + 1} ${copy.of} ${activeProgress.stepCount}`}</Text>
      </View>
      <View
        accessibilityLabel={`${copy.phase} ${activeProgress.stepIndex + 1} ${copy.of} ${activeProgress.stepCount}`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: activeProgress.stepCount, now: activeProgress.stepIndex + 1 }}
        style={[styles.guidedTimerTrack, { backgroundColor: palette.surfaceRaised }]}
      >
        <GuidedPhaseTimer
          color={palette.accent}
          durationSeconds={phase.durationSeconds}
          key={activeProgress.stepStartedAt}
          reduceMotion={reduceMotion}
          startedAt={activeProgress.stepStartedAt}
        />
      </View>
      <LucidGuideOrb
        accessibilityLabel={copy.eyebrow}
        active={!busy}
        reduceMotion={reduceMotion}
        testID="lucid-guided-orb"
      />
      <Animated.View
        accessibilityLiveRegion="polite"
        key={`${activeProgress.sessionId}:${activeProgress.stepIndex}`}
        style={[
          styles.guidedPhaseCard,
          { backgroundColor: palette.surface, borderColor: palette.border },
          getLucidGuidedPhaseMotion(reduceMotion),
        ] as StyleProp<ViewStyle>}
        testID={`lucid-guided-phase-${phase.id}`}
      >
        <View style={[styles.guidedPhaseIcon, { backgroundColor: palette.accentSoft }]}>
          <Ionicons name={GUIDED_PHASE_ICONS[phase.id]} size={LucidIcon.lg} color={palette.accent} />
        </View>
        <Text accessibilityRole="header" style={[styles.guidedPhaseTitle, { color: palette.text }]}>{phaseCopy.title}</Text>
        <Text style={[styles.guidedPhaseBody, { color: palette.textSecondary }]}>{guidedPhaseBody(copy, phase.id, activeDreamSource)}</Text>
      </Animated.View>
      {activeDreamSource && phase.id.startsWith('mild_') ? (
        <MildSourceCard copy={copy} palette={palette} source={activeDreamSource} compact />
      ) : null}
      {error ? <Text accessibilityLiveRegion="assertive" style={[styles.guidedError, { color: palette.danger }]}>{error}</Text> : null}
    </LucidScreen>
  );
}

function GuidedPhaseTimer({
  color,
  durationSeconds,
  reduceMotion,
  startedAt,
}: {
  color: string;
  durationSeconds: number;
  reduceMotion: boolean;
  startedAt: number;
}) {
  const [mountedAt] = useState(Date.now);
  const durationMs = durationSeconds * 1_000;
  const elapsedRatio = Math.min(1, Math.max(0, mountedAt - startedAt) / durationMs);
  const remainingMs = Math.max(0, durationMs - Math.max(0, mountedAt - startedAt));
  const fillMotion: CSSStyle = reduceMotion
    ? { width: `${elapsedRatio * 100}%` }
    : {
        animationName: {
          from: { width: `${elapsedRatio * 100}%` },
          to: { width: '100%' },
        },
        animationDuration: remainingMs,
        animationTimingFunction: 'linear',
        animationFillMode: 'both',
      };

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.guidedTimerFill,
        { backgroundColor: color },
        fillMotion,
      ] as StyleProp<ViewStyle>}
    />
  );
}

function MildSourceCard({
  compact = false,
  copy,
  palette,
  source,
}: {
  compact?: boolean;
  copy: GuidedCopy;
  palette: ReturnType<typeof getLucidPalette>;
  source: LucidMildRehearsalSource;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${copy.mildDream}: ${source.dreamTitle}. ${copy.confirmedSign}: ${source.signLabel}`}
      style={[
        styles.guidedSourceCard,
        compact && styles.guidedSourceCardCompact,
        { backgroundColor: palette.accentSoft, borderColor: palette.accent },
      ]}
      testID="lucid-guided-mild-source"
    >
      <View style={styles.guidedSourceRow}>
        <Ionicons name="images-outline" size={LucidIcon.md} color={palette.accent} />
        <View style={styles.guidedSourceCopy}>
          <LucidOverline text={copy.mildDream} tone="accent" />
          <Text style={[styles.guidedSourceTitle, { color: palette.text }]}>{source.dreamTitle || source.dreamExcerpt}</Text>
        </View>
      </View>
      <View style={styles.guidedSourceRow}>
        <Ionicons name="shapes-outline" size={LucidIcon.md} color={palette.accent} />
        <View style={styles.guidedSourceCopy}>
          <LucidOverline text={copy.confirmedSign} tone="accent" />
          <Text style={[styles.guidedSourceSign, { color: palette.accentOn }]}>{source.signLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 280, borderRadius: LucidRadius.xl, overflow: 'hidden' },
  heroContent: { minHeight: 280, flex: 1, justifyContent: 'space-between', padding: LucidSpace.lg },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: LucidSpace.md },
  heroCopy: { gap: LucidSpace.sm },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.xs },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: LucidType.h1[0], lineHeight: LucidType.h1[1], letterSpacing: -0.4 },
  objective: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  progressBlock: { gap: LucidSpace.sm, paddingHorizontal: LucidSpace.xs },
  progressCopy: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: LucidSpace.md },
  progressLabel: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  progressValue: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  personalCue: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md, borderWidth: 1, borderRadius: LucidRadius.lg, padding: LucidSpace.md },
  personalCueCopy: { flex: 1, gap: LucidSpace.xs },
  personalCueText: { fontFamily: 'Fraunces_500Medium', fontSize: LucidType.h3[0], lineHeight: LucidType.h3[1] },
  steps: { borderWidth: StyleSheet.hairlineWidth, borderRadius: LucidRadius.xl, overflow: 'hidden' },
  stepRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md, paddingHorizontal: LucidSpace.lg, paddingVertical: LucidSpace.md },
  check: { width: 32, height: 32, borderRadius: LucidRadius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checkNumber: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  stepText: { flex: 1, fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: LucidSpace.md, borderRadius: LucidRadius.lg, padding: LucidSpace.md },
  noticeCopy: { flex: 1, gap: LucidSpace.xs },
  noticeText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  reflectionBlock: { borderTopWidth: StyleSheet.hairlineWidth, gap: LucidSpace.sm, paddingTop: LucidSpace.lg },
  reflection: { fontFamily: 'Fraunces_500Medium', fontSize: LucidType.h3[0], lineHeight: LucidType.h3[1] },
  guidedScreenContent: { gap: LucidSpace.lg },
  guidedIntroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.sm },
  guidedActiveMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: LucidSpace.md },
  guidedPhaseCount: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  guidedNotice: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md, borderRadius: LucidRadius.lg, padding: LucidSpace.md },
  guidedNoticeText: { flex: 1, fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  guidedSourceCard: { gap: LucidSpace.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: LucidRadius.xl, padding: LucidSpace.lg },
  guidedSourceCardCompact: { padding: LucidSpace.md },
  guidedSourceRow: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md },
  guidedSourceCopy: { flex: 1, gap: LucidSpace.xs },
  guidedSourceTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: LucidType.h3[0], lineHeight: LucidType.h3[1] },
  guidedSourceSign: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  guidedBody: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  guidedTimerTrack: { height: LucidSpace.xs, overflow: 'hidden', borderRadius: LucidRadius.full },
  guidedTimerFill: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  guidedPhaseCard: { alignItems: 'center', gap: LucidSpace.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: LucidRadius.xl, padding: LucidSpace.xl },
  guidedPhaseIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: LucidRadius.full },
  guidedPhaseTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: LucidType.h1[0], lineHeight: LucidType.h1[1], textAlign: 'center' },
  guidedPhaseBody: { maxWidth: 520, fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.body[0], lineHeight: LucidType.body[1], textAlign: 'center' },
  guidedError: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1], textAlign: 'center' },
});
