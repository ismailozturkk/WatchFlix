// Seelogd — widget uzantısının üç widget'ı arasında PAYLAŞILAN parçalar.
//
// Swift'te dosya seviyesindeki `private` fiilen `fileprivate`'tir; App Group
// kimliği ve marka renkleri index.swift içinde private kaldığı sürece diğer
// widget dosyalarından görünmez. Bu yüzden ortak semboller burada `internal`
// (varsayılan) olarak tanımlanır.

import SwiftUI

// Üç yerde de birebir aynı olmalı: app.json entitlements,
// targets/reminder-widget/expo-target.config.js, ReminderWidgetModule.swift.
let appGroupId = "group.com.smlztrk.seelogd"
let languageKey = "language"

func loadLanguage() -> String {
  UserDefaults(suiteName: appGroupId)?.string(forKey: languageKey) ?? "tr"
}

func isTurkishLanguage() -> Bool {
  loadLanguage().hasPrefix("tr")
}

// MARK: - Marka renkleri

extension Color {
  static let wxBackground = Color(red: 0.043, green: 0.055, blue: 0.086) // #0B0E16
  static let wxAccent = Color(red: 0.424, green: 0.388, blue: 1.0)       // #6C63FF
  static let wxMovie = Color(red: 0.898, green: 0.357, blue: 0.133)      // #E55B22
  static let wxTitle = Color(red: 0.969, green: 0.969, blue: 0.988)      // #F7F7FC
  static let wxMeta = Color(red: 0.604, green: 0.639, blue: 0.722)       // #9AA3B8

  /// "#RRGGBB" → Color. Liste aksanları ve rank renkleri JS'ten hex olarak gelir.
  init?(hex: String) {
    var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if value.hasPrefix("#") { value.removeFirst() }
    guard value.count == 6, let rgb = UInt32(value, radix: 16) else { return nil }
    self.init(
      red: Double((rgb >> 16) & 0xFF) / 255.0,
      green: Double((rgb >> 8) & 0xFF) / 255.0,
      blue: Double(rgb & 0xFF) / 255.0
    )
  }
}

// MARK: - Arka plan uyumluluğu

// iOS 17+ containerBackground ister; daha eskiler düz background kullanır.
extension View {
  @ViewBuilder
  func widgetBackgroundCompat(_ color: Color) -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(for: .widget) { color }
    } else {
      background(color)
    }
  }
}
