import type { DreamGuideLanguage, PracticalDreamGuideId } from '@/lib/dreamGuideTypes';
import type { GuideReadingStatus } from '@/lib/guideReading';

type ReadingCopy = {
  status: Record<GuideReadingStatus, string>; progress: (count: number) => string;
  resume: string; complete: string; completed: string; optional: string; retry: string; pending: string;
  /** After a completion: the next guide still to finish, or the way back once all eight are. */
  next: string; allDone: string; backToGuides: string;
  exercise: Record<PracticalDreamGuideId, { body: string; action: string }>;
};
const copy: Record<DreamGuideLanguage, ReadingCopy> = {
  en: {
    status: { new: 'Not opened', visited: 'Visited', inProgress: 'In progress', completed: 'Completed' },
    progress: count => `${count} of 8 guides completed`, resume: 'Resume reading', complete: 'Mark as completed', completed: 'You marked this guide as completed.', optional: 'Try it, if you like',
    next: 'Next guide', allDone: 'All 8 guides completed.', backToGuides: 'Back to guides',
    retry: 'Retry saving', pending: 'Progress is waiting to be saved. Keep this device until saving succeeds.',
    exercise: {
      'understand-dreams': { body: 'Choose a dream in your journal. Notice one image and ask what it brings to mind for you. There is no single correct interpretation.', action: 'Revisit a dream' },
      'remember-dreams': { body: 'If you like, prepare a gentle recall ritual for your next waking. A fragment is enough; there is nothing to make up or force.', action: 'Open the recall ritual' },
      'dream-journal': { body: 'Record a fragment you remember: a place, an image or a feeling. A few words are enough, and you can leave details for later.', action: 'Write a fragment' },
      'lucid-dreaming': { body: 'Explore the daytime awareness ritual if you are curious. Keep your usual sleep rhythm; skip any practice that feels tiring or uncomfortable.', action: 'Explore the lucid ritual' },
    },
  },
  fr: {
    status: { new: 'À découvrir', visited: 'Consulté', inProgress: 'En cours', completed: 'Terminé' },
    progress: count => count > 1 ? `${count} guides terminés sur 8` : `${count} guide terminé sur 8`, resume: 'Reprendre la lecture', complete: 'Marquer comme terminé', completed: 'Tu as marqué ce guide comme terminé.', optional: 'À essayer, si tu le souhaites',
    next: 'Guide suivant', allDone: 'Les 8 guides sont terminés.', backToGuides: 'Revenir aux guides',
    retry: 'Réessayer la sauvegarde', pending: 'La progression attend sa sauvegarde. Garde cet appareil jusqu’à sa réussite.',
    exercise: {
      'understand-dreams': { body: 'Choisis un rêve dans ton journal. Repère une image et demande-toi ce qu’elle évoque pour toi. Il n’y a pas une seule bonne interprétation.', action: 'Relire un rêve' },
      'remember-dreams': { body: 'Si tu le souhaites, prépare un rituel de rappel doux pour ton prochain réveil. Un fragment suffit ; rien à inventer ni à forcer.', action: 'Ouvrir le rituel de rappel' },
      'dream-journal': { body: 'Note un fragment dont tu te souviens : un lieu, une image ou une sensation. Quelques mots suffisent, les détails peuvent attendre.', action: 'Écrire un fragment' },
      'lucid-dreaming': { body: 'Explore le rituel d’attention en journée si tu es curieux. Garde ton rythme de sommeil habituel ; laisse de côté toute pratique fatigante ou inconfortable.', action: 'Explorer le rituel lucide' },
    },
  },
  es: {
    status: { new: 'Por descubrir', visited: 'Consultada', inProgress: 'En curso', completed: 'Terminada' },
    progress: count => `${count} de 8 guías terminadas`, resume: 'Continuar la lectura', complete: 'Marcar como terminada', completed: 'Has marcado esta guía como terminada.', optional: 'Para probar, si te apetece',
    next: 'Siguiente guía', allDone: 'Las 8 guías están terminadas.', backToGuides: 'Volver a las guías',
    retry: 'Volver a guardar', pending: 'El progreso está pendiente de guardarse. Conserva este dispositivo hasta que se guarde.',
    exercise: {
      'understand-dreams': { body: 'Elige un sueño del diario. Fíjate en una imagen y pregúntate qué te evoca. No hay una única interpretación correcta.', action: 'Releer un sueño' },
      'remember-dreams': { body: 'Si te apetece, prepara un ritual suave de recuerdo para tu próximo despertar. Basta un fragmento; no hace falta inventar ni forzar nada.', action: 'Abrir el ritual de recuerdo' },
      'dream-journal': { body: 'Anota un fragmento que recuerdes: un lugar, una imagen o una sensación. Bastan unas palabras; los detalles pueden esperar.', action: 'Escribir un fragmento' },
      'lucid-dreaming': { body: 'Explora el ritual de atención durante el día si tienes curiosidad. Mantén tu ritmo de sueño habitual y deja cualquier práctica que te canse o incomode.', action: 'Explorar el ritual lúcido' },
    },
  },
  de: {
    status: { new: 'Noch nicht geöffnet', visited: 'Angesehen', inProgress: 'In Bearbeitung', completed: 'Abgeschlossen' },
    progress: count => `${count} von 8 Ratgebern abgeschlossen`, resume: 'Weiterlesen', complete: 'Als abgeschlossen markieren', completed: 'Sie haben diesen Ratgeber als abgeschlossen markiert.', optional: 'Zum Ausprobieren, wenn Sie möchten',
    next: 'Nächster Ratgeber', allDone: 'Alle 8 Ratgeber abgeschlossen.', backToGuides: 'Zurück zu den Ratgebern',
    retry: 'Speichern erneut versuchen', pending: 'Der Fortschritt wartet auf das Speichern. Behalten Sie dieses Gerät, bis das Speichern gelingt.',
    exercise: {
      'understand-dreams': { body: 'Wählen Sie einen Traum im Tagebuch. Achten Sie auf ein Bild und fragen Sie sich, was es für Sie bedeutet. Es gibt nicht nur eine richtige Deutung.', action: 'Einen Traum erneut lesen' },
      'remember-dreams': { body: 'Bereiten Sie auf Wunsch ein sanftes Erinnerungsritual für Ihr nächstes Erwachen vor. Ein Fragment reicht; nichts muss erfunden oder erzwungen werden.', action: 'Erinnerungsritual öffnen' },
      'dream-journal': { body: 'Notieren Sie ein Fragment: einen Ort, ein Bild oder ein Gefühl. Ein paar Worte reichen; Einzelheiten können warten.', action: 'Ein Fragment aufschreiben' },
      'lucid-dreaming': { body: 'Entdecken Sie bei Interesse das Achtsamkeitsritual für den Tag. Behalten Sie Ihren Schlafrhythmus bei und lassen Sie ermüdende oder unangenehme Übungen aus.', action: 'Klartraumritual entdecken' },
    },
  },
  it: {
    status: { new: 'Da scoprire', visited: 'Consultata', inProgress: 'In corso', completed: 'Completata' },
    progress: count => count === 1 ? '1 guida completata su 8' : `${count} guide completate su 8`, resume: 'Riprendi la lettura', complete: 'Segna come completata', completed: 'Hai segnato questa guida come completata.', optional: 'Da provare, se ti va',
    next: 'Guida successiva', allDone: 'Tutte le 8 guide sono completate.', backToGuides: 'Torna alle guide',
    retry: 'Riprova a salvare', pending: 'I progressi sono in attesa di essere salvati. Conserva questo dispositivo finché il salvataggio non riesce.',
    exercise: {
      'understand-dreams': { body: 'Scegli un sogno nel diario. Nota un’immagine e chiediti che cosa ti evoca. Non esiste un’unica interpretazione corretta.', action: 'Rileggere un sogno' },
      'remember-dreams': { body: 'Se ti va, prepara un rituale delicato per ricordare al prossimo risveglio. Basta un frammento; non devi inventare o forzare nulla.', action: 'Apri il rituale del ricordo' },
      'dream-journal': { body: 'Annota un frammento che ricordi: un luogo, un’immagine o una sensazione. Bastano poche parole; i dettagli possono aspettare.', action: 'Scrivi un frammento' },
      'lucid-dreaming': { body: 'Esplora il rituale di attenzione diurna se ti incuriosisce. Mantieni il tuo ritmo di sonno e tralascia le pratiche stancanti o scomode.', action: 'Esplora il rituale lucido' },
    },
  },
  pt: {
    status: { new: 'Por descobrir', visited: 'Consultado', inProgress: 'Em andamento', completed: 'Concluído' },
    progress: count => `${count} de 8 guias concluídos`, resume: 'Retomar a leitura', complete: 'Marcar como concluído', completed: 'Você marcou este guia como concluído.', optional: 'Para experimentar, se quiser',
    next: 'Próximo guia', allDone: 'Os 8 guias estão concluídos.', backToGuides: 'Voltar aos guias',
    retry: 'Tentar salvar novamente', pending: 'O progresso está aguardando para ser salvo. Mantenha este dispositivo até que seja salvo.',
    exercise: {
      'understand-dreams': { body: 'Escolha um sonho no diário. Observe uma imagem e pergunte o que ela evoca para você. Não existe uma única interpretação correta.', action: 'Reler um sonho' },
      'remember-dreams': { body: 'Se quiser, prepare um ritual suave de lembrança para o próximo despertar. Um fragmento basta; não é preciso inventar nem forçar nada.', action: 'Abrir o ritual de lembrança' },
      'dream-journal': { body: 'Anote um fragmento de que se lembra: um lugar, uma imagem ou uma sensação. Algumas palavras bastam; os detalhes podem esperar.', action: 'Escrever um fragmento' },
      'lucid-dreaming': { body: 'Explore o ritual de atenção durante o dia se tiver curiosidade. Mantenha seu ritmo de sono e deixe de lado práticas cansativas ou desconfortáveis.', action: 'Explorar o ritual lúcido' },
    },
  },
};
export const getGuideReadingCopy = (language: DreamGuideLanguage) => copy[language] ?? copy.en;
