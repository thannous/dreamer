import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
import { useDreamsData } from '@/context/DreamsContext';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidDreamAtlas } from '@/hooks/useLucidDreamAtlas';
import { useLucidReducedMotion } from '@/hooks/useLucidReducedMotion';
import { resolveLucidDreamAtlasRehearsalSignId } from '@/lib/lucid/dreamAtlas';
import { extractLucidDreamSignCandidates, reconcileLucidDreamSignDecisions } from '@/lib/lucid/dreamSigns';
import { closeLucidRoute } from '@/lib/lucid/routes';

const COPY = {
  en: {
    eyebrow: 'Your dream memory',
    title: 'Dream atlas',
    subtitle: 'A local map of confirmed signs. Hidden signs stay in the list.',
    close: 'Close',
    retry: 'Try again',
    empty: 'Confirm a recurring dream sign to start this atlas.',
    emptyCta: 'Review dream signs',
    nodes: 'Signs',
    hidden: 'Hidden',
    visible: 'Visible',
    frequency: (count: number) => `Seen in ${count} ${count === 1 ? 'dream' : 'dreams'}`,
    lastSeen: 'Last appearance',
    sources: 'Source dreams',
    sourceFallback: 'Recorded dream',
    map: 'Map of visible signs',
    sharedDreams: (left: string, right: string, count: number) =>
      `${left} · ${right}: ${count} shared ${count === 1 ? 'dream' : 'dreams'}`,
    rename: 'Personal name',
    save: 'Save name',
    hide: 'Hide',
    unhide: 'Show again',
    merge: 'Merge into another sign',
    mergeConfirmTitle: 'Merge these signs?',
    mergeConfirmBody: 'Their source dreams will be kept together. This stays on this device.',
    delete: 'Remove from atlas',
    deleteConfirmTitle: 'Remove this sign?',
    deleteConfirmBody: 'Source dreams are not deleted. Only this atlas entry is removed.',
    cancel: 'Cancel',
    pause: 'Mindful pause',
    pauseHint: 'Open a reality check from this sign.',
    repeatScene: (title: string) => `Rehearse this scene: ${title}`,
    privacy: 'This atlas stays on this device. It does not send dream text anywhere.',
    persistenceFailed: 'The atlas could not be saved on this device. Try again.',
    storageFull: 'This device is out of storage for the atlas.',
    invalidScope: 'This atlas is not available for the current account.',
    invalidMetadata: 'This atlas entry could not be updated.',
    nodeSummary: (label: string, visibility: string, frequency: string, lastSeen: string) =>
      `${label}. ${visibility}. ${frequency}. ${lastSeen}.`,
  },
  fr: {
    eyebrow: 'Ta mémoire onirique',
    title: 'Atlas des rêves',
    subtitle: 'Une carte locale des signes confirmés. Les signes masqués restent dans la liste.',
    close: 'Fermer',
    retry: 'Réessayer',
    empty: 'Confirme un signe onirique récurrent pour commencer cet atlas.',
    emptyCta: 'Examiner les signes',
    nodes: 'Signes',
    hidden: 'Masqué',
    visible: 'Visible',
    frequency: (count: number) => `Vu dans ${count} rêve${count > 1 ? 's' : ''}`,
    lastSeen: 'Dernière apparition',
    sources: 'Rêves sources',
    sourceFallback: 'Rêve enregistré',
    map: 'Carte des signes visibles',
    sharedDreams: (left: string, right: string, count: number) =>
      `${left} · ${right} : ${count} rêve${count > 1 ? 's' : ''} en commun`,
    rename: 'Nom personnel',
    save: 'Enregistrer le nom',
    hide: 'Masquer',
    unhide: 'Réafficher',
    merge: 'Fusionner dans un autre signe',
    mergeConfirmTitle: 'Fusionner ces signes ?',
    mergeConfirmBody: 'Leurs rêves sources resteront ensemble. Cela reste sur cet appareil.',
    delete: 'Retirer de l’atlas',
    deleteConfirmTitle: 'Retirer ce signe ?',
    deleteConfirmBody: 'Les rêves sources ne sont pas supprimés. Seule cette entrée d’atlas disparaît.',
    cancel: 'Annuler',
    pause: 'Pause attentive',
    pauseHint: 'Ouvre un test de réalité à partir de ce signe.',
    repeatScene: (title: string) => `Répéter cette scène : ${title}`,
    privacy: 'Cet atlas reste sur cet appareil. Il n’envoie aucun texte de rêve.',
    persistenceFailed: 'L’atlas n’a pas pu être enregistré sur cet appareil. Réessaie.',
    storageFull: 'Cet appareil n’a plus assez d’espace pour l’atlas.',
    invalidScope: 'Cet atlas n’est pas disponible pour le compte actuel.',
    invalidMetadata: 'Cette entrée d’atlas n’a pas pu être mise à jour.',
    nodeSummary: (label: string, visibility: string, frequency: string, lastSeen: string) =>
      `${label}. ${visibility}. ${frequency}. ${lastSeen}.`,
  },
  es: {
    eyebrow: 'Tu memoria onírica',
    title: 'Atlas de sueños',
    subtitle: 'Un mapa local de señales confirmadas. Las ocultas siguen en la lista.',
    close: 'Cerrar',
    retry: 'Reintentar',
    empty: 'Confirma una señal onírica recurrente para empezar este atlas.',
    emptyCta: 'Revisar señales',
    nodes: 'Señales',
    hidden: 'Oculta',
    visible: 'Visible',
    frequency: (count: number) => `Aparece en ${count} ${count === 1 ? 'sueño' : 'sueños'}`,
    lastSeen: 'Última aparición',
    sources: 'Sueños de origen',
    sourceFallback: 'Sueño registrado',
    map: 'Mapa de señales visibles',
    sharedDreams: (left: string, right: string, count: number) =>
      `${left} · ${right}: ${count} ${count === 1 ? 'sueño compartido' : 'sueños compartidos'}`,
    rename: 'Nombre personal',
    save: 'Guardar nombre',
    hide: 'Ocultar',
    unhide: 'Mostrar de nuevo',
    merge: 'Fusionar en otra señal',
    mergeConfirmTitle: '¿Fusionar estas señales?',
    mergeConfirmBody: 'Sus sueños de origen se conservarán juntos. Esto permanece en este dispositivo.',
    delete: 'Quitar del atlas',
    deleteConfirmTitle: '¿Quitar esta señal?',
    deleteConfirmBody: 'Los sueños de origen no se eliminan. Solo desaparece esta entrada del atlas.',
    cancel: 'Cancelar',
    pause: 'Pausa atenta',
    pauseHint: 'Abre una prueba de realidad desde esta señal.',
    repeatScene: (title: string) => `Repetir esta escena: ${title}`,
    privacy: 'Este atlas permanece en este dispositivo. No envía texto de sueños.',
    persistenceFailed: 'No se pudo guardar el atlas en este dispositivo. Inténtalo de nuevo.',
    storageFull: 'Este dispositivo no tiene espacio para el atlas.',
    invalidScope: 'Este atlas no está disponible para la cuenta actual.',
    invalidMetadata: 'No se pudo actualizar esta entrada del atlas.',
    nodeSummary: (label: string, visibility: string, frequency: string, lastSeen: string) =>
      `${label}. ${visibility}. ${frequency}. ${lastSeen}.`,
  },
  de: {
    eyebrow: 'Deine Traumerinnerung',
    title: 'Traumatlas',
    subtitle: 'Eine lokale Karte bestätigter Zeichen. Ausgeblendete bleiben in der Liste.',
    close: 'Schließen',
    retry: 'Erneut versuchen',
    empty: 'Bestätige ein wiederkehrendes Traumzeichen, um diesen Atlas zu starten.',
    emptyCta: 'Traumzeichen prüfen',
    nodes: 'Zeichen',
    hidden: 'Ausgeblendet',
    visible: 'Sichtbar',
    frequency: (count: number) => `In ${count} ${count === 1 ? 'Traum' : 'Träumen'} gesehen`,
    lastSeen: 'Letztes Erscheinen',
    sources: 'Quellträume',
    sourceFallback: 'Gespeicherter Traum',
    map: 'Karte sichtbarer Zeichen',
    sharedDreams: (left: string, right: string, count: number) =>
      `${left} · ${right}: ${count} ${count === 1 ? 'gemeinsamer Traum' : 'gemeinsame Träume'}`,
    rename: 'Persönlicher Name',
    save: 'Name speichern',
    hide: 'Ausblenden',
    unhide: 'Wieder anzeigen',
    merge: 'In ein anderes Zeichen mergen',
    mergeConfirmTitle: 'Diese Zeichen mergen?',
    mergeConfirmBody: 'Ihre Quellträume bleiben zusammen. Das bleibt auf diesem Gerät.',
    delete: 'Aus dem Atlas entfernen',
    deleteConfirmTitle: 'Dieses Zeichen entfernen?',
    deleteConfirmBody: 'Quellträume werden nicht gelöscht. Nur dieser Atlas-Eintrag verschwindet.',
    cancel: 'Abbrechen',
    pause: 'Achtsame Pause',
    pauseHint: 'Öffne einen Reality Check von diesem Zeichen.',
    repeatScene: (title: string) => `Diese Szene wiederholen: ${title}`,
    privacy: 'Dieser Atlas bleibt auf diesem Gerät. Es wird kein Traumtext gesendet.',
    persistenceFailed: 'Der Atlas konnte auf diesem Gerät nicht gespeichert werden. Versuche es erneut.',
    storageFull: 'Auf diesem Gerät ist kein Speicher mehr für den Atlas frei.',
    invalidScope: 'Dieser Atlas ist für das aktuelle Konto nicht verfügbar.',
    invalidMetadata: 'Dieser Atlas-Eintrag konnte nicht aktualisiert werden.',
    nodeSummary: (label: string, visibility: string, frequency: string, lastSeen: string) =>
      `${label}. ${visibility}. ${frequency}. ${lastSeen}.`,
  },
  it: {
    eyebrow: 'La tua memoria onirica',
    title: 'Atlante dei sogni',
    subtitle: 'Una mappa locale dei segnali confermati. Quelli nascosti restano nell’elenco.',
    close: 'Chiudi',
    retry: 'Riprova',
    empty: 'Conferma un segnale onirico ricorrente per iniziare questo atlante.',
    emptyCta: 'Rivedi i segnali',
    nodes: 'Segnali',
    hidden: 'Nascosto',
    visible: 'Visibile',
    frequency: (count: number) => `Presente in ${count} ${count === 1 ? 'sogno' : 'sogni'}`,
    lastSeen: 'Ultima comparsa',
    sources: 'Sogni di origine',
    sourceFallback: 'Sogno registrato',
    map: 'Mappa dei segnali visibili',
    sharedDreams: (left: string, right: string, count: number) =>
      `${left} · ${right}: ${count} ${count === 1 ? 'sogno in comune' : 'sogni in comune'}`,
    rename: 'Nome personale',
    save: 'Salva nome',
    hide: 'Nascondi',
    unhide: 'Mostra di nuovo',
    merge: 'Unisci in un altro segnale',
    mergeConfirmTitle: 'Unire questi segnali?',
    mergeConfirmBody: 'I sogni di origine resteranno insieme. Resta su questo dispositivo.',
    delete: 'Rimuovi dall’atlante',
    deleteConfirmTitle: 'Rimuovere questo segnale?',
    deleteConfirmBody: 'I sogni di origine non vengono eliminati. Scompare solo questa voce dell’atlante.',
    cancel: 'Annulla',
    pause: 'Pausa consapevole',
    pauseHint: 'Apri un reality check da questo segnale.',
    repeatScene: (title: string) => `Ripeti questa scena: ${title}`,
    privacy: 'Questo atlante resta su questo dispositivo. Non invia testo dei sogni.',
    persistenceFailed: 'L’atlante non è stato salvato su questo dispositivo. Riprova.',
    storageFull: 'Questo dispositivo non ha spazio per l’atlante.',
    invalidScope: 'Questo atlante non è disponibile per l’account attuale.',
    invalidMetadata: 'Questa voce dell’atlante non è stata aggiornata.',
    nodeSummary: (label: string, visibility: string, frequency: string, lastSeen: string) =>
      `${label}. ${visibility}. ${frequency}. ${lastSeen}.`,
  },
} as const;

