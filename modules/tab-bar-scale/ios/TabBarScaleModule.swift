import ExpoModulesCore
import UIKit

// Seelogd — yerel sekme çubuğunu kaydırmayla ölçekleyen köprü (iOS).
//
// react-native-screens'in Tabs.Host'u gerçek bir UITabBarController çiziyor ve
// ona ölçek vermiyor (yalnız `tabBarMinimizeBehavior`). Görünümü hiç değiştirmeden
// çubuğu %20 küçültüp büyütmek için tabBar'ın `transform`u buradan sürülür.
//
// SÖZLEŞME (JS: services/tabBarScale.js):
//   isSupported()                     → iOS 26+ mı?
//   setProgress(progress, minScale)   → progress 0 (tam boyut) … 1 (minScale)
//   reset()                           → tam boyut
//
// NEDEN YALNIZ iOS 26+: orada çubuk yüzen bir kapsül; ölçeklemek kapsülü
// merkezine doğru küçültür. iOS 18–25'te çubuk kenardan kenara bir şerit —
// ölçeklenirse yanlarda boşluk kalır, bu yüzden orada dokunmuyoruz.
//
// DÖNÜŞÜM: ölçek merkezden uygulanır ve alt kenarı yukarı kaldırır; önce
// `(1 - scale) * height / 2` kadar aşağı itilir, yani çubuk kendi ALT kenarına
// doğru küçülür (home göstergesine yaklaşır, havada asılı kalmaz).
// `translated.scaledBy(...)`: önce ölçek, sonra öteleme (öteleme ölçeklenmez).
//
// BİLİNEN RİSK (cihazda doğrulanmadı): UIKit çubuğun `frame`ini kendisi
// ayarlıyor; `transform` kimlik değilken `frame` tanımsız sayılır. Bir yerleşim
// geçişi küçülmüşken olursa çubuk yanlış boyda kalabilir. Böyle bir şey görülürse
// JS tarafında utils/tabBarCollapse.js → TAB_BAR_NATIVE_SCALE_ENABLED = false
// (sistemin kendi minimize'ı geri gelir, yeni build gerekmez).
//
// UIKit yalnız ana iş parçacığında kullanılabilir; JS'ten gelen çağrılar
// ana kuyruğa alınır (FIFO: sıra korunur, reset hiçbir zaman öne geçmez).
public class TabBarScaleModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SeelogdTabBarScale")

    Function("isSupported") { () -> Bool in
      return TabBarScaler.isSupportedOS
    }

    Function("setProgress") { (progress: Double, minScale: Double) -> Void in
      TabBarScaler.shared.apply(progress: CGFloat(progress), minScale: CGFloat(minScale))
    }

    Function("reset") { () -> Void in
      TabBarScaler.shared.apply(progress: 0, minScale: 1)
    }
  }
}

final class TabBarScaler {
  static let shared = TabBarScaler()

  static var isSupportedOS: Bool {
    return ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26
  }

  // Zayıf tutulur: sekme denetleyicisi yeniden kurulursa eski çubuk tutulmaz.
  private weak var tabBar: UITabBar?

  func apply(progress: CGFloat, minScale: CGFloat) {
    guard TabBarScaler.isSupportedOS else { return }
    let p = max(0, min(1, progress))
    let floorScale = max(0.5, min(1, minScale))
    DispatchQueue.main.async { [weak self] in
      self?.applyOnMain(progress: p, minScale: floorScale)
    }
  }

  private func applyOnMain(progress: CGFloat, minScale: CGFloat) {
    guard let bar = resolveTabBar() else { return }
    if progress <= 0 {
      if !bar.transform.isIdentity {
        bar.transform = .identity
      }
      return
    }
    let scale = 1 - progress * (1 - minScale)
    let lift = (1 - scale) * bar.bounds.height / 2
    bar.transform = CGAffineTransform(translationX: 0, y: lift).scaledBy(x: scale, y: scale)
  }

  // ── Çubuğu bulma ──────────────────────────────────────────────────────────

  private func resolveTabBar() -> UITabBar? {
    if let bar = tabBar, bar.window != nil {
      return bar
    }
    guard let window = activeWindow() else { return nil }
    // Önce denetleyici ağacı (ucuz); bulunamazsa görünüm ağacı.
    var found: UITabBar? = findTabBarController(window.rootViewController)?.tabBar
    if found == nil {
      found = findTabBar(in: window)
    }
    tabBar = found
    return found
  }

  private func activeWindow() -> UIWindow? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first
    return scene?.windows.first(where: { $0.isKeyWindow }) ?? scene?.windows.first
  }

  private func findTabBarController(_ controller: UIViewController?) -> UITabBarController? {
    guard let controller = controller else { return nil }
    if let tabBarController = controller as? UITabBarController {
      return tabBarController
    }
    for child in controller.children {
      if let found = findTabBarController(child) {
        return found
      }
    }
    return findTabBarController(controller.presentedViewController)
  }

  private func findTabBar(in view: UIView) -> UITabBar? {
    if let bar = view as? UITabBar {
      return bar
    }
    for subview in view.subviews {
      if let found = findTabBar(in: subview) {
        return found
      }
    }
    return nil
  }
}
