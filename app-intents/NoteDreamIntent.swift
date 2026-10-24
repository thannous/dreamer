import AppIntents
internal import ExpoAppIntents

/// « Noter un rêve » from Siri or Shortcuts, without opening the app.
///
/// The words wait in the native queue until the journal's JavaScript picks them
/// up (`hooks/useSiriDreamCapture.ts`), right away when the app is running and
/// otherwise at its next launch. The dialog only says the dream is kept, not that
/// it is already in the journal.
struct NoteDreamIntent: AppIntent {
  static let title: LocalizedStringResource = "Note a dream"
  static let description = IntentDescription("Dictate a dream and keep it in your Noctalia journal.")
  static let openAppWhenRun: Bool = false

  @Parameter(
    title: "Dream",
    inputOptions: String.IntentInputOptions(multiline: true),
    requestValueDialog: IntentDialog("What did you dream?")
  )
  var text: String

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    let dream = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !dream.isEmpty else {
      throw $text.needsValueError("What did you dream?")
    }
    await AppIntentDispatcher.shared.dispatch(
      name: "noteDream",
      params: ["text": .string(dream)]
    )
    return .result(dialog: "Noted. Your dream is waiting in Noctalia.")
  }
}
