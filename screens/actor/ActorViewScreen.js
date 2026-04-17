import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Animated,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import axios from "axios";
import { useTheme } from "../../context/ThemeContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useLanguage } from "../../context/LanguageContext";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const HERO_HEIGHT = width * 1.1;

const FILTERS = [
  { key: "popular", label: "Popüler", icon: "flame-outline" },
  { key: "voted", label: "En Çok Oy", icon: "people-outline" },
  { key: "rated", label: "En İyi Puan", icon: "star-outline" },
  { key: "upcoming", label: "Yakında", icon: "time-outline" },
  { key: "latest", label: "En Yeni", icon: "calendar-outline" },
];

const TV_FILTERS = [
  { key: "popular", label: "Popüler", icon: "flame-outline" },
  { key: "voted", label: "En Çok Oy", icon: "people-outline" },
  { key: "rated", label: "En İyi Puan", icon: "star-outline" },
  { key: "latest", label: "En Yeni", icon: "calendar-outline" },
];

const getRatingColor = (r) => {
  if (r >= 8) return "#29b864";
  if (r >= 6) return "#f5c518";
  if (r >= 4) return "#ff6400";
  return "#e33";
};

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, count, theme }) => (
  <View style={styles.sectionHeaderRow}>
    <View style={[styles.sectionAccent, { backgroundColor: theme.accent }]} />
    <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
      {title}
    </Text>
    {count != null && (
      <View style={[styles.countBadge, { backgroundColor: theme.secondary }]}>
        <Text style={[styles.countText, { color: theme.text.secondary }]}>
          {count}
        </Text>
      </View>
    )}
  </View>
);

