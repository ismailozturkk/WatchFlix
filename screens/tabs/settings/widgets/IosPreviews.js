// screens/tabs/settings/widgets/IosPreviews.js
//
// iOS (WidgetKit) widget'larının önizlemesi. Android önizlemesinden AYRI çünkü
// iOS widget'ları farklı çiziliyor:
//   • poster yok → Yaklaşanlar'da F/D tür rozeti, Listelerim'de yalnız ad + sayı
//   • Listelerim'de ‹ › liste seçici yok, tüm listeler alt alta
//   • satır sayısı widget'ın GERÇEK yüksekliğinden hesaplanır (aile + yoğunluk)
//   • İstatistikler orta boyda sıkı (iki kart yan yana), büyükte esner
//
// Ölçüler SwiftUI kaynaklarından birebir (pt = RN birimi):
//   targets/reminder-widget/index.swift          → Yaklaşanlar  (ReminderMetrics)
//   targets/reminder-widget/lists-widget.swift   → Listelerim   (ListMetrics)
//   targets/reminder-widget/stats-widget.swift   → İstatistikler (StatsScale, StatsMediumBudget)
//   targets/reminder-widget/shared.swift         → fitRows, widgetContentPadding
// Sayılar widgetPlatform.js'te tek yerde; test Swift dosyalarını okuyup kilitler.
//
// Kenar boşluğu iOS 17+ sistem boşluğudur (16 pt); içerik alanı bundan düşülür. Satır
// sayısı sığdırmayla seçildiği için içerik normalde çerçeveye SIĞAR — yine de
// `overflow: hidden` korunur, taşma olursa gerçekte olduğu gibi kırpılır.

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import { useLanguage } from "@context/LanguageContext";
import { alpha } from "../../../../theme/colors";
import {
  IOS_FAMILY_SIZE,
  IOS_STATS_MEDIUM,
  IOS_STATS_SCALE,
  IOS_SYSTEM_MARGIN,
  fitRows,
  iosContentHeight,
  iosFamilyFor,
  iosListMetrics,
  iosReminderMetrics,
  iosReminderRowHeight,
  iosStatsMediumPlan,
  widgetAspect,
} from "./widgetPlatform";
import {
  buildListSamples,
  buildReminderSamples,
  countdownLabel,
} from "./widgetSamples";

// Color.wxMovie (shared.swift)
const MOVIE_ORANGE = "#E55B22";
const WIDGET_RADIUS = 22;

const etiket = (value, fallback) => String(value || fallback).trim();
const lineOf = (size) => Math.round(size * 1.2);

/**
 * Çerçevenin yüksekliği: sahne widget'ı `width` genişliğinde çizer ve çerçeve en/boy
 * oranından yükselir (aspectRatio), yani yükseklik = width / oran — ÖLÇMEYE gerek yok.
 * (Eskiden onLayout ile ölçülüyordu: aile değişince ilk karede eski yükseklikle satır
 * sayısı hesaplanıp bir kare yanlış çiziliyordu.) Genişlik yoksa referans cihaz boyu.
 */
const frameHeightOf = (width, widgetId, family) =>
  width > 0
    ? width / widgetAspect("ios", widgetId, family)
    : IOS_FAMILY_SIZE[family].height;

// ─── Yaklaşanlar ─────────────────────────────────────────────────────────────

function ReminderRow({ item, isTr, showIcon, showDate, metrics: m, p }) {
  const isMovie = item.type === "movie";
  const typeLabel = isMovie ? (isTr ? "Film" : "Movie") : isTr ? "Dizi" : "TV";
  const meta = [
    typeLabel,
    item.sub,
    showDate ? countdownLabel(item.daysLeft, isTr) : "",
  ]
    .filter(Boolean)
    .join("  •  ");

  return (
    <View
      style={[
        styles.remRow,
        {
          backgroundColor: p.surfaceAlt,
          gap: m.gap + 2,
          paddingVertical: m.padV,
        },
      ]}
    >
      {showIcon && (
        <View
          style={{
            width: m.icon,
            height: m.icon,
            borderRadius: m.icon * 0.3,
            backgroundColor: isMovie ? MOVIE_ORANGE : p.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              color: "#FFFFFF",
              fontSize: m.icon * 0.46,
              lineHeight: lineOf(m.icon * 0.46),
              fontWeight: "700",
            }}
          >
            {isMovie ? "F" : "D"}
          </Text>
        </View>
      )}
      <View style={styles.remCopy}>
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            color: p.text,
            fontSize: m.title,
            lineHeight: lineOf(m.title),
            fontWeight: "600",
          }}
        >
          {item.title}
        </Text>
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            color: p.secondaryText,
            fontSize: m.meta,
            lineHeight: lineOf(m.meta),
          }}
        >
          {meta}
        </Text>
      </View>
    </View>
  );
}

