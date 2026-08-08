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
  let isTurkish: Bool
  let preferences: WidgetDisplayPreferences
}

private struct ListsProvider: TimelineProvider {
  func placeholder(in context: Context) -> ListsEntry {
    ListsEntry(
      date: Date(),
      lists: sampleLists,
      isTurkish: isTurkishLanguage(),
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
        isTurkish: isTurkishLanguage(),
        preferences: loadWidgetPreferences()
      )
    )
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ListsEntry>) -> Void) {
    // Listeler yalnız uygulama yazınca değişir (reloadAllTimelines).
    let entry = ListsEntry(
      date: Date(),
      lists: loadLists(),
      isTurkish: isTurkishLanguage(),
      preferences: loadWidgetPreferences()
    )
    completion(Timeline(entries: [entry], policy: .never))
  }
}

// MARK: - Görünüm

private struct ListRow: View {
  let list: ListSummary
  let showCount: Bool
  let appearance: WidgetAppearancePreferences

  var body: some View {
    HStack(spacing: 9) {
      Image(systemName: symbolName(for: list.icon))
        .font(.system(size: 11, weight: .semibold))
        .foregroundColor(appearance.accentColor)
        .frame(width: 22, height: 22)
        .background(appearance.accentColor.opacity(0.16))
        .clipShape(Circle())

      Text(list.name)
        .font(.system(size: 12, weight: .semibold))
        .foregroundColor(appearance.textColor)
        .lineLimit(1)

      Spacer(minLength: 0)

      if showCount {
        Text("\(list.count)")
          .font(.system(size: 12, weight: .bold))
          .foregroundColor(appearance.accentColor)
      }
    }
    .padding(.horizontal, 8)
    .padding(.vertical, 7)
    .background(appearance.surfaceAltColor)
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}

private struct ListsWidgetEntryView: View {
  var entry: ListsEntry
  @Environment(\.widgetFamily) private var family

  private var maxRows: Int {
    family == .systemLarge
      ? (entry.preferences.listsCompact ? 8 : 7)
      : (entry.preferences.listsCompact ? 4 : 3)
  }

  var body: some View {
    let shown = Array(entry.lists.prefix(maxRows))
    let appearance = entry.preferences.listsAppearance

    VStack(alignment: .leading, spacing: 7) {
      if entry.preferences.listsShowTitle {
        HStack(spacing: 8) {
          Image(systemName: "square.grid.2x2.fill")
            .font(.system(size: 11, weight: .bold))
            .foregroundColor(.white)
            .frame(width: 24, height: 24)
            .background(appearance.accentColor)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

          Text(entry.isTurkish ? "Listelerim" : "My Lists")
            .font(.system(size: 14, weight: .bold))
            .foregroundColor(appearance.textColor)

          Spacer(minLength: 0)
        }
      }

      if shown.isEmpty {
        Spacer()
        Text(entry.isTurkish ? "Henüz liste yok" : "No lists yet")
          .font(.system(size: 12))
          .foregroundColor(appearance.mutedColor)
          .frame(maxWidth: .infinity, alignment: .center)
        Spacer()
      } else {
        ForEach(shown) { list in
          ListRow(
            list: list,
            showCount: entry.preferences.listsShowCount,
            appearance: appearance
          )
        }
        Spacer(minLength: 0)
      }
    }
    .padding(13)
    .widgetBackgroundCompat(appearance.backgroundColor)
  }
}

// MARK: - Widget

struct ListsWidget: Widget {
  let kind = "ListsWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ListsProvider()) { entry in
      ListsWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Seelogd Listelerim")
    .description("Listelerini ve içerik sayılarını ana ekranda gösterir.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}
