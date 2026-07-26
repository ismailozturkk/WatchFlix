import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Animated,
  Easing,
  Keyboard,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import AppIcon from "../../components/AppIcon";
import IconBacground from "../../components/IconBacground";
import MovieSearch from "../search/MovieSearch";
import TvShowSearch from "../search/TvShowSearch";
import ActorSearch from "../search/ActorSearch";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/BackButton";
import { useFocusEffect } from "@react-navigation/native";
import { i18nText } from "../../utils/i18nText";


const LayoutToggle = React.memo(({ viewMode, onToggle, theme }) => {
  const anim = useRef(new Animated.Value(viewMode === "grid" ? 1 : 0)).current;

  const toggle = useCallback(() => {
    const next = viewMode === "row" ? "grid" : "row";
    Animated.spring(anim, {
      toValue: next === "grid" ? 1 : 0,
      speed: 18,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
    onToggle(next);
  }, [viewMode, onToggle]);

  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.7}
      style={[styles.layoutToggleBtn, { backgroundColor: theme.secondary }]}
    >
      <AppIcon
        family="Ionicons"
        name={viewMode === "row" ? "grid-outline" : "list-outline"}
        size={22}
        color={theme.text?.primary ?? "#fff"}
      />
    </TouchableOpacity>
  );
});

