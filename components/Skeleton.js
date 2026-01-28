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
    />
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
            mmarginBottom: 5,
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
          <Skeleton width={width * 0.3} height={15} style={styles.title} />
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
    <View style={[styles.detailsContainer, { backgroundColor: theme.primary }]}>
      <Skeleton width={width} height={width * 0.6} style={styles.backdrop} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Skeleton
            width={width * 0.35}
            height={width * 0.5}
            style={styles.posterSmall}
          />
          <View style={styles.headerInfo}>
            <Skeleton
              width={width * 0.5}
              height={24}
              style={styles.titleLarge}
            />
            <Skeleton width={width * 0.4} height={16} style={styles.tagline} />
            <View style={styles.genres}>
              <Skeleton width={80} height={25} style={styles.genre} />
              <Skeleton width={80} height={25} style={styles.genre} />
              <Skeleton width={80} height={25} style={styles.genre} />
            </View>
            <View style={styles.rating}>
              <Skeleton width={100} height={20} style={styles.ratingValue} />
              <Skeleton width={150} height={15} style={styles.stars} />
            </View>
          </View>
        </View>

        <View style={styles.stats}>
          <Skeleton width={width * 0.9} height={60} style={styles.statsCard} />
        </View>

        <Skeleton width={width * 0.9} height={80} style={styles.overview} />

        <View style={styles.castSection}>
          <Skeleton
            width={width * 0.5}
            height={24}
            style={styles.sectionTitle}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.castList}>
              {[1, 2, 3, 4].map((_, index) => (
                <View key={index} style={styles.castItem}>
                  <Skeleton width={80} height={80} style={styles.castImage} />
                  <Skeleton width={70} height={12} style={styles.castName} />
                  <Skeleton width={60} height={10} style={styles.castRole} />
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.videoSection}>
          <Skeleton
            width={width * 0.5}
            height={24}
            style={styles.sectionTitle}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.videoList}>
              {[1, 2, 3].map((_, index) => (
                <View key={index} style={styles.videoItem}>
                  <Skeleton
                    width={200}
                    height={120}
                    style={styles.videoThumbnail}
                  />
                  <Skeleton width={180} height={12} style={styles.videoTitle} />
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
    <View style={[styles.seasonContainer, { backgroundColor: theme.primary }]}>
      <View style={styles.seasonHeader}>
        <Skeleton
          width={width * 0.35}
          height={width * 0.5}
          style={styles.seasonPoster}
        />
        <View style={styles.seasonInfo}>
          <Skeleton
            width={width * 0.5}
            height={24}
            style={styles.seasonTitle}
          />
          <Skeleton width={width * 0.3} height={16} style={styles.seasonMeta} />
          <Skeleton
            width={width * 0.5}
            height={60}
            style={styles.seasonOverview}
          />
        </View>
      </View>
      <View style={styles.episodesList}>
        <Skeleton width={width * 0.5} height={24} style={styles.sectionTitle} />
        {[1, 2, 3].map((_, index) => (
          <View key={index} style={styles.episodeCard}>
            <Skeleton width={160} height={130} style={styles.episodeImage} />
            <View style={styles.episodeInfo}>
              <Skeleton
                width={width * 0.4}
                height={18}
                style={styles.episodeTitle}
              />
              <View style={styles.episodeMetaContainer}>
                <Skeleton
                  width={100}
                  height={12}
                  style={styles.episodeRating}
                />
                <Skeleton width={80} height={12} style={styles.episodeDate} />
              </View>
              <Skeleton
                width={width * 0.4}
                height={30}
                style={styles.episodeOverview}
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
      style={[styles.episodeContainer, { backgroundColor: theme.primary }]}
    >
      <Skeleton
        width={width}
        height={width * 0.6}
        style={styles.episodeBackdrop}
      />
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
                  width={width * 0.2}
                  height={width * 0.2}
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
                  width={width * 0.2}
                  height={width * 0.2}
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
              width={110}
              height={170}
              style={{ ...styles.searchPoster, borderRadius: 5 }}
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

const styles = StyleSheet.create({
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
