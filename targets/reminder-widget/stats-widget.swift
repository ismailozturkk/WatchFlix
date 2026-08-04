// Seelogd — iOS "İstatistikler" widget'ı.
//
// Android'deki StatsWidgetProvider.kt ile aynı davranış: App Group
// UserDefaults'tan hazır biçimlendirilmiş istatistik JSON'unu okur ve profildeki
// istatistik bölümünün düzenini çizer. Sayı biçimlendirme ve i18n JS tarafında
// bitmiştir (services/statsWidgetService.js) — burada hesap YOK, yalnız çizim.

import WidgetKit
import SwiftUI

// MARK: - Paylaşılan veri

private let statsKey = "stats"

private struct StatsTime {
  let years: Int
  let months: Int
  let days: Int
  let hours: Int
  let minutes: Int

  static let zero = StatsTime(years: 0, months: 0, days: 0, hours: 0, minutes: 0)

  init(years: Int, months: Int, days: Int, hours: Int, minutes: Int) {
    self.years = years
    self.months = months
    self.days = days
    self.hours = hours
    self.minutes = minutes
  }

  init(_ obj: [String: Any]?) {
    years = (obj?["years"] as? NSNumber)?.intValue ?? 0
    months = (obj?["months"] as? NSNumber)?.intValue ?? 0
    days = (obj?["days"] as? NSNumber)?.intValue ?? 0
    hours = (obj?["hours"] as? NSNumber)?.intValue ?? 0
    minutes = (obj?["minutes"] as? NSNumber)?.intValue ?? 0
  }

  var values: [Int] { [years, months, days, hours, minutes] }
}

private struct StatsData {
  var title: String = "İstatistikler"
  var movieCount: String = "0"
  var movieCountLabel: String = ""
  var movieTime: StatsTime = .zero
  var showCount: String = "0"
  var showCountLabel: String = ""
  var episodeCount: String = "0"
  var episodeCountLabel: String = ""
  var tvTime: StatsTime = .zero
  var totalText: String = ""
  var totalLabel: String = ""
  var movieText: String = ""
  var movieLabel: String = ""
  var movieAccent: String = "#4FC3F7"
  var tvText: String = ""
  var tvLabel: String = ""
  var tvAccent: String = "#A78BFA"
  var units: [String] = ["Yıl", "Ay", "Gün", "Saat", "Dakika"]
}

private func loadStats() -> StatsData? {
  guard
    let defaults = UserDefaults(suiteName: appGroupId),
    let raw = defaults.string(forKey: statsKey),
    let data = raw.data(using: .utf8),
    let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
  else { return nil }

  var stats = StatsData()
  if let title = obj["title"] as? String, !title.isEmpty { stats.title = title }

  if let movie = obj["movie"] as? [String: Any] {
    stats.movieCount = movie["count"] as? String ?? "0"
    stats.movieCountLabel = movie["countLabel"] as? String ?? ""
    stats.movieTime = StatsTime(movie["time"] as? [String: Any])
  }

  if let tv = obj["tv"] as? [String: Any] {
    stats.showCount = tv["showCount"] as? String ?? "0"
    stats.showCountLabel = tv["showCountLabel"] as? String ?? ""
    stats.episodeCount = tv["episodeCount"] as? String ?? "0"
    stats.episodeCountLabel = tv["episodeCountLabel"] as? String ?? ""
    stats.tvTime = StatsTime(tv["time"] as? [String: Any])
  }

  if let duration = obj["duration"] as? [String: Any] {
    stats.totalText = duration["totalText"] as? String ?? ""
    stats.totalLabel = duration["totalLabel"] as? String ?? ""
    stats.movieText = duration["movieText"] as? String ?? ""
    stats.movieLabel = duration["movieLabel"] as? String ?? ""
    stats.movieAccent = duration["movieAccent"] as? String ?? stats.movieAccent
    stats.tvText = duration["tvText"] as? String ?? ""
    stats.tvLabel = duration["tvLabel"] as? String ?? ""
    stats.tvAccent = duration["tvAccent"] as? String ?? stats.tvAccent
  }

  if let units = obj["units"] as? [String: Any] {
    stats.units = ["years", "months", "days", "hours", "minutes"].map {
      units[$0] as? String ?? ""
    }
  }

  return stats
}

private let sampleStats: StatsData = {
  var stats = StatsData()
  stats.movieCount = "184"
  stats.movieCountLabel = "İzlenen Film"
  stats.movieTime = StatsTime(years: 0, months: 4, days: 11, hours: 6, minutes: 30)
  stats.showCount = "37"
  stats.showCountLabel = "Dizi"
  stats.episodeCount = "912"
  stats.episodeCountLabel = "Bölüm"
  stats.tvTime = StatsTime(years: 0, months: 1, days: 8, hours: 16, minutes: 45)
  stats.totalText = "1.284 Saat"
  stats.totalLabel = "Toplam Süre"
  stats.movieText = "356 Saat"
  stats.movieLabel = "Filmler"
  stats.tvText = "928 Saat"
  stats.tvLabel = "Diziler"
  return stats
}()

// MARK: - Timeline

private struct StatsEntry: TimelineEntry {
  let date: Date
  let stats: StatsData
  let preferences: WidgetDisplayPreferences
}

