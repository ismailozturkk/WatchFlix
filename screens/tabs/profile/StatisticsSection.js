import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { i18nText } from "@utils/i18nText";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import Skeleton from "../../../components/Skeleton";
import { withAlpha } from "../../../components/profile/StatsComponents";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useProfileStats } from "../../../context/ProfileStatsContext";

const COUNT_MODES = ["total", "unique"];
const TIME_UNITS = ["years", "months", "days", "hours", "minutes"];
// Film/dizi kartının yüklenirken tuttuğu yer. Gerçek kartın yüksekliğiyle AYNI
// olmalı (aşağıdaki mediaCard bütçesi), yoksa veri gelince sayfa zıplar.
// Bütçe: kenarlık 2 + dikey dolgu 24 + başlık 38 + boşluk 9 + süre şeridi 30
// = 103. Kompakt toplam süre kartı ≈ 64.
const MEDIA_CARD_HEIGHT = 103;

// ─── Tekrarlı / tekrarsız anahtarı ───────────────────────────────────────────
// Kartlardaki sayıları belirler. Süre her iki kipte de aynı kalır, o dakikalar
// gerçekten harcandı.

const CountModeSwitch = memo(function CountModeSwitch({ theme, mode, onToggle }) {
  // Etiketler i18nText'ten (global i18n): dil değişince memo yeniden çizilsin
  // diye dile abone (T3 B8).
  useLanguage();
  const [width, setWidth] = useState(0);
  const anim = useRef(new Animated.Value(mode === "unique" ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: mode === "unique" ? 1 : 0,
      stiffness: 260,
      damping: 24,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [anim, mode]);

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        styles.countModeSwitch,
        { backgroundColor: theme.primary, borderColor: theme.border },
      ]}
    >
      {width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.countModeIndicator,
            {
              width: (width - 4) / 2,
              backgroundColor: theme.accent,
              transform: [
                {
                  translateX: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, (width - 4) / 2],
                  }),
                },
              ],
            },
          ]}
        />
      )}
      {COUNT_MODES.map((item) => {
        const active = mode === item;
        const labelActivity = anim.interpolate({
          inputRange: [0, 1],
          outputRange: item === "total" ? [1, 0.58] : [0.58, 1],
        });
        const labelScale = anim.interpolate({
          inputRange: [0, 1],
          outputRange: item === "total" ? [1, 0.96] : [0.96, 1],
        });
        return (
          <TouchableOpacity
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            activeOpacity={0.8}
            onPress={() => {
              if (!active) onToggle();
            }}
            style={styles.countModeButton}
          >
            <Animated.Text
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[
                styles.countModeText,
                { color: active ? "#FFFFFF" : theme.text.muted },
                { opacity: labelActivity, transform: [{ scale: labelScale }] },
              ]}
            >
              {item === "total"
                ? i18nText("autoI18n.tekrarli", "Tekrarlı")
                : i18nText("autoI18n.tekrarsiz", "Tekrarsız")}
            </Animated.Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// ─── Basış animasyonu ────────────────────────────────────────────────────────

const usePressScale = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (toValue) =>
    Animated.spring(scale, {
      toValue,
      friction: 6,
      tension: 160,
      useNativeDriver: true,
    }).start();
  return { scale, onPressIn: () => to(0.97), onPressOut: () => to(1) };
};

// ─── Toplam süre kartı ───────────────────────────────────────────────────────
// Film + dizi toplamı ve ikisinin payı. Dokununca birim dk → sa → gün döner.

const TotalTimeCard = memo(function TotalTimeCard({
  theme,
  movieMinutes,
  tvMinutes,
  movieColor,
  tvColor,
  movieLabel,
  tvLabel,
  totalLabel,
  timeDisplayMode,
  formatDuration,
  onPress,
}) {
  const total = movieMinutes + tvMinutes;
  const { scale, onPressIn, onPressOut } = usePressScale();
  const short = { short: true };

  return (
    <Animated.View
      style={[
        styles.cardShadow,
        styles.totalCardShadow,
        { backgroundColor: theme.secondary, shadowColor: theme.shadow },
        { transform: [{ scale }] },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.card, styles.totalCard, { borderColor: theme.border }]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(theme.accent, 0.16), withAlpha(theme.accent, 0)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.totalTop}>
          <View style={[styles.totalIcon, { backgroundColor: withAlpha(theme.accent, 0.18) }]}>
            <Ionicons name="time-outline" size={15} color={theme.accent} />
          </View>
          <View style={styles.totalCopy}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              style={[styles.eyebrow, { color: theme.text.muted }]}
            >
              {totalLabel}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[styles.totalValue, { color: theme.text.primary }]}
            >
              {formatDuration(total, timeDisplayMode, short)}
            </Text>
          </View>
          <Ionicons name="swap-horizontal" size={14} color={theme.text.muted} />
        </View>

        {/* Film / dizi payı: segment genişliği dakikayla orantılı */}
        <View style={styles.splitBar}>
          {total > 0 ? (
            <>
              {movieMinutes > 0 && (
                <View
                  style={[
                    styles.splitSegment,
                    { flex: movieMinutes, backgroundColor: movieColor },
                  ]}
                />
              )}
              {tvMinutes > 0 && (
                <View
                  style={[styles.splitSegment, { flex: tvMinutes, backgroundColor: tvColor }]}
                />
              )}
            </>
          ) : (
            <View
              style={[
                styles.splitSegment,
                { flex: 1, backgroundColor: withAlpha(theme.text.muted, 0.18) },
              ]}
            />
          )}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: movieColor }]} />
            <Text allowFontScaling={false} style={[styles.legendLabel, { color: theme.text.muted }]}>
              {movieLabel}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.legendValue, { color: theme.text.secondary }]}
            >
              {formatDuration(movieMinutes, timeDisplayMode, short)}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: tvColor }]} />
            <Text allowFontScaling={false} style={[styles.legendLabel, { color: theme.text.muted }]}>
              {tvLabel}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.legendValue, { color: theme.text.secondary }]}
            >
              {formatDuration(tvMinutes, timeDisplayMode, short)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Film / dizi kartı ───────────────────────────────────────────────────────
// Rank renginde gradyan kart: başlık + rank rozeti, sayılar, yıl→dakika süre
// dökümü ve bir sonraki rank'e (haftalık adım) ilerleme çubuğu.

const MediaStatCard = memo(function MediaStatCard({
  theme,
  accent,
  icon,
  title,
  rankName,
  stats,
  time,
  unitLabels,
  onPress,
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();

  // Baştaki sıfır birimler (0 yıl, 0 ay…) soluk: dikkat gerçek değerlere gitsin.
  const firstActive = TIME_UNITS.findIndex((unit) => (time?.[unit] || 0) > 0);

  return (
    <Animated.View
      style={[
        styles.cardShadow,
        { backgroundColor: theme.secondary, shadowColor: theme.shadow },
        { transform: [{ scale }] },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.92}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.card, styles.mediaCard, { borderColor: withAlpha(accent, 0.3) }]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(accent, 0.24), withAlpha(accent, 0.05), withAlpha(accent, 0)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[styles.orb, { backgroundColor: withAlpha(accent, 0.1) }]}
        />

        {/* Başlık satırı: simge + ad/rank solda, sayılar sağda. Eskiden sayılar ayrı
            bir satırdı (38 pt'lik rakam); toplam süre kartıyla aynı ölçeğe inmek için
            başlıkla aynı satıra alındı. */}
        <View style={styles.mediaHeader}>
          <View
            style={[
              styles.mediaIcon,
              { backgroundColor: withAlpha(accent, 0.18), borderColor: withAlpha(accent, 0.34) },
            ]}
          >
            <Ionicons name={icon} size={19} color={accent} />
          </View>
          <View style={styles.mediaTitleCol}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.mediaTitle, { color: theme.text.primary }]}
            >
              {title}
            </Text>
            {!!rankName && (
              <View
                style={[
                  styles.rankChip,
                  { backgroundColor: withAlpha(accent, 0.16), borderColor: withAlpha(accent, 0.5) },
                ]}
              >
                <MaterialCommunityIcons name="shield-star" size={10} color={accent} />
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.rankChipText, { color: accent }]}
                >
                  {rankName}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.statsCluster}>
            {stats.map((stat, index) => (
              <View
                key={stat.label}
                style={[
                  styles.statCol,
                  index > 0 && [
                    styles.statColDivided,
                    { borderLeftColor: withAlpha(accent, 0.25) },
                  ],
                ]}
              >
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={[styles.statNumber, { color: theme.text.primary }]}
                >
                  {stat.value}
                </Text>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={[styles.statLabel, { color: theme.text.muted }]}
                >
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          <Ionicons name="chevron-forward" size={15} color={theme.text.muted} />
        </View>

        {/* Süre dökümü: tek satırlık ince şerit, hücreler "değer + birim" yan yana */}
        <View
          style={[
            styles.timeRow,
            { backgroundColor: withAlpha(theme.primary, 0.5), borderColor: withAlpha(accent, 0.18) },
          ]}
        >
          {TIME_UNITS.map((unit, index) => {
            const dim = firstActive === -1 || index < firstActive;
            return (
              <View key={unit} style={[styles.timeCell, dim && styles.timeCellDim]}>
                <Text
                  allowFontScaling={false}
                  style={[styles.timeValue, { color: dim ? theme.text.muted : theme.text.primary }]}
                >
                  {time?.[unit] ?? 0}
                </Text>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.timeLabel, { color: theme.text.muted }]}
                >
                  {unitLabels[unit]}
                </Text>
              </View>
            );
          })}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Bölüm ───────────────────────────────────────────────────────────────────

const StatisticsSection = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const {
    displayMovieCount,
    displayTvCount,
    displayEpisodesCount,
    statsCountMode,
    toggleStatsCountMode,
    totalWatchedTime,
    totalWatchedTimeTv,
    totalMinutesTime,
    totalMinutesTimeTv,
    isloadingShowInfo,
    isloadingMovieInfo,
    timeDisplayMode,
    handleTimeClick,
    formatTotalDurationTime,
    borderColorTv,
    borderColorMovie,
    rankNameTv,
    rankNameMovie,
  } = useProfileStats();

  const movieMinutes = totalMinutesTime ?? 0;
  const tvMinutes = totalMinutesTimeTv ?? 0;

  // Etiketler baştaki boşlukla gelir (" Dakika"); dar hücrede kırpılmasın.
  const unitLabels = useMemo(
    () => ({
      years: (t.profileScreen.years || "").trim(),
      months: (t.profileScreen.months || "").trim(),
      days: (t.profileScreen.days || "").trim(),
      hours: (t.profileScreen.hours || "").trim(),
      minutes: (t.profileScreen.minutes || "").trim(),
    }),
    [t.profileScreen],
  );

  const movieStats = useMemo(
    () => [{ value: displayMovieCount, label: t.profileScreen.movieWatched }],
    [displayMovieCount, t.profileScreen.movieWatched],
  );
  const tvStats = useMemo(
    () => [
      { value: displayEpisodesCount, label: t.profileScreen.tvShowEpisodetotalCount },
      { value: displayTvCount, label: t.profileScreen.tvShowCount },
    ],
    [
      displayEpisodesCount,
      displayTvCount,
      t.profileScreen.tvShowEpisodetotalCount,
      t.profileScreen.tvShowCount,
    ],
  );

  const openMovieStats = useCallback(
    () => navigation.navigate("MovieStatisticsScreen"),
    [navigation],
  );
  const openTvStats = useCallback(
    () => navigation.navigate("TvStatisticsScreen"),
    [navigation],
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text
          allowFontScaling={false}
          style={[styles.sectionTitle, { color: theme.text.muted }]}
        >
          {i18nText("autoI18n.istatistikler_upper", "İSTATİSTİKLER")}
        </Text>
        <CountModeSwitch
          theme={theme}
          mode={statsCountMode}
          onToggle={toggleStatsCountMode}
        />
      </View>

      <View style={styles.cards}>
        <TotalTimeCard
          theme={theme}
          movieMinutes={movieMinutes}
          tvMinutes={tvMinutes}
          movieColor={borderColorMovie}
          tvColor={borderColorTv}
          movieLabel={t.movies}
          tvLabel={t.tvShows}
          totalLabel={t.profileScreen.totalDuration}
          timeDisplayMode={timeDisplayMode}
          formatDuration={formatTotalDurationTime}
          onPress={handleTimeClick}
        />

        {isloadingMovieInfo ? (
          <Skeleton width="100%" height={MEDIA_CARD_HEIGHT} style={styles.skeleton} />
        ) : (
          <MediaStatCard
            theme={theme}
            accent={borderColorMovie}
            icon="film-outline"
            title={t.movies}
            rankName={rankNameMovie}
            stats={movieStats}
            time={totalWatchedTime}
            unitLabels={unitLabels}
            onPress={openMovieStats}
          />
        )}

        {isloadingShowInfo ? (
          <Skeleton width="100%" height={MEDIA_CARD_HEIGHT} style={styles.skeleton} />
        ) : (
          <MediaStatCard
            theme={theme}
            accent={borderColorTv}
            icon="tv-outline"
            title={t.tvShows}
            rankName={rankNameTv}
            stats={tvStats}
            time={totalWatchedTimeTv}
            unitLabels={unitLabels}
            onPress={openTvStats}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    width: "90%",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 10,
    textTransform: "uppercase",
  },
  cards: {
    gap: 10,
    marginBottom: 10,
  },
  skeleton: { borderRadius: 22 },

  countModeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
    marginBottom: 10,
    marginRight: 6,
    minWidth: 148,
    position: "relative",
  },
  countModeIndicator: {
    position: "absolute",
    left: 2,
    top: 2,
    bottom: 2,
    borderRadius: 999,
  },
  countModeButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    zIndex: 1,
  },
  countModeText: {
    fontSize: 10.5,
    fontWeight: "800",
  },

  // Ortak kart kabuğu. Gölge dış sarmalayıcıda: iOS'ta `overflow: hidden` olan
  // bir görünümün kendi gölgesi kesilir, o yüzden iç kart ayrı.
  cardShadow: {
    borderRadius: 22,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  totalCardShadow: { borderRadius: 17 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    right: -50,
    top: -58,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // Toplam süre
  totalCard: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 17 },
  totalTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  totalIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  totalCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  totalValue: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 19,
    fontWeight: "800",
    letterSpacing: -0.25,
    textAlign: "right",
  },
  splitBar: {
    flexDirection: "row",
    gap: 2,
    height: 4,
    marginTop: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  splitSegment: { height: "100%", minWidth: 3, borderRadius: 3 },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  legendDot: { width: 5, height: 5, borderRadius: 3 },
  legendLabel: { fontSize: 10, fontWeight: "600" },
  legendValue: { fontSize: 10, fontWeight: "800" },

  // Film / dizi kartı — toplam süre kartıyla aynı ölçekte (≈ 103 pt, eskiden ≈ 240).
  //
  // YÜKSEKLİK BÜTÇESİ (MEDIA_CARD_HEIGHT ile BİRLİKTE değişir): kenarlık 2 +
  // dikey dolgu 24 + başlık satırı 38 + boşluk 9 + süre şeridi 30. Boşluklar `gap` değil `marginTop`: kartta mutlak konumlu
  // degrade/ışık katmanları da var, `gap` ile karışmasın.
  mediaCard: { paddingVertical: 12 },
  mediaHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  mediaIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // minWidth: uzun sayı etiketleri (de/es/pt) başlık sütununu sıfıra itip rütbe
  // çipini "0 Woch…" diye kesiyordu (T3 B8); sayı kümesi ise küçülebilir.
  mediaTitleCol: { flex: 1, minWidth: 96, alignItems: "flex-start", gap: 3 },
  mediaTitle: { fontSize: 15, lineHeight: 18, fontWeight: "800", letterSpacing: -0.3 },
  rankChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    maxWidth: "100%",
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  rankChipText: { flexShrink: 1, fontSize: 9.5, lineHeight: 12, fontWeight: "800", letterSpacing: 0.2 },

  // Sayılar başlıkla aynı satırda, sağa yaslı. Dizi kartında iki sütun var.
  statsCluster: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  statCol: { alignItems: "flex-end", flexShrink: 1 },
  statColDivided: { borderLeftWidth: 1, paddingLeft: 11, marginLeft: 11 },
  statNumber: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  statLabel: { fontSize: 10, lineHeight: 12, fontWeight: "700" },

  // Süre şeridi: tek satır, "değer + birim" hücreleri eşit aralıkla.
  timeRow: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  timeCell: { flexDirection: "row", alignItems: "baseline", gap: 3, flexShrink: 1 },
  timeCellDim: { opacity: 0.55 },
  timeValue: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  timeLabel: {
    flexShrink: 1,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: "700",
    includeFontPadding: false,
  },
});

export default StatisticsSection;
