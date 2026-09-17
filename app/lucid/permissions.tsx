import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import {
  LucidButton,
  LucidCard,
  LucidIconAction,
  LucidIconTile,
  LucidPill,
  LucidScreen,
} from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidIcon, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { buildLucidReminderPlan } from '@/lib/lucid/reminders';
import { closeLucidRoute } from '@/lib/lucid/routes';
import { reconcileLucidTrainerReminders } from '@/services/lucidTrainerNotifications';

const COPY = {
  en: {
    eyebrow: 'Permissions',
    title: 'Ask only when useful',
    subtitle: 'Lucid Trainer works without notifications. Audio playback never requires microphone access.',
    notifications: 'Training reminders',
    granted: 'Granted',
    denied: 'Denied',
    unknown: 'Not requested',
    enable: 'Request notification access',
    settings: 'Open system settings',
    audio: 'Night audio',
    audioBody: 'Uses bundled sounds through the speaker at a user-chosen low volume. No microphone, listening or recording.',
    timezone: 'Time and timezone',
    timezoneBody: 'Schedules are reconciled on launch and foreground after timezone or daylight-saving changes.',
    reboot: 'Restart behavior',
    rebootBody: 'On Android, native notification restoration is configured for device restarts. It still requires a new native build and real-device verification before release.',
  },
  fr: {
    eyebrow: 'Permissions',
    title: 'Demander seulement au bon moment',
    subtitle: 'Lucid Trainer fonctionne sans notifications. L’audio ne demande jamais le microphone.',
    notifications: 'Rappels d’entraînement',
    granted: 'Accordée',
    denied: 'Refusée',
    unknown: 'Non demandée',
    enable: 'Demander l’autorisation',
    settings: 'Ouvrir les réglages système',
    audio: 'Audio nocturne',
    audioBody: 'Utilise des sons embarqués sur le haut-parleur, à faible volume choisi. Aucun micro, aucune écoute, aucun enregistrement.',
    timezone: 'Heure et fuseau',
    timezoneBody: 'Les horaires sont réconciliés au lancement et au retour actif après un changement de fuseau ou d’heure.',
    reboot: 'Comportement après redémarrage',
    rebootBody: 'Sur Android, la restauration native des notifications après redémarrage est configurée. Elle doit encore être vérifiée avec un nouveau build natif sur appareil réel avant release.',
  },
  es: {
    eyebrow: 'Permisos',
    title: 'Pedir solo cuando sea útil',
    subtitle: 'Lucid Trainer funciona sin notificaciones. El audio nunca necesita micrófono.',
    notifications: 'Recordatorios',
    granted: 'Concedido',
    denied: 'Denegado',
    unknown: 'No solicitado',
    enable: 'Solicitar notificaciones',
    settings: 'Abrir ajustes del sistema',
    audio: 'Audio nocturno',
    audioBody: 'Usa sonidos incluidos por el altavoz a bajo volumen. Sin micrófono ni grabación.',
    timezone: 'Hora y zona',
    timezoneBody: 'Los horarios se reconcilian al abrir y volver tras cambios de zona u horario.',
    reboot: 'Tras reiniciar',
    rebootBody: 'En Android está configurada la restauración nativa de notificaciones tras reiniciar. Aún requiere un nuevo build nativo y verificación en un dispositivo real.',
  },
  de: {
    eyebrow: 'Berechtigungen',
    title: 'Nur bei Bedarf fragen',
    subtitle: 'Lucid Trainer funktioniert ohne Benachrichtigungen. Audio braucht kein Mikrofon.',
    notifications: 'Trainingserinnerungen',
    granted: 'Erlaubt',
    denied: 'Abgelehnt',
    unknown: 'Nicht gefragt',
    enable: 'Benachrichtigungen anfragen',
    settings: 'Systemeinstellungen öffnen',
    audio: 'Nacht-Audio',
    audioBody: 'Nutzt integrierte Töne leise über den Lautsprecher. Kein Mikrofon und keine Aufnahme.',
    timezone: 'Zeit und Zeitzone',
    timezoneBody: 'Pläne werden beim Start und Vordergrund nach Zeitänderungen abgeglichen.',
    reboot: 'Nach Neustart',
    rebootBody: 'Unter Android ist die native Wiederherstellung von Benachrichtigungen nach einem Neustart konfiguriert. Vor dem Release braucht sie noch einen neuen nativen Build und einen Test auf einem echten Gerät.',
  },
  it: {
    eyebrow: 'Permessi',
    title: 'Chiedi solo quando utile',
    subtitle: 'Lucid Trainer funziona senza notifiche. L’audio non richiede microfono.',
    notifications: 'Promemoria training',
    granted: 'Concesso',
    denied: 'Negato',
    unknown: 'Non richiesto',
    enable: 'Richiedi notifiche',
    settings: 'Apri impostazioni di sistema',
    audio: 'Audio notturno',
    audioBody: 'Usa suoni inclusi dall’altoparlante a basso volume. Nessun microfono o registrazione.',
    timezone: 'Ora e fuso',
    timezoneBody: 'Gli orari vengono riconciliati all’avvio e in primo piano dopo cambi di fuso o ora.',
    reboot: 'Dopo il riavvio',
    rebootBody: 'Su Android è configurato il ripristino nativo delle notifiche dopo il riavvio. Prima della release richiede ancora un nuovo build nativo e una verifica su un dispositivo reale.',
  },
} as const;

