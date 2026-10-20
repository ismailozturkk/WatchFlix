// components/profile/StatsComponents.js
//
// Movie + TV istatistik ekranları için paylaşılan modern UI bileşenleri.
// Tüm component'ler memo'lu — parent context değiştiğinde gereksiz re-render
// yapmaz, child'ları sadece prop'ları değişirse render eder.

import React, { memo, useRef, useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Pressable,
  ScrollView,
  FlatList,
  SectionList,
  Dimensions,
} from "react-native";

const { height: SCREEN_H } = Dimensions.get("window");
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AdaptiveBlurView from "../common/AdaptiveBlurView";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import { MyPosterActivityBadge } from "@components/PosterActivityBadge";
import { i18nText } from "../../utils/i18nText";

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import GlassTouchable from "../common/GlassTouchable";
import GlassPressable from "../common/GlassPressable";
import GlassBox from "../common/GlassBox";

/**
 * Renge alpha ekle — hem hex (#aabbcc) hem hsl(...) destekler.
 * ProfileStatsContext.getDynamicRankColor `hsl(...)` döndürdüğü için bu kritik;
 * `rankColor + "33"` doğrudan birleştirme `"hsl(...)33"` = geçersiz renk verir.
 *
 * @param {string} color  hex veya hsl string
 * @param {number} alpha  0–1
 */
export const withAlpha = (color, alpha = 1) => {
  if (typeof color !== "string") return color;
  if (color.startsWith("hsl(")) {
    return color.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
  }
  if (color.startsWith("hsla(")) {
    return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  }
  if (color.startsWith("#")) {
    const hex = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, "0");
    return color + hex;
  }
  // rgb / rgba / named — minimal: rgba'ya çevir
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  return color;
};

// ─── SCREEN INTRO ────────────────────────────────────────────────────────────
// Geri butonunun sağında kalan, film/TV kimliğini belirginleştiren ortak başlık.

export const StatsScreenHeader = memo(function StatsScreenHeader({
  theme,
  title,
  eyebrow,
  subtitle,
  icon,
  accentColor,
}) {
  const accent = accentColor || theme.accent;

  return (
    <View style={introStyles.wrap}>
      <View
        pointerEvents="none"
        style={[introStyles.glow, { backgroundColor: withAlpha(accent, 0.12) }]}
      />

      <View style={introStyles.copy}>
        <View style={introStyles.eyebrowRow}>
          <View style={[introStyles.eyebrowDot, { backgroundColor: accent }]} />
          <Text
            allowFontScaling={false}
            style={[introStyles.eyebrow, { color: accent }]}
          >
            {eyebrow}
          </Text>
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[introStyles.title, { color: theme.text.primary }]}
        >
          {title}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[introStyles.subtitle, { color: theme.text.muted }]}
        >
          {subtitle}
        </Text>
      </View>

      <LinearGradient
        colors={[withAlpha(accent, 0.28), withAlpha(accent, 0.08)]}
        style={[introStyles.iconBox, { borderColor: withAlpha(accent, 0.32) }]}
      >
        <Ionicons name={icon} size={25} color={accent} />
      </LinearGradient>
    </View>
  );
});

const introStyles = StyleSheet.create({
  wrap: {
    minHeight: 82,
    paddingLeft: 68,
    paddingRight: 16,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    right: -24,
    top: -46,
  },
  copy: { flex: 1, paddingRight: 12 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  eyebrowDot: { width: 5, height: 5, borderRadius: 3 },
  eyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.25, textTransform: "uppercase" },
  title: { fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.65 },
  subtitle: { fontSize: 11, lineHeight: 15, fontWeight: "500", marginTop: 2 },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "3deg" }],
  },
});

// ─── SEGMENTED CONTROL ───────────────────────────────────────────────────────
// Grafik dönemi (günlük/aylık/yıllık) ve birim (dk/sa/gün) seçicileri aynı
// kalıbı paylaşır; tek yerde dursun ki iki seçici hiç ayrışmasın.

const SegmentedControl = memo(function SegmentedControl({
  options,
  value,
  onChange,
  color,
  inactiveColor,
  flex = 1,
}) {
  return (
    <View
      style={[
        heroStyles.segmented,
        { flex, borderColor: withAlpha(color, 0.2) },
      ]}
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <GlassTouchable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.key)}
            activeOpacity={0.78}
            style={[
              heroStyles.segmentButton,
              active && { backgroundColor: withAlpha(color, 0.22) },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[
                heroStyles.segmentText,
                { color: active ? color : inactiveColor },
              ]}
            >
              {option.label}
            </Text>
          </GlassTouchable>
        );
      })}
    </View>
  );
});

// ─── STAT TILE ───────────────────────────────────────────────────────────────
// Hero'nun sayı kutucuğu: ikon + büyük sayı + etiket + (varsa) tekrarsız rozeti.
// Büyük sayı tekrarlı toplamı gösterir; alt rozet aynı ölçünün tekrarsız
// karşılığıdır. İkisi yan yana durmadan "500 film" yanıltıcı okunuyordu.

const StatTile = memo(function StatTile({
  theme,
  accent,
  icon,
  count,
  label,
  subLabel,
  large,
}) {
  const surface = {
    backgroundColor: withAlpha(theme.primary, 0.42),
    borderColor: withAlpha(accent, 0.2),
  };

  // Tek kutucuk tüm genişliği kaplar: köşeye yapışık küçük ikon + sola yaslı
  // 10.5 pt etiket bu genişlikte kaybolup hizasız duruyordu. Bunun yerine hemen
  // altındaki "Toplam izlenme" satırıyla aynı kalıp (soldaki ikon kutusu, üstte
  // etiket, altta değer) kullanılır; iki satırın metin sütunu aynı hizada başlar.
  if (large) {
    return (
      <View style={[heroStyles.tile, heroStyles.tileWide, surface]}>
        <View style={[heroStyles.tileWideIcon, { backgroundColor: withAlpha(accent, 0.2) }]}>
          <Ionicons name={icon} size={19} color={accent} />
        </View>
        <View style={heroStyles.tileWideCopy}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[heroStyles.tileLabelWide, { color: theme.text.muted }]}
          >
            {label}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[heroStyles.tileNumberLarge, { color: theme.text.primary }]}
          >
            {count}
          </Text>
        </View>
        {!!subLabel && (
          <View style={[heroStyles.tileSubWide, { backgroundColor: withAlpha(accent, 0.14) }]}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[heroStyles.tileSubTextWide, { color: accent }]}
            >
              {subLabel}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[heroStyles.tile, surface]}>
      <View style={[heroStyles.tileIcon, { backgroundColor: withAlpha(accent, 0.16) }]}>
        <Ionicons name={icon} size={15} color={accent} />
      </View>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={[heroStyles.tileNumber, { color: theme.text.primary }]}
      >
        {count}
      </Text>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[heroStyles.tileLabel, { color: theme.text.muted }]}
      >
        {label}
      </Text>
      {!!subLabel && (
        <View style={[heroStyles.tileSub, { backgroundColor: withAlpha(accent, 0.14) }]}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={[heroStyles.tileSubText, { color: accent }]}
          >
            {subLabel}
          </Text>
        </View>
      )}
    </View>
  );
});

