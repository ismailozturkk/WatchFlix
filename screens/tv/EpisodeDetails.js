import React, { useState, useEffect, useCallback, memo } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  StatusBar,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import axios from "axios";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { EpisodeSkeleton } from "../../components/Skeleton";
import RatingStars from "../../components/RatingStars";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { useSnow } from "../../context/SnowContext";
import WatchedAdd from "./WatchedAdd";
import { useAppSettings } from "../../context/AppSettingsContext";

const { width } = Dimensions.get("window");

// ─── Oyuncu / Ekip Kartı (Memoize) ───────────────────────────────────────────
const PersonCard = memo(({ person, role, imageQuality, theme, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    style={styles.personCard}
  >
    <View style={styles.personImageWrapper}>
      {person.profile_path ? (
        <Image
          source={{
            uri: `https://image.tmdb.org/t/p/${imageQuality}${person.profile_path}`,
          }}
          style={styles.personImage}
        />
      ) : (
        <View
          style={[
            styles.personImagePlaceholder,
            { backgroundColor: theme.secondary },
          ]}
        >
          <Ionicons
            name="person"
            size={28}
            color={theme.text?.muted ?? "#666"}
          />
        </View>
      )}
    </View>
    <Text
      style={[styles.personName, { color: theme.text?.primary ?? "#fff" }]}
      numberOfLines={2}
    >
      {person.name}
    </Text>
    <Text
      style={[styles.personRole, { color: theme.text?.secondary ?? "#aaa" }]}
      numberOfLines={1}
    >
      {role}
    </Text>
  </TouchableOpacity>
));

// ─── Bölüm Bilgisi Rozeti ─────────────────────────────────────────────────────
const MetaBadge = ({ icon, label, theme }) => (
  <View
    style={[styles.metaBadge, { backgroundColor: "rgba(255,255,255,0.08)" }]}
  >
    <Ionicons
      name={icon}
      size={13}
      color={theme.text?.secondary ?? "#aaa"}
      style={{ marginRight: 5 }}
    />
    <Text
      style={[styles.metaBadgeText, { color: theme.text?.secondary ?? "#aaa" }]}
    >
      {label}
    </Text>
  </View>
);

// ─── Bölüm Puanı Göstergesi ───────────────────────────────────────────────────
const RatingPill = ({ rating, theme }) => {
  const getColor = (r) => {
    if (r >= 8) return "#29b864";
    if (r >= 6) return "#f5c518";
    if (r >= 4) return "#ff6400";
    return "#e00";
  };
  const color = getColor(rating);
  return (
    <View
      style={[
        styles.ratingPill,
        { borderColor: color + "55", backgroundColor: color + "18" },
      ]}
    >
      <Text style={[styles.ratingPillStar, { color }]}>★</Text>
      <Text style={[styles.ratingPillScore, { color }]}>
        {rating.toFixed(1)}
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
  );
};

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function EpisodeDetails({ route, navigation }) {
  const {
    showId,
    seasonNumber,
    episodeNumber,
    showEpisodeCount,
    showSeasonCount,
    showName,
    seasonEpisodes,
    showPosterPath,
    seasonPosterPath,
    genres,
  } = route.params;

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [check, setChecked] = useState(false);

  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { API_KEY, showSnow, imageQuality } = useAppSettings();

  const formatDate = useCallback(
    (timestamp) =>
      new Intl.DateTimeFormat(language, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(timestamp)),
    [language],
  );

  useEffect(() => {
    let cancelled = false;
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`,
          {
            params: { language: language === "tr" ? "tr-TR" : "en-US" },
            headers: { accept: "application/json", Authorization: API_KEY },
          },
        );
        if (!cancelled) setDetails(response.data);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [showId, seasonNumber, episodeNumber, language, API_KEY]);

  if (loading) return <EpisodeSkeleton />;

  if (!details) {
    return (
      <View style={[styles.container, { backgroundColor: theme.primary }]}>
        <Text style={[styles.loadingText, { color: theme.text?.primary }]}>
          {t.loading}
        </Text>
      </View>
    );
  }

  const navigateToPerson = (personId) =>
    navigation.navigate("ActorViewScreen", { personId });

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
      {check && (
        <LottieView
          style={styles.confetti}
          source={require("../../LottieJson/confetti_2.json")}
          autoPlay={check}
          loop={false}
        />
      )}

      {/* ── Hero Görsel ──────────────────────────────────────────────────── */}
      <View style={styles.heroContainer}>
        {details.still_path ? (
          <Image
            source={{
              uri: `https://image.tmdb.org/t/p/original${details.still_path}`,
            }}
            style={styles.heroImage}
          />
        ) : (
          <View
            style={[
              styles.heroPlaceholder,
              { backgroundColor: theme.secondary },
            ]}
          >
            <Ionicons
              name="film-outline"
              size={64}
              color={theme.text?.muted ?? "#555"}
            />
          </View>
        )}
        {/* Çift gradient: alttan ana renk, üstten hafif karartma */}
        <LinearGradient
          colors={["rgba(0,0,0,0.35)", "transparent", theme.primary]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Sezon / Bölüm etiketi hero üzerinde */}
        <View style={styles.heroEpisodeBadge}>
          <Text style={styles.heroEpisodeBadgeText}>
            S{seasonNumber} · E{episodeNumber}
          </Text>
        </View>
      </View>

      {/* ── İçerik ───────────────────────────────────────────────────────── */}
      <View style={[styles.content, { backgroundColor: theme.primary }]}>
        {showSnow && (
          <LottieView
            style={styles.lottie}
            source={require("../../LottieJson/snow.json")}
            autoPlay
            loop
          />
        )}

        {/* ── Başlık Bloğu ─────────────────────────────────────────────── */}
        <View style={styles.titleBlock}>
          {/* Sol: isim + meta */}
          <View style={styles.titleLeft}>
            <Text
              style={[
                styles.episodeTitle,
                { color: theme.text?.primary ?? "#fff" },
              ]}
            >
              {details.name}
            </Text>

            <View style={styles.metaRow}>
              {details.air_date && (
                <MetaBadge
                  icon="calendar-outline"
                  label={formatDate(details.air_date)}
                  theme={theme}
                />
              )}
              {details.runtime > 0 && (
                <MetaBadge
                  icon="time-outline"
                  label={`${details.runtime} ${t.duration}`}
                  theme={theme}
                />
              )}
            </View>
          </View>

          {/* Sağ: İzlendi butonu */}
          <WatchedAdd
            showId={showId}
            showReleaseDate={details.air_date}
            seasonNumber={seasonNumber}
            episodeNumber={episodeNumber}
            showEpisodeCount={showEpisodeCount}
            showSeasonCount={showSeasonCount}
            showName={showName}
            episodeName={details.name}
            episodeRatings={details.vote_average.toFixed(1)}
            episodeMinutes={details.runtime}
            seasonEpisodes={seasonEpisodes}
            showPosterPath={showPosterPath}
            seasonPosterPath={seasonPosterPath}
            episodePosterPath={details.still_path}
            genres={genres}
          />
        </View>

        {/* ── Puan ─────────────────────────────────────────────────────── */}
        {details.vote_average > 0 && (
          <View style={styles.ratingBlock}>
            <RatingPill rating={details.vote_average} theme={theme} />
            <RatingStars rating={details.vote_average} />
          </View>
        )}

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
          >
            {details.overview || t.noOverviewAvailable}
          </Text>
        </View>

        {/* ── Konuk Oyuncular ───────────────────────────────────────────── */}
        {details.guest_stars?.length > 0 && (
          <View style={styles.section}>
            <SectionTitle
              label={t.guestStars}
              theme={theme}
              count={details.guest_stars.length}
            />
            <ScrollView
              horizontal
              contentContainerStyle={styles.personList}
              showsHorizontalScrollIndicator={false}
            >
              {details.guest_stars.map((actor) => (
                <PersonCard
                  key={`actor-${actor.id}-${actor.character}`}
                  person={actor}
                  role={actor.character}
                  imageQuality={imageQuality}
                  theme={theme}
                  onPress={() => navigateToPerson(actor.id)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Ekip ──────────────────────────────────────────────────────── */}
        {details.crew?.length > 0 && (
          <View style={[styles.section, { paddingBottom: 40 }]}>
            <SectionTitle
              label={t.crew}
              theme={theme}
              count={details.crew.length}
            />
            <ScrollView
              horizontal
              contentContainerStyle={styles.personList}
              showsHorizontalScrollIndicator={false}
            >
              {details.crew.map((member) => (
                <PersonCard
                  key={`crew-${member.id}-${member.job}`}
                  person={member}
                  role={member.job}
                  imageQuality={imageQuality}
                  theme={theme}
                  onPress={() => navigateToPerson(member.id)}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Bölüm Başlığı Yardımcı Bileşeni ─────────────────────────────────────────
const SectionTitle = memo(({ label, theme, count }) => (
  <View style={styles.sectionTitleRow}>
    <View style={styles.sectionTitleAccent} />
    <Text
      style={[styles.sectionTitle, { color: theme.text?.primary ?? "#fff" }]}
    >
      {label}
    </Text>
    {count != null && (
      <View style={styles.sectionCount}>
        <Text style={styles.sectionCountText}>{count}</Text>
      </View>
    )}
  </View>
));

// ─── Styles ───────────────────────────────────────────────────────────────────
const AVATAR = width * 0.18;

const styles = StyleSheet.create({
  container: { flex: 1 },

  loadingText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },

  confetti: {
    position: "absolute",
    height: 600,
    left: 0,
    right: 0,
    zIndex: 3,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroContainer: {
    height: 280,
    position: "relative",
    overflow: "hidden",
  },
  heroImage: {
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
  heroEpisodeBadge: {
    position: "absolute",
    top: 52,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroEpisodeBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },

  // ── İçerik ────────────────────────────────────────────────────────────────
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  lottie: {
    position: "absolute",
    height: 1000,
    top: 0,
    left: -120,
    right: -120,
    zIndex: 0,
  },

  // ── Başlık Bloğu ──────────────────────────────────────────────────────────
  titleBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    marginTop: 6,
  },
  titleLeft: {
    flex: 1,
    marginRight: 12,
  },
  episodeTitle: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  metaBadgeText: {
    fontSize: 12,
    fontWeight: "500",
  },

  // ── Puan Bloğu ────────────────────────────────────────────────────────────
  ratingBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
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
  ratingPillStar: {
    fontSize: 15,
    fontWeight: "800",
  },
  ratingPillScore: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  ratingPillMax: {
    fontSize: 13,
    fontWeight: "500",
  },

  divider: {
    height: 1,
    marginBottom: 20,
  },

  // ── Seksiyon ──────────────────────────────────────────────────────────────
  section: {
    marginBottom: 24,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  sectionTitleAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: "#29b864",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
    flex: 1,
  },
  sectionCount: {
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
  overviewText: {
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: 0.1,
  },

  // ── Kişi Kartı ────────────────────────────────────────────────────────────
  personList: {
    flexDirection: "row",
    gap: 12,
    paddingRight: 4,
  },
  personCard: {
    width: 90,
    alignItems: "center",
  },
  personImageWrapper: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    marginBottom: 8,
    overflow: "hidden",
    // subtle ring
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  personImage: {
    width: "100%",
    height: "100%",
  },
  personImagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  personName: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 2,
  },
  personRole: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 14,
    opacity: 0.7,
  },
});
