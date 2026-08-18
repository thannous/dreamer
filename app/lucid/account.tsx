import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { EmailAuthCard } from '@/components/auth/EmailAuthCard';
import { LucidButton, LucidCard, LucidIconAction, LucidScreen } from '@/components/lucid/LucidUI';
import { getLucidPalette } from '@/constants/lucidTheme';
import { useLucidTrainer } from '@/context/LucidTrainerContext';
import { useTheme } from '@/context/ThemeContext';
import { isGoogleSignInAvailable } from '@/lib/auth';
import { closeLucidRoute } from '@/lib/lucid/routes';

const COPY = {
  en: {
    eyebrow: 'Shared account',
    title: 'Your Noctalia account',
    subtitle:
      'Sign in only if you want account sync or shared Noctalia Plus recognition. Local training never requires an account.',
    importTitle: 'Training found on this device',
    importBody: 'Import this device’s guest training into the connected account? This may belong to another person on a shared device.',
    importAction: 'Review guest import',
    importConfirm: 'Merge guest training with this account?',
    importDetail: 'The guest copy is removed from this device only after the merge succeeds. Canceling or an error keeps it separate.',
    importSuccess: 'Guest training imported',
    importError: 'Import failed. The guest training remains separate on this device.',
  },
  fr: {
    eyebrow: 'Compte partagé',
    title: 'Votre compte Noctalia',
    subtitle:
      'Connectez-vous seulement pour la synchronisation ou la reconnaissance de Noctalia Plus. L’entraînement local ne nécessite jamais de compte.',
    importTitle: 'Entraînement trouvé sur cet appareil',
    importBody: 'Importer l’entraînement invité de cet appareil dans le compte connecté ? Sur un appareil partagé, il peut appartenir à une autre personne.',
    importAction: 'Vérifier l’import',
    importConfirm: 'Fusionner l’entraînement invité avec ce compte ?',
    importDetail: 'La copie invitée ne sera retirée de cet appareil qu’après une fusion réussie. Un refus ou une erreur la conserve séparément.',
    importSuccess: 'Entraînement invité importé',
    importError: 'Échec de l’import. L’entraînement invité reste séparé sur cet appareil.',
  },
  es: {
    eyebrow: 'Cuenta compartida',
    title: 'Tu cuenta Noctalia',
    subtitle:
      'Inicia sesión solo para sincronizar o reconocer Noctalia Plus. El entrenamiento local nunca requiere una cuenta.',
    importTitle: 'Entrenamiento encontrado en este dispositivo', importBody: '¿Importar los datos de invitado en la cuenta conectada? En un dispositivo compartido podrían pertenecer a otra persona.', importAction: 'Revisar importación', importConfirm: '¿Fusionar el entrenamiento invitado con esta cuenta?', importDetail: 'La copia invitada solo se elimina tras una fusión correcta. Cancelar o un error la conserva separada.', importSuccess: 'Entrenamiento importado', importError: 'Error de importación. Los datos invitados siguen separados.',
  },
  de: {
    eyebrow: 'Geteiltes Konto',
    title: 'Dein Noctalia-Konto',
    subtitle:
      'Melde dich nur für Synchronisierung oder Noctalia Plus an. Lokales Training erfordert kein Konto.',
    importTitle: 'Training auf diesem Gerät gefunden', importBody: 'Gasttraining in das verbundene Konto importieren? Auf einem geteilten Gerät kann es einer anderen Person gehören.', importAction: 'Import prüfen', importConfirm: 'Gasttraining mit diesem Konto zusammenführen?', importDetail: 'Die Gastkopie wird erst nach erfolgreicher Zusammenführung entfernt. Abbruch oder Fehler lassen sie getrennt.', importSuccess: 'Gasttraining importiert', importError: 'Import fehlgeschlagen. Das Gasttraining bleibt getrennt.',
  },
  it: {
    eyebrow: 'Account condiviso',
    title: 'Il tuo account Noctalia',
    subtitle:
      'Accedi solo per la sincronizzazione o il riconoscimento di Noctalia Plus. Il training locale non richiede un account.',
    importTitle: 'Training trovato su questo dispositivo', importBody: 'Importare il training ospite nell’account connesso? Su un dispositivo condiviso potrebbe appartenere a un’altra persona.', importAction: 'Verifica importazione', importConfirm: 'Unire il training ospite a questo account?', importDetail: 'La copia ospite viene rimossa solo dopo un’unione riuscita. Annullamento o errore la mantengono separata.', importSuccess: 'Training ospite importato', importError: 'Importazione non riuscita. Il training ospite resta separato.',
  },
} as const;

export default function LucidAccountScreen() {
  const { colors, mode } = useTheme();
  const palette = getLucidPalette(colors, mode);
  const { content, guestImportAvailable, importGuestData } = useLucidTrainer();
  const copy = COPY[content.locale];
  const [importing, setImporting] = useState(false);

  const confirmImport = () => Alert.alert(copy.importConfirm, copy.importDetail, [
    { text: content.chrome.common.cancel, style: 'cancel' },
    {
      text: copy.importAction,
      onPress: () => void (async () => {
        setImporting(true);
        try {
          await importGuestData();
          Alert.alert(copy.importSuccess);
        } catch {
          Alert.alert(content.chrome.common.error, copy.importError);
        } finally {
          setImporting(false);
        }
      })(),
    },
  ]);

  return (
    <LucidScreen
      testID="lucid-account"
      eyebrow={copy.eyebrow}
      title={copy.title}
      subtitle={copy.subtitle}
      trailing={
        <LucidIconAction
          label={content.chrome.common.back}
          icon="close"
          onPress={() => closeLucidRoute(router, '/lucid/(tabs)/settings')}
        />
      }
    >
      <EmailAuthCard
        presentation="embedded"
        returnTo="/lucid/(tabs)/settings"
        showGoogleSignIn={isGoogleSignInAvailable()}
      />
      {guestImportAvailable ? (
        <LucidCard>
          <Text style={[styles.importTitle, { color: palette.text }]}>{copy.importTitle}</Text>
          <Text style={[styles.importBody, { color: palette.textSecondary }]}>{copy.importBody}</Text>
          <LucidButton
            label={copy.importAction}
            variant="secondary"
            icon="download-outline"
            loading={importing}
            onPress={confirmImport}
            testID="lucid-import-guest"
          />
        </LucidCard>
      ) : null}
    </LucidScreen>
  );
}

const styles = StyleSheet.create({
  importTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16 },
  importBody: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, lineHeight: 19 },
});
