// Seelogd — iOS "Yaklaşanlar" (Coming Up) home-screen widget.
//
// Android'deki ReminderWidgetProvider.kt ile aynı davranış: paylaşılan App
// Group UserDefaults'tan hatırlatıcı JSON'unu okur, yaklaşan film/bölümleri
// tarihe göre sıralar ve geri sayımla listeler. Veriyi ana uygulama
// modules/reminder-widget (ReminderWidgetModule.swift) üzerinden yazar.

import WidgetKit
import SwiftUI

// MARK: - Paylaşılan veri

// appGroupId / languageKey / loadLanguage() ve marka renkleri shared.swift'te
// (üç widget da aynı uzantı hedefinde yaşıyor).
private let itemsKey = "items"

private struct ReminderItem: Identifiable {
  let id: String
  let type: String
  let title: String
  let subtitle: String
  let date: Date
}

private func loadItems() -> [ReminderItem] {
  guard
    let defaults = UserDefaults(suiteName: appGroupId),
    let raw = defaults.string(forKey: itemsKey),
    let data = raw.data(using: .utf8),
    let array = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]]
  else { return [] }

  let startOfToday = Calendar.current.startOfDay(for: Date())

  return array.compactMap { obj -> ReminderItem? in
    guard let epochMs = (obj["dateEpoch"] as? NSNumber)?.doubleValue else { return nil }
    return ReminderItem(
      id: obj["id"] as? String ?? UUID().uuidString,
      type: obj["type"] as? String ?? "movie",
      title: obj["title"] as? String ?? "",
      subtitle: obj["subtitle"] as? String ?? "",
      date: Date(timeIntervalSince1970: epochMs / 1000.0)
    )
  }
  .filter { Calendar.current.startOfDay(for: $0.date) >= startOfToday }
  .sorted { $0.date < $1.date }
}

private func countdownText(_ date: Date, isTurkish: Bool) -> String {
  let cal = Calendar.current
  let days = cal.dateComponents(
    [.day],
    from: cal.startOfDay(for: Date()),
    to: cal.startOfDay(for: date)
  ).day ?? 0

  if days <= 0 { return isTurkish ? "Bugün" : "Today" }
  if days == 1 { return isTurkish ? "Yarın" : "Tomorrow" }
  return isTurkish ? "\(days) gün" : "\(days) days"
}

private let sampleItems: [ReminderItem] = [
  ReminderItem(
    id: "sample-1",
    type: "movie",
    title: "Dune: Part Two",
    subtitle: "",
    date: Date().addingTimeInterval(86400)
  ),
  ReminderItem(
    id: "sample-2",
    type: "tv",
    title: "The Last of Us",
    subtitle: "S2 • E1",
    date: Date().addingTimeInterval(86400 * 3)
  ),
  ReminderItem(
    id: "sample-3",
    type: "movie",
    title: "Interstellar",
    subtitle: "",
    date: Date().addingTimeInterval(86400 * 5)
  )
]

// MARK: - Timeline

private struct ReminderEntry: TimelineEntry {
  let date: Date
  let items: [ReminderItem]
  let isTurkish: Bool
}

private struct ReminderProvider: TimelineProvider {
  func placeholder(in context: Context) -> ReminderEntry {
    ReminderEntry(date: Date(), items: sampleItems, isTurkish: loadLanguage().hasPrefix("tr"))
  }

  func getSnapshot(in context: Context, completion: @escaping (ReminderEntry) -> Void) {
    let items = loadItems()
    let displayItems = (items.isEmpty || context.isPreview) ? sampleItems : items
    completion(
      ReminderEntry(date: Date(), items: displayItems, isTurkish: loadLanguage().hasPrefix("tr"))
    )
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ReminderEntry>) -> Void) {
    let entry = ReminderEntry(
      date: Date(),
      items: loadItems(),
      isTurkish: loadLanguage().hasPrefix("tr")
    )
    // Geri sayımlar doğru kalsın diye gece yarısından hemen sonra yenile.
    let nextRefresh = Calendar.current.nextDate(
      after: Date(),
      matching: DateComponents(hour: 0, minute: 1),
      matchingPolicy: .nextTime
    ) ?? Date().addingTimeInterval(60 * 60)
    completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
  }
}

