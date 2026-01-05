import React, { useEffect } from "react";
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  ScrollView,
  Text,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
const { width, height } = Dimensions.get("window");

export default function Skeleton({ width: skeletonWidth, height, style }) {
  const { theme } = useTheme();
  const animatedValue = new Animated.Value(0);

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
      ])
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
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    borderRadius: 4,
  },
});

// Ready skeleton components
export const MovieCardSkeleton = () => {
  const { theme } = useTheme();
  return (
    <View style={styles2.cardContainer}>
      <Skeleton
        width={width * 0.4}
        height={width * 0.6}
        style={styles2.poster}
      />
      <View style={styles2.infoContainer}>
        <Skeleton width={width * 0.35} height={20} style={styles2.title} />
        <Skeleton width={width * 0.3} height={15} style={styles2.rating} />
        <Skeleton width={width * 0.35} height={10} style={styles2.stars} />
      </View>
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
        <View style={{ gap: 10 }}>
          <Skeleton
            width={20}
            height={width * 0.15}
            style={{ borderRadius: 10 }}
          />
          <Skeleton
            width={20}
            height={width * 0.27}
            style={{ borderRadius: 10 }}
          />
        </View>
        <Skeleton
          width={width * 0.35}
          height={width * 0.45}
          style={{
            marginRight: 15,
            width: width * 0.3,
            height: width * 0.45,
            borderRadius: 10,
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
            right: 20,
            bottom: 10,
            borderRadius: 10,
          }}
        />
      </View>
      <View style={{ alignItems: "center" }}>
        <Skeleton width={width * 0.3} height={15} style={styles2.title} />
      </View>
    </ScrollView>
  );
};
export const MovieProviderSkeleton = () => {
  const { theme } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        marginRight: 10,
        marginBottom: 20,
      }}
    >
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Skeleton
          width={width * 0.15}
          height={40}
          style={{ borderRadius: 10 }}
        />
        <Skeleton
          width={width * 0.27}
          height={40}
          style={{ borderRadius: 10 }}
        />
        <Skeleton
          width={width * 0.32}
          height={40}
          style={{ borderRadius: 10 }}
        />
      </View>
    </ScrollView>
  );
};
export const MovieSkeleton = () => {
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
          marginBottom: 5,
        }}
      >
        <View style={{ gap: 5, width: width * 0.3 }}>
          <Skeleton
            width={width * 0.35}
            height={width * 0.45}
            style={{
              marginRight: 15,
              width: width * 0.3,
              height: width * 0.45,
              borderRadius: 10,
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
              bottom: 10,
              borderRadius: 10,
            }}
          />
        </View>
        <View style={{}}>
          <Skeleton width={width * 0.3} height={15} style={styles2.title} />
        </View>
      </ScrollView>
    </View>
  );
};
export const MovieGenreSkeleton = () => {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 15 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          marginRight: 10,
        }}
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Skeleton
            width={width * 0.15}
            height={35}
            style={{ borderRadius: 20 }}
          />
          <Skeleton
            width={width * 0.27}
            height={35}
            style={{ borderRadius: 20 }}
          />
          <Skeleton
            width={width * 0.22}
            height={35}
            style={{ borderRadius: 20 }}
          />
        </View>
      </ScrollView>
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
        <View style={{ gap: 5, width: width * 0.3 }}>
          <Skeleton
            width={width * 0.35}
            height={width * 0.45}
            style={{
              marginRight: 15,
              width: width * 0.3,
              height: width * 0.45,
              borderRadius: 10,
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
        <View style={{}}>
          <Skeleton width={width * 0.3} height={15} style={styles2.title} />
        </View>
      </ScrollView>
    </View>
  );
};
export const AvatarSkeleton = () => {
  return <Skeleton width={120} height={120} style={{ borderRadius: 75 }} />;
};
export const WatchedInfoSkeleton = () => {
  return (
    <Skeleton
      width={"100%"}
      height={65}
      style={{ borderRadius: 12, marginBottom: 8 }}
    />
  );
};
export const ListsSkeleton = () => {
  return (
    <Skeleton
      width={170}
      height={135}
      style={{ borderRadius: 12, marginBottom: 10 }}
    />
  );
};
export const DetailsSkeleton = () => {
  const { theme } = useTheme();
  return (
    <View
      style={[styles2.detailsContainer, { backgroundColor: theme.primary }]}
    >
      <Skeleton width={width} height={width * 0.6} style={styles2.backdrop} />
      <View style={styles2.content}>
        <View style={styles2.header}>
          <Skeleton
            width={width * 0.35}
            height={width * 0.5}
            style={styles2.posterSmall}
          />
          <View style={styles2.headerInfo}>
            <Skeleton
              width={width * 0.5}
              height={24}
              style={styles2.titleLarge}
            />
            <Skeleton width={width * 0.4} height={16} style={styles2.tagline} />
            <View style={styles2.genres}>
              <Skeleton width={80} height={25} style={styles2.genre} />
              <Skeleton width={80} height={25} style={styles2.genre} />
              <Skeleton width={80} height={25} style={styles2.genre} />
            </View>
            <View style={styles2.rating}>
              <Skeleton width={100} height={20} style={styles2.ratingValue} />
              <Skeleton width={150} height={15} style={styles2.stars} />
            </View>
          </View>
        </View>

        <View style={styles2.stats}>
          <Skeleton width={width * 0.9} height={60} style={styles2.statsCard} />
        </View>

        <Skeleton width={width * 0.9} height={80} style={styles2.overview} />

        <View style={styles2.castSection}>
          <Skeleton
            width={width * 0.5}
            height={24}
            style={styles2.sectionTitle}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles2.castList}>
              {[1, 2, 3, 4].map((_, index) => (
                <View key={index} style={styles2.castItem}>
                  <Skeleton width={80} height={80} style={styles2.castImage} />
                  <Skeleton width={70} height={12} style={styles2.castName} />
                  <Skeleton width={60} height={10} style={styles2.castRole} />
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles2.videoSection}>
          <Skeleton
            width={width * 0.5}
            height={24}
            style={styles2.sectionTitle}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles2.videoList}>
              {[1, 2, 3].map((_, index) => (
                <View key={index} style={styles2.videoItem}>
                  <Skeleton
                    width={200}
                    height={120}
                    style={styles2.videoThumbnail}
                  />
                  <Skeleton
                    width={180}
                    height={12}
                    style={styles2.videoTitle}
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

export const SeasonSkeleton = () => {
  const { theme } = useTheme();
  return (
    <View style={[styles2.seasonContainer, { backgroundColor: theme.primary }]}>
      <View style={styles2.seasonHeader}>
        <Skeleton
          width={width * 0.35}
          height={width * 0.5}
          style={styles2.seasonPoster}
        />
        <View style={styles2.seasonInfo}>
          <Skeleton
            width={width * 0.5}
            height={24}
            style={styles2.seasonTitle}
          />
          <Skeleton
            width={width * 0.3}
            height={16}
            style={styles2.seasonMeta}
          />
          <Skeleton
            width={width * 0.5}
            height={60}
            style={styles2.seasonOverview}
          />
        </View>
      </View>
      <View style={styles2.episodesList}>
        <Skeleton
          width={width * 0.5}
          height={24}
          style={styles2.sectionTitle}
        />
        {[1, 2, 3].map((_, index) => (
          <View key={index} style={styles2.episodeCard}>
            <Skeleton width={160} height={130} style={styles2.episodeImage} />
            <View style={styles2.episodeInfo}>
              <Skeleton
                width={width * 0.4}
                height={18}
                style={styles2.episodeTitle}
              />
              <View style={styles2.episodeMetaContainer}>
                <Skeleton
                  width={100}
                  height={12}
                  style={styles2.episodeRating}
                />
                <Skeleton width={80} height={12} style={styles2.episodeDate} />
              </View>
              <Skeleton
                width={width * 0.4}
                height={30}
                style={styles2.episodeOverview}
              />
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
      style={[styles2.episodeContainer, { backgroundColor: theme.primary }]}
    >
      <Skeleton
        width={width}
        height={width * 0.6}
        style={styles2.episodeBackdrop}
      />
      <View style={styles2.episodeContent}>
        <View style={styles2.episodeHeader}>
          <Skeleton
            width={width * 0.8}
            height={24}
            style={styles2.episodeTitle}
          />
          <View style={styles2.episodeMeta}>
            <Skeleton
              width={width * 0.3}
              height={16}
              style={styles2.episodeDate}
            />
            <Skeleton
              width={width * 0.2}
              height={16}
              style={styles2.episodeRuntime}
            />
          </View>
          <View style={styles2.episodeRating}>
            <Skeleton width={100} height={20} style={styles2.ratingValue} />
            <Skeleton width={150} height={15} style={styles2.stars} />
            <Skeleton width={80} height={12} style={styles2.voteCount} />
          </View>
        </View>

        <View style={styles2.episodeSection}>
          <Skeleton
            width={width * 0.4}
            height={24}
            style={styles2.sectionTitle}
          />
          <Skeleton
            width={width * 0.9}
            height={80}
            style={styles2.episodeOverview}
          />
        </View>

        <View style={styles2.episodeSection}>
          <Skeleton
            width={width * 0.4}
            height={24}
            style={styles2.sectionTitle}
          />
          <View style={styles2.crewList}>
            {[1, 2, 3].map((_, index) => (
              <View key={index} style={styles2.crewItem}>
                <Skeleton
                  width={width * 0.2}
                  height={width * 0.2}
                  style={styles2.crewImage}
                />
                <Skeleton
                  width={width * 0.18}
                  height={12}
                  style={styles2.crewName}
                />
                <Skeleton
                  width={width * 0.15}
                  height={10}
                  style={styles2.crewJob}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles2.episodeSection}>
          <Skeleton
            width={width * 0.4}
            height={24}
            style={styles2.sectionTitle}
          />
          <View style={styles2.guestList}>
            {[1, 2, 3, 4, 5, 6].map((_, index) => (
              <View key={index} style={styles2.guestItem}>
                <Skeleton
                  width={width * 0.2}
                  height={width * 0.2}
                  style={styles2.guestImage}
                />
                <Skeleton
                  width={width * 0.18}
                  height={12}
                  style={styles2.guestName}
                />
                <Skeleton
                  width={width * 0.15}
                  height={10}
                  style={styles2.guestCharacter}
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
    <View style={[styles2.searchContainer, { backgroundColor: theme.primary }]}>
      <View style={styles2.searchResults}>
        {[1, 2, 3, 4].map((_, index) => (
          <View key={index} style={styles2.searchItem}>
            <Skeleton
              width={width * 0.25}
              height={width * 0.4}
              style={styles2.searchPoster}
            />
            <View style={styles2.searchInfo}>
              <Skeleton
                width={width * 0.5}
                height={20}
                style={styles2.searchTitle}
              />
              <Skeleton
                width={width * 0.3}
                height={15}
                style={styles2.searchDate}
              />
              <View style={styles2.searchRating}>
                <Skeleton width={80} height={20} style={styles2.ratingValue} />
                <Skeleton width={150} height={15} style={styles2.stars} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles2 = StyleSheet.create({
  cardContainer: {
    width: width * 0.4 + 25,
    alignItems: "center",
  },
  poster: {
    borderRadius: 25,
  },
  infoContainer: {
    alignItems: "center",
    marginTop: 20,
    gap: 10,
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
  episodeRating: {
    borderRadius: 4,
  },
  episodeDate: {
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
    borderRadius: width * 0.1,
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
    borderRadius: width * 0.1,
  },
  guestName: {
    borderRadius: 4,
  },
  guestCharacter: {
    borderRadius: 4,
  },
});
