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
    NavigateSettings: 'btn.navigateSettings',
    MockProfile: (profile: string) => `btn.mockProfile.${profile}`,
  },
  Tab: {
    Home: 'tab.home',
    Journal: 'tab.journal',
    Stats: 'tab.stats',
    Settings: 'tab.settings',
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
  Text: {
    AuthEmail: 'text.auth.email',
  },
} as const;

export type TestIDs = typeof TID;
