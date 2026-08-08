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
import { i18nText } from "../../utils/i18nText";

import {
  Ionicons,
  MaterialCommunityIcons,
  Fontisto,
} from "@expo/vector-icons";

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

// ─── HERO STATS CARD ─────────────────────────────────────────────────────────
//
// Tepe noktasında büyük gradient kart. Watched count + zaman + rank rozeti.
// İçeriği toggle ile genişletilebilir (bonus stats: toplam dakika + türler).

export const StatsHeroCard = memo(function StatsHeroCard({
  theme,
  primaryCount,
  primaryLabel,
  // Büyük sayı tekrarlı toplamı gösterir; alt satır aynı ölçünün tekrarsız
  // karşılığıdır. İkisi yan yana durmadan "500 film" yanıltıcı okunuyordu.
  primarySubLabel,
  secondaryCount,
  secondaryLabel,
  secondarySubLabel,
  tertiaryCount,
  tertiaryLabel,
  tertiarySubLabel,
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
  genres = [],
  genresLabel = i18nText("autoI18n.en_cok_izlenen", "En çok izlenen"),
  rankLabel = "Seviye",
}) {
  const [chartPeriod, setChartPeriod] = useState("daily");
  const [chartUnit, setChartUnit] = useState("minutes");
  const [selectedChartKey, setSelectedChartKey] = useState(null);
  // Gradient renkleri rank renginden türetiyoruz (dinamik).
  const grad1 = rankColor || theme.accent;
  const grad2 = theme.secondary;
  const chartData = chartDataByPeriod?.[chartPeriod] || [];
  const chartMax = Math.max(...chartData.map((item) => item.value), 1);
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
    const suffix = unitOptions.find((option) => option.key === chartUnit)?.label || "";
    return `${value.toFixed(decimals).replace(/\.0$/, "")}${suffix}`;
  };

  return (
    <View
      style={[
        heroStyles.wrap,
        { shadowColor: rankColor || theme.shadow, backgroundColor: theme.secondary },
      ]}
    >
      <LinearGradient
        colors={[withAlpha(grad1, 0.27), grad2, theme.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[heroStyles.card, { borderColor: theme.border }]}
      >
        <View
          pointerEvents="none"
          style={[heroStyles.decorOrb, { backgroundColor: withAlpha(grad1, 0.11) }]}
        />
        <View
          pointerEvents="none"
          style={[heroStyles.accentLine, { backgroundColor: grad1 }]}
        />

        {/* Rank badge — sağ üst */}
        {rankLevel != null && (
          <View
            style={[
              heroStyles.rankBadge,
              { backgroundColor: withAlpha(rankColor, 0.2), borderColor: rankColor },
            ]}
          >
            <MaterialCommunityIcons name="shield-star" size={12} color={rankColor} />
            <Text style={[heroStyles.rankText, { color: rankColor }]}>
              {rankName || `${rankLabel} ${rankLevel + 1}`}
            </Text>
          </View>
        )}

        {/* Main row: count(s) — 1, 2 veya 3 sütun */}
        <View style={heroStyles.mainRow}>
          <View style={heroStyles.countCol}>
            <Text style={[heroStyles.bigNumber, { color: theme.text.primary }]}>
              {primaryCount}
            </Text>
            <Text style={[heroStyles.label, { color: theme.text.muted }]}>
              {primaryLabel}
            </Text>
            {!!primarySubLabel && (
              <Text style={[heroStyles.subLabel, { color: grad1 }]}>
                {primarySubLabel}
              </Text>
            )}
          </View>

          {secondaryCount != null && (
            <>
              <View style={[heroStyles.vDivider, { backgroundColor: theme.border }]} />
              <View style={heroStyles.countCol}>
                <Text style={[heroStyles.bigNumber, { color: theme.text.primary }]}>
                  {secondaryCount}
                </Text>
                <Text style={[heroStyles.label, { color: theme.text.muted }]}>
                  {secondaryLabel}
                </Text>
                {!!secondarySubLabel && (
                  <Text style={[heroStyles.subLabel, { color: grad1 }]}>
                    {secondarySubLabel}
                  </Text>
                )}
              </View>
            </>
          )}

          {tertiaryCount != null && (
            <>
              <View style={[heroStyles.vDivider, { backgroundColor: theme.border }]} />
              <View style={heroStyles.countCol}>
                <Text style={[heroStyles.bigNumber, { color: theme.text.primary }]}>
                  {tertiaryCount}
                </Text>
                <Text style={[heroStyles.label, { color: theme.text.muted }]}>
                  {tertiaryLabel}
                </Text>
                {!!tertiarySubLabel && (
                  <Text style={[heroStyles.subLabel, { color: grad1 }]}>
                    {tertiarySubLabel}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>

        {/* Son 7 günlük izleme sütun grafiği */}
        <View
          style={[
            heroStyles.chartCard,
            {
              backgroundColor: withAlpha(theme.primary, 0.35),
              borderColor: withAlpha(grad1, 0.16),
            },
          ]}
        >
          <View style={heroStyles.chartHeader}>
            <View style={heroStyles.chartTitleRow}>
              <Ionicons name="stats-chart" size={13} color={grad1} />
              <Text style={[heroStyles.chartTitle, { color: theme.text.secondary }]}>
                {i18nText("autoI18n.izleme_ritmi", "İzleme ritmi")}
              </Text>
            </View>
            {chartData.length > 0 && (
              <View style={heroStyles.chartRangeWrap}>
                <Text style={[heroStyles.chartRange, { color: theme.text.muted }]}>
                  {chartData[0].dateLabel} – {chartData[chartData.length - 1].dateLabel}
                </Text>
                {!!selectedChartPoint?.value && (
                  <Text style={[heroStyles.chartSelectedValue, { color: grad1 }]}>
                    {selectedChartPoint.dayLabel} · {chartValueLabel(selectedChartPoint.value)}
                  </Text>
                )}
              </View>
            )}
          </View>
          <View style={heroStyles.chartControls}>
            <View style={[heroStyles.segmented, { borderColor: withAlpha(grad1, 0.2) }]}>
              {periodOptions.map((option) => {
                const active = chartPeriod === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setChartPeriod(option.key)}
                    activeOpacity={0.78}
                    style={[
                      heroStyles.segmentButton,
                      active && { backgroundColor: withAlpha(grad1, 0.2) },
                    ]}
                  >
                    <Text style={[
                      heroStyles.segmentText,
                      { color: active ? grad1 : theme.text.muted },
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[heroStyles.segmented, heroStyles.unitSegmented, { borderColor: withAlpha(grad1, 0.2) }]}>
              {unitOptions.map((option) => {
                const active = chartUnit === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setChartUnit(option.key)}
                    activeOpacity={0.78}
                    style={[
                      heroStyles.segmentButton,
                      active && { backgroundColor: withAlpha(grad1, 0.2) },
                    ]}
                  >
                    <Text style={[
                      heroStyles.segmentText,
                      { color: active ? grad1 : theme.text.muted },
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={heroStyles.chartBars}>
            {chartData.map((point) => {
              const selected = selectedChartPoint?.key === point.key;
              const dense = chartData.length > 12;
              const height = point.value > 0
                ? Math.max(7, Math.round((point.value / chartMax) * 52))
                : 4;
              const valueLabel = chartData.length <= 7 || selected
                ? chartValueLabel(point.value)
                : "";
              const selectedUnit = unitOptions.find((option) => option.key === chartUnit)?.label || "";
              const visibleValueLabel = dense && selected
                ? `${point.dayLabel} · ${valueLabel || `0${selectedUnit}`}`
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
                        color: dense && selected ? grad1 : theme.text.muted,
                        backgroundColor: dense && selected ? theme.secondary : "transparent",
                        borderColor: dense && selected ? withAlpha(grad1, 0.55) : "transparent",
                      },
                    ]}
                  >
                    {visibleValueLabel}
                  </Text>
                  <View style={heroStyles.chartTrack}>
                    <LinearGradient
                      colors={point.value > 0
                        ? [withAlpha(grad1, 0.95), withAlpha(grad1, 0.42)]
                        : [withAlpha(theme.text.muted, 0.18), withAlpha(theme.text.muted, 0.08)]}
                      style={[
                        heroStyles.chartBar,
                        {
                          height,
                          width: dense ? 6 : chartData.length > 7 ? 12 : 18,
                          borderColor: selected ? grad1 : "transparent",
                          borderWidth: selected ? 1 : 0,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[
                    heroStyles.chartDay,
                    dense && heroStyles.chartDayDense,
                    { color: selected ? grad1 : theme.text.secondary },
                  ]}>
                    {point.dayLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Expand toggle */}
        <TouchableOpacity
          style={[heroStyles.expandBtn, { borderColor: theme.border }]}
          onPress={onToggleExpand}
          activeOpacity={0.7}
        >
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={theme.text.muted}
          />
          <Text style={[heroStyles.expandText, { color: theme.text.muted }]}>
            {expanded ? "Daha az" : "Daha fazla"}
          </Text>
        </TouchableOpacity>

        {/* Expanded content */}
        {expanded && (
          <View style={[heroStyles.expanded, { borderTopColor: theme.border }]}>
            {/* Toplam dakika (mode toggle ile) */}
            <Pressable
              onPress={onTimePress}
              style={[
                heroStyles.totalRow,
                { backgroundColor: withAlpha(theme.primary, 0.67), borderColor: theme.border },
              ]}
            >
              <View style={heroStyles.totalLabel}>
                <Fontisto name="stopwatch" size={14} color={theme.text.muted} />
                <Text style={[heroStyles.totalLabelText, { color: theme.text.muted }]}>
                  {i18nText("autoI18n.toplam_izlenme", "Toplam izlenme")}
                </Text>
              </View>
              <View style={heroStyles.totalValue}>
                <Text style={[heroStyles.totalValueText, { color: theme.text.primary }]}>
                  {formatDuration?.(totalMinutes || 0, timeDisplayMode)}
                </Text>
                <Fontisto name="arrow-h" size={12} color={theme.text.muted} />
              </View>
            </Pressable>

            {/* Genre chips */}
            {genres.length > 0 && (
              <View style={heroStyles.genresWrap}>
                <Text style={[heroStyles.genresHeader, { color: theme.text.muted }]}>
                  {genresLabel}
                </Text>
                <View style={heroStyles.genreRow}>
                  {genres.filter(Boolean).slice(0, 3).map((g, i) => (
                    <View
                      key={`${g}-${i}`}
                      style={[
                        heroStyles.genreChip,
                        {
                          backgroundColor: withAlpha(theme.primary, 0.67),
                          borderColor: i === 0 ? rankColor : theme.border,
                        },
                      ]}
                    >
                      {i === 0 && (
                        <MaterialCommunityIcons
                          name="crown"
                          size={11}
                          color={rankColor}
                        />
                      )}
                      <Text
                        style={[heroStyles.genreText, { color: theme.text.primary }]}
                      >
                        {g}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
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
    padding: 17,
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
  rankBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  rankText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },

  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  countCol: { flex: 1, alignItems: "flex-start" },
  bigNumber: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  label: { fontSize: 11, marginTop: 2, fontWeight: "600" },
  subLabel: { fontSize: 9.5, marginTop: 3, fontWeight: "700" },
  vDivider: { width: 1, height: 36, marginHorizontal: 10 },

  chartCard: {
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  chartHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chartTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  chartTitle: { fontSize: 11, fontWeight: "800" },
  chartRangeWrap: { alignItems: "flex-end" },
  chartRange: { fontSize: 9.5, fontWeight: "600" },
  chartSelectedValue: { marginTop: 1, fontSize: 9, fontWeight: "800" },
  chartControls: { marginTop: 9, flexDirection: "row", gap: 7 },
  segmented: {
    flex: 1.35,
    minHeight: 30,
    padding: 2,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
  },
  unitSegmented: { flex: 1 },
  segmentButton: { flex: 1, minHeight: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  segmentText: { fontSize: 9, fontWeight: "800" },
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
  chartBar: { width: 18, borderRadius: 6 },
  chartDay: { marginTop: 3, fontSize: 9, fontWeight: "700" },
  chartDayDense: { fontSize: 7 },

  expandBtn: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  expandText: { fontSize: 11, fontWeight: "600" },

  expanded: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  totalLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  totalLabelText: { fontSize: 12, fontWeight: "600" },
  totalValue: { flexDirection: "row", alignItems: "center", gap: 6 },
  totalValueText: { fontSize: 14, fontWeight: "700" },

  genresWrap: { gap: 6 },
  genresHeader: { fontSize: 11, fontWeight: "600", marginLeft: 4 },
  genreRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  genreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  genreText: { fontSize: 11, fontWeight: "700" },
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
        <Pressable
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
        </Pressable>

        {searchVisible ? (
          <View
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
          </View>
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
    <Pressable
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
    </Pressable>
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
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={[modalStyles.closeBtn, { borderColor: theme.border }]}
            >
              <Ionicons name="close" size={18} color={theme.text.secondary} />
            </Pressable>
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
            <Pressable
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
            </Pressable>
            <Pressable
              onPress={onClose}
              style={[modalStyles.doneBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={modalStyles.doneText}>{doneLabel}</Text>
            </Pressable>
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
          <Pressable
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
          </Pressable>
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
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
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
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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

export const StatsSectionHeader = memo(function StatsSectionHeader({
  theme,
  title,
  totalMinutes,
  genres = [],
  minutesLabel = "dk",
  fallbackTitle = i18nText("autoI18n.eski_kayitlar", "Eski Kayıtlar"),
  formatDate,
  isFirst,
}) {
  const isDateValid = title && !isNaN(new Date(title).getTime());
  const displayTitle = isDateValid ? formatDate?.(title) || title : fallbackTitle;

  return (
    <View
      style={[
        sectStyles.wrap,
        { borderLeftColor: theme.border },
        isFirst && { marginTop: 4 },
      ]}
    >
      {/* Timeline dot */}
      <View style={[sectStyles.dot, { backgroundColor: theme.accent }]} />

      {/* Header row */}
      <View style={sectStyles.headerRow}>
        <View
          style={[
            sectStyles.dateChip,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <Ionicons name="calendar-outline" size={12} color={theme.text.primary} />
          <Text
            style={[sectStyles.dateText, { color: theme.text.primary }]}
            numberOfLines={1}
          >
            {displayTitle}
          </Text>
        </View>

        {totalMinutes > 0 && (
          <View
            style={[
              sectStyles.minBadge,
              {
                backgroundColor: theme.notesColor?.yellowBackground || "#fff8d6",
              },
            ]}
          >
            <MaterialCommunityIcons
              name="clock-outline"
              size={12}
              color={theme.notesColor?.yellow || "#cb9700"}
            />
            <Text
              style={[
                sectStyles.minBadgeText,
                { color: theme.notesColor?.yellow || "#cb9700" },
              ]}
            >
              {totalMinutes} {minutesLabel}
            </Text>
          </View>
        )}
      </View>

      {/* Genre chips */}
      {genres.length > 0 && (
        <View style={sectStyles.genreRow}>
          {genres.slice(0, 5).map((g, i) => (
            <View
              key={`${g}-${i}`}
              style={[sectStyles.genreChip, { backgroundColor: theme.secondary }]}
            >
              <Text style={[sectStyles.genreText, { color: theme.text.secondary }]}>
                {g}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

const sectStyles = StyleSheet.create({
  wrap: {
    paddingLeft: 18,
    paddingVertical: 10,
    marginLeft: 16,
    borderLeftWidth: 1,
    position: "relative",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: "absolute",
    left: -4.5,
    top: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 180,
  },
  dateText: { fontSize: 12, fontWeight: "700" },
  minBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  minBadgeText: { fontSize: 11, fontWeight: "700" },

  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  genreChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  genreText: { fontSize: 10, fontWeight: "600" },
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
  title,
  subtitle,
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

          {/* Bottom gradient for text readability */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.85)"]}
            style={cardStyles.bottomGrad}
          />

          {/* Minutes badge (top-right) */}
          {minutes > 0 && (
            <AdaptiveBlurView intensity={20} tint="dark" style={cardStyles.minBadge}>
              <MaterialCommunityIcons name="clock-time-four" size={9} color="#fff" />
              <Text style={cardStyles.minText}>
                {minutes} {minutesLabel}
              </Text>
            </AdaptiveBlurView>
          )}

          {/* Title overlay */}
          {title ? (
            <Text style={cardStyles.title} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
        </View>

        {/* Subtitle altta */}
        {subtitle ? (
          <Text
            style={[cardStyles.subtitle, { color: theme.text.secondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
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
  bottomGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
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
  title: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 13,
  },
  subtitle: {
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
    width: CARD_W,
    fontWeight: "600",
  },
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
  minutesLabel = "dk",
  formatDate,
  rankColor,
  isFirst,
}) {
  const renderPoster = useCallback(
    ({ item }) => (
      <StatsPosterCard
        theme={theme}
        rankColor={rankColor}
        imageUri={item.imageUri}
        title={item.title}
        subtitle={item.subtitle}
        minutes={item.minutes}
        minutesLabel={minutesLabel}
        onPress={item.onPress}
      />
    ),
    [theme, rankColor, minutesLabel],
  );

  return (
    <View>
      <StatsSectionHeader
        theme={theme}
        title={title}
        totalMinutes={totalMinutes}
        genres={genres}
        minutesLabel={minutesLabel}
        formatDate={formatDate}
        isFirst={isFirst}
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
    </View>
  );
});

const dateSectionStyles = StyleSheet.create({
  posterRow: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
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
    <View style={[
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
    </View>
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
