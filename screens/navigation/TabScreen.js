import React, { memo, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  Animated,
  InteractionManager,
} from "react-native";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import ShareContentScreen from "@screens/tabs/ShareContentScreen";
import SettingsScreen from "@screens/tabs/SettingsScreen";
import Ionicons from "@expo/vector-icons/Ionicons";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Octicons from "@expo/vector-icons/Octicons";
import ProfileScreen from "@screens/tabs/ProfileScreen";
import MovieScreen from "@screens/tabs/MovieScreen";
import TvShowScreen from "@screens/tabs/TvShowScreen";
import { MovieProvider } from "@context/MovieContex";
import { CalendarProvider } from "@context/CalendarContext";
import { Screen, ScreenContainer } from "react-native-screens";
import { i18nText } from "@utils/i18nText";

const { width } = Dimensions.get("window");
const TAB_NAMES = ["tvshows", "movies", "share", "settings", "profile"];
const BACKGROUND_WARMUP_DELAY = 6000;
const BACKGROUND_WARMUP_STEP = 1200;

function TabScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("tvshows");
  const [mountedTabs, setMountedTabs] = useState(() => new Set(["tvshows"]));
  const { t, language, toggleLanguage } = useLanguage();
  const { theme } = useTheme();
  // Ekranları memoize edelim
  const screens = useMemo(
    () => ({
      tvshows: <TvShowScreen navigation={navigation} />,
      movies: (
        <MovieProvider>
          <MovieScreen navigation={navigation} />
        </MovieProvider>
      ),
      share: <ShareContentScreen navigation={navigation} />,
      settings: <SettingsScreen navigation={navigation} />,
      profile: (
        <CalendarProvider>
          <ProfileScreen navigation={navigation} />
        </CalendarProvider>
      ),
    }),
    [navigation]
  );

  useEffect(() => {
    const timers = [];
    const task = InteractionManager.runAfterInteractions(() => {
      TAB_NAMES.filter((name) => name !== "tvshows").forEach((name, index) => {
        const timer = setTimeout(() => {
          setMountedTabs((current) => {
            if (current.has(name)) return current;
            const next = new Set(current);
            next.add(name);
            return next;
          });
        }, BACKGROUND_WARMUP_DELAY + BACKGROUND_WARMUP_STEP * index);
        timers.push(timer);
      });
    });

    return () => {
      task.cancel?.();
      timers.forEach(clearTimeout);
    };
  }, []);

  const tabs = [
    {
      name: "tvshows",
      label: t.tvShows,
      icon: (size, color) => <Feather name="tv" size={size} color={color} />,
    },
    {
      name: "movies",
      label: t.movies,
      icon: (size, color) => (
        <MaterialCommunityIcons name="movie-outline" size={size} color={color} />
      ),
    },
    {
      name: "share",
      label: t.share || i18nText("autoI18n.paylas", "Paylaş"),
      icon: (size, color) => (
        <Feather name="plus-square" size={size} color={color} />
      ),
    },
    {
      name: "settings",
      label: t.settings,
      icon: (size, color) => (
        <Ionicons name="settings-outline" size={size} color={color} />
      ),
    },
    {
      name: "profile",
      label: t.profile,
      icon: (size, color) => (
        <Ionicons name="person-outline" size={size} color={color} />
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
          isActive && [styles.activeTab, { backgroundColor: theme.primary }],
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
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
  const handleTabPress = (index, name) => {
    setMountedTabs((current) => {
      if (current.has(name)) return current;
      const next = new Set(current);
      next.add(name);
      return next;
    });
    setActiveTab(name);
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
      <ScreenContainer style={styles.screenSlot} hasTwoStates>
        {TAB_NAMES.map((name) => {
          if (!mountedTabs.has(name)) return null;
          const isActive = activeTab === name;

          return (
            <Screen
              key={name}
              activityState={isActive ? 2 : 0}
              freezeOnBlur
              shouldFreeze={!isActive}
              style={styles.screen}
            >
              {screens[name]}
            </Screen>
          );
        })}
      </ScreenContainer>

      <View style={[styles.bottomTabs]}>
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
  screenSlot: {
    flex: 1,
  },
  screen: {
    ...StyleSheet.absoluteFillObject,
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
});

export default TabScreen;
