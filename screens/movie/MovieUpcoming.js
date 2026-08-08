import React, { memo, useEffect, useRef } from "react";
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  View,
  Dimensions,
  Animated,
} from "react-native";
import PosterImage from "../../components/PosterImage";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
import { Dropdown } from "react-native-element-dropdown";
import { useFontFamilyForRole } from "../../components/typography/AppText";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MovieUpComingSkeleton } from "../../components/Skeleton";
import PaginatedRail from "../../components/PaginatedRail";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
//import { API_KEY } from "@env";
import { useImageQualitySettings, useListLayoutSettings } from "../../context/AppSettingsContext";
import { useMovie } from "../../context/MovieContex";
import ListBadges from "../../components/ListBadges";
import { CountdownBadge, ReleaseDateBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
import { i18nText } from "../../utils/i18nText";

const { width } = Dimensions.get("window");

// Stable, module-scope item component → no remount → no flicker.
const MovieUpcomingCard = memo(function MovieUpcomingCard({ item, navigation, theme, getTmdbUrl, RelaseCount }) {
  const rp = useRailPosterStyle();
  const { posterBadges } = useListLayoutSettings();
  const { openQuickActions } = useMediaQuickActions();
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.9, duration: 200, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }).start();

  return (
    <TouchableOpacity
      style={[styles.similarItem, { width: rp.itemWidth, height: rp.itemHeight }]}
      activeOpacity={0.8}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => navigation.push("MovieDetails", { id: item.id })}
      onLongPress={() =>
        openQuickActions({ item, mediaType: "movie", navigation })
      }
      delayLongPress={350}
    >
      <Animated.View style={[{ transform: [{ scale }] }]}>
        <PosterImage
          path={item.poster_path}
          type="movie"
          size={200}
          style={[
            styles.similarPoster,
            { width: rp.posterWidth, height: rp.posterHeight, borderRadius: rp.radius, shadowColor: theme.shadow },
          ]}
          cachePolicy="memory-disk"
          recyclingKey={`movieupcoming-${item.id}`}
          transition={120}
        />

        {posterBadges?.countdown !== false && (
          <CountdownBadge date={item.release_date} style={POSTER_BADGE_POS.topLeft} />
        )}
        {posterBadges?.releaseDate !== false && (
          <ReleaseDateBadge date={item.release_date} style={POSTER_BADGE_POS.topRight} />
        )}
        <ListBadges
          mediaId={item.id}
          mediaType="movie"
          theme={theme}
          style={{ position: "absolute", left: 2, bottom: 8 }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function MovieUpcoming({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // react-native-element-dropdown metnini node_modules içinde çizer; font
  // ancak stil nesnesine düz bir aile adı yazılarak uygulanır. Aile adı doğru
  // ağırlık dosyasını gösterdiği için fontWeight'i 400'e sabitliyoruz.
  const dropdownFontu = useFontFamilyForRole("body", { fontWeight: "500" });
  const dropdownFontStili = dropdownFontu
    ? { fontFamily: dropdownFontu, fontWeight: "400" }
    : null;
  const {
    dateData,
    addTimeToDate,
    moviesUpcoming,
    loadingUpcoming,
    isFocusUpcoming,
    setValueUpcoming,
    pageUpcoming,
    totalPagesUpcoming,
    loadMoreUpcoming,
    loadingMoreUpcoming,
    setIsFocusUpcoming,
    valueUpcoming,
    RelaseCount,
    activateMovieSection,
  } = useMovie();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();

  useEffect(() => {
    activateMovieSection("upcoming");
  }, [activateMovieSection]);

  if (loadingUpcoming) {
    return (
      <View style={{ flex: 1, paddingVertical: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text
            allowFontScaling={false}
            style={[styles.title, { color: theme.text.secondary }]}
          >
            {t.movieScreens.movieUpcaming.upcaming}
          </Text>
          <Dropdown
            style={[
              styles.dropdown,
              isFocusUpcoming && { borderColor: "blue" },
            ]}
            placeholderStyle={[
              styles.placeholderStyle,
              { color: theme.text.primary },
              dropdownFontStili,
            ]}
            selectedTextStyle={[
              styles.selectedTextStyle,
              { color: theme.text.secondary },
              dropdownFontStili,
            ]}
            // RENK BİLEREK VERİLMİYOR: açılan listenin kabı kütüphanede sabit
            // BEYAZ (react-native-element-dropdown styles.container) ve bu ekran
            // containerStyle geçmiyor. Tema metin rengi (açık gri/mavi) beyaz
            // zeminde okunmuyor; kütüphanenin siyah varsayılanı kalsın.
            itemTextStyle={[styles.selectedTextStyle, dropdownFontStili]}
            iconStyle={styles.iconStyle}
            data={dateData}
            maxHeight={200}
            labelField="label"
            valueField="value"
            placeholder={!isFocusUpcoming ? i18nText("autoI18n.tarih_secin", "Tarih Seçin") : "..."}
            value={valueUpcoming}
            onFocus={() => setIsFocusUpcoming(true)}
            onBlur={() => setIsFocusUpcoming(false)}
            onChange={(item) => {
              setValueUpcoming(item.value);
              addTimeToDate(item.value);
              setIsFocusUpcoming(false);
            }}
            renderLeftIcon={() => (
              <Ionicons
                name="calendar"
                style={styles.icon}
                color={
                  isFocusUpcoming ? theme.text.primary : theme.text.secondary
                }
                size={20}
              />
            )}
          />
        </View>

        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <MovieUpComingSkeleton />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
        />
      </View>
    );
  }
  const renderMovieItem = ({ item }) => {
    if (!item.poster_path) return null;
    return (
      <MovieUpcomingCard
        item={item}
        navigation={navigation}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        RelaseCount={RelaseCount}
      />
    );
  };
  return (
    <View style={styles.container}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text
          allowFontScaling={false}
          style={[styles.title, { color: theme.text.secondary }]}
        >
          {t.movieScreens.movieUpcaming.upcaming}
        </Text>
        <Dropdown
          style={[styles.dropdown, isFocusUpcoming && { borderColor: "blue" }]}
          placeholderStyle={[
            styles.placeholderStyle,
            { color: theme.text.primary },
            dropdownFontStili,
          ]}
          selectedTextStyle={[
            styles.selectedTextStyle,
            { color: theme.text.secondary },
            dropdownFontStili,
          ]}
          // Renk için yukarıdaki nota bak: liste kabı kütüphanede sabit beyaz.
          itemTextStyle={[styles.selectedTextStyle, dropdownFontStili]}
          iconStyle={styles.iconStyle}
          data={dateData}
          maxHeight={200}
          labelField="label"
          valueField="value"
          placeholder={!isFocusUpcoming ? i18nText("autoI18n.tarih_secin", "Tarih Seçin") : "..."}
          value={valueUpcoming}
          onFocus={() => setIsFocusUpcoming(true)}
          onBlur={() => setIsFocusUpcoming(false)}
          onChange={(item) => {
            setValueUpcoming(item.value);
            addTimeToDate(item.value);
            setIsFocusUpcoming(false);
          }}
          renderLeftIcon={() => (
            <Ionicons
              name="calendar"
              style={styles.icon}
              color={
                isFocusUpcoming ? theme.text.primary : theme.text.secondary
              }
              size={20}
            />
          )}
        />
      </View>
      <PaginatedRail
        data={moviesUpcoming}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMovieItem}
        onLoadMore={loadMoreUpcoming}
        loadingMore={loadingMoreUpcoming}
        hasMore={pageUpcoming < totalPagesUpcoming}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={80}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
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
