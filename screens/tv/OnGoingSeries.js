import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useTvShow } from "../../context/TvShowContex";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Progress from "react-native-progress";
import IconBacground from "../../components/IconBacground";

const { width } = Dimensions.get("window");
const POSTER_W = (width - 48) / 2;
const POSTER_H = POSTER_W * 1.5;


// ─── Tek kart ─────────────────────────────────────────────────────────────────
function SeriesCard({ show, navigation, theme, language, API_KEY, imageQuality }) {
  const TMDB_IMG = `https://image.tmdb.org/t/p/${imageQuality.poster}`;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // İlerleme hesabı
  const watchedEps = (show.seasons || []).reduce(
    (acc, s) => acc + (s.episodes ? s.episodes.length : 0),
    0,
  );
  const totalEps = show.showEpisodeCount || 1;
  const progress = Math.min(watchedEps / totalEps, 1);
  const isCompleted = progress >= 1;

  // Son izlenen bölüm
  const lastSeason = [...(show.seasons || [])]
    .filter((s) => s.episodes && s.episodes.length > 0)
    .sort((a, b) => b.seasonNumber - a.seasonNumber)[0];
  const lastEp = lastSeason
    ? [...lastSeason.episodes].sort(
        (a, b) => b.episodeNumber - a.episodeNumber,
      )[0]
    : null;

  const pressIn = useCallback(
    () =>
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        speed: 30,
        bounciness: 2,
      }).start(),
    [scaleAnim],
  );
  const pressOut = useCallback(
    () =>
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 4,
      }).start(),
    [scaleAnim],
  );

  const progressColor = isCompleted
    ? theme.colors.green
    : progress > 0
      ? theme.colors.orange
      : theme.colors.blue;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={() => navigation.navigate("TvShowsDetails", { id: show.id })}
      style={styles.cardWrapper}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Poster */}
        <View style={styles.posterContainer}>
          <Image
            source={
              show.imagePath
                ? { uri: `${TMDB_IMG}${show.imagePath}` }
                : require("../../assets/image/no_image.png")
            }
            style={styles.poster}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.85)"]}
            style={StyleSheet.absoluteFill}
          />

          {/* Tamamlandı rozeti */}
          {isCompleted && (
            <View
              style={[
                styles.completedBadge,
                { backgroundColor: theme.colors.green + "DD" },
              ]}
            >
              <Ionicons name="checkmark-circle" size={11} color="#fff" />
              <Text allowFontScaling={false} style={styles.completedText}>
                Tamamlandı
              </Text>
            </View>
          )}

          {/* İlerleme bar (poster üstünde) */}
          <View style={styles.progressOverlay}>
            <Progress.Bar
              progress={progress}
              width={POSTER_W - 16}
              height={4}
              borderWidth={0}
              borderRadius={2}
              color={progressColor}
              unfilledColor="rgba(255,255,255,0.2)"
              animationConfig={{ bounciness: 10 }}
            />
          </View>
        </View>

        {/* Bilgi */}
        <View style={styles.info}>
          <Text
            style={[styles.title, { color: theme.text.primary }]}
            numberOfLines={2}
          >
            {show.name}
          </Text>

          {/* Son bölüm */}
          {lastEp && (
            <View style={styles.epRow}>
              <Ionicons
                name="play-circle-outline"
                size={11}
                color={theme.text.muted}
              />
              <Text
                style={[styles.epText, { color: theme.text.muted }]}
                numberOfLines={1}
              >
                S{lastSeason.seasonNumber} · B{lastEp.episodeNumber}
                {lastEp.episodeName ? ` — ${lastEp.episodeName}` : ""}
              </Text>
            </View>
          )}

          {/* Bölüm sayacı */}
          <View style={styles.epRow}>
            <Ionicons name="tv-outline" size={11} color={progressColor} />
            <Text
              allowFontScaling={false}
              style={[styles.progressLabel, { color: progressColor }]}
            >
              {watchedEps} / {totalEps} bölüm
            </Text>
          </View>

          {/* Sezon sayısı */}
          <View style={styles.epRow}>
            <Ionicons
              name="layers-outline"
              size={11}
              color={theme.text.muted}
            />
            <Text
              allowFontScaling={false}
              style={[styles.epText, { color: theme.text.muted }]}
            >
              {show.showSeasonCount || (show.seasons || []).length} sezon
            </Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Ana ekran ─────────────────────────────────────────────────────────────────
