import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { LucidButton, LucidCard, LucidIconAction, LucidScreen, LucidSectionHeader } from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { useLucidJournalImport } from '@/hooks/useLucidJournalImport';
import { closeLucidRoute } from '@/lib/lucid/routes';
import type { JournalImportPerimeter } from '@/services/lucidJournalImportRuntime';

const COPY = {
  "en": {
    "title": "Import from Journal",
    "intro": "Copy narratives, dates and provenance from Noctalia Journal into local Lucid copies. Journal stays unchanged.",
    "limits": "No images, audio or analyses are imported. Copies are not uploaded or turned into dream signs. Dreams stored only on another device are unavailable.",
    "all": "All dreams",
    "recent": "Last 30 dreams",
    "prepare": "Authorize reading in Journal",
    "confirm": "Confirm import",
    "scope": "Selected scope",
    "countUnknown": "Count unavailable",
    "copies": "Local copies",
    "empty": "No local copies yet.",
    "dateUnknown": "Date unavailable",
    "source": "Source: Noctalia Journal",
    "edit": "Edit local copy",
    "save": "Save locally",
    "cancel": "Cancel",
    "delete": "Delete copy",
    "deleteAll": "Delete all copies",
    "deletePrompt": "Delete these local copies?",
    "deleteBody": "This removes their text from Lucid only. Journal stays unchanged. Deleted copies will not be imported again.",
    "keep": "Keep my text",
    "incoming": "Use Journal version",
    "conflict": "A newer Journal version is available. Choose which text to keep.",
    "preparing": "Preparing authorization…",
    "importing": "Import in progress",
    "complete": "Import complete",
    "cancelled": "Import cancelled. Saved copies remain available.",
    "error": "Import interrupted. Saved copies remain available.",
    "unavailable": "Import is unavailable in this version. Local copies remain accessible.",
    "cleanup": "Authorization cleanup could not be completed. Retry cancellation before a new import.",
    "retry": "Prepare again",
    "login": "Optional Lucid account",
    "loginBody": "You can use local copies without signing in to Lucid.",
    "local": "Local only",
    "pages": "Pages saved",
    "available": "Copies available",
    "close": "Close"
  },
  "fr": {
    "title": "Importer depuis Journal",
    "intro": "Copiez les récits, dates et provenance de Noctalia Journal dans des copies locales Lucid. Journal reste inchangé.",
    "limits": "Aucune image, aucun audio ni aucune analyse ne sont importés. Les copies ne sont ni envoyées ni transformées en signes de rêve. Les rêves conservés uniquement sur un autre appareil sont indisponibles.",
    "all": "Tous les rêves",
    "recent": "30 derniers rêves",
    "prepare": "Autoriser la lecture dans Journal",
    "confirm": "Confirmer l’import",
    "scope": "Périmètre sélectionné",
    "countUnknown": "Nombre indisponible",
    "copies": "Copies locales",
    "empty": "Aucune copie locale pour le moment.",
    "dateUnknown": "Date indisponible",
    "source": "Source : Noctalia Journal",
    "edit": "Modifier la copie locale",
    "save": "Enregistrer localement",
    "cancel": "Annuler",
    "delete": "Supprimer la copie",
    "deleteAll": "Supprimer toutes les copies",
    "deletePrompt": "Supprimer ces copies locales ?",
    "deleteBody": "Leur texte sera retiré de Lucid uniquement. Journal reste inchangé. Les copies supprimées ne seront pas réimportées.",
    "keep": "Garder mon texte",
    "incoming": "Utiliser la version Journal",
    "conflict": "Une version Journal plus récente est disponible. Choisissez le texte à conserver.",
    "preparing": "Préparation de l’autorisation…",
    "importing": "Import en cours",
    "complete": "Import terminé",
    "cancelled": "Import annulé. Les copies enregistrées restent disponibles.",
    "error": "Import interrompu. Les copies enregistrées restent disponibles.",
    "unavailable": "L’import est indisponible dans cette version. Les copies locales restent accessibles.",
    "cleanup": "La fermeture de l’autorisation n’a pas abouti. Réessayez l’annulation avant un nouvel import.",
    "retry": "Préparer à nouveau",
    "login": "Compte Lucid facultatif",
    "loginBody": "Vous pouvez utiliser les copies locales sans vous connecter à Lucid.",
    "local": "Local uniquement",
    "pages": "Pages enregistrées",
    "available": "Copies disponibles",
    "close": "Fermer"
  },
  "es": {
    "title": "Importar desde Journal",
    "intro": "Copia relatos, fechas y procedencia de Noctalia Journal en copias locales de Lucid. Journal no cambia.",
    "limits": "No se importan imágenes, audio ni análisis. Las copias no se suben ni se convierten en señales de sueño. Los sueños guardados solo en otro dispositivo no están disponibles.",
    "all": "Todos los sueños",
    "recent": "Últimos 30 sueños",
    "prepare": "Autorizar lectura en Journal",
    "confirm": "Confirmar importación",
    "scope": "Alcance seleccionado",
    "countUnknown": "Cantidad no disponible",
    "copies": "Copias locales",
    "empty": "Aún no hay copias locales.",
    "dateUnknown": "Fecha no disponible",
    "source": "Origen: Noctalia Journal",
    "edit": "Editar copia local",
    "save": "Guardar localmente",
    "cancel": "Cancelar",
    "delete": "Eliminar copia",
    "deleteAll": "Eliminar todas las copias",
    "deletePrompt": "¿Eliminar estas copias locales?",
    "deleteBody": "Su texto se elimina solo de Lucid. Journal no cambia. Las copias eliminadas no se volverán a importar.",
    "keep": "Conservar mi texto",
    "incoming": "Usar versión de Journal",
    "conflict": "Hay una versión más reciente en Journal. Elige qué texto conservar.",
    "preparing": "Preparando autorización…",
    "importing": "Importación en curso",
    "complete": "Importación completada",
    "cancelled": "Importación cancelada. Las copias guardadas siguen disponibles.",
    "error": "Importación interrumpida. Las copias guardadas siguen disponibles.",
    "unavailable": "La importación no está disponible en esta versión. Las copias locales siguen accesibles.",
    "cleanup": "No se pudo cerrar la autorización. Vuelve a cancelar antes de importar.",
    "retry": "Preparar de nuevo",
    "login": "Cuenta Lucid opcional",
    "loginBody": "Puedes usar copias locales sin iniciar sesión en Lucid.",
    "local": "Solo local",
    "pages": "Páginas guardadas",
    "available": "Copias disponibles",
    "close": "Cerrar"
  },
  "de": {
    "title": "Aus Journal importieren",
    "intro": "Kopiere Erzählungen, Daten und Herkunft aus Noctalia Journal in lokale Lucid-Kopien. Journal bleibt unverändert.",
    "limits": "Bilder, Audio und Analysen werden nicht importiert. Kopien werden weder hochgeladen noch zu Traumzeichen. Nur auf einem anderen Gerät gespeicherte Träume sind nicht verfügbar.",
    "all": "Alle Träume",
    "recent": "Letzte 30 Träume",
    "prepare": "Lesen in Journal erlauben",
    "confirm": "Import bestätigen",
    "scope": "Gewählter Umfang",
    "countUnknown": "Anzahl nicht verfügbar",
    "copies": "Lokale Kopien",
    "empty": "Noch keine lokalen Kopien.",
    "dateUnknown": "Datum nicht verfügbar",
    "source": "Quelle: Noctalia Journal",
    "edit": "Lokale Kopie bearbeiten",
    "save": "Lokal speichern",
    "cancel": "Abbrechen",
    "delete": "Kopie löschen",
    "deleteAll": "Alle Kopien löschen",
    "deletePrompt": "Diese lokalen Kopien löschen?",
    "deleteBody": "Ihr Text wird nur aus Lucid entfernt. Journal bleibt unverändert. Gelöschte Kopien werden nicht erneut importiert.",
    "keep": "Meinen Text behalten",
    "incoming": "Journal-Version verwenden",
    "conflict": "Eine neuere Journal-Version ist verfügbar. Wähle den Text, den du behalten möchtest.",
    "preparing": "Autorisierung wird vorbereitet…",
    "importing": "Import läuft",
    "complete": "Import abgeschlossen",
    "cancelled": "Import abgebrochen. Gespeicherte Kopien bleiben verfügbar.",
    "error": "Import unterbrochen. Gespeicherte Kopien bleiben verfügbar.",
    "unavailable": "Import ist in dieser Version nicht verfügbar. Lokale Kopien bleiben zugänglich.",
    "cleanup": "Die Autorisierung konnte nicht beendet werden. Versuche den Abbruch erneut, bevor du importierst.",
    "retry": "Erneut vorbereiten",
    "login": "Optionales Lucid-Konto",
    "loginBody": "Lokale Kopien sind ohne Anmeldung bei Lucid nutzbar.",
    "local": "Nur lokal",
    "pages": "Gespeicherte Seiten",
    "available": "Verfügbare Kopien",
    "close": "Schließen"
  },
  "it": {
    "title": "Importa da Journal",
    "intro": "Copia racconti, date e provenienza da Noctalia Journal in copie locali Lucid. Journal resta invariato.",
    "limits": "Non vengono importati immagini, audio o analisi. Le copie non vengono caricate né trasformate in segni onirici. I sogni salvati solo su un altro dispositivo non sono disponibili.",
    "all": "Tutti i sogni",
    "recent": "Ultimi 30 sogni",
    "prepare": "Autorizza la lettura in Journal",
    "confirm": "Conferma importazione",
    "scope": "Ambito selezionato",
    "countUnknown": "Numero non disponibile",
    "copies": "Copie locali",
    "empty": "Nessuna copia locale per ora.",
    "dateUnknown": "Data non disponibile",
    "source": "Origine: Noctalia Journal",
    "edit": "Modifica copia locale",
    "save": "Salva localmente",
    "cancel": "Annulla",
    "delete": "Elimina copia",
    "deleteAll": "Elimina tutte le copie",
    "deletePrompt": "Eliminare queste copie locali?",
    "deleteBody": "Il testo verrà rimosso solo da Lucid. Journal resta invariato. Le copie eliminate non verranno importate di nuovo.",
    "keep": "Mantieni il mio testo",
    "incoming": "Usa versione Journal",
    "conflict": "È disponibile una versione Journal più recente. Scegli il testo da conservare.",
    "preparing": "Preparazione autorizzazione…",
    "importing": "Importazione in corso",
    "complete": "Importazione completata",
    "cancelled": "Importazione annullata. Le copie salvate restano disponibili.",
    "error": "Importazione interrotta. Le copie salvate restano disponibili.",
    "unavailable": "Importazione non disponibile in questa versione. Le copie locali restano accessibili.",
    "cleanup": "Impossibile chiudere l’autorizzazione. Riprova ad annullare prima di importare.",
    "retry": "Prepara di nuovo",
    "login": "Account Lucid facoltativo",
    "loginBody": "Puoi usare le copie locali senza accedere a Lucid.",
    "local": "Solo locale",
    "pages": "Pagine salvate",
    "available": "Copie disponibili",
    "close": "Chiudi"
  }
} as const;

