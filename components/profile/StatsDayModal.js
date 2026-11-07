// components/profile/StatsDayModal.js
//
// Film / Dizi istatistik ekranlarında bir günün takvim yaprağına basınca açılan
// "gün özeti" alt sayfası: o günün toplam süresi, adedi, ortalama süresi (film)
// ya da kaç farklı dizi izlendiği (dizi), sayılı tür çipleri ve izlenenlerin yatay
// afiş şeridi.
//
// Veri, ekranların gün kartı için hazırladığı bölümün kendisidir (afiş öğeleri
// title/subtitle/genres taşır); sayılar utils/statsDaySummary'de hesaplanır.
// Şeritten bir afişe basınca sayfa önce kapanır, ayrıntı ekranına çıkış
// animasyonu bittikten SONRA gidilir (iOS'ta açık Modal'ın üstüne ekran itilmez).

import React, { memo, useCallback, useMemo, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import { i18nText } from "../../utils/i18nText";
import { formatMinutes } from "../../utils/mediaFacts";
import { summarizeStatsDay } from "../../utils/statsDaySummary";
import { StatsCalendarLeaf, withAlpha } from "./StatsComponents";

const { height: SCREEN_H } = Dimensions.get("window");

const MetricTile = memo(function MetricTile({ theme, tint, icon, value, label }) {
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: withAlpha(tint, 0.1), borderColor: withAlpha(tint, 0.28) },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={16} color={tint} />
      <Text
        style={[styles.tileValue, { color: theme.text.primary }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      <Text style={[styles.tileLabel, { color: theme.text.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

const SectionLabel = ({ theme, icon, children }) => (
  <View style={styles.sectionHeader}>
    <Ionicons name={icon} size={13} color={theme.text.muted} />
    <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{children}</Text>
  </View>
);

// Tür çipi: ad + o günün kaç öğesinde geçtiği (bir film birden çok türde olabilir).
const GenreChip = memo(function GenreChip({ theme, tint, genre }) {
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: withAlpha(tint, 0.12), borderColor: withAlpha(tint, 0.3) },
      ]}
    >
      <Text style={[styles.chipText, { color: theme.text.primary }]} numberOfLines={1}>
        {genre.name}
      </Text>
      <View style={[styles.chipCount, { backgroundColor: tint }]}>
        <Text style={styles.chipCountText}>{genre.count}</Text>
      </View>
    </View>
  );
});

const POSTER_W = 92;
const POSTER_H = POSTER_W * 1.5;

// İzlenenler şeridindeki afiş: süre afişin alt kenarında, ad (ve dizide bölüm
// kodu) altında.
const WatchedCard = memo(function WatchedCard({ theme, tint, item, durationLabel, onPress }) {
  const handlePress = useCallback(() => onPress(item), [onPress, item]);
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={[item.title, item.subtitle, durationLabel].filter(Boolean).join(", ")}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.poster, { backgroundColor: withAlpha(tint, 0.16) }]}>
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.posterImage} contentFit="cover" />
        ) : (
          <Ionicons name="image-outline" size={20} color={tint} />
        )}
        {durationLabel ? (
          <View style={styles.durationPill}>
            <Ionicons name="time-outline" size={10} color="#fff" />
            <Text style={styles.durationText} numberOfLines={1}>
              {durationLabel}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.cardTitle, { color: theme.text.primary }]} numberOfLines={2}>
        {item.title || "—"}
      </Text>
      {item.subtitle ? (
        <Text style={[styles.cardSubtitle, { color: theme.text.muted }]} numberOfLines={1}>
          {item.subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
});

const itemKey = (item) => item.key;

/**
 * @param {object} props
 * @param {"movie"|"tv"} props.kind
 * @param {{ title: string, posters: object[] } | null} props.day  ekranın gün bölümü
 * @param {string} [props.minutesLabel]  kısa dakika etiketi ("dk")
 * @param {string} [props.accent]        ekranın rütbe rengi
 */
const StatsDayModal = memo(function StatsDayModal({
  visible,
  onClose,
  theme,
  kind = "movie",
  day,
  formatDate,
  locale,
  minutesLabel = "dk",
  accent,
}) {
  const tint = accent || theme.accent;
  const items = day?.posters || [];
  // Çipler tek satırda yatay kayar; günün tüm türleri gösterilir (TMDB tür sayısı sınırlı).
  const summary = useMemo(() => summarizeStatsDay(items, { genreLimit: 20 }), [items]);
  const isTv = kind === "tv";
  // Afiş şeridi sayfanın dibinde: sistem çubuğunun altında kalmasın.
  const { bottom: bottomInset } = useSafeAreaInsets();

  const duration = useCallback(
    (minutes) =>
      formatMinutes(minutes, {
        hourLabel: i18nText("autoI18n.saat_kisa", "sa"),
        minuteLabel: minutesLabel,
      }),
    [minutesLabel],
  );

  // Şeritten seçilen öğe: sayfa kapanınca (onDismissed) ayrıntıya gidilir.
  const pendingRef = useRef(null);
  const openItem = useCallback(
    (item) => {
      pendingRef.current = item;
      onClose();
    },
    [onClose],
  );
  const onDismissed = useCallback(() => {
    const item = pendingRef.current;
    pendingRef.current = null;
    item?.onPress?.();
  }, []);

  const renderWatched = useCallback(
    ({ item }) => (
      <WatchedCard
        theme={theme}
        tint={tint}
        item={item}
        durationLabel={duration(item.minutes)}
        onPress={openItem}
      />
    ),
    [theme, tint, duration, openItem],
  );

  const countLabel = isTv
    ? i18nText("autoI18n.gun_ozeti_bolum", "Bölüm")
    : i18nText("autoI18n.gun_ozeti_film", "Film");
  const dateTitle = day ? formatDate?.(day.title) || day.title : "";

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.header}>
        <StatsCalendarLeaf theme={theme} title={day?.title} locale={locale} accent={tint} large />
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: tint }]}>
            {i18nText("autoI18n.gun_ozeti", "Gün özeti")}
          </Text>
          <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={2}>
            {dateTitle}
          </Text>
        </View>
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
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: 16 + bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tiles}>
          <MetricTile
            theme={theme}
            tint={tint}
            icon="clock-outline"
            value={duration(summary.totalMinutes) || "—"}
            label={i18nText("autoI18n.toplam_sure", "Toplam süre")}
          />
          <MetricTile
            theme={theme}
            tint={tint}
            icon={isTv ? "play-circle-outline" : "filmstrip"}
            value={String(summary.count)}
            label={countLabel}
          />
          {isTv ? (
            <MetricTile
              theme={theme}
              tint={tint}
              icon="television-classic"
              value={String(summary.distinctTitles)}
              label={i18nText("autoI18n.gun_ozeti_farkli_dizi", "Farklı dizi")}
            />
          ) : (
            <MetricTile
              theme={theme}
              tint={tint}
              icon="timer-sand"
              value={duration(summary.avgMinutes) || "—"}
              label={i18nText("autoI18n.gun_ozeti_ortalama", "Ortalama süre")}
            />
          )}
        </View>

        {summary.genres.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel theme={theme} icon="pricetags-outline">
              {i18nText("autoI18n.turler", "TÜRLER")}
            </SectionLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.strip}
              contentContainerStyle={styles.chips}
            >
              {summary.genres.map((genre) => (
                <GenreChip key={genre.name} theme={theme} tint={tint} genre={genre} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {items.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel theme={theme} icon={isTv ? "play-circle-outline" : "film-outline"}>
              {i18nText("autoI18n.gun_ozeti_izlenenler", "İzlenenler")}
            </SectionLabel>
            <FlatList
              data={items}
              horizontal
              keyExtractor={itemKey}
              renderItem={renderWatched}
              showsHorizontalScrollIndicator={false}
              style={styles.strip}
              contentContainerStyle={styles.stripContent}
              initialNumToRender={5}
            />
          </View>
        ) : null}
      </ScrollView>
    </BottomSheetModal>
  );
});

