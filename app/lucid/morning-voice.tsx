import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  LucidButton,
  LucidCard,
  LucidIconAction,
  LucidPill,
  LucidScreen,
  LucidSectionHeader,
} from '@/components/lucid/LucidUI';
import {
  getLucidPalette,
  LucidIcon,
  LucidRadius,
  LucidSpace,
  LucidType,
} from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidMorningVoiceNotes } from '@/hooks/useLucidMorningVoiceNotes';
import { useLucidMorningVoicePlayer } from '@/hooks/useLucidMorningVoicePlayer';
import { useLucidMorningVoiceRecorder } from '@/hooks/useLucidMorningVoiceRecorder';
import { closeLucidRoute } from '@/lib/lucid/routes';
import {
  MAX_LUCID_MORNING_VOICE_TITLE_LENGTH,
  MAX_LUCID_MORNING_VOICE_TRANSCRIPT_LENGTH,
  type LucidMorningVoiceCapturePhase,
  type LucidMorningVoiceNote,
} from '@/lib/lucid/morningVoiceNote';
import type { LucidExperiment, LucidLocale } from '@/lib/lucid/model';
import { shareLucidMorningVoiceNote } from '@/services/lucidMorningVoiceNoteExport';

const COPY = {
  en: {
    eyebrow: 'Morning recall',
    title: 'Morning voice notes',
    subtitle: 'Speak the dream before it fades. Audio stays on this device.',
    close: 'Close',
    privacy:
      'These notes stay on this device. Nothing is uploaded, synced or transcribed automatically. A missing transcript never blocks saving.',
    micContext:
      'The first tap on Speak asks for the microphone, then recording starts only if you allow it. Sleep still comes first.',
    speak: 'Speak',
    speakHint: 'Ask for the microphone, then start recording.',
    pause: 'Pause',
    pauseHint: 'Pause this local recording. The draft stays on this device.',
    resume: 'Resume',
    resumeHint: 'Resume this local recording.',
    stop: 'Stop',
    stopHint: 'Stop and save this local recording. Nothing is uploaded.',
    reset: 'Start over',
    duration: 'Duration',
    durationLabel: (value: string) => `Duration ${value}`,
    retrySaveHint: 'Try saving this local recording again. Nothing is uploaded.',
    notes: 'Local notes',
    empty: 'No morning voice notes yet. Speak when you wake, then keep the draft or save it.',
    loading: 'Loading your notes…',
    retry: 'Try again',
    retrySave: 'Try saving again',
    play: 'Play',
    pausePlayback: 'Pause playback',
    replay: 'Replay',
    rename: 'Note title',
    saveTitle: 'Save title',
    transcript: 'Optional transcript',
    saveTranscript: 'Save transcript',
    clearTranscript: 'Remove transcript',
    link: 'Attach to a morning review',
    unlinkHint: 'Choose an exact existing morning review. Invented links are not created.',
    noReviews: 'No morning review is available to attach yet.',
    attached: 'Attached review',
    unattached: 'Not attached',
    delete: 'Delete',
    deleteTitle: 'Delete this voice note?',
    deleteBody: 'The local audio file is removed from this device. This cannot be undone.',
    cancel: 'Cancel',
    share: 'Share',
    shareHint: 'Opens the system share sheet for this local file. Nothing is uploaded automatically.',
    sharing: 'Opening the system share sheet…',
    shareUnavailable: 'Sharing is unavailable on this device. The note stays here.',
    shareFailed: 'The local file could not be shared. Nothing was uploaded.',
    draft: 'Recoverable draft',
    ready: 'Saved',
    interrupted: 'Interrupted. A recoverable draft was kept.',
    recoverable: 'A recoverable draft is waiting. It is not marked complete.',
    recording: 'Recording',
    paused: 'Paused',
    requesting: 'Waiting for microphone access',
    stopping: 'Saving locally…',
    completeNever: 'Never invent a completion. Only Stop can save a finished note.',
    playbackUnavailable: 'Playback is unavailable for this local file.',
    untitled: 'Morning voice note',
    reviewLabel: (when: string) => `Morning review · ${when}`,
    untitledReview: 'Morning review',
    status: {
      idle: 'Ready to speak.',
      created: 'Preparing a local note.',
      requesting_permission: 'Waiting for microphone access.',
      recording: 'Recording on this device.',
      paused: 'Recording paused.',
      stopping: 'Saving the local note.',
      stopped: 'Saved locally. Not uploaded.',
      interrupted: 'Interrupted. A recoverable draft was kept.',
      recoverable: 'A recoverable draft is waiting.',
      error: 'Recording could not continue.',
    },
    errors: {
      permission_denied: 'Microphone access was refused. You can try Speak again.',
      storage_full: 'This device is out of storage for voice notes.',
      interrupted: 'Recording was interrupted. A recoverable draft was kept.',
      recorder_unavailable: 'The recorder is unavailable right now. Try again.',
      persistence_failed: 'The note could not be saved on this device. Try again.',
      invalid_metadata: 'This note could not be updated.',
      invalid_title: 'This title could not be saved.',
      invalid_scope: 'These notes are not available for the current account.',
      invalid_id: 'This note or morning review could not be used.',
      invalid_uri: 'This local audio file is not available.',
      invalid_duration: 'This recording is too short to save as complete.',
      invalid_transition: 'This recording step is not available right now.',
      playback_failed: 'Playback is unavailable for this local file.',
    },
  },
  fr: {
    eyebrow: 'Rappel du matin',
    title: 'Notes vocales du matin',
    subtitle: 'Parle le rêve avant qu’il ne s’efface. L’audio reste sur cet appareil.',
    close: 'Fermer',
    privacy:
      'Ces notes restent sur cet appareil. Rien n’est envoyé, synchronisé ni transcrit automatiquement. L’absence de transcript ne bloque jamais l’enregistrement.',
    micContext:
      'Le premier tap sur Parler demande le micro, puis l’enregistrement commence seulement si tu l’autorises. Le sommeil reste prioritaire.',
    speak: 'Parler',
    speakHint: 'Demander le micro, puis commencer l’enregistrement.',
    pause: 'Pause',
    pauseHint: 'Mettre en pause cet enregistrement local. Le brouillon reste sur cet appareil.',
    resume: 'Reprendre',
    resumeHint: 'Reprendre cet enregistrement local.',
    stop: 'Arrêter',
    stopHint: 'Arrêter et enregistrer localement. Rien n’est envoyé.',
    reset: 'Recommencer',
    duration: 'Durée',
    durationLabel: (value: string) => `Durée ${value}`,
    retrySaveHint: 'Réessayer d’enregistrer cette note locale. Rien n’est envoyé.',
    notes: 'Notes locales',
    empty: 'Aucune note vocale du matin. Parle au réveil, puis garde le brouillon ou enregistre-le.',
    loading: 'Chargement de tes notes…',
    retry: 'Réessayer',
    retrySave: 'Réessayer l’enregistrement',
    play: 'Lire',
    pausePlayback: 'Mettre en pause',
    replay: 'Rejouer',
    rename: 'Titre de la note',
    saveTitle: 'Enregistrer le titre',
    transcript: 'Transcript facultatif',
    saveTranscript: 'Enregistrer le transcript',
    clearTranscript: 'Retirer le transcript',
    link: 'Rattacher à un bilan du matin',
    unlinkHint: 'Choisis un bilan du matin déjà existant. Aucun lien inventé n’est créé.',
    noReviews: 'Aucun bilan du matin n’est encore disponible à rattacher.',
    attached: 'Bilan rattaché',
    unattached: 'Non rattaché',
    delete: 'Supprimer',
    deleteTitle: 'Supprimer cette note vocale ?',
    deleteBody: 'Le fichier audio local est retiré de cet appareil. Cette action est définitive.',
    cancel: 'Annuler',
    share: 'Partager',
    shareHint: 'Ouvre la feuille de partage système pour ce fichier local. Rien n’est envoyé automatiquement.',
    sharing: 'Ouverture de la feuille de partage…',
    shareUnavailable: 'Le partage est indisponible sur cet appareil. La note reste ici.',
    shareFailed: 'Le fichier local n’a pas pu être partagé. Rien n’a été envoyé.',
    draft: 'Brouillon récupérable',
    ready: 'Enregistrée',
    interrupted: 'Interrompu. Un brouillon récupérable a été conservé.',
    recoverable: 'Un brouillon récupérable attend. Il n’est pas marqué comme terminé.',
    recording: 'Enregistrement',
    paused: 'En pause',
    requesting: 'En attente d’accès au micro',
    stopping: 'Enregistrement local…',
    completeNever: 'Ne jamais inventer une complétion. Seul Arrêter peut sauver une note terminée.',
    playbackUnavailable: 'La lecture est indisponible pour ce fichier local.',
    untitled: 'Note vocale du matin',
    reviewLabel: (when: string) => `Bilan du matin · ${when}`,
    untitledReview: 'Bilan du matin',
    status: {
      idle: 'Prêt à parler.',
      created: 'Préparation d’une note locale.',
      requesting_permission: 'En attente d’accès au micro.',
      recording: 'Enregistrement sur cet appareil.',
      paused: 'Enregistrement en pause.',
      stopping: 'Enregistrement local de la note.',
      stopped: 'Enregistrée localement. Non envoyée.',
      interrupted: 'Interrompu. Un brouillon récupérable a été conservé.',
      recoverable: 'Un brouillon récupérable attend.',
      error: 'L’enregistrement n’a pas pu continuer.',
    },
    errors: {
      permission_denied: 'L’accès au micro a été refusé. Tu peux retaper Parler.',
      storage_full: 'Cet appareil n’a plus assez d’espace pour les notes vocales.',
      interrupted: 'L’enregistrement a été interrompu. Un brouillon récupérable a été conservé.',
      recorder_unavailable: 'L’enregistreur est indisponible pour le moment. Réessaie.',
      persistence_failed: 'La note n’a pas pu être enregistrée sur cet appareil. Réessaie.',
      invalid_metadata: 'Cette note n’a pas pu être mise à jour.',
      invalid_title: 'Ce titre n’a pas pu être enregistré.',
      invalid_scope: 'Ces notes ne sont pas disponibles pour le compte actuel.',
      invalid_id: 'Cette note ou ce bilan du matin n’a pas pu être utilisé.',
      invalid_uri: 'Ce fichier audio local n’est pas disponible.',
      invalid_duration: 'Cet enregistrement est trop court pour être marqué comme terminé.',
      invalid_transition: 'Cette étape d’enregistrement n’est pas disponible maintenant.',
      playback_failed: 'La lecture est indisponible pour ce fichier local.',
    },
  },
  es: {
    eyebrow: 'Recuerdo de la mañana',
    title: 'Notas de voz de la mañana',
    subtitle: 'Di el sueño antes de que se borre. El audio permanece en este dispositivo.',
    close: 'Cerrar',
    privacy:
      'Estas notas permanecen en este dispositivo. Nada se envía, sincroniza ni transcribe automáticamente. La falta de transcripción nunca impide guardar.',
    micContext:
      'El primer toque en Hablar pide el micrófono, y la grabación empieza solo si lo permites. El sueño sigue primero.',
    speak: 'Hablar',
    speakHint: 'Pedir el micrófono y luego empezar a grabar.',
    pause: 'Pausa',
    pauseHint: 'Pausar esta grabación local. El borrador permanece en este dispositivo.',
    resume: 'Reanudar',
    resumeHint: 'Reanudar esta grabación local.',
    stop: 'Detener',
    stopHint: 'Detener y guardar esta grabación local. No se envía nada.',
    reset: 'Empezar de nuevo',
    duration: 'Duración',
    durationLabel: (value: string) => `Duración ${value}`,
    retrySaveHint: 'Volver a guardar esta grabación local. No se envía nada.',
    notes: 'Notas locales',
    empty: 'Aún no hay notas de voz de la mañana. Habla al despertar y guarda el borrador o la nota.',
    loading: 'Cargando tus notas…',
    retry: 'Reintentar',
    retrySave: 'Volver a guardar',
    play: 'Reproducir',
    pausePlayback: 'Pausar reproducción',
    replay: 'Volver a reproducir',
    rename: 'Título de la nota',
    saveTitle: 'Guardar título',
    transcript: 'Transcripción opcional',
    saveTranscript: 'Guardar transcripción',
    clearTranscript: 'Quitar transcripción',
    link: 'Vincular a un repaso de la mañana',
    unlinkHint: 'Elige un repaso de la mañana ya existente. No se inventan vínculos.',
    noReviews: 'Aún no hay un repaso de la mañana para vincular.',
    attached: 'Repaso vinculado',
    unattached: 'Sin vincular',
    delete: 'Eliminar',
    deleteTitle: '¿Eliminar esta nota de voz?',
    deleteBody: 'El archivo de audio local se elimina de este dispositivo. No se puede deshacer.',
    cancel: 'Cancelar',
    share: 'Compartir',
    shareHint: 'Abre la hoja de compartir del sistema para este archivo local. Nada se envía automáticamente.',
    sharing: 'Abriendo la hoja de compartir…',
    shareUnavailable: 'Compartir no está disponible en este dispositivo. La nota se queda aquí.',
    shareFailed: 'No se pudo compartir el archivo local. No se envió nada.',
    draft: 'Borrador recuperable',
    ready: 'Guardada',
    interrupted: 'Interrumpida. Se conservó un borrador recuperable.',
    recoverable: 'Hay un borrador recuperable. No se marca como completa.',
    recording: 'Grabando',
    paused: 'En pausa',
    requesting: 'Esperando acceso al micrófono',
    stopping: 'Guardando en local…',
    completeNever: 'Nunca inventes una finalización. Solo Detener puede guardar una nota terminada.',
    playbackUnavailable: 'La reproducción no está disponible para este archivo local.',
    untitled: 'Nota de voz de la mañana',
    reviewLabel: (when: string) => `Repaso de la mañana · ${when}`,
    untitledReview: 'Repaso de la mañana',
    status: {
      idle: 'Lista para hablar.',
      created: 'Preparando una nota local.',
      requesting_permission: 'Esperando acceso al micrófono.',
      recording: 'Grabando en este dispositivo.',
      paused: 'Grabación en pausa.',
      stopping: 'Guardando la nota local.',
      stopped: 'Guardada en local. No se envió.',
      interrupted: 'Interrumpida. Se conservó un borrador recuperable.',
      recoverable: 'Hay un borrador recuperable.',
      error: 'La grabación no pudo continuar.',
    },
    errors: {
      permission_denied: 'Se negó el acceso al micrófono. Puedes tocar Hablar otra vez.',
      storage_full: 'Este dispositivo no tiene espacio para notas de voz.',
      interrupted: 'La grabación se interrumpió. Se conservó un borrador recuperable.',
      recorder_unavailable: 'La grabadora no está disponible ahora. Inténtalo de nuevo.',
      persistence_failed: 'No se pudo guardar la nota en este dispositivo. Inténtalo de nuevo.',
      invalid_metadata: 'No se pudo actualizar esta nota.',
      invalid_title: 'No se pudo guardar este título.',
      invalid_scope: 'Estas notas no están disponibles para la cuenta actual.',
      invalid_id: 'Esta nota o este repaso de la mañana no se pudo usar.',
      invalid_uri: 'Este archivo de audio local no está disponible.',
      invalid_duration: 'Esta grabación es demasiado corta para marcarse como completa.',
      invalid_transition: 'Este paso de grabación no está disponible ahora.',
      playback_failed: 'La reproducción no está disponible para este archivo local.',
    },
  },
  de: {
    eyebrow: 'Morgenrückruf',
    title: 'Morgendliche Sprachnotizen',
    subtitle: 'Sprich den Traum, bevor er verblasst. Das Audio bleibt auf diesem Gerät.',
    close: 'Schließen',
    privacy:
      'Diese Notizen bleiben auf diesem Gerät. Nichts wird hochgeladen, synchronisiert oder automatisch transkribiert. Ein fehlendes Transkript blockiert das Speichern nie.',
    micContext:
      'Der erste Tipp auf Sprechen fragt nach dem Mikrofon. Die Aufnahme startet nur, wenn du zustimmst. Schlaf bleibt vorrangig.',
    speak: 'Sprechen',
    speakHint: 'Mikrofon anfragen und dann aufnehmen.',
    pause: 'Pause',
    pauseHint: 'Diese lokale Aufnahme pausieren. Der Entwurf bleibt auf diesem Gerät.',
    resume: 'Fortsetzen',
    resumeHint: 'Diese lokale Aufnahme fortsetzen.',
    stop: 'Stopp',
    stopHint: 'Diese lokale Aufnahme stoppen und speichern. Nichts wird hochgeladen.',
    reset: 'Neu beginnen',
    duration: 'Dauer',
    durationLabel: (value: string) => `Dauer ${value}`,
    retrySaveHint: 'Diese lokale Aufnahme erneut speichern. Nichts wird hochgeladen.',
    notes: 'Lokale Notizen',
    empty: 'Noch keine morgendlichen Sprachnotizen. Sprich nach dem Aufwachen und behalte den Entwurf oder speichere ihn.',
    loading: 'Notizen werden geladen…',
    retry: 'Erneut versuchen',
    retrySave: 'Erneut speichern',
    play: 'Abspielen',
    pausePlayback: 'Wiedergabe pausieren',
    replay: 'Erneut abspielen',
    rename: 'Titel der Notiz',
    saveTitle: 'Titel speichern',
    transcript: 'Optionales Transkript',
    saveTranscript: 'Transkript speichern',
    clearTranscript: 'Transkript entfernen',
    link: 'Mit einem Morgenrückblick verknüpfen',
    unlinkHint: 'Wähle einen bereits vorhandenen Morgenrückblick. Erfundene Verknüpfungen gibt es nicht.',
    noReviews: 'Es gibt noch keinen Morgenrückblick zum Verknüpfen.',
    attached: 'Verknüpfter Rückblick',
    unattached: 'Nicht verknüpft',
    delete: 'Löschen',
    deleteTitle: 'Diese Sprachnotiz löschen?',
    deleteBody: 'Die lokale Audiodatei wird von diesem Gerät entfernt. Das lässt sich nicht rückgängig machen.',
    cancel: 'Abbrechen',
    share: 'Teilen',
    shareHint: 'Öffnet das System-Teilen-Menü für diese lokale Datei. Nichts wird automatisch hochgeladen.',
    sharing: 'Teilen-Menü wird geöffnet…',
    shareUnavailable: 'Teilen ist auf diesem Gerät nicht verfügbar. Die Notiz bleibt hier.',
    shareFailed: 'Die lokale Datei konnte nicht geteilt werden. Es wurde nichts hochgeladen.',
    draft: 'Wiederherstellbarer Entwurf',
    ready: 'Gespeichert',
    interrupted: 'Unterbrochen. Ein wiederherstellbarer Entwurf wurde behalten.',
    recoverable: 'Ein wiederherstellbarer Entwurf wartet. Er gilt nicht als abgeschlossen.',
    recording: 'Aufnahme',
    paused: 'Pausiert',
    requesting: 'Warten auf Mikrofonzugriff',
    stopping: 'Lokal speichern…',
    completeNever: 'Erfinde nie einen Abschluss. Nur Stopp speichert eine fertige Notiz.',
    playbackUnavailable: 'Die Wiedergabe ist für diese lokale Datei nicht verfügbar.',
    untitled: 'Morgendliche Sprachnotiz',
    reviewLabel: (when: string) => `Morgenrückblick · ${when}`,
    untitledReview: 'Morgenrückblick',
    status: {
      idle: 'Bereit zu sprechen.',
      created: 'Lokale Notiz wird vorbereitet.',
      requesting_permission: 'Warten auf Mikrofonzugriff.',
      recording: 'Aufnahme auf diesem Gerät.',
      paused: 'Aufnahme pausiert.',
      stopping: 'Lokale Notiz wird gespeichert.',
      stopped: 'Lokal gespeichert. Nicht hochgeladen.',
      interrupted: 'Unterbrochen. Ein wiederherstellbarer Entwurf wurde behalten.',
      recoverable: 'Ein wiederherstellbarer Entwurf wartet.',
      error: 'Die Aufnahme konnte nicht fortgesetzt werden.',
    },
    errors: {
      permission_denied: 'Der Mikrofonzugriff wurde verweigert. Du kannst Sprechen erneut tippen.',
      storage_full: 'Auf diesem Gerät ist kein Speicher mehr für Sprachnotizen frei.',
      interrupted: 'Die Aufnahme wurde unterbrochen. Ein wiederherstellbarer Entwurf wurde behalten.',
      recorder_unavailable: 'Der Rekorder ist gerade nicht verfügbar. Versuche es erneut.',
      persistence_failed: 'Die Notiz konnte auf diesem Gerät nicht gespeichert werden. Versuche es erneut.',
      invalid_metadata: 'Diese Notiz konnte nicht aktualisiert werden.',
      invalid_title: 'Dieser Titel konnte nicht gespeichert werden.',
      invalid_scope: 'Diese Notizen sind für das aktuelle Konto nicht verfügbar.',
      invalid_id: 'Diese Notiz oder dieser Morgenrückblick konnte nicht verwendet werden.',
      invalid_uri: 'Diese lokale Audiodatei ist nicht verfügbar.',
      invalid_duration: 'Diese Aufnahme ist zu kurz, um als fertig gespeichert zu werden.',
      invalid_transition: 'Dieser Aufnahmeschritt ist gerade nicht verfügbar.',
      playback_failed: 'Die Wiedergabe ist für diese lokale Datei nicht verfügbar.',
    },
  },
  it: {
    eyebrow: 'Richiamo del mattino',
    title: 'Note vocali del mattino',
    subtitle: 'Parla il sogno prima che svanisca. L’audio resta su questo dispositivo.',
    close: 'Chiudi',
    privacy:
      'Queste note restano su questo dispositivo. Nulla viene caricato, sincronizzato o trascritto automaticamente. L’assenza di trascrizione non blocca mai il salvataggio.',
    micContext:
      'Il primo tap su Parlare chiede il microfono, poi la registrazione inizia solo se lo consenti. Il sonno resta prioritario.',
    speak: 'Parlare',
    speakHint: 'Chiedere il microfono, poi iniziare a registrare.',
    pause: 'Pausa',
    pauseHint: 'Metti in pausa questa registrazione locale. La bozza resta su questo dispositivo.',
    resume: 'Riprendi',
    resumeHint: 'Riprendi questa registrazione locale.',
    stop: 'Arresta',
    stopHint: 'Arresta e salva questa registrazione locale. Nulla viene caricato.',
    reset: 'Ricomincia',
    duration: 'Durata',
    durationLabel: (value: string) => `Durata ${value}`,
    retrySaveHint: 'Riprova a salvare questa registrazione locale. Nulla viene caricato.',
    notes: 'Note locali',
    empty: 'Nessuna nota vocale del mattino. Parla al risveglio, poi tieni la bozza o salvala.',
    loading: 'Caricamento delle note…',
    retry: 'Riprova',
    retrySave: 'Riprova a salvare',
    play: 'Ascolta',
    pausePlayback: 'Metti in pausa',
    replay: 'Riascolta',
    rename: 'Titolo della nota',
    saveTitle: 'Salva titolo',
    transcript: 'Trascrizione facoltativa',
    saveTranscript: 'Salva trascrizione',
    clearTranscript: 'Rimuovi trascrizione',
    link: 'Collega a un bilancio del mattino',
    unlinkHint: 'Scegli un bilancio del mattino già esistente. Non si inventano collegamenti.',
    noReviews: 'Non c’è ancora un bilancio del mattino da collegare.',
    attached: 'Bilancio collegato',
    unattached: 'Non collegata',
    delete: 'Elimina',
    deleteTitle: 'Eliminare questa nota vocale?',
    deleteBody: 'Il file audio locale viene rimosso da questo dispositivo. L’azione è definitiva.',
    cancel: 'Annulla',
    share: 'Condividi',
    shareHint: 'Apre il foglio di condivisione di sistema per questo file locale. Nulla viene caricato automaticamente.',
    sharing: 'Apertura del foglio di condivisione…',
    shareUnavailable: 'La condivisione non è disponibile su questo dispositivo. La nota resta qui.',
    shareFailed: 'Il file locale non è stato condiviso. Nulla è stato caricato.',
    draft: 'Bozza recuperabile',
    ready: 'Salvata',
    interrupted: 'Interrotta. È stata conservata una bozza recuperabile.',
    recoverable: 'C’è una bozza recuperabile. Non è segnata come completata.',
    recording: 'Registrazione',
    paused: 'In pausa',
    requesting: 'In attesa dell’accesso al microfono',
    stopping: 'Salvataggio locale…',
    completeNever: 'Non inventare mai un completamento. Solo Arresta può salvare una nota finita.',
    playbackUnavailable: 'La riproduzione non è disponibile per questo file locale.',
    untitled: 'Nota vocale del mattino',
    reviewLabel: (when: string) => `Bilancio del mattino · ${when}`,
    untitledReview: 'Bilancio del mattino',
    status: {
      idle: 'Pronto a parlare.',
      created: 'Preparazione di una nota locale.',
      requesting_permission: 'In attesa dell’accesso al microfono.',
      recording: 'Registrazione su questo dispositivo.',
      paused: 'Registrazione in pausa.',
      stopping: 'Salvataggio locale della nota.',
      stopped: 'Salvata in locale. Non inviata.',
      interrupted: 'Interrotta. È stata conservata una bozza recuperabile.',
      recoverable: 'C’è una bozza recuperabile.',
      error: 'La registrazione non è potuta continuare.',
    },
    errors: {
      permission_denied: 'L’accesso al microfono è stato rifiutato. Puoi toccare di nuovo Parlare.',
      storage_full: 'Questo dispositivo non ha spazio per le note vocali.',
      interrupted: 'La registrazione è stata interrotta. È stata conservata una bozza recuperabile.',
      recorder_unavailable: 'Il registratore non è disponibile ora. Riprova.',
      persistence_failed: 'La nota non è stata salvata su questo dispositivo. Riprova.',
      invalid_metadata: 'Questa nota non è stata aggiornata.',
      invalid_title: 'Questo titolo non è stato salvato.',
      invalid_scope: 'Queste note non sono disponibili per l’account attuale.',
      invalid_id: 'Questa nota o questo bilancio del mattino non è utilizzabile.',
      invalid_uri: 'Questo file audio locale non è disponibile.',
      invalid_duration: 'Questa registrazione è troppo breve per essere salvata come completa.',
      invalid_transition: 'Questo passaggio di registrazione non è disponibile ora.',
      playback_failed: 'La riproduzione non è disponibile per questo file locale.',
    },
  },
} as const;

