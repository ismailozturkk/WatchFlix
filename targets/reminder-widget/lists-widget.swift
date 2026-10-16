// Seelogd — iOS "Listelerim" widget'ı.
//
// ANDROID'DEN FARKI (bilinçli, bkz. docs/kurulum/reminder-widget-ios-kurulum.md):
//
// 1) POSTER YOK. WidgetKit uzantısında ağdan görsel indirilemez (AsyncImage
//    widget'larda çalışmaz); posterlerin App Group konteynerine ÖNCEDEN
//    indirilip diskten okunması gerekir. O görsel boru hattı henüz yok, bu
//    yüzden iOS sürümü listeleri ad + öğe sayısı + aksan rengiyle gösterir.
//    Poster ızgarası Mac adımında (görsel önbelleği eklendikten sonra) açılır.
//
// 2) LİSTE SEÇİCİ YOK. Android'de başlıktaki ‹ › düğmeleri listeler arasında
//    dolaşır; iOS'ta bunun doğru karşılığı AppIntent tabanlı yapılandırılabilir
//    widget'tır (iOS 17+) ve Windows'ta derlenip doğrulanamaz. Şimdilik TÜM
//    listeler tek kartta sıralanır — seçim gerekmez.
//
// Veri sözleşmesi Android ile aynı: services/listsWidgetService.js
//   [{ key, name, accent, icon, count, posters: [url] }]

import WidgetKit
import SwiftUI

// MARK: - Paylaşılan veri

private let listsKey = "lists"

private struct ListSummary: Identifiable {
  let id: String
  let name: String
  let accent: Color
  let icon: String
  let count: Int
}

// JS'teki Ionicons adlarını (utils/listAppearance.js) SF Symbol'e çevirir.
private func symbolName(for icon: String) -> String {
  switch icon {
  case "film": return "film"
  case "tv": return "tv"
  case "heart": return "heart.fill"
  case "bookmark": return "bookmark.fill"
  default: return "list.bullet"
  }
}

private func loadLists() -> [ListSummary] {
  guard
    let defaults = UserDefaults(suiteName: appGroupId),
    let raw = defaults.string(forKey: listsKey),
    let data = raw.data(using: .utf8),
    let array = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]]
  else { return [] }

  return array.compactMap { obj -> ListSummary? in
    guard let key = obj["key"] as? String else { return nil }
    return ListSummary(
      id: key,
      name: obj["name"] as? String ?? key,
      accent: Color(hex: obj["accent"] as? String ?? "") ?? .wxAccent,
      icon: obj["icon"] as? String ?? "list",
      count: (obj["count"] as? NSNumber)?.intValue ?? 0
    )
  }
}

private let sampleLists: [ListSummary] = [
  ListSummary(id: "watchedTv", name: "İzlenen Diziler", accent: Color(hex: "#a78bfa")!, icon: "tv", count: 37),
  ListSummary(id: "watchedMovies", name: "İzlenen Filmler", accent: Color(hex: "#4fc3f7")!, icon: "film", count: 184),
  ListSummary(id: "watchList", name: "İzlenecekler", accent: Color(hex: "#34d399")!, icon: "bookmark", count: 52),
  ListSummary(id: "favorites", name: "Favoriler", accent: Color(hex: "#f87171")!, icon: "heart", count: 24),
]

// MARK: - Timeline

private struct ListsEntry: TimelineEntry {
  let date: Date
  let lists: [ListSummary]
  let lang: String
  let preferences: WidgetDisplayPreferences
}

private struct ListsProvider: TimelineProvider {
  func placeholder(in context: Context) -> ListsEntry {
    ListsEntry(
      date: Date(),
      lists: sampleLists,
      lang: widgetLanguage(),
      preferences: loadWidgetPreferences()
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (ListsEntry) -> Void) {
    let loaded = loadLists()
    let shown = (loaded.isEmpty || context.isPreview) ? sampleLists : loaded
    completion(
      ListsEntry(
        date: Date(),
        lists: shown,
        lang: widgetLanguage(),
        preferences: loadWidgetPreferences()
      )
    )
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ListsEntry>) -> Void) {
    // Listeler yalnız uygulama yazınca değişir (reloadAllTimelines).
    let entry = ListsEntry(
      date: Date(),
      lists: loadLists(),
      lang: widgetLanguage(),
      preferences: loadWidgetPreferences()
    )
    completion(Timeline(entries: [entry], policy: .never))
  }
}

// MARK: - Görünüm

// Satır ve başlık ölçüleri (pt); satır sayısı widget'ın GERÇEK yüksekliğinden
// hesaplanır (fitRows, shared.swift). JS ikizi: screens/tabs/settings/widgets/
// widgetPlatform.js → iosListMetrics (testle kilitli, ikisi AYNI kalmalı).
// `line` = 12/11 pt metnin satır yüksekliği (yukarı yuvarlı).
private struct ListMetrics {
  let badge: CGFloat
  let circle: CGFloat
  let padV: CGFloat
  let gap: CGFloat
  let font: CGFloat
  let line: CGFloat