export default function SearchScreen({ navigation, route }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const searchOrigin = route?.params?.searchOrigin;
  const hasSearchOrigin =
    searchOrigin &&
    [searchOrigin.x, searchOrigin.y, searchOrigin.width, searchOrigin.height].every(
      Number.isFinite,
    ) &&
    searchOrigin.width > 0 &&
    searchOrigin.height > 0;

  // Route'dan gelen initialType varsa al (örn: ana ekrandan "movie" veya "tv" tıklandıysa)
  const initialType = route?.params?.initialType || "movie";

  const [activeTab, setActiveTab] = useState(initialType);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("row");
  const inputRef = useRef(null);

  // Genişleme animasyonu bitti mi? Bittiğinde kabuk sabit ölçü yerine
  // absoluteFill'e geçer; edge-to-edge'de kökün gerçek yüksekliği pencere
  // yüksekliğinden büyük olduğu için (navigasyon çubuğu şeridi) aksi halde
  // altta boyanmamış bir bant kalır ve transparentModal'ın altındaki ekran görünür.
  const [expandDone, setExpandDone] = useState(!hasSearchOrigin);

  // Kabuğun hedef ölçüsü kökün ölçülen layout'undan gelir; useWindowDimensions
  // Android'de navigasyon çubuğunu hariç tutar.
  const [rootSize, setRootSize] = useState(null);
  const onRootLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    setRootSize((prev) =>
      prev && prev.width === width && prev.height === height
        ? prev
        : { width, height },
    );
  }, []);
  const targetWidth = rootSize?.width ?? screenWidth;
  const targetHeight = rootSize?.height ?? screenHeight;

  const searchBarAnim = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(hasSearchOrigin ? 0 : 1)).current;
  const contentRevealAnim = useRef(
    new Animated.Value(hasSearchOrigin ? 0 : 1),
  ).current;

  useFocusEffect(
    useCallback(() => {
      if (route?.params?.autoFocus) {
        setTimeout(() => inputRef.current?.focus(), hasSearchOrigin ? 320 : 100);
      }
      if (route?.params?.initialType) {
        setActiveTab(route.params.initialType);
      }
    }, [hasSearchOrigin, route?.params])
  );

  useEffect(() => {
    const animations = [
      Animated.timing(searchBarAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ];

    if (hasSearchOrigin) {
      animations.push(
        Animated.timing(expandAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(contentRevealAnim, {
          toValue: 1,
          delay: 100,
          duration: 180,
          useNativeDriver: true,
        }),
      );
    }

    let cancelled = false;
    Animated.parallel(animations).start(() => {
      if (!cancelled) setExpandDone(true);
    });

    return () => {
      cancelled = true;
    };
  }, [contentRevealAnim, expandAnim, hasSearchOrigin, searchBarAnim]);

  const searchBarStyle = {
    opacity: searchBarAnim,
    transform: [
      {
        translateY: searchBarAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  const tabs = [
    {
      id: "movie",
      label: t.SearchScreen?.searchMovies ?? i18nText("autoI18n.film", "Film"),
      icon: (color) => <AppIcon family="MaterialCommunityIcons" name="movie-outline" size={20} color={color} />,
    },
    {
      id: "tv",
      label: t.SearchScreen?.searchTvShows ?? i18nText("autoI18n.dizi", "Dizi"),
      icon: (color) => <AppIcon family="Feather" name="tv" size={18} color={color} />,
    },
    {
      id: "actor",
      label: t.SearchScreen?.searchActrist ?? "Oyuncu",
      icon: (color) => <AppIcon family="Feather" name="user" size={18} color={color} />,
    },
  ];

  const expandingShellStyle =
    hasSearchOrigin && !expandDone
      ? {
          top: expandAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [searchOrigin.y, 0],
          }),
          left: expandAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [searchOrigin.x, 0],
          }),
          width: expandAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [searchOrigin.width, targetWidth],
          }),
          height: expandAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [searchOrigin.height, targetHeight],
          }),
          borderRadius: expandAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [10, 0],
          }),
        }
      : StyleSheet.absoluteFillObject;

  return (
    <View style={styles.transitionRoot} onLayout={onRootLayout}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.expandingShell,
          { backgroundColor: theme.primary },
          expandingShellStyle,
        ]}
      />
      <Animated.View
        style={[styles.animatedContent, { opacity: contentRevealAnim }]}
      >
        <SafeAreaView style={styles.container} edges={['top']}>
          <IconBacground opacity={0.3} />

      {/* ── Arama Kutusu ──────────────────────────────────────── */}
      <Animated.View style={[styles.searchContainer, searchBarStyle]}>
        <BackButton absolute={false} style={{ alignSelf: "center" }} />
        <View style={[styles.searchBar, { backgroundColor: theme.secondary }]}>
          <AppIcon
            family="Ionicons"
            name="search"
            size={20}
            color={theme.text?.muted ?? "#666"}
            style={{ marginRight: 8 }}
          />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: theme.text?.primary ?? "#fff" }]}
            placeholder={
              activeTab === "movie"
                ? (t.SearchScreen?.searchMovies ?? "Film ara...")
                : activeTab === "tv"
                ? (t.SearchScreen?.searchTvShows ?? "Dizi ara...")
                : (t.SearchScreen?.searchActrist ?? "Oyuncu ara...")
            }
            placeholderTextColor={theme.text?.muted ?? "#666"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            maxLength={80}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon
                family="Ionicons"
                name="close-circle"
                size={22}
                color={theme.text?.muted ?? "#666"}
              />
            </TouchableOpacity>
          )}
        </View>
        <LayoutToggle
          viewMode={viewMode}
          onToggle={setViewMode}
          theme={theme}
        />
      </Animated.View>

      {/* ── Kategori Seçici (Tab Bar) ──────────────────────────────────────── */}
      <Animated.View style={[styles.tabsContainer, searchBarStyle]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.7}
              onPress={() => setActiveTab(tab.id)}
              style={[
                styles.tabButton,
                isActive && { backgroundColor: theme.text?.primary ?? "#fff" },
                !isActive && { backgroundColor: theme.secondary },
              ]}
            >
              {tab.icon(isActive ? theme.primary : (theme.text?.primary ?? "#fff"))}
              <Text
                style={[
                  styles.tabLabel,
                  isActive && { color: theme.primary, fontWeight: "700" },
                  !isActive && { color: theme.text?.primary ?? "#fff" },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </Animated.View>

      {/* ── İçerik ──────────────────────────────────────── */}
          <View style={styles.contentContainer}>
        {activeTab === "movie" && (
          <MovieSearch
            navigation={navigation}
            route={route}
            isUnified={true}
            unifiedQuery={searchQuery}
            unifiedViewMode={viewMode}
          />
        )}
        {activeTab === "tv" && (
          <TvShowSearch
            navigation={navigation}
            route={route}
            isUnified={true}
            unifiedQuery={searchQuery}
            unifiedViewMode={viewMode}
          />
        )}
        {activeTab === "actor" && (
          <ActorSearch
            navigation={navigation}
            route={route}
            isUnified={true}
            unifiedQuery={searchQuery}
            unifiedViewMode={viewMode}
          />
        )}
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  transitionRoot: {
    flex: 1,
    backgroundColor: "transparent",
  },
  expandingShell: {
    position: "absolute",
    overflow: "hidden",
  },
  animatedContent: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 10,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 16,
    minHeight: 50,
  },
  layoutToggleBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  contentContainer: {
    flex: 1,
  },
});
