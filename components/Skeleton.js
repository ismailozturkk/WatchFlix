import React, { useEffect, useRef } from "react";
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import useRailPosterStyle from "../hooks/useRailPosterStyle";
import { PosterBadgeSkeleton, POSTER_BADGE_POS } from "./PosterInfoBadges";
const { width } = Dimensions.get("window");

export default function Skeleton({
  width: skeletonWidth,
  height,
  style,
  children,
}) {
  const { theme } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sonsuz döngü unmount'ta durdurulmazsa iskelet kaybolduktan sonra da
    // çalışmaya devam ediyor; iskeletler her liste/ekran yüklemesinde monte
    // edildiği için oturum boyunca birikiyorlar.
    const loop = Animated.loop(
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
    );
    loop.start();
    return () => loop.stop();
  }, [animatedValue]);

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

// ── Ana ekran "Trendler" rayı (TvShowsTrends / MovieTrends) ──────────────────
// Ölçüler prop olarak GERÇEK kartın sabitlerinden gelir (ITEM_SIZE, CARD_WIDTH,
// CARD_HEIHGT, SPACING, EMPTY_ITEM_SIZE, FOCUS_HEADROOM); iskelet burada kendi
// sayılarını uydurmaz, kart ölçüsü değişirse kendiliğinden takip eder.
//   • edge     → gerçek listedeki kenar spacer'ı (ilk kart ortalanır)
//   • headroom → büyüyen odak posteri için contentContainerStyle'daki üst pay
//   • ölçek    → odaktaki kart 1.0, diğerleri 0.7: listenin durgun hâli
export const TrendRailSkeleton = ({ metrics, count = 3 }) => {
  const { itemSize, cardWidth, cardHeight, spacing, edge, headroom } = metrics;
  return (
    <View
      style={{
        flexDirection: "row",
        paddingLeft: edge,
        paddingTop: headroom,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={{ width: itemSize, height: cardHeight }}>
          <View
            style={{
              width: cardWidth,
              height: cardWidth * 1.5,
              marginHorizontal: spacing,
              transform: [{ scale: index === 0 ? 1 : 0.7 }],
            }}
          >
            <Skeleton
              width={cardWidth}
              height={cardWidth * 1.5}
              style={{ borderRadius: 25 }}
            />
            {/* Gerçek kartın puan rozetiyle aynı köşe (trendRating: 8/8) */}
            <PosterBadgeSkeleton
              variant="rating"
              scale={1}
              style={{ position: "absolute", right: 8, bottom: 8 }}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

// ── Ana ekran yatay rayları (Bests, Genres, Providers, OnTheAir, Discovery…) ──
// Tek kart. Ölçü/köşe useRailPosterStyle'dan gelir — yani ayarlardaki poster
// boyutu (normal/small) ve köşe yarıçapı iskelette de geçerlidir. Hücre
// boşlukları gerçek kartla aynı (similarItem: marginRight 10 / marginBottom 5).
// Rozetler posterin İÇİNE konumlanır (gerçek kartta da poster sarmalayıcısına
// göre konumlanıyorlar), bu yüzden ayrı bir poster kutusu var.
export const RailPosterSkeleton = ({
  showRating = true,
  showReleaseDate = false,
  showCountdown = false,
  // TvShowsGenres'in kartında alt boşluk yok; iskelet de ray yüksekliğini
  // 5px şişirmesin diye ayarlanabilir.
  cellMarginBottom = 5,
}) => {
  const rp = useRailPosterStyle();
  return (
    <View
      style={{
        width: rp.itemWidth,
        height: rp.itemHeight,
        marginRight: 10,
        marginBottom: cellMarginBottom,
      }}
    >
      <View style={{ width: rp.posterWidth, height: rp.posterHeight }}>
        <Skeleton
          width={rp.posterWidth}
          height={rp.posterHeight}
          style={{ borderRadius: rp.radius }}
        />
        {showReleaseDate && (
          <PosterBadgeSkeleton variant="date" style={POSTER_BADGE_POS.topRight} />
        )}
        {showCountdown && (
          <PosterBadgeSkeleton variant="countdown" style={POSTER_BADGE_POS.topLeft} />
        )}
        {showRating && (
          <PosterBadgeSkeleton variant="rating" style={POSTER_BADGE_POS.bottomRight} />
        )}
      </View>
    </View>
  );
};

// Rayın tamamı: rail'in contentContainerStyle'ı ile aynı yatay dolgu (15) ve
// ekranı dolduracak kadar kart. Yükleme sırasında kaydırma olmadığından düz
// View yeter; FlatList kurulum maliyeti boşuna ödenmez.
export const RailSkeleton = ({
  count,
  showRating = true,
  showReleaseDate = false,
  showCountdown = false,
  cellMarginBottom = 5,
  style,
}) => {
  const rp = useRailPosterStyle();
  const total = count ?? Math.ceil((width - 30) / (rp.itemWidth + 10)) + 1;
  return (
    <View style={[styles.railSkeleton, style]}>
      {Array.from({ length: total }).map((_, index) => (
        <RailPosterSkeleton
          key={index}
          showRating={showRating}
          showReleaseDate={showReleaseDate}
          showCountdown={showCountdown}
          cellMarginBottom={cellMarginBottom}
        />
      ))}
    </View>
  );
};

// Kategori / tür / sağlayıcı çipleri veri gelmeden çizilemez; yerlerini aynı
// yükseklikteki iskelet haplar tutar. Olmasa başlık satırı 0 yükseklikten
// gerçek yüksekliğe sıçrar ve altındaki ray zıplar.
const CHIP_SKELETON_WIDTHS = [78, 96, 66, 104, 84, 90];
export const ChipRowSkeleton = ({
  count = 5,
  chipHeight = 38,
  radius = 20,
  gap = 5,
  style,
}) => (
  <View style={[styles.chipRow, style]}>
    {Array.from({ length: count }).map((_, index) => (
      <Skeleton
        key={index}
        width={CHIP_SKELETON_WIDTHS[index % CHIP_SKELETON_WIDTHS.length]}
        height={chipHeight}
        style={{ borderRadius: radius, marginRight: gap }}
      />
    ))}
  </View>
);
export const MovieBestsSkeleton = () => {
  return <RailPosterSkeleton />;
};
// Koleksiyon kartı da standart poster ayarını kullanır; sağ üstte film sayısı vardır.
export const MovieCollectionSkeleton = () => {
  const rp = useRailPosterStyle();
  return (
    <View style={{ width: rp.itemWidth, height: rp.posterHeight, marginRight: 14 }}>
      <Skeleton
        width={rp.posterWidth}
        height={rp.posterHeight}
        style={{
          borderRadius: rp.radius,
        }}
      />
      <Skeleton
        width={42}
        height={20}
        style={{ position: "absolute", right: 6, top: 6, borderRadius: 10 }}
      />
    </View>
  );
};
export const MovieOscarSkeleton = () => {
  const rp = useRailPosterStyle();
  return (
    <View
      style={{
        width: rp.posterWidth + width * 0.04,
        height: rp.posterHeight,
        marginRight: 15,
        flexDirection: "row",
      }}
    >
      <View style={{ width: width * 0.04, alignItems: "center", justifyContent: "space-around" }}>
        <Skeleton width={10} height={40} style={{ borderRadius: 5 }} />
        <Skeleton width={10} height={Math.min(120, rp.posterHeight * 0.5)} style={{ borderRadius: 5 }} />
      </View>
      <View style={{ width: rp.posterWidth, height: rp.posterHeight }}>
        <Skeleton
          width={rp.posterWidth}
          height={rp.posterHeight}
          style={{ borderRadius: rp.radius }}
        />
        <PosterBadgeSkeleton
          variant="rating"
          style={POSTER_BADGE_POS.bottomRight}
        />
      </View>
    </View>
  );
};
export const TvShowsEmmySkeleton = () => {
  const rp = useRailPosterStyle();
  return (
    <View
      style={{
        width: rp.posterWidth + width * 0.04,
        height: rp.posterHeight,
        marginRight: 15,
        flexDirection: "row",
      }}
    >
      <View style={{ width: width * 0.04, alignItems: "center", justifyContent: "space-around" }}>
        <Skeleton width={10} height={40} style={{ borderRadius: 5 }} />
        <Skeleton width={10} height={Math.min(120, rp.posterHeight * 0.5)} style={{ borderRadius: 5 }} />
      </View>
      <View style={{ width: rp.posterWidth, height: rp.posterHeight }}>
        <Skeleton
          width={rp.posterWidth}
          height={rp.posterHeight}
          style={{ borderRadius: rp.radius }}
        />
        <PosterBadgeSkeleton
          variant="rating"
          style={POSTER_BADGE_POS.bottomRight}
        />
      </View>
    </View>
  );
};
// Yatay poster section'ları (Genres, NowPlaying, Provders, TvGenres, TvProvders…)
// Gerçek kart 0.4×0.6 r15 → skeleton de aynı ölçüde.
export const MovieSkeleton = () => {
  return <RailPosterSkeleton />;
};
export const MovieUpComingSkeleton = () => {
  return (
    <RailPosterSkeleton
      showRating={false}
      showReleaseDate
      showCountdown
    />
  );
};
export const AvatarSkeleton = () => {
  // ProfileScreen'deki avatarProgressWrapper/profilImageTouch (156x156,
  // borderRadius 78) ile eşleşir — yükleme sırasında boyut sıçraması olmasın.
  return <Skeleton width={156} height={156} style={{ borderRadius: 78 }} />;
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

// ── Kompakt sosyal kart (PostDetail): avatar başlık + başlık + poster rayı +
// aksiyon satırı. Feed'in kendi iskeleti aşağıdaki FeedPostCardSkeleton.
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
      <View>
        {/* Başlık satırı */}
        <Skeleton width={"70%"} height={15} style={{ borderRadius: 5, marginBottom: 12 }} />
        {/* Poster rayı */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={78} height={117} style={{ borderRadius: 10 }} />
          ))}
        </View>
        {/* Aksiyon satırı (beğen / yorum / paylaş) */}
        <View style={{ flexDirection: "row", gap: 22 }}>
          {[46, 46, 40].map((w, i) => (
            <Skeleton key={i} width={w} height={14} style={{ borderRadius: 6 }} />
          ))}
        </View>
      </View>
    </View>
  );
};

// ── Feed kartı (ShareContentScreen FeedPostCard ile aynı ölçü): yuvarlak
// yüzeyli kart, avatar başlık + tip rozeti, büyük poster + metin satırları,
// aksiyon hapları.
export const FeedPostCardSkeleton = () => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        marginHorizontal: 14,
        marginBottom: 14,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 12,
        borderWidth: StyleSheet.hairlineWidth,
        backgroundColor: theme.secondary,
        borderColor: theme.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
        <Skeleton width={40} height={40} style={{ borderRadius: 20 }} />
        <View style={{ flex: 1, marginLeft: 10, gap: 6 }}>
          <Skeleton width={"40%"} height={12} style={{ borderRadius: 4 }} />
          <Skeleton width={"22%"} height={9} style={{ borderRadius: 4 }} />
        </View>
        <Skeleton width={70} height={22} style={{ borderRadius: 11 }} />
      </View>
      <View style={{ flexDirection: "row", gap: 14, marginBottom: 12 }}>
        <Skeleton width={118} height={177} style={{ borderRadius: 18 }} />
        <View style={{ flex: 1, gap: 9 }}>
          <Skeleton width={"55%"} height={11} style={{ borderRadius: 4 }} />
          <Skeleton width={"90%"} height={16} style={{ borderRadius: 5 }} />
          <Skeleton width={"70%"} height={16} style={{ borderRadius: 5 }} />
          <Skeleton width={"100%"} height={11} style={{ borderRadius: 4, marginTop: 4 }} />
          <Skeleton width={"100%"} height={11} style={{ borderRadius: 4 }} />
          <Skeleton width={"80%"} height={11} style={{ borderRadius: 4 }} />
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
        }}
      >
        <Skeleton width={58} height={36} style={{ borderRadius: 18 }} />
        <Skeleton width={58} height={36} style={{ borderRadius: 18 }} />
        <View style={{ flex: 1 }} />
        <Skeleton width={40} height={36} style={{ borderRadius: 18 }} />
      </View>
    </View>
  );
};

