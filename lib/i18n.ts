type Translations = { [key: string]: string };
type LanguagePack = { [lang: string]: Translations };

const translations: LanguagePack = {
  en: {
    'app.title': 'Dream Weaver',
    'button.record_dream': 'Record Your Dream',
    'button.view_journal': 'View My Journal',
    'edit.button.analyze': 'Analyze Dream',
    'loading.analyzing': 'Analyzing the dream...',
    'loading.painting': 'Painting a picture of your dream...',
    'analysis_error.title': 'Analysis Error',
    'journal.back_button': 'Back',
    'journal.menu.share': 'Share Quote',
    'journal.menu.delete': 'Delete Dream',
    'journal.original_transcript': 'Original Transcript',
  },
  fr: {
    'app.title': 'Journal de Rêves',
    'button.record_dream': 'Enregistrer un rêve',
    'button.view_journal': 'Voir mon journal',
    'edit.button.analyze': 'Analyser le rêve',
    'loading.analyzing': 'Analyse du rêve en cours...',
    'loading.painting': 'Création de l’image du rêve...',
    'analysis_error.title': "Erreur d'analyse",
    'journal.back_button': 'Retour',
    'journal.menu.share': 'Partager la citation',
    'journal.menu.delete': 'Supprimer le rêve',
    'journal.original_transcript': 'Transcription originale',
  },
  es: {
    'app.title': 'Diario de Sueños',
    'button.record_dream': 'Grabar un sueño',
    'button.view_journal': 'Ver mi diario',
    'edit.button.analyze': 'Analizar sueño',
    'loading.analyzing': 'Analizando el sueño...',
    'loading.painting': 'Creando la imagen del sueño...',
    'analysis_error.title': 'Error de análisis',
    'journal.back_button': 'Volver',
    'journal.menu.share': 'Compartir cita',
    'journal.menu.delete': 'Eliminar sueño',
    'journal.original_transcript': 'Transcripción original',
  },
};

export const getTranslator = (lang?: string) => {
  const language = translations[lang || 'en'] ? (lang as keyof typeof translations) : 'en';
  return (key: string, replacements?: { [k: string]: string | number }): string => {
    let s = translations[language][key] ?? key;
    if (replacements) {
      for (const k of Object.keys(replacements)) {
        s = s.replace(`{${k}}`, String(replacements[k]));
      }
    }
    return s;
  };
};

