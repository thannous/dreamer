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
    expect(originalTranscript).toBeLessThan(analysisState);
    expect(analysisState).toBeLessThan(recallOffer);
    expect(recallOffer).toBeLessThan(analysisResult);
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

  it('hides concurrent reflection CTAs when analysis is stale and shows quota before AI actions', () => {
    expect(source).toContain('isStalePrimaryAction');
    expect(source).toContain("isStalePrimaryAction ? null : renderDetailActionCard(['explore', 'continue'])");
    expect(source).toContain('getReflectionQuotaHint');
    expect(source).toContain('reflectionJourney.primary.consumesQuota');
    expect(source).toContain('TID.Text.DreamDetailQuotaHint');
    expect(source).toContain('TID.Button.AnalysisStaleCta');
    expect(mainReturn).not.toContain('onPress={handleStaleReanalyze}');
  });

  it('keeps delete as a 44 dp button rather than a link', () => {
    expect(source).toContain('testID={TID.Button.DreamDelete}');
    const deleteBlock = source.slice(
      source.indexOf('testID={TID.Button.DreamDelete}') - 280,
      source.indexOf('testID={TID.Button.DreamDelete}') + 220
    );
    expect(deleteBlock).toContain('accessibilityRole="button"');
    expect(deleteBlock).toContain('min-h-[44px]');
    expect(deleteBlock).toContain('min-w-[44px]');
    expect(deleteBlock).not.toContain('accessibilityRole="link"');
  });
});