// Feed ilk yüklemesi için N adet FeedPostCardSkeleton (FlatList ListEmptyComponent).
export const FeedSkeleton = ({ count = 4 }) => (
  <View style={{ paddingTop: 6 }}>
    {Array.from({ length: count }).map((_, i) => (
      <FeedPostCardSkeleton key={i} />
    ))}
  </View>
);

// ── "Postlarım" (MyPostsScreen ile aynı ölçü): üstte 3'lü özet şeridi, altında
// yuvarlak yüzeyli kartlar — rozet/zaman satırı, poster + metin, istatistik hapları.
export const MyPostsSkeleton = ({ count = 4 }) => {
  const { theme } = useTheme();
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              padding: 10,
              borderRadius: 18,
              borderWidth: StyleSheet.hairlineWidth,
              backgroundColor: theme.secondary,
              borderColor: theme.border,
            }}
          >
            <Skeleton width={32} height={32} style={{ borderRadius: 11 }} />
            <View style={{ gap: 5 }}>
              <Skeleton width={34} height={13} style={{ borderRadius: 4 }} />
              <Skeleton width={42} height={9} style={{ borderRadius: 4 }} />
            </View>
          </View>
        ))}
      </View>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            marginBottom: 14,
            borderRadius: 24,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 12,
            borderWidth: StyleSheet.hairlineWidth,
            backgroundColor: theme.secondary,
            borderColor: theme.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Skeleton width={74} height={22} style={{ borderRadius: 11 }} />
            <Skeleton width={36} height={10} style={{ borderRadius: 4, marginLeft: "auto" }} />
          </View>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <Skeleton width={80} height={120} style={{ borderRadius: 14 }} />
            <View style={{ flex: 1, gap: 9 }}>
              <Skeleton width={"85%"} height={16} style={{ borderRadius: 5 }} />
              <Skeleton width={"60%"} height={16} style={{ borderRadius: 5 }} />
              <Skeleton width={"100%"} height={11} style={{ borderRadius: 4, marginTop: 4 }} />
              <Skeleton width={"90%"} height={11} style={{ borderRadius: 4 }} />
              <Skeleton width={"55%"} height={11} style={{ borderRadius: 4 }} />
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.border,
            }}
          >
            <Skeleton width={56} height={32} style={{ borderRadius: 16 }} />
            <Skeleton width={56} height={32} style={{ borderRadius: 16 }} />
          </View>
        </View>
      ))}
    </View>
  );
};