function ReminderPreview({ settings, family, width }) {
  const p = settings.appearance;
  const { language } = useLanguage();
  const isTr = language !== "en";
  const compact = settings.density === "compact";
  const m = iosReminderMetrics({ family, compact });
  const frameHeight = frameHeightOf(width, "reminders", family);
  const samples = useMemo(() => buildReminderSamples({ isTr }), [isTr]);
  const filtered =
    settings.content === "all"
      ? samples
      : samples.filter((item) => item.type === settings.content);
  const fit = fitRows({
    available: iosContentHeight(frameHeight),
    header: settings.showTitle ? m.header : 0,
    row: iosReminderRowHeight(m, settings.showPosters),
    gap: m.gap,
    label: 12,
    total: filtered.length,
    limit: settings.maxItems,
  });
  const shown = filtered.slice(0, fit.rows);
  const overflow = filtered.length - shown.length;

  return (
    <View
      style={[
        styles.frame,
        {
          backgroundColor: p.background,
          aspectRatio: widgetAspect("ios", "reminders", family),
        },
      ]}
    >
      <View style={[styles.body, { padding: IOS_SYSTEM_MARGIN, gap: m.gap }]}>
        {settings.showTitle && (
          <>
            <View style={styles.headerRow}>
              <View
                style={{
                  width: m.badge,
                  height: m.badge,
                  borderRadius: m.badge * 0.3,
                  backgroundColor: p.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  allowFontScaling={false}
                  style={{
                    color: "#FFFFFF",
                    fontSize: m.badge * 0.5,
                    lineHeight: lineOf(m.badge * 0.5),
                    fontWeight: "700",
                  }}
                >
                  S
                </Text>
              </View>
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={[
                  styles.remHeaderTitle,
                  {
                    color: p.text,
                    fontSize: m.badge >= 24 ? 15 : 13,
                    lineHeight: m.badge >= 24 ? 18 : 16,
                  },
                ]}
              >
                {isTr ? "Yaklaşanlar" : "Coming Up"}
              </Text>
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={[styles.remCount, { color: p.accent }]}
              >
                {isTr
                  ? `${filtered.length} hatırlatma`
                  : `${filtered.length} reminders`}
              </Text>
            </View>
            {m.divider && <View style={styles.divider} />}
          </>
        )}

        {shown.length === 0 ? (
          <View style={styles.empty}>
            <Text
              allowFontScaling={false}
              style={[styles.emptyText, { color: p.muted }]}
            >
              {isTr
                ? "Yaklaşan film veya bölüm yok"
                : "No upcoming movies or episodes"}
            </Text>
          </View>
        ) : (
          <>
            {shown.map((item) => (
              <ReminderRow
                key={item.id}
                item={item}
                isTr={isTr}
                showIcon={settings.showPosters}
                showDate={settings.showDates}
                metrics={m}
                p={p}
              />
            ))}
            {fit.overflow && (
              <Text
                allowFontScaling={false}
                style={[styles.overflow, { color: p.accent }]}
              >
                {isTr ? `+${overflow} daha` : `+${overflow} more`}
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ─── Listelerim ──────────────────────────────────────────────────────────────

function ListRow({ list, showCount, metrics: m, p }) {
  return (
    <View
      style={[
        styles.listRow,
        { backgroundColor: p.surfaceAlt, paddingVertical: m.padV },
      ]}
    >
      <View
        style={{
          width: m.circle,
          height: m.circle,
          borderRadius: m.circle / 2,
          backgroundColor: alpha(p.accent, 0.16),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AppIcon name={list.icon} size={m.circle * 0.5} color={p.accent} />
      </View>
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={[
          styles.listName,
          { color: p.text, fontSize: m.font, lineHeight: m.line },
        ]}
      >
        {list.name}
      </Text>
      {showCount && (
        <Text
          allowFontScaling={false}
          style={{
            color: p.accent,
            fontSize: m.font,
            lineHeight: m.line,
            fontWeight: "700",
          }}
        >
          {list.count}
        </Text>
      )}
    </View>
  );
}

function ListsPreview({ settings, family, width }) {
  const p = settings.appearance;
  const { language } = useLanguage();
  const isTr = language !== "en";
  const compact = settings.density === "compact";
  const m = iosListMetrics({ family, compact });
  const frameHeight = frameHeightOf(width, "lists", family);
  const lists = useMemo(() => buildListSamples({ isTr }), [isTr]);
  // "+N daha" etiketi yok (label çok büyük → sığmaz), sınır yok (Infinity).
  const fit = fitRows({
    available: iosContentHeight(frameHeight),
    header: settings.showTitle ? m.header : 0,
    row: m.row,
    gap: m.gap,
    label: 10000,
    total: lists.length,
    limit: Infinity,
  });
  const shown = lists.slice(0, fit.rows);

  return (
    <View
      style={[
        styles.frame,
        {
          backgroundColor: p.background,
          aspectRatio: widgetAspect("ios", "lists", family),
        },
      ]}
    >
      <View style={[styles.body, { padding: IOS_SYSTEM_MARGIN, gap: m.gap }]}>
        {settings.showTitle && (
          <View style={styles.headerRow}>
            <View
              style={{
                width: m.badge,
                height: m.badge,
                borderRadius: m.badge * 0.33,
                backgroundColor: p.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppIcon name="grid" size={m.badge * 0.46} color="#FFFFFF" />
            </View>
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={[
                styles.listsTitle,
                {
                  color: p.text,
                  fontSize: m.badge >= 22 ? 14 : 12,
                  lineHeight: m.badge >= 22 ? 17 : 15,
                },
              ]}
            >
              {isTr ? "Listelerim" : "My Lists"}
            </Text>
          </View>
        )}
        {shown.map((list) => (
          <ListRow
            key={list.id}
            list={list}
            showCount={settings.showCount}
            metrics={m}
            p={p}
          />
        ))}
      </View>
    </View>
  );
}

// ─── İstatistikler ───────────────────────────────────────────────────────────

function StatBlock({ value, label, valueSize, labelSize, p }) {
  return (
    <View style={styles.statBlock}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        allowFontScaling={false}
        style={{
          color: p.text,
          fontSize: valueSize,
          lineHeight: lineOf(valueSize),
          fontWeight: "700",
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        allowFontScaling={false}
        style={{
          color: p.muted,
          fontSize: labelSize,
          lineHeight: lineOf(labelSize),
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// Satır düzeninde (geniş / büyük kart) paneller genişliği paylaşır (flex: 1, ana eksen
// genişlik → güvenli). Alt alta düzende (orta boy, yan yana iki kart) yükseklik belirsiz;
// orada flex: 1 paneli 0 yüksekliğe çökertirdi, o yüzden panel içeriği kadar uzar.
function StatsPanel({ p, scale, stacked, children }) {
  return (
    <View
      style={[
        styles.statsPanel,
        stacked ? null : styles.statsPanelRow,
        { backgroundColor: p.surfaceAlt, paddingVertical: scale.panelPadV },
      ]}
    >
      {children}
    </View>
  );
}

function StatsCard({ p, leading, values, units, scale, stacked, stretch }) {
  const lead = (
    <StatsPanel p={p} scale={scale} stacked={stacked}>
      {leading}
    </StatsPanel>
  );
  const time = (
    <StatsPanel p={p} scale={scale} stacked={stacked}>
      <View style={styles.timeRow}>
        {values.map((value, index) => (
          <StatBlock
            key={units[index]}
            value={value}
            label={units[index]}
            valueSize={scale.unitValue}
            labelSize={scale.unitLabel}
            p={p}
          />
        ))}
      </View>
    </StatsPanel>
  );
  return (
    <View
      style={[
        stacked ? styles.cardStacked : styles.cardWide,
        stretch ? styles.cardStretch : null,
        {
          backgroundColor: p.surface,
          padding: stretch ? 6 : 4,
          borderRadius: stretch ? 16 : 12,
        },
      ]}
    >
      {lead}
      {time}
    </View>
  );
}

function DurationItem({ icon, value, label, tint, scale, p }) {
  return (
    <View style={styles.durationItem}>
      <AppIcon name={icon} size={scale.durationIcon} color={p.muted} />
      <View style={styles.durationCopy}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          allowFontScaling={false}
          style={{
            color: tint,
            fontSize: scale.durationValue,
            lineHeight: lineOf(scale.durationValue),
            fontWeight: "700",
          }}
        >
          {value}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          allowFontScaling={false}
          style={{
            color: p.muted,
            fontSize: scale.durationLabel,
            lineHeight: lineOf(scale.durationLabel),
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function StatsPreview({ settings, family, width }) {
  const p = settings.appearance;
  const { t, language } = useLanguage();
  const isTr = language !== "en";
  const large = family === "large";
  const scale = large ? IOS_STATS_SCALE.large : IOS_STATS_SCALE.medium;
  const frameHeight = frameHeightOf(width, "stats", family);
  const ps = t?.profileScreen || {};
  const hours = etiket(ps.hours, isTr ? "Saat" : "Hours");
  const units = [
    etiket(ps.years, isTr ? "Yıl" : "Years"),
    etiket(ps.months, isTr ? "Ay" : "Months"),
    etiket(ps.days, isTr ? "Gün" : "Days"),
    hours,
    etiket(ps.minutes, isTr ? "Dakika" : "Minutes"),
  ];
  // Kenar boşluğu: iOS 17+ sistem boşluğu (statsCompact yalnız iOS < 17'de dolguyu değiştirir).
  const inset = IOS_SYSTEM_MARGIN;
  const plan = iosStatsMediumPlan({
    height: iosContentHeight(frameHeight),
    showTitle: settings.showTitle,
    showMovies: settings.showMovies,
    showTv: settings.showTv,
    showDuration: settings.showDuration,
  });
  const showStrip = large ? settings.showDuration : plan.showStrip;

  // StatBlock `flex: 1` taşır; alt alta düzendeki panel içinde (yükseklik belirsiz) tek
  // başına durursa 0 yüksekliğe çöker. Satır kabına konur ki flex yatay çalışsın.
  const movieLeading = (
    <View style={styles.timeRow}>
      <StatBlock
        value="184"
        label={etiket(ps.movieWatched, isTr ? "İzlenen Filmler" : "Movies Watched")}
        valueSize={scale.countValue}
        labelSize={scale.countLabel}
        p={p}
      />
    </View>
  );
  const tvLeading = (
    <View style={styles.timeRow}>
      <StatBlock
        value="37"
        label={etiket(ps.tvShowCount, isTr ? "Dizi Sayısı" : "Shows")}
        valueSize={scale.countValue}
        labelSize={scale.countLabel}
        p={p}
      />
      <StatBlock
        value="912"
        label={etiket(
          ps.tvShowEpisodetotalCount,
          isTr ? "Bölüm Sayısı" : "Episodes",
        )}
        valueSize={scale.countValue}
        labelSize={scale.countLabel}
        p={p}
      />
    </View>
  );
  const strip = showStrip && (
    <View
      style={[
        styles.durationStrip,
        {
          backgroundColor: p.surfaceAlt,
          paddingVertical: large ? 9 : 4,
        },
      ]}
    >
      <DurationItem
        icon="time-outline"
        value={`1.284 ${hours}`}
        label={etiket(ps.totalDuration, isTr ? "Toplam Süre" : "Total Duration")}
        tint={p.accent}
        scale={scale}
        p={p}
      />
      <DurationItem
        icon="film-outline"
        value={`356 ${hours}`}
        label={etiket(t?.movies, isTr ? "Filmler" : "Movies")}
        tint={p.accent}
        scale={scale}
        p={p}
      />
      <DurationItem
        icon="tv-outline"
        value={`928 ${hours}`}
        label={etiket(t?.tvShows, isTr ? "Diziler" : "TV Shows")}
        tint={p.bold}
        scale={scale}
        p={p}
      />
    </View>
  );
  const title = settings.showTitle && (
    <View style={styles.headerRow}>
      <View
        style={{
          width: large ? 24 : 20,
          height: large ? 24 : 20,
          borderRadius: (large ? 24 : 20) * 0.33,
          backgroundColor: p.accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: "#FFFFFF",
            fontSize: (large ? 24 : 20) * 0.54,
            lineHeight: 16,
            fontWeight: "700",
          }}
        >
          S
        </Text>
      </View>
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={[
          styles.listsTitle,
          {
            color: p.text,
            fontSize: large ? 14 : 13,
            lineHeight: large ? 17 : 16,
          },
        ]}
      >
        {isTr ? "İstatistikler" : "Statistics"}
      </Text>
    </View>
  );

  const movieCard = (stacked, stretch) => (
    <StatsCard
      p={p}
      units={units}
      values={["0", "4", "11", "6", "30"]}
      leading={movieLeading}
      scale={scale}
      stacked={stacked}
      stretch={stretch}
    />
  );
  const tvCard = (stacked, stretch) => (
    <StatsCard
      p={p}
      units={units}
      values={["0", "1", "8", "16", "45"]}
      leading={tvLeading}
      scale={scale}
      stacked={stacked}
      stretch={stretch}
    />
  );

  return (
    <View
      style={[
        styles.frame,
        {
          backgroundColor: p.background,
          aspectRatio: widgetAspect("ios", "stats", family),
        },
      ]}
    >
      {large ? (
        <View style={[styles.body, { padding: inset, gap: 8 }]}>
          {title}
          {settings.showMovies && movieCard(false, true)}
          {strip}
          {settings.showTv && tvCard(false, true)}
        </View>
      ) : (
        <View style={[styles.body, { padding: inset, gap: IOS_STATS_MEDIUM.gap }]}>
          {title}
          {plan.bothCards ? (
            <View style={styles.mediumCards}>
              {movieCard(true, false)}
              {tvCard(true, false)}
            </View>
          ) : settings.showMovies ? (
            movieCard(false, false)
          ) : settings.showTv ? (
            tvCard(false, false)
          ) : null}
          {strip}
        </View>
      )}
    </View>
  );
}

/**
 * @param {object} props
 * @param {"reminders"|"lists"|"stats"} props.active
 * @param {object} props.settings Seçili widget'ın tercihleri
 * @param {"medium"|"large"} props.family Widget ailesi
 * @param {number} [props.width] Çerçevenin çizildiği genişlik (satır sığdırma yüksekliği buradan türetir)
 */
export default function IosWidgetPreview({ active, settings, family, width }) {
  const resolved = iosFamilyFor(active, family);
  if (active === "reminders") {
    return <ReminderPreview settings={settings} family={resolved} width={width} />;
  }
  if (active === "lists") {
    return <ListsPreview settings={settings} family={resolved} width={width} />;
  }
  return <StatsPreview settings={settings} family={resolved} width={width} />;
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    borderRadius: WIDGET_RADIUS,
    overflow: "hidden",
  },
  // Aileye sığmayan içerik alttan kırpılır (frame overflow: hidden).
  body: { flex: 1 },

  // Ortak başlık şeridi
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)" },

  /* Yaklaşanlar */
  remHeaderTitle: { flex: 1, fontWeight: "700" },
  remCount: { fontSize: 10, lineHeight: 12, fontWeight: "700" },
  remRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  remCopy: { flex: 1, gap: 1 },
  overflow: { fontSize: 10, lineHeight: 12, fontWeight: "700", textAlign: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 12, lineHeight: 14, textAlign: "center" },

  /* Listelerim */
  listsTitle: { flex: 1, fontWeight: "700" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  listName: { flex: 1, fontWeight: "600" },

  /* İstatistikler */
  statsPanel: {
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: "stretch",
    justifyContent: "center",
  },
  // Büyük boyda panel kalan yüksekliği doldurur (Swift: maxHeight .infinity): kart
  // satırında alignItems varsayılanı stretch olduğundan yükseklik kartı izler.
  statsPanelRow: { flex: 1 },
  cardWide: { flexDirection: "row", gap: 5 },
  cardStacked: { flex: 1, gap: 3 },
  cardStretch: { flex: 1 },
  mediumCards: { flexDirection: "row", gap: IOS_STATS_MEDIUM.gap },
  timeRow: { flexDirection: "row", alignItems: "center" },
  statBlock: { flex: 1, alignItems: "center", gap: 1 },
  durationStrip: {
    flexDirection: "row",
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  durationItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  durationCopy: { flex: 1 },
});
