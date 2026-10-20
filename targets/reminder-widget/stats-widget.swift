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

// İki düzen var:
//   • BÜYÜK: kartlar kalan yüksekliği paylaşır (esner). Eskiden küçük puntolu sayılar
//     dev kutuların ortasında kalıyor, çok boşluk görünüyordu; punto büyütüldü.
//   • ORTA: sıkı, boşluksuz düzen — iki kart yan yana (film | dizi), altında süre
//     şeridi. Yükseklik yetmezse (başlık açık / küçük telefon) önce şerit düşer.
// JS ikizi: screens/tabs/settings/widgets/IosPreviews.js (StatsPreview) ve
// widgetPlatform.js → IOS_STATS_MEDIUM / iosStatsMediumPlan.

private struct StatsScale {
  let countValue: CGFloat
  let countLabel: CGFloat
  let unitValue: CGFloat
  let unitLabel: CGFloat
  let durationValue: CGFloat
  let durationLabel: CGFloat
  let durationIcon: CGFloat
  let panelPadV: CGFloat

  static let large = StatsScale(
    countValue: 26, countLabel: 10, unitValue: 18, unitLabel: 9,
    durationValue: 12, durationLabel: 9, durationIcon: 13, panelPadV: 8
  )
  static let medium = StatsScale(
    countValue: 17, countLabel: 8, unitValue: 13, unitLabel: 7,
    durationValue: 11, durationLabel: 8, durationIcon: 11, panelPadV: 4
  )
}

// Orta boyda parçaların yükseklik bütçesi (pt). Şerit için yer var mı diye bakılır.
private enum StatsMediumBudget {
  static let title: CGFloat = 25
  static let bothCards: CGFloat = 83
  static let wideCard: CGFloat = 47
  static let strip: CGFloat = 31
  static let gap: CGFloat = 5
}

private struct StatBlock: View {
  let value: String
  let label: String
  let valueSize: CGFloat
  let labelSize: CGFloat
  let appearance: WidgetAppearancePreferences

  var body: some View {
    VStack(spacing: 1) {
      Text(value)
        .font(.system(size: valueSize, weight: .bold))
        .foregroundColor(appearance.textColor)
        .lineLimit(1)
        .minimumScaleFactor(0.5)
      // "Dakika" gibi uzun etiketler "Dak…" diye kesilmesin: kırpmak yerine küçülür.
      Text(label)
        .font(.system(size: labelSize))
        .foregroundColor(appearance.mutedColor)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }
    .frame(maxWidth: .infinity)
  }
}

private struct StatsPanel<Content: View>: View {
  let appearance: WidgetAppearancePreferences
  let padV: CGFloat
  let stretch: Bool
  @ViewBuilder let content: Content

  var body: some View {
    content
      .padding(.vertical, padV)
      .padding(.horizontal, 4)
      .frame(maxWidth: .infinity, maxHeight: stretch ? CGFloat.infinity : nil)
      .background(appearance.surfaceAltColor)
      .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
  }
}

private struct StatsCard: View {
  let leading: AnyView
  let time: StatsTime
  let units: [String]
  let scale: StatsScale
  /// true: iki panel alt alta (orta boyda yan yana iki kart); false: yan yana.
  let stacked: Bool
  /// true: panel kalan yüksekliği doldurur (büyük boy).
  let stretch: Bool
  let appearance: WidgetAppearancePreferences

  private var leadingPanel: some View {
    StatsPanel(appearance: appearance, padV: scale.panelPadV, stretch: stretch) {
      leading
    }
  }

  private var timePanel: some View {
    StatsPanel(appearance: appearance, padV: scale.panelPadV, stretch: stretch) {
      HStack(spacing: 0) {
        ForEach(Array(time.values.enumerated()), id: \.offset) { index, value in
          StatBlock(
            value: "\(value)",
            label: units.indices.contains(index) ? units[index] : "",
            valueSize: scale.unitValue,
            labelSize: scale.unitLabel,
            appearance: appearance
          )
        }
      }
    }
  }