// ─── Filter Chips ─────────────────────────────────────────────────────────────
const FilterChips = ({ filters, active, onSelect, theme }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.filterList}
  >
    {filters.map((f) => {
      const isActive = f.key === active;
      return (
        <TouchableOpacity
          key={f.key}
          onPress={() => onSelect(f.key)}
          activeOpacity={0.75}
          style={[
            styles.filterChip,
            {
              backgroundColor: isActive ? theme.accent : theme.secondary,
              borderColor: isActive
                ? theme.accent
                : (theme.border ?? "#333"),
            },
          ]}
        >
          <Ionicons
            name={f.icon}
            size={12}
            color={isActive ? "#fff" : (theme.text?.secondary ?? "#aaa")}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.filterChipText,
              {
                color: isActive ? "#fff" : (theme.text?.primary ?? "#fff"),
                fontWeight: isActive ? "700" : "500",
              },
            ]}
          >
            {f.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

// ─── Media Card ───────────────────────────────────────────────────────────────
const MediaCard = ({ item, onPress, theme, imageQuality }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const rating = item.vote_average ?? 0;
  const ratingColor = getRatingColor(rating);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() =>
        Animated.spring(scale, {
          toValue: 0.93,
          friction: 4,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }).start()
      }
      onPress={onPress}
    >
      <Animated.View
        style={[styles.mediaCard, { transform: [{ scale }] }]}
      >
        {item.poster_path ? (
          <Image
            source={{
              uri: `https://image.tmdb.org/t/p/${imageQuality.poster}${item.poster_path}`,
            }}
            style={styles.mediaPoster}
          />
        ) : (
          <View
            style={[styles.mediaNoImage, { backgroundColor: theme.secondary }]}
          >
            <Ionicons
              name="film-outline"
              size={28}
              color={theme.text?.muted ?? "#555"}
            />
          </View>
        )}
        {/* Bottom gradient */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.85)"]}
          locations={[0.4, 1]}
          style={styles.mediaGradient}
        />
        {/* Rating badge */}
        {rating > 0 && (
          <View
            style={[
              styles.ratingBadge,
              { backgroundColor: ratingColor + "ee" },
            ]}
          >
            <Text style={styles.ratingBadgeText}>★ {rating.toFixed(1)}</Text>
          </View>
        )}
        {/* Title */}
        <View style={styles.mediaFooter}>
          <Text style={styles.mediaTitle} numberOfLines={2}>
            {item.title || item.name || "—"}
          </Text>
          {(item.release_date || item.first_air_date) && (
            <Text style={styles.mediaYear}>
              {new Date(
                item.release_date || item.first_air_date,
              ).getFullYear()}
            </Text>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Info Pill ────────────────────────────────────────────────────────────────
const InfoPill = ({ icon, label, theme }) =>
  label ? (
    <View style={[styles.infoPill, { backgroundColor: theme.secondary }]}>
      <Ionicons
        name={icon}
        size={13}
        color={theme.accent}
        style={{ marginRight: 5 }}
      />
      <Text
        style={[styles.infoPillText, { color: theme.text?.primary ?? "#fff" }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  ) : null;

// ─── Filtre uygulama ──────────────────────────────────────────────────────────
const applyFilter = (list, filter, type) => {
  if (!list) return [];
  const now = new Date();
  switch (filter) {
    case "popular":
      return [...list].sort((a, b) => b.popularity - a.popularity);
    case "voted":
      return [...list].sort((a, b) => b.vote_count - a.vote_count);
    case "rated":
      return [...list].sort((a, b) => b.vote_average - a.vote_average);
    case "upcoming":
      return type === "movie"
        ? list.filter((m) => new Date(m.release_date) > now)
        : list;
    case "latest":
    default:
      if (type === "movie")
        return [...list].sort(
          (a, b) => new Date(b.release_date) - new Date(a.release_date),
        );
      if (type === "tv")
        return [...list].sort(
          (a, b) => new Date(b.first_air_date) - new Date(a.first_air_date),
        );
      return list;
  }
};

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
const ActorViewScreen = ({ route, navigation }) => {
  const { personId } = route.params;
  const { theme } = useTheme();
  const { API_KEY, imageQuality } = useAppSettings();
  const { language } = useLanguage();
  const [actor, setActor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [filter, setFilter] = useState("popular");
  const [tvFilter, setTvFilter] = useState("popular");

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchActor = async () => {
      try {
        const { data } = await axios.get(
          `https://api.themoviedb.org/3/person/${personId}`,
          {
            params: {
              language: language === "tr" ? "tr-TR" : "en-US",
              append_to_response: "movie_credits,tv_credits",
            },
            headers: { Authorization: API_KEY },
          },
        );
        setActor(data);
      } catch (err) {
        console.error("Actor fetch error:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchActor();
  }, [personId]);

  const headerOpacity = scrollY.interpolate({
    inputRange: [HERO_HEIGHT - 100, HERO_HEIGHT - 40],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.primary }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!actor) {
    return (
      <View style={[styles.center, { backgroundColor: theme.primary }]}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={theme.text?.muted ?? "#555"}
        />
        <Text style={[styles.errorText, { color: theme.text?.secondary }]}>
          Oyuncu bilgisi yüklenemedi
        </Text>
      </View>
    );
  }

  const filteredMovies = applyFilter(actor?.movie_credits?.cast, filter, "movie");
  const filteredTv = Array.from(
    new Map(
      applyFilter(actor?.tv_credits?.cast, tvFilter, "tv").map((i) => [i.id, i]),
    ).values(),
  );

  const IMAGE_URL = `https://image.tmdb.org/t/p/${imageQuality.poster}`;

  const formatDate = (d) => {
    if (!d) return null;
    try {
      return new Date(d).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── Floating header (scroll sonrası görünür) ── */}
      <Animated.View
        style={[
          styles.floatingHeader,
          { backgroundColor: theme.primary, opacity: headerOpacity },
        ]}
        pointerEvents="none"
      >
        <Text
          style={[styles.floatingTitle, { color: theme.text?.primary }]}
          numberOfLines={1}
        >
          {actor.name}
        </Text>
      </Animated.View>

      {/* ── Back button (daima görünür) ── */}
      <SafeAreaView style={styles.backBtnWrapper} edges={["top"]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <BlurView tint="dark" intensity={55} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </BlurView>
        </TouchableOpacity>
      </SafeAreaView>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* ── Hero ── */}
        <View style={{ height: HERO_HEIGHT }}>
          {actor.profile_path ? (
            <Image
              source={{ uri: `${IMAGE_URL}${actor.profile_path}` }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: theme.secondary,
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
            >
              <FontAwesome
                name="user"
                size={80}
                color={theme.text?.muted ?? "#444"}
              />
            </View>
          )}

          {/* Gradient overlay */}
          <LinearGradient
            colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.3)", theme.primary]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Alt bilgi */}
          <View style={styles.heroBottom}>
            <Text style={styles.heroName}>{actor.name}</Text>
            <View style={styles.heroMeta}>
              {actor.known_for_department && (
                <View style={styles.deptBadge}>
                  <Ionicons name="person" size={11} color="rgba(255,255,255,0.8)" style={{ marginRight: 4 }} />
                  <Text style={styles.deptText}>
                    {actor.known_for_department}
                  </Text>
                </View>
              )}
              {actor.popularity > 0 && (
                <View style={styles.popBadge}>
                  <Ionicons name="flame" size={11} color="#f5c518" style={{ marginRight: 4 }} />
                  <Text style={styles.popText}>
                    {actor.popularity.toFixed(0)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Doğum Bilgileri Pill'leri ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
        >
          <InfoPill
            icon="calendar-outline"
            label={formatDate(actor.birthday)}
            theme={theme}
          />
          {actor.deathday && (
            <InfoPill
              icon="skull-outline"
              label={`✝ ${formatDate(actor.deathday)}`}
              theme={theme}
            />
          )}
          <InfoPill
            icon="location-outline"
            label={actor.place_of_birth}
            theme={theme}
          />
          <InfoPill
            icon="film-outline"
            label={
              actor.movie_credits?.cast?.length
                ? `${actor.movie_credits.cast.length} film`
                : null
            }
            theme={theme}
          />
          <InfoPill
            icon="tv-outline"
            label={
              actor.tv_credits?.cast?.length
                ? `${actor.tv_credits.cast.length} dizi`
                : null
            }
            theme={theme}
          />
        </ScrollView>

        {/* ── Biyografi ── */}
        {actor.biography ? (
          <View style={styles.section}>
            <SectionHeader title="Biyografi" theme={theme} />
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setBioExpanded((e) => !e)}
            >
              <Text
                style={[styles.bioText, { color: theme.text?.secondary ?? "#aaa" }]}
                numberOfLines={bioExpanded ? undefined : 5}
              >
                {actor.biography}
              </Text>
              <View style={styles.bioToggle}>
                <Text style={[styles.bioToggleText, { color: theme.accent }]}>
                  {bioExpanded ? "Daha az göster" : "Devamını oku"}
                </Text>
                <Ionicons
                  name={bioExpanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={theme.accent}
                />
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Filmler ── */}
        {actor.movie_credits?.cast?.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Filmler"
              count={actor.movie_credits.cast.length}
              theme={theme}
            />
            <FilterChips
              filters={FILTERS}
              active={filter}
              onSelect={setFilter}
              theme={theme}
            />
            {filteredMovies.length > 0 ? (
              <FlatList
                horizontal
                data={filteredMovies}
                keyExtractor={(item) => `movie_${item.id}_${item.credit_id}`}
                renderItem={({ item }) => (
                  <MediaCard
                    item={item}
                    theme={theme}
                    imageQuality={imageQuality}
                    onPress={() =>
                      navigation.navigate("MovieDetails", { id: item.id })
                    }
                  />
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mediaList}
              />
            ) : (
              <View style={styles.emptyFilter}>
                <Ionicons
                  name="film-outline"
                  size={32}
                  color={theme.text?.muted ?? "#555"}
                />
                <Text style={[styles.emptyFilterText, { color: theme.text?.secondary ?? "#aaa" }]}>
                  Bu filtre için sonuç bulunamadı
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Diziler ── */}
        {actor.tv_credits?.cast?.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Diziler"
              count={
                Array.from(
                  new Map(
                    (actor.tv_credits.cast).map((i) => [i.id, i]),
                  ).values(),
                ).length
              }
              theme={theme}
            />
            <FilterChips
              filters={TV_FILTERS}
              active={tvFilter}
              onSelect={setTvFilter}
              theme={theme}
            />
            {filteredTv.length > 0 ? (
              <FlatList
                horizontal
                data={filteredTv}
                keyExtractor={(item) => `tv_${item.id}_${item.credit_id}`}
                renderItem={({ item }) => (
                  <MediaCard
                    item={item}
                    theme={theme}
                    imageQuality={imageQuality}
                    onPress={() =>
                      navigation.navigate("TvShowsDetails", { id: item.id })
                    }
                  />
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mediaList}
              />
            ) : (
              <View style={styles.emptyFilter}>
                <Ionicons
                  name="tv-outline"
                  size={32}
                  color={theme.text?.muted ?? "#555"}
                />
                <Text style={[styles.emptyFilterText, { color: theme.text?.secondary ?? "#aaa" }]}>
                  Bu filtre için sonuç bulunamadı
                </Text>
              </View>
            )}
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { marginTop: 12, fontSize: 14, textAlign: "center" },

  // ── Back button ──────────────────────────────────────────────────────────
  backBtnWrapper: {
    position: "absolute",
    top: 0,
    left: 16,
    zIndex: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Floating header ──────────────────────────────────────────────────────
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === "ios" ? 52 : (StatusBar.currentHeight ?? 24) + 8,
    paddingBottom: 12,
    paddingHorizontal: 60,
    alignItems: "center",
  },
  floatingTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },

  // ── Hero ─────────────────────────────────────────────────────────────────
  heroBottom: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  heroName: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  deptBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  deptText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  popBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245,197,24,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  popText: { color: "#f5c518", fontSize: 12, fontWeight: "700" },

  // ── Info pills ────────────────────────────────────────────────────────────
  pillsRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  infoPillText: { fontSize: 13, fontWeight: "500" },

  // ── Section ───────────────────────────────────────────────────────────────
  section: { marginBottom: 8 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
    gap: 8,
  },
  sectionAccent: { width: 4, height: 20, borderRadius: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "700", flex: 1 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countText: { fontSize: 12, fontWeight: "600" },

  // ── Biography ─────────────────────────────────────────────────────────────
  bioText: { fontSize: 14, lineHeight: 22, paddingHorizontal: 16 },
  bioToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  bioToggleText: { fontSize: 13, fontWeight: "600" },

  // ── Filter chips ──────────────────────────────────────────────────────────
  filterList: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12 },

  // ── Media card ────────────────────────────────────────────────────────────
  mediaList: { paddingHorizontal: 16, paddingBottom: 4, gap: 10 },
  mediaCard: {
    width: 120,
    height: 180,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111",
    justifyContent: "flex-end",
  },
  mediaPoster: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    resizeMode: "cover",
  },
  mediaNoImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  mediaGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "65%",
  },
  ratingBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  mediaFooter: { padding: 8, gap: 2 },
  mediaTitle: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  mediaYear: { color: "rgba(255,255,255,0.55)", fontSize: 10 },

  // ── Empty filter state ────────────────────────────────────────────────────
  emptyFilter: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyFilterText: { fontSize: 13, textAlign: "center" },
});

export default ActorViewScreen;