function persistenceCopy(
  copy: (typeof COPY)[keyof typeof COPY],
  reason: string | null
) {
  if (reason === 'storage_full') return copy.storageFull;
  if (reason === 'invalid_scope') return copy.invalidScope;
  if (reason === 'invalid_metadata') return copy.invalidMetadata;
  return copy.persistenceFailed;
}

function formatDate(value: number, locale: string) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return new Date(value).toDateString();
  }
}

const MAX_VISIBLE_GRAPH_NODES = 12;

function sharedSourceIds(left: readonly string[], right: readonly string[]): string[] {
  if (left.length === 0 || right.length === 0) return [];
  const rightSet = new Set(right);
  return left.filter((id) => rightSet.has(id));
}

function buildVisibleGraph<T extends { id: string; label: string; sourceDreamIds: readonly string[] }>(
  nodes: readonly T[]
) {
  const graphNodes = nodes.slice(0, MAX_VISIBLE_GRAPH_NODES);
  const relations: { id: string; left: string; right: string; count: number }[] = [];
  for (let i = 0; i < graphNodes.length; i += 1) {
    for (let j = i + 1; j < graphNodes.length; j += 1) {
      const leftNode = graphNodes[i];
      const rightNode = graphNodes[j];
      if (!leftNode || !rightNode) continue;
      const count = sharedSourceIds(leftNode.sourceDreamIds, rightNode.sourceDreamIds).length;
      if (count === 0) continue;
      relations.push({
        id: `${leftNode.id}::${rightNode.id}`,
        left: leftNode.label,
        right: rightNode.label,
        count,
      });
    }
  }
  return { graphNodes, relations };
}