type Copy = (typeof COPY)[LucidLocale];

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatWhen(value: number, locale: LucidLocale): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

function errorCopy(copy: Copy, reason: string | null | undefined): string | null {
  if (!reason) return null;
  return copy.errors[reason as keyof Copy['errors']] ?? copy.errors.persistence_failed;
}

function captureStatus(copy: Copy, phase: LucidMorningVoiceCapturePhase): string {
  return copy.status[phase];
}

function experimentLabel(copy: Copy, experiment: LucidExperiment, locale: LucidLocale): string {
  const recall = experiment.recallText?.trim();
  const notes = experiment.notes?.trim();
  const detail = recall || notes;
  const when = formatWhen(experiment.occurredAt, locale);
  if (detail) return `${copy.reviewLabel(when)} · ${detail}`;
  return copy.reviewLabel(when);
}

function runQuiet(work: () => Promise<unknown>) {
  void Promise.resolve(work()).catch(() => undefined);
}

function MorningVoiceNoteRow({
  note,
  copy,
  locale,
  palette,
  experiments,
  busy,
  onRename,
  onSaveTranscript,
  onClearTranscript,
  onLink,
  onDelete,
  onShare,
  shareBusy,
  shareError,
}: {
  note: LucidMorningVoiceNote;
  copy: Copy;
  locale: LucidLocale;
  palette: ReturnType<typeof getLucidPalette>;
  experiments: LucidExperiment[];
  busy: boolean;
  onRename: (noteId: string, title: string) => Promise<unknown>;
  onSaveTranscript: (noteId: string, transcript: string | null) => Promise<unknown>;
  onClearTranscript: (noteId: string) => Promise<unknown>;
  onLink: (noteId: string, experimentId: string) => Promise<unknown>;
  onDelete: (noteId: string) => void;
  onShare: (note: LucidMorningVoiceNote) => void;
  shareBusy: boolean;
  shareError: 'unavailable' | 'failed' | null;
}) {
  const player = useLucidMorningVoicePlayer(note);
  const [titleDraft, setTitleDraft] = useState({ noteId: note.id, value: note.title });
  const [transcriptDraft, setTranscriptDraft] = useState({
    noteId: note.id,
    value: note.transcript ?? '',
  });
  const title = titleDraft.noteId === note.id ? titleDraft.value : note.title;
  const transcript = transcriptDraft.noteId === note.id ? transcriptDraft.value : (note.transcript ?? '');
  const attached = experiments.find((item) => item.id === note.experimentId) ?? null;
  const canSaveTitle = title.trim().length > 0 && title.trim() !== note.title;
  const nextTranscript = transcript.trim() ? transcript.trim() : null;
  const canSaveTranscript = nextTranscript !== (note.transcript ?? null);

  return (
    <LucidCard style={styles.noteCard} testID={`lucid-morning-voice-note-${note.id}`}>
      <View style={styles.noteHeader}>
        <View style={styles.noteTitleBlock}>
          <Text style={[styles.noteTitle, { color: palette.text }]}>{note.title}</Text>
          <Text style={[styles.meta, { color: palette.textMuted }]}>
            {formatWhen(note.createdAt, locale)} · {formatDuration(note.durationMs)}
          </Text>
        </View>
        <LucidPill
          label={note.status === 'draft' || note.recoverable ? copy.draft : copy.ready}
          tone={note.status === 'draft' || note.recoverable ? 'amber' : 'neutral'}
        />
      </View>

      <View
        accessibilityLiveRegion="polite"
        style={styles.playback}
        testID={`lucid-morning-voice-player-${note.id}`}
      >
        <LucidButton
          accessibilityHint={copy.play}
          disabled={!player.isLoaded || Boolean(player.error)}
          disabledReason={player.error ? copy.playbackUnavailable : undefined}
          label={player.isPlaying ? copy.pausePlayback : copy.play}
          onPress={() => runQuiet(() => (player.isPlaying ? player.pause() : player.play()))}
          testID={`lucid-morning-voice-play-${note.id}`}
          variant="secondary"
        />
        <LucidButton
          disabled={!player.isLoaded || Boolean(player.error)}
          disabledReason={player.error ? copy.playbackUnavailable : undefined}
          label={copy.replay}
          onPress={() => runQuiet(player.replay)}
          testID={`lucid-morning-voice-replay-${note.id}`}
          variant="secondary"
        />
      </View>
      {player.error ? (
        <Text accessibilityLiveRegion="assertive" style={[styles.body, { color: palette.danger }]}>
          {copy.errors.playback_failed}
        </Text>
      ) : null}

      <TextInput
        accessibilityLabel={copy.rename}
        editable={!busy}
        maxLength={MAX_LUCID_MORNING_VOICE_TITLE_LENGTH}
        onChangeText={(value) => setTitleDraft({ noteId: note.id, value })}
        placeholder={copy.rename}
        placeholderTextColor={palette.textMuted}
        style={[styles.input, { backgroundColor: palette.surfaceRaised, borderColor: palette.borderInteractive, color: palette.text }]}
        testID={`lucid-morning-voice-rename-${note.id}`}
        value={title}
      />
      <LucidButton
        disabled={!canSaveTitle}
        label={copy.saveTitle}
        loading={busy}
        onPress={() => runQuiet(() => onRename(note.id, title.trim()))}
        testID={`lucid-morning-voice-save-title-${note.id}`}
      />

      <TextInput
        accessibilityHint={copy.transcript}
        accessibilityLabel={copy.transcript}
        editable={!busy}
        maxLength={MAX_LUCID_MORNING_VOICE_TRANSCRIPT_LENGTH}
        multiline
        onChangeText={(value) => setTranscriptDraft({ noteId: note.id, value })}
        placeholder={copy.transcript}
        placeholderTextColor={palette.textMuted}
        style={[styles.input, styles.transcript, { backgroundColor: palette.surfaceRaised, borderColor: palette.borderInteractive, color: palette.text }]}
        testID={`lucid-morning-voice-transcript-${note.id}`}
        value={transcript}
      />
      <View style={styles.actions}>
        <LucidButton
          disabled={!canSaveTranscript}
          label={copy.saveTranscript}
          loading={busy}
          onPress={() => runQuiet(() => onSaveTranscript(note.id, nextTranscript))}
          testID={`lucid-morning-voice-save-transcript-${note.id}`}
          variant="secondary"
        />
        {note.transcript ? (
          <LucidButton
            label={copy.clearTranscript}
            loading={busy}
            onPress={() => runQuiet(() => onClearTranscript(note.id))}
            testID={`lucid-morning-voice-clear-transcript-${note.id}`}
            variant="secondary"
          />
        ) : null}
      </View>

      <Text style={[styles.label, { color: palette.textMuted }]}>{copy.link}</Text>
      <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.unlinkHint}</Text>
      <Text style={[styles.meta, { color: palette.textMuted }]}>
        {attached ? `${copy.attached}: ${experimentLabel(copy, attached, locale)}` : copy.unattached}
      </Text>
      {experiments.length === 0 ? (
        <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.noReviews}</Text>
      ) : (
        experiments.map((experiment) => (
          <LucidButton
            key={experiment.id}
            label={experimentLabel(copy, experiment, locale)}
            loading={busy}
            onPress={() => runQuiet(() => onLink(note.id, experiment.id))}
            testID={`lucid-morning-voice-link-${note.id}-${experiment.id}`}
            variant={note.experimentId === experiment.id ? 'primary' : 'secondary'}
          />
        ))
      )}

      <View style={styles.actions}>
        <LucidButton
          accessibilityHint={copy.shareHint}
          label={copy.share}
          loading={shareBusy}
          onPress={() => onShare(note)}
          testID={`lucid-morning-voice-share-${note.id}`}
          variant="secondary"
        />
        <LucidButton
          label={copy.delete}
          loading={busy}
          onPress={() => onDelete(note.id)}
          testID={`lucid-morning-voice-delete-${note.id}`}
          variant="danger"
        />
      </View>
      {shareBusy ? (
        <Text accessibilityLiveRegion="polite" style={[styles.meta, { color: palette.textMuted }]}>
          {copy.sharing}
        </Text>
      ) : null}
      {shareError ? (
        <Text
          accessibilityLiveRegion="assertive"
          style={[styles.body, { color: palette.danger }]}
          testID={`lucid-morning-voice-share-error-${note.id}`}
        >
          {shareError === 'unavailable' ? copy.shareUnavailable : copy.shareFailed}
        </Text>
      ) : null}
    </LucidCard>
  );
}

