import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  LucidButton,
  LucidIconAction,
  LucidScreen,
  LucidSectionHeader,
} from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidRadius, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import type { LucidHkSleepCategory, LucidHkSleepIssueKind } from '@/lib/lucid/healthKitSleep';
import type { LucidLocale } from '@/lib/lucid/model';
import { closeLucidRoute } from '@/lib/lucid/routes';
import {
  queryLucidHealthKitSleepAnalysis,
  requestLucidHealthKitSleepReadAuthorization,
} from '@/services/lucidHealthKit';
import {
  deleteLucidHealthKitSnapshot,
  disableLucidHealthKitSnapshot,
  importLucidHealthKitSnapshot,
  loadLucidHealthKitSnapshot,
  recordLucidHealthKitEmptySnapshot,
  type LucidHealthKitSnapshot,
} from '@/services/lucidHealthKitStorage';

function emptyLocalSnapshot(): LucidHealthKitSnapshot {
  return {
    version: 1,
    status: 'empty',
    importedAt: null,
    rangeStartMs: null,
    rangeEndMs: null,
    normalization: null,
    emptyReason: null,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

const COPY = {
  en: {
    eyebrow: 'Prototype',
    title: 'Apple Health sleep import',
    back: 'Back',
    notice:
      'This local prototype can import past Apple Health sleepAnalysis samples. It does not detect REM in real time, write Health data, or drive night cues.',
    connect: 'Connect Apple Health and import',
    connecting: 'Importing…',
    working: 'Working…',
    disable: 'Disable import',
    delete: 'Delete imported copy',
    confirmDeleteTitle: 'Delete the imported copy?',
    confirmDeleteBody:
      'This removes only the local Lucid copy. Apple Health source data is never deleted.',
    confirm: 'Delete local copy',
    cancel: 'Keep copy',
    status: 'Status',
    imported: 'Imported',
    disabled: 'Disabled',
    empty: 'Empty',
    window: 'Imported window',
    granularity: 'Granularity',
    sources: 'Sources',
    categories: 'Category counts',
    usable: 'Usable samples',
    rejected: 'Rejected samples',
    issues: 'Issues',
    liveIdle: 'No Health query has run yet.',
    livePrompting: 'Asking Apple Health, then importing the last 7 days.',
    liveImported: 'A local snapshot is available.',
    liveEmpty: 'No sleep samples were returned. This can mean no data or access not granted.',
    liveUnavailable: 'Apple Health sleep import is unavailable on this device.',
    liveFailure: 'The Health query failed. The previous local snapshot was kept.',
    liveDisabled: 'Import is disabled. The local copy is kept but ignored.',
    liveDeleted: 'The local imported copy was deleted. Apple Health source data was not deleted.',
    liveLoadFailed: 'The local snapshot could not be loaded. The previous view remains.',
    liveStorageFailed: 'The local copy could not be changed. The previous snapshot was kept.',
    disableUnavailable: 'Disable is available after a successful import.',
    deleteUnavailable: 'Delete is available when a local copy exists.',
    noSource: 'No source name recorded',
    inBed: 'In bed',
    asleepUnspecified: 'Asleep, unspecified',
    awake: 'Awake',
    asleepCore: 'Asleep, core',
    asleepDeep: 'Asleep, deep',
    asleepREM: 'Asleep, REM label',
    detailed: 'Detailed',
    coarse: 'Coarse',
    mixed: 'Mixed',
    unknown: 'Unknown',
    issueAbsent: 'No usable samples in this window.',
    issueMalformed: 'Some samples were malformed and ignored.',
    issueInterval: 'Some samples had a non-positive interval and were ignored.',
    issueOverlap: 'Some intervals overlap. Overlaps are shown, not resolved.',
    issueContradiction: 'Asleep and awake labels overlap. This contradiction is shown, not inferred away.',
    issueCoarse: 'Some samples are only in bed or unspecified asleep. They are retrospective labels, not REM timing.',
  },
  fr: {
    eyebrow: 'Prototype',
    title: 'Import sommeil Apple Health',
    back: 'Retour',
    notice:
      'Ce prototype local peut importer d’anciens échantillons sleepAnalysis d’Apple Health. Il ne détecte pas le REM en temps réel, n’écrit pas dans Health et ne pilote aucun signal nocturne.',
    connect: 'Connecter Apple Health et importer',
    connecting: 'Import…',
    working: 'Traitement…',
    disable: 'Désactiver l’import',
    delete: 'Supprimer la copie importée',
    confirmDeleteTitle: 'Supprimer la copie importée ?',
    confirmDeleteBody:
      'Cela retire uniquement la copie locale Lucid. Les données sources d’Apple Health ne sont jamais supprimées.',
    confirm: 'Supprimer la copie locale',
    cancel: 'Conserver la copie',
    status: 'Statut',
    imported: 'Importé',
    disabled: 'Désactivé',
    empty: 'Vide',
    window: 'Fenêtre importée',
    granularity: 'Granularité',
    sources: 'Sources',
    categories: 'Comptes par catégorie',
    usable: 'Échantillons utilisables',
    rejected: 'Échantillons rejetés',
    issues: 'Problèmes',
    liveIdle: 'Aucune requête Health n’a encore été lancée.',
    livePrompting: 'Demande à Apple Health, puis import des 7 derniers jours.',
    liveImported: 'Un instantané local est disponible.',
    liveEmpty: 'Aucun échantillon de sommeil n’a été renvoyé. Cela peut signifier aucune donnée ou accès non accordé.',
    liveUnavailable: 'L’import sommeil Apple Health est indisponible sur cet appareil.',
    liveFailure: 'La requête Health a échoué. L’instantané local précédent a été conservé.',
    liveDisabled: 'L’import est désactivé. La copie locale est conservée mais ignorée.',
    liveDeleted: 'La copie locale importée a été supprimée. Les données sources d’Apple Health n’ont pas été supprimées.',
    liveLoadFailed: 'L’instantané local n’a pas pu être chargé. L’affichage précédent reste visible.',
    liveStorageFailed: 'La copie locale n’a pas pu être modifiée. L’instantané précédent a été conservé.',
    disableUnavailable: 'La désactivation est disponible après un import réussi.',
    deleteUnavailable: 'La suppression est disponible lorsqu’une copie locale existe.',
    noSource: 'Aucun nom de source enregistré',
    inBed: 'Au lit',
    asleepUnspecified: 'Endormi, non précisé',
    awake: 'Éveillé',
    asleepCore: 'Endormi, léger',
    asleepDeep: 'Endormi, profond',
    asleepREM: 'Endormi, libellé REM',
    detailed: 'Détaillée',
    coarse: 'Grossière',
    mixed: 'Mixte',
    unknown: 'Inconnue',
    issueAbsent: 'Aucun échantillon utilisable dans cette fenêtre.',
    issueMalformed: 'Certains échantillons étaient mal formés et ont été ignorés.',
    issueInterval: 'Certains échantillons avaient un intervalle non positif et ont été ignorés.',
    issueOverlap: 'Certains intervalles se chevauchent. Les chevauchements sont affichés, pas résolus.',
    issueContradiction: 'Des libellés endormi et éveillé se chevauchent. Cette contradiction est affichée, pas corrigée.',
    issueCoarse: 'Certains échantillons sont seulement au lit ou endormi non précisé. Ce sont des libellés rétrospectifs, pas un timing REM.',
  },
  es: {
    eyebrow: 'Prototipo',
    title: 'Importación de sueño de Apple Health',
    back: 'Atrás',
    notice:
      'Este prototipo local puede importar muestras sleepAnalysis pasadas de Apple Health. No detecta REM en tiempo real, no escribe en Health ni activa señales nocturnas.',
    connect: 'Conectar Apple Health e importar',
    connecting: 'Importando…',
    working: 'Trabajando…',
    disable: 'Desactivar importación',
    delete: 'Eliminar copia importada',
    confirmDeleteTitle: '¿Eliminar la copia importada?',
    confirmDeleteBody:
      'Esto quita solo la copia local de Lucid. Los datos originales de Apple Health nunca se eliminan.',
    confirm: 'Eliminar copia local',
    cancel: 'Conservar copia',
    status: 'Estado',
    imported: 'Importado',
    disabled: 'Desactivado',
    empty: 'Vacío',
    window: 'Ventana importada',
    granularity: 'Granularidad',
    sources: 'Fuentes',
    categories: 'Conteos por categoría',
    usable: 'Muestras utilizables',
    rejected: 'Muestras rechazadas',
    issues: 'Problemas',
    liveIdle: 'Aún no se ha ejecutado ninguna consulta de Health.',
    livePrompting: 'Solicitando Apple Health e importando los últimos 7 días.',
    liveImported: 'Hay una instantánea local disponible.',
    liveEmpty: 'No se devolvieron muestras de sueño. Puede significar que no hay datos o que el acceso no se concedió.',
    liveUnavailable: 'La importación de sueño de Apple Health no está disponible en este dispositivo.',
    liveFailure: 'La consulta de Health falló. Se conservó la instantánea local anterior.',
    liveDisabled: 'La importación está desactivada. La copia local se conserva pero se ignora.',
    liveDeleted: 'Se eliminó la copia local importada. Los datos originales de Apple Health no se eliminaron.',
    liveLoadFailed: 'No se pudo cargar la instantánea local. Se mantiene la vista anterior.',
    liveStorageFailed: 'No se pudo cambiar la copia local. Se conservó la instantánea anterior.',
    disableUnavailable: 'Desactivar está disponible tras una importación correcta.',
    deleteUnavailable: 'Eliminar está disponible cuando existe una copia local.',
    noSource: 'Sin nombre de fuente registrado',
    inBed: 'En la cama',
    asleepUnspecified: 'Dormido, no especificado',
    awake: 'Despierto',
    asleepCore: 'Dormido, ligero',
    asleepDeep: 'Dormido, profundo',
    asleepREM: 'Dormido, etiqueta REM',
    detailed: 'Detallada',
    coarse: 'Gruesa',
    mixed: 'Mixta',
    unknown: 'Desconocida',
    issueAbsent: 'No hay muestras utilizables en esta ventana.',
    issueMalformed: 'Algunas muestras estaban mal formadas y se ignoraron.',
    issueInterval: 'Algunas muestras tenían un intervalo no positivo y se ignoraron.',
    issueOverlap: 'Algunos intervalos se solapan. Los solapes se muestran, no se resuelven.',
    issueContradiction: 'Las etiquetas dormido y despierto se solapan. Esta contradicción se muestra, no se infiere.',
    issueCoarse: 'Algunas muestras son solo en la cama o dormido no especificado. Son etiquetas retrospectivas, no tiempo REM.',
  },
  de: {
    eyebrow: 'Prototyp',
    title: 'Apple-Health-Schlafimport',
    back: 'Zurück',
    notice:
      'Dieser lokale Prototyp kann frühere Apple-Health-sleepAnalysis-Proben importieren. Er erkennt REM nicht in Echtzeit, schreibt nicht in Health und steuert keine Nachtsignale.',
    connect: 'Apple Health verbinden und importieren',
    connecting: 'Importiere…',
    working: 'Arbeite…',
    disable: 'Import deaktivieren',
    delete: 'Importierte Kopie löschen',
    confirmDeleteTitle: 'Importierte Kopie löschen?',
    confirmDeleteBody:
      'Es wird nur die lokale Lucid-Kopie entfernt. Apple-Health-Quelldaten werden nie gelöscht.',
    confirm: 'Lokale Kopie löschen',
    cancel: 'Kopie behalten',
    status: 'Status',
    imported: 'Importiert',
    disabled: 'Deaktiviert',
    empty: 'Leer',
    window: 'Importiertes Fenster',
    granularity: 'Granularität',
    sources: 'Quellen',
    categories: 'Kategoriezahlen',
    usable: 'Nutzbare Proben',
    rejected: 'Verworfene Proben',
    issues: 'Hinweise',
    liveIdle: 'Es wurde noch keine Health-Abfrage ausgeführt.',
    livePrompting: 'Apple Health wird gefragt, dann werden die letzten 7 Tage importiert.',
    liveImported: 'Ein lokaler Schnappschuss ist verfügbar.',
    liveEmpty: 'Es wurden keine Schlafproben zurückgegeben. Das kann keine Daten oder nicht gewährten Zugriff bedeuten.',
    liveUnavailable: 'Apple-Health-Schlafimport ist auf diesem Gerät nicht verfügbar.',
    liveFailure: 'Die Health-Abfrage ist fehlgeschlagen. Der vorherige lokale Schnappschuss blieb erhalten.',
    liveDisabled: 'Der Import ist deaktiviert. Die lokale Kopie bleibt erhalten, wird aber ignoriert.',
    liveDeleted: 'Die lokale importierte Kopie wurde gelöscht. Apple-Health-Quelldaten wurden nicht gelöscht.',
    liveLoadFailed: 'Der lokale Schnappschuss konnte nicht geladen werden. Die vorherige Ansicht bleibt.',
    liveStorageFailed: 'Die lokale Kopie konnte nicht geändert werden. Der vorherige Schnappschuss blieb erhalten.',
    disableUnavailable: 'Deaktivieren ist nach einem erfolgreichen Import verfügbar.',
    deleteUnavailable: 'Löschen ist verfügbar, wenn eine lokale Kopie existiert.',
    noSource: 'Kein Quellenname gespeichert',
    inBed: 'Im Bett',
    asleepUnspecified: 'Schlafend, unbestimmt',
    awake: 'Wach',
    asleepCore: 'Schlafend, leicht',
    asleepDeep: 'Schlafend, tief',
    asleepREM: 'Schlafend, REM-Label',
    detailed: 'Detailliert',
    coarse: 'Grob',
    mixed: 'Gemischt',
    unknown: 'Unbekannt',
    issueAbsent: 'Keine nutzbaren Proben in diesem Fenster.',
    issueMalformed: 'Einige Proben waren fehlerhaft und wurden ignoriert.',
    issueInterval: 'Einige Proben hatten ein nicht positives Intervall und wurden ignoriert.',
    issueOverlap: 'Einige Intervalle überlappen. Überlappungen werden angezeigt, nicht aufgelöst.',
    issueContradiction: 'Schlafend- und Wach-Labels überlappen. Dieser Widerspruch wird angezeigt, nicht weginferiert.',
    issueCoarse: 'Einige Proben sind nur im Bett oder unbestimmt schlafend. Das sind rückblickende Labels, keine REM-Zeit.',
  },
  it: {
    eyebrow: 'Prototipo',
    title: 'Importazione sonno Apple Health',
    back: 'Indietro',
    notice:
      'Questo prototipo locale può importare campioni sleepAnalysis passati di Apple Health. Non rileva il REM in tempo reale, non scrive in Health e non guida segnali notturni.',
    connect: 'Collega Apple Health e importa',
    connecting: 'Importazione…',
    working: 'Elaborazione…',
    disable: 'Disattiva importazione',
    delete: 'Elimina copia importata',
    confirmDeleteTitle: 'Eliminare la copia importata?',
    confirmDeleteBody:
      'Questo rimuove solo la copia locale Lucid. I dati originali di Apple Health non vengono mai eliminati.',
    confirm: 'Elimina copia locale',
    cancel: 'Conserva copia',
    status: 'Stato',
    imported: 'Importato',
    disabled: 'Disattivato',
    empty: 'Vuoto',
    window: 'Finestra importata',
    granularity: 'Granularità',
    sources: 'Fonti',
    categories: 'Conteggi per categoria',
    usable: 'Campioni utilizzabili',
    rejected: 'Campioni rifiutati',
    issues: 'Problemi',
    liveIdle: 'Nessuna query Health è ancora stata eseguita.',
    livePrompting: 'Richiesta ad Apple Health, poi importazione degli ultimi 7 giorni.',
    liveImported: 'È disponibile un’istantanea locale.',
    liveEmpty: 'Non è stato restituito alcun campione di sonno. Può significare nessun dato oppure accesso non concesso.',
    liveUnavailable: 'L’importazione sonno Apple Health non è disponibile su questo dispositivo.',
    liveFailure: 'La query Health non è riuscita. L’istantanea locale precedente è stata conservata.',
    liveDisabled: 'L’importazione è disattivata. La copia locale è conservata ma ignorata.',
    liveDeleted: 'La copia locale importata è stata eliminata. I dati originali di Apple Health non sono stati eliminati.',
    liveLoadFailed: 'L’istantanea locale non è stata caricata. Resta visibile la vista precedente.',
    liveStorageFailed: 'La copia locale non è stata modificata. È stata conservata l’istantanea precedente.',
    disableUnavailable: 'La disattivazione è disponibile dopo un’importazione riuscita.',
    deleteUnavailable: 'L’eliminazione è disponibile quando esiste una copia locale.',
    noSource: 'Nessun nome fonte registrato',
    inBed: 'A letto',
    asleepUnspecified: 'Addormentato, non specificato',
    awake: 'Sveglio',
    asleepCore: 'Addormentato, leggero',
    asleepDeep: 'Addormentato, profondo',
    asleepREM: 'Addormentato, etichetta REM',
    detailed: 'Dettagliata',
    coarse: 'Grossolana',
    mixed: 'Mista',
    unknown: 'Sconosciuta',
    issueAbsent: 'Nessun campione utilizzabile in questa finestra.',
    issueMalformed: 'Alcuni campioni erano malformati e sono stati ignorati.',
    issueInterval: 'Alcuni campioni avevano un intervallo non positivo e sono stati ignorati.',
    issueOverlap: 'Alcuni intervalli si sovrappongono. Le sovrapposizioni sono mostrate, non risolte.',
    issueContradiction: 'Etichette addormentato e sveglio si sovrappongono. Questa contraddizione è mostrata, non corretta.',
    issueCoarse: 'Alcuni campioni sono solo a letto o addormentato non specificato. Sono etichette retrospettive, non tempi REM.',
  },
} as const;

const CATEGORY_KEYS: Record<LucidHkSleepCategory, keyof (typeof COPY)['en']> = {
  inBed: 'inBed',
  asleepUnspecified: 'asleepUnspecified',
  awake: 'awake',
  asleepCore: 'asleepCore',
  asleepDeep: 'asleepDeep',
  asleepREM: 'asleepREM',
};

const ISSUE_KEYS: Record<LucidHkSleepIssueKind, keyof (typeof COPY)['en']> = {
  absent: 'issueAbsent',
  malformed: 'issueMalformed',
  non_positive_interval: 'issueInterval',
  overlap: 'issueOverlap',
  contradiction: 'issueContradiction',
  coarse: 'issueCoarse',
};

type LiveStatus =
  | 'idle'
  | 'prompting'
  | 'imported'
  | 'empty'
  | 'unavailable'
  | 'failure'
  | 'disabled'
  | 'deleted'
  | 'loadFailed'
  | 'storageFailed';

function formatWindow(startMs: number | null, endMs: number | null, locale: LucidLocale): string {
  if (startMs == null || endMs == null) return '—';
  const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return `${format.format(new Date(startMs))} – ${format.format(new Date(endMs))}`;
}

function uniqueSampleSources(
  samples: readonly { sourceName: string | null; sourceBundleId: string | null }[] | null | undefined
): { name: string | null; bundleId: string | null }[] {
  const pairs = new Map<string, { name: string | null; bundleId: string | null }>();
  for (const sample of samples ?? []) {
    const name = sample.sourceName;
    const bundleId = sample.sourceBundleId;
    const key = `${name ?? ''}\u0000${bundleId ?? ''}`;
    if (!pairs.has(key)) pairs.set(key, { name, bundleId });
  }
  return [...pairs.values()].sort((left, right) => {
    const leftLabel = `${left.name ?? ''}${left.bundleId ?? ''}`;
    const rightLabel = `${right.name ?? ''}${right.bundleId ?? ''}`;
    return leftLabel.localeCompare(rightLabel);
  });
}

function liveStatusFromSnapshot(snapshot: LucidHealthKitSnapshot | null): LiveStatus {
  if (!snapshot) return 'idle';
  if (snapshot.status === 'imported') return 'imported';
  if (snapshot.status === 'disabled') return 'disabled';
  if (snapshot.emptyReason === 'ambiguous_empty') return 'empty';
  return 'idle';
}

export default function LucidSleepIntegrationScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { content, userScope } = useLucidTrainer();
  const copy = COPY[content.locale];
  const [snapshot, setSnapshot] = useState<LucidHealthKitSnapshot | null>(null);
  const [activeAction, setActiveAction] = useState<'import' | 'disable' | 'delete' | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle');

  const close = () => closeLucidRoute(router, '/lucid/(tabs)/settings');
  const liveCopy: Record<LiveStatus, string> = {
    idle: copy.liveIdle,
    prompting: copy.livePrompting,
    imported: copy.liveImported,
    empty: copy.liveEmpty,
    unavailable: copy.liveUnavailable,
    failure: copy.liveFailure,
    disabled: copy.liveDisabled,
    deleted: copy.liveDeleted,
    loadFailed: copy.liveLoadFailed,
    storageFailed: copy.liveStorageFailed,
  };

  useEffect(() => {
    let active = true;
    void loadLucidHealthKitSnapshot(userScope)
      .then((next) => {
        if (!active) return;
        setSnapshot(next);
        setLiveStatus(liveStatusFromSnapshot(next));
      })
      .catch(() => {
        if (!active) return;
        setLiveStatus('loadFailed');
      });
    return () => {
      active = false;
    };
  }, [userScope]);

  const visibleSnapshot = snapshot?.status === 'disabled' ? { ...snapshot, normalization: null } : snapshot;
  const normalization = visibleSnapshot?.status === 'imported' ? visibleSnapshot.normalization : null;
  const categoryCounts = useMemo(() => {
    const counts: Record<LucidHkSleepCategory, number> = {
      inBed: 0,
      asleepUnspecified: 0,
      awake: 0,
      asleepCore: 0,
      asleepDeep: 0,
      asleepREM: 0,
    };
    for (const sample of normalization?.samples ?? []) counts[sample.category] += 1;
    return counts;
  }, [normalization]);

  const sources = useMemo(
    () => uniqueSampleSources(normalization?.samples),
    [normalization?.samples]
  );
  const canDisable = snapshot?.status === 'imported';
  const canDelete = Boolean(
    snapshot &&
      (snapshot.status === 'imported' ||
        snapshot.status === 'disabled' ||
        snapshot.emptyReason === 'ambiguous_empty' ||
        snapshot.importedAt !== null)
  );

  const busy = activeAction !== null;
  const importSleep = useCallback(async () => {
    if (activeAction) return;
    setActiveAction('import');
    setLiveStatus('prompting');
    try {
      const prompt = await requestLucidHealthKitSleepReadAuthorization();
      if (prompt.status === 'unavailable') {
        setLiveStatus('unavailable');
        return;
      }
      if (prompt.status === 'native_failure') {
        setLiveStatus('failure');
        return;
      }
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * DAY_MS);
      const result = await queryLucidHealthKitSleepAnalysis(
        { startDate, endDate },
        { hasRequestedAuthorization: true }
      );
      const importedAt = Date.now();
      if (result.status === 'ready') {
        try {
          const next = await importLucidHealthKitSnapshot(userScope, {
            importedAt,
            rangeStartMs: startDate.getTime(),
            rangeEndMs: endDate.getTime(),
            normalization: result.normalization,
          });
          setSnapshot(next);
          setLiveStatus('imported');
        } catch {
          setLiveStatus('storageFailed');
        }
        return;
      }
      if (result.reason === 'ambiguous_empty') {
        try {
          const next = await recordLucidHealthKitEmptySnapshot(userScope, {
            importedAt,
            rangeStartMs: startDate.getTime(),
            rangeEndMs: endDate.getTime(),
            emptyReason: 'ambiguous_empty',
          });
          setSnapshot(next);
          setLiveStatus('empty');
        } catch {
          setLiveStatus('storageFailed');
        }
        return;
      }
      if (result.reason === 'unavailable') {
        setLiveStatus('unavailable');
        return;
      }
      setLiveStatus('failure');
    } catch {
      setLiveStatus('failure');
    } finally {
      setActiveAction(null);
    }
  }, [activeAction, userScope]);

  const disableImport = useCallback(async () => {
    if (activeAction || snapshot?.status !== 'imported') return;
    const previous = snapshot;
    setActiveAction('disable');
    try {
      const next = await disableLucidHealthKitSnapshot(userScope);
      setSnapshot(next);
      setLiveStatus('disabled');
    } catch {
      setSnapshot(previous);
      setLiveStatus('storageFailed');
    } finally {
      setActiveAction(null);
    }
  }, [activeAction, snapshot, userScope]);

  const deleteImport = useCallback(() => {
    if (activeAction) return;
    Alert.alert(copy.confirmDeleteTitle, copy.confirmDeleteBody, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.confirm,
        style: 'destructive',
        onPress: () => {
          if (activeAction) return;
          const previous = snapshot;
          setActiveAction('delete');
          void deleteLucidHealthKitSnapshot(userScope)
            .then(() => {
              setSnapshot(emptyLocalSnapshot());
              setLiveStatus('deleted');
            })
            .catch(() => {
              setSnapshot(previous);
              setLiveStatus('storageFailed');
            })
            .finally(() => {
              setActiveAction(null);
            });
        },
      },
    ]);
  }, [activeAction, copy, snapshot, userScope]);

  const statusLabel =
    visibleSnapshot?.status === 'imported'
      ? copy.imported
      : visibleSnapshot?.status === 'disabled'
        ? copy.disabled
        : copy.empty;

  return (
    <LucidScreen
      testID="lucid-sleep-integration"
      title={copy.title}
      eyebrow={copy.eyebrow}
      trailing={
        <LucidIconAction label={copy.back} icon="close" onPress={close} />
      }
    >
      <Text style={[styles.notice, { color: palette.textSecondary }]}>
        {copy.notice}
      </Text>
      <Text accessibilityLiveRegion="polite" style={[styles.live, { color: palette.text }]}>
        {liveCopy[liveStatus]}
      </Text>

      <LucidButton
        label={activeAction === 'import' ? copy.connecting : copy.connect}
        icon="cloud-download"
        disabled={busy}
        onPress={() => void importSleep()}
        testID="lucid-sleep-connect"
      />

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <LucidSectionHeader title={copy.status} />
        <Text style={[styles.body, { color: palette.text }]}>{statusLabel}</Text>
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          {copy.window}: {formatWindow(visibleSnapshot?.rangeStartMs ?? null, visibleSnapshot?.rangeEndMs ?? null, content.locale)}
        </Text>
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          {copy.granularity}: {copy[normalization?.granularity ?? 'unknown']}
        </Text>
        <Text accessibilityRole="header" style={[styles.section, { color: palette.text }]}>
          {copy.sources}
        </Text>
        {(sources.length ? sources : [{ name: copy.noSource, bundleId: null }]).map((source) => (
          <Text key={`${source.name ?? ''}:${source.bundleId ?? ''}`} style={[styles.body, { color: palette.textSecondary }]}>
            {source.name ?? copy.noSource}
            {source.bundleId ? ` · ${source.bundleId}` : ''}
          </Text>
        ))}
        <Text accessibilityRole="header" style={[styles.section, { color: palette.text }]}>
          {copy.categories}
        </Text>
        {(Object.keys(CATEGORY_KEYS) as LucidHkSleepCategory[]).map((category) => (
          <Text key={category} style={[styles.body, { color: palette.textSecondary }]}>
            {copy[CATEGORY_KEYS[category]]}: {categoryCounts[category]}
          </Text>
        ))}
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          {copy.usable}: {normalization?.samples.length ?? 0}
        </Text>
        <Text style={[styles.body, { color: palette.textSecondary }]}>
          {copy.rejected}: {normalization?.rejected.length ?? 0}
        </Text>
        <Text accessibilityRole="header" style={[styles.section, { color: palette.text }]}>
          {copy.issues}
        </Text>
        {(normalization?.issues.length
          ? normalization.issues
          : visibleSnapshot?.emptyReason === 'ambiguous_empty'
            ? [{ kind: 'absent' as const }]
            : []
        ).map((issue, index) => (
          <Text key={`${issue.kind}-${index}`} style={[styles.body, { color: palette.textSecondary }]}>
            {copy[ISSUE_KEYS[issue.kind]]}
          </Text>
        ))}
      </View>

      <LucidButton
        label={copy.disable}
        variant="secondary"
        icon="pause"
        disabled={busy || !canDisable}
        disabledReason={busy ? copy.working : !canDisable ? copy.disableUnavailable : undefined}
        onPress={() => void disableImport()}
        testID="lucid-sleep-disable"
      />
      <LucidButton
        label={copy.delete}
        variant="danger"
        icon="trash"
        disabled={busy || !canDelete}
        disabledReason={busy ? copy.working : !canDelete ? copy.deleteUnavailable : undefined}
        onPress={deleteImport}
        testID="lucid-sleep-delete"
      />
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  notice: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
  },
  live: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  card: {
    borderWidth: 1,
    borderRadius: LucidRadius.lg,
    padding: LucidSpace.lg,
    gap: LucidSpace.sm,
  },
  section: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.bodySm[0],
    lineHeight: LucidType.bodySm[1],
    marginTop: LucidSpace.sm,
  },
  body: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
});
