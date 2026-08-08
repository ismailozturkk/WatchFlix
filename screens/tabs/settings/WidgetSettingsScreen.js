import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import SwitchToggle from "@components/SwitchToggle";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { alpha, buildCustomTheme, themes } from "../../../theme/colors";
import { toHex } from "../../../utils/colorUtils";
import { i18nText } from "@utils/i18nText";
import {
  DEFAULT_WIDGET_PREFERENCES,
  loadWidgetPreferences,
  resetWidgetPreferences,
  saveWidgetPreferences,
} from "@services/widgetPreferencesService";
import {
  SectionLabel,
  SettingsSubScreen,
  buildUiColors,
} from "./settingsUi";

const WIDGETS = [
  { id: "reminders", icon: "time-outline", titleKey: "widget_upcoming" },
  { id: "lists", icon: "grid-outline", titleKey: "widget_lists" },
  { id: "stats", icon: "stats-chart-outline", titleKey: "widget_stats" },
];

const BUILTIN_THEMES = [
  { id: "gray", labelKey: "grayTheme", fallback: "Gri" },
  { id: "blue", labelKey: "blueTheme", fallback: "Lacivert" },
  { id: "green", labelKey: "greenTheme", fallback: "Yeşil" },
  { id: "dark", labelKey: "darkTheme", fallback: "AMOLED" },
  { id: "light", labelKey: "lightTheme", fallback: "Açık" },
  { id: "purple", labelKey: "purpleTheme", fallback: "Gece Moru" },
  { id: "amber", labelKey: "amberTheme", fallback: "Sinema" },
];

const POSTERS = [
  "https://image.tmdb.org/t/p/w342/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
  "https://image.tmdb.org/t/p/w342/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
  "https://image.tmdb.org/t/p/w342/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg",
  "https://image.tmdb.org/t/p/w342/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  "https://image.tmdb.org/t/p/w342/bQLrHIRNEkE3PdIWQrZHynQZazu.jpg",
  "https://image.tmdb.org/t/p/w342/2IWouZK4gkgHhJa3oyYuSWfSqbG.jpg",
  "https://image.tmdb.org/t/p/w342/7WUHnWGx5OO145IRxPDUkQSh4C7.jpg",
  "https://image.tmdb.org/t/p/w342/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
  "https://image.tmdb.org/t/p/w342/6LWy0jvMpmjoS9fojNgHIKoWL05.jpg",
];

const copy = (key, fallback, options) =>
  i18nText(`autoI18n.${key}`, fallback, options);

// Widget'ın ana ekrandaki gerçek en/boy oranı (res/xml/*_widget_info.xml
// targetCellWidth × targetCellHeight). Yaklaşanlar ve Listeler 4×3 hücre —
// yani ENİNE; İstatistikler 4×4 — kareye yakın. Önizleme bu orana oturur ve
// taşan içerik gerçeğinde olduğu gibi kırpılır (ikisi de kaydırılabilir liste).
const WIDGET_ASPECT = { reminders: 1.4, lists: 1.35, stats: 1.05 };

// GridView horizontalSpacing/verticalSpacing = 6dp (lists_widget.xml).
const GRID_GAP = 6;

// Widget metinleri: dize kaynağı GERÇEK widget ile aynı olmalı.
// • Sabit metinleri (başlık, sayaç, boş durum, tip etiketi) provider'lar dile
//   göre kendisi yazar — burada da öyle yazılır.
// • İstatistik etiketleri payload'dan gelir (services/statsWidgetService.js →
//   ProfileStatsContext → t.profileScreen.*) — aynı anahtarlar kullanılır ki
//   iki dilde de birebir aynı kelime çıksın. Bu anahtarların başında boşluk
//   var (" Yıl"), o yüzden trim edilir.
const etiket = (value, fallback) => String(value || fallback).trim();

const chunk = (list, size) =>
  list.reduce((acc, item, index) => {
    if (index % size === 0) acc.push([]);
    acc[acc.length - 1].push(item);
    return acc;
  }, []);

const appearanceFromPalette = (themeId, themeName, palette) => ({
  themeId,
  themeName,
  background: toHex(palette.primary),
  surface: toHex(palette.secondary),
  surfaceAlt: toHex(palette.between),
  border: toHex(palette.border),
  text: toHex(palette.text.primary),
  secondaryText: toHex(palette.text.secondary),
  muted: toHex(palette.text.muted),
  accent: toHex(palette.accent),
  bold: toHex(palette.bold || palette.accent),
});