// ── Etkinlik listesi satırı (MyActivityScreen Row ile aynı ölçü):
// yuvarlak kart, sol poster 56×84, rozet/tarih + başlık satırları, sağda puan rozeti.
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
            padding: 12,
            borderRadius: 22,
            borderWidth: StyleSheet.hairlineWidth,
            marginBottom: 12,
            backgroundColor: theme.secondary,
            borderColor: theme.border,
          }}
        >
          <Skeleton width={56} height={84} style={{ borderRadius: 12 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Skeleton width={52} height={16} style={{ borderRadius: 8 }} />
              <Skeleton width={44} height={10} style={{ borderRadius: 4, marginLeft: "auto" }} />
            </View>
            <Skeleton width={"78%"} height={15} style={{ borderRadius: 5 }} />
            <Skeleton width={"45%"} height={12} style={{ borderRadius: 4 }} />
          </View>
          <Skeleton width={58} height={52} style={{ borderRadius: 16 }} />
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
  // Ray iskeleti: gerçek rail'in contentContainerStyle'ı ile aynı yatay dolgu.
  railSkeleton: {
    flexDirection: "row",
    paddingHorizontal: 15,
    overflow: "hidden",
  },
  chipRow: {
    flexDirection: "row",
    overflow: "hidden",
  },
  stars: {
    borderRadius: 4,
  },
  detailsContainer: {
    flex: 1,
  },
  episodeTitle: {
    borderRadius: 4,
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
  ratingValue: {
    marginBottom: 5,
    borderRadius: 4,
  },
  searchContainer: {
    flex: 1,
    paddingHorizontal: 15,
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
