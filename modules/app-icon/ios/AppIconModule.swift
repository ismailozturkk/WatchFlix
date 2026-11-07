import ExpoModulesCore
import UIKit

// Seelogd — uygulama simgesi değiştirme köprüsü (iOS).
//
// Sözleşme Android modülüyle aynı: "Default" adı birincil simgedir
// (`setAlternateIconName(nil)`), diğer adlar plugin'in ürettiği
// `<Ad>.appiconset` kümeleridir (plugins/withAlternateAppIcons.js).
// `names` JS kataloğundaki tüm adlardır (utils/appIcons.js); iOS'ta yalnız
// doğrulama için kullanılır.
//
// UIApplication yalnız ana iş parçacığında kullanılabilir; bu yüzden hepsi
// Promise ile ana kuyruğa alınıyor. Simge değişince iOS kendi sistem uyarısını
// ("Simgeyi değiştirdiniz") gösterir — bu normal, bastırılamaz.
public class AppIconModule: Module {
  private let defaultName = "Default"

  public func definition() -> ModuleDefinition {
    Name("SeelogdAppIcon")

    AsyncFunction("isSupportedAsync") { (promise: Promise) in
      DispatchQueue.main.async {
        promise.resolve(UIApplication.shared.supportsAlternateIcons)
      }
    }

    // `names` içinden bu yapıda appiconset'i OLANLAR (derlenmiş Info.plist'teki
    // CFBundleAlternateIcons + Default). Katalog binary'den önce büyüyebilir; JS yalnız
    // bunları seçtirir. Liste okunamazsa hepsi döner: iOS'ta olmayan simge yalnız kendi
    // seçimini reddeder (Android'deki gibi tüm değişimi düşürmez).
    AsyncFunction("getAvailableNamesAsync") { (names: [String]) -> [String] in
      var alternates = Set<String>()
      for key in ["CFBundleIcons", "CFBundleIcons~ipad"] {
        let icons = Bundle.main.object(forInfoDictionaryKey: key) as? [String: Any]
        if let found = icons?["CFBundleAlternateIcons"] as? [String: Any] {
          alternates.formUnion(found.keys)
        }
      }
      if alternates.isEmpty { return names }
      return names.filter { $0 == self.defaultName || alternates.contains($0) }
    }

    AsyncFunction("getAppIconNameAsync") { (names: [String], promise: Promise) in
      DispatchQueue.main.async {
        promise.resolve(UIApplication.shared.alternateIconName ?? self.defaultName)
      }
    }

    AsyncFunction("setAppIconNameAsync") { (name: String, names: [String], promise: Promise) in
      DispatchQueue.main.async {
        guard names.contains(name) else {
          promise.reject("ERR_APP_ICON_UNKNOWN", "Bilinmeyen simge: \(name)")
          return
        }
        guard UIApplication.shared.supportsAlternateIcons else {
          promise.reject("ERR_APP_ICON_UNSUPPORTED", "Bu cihaz alternatif simgeleri desteklemiyor.")
          return
        }
        let target: String? = (name == self.defaultName) ? nil : name
        UIApplication.shared.setAlternateIconName(target) { error in
          if let error = error {
            promise.reject("ERR_APP_ICON_CHANGE", error.localizedDescription)
          } else {
            promise.resolve(name)
          }
        }
      }
    }
  }
}
