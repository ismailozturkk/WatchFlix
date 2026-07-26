import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import PosterImage from "../../components/PosterImage";
import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { MovieCollectionSkeleton } from "../../components/Skeleton";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import { RatingBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useListLayoutSettings } from "../../context/AppSettingsContext";

const { width } = Dimensions.get("window");

const yearOf = (dateStr) =>
  dateStr && dateStr.length >= 4 ? dateStr.slice(0, 4) : "";

export default function MovieCollection({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { posterBadges } = useListLayoutSettings();
  const {
    moviesCollection,
    loadingCollection,
    errorCollection,
    activateMovieSection,
  } = useMovie();
  const rp = useRailPosterStyle();

  // Seçili koleksiyon (null → koleksiyon listesi, dolu → o serinin filmleri)
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    activateMovieSection("collection");
  }, [activateMovieSection]);

  // Yalnızca posteri ve en az 1 filmi olan koleksiyonlar.
  const collections = useMemo(
    () =>
      (moviesCollection || []).filter(
        (c) =>
          c &&
          c.poster_path &&
          Array.isArray(c.parts) &&
          c.parts.some((p) => p && p.poster_path),
      ),
    [moviesCollection],
  );

  const filmCount = (c) =>
    (c?.parts || []).filter((p) => p && p.poster_path).length;

  // Seçili serinin filmleri — kronolojik (yayın tarihine göre; tarihsizler sonda).
  const parts = useMemo(() => {
    if (!selected) return [];
    return (selected.parts || [])
      .filter((p) => p && p.poster_path)
      .slice()
      .sort((a, b) => {
        const da = a.release_date ? new Date(a.release_date).getTime() : Infinity;
        const db = b.release_date ? new Date(b.release_date).getTime() : Infinity;
        if (da === db) return 0;
        return da - db;
      });
  }, [selected]);

  const countLabel = (n) =>
    (t.movieScreens?.collectionFilmCount || "{count}").replace("{count}", n);

  if (loadingCollection) {
    return (
      <View style={styles.container}>
        <Text
          allowFontScaling={false}
          style={[styles.title, { color: theme.text.secondary }]}
        >
          {t.movieScreens.collection}
        </Text>
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <MovieCollectionSkeleton />}
          keyExtractor={(i) => String(i)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={3}
        />
      </View>
    );
  }

  if (errorCollection || collections.length === 0) return null;

  // ── Koleksiyon kartı (kapalı durum) ──
  const renderCollection = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setSelected(item)}
      style={[styles.collCard, { width: rp.itemWidth }]}
    >
      <View>
        <PosterImage
          path={item.poster_path}
          type="movie"
          size={200}
          style={[
            styles.poster,
            {
              width: rp.posterWidth,
              height: rp.posterHeight,
              borderRadius: rp.radius,
              shadowColor: theme.shadow,
            },
          ]}
          cachePolicy="memory-disk"
          recyclingKey={`collection-${item.id}`}
          transition={120}
        />
        <View style={[styles.countBadge, { backgroundColor: theme.secondaryt }]}>
          <Ionicons name="film-outline" size={11} color={theme.text.primary} />
          <Text
            allowFontScaling={false}
            style={[styles.countText, { color: theme.text.primary }]}
          >
            {filmCount(item)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // ── Seri filmi kartı (açık durum) ──
  const renderPart = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => navigation.push("MovieDetails", { id: item.id })}
      style={{ width: rp.itemWidth }}
    >
      <View>
        <PosterImage
          path={item.poster_path}
          type="movie"
          size={200}
          style={[
            styles.poster,
            {
              width: rp.posterWidth,
              height: rp.posterHeight,
              borderRadius: rp.radius,
              shadowColor: theme.shadow,
            },
          ]}
          cachePolicy="memory-disk"
          recyclingKey={`collectionpart-${item.id}`}
          transition={120}
        />
        <RatingBadge
          value={item.vote_average}
          votes={item.vote_count}
          style={POSTER_BADGE_POS.bottomRight}
        />
        <ListBadges
          mediaId={item.id}
          mediaType="movie"
          theme={theme}
          style={{ position: "absolute", left: 2, bottom: 8 }}
        />
      </View>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.partTitle, { color: theme.text.primary, width: rp.posterWidth }]}
      >
        {item.title}
      </Text>
      {posterBadges?.releaseDate !== false && yearOf(item.release_date) ? (
        <Text
          allowFontScaling={false}
          style={[styles.partYear, { color: theme.text.muted }]}
        >
          {yearOf(item.release_date)}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {selected ? (
        // ── Açık: koleksiyon başlığı + kapat ──
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setSelected(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          >
            <Ionicons name="chevron-back" size={18} color={theme.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.headerTitle, { color: theme.text.primary }]}
            >
              {selected.name}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.headerSub, { color: theme.text.muted }]}
            >
              {countLabel(parts.length)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setSelected(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          >
            <Ionicons name="close" size={18} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>
      ) : (
        <Text
          allowFontScaling={false}
          style={[styles.title, { color: theme.text.secondary }]}
        >
          {t.movieScreens.collection}
        </Text>
      )}

      {selected ? (
        <FlatList
          key="parts"
          data={parts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPart}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railContent}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
        />
      ) : (
        <FlatList
          key="collections"
          data={collections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCollection}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railContent}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  title: {
    fontSize: 18,
    marginBottom: 15,
    marginLeft: 15,
    fontWeight: "700",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  railContent: {
    paddingHorizontal: 15,
    gap: 14,
  },
  collCard: {
    alignItems: "flex-start",
  },
  poster: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  countBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
  },
  partTitle: {
    marginTop: 6,
    fontSize: 12.5,
    fontWeight: "600",
  },
  partYear: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "500",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 8,
    right: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  ratingText: {
    color: "#ffd700",
    fontSize: 11,
    fontWeight: "700",
  },
});