  var header: CGFloat { badge + gap }
  var row: CGFloat { max(circle, line) + padV * 2 }

  static func make(large: Bool, compact: Bool) -> ListMetrics {
    if large {
      return compact
        ? ListMetrics(badge: 20, circle: 20, padV: 5, gap: 5, font: 11, line: 14)
        : ListMetrics(badge: 24, circle: 22, padV: 7, gap: 7, font: 12, line: 15)
    }
    return compact
      ? ListMetrics(badge: 18, circle: 16, padV: 3, gap: 4, font: 11, line: 14)
      : ListMetrics(badge: 22, circle: 20, padV: 4, gap: 5, font: 12, line: 15)
  }
}

private struct ListRow: View {
  let list: ListSummary
  let showCount: Bool
  let metrics: ListMetrics
  let appearance: WidgetAppearancePreferences

  var body: some View {
    HStack(spacing: 9) {
      Image(systemName: symbolName(for: list.icon))
        .font(.system(size: metrics.circle * 0.5, weight: .semibold))
        .foregroundColor(appearance.accentColor)
        .frame(width: metrics.circle, height: metrics.circle)
        .background(appearance.accentColor.opacity(0.16))
        .clipShape(Circle())

      Text(list.name)
        .font(.system(size: metrics.font, weight: .semibold))
        .foregroundColor(appearance.textColor)
        .lineLimit(1)

      Spacer(minLength: 0)

      if showCount {
        Text("\(list.count)")
          .font(.system(size: metrics.font, weight: .bold))
          .foregroundColor(appearance.accentColor)
      }
    }
    .padding(.horizontal, 8)
    .padding(.vertical, metrics.padV)
    .background(appearance.surfaceAltColor)
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}

private struct ListsWidgetEntryView: View {
  var entry: ListsEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    // Sabit satır sayısı yerine widget'ın gerçek yüksekliğine göre dizilir; orta
    // boyda başlık artık taşıp kırpılmıyor (bkz. widgetContentPadding, shared.swift).
    GeometryReader { proxy in
      content(available: proxy.size.height)
    }
    .widgetContentPadding(13)
    .widgetBackgroundCompat(entry.preferences.listsAppearance.backgroundColor)
  }

  private func content(available: CGFloat) -> some View {
    let prefs = entry.preferences
    let appearance = prefs.listsAppearance
    let metrics = ListMetrics.make(
      large: family == .systemLarge,
      compact: prefs.listsCompact
    )
    // "+N daha" etiketi yok (overflowLabel çok büyük → hiç sığmaz); sınır yok (Int.max).
    let fit = fitRows(
      available: available,
      header: prefs.listsShowTitle ? metrics.header : 0,
      row: metrics.row,
      gap: metrics.gap,
      overflowLabel: 10000,
      total: entry.lists.count,
      limit: Int.max
    )
    let shown = Array(entry.lists.prefix(fit.rows))

    return VStack(alignment: .leading, spacing: metrics.gap) {
      if prefs.listsShowTitle {
        HStack(spacing: 8) {
          Image(systemName: "square.grid.2x2.fill")
            .font(.system(size: metrics.badge * 0.46, weight: .bold))
            .foregroundColor(.white)
            .frame(width: metrics.badge, height: metrics.badge)
            .background(appearance.accentColor)
            .clipShape(RoundedRectangle(cornerRadius: metrics.badge * 0.33, style: .continuous))

          Text(widgetPick(entry.lang, tr: "Listelerim", en: "My Lists", es: "Mis listas"))
            .font(.system(size: metrics.badge >= 22 ? 14 : 12, weight: .bold))
            .foregroundColor(appearance.textColor)
            .lineLimit(1)

          Spacer(minLength: 0)
        }
      }

      if shown.isEmpty {
        Spacer()
        Text(widgetPick(entry.lang, tr: "Henüz liste yok", en: "No lists yet", es: "Aún no hay listas"))
          .font(.system(size: 12))
          .foregroundColor(appearance.mutedColor)
          .frame(maxWidth: .infinity, alignment: .center)
        Spacer()
      } else {
        ForEach(shown) { list in
          ListRow(
            list: list,
            showCount: prefs.listsShowCount,
            metrics: metrics,
            appearance: appearance
          )
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

// MARK: - Widget

struct ListsWidget: Widget {
  let kind = "ListsWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ListsProvider()) { entry in
      ListsWidgetEntryView(entry: entry)
    }
    .configurationDisplayName(LocalizedStringKey("Seelogd My Lists"))
    .description(LocalizedStringKey("Shows your lists and how many items they hold on the home screen."))
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}
