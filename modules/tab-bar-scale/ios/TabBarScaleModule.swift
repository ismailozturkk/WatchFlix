import ExpoModulesCore
import UIKit

// Seelogd — yerel sekme çubuğunu kaydırmayla küçülten köprü (iOS).
//
// react-native-screens'in Tabs.Host'u gerçek bir UITabBarController çiziyor ve
// ona ölçek vermiyor (yalnız `tabBarMinimizeBehavior`). Kaydırınca çubuk %20
// küçülür, sekme adları solar ve simgeler adların boşalttığı yere doğru iner.
//
// SÖZLEŞME (JS: services/tabBarScale.js):
//   isSupported()                     → iOS 26+ mı?
//   setProgress(progress, minScale)   → progress 0 (tam boyut) … 1 (minScale, adlar yok)
//   reset()                           → tam boyut, adlar görünür
//
// NEDEN YALNIZ iOS 26+: orada çubuk yüzen bir kapsül; ölçeklemek kapsülü
// merkezine doğru küçültür. iOS 18–25'te çubuk kenardan kenara bir şerit —
// ölçeklenirse yanlarda boşluk kalır, bu yüzden orada dokunmuyoruz.
//
// NEDEN `transform` DEĞİL `sublayerTransform`: UIKit çubuğun `frame`ini kendisi
// ayarlıyor. `transform` kimlik değilken yazılan frame, `bounds`u 1/ölçek kadar
// büyütür: çubuk tam genişlikte kalıp yalnız boyu kısalır, yani yatayda uzamış
// görünür (cihazda görülen hata). `sublayerTransform` görünümün geometrisine
// dokunmadan yalnız içeriği çizer; UIKit'in yerleşimiyle çakışmaz.
//
// DOKUNMA ALANI: `sublayerTransform` isabet testini değiştirmez, alanlar tam
// boyutta kalır. Her görünüm kendi merkezinde küçüldüğü (yatay öteleme yok) için
// %20'de bir öğenin görünen yeri yine kendi alanının içindedir.
//
// YAPAY ZEKA DÜĞMESİ: `systemItem: search` sekmesi iOS 26'da ayrık çizilir ve
// çubuğun içinde durmayabilir; çubuğun alt kenardaki kısa kardeş görünümleri de
// aynı şekilde küçültülür (`scaleTargets`). Hiyerarşi özeldir, sınıf adına değil
// konuma bakılır.
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

  // Adlar ilerlemenin bu oranında tamamen solar: küçülme bitmeden kaybolmuş olurlar.
  private static let labelFadeSpeed: CGFloat = 1.6
  // Kardeş görünüm bu kadar kısa ve alt kenara bu kadar yakınsa çubuğun parçasıdır.
  private static let siblingMaxHeight: CGFloat = 140
  private static let siblingBottomReach: CGFloat = 120

  // Zayıf tutulur: sekme denetleyicisi yeniden kurulursa eski çubuk tutulmaz.
  private weak var tabBar: UITabBar?
  private let scaledViews = NSHashTable<UIView>.weakObjects()
  // Ad soldurulmadan önceki opaklık: UIKit'in kendi gizlediği bir ad geri açılmasın.
  private let labelAlphas = NSMapTable<UILabel, NSNumber>.weakToStrongObjects()

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
    let targets = scaleTargets(for: bar)
    let scale = 1 - progress * (1 - minScale)

    CATransaction.begin()
    CATransaction.setDisableActions(true)
    for view in scaledViews.allObjects where progress <= 0 || !targets.contains(view) {
      view.layer.sublayerTransform = CATransform3DIdentity
      scaledViews.remove(view)
    }
    for view in targets {
      if progress > 0 {
        // Kendi merkezinde küçülür, alt kenarı yerinde kalır (havada asılı durmaz).
        let lift = (1 - scale) * view.bounds.height / 2
        view.layer.sublayerTransform = CATransform3DScale(
          CATransform3DMakeTranslation(0, lift, 0), scale, scale, 1
        )
        scaledViews.add(view)
      }
      updateItems(in: view, progress: progress)
    }
    if progress <= 0 {
      labelAlphas.removeAllObjects()
    }
    CATransaction.commit()
  }

  // ── Küçültülecek görünümler ───────────────────────────────────────────────

  private func scaleTargets(for bar: UITabBar) -> [UIView] {
    guard let container = bar.superview else { return [bar] }
    let siblings = container.subviews.filter { view in
      guard view !== bar, !view.isHidden, view.bounds.width > 0 else { return false }
      return view.frame.height <= TabBarScaler.siblingMaxHeight
        && view.frame.maxY >= container.bounds.maxY - TabBarScaler.siblingBottomReach
    }
    return [bar] + siblings
  }

  // ── Sekme adları ve simgeler ──────────────────────────────────────────────

  // Ad solarken simge, ad+simge bloğunun ortasına kayar; ad geri gelirken aynı
  // oranda eski yerine döner. Kayma adın sönme oranına bağlı (`hidden`): ad
  // tamamen gittiği anda simge tam ortadadır.
  //
  // Önceki sürüm simgeyi "adın yarı boyu" kadar indiriyordu: ad–simge arasındaki
  // boşluğu saymadığı için simge ortanın biraz üstünde kalıyordu; iOS 26'da ad ile
  // simge ayrı kapsayıcılardaysa hiç kaymıyordu. Şimdi her ad için simgeyi de
  // içeren en yakın ata (sekme öğesi) bulunur ve kayma gerçek konumlardan
  // hesaplanır: (adın alt kenarı − simgenin alt kenarı) / 2.
  private func updateItems(in root: UIView, progress: CGFloat) {
    let visibility = max(0, 1 - progress * TabBarScaler.labelFadeSpeed)
    let hidden = 1 - visibility
    var itemOrder: [UIView] = []
    var itemLabels: [ObjectIdentifier: [UILabel]] = [:]

    for label in labels(in: root) {
      if labelAlphas.object(forKey: label) == nil {
        labelAlphas.setObject(NSNumber(value: Double(label.alpha)), forKey: label)
      }
      let original = CGFloat(labelAlphas.object(forKey: label)?.doubleValue ?? 1)
      label.alpha = original * visibility
      // UIKit'in zaten gizlediği ad yerleşime katılmaz.
      guard original > 0, !label.isHidden, label.bounds.height > 0,
            let item = itemView(for: label, within: root) else { continue }
      let key = ObjectIdentifier(item)
      if itemLabels[key] == nil {
        itemLabels[key] = []
        itemOrder.append(item)
      }
      itemLabels[key]?.append(label)
    }

    for item in itemOrder {
      settleIcons(in: item, labels: itemLabels[ObjectIdentifier(item)] ?? [], hidden: hidden)
    }
  }

  private func settleIcons(in item: UIView, labels: [UILabel], hidden: CGFloat) {
    let labelFrames = labels.compactMap { layoutFrame(of: $0, in: item) }
    guard let labelTop = labelFrames.map({ $0.minY }).min(),
          let labelBottom = labelFrames.map({ $0.maxY }).max() else { return }
    // Yalnız adın ÜSTÜNDEKİ görseller simgedir; adı da kaplayan bir zemin/seçim
    // görseli kaydırılmaz.
    let icons = imageViews(in: item).compactMap { image -> (UIImageView, CGRect)? in
      guard let frame = layoutFrame(of: image, in: item), frame.maxY <= labelTop + 2 else {
        return nil
      }
      return (image, frame)
    }
    guard let iconBottom = icons.map({ $0.1.maxY }).max() else { return }

    // Güvenlik sınırı: beklenmedik bir yerleşimde simge çubuktan taşmasın.
    let maxDrop = labelBottom - labelTop + 12
    let fullDrop = min(max(0, (labelBottom - iconBottom) / 2), maxDrop)
    let drop = fullDrop * hidden
    for (image, _) in icons {
      image.transform = drop > 0.01 ? CGAffineTransform(translationX: 0, y: drop) : .identity
    }
  }

  // Adın sekme öğesi: adın atalarından, içinde görsel bulunan ilki.
  private func itemView(for label: UILabel, within root: UIView) -> UIView? {
    var candidate = label.superview
    while let view = candidate {
      if !imageViews(in: view).isEmpty { return view }
      if view === root { return nil }
      candidate = view.superview
    }
    return nil
  }

  // Görünümün `ancestor` içindeki yerleşim çerçevesi; dönüşümler (bizim simgeye
  // verdiğimiz kayma dahil) hesaba katılmaz — `frame` dönüşüm varken tanımsızdır,
  // `center` + `bounds` değildir. Böylece kayma her çağrıda aynı tabandan ölçülür.
  private func layoutFrame(of view: UIView, in ancestor: UIView) -> CGRect? {
    let size = view.bounds.size
    var origin = CGPoint(
      x: view.center.x - size.width * view.layer.anchorPoint.x,
      y: view.center.y - size.height * view.layer.anchorPoint.y
    )
    var parent = view.superview
    while let p = parent, p !== ancestor {
      origin.x += p.center.x - p.bounds.width * p.layer.anchorPoint.x - p.bounds.origin.x
      origin.y += p.center.y - p.bounds.height * p.layer.anchorPoint.y - p.bounds.origin.y
      parent = p.superview
    }
    guard parent === ancestor else { return nil }
    return CGRect(origin: origin, size: size)
  }

  private func labels(in view: UIView) -> [UILabel] {
    return view.subviews.flatMap { child -> [UILabel] in
      if let label = child as? UILabel { return [label] }
      return labels(in: child)
    }
  }

  private func imageViews(in view: UIView) -> [UIImageView] {
    return view.subviews.flatMap { child -> [UIImageView] in
      if let image = child as? UIImageView { return [image] }
      return imageViews(in: child)
    }
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