export default function LucidPermissionsScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { state, content, updatePreferences, reload } = useLucidTrainer();
  const c = COPY[content.locale];
  const [busy, setBusy] = useState(false);
  const permission = state!.onboarding.notificationsPermission;

  const request = async () => {
    setBusy(true);
    try {
      const result = await reconcileLucidTrainerReminders(
        buildLucidReminderPlan(
          {
            ...state!,
            preferences: { ...state!.preferences, notificationsEnabled: true },
          },
          content
        ),
        { requestPermissionIfNeeded: true }
      );
      if (result.permission === 'granted') {
        await updatePreferences({ notificationsEnabled: true });
      }
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <LucidScreen
      eyebrow={c.eyebrow}
      title={c.title}
      subtitle={c.subtitle}
      trailing={
        <LucidIconAction
          label={content.chrome.common.back}
          icon="close"
          onPress={() => closeLucidRoute(router, '/lucid/(tabs)/settings')}
        />
      }
    >
      <LucidCard accent={permission === 'granted' ? 'accent' : 'amber'}>
        <View style={styles.top}>
          <LucidIconTile icon="notifications" tone={permission === 'granted' ? 'accent' : 'amber'} size="md" />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: palette.text }]}>{c.notifications}</Text>
            <LucidPill
              label={c[permission]}
              tone={permission === 'granted' ? 'accent' : 'amber'}
            />
          </View>
        </View>
        {permission !== 'granted' ? (
          <LucidButton
            label={c.enable}
            icon="notifications"
            loading={busy}
            onPress={() => void request()}
          />
        ) : null}
        {permission === 'denied' ? (
          <LucidButton
            label={c.settings}
            variant="secondary"
            icon="settings"
            onPress={() => void Linking.openSettings()}
          />
        ) : null}
      </LucidCard>
      <Info title={c.audio} body={c.audioBody} icon="volume-low" />
      <Info
        title={c.timezone}
        body={`${c.timezoneBody}\n\n${state!.preferences.timeZone}`}
        icon="globe"
      />
      <Info title={c.reboot} body={c.rebootBody} icon="refresh" />
    </LucidScreen>
  );
}

function Info({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  return (
    <LucidCard>
      <View style={styles.info}>
        <Ionicons name={icon} size={LucidIcon.lg} color={palette.accent} />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{body}</Text>
        </View>
      </View>
    </LucidCard>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: LucidSpace.md },
  copy: { flex: 1, gap: LucidSpace.xs },
  title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: LucidType.bodySm[0], lineHeight: LucidType.bodySm[1] },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: LucidSpace.md },
  body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
});