function Segment({ options, value, onChange, colors }) {
  return (
    <View
      style={[
        styles.segment,
        { backgroundColor: colors.cardAlt, borderColor: colors.border },
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            activeOpacity={0.72}
            onPress={() => onChange(option.value)}
            style={[
              styles.segmentButton,
              active && { backgroundColor: colors.accent },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.segmentText,
                { color: active ? colors.white : colors.muted },
                active && styles.segmentTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function OptionRow({ icon, title, subtitle, value, onChange, colors, last }) {
  return (
    <View
      style={[
        styles.optionRow,
        { borderBottomColor: colors.borderMuted },
        last && styles.noBorder,
      ]}
    >
      <View style={[styles.optionIcon, { backgroundColor: colors.accentDim }]}>
        <AppIcon name={icon} size={16} color={colors.accent} />
      </View>
      <View style={styles.optionCopy}>
        <Text style={[styles.optionTitle, { color: colors.text }]}>{title}</Text>
        {!!subtitle && (
          <Text style={[styles.optionSubtitle, { color: colors.muted }]}>
            {subtitle}
          </Text>
        )}
      </View>
      <SwitchToggle value={value} onValueChange={onChange} size={36} />
    </View>
  );
}

// ─── Gerçek widget ölçüleri ──────────────────────────────────────────────────
//
// Aşağıdaki bileşenler ana ekrandaki widget'ın BİREBİR kopyasıdır: sayılar
// native kaynaklardan alınır (Android dp'si RN biriminde 1:1 karşılanır), uydurma
// değer yok. Kaynaklar:
//   • native/android-widgets/res/layout/reminder_widget.xml (+ _item)
//   • native/android-widgets/res/layout/lists_widget.xml (+ _item)
//   • native/android-widgets/res/drawable/*.xml            (köşe yarıçapı/dolgu)
//   • .../widget/ReminderWidgetProvider.kt + ReminderWidgetRemoteViewsService.kt
//   • .../widget/ListsWidgetProvider.kt        (çalışma anı renkleri/görünürlük)
// Renkler tema paletinden ÇALIŞMA ANINDA basılır (WidgetThemeViews.tintBackground):
// kök = background, öne çıkan satır = surface, diğer satır = surfaceAlt.
const LOGO_KAYNAK = require("../../../assets/android-icon-monochrome.png");

function Poster({ uri, style, contain }) {
  return (
    <View style={[styles.posterFallback, style]}>
      <Image
        source={{ uri }}
        resizeMode={contain ? "contain" : "cover"}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

// Uygulama logosu rozeti. Gradyan SABİTTİR (reminder_widget_logo_badge.xml):
// tema değişince bile mor kalır — widget'ın kimliği bu rozet.
function WidgetBrand({ size = 28, radius = 9 }) {
  return (
    <LinearGradient
      colors={["#8E7CFF", "#574BDB"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.brand,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <Image
        source={LOGO_KAYNAK}
        resizeMode="contain"
        style={{ width: size - 8, height: size - 8, tintColor: "#FFFFFF" }}
      />
    </LinearGradient>
  );
}

// Örnek satırlar. Meta biçimi servisteki ile aynı: "Tip  •  alt bilgi"
// (ReminderWidgetRemoteViewsService.kt, joinToString("  •  ")).
const REMINDER_SAMPLES = [
  {
    title: "Spider-Man: Brand New Day",
    type: "movie",
    sub: "",
    when: "Bugün",
    date: "30 Tem",
    today: true,
  },
  {
    title: "Silo",
    type: "tv",
    sub: "S3 · 5. Bölüm",
    when: "Bugün",
    date: "30 Tem",
    today: true,
  },
  {
    title: "House of the Dragon",
    type: "tv",
    sub: "S3 · 7. Bölüm",
    when: "3 gün",
    date: "2 Ağu",
  },
  {
    title: "Dune: Part Three",
    type: "movie",
    sub: "",
    when: "6 gün",
    date: "5 Ağu",
  },
  {
    title: "Silo",
    type: "tv",
    sub: "S3 · 6. Bölüm",
    when: "7 gün",
    date: "6 Ağu",
  },
  {
    title: "The Batman: Part II",
    type: "movie",
    sub: "",
    when: "12 gün",
    date: "11 Ağu",
  },
  {
    title: "Severance",
    type: "tv",
    sub: "S3 · 1. Bölüm",
    when: "18 gün",
    date: "17 Ağu",
  },
  {
    title: "Avatar: Fire and Ash",
    type: "movie",
    sub: "",
    when: "24 gün",
    date: "23 Ağu",
  },
];

function ReminderPreview({ settings }) {
  const p = settings.appearance;
  const { language } = useLanguage();
  // Provider dizeleri dile göre kendisi yazar (ReminderWidgetProvider.kt).
  const isTr = language !== "en";
  const compact = settings.density === "compact";
  const filtered =
    settings.content === "all"
      ? REMINDER_SAMPLES
      : REMINDER_SAMPLES.filter((item) => item.type === settings.content);
  // Servis `take(maxItems)` yapar — eksikse eksik gösterilir, tekrar edilmez.
  const display = filtered.slice(0, settings.maxItems);
  const typeLabel = (type) =>
    type === "movie" ? (isTr ? "Film" : "Movie") : isTr ? "Dizi" : "TV";

  return (
    <View
      style={[
        styles.widgetFrame,
        styles.reminderRoot,
        { backgroundColor: p.background, aspectRatio: WIDGET_ASPECT.reminders },
      ]}
    >
      {/* Başlık şeridi. showTitle YALNIZCA logo + başlığı gizler; sayaç rozeti
          gerçekte kalmaya devam eder (ReminderWidgetProvider.kt). */}
      <View style={styles.remHeader}>
        {/* Başlık gizlenince rozet SOLA yaslanır: native LinearLayout'un
            varsayılan start hizalaması budur, sağa itilmez. */}
        {settings.showTitle && (
          <>
            <WidgetBrand size={28} radius={9} />
            <Text
              numberOfLines={1}
              style={[styles.remTitle, { color: p.text }]}
            >
              {isTr ? "Yaklaşanlar" : "Coming Up"}
            </Text>
          </>
        )}
        <View
          // Rozetin dolgusu/çerçevesi çalışma anında BOYANMAZ: her temada aynı
          // indigo yıkama kalır, yalnız metin aksana döner (count_badge drawable).
          style={styles.remCountBadge}
        >
          <Text
            allowFontScaling={false}
            style={[styles.remCountText, { color: p.accent }]}
          >
            {display.length} {isTr ? "hatırlatma" : "reminders"}
          </Text>
        </View>
      </View>

      {/* Gerçeğinde bu bir ListView'dur: çerçeveye sığmayan satırlar kırpılır ve
          kaydırılarak görülür. Önizleme de öyle — böylece "5 öğe" ile "8 öğe"
          farkı hem sayaçta hem kaydırılabilir içerikte gerçekten görünür. */}
      {display.length === 0 ? (
        <View style={styles.remEmpty}>
          {/* İkon sabit gri (reminder_widget_ic_empty), yalnız metin temaya uyar. */}
          <AppIcon name="calendar-outline" size={30} color="#9AA3B8" />
          <Text style={[styles.remEmptyText, { color: p.muted }]}>
            {isTr
              ? "Yaklaşan film veya bölüm yok"
              : "No upcoming movies or episodes"}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.widgetScroll}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {display.map((item, index) => (
          <View
            key={`${item.title}-${index}`}
            style={[
              styles.remRow,
              {
                // Satır zemini DÜZ RENK DEĞİL. Provider drawable'ı SRC_IN ile
                // boyar; kaynak alfa korunduğu için sonuç, temanın renginin
                // saydam bir yıkaması olur: bugünküler surface @%16
                // (row_bg_today #2A…), diğerleri surfaceAlt @%8 (row_bg #14…).
                backgroundColor: item.today
                  ? alpha(p.surface, 0.165)
                  : alpha(p.surfaceAlt, 0.078),
                borderColor: item.today
                  ? alpha(p.surface, 0.3)
                  : alpha(p.surfaceAlt, 0.063),
                // Dolgu 1'er azaltıldı: RN kenarlığı kutuya EKLER, native ise
                // 1dp çizgiyi içeri çizer — satır yüksekliği 64/58 kalsın.
                paddingHorizontal: compact ? 5 : 7,
                paddingVertical: compact ? 3 : 6,
              },
            ]}
          >
            {settings.showPosters && (
              <Poster
                uri={POSTERS[index % POSTERS.length]}
                style={styles.remPoster}
              />
            )}
            <View style={styles.remCopy}>
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={[
                  styles.remName,
                  { color: p.text, fontSize: compact ? 11 : 12 },
                ]}
              >
                {item.title}
              </Text>
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={[styles.remMeta, { color: p.secondaryText }]}
              >
                {[typeLabel(item.type), item.sub].filter(Boolean).join("  •  ")}
              </Text>
            </View>
            <View style={styles.remWhenBox}>
              <Text
                allowFontScaling={false}
                style={[
                  styles.remWhen,
                  { color: item.today ? p.accent : p.text },
                ]}
              >
                {item.when}
              </Text>
              {settings.showDates && (
                <Text
                  allowFontScaling={false}
                  style={[styles.remDate, { color: p.muted }]}
                >
                  {item.date}
                </Text>
              )}
            </View>
          </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function ListsPreview({ settings }) {
  const p = settings.appearance;
  const { language } = useLanguage();
  const isTr = language !== "en";
  const compact = settings.density === "compact";
  // Gerçek widget hücreleri 3 sütunda 6dp aralıkla dizilir; hücre yüksekliği
  // SABİT 112dp (lists_widget_item.xml) ve poster fitCenter olduğu için 2:3
  // afişin solunda/sağında hücre zemini şerit olarak görünür — ızgaranın en
  // tanınır özelliği bu.
  const cells = Array.from(
    { length: settings.maxPosters },
    (_, index) => POSTERS[index % POSTERS.length],
  );
  return (
    <View
      style={[
        styles.widgetFrame,
        styles.listsRoot,
        { backgroundColor: p.background, aspectRatio: WIDGET_ASPECT.lists },
      ]}
    >
      {/* Liste seçici şeridi. showTitle YALNIZCA ikon + adı gizler; şerit,
          sayaç ve ‹ 1/4 › kümesi yerinde kalır (ListsWidgetProvider.kt). */}
      <View
        style={[
          styles.listsHeader,
          {
            // Satırlarla aynı kural: header_bg #14FFFFFF olduğu için sonuç
            // surface'in %8'lik yıkaması, düz surface değil.
            backgroundColor: alpha(p.surface, 0.078),
            borderColor: alpha(p.surface, 0.07),
          },
        ]}
      >
        {settings.showTitle && (
          <>
            <View style={styles.listIconDot}>
              <AppIcon name="tv" size={14} color={p.accent} />
            </View>
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={[styles.listsTitle, { color: p.text }]}
            >
              {isTr ? "Listelerim" : "My Lists"}
            </Text>
          </>
        )}
        {settings.showCount && (
          <Text
            allowFontScaling={false}
            style={[styles.listCount, { color: p.accent }]}
          >
            80
          </Text>
        )}
        {settings.showNavigation && (
          <>
            <View style={styles.navButton}>
              <AppIcon name="chevron-back" size={12} color={p.secondaryText} />
            </View>
            <Text
              allowFontScaling={false}
              style={[styles.listPosition, { color: p.muted }]}
            >
              1/4
            </Text>
            <View style={styles.navButton}>
              <AppIcon name="chevron-forward" size={12} color={p.secondaryText} />
            </View>
          </>
        )}
      </View>

      {/* Gerçeğinde kaydırılabilir bir GridView: 12 ile 18 poster farkı
          kaydırınca görünür, tıpkı ana ekrandaki gibi. */}
      <ScrollView
        style={[styles.widgetScroll, styles.posterGrid]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {chunk(cells, 3).map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.gridRow}>
            {row.map((uri, index) => (
              <View
                key={`${uri}-${index}`}
                style={[
                  styles.gridCell,
                  { backgroundColor: p.surfaceAlt, padding: compact ? 2 : 5 },
                ]}
              >
                {/* Yan şeritler hücre zeminiyle AYNI renk olmalı: gerçekte
                    poster_bg da temanın surfaceAlt'ıyla boyanır. */}
                <Poster
                  uri={uri}
                  style={[styles.gridPoster, { backgroundColor: p.surfaceAlt }]}
                  contain
                />
              </View>
            ))}
            {/* Son satır eksikse boş hücreler koy: yoksa kalan afişler
                genişleyip ızgara sütun hizasını kaybeder. */}
            {Array.from({ length: 3 - row.length }, (_, index) => (
              <View key={`bos-${index}`} style={styles.gridCellEmpty} />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// Sağ paneldeki beş eşit sütun: değer 15sp bold, etiket 8sp muted.
const TimeUnit = ({ value, label, palette }) => (
  <View style={styles.timeUnit}>
    <Text allowFontScaling={false} style={[styles.timeValue, { color: palette.text }]}>
      {value}
    </Text>
    <Text
      numberOfLines={1}
      allowFontScaling={false}
      style={[styles.timeLabel, { color: palette.muted }]}
    >
      {label}
    </Text>
  </View>
);

// Sol paneldeki büyük sayaç: 19sp bold + 9sp etiket (Android ölçüsü).
const CountBlock = ({ value, label, palette }) => (
  <View style={styles.countBlock}>
    <Text allowFontScaling={false} style={[styles.bigStat, { color: palette.text }]}>
      {value}
    </Text>
    <Text
      numberOfLines={1}
      allowFontScaling={false}
      style={[styles.statCaption, { color: palette.muted }]}
    >
      {label}
    </Text>
  </View>
);

// Kart gövdesi: 315° gradyan (sol üstte %18 surface → sağ altta tam surface),
// 18dp köşe, %12 surface hairline (stats_widget_card_bg + runtime tint).
function StatsCard({ palette, style, children }) {
  return (
    <LinearGradient
      colors={[alpha(palette.surface, 0.18), palette.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.statsCard, { borderColor: alpha(palette.surface, 0.12) }, style]}
    >
      {children}
    </LinearGradient>
  );
}

function StatsPreview({ settings }) {
  const p = settings.appearance;
  const { t, language } = useLanguage();
  const isTr = language !== "en";
  const compact = settings.density === "compact";
  // Etiketler widget'a hangi anahtarlardan gidiyorsa buraya da oradan gelir
  // (ProfileStatsContext.labels → statsWidgetService payload).
  const ps = t?.profileScreen || {};
  const saatEtiketi = etiket(ps.hours, isTr ? "Saat" : "Hours");
  // Yoğunluk bu widget'ta YALNIZCA kök dolguyu değiştirir (StatsWidgetProvider
  // setViewPadding); bölüm araları ve punto sabittir.
  const birimler = (values) =>
    [
      [values[0], etiket(ps.years, isTr ? "Yıl" : "Years")],
      [values[1], etiket(ps.months, isTr ? "Ay" : "Months")],
      [values[2], etiket(ps.days, isTr ? "Gün" : "Days")],
      [values[3], saatEtiketi],
      [values[4], etiket(ps.minutes, isTr ? "Dakika" : "Minutes")],
    ].map(([value, label]) => (
      <TimeUnit key={label} value={value} label={label} palette={p} />
    ));

  return (
    <View
      style={[
        styles.widgetFrame,
        {
          backgroundColor: p.background,
          aspectRatio: WIDGET_ASPECT.stats,
          paddingHorizontal: compact ? 8 : 12,
          paddingVertical: compact ? 7 : 11,
        },
      ]}
    >
      {settings.showTitle && (
        <View style={styles.statsHeader}>
          <WidgetBrand size={24} radius={9} />
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={[styles.statsHeaderTitle, { color: p.text }]}
          >
            {isTr ? "İstatistikler" : "Statistics"}
          </Text>
        </View>
      )}

      {settings.showMovies && (
        <StatsCard palette={p}>
          <View style={[styles.statsPanel, styles.statsCountPanel, { backgroundColor: alpha(p.surfaceAlt, 0.85) }]}>
            <CountBlock
              value="184"
              label={etiket(ps.movieWatched, isTr ? "İzlenen Filmler" : "Movies Watched")}
              palette={p}
            />
          </View>
          <View style={[styles.statsPanel, styles.statsTimePanel, { backgroundColor: alpha(p.surfaceAlt, 0.85) }]}>
            {birimler(["0", "1", "8", "6", "56"])}
          </View>
        </StatsCard>
      )}

      {settings.showDuration && (
        <View
          style={[
            styles.statsStrip,
            {
              backgroundColor: alpha(p.surfaceAlt, 0.07),
              borderColor: alpha(p.surfaceAlt, 0.1),
            },
          ]}
        >
          {[
            ["time-outline", "1.284", etiket(ps.totalDuration, isTr ? "Toplam Süre" : "Total Duration"), p.accent],
            ["film-outline", "356", etiket(t?.movies, isTr ? "Filmler" : "Movies"), p.accent],
            ["tv-outline", "928", etiket(t?.tvShows, isTr ? "Diziler" : "TV Shows"), p.bold],
          ].map(([icon, value, label, tint]) => (
            <View key={icon} style={styles.durationGroup}>
              {/* Üç ikon da sabit gri: provider bunları yeniden boyamaz. */}
              <AppIcon name={icon} size={14} color="#9AA3B8" />
              <View style={styles.durationCopy}>
                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={[styles.durationNumber, { color: tint }]}
                >
                  {value} {saatEtiketi}
                </Text>
                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={[styles.durationCaption, { color: p.muted }]}
                >
                  {label}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {settings.showTv && (
        <StatsCard palette={p} style={styles.statsCardFollow}>
          <View
            style={[
              styles.statsPanel,
              styles.statsCountPanel,
              styles.statsTvCountPanel,
              { backgroundColor: alpha(p.surfaceAlt, 0.85) },
            ]}
          >
            <CountBlock
              value="37"
              label={etiket(ps.tvShowCount, isTr ? "Dizi Sayısı" : "Series Count")}
              palette={p}
            />
            <CountBlock
              value="912"
              label={etiket(
                ps.tvShowEpisodetotalCount,
                isTr ? "Bölüm Sayısı" : "Episode Count",
              )}
              palette={p}
            />
          </View>
          <View style={[styles.statsPanel, styles.statsTimePanel, { backgroundColor: alpha(p.surfaceAlt, 0.85) }]}>
            {birimler(["0", "3", "20", "8", "35"])}
          </View>
        </StatsCard>
      )}
    </View>
  );
}

function WidgetPreview({ active, settings }) {
  if (active === "reminders") return <ReminderPreview settings={settings} />;
  if (active === "lists") return <ListsPreview settings={settings} />;
  return <StatsPreview settings={settings} />;
}

function ThemeCard({ item, active, onPress, uiColors }) {
  const p = item.appearance;
  return (
    <TouchableOpacity
      activeOpacity={0.76}
      onPress={onPress}
      style={[
        styles.themeCard,
        {
          backgroundColor: p.background,
          borderColor: active ? p.accent : p.border,
        },
        active && styles.themeCardActive,
      ]}
    >
      <View style={[styles.themeMiniSurface, { backgroundColor: p.surface }]}>
        <View style={[styles.themeMiniAccent, { backgroundColor: p.accent }]} />
        <View style={styles.themeMiniLines}>
          <View style={[styles.themeMiniLine, { backgroundColor: p.text }]} />
          <View
            style={[
              styles.themeMiniLine,
              { width: "58%", backgroundColor: p.muted },
            ]}
          />
        </View>
        {active && (
          <View style={[styles.themeCheck, { backgroundColor: p.accent }]}>
            <AppIcon name="checkmark" size={10} color="#FFFFFF" />
          </View>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={[styles.themeName, { color: active ? uiColors.text : uiColors.muted }]}
      >
        {item.name}
      </Text>
      {item.custom && (
        <Text style={[styles.customLabel, { color: uiColors.accent }]}>
          {copy("widget_custom_theme", "ÖZEL")}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function SelectedFeatureChips({ active, settings }) {
  const items = [
    settings.appearance.themeName,
    settings.density === "compact"
      ? copy("widget_compact", "Kompakt")
      : copy("widget_comfortable", "Rahat"),
  ];
  if (active === "reminders") {
    items.push(`${settings.maxItems} ${copy("widget_item", "öğe")}`);
    items.push(
      settings.content === "all"
        ? copy("tumu", "Tümü")
        : settings.content === "movie"
          ? copy("film", "Film")
          : copy("dizi", "Dizi"),
    );
  } else if (active === "lists") {
    items.push(`${settings.maxPosters} ${copy("poster", "poster")}`);
  } else {
    const visible =
      Number(settings.showMovies) +
      Number(settings.showTv) +
      Number(settings.showDuration);
    items.push(`${visible}/3 ${copy("widget_section", "bölüm")}`);
  }
  return (
    <View style={styles.featureChips}>
      {items.map((item, index) => (
        <View
          key={`${item}-${index}`}
          style={[
            styles.featureChip,
            {
              backgroundColor: alpha(settings.appearance.accent, 0.12),
              borderColor: alpha(settings.appearance.accent, 0.28),
            },
          ]}
        >
          {index === 0 && (
            <View
              style={[
                styles.featureDot,
                { backgroundColor: settings.appearance.accent },
              ]}
            />
          )}
          <Text style={[styles.featureText, { color: settings.appearance.accent }]}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function WidgetSettingsScreen() {
  const { theme, customThemes = [] } = useTheme();
  const C = buildUiColors(theme);
  const [activeWidget, setActiveWidget] = useState("reminders");
  const [preferences, setPreferences] = useState(DEFAULT_WIDGET_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const persistTimer = useRef(null);

  const themeCatalog = useMemo(() => {
    const builtins = BUILTIN_THEMES.map((item) => ({
      id: item.id,
      name: i18nText(item.labelKey, item.fallback),
      appearance: appearanceFromPalette(
        item.id,
        i18nText(item.labelKey, item.fallback),
        themes[item.id],
      ),
      custom: false,
    }));
    const custom = customThemes.map((item) => {
      const id = `custom:${item.id}`;
      // Rozet metni ("ÖZEL") ile tema ADI ayrı anahtar: tek anahtar
      // paylaşılınca ikisinden biri kaçınılmaz olarak yanlış görünüyordu.
      const name = item.name || copy("widget_custom_theme_name", "Özel Tema");
      return {
        id,
        name,
        appearance: appearanceFromPalette(
          id,
          name,
          buildCustomTheme(item.tokens),
        ),
        custom: true,
      };
    });
    return [...builtins, ...custom];
  }, [customThemes]);

  useEffect(() => {
    let mounted = true;
    loadWidgetPreferences().then((loaded) => {
      if (!mounted) return;
      setPreferences(loaded);
      setReady(true);
    });
    return () => {
      mounted = false;
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    setSaving(true);
    persistTimer.current = setTimeout(() => {
      saveWidgetPreferences(preferences).finally(() => setSaving(false));
    }, 220);
    return () => clearTimeout(persistTimer.current);
  }, [preferences, ready]);

  const patchActive = useCallback(
    (next) => {
      setPreferences((current) => ({
        ...current,
        [activeWidget]: { ...current[activeWidget], ...next },
      }));
    },
    [activeWidget],
  );

  const patchAppearance = useCallback(
    (next) => {
      setPreferences((current) => ({
        ...current,
        [activeWidget]: {
          ...current[activeWidget],
          appearance: {
            ...current[activeWidget].appearance,
            ...next,
          },
        },
      }));
    },
    [activeWidget],
  );

  const handleReset = useCallback(async () => {
    setSaving(true);
    const defaults = await resetWidgetPreferences();
    setPreferences(defaults);
    setSaving(false);
  }, []);

  if (!ready) {
    return (
      <SettingsSubScreen title={copy("widget_settings_title", "Widget’lar")}>
        <View style={styles.loading}>
          <ActivityIndicator color={C.accent} />
        </View>
      </SettingsSubScreen>
    );
  }

  const settings = preferences[activeWidget];
  const accentOptions = Array.from(
    new Set(
      themeCatalog.flatMap((item) => [
        item.appearance.accent,
        item.appearance.bold,
      ]),
    ),
  );

  return (
    <SettingsSubScreen title={copy("widget_settings_title", "Widget’lar")}>
      <View style={styles.heroHeader}>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroEyebrow, { color: C.accent }]}>
            {copy("widget_live_preview", "CANLI ÖNİZLEME")}
          </Text>
          <Text style={[styles.heroSubtitle, { color: C.muted }]}>
            {copy(
              "widget_exact_preview_description",
              "Önizleme ana ekrandaki gerçek boyut ve düzeni yansıtır",
            )}
          </Text>
        </View>
        <View style={[styles.saveState, { backgroundColor: C.accentDim }]}>
          <View
            style={[
              styles.saveDot,
              { backgroundColor: saving ? C.amber : C.green },
            ]}
          />
          <Text style={[styles.saveText, { color: C.text }]}>
            {saving
              ? copy("widget_saving", "Kaydediliyor")
              : copy("widget_saved", "Güncel")}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.widgetTabs,
          { backgroundColor: C.card, borderColor: C.border },
        ]}
      >
        {WIDGETS.map((widget) => {
          const active = activeWidget === widget.id;
          return (
            <TouchableOpacity
              key={widget.id}
              onPress={() => setActiveWidget(widget.id)}
              style={[
                styles.widgetTab,
                active && { backgroundColor: C.accent },
              ]}
            >
              <AppIcon
                name={widget.icon}
                size={15}
                color={active ? C.white : C.muted}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.widgetTabText,
                  { color: active ? C.white : C.muted },
                ]}
              >
                {copy(widget.titleKey, widget.id)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.previewStage}>
        <WidgetPreview active={activeWidget} settings={settings} />
      </View>
      <SelectedFeatureChips active={activeWidget} settings={settings} />

      <SectionLabel color={C.muted}>
        {copy("widget_private_appearance", "BU WIDGET’A ÖZEL GÖRÜNÜM")}
      </SectionLabel>
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.controlBlock}>
          <View style={styles.controlHeading}>
            <View>
              <Text style={[styles.controlTitle, { color: C.text }]}>
                {copy("widget_theme", "Widget teması")}
              </Text>
              <Text style={[styles.controlHint, { color: C.muted }]}>
                {copy(
                  "widget_theme_description",
                  "Uygulama temaları ve oluşturduğun özel temalar",
                )}
              </Text>
            </View>
            <View
              style={[
                styles.activePalette,
                { backgroundColor: settings.appearance.accent },
              ]}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.themeScroll}
          >
            {themeCatalog.map((item) => (
              <ThemeCard
                key={item.id}
                item={item}
                uiColors={C}
                active={settings.appearance.themeId === item.id}
                onPress={() => patchAppearance(item.appearance)}
              />
            ))}
          </ScrollView>
        </View>

        <View
          style={[
            styles.controlBlock,
            { borderTopColor: C.borderMuted, borderTopWidth: 1 },
          ]}
        >
          <Text style={[styles.controlTitle, { color: C.text }]}>
            {copy("widget_accent", "Vurgu rengi")}
          </Text>
          <Text style={[styles.controlHint, { color: C.muted }]}>
            {copy(
              "widget_theme_accent_description",
              "Tema paletlerinden bir vurgu seç; önizlemede anında gör",
            )}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accentRow}
          >
            {accentOptions.map((accent) => {
              const selected = settings.appearance.accent === accent;
              return (
                <TouchableOpacity
                  key={accent}
                  onPress={() => patchAppearance({ accent, bold: accent })}
                  style={[
                    styles.accentButton,
                    { backgroundColor: accent },
                    selected && styles.accentButtonSelected,
                  ]}
                >
                  {selected && (
                    <AppIcon name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View
          style={[
            styles.controlBlock,
            { borderTopColor: C.borderMuted, borderTopWidth: 1 },
          ]}
        >
          <Text style={[styles.controlTitle, { color: C.text }]}>
            {copy("widget_density", "İçerik yoğunluğu")}
          </Text>
          <Segment
            colors={C}
            value={settings.density}
            onChange={(density) => patchActive({ density })}
            options={[
              { value: "compact", label: copy("widget_compact", "Kompakt") },
              {
                value: "comfortable",
                label: copy("widget_comfortable", "Rahat"),
              },
            ]}
          />
        </View>
        <OptionRow
          colors={C}
          icon="text-outline"
          title={copy("widget_show_title", "Widget başlığını göster")}
          subtitle={copy(
            "widget_show_title_description",
            "Logo ve bölüm adını üst alanda tutar",
          )}
          value={settings.showTitle}
          onChange={(showTitle) => patchActive({ showTitle })}
          last
        />
      </View>

      <SectionLabel color={C.muted}>
        {copy(
          activeWidget === "reminders"
            ? "widget_upcoming"
            : activeWidget === "lists"
              ? "widget_lists"
              : "widget_stats",
          activeWidget,
        ).toUpperCase()}
      </SectionLabel>

      {activeWidget === "reminders" && (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.controlBlock}>
            <Text style={[styles.controlTitle, { color: C.text }]}>
              {copy("widget_content_filter", "İçerik filtresi")}
            </Text>
            <Segment
              colors={C}
              value={settings.content}
              onChange={(content) => patchActive({ content })}
              options={[
                { value: "all", label: copy("tumu", "Tümü") },
                { value: "movie", label: copy("film", "Film") },
                { value: "tv", label: copy("dizi", "Dizi") },
              ]}
            />
          </View>
          <View
            style={[
              styles.controlBlock,
              { borderTopColor: C.borderMuted, borderTopWidth: 1 },
            ]}
          >
            <Text style={[styles.controlTitle, { color: C.text }]}>
              {copy("widget_item_limit", "Gösterilecek öğe")}
            </Text>
            <Segment
              colors={C}
              value={settings.maxItems}
              onChange={(maxItems) => patchActive({ maxItems })}
              options={[3, 5, 8].map((value) => ({
                value,
                label: String(value),
              }))}
            />
          </View>
          <OptionRow
            colors={C}
            icon="image-outline"
            title={copy("widget_show_posters", "Posterleri göster")}
            value={settings.showPosters}
            onChange={(showPosters) => patchActive({ showPosters })}
          />
          <OptionRow
            colors={C}
            icon="calendar-outline"
            title={copy("widget_show_dates", "Tarihleri göster")}
            value={settings.showDates}
            onChange={(showDates) => patchActive({ showDates })}
            last
          />
        </View>
      )}

      {activeWidget === "lists" && (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.controlBlock}>
            <Text style={[styles.controlTitle, { color: C.text }]}>
              {copy("widget_poster_limit", "Widget başına poster")}
            </Text>
            <Segment
              colors={C}
              value={settings.maxPosters}
              onChange={(maxPosters) => patchActive({ maxPosters })}
              options={[6, 12, 18].map((value) => ({
                value,
                label: String(value),
              }))}
            />
          </View>
          <OptionRow
            colors={C}
            icon="calculator-outline"
            title={copy("widget_show_count", "İçerik sayısını göster")}
            value={settings.showCount}
            onChange={(showCount) => patchActive({ showCount })}
          />
          <OptionRow
            colors={C}
            icon="swap-horizontal-outline"
            title={copy("widget_show_navigation", "Liste geçişini göster")}
            subtitle={copy(
              "widget_show_navigation_description",
              "Önceki ve sonraki liste düğmeleri",
            )}
            value={settings.showNavigation}
            onChange={(showNavigation) => patchActive({ showNavigation })}
            last
          />
        </View>
      )}

      {activeWidget === "stats" && (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <OptionRow
            colors={C}
            icon="film-outline"
            title={copy("widget_movie_stats", "Film istatistikleri")}
            value={settings.showMovies}
            onChange={(showMovies) => patchActive({ showMovies })}
          />
          <OptionRow
            colors={C}
            icon="tv-outline"
            title={copy("widget_tv_stats", "Dizi istatistikleri")}
            value={settings.showTv}
            onChange={(showTv) => patchActive({ showTv })}
          />
          <OptionRow
            colors={C}
            icon="time-outline"
            title={copy("widget_duration_stats", "Toplam süre şeridi")}
            value={settings.showDuration}
            onChange={(showDuration) => patchActive({ showDuration })}
            last
          />
        </View>
      )}

      <TouchableOpacity
        onPress={handleReset}
        activeOpacity={0.72}
        style={[
          styles.resetButton,
          { borderColor: C.border, backgroundColor: C.card },
        ]}
      >
        <AppIcon name="refresh-outline" size={17} color={C.muted} />
        <Text style={[styles.resetText, { color: C.muted }]}>
          {copy("widget_reset", "Varsayılanlara dön")}
        </Text>
      </TouchableOpacity>
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingTop: 80, alignItems: "center" },
  heroHeader: {
    marginTop: 8,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heroCopy: { flex: 1 },
  heroEyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  heroSubtitle: { fontSize: 11, marginTop: 3, lineHeight: 15 },
  saveState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  saveDot: { width: 6, height: 6, borderRadius: 3 },
  saveText: { fontSize: 9.5, fontWeight: "700" },
  widgetTabs: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  widgetTab: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 4,
  },
  widgetTabText: { fontSize: 10.5, fontWeight: "700", flexShrink: 1 },
  previewStage: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Widget önizlemeleri ────────────────────────────────────────────────
  // Sayılar native kaynaklardaki dp/sp değerleridir; ölçek 1:1 korunur.
  // Kök çerçevenin görünür kenarlığı YOK: gerçekte drawable'ın çizgisi de
  // arka plan rengiyle boyandığı için kaybolur (WidgetThemeViews.tintBackground).
  widgetFrame: {
    width: "100%",
    borderRadius: 24, // reminder_widget_background.xml
    overflow: "hidden",
  },

  /* Yaklaşanlar */
  reminderRoot: { paddingHorizontal: 13, paddingTop: 12, paddingBottom: 11 },
  remHeader: { height: 32, flexDirection: "row", alignItems: "center" },
  brand: { alignItems: "center", justifyContent: "center" },
  remTitle: { flex: 1, marginStart: 9, fontSize: 15, fontWeight: "700" },
  remCountBadge: {
    // reminder_widget_count_badge.xml — sabit indigo, temayla değişmez.
    backgroundColor: "rgba(108,99,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(108,99,255,0.21)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  remCountText: { fontSize: 10, fontWeight: "700" },
  remRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 13,
    borderWidth: 1,
    marginTop: 6,
  },
  posterFallback: { backgroundColor: "#1F2233", overflow: "hidden" },
  remPoster: { width: 34, height: 50, borderRadius: 7 },
  remCopy: { flex: 1, marginStart: 10, marginEnd: 8 },
  remName: { fontWeight: "700" },
  remMeta: { fontSize: 9, marginTop: 2 },
  remWhenBox: { alignItems: "flex-end" },
  remWhen: { fontSize: 10, fontWeight: "700" },
  remDate: { fontSize: 8, marginTop: 1 },
  remEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  remEmptyText: { fontSize: 12, marginTop: 7, textAlign: "center" },

  /* Listelerim */
  listsRoot: { paddingHorizontal: 12, paddingTop: 11, paddingBottom: 10 },
  listsHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    // Native 1dp çizgiyi içeri çizer; RN dışarı ekler → dolgu 1 azaltıldı ki
    // şerit yüksekliği 38 kalsın.
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  listIconDot: {
    // lists_widget_icon_dot.xml — daire, sabit %12 beyaz (temaya bağlı değil).
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  listsTitle: { flex: 1, marginStart: 8, fontSize: 13, fontWeight: "700" },
  listCount: { fontSize: 12, fontWeight: "700", marginEnd: 6 },
  navButton: {
    // lists_widget_nav_btn.xml — sabit menekşe yıkama, temayla değişmez.
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "rgba(108,99,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(108,99,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  listPosition: {
    fontSize: 9,
    fontWeight: "700",
    minWidth: 24,
    marginHorizontal: 5,
    textAlign: "center",
  },
  // Kaydırılabilir gövde: gerçeğinde ListView/GridView, burada da öyle —
  // çerçeveye sığmayan içerik kırpılır ve kaydırılarak görülür.
  widgetScroll: { flex: 1 },
  posterGrid: { marginTop: 8 },
  gridRow: { flexDirection: "row", gap: GRID_GAP, marginBottom: GRID_GAP },
  gridCell: { flex: 1, height: 112, borderRadius: 9, overflow: "hidden" },
  gridCellEmpty: { flex: 1 },
  gridPoster: { flex: 1, borderRadius: 7 },

  /* İstatistikler */
  statsHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  statsHeaderTitle: { flex: 1, fontSize: 14, fontWeight: "700" },
  statsCard: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    padding: 6,
    marginTop: 9,
  },
  statsCardFollow: { marginTop: 7 },
  statsPanel: {
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
  },
  statsCountPanel: { flex: 43, paddingHorizontal: 4 },
  statsTvCountPanel: { flexDirection: "row", paddingHorizontal: 3 },
  statsTimePanel: {
    flex: 55,
    marginStart: 5,
    flexDirection: "row",
    paddingHorizontal: 3,
  },
  countBlock: { flex: 1, alignItems: "center", justifyContent: "center" },
  bigStat: { fontSize: 19, fontWeight: "700" },
  statCaption: { fontSize: 9, textAlign: "center" },
  timeUnit: { flex: 1, alignItems: "center", justifyContent: "center" },
  timeValue: { fontSize: 15, fontWeight: "700" },
  timeLabel: { fontSize: 8, textAlign: "center" },
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginTop: 7,
  },
  durationGroup: { flex: 1, flexDirection: "row", alignItems: "center" },
  durationCopy: { flex: 1, marginStart: 5 },
  durationNumber: { fontSize: 11, fontWeight: "700" },
  durationCaption: { fontSize: 8 },
  featureChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 9,
  },
  featureChip: {
    minHeight: 26,
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    gap: 5,
  },
  featureDot: { width: 6, height: 6, borderRadius: 3 },
  featureText: { fontSize: 9.5, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  controlBlock: { padding: 14 },
  controlHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlTitle: { fontSize: 12, fontWeight: "700", marginBottom: 5 },
  controlHint: { fontSize: 9.5, lineHeight: 13, marginBottom: 10 },
  activePalette: { width: 20, height: 20, borderRadius: 10 },
  themeScroll: { gap: 10, paddingVertical: 3, paddingRight: 4 },
  themeCard: {
    width: 94,
    minHeight: 99,
    borderWidth: 1,
    borderRadius: 14,
    padding: 7,
  },
  themeCardActive: { borderWidth: 2 },
  themeMiniSurface: {
    height: 48,
    borderRadius: 9,
    padding: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  themeMiniAccent: { width: 19, height: 31, borderRadius: 6 },
  themeMiniLines: { flex: 1, gap: 5, marginLeft: 6 },
  themeMiniLine: { height: 5, borderRadius: 3, width: "82%" },
  themeCheck: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  themeName: { fontSize: 9.5, fontWeight: "800", marginTop: 7 },
  customLabel: { fontSize: 6.5, fontWeight: "900", marginTop: 2 },
  segment: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segmentButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  segmentText: { fontSize: 10.5, fontWeight: "600" },
  segmentTextActive: { fontWeight: "800" },
  accentRow: { gap: 11, paddingVertical: 4, paddingRight: 4 },
  accentButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  accentButtonSelected: {
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 3,
  },
  optionRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  noBorder: { borderBottomWidth: 0 },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  optionCopy: { flex: 1, paddingRight: 10 },
  optionTitle: { fontSize: 13, fontWeight: "600" },
  optionSubtitle: { fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  resetButton: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  resetText: { fontSize: 12, fontWeight: "700" },
});
