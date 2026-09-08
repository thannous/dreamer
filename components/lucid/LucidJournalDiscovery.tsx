import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { LucidButton, LucidCard } from '@/components/lucid/LucidUI';
import { getLucidPalette, LucidSpace, LucidType } from '@/constants/lucidTheme';
import { useTheme } from '@/context/ThemeContext';
import type { LucidLocale } from '@/lib/lucid/model';
import { hideJournalDiscovery, isJournalDiscoveryVisible, openJournalDiscovery } from '@/services/lucidJournalDiscovery';

const COPY = {
  en: { title: 'Discover the Noctalia journal', body: 'Keep your dream accounts and explore your own associations in Noctalia. Lucid remains a complete, independent practice.', open: 'Discover Noctalia', hide: 'Hide this recommendation', saveError: 'Could not save this choice. Tap Hide again to retry.', openError: 'Could not open Noctalia. You can try again later.' },
  fr: { title: 'Découvrir le journal Noctalia', body: 'Conserve tes récits de rêves et explore tes propres associations dans Noctalia. Tu peux continuer ta pratique dans Lucid de façon autonome.', open: 'Découvrir Noctalia', hide: 'Masquer cette recommandation', saveError: 'Ce choix n’a pas pu être enregistré. Appuie à nouveau sur Masquer pour réessayer.', openError: 'Noctalia n’a pas pu être ouvert. Tu peux réessayer plus tard.' },
  es: { title: 'Descubre el diario Noctalia', body: 'Conserva tus relatos de sueños y explora tus propias asociaciones en Noctalia. Lucid sigue siendo una práctica completa e independiente.', open: 'Descubrir Noctalia', hide: 'Ocultar esta recomendación', saveError: 'No se pudo guardar esta elección. Pulsa Ocultar de nuevo para reintentarlo.', openError: 'No se pudo abrir Noctalia. Puedes intentarlo más tarde.' },
  de: { title: 'Das Noctalia-Traumtagebuch entdecken', body: 'Bewahre deine Traumberichte und erkunde deine eigenen Assoziationen in Noctalia. Lucid bleibt eine vollständige, eigenständige Praxis.', open: 'Noctalia entdecken', hide: 'Diese Empfehlung ausblenden', saveError: 'Diese Auswahl konnte nicht gespeichert werden. Tippe erneut auf Ausblenden.', openError: 'Noctalia konnte nicht geöffnet werden. Versuche es später erneut.' },
  it: { title: 'Scopri il diario Noctalia', body: 'Conserva i racconti dei tuoi sogni ed esplora le tue associazioni in Noctalia. Lucid resta una pratica completa e autonoma.', open: 'Scopri Noctalia', hide: 'Nascondi questo suggerimento', saveError: 'Impossibile salvare questa scelta. Tocca di nuovo Nascondi per riprovare.', openError: 'Impossibile aprire Noctalia. Puoi riprovare più tardi.' },
} satisfies Record<LucidLocale, Record<string, string>>;

export function LucidJournalDiscovery({ locale }: { locale: LucidLocale }) {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const copy = COPY[locale];
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'saveError' | 'openError' | null>(null);
  useEffect(() => {
    let active = true;
    void isJournalDiscoveryVisible().then((show) => { if (active) setVisible(show); });
    return () => { active = false; };
  }, []);

  const act = async (action: 'hide' | 'open') => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (action === 'hide') {
        await hideJournalDiscovery();
        setVisible(false);
      } else {
        await openJournalDiscovery();
      }
    } catch {
      setError(action === 'hide' ? 'saveError' : 'openError');
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;
  return (
    <LucidCard testID="lucid-journal-discovery" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
      <Text style={[styles.body, { color: palette.textSecondary }]}>{copy.body}</Text>
      {error ? <Text accessibilityRole="alert" style={[styles.body, { color: palette.danger }]}>{copy[error]}</Text> : null}
      <LucidButton label={copy.open} variant="secondary" loading={busy} onPress={() => void act('open')} />
      <LucidButton label={copy.hide} variant="ghost" loading={busy} onPress={() => void act('hide')} />
    </LucidCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: LucidSpace.sm },
  title: { fontSize: LucidType.h3[0], lineHeight: LucidType.h3[1], fontWeight: '600' },
  body: { fontSize: LucidType.body[0], lineHeight: LucidType.body[1] },
});
