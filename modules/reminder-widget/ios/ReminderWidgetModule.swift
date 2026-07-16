import ExpoModulesCore
import WidgetKit

// Watchify — iOS köprüsü. Hatırlatıcı verisini paylaşılan App Group'a yazar ve
// WidgetKit zaman çizelgelerini yeniler. Android'deki ReminderWidgetModule.kt
// ile aynı sözleşme: updateReminders(payload, language) / clearReminders().
// JS tarafı bu modülü services/reminderWidgetService.js içinden
// requireOptionalNativeModule("ReminderWidget") ile çağırır.
public class ReminderWidgetModule: Module {
  private let appGroupId = "group.com.smlztrk.Watchify"
  private let itemsKey = "items"
  private let languageKey = "language"

  public func definition() -> ModuleDefinition {
    Name("ReminderWidget")

    AsyncFunction("updateReminders") { (payload: String, language: String) in
      let defaults = UserDefaults(suiteName: self.appGroupId)
      defaults?.set(payload, forKey: self.itemsKey)
      defaults?.set(language, forKey: self.languageKey)
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }

    AsyncFunction("clearReminders") {
      let defaults = UserDefaults(suiteName: self.appGroupId)
      defaults?.removeObject(forKey: self.itemsKey)
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