// ─── WATCH RHYTHM CHART ──────────────────────────────────────────────────────
// Günlük/aylık/yıllık izleme sütunları. Yalnız "Daha fazla" alanında çizilir;
// kapanınca bileşen sökülür. Bu yüzden dönem ve birim seçimi hero'da tutulur
// (yeniden açınca seçim kaybolmasın), yalnız seçili sütun yerel kalır.

const WatchRhythmChart = memo(function WatchRhythmChart({
  theme,
  accent,
  chartDataByPeriod,
  chartPeriod,
  onChartPeriodChange,
  chartUnit,
  onChartUnitChange,
}) {
  const [selectedChartKey, setSelectedChartKey] = useState(null);

  const chartData = chartDataByPeriod?.[chartPeriod] || [];
  const chartMax = Math.max(...chartData.map((item) => item.value), 1);
  const periodTotal = chartData.reduce((sum, item) => sum + item.value, 0);
  const selectedChartPoint = chartData.find((point) => point.key === selectedChartKey)
    || [...chartData].reverse().find((point) => point.value > 0)
    || chartData[chartData.length - 1];

  const periodOptions = [
    { key: "daily", label: i18nText("autoI18n.gunluk", "Günlük") },
    { key: "monthly", label: i18nText("autoI18n.aylik", "Aylık") },
    { key: "yearly", label: i18nText("autoI18n.yillik", "Yıllık") },
  ];
  const unitOptions = [
    { key: "minutes", label: i18nText("autoI18n.dakika", "dk") },
    { key: "hours", label: i18nText("autoI18n.saat_kisa", "sa") },
    { key: "days", label: i18nText("autoI18n.gun_kisa", "gün") },
  ];
  const unitSuffix = unitOptions.find((option) => option.key === chartUnit)?.label || "";
  const chartValueLabel = (minutes) => {
    if (!minutes) return "";
    const divisor = chartUnit === "days" ? 1440 : chartUnit === "hours" ? 60 : 1;
    const value = minutes / divisor;
    const decimals = chartUnit === "minutes"
      ? 0
      : value < 1
        ? 2
        : value < 10
          ? 1
          : 0;
    return `${value.toFixed(decimals).replace(/\.0$/, "")}${unitSuffix}`;
  };

  return (
    <GlassBox role="card"
      style={[
        heroStyles.chartCard,
        {
          backgroundColor: withAlpha(theme.primary, 0.42),
          borderColor: withAlpha(accent, 0.18),
        },
      ]}
    >
      <View style={heroStyles.chartHeader}>
        <View style={heroStyles.chartTitleCol}>
          <View style={heroStyles.chartTitleRow}>
            <Ionicons name="stats-chart" size={13} color={accent} />
            <Text style={[heroStyles.chartTitle, { color: theme.text.secondary }]}>
              {i18nText("autoI18n.izleme_ritmi", "İzleme ritmi")}
            </Text>
          </View>
          {periodTotal > 0 && (
            <Text style={[heroStyles.chartTotal, { color: theme.text.muted }]}>
              {i18nText(
                "autoI18n.istatistik_donem_toplami",
                `Toplam ${chartValueLabel(periodTotal)}`,
                { value: chartValueLabel(periodTotal) },
              )}
            </Text>
          )}
        </View>
        {chartData.length > 0 && (
          <View style={heroStyles.chartRangeWrap}>
            <Text style={[heroStyles.chartRange, { color: theme.text.muted }]}>
              {chartData[0].dateLabel} – {chartData[chartData.length - 1].dateLabel}
            </Text>
            {!!selectedChartPoint?.value && (
              <Text style={[heroStyles.chartSelectedValue, { color: accent }]}>
                {selectedChartPoint.dayLabel} · {chartValueLabel(selectedChartPoint.value)}
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={heroStyles.chartControls}>
        <SegmentedControl
          options={periodOptions}
          value={chartPeriod}
          onChange={onChartPeriodChange}
          color={accent}
          inactiveColor={theme.text.muted}
          flex={1.35}
        />
        <SegmentedControl
          options={unitOptions}
          value={chartUnit}
          onChange={onChartUnitChange}
          color={accent}
          inactiveColor={theme.text.muted}
        />
      </View>

      <View style={heroStyles.chartBars}>
        {chartData.map((point) => {
          const selected = selectedChartPoint?.key === point.key;
          const dense = chartData.length > 12;
          const height = point.value > 0
            ? Math.max(7, Math.round((point.value / chartMax) * 52))
            : 4;
          const barWidth = dense ? 6 : chartData.length > 7 ? 12 : 18;
          const valueLabel = chartData.length <= 7 || selected
            ? chartValueLabel(point.value)
            : "";
          const visibleValueLabel = dense && selected
            ? `${point.dayLabel} · ${valueLabel || `0${unitSuffix}`}`
            : valueLabel;
          return (
            <TouchableOpacity
              key={point.key}
              activeOpacity={0.75}
              onPress={() => setSelectedChartKey(point.key)}
              style={[heroStyles.chartColumn, selected && { zIndex: 10 }]}
            >
              <Text
                numberOfLines={1}
                style={[
                  heroStyles.chartValue,
                  dense && selected && heroStyles.chartValueTooltip,
                  {
                    color: dense && selected ? accent : theme.text.muted,
                    backgroundColor: dense && selected ? theme.secondary : "transparent",
                    borderColor: dense && selected ? withAlpha(accent, 0.55) : "transparent",
                  },
                ]}
              >
                {visibleValueLabel}
              </Text>
              {/* Sütunun oturduğu soluk kulvar: boş günler de ölçeği okutur. */}
              <View style={heroStyles.chartTrack}>
                <View
                  style={[
                    heroStyles.chartLane,
                    {
                      width: barWidth,
                      backgroundColor: withAlpha(theme.text.muted, 0.1),
                    },
                  ]}
                >
                  <LinearGradient
                    colors={point.value > 0
                      ? [withAlpha(accent, 0.95), withAlpha(accent, 0.45)]
                      : [withAlpha(theme.text.muted, 0.2), withAlpha(theme.text.muted, 0.1)]}
                    style={[
                      heroStyles.chartBar,
                      {
                        height,
                        borderColor: selected ? accent : "transparent",
                        borderWidth: selected ? 1 : 0,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text
                style={[
                  heroStyles.chartDay,
                  dense && heroStyles.chartDayDense,
                  { color: selected ? accent : theme.text.secondary },
                ]}
              >
                {point.dayLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </GlassBox>
  );
});

// ─── GENRE BARS ──────────────────────────────────────────────────────────────
// En çok izlenen türler: sıra + ad + göreli çubuk + adet. İlk tür rank renginde.

const GenreBars = memo(function GenreBars({ theme, accent, genres, title }) {
  const rows = genres.slice(0, 5);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((g) => g.count), 1);

  return (
    <View style={heroStyles.genresWrap}>
      <Text style={[heroStyles.sectionLabel, { color: theme.text.muted }]}>{title}</Text>
      {rows.map((genre, index) => (
        <View key={`${genre.name}-${index}`} style={heroStyles.genreRow}>
          <View style={heroStyles.genreNameCol}>
            {index === 0 ? (
              <MaterialCommunityIcons name="crown" size={12} color={accent} />
            ) : (
              <Text style={[heroStyles.genreIndex, { color: theme.text.muted }]}>
                {index + 1}
              </Text>
            )}
            <Text
              numberOfLines={1}
              style={[heroStyles.genreName, { color: theme.text.primary }]}
            >
              {genre.name}
            </Text>
          </View>
          <View
            style={[
              heroStyles.genreTrack,
              { backgroundColor: withAlpha(theme.text.muted, 0.12) },
            ]}
          >
            <View
              style={[
                heroStyles.genreFill,
                {
                  width: `${Math.max(6, Math.round((genre.count / max) * 100))}%`,
                  backgroundColor: index === 0 ? accent : withAlpha(accent, 0.55),
                },
              ]}
            />
          </View>
          <Text style={[heroStyles.genreCount, { color: theme.text.secondary }]}>
            {genre.count}
          </Text>
        </View>
      ))}
    </View>
  );
});

// ─── HERO STATS CARD ─────────────────────────────────────────────────────────
//
// Ekranın tepesindeki özet kartı: rank rozeti, sayı kutucukları ve toplam süre.
// "Daha fazla" ile açılınca izleme ritmi, tür dağılımı ve en çok tekrar
// izlenenler gelir. Toplam süre eskiden "Daha fazla"nın arkasındaydı; sayfanın
// asıl cevabı olduğu için sayılarla birlikte ilk görünene taşındı. İzleme ritmi
// ise tersine: kart katlanan başlığın içinde olduğundan, hep açık durması liste
// alanından ~190 pt yer alıyordu; ikincil bilgi olduğu için açılır alana alındı.

export const StatsHeroCard = memo(function StatsHeroCard({
  theme,
  primaryCount,
  primaryLabel,
  primarySubLabel,
  primaryIcon = "film-outline",
  secondaryCount,
  secondaryLabel,
  secondarySubLabel,
  secondaryIcon = "play-circle-outline",
  tertiaryCount,
  tertiaryLabel,
  tertiarySubLabel,
  tertiaryIcon = "layers-outline",
  chartDataByPeriod = {},
  rewatchItems = [],
  expanded,
  onToggleExpand,
  rankColor,
  rankLevel,
  rankName,
  totalMinutes,
  timeDisplayMode,
  onTimePress,
  formatDuration,
  // [{ name, count }] — izlenme sıklığına göre azalan.
  genres = [],
  genresLabel = i18nText("autoI18n.istatistik_en_cok_izlenen_turler", "En çok izlenen türler"),
}) {
  // Gradient renkleri rank renginden türetiyoruz (dinamik).
  const accent = rankColor || theme.accent;
  const grad2 = theme.secondary;

  // İzleme ritmi grafiği yalnız açılır alanda durur (kapanınca sökülür); dönem ve
  // birim seçimi burada tutulur ki yeniden açınca sıfırlanmasın.
  const [chartPeriod, setChartPeriod] = useState("daily");
  const [chartUnit, setChartUnit] = useState("minutes");

  const stats = [
    { key: "primary", count: primaryCount, label: primaryLabel, sub: primarySubLabel, icon: primaryIcon },
    secondaryCount != null && {
      key: "secondary",
      count: secondaryCount,
      label: secondaryLabel,
      sub: secondarySubLabel,
      icon: secondaryIcon,
    },
    tertiaryCount != null && {
      key: "tertiary",
      count: tertiaryCount,
      label: tertiaryLabel,
      sub: tertiarySubLabel,
      icon: tertiaryIcon,
    },
  ].filter(Boolean);

  return (
    <View
      style={[
        heroStyles.wrap,
        { shadowColor: rankColor || theme.shadow, backgroundColor: theme.secondary },
      ]}
    >
      <LinearGradient
        colors={[withAlpha(accent, 0.27), grad2, theme.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[heroStyles.card, { borderColor: theme.border }]}
      >
        <View
          pointerEvents="none"
          style={[heroStyles.decorOrb, { backgroundColor: withAlpha(accent, 0.11) }]}
        />
        <View
          pointerEvents="none"
          style={[heroStyles.accentLine, { backgroundColor: accent }]}
        />

        {/* Üst satır: özet başlığı + rank rozeti */}
        <View style={heroStyles.topRow}>
          <View style={heroStyles.eyebrowRow}>
            <View style={[heroStyles.eyebrowDot, { backgroundColor: accent }]} />
            <Text
              allowFontScaling={false}
              style={[heroStyles.eyebrow, { color: theme.text.muted }]}
            >
              {i18nText("autoI18n.istatistik_izleme_ozeti", "İzleme özeti")}
            </Text>
          </View>
          {rankLevel != null && !!rankName && (
            <View
              style={[
                heroStyles.rankBadge,
                { backgroundColor: withAlpha(accent, 0.18), borderColor: withAlpha(accent, 0.7) },
              ]}
            >
              <MaterialCommunityIcons name="shield-star" size={12} color={accent} />
              <Text allowFontScaling={false} style={[heroStyles.rankText, { color: accent }]}>
                {rankName}
              </Text>
            </View>
          )}
        </View>

        {/* Sayı kutucukları — 1, 2 veya 3 adet */}
        <View style={heroStyles.tiles}>
          {stats.map((stat) => (
            <StatTile
              key={stat.key}
              theme={theme}
              accent={accent}
              icon={stat.icon}
              count={stat.count}
              label={stat.label}
              subLabel={stat.sub}
              large={stats.length === 1}
            />
          ))}
        </View>

        {/* Toplam süre — dokununca dk → sa → gün */}
        <GlassPressable
          onPress={onTimePress}
          accessibilityRole="button"
          style={[
            heroStyles.totalRow,
            {
              backgroundColor: withAlpha(accent, 0.1),
              borderColor: withAlpha(accent, 0.24),
            },
          ]}
        >
          <View style={[heroStyles.totalIcon, { backgroundColor: withAlpha(accent, 0.2) }]}>
            <Ionicons name="time-outline" size={19} color={accent} />
          </View>
          <View style={heroStyles.totalCopy}>
            <Text
              allowFontScaling={false}
              style={[heroStyles.totalLabelText, { color: theme.text.muted }]}
            >
              {i18nText("autoI18n.toplam_izlenme", "Toplam izlenme")}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[heroStyles.totalValueText, { color: theme.text.primary }]}
            >
              {formatDuration?.(totalMinutes || 0, timeDisplayMode)}
            </Text>
          </View>
          <Ionicons name="swap-horizontal" size={17} color={theme.text.muted} />
        </GlassPressable>

        {/* Expand toggle */}
        <GlassTouchable
          style={[heroStyles.expandBtn, { borderColor: theme.border }]}
          onPress={onToggleExpand}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded: !!expanded }}
        >
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={theme.text.muted}
          />
          <Text style={[heroStyles.expandText, { color: theme.text.muted }]}>
            {expanded
              ? i18nText("autoI18n.daha_az", "Daha az")
              : i18nText("autoI18n.istatistik_daha_fazla", "Daha fazla")}
          </Text>
        </GlassTouchable>

        {/* Expanded content */}
        {expanded && (
          <View style={[heroStyles.expanded, { borderTopColor: theme.border }]}>
            <WatchRhythmChart
              theme={theme}
              accent={accent}
              chartDataByPeriod={chartDataByPeriod}
              chartPeriod={chartPeriod}
              onChartPeriodChange={setChartPeriod}
              chartUnit={chartUnit}
              onChartUnitChange={setChartUnit}
            />
            <GenreBars theme={theme} accent={accent} genres={genres} title={genresLabel} />
            <RewatchHighlights theme={theme} items={rewatchItems} embedded />
          </View>
        )}
      </LinearGradient>
    </View>
  );
});

const heroStyles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 5,
  },
  card: {
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  decorOrb: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -72,
    top: -76,
  },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 28,
    right: 28,
    height: 2,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    opacity: 0.8,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrowDot: { width: 5, height: 5, borderRadius: 3 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" },
  rankBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  rankText: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.3 },

  tiles: { flexDirection: "row", gap: 8, marginBottom: 10 },
  tile: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 11,
    paddingHorizontal: 9,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  // İkon köşede durur, yerleşimde yer kaybettirmez: üç kutucuklu dizi hero'su
  // katlanan başlığın içinde olduğu için yükseklik doğrudan liste alanından yer.
  tileIcon: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  tileNumber: {
    alignSelf: "stretch",
    paddingRight: 30,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: "800",
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  // Tek kutucuk (film ekranı): yatay düzen. Dolgu ve ikon kutusu "Toplam izlenme"
  // satırıyla (totalRow/totalIcon) aynı; iki satırın metni aynı sütundan başlar.
  tileWide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tileWideIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tileWideCopy: { flex: 1, minWidth: 0 },
  tileLabelWide: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 },
  tileNumberLarge: {
    marginTop: 1,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "800",
    letterSpacing: -0.8,
    includeFontPadding: false,
  },
  tileSubWide: {
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tileSubTextWide: { fontSize: 11, fontWeight: "800" },
  tileLabel: { alignSelf: "stretch", fontSize: 10.5, marginTop: 1, fontWeight: "700" },
  tileSub: {
    marginTop: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: "100%",
  },
  tileSubText: { fontSize: 9.5, fontWeight: "800" },

  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  totalIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  totalCopy: { flex: 1, minWidth: 0 },
  totalLabelText: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.2 },
  totalValueText: { marginTop: 1, fontSize: 18, lineHeight: 23, fontWeight: "800", letterSpacing: -0.3 },

  chartCard: {
    paddingTop: 11,
    paddingBottom: 8,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  chartTitleCol: { flexShrink: 1 },
  chartTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  chartTitle: { fontSize: 12, fontWeight: "800" },
  chartTotal: { marginTop: 2, marginLeft: 18, fontSize: 9.5, fontWeight: "700" },
  chartRangeWrap: { alignItems: "flex-end", flexShrink: 1 },
  chartRange: { fontSize: 9.5, fontWeight: "600" },
  chartSelectedValue: { marginTop: 1, fontSize: 9.5, fontWeight: "800" },
  chartControls: { marginTop: 10, flexDirection: "row", gap: 7 },
  segmented: {
    minHeight: 30,
    padding: 2,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
  },
  segmentButton: { flex: 1, minHeight: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  segmentText: { fontSize: 9.5, fontWeight: "800" },
  chartBars: { height: 87, marginTop: 7, flexDirection: "row", alignItems: "flex-end" },
  chartColumn: { flex: 1, alignItems: "center" },
  chartValue: { height: 18, lineHeight: 16, fontSize: 8, fontWeight: "700", textAlign: "center" },
  chartValueTooltip: {
    minWidth: 46,
    paddingHorizontal: 5,
    borderRadius: 7,
    borderWidth: 1,
    fontSize: 9.5,
    fontWeight: "900",
    overflow: "hidden",
  },
  chartTrack: { height: 52, justifyContent: "flex-end", alignItems: "center" },
  chartLane: { height: 52, borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  chartBar: { width: "100%", borderRadius: 6 },
  chartDay: { marginTop: 3, fontSize: 9, fontWeight: "700" },
  chartDayDense: { fontSize: 7 },

  expandBtn: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  expandText: { fontSize: 11, fontWeight: "700" },

  expanded: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },

  genresWrap: { gap: 9 },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginLeft: 2,
  },
  genreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  genreNameCol: { width: "33%", flexDirection: "row", alignItems: "center", gap: 6 },
  genreIndex: { width: 12, textAlign: "center", fontSize: 11, fontWeight: "800" },
  genreName: { flexShrink: 1, fontSize: 12.5, fontWeight: "700" },
  genreTrack: { flex: 1, height: 7, borderRadius: 4, overflow: "hidden" },
  genreFill: { height: "100%", borderRadius: 4 },
  genreCount: { minWidth: 24, textAlign: "right", fontSize: 12, fontWeight: "800" },
});

// ─── FILTER BAR ──────────────────────────────────────────────────────────────
//
// Yatay kayan tarih chip'leri + arama butonu. Picker yerine modern interaction.

export const StatsFilterBar = memo(function StatsFilterBar({
  theme,
  searchVisible,
  onToggleSearch,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  selectedDate,
  selectedGenre,
  formatDate,
  onOpenFilters,
  allDatesLabel = i18nText("autoI18n.tum_tarihler", "Tüm Tarihler"),
  allGenresLabel = i18nText("autoI18n.tum_turler", "Tüm Türler"),
}) {
  const dateText = selectedDate ? formatDate?.(selectedDate) || selectedDate : allDatesLabel;
  const genreText = selectedGenre || allGenresLabel;

  return (
    <View style={filterStyles.wrap}>
      {/* Search row */}
      <View style={[filterStyles.searchRow]}>
        <GlassPressable
          onPress={onToggleSearch}
          style={[
            filterStyles.searchIconBtn,
            {
              backgroundColor: searchVisible ? theme.accent : theme.secondary,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons
            name={searchVisible ? "close" : "search"}
            size={16}
            color={searchVisible ? "#fff" : theme.text.primary}
          />
        </GlassPressable>

        {searchVisible ? (
          <GlassBox role="field"
            style={[
              filterStyles.searchInputWrap,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <FilterSearchInput
              value={searchValue}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
              theme={theme}
            />
            {searchValue ? (
              <Pressable onPress={() => onSearchChange("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={theme.text.muted} />
              </Pressable>
            ) : null}
          </GlassBox>
        ) : (
          // Tarih + tür filtre pill'leri (search kapalıyken). Dokununca modal açılır.
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={filterStyles.chipsScroll}
            contentContainerStyle={filterStyles.chipsContent}
            keyboardShouldPersistTaps="handled"
          >
            <FilterPill
              theme={theme}
              icon="calendar-outline"
              text={dateText}
              active={selectedDate != null}
              onPress={onOpenFilters}
            />
            <FilterPill
              theme={theme}
              icon="pricetag-outline"
              text={genreText}
              active={selectedGenre != null}
              onPress={onOpenFilters}
            />
          </ScrollView>
        )}
      </View>
    </View>
  );
});

// Filtre tetikleyici pill (tarih / tür). Seçim varsa vurgulanır.
const FilterPill = memo(function FilterPill({ theme, icon, text, active, onPress }) {
  return (
    <GlassPressable
      onPress={onPress}
      style={[
        filterStyles.pill,
        {
          backgroundColor: active ? theme.accent : theme.secondary,
          borderColor: active ? theme.accent : theme.border,
        },
      ]}
    >
      <Ionicons name={icon} size={14} color={active ? "#fff" : theme.text.secondary} />
      <Text
        style={[
          filterStyles.pillText,
          {
            color: active ? "#fff" : theme.text.secondary,
            fontWeight: active ? "700" : "600",
          },
        ]}
        numberOfLines={1}
      >
        {text}
      </Text>
      <Ionicons name="chevron-down" size={13} color={active ? "#fff" : theme.text.muted} />
    </GlassPressable>
  );
});

const FilterSearchInput = memo(function FilterSearchInput({
  value,
  onChange,
  placeholder,
  theme,
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      maxLength={80}
      placeholder={placeholder}
      placeholderTextColor={theme.text.muted}
      style={[filterStyles.searchInput, { color: theme.text.primary }]}
      autoFocus
    />
  );
});

// ─── FILTER MODAL ────────────────────────────────────────────────────────────
//
// Tarih + tür filtrelerini tek bottom-sheet'te toplar. Seçimler anında uygulanır
// (parent state'i günceller); "Temizle" ikisini de sıfırlar. Tekil seçim: null = tümü.

export const StatsFilterModal = memo(function StatsFilterModal({
  visible,
  onClose,
  theme,
  dates = [],
  selectedDate,
  onSelectDate,
  genres = [],
  selectedGenre,
  onSelectGenre,
  formatDate,
  title = i18nText("autoI18n.filtrele", "Filtrele"),
  dateLabel = i18nText("autoI18n.filtre_tarih", "Tarih"),
  genreLabel = i18nText("autoI18n.filtre_tur", "Tür"),
  allDatesLabel = i18nText("autoI18n.tum_tarihler", "Tüm Tarihler"),
  allGenresLabel = i18nText("autoI18n.tum_turler", "Tüm Türler"),
  clearLabel = i18nText("autoI18n.temizle", "Temizle"),
  doneLabel = i18nText("autoI18n.tamam", "Tamam"),
}) {
  const hasFilters = selectedDate != null || selectedGenre != null;

  const dateOptions = [
    { key: "__all__", label: allDatesLabel, value: null },
    ...dates.map((d) => ({ key: d, label: formatDate?.(d) || d, value: d })),
  ];
  const genreOptions = [
    { key: "__all__", label: allGenresLabel, value: null },
    ...genres.map((g) => ({ key: g, label: g, value: g })),
  ];

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[
        modalStyles.sheet,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
          <View style={[modalStyles.handle, { backgroundColor: theme.border }]} />

          <View style={modalStyles.header}>
            <Text style={[modalStyles.title, { color: theme.text.primary }]}>{title}</Text>
            <GlassCloseButton
              size={32}
              fallbackRadius={16}
              color={theme.text.secondary}
              backgroundColor="transparent"
              borderColor={theme.border}
              hitSlop={10}
              onPress={onClose}
            />
          </View>

          <ScrollView
            style={modalStyles.body}
            contentContainerStyle={modalStyles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <FilterGroup theme={theme} icon="calendar-outline" label={dateLabel}>
              <FilterChipCloud
                theme={theme}
                options={dateOptions}
                selectedValue={selectedDate}
                onSelect={onSelectDate}
              />
            </FilterGroup>

            {genres.length > 0 && (
              <FilterGroup theme={theme} icon="pricetags-outline" label={genreLabel}>
                <FilterChipCloud
                  theme={theme}
                  options={genreOptions}
                  selectedValue={selectedGenre}
                  onSelect={onSelectGenre}
                />
              </FilterGroup>
            )}
          </ScrollView>

          <View style={[modalStyles.footer, { borderTopColor: theme.border }]}>
            <GlassPressable
              onPress={() => {
                onSelectDate(null);
                onSelectGenre(null);
              }}
              disabled={!hasFilters}
              style={[
                modalStyles.clearBtn,
                { borderColor: theme.border, opacity: hasFilters ? 1 : 0.45 },
              ]}
            >
              <Ionicons name="refresh-outline" size={15} color={theme.text.secondary} />
              <Text style={[modalStyles.clearText, { color: theme.text.secondary }]}>
                {clearLabel}
              </Text>
            </GlassPressable>
            <GlassPressable
              onPress={onClose}
              style={[modalStyles.doneBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={modalStyles.doneText}>{doneLabel}</Text>
            </GlassPressable>
          </View>
    </BottomSheetModal>
  );
});

const FilterGroup = memo(function FilterGroup({ theme, icon, label, children }) {
  return (
    <View style={modalStyles.group}>
      <View style={modalStyles.groupHeader}>
        <Ionicons name={icon} size={15} color={theme.text.muted} />
        <Text style={[modalStyles.groupLabel, { color: theme.text.muted }]}>{label}</Text>
      </View>
      {children}
    </View>
  );
});

const FilterChipCloud = memo(function FilterChipCloud({
  theme,
  options,
  selectedValue,
  onSelect,
}) {
  return (
    <View style={modalStyles.cloud}>
      {options.map((opt) => {
        const isActive =
          (opt.value == null && selectedValue == null) ||
          (opt.value != null && selectedValue === opt.value);
        return (
          <GlassPressable
            key={opt.key}
            onPress={() => onSelect(opt.value)}
            style={[
              modalStyles.cloudChip,
              {
                backgroundColor: isActive ? theme.accent : theme.primary,
                borderColor: isActive ? theme.accent : theme.border,
              },
            ]}
          >
            {isActive && (
              <Ionicons
                name="checkmark"
                size={13}
                color="#fff"
                style={{ marginRight: 3 }}
              />
            )}
            <Text
              style={[
                modalStyles.cloudChipText,
                {
                  color: isActive ? "#fff" : theme.text.secondary,
                  fontWeight: isActive ? "700" : "600",
                },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </GlassPressable>
        );
      })}
    </View>
  );
});

const filterStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  chipsScroll: {
    flex: 1,
  },
  chipsContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 200,
  },
  pillText: { fontSize: 12, flexShrink: 1 },
});

const modalStyles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 6,
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 12,
  },
  title: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  body: { paddingHorizontal: 16, maxHeight: Math.round(SCREEN_H * 0.48) },
  bodyContent: { paddingBottom: 12, gap: 20 },
  group: { gap: 10 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  groupLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  cloud: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cloudChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "100%",
  },
  cloudChipText: { fontSize: 13 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  clearText: { fontSize: 13, fontWeight: "700" },
  doneBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
  },
  doneText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});

// ─── SECTION HEADER (her tarih grubunun başlığı) ─────────────────────────────
//
// Sol: gün/ay "takvim kutucuğu". Orta: tarih + türler. Sağ: adet ve süre
// rozetleri. Geçersiz tarihli ("Eski Kayıtlar") gruplarda kutucukta ikon çıkar.

const dateTileParts = (title, locale) => {
  const match = typeof title === "string" ? title.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (!match) return null;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], 12));
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: String(+match[3]),
    month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date),
  };
};

export const StatsSectionHeader = memo(function StatsSectionHeader({
  theme,
  title,
  totalMinutes,
  count,
  itemIcon = "film-outline",
  genres = [],
  minutesLabel = "dk",
  fallbackTitle = i18nText("autoI18n.eski_kayitlar", "Eski Kayıtlar"),
  formatDate,
  locale,
  accent,
}) {
  const tint = accent || theme.accent;
  const isDateValid = title && !isNaN(new Date(title).getTime());
  const displayTitle = isDateValid ? formatDate?.(title) || title : fallbackTitle;
  const tile = useMemo(() => dateTileParts(title, locale), [title, locale]);
  const genreLine = genres.slice(0, 3).join(" · ");

  return (
    <View style={sectStyles.wrap}>
      <View
        style={[
          sectStyles.dateTile,
          { backgroundColor: withAlpha(tint, 0.14), borderColor: withAlpha(tint, 0.32) },
        ]}
      >
        {tile ? (
          <>
            <Text allowFontScaling={false} style={[sectStyles.tileDay, { color: theme.text.primary }]}>
              {tile.day}
            </Text>
            <Text allowFontScaling={false} style={[sectStyles.tileMonth, { color: tint }]}>
              {tile.month}
            </Text>
          </>
        ) : (
          <Ionicons name="time-outline" size={20} color={tint} />
        )}
      </View>

      <View style={sectStyles.copy}>
        <Text
          style={[sectStyles.title, { color: theme.text.primary }]}
          numberOfLines={1}
        >
          {displayTitle}
        </Text>
        {!!genreLine && (
          <Text
            style={[sectStyles.genres, { color: theme.text.muted }]}
            numberOfLines={1}
          >
            {genreLine}
          </Text>
        )}
      </View>

      <View style={sectStyles.badges}>
        {count > 0 && (
          <View style={[sectStyles.badge, { backgroundColor: withAlpha(theme.primary, 0.7) }]}>
            <Ionicons name={itemIcon} size={11} color={theme.text.secondary} />
            <Text style={[sectStyles.badgeText, { color: theme.text.secondary }]}>{count}</Text>
          </View>
        )}
        {totalMinutes > 0 && (
          <View style={[sectStyles.badge, { backgroundColor: withAlpha(tint, 0.16) }]}>
            <MaterialCommunityIcons name="clock-outline" size={11} color={tint} />
            <Text style={[sectStyles.badgeText, { color: tint }]}>
              {totalMinutes} {minutesLabel}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

const sectStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 2,
  },
  dateTile: {
    width: 46,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tileDay: { fontSize: 18, lineHeight: 21, fontWeight: "900", letterSpacing: -0.4 },
  tileMonth: {
    marginTop: -1,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  genres: { marginTop: 2, fontSize: 10.5, fontWeight: "600" },
  badges: { alignItems: "flex-end", gap: 5 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { fontSize: 10.5, fontWeight: "800" },
});

// ─── POSTER CARD ─────────────────────────────────────────────────────────────
//
// İzlenen film/bölüm görsel kartı. Modern: poster + alt başlık + üst-sağ
// minutes badge + press animasyonu.

const CARD_W = 110;
const CARD_H = CARD_W * 1.5;

export const StatsPosterCard = memo(function StatsPosterCard({
  theme,
  imageUri,
  mediaId,
  mediaType,
  minutes,
  minutesLabel = "dk",
  onPress,
  rankColor,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, friction: 5 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();

  return (
    <Animated.View style={[cardStyles.wrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
      >
        <View
          style={[
            cardStyles.posterWrap,
            { borderColor: rankColor ? withAlpha(rankColor, 0.33) : theme.border },
          ]}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={cardStyles.poster}
              contentFit="cover"
              // recyclingKey URI'den türeyelim: aynı isimli farklı posterlerin
              // cache'i karışmasın.
              recyclingKey={`stats-${imageUri}`}
              cachePolicy="memory-disk"
              transition={120}
            />
          ) : (
            <View
              style={[cardStyles.posterPh, { backgroundColor: theme.secondary }]}
            >
              <Ionicons
                name="image-outline"
                size={26}
                color={theme.text.muted}
              />
            </View>
          )}

          {/* Minutes badge (top-right) */}
          {minutes > 0 && (
            <AdaptiveBlurView
              intensity={45}
              tint="dark"
              style={[cardStyles.minBadge, { backgroundColor: "rgba(0,0,0,0.45)" }]}
            >
              <MaterialCommunityIcons name="clock-time-four" size={9} color="#fff" />
              <Text style={cardStyles.minText}>
                {minutes} {minutesLabel}
              </Text>
            </AdaptiveBlurView>
          )}
        </View>

        {/* Kişisel puan (yıldız) + yorum ikonu — posterin ALTINDA, içerik adı yerine */}
        <MyPosterActivityBadge mediaId={mediaId} mediaType={mediaType} posterWidth={CARD_W} />
      </TouchableOpacity>
    </Animated.View>
  );
});

const cardStyles = StyleSheet.create({
  wrap: { marginRight: 10 },
  posterWrap: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  poster: { width: "100%", height: "100%" },
  posterPh: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  minBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  minText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});

// ─── DATE SECTION ────────────────────────────────────────────────────────────
//
// Bir tarih grubunun tamamı: başlık (StatsSectionHeader) + yatay poster listesi.
// memo'lu — parent (ekran) re-render olduğunda, bu section'ın prop'ları (posters
// ref'i vb.) değişmedikçe yeniden render edilmez. Poster'lar ekranın useMemo'sunda
// önceden normalize edilip geldiği için onPress closure'ları da stabildir.

const POSTER_STRIDE = CARD_W + 10; // kart genişliği + marginRight (StatsPosterCard)

const posterKeyExtractor = (it) => it.key;
const posterGetItemLayout = (_data, index) => ({
  length: POSTER_STRIDE,
  offset: POSTER_STRIDE * index,
  index,
});

export const StatsDateSection = memo(function StatsDateSection({
  theme,
  title,
  posters = [],
  genres = [],
  totalMinutes = 0,
  count,
  itemIcon,
  // Poster üzerindeki küçük dakika rozeti başlığın tam kelimesini değil
  // ("Dakika") kısaltmasını kullanır ("dk") — dar rozette yer kazanır. Başlıktaki
  // süre rozeti de aynı kısaltmayı kullanır.
  minutesLabel = "dk",
  posterMinutesLabel = "dk",
  formatDate,
  locale,
  rankColor,
}) {
  const renderPoster = useCallback(
    ({ item }) => (
      <StatsPosterCard
        theme={theme}
        rankColor={rankColor}
        imageUri={item.imageUri}
        mediaId={item.mediaId}
        mediaType={item.mediaType}
        minutes={item.minutes}
        minutesLabel={posterMinutesLabel}
        onPress={item.onPress}
      />
    ),
    [theme, rankColor, posterMinutesLabel],
  );

  return (
    <GlassBox role="card"
      style={[
        dateSectionStyles.card,
        { backgroundColor: withAlpha(theme.secondary, 0.62), borderColor: theme.border },
      ]}
    >
      <StatsSectionHeader
        theme={theme}
        title={title}
        totalMinutes={totalMinutes}
        count={count ?? posters.length}
        itemIcon={itemIcon}
        genres={genres}
        minutesLabel={posterMinutesLabel || minutesLabel}
        formatDate={formatDate}
        locale={locale}
        accent={rankColor}
      />
      <FlatList
        data={posters}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={posterKeyExtractor}
        getItemLayout={posterGetItemLayout}
        renderItem={renderPoster}
        contentContainerStyle={dateSectionStyles.posterRow}
        initialNumToRender={5}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={false}
      />
    </GlassBox>
  );
});

const dateSectionStyles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  posterRow: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12 },
});

// ─── COLLAPSING LIST ─────────────────────────────────────────────────────────
//
// Katlanan başlık + sabit filtre + SectionList'i tek yerde toplar.
// Aşağı kaydırınca `collapsing` (başlık + hero) yukarı katlanıp kaybolur;
// `pinned` (arama + tarih çipleri) en üste sabitlenir. Animasyon native
// driver ile çalışır (60fps). Yükseklikler onLayout ile ölçülür, böylece hero
// genişleyince (tür chip'leri) hesap kendini günceller.

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);
const renderNullItem = () => null;

export function StatsCollapsingList({
  theme,
  topInset = 0,
  sections,
  keyExtractor,
  renderSectionHeader,
  ListEmptyComponent,
  collapsing,
  pinned,
}) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [collapseH, setCollapseH] = useState(0);
  const [pinnedH, setPinnedH] = useState(0);

  const translateY = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, collapseH > 0 ? collapseH : 1],
        outputRange: [0, collapseH > 0 ? -collapseH : 0],
        extrapolate: "clamp",
      }),
    [scrollY, collapseH],
  );

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );

  const contentContainerStyle = useMemo(
    () => ({ paddingTop: topInset + pinnedH, paddingBottom: 40 }),
    [topInset, pinnedH],
  );

  return (
    <View style={collapseStyles.root}>
      <AnimatedSectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderNullItem}
        ListEmptyComponent={ListEmptyComponent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews={false}
        contentContainerStyle={contentContainerStyle}
      />

      {/* Durum çubuğu arka planı — her zaman sabit (katlanan içerik altına kaymasın) */}
      <View
        style={[collapseStyles.statusStrip, { height: topInset, backgroundColor: theme.primary }]}
      />

      {/* Katlanan başlık + sabit filtre */}
      <Animated.View
        style={[
          collapseStyles.header,
          { top: topInset, backgroundColor: theme.primary, transform: [{ translateY }] },
        ]}
        onLayout={(e) => setPinnedH(e.nativeEvent.layout.height)}
      >
        <View onLayout={(e) => setCollapseH(e.nativeEvent.layout.height)}>
          {collapsing}
        </View>
        {pinned}
      </Animated.View>
    </View>
  );
}

const collapseStyles = StyleSheet.create({
  root: { flex: 1 },
  statusStrip: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 12 },
  header: { position: "absolute", left: 0, right: 0, zIndex: 10 },
});

// ─── REWATCH HIGHLIGHTS ────────────────────────────────────────────────────

export const RewatchHighlights = memo(function RewatchHighlights({
  theme,
  items = [],
  embedded = false,
}) {
  if (!items.length) return null;
  return (
    <GlassBox role="card" style={[
      rewatchStyles.card,
      embedded && rewatchStyles.embeddedCard,
      {
        backgroundColor: embedded ? withAlpha(theme.primary, 0.67) : theme.secondary,
        borderColor: theme.border,
      },
    ]}>
      <View style={rewatchStyles.header}>
        <View style={[rewatchStyles.icon, { backgroundColor: withAlpha(theme.accent || "#A78BFA", 0.14) }]}>
          <Ionicons name="repeat" size={16} color={theme.accent || "#A78BFA"} />
        </View>
        <View style={rewatchStyles.copy}>
          <Text style={[rewatchStyles.title, { color: theme.text.primary }]}>
            {i18nText("autoI18n.en_cok_tekrar_izlenenler", "En çok tekrar izlenenler")}
          </Text>
          <Text style={[rewatchStyles.subtitle, { color: theme.text.muted }]}>
            {i18nText("autoI18n.tekrar_izleme_ozeti", "Birden fazla izlediğiniz yapımlar")}
          </Text>
        </View>
      </View>
      <View style={rewatchStyles.rows}>
        {items.slice(0, 3).map(({ title, count }, index) => (
          <View key={`${title}-${index}`} style={rewatchStyles.row}>
            <Text style={[rewatchStyles.index, { color: theme.text.muted }]}>{index + 1}</Text>
            <Text style={[rewatchStyles.name, { color: theme.text.primary }]} numberOfLines={1}>
              {title}
            </Text>
            <View style={[rewatchStyles.count, { backgroundColor: withAlpha(theme.accent || "#A78BFA", 0.16) }]}>
              <Text style={[rewatchStyles.countText, { color: theme.accent || "#A78BFA" }]}>×{count}</Text>
            </View>
          </View>
        ))}
      </View>
    </GlassBox>
  );
});

const rewatchStyles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 20, borderWidth: 1 },
  embeddedCard: { marginHorizontal: 0, marginTop: 0, borderRadius: 14 },
  header: { flexDirection: "row", alignItems: "center" },
  icon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, marginLeft: 10 },
  title: { fontSize: 14, fontWeight: "800" },
  subtitle: { fontSize: 11, marginTop: 2 },
  rows: { marginTop: 10, gap: 7 },
  row: { minHeight: 30, flexDirection: "row", alignItems: "center" },
  index: { width: 22, fontSize: 11, fontWeight: "800" },
  name: { flex: 1, fontSize: 13, fontWeight: "600" },
  count: { minWidth: 40, height: 25, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  countText: { fontSize: 12, fontWeight: "900" },
});

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────

export const StatsEmptyState = memo(function StatsEmptyState({
  theme,
  icon = "film-outline",
  title = i18nText("autoI18n.henuz_veri_yok", "Henüz veri yok"),
  subtitle = i18nText("autoI18n.izlediklerini_ekledikce_burada_gorunecek", "İzlediklerini ekledikçe burada görünecek"),
}) {
  return (
    <View style={emptyStyles.wrap}>
      <View
        style={[
          emptyStyles.iconWrap,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        <Ionicons name={icon} size={40} color={theme.text.muted} />
      </View>
      <Text style={[emptyStyles.title, { color: theme.text.primary }]}>{title}</Text>
      <Text style={[emptyStyles.subtitle, { color: theme.text.secondary }]}>
        {subtitle}
      </Text>
    </View>
  );
});

const emptyStyles = StyleSheet.create({
  wrap: { alignItems: "center", paddingHorizontal: 32, paddingVertical: 50 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  subtitle: { fontSize: 13, textAlign: "center", lineHeight: 18 },
});
