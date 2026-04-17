import React, { useState, useEffect, useCallback, memo, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from "react-native";
import axios from "axios";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { SearchSkeleton } from "../../components/Skeleton";
import RatingStars from "../../components/RatingStars";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import LottieView from "lottie-react-native";
import { useSnow } from "../../context/SnowContext";
import WatchedAdd from "./WatchedAdd";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import AntDesign from "@expo/vector-icons/AntDesign";
import { useAppSettings } from "../../context/AppSettingsContext";
import Reminder from "../../components/Reminder";

const { width } = Dimensions.get("window");

// ─── Yardımcı: Puan rengi ────────────────────────────────────────────────────
const getRatingColor = (r) => {
  if (r >= 8) return "#29b864";
  if (r >= 6) return "#f5c518";
  if (r >= 4) return "#ff6400";
  return "#e33";
};

// ─── Bölüm Kartı (Memoize) ────────────────────────────────────────────────────
const EpisodeCard = memo(
  ({
    episode,
    showId,
    showName,
    seasonNumber,
    showEpisodeCount,
    showSeasonCount,
    showPosterPath,
    seasonPosterPath,
    seasonEpisodeCount,
    genres,
    theme,
    imageQuality,
    t,
    isPlaying,
    dateDiff,
    onPress,
    adjustOpacity,
  }) => {
    const ratingColor = getRatingColor(episode.vote_average);
    const isUpcoming = dateDiff?.isRemaining;

    return (
      <TouchableOpacity
        style={[
          styles.episodeCard,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
        activeOpacity={0.78}
        onPress={onPress}
      >
        {/* Havai fişek animasyonu */}
        {isPlaying && (
          <>
            <LottieView
              style={styles.fireworksLeft}
              source={require("../../LottieJson/6_fireworks.json")}
              autoPlay
              loop={false}
            />
            <LottieView
              style={styles.fireworksRight}
              source={require("../../LottieJson/6_fireworks.json")}
              autoPlay
              loop={false}
            />
          </>
        )}

        {/* ── Sol: Görsel ───────────────────────────────────────────────── */}
        <View style={styles.episodeThumbnailWrapper}>
          {episode.still_path ? (
            <>
              <Image
                source={{
                  uri: `https://image.tmdb.org/t/p/${imageQuality.poster}${episode.still_path}`,
                }}
                style={styles.episodeThumbnail}
              />
              {/* Üstten karartma – runtime rozeti için */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.55)"]}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <View
              style={[
                styles.episodeThumbnailPlaceholder,
                { backgroundColor: theme.border },
              ]}
            >
              <Ionicons
                name="film-outline"
                size={32}
                color={theme.text?.muted ?? "#555"}
              />
            </View>
          )}

          {/* Runtime rozeti */}
          {episode.runtime > 0 && (
            <View
              style={[
                styles.runtimeBadge,
                { backgroundColor: adjustOpacity(theme.secondary, 0.82) },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={10}
                color={theme.text?.primary ?? "#fff"}
                style={{ marginRight: 3 }}
              />
              <Text
                style={[
                  styles.runtimeText,
                  { color: theme.text?.primary ?? "#fff" },
                ]}
              >
                {episode.runtime} {t.time}
              </Text>
            </View>
          )}

          {/* Puan rozeti – sol alt */}
          {episode.vote_average > 0 && (
            <View
              style={[
                styles.ratingBadgeOnThumb,
                { backgroundColor: ratingColor + "dd" },
              ]}
            >
              <Text style={styles.ratingBadgeOnThumbText}>
                ★ {episode.vote_average.toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        {/* ── Sağ: Bilgiler ─────────────────────────────────────────────── */}
        <View style={styles.episodeBody}>
          {/* Üst satır: bölüm no + tarih + hatırlatıcı + izlendi */}
          <View style={styles.episodeTopRow}>
            <View style={styles.episodeMetaLeft}>
              <Text
                style={[
                  styles.episodeNumText,
                  { color: theme.text?.secondary ?? "#aaa" },
                ]}
              >
                {episode.episode_number}. {t.episode}
              </Text>
              {episode.air_date && (
                <View
                  style={[
                    styles.datePill,
                    isUpcoming && {
                      backgroundColor:
                        theme.notesColor?.blueBackground ??
                        "rgba(100,160,255,0.18)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.datePillText,
                      {
                        color: isUpcoming
                          ? (theme.text?.primary ?? "#fff")
                          : (theme.text?.secondary ?? "#aaa"),
                      },
                    ]}
                  >
                    {dateDiff?.text ?? ""}
                  </Text>
                </View>
              )}
              {isUpcoming && (
                <Reminder
                  showId={showId}
                  episodeId={episode.id}
                  showName={showName}
                  showPosterPath={showPosterPath}
                  seasonNumber={seasonNumber}
                  episodeNumber={episode.episode_number}
                  episodeName={episode.name}
                  airDate={episode.air_date}
                  stillPath={episode.still_path || null}
                  seasonPosterPath={seasonPosterPath}
                  episodeMinutes={episode.runtime}
                  type="tv"
                />
              )}
            </View>

            {!isUpcoming && (
              <WatchedAdd
                showId={showId}
                showName={showName}
                showReleaseDate={episode.air_date}
                seasonNumber={seasonNumber}
                showPosterPath={showPosterPath}
                showEpisodeCount={showEpisodeCount}
                showSeasonCount={showSeasonCount}
                seasonEpisodes={seasonEpisodeCount}
                episodeNumber={episode.episode_number}
                episodeName={episode.name}
                episodeMinutes={episode.runtime}
                episodeRatings={episode.vote_average.toFixed(1)}
                seasonPosterPath={seasonPosterPath}
                episodePosterPath={episode.still_path}
                genres={genres}
                size={32}
              />
            )}
          </View>

          {/* Bölüm adı */}
          <Text
            style={[
              styles.episodeName,
              { color: theme.text?.primary ?? "#fff" },
            ]}
            numberOfLines={2}
          >
            {episode.name}
          </Text>

          {/* Özet */}
          {episode.overview ? (
            <Text
              style={[
                styles.episodeOverview,
                { color: theme.text?.secondary ?? "#aaa" },
              ]}
              numberOfLines={2}
            >
              {episode.overview}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  },
);

// ─── Bölüm Başlığı ────────────────────────────────────────────────────────────
const SectionTitle = memo(({ label, theme, count }) => (
  <View style={styles.sectionTitleRow}>
    <View style={styles.sectionAccent} />
    <Text
      style={[styles.sectionTitle, { color: theme.text?.primary ?? "#fff" }]}
    >
      {label}
    </Text>
    {count != null && (
      <View style={styles.sectionCountBadge}>
        <Text style={styles.sectionCountText}>{count}</Text>
      </View>
    )}
  </View>
));

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function SeasonDetails({ route, navigation }) {
  const {
    showId,
    seasonNumber,
    showName,
    showEpisodeCount,
    showSeasonCount,
    showPosterPath,
    genres,
  } = route.params;

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lineCount, setLineCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [play, setPlay] = useState("");
  const [isSeasonWatched, setIsSeasonWatched] = useState(0);

  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { API_KEY, showSnow, imageQuality } = useAppSettings();

  // ── Yardımcılar ───────────────────────────────────────────────────────────
  const formatDate = useCallback(
    (ts) =>
      new Intl.DateTimeFormat(language, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(ts)),
    [language],
  );

  const adjustOpacity = useCallback((rgbColor, opacity) => {
    const rgb = rgbColor.match(/\d+/g);
    if (!rgb) return rgbColor;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
  }, []);

  const calculateDateDifference = useCallback(
    (airDate) => {
      if (!airDate) return null;
      const diff = new Date(airDate).getTime() - Date.now();
      if (diff < 0) return { text: formatDate(airDate), isRemaining: false };
      const days = Math.floor(diff / 86400000);
      const months = Math.floor(days / 30);
      const remDays = days % 30;
      let text;
      if (months > 0) {
        text =
          remDays > 0
            ? `${months} ${t.month} ${remDays} ${t.days}`
            : `${months} ${t.month}`;
      } else if (days > 0) {
        text = `${days} ${t.days}`;
      } else {
        text = t.today;
      }
      return { text, isRemaining: true };
    },
    [formatDate, t],
  );

  // ── Veri Çekme ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}`,
          {
            params: { language: language === "tr" ? "tr-TR" : "en-US" },
            headers: { accept: "application/json", Authorization: API_KEY },
          },
        );
        if (!cancelled) setDetails(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, [showId, seasonNumber, language, API_KEY]);

  // ── Firestore İzleme ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !showId || !seasonNumber) return;
    const unsubscribe = onSnapshot(doc(db, "Lists", user.uid), (snap) => {
      if (!snap.exists()) return;
      const watchedTv = snap.data().watchedTv || [];
      const tvShow = watchedTv.find((s) => s.id === showId);
      if (tvShow?.seasons?.[seasonNumber - 1]) {
        const season = tvShow.seasons[seasonNumber - 1];
        if (season.episodes?.length && season.seasonEpisodes) {
          setIsSeasonWatched(season.episodes.length / season.seasonEpisodes);
        }
      } else {
        setIsSeasonWatched(0);
      }
    });
    return unsubscribe;
  }, [user, showId, seasonNumber]);

  // ── Kar efekti lottie sayısını sınırla ───────────────────────────────────
  const snowIndices = useMemo(() => {
    if (!details || !showSnow) return [];
    return details.episodes
      .map((ep, i) => i)
      .filter((i) => (i + 7) % 7 === 0 || i < 4);
  }, [details, showSnow]);

  if (loading) return <SearchSkeleton />;

  if (!details) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primary }]}>
        <Text style={[styles.loadingText, { color: theme.text?.primary }]}>
          {t.loading}
        </Text>
      </View>
    );
  }

  const progressColor =
    isSeasonWatched === 1 ? theme.colors?.green : theme.colors?.orange;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.primary }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Konfeti */}
      {isSeasonWatched === 1 && (
        <LottieView
          style={styles.confetti}
          source={require("../../LottieJson/confetti_2.json")}
          autoPlay
          loop={false}
        />
      )}

      {/* ── Hero: Poster ──────────────────────────────────────────────────── */}
      <View style={styles.heroContainer}>
        {details.poster_path ? (
          <Image
            source={{
              uri: `https://image.tmdb.org/t/p/original${details.poster_path}`,
            }}
            style={styles.heroPoster}
          />
        ) : (
          <View
            style={[
              styles.heroPlaceholder,
              { backgroundColor: theme.secondary },
            ]}
          >
            <Ionicons
              name="image"
              size={90}
              color={theme.text?.muted ?? "#555"}
            />
          </View>
        )}
        {/* Üstten hafif karartma */}
        <LinearGradient
          colors={["rgba(0,0,0,0.5)", "transparent"]}
          locations={[0, 0.28]}
          style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
        />
        {/* Alttan tema rengine geçiş */}
        <LinearGradient
          colors={["transparent", theme.primary]}
          locations={[0.6, 1]}
          style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
        />
        {/* Sezon adı – sol alt, gradient üzerinde */}
        <View style={[styles.seasonHeroBadge, { zIndex: 2 }]}>
          <Text style={styles.seasonHeroBadgeText}>{details.name}</Text>
        </View>
      </View>

      {/* ── İçerik ───────────────────────────────────────────────────────── */}
      <View style={[styles.content, { backgroundColor: theme.primary }]}>
        {/* Kar efekti */}
        {snowIndices.map((i) => (
          <LottieView
            key={details.episodes[i].episode_number}
            style={[
              styles.lottie,
              { top: 1000 * Math.floor(i < 7 ? i : i / 7) },
            ]}
            source={require("../../LottieJson/snow.json")}
            autoPlay
            loop
          />
        ))}

        {/* ── Başlık Bloğu ─────────────────────────────────────────────── */}
        <View style={styles.titleBlock}>
          <Text
            style={[
              styles.showNameText,
              { color: theme.text?.secondary ?? "#aaa" },
            ]}
          >
            {showName}
          </Text>
          <View style={styles.metaRow}>
            {details.air_date && (
              <View
                style={[
                  styles.metaBadge,
                  { backgroundColor: "rgba(255,255,255,0.08)" },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={theme.text?.secondary ?? "#aaa"}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.metaBadgeText,
                    { color: theme.text?.secondary ?? "#aaa" },
                  ]}
                >
                  {formatDate(details.air_date)}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.metaBadge,
                { backgroundColor: "rgba(255,255,255,0.08)" },
              ]}
            >
              <Ionicons
                name="play-circle-outline"
                size={12}
                color={theme.text?.secondary ?? "#aaa"}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.metaBadgeText,
                  { color: theme.text?.secondary ?? "#aaa" },
                ]}
              >
                {details.episodes.length} {t.episode}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Puan ─────────────────────────────────────────────────────── */}
        {details.vote_average > 0 && (
          <View style={styles.ratingRow}>
            <View
              style={[
                styles.ratingPill,
                {
                  borderColor: getRatingColor(details.vote_average) + "55",
                  backgroundColor: getRatingColor(details.vote_average) + "18",
                },
              ]}
            >
              <Text
                style={[
                  styles.ratingPillStar,
                  { color: getRatingColor(details.vote_average) },
                ]}
              >
                ★
              </Text>
              <Text
                style={[
                  styles.ratingPillScore,
                  { color: getRatingColor(details.vote_average) },
                ]}
              >
                {details.vote_average.toFixed(1)}
              </Text>
              <Text
                style={[
                  styles.ratingPillMax,
                  { color: theme.text?.secondary ?? "#aaa" },
                ]}
              >
                /10
              </Text>
            </View>
          </View>
        )}

        {/* ── İzlenme Çubuğu ───────────────────────────────────────────── */}
        <View style={styles.progressWrapper}>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.round(isSeasonWatched * 100)}%`,
                  backgroundColor: progressColor,
                },
              ]}
            />
          </View>
          {isSeasonWatched > 0 && (
            <Text style={[styles.progressLabel, { color: progressColor }]}>
              %{Math.round(isSeasonWatched * 100)}
            </Text>
          )}
        </View>

        <View
          style={[
            styles.divider,
            { backgroundColor: "rgba(255,255,255,0.07)" },
          ]}
        />

        {/* ── Özet ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionTitle label={t.overview} theme={theme} />
          <Text
            style={[
              styles.overviewText,
              { color: theme.text?.secondary ?? "#aaa" },
            ]}
            numberOfLines={expanded ? undefined : 5}
            ellipsizeMode="tail"
            onTextLayout={(e) => setLineCount(e.nativeEvent.lines.length)}
          >
            {details.overview || t.noOverviewAvailable}
          </Text>
          {lineCount > 5 && (
            <TouchableOpacity
              onPress={() => setExpanded((v) => !v)}
              style={styles.expandBtn}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.expandBtnInner,
                  { backgroundColor: theme.secondary },
                ]}
              >
                <MaterialIcons
                  name={expanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                  size={22}
                  color={theme.text?.primary ?? "#fff"}
                />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Bölüm Listesi ────────────────────────────────────────────── */}
        <View style={[styles.section, { paddingBottom: 30 }]}>
          <SectionTitle
            label={t.episode}
            theme={theme}
            count={details.episodes.length}
          />
          {details.episodes.map((episode) => {
            const dateDiff = calculateDateDifference(episode.air_date);
            return (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                showId={showId}
                showName={showName}
                seasonNumber={seasonNumber}
                showEpisodeCount={showEpisodeCount}
                showSeasonCount={showSeasonCount}
                showPosterPath={showPosterPath}
                seasonPosterPath={details.poster_path}
                seasonEpisodeCount={details.episodes.length}
                genres={genres}
                theme={theme}
                imageQuality={imageQuality}
                t={t}
                isPlaying={episode.id === play}
                dateDiff={dateDiff}
                adjustOpacity={adjustOpacity}
                onPress={() =>
                  navigation.navigate("EpisodeDetails", {
                    showId,
                    showName,
                    seasonNumber,
                    seasonEpisodes: details.episodes.length,
                    episodeNumber: episode.episode_number,
                    showEpisodeCount,
                    showSeasonCount,
                    showPosterPath,
                    seasonPosterPath: details.poster_path,
                    genres,
                  })
                }
              />
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  loadingText: { fontSize: 16, textAlign: "center", marginTop: 20 },

  confetti: {
    position: "absolute",
    height: 600,
    left: 0,
    right: 0,
    zIndex: 1,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroContainer: {
    width: "100%",
    height: Math.round(width * 1.35), // ~2:3 poster oranı, cihaza göre ölçekli
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#0a0a0a",
  },
  heroPoster: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  heroPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  seasonHeroBadge: {
    position: "absolute",
    bottom: 24,
    left: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  seasonHeroBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // ── İçerik ────────────────────────────────────────────────────────────────
  content: {
    flex: 1,
    marginTop: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  lottie: {
    position: "absolute",
    height: 1000,
    top: 0,
    left: -120,
    right: -120,
    zIndex: 0,
  },

  // ── Başlık ────────────────────────────────────────────────────────────────
  titleBlock: {
    marginBottom: 14,
  },
  showNameText: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  metaBadgeText: { fontSize: 12, fontWeight: "500" },

  // ── Puan ──────────────────────────────────────────────────────────────────
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 30,
    borderWidth: 1,
    gap: 3,
  },
  ratingPillStar: { fontSize: 14, fontWeight: "800" },
  ratingPillScore: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  ratingPillMax: { fontSize: 13, fontWeight: "500" },

  // ── İlerleme ──────────────────────────────────────────────────────────────
  progressWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  progressBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: "700",
    minWidth: 32,
    textAlign: "right",
  },

  divider: { height: 1, marginBottom: 20 },

  // ── Seksiyon ──────────────────────────────────────────────────────────────
  section: { marginBottom: 16 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  sectionAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: "#29b864",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    letterSpacing: -0.2,
  },
  sectionCountBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionCountText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
  },

  overviewText: { fontSize: 15, lineHeight: 24 },
  expandBtn: { marginTop: 10, alignItems: "center" },
  expandBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Bölüm Kartı ───────────────────────────────────────────────────────────
  episodeCard: {
    flexDirection: "row",
    padding: 5,
    borderRadius: 25,
    marginBottom: 12,
    gap: 5,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  episodeThumbnailWrapper: {
    width: 155,
    height: 110,
    position: "relative",
    borderRadius: 20,
    overflow: "hidden",
  },
  episodeThumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  episodeThumbnailPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  runtimeBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  runtimeText: { fontSize: 10, fontWeight: "600" },
  ratingBadgeOnThumb: {
    position: "absolute",
    bottom: 7,
    left: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  ratingBadgeOnThumbText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  fireworksLeft: {
    position: "absolute",
    height: 200,
    top: 0,
    left: 0,
    right: "50%",
    zIndex: 5,
  },
  fireworksRight: {
    position: "absolute",
    height: 200,
    top: 0,
    left: "50%",
    right: 0,
    zIndex: 5,
  },

  // Kart sağ tarafı
  episodeBody: {
    flex: 1,
    padding: 5,
    justifyContent: "space-between",
  },
  episodeTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  episodeMetaLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    flex: 1,
    marginRight: 6,
  },
  episodeNumText: { fontSize: 12, fontWeight: "600" },
  datePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  datePillText: { fontSize: 11, fontWeight: "500" },
  episodeName: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 4,
  },
  episodeOverview: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "300",
  },
});
