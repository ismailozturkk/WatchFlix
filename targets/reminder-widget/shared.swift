// Seelogd — widget uzantısının üç widget'ı arasında PAYLAŞILAN parçalar.
//
// Swift'te dosya seviyesindeki `private` fiilen `fileprivate`'tir; App Group
// kimliği ve marka renkleri index.swift içinde private kaldığı sürece diğer
// widget dosyalarından görünmez. Bu yüzden ortak semboller burada `internal`
// (varsayılan) olarak tanımlanır.

import Foundation
import SwiftUI

// Üç yerde de birebir aynı olmalı: app.json entitlements,
// targets/reminder-widget/expo-target.config.js, ReminderWidgetModule.swift.
let appGroupId = "group.com.smlztrk.seelogd"
let languageKey = "language"
let preferencesKey = "preferences"

func loadLanguage() -> String {
  UserDefaults(suiteName: appGroupId)?.string(forKey: languageKey) ?? "tr"
}

func isTurkishLanguage() -> Bool {
  loadLanguage().hasPrefix("tr")
}

struct WidgetAppearancePreferences {
  var themeId = "purple"
  var background = "#16131E"
  var surface = "#211C2E"
  var surfaceAlt = "#1B1726"
  var border = "#332C46"
  var text = "#F4F2F9"
  var secondaryText = "#CFC9DE"
  var muted = "#7E7694"
  var accent = "#8B5CF6"
  var bold = "#7C3AED"

  var backgroundColor: Color { Color(hex: background) ?? .wxBackground }
  var surfaceColor: Color { Color(hex: surface) ?? .wxSurface }
  var surfaceAltColor: Color { Color(hex: surfaceAlt) ?? .wxSurfaceAlt }
  var borderColor: Color { Color(hex: border) ?? .wxBorder }
  var textColor: Color { Color(hex: text) ?? .wxTitle }
  var secondaryTextColor: Color { Color(hex: secondaryText) ?? .wxMeta }
  var mutedColor: Color { Color(hex: muted) ?? .wxMeta }
  var accentColor: Color { Color(hex: accent) ?? .wxAccent }
  var boldColor: Color { Color(hex: bold) ?? .wxAccent }
}

struct WidgetDisplayPreferences {
  var reminderAppearance = WidgetAppearancePreferences()
  var reminderCompact = false
  var reminderShowTitle = true
  var reminderContent = "all"
  var reminderShowPosters = true
  var reminderShowDates = true
  var reminderMaxItems = 5
  var listsAppearance = WidgetAppearancePreferences()
  var listsCompact = false
  var listsShowTitle = true
  var listsShowCount = true
  var listsShowNavigation = true
  var listsMaxPosters = 12
  var statsAppearance = WidgetAppearancePreferences(
    themeId: "blue",
    background: "#141C33",
    surface: "#23324B",
    surfaceAlt: "#1B2440",
    border: "#2A3E63",
    text: "#EFF5FA",
    secondaryText: "#8BAFD0",
    muted: "#5F7694",
    accent: "#4C8DFF",
    bold: "#2D6BDF"
  )
  var statsCompact = false
  var statsShowTitle = false
  var statsShowMovies = true
  var statsShowTv = true
  var statsShowDuration = true
}

func loadWidgetPreferences() -> WidgetDisplayPreferences {
  guard
    let defaults = UserDefaults(suiteName: appGroupId),
    let raw = defaults.string(forKey: preferencesKey),
    let data = raw.data(using: .utf8),
    let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
  else { return WidgetDisplayPreferences() }

  let reminders = root["reminders"] as? [String: Any] ?? [:]
  let lists = root["lists"] as? [String: Any] ?? [:]
  let stats = root["stats"] as? [String: Any] ?? [:]
  var result = WidgetDisplayPreferences()
  result.reminderAppearance = parseWidgetAppearance(
    reminders["appearance"] as? [String: Any],
    fallback: result.reminderAppearance
  )
  result.reminderCompact =
    (reminders["density"] as? String ?? root["density"] as? String) == "compact"
  result.reminderShowTitle =
    reminders["showTitle"] as? Bool ?? root["showTitle"] as? Bool ?? result.reminderShowTitle
  result.reminderContent = reminders["content"] as? String ?? result.reminderContent
  result.reminderShowPosters = reminders["showPosters"] as? Bool ?? result.reminderShowPosters
  result.reminderShowDates = reminders["showDates"] as? Bool ?? result.reminderShowDates
  result.reminderMaxItems = (reminders["maxItems"] as? NSNumber)?.intValue ?? result.reminderMaxItems
  result.listsAppearance = parseWidgetAppearance(
    lists["appearance"] as? [String: Any],
    fallback: result.listsAppearance
  )
  result.listsCompact =
    (lists["density"] as? String ?? root["density"] as? String) == "compact"
  result.listsShowTitle =
    lists["showTitle"] as? Bool ?? root["showTitle"] as? Bool ?? result.listsShowTitle
  result.listsShowCount = lists["showCount"] as? Bool ?? result.listsShowCount
  result.listsShowNavigation = lists["showNavigation"] as? Bool ?? result.listsShowNavigation
  result.listsMaxPosters = (lists["maxPosters"] as? NSNumber)?.intValue ?? result.listsMaxPosters
  result.statsAppearance = parseWidgetAppearance(
    stats["appearance"] as? [String: Any],
    fallback: result.statsAppearance
  )
  result.statsCompact =
    (stats["density"] as? String ?? root["density"] as? String) == "compact"
  result.statsShowTitle =
    stats["showTitle"] as? Bool ?? root["showTitle"] as? Bool ?? result.statsShowTitle
  result.statsShowMovies = stats["showMovies"] as? Bool ?? result.statsShowMovies
  result.statsShowTv = stats["showTv"] as? Bool ?? result.statsShowTv
  result.statsShowDuration = stats["showDuration"] as? Bool ?? result.statsShowDuration
  return result
}

func parseWidgetAppearance(
  _ raw: [String: Any]?,
  fallback: WidgetAppearancePreferences
) -> WidgetAppearancePreferences {
  guard let raw else { return fallback }
  return WidgetAppearancePreferences(
    themeId: raw["themeId"] as? String ?? fallback.themeId,
    background: raw["background"] as? String ?? fallback.background,
    surface: raw["surface"] as? String ?? fallback.surface,
    surfaceAlt: raw["surfaceAlt"] as? String ?? fallback.surfaceAlt,
    border: raw["border"] as? String ?? fallback.border,
    text: raw["text"] as? String ?? fallback.text,
    secondaryText: raw["secondaryText"] as? String ?? fallback.secondaryText,
    muted: raw["muted"] as? String ?? fallback.muted,
    accent: raw["accent"] as? String ?? fallback.accent,
    bold: raw["bold"] as? String ?? fallback.bold
  )
}

// MARK: - Marka renkleri

extension Color {
  static let wxBackground = Color(red: 0.043, green: 0.055, blue: 0.086) // #0B0E16
  static let wxSurface = Color(red: 0.129, green: 0.110, blue: 0.180)
  static let wxSurfaceAlt = Color(red: 0.106, green: 0.090, blue: 0.149)
  static let wxBorder = Color(red: 0.2, green: 0.173, blue: 0.275)
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
