import React, { useEffect, useRef } from "react";
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
const { width, height } = Dimensions.get("window");

export default function Skeleton({
  width: skeletonWidth,
  height,
  style,
  children,
}) {
  const { theme } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: skeletonWidth || "100%",
          height: height || 20,
          opacity,
          backgroundColor: theme.text.muted,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
// Ready skeleton components
export const MovieCardSkeleton = ({ index }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.cardContainer}>
      <Skeleton
        width={width * 0.6}
        height={width * 0.6 * 1.5}
        style={{
          borderRadius: 25,
          transform: [{ scale: index.index === 0 ? 1 : 0.7 }],
        }}
      />
      <Skeleton
        width={80}
        height={15}
        style={{
          position: "absolute",
          right: 15,
          bottom: 25,
          borderRadius: 10,
        }}
      />
    </View>
  );
};
export const MovieBestsSkeleton = () => {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 5, marginRight: 10 }}>
      <Skeleton
        width={width * 0.4}
        height={width * 0.6}
        style={{ borderRadius: 15, marginBottom: 5 }}
      />

      <Skeleton
        width={30}
        height={15}
        style={{
          position: "absolute",
          right: 10,
          bottom: 13,
          borderRadius: 10,
        }}
      />
    </View>
  );
};
// MovieCollection kartı yatay poster (0.4 × 0.45) — Oscar skeleton'ı uymuyordu.
export const MovieCollectionSkeleton = () => {
  return (
    <View style={{ marginBottom: 5, marginRight: 15 }}>
      <Skeleton
        width={width * 0.4}
        height={width * 0.45}
        style={{
          borderRadius: 15,
          marginBottom: 5,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.94,
          shadowRadius: 10.32,
          elevation: 5,
        }}
      />
      <Skeleton
        width={30}
        height={15}
        style={{ position: "absolute", right: 10, bottom: 13, borderRadius: 10 }}
      />
    </View>
  );
};
export const MovieOscarSkeleton = () => {
  const { theme } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: "column",
        gap: 5,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", gap: 5 }}>
        <View
          style={{
            gap: 10,
            justifyContent: "space-around",
            alignItems: "center",
          }}
        >
          <Skeleton width={20} height={60} style={{ borderRadius: 10 }} />
          <Skeleton width={20} height={120} style={{ borderRadius: 10 }} />
        </View>
        <Skeleton
          width={width * 0.4}
          height={width * 0.6}
          style={{
            marginRight: 15,
            borderRadius: 15,
            marginBottom: 5,
            shadowColor: "#000",
            shadowOffset: {
              width: 0,
              height: 8,
            },
            shadowOpacity: 0.94,
            shadowRadius: 10.32,
            elevation: 5,
          }}
        />
        <Skeleton
          width={30}
          height={15}
          style={{
            position: "absolute",
            right: 23,
            bottom: 10,
            borderRadius: 10,
          }}
        />
      </View>
    </ScrollView>
  );
};
// Yatay poster section'ları (Genres, NowPlaying, Provders, TvGenres, TvProvders…)
// Gerçek kart 0.4×0.6 r15 → skeleton de aynı ölçüde.
export const MovieSkeleton = () => {
  return (
    <View style={{ marginBottom: 5, marginRight: 10 }}>
      <Skeleton
        width={width * 0.4}
        height={width * 0.6}
        style={{
          borderRadius: 15,
          marginBottom: 5,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.94,
          shadowRadius: 10.32,
          elevation: 5,
        }}
      />
      <Skeleton
        width={30}
        height={15}
        style={{
          position: "absolute",
          right: 10,
          bottom: 13,
          borderRadius: 10,
        }}
      />
    </View>
  );
};
export const MovieUpComingSkeleton = () => {
  const { theme } = useTheme();
  return (
    <View style={{ paddingBottom: 15, gap: 10 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexDirection: "column",
          gap: 5,
          marginRight: 10,
          marginBottom: 6,
        }}
      >
        <View style={{ gap: 5, width: width * 0.4 }}>
          <Skeleton
            width={width * 0.4}
            height={width * 0.6}
            style={{
              marginRight: 15,
              width: width * 0.4,
              height: width * 0.6,
              borderRadius: 15,
              marginBottom: 5,
              shadowColor: "#000",
              shadowOffset: {
                width: 0,
                height: 8,
              },
              shadowOpacity: 0.94,
              shadowRadius: 10.32,
              elevation: 5,
            }}
          />
          <Skeleton
            width={30}
            height={15}
            style={{
              position: "absolute",
              right: 5,
              top: 5,
              borderRadius: 10,
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
};
export const AvatarSkeleton = () => {
  return <Skeleton width={140} height={140} style={{ borderRadius: 70 }} />;
};
export const WatchedInfoSkeleton = () => {
  return (
    <View style={{ gap: 10 }}>
      <Skeleton
        width={"100%"}
        height={70}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 8,
          borderRadius: 12,
          marginBottom: 8,
        }}
      >
        <Skeleton width={"49%"} height={55} style={{ borderRadius: 8 }} />
        <Skeleton width={"49%"} height={55} style={{ borderRadius: 8 }} />
      </Skeleton>
    </View>
  );
};
// ProfileLists ile BİRE BİR: yatay scroll, ~152×150 r15 kartlar (collage + etiket),
// paddingHorizontal 15 + gap 10.
export const ListsSkeleton = () => {
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 15, gap: 10 }}>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} width={152} height={150} style={{ borderRadius: 15 }} />
      ))}
    </View>
  );
};
// MovieDetail / TvShowsDetails ile BİRE BİR: hero (9/16) + üste binen 110×165
// poster + bilgi sütunu + stat satırı + yorum butonu + özet + cast rail.
export const DetailsSkeleton = () => {
  const { theme } = useTheme();
  const BACKDROP_H = width * (9 / 16);
  const CAST_W = width * 0.26;
  return (
    <View style={[styles.detailsContainer, { backgroundColor: theme.primary }]}>
      {/* Hero / backdrop */}
      <Skeleton width={width} height={BACKDROP_H} style={{ borderRadius: 0 }} />

      {/* Info header — poster hero'nun üstüne biner */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          marginTop: -BACKDROP_H * 0.28,
          gap: 14,
          alignItems: "flex-end",
          marginBottom: 20,
        }}
      >
        <Skeleton width={110} height={110 * 1.5} style={{ borderRadius: 14 }} />
        <View style={{ flex: 1, gap: 8, paddingBottom: 4 }}>
          <Skeleton width={"85%"} height={22} style={{ borderRadius: 6 }} />
          <Skeleton width={"55%"} height={13} style={{ borderRadius: 4 }} />
          <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
            <Skeleton width={62} height={26} style={{ borderRadius: 20 }} />
            <Skeleton width={52} height={26} style={{ borderRadius: 20 }} />
            <Skeleton width={70} height={26} style={{ borderRadius: 20 }} />
          </View>
          <Skeleton width={"62%"} height={18} style={{ borderRadius: 6, marginTop: 4 }} />
        </View>
      </View>

      {/* Body */}
      <View style={{ paddingHorizontal: 15 }}>
        {/* Stat satırı */}
        <Skeleton width={"100%"} height={88} style={{ borderRadius: 20, marginBottom: 16 }} />
        {/* Yorumlar butonu */}
        <Skeleton width={"100%"} height={64} style={{ borderRadius: 18, marginBottom: 26 }} />

        {/* Özet */}
        <Skeleton width={width * 0.4} height={18} style={{ borderRadius: 6, marginBottom: 14 }} />
        <Skeleton width={"100%"} height={13} style={{ borderRadius: 4, marginBottom: 7 }} />
        <Skeleton width={"100%"} height={13} style={{ borderRadius: 4, marginBottom: 7 }} />
        <Skeleton width={"72%"} height={13} style={{ borderRadius: 4, marginBottom: 26 }} />

        {/* Cast rail */}
        <Skeleton width={width * 0.45} height={18} style={{ borderRadius: 6, marginBottom: 14 }} />
        <View style={{ flexDirection: "row", gap: 14 }}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ width: CAST_W, alignItems: "center", gap: 7 }}>
              <Skeleton width={CAST_W} height={CAST_W * 1.5} style={{ borderRadius: 12 }} />
              <Skeleton width={"85%"} height={11.5} style={{ borderRadius: 4 }} />
              <Skeleton width={"60%"} height={10.5} style={{ borderRadius: 4 }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// SeasonDetails ile BİRE BİR: tam genişlik hero poster (width×width*1.35) +
// içerik (show adı, meta rozetleri, bölüm başlığı) + bölüm kartları (thumb 155×110).
export const SeasonSkeleton = () => {
  const { theme } = useTheme();
  const HERO_H = Math.round(width * 1.35);
  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <Skeleton width={width} height={HERO_H} style={{ borderRadius: 0 }} />
      <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
        <Skeleton width={"45%"} height={15} style={{ borderRadius: 4, marginBottom: 10 }} />
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
          <Skeleton width={92} height={28} style={{ borderRadius: 20 }} />
          <Skeleton width={70} height={28} style={{ borderRadius: 20 }} />
          <Skeleton width={60} height={28} style={{ borderRadius: 20 }} />
        </View>
        <Skeleton width={width * 0.4} height={20} style={{ borderRadius: 6, marginBottom: 16 }} />
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              padding: 5,
              gap: 5,
              borderRadius: 25,
              borderWidth: 1,
              borderColor: theme.border,
              marginBottom: 12,
            }}
          >
            <Skeleton width={155} height={110} style={{ borderRadius: 20 }} />
            <View style={{ flex: 1, paddingVertical: 8, paddingRight: 8, gap: 9, justifyContent: "center" }}>
              <Skeleton width={"80%"} height={16} style={{ borderRadius: 4 }} />
              <Skeleton width={"50%"} height={12} style={{ borderRadius: 4 }} />
              <Skeleton width={"95%"} height={11} style={{ borderRadius: 4 }} />
              <Skeleton width={"70%"} height={11} style={{ borderRadius: 4 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export const EpisodeSkeleton = () => {
  const { theme } = useTheme();
  return (
    <ScrollView
      style={[styles.episodeContainer, { backgroundColor: theme.primary }]}
    >
      <Skeleton width={width} height={280} style={styles.episodeBackdrop} />
      <View style={styles.episodeContent}>
        <View style={styles.episodeHeader}>
          <Skeleton
            width={width * 0.8}
            height={24}
            style={styles.episodeTitle}
          />
          <View style={styles.episodeMeta}>
            <Skeleton
              width={width * 0.3}
              height={16}
              style={styles.episodeDate}
            />
            <Skeleton
              width={width * 0.2}
              height={16}
              style={styles.episodeRuntime}
            />
          </View>
          <View style={styles.episodeRating}>
            <Skeleton width={100} height={20} style={styles.ratingValue} />
            <Skeleton width={150} height={15} style={styles.stars} />
            <Skeleton width={80} height={12} style={styles.voteCount} />
          </View>
        </View>

        <View style={styles.episodeSection}>
          <Skeleton
            width={width * 0.4}
            height={24}
            style={styles.sectionTitle}
          />
          <Skeleton
            width={width * 0.9}
            height={80}
            style={styles.episodeOverview}
          />
        </View>

        <View style={styles.episodeSection}>
          <Skeleton
            width={width * 0.4}
            height={24}
            style={styles.sectionTitle}
          />
          <View style={styles.crewList}>
            {[1, 2, 3].map((_, index) => (
              <View key={index} style={styles.crewItem}>
                <Skeleton
                  width={width * 0.18}
                  height={width * 0.18}
                  style={styles.crewImage}
                />
                <Skeleton
                  width={width * 0.18}
                  height={12}
                  style={styles.crewName}
                />
                <Skeleton
                  width={width * 0.15}
                  height={10}
                  style={styles.crewJob}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.episodeSection}>
          <Skeleton
            width={width * 0.4}
            height={24}
            style={styles.sectionTitle}
          />
          <View style={styles.guestList}>
            {[1, 2, 3, 4, 5, 6].map((_, index) => (
              <View key={index} style={styles.guestItem}>
                <Skeleton
                  width={width * 0.18}
                  height={width * 0.18}
                  style={styles.guestImage}
                />
                <Skeleton
                  width={width * 0.18}
                  height={12}
                  style={styles.guestName}
                />
                <Skeleton
                  width={width * 0.15}
                  height={10}
                  style={styles.guestCharacter}
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export const SearchSkeleton = () => {
  const { theme } = useTheme();
  return (
    <View style={[styles.searchContainer, { backgroundColor: theme.primary }]}>
      <View style={styles.searchResults}>
        {[1, 2, 3, 4].map((_, index) => (
          <View key={index} style={styles.searchItem}>
            <Skeleton
              width={100}
              height={152}
              style={{ ...styles.searchPoster, borderRadius: 12 }}
            />
            <View style={styles.searchInfo}>
              <Skeleton
                width={width * 0.5}
                height={20}
                style={styles.searchTitle}
              />
              <Skeleton
                width={width * 0.3}
                height={15}
                style={styles.searchDate}
              />
              <View style={styles.searchRating}>
                <Skeleton width={80} height={20} style={styles.ratingValue} />
                <Skeleton width={150} height={15} style={styles.stars} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// Oyuncu detay sayfası (hero + bilgi pill'leri + biyografi + filmografi)
export const ActorSkeleton = () => {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      {/* Hero görsel */}
      <Skeleton width={width} height={width * 1.1} style={{ borderRadius: 0 }} />
      <View style={{ padding: 16, gap: 14 }}>
        {/* İsim + meta rozetleri */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Skeleton width={130} height={26} style={{ borderRadius: 13 }} />
          <Skeleton width={70} height={26} style={{ borderRadius: 13 }} />
        </View>
        {/* Doğum bilgisi pill'leri */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Skeleton width={width * 0.42} height={40} style={{ borderRadius: 12 }} />
          <Skeleton width={width * 0.42} height={40} style={{ borderRadius: 12 }} />
        </View>
        {/* Biyografi */}
        <View style={{ gap: 8 }}>
          <Skeleton width={width * 0.4} height={20} style={{ borderRadius: 6 }} />
          <Skeleton width={"100%"} height={13} style={{ borderRadius: 4 }} />
          <Skeleton width={"100%"} height={13} style={{ borderRadius: 4 }} />
          <Skeleton width={"70%"} height={13} style={{ borderRadius: 4 }} />
        </View>
        {/* Filmografi başlığı + posterler */}
        <Skeleton
          width={width * 0.5}
          height={22}
          style={{ borderRadius: 6, marginTop: 4 }}
        />
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              width={width * 0.3}
              height={width * 0.45}
              style={{ borderRadius: 12 }}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

// Devam Eden Diziler (başlık + 4 istatistik kartı + 2 sütun poster grid)
export const OnGoingSeriesSkeleton = () => {
  const POSTER_W = (width - 48) / 2;
  const POSTER_H = POSTER_W * 1.5;
  const STAT_W = (width - 48) / 4;
  return (
    <View style={{ flex: 1, paddingTop: 12 }}>
      {/* Başlık */}
      <View style={{ paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
        <Skeleton width={width * 0.55} height={22} style={{ borderRadius: 6 }} />
        <Skeleton width={width * 0.3} height={14} style={{ borderRadius: 4 }} />
      </View>
      {/* İstatistik kartları */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 12,
          gap: 8,
          marginBottom: 16,
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <Skeleton
            key={i}
            width={STAT_W}
            height={70}
            style={{ borderRadius: 12 }}
          />
        ))}
      </View>
      {/* Dizi grid (2 sütun) */}
      <View style={{ paddingHorizontal: 12, gap: 12 }}>
        {[0, 1, 2].map((r) => (
          <View key={r} style={{ flexDirection: "row", gap: 12 }}>
            <Skeleton width={POSTER_W} height={POSTER_H} style={{ borderRadius: 14 }} />
            <Skeleton width={POSTER_W} height={POSTER_H} style={{ borderRadius: 14 }} />
          </View>
        ))}
      </View>
    </View>
  );
};

// ── Sosyal feed kartı (ShareContentScreen / PostDetail): avatar başlık + başlık
// + poster rayı + aksiyon satırı. Gerçek PostCard (postStyles.card) ile aynı ölçü.
export const PostCardSkeleton = () => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        marginHorizontal: 14,
        marginBottom: 10,
        borderRadius: 16,
        padding: 13,
        borderWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: 2,
        backgroundColor: theme.secondary,
        borderColor: theme.border,
        borderLeftColor: theme.border,
      }}
    >
      {/* Başlık: avatar + isim/zaman + menü noktası */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Skeleton width={34} height={34} style={{ borderRadius: 17 }} />
        <View style={{ flex: 1, marginLeft: 10, gap: 6 }}>
          <Skeleton width={"42%"} height={12} style={{ borderRadius: 4 }} />
          <Skeleton width={"26%"} height={9} style={{ borderRadius: 4 }} />
        </View>
        <Skeleton width={4} height={16} style={{ borderRadius: 2 }} />
      </View>
      {/* Başlık satırı */}
      <Skeleton width={"70%"} height={15} style={{ borderRadius: 5, marginBottom: 12 }} />
      {/* Poster rayı */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={78} height={117} style={{ borderRadius: 10 }} />
        ))}
      </View>
      {/* Aksiyon satırı (beğen / yorum / paylaş) */}
      <View
        style={{
          flexDirection: "row",
          gap: 14,
          paddingTop: 10,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
        }}
      >
        {[46, 46, 40].map((w, i) => (
          <Skeleton key={i} width={w} height={14} style={{ borderRadius: 6 }} />
        ))}
      </View>
    </View>
  );
};

// Feed ilk yüklemesi için N adet PostCardSkeleton (FlatList ListEmptyComponent).
export const FeedSkeleton = ({ count = 4 }) => (
  <View style={{ paddingTop: 6 }}>
    {Array.from({ length: count }).map((_, i) => (
      <PostCardSkeleton key={i} />
    ))}
  </View>
);

// ── "Postlarım" yatay kompakt kart (MyPostsScreen MyPostCard ile aynı ölçü):
// sol poster yığını + rozet/zaman + başlık + içerik + istatistik satırı.
export const MyPostsSkeleton = ({ count = 5 }) => {
  const { theme } = useTheme();
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            gap: 14,
            padding: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderLeftWidth: 3,
            marginBottom: 12,
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            borderLeftColor: theme.border,
          }}
        >
          <Skeleton width={64} height={96} style={{ borderRadius: 10 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Skeleton width={54} height={16} style={{ borderRadius: 6 }} />
              <Skeleton width={40} height={10} style={{ borderRadius: 4, marginLeft: "auto" }} />
            </View>
            <Skeleton width={"75%"} height={15} style={{ borderRadius: 5 }} />
            <Skeleton width={"100%"} height={11} style={{ borderRadius: 4 }} />
            <Skeleton width={"55%"} height={11} style={{ borderRadius: 4 }} />
            <View style={{ flexDirection: "row", gap: 16, marginTop: 2 }}>
              <Skeleton width={44} height={12} style={{ borderRadius: 4 }} />
              <Skeleton width={44} height={12} style={{ borderRadius: 4 }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

// ── Etkinlik listesi satırı (MyActivityScreen row ile aynı ölçü):
// sol poster 48×70 + meta/başlık/tarih satırları.
export const ActivityListSkeleton = ({ count = 7 }) => {
  const { theme } = useTheme();
  return (
    <View style={{ padding: 16, paddingTop: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 11,
            paddingRight: 14,
            paddingLeft: 16,
            borderRadius: 18,
            borderWidth: 1,
            marginBottom: 12,
            backgroundColor: theme.secondary,
            borderColor: theme.border,
          }}
        >
          <Skeleton width={48} height={70} style={{ borderRadius: 10 }} />
          <View style={{ flex: 1, gap: 7 }}>
            <Skeleton width={70} height={12} style={{ borderRadius: 4 }} />
            <Skeleton width={"72%"} height={14} style={{ borderRadius: 5 }} />
            <Skeleton width={"40%"} height={11} style={{ borderRadius: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  // Temel Skeleton kutusu (boyut/renk inline gelir; köşe buradan)
  skeleton: {
    borderRadius: 4,
  },
  cardContainer: {
    alignItems: "center",
    width: width * 0.6,
    height: height * 0.45,
  },
  poster: {
    borderRadius: 25,
  },
  infoContainer: {
    alignItems: "center",
    marginTop: 20,
    gap: 10,
  },
  infoBestContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderRadius: 10,
  },
  title: {
    borderRadius: 10,
  },
  rating: {
    marginTop: 10,
  },
  stars: {
    borderRadius: 4,
  },
  titleOscar: {
    fontSize: 18,
    uppercase: true,
    marginBottom: 15,
    marginLeft: 15,
    fontWeight: "700",
  },
  detailsContainer: {
    flex: 1,
  },
  backdrop: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    gap: 15,
  },
  posterSmall: {
    borderRadius: 10,
  },
  headerInfo: {
    flex: 1,
    gap: 10,
  },
  titleLarge: {
    borderRadius: 4,
  },
  tagline: {
    borderRadius: 4,
  },
  genres: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  genre: {
    borderRadius: 15,
  },
  statsCard: {
    borderRadius: 10,
  },
  overview: {
    borderRadius: 4,
  },
  seasonContainer: {
    flex: 1,
    padding: 20,
  },
  seasonHeader: {
    flexDirection: "row",
    marginBottom: 30,
  },
  seasonPoster: {
    borderRadius: 10,
  },
  seasonInfo: {
    flex: 1,
    marginLeft: 15,
  },
  seasonTitle: {
    marginBottom: 10,
    borderRadius: 4,
  },
  seasonMeta: {
    marginBottom: 10,
    borderRadius: 4,
  },
  seasonOverview: {
    borderRadius: 4,
  },
  episodesList: {
    gap: 15,
  },
  episodeCard: {
    flexDirection: "row",
    borderRadius: 20,
    padding: 3,
    overflow: "hidden",
  },
  episodeImage: {
    borderRadius: 17,
  },
  episodeInfo: {
    flex: 1,
    padding: 10,
    gap: 10,
  },
  episodeTitle: {
    borderRadius: 4,
  },
  episodeMetaContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 5,
  },
  episodeDate: {
    borderRadius: 4,
  },
  episodeRuntime: {
    borderRadius: 4,
  },
  voteCount: {
    borderRadius: 4,
  },
  sectionTitle: {
    borderRadius: 4,
  },
  episodeOverview: {
    borderRadius: 4,
  },
  crew: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  crewMember: {
    borderRadius: width * 0.135,
  },
  ratingValue: {
    marginBottom: 5,
    borderRadius: 4,
  },
  castSection: {
    marginTop: 20,
  },
  castList: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 15,
  },
  castItem: {
    alignItems: "center",
    width: 80,
  },
  castImage: {
    borderRadius: 40,
    marginBottom: 8,
  },
  castName: {
    marginBottom: 4,
    borderRadius: 4,
  },
  castRole: {
    borderRadius: 4,
  },
  videoSection: {
    marginTop: 20,
  },
  videoList: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 15,
  },
  videoItem: {
    width: 200,
  },
  videoThumbnail: {
    borderRadius: 10,
    marginBottom: 8,
  },
  videoTitle: {
    borderRadius: 4,
  },
  searchContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  searchInputContainer: {
    marginBottom: 20,
  },
  searchInput: {
    borderRadius: 25,
  },
  searchResults: {
    gap: 15,
  },
  searchItem: {
    flexDirection: "row",
    borderRadius: 15,
    padding: 10,
    overflow: "hidden",
  },
  searchPoster: {
    borderRadius: 10,
  },
  searchInfo: {
    flex: 1,
    marginLeft: 15,
    gap: 10,
  },
  searchTitle: {
    borderRadius: 4,
  },
  searchDate: {
    borderRadius: 4,
  },
  searchRating: {
    marginTop: 5,
  },
  episodeContainer: {
    flex: 1,
  },
  episodeBackdrop: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  episodeContent: {
    padding: 20,
    gap: 20,
  },
  episodeHeader: {
    gap: 10,
  },
  episodeMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  episodeRating: {
    gap: 5,
  },
  episodeSection: {
    marginTop: 20,
    gap: 15,
  },
  crewList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
    justifyContent: "space-between",
  },
  crewItem: {
    width: width * 0.27,
    alignItems: "center",
    gap: 5,
  },
  crewImage: {
    borderRadius: width * 0.09,
  },
  crewName: {
    borderRadius: 4,
  },
  crewJob: {
    borderRadius: 4,
  },
  guestList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
    justifyContent: "space-between",
  },
  guestItem: {
    width: width * 0.27,
    alignItems: "center",
    gap: 5,
  },
  guestImage: {
    borderRadius: width * 0.09,
  },
  guestName: {
    borderRadius: 4,
  },
  guestCharacter: {
    borderRadius: 4,
  },
});