export default function LucidJournalImportScreen() {
  const { content, userScope } = useLucidTrainer();
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const c = COPY[content.locale];
  const flow = useLucidJournalImport();
  const { state } = flow;
  const [perimeter, setPerimeter] = useState<JournalImportPerimeter>('all');
  const [editing, setEditing] = useState<{ scope: string; id: string; text: string } | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const busy = state.status === 'preparing' || state.status === 'importing';
  const copies = Object.values(state.snapshot?.copies ?? {}).filter(copy => !copy.deleted);
  const body = [styles.body, { color: palette.textSecondary }];
  const actLocal = async (action: () => Promise<unknown>) => {
    setLocalBusy(true);
    try { await action(); } finally { setLocalBusy(false); }
  };
  const confirmDelete = (id?: string) => Alert.alert(c.deletePrompt, c.deleteBody, [
    { text: c.cancel, style: 'cancel' },
    { text: id ? c.delete : c.deleteAll, style: 'destructive', onPress: () => {
      void actLocal(() => id ? flow.updateCopy(id, { type: 'delete' }) : flow.deleteAll());
    } },
  ]);
  return (
    <LucidScreen title={c.title} subtitle={c.intro} trailing={
      <LucidIconAction label={c.close} icon="close" onPress={() => closeLucidRoute(router, '/lucid/data')} />
    }>
      <LucidCard>
        <Text style={body}>{c.limits}</Text>
        <LucidButton label={c.all} variant={perimeter === 'all' ? 'primary' : 'secondary'}
          disabled={busy || state.status === 'ready'} onPress={() => setPerimeter('all')} />
        <LucidButton label={c.recent} variant={perimeter === 'recent30' ? 'primary' : 'secondary'}
          disabled={busy || state.status === 'ready'} onPress={() => setPerimeter('recent30')} />
        {state.status === 'ready' && state.preparation ? (
          <View style={styles.group}>
            <Text style={body}>{c.scope}: {state.preparation.perimeter === 'all' ? c.all : c.recent}</Text>
            <Text style={body}>{state.preparation.knownCount === null ? c.countUnknown : `${c.copies}: ${state.preparation.knownCount}`}</Text>
            <Text style={body}>{c.source} · {state.preparation.sourceAccount}</Text>
            <LucidButton label={c.confirm} onPress={() => { void flow.confirmStart(); }} />
          </View>
        ) : !busy ? (
          <LucidButton label={state.status === 'error' || state.status === 'cancelled' ? c.retry : c.prepare}
            disabled={!flow.remoteAvailable} onPress={() => { void flow.prepare(perimeter); }} />
        ) : null}
        {flow.available && flow.signedIn && !flow.remoteAvailable && !state.errorCode ? <Text style={body}>{c.unavailable}</Text> : null}
        {busy ? <Text accessibilityLiveRegion="polite" style={body}>{state.status === 'preparing' ? c.preparing : c.importing}</Text> : null}
        {state.progress ? <Text accessibilityLiveRegion="polite" style={body}>{c.pages}: {state.progress.persistedPages} · {c.available}: {state.progress.availableCopies}</Text> : null}
        {state.status === 'complete' && !state.errorCode ? <Text style={body}>{c.complete} · {c.available}: {copies.length}</Text> : null}
        {state.status === 'cancelled' ? <Text style={body}>{c.cancelled}</Text> : null}
        {state.errorCode || state.status === 'error' ? <Text accessibilityRole="alert" style={body}>{state.errorCode === 'cleanup_failed' ? c.cleanup : state.errorCode === 'unavailable' ? c.unavailable : c.error}</Text> : null}
        {busy || state.status === 'ready' || state.errorCode === 'cleanup_failed' ? <LucidButton label={c.cancel} variant="secondary" onPress={() => { void flow.cancel(); }} /> : null}
      </LucidCard>
      {!flow.signedIn ? <LucidCard>
        <Text style={body}>{c.loginBody}</Text>
        <LucidButton label={c.login} variant="secondary" onPress={() => router.push('/lucid/account')} />
      </LucidCard> : null}
      <LucidSectionHeader title={c.copies} />
      {copies.length === 0 ? <Text style={body}>{c.empty}</Text> : null}
      {copies.map(copy => (
        <LucidCard key={copy.identity}>
          <Text style={body}>{c.source} · {copy.sourceAccount}</Text>
          <Text style={body}>{copy.createdAt ? new Date(copy.createdAt).toLocaleDateString(content.locale) : c.dateUnknown} · {c.local}</Text>
          {editing?.scope === userScope && editing.id === copy.identity ? <>
            <TextInput accessibilityLabel={c.edit} multiline value={editing.text}
              onChangeText={text => setEditing({ ...editing, text })}
              style={[styles.editor, { color: palette.text, borderColor: palette.textSecondary }]} />
            <LucidButton label={c.save} disabled={localBusy || busy} onPress={() => {
              void actLocal(async () => { const saved = await flow.updateCopy(copy.identity, { type: 'edit', text: editing.text }); if (saved) setEditing(null); });
            }} />
            <LucidButton label={c.cancel} variant="secondary" onPress={() => setEditing(null)} />
          </> : <>
            <Text style={[styles.body, { color: palette.text }]} numberOfLines={6}>{copy.text}</Text>
            <LucidButton label={c.edit} variant="secondary" disabled={localBusy || busy}
              onPress={() => setEditing({ scope: userScope, id: copy.identity, text: copy.text })} />
          </>}
          {copy.incoming ? <View style={styles.group}>
            <Text style={body}>{c.conflict}</Text>
            <Text style={body} numberOfLines={6}>{copy.incoming.text}</Text>
            <LucidButton label={c.keep} variant="secondary" disabled={localBusy || busy}
              onPress={() => { void actLocal(() => flow.updateCopy(copy.identity, { type: 'keepLocal' })); }} />
            <LucidButton label={c.incoming} variant="secondary" disabled={localBusy || busy}
              onPress={() => { void actLocal(() => flow.updateCopy(copy.identity, { type: 'useIncoming' })); }} />
          </View> : null}
          <LucidButton label={c.delete} variant="danger" disabled={localBusy || busy} onPress={() => confirmDelete(copy.identity)} />
        </LucidCard>
      ))}
      {copies.length > 0 ? <LucidButton label={c.deleteAll} variant="danger" disabled={localBusy || busy} onPress={() => confirmDelete()} /> : null}
    </LucidScreen>
  );
}
const styles = StyleSheet.create({
  body: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: LucidType.caption[0], lineHeight: LucidType.caption[1] },
  group: { gap: LucidSpace.md },
  editor: { minHeight: 140, borderWidth: 1, borderRadius: 12, padding: LucidSpace.md, textAlignVertical: 'top', fontSize: 16 },
});
