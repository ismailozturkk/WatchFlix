import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../../context/ThemeContext";
import { useTvShow } from "../../context/TvShowContex";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Progress from "react-native-progress";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
import { i18nText } from "../../utils/i18nText";


const { width } = Dimensions.get("window");
const CARD_W = width * 0.4;
const CARD_H = width * 0.6;

// ─── Tek kart (aynı pattern: TvShowBests.MovieItem) ─────────────────────────
const OngoingCard = ({
  item,
  navigation,
  theme,
  scaleValue,
  onPressIn,
  onPressOut,
}) => {
  const watchedEps = (item.seasons || []).reduce(
    (acc, s) => acc + (s.episodes ? s.episodes.length : 0),
    0,
  );
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
  const totalEps = item.showEpisodeCount || 1;
  const progress = Math.min(watchedEps / totalEps, 1);
  const isCompleted = progress >= 1;

  const progressColor = isCompleted
    ? "#4CAF50"
    : progress > 0
      ? "#FF9500"
      : theme.accent;

  // Son izlenen sezon/bölüm
  const lastSeason = [...(item.seasons || [])]
    .filter((s) => s.episodes && s.episodes.length > 0)
    .sort((a, b) => b.seasonNumber - a.seasonNumber)[0];
  const lastEp = lastSeason
    ? [...lastSeason.episodes].sort(
        (a, b) => b.episodeNumber - a.episodeNumber,
      )[0]
    : null;

  return (
    <TouchableOpacity
      style={styles.similarItem}
      activeOpacity={0.85}
      onPressIn={() => onPressIn(item.id)}
      onPressOut={() => onPressOut(item.id)}
      onPress={() => navigation.push("TvShowsDetails", { id: item.id })}
    >
      <Animated.View
        style={{
          transform: [{ scale: scaleValue }],
        }}
      >
        {/* Poster */}
        <Image
          source={
            item.imagePath
              ? {
                  uri: getTmdbUrl(item.imagePath, 'poster', 200),
                }
              : require("../../assets/image/no_image.png")
          }
          style={[styles.similarPoster, { shadowColor: theme.shadow }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`tvongoing-${item.id}`}
          transition={120}
        />

        {/* Gradient alt karartma */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.80)"]}
          style={styles.gradient}
        />

        {/* İlerleme çubuğu — poster altında */}
        <View style={styles.progressBar}>
          <Progress.Bar
            progress={progress}
            width={CARD_W - 16}
            height={3}
            borderWidth={0}
            borderRadius={2}
            color={progressColor}
            unfilledColor="rgba(255,255,255,0.2)"
          />
        </View>

        {/* Tamamlandı rozeti — sol üst */}
        {isCompleted && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={10} color="#fff" />
            <Text allowFontScaling={false} style={styles.completedText}>
              Bitti
            </Text>
          </View>
        )}

        {/* Bölüm sayacı — sağ üst (aynı pozisyon: TvShowBests.relaseDate) */}
        <View
          style={[styles.relaseDate, { backgroundColor: theme.secondaryt }]}
        >
          <Text
            allowFontScaling={false}
            style={[styles.badgeText, { color: progressColor }]}
          >
            {watchedEps}/{totalEps}
          </Text>
        </View>

        {/* Son izlenen bölüm — sol alt (aynı pozisyon: TvShowBests.relaseDateCount) */}
        {lastEp && lastSeason && (
          <View
            style={[
              styles.relaseDateCount,
              { backgroundColor: theme.secondaryt },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[styles.badgeText, { color: theme.text.secondary }]}
            >
              S{lastSeason.seasonNumber}·B{lastEp.episodeNumber}
            </Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Section bileşeni (TvShowBests/TvShowsGenres ile aynı şablon) ─────────────
export default function TvOngoingSection({ navigation }) {
  const { theme } = useTheme();
  const { watchedTvShows: shows } = useTvShow();

  const scaleValuesRef = useRef({});
  const getScaleValue = (id) => {
    if (!scaleValuesRef.current[id]) {
      scaleValuesRef.current[id] = new Animated.Value(1);
    }
    return scaleValuesRef.current[id];
  };

  const onPressIn = (id) => {
    Animated.timing(getScaleValue(id), {
      toValue: 0.9,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };
  const onPressOut = (id) => {
    Animated.timing(getScaleValue(id), {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  // ── Yalnızca devam eden (tamamlanmamış) diziler ─────────────────────────────
  const filtered = shows.filter((s) => {
    const watched = (s.seasons || []).reduce(
      (acc, ss) => acc + (ss.episodes ? ss.episodes.length : 0),
      0,
    );
    const total = s.showEpisodeCount || 1;
    return watched / total < 1;
  });

  // Devam eden dizi yoksa section'ı hiç gösterme
  if (filtered.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* ── Başlık + "Tümünü gör" butonu ── */}
      <View style={styles.header}>
        <Text
          allowFontScaling={false}
          style={[styles.title, { color: theme.text.secondary }]}
        >
          Devam Eden Dizilerim
        </Text>
        <TouchableOpacity
          style={[styles.seeAll, { backgroundColor: theme.secondary }]}
          onPress={() => navigation.navigate("OnGoingSeries")}
        >
          <Text
            allowFontScaling={false}
            style={[styles.seeAllText, { color: theme.text.muted }]}
          >{i18nText("autoI18n.tumu", "Tümü")}</Text>
          <Ionicons name="chevron-forward" size={13} color={theme.text.muted} />
        </TouchableOpacity>
      </View>

      {/* ── Yatay dizi listesi ── */}
      <FlatList
        data={filtered}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        keyExtractor={(item) => item.id.toString()}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews
        renderItem={({ item }) => (
          <OngoingCard
            item={item}
            navigation={navigation}
            theme={theme}
            scaleValue={getScaleValue(item.id)}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },

  // ── Başlık satırı ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 15,
    paddingRight: 12,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    marginBottom: 0,
    fontWeight: "700",
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2,
  },
  seeAllText: { fontSize: 12 },

  // ── Filtre çipleri (TvShowBests pattern) ──
  categoriesList: {
    borderRadius: 15,
    paddingVertical: 3,
    paddingHorizontal: 3,
    marginBottom: 10,
    gap: 3,
  },
  categoryItem: {},
  categoryText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Kart (birebir TvShowBests.similarItem) ──
  similarItem: {
    width: CARD_W,
    height: CARD_H, // kart yükseklik
    marginRight: 10,
    marginBottom: 5,
  },
  similarPoster: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 15,
    marginBottom: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 5,
    height: CARD_H * 0.4,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  progressBar: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
  },

  // ── Rozetler (birebir TvShowBests konumları) ──
  relaseDate: {
    // sağ üst — TvShowBests.relaseDate
    position: "absolute",
    top: 5,
    right: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  relaseDateCount: {
    // sol üst — TvShowBests.relaseDateCount
    position: "absolute",
    top: 5,
    left: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  completedBadge: {
    position: "absolute",
    bottom: 16,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(76,175,80,0.85)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  completedText: { color: "#fff", fontSize: 9, fontWeight: "700" },

  // ── Boş durum ──
  emptyContainer: {
    width: width * 0.6,
    height: CARD_H,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 13 },
});
