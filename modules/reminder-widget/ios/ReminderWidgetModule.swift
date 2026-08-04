import ExpoModulesCore
import WidgetKit

// Seelogd — iOS köprüsü. ÜÇ ana ekran widget'ının verisini de paylaşılan App
// Group'a yazar ve WidgetKit zaman çizelgelerini yeniler.
//
// Android'de her widget'ın AYRI bir köprü modülü var (ReminderWidgetModule /
// ListsWidgetModule / StatsWidgetModule); iOS'ta tek uzantı hedefi ve tek
// App Group olduğu için hepsi bu modülde toplanır. JS tarafı farkı
// services/widgetBridge.js içinde soğurur.
//
// Sözleşmeler:
//   updateReminders(payload, language) / clearReminders()
//   updateLists(payload, language)     / clearLists()
//   updateStats(payload, language)     / clearStats()
public class ReminderWidgetModule: Module {
  private let appGroupId = "group.com.smlztrk.seelogd"
  private let itemsKey = "items"
  private let listsKey = "lists"
  private let statsKey = "stats"
  private let languageKey = "language"
  private let preferencesKey = "preferences"

  private func write(_ payload: String?, forKey key: String, language: String?) {
    let defaults = UserDefaults(suiteName: appGroupId)
    if let payload = payload {
      defaults?.set(payload, forKey: key)
    } else {
      defaults?.removeObject(forKey: key)
    }
    if let language = language {
      defaults?.set(language, forKey: languageKey)
    }
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  public func definition() -> ModuleDefinition {
    Name("ReminderWidget")

    AsyncFunction("updateReminders") { (payload: String, language: String) in
      self.write(payload, forKey: self.itemsKey, language: language)
    }

    AsyncFunction("clearReminders") {
      self.write(nil, forKey: self.itemsKey, language: nil)
    }

    AsyncFunction("updateLists") { (payload: String, language: String) in
      self.write(payload, forKey: self.listsKey, language: language)
    }

    AsyncFunction("clearLists") {
      self.write(nil, forKey: self.listsKey, language: nil)
    }

    AsyncFunction("updateStats") { (payload: String, language: String) in
      self.write(payload, forKey: self.statsKey, language: language)
    }

    AsyncFunction("clearStats") {
      self.write(nil, forKey: self.statsKey, language: nil)
    }

    AsyncFunction("updatePreferences") { (payload: String) in
      self.write(payload, forKey: self.preferencesKey, language: nil)
    }
  }
}
