import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

import {
  LucidButton,
  LucidCard,
  LucidIconAction,
  LucidPill,
  LucidScreen,
  LucidSectionHeader,
} from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidIcon, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useAuth } from '@/context/AuthContext';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { trackProductEvent } from '@/lib/analytics';
import { buildNoctaliaHandoffLinks, type NoctaliaScoreBand } from '@/lib/lucid/deepLinks';
import type { LucidExperiment, LucidExperimentResult, LucidTechnique } from '@/lib/lucid/model';
import { closeLucidRoute } from '@/lib/lucid/routes';
import { finalizeAccountDeletion, requestAccountDeletion } from '@/services/accountDeletionService';
import { clearLucidMorningVoiceNotes } from '@/services/lucidMorningVoiceNoteStorage';
import { deleteLucidTrainerCloudData } from '@/services/lucidTrainerCloudData';
import { shareLucidTrainerExport } from '@/services/lucidTrainerExport';

const COPY = {
  en: {
    eyebrow: 'Data management',
    title: 'Keep control of every record',
    subtitle: 'Exports contain your Lucid Trainer data only. Nothing is transferred to Noctalia without a separate action.',
    export: 'Export',
    exportBody: 'JSON and CSV export structured Lucid Trainer data. Audio files stay on this device and must be shared individually from Voice notes. Text notes remain included because this export is for you.',
    json: 'Export JSON',
    csv: 'Export CSV',
    voiceNotes: 'Open Voice notes',
    syncNote: 'Optional account sync still excludes media. Audio files are never uploaded.',
    bridge: 'Optional Noctalia handoff',
    bridgeBody: 'Open the latest result in Noctalia using only technique, outcome and score bands. Notes and timestamps are never sent.',
    open: 'Send latest summary',
    noResult: 'Record a morning review first.',
    confirmTransfer: 'Open Noctalia with this minimal summary?',
    transfer: 'Open Noctalia',
    fallback: 'Noctalia is not installed; the secure web fallback will open.',
    deleteLocal: 'Delete Lucid Trainer data',
    deleteLocalBody: 'Removes this profile, reviews, progress, notifications, queued sync and local morning voice notes, including metadata and audio files, from this device. When signed in, any previous Lucid cloud copy is deleted too, even if sync is currently off.',
    deleteButton: 'Delete trainer data',
    confirmDelete: 'Delete all Lucid Trainer data?',
    irreversible: 'This cannot be undone unless you exported first.',
    deleted: 'Lucid Trainer data deleted',
    account: 'Delete entire Noctalia account',
    accountBody: 'This existing Noctalia control permanently deletes the account and all associated ecosystem data, not only Lucid Trainer.',
    deleteAccount: 'Delete entire account',
    accountConfirm: 'Permanently delete the complete Noctalia account?',
    unavailable: 'Unavailable',
    error: 'The operation could not be completed. Your local data was preserved.',
    partialTitle: 'Deletion incomplete',
    partialError:
      'This operation could not be completed. Some data or media may already have been removed, including a cloud copy if one existed.',
  },
  fr: {
    eyebrow: 'Gestion des données',
    title: 'Gardez le contrôle de chaque donnée',
    subtitle: 'Les exports contiennent uniquement Lucid Trainer. Rien ne passe vers Noctalia sans action séparée.',
    export: 'Exporter',
    exportBody: 'JSON et CSV exportent les données structurées de Lucid Trainer. Les fichiers audio restent locaux et doivent être partagés un par un depuis Notes vocales. Les notes textuelles restent incluses car cet export est pour vous.',
    json: 'Exporter en JSON',
    csv: 'Exporter en CSV',
    voiceNotes: 'Ouvrir les notes vocales',
    syncNote: 'La synchronisation facultative du compte exclut toujours les médias. Les fichiers audio ne sont jamais envoyés.',
    bridge: 'Passage facultatif vers Noctalia',
    bridgeBody: 'Ouvrez le dernier résultat dans Noctalia avec seulement la technique, le résultat et des niveaux. Notes et horaires ne sont jamais envoyés.',
    open: 'Envoyer le dernier résumé',
    noResult: 'Enregistrez d’abord un bilan du matin.',
    confirmTransfer: 'Ouvrir Noctalia avec ce résumé minimal ?',
    transfer: 'Ouvrir Noctalia',
    fallback: 'Noctalia n’est pas installé ; le fallback web sécurisé va s’ouvrir.',
    deleteLocal: 'Supprimer les données Lucid Trainer',
    deleteLocalBody: 'Supprime ce profil, les bilans, la progression, les notifications, la file de sync et les notes vocales locales du matin, métadonnées et fichiers audio compris, de cet appareil. Si vous êtes connecté, toute ancienne copie cloud Lucid est aussi supprimée, même si la sync est désactivée.',
    deleteButton: 'Supprimer les données Trainer',
    confirmDelete: 'Supprimer toutes les données Lucid Trainer ?',
    irreversible: 'Cette action est irréversible sans export préalable.',
    deleted: 'Données Lucid Trainer supprimées',
    account: 'Supprimer tout le compte Noctalia',
    accountBody: 'Ce contrôle Noctalia existant supprime définitivement le compte et toutes les données de l’écosystème, pas seulement Lucid Trainer.',
    deleteAccount: 'Supprimer tout le compte',
    accountConfirm: 'Supprimer définitivement le compte Noctalia complet ?',
    unavailable: 'Indisponible',
    error: 'L’opération n’a pas abouti. Les données locales ont été préservées.',
    partialTitle: 'Suppression incomplète',
    partialError:
      'L’opération n’a pas abouti. Certaines données ou certains médias peuvent déjà avoir été retirés, y compris une copie cloud s’il en existait une.',
  },
  es: {
    eyebrow: 'Gestión de datos',
    title: 'Controla cada registro',
    subtitle: 'Las exportaciones solo contienen Lucid Trainer. Nada pasa a Noctalia sin otra acción.',
    export: 'Exportar',
    exportBody: 'JSON y CSV exportan tus datos estructurados de Lucid Trainer. Los archivos de audio permanecen en este dispositivo y deben compartirse uno a uno desde Notas de voz. Las notas de texto se incluyen porque esta exportación es para ti.',
    json: 'Exportar JSON',
    csv: 'Exportar CSV',
    voiceNotes: 'Abrir notas de voz',
    syncNote: 'La sincronización opcional de la cuenta sigue excluyendo los medios. Los archivos de audio nunca se suben.',
    bridge: 'Enlace opcional con Noctalia',
    bridgeBody: 'Abre el último resultado con técnica, resultado y bandas. Sin notas ni horas.',
    open: 'Enviar último resumen',
    noResult: 'Registra primero una revisión.',
    confirmTransfer: '¿Abrir Noctalia con este resumen mínimo?',
    transfer: 'Abrir Noctalia',
    fallback: 'Noctalia no está instalada; se abrirá la web segura.',
    deleteLocal: 'Eliminar datos de Lucid Trainer',
    deleteLocalBody: 'Elimina perfil, revisiones, progreso, notificaciones, cola y notas de voz locales de la mañana, incluidos metadatos y archivos de audio, de este dispositivo. Con una sesión abierta, también elimina cualquier copia Lucid anterior de la nube aunque la sincronización esté desactivada.',
    deleteButton: 'Eliminar datos',
    confirmDelete: '¿Eliminar todos los datos?',
    irreversible: 'No se puede deshacer sin una exportación.',
    deleted: 'Datos eliminados',
    account: 'Eliminar toda la cuenta Noctalia',
    accountBody: 'Elimina la cuenta y todos los datos del ecosistema, no solo Lucid Trainer.',
    deleteAccount: 'Eliminar cuenta completa',
    accountConfirm: '¿Eliminar permanentemente toda la cuenta?',
    unavailable: 'No disponible',
    error: 'No se pudo completar. Los datos locales se conservaron.',
    partialTitle: 'Eliminación incompleta',
    partialError:
      'No se pudo completar la operación. Algunos datos o archivos pueden haberse eliminado ya, incluida una copia en la nube si existía.',
  },
  de: {
    eyebrow: 'Datenverwaltung',
    title: 'Kontrolle über jeden Eintrag',
    subtitle: 'Exporte enthalten nur Lucid Trainer. Ohne eigene Aktion geht nichts an Noctalia.',
    export: 'Export',
    exportBody: 'JSON und CSV exportieren deine strukturierten Lucid-Trainer-Daten. Audiodateien bleiben lokal und müssen einzeln unter Sprachnotizen geteilt werden. Textnotizen sind enthalten, weil dieser Export für dich ist.',
    json: 'JSON exportieren',
    csv: 'CSV exportieren',
    voiceNotes: 'Sprachnotizen öffnen',
    syncNote: 'Die optionale Kontosynchronisierung schließt Medien weiterhin aus. Audiodateien werden nie hochgeladen.',
    bridge: 'Optionale Noctalia-Übergabe',
    bridgeBody: 'Öffnet das letzte Ergebnis nur mit Technik, Ergebnis und Stufen. Keine Notizen oder Zeiten.',
    open: 'Letzte Zusammenfassung senden',
    noResult: 'Zuerst Morgenrückblick erfassen.',
    confirmTransfer: 'Noctalia mit dieser minimalen Zusammenfassung öffnen?',
    transfer: 'Noctalia öffnen',
    fallback: 'Noctalia ist nicht installiert; sichere Web-Alternative öffnet.',
    deleteLocal: 'Lucid-Trainer-Daten löschen',
    deleteLocalBody: 'Entfernt Profil, Rückblicke, Fortschritt, Benachrichtigungen, Sync-Warteschlange und lokale morgendliche Sprachnotizen inklusive Metadaten und Audiodateien. Bei Anmeldung wird auch jede frühere Lucid-Cloudkopie gelöscht, selbst wenn Sync derzeit aus ist.',
    deleteButton: 'Trainer-Daten löschen',
    confirmDelete: 'Alle Lucid-Trainer-Daten löschen?',
    irreversible: 'Ohne Export nicht rückgängig.',
    deleted: 'Lucid-Trainer-Daten gelöscht',
    account: 'Ganzes Noctalia-Konto löschen',
    accountBody: 'Löscht Konto und alle Ökosystemdaten, nicht nur Lucid Trainer.',
    deleteAccount: 'Gesamtes Konto löschen',
    accountConfirm: 'Komplettes Noctalia-Konto dauerhaft löschen?',
    unavailable: 'Nicht verfügbar',
    error: 'Vorgang fehlgeschlagen. Lokale Daten wurden bewahrt.',
    partialTitle: 'Löschen unvollständig',
    partialError:
      'Der Vorgang konnte nicht abgeschlossen werden. Einige Daten oder Medien wurden möglicherweise bereits entfernt, einschließlich einer Cloudkopie, falls vorhanden.',
  },
  it: {
    eyebrow: 'Gestione dati',
    title: 'Controlla ogni dato',
    subtitle: 'Gli export contengono solo Lucid Trainer. Nulla passa a Noctalia senza un’azione separata.',
    export: 'Esporta',
    exportBody: 'JSON e CSV esportano i dati strutturati di Lucid Trainer. I file audio restano su questo dispositivo e vanno condivisi uno per uno da Note vocali. Le note testuali restano incluse perché l’export è per te.',
    json: 'Esporta JSON',
    csv: 'Esporta CSV',
    voiceNotes: 'Apri le note vocali',
    syncNote: 'La sincronizzazione facoltativa dell’account continua a escludere i media. I file audio non vengono mai caricati.',
    bridge: 'Passaggio opzionale a Noctalia',
    bridgeBody: 'Apre l’ultimo risultato con tecnica, esito e fasce. Mai note o orari.',
    open: 'Invia ultimo riepilogo',
    noResult: 'Registra prima un bilancio.',
    confirmTransfer: 'Aprire Noctalia con questo riepilogo minimo?',
    transfer: 'Apri Noctalia',
    fallback: 'Noctalia non è installata; si aprirà il fallback web sicuro.',
    deleteLocal: 'Elimina dati Lucid Trainer',
    deleteLocalBody: 'Rimuove profilo, bilanci, progresso, notifiche, coda e note vocali locali del mattino, metadati e file audio compresi, da questo dispositivo. Se hai effettuato l’accesso elimina anche ogni precedente copia cloud Lucid, anche con la sincronizzazione disattivata.',
    deleteButton: 'Elimina dati Trainer',
    confirmDelete: 'Eliminare tutti i dati Lucid Trainer?',
    irreversible: 'Non è annullabile senza export.',
    deleted: 'Dati Lucid Trainer eliminati',
    account: 'Elimina intero account Noctalia',
    accountBody: 'Elimina account e dati di tutto l’ecosistema, non solo Lucid Trainer.',
    deleteAccount: 'Elimina intero account',
    accountConfirm: 'Eliminare definitivamente tutto l’account?',
    unavailable: 'Non disponibile',
    error: 'Operazione non completata. I dati locali sono stati conservati.',
    partialTitle: 'Eliminazione incompleta',
    partialError:
      'Operazione non completata. Alcuni dati o file potrebbero essere già stati rimossi, inclusa una copia cloud se esisteva.',
  },
} as const;

