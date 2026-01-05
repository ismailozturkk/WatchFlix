import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Image,
  Dimensions,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
//import { API_KEY } from "@env";
const { width, height } = Dimensions.get("window");
import { MovieUpComingSkeleton } from "../../components/Skeleton";
import { useTvShow } from "../../context/TvShowContex";
import { useEffect, useState } from "react";
//import { API_KEY } from "@env";

export default function TvShowBests({ navigation }) {
  const { theme } = useTheme();

  const {
    seriesBest,
    setSelectedCategoryBest,
    selectedCategoryBest,
    setPageBest,
    pageBest,
    totalPagesBest,
    loadingBest,
    categoriesBest,
    getCategoryTitleBest,
  } = useTvShow();

  // Animated import'unun eklendiğinden emin olun
  const [scaleValues, setScaleValues] = useState({});

  useEffect(() => {
    const newScaleValues = {};
    if (seriesBest && seriesBest.length > 0) {
      seriesBest.forEach((item) => {
        newScaleValues[item.id] = new Animated.Value(1);
      });
      setScaleValues(newScaleValues);
    }
  }, [seriesBest]);

  const onPressIn = (itemId) => {
    if (!scaleValues[itemId]) return;
    Animated.timing(scaleValues[itemId], {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (itemId) => {
    if (!scaleValues[itemId]) return;
    Animated.timing(scaleValues[itemId], {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const renderCategory = ({ item }) => (
    <TouchableOpacity
      onPress={() => setSelectedCategoryBest(item)}
      style={[
        styles.categoryItem,
        {
          borderColor:
            selectedCategoryBest === item
              ? theme.text.primary
              : theme.text.muted,
        },
        {
          paddingVertical: 7,
          borderRadius: 13,
          paddingHorizontal: 12,
          backgroundColor: theme.primary,
        },
      ]}
    >
      <Text
        style={[
          styles.categoryText,
          {
            color:
              selectedCategoryBest === item
                ? theme.text.primary
                : theme.text.muted,
          },
        ]}
      >
        {getCategoryTitleBest(item)}
      </Text>
    </TouchableOpacity>
  );
  if (loadingBest) {
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <FlatList
          data={categoriesBest}
          renderItem={renderCategory}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />

        <FlatList
          data={[1, 2, 3, 4, 5, 6, 7, 8, 9]}
          renderItem={() => <MovieUpComingSkeleton />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
        />
        <View
          style={{
            flexDirection: "row",
            gap: 5,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={[styles.genreText, { color: theme.text.muted }]}>
            ●●●
          </Text>
          {pageBest > 5 && (
            <>
              <TouchableOpacity
                onPress={() => setPageBest(pageBest - 5)}
                style={[
                  styles.pageButton,
                  {
                    backgroundColor: theme.secondary,
                  },
                ]}
              >
                <Text style={[styles.genreText, { color: theme.text.primary }]}>
                  {pageBest - 5}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.genreText, { color: theme.text.muted }]}>
                ●
              </Text>
            </>
          )}

          {pageBest > 2 && (
            <TouchableOpacity
              onPress={() => setPageBest(pageBest - 2)}
              style={[
                styles.pageButton,
                {
                  backgroundColor: theme.secondary,
                },
              ]}
            >
              <Text style={[styles.genreText, { color: theme.text.primary }]}>
                {pageBest - 2}
              </Text>
            </TouchableOpacity>
          )}
          {pageBest > 1 && (
            <TouchableOpacity
              onPress={() => setPageBest(pageBest - 1)}
              style={[
                styles.pageButton,
                {
                  backgroundColor: theme.secondary,
                },
              ]}
            >
              <Text style={[styles.genreText, { color: theme.text.primary }]}>
                {pageBest - 1}
              </Text>
            </TouchableOpacity>
          )}
          <Text
            style={[
              styles.genreText,
              {
                color: theme.text.secondary,
                width: 25,
                height: 20,
                textAlign: "center",
              },
            ]}
          >
            {pageBest}
          </Text>
          <TouchableOpacity
            onPress={() => setPageBest(pageBest + 1)}
            style={[
              styles.pageButton,
              {
                backgroundColor: theme.secondary,
              },
            ]}
          >
            <Text style={[styles.genreText, { color: theme.text.primary }]}>
              {pageBest + 1}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPageBest(pageBest + 2)}
            style={[
              styles.pageButton,
              {
                backgroundColor: theme.secondary,
              },
            ]}
          >
            <Text style={[styles.genreText, { color: theme.text.primary }]}>
              {pageBest + 2}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.genreText, { color: theme.text.muted }]}>●</Text>
          <TouchableOpacity
            onPress={() => setPageBest(pageBest + 5)}
            style={[
              styles.pageButton,
              {
                backgroundColor: theme.secondary,
              },
            ]}
          >
            <Text style={[styles.genreText, { color: theme.text.primary }]}>
              {pageBest + 5}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.genreText, { color: theme.text.muted }]}>
            ●●●
          </Text>
        </View>
      </View>
    );
  }
  const renderMovieItem = ({ item }) => {
    const { inWatchList, inFavorites, isWatched, isInOtherLists } =
      useListStatus(item.id, "tv");
    item.poster_path && (
      <TouchableOpacity
        activeOpacity={0.8}
        onPressIn={() => onPressIn(item.id)}
        onPressOut={() => onPressOut(item.id)}
        style={styles.similarItem}
        onPress={() => navigation.push("TvShowsDetails", { id: item.id })}
      >
        <Animated.View
          style={[
            {
              transform: [{ scale: scaleValues[item.id] || 1 }],
            },
          ]}
        >
          <Image
            source={
              item.poster_path
                ? { uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }
                : require("../../assets/image/no_image.png")
            }
            style={[styles.similarPoster, { shadowColor: theme.shadow }]}
          />
          <View
            style={[
              styles.relaseDateCount,
              { backgroundColor: theme.secondaryt },
            ]}
          >
            <Text
              style={[
                styles.similarRatingText,
                { color: theme.text.secondary },
              ]}
            >
              {item.first_air_date}
            </Text>
          </View>
          <View
            style={[styles.relaseDate, { backgroundColor: theme.secondaryt }]}
          >
            <Text
              style={[styles.similarRatingText, { color: theme.colors.orange }]}
            >
              {item.vote_average.toFixed(1)}
            </Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View
        style={{
          paddingLeft: 15,
          justifyContent: "center",
        }}
      >
        <FlatList
          data={categoriesBest}
          renderItem={renderCategory}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.categoriesList,
            { backgroundColor: theme.secondary },
          ]}
        />
      </View>
      <FlatList
        data={seriesBest}
        horizontal
        contentContainerStyle={{ paddingHorizontal: 15 }}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
      />
      <View
        style={{
          flexDirection: "row",
          gap: 5,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={[styles.genreText, { color: theme.text.muted }]}>●●●</Text>
        {pageBest > 1 && (
          <>
            <TouchableOpacity
              onPress={() => setPageBest(1)}
              style={[
                styles.pageButton,
                {
                  backgroundColor: theme.secondary,
                },
              ]}
            >
              <Text style={[styles.genreText, { color: theme.text.primary }]}>
                {1}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.genreText, { color: theme.text.muted }]}>
              ●
            </Text>
          </>
        )}

        {pageBest > 2 && (
          <TouchableOpacity
            onPress={() => setPageBest(pageBest - 2)}
            style={[
              styles.pageButton,
              {
                backgroundColor: theme.secondary,
              },
            ]}
          >
            <Text style={[styles.genreText, { color: theme.text.primary }]}>
              {pageBest - 2}
            </Text>
          </TouchableOpacity>
        )}
        {pageBest > 1 && (
          <TouchableOpacity
            onPress={() => setPageBest(pageBest - 1)}
            style={[
              styles.pageButton,
              {
                backgroundColor: theme.secondary,
              },
            ]}
          >
            <Text style={[styles.genreText, { color: theme.text.primary }]}>
              {pageBest - 1}
            </Text>
          </TouchableOpacity>
        )}
        <Text
          style={[
            styles.genreText,
            {
              color: theme.text.secondary,
              width: 25,
              height: 20,
              textAlign: "center",
            },
          ]}
        >
          {pageBest}
        </Text>
        {pageBest < totalPagesBest - 2 ? (
          <>
            <TouchableOpacity
              onPress={() => setPageBest(pageBest + 1)}
              style={[
                styles.pageButton,
                {
                  backgroundColor: theme.secondary,
                },
              ]}
            >
              <Text style={[styles.genreText, { color: theme.text.primary }]}>
                {pageBest + 1}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPageBest(pageBest + 2)}
              style={[
                styles.pageButton,
                {
                  backgroundColor: theme.secondary,
                },
              ]}
            >
              <Text style={[styles.genreText, { color: theme.text.primary }]}>
                {pageBest + 2}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
        <Text style={[styles.genreText, { color: theme.text.muted }]}>●</Text>
        <TouchableOpacity
          onPress={() => setPageBest(totalPagesBest)}
          style={[
            styles.pageButton,
            {
              backgroundColor: theme.secondary,
            },
          ]}
        >
          <Text style={[styles.genreText, { color: theme.text.primary }]}>
            {totalPagesBest}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.genreText, { color: theme.text.muted }]}>●●●</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  categoriesList: {
    borderRadius: 15,
    paddingVertical: 3,
    paddingHorizontal: 3,
    marginBottom: 10,
    gap: 3,
  },
  categoryItem: {
    paddingVertical: 15,
  },
  pageButton: {
    width: 25,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  genreButton: {
    marginVertical: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  genreText: {
    color: "white",
    fontWeight: "bold",
  },
  dropdown: {
    width: 170,
    height: 30,
    paddingHorizontal: 8,
  },
  icon: {
    marginRight: 10,
  },
  label: {
    position: "absolute",
    backgroundColor: "white",
    left: 22,
    top: 8,
    zIndex: 999,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  placeholderStyle: {
    fontSize: 16,
  },
  selectedTextStyle: {
    fontSize: 16,
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
  },
  similarItem: {
    width: width * 0.4,
    height: width * 0.62,
    marginRight: 10,
    marginBottom: 5,
  },
  similarPoster: {
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
  },
  similarTitle: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 5,
  },
  relaseDate: {
    position: "absolute",
    top: 5,
    right: 5,
    paddingHorizontal: 5,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  relaseDateCount: {
    position: "absolute",
    top: 5,
    left: 5,
    paddingHorizontal: 5,
    //width: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  similarRatingText: {
    color: "#ffd700",
    fontSize: 11,
    marginBottom: 2,
  },
  errorText: {
    color: "red",
    fontSize: 16,
    fontWeight: "bold",
  },
  title: {
    fontSize: 18,
    uppercase: true,
    marginBottom: 15,
    marginLeft: 15,
    fontWeight: "700",
  },
});