export default StatsDayModal;

const styles = StyleSheet.create({
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
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 14,
  },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  title: { marginTop: 2, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  body: { paddingHorizontal: 16, maxHeight: Math.round(SCREEN_H * 0.62) },
  bodyContent: { paddingBottom: 16, gap: 20 },

  tiles: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  tileValue: { fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  tileLabel: { fontSize: 11, fontWeight: "700" },

  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },

  // Afiş şeridi gibi kenara kadar kayar (stil: strip).
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 12,
    paddingRight: 5,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { flexShrink: 1, fontSize: 13, fontWeight: "700" },
  chipCount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCountText: { color: "#fff", fontSize: 11.5, fontWeight: "900" },

  // Şeritler (türler, afişler) sayfa gövdesinin yatay dolgusunu taşar: kenara kadar kayar.
  strip: { marginHorizontal: -16 },
  stripContent: { paddingHorizontal: 16, gap: 10 },
  card: { width: POSTER_W },
  cardPressed: { opacity: 0.65 },
  poster: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  posterImage: { ...StyleSheet.absoluteFillObject },
  durationPill: {
    position: "absolute",
    left: 5,
    bottom: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  durationText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
  cardTitle: { marginTop: 6, fontSize: 12.5, lineHeight: 16, fontWeight: "700" },
  cardSubtitle: { marginTop: 1, fontSize: 11, fontWeight: "600" },
});