function band(value: number): NoctaliaScoreBand {
  return value <= 0 ? 'none' : value <= 2 ? 'low' : value <= 4 ? 'medium' : 'high';
}

function isTransferableExperiment(
  experiment: LucidExperiment
): experiment is TransferableExperiment {
  return (
    experiment.technique != null &&
    experiment.result != null &&
    experiment.lucidityLevel != null &&
    experiment.recallLevel != null
  );
}

type TransferableExperiment = LucidExperiment & {
  technique: LucidTechnique;
  result: LucidExperimentResult;
  lucidityLevel: number;
  recallLevel: number;
};

function findTransferableExperiment(
  experiments: readonly LucidExperiment[]
): TransferableExperiment | undefined {
  const eligible = experiments.filter(isTransferableExperiment);
  if (eligible.length === 0) return undefined;
  return [...eligible].sort(
    (left, right) =>
      right.occurredAt - left.occurredAt ||
      right.updatedAt - left.updatedAt ||
      left.id.localeCompare(right.id)
  )[0];
}

export default function LucidDataScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { user } = useAuth();
  const { state, content, resetLocalData, userScope } = useLucidTrainer();
  const c = COPY[content.locale];
  const [busy, setBusy] = useState<string | null>(null);
  const transferable = findTransferableExperiment(state!.experiments);

  const reportHandoff = (outcome: 'opened' | 'fallback' | 'cancelled' | 'failed') =>
    state!.onboarding.analyticsConsent === true
      ? trackProductEvent('lucid_noctalia_handoff', {
          action: 'transfer_summary',
          outcome,
          transfer: 'experiment_summary',
        })
      : Promise.resolve();

  const exportData = async (format: 'json' | 'csv') => {
    setBusy(format);
    try {
      await shareLucidTrainerExport(state!, format);
    } catch {
      Alert.alert(content.chrome.common.error);
    } finally {
      setBusy(null);
    }
  };

  const handoff = () => {
    if (!transferable || !state!.preferences.noctaliaLinkEnabled) {
      Alert.alert(c.unavailable, transferable ? content.privacy.minimalTransfer : c.noResult);
      return;
    }

    const links = buildNoctaliaHandoffLinks(
      {
        schemaVersion: 1,
        technique: transferable.technique,
        outcome:
          transferable.result === 'lucid'
            ? 'lucid'
            : transferable.recallLevel > 0
              ? 'remembered'
              : 'no_recall',
        lucidity: band(transferable.result === 'lucid' ? transferable.lucidityLevel : 0),
        recall: band(transferable.recallLevel),
      },
      { dataTransfer: true }
    );
    if (!links) return;

    Alert.alert(c.confirmTransfer, content.privacy.minimalTransfer, [
      {
        text: content.chrome.common.cancel,
        style: 'cancel',
        onPress: () => void reportHandoff('cancelled'),
      },
      {
        text: c.transfer,
        onPress: () =>
          void (async () => {
            try {
              const available = await Linking.canOpenURL(links.appUrl);
              if (!available) Alert.alert(c.fallback);
              await Linking.openURL(available ? links.appUrl : links.fallbackUrl);
              await reportHandoff(available ? 'opened' : 'fallback');
            } catch {
              await reportHandoff('failed');
              Alert.alert(content.chrome.common.error);
            }
          })(),
      },
    ]);
  };

  const deleteTrainer = () =>
    Alert.alert(c.confirmDelete, c.irreversible, [
      { text: content.chrome.common.cancel, style: 'cancel' },
      {
        text: c.deleteButton,
        style: 'destructive',
        onPress: () =>
          void (async () => {
            setBusy('delete');
            let localCleanupStarted = false;
            try {
              // A signed-in user may still have a cloud copy after disabling sync.
              // Delete the remote generation first; local data is preserved if it fails.
              if (user) await deleteLucidTrainerCloudData();
              localCleanupStarted = true;
              await clearLucidMorningVoiceNotes(userScope);
              await resetLocalData();
              Alert.alert(c.deleted, undefined, [
                {
                  text: content.chrome.common.done,
                  onPress: () => router.replace('/lucid/onboarding'),
                },
              ]);
            } catch {
              Alert.alert(
                localCleanupStarted ? c.partialTitle : content.chrome.common.error,
                localCleanupStarted ? c.partialError : c.error
              );
            } finally {
              setBusy(null);
            }
          })(),
      },
    ]);

  const deleteAccount = () =>
    Alert.alert(c.accountConfirm, c.irreversible, [
      { text: content.chrome.common.cancel, style: 'cancel' },
      {
        text: c.deleteAccount,
        style: 'destructive',
        onPress: () =>
          void (async () => {
            setBusy('account');
            let localCleanupStarted = false;
            try {
              const result = await requestAccountDeletion();
              if (!result.deleted) throw new Error('not_deleted');
              localCleanupStarted = true;
              await clearLucidMorningVoiceNotes(userScope);
              await resetLocalData();
              await finalizeAccountDeletion();
              router.replace('/lucid/onboarding');
            } catch {
              Alert.alert(
                localCleanupStarted ? c.partialTitle : content.chrome.common.error,
                localCleanupStarted ? c.partialError : c.error
              );
            } finally {
              setBusy(null);
            }
          })(),
      },
    ]);

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
      <LucidSectionHeader title={c.export} />
      <LucidCard>
        <Text style={[styles.body, { color: palette.textSecondary }]}>{c.exportBody}</Text>
        <View style={styles.buttons}>
          <View style={styles.flex}>
            <LucidButton
              label={c.json}
              variant="secondary"
              icon="code-slash"
              loading={busy === 'json'}
              onPress={() => void exportData('json')}
            />
          </View>
          <View style={styles.flex}>
            <LucidButton
              label={c.csv}
              variant="secondary"
              icon="grid"
              loading={busy === 'csv'}
              onPress={() => void exportData('csv')}
            />
          </View>
        </View>
        <LucidButton
          label={c.voiceNotes}
          variant="secondary"
          icon="mic"
          onPress={() => router.push('/lucid/morning-voice' as never)}
        />
        <Text style={[styles.body, { color: palette.textSecondary }]}>{c.syncNote}</Text>
      </LucidCard>

      <LucidSectionHeader title={c.bridge} />
      <LucidCard accent="accent">
        <View style={styles.bridgeTop}>
          <Ionicons name="link" size={LucidIcon.lg} color={palette.accent} />
          <LucidPill
            label={state!.preferences.noctaliaLinkEnabled ? 'opt-in' : 'off'}
            tone={state!.preferences.noctaliaLinkEnabled ? 'accent' : 'neutral'}
          />
        </View>
        <Text style={[styles.body, { color: palette.textSecondary }]}>{c.bridgeBody}</Text>
        <LucidButton
          label={c.open}
          variant="secondary"
          icon="open"
          disabled={!transferable || !state!.preferences.noctaliaLinkEnabled}
          onPress={handoff}
        />
      </LucidCard>

      <LucidSectionHeader title={c.deleteLocal} />
      <LucidCard accent="amber">
        <Text style={[styles.body, { color: palette.textSecondary }]}>{c.deleteLocalBody}</Text>
        <LucidButton
          label={c.deleteButton}
          variant="danger"
          icon="trash"
          loading={busy === 'delete'}
          onPress={deleteTrainer}
        />
      </LucidCard>

      {user ? (
        <>
          <LucidSectionHeader title={c.account} />
          <LucidCard>
            <Text style={[styles.body, { color: palette.textSecondary }]}>{c.accountBody}</Text>
            <LucidButton
              label={c.deleteAccount}
              variant="danger"
              icon="person-remove"
              loading={busy === 'account'}
              onPress={deleteAccount}
            />
          </LucidCard>
        </>
      ) : null}
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  buttons: { flexDirection: 'row', gap: LucidSpace.sm },
  flex: { flex: 1 },
  bridgeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