  var body: some View {
    Group {
      if stacked {
        VStack(spacing: 3) {
          leadingPanel
          timePanel
        }
      } else {
        HStack(spacing: 5) {
          leadingPanel
          timePanel
        }
      }
    }
    .padding(stretch ? 6 : 4)
    .background(appearance.surfaceColor)
    .clipShape(RoundedRectangle(cornerRadius: stretch ? 16 : 12, style: .continuous))
  }
}

private struct DurationItem: View {
  let systemName: String
  let value: String
  let label: String
  let tint: Color
  let muted: Color
  let scale: StatsScale

  var body: some View {
    HStack(spacing: 5) {
      Image(systemName: systemName)
        .font(.system(size: scale.durationIcon))
        .foregroundColor(muted)
      VStack(alignment: .leading, spacing: 0) {
        Text(value)
          .font(.system(size: scale.durationValue, weight: .bold))
          .foregroundColor(tint)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        Text(label)
          .font(.system(size: scale.durationLabel))
          .foregroundColor(muted)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity)
  }
}

private struct DurationStrip: View {
  let stats: StatsData
  let scale: StatsScale
  let padV: CGFloat
  let appearance: WidgetAppearancePreferences

  var body: some View {
    HStack(spacing: 0) {
      DurationItem(
        systemName: "clock",
        value: stats.totalText,
        label: stats.totalLabel,
        tint: appearance.accentColor,
        muted: appearance.mutedColor,
        scale: scale
      )
      DurationItem(
        systemName: "film",
        value: stats.movieText,
        label: stats.movieLabel,
        tint: appearance.accentColor,
        muted: appearance.mutedColor,
        scale: scale
      )
      DurationItem(
        systemName: "tv",
        value: stats.tvText,
        label: stats.tvLabel,
        tint: appearance.boldColor,
        muted: appearance.mutedColor,
        scale: scale
      )
    }
    .padding(.horizontal, 8)
    .padding(.vertical, padV)
    .background(appearance.surfaceAltColor)
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}

private struct StatsWidgetEntryView: View {
  var entry: StatsEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    // Düzen widget'ın gerçek (sistem kenar boşluğu düşülmüş) yüksekliğine bakar.
    GeometryReader { proxy in
      layout(height: proxy.size.height)
    }
    .widgetContentPadding(entry.preferences.statsCompact ? 9 : 13)
    .widgetBackgroundCompat(entry.preferences.statsAppearance.backgroundColor)
  }

  @ViewBuilder
  private func layout(height: CGFloat) -> some View {
    if family == .systemLarge {
      largeLayout()
    } else {
      mediumLayout(height: height)
    }
  }

  private func movieLeading(_ stats: StatsData, _ scale: StatsScale, _ appearance: WidgetAppearancePreferences) -> AnyView {
    AnyView(
      StatBlock(
        value: stats.movieCount,
        label: stats.movieCountLabel,
        valueSize: scale.countValue,
        labelSize: scale.countLabel,
        appearance: appearance
      )
    )
  }

  private func tvLeading(_ stats: StatsData, _ scale: StatsScale, _ appearance: WidgetAppearancePreferences) -> AnyView {
    AnyView(
      HStack(spacing: 0) {
        StatBlock(
          value: stats.showCount,
          label: stats.showCountLabel,
          valueSize: scale.countValue,
          labelSize: scale.countLabel,
          appearance: appearance
        )
        StatBlock(
          value: stats.episodeCount,
          label: stats.episodeCountLabel,
          valueSize: scale.countValue,
          labelSize: scale.countLabel,
          appearance: appearance
        )
      }
    )
  }

  private func titleRow(_ stats: StatsData, _ appearance: WidgetAppearancePreferences, badge: CGFloat, font: CGFloat) -> some View {
    HStack(spacing: 8) {
      Text("S")
        .font(.system(size: badge * 0.54, weight: .bold))
        .foregroundColor(.white)
        .frame(width: badge, height: badge)
        .background(appearance.accentColor)
        .clipShape(RoundedRectangle(cornerRadius: badge * 0.33, style: .continuous))
      Text(stats.title)
        .font(.system(size: font, weight: .bold))
        .foregroundColor(appearance.textColor)
        .lineLimit(1)
      Spacer(minLength: 0)
    }
  }