export default function LucidMorningVoiceScreen() {
  const { content, state, userScope } = useLucidTrainer();
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const copy = COPY[content.locale];
  const params = useLocalSearchParams<{ autoStart?: string | string[] }>();
  const autoStartParam = Array.isArray(params.autoStart) ? params.autoStart[0] : params.autoStart;
  const shouldAutoStart = autoStartParam === '1';
  const notesApi = useLucidMorningVoiceNotes({ userScope });
  const recorder = useLucidMorningVoiceRecorder({
    userScope,
    title: copy.untitled,
    onPersisted: () => {
      void notesApi.refresh();
    },
  });
  const autoStartAttemptedRef = useRef(false);
  const [shareBusyId, setShareBusyId] = useState<string | null>(null);
  const [shareErrorById, setShareErrorById] = useState<Record<string, 'unavailable' | 'failed'>>({});

  const experiments = useMemo(
    () => [...(state?.experiments ?? [])].sort((left, right) => right.occurredAt - left.occurredAt),
    [state?.experiments]
  );

  const phase = recorder.capture.phase;
  const persistRetryable =
    (phase === 'stopping' || phase === 'interrupted') &&
    (recorder.errorReason === 'storage_full' || recorder.errorReason === 'persistence_failed');
  const canSpeak = phase === 'idle' || phase === 'stopped' || phase === 'recoverable' || phase === 'error';
  const canPause = phase === 'recording';
  const canResume = phase === 'paused';
  const canStop = phase === 'recording' || phase === 'paused';
  const canReset = phase === 'stopped' || phase === 'recoverable' || phase === 'error';
  const visibleNotes = useMemo(
    () =>
      [...notesApi.notes].sort((left, right) => {
        if (left.createdAt !== right.createdAt) return right.createdAt - left.createdAt;
        return right.id.localeCompare(left.id);
      }),
    [notesApi.notes]
  );
  const captureError = errorCopy(copy, recorder.errorReason);
  const listError = errorCopy(copy, notesApi.error);
  const liveStatus = captureStatus(copy, phase);
  const start = recorder.start;

  useEffect(() => {
    if (!shouldAutoStart) return;
    if (autoStartAttemptedRef.current) return;
    if (phase !== 'idle') return;
    autoStartAttemptedRef.current = true;
    runQuiet(start);
  }, [phase, shouldAutoStart, start]);

  const confirmDelete = (noteId: string) => {
    Alert.alert(copy.deleteTitle, copy.deleteBody, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.delete,
        style: 'destructive',
        onPress: () => runQuiet(() => notesApi.deleteNote(noteId)),
      },
    ]);
  };

  const shareNote = (note: LucidMorningVoiceNote) => {
    if (shareBusyId) return;
    setShareBusyId(note.id);
    setShareErrorById((current) => {
      if (!(note.id in current)) return current;
      const next = { ...current };
      delete next[note.id];
      return next;
    });
    runQuiet(async () => {
      try {
        const result = await shareLucidMorningVoiceNote(note);
        if (!result.shared) {
          setShareErrorById((current) => ({ ...current, [note.id]: 'unavailable' }));
        }
      } catch {
        setShareErrorById((current) => ({ ...current, [note.id]: 'failed' }));
      } finally {
        setShareBusyId((current) => (current === note.id ? null : current));
      }
    });
  };
  return (
    <LucidScreen
      eyebrow={copy.eyebrow}
      subtitle={copy.subtitle}
      testID="lucid-morning-voice"
      title={copy.title}
      trailing={
        <LucidIconAction
          icon="close"
          label={copy.close}
          onPress={() => closeLucidRoute(router, '/lucid/(tabs)/journal')}
        />
      }
    >
      <LucidCard accent="accent" style={styles.privacyCard}>
        <Ionicons color={palette.accent} name="phone-portrait-outline" size={LucidIcon.md} />
        <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.privacy}</Text>
      </LucidCard>

      <LucidCard style={styles.captureCard} testID="lucid-morning-voice-capture">
        <Text style={[styles.body, { color: palette.text }]}>{copy.micContext}</Text>
        <Text accessibilityLiveRegion="polite" style={[styles.meta, { color: palette.textMuted }]}>
          {copy.completeNever}
        </Text>
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.status, { color: palette.text }]}
          testID="lucid-morning-voice-status"
        >
          {liveStatus}
        </Text>
        <Text
          accessibilityLiveRegion="polite"
          accessibilityLabel={copy.durationLabel(formatDuration(recorder.durationMillis))}
          style={[styles.meta, { color: palette.textMuted }]}
          testID="lucid-morning-voice-duration"
        >
          {copy.duration}: {formatDuration(recorder.durationMillis)}
        </Text>
        {captureError ? (
          <Text
            accessibilityLiveRegion="assertive"
            style={[styles.body, { color: palette.danger }]}
            testID="lucid-morning-voice-error"
          >
            {captureError}
          </Text>
        ) : null}
        {phase === 'interrupted' || phase === 'recoverable' ? (
          <Text accessibilityLiveRegion="polite" style={[styles.body, { color: palette.textSecondary }]}>
            {phase === 'interrupted' ? copy.interrupted : copy.recoverable}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {canSpeak ? (
            <LucidButton
              accessibilityHint={copy.speakHint}
              icon="mic-outline"
              label={copy.speak}
              onPress={() => {
                if (canReset) recorder.reset();
                runQuiet(recorder.start);
              }}
              testID="lucid-morning-voice-speak"
            />
          ) : null}
          {canPause ? (
            <LucidButton
              accessibilityHint={copy.pauseHint}
              label={copy.pause}
              onPress={() => runQuiet(recorder.pause)}
              testID="lucid-morning-voice-pause"
              variant="secondary"
            />
          ) : null}
          {canResume ? (
            <LucidButton
              accessibilityHint={copy.resumeHint}
              label={copy.resume}
              onPress={() => runQuiet(recorder.resume)}
              testID="lucid-morning-voice-resume"
            />
          ) : null}
          {canStop ? (
            <LucidButton
              accessibilityHint={copy.stopHint}
              label={copy.stop}
              onPress={() => runQuiet(recorder.stop)}
              testID="lucid-morning-voice-stop"
              variant="secondary"
            />
          ) : null}
          {persistRetryable ? (
            <LucidButton
              accessibilityHint={copy.retrySaveHint}
              label={copy.retrySave}
              onPress={() => runQuiet(recorder.stop)}
              testID="lucid-morning-voice-retry-save"
            />
          ) : null}
          {canReset && !canSpeak ? (
            <LucidButton
              label={copy.reset}
              onPress={recorder.reset}
              testID="lucid-morning-voice-reset"
              variant="secondary"
            />
          ) : null}
        </View>
      </LucidCard>

      {listError ? (
        <LucidCard style={styles.noteCard}>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{listError}</Text>
          <LucidButton label={copy.retry} onPress={() => runQuiet(notesApi.refresh)} />
        </LucidCard>
      ) : null}
      <LucidSectionHeader
        action={<LucidPill label={String(visibleNotes.length)} tone="neutral" />}
        title={copy.notes}
      />
      {notesApi.isLoading ? (
        <Text accessibilityLiveRegion="polite" style={[styles.empty, { color: palette.textSecondary }]}>
          {copy.loading}
        </Text>
      ) : null}
      {!notesApi.isLoading && visibleNotes.length === 0 ? (
        <Text style={[styles.empty, { color: palette.textSecondary }]}>{copy.empty}</Text>
      ) : null}
      {visibleNotes.map((note) => (
        <MorningVoiceNoteRow
          busy={notesApi.isMutating}
          copy={copy}
          experiments={experiments}
          key={note.id}
          locale={content.locale}
          note={note}
          onClearTranscript={(noteId) => notesApi.updateTranscript(noteId, null)}
          onDelete={confirmDelete}
          onLink={notesApi.linkToExperiment}
          onRename={notesApi.renameNote}
          onSaveTranscript={notesApi.updateTranscript}
          onShare={shareNote}
          palette={palette}
          shareBusy={shareBusyId === note.id}
          shareError={shareErrorById[note.id] ?? null}
        />
      ))}
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  privacyCard: { flexDirection: 'row', gap: LucidSpace.sm, alignItems: 'center' },
  captureCard: { gap: LucidSpace.sm },
  body: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  status: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  meta: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
    textTransform: 'uppercase',
  },
  empty: {
    paddingVertical: LucidSpace.lg,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
    textAlign: 'center',
  },
  actions: { gap: LucidSpace.sm },
  noteCard: { gap: LucidSpace.sm, marginBottom: LucidSpace.md },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: LucidSpace.sm },
  noteTitleBlock: { flex: 1, minWidth: 0, gap: 4 },
  noteTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  playback: { gap: LucidSpace.sm },
  input: {
    borderWidth: 1,
    borderRadius: LucidRadius.md,
    paddingHorizontal: LucidSpace.md,
    paddingVertical: LucidSpace.sm,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  transcript: { minHeight: 88, textAlignVertical: 'top' },
});
