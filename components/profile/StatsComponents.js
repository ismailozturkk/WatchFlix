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
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
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
const withAlpha = (color, alpha = 1) => {
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

// ─── HERO STATS CARD ─────────────────────────────────────────────────────────
//
// Tepe noktasında büyük gradient kart. Watched count + zaman + rank rozeti.
// İçeriği toggle ile genişletilebilir (bonus stats: toplam dakika + türler).

export const StatsHeroCard = memo(function StatsHeroCard({
  theme,
  primaryCount,
  primaryLabel,
  secondaryCount,
  secondaryLabel,
  tertiaryCount,
  tertiaryLabel,
  time = {},
  timeLabels = {},
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
  // Gradient renkleri rank renginden türetiyoruz (dinamik).
  const grad1 = rankColor || theme.accent;
  const grad2 = theme.secondary;

  return (
    <View style={heroStyles.wrap}>
      <LinearGradient
        colors={[withAlpha(grad1, 0.2), grad2, theme.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[heroStyles.card, { borderColor: theme.border }]}
      >
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
              </View>
            </>
          )}
        </View>

        {/* Time row */}
        <View style={heroStyles.timeRow}>
          {[
            { v: time.years, l: timeLabels.years },
            { v: time.months, l: timeLabels.months },
            { v: time.days, l: timeLabels.days },
            { v: time.hours, l: timeLabels.hours },
            { v: time.minutes, l: timeLabels.minutes },
          ]
            // Sıfır olan üst birimleri gizle (örn. yıl=0 ay=0 ise direkt gün'den başla)
            .reduce((acc, x, i, arr) => {
              if (acc.length === 0 && x.v === 0) {
                const remaining = arr.slice(i + 1).some((r) => r.v > 0);
                if (remaining) return acc;
              }
              acc.push(x);
              return acc;
            }, [])
            .map((x, i) => (
              <View key={i} style={heroStyles.timeChunk}>
                <Text
                  style={[heroStyles.timeValue, { color: theme.text.primary }]}
                  allowFontScaling={false}
                >
                  {x.v || 0}
                </Text>
                <Text
                  style={[heroStyles.timeLabel, { color: theme.text.secondary }]}
                  allowFontScaling={false}
                >
                  {x.l}
                </Text>
              </View>
            ))}
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
                  Toplam izlenme
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
          </View>
        )}
      </LinearGradient>
    </View>
  );
});

const heroStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, marginTop: 14 },
  card: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    overflow: "hidden",
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
  vDivider: { width: 1, height: 36, marginHorizontal: 10 },

  timeRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    marginBottom: 10,
  },
  timeChunk: { alignItems: "center", minWidth: 40 },
  timeValue: { fontSize: 18, fontWeight: "700" },
  timeLabel: { fontSize: 10, marginTop: 2, fontWeight: "600" },

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
  dates = [],
  selectedDate,
  onSelectDate,
  formatDate,
  allDatesLabel = i18nText("autoI18n.tum_tarihler", "Tüm Tarihler"),
}) {
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
          // Date chips (sadece search kapalıyken görünür)
          <FilterDateChips
            theme={theme}
            dates={dates}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            formatDate={formatDate}
            allDatesLabel={allDatesLabel}
          />
        )}
      </View>
    </View>
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
      placeholder={placeholder}
      placeholderTextColor={theme.text.muted}
      style={[filterStyles.searchInput, { color: theme.text.primary }]}
      autoFocus
    />
  );
});

const FilterDateChips = memo(function FilterDateChips({
  theme,
  dates,
  selectedDate,
  onSelectDate,
  formatDate,
  allDatesLabel,
}) {
  // "Tümü" + dates listesi
  const items = [{ key: "all", label: allDatesLabel, value: null }, ...dates.map((d) => ({
    key: d,
    label: formatDate?.(d) || d,
    value: d,
  }))];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={filterStyles.chipsScroll}
      contentContainerStyle={filterStyles.chipsContent}
      keyboardShouldPersistTaps="handled"
    >
      {items.map((it) => {
        const isActive =
          (it.value === null && !selectedDate) ||
          (it.value && selectedDate === it.value);
        return (
          <Pressable
            key={it.key}
            onPress={() => onSelectDate(it.value)}
            style={[
              filterStyles.chip,
              {
                backgroundColor: isActive ? theme.accent : theme.secondary,
                borderColor: isActive ? theme.accent : theme.border,
              },
            ]}
          >
            <Text
              style={[
                filterStyles.chipText,
                {
                  color: isActive ? "#fff" : theme.text.secondary,
                  fontWeight: isActive ? "700" : "600",
                },
              ]}
              numberOfLines={1}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
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
    gap: 6,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 110,
  },
  chipText: { fontSize: 11 },
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
            <BlurView intensity={20} tint="dark" style={cardStyles.minBadge}>
              <MaterialCommunityIcons name="clock-time-four" size={9} color="#fff" />
              <Text style={cardStyles.minText}>
                {minutes} {minutesLabel}
              </Text>
            </BlurView>
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
        removeClippedSubviews
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
        removeClippedSubviews={Platform.OS === "android"}
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
