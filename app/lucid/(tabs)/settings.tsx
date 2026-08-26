import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import {
  LUCID_TAB_BAR_INSET,
  LucidButton,
  LucidCard,
  LucidIconTile,
  LucidPill,
  LucidScreen,
  LucidSectionHeader,
  LucidToggleRow,
} from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidIcon, LucidPress, LucidRadius, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useAuth } from '@/context/AuthContext';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { isLucidLocalTime } from '@/lib/lucid/model';
import type {
  LucidAccessibilityPreferences,
  LucidExperienceLevel,
  LucidGoal,
  LucidLocale,
  LucidSleepSchedule,
  LucidSyncEntity,
  LucidTrainerPreferences,
} from '@/lib/lucid/model';
import {
  createLucidTrainerMutation,
  queueLucidTrainerMutation,
} from '@/services/lucidTrainerSync';
import { updateLucidTrainerState } from '@/services/lucidTrainerStorage';

const COPY = {
  en: {
    eyebrow: 'Settings',
    title: 'Your trainer, your choices',
    account: 'Account and Noctalia Plus',
    signed: 'Shared Noctalia account',
    guest: 'Local guest mode',
    accountBody: 'Signing in enables optional sync and shared subscription recognition. Core training stays available offline.',
    manage: 'Open account controls',
    syncRecovery: 'Sync needs attention',
    syncOffline: 'No network is available. Your local changes are safe and can be retried later.',
    syncError: 'The last sync did not complete. Your local changes remain available.',
    syncConflicts: 'conflicts',
    syncFailed: 'failed',
    syncBlocked: 'blocked',
    syncPending: 'pending',
    retrySync: 'Retry sync',
    appearance: 'Appearance',
    appearanceBody: 'Dynamic follows morning, daylight, afterglow and night.',
    dynamic: 'Dynamic',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    journey: 'My journey',
    horizon: 'Horizon',
    experience: 'Starting point',
    training: 'Training preferences',
    weekly: 'Practice rhythm',
    nightsPerWeek: 'nights per week',
    reminders: 'Reality-check reminders',
    perDay: 'per day',
    notifications: 'Training notifications',
    notificationsBody: 'Master switch for Lucid training reminders. Turning it off cancels scheduled reminders without changing how many reality checks you want.',
    decrease: 'Decrease',
    increase: 'Increase',
    schedule: 'Sleep window',
    scheduleBody: 'Preparation and reminders stay within your sleep window.',
    bedtime: 'Bedtime',
    wakeTime: 'Wake time',
    timeZone: 'Time zone',
    useDeviceZone: 'Use device time zone',
    saveSchedule: 'Save sleep window',
    invalidTime: 'Enter valid 24-hour times, for example 22:30 and 07:00.',
    saved: 'Sleep window saved.',
    saveError: 'This preference could not be saved. Your previous settings remain available.',
    accessibility: 'Accessibility',
    accessibilityBody: 'Trainer supports system text scaling and labelled controls. You can also keep motion to a minimum.',
    reduceMotion: 'Reduce motion',
    reduceMotionBody: 'Keep decorative transitions to a minimum throughout Trainer.',
    systemText: 'System text size',
    systemTextBody: 'Trainer inherits the size chosen in your device accessibility settings. It has no text size setting of its own.',
    screenReader: 'Screen reader labels',
    screenReaderBody: 'Buttons, toggles, progress and inputs expose names and states.',
    sync: 'Cloud sync',
    syncBody: 'Encrypted transport to your Noctalia account. Disabled by default.',
    link: 'Noctalia handoff',
    linkBody: 'Allows a minimal, consented experiment summary to open in Noctalia.',
    analytics: 'Product analytics',
    analyticsBody: 'Only fixed, non-free-text events. Disabled by default.',
    language: 'Language',
    secondary: 'Resources and control',
    plan: 'Subscription',
    permissions: 'Permissions',
    science: 'Science and limits',
    privacy: 'Privacy',
    data: 'Data management',
    help: 'Help',
    about: 'About',
  },
  fr: {
    eyebrow: 'Réglages',
    title: 'Votre entraînement, vos choix',
    account: 'Compte et Noctalia Plus',
    signed: 'Compte Noctalia partagé',
    guest: 'Mode invité local',
    accountBody: 'La connexion active la synchronisation facultative et la reconnaissance de l’abonnement partagé. L’entraînement essentiel reste hors ligne.',
    manage: 'Ouvrir les contrôles du compte',
    syncRecovery: 'La synchronisation demande votre attention',
    syncOffline: 'Aucun réseau n’est disponible. Vos modifications locales restent enregistrées et pourront être renvoyées plus tard.',
    syncError: 'La dernière synchronisation n’a pas abouti. Vos modifications locales restent disponibles.',
    syncConflicts: 'conflits',
    syncFailed: 'échecs',
    syncBlocked: 'bloqués',
    syncPending: 'en attente',
    retrySync: 'Réessayer la synchronisation',
    appearance: 'Apparence',
    appearanceBody: 'Le mode dynamique suit le matin, le jour, l’afterglow et la nuit.',
    dynamic: 'Dynamique',
    system: 'Système',
    light: 'Clair',
    dark: 'Sombre',
    journey: 'Mon parcours',
    horizon: 'Horizon',
    experience: 'Point de départ',
    training: 'Préférences d’entraînement',
    weekly: 'Rythme de pratique',
    nightsPerWeek: 'nuits par semaine',
    reminders: 'Rappels de tests de réalité',
    perDay: 'par jour',
    notifications: 'Notifications d’entraînement',
    notificationsBody: 'Interrupteur maître des rappels d’entraînement Lucid. Le désactiver annule les rappels programmés, sans changer le nombre de tests de réalité souhaités.',
    decrease: 'Diminuer',
    increase: 'Augmenter',
    schedule: 'Fenêtre de sommeil',
    scheduleBody: 'La préparation et les rappels restent dans votre fenêtre de sommeil.',
    bedtime: 'Coucher',
    wakeTime: 'Réveil',
    timeZone: 'Fuseau horaire',
    useDeviceZone: 'Utiliser le fuseau de l’appareil',
    saveSchedule: 'Enregistrer la fenêtre',
    invalidTime: 'Saisissez des heures valides sur 24 h, par exemple 22:30 et 07:00.',
    saved: 'Fenêtre de sommeil enregistrée.',
    saveError: 'Cette préférence n’a pas pu être enregistrée. Vos réglages précédents restent disponibles.',
    accessibility: 'Accessibilité',
    accessibilityBody: 'Le Trainer respecte la taille de texte du système et fournit des contrôles nommés. Vous pouvez aussi limiter les mouvements.',
    reduceMotion: 'Réduire les mouvements',
    reduceMotionBody: 'Limiter au minimum les transitions décoratives dans le Trainer.',
    systemText: 'Taille de texte système',
    systemTextBody: 'Le Trainer hérite de la taille choisie dans les réglages d’accessibilité de l’appareil. Il n’a pas de réglage de taille propre.',
    screenReader: 'Libellés pour lecteur d’écran',
    screenReaderBody: 'Les boutons, interrupteurs, progressions et champs exposent leur nom et leur état.',
    sync: 'Synchronisation cloud',
    syncBody: 'Transport chiffré vers votre compte Noctalia. Désactivé par défaut.',
    link: 'Passage vers Noctalia',
    linkBody: 'Autorise un résumé minimal et consenti à s’ouvrir dans Noctalia.',
    analytics: 'Analytics produit',
    analyticsBody: 'Uniquement des événements fixes, sans texte libre. Désactivés par défaut.',
    language: 'Langue',
    secondary: 'Ressources et contrôle',
    plan: 'Abonnement',
    permissions: 'Permissions',
    science: 'Science et limites',
    privacy: 'Confidentialité',
    data: 'Gestion des données',
    help: 'Aide',
    about: 'À propos',
  },
  es: {
    eyebrow: 'Ajustes',
    title: 'Tu entrenamiento, tus decisiones',
    account: 'Cuenta y Noctalia Plus',
    signed: 'Cuenta Noctalia compartida',
    guest: 'Modo invitado local',
    accountBody: 'Iniciar sesión habilita la sincronización opcional y la suscripción compartida. El entrenamiento esencial funciona sin conexión.',
    manage: 'Abrir controles de cuenta',
    syncRecovery: 'La sincronización necesita atención',
    syncOffline: 'No hay red disponible. Tus cambios locales están a salvo y podrás reintentarlo más tarde.',
    syncError: 'La última sincronización no se completó. Tus cambios locales siguen disponibles.',
    syncConflicts: 'conflictos',
    syncFailed: 'fallidos',
    syncBlocked: 'bloqueados',
    syncPending: 'pendientes',
    retrySync: 'Reintentar sincronización',
    appearance: 'Apariencia',
    appearanceBody: 'Dinámico sigue la mañana, el día, el resplandor del atardecer y la noche.',
    dynamic: 'Dinámico',
    system: 'Sistema',
    light: 'Claro',
    dark: 'Oscuro',
    journey: 'Mi recorrido',
    horizon: 'Horizonte',
    experience: 'Punto de partida',
    training: 'Preferencias de entrenamiento',
    weekly: 'Ritmo de práctica',
    nightsPerWeek: 'noches por semana',
    reminders: 'Recordatorios de realidad',
    perDay: 'al día',
    notifications: 'Notificaciones de entrenamiento',
    notificationsBody: 'Interruptor maestro de los recordatorios de entrenamiento Lucid. Al desactivarlo se cancelan los recordatorios programados, sin cambiar cuántas pruebas de realidad quieres.',
    decrease: 'Reducir',
    increase: 'Aumentar',
    schedule: 'Horario de sueño',
    scheduleBody: 'La preparación y los recordatorios respetan tu horario de sueño.',
    bedtime: 'Hora de dormir',
    wakeTime: 'Hora de despertar',
    timeZone: 'Zona horaria',
    useDeviceZone: 'Usar zona del dispositivo',
    saveSchedule: 'Guardar horario',
    invalidTime: 'Introduce horas válidas de 24 horas, por ejemplo 22:30 y 07:00.',
    saved: 'Horario de sueño guardado.',
    saveError: 'No se ha podido guardar esta preferencia. Tus ajustes anteriores siguen disponibles.',
    accessibility: 'Accesibilidad',
    accessibilityBody: 'Trainer admite el tamaño de texto del sistema y controles etiquetados. También puedes reducir el movimiento.',
    reduceMotion: 'Reducir movimiento',
    reduceMotionBody: 'Mantiene al mínimo las transiciones decorativas del Trainer.',
    systemText: 'Tamaño de texto del sistema',
    systemTextBody: 'Trainer hereda el tamaño elegido en los ajustes de accesibilidad del dispositivo. No tiene un ajuste de tamaño propio.',
    screenReader: 'Etiquetas para lector de pantalla',
    screenReaderBody: 'Botones, interruptores, progreso y campos exponen su nombre y estado.',
    sync: 'Sincronización en nube',
    syncBody: 'Transporte cifrado a tu cuenta Noctalia. Desactivado por defecto.',
    link: 'Enlace con Noctalia',
    linkBody: 'Permite abrir un resumen mínimo y consentido en Noctalia.',
    analytics: 'Analítica del producto',
    analyticsBody: 'Solo eventos fijos, sin texto libre. Desactivada por defecto.',
    language: 'Idioma',
    secondary: 'Recursos y control',
    plan: 'Suscripción',
    permissions: 'Permisos',
    science: 'Ciencia y límites',
    privacy: 'Privacidad',
    data: 'Gestión de datos',
    help: 'Ayuda',
    about: 'Acerca de',
  },
  de: {
    eyebrow: 'Einstellungen',
    title: 'Dein Training, deine Wahl',
    account: 'Konto und Noctalia Plus',
    signed: 'Geteiltes Noctalia-Konto',
    guest: 'Lokaler Gastmodus',
    accountBody: 'Anmeldung ermöglicht optionale Synchronisierung und ein geteiltes Abo. Kerntraining bleibt offline verfügbar.',
    manage: 'Kontosteuerung öffnen',
    syncRecovery: 'Synchronisierung erfordert Aufmerksamkeit',
    syncOffline: 'Kein Netzwerk verfügbar. Deine lokalen Änderungen sind sicher und können später erneut gesendet werden.',
    syncError: 'Die letzte Synchronisierung wurde nicht abgeschlossen. Deine lokalen Änderungen bleiben verfügbar.',
    syncConflicts: 'Konflikte',
    syncFailed: 'fehlgeschlagen',
    syncBlocked: 'blockiert',
    syncPending: 'ausstehend',
    retrySync: 'Synchronisierung erneut versuchen',
    appearance: 'Darstellung',
    appearanceBody: 'Dynamisch folgt Morgen, Tag, Abendglühen und Nacht.',
    dynamic: 'Dynamisch',
    system: 'System',
    light: 'Hell',
    dark: 'Dunkel',
    journey: 'Mein Weg',
    horizon: 'Horizont',
    experience: 'Ausgangspunkt',
    training: 'Trainingseinstellungen',
    weekly: 'Übungsrhythmus',
    nightsPerWeek: 'Nächte pro Woche',
    reminders: 'Realitätscheck-Erinnerungen',
    perDay: 'pro Tag',
    notifications: 'Trainingsbenachrichtigungen',
    notificationsBody: 'Hauptschalter für Lucid-Trainingserinnerungen. Aus löscht geplante Erinnerungen, ohne die gewünschte Zahl der Realitätschecks zu ändern.',
    decrease: 'Verringern',
    increase: 'Erhöhen',
    schedule: 'Schlaffenster',
    scheduleBody: 'Vorbereitung und Hinweise bleiben in deinem Schlaffenster.',
    bedtime: 'Schlafenszeit',
    wakeTime: 'Aufstehzeit',
    timeZone: 'Zeitzone',
    useDeviceZone: 'Gerätezeitzone verwenden',
    saveSchedule: 'Schlaffenster speichern',
    invalidTime: 'Gib gültige 24-Stunden-Zeiten ein, zum Beispiel 22:30 und 07:00.',
    saved: 'Schlaffenster gespeichert.',
    saveError: 'Diese Einstellung konnte nicht gespeichert werden. Deine bisherigen Einstellungen bleiben verfügbar.',
    accessibility: 'Barrierefreiheit',
    accessibilityBody: 'Trainer unterstützt die Systemtextgröße und beschriftete Bedienelemente. Bewegungen lassen sich zusätzlich begrenzen.',
    reduceMotion: 'Bewegung reduzieren',
    reduceMotionBody: 'Beschränkt dekorative Übergänge im Trainer auf ein Minimum.',
    systemText: 'Systemtextgröße',
    systemTextBody: 'Trainer übernimmt die in den Bedienungshilfen des Geräts gewählte Größe. Eine eigene Textgröße gibt es hier nicht.',
    screenReader: 'Screenreader-Beschriftungen',
    screenReaderBody: 'Schaltflächen, Umschalter, Fortschritt und Felder geben Namen und Status aus.',
    sync: 'Cloud-Synchronisierung',
    syncBody: 'Verschlüsselter Transport zu deinem Noctalia-Konto. Standardmäßig aus.',
    link: 'Noctalia-Übergabe',
    linkBody: 'Erlaubt einen minimalen, zugestimmten Bericht in Noctalia.',
    analytics: 'Produktanalyse',
    analyticsBody: 'Nur feste Ereignisse, kein Freitext. Standardmäßig aus.',
    language: 'Sprache',
    secondary: 'Ressourcen und Kontrolle',
    plan: 'Abonnement',
    permissions: 'Berechtigungen',
    science: 'Wissenschaft und Grenzen',
    privacy: 'Datenschutz',
    data: 'Datenverwaltung',
    help: 'Hilfe',
    about: 'Über',
  },
  it: {
    eyebrow: 'Impostazioni',
    title: 'Il tuo training, le tue scelte',
    account: 'Account e Noctalia Plus',
    signed: 'Account Noctalia condiviso',
    guest: 'Modalità ospite locale',
    accountBody: 'L’accesso abilita la sincronizzazione opzionale e l’abbonamento condiviso. Il training essenziale resta offline.',
    manage: 'Apri controlli account',
    syncRecovery: 'La sincronizzazione richiede attenzione',
    syncOffline: 'Nessuna rete disponibile. Le modifiche locali sono al sicuro e potrai riprovare più tardi.',
    syncError: 'L’ultima sincronizzazione non è stata completata. Le modifiche locali restano disponibili.',
    syncConflicts: 'conflitti',
    syncFailed: 'non riusciti',
    syncBlocked: 'bloccati',
    syncPending: 'in attesa',
    retrySync: 'Riprova sincronizzazione',
    appearance: 'Aspetto',
    appearanceBody: 'Dinamico segue mattino, giorno, bagliore serale e notte.',
    dynamic: 'Dinamico',
    system: 'Sistema',
    light: 'Chiaro',
    dark: 'Scuro',
    journey: 'Il mio percorso',
    horizon: 'Orizzonte',
    experience: 'Punto di partenza',
    training: 'Preferenze training',
    weekly: 'Ritmo di pratica',
    nightsPerWeek: 'notti a settimana',
    reminders: 'Promemoria test di realtà',
    perDay: 'al giorno',
    notifications: 'Notifiche di training',
    notificationsBody: 'Interruttore principale dei promemoria di training Lucid. Disattivarlo annulla i promemoria programmati, senza cambiare quanti test di realtà vuoi.',
    decrease: 'Riduci',
    increase: 'Aumenta',
    schedule: 'Finestra di sonno',
    scheduleBody: 'Preparazione e promemoria restano nella tua finestra di sonno.',
    bedtime: 'Ora di dormire',
    wakeTime: 'Ora di sveglia',
    timeZone: 'Fuso orario',
    useDeviceZone: 'Usa il fuso del dispositivo',
    saveSchedule: 'Salva finestra di sonno',
    invalidTime: 'Inserisci orari validi di 24 ore, per esempio 22:30 e 07:00.',
    saved: 'Finestra di sonno salvata.',
    saveError: 'Impossibile salvare questa preferenza. Le impostazioni precedenti restano disponibili.',
    accessibility: 'Accessibilità',
    accessibilityBody: 'Trainer supporta la dimensione del testo di sistema e controlli etichettati. Puoi anche ridurre il movimento.',
    reduceMotion: 'Riduci movimento',
    reduceMotionBody: 'Mantiene al minimo le transizioni decorative del Trainer.',
    systemText: 'Dimensione testo di sistema',
    systemTextBody: 'Trainer eredita la dimensione scelta nelle impostazioni di accessibilità del dispositivo. Non ha un’impostazione di dimensione propria.',
    screenReader: 'Etichette per lettore di schermo',
    screenReaderBody: 'Pulsanti, interruttori, avanzamento e campi espongono nome e stato.',
    sync: 'Sincronizzazione cloud',
    syncBody: 'Trasporto cifrato al tuo account Noctalia. Disattivato di default.',
    link: 'Passaggio a Noctalia',
    linkBody: 'Consente un riepilogo minimo e autorizzato in Noctalia.',
    analytics: 'Analisi prodotto',
    analyticsBody: 'Solo eventi fissi, senza testo libero. Disattivata di default.',
    language: 'Lingua',
    secondary: 'Risorse e controllo',
    plan: 'Abbonamento',
    permissions: 'Permessi',
    science: 'Scienza e limiti',
    privacy: 'Privacy',
    data: 'Gestione dati',
    help: 'Aiuto',
    about: 'Informazioni',
  },
} as const;