// MARK: - Görünüm

private struct ReminderRow: View {
  let item: ReminderItem
  let isTurkish: Bool

  private var isMovie: Bool { item.type == "movie" }
  private var typeLabel: String {
    if isMovie { return isTurkish ? "Film" : "Movie" }
    return isTurkish ? "Dizi" : "TV"
  }

  var body: some View {
    HStack(spacing: 10) {
      Text(isMovie ? "F" : "D")
        .font(.system(size: 12, weight: .bold))
        .foregroundColor(.white)
        .frame(width: 26, height: 26)
        .background(isMovie ? Color.wxMovie : Color.wxAccent)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

      VStack(alignment: .leading, spacing: 1) {
        Text(item.title)
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(.wxTitle)
          .lineLimit(1)

        Text(
          [typeLabel, item.subtitle, countdownText(item.date, isTurkish: isTurkish)]
            .filter { !$0.isEmpty }
            .joined(separator: "  •  ")
        )
        .font(.system(size: 9))
        .foregroundColor(.wxMeta)
        .lineLimit(1)
      }

      Spacer(minLength: 0)
    }
  }
}

private struct ReminderWidgetEntryView: View {
  var entry: ReminderEntry
  @Environment(\.widgetFamily) private var family

  private var maxRows: Int {
    family == .systemLarge ? 6 : 3
  }

  var body: some View {
    let shown = Array(entry.items.prefix(maxRows))
    let overflow = entry.items.count - shown.count

    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 8) {
        Text("W")
          .font(.system(size: 13, weight: .bold))
          .foregroundColor(.white)
          .frame(width: 26, height: 26)
          .background(Color.wxAccent)
          .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

        Text(entry.isTurkish ? "Yaklaşanlar" : "Coming Up")
          .font(.system(size: 15, weight: .bold))
          .foregroundColor(.wxTitle)

        Spacer(minLength: 0)

        Text(entry.isTurkish ? "\(entry.items.count) hatırlatma" : "\(entry.items.count) reminders")
          .font(.system(size: 10, weight: .bold))
          .foregroundColor(.wxAccent)
      }

      Divider().overlay(Color.white.opacity(0.12))

      if shown.isEmpty {
        Spacer()
        Text(entry.isTurkish ? "Yaklaşan film veya bölüm yok" : "No upcoming movies or episodes")
          .font(.system(size: 12))
          .foregroundColor(.wxMeta)
          .frame(maxWidth: .infinity, alignment: .center)
        Spacer()
      } else {
        ForEach(shown) { item in
          ReminderRow(item: item, isTurkish: entry.isTurkish)
        }
        if overflow > 0 {
          Text(entry.isTurkish ? "+\(overflow) daha" : "+\(overflow) more")
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(.wxAccent)
            .frame(maxWidth: .infinity, alignment: .center)
        }
        Spacer(minLength: 0)
      }
    }
    .padding(14)
    .widgetBackgroundCompat(Color.wxBackground)
  }
}

// MARK: - Widget

struct ReminderWidget: Widget {
  let kind = "ReminderWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ReminderProvider()) { entry in
      ReminderWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Seelogd Yaklaşanlar")
    .description("Yaklaşan film ve dizi bölümlerini gösterir.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

// Tek uzantı hedefi, üç widget: Yaklaşanlar (bu dosya), Listelerim
// (lists-widget.swift), İstatistikler (stats-widget.swift).
@main
struct ReminderWidgetBundle: WidgetBundle {
  var body: some Widget {
    ReminderWidget()
    ListsWidget()
    StatsWidget()
  }
}
