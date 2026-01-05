import React, { memo, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  Animated,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import SearchScreen from "./tabs/SearchScreen";
import SettingsScreen from "./tabs/SettingsScreen";
import Ionicons from "@expo/vector-icons/Ionicons";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Octicons from "@expo/vector-icons/Octicons";
import ProfileScreen from "./tabs/ProfileScreen";
import MovieScreen from "./tabs/MovieScreen";
import TvShowScreen from "./tabs/TvShowScreen";
import PagerView from "react-native-pager-view";
import { useAuth } from "../context/AuthContext";
import { useProfileScreen } from "../context/ProfileScreenContext";
import { LinearGradient } from "expo-linear-gradient";
import { FontAwesome } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
const { width } = Dimensions.get("window");

function TabScreenNavigator({ navigation }) {
  const [activeTab, setActiveTab] = useState("tvshows");
  const { t, language, toggleLanguage } = useLanguage();
  const { theme } = useTheme();
  // Ekranları memoize edelim
  const screens = useMemo(
    () => ({
      tvshows: <TvShowScreen navigation={navigation} />,
      movies: <MovieScreen navigation={navigation} />,
      search: <SearchScreen navigation={navigation} />,
      settings: <SettingsScreen navigation={navigation} />,
      profile: <ProfileScreen navigation={navigation} />,
    }),
    [navigation, theme, t, language]
  );

  // renderScreen fonksiyonunu basitleştirelim
  const renderScreen = () => screens[activeTab];

  const tabs = [
    {
      name: "tvshows",
      label: t.tvShows,
      icon: (size, color) => <Ionicons name="tv" size={size} color={color} />,
    },
    {
      name: "movies",
      label: t.movies,
      icon: (size, color) => (
        <MaterialCommunityIcons name="movie" size={size} color={color} />
      ),
    },
    {
      name: "search",
      label: t.search,
      icon: (size, color) => (
        <FontAwesome name="search" size={size} color={color} />
      ),
    },
    {
      name: "settings",
      label: t.settings,
      icon: (size, color) => (
        <Ionicons name="settings" size={size} color={color} />
      ),
    },
    {
      name: "profile",
      label: t.profile,
      icon: (size, color) => (
        <Ionicons name="person" size={size} color={color} />
      ),
    },
  ];

  const TabItem = memo(({ name, label, icon, isActive, onPress, theme }) => {
    // Animasyon değerleri
    const [scaleAnim] = useState(new Animated.Value(1));
    const [labelWidth] = useState(new Animated.Value(0));

    useEffect(() => {
      const animations = [];

      if (isActive) {
        animations.push(
          Animated.spring(scaleAnim, {
            toValue: 1.2,
            friction: 3,
            useNativeDriver: true,
          }),
          Animated.timing(labelWidth, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          })
        );
      } else {
        animations.push(
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            useNativeDriver: true,
          }),
          Animated.timing(labelWidth, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          })
        );
      }

      Animated.parallel(animations).start();
    }, [isActive]);

    return (
      <TouchableOpacity
        style={[
          styles.tab,
          isActive && [
            styles.activeTab,
            {
              backgroundColor: theme.primary,
              borderBottomWidth: 2,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderTopWidth: 0,

              borderTopColor: theme.primary,
              borderRightColor: theme.primary,
              borderLeftColor: theme.primary,
              borderBottomColor: theme.accent,
            },
          ],
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* {isActive && (
          <LinearGradient
            colors={["transparent", "transparent", theme.accent]}
            style={[styles.positionStyle, { zIndex: 9999999999 }]}
          />
        )} */}
        {isActive ? (
          <Animated.View
            style={[
              styles.tabContent,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {icon(20, theme.text.primary)}
            <Animated.Text
              style={[
                styles.tabText,
                styles.activeTabText,
                {
                  color: theme.text.primary,
                  opacity: labelWidth,
                  transform: [
                    {
                      translateX: labelWidth.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {label}
            </Animated.Text>
          </Animated.View>
        ) : (
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            {icon(24, theme.text.muted)}
          </Animated.View>
        )}
      </TouchableOpacity>
    );
  });
  const pagerRef = React.useRef(null);

  const handleTabPress = (index, name) => {
    setActiveTab(name);
    pagerRef.current?.setPage(index); // animasyonlu kaydır
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      {false && activeTab !== "settings" && (
        <TouchableOpacity
          style={[styles.languageButton, { backgroundColor: theme.secondary }]}
          onPress={() => {
            toggleLanguage(language === "tr" ? "en" : "tr");
          }}
        >
          <Text
            style={[styles.languageButtonText, { color: theme.text.primary }]}
          >
            {language.toUpperCase()}
          </Text>
        </TouchableOpacity>
      )}
      <PagerView
        style={{ flex: 1 }}
        initialPage={0}
        scrollEnabled={false} // elle swipe kapatabilirsin
        ref={pagerRef}
        overdrag={true}
        overScrollMode="auto"
        nestedScrollEnabled={true}
        onPageSelected={(e) => {
          const pageIndex = e.nativeEvent.position;
          setActiveTab(tabs[pageIndex].name);
        }}
      >
        <View key="1">{screens.tvshows}</View>
        <View key="2">{screens.movies}</View>
        <View key="3">{screens.search}</View>
        <View key="4">{screens.settings}</View>
        <View key="5">{screens.profile}</View>
      </PagerView>

      <View style={[styles.bottomTabs]}>
        <BlurView
          intensity={50}
          tint={theme.mode === "dark" ? "dark" : "light"}
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 30,
            },
          ]}
        />
        <View
          style={[
            styles.tabContainer,
            {
              backgroundColor: theme.tab,
              shadowColor: theme.shadow,
              borderWidth: 1,
              borderColor: theme.border,

              shadowOffset: {
                width: 0,
                height: 8,
              },
              shadowOpacity: 0.94,
              shadowRadius: 10.32,
              elevation: 5,
            },
          ]}
        >
          {tabs.map((tab, index) => (
            <TabItem
              key={tab.name}
              name={tab.name}
              label={tab.label}
              icon={tab.icon}
              isActive={activeTab === tab.name}
              onPress={() => handleTabPress(index, tab.name)}
              theme={theme}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  languageButton: {
    position: "absolute",
    top: 40,
    right: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1,
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  bottomTabs: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
    backfaceVisibility: "hidden",
  },
  tabContainer: {
    flexDirection: "row",
    borderRadius: 30,
    padding: 10,
    width: width * 0.9,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    transform: [{ perspective: 1000 }],
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeTab: {
    flex: 2,
    backgroundColor: "rgb(0, 122, 184)",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
  },
  activeTabText: {
    fontSize: 12,
  },
  tabContent: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  positionStyle: {
    position: "absolute",
    top: 20,
    bottom: 0,
    left: 15,
    right: 15,
  },
});

export default TabScreenNavigator;
