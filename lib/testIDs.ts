export const TID = {
  Screen: {
    Recording: 'screen.recording',
    Journal: 'screen.journal',
  },
  Input: {
    SearchDreams: 'input.searchDreams',
    DreamTranscript: 'input.dreamTranscript',
  },
  Button: {
    AddDream: 'btn.addDream',
    RecordToggle: 'btn.recordToggle',
    SaveDream: 'btn.saveDream',
    NavigateJournal: 'btn.navigateJournal',
    FilterTheme: 'btn.filterTheme',
    FilterDate: 'btn.filterDate',
    ClearFilters: 'btn.clearFilters',
  },
  List: {
    Dreams: 'list.dreams',
    DreamItem: (id: number | string) => `dream.item.${id}`,
  },
  Modal: {
    Theme: 'modal.theme',
    DateRange: 'modal.dateRange',
  },
  Component: {
    SearchBar: 'component.searchBar',
  },
} as const;

export type TestIDs = typeof TID;