export default function OnGoingSeries({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { API_KEY, imageQuality } = useAppSettings();
  const { watchedTvShows: shows, loadingWatchedTv: loading } = useTvShow();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // all | ongoing | completed

  // ── Filtrele + Ara ──────────────────────────────────────────────────────────
  const filtered = shows.filter((s) => {
    const watchedEps = (s.seasons || []).reduce(
      (acc, ss) => acc + (ss.episodes ? ss.episodes.length : 0),
      0,
    );
    const total = s.showEpisodeCount || 1;
    const pct = watchedEps / total;

    if (activeFilter === "ongoing" && pct >= 1) return false;
    if (activeFilter === "completed" && pct < 1) return false;

    if (!searchQuery.trim()) return true;
    return (s.name || "").toLowerCase().includes(searchQuery.toLowerCase());
  });

  // ── Üst istatistikler ──────────────────────────────────────────────────────
  const totalShows = shows.length;
  const completedShows = shows.filter((s) => {
    const watched = (s.seasons || []).reduce(
      (acc, ss) => acc + (ss.episodes ? ss.episodes.length : 0),
      0,
    );
    return watched >= (s.showEpisodeCount || 1);
  }).length;
  const ongoingShows = totalShows - completedShows;
  const totalEpsWatched = shows.reduce(
    (acc, s) =>
      acc +
      (s.seasons || []).reduce(
        (a, ss) => a + (ss.episodes ? ss.episodes.length : 0),
        0,
      ),
    0,
  );

  const renderItem = useCallback(
    ({ item }) => (
      <SeriesCard
        show={item}
        navigation={navigation}
        theme={theme}
        language={language}
        API_KEY={API_KEY}
        imageQuality={imageQuality}
      />
    ),
    [navigation, theme, language, API_KEY, imageQuality],
  );

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: theme.primary }]}>
        <StatusBar barStyle="light-content" />
        <IconBacground opacity={0.3} />
        <ActivityIndicator
          size="large"
          color={theme.accent}
          style={{ flex: 1 }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" />
      <IconBacground opacity={0.3} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[
              styles.backBtn,
              { backgroundColor: theme.secondary + "CC" },
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={theme.text.primary}
            />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text
              allowFontScaling={false}
              style={[styles.headerTitle, { color: theme.text.primary }]}
            >
              Devam Eden Diziler
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.headerSub, { color: theme.text.muted }]}
            >
              {totalShows} dizi izlendi
            </Text>
          </View>
        </View>

        {/* ── İstatistik kartları ── */}
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <Ionicons name="tv" size={20} color={theme.colors.blue} />
            <Text
              allowFontScaling={false}
              style={[styles.statNum, { color: theme.colors.blue }]}
            >
              {totalShows}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.statLabel, { color: theme.text.muted }]}
            >
              Toplam
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <Ionicons
              name="play-circle"
              size={20}
              color={theme.colors.orange}
            />
            <Text
              allowFontScaling={false}
              style={[styles.statNum, { color: theme.colors.orange }]}
            >
              {ongoingShows}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.statLabel, { color: theme.text.muted }]}
            >
              Devam Eden
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <Ionicons
              name="checkmark-done"
              size={20}
              color={theme.colors.green}
            />
            <Text
              allowFontScaling={false}
              style={[styles.statNum, { color: theme.colors.green }]}
            >
              {completedShows}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.statLabel, { color: theme.text.muted }]}
            >
              Tamamlandı
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <Ionicons name="film" size={20} color={theme.accent} />
            <Text
              allowFontScaling={false}
              style={[styles.statNum, { color: theme.accent }]}
            >
              {totalEpsWatched}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.statLabel, { color: theme.text.muted }]}
            >
              Bölüm
            </Text>
          </View>
        </View>

        {/* ── Arama ── */}
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <Ionicons name="search" size={16} color={theme.text.muted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text.primary }]}
            placeholder="Dizi ara..."
            placeholderTextColor={theme.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={16}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Filtre ── */}
        <View style={styles.filterRow}>
          {[
            { key: "all", label: "Tümü" },
            { key: "ongoing", label: "Devam Ediyor" },
            { key: "completed", label: "Tamamlandı" },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              style={[
                styles.filterBtn,
                {
                  backgroundColor:
                    activeFilter === f.key ? theme.accent : theme.secondary,
                  borderColor:
                    activeFilter === f.key ? theme.accent : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: activeFilter === f.key ? "#fff" : theme.text.muted,
                    fontWeight: activeFilter === f.key ? "700" : "400",
                  },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Liste ── */}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="tv-outline" size={60} color={theme.text.muted} />
            <Text
              allowFontScaling={false}
              style={[styles.emptyTitle, { color: theme.text.primary }]}
            >
              {searchQuery ? "Sonuç bulunamadı" : "Henüz dizi yok"}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.emptySubt, { color: theme.text.muted }]}
            >
              {searchQuery
                ? `"${searchQuery}" ile eşleşen dizi yok`
                : "İzlediğiniz diziler burada görünecek"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => `${item.id}`}
            renderItem={renderItem}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 2 },

  // ── Stats ──
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  statNum: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 9, textAlign: "center" },

  // ── Search ──
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },

  // ── Filter ──
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 12 },

  // ── List ──
  list: { paddingHorizontal: 12, paddingBottom: 30 },
  row: { gap: 12, marginBottom: 12 },

  // ── Card ──
  cardWrapper: { flex: 1 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  posterContainer: {
    width: "100%",
    height: POSTER_H,
    position: "relative",
  },
  poster: { width: "100%", height: "100%" },
  completedBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  completedText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  progressOverlay: {
    position: "absolute",
    bottom: 0,
    left: 8,
    right: 8,
    paddingBottom: 6,
  },

  // ── Card info ──
  info: {
    padding: 10,
    gap: 4,
  },
  title: { fontSize: 13, fontWeight: "700", lineHeight: 17 },
  epRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  epText: { fontSize: 10, flex: 1 },
  progressLabel: { fontSize: 10, fontWeight: "700" },

  // ── Empty ──
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingBottom: 60,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySubt: { fontSize: 13, textAlign: "center", paddingHorizontal: 30 },
});