private struct StatsProvider: TimelineProvider {
  func placeholder(in context: Context) -> StatsEntry {
    StatsEntry(
      date: Date(),
      stats: sampleStats,
      preferences: loadWidgetPreferences()
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (StatsEntry) -> Void) {
    let loaded = loadStats()
    completion(
      StatsEntry(
        date: Date(),
        stats: (context.isPreview ? nil : loaded) ?? sampleStats,
        preferences: loadWidgetPreferences()
      )
    )
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StatsEntry>) -> Void) {
    // İstatistikler yalnız uygulama yazınca değişir (reloadAllTimelines);
    // zamana bağlı bir yenilemeye gerek yok.
    let entry = StatsEntry(
      date: Date(),
      stats: loadStats() ?? StatsData(),
      preferences: loadWidgetPreferences()
    )
    completion(Timeline(entries: [entry], policy: .never))
  }
}

// MARK: - Görünüm

private struct StatBlock: View {
  let value: String
  let label: String
  let appearance: WidgetAppearancePreferences

  var body: some View {
    VStack(spacing: 1) {
      Text(value)
        .font(.system(size: 15, weight: .bold))
        .foregroundColor(appearance.textColor)
      Text(label)
        .font(.system(size: 8))
        .foregroundColor(appearance.mutedColor)
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity)
  }
}

private struct StatsPanel<Content: View>: View {
  let appearance: WidgetAppearancePreferences
  @ViewBuilder let content: Content

  var body: some View {
    content
      .padding(.vertical, 6)
      .padding(.horizontal, 4)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(appearance.surfaceAltColor)
      .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
  }
}

private struct StatsCard: View {
  let leading: AnyView
  let time: StatsTime
  let units: [String]
  let appearance: WidgetAppearancePreferences

  var body: some View {
    HStack(spacing: 5) {
      StatsPanel(appearance: appearance) { leading }
        .frame(maxWidth: .infinity)
      StatsPanel(appearance: appearance) {
        HStack(spacing: 0) {
          ForEach(Array(time.values.enumerated()), id: \.offset) { index, value in
            StatBlock(
              value: "\(value)",
              label: units.indices.contains(index) ? units[index] : "",
              appearance: appearance
            )
          }
        }
      }
      .frame(maxWidth: .infinity)
    }
    .padding(6)
    .background(appearance.surfaceColor)
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
  }
}

private struct DurationItem: View {
  let systemName: String
  let value: String
  let label: String
  let tint: Color
  let muted: Color

  var body: some View {
    HStack(spacing: 5) {
      Image(systemName: systemName)
        .font(.system(size: 11))
        .foregroundColor(muted)
      VStack(alignment: .leading, spacing: 0) {
        Text(value)
          .font(.system(size: 11, weight: .bold))
          .foregroundColor(tint)
          .lineLimit(1)
        Text(label)
          .font(.system(size: 8))
          .foregroundColor(muted)
          .lineLimit(1)
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity)
  }
}

private struct StatsWidgetEntryView: View {
  var entry: StatsEntry

  var body: some View {
    let stats = entry.stats
    let appearance = entry.preferences.statsAppearance

    VStack(alignment: .leading, spacing: 7) {
      if entry.preferences.statsShowTitle {
        HStack(spacing: 8) {
          Text("S")
            .font(.system(size: 13, weight: .bold))
            .foregroundColor(.white)
            .frame(width: 24, height: 24)
            .background(appearance.accentColor)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
          Text(stats.title)
            .font(.system(size: 14, weight: .bold))
            .foregroundColor(appearance.textColor)
          Spacer(minLength: 0)
        }
      }

      if entry.preferences.statsShowMovies {
        StatsCard(
          leading: AnyView(
            VStack(spacing: 1) {
              Text(stats.movieCount)
                .font(.system(size: 19, weight: .bold))
                .foregroundColor(appearance.textColor)
              Text(stats.movieCountLabel)
                .font(.system(size: 9))
                .foregroundColor(appearance.mutedColor)
                .lineLimit(1)
            }
          ),
          time: stats.movieTime,
          units: stats.units,
          appearance: appearance
        )
      }

      if entry.preferences.statsShowDuration {
        HStack(spacing: 0) {
          DurationItem(
            systemName: "clock",
            value: stats.totalText,
            label: stats.totalLabel,
            tint: appearance.accentColor,
            muted: appearance.mutedColor
          )
          DurationItem(
            systemName: "film",
            value: stats.movieText,
            label: stats.movieLabel,
            tint: appearance.accentColor,
            muted: appearance.mutedColor
          )
          DurationItem(
            systemName: "tv",
            value: stats.tvText,
            label: stats.tvLabel,
            tint: appearance.boldColor,
            muted: appearance.mutedColor
          )
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 7)
        .background(appearance.surfaceAltColor)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
      }

      if entry.preferences.statsShowTv {
        StatsCard(
          leading: AnyView(
            HStack(spacing: 0) {
              StatBlock(
                value: stats.showCount,
                label: stats.showCountLabel,
                appearance: appearance
              )
              StatBlock(
                value: stats.episodeCount,
                label: stats.episodeCountLabel,
                appearance: appearance
              )
            }
          ),
          time: stats.tvTime,
          units: stats.units,
          appearance: appearance
        )
      }
    }
    .padding(entry.preferences.statsCompact ? 9 : 13)
    .widgetBackgroundCompat(appearance.backgroundColor)
  }
}

// MARK: - Widget

struct StatsWidget: Widget {
  let kind = "StatsWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: StatsProvider()) { entry in
      StatsWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Seelogd İstatistikler")
    .description("İzleme istatistiklerini ana ekranda gösterir.")
    .supportedFamilies([.systemLarge])
  }
}