  private func largeLayout() -> some View {
    let stats = entry.stats
    let prefs = entry.preferences
    let appearance = prefs.statsAppearance
    let scale = StatsScale.large

    return VStack(alignment: .leading, spacing: 8) {
      if prefs.statsShowTitle {
        titleRow(stats, appearance, badge: 24, font: 14)
      }

      if prefs.statsShowMovies {
        StatsCard(
          leading: movieLeading(stats, scale, appearance),
          time: stats.movieTime,
          units: stats.units,
          scale: scale,
          stacked: false,
          stretch: true,
          appearance: appearance
        )
      }

      if prefs.statsShowDuration {
        DurationStrip(stats: stats, scale: scale, padV: 9, appearance: appearance)
      }

      if prefs.statsShowTv {
        StatsCard(
          leading: tvLeading(stats, scale, appearance),
          time: stats.tvTime,
          units: stats.units,
          scale: scale,
          stacked: false,
          stretch: true,
          appearance: appearance
        )
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private func mediumLayout(height: CGFloat) -> some View {
    let stats = entry.stats
    let prefs = entry.preferences
    let appearance = prefs.statsAppearance
    let scale = StatsScale.medium

    let bothCards = prefs.statsShowMovies && prefs.statsShowTv
    let anyCard = prefs.statsShowMovies || prefs.statsShowTv
    let titleBlock: CGFloat = prefs.statsShowTitle ? StatsMediumBudget.title : 0
    let cardsBlock: CGFloat =
      bothCards ? StatsMediumBudget.bothCards : (anyCard ? StatsMediumBudget.wideCard : 0)
    let stripBlock: CGFloat =
      (anyCard ? StatsMediumBudget.gap : 0) + StatsMediumBudget.strip
    // Şerit en son feda edilir: kartlar + başlık yerleşince kalan yere sığıyorsa konur.
    let showStrip = prefs.statsShowDuration && (titleBlock + cardsBlock + stripBlock <= height)

    return VStack(alignment: .leading, spacing: StatsMediumBudget.gap) {
      if prefs.statsShowTitle {
        titleRow(stats, appearance, badge: 20, font: 13)
      }

      if bothCards {
        HStack(spacing: StatsMediumBudget.gap) {
          StatsCard(
            leading: movieLeading(stats, scale, appearance),
            time: stats.movieTime,
            units: stats.units,
            scale: scale,
            stacked: true,
            stretch: false,
            appearance: appearance
          )
          StatsCard(
            leading: tvLeading(stats, scale, appearance),
            time: stats.tvTime,
            units: stats.units,
            scale: scale,
            stacked: true,
            stretch: false,
            appearance: appearance
          )
        }
      } else if prefs.statsShowMovies {
        StatsCard(
          leading: movieLeading(stats, scale, appearance),
          time: stats.movieTime,
          units: stats.units,
          scale: scale,
          stacked: false,
          stretch: false,
          appearance: appearance
        )
      } else if prefs.statsShowTv {
        StatsCard(
          leading: tvLeading(stats, scale, appearance),
          time: stats.tvTime,
          units: stats.units,
          scale: scale,
          stacked: false,
          stretch: false,
          appearance: appearance
        )
      }

      if showStrip {
        DurationStrip(stats: stats, scale: scale, padV: 4, appearance: appearance)
      }

      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

// MARK: - Widget

struct StatsWidget: Widget {
  let kind = "StatsWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: StatsProvider()) { entry in
      StatsWidgetEntryView(entry: entry)
    }
    .configurationDisplayName(LocalizedStringKey("Seelogd Statistics"))
    .description(LocalizedStringKey("Shows your watching statistics on the home screen."))
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}
