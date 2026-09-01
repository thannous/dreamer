import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('journal dream detail visible order', () => {
  const source = readFileSync(join(__dirname, '../../app/journal/[id].tsx'), 'utf8');
  const mainReturn = source.slice(source.indexOf('<Reveal index={0}>'));

  const markerIndex = (haystack: string, marker: string) => {
    const index = haystack.indexOf(marker);
    expect(index).toBeGreaterThan(-1);
    return index;
  };

  it('renders title, original transcript, analysis state, compact illustration, then symbols and secondary actions', () => {
    const titleAndDate = markerIndex(mainReturn, '{!isEditing && renderMetadataCard()}');
    const originalTranscript = markerIndex(mainReturn, '{renderTranscriptBody()}');
    const recallOffer = markerIndex(mainReturn, '<DreamRecallAssistantCard');
    const analysisState = markerIndex(mainReturn, "renderDetailActionCard(['analyze'])");
    const analysisResult = markerIndex(mainReturn, "t('journal.detail.zone.reading')");
    const interpretation = markerIndex(mainReturn, "t('journal.detail.interpretation_header')");
    const illustration = markerIndex(mainReturn, '{renderIllustrationSection()}');
    const symbols = markerIndex(mainReturn, "t('journal.detail.symbols_header')");
    const emotions = markerIndex(mainReturn, "t('journal.detail.emotions_header')");
    const reflection = markerIndex(mainReturn, "t('journal.detail.zone.reflection')");
    const questions = markerIndex(mainReturn, "t('journal.detail.reflection_header')");
    const secondaryActions = markerIndex(mainReturn, "t('journal.detail.zone.actions')");

    expect(titleAndDate).toBeLessThan(originalTranscript);
    expect(originalTranscript).toBeLessThan(recallOffer);
    expect(recallOffer).toBeLessThan(analysisState);
    expect(analysisState).toBeLessThan(analysisResult);
    expect(analysisResult).toBeLessThan(interpretation);
    expect(interpretation).toBeLessThan(illustration);
    expect(illustration).toBeLessThan(symbols);
    expect(symbols).toBeLessThan(emotions);
    expect(emotions).toBeLessThan(reflection);
    expect(reflection).toBeLessThan(questions);
    expect(questions).toBeLessThan(secondaryActions);
  });

  it('keeps a single Analyse Noctalia header, independent image, optional recall, and one progressive CTA family', () => {
    expect(source).toContain("t('journal.detail.zone.dream')");
    expect(source).toContain("t('journal.detail.zone.reading')");
    expect(source).toContain("t('journal.detail.zone.reflection')");
    expect(mainReturn.split("t('journal.detail.zone.reading')")).toHaveLength(2);
    expect(mainReturn.split("t('journal.detail.zone.reflection')")).toHaveLength(2);
    expect(mainReturn.split('{renderIllustrationSection()}')).toHaveLength(2);
    expect(mainReturn.split("renderDetailActionCard(['analyze'])")).toHaveLength(2);
    expect(mainReturn.split("renderDetailActionCard(['explore', 'continue'])")).toHaveLength(2);
    expect(mainReturn).not.toContain('{renderDetailActionCard()}');
    expect(mainReturn).toContain('<DreamRecallAssistantCard');
    expect(source).toContain('TID.Component.JournalIllustration');
    expect(source).toContain('TID.Modal.JournalIllustrationFullscreen');
    expect(source).toContain('TID.Component.AnalysisStaleBanner');
  });
});