export default function LucidDreamAtlasScreen() {
  const { dreams, loaded } = useDreamsData();
  const { content, state, userScope, dreamSignCandidates } = useLucidTrainer();
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const reduceMotion = useLucidReducedMotion();
  const copy = COPY[content.locale];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ nodeId: string; value: string } | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);

  const signs = useMemo(() => {
    const candidates = dreamSignCandidates.length
      ? dreamSignCandidates
      : extractLucidDreamSignCandidates(dreams);
    return reconcileLucidDreamSignDecisions(candidates, state?.dreamSignDecisions ?? []);
  }, [dreamSignCandidates, dreams, state?.dreamSignDecisions]);

  const atlas = useLucidDreamAtlas({
    userScope,
    signs,
    dreams,
  });

  const nodes = atlas.snapshot?.nodes ?? [];
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0] ?? null;
  const draftName = selected
    ? draft?.nodeId === selected.id
      ? draft.value
      : selected.label
    : '';
  const dreamsById = useMemo(
    () => new Map(dreams.map((dream) => [String(dream.id), dream] as const)),
    [dreams]
  );

  const visibleNodes = nodes.filter((node) => !node.hidden);
  const graph = buildVisibleGraph(visibleNodes);
  const showMap = !reduceMotion && visibleNodes.length > 0;
  const busy = atlas.isMutating;
  const loading = !loaded || atlas.isLoading;
  const canSaveName = Boolean(
    selected && draftName.trim().length > 0 && draftName.trim() !== selected.label
  );

  const runAtlasAction = (work: () => Promise<void>) => {
    void Promise.resolve(work()).catch(() => undefined);
  };

  const selectNode = (nodeId: string) => {
    setSelectedId(nodeId);
    setDraft(null);
    setMergeTargetId(null);
  };

  const confirmMerge = (fromId: string, intoId: string) => {
    Alert.alert(copy.mergeConfirmTitle, copy.mergeConfirmBody, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.merge,
        onPress: () => {
          runAtlasAction(() => atlas.mergeNodes(fromId, intoId));
          setMergeTargetId(null);
          setSelectedId(intoId);
          setDraft(null);
        },
      },
    ]);
  };

  const confirmDelete = (nodeId: string) => {
    Alert.alert(copy.deleteConfirmTitle, copy.deleteConfirmBody, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.delete,
        style: 'destructive',
        onPress: () => {
          runAtlasAction(() => atlas.deleteNode(nodeId));
          if (selectedId === nodeId) {
            setSelectedId(null);
            setDraft(null);
          }
        },
      },
    ]);
  };

  return (
    <LucidScreen
      eyebrow={copy.eyebrow}
      subtitle={copy.subtitle}
      testID="lucid-dream-atlas"
      title={copy.title}
      trailing={<LucidIconAction icon="close" label={copy.close} onPress={() => closeLucidRoute(router, '/lucid/(tabs)/journal')} />}
    >
      <LucidCard accent="accent" style={styles.privacyCard}>
        <Ionicons color={palette.accent} name="phone-portrait-outline" size={LucidIcon.md} />
        <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.privacy}</Text>
      </LucidCard>

      {loading ? (
        <Text accessibilityLiveRegion="polite" style={[styles.empty, { color: palette.textSecondary }]}>
          {content.chrome.common.loading}
        </Text>
      ) : null}

      {atlas.error ? (
        <LucidCard style={styles.signCard}>
          <Text style={[styles.body, { color: palette.textSecondary }]}>
            {persistenceCopy(copy, atlas.error)}
          </Text>
          <LucidButton label={copy.retry} onPress={() => runAtlasAction(atlas.refresh)} />
        </LucidCard>
      ) : null}

      {!loading && !atlas.error && nodes.length === 0 ? (
        <LucidCard style={styles.signCard}>
          <Text style={[styles.empty, { color: palette.textSecondary }]}>{copy.empty}</Text>
          <LucidButton label={copy.emptyCta} onPress={() => router.push('/lucid/dream-signs' as Href)} />
        </LucidCard>
      ) : null}

      {showMap ? (
        <View
          style={[styles.map, { borderColor: palette.borderInteractive, backgroundColor: palette.surfaceRaised }]}
          testID="lucid-dream-atlas-map"
        >
          <Text style={[styles.mapLabel, { color: palette.textMuted }]}>{copy.map}</Text>
          <View style={styles.mapRow}>
            {graph.graphNodes.map((node) => {
              const active = selected?.id === node.id;
              const summary = copy.nodeSummary(
                node.label,
                copy.visible,
                copy.frequency(node.distinctDreamCount),
                `${copy.lastSeen}: ${formatDate(node.lastAppearanceAt, content.locale)}`
              );
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={summary}
                  accessibilityState={{ selected: active }}
                  key={node.id}
                  onPress={() => selectNode(node.id)}
                  style={({ pressed }) => [
                    styles.mapNode,
                    {
                      backgroundColor: active ? palette.accentSoft : palette.surfaceRaised,
                      borderColor: active ? palette.accent : palette.borderInteractive,
                    },
                    pressed && styles.pressed,
                  ]}
                  testID={`lucid-dream-atlas-map-node-${node.id}`}
                >
                  <Text numberOfLines={1} style={[styles.mapNodeLabel, { color: palette.text }]}>
                    {node.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {graph.relations.length > 0 ? (
            <View style={styles.mapRelations} testID="lucid-dream-atlas-map-relations">
              {graph.relations.map((relation) => (
                <Text
                  key={relation.id}
                  style={[styles.mapRelation, { color: palette.textSecondary }]}
                  testID={`lucid-dream-atlas-map-relation-${relation.id}`}
                >
                  {copy.sharedDreams(relation.left, relation.right, relation.count)}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {nodes.length > 0 ? (
        <LucidSectionHeader
          action={<LucidPill label={String(nodes.length)} tone="neutral" />}
          title={copy.nodes}
        />
      ) : null}

      {nodes.map((node) => {
        const active = selected?.id === node.id;
        const summary = copy.nodeSummary(
          node.label,
          node.hidden ? copy.hidden : copy.visible,
          copy.frequency(node.distinctDreamCount),
          `${copy.lastSeen}: ${formatDate(node.lastAppearanceAt, content.locale)}`
        );
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={summary}
            accessibilityState={{ selected: active, expanded: active }}
            key={node.id}
            onPress={() => {
              selectNode(node.id);
            }}
            style={({ pressed }) => [pressed && styles.pressed]}
            testID={`lucid-dream-atlas-node-${node.id}`}
          >
            <LucidCard style={active ? { ...styles.signCard, borderColor: palette.accent } : styles.signCard}>
              <Text testID={`lucid-dream-atlas-node-summary-${node.id}`} style={styles.srOnly}>
                {summary}
              </Text>
              <View style={styles.signHeader}>
                <View style={styles.signTitleBlock}>
                  <Text style={[styles.signTitle, { color: palette.text }]}>{node.label}</Text>
                  <Text style={[styles.body, { color: palette.textSecondary }]}>
                    {copy.frequency(node.distinctDreamCount)}
                  </Text>
                  <Text style={[styles.meta, { color: palette.textMuted }]}>
                    {node.category ?? '—'} · {copy.lastSeen}: {formatDate(node.lastAppearanceAt, content.locale)}
                  </Text>
                </View>
                <LucidPill label={node.hidden ? copy.hidden : copy.visible} tone={node.hidden ? 'neutral' : 'accent'} />
              </View>
            </LucidCard>
          </Pressable>
        );
      })}

      {selected ? (
        <LucidCard style={styles.signCard} testID={`lucid-dream-atlas-detail-${selected.id}`}>
          <Text style={[styles.signTitle, { color: palette.text }]}>{selected.label}</Text>
          <Text style={[styles.label, { color: palette.textMuted }]}>{copy.sources}</Text>
          <View style={styles.sources}>
            {selected.sourceDreamIds.map((sourceId) => {
              const dream = dreamsById.get(sourceId);
              const sourceTitle = dream?.title?.trim() || copy.sourceFallback;
              const rehearsalSignId = dream
                ? resolveLucidDreamAtlasRehearsalSignId({
                    nodeId: selected.id,
                    sourceDreamId: sourceId,
                    signs,
                    preferences: atlas.snapshot?.preferences,
                  })
                : null;
              return (
                <View key={sourceId} style={styles.sourceBlock} testID={`lucid-dream-atlas-source-row-${sourceId}`}>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => router.push(`/journal/${sourceId}` as Href)}
                    style={({ pressed }) => [
                      styles.source,
                      { backgroundColor: palette.surfaceRaised, borderColor: palette.borderInteractive },
                      pressed && styles.pressed,
                    ]}
                    testID={`lucid-dream-atlas-source-${sourceId}`}
                  >
                    <Ionicons color={palette.accent} name="book-outline" size={LucidIcon.sm} />
                    <Text numberOfLines={1} style={[styles.sourceText, { color: palette.text }]}>
                      {sourceTitle}
                    </Text>
                  </Pressable>
                  {rehearsalSignId ? (
                    <LucidButton
                      label={copy.repeatScene(sourceTitle)}
                      onPress={() =>
                        router.push(
                          `/lucid/dream-rehearsal?dreamId=${encodeURIComponent(sourceId)}&signId=${encodeURIComponent(rehearsalSignId)}` as Href
                        )
                      }
                      testID={`lucid-dream-atlas-rehearse-${sourceId}`}
                      variant="secondary"
                    />
                  ) : null}
                </View>
              );
            })}
          </View>

          <TextInput
            accessibilityLabel={copy.rename}
            editable={!busy}
            maxLength={80}
            onChangeText={(value) => {
              if (!selected) return;
              setDraft({ nodeId: selected.id, value });
            }}
            placeholder={copy.rename}
            placeholderTextColor={palette.textMuted}
            style={[
              styles.input,
              { backgroundColor: palette.surfaceRaised, borderColor: palette.borderInteractive, color: palette.text },
            ]}
            testID="lucid-dream-atlas-rename"
            value={draftName}
          />
          <LucidButton
            label={copy.save}
            loading={busy}
            disabled={!canSaveName}
            onPress={() => runAtlasAction(() => atlas.renameNode(selected.id, draftName.trim()))}
          />

          <View style={styles.actions}>
            <LucidButton
              label={selected.hidden ? copy.unhide : copy.hide}
              loading={busy}
              onPress={() =>
                runAtlasAction(() => (selected.hidden ? atlas.unhideNode(selected.id) : atlas.hideNode(selected.id)))
              }
              variant="secondary"
            />
            <LucidButton
              label={copy.delete}
              loading={busy}
              onPress={() => confirmDelete(selected.id)}
              variant="secondary"
            />
          </View>

          {nodes.filter((node) => node.id !== selected.id).length > 0 ? (
            <>
              <Text style={[styles.label, { color: palette.textMuted }]}>{copy.merge}</Text>
              {nodes
                .filter((node) => node.id !== selected.id)
                .map((node) => (
                  <LucidButton
                    key={node.id}
                    label={node.label}
                    loading={busy}
                    onPress={() => {
                      setMergeTargetId(node.id);
                      confirmMerge(selected.id, node.id);
                    }}
                    variant={mergeTargetId === node.id ? 'primary' : 'secondary'}
                  />
                ))}
            </>
          ) : null}

          <LucidButton
            label={copy.pause}
            onPress={() => router.push('/lucid/reality-check' as Href)}
            variant="secondary"
          />
          <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.pauseHint}</Text>
        </LucidCard>
      ) : null}
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  privacyCard: { flexDirection: 'row', gap: LucidSpace.sm, alignItems: 'center' },
  body: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  empty: {
    marginBottom: LucidSpace.md,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  map: {
    borderWidth: 1,
    borderRadius: LucidRadius.lg,
    padding: LucidSpace.md,
    marginBottom: LucidSpace.md,
    gap: LucidSpace.sm,
  },
  mapLabel: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  mapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: LucidSpace.sm },
  mapNode: {
    borderWidth: 1,
    borderRadius: LucidRadius.full,
    paddingHorizontal: LucidSpace.md,
    paddingVertical: LucidSpace.xs,
    maxWidth: 160,
  },
  mapNodeLabel: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  mapRelations: { gap: LucidSpace.xs },
  mapRelation: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  signCard: { gap: LucidSpace.sm, marginBottom: LucidSpace.md },
  signHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: LucidSpace.sm },
  signTitleBlock: { flex: 1, gap: 4 },
  signTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: LucidType.h3[0],
    lineHeight: LucidType.h3[1],
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
  sources: { gap: LucidSpace.xs },
  sourceBlock: { gap: LucidSpace.sm },
  source: {
    borderWidth: 1,
    borderRadius: LucidRadius.md,
    padding: LucidSpace.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LucidSpace.xs,
  },
  sourceText: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: LucidType.caption[0],
    lineHeight: LucidType.caption[1],
  },
  input: {
    borderWidth: 1,
    borderRadius: LucidRadius.md,
    paddingHorizontal: LucidSpace.md,
    paddingVertical: LucidSpace.sm,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: LucidType.body[0],
    lineHeight: LucidType.body[1],
  },
  actions: { gap: LucidSpace.sm },
  pressed: { opacity: 0.88 },
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