type OnboardingSettingsPatch = {
  goal?: LucidGoal;
  experience?: LucidExperienceLevel;
  weeklyTarget?: number;
  sleepSchedule?: LucidSleepSchedule;
  accessibility?: LucidAccessibilityPreferences;
};

const WEEKLY_TARGET_OPTIONS = [2, 3, 5, 7] as const;

const THEME_ICONS: Record<LucidTrainerPreferences['theme'], keyof typeof Ionicons.glyphMap> = {
  dynamic: 'time-outline',
  system: 'phone-portrait-outline',
  light: 'sunny-outline',
  dark: 'moon-outline',
};

function deviceTimeZone(fallback: string): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}

export default function LucidSettingsScreen() {
  const {
    colors,
    mode,
    preference: themePreference,
    setPreference: setThemePreference,
  } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { user } = useAuth();
  const {
    state,
    content,
    updatePreferences,
    updateAnalyticsConsent,
    userScope,
    syncStatus,
    lastSyncResult,
    syncNow,
    reload,
  } = useLucidTrainer();
  const copy = COPY[content.locale];
  const [bedtime, setBedtime] = useState(state?.onboarding.sleepSchedule.bedtime ?? '22:30');
  const [wakeTime, setWakeTime] = useState(state?.onboarding.sleepSchedule.wakeTime ?? '07:00');
  const [scheduleTimeZone, setScheduleTimeZone] = useState(
    state?.onboarding.sleepSchedule.timeZone ?? 'UTC',
  );
  const [savingSetting, setSavingSetting] = useState(false);
  const [settingError, setSettingError] = useState<string | null>(null);
  const [settingStatus, setSettingStatus] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<
    'account' | 'accessibility' | 'journey' | 'language' | 'resources' | 'sync' | null
  >(null);
  const { fontScale, width } = useWindowDimensions();
  const compactLayout = width < 380 || fontScale >= 1.3;

  const persistOnboardingSettings = useCallback(
    async (
      patch: OnboardingSettingsPatch,
      preferencesPatch?: Partial<LucidTrainerPreferences>,
    ) => {
      if (!state) return;
      let entitiesToQueue: LucidSyncEntity[] = [];

      await updateLucidTrainerState(userScope, (current) => {
        const updatedAt = Date.now();
        const onboarding = {
          ...current.onboarding,
          ...patch,
          updatedAt,
        };
        const preferences = preferencesPatch
          ? { ...current.preferences, ...preferencesPatch, updatedAt }
          : current.preferences;
        entitiesToQueue = [
          {
            entityType: 'onboarding',
            entityKey: 'onboarding',
            value: onboarding,
          },
          ...(preferencesPatch
            ? ([{
                entityType: 'preferences',
                entityKey: 'preferences',
                value: preferences,
              }] satisfies LucidSyncEntity[])
            : []),
        ];
        return { ...current, onboarding, preferences, updatedAt };
      });

      if (user?.id && state.preferences.cloudSyncEnabled) {
        for (const entity of entitiesToQueue) {
          await queueLucidTrainerMutation(
            createLucidTrainerMutation({ userScope, operation: 'upsert', entity }),
          );
        }
      }
      await reload();
    },
    [reload, state, user?.id, userScope],
  );

  const runSettingChange = async (
    change: () => Promise<void>,
    successMessage?: string,
    syncAfterChange = true,
  ) => {
    if (savingSetting) return;
    setSavingSetting(true);
    setSettingError(null);
    setSettingStatus(null);
    try {
      await change();
      if (syncAfterChange && state?.preferences.cloudSyncEnabled && user?.id) {
        await syncNow();
      }
      if (successMessage) setSettingStatus(successMessage);
    } catch {
      setSettingError(copy.saveError);
    } finally {
      setSavingSetting(false);
    }
  };

  if (!state) {
    return (
      <LucidScreen
        testID="lucid-settings"
        bottomInset={LUCID_TAB_BAR_INSET}
        eyebrow={copy.eyebrow}
        title={copy.title}
        subtitle={content.chrome.common.loading}
      >
        {null}
      </LucidScreen>
    );
  }

  const selectedTheme: LucidTrainerPreferences['theme'] =
    themePreference === 'auto' ? 'system' : themePreference;
  const themeOptions: {
    value: LucidTrainerPreferences['theme'];
    label: string;
  }[] = [
    { value: 'dynamic', label: copy.dynamic },
    { value: 'system', label: copy.system },
    { value: 'light', label: copy.light },
    { value: 'dark', label: copy.dark },
  ];
  const selectedGoal = content.onboarding.goals.find(
    (choice) => choice.id === state.onboarding.goal,
  );
  const selectedExperience = content.onboarding.experienceLevels.find(
    (choice) => choice.id === state.onboarding.experience,
  );
  const journeySummary = [selectedGoal?.title, selectedExperience?.title]
    .filter((value): value is string => Boolean(value))
    .join(' · ');
  const rows: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    route: string;
  }[] = [
    { label: copy.plan, icon: 'diamond', route: '/lucid/subscription' },
    { label: copy.permissions, icon: 'notifications', route: '/lucid/permissions' },
    { label: copy.science, icon: 'flask', route: '/lucid/science' },
    { label: copy.privacy, icon: 'shield-checkmark', route: '/lucid/privacy' },
    { label: copy.data, icon: 'folder-open', route: '/lucid/data' },
    { label: copy.help, icon: 'help-circle', route: '/lucid/help' },
    { label: copy.about, icon: 'information-circle', route: '/lucid/about' },
  ];
  const scheduleIsValid = isLucidLocalTime(bedtime) && isLucidLocalTime(wakeTime);
  const syncNeedsRecovery =
    syncStatus === 'offline' ||
    syncStatus === 'error' ||
    lastSyncResult?.outcome === 'offline' ||
    Boolean(
      lastSyncResult &&
        (lastSyncResult.conflicts > 0 ||
          lastSyncResult.failed > 0 ||
          lastSyncResult.blocked > 0 ||
          lastSyncResult.pending > 0),
    );
  const syncRecoverySummary = lastSyncResult
    ? [
        `${lastSyncResult.conflicts} ${copy.syncConflicts}`,
        `${lastSyncResult.failed} ${copy.syncFailed}`,
        `${lastSyncResult.blocked} ${copy.syncBlocked}`,
        `${lastSyncResult.pending} ${copy.syncPending}`,
      ].join(' · ')
    : syncStatus === 'offline'
      ? copy.syncOffline
      : copy.syncError;

  const changeTheme = (theme: LucidTrainerPreferences['theme']) => {
    void runSettingChange(async () => {
      const nextThemePreference = theme === 'system' ? 'auto' : theme;
      await setThemePreference(nextThemePreference);
      try {
        await updatePreferences({ theme });
      } catch (error) {
        await setThemePreference(themePreference);
        throw error;
      }
    });
  };

  const changeWeeklyTarget = (delta: number) => {
    const current = state.onboarding.weeklyTarget;
    const next = delta < 0
      ? [...WEEKLY_TARGET_OPTIONS].reverse().find((value) => value < current)
      : WEEKLY_TARGET_OPTIONS.find((value) => value > current);
    if (next === undefined) return;
    void runSettingChange(() => persistOnboardingSettings({ weeklyTarget: next }));
  };

  const changeGoal = (goal: LucidGoal) => {
    if (goal === state.onboarding.goal) return;
    void runSettingChange(() => persistOnboardingSettings({ goal }));
  };

  const changeExperience = (experience: LucidExperienceLevel) => {
    if (experience === state.onboarding.experience) return;
    void runSettingChange(() => persistOnboardingSettings({ experience }));
  };

  const changeReminderCount = (delta: number) => {
    const next = Math.max(
      0,
      Math.min(12, state.preferences.realityCheckRemindersPerDay + delta),
    );
    if (next === state.preferences.realityCheckRemindersPerDay) return;
    void runSettingChange(() =>
      updatePreferences({ realityCheckRemindersPerDay: next }),
    );
  };

  const changeNotificationsEnabled = (enabled: boolean) => {
    if (enabled === state.preferences.notificationsEnabled) return;
    if (enabled) {
      router.push('/lucid/permissions' as never);
      return;
    }
    void runSettingChange(() => updatePreferences({ notificationsEnabled: false }));
  };

  const saveSchedule = () => {
    if (!scheduleIsValid) {
      setSettingStatus(null);
      setSettingError(copy.invalidTime);
      return;
    }
    void runSettingChange(async () => {
      await persistOnboardingSettings({
        sleepSchedule: { bedtime, wakeTime, timeZone: scheduleTimeZone },
      }, { timeZone: scheduleTimeZone });
    }, copy.saved);
  };

  const changeAccessibility = (reduceMotion: boolean) => {
    void runSettingChange(() =>
      persistOnboardingSettings({
        accessibility: {
          ...state.onboarding.accessibility,
          reduceMotion,
        },
      }),
    );
  };

  return (
    <LucidScreen
      testID="lucid-settings"
      bottomInset={LUCID_TAB_BAR_INSET}
      eyebrow={copy.eyebrow}
      title={copy.title}
    >
      <LucidSectionHeader title={copy.appearance} caption={copy.appearanceBody} />
      <View accessibilityRole="radiogroup" style={styles.optionGrid}>
        {themeOptions.map((option) => {
          const selected = selectedTheme === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected, disabled: savingSetting }}
              disabled={savingSetting}
              onPress={() => changeTheme(option.value)}
              testID={`lucid-theme-${option.value}`}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? palette.accentSoft : palette.surface,
                  borderColor: selected ? palette.accent : palette.borderInteractive,
                  opacity: pressed ? LucidPress.opacity : 1,
                },
              ]}
            >
              <Ionicons
                name={THEME_ICONS[option.value]}
                size={LucidIcon.md}
                color={selected ? palette.accent : palette.textSecondary}
              />
              <Text
                style={[
                  styles.optionLabel,
                  { color: selected ? palette.accent : palette.text },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SettingsDisclosure
        expanded={expandedSection === 'journey'}
        icon="compass-outline"
        onPress={() => setExpandedSection((current) => current === 'journey' ? null : 'journey')}
        palette={palette}
        summary={journeySummary}
        testID="lucid-settings-journey"
        title={copy.journey}
      >
        <Text accessibilityRole="header" style={[styles.journeySectionLabel, { color: palette.text }]}>
          {copy.horizon}
        </Text>
        <View
          accessibilityLabel={copy.horizon}
          accessibilityRole="radiogroup"
          style={styles.journeyChoices}
        >
          {content.onboarding.goals.map((choice) => {
            const selected = choice.id === state.onboarding.goal;
            return (
              <Pressable
                key={choice.id}
                accessibilityLabel={choice.title}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, selected, disabled: savingSetting }}
                disabled={savingSetting}
                onPress={() => changeGoal(choice.id)}
                testID={`lucid-settings-goal-${choice.id}`}
                style={({ pressed }) => [
                  styles.journeyChoice,
                  {
                    backgroundColor: selected ? palette.accentSoft : 'transparent',
                    borderColor: selected ? palette.accent : palette.border,
                    opacity: pressed ? LucidPress.opacity : 1,
                  },
                ]}
              >
                <Ionicons
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  color={selected ? palette.accent : palette.textMuted}
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={LucidIcon.md}
                />
                <Text style={[styles.journeyChoiceLabel, { color: palette.text }]}>
                  {choice.title}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text accessibilityRole="header" style={[styles.journeySectionLabel, { color: palette.text }]}>
          {copy.experience}
        </Text>
        <View
          accessibilityLabel={copy.experience}
          accessibilityRole="radiogroup"
          style={styles.journeyChoices}
        >
          {content.onboarding.experienceLevels.map((choice) => {
            const selected = choice.id === state.onboarding.experience;
            return (
              <Pressable
                key={choice.id}
                accessibilityLabel={choice.title}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, selected, disabled: savingSetting }}
                disabled={savingSetting}
                onPress={() => changeExperience(choice.id)}
                testID={`lucid-settings-experience-${choice.id}`}
                style={({ pressed }) => [
                  styles.journeyChoice,
                  {
                    backgroundColor: selected ? palette.accentSoft : 'transparent',
                    borderColor: selected ? palette.accent : palette.border,
                    opacity: pressed ? LucidPress.opacity : 1,
                  },
                ]}
              >
                <Ionicons
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  color={selected ? palette.accent : palette.textMuted}
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={LucidIcon.md}
                />
                <Text style={[styles.journeyChoiceLabel, { color: palette.text }]}>
                  {choice.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SettingsDisclosure>

      <LucidSectionHeader title={copy.training} />
      <LucidCard>
        <View style={styles.counter}>
          <View style={styles.counterCopy}>
            <Text style={[styles.accountTitle, { color: palette.text }]}>{copy.weekly}</Text>
            <Text style={[styles.accountSub, { color: palette.textSecondary }]}>
              {state.onboarding.weeklyTarget} {copy.nightsPerWeek}
            </Text>
          </View>
          <View style={styles.counterButtons}>
            <CounterButton
              accessibilityLabel={`${copy.decrease}: ${copy.weekly}`}
              color={palette.textSecondary}
              disabled={savingSetting || state.onboarding.weeklyTarget <= WEEKLY_TARGET_OPTIONS[0]}
              icon="remove"
              onPress={() => changeWeeklyTarget(-1)}
              testID="lucid-weekly-decrease"
            />
            <CounterButton
              accessibilityLabel={`${copy.increase}: ${copy.weekly}`}
              color={palette.accent}
              disabled={savingSetting || state.onboarding.weeklyTarget >= WEEKLY_TARGET_OPTIONS[WEEKLY_TARGET_OPTIONS.length - 1]}
              icon="add"
              onPress={() => changeWeeklyTarget(1)}
              testID="lucid-weekly-increase"
            />
          </View>
        </View>
        <View style={[styles.counter, { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={styles.counterCopy}>
            <Text style={[styles.accountTitle, { color: palette.text }]}>{copy.reminders}</Text>
            <Text style={[styles.accountSub, { color: palette.textSecondary }]}>
              {state.preferences.realityCheckRemindersPerDay} {copy.perDay}
            </Text>
          </View>
          <View style={styles.counterButtons}>
            <CounterButton
              accessibilityLabel={`${copy.decrease}: ${copy.reminders}`}
              color={palette.textSecondary}
              disabled={savingSetting || state.preferences.realityCheckRemindersPerDay <= 0}
              icon="remove"
              onPress={() => changeReminderCount(-1)}
              testID="lucid-reminders-decrease"
            />
            <CounterButton
              accessibilityLabel={`${copy.increase}: ${copy.reminders}`}
              color={palette.accent}
              disabled={savingSetting || state.preferences.realityCheckRemindersPerDay >= 12}
              icon="add"
              onPress={() => changeReminderCount(1)}
              testID="lucid-reminders-increase"
            />
          </View>
        </View>
        <LucidToggleRow
          title={copy.notifications}
          description={copy.notificationsBody}
          value={state.preferences.notificationsEnabled}
          disabled={savingSetting}
          onValueChange={changeNotificationsEnabled}
          icon="notifications"
        />
      </LucidCard>

      <LucidSectionHeader title={copy.schedule} caption={copy.scheduleBody} />
      <LucidCard accent="accent">
        <View style={[styles.timeRow, compactLayout && styles.timeRowCompact]}>
          <TimeField
            label={copy.bedtime}
            onChangeText={setBedtime}
            palette={palette}
            testID="lucid-bedtime-input"
            value={bedtime}
          />
          <TimeField
            label={copy.wakeTime}
            onChangeText={setWakeTime}
            palette={palette}
            testID="lucid-wake-input"
            value={wakeTime}
          />
        </View>
        <View style={[styles.zoneRow, compactLayout && styles.zoneRowCompact]}>
          <View style={styles.counterCopy}>
            <Text style={[styles.fieldLabel, { color: palette.text }]}>{copy.timeZone}</Text>
            <Text selectable style={[styles.zoneValue, { color: palette.textSecondary }]}>
              {scheduleTimeZone}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={savingSetting}
            onPress={() => setScheduleTimeZone(deviceTimeZone(scheduleTimeZone))}
            testID="lucid-use-device-timezone"
            style={({ pressed }) => [
              styles.zoneButton,
              {
                backgroundColor: palette.surfaceRaised,
                borderColor: palette.borderInteractive,
                opacity: pressed ? LucidPress.opacity : 1,
              },
            ]}
          >
            <Text style={[styles.zoneButtonLabel, { color: palette.accent }]}>
              {copy.useDeviceZone}
            </Text>
          </Pressable>
        </View>
        {!scheduleIsValid ? (
          <Text accessibilityRole="alert" style={[styles.feedback, { color: palette.danger }]}>
            {copy.invalidTime}
          </Text>
        ) : null}
        <LucidButton
          label={copy.saveSchedule}
          icon="time"
          disabled={!scheduleIsValid}
          loading={savingSetting}
          onPress={saveSchedule}
          testID="lucid-save-schedule"
        />
      </LucidCard>

      {settingError ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          selectable
          style={[styles.feedback, { color: palette.danger }]}
        >
          {settingError}
        </Text>
      ) : null}
      {settingStatus ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="text"
          style={[styles.feedback, { color: palette.accent }]}
        >
          {settingStatus}
        </Text>
      ) : null}

      <View style={styles.disclosureStack}>
        <SettingsDisclosure
          expanded={expandedSection === 'account'}
          icon={user ? 'person-circle' : 'person-outline'}
          onPress={() => setExpandedSection((section) => section === 'account' ? null : 'account')}
          palette={palette}
          summary={user?.email ?? copy.guest}
          testID="lucid-settings-account"
          title={copy.account}
        >
          <View style={styles.accountTop}>
            <LucidIconTile icon={user ? 'person-circle' : 'person-outline'} tone="accent" size="md" />
            <View style={styles.accountCopy}>
              <Text style={[styles.accountTitle, { color: palette.text }]}>
                {user ? copy.signed : copy.guest}
              </Text>
              <Text style={[styles.accountSub, { color: palette.textSecondary }]}>
                {user?.email ?? copy.accountBody}
              </Text>
            </View>
            <LucidPill label={syncStatus} tone={syncStatus === 'synced' ? 'accent' : 'neutral'} />
          </View>
          <LucidButton
            label={copy.manage}
            variant={user ? 'secondary' : 'primary'}
            icon={user ? 'person' : 'log-in'}
            onPress={() => router.push('/lucid/account' as never)}
          />
        </SettingsDisclosure>

        <SettingsDisclosure
          expanded={expandedSection === 'sync'}
          icon="shield-checkmark"
          onPress={() => setExpandedSection((section) => section === 'sync' ? null : 'sync')}
          palette={palette}
          summary={syncNeedsRecovery ? copy.syncRecovery : syncStatus}
          testID="lucid-settings-sync"
          title={copy.sync}
        >
          {syncNeedsRecovery ? (
            <View style={styles.syncRecoveryContent}>
              <View style={styles.syncRecoveryHeader}>
                <Ionicons name="cloud-offline-outline" size={LucidIcon.lg} color={palette.amber} />
                <View style={styles.counterCopy}>
                  <Text style={[styles.accountTitle, { color: palette.text }]}>{copy.syncRecovery}</Text>
                  <Text
                    accessibilityLiveRegion="polite"
                    selectable
                    style={[styles.accountSub, { color: palette.textSecondary }]}
                  >
                    {lastSyncResult?.outcome === 'offline'
                      ? `${copy.syncOffline} ${syncRecoverySummary}`
                      : syncRecoverySummary}
                  </Text>
                </View>
              </View>
              <LucidButton
                label={copy.retrySync}
                variant="secondary"
                icon="refresh"
                disabled={!user || savingSetting}
                loading={syncStatus === 'syncing'}
                onPress={() =>
                  void runSettingChange(async () => { await syncNow(); }, undefined, false)
                }
                testID="lucid-sync-retry"
              />
            </View>
          ) : null}
          <LucidToggleRow
            title={copy.sync}
            description={copy.syncBody}
            value={state.preferences.cloudSyncEnabled}
            disabled={!user || savingSetting}
            onValueChange={(value) => {
              void runSettingChange(async () => {
                await updatePreferences({ cloudSyncEnabled: value });
                if (value) await syncNow();
              }, undefined, false);
            }}
            icon="cloud-upload"
          />
          <LucidToggleRow
            title={copy.link}
            description={copy.linkBody}
            value={state.preferences.noctaliaLinkEnabled}
            disabled={savingSetting}
            onValueChange={(value) =>
              void runSettingChange(() => updatePreferences({ noctaliaLinkEnabled: value }))
            }
            icon="link"
          />
          <LucidToggleRow
            title={copy.analytics}
            description={copy.analyticsBody}
            value={state.onboarding.analyticsConsent === true}
            disabled={savingSetting}
            onValueChange={(value) =>
              void runSettingChange(() => updateAnalyticsConsent(value))
            }
            icon="analytics"
            divider={false}
          />
        </SettingsDisclosure>

        <SettingsDisclosure
          expanded={expandedSection === 'accessibility'}
          icon="accessibility"
          onPress={() => setExpandedSection((section) => section === 'accessibility' ? null : 'accessibility')}
          palette={palette}
          summary={state.onboarding.accessibility.reduceMotion ? copy.reduceMotion : copy.systemText}
          testID="lucid-settings-accessibility"
          title={copy.accessibility}
        >
          <LucidToggleRow
            title={copy.reduceMotion}
            description={copy.reduceMotionBody}
            value={state.onboarding.accessibility.reduceMotion}
            disabled={savingSetting}
            onValueChange={changeAccessibility}
            icon="accessibility"
          />
          <AccessibilityStatusRow
            icon="text"
            title={copy.systemText}
            description={copy.systemTextBody}
            palette={palette}
          />
          <AccessibilityStatusRow
            icon="ear-outline"
            title={copy.screenReader}
            description={copy.screenReaderBody}
            palette={palette}
          />
        </SettingsDisclosure>

        <SettingsDisclosure
          expanded={expandedSection === 'language'}
          icon="language"
          onPress={() => setExpandedSection((section) => section === 'language' ? null : 'language')}
          palette={palette}
          summary={state.preferences.locale.toUpperCase()}
          testID="lucid-settings-language"
          title={copy.language}
        >
          <View accessibilityRole="radiogroup" style={styles.languages}>
            {(['fr', 'en', 'es', 'de', 'it'] as LucidLocale[]).map((locale) => (
              <Pressable
                key={locale}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: state.preferences.locale === locale,
                  selected: state.preferences.locale === locale,
                }}
                onPress={() => void updatePreferences({ locale })}
                style={[
                  styles.language,
                  {
                    backgroundColor:
                      state.preferences.locale === locale
                        ? palette.accentSoft
                        : palette.surfaceRaised,
                    borderColor:
                      state.preferences.locale === locale ? palette.accent : palette.borderInteractive,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.languageLabel,
                    {
                      color:
                        state.preferences.locale === locale
                          ? palette.accent
                          : palette.textSecondary,
                    },
                  ]}
                >
                  {locale.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </SettingsDisclosure>

        <SettingsDisclosure
          expanded={expandedSection === 'resources'}
          icon="ellipsis-horizontal-circle"
          onPress={() => setExpandedSection((section) => section === 'resources' ? null : 'resources')}
          palette={palette}
          testID="lucid-settings-resources"
          title={copy.secondary}
        >
          {rows.map((row, index) => (
            <Pressable
              key={row.route}
              accessibilityRole="link"
              onPress={() => router.push(row.route as never)}
              style={({ pressed }) => [
                styles.settingRow,
                index < rows.length - 1 && {
                  borderBottomColor: palette.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name={row.icon} size={LucidIcon.md} color={palette.accent} />
              <Text style={[styles.settingLabel, { color: palette.text }]}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={LucidIcon.md} color={palette.textMuted} />
            </Pressable>
          ))}
        </SettingsDisclosure>
      </View>
    </LucidScreen>
  );
}

function SettingsDisclosure({
  children,
  expanded,
  icon,
  onPress,
  palette,
  summary,
  testID,
  title,
}: {
  children: React.ReactNode;
  expanded: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  palette: ReturnType<typeof getLucidPalette>;
  summary?: string;
  testID: string;
  title: string;
}) {
  return (
    <View style={[styles.disclosure, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Pressable
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [styles.disclosureTrigger, pressed && styles.pressed]}
      >
        <Ionicons name={icon} size={LucidIcon.md} color={palette.accent} />
        <View style={styles.disclosureCopy}>
          <Text style={[styles.accountTitle, { color: palette.text }]}>{title}</Text>
          {summary ? (
            <Text numberOfLines={1} style={[styles.disclosureSummary, { color: palette.textSecondary }]}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={LucidIcon.md}
          color={palette.textMuted}
        />
      </Pressable>
      {expanded ? (
        <View style={[styles.disclosureBody, { borderTopColor: palette.border }]}>{children}</View>
      ) : null}
    </View>
  );
}

function CounterButton({
  accessibilityLabel,
  color,
  disabled,
  icon,
  onPress,
  testID,
}: {
  accessibilityLabel: string;
  color: string;
  disabled: boolean;
  icon: 'add' | 'remove';
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={LucidSpace.xs}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.counterButton, { opacity: disabled ? 0.38 : pressed ? LucidPress.opacity : 1 }]}
    >
      <Ionicons name={`${icon}-circle`} size={LucidIcon.xl} color={color} />
    </Pressable>
  );
}

function TimeField({
  label,
  onChangeText,
  palette,
  testID,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  palette: ReturnType<typeof getLucidPalette>;
  testID: string;
  value: string;
}) {
  const valid = isLucidLocalTime(value);
  return (
    <View style={styles.timeField}>
      <Text style={[styles.fieldLabel, { color: palette.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        onChangeText={onChangeText}
        placeholder="22:30"
        placeholderTextColor={palette.textMuted}
        selectTextOnFocus
        style={[
          styles.timeInput,
          {
            backgroundColor: palette.surfaceRaised,
            borderColor: valid ? palette.borderInteractive : palette.danger,
            color: palette.text,
          },
        ]}
        testID={testID}
        value={value}
      />
    </View>
  );
}

function AccessibilityStatusRow({
  description,
  icon,
  palette,
  title,
}: {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  palette: ReturnType<typeof getLucidPalette>;
  title: string;
}) {
  return (
    <View style={[styles.accessibilityRow, { borderTopColor: palette.border }]}>
      <Ionicons name={icon} size={LucidIcon.md} color={palette.accent} />
      <View style={styles.counterCopy}>
        <Text style={[styles.accountTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.accountSub, { color: palette.textSecondary }]}>{description}</Text>
      </View>
      <LucidPill label="OS" tone="neutral" />
    </View>
  );
}

const styles = StyleSheet.create({
  accountTop: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md },
  accountCopy: { flex: 1, gap: LucidSpace.xs },
  accountTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  accountSub: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  disclosureStack: { gap: LucidSpace.sm },
  disclosure: { overflow: 'hidden', borderRadius: LucidRadius.lg, borderWidth: 1 },
  disclosureTrigger: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md, paddingHorizontal: LucidSpace.lg, paddingVertical: LucidSpace.md },
  disclosureCopy: { flex: 1, gap: 2 },
  disclosureSummary: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  disclosureBody: { gap: LucidSpace.md, borderTopWidth: StyleSheet.hairlineWidth, padding: LucidSpace.lg },
  journeySectionLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.overline[0], lineHeight: LucidType.overline[1], letterSpacing: 1.1, textTransform: 'uppercase' },
  journeyChoices: { gap: 2 },
  journeyChoice: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: LucidRadius.md, paddingHorizontal: LucidSpace.sm, paddingVertical: LucidSpace.sm },
  journeyChoiceLabel: { flex: 1, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.sm },
  // Trois options, une ligne. À 104 de large et 9 de gouttière elles réclamaient
  // 330px pour les 320 d'un écran de 360 dp, et le sélecteur se repliait en 2+1
  // dès qu'on descendait sous 370 dp. À 92 et une gouttière de 8, la rangée
  // redescend à 292px de minimum : elle tient, et `flex: 1` rend le reste.
  option: { minHeight: 52, minWidth: 92, flex: 1, borderRadius: LucidRadius.lg, borderWidth: 1, paddingHorizontal: LucidSpace.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: LucidSpace.sm },
  optionLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  counter: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md, paddingVertical: LucidSpace.md },
  counterCopy: { flex: 1, gap: LucidSpace.xs },
  counterButtons: { flexDirection: 'row', gap: LucidSpace.xs },
  counterButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  timeRow: { flexDirection: 'row', gap: LucidSpace.md },
  timeRowCompact: { flexDirection: 'column' },
  timeField: { flex: 1, gap: LucidSpace.sm },
  fieldLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  timeInput: { minHeight: 50, borderRadius: LucidRadius.md, borderWidth: 1, paddingHorizontal: LucidSpace.lg, fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.h3[0], lineHeight: LucidType.h3[1], fontVariant: ['tabular-nums'], textAlign: 'center' },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md },
  zoneRowCompact: { alignItems: 'stretch', flexDirection: 'column' },
  zoneValue: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  zoneButton: { minHeight: 44, maxWidth: '54%', borderRadius: LucidRadius.md, borderWidth: 1, paddingHorizontal: LucidSpace.md, alignItems: 'center', justifyContent: 'center' },
  zoneButtonLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.overline[0], lineHeight: LucidType.overline[1], textAlign: 'center' },
  accessibilityRow: { minHeight: 70, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md, paddingVertical: LucidSpace.md },
  syncRecoveryHeader: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md },
  syncRecoveryContent: { gap: LucidSpace.md, paddingBottom: LucidSpace.sm },
  feedback: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.sm },
  language: { minHeight: 44, minWidth: 54, overflow: 'hidden', borderRadius: LucidRadius.md, borderWidth: 1, paddingHorizontal: LucidSpace.lg, alignItems: 'center', justifyContent: 'center' },
  languageLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  settingRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md },
  settingLabel: { flex: 1, fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  pressed: { opacity: LucidPress.opacity },
});
