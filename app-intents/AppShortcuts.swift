import AppIntents

/// Siri phrases. Their translations live in `<language>.lproj/AppShortcuts.strings`;
/// every phrase must name the app.
struct AppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: NoteDreamIntent(),
      phrases: [
        "Note a dream in \(.applicationName)",
        "Tell \(.applicationName) my dream",
        "New dream in \(.applicationName)",
      ],
      shortTitle: "Note a dream",
      systemImageName: "moon.stars"
    )
  }
}
