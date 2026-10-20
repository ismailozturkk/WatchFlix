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

private func countdownText(_ date: Date, lang: String) -> String {
  let cal = Calendar.current
  let days = cal.dateComponents(
    [.day],
    from: cal.startOfDay(for: Date()),
    to: cal.startOfDay(for: date)
  ).day ?? 0

  if days <= 0 { return widgetPick(lang, tr: "Bugün", en: "Today", es: "Hoy", pt: "Hoje", de: "Heute") }
  if days == 1 { return widgetPick(lang, tr: "Yarın", en: "Tomorrow", es: "Mañana", pt: "Amanhã", de: "Morgen") }
  return widgetPick(lang, tr: "\(days) gün", en: "\(days) days", es: "\(days) días", pt: "\(days) dias", de: "\(days) Tage")
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
  let lang: String
  let preferences: WidgetDisplayPreferences
}

private struct ReminderProvider: TimelineProvider {
  func placeholder(in context: Context) -> ReminderEntry {
    ReminderEntry(
      date: Date(),
      items: sampleItems,
      lang: widgetLanguage(),
      preferences: loadWidgetPreferences()
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (ReminderEntry) -> Void) {
    let items = loadItems()
    let displayItems = (items.isEmpty || context.isPreview) ? sampleItems : items
    completion(
      ReminderEntry(
        date: Date(),
        items: displayItems,
        lang: widgetLanguage(),
        preferences: loadWidgetPreferences()
      )
    )
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ReminderEntry>) -> Void) {
    let entry = ReminderEntry(
      date: Date(),
      items: loadItems(),
      lang: widgetLanguage(),
      preferences: loadWidgetPreferences()
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

// Satır ve başlık ölçüleri (pt). Satır sayısı bu ölçülerle widget'ın GERÇEK
// yüksekliğinden hesaplanır (bkz. fitRows, shared.swift). JS ikizi:
// screens/tabs/settings/widgets/widgetPlatform.js → iosReminderMetrics. Ayarlar
// önizlemesi aynı sayılarla çizer; ikisi AYNI kalmalı (testle kilitli).
//
// textBlock = başlık + alt satır metninin toplam yüksekliği (SF satır yüksekliği).
// Orta boyda ayraç çizgisi yok ve ölçüler daha sıkı: 158 pt'lik widget'ta sistem
// kenar boşluğu düşünce yalnız ≈126 pt kalıyor.
private struct ReminderMetrics {
  let badge: CGFloat
  let divider: Bool
  let icon: CGFloat
  let padV: CGFloat
  let gap: CGFloat
  let title: CGFloat
  let meta: CGFloat
  let textBlock: CGFloat

  /// Başlık şeridinin kapladığı yükseklik (rozet + boşluk [+ ayraç + boşluk]).
  var header: CGFloat { badge + gap + (divider ? 1 + gap : 0) }

  func row(showIcon: Bool) -> CGFloat {
    max(showIcon ? icon : 0, textBlock) + padV * 2
  }

  static func make(large: Bool, compact: Bool) -> ReminderMetrics {
    if large {
      return compact
        ? ReminderMetrics(badge: 22, divider: true, icon: 22, padV: 4, gap: 5, title: 11, meta: 8, textBlock: 24)
        : ReminderMetrics(badge: 26, divider: true, icon: 26, padV: 6, gap: 8, title: 12, meta: 9, textBlock: 26)
    }
    return compact
      ? ReminderMetrics(badge: 20, divider: false, icon: 20, padV: 3, gap: 4, title: 11, meta: 8, textBlock: 24)
      : ReminderMetrics(badge: 24, divider: false, icon: 24, padV: 5, gap: 6, title: 12, meta: 9, textBlock: 26)
  }
}

private struct ReminderRow: View {
  let item: ReminderItem
  let lang: String
  let showIcon: Bool
  let showDate: Bool
  let metrics: ReminderMetrics
  let appearance: WidgetAppearancePreferences

  private var isMovie: Bool { item.type == "movie" }
  private var typeLabel: String {
    if isMovie { return widgetPick(lang, tr: "Film", en: "Movie", es: "Película", pt: "Filme", de: "Film") }
    return widgetPick(lang, tr: "Dizi", en: "TV", es: "Serie", pt: "Série", de: "Serie")
  }

  var body: some View {
    HStack(spacing: metrics.gap + 2) {
      if showIcon {
        Text(isMovie ? "F" : "D")
          .font(.system(size: metrics.icon * 0.46, weight: .bold))
          .foregroundColor(.white)
          .frame(width: metrics.icon, height: metrics.icon)
          .background(isMovie ? Color.wxMovie : appearance.accentColor)
          .clipShape(RoundedRectangle(cornerRadius: metrics.icon * 0.3, style: .continuous))
      }

      VStack(alignment: .leading, spacing: 1) {
        Text(item.title)
          .font(.system(size: metrics.title, weight: .semibold))
          .foregroundColor(appearance.textColor)
          .lineLimit(1)

        Text(
          [
            typeLabel,
            item.subtitle,
            showDate ? countdownText(item.date, lang: lang) : ""
          ]
            .filter { !$0.isEmpty }
            .joined(separator: "  •  ")
        )
        .font(.system(size: metrics.meta))
        .foregroundColor(appearance.secondaryTextColor)
        .lineLimit(1)
      }

      Spacer(minLength: 0)
    }
    .padding(.horizontal, 8)
    .padding(.vertical, metrics.padV)
    .background(appearance.surfaceAltColor)
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}

private struct ReminderWidgetEntryView: View {
  var entry: ReminderEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    // GeometryReader: içeriği sabit sayılarla değil widget'ın gerçek (sistem kenar
    // boşluğu düşülmüş) yüksekliğine göre dizeriz.
    GeometryReader { proxy in
      content(available: proxy.size.height)
    }
    .widgetContentPadding(14)
    .widgetBackgroundCompat(entry.preferences.reminderAppearance.backgroundColor)
  }

  private func content(available: CGFloat) -> some View {
    let prefs = entry.preferences
    let appearance = prefs.reminderAppearance
    let metrics = ReminderMetrics.make(
      large: family == .systemLarge,
      compact: prefs.reminderCompact
    )
    let filtered = entry.items.filter {
      prefs.reminderContent == "all" || prefs.reminderContent == $0.type
    }
    let fit = fitRows(
      available: available,
      header: prefs.reminderShowTitle ? metrics.header : 0,
      row: metrics.row(showIcon: prefs.reminderShowPosters),
      gap: metrics.gap,
      overflowLabel: 12,
      total: filtered.count,
      limit: prefs.reminderMaxItems
    )
    let shown = Array(filtered.prefix(fit.rows))
    let overflow = filtered.count - shown.count

    return VStack(alignment: .leading, spacing: metrics.gap) {
      if prefs.reminderShowTitle {
        HStack(spacing: 8) {
          Text("S")
            .font(.system(size: metrics.badge * 0.5, weight: .bold))
            .foregroundColor(.white)
            .frame(width: metrics.badge, height: metrics.badge)
            .background(appearance.accentColor)
            .clipShape(RoundedRectangle(cornerRadius: metrics.badge * 0.3, style: .continuous))

          Text(widgetPick(entry.lang, tr: "Yaklaşanlar", en: "Coming Up", es: "Próximos", pt: "Próximos", de: "Demnächst"))
            .font(.system(size: metrics.badge >= 24 ? 15 : 13, weight: .bold))
            .foregroundColor(appearance.textColor)
            .lineLimit(1)

          Spacer(minLength: 0)

          Text(widgetPick(entry.lang, tr: "\(filtered.count) hatırlatma", en: "\(filtered.count) reminders", es: "\(filtered.count) recordatorios", pt: "\(filtered.count) lembretes", de: "\(filtered.count) Erinnerungen"))
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(appearance.accentColor)
            .lineLimit(1)
        }

        if metrics.divider {
          Divider().overlay(Color.white.opacity(0.12))
        }
      }

      if shown.isEmpty {
        Spacer()
        Text(widgetPick(entry.lang, tr: "Yaklaşan film veya bölüm yok", en: "No upcoming movies or episodes", es: "No hay películas ni episodios próximos", pt: "Nenhum filme ou episódio próximo", de: "Keine bevorstehenden Filme oder Folgen"))
          .font(.system(size: 12))
          .foregroundColor(appearance.mutedColor)
          .frame(maxWidth: .infinity, alignment: .center)
        Spacer()
      } else {
        ForEach(shown) { item in
          ReminderRow(
            item: item,
            lang: entry.lang,
            showIcon: prefs.reminderShowPosters,
            showDate: prefs.reminderShowDates,
            metrics: metrics,
            appearance: appearance
          )
        }
        if fit.showsOverflow {
          Text(widgetPick(entry.lang, tr: "+\(overflow) daha", en: "+\(overflow) more", es: "+\(overflow) más", pt: "+\(overflow) mais", de: "+\(overflow) weitere"))
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(appearance.accentColor)
            .frame(maxWidth: .infinity, alignment: .center)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

// MARK: - Widget (galeri adı/açıklaması SİSTEM diline göre: <dil>.lproj/Localizable.strings, anahtar = İngilizce metin)

struct ReminderWidget: Widget {
  let kind = "ReminderWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ReminderProvider()) { entry in
      ReminderWidgetEntryView(entry: entry)
    }
    .configurationDisplayName(LocalizedStringKey("Seelogd Coming Up"))
    .description(LocalizedStringKey("Shows upcoming movies and TV episodes."))
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
