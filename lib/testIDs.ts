export const TID = {
  Screen: {
    Recording: 'screen.recording',
    Journal: 'screen.journal',
  },
  Input: {
    SearchDreams: 'input.searchDreams',
    DreamTranscript: 'input.dreamTranscript',
    AuthEmail: 'input.auth.email',
    AuthPassword: 'input.auth.password',
  },
  Button: {
    AddDream: 'btn.addDream',
    RecordToggle: 'btn.recordToggle',
    SaveDream: 'btn.saveDream',
    NavigateJournal: 'btn.navigateJournal',
    NavigateSettings: 'btn.navigateSettings',
    FilterTheme: 'btn.filterTheme',
    FilterDate: 'btn.filterDate',
    ClearFilters: 'btn.clearFilters',
    MockProfile: (profile: string) => `btn.mockProfile.${profile}`,
    ExploreDream: 'btn.exploreDream',
    DreamCategory: (id: string) => `btn.dreamCategory.${id}`,
    AuthSignIn: 'btn.auth.signIn',
    AuthSignUp: 'btn.auth.signUp',
    AuthSignOut: 'btn.auth.signOut',
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
    AnalysisLimitBanner: 'text.analysisLimit',
    ChatLimitBanner: 'text.chat.limit',
  },
  Chat: {
    Input: 'chat.input.message',
    Send: 'chat.button.send',
    ScreenBlocked: 'chat.screen.blocked',
  },
} as const;

export type TestIDs = typeof TID;
