import React, { memo, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  InteractionManager,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import ShareContentScreen from "@screens/tabs/ShareContentScreen";
import SettingsScreen from "@screens/tabs/SettingsScreen";
import AppIcon from "@components/AppIcon";
import ProfileScreen from "@screens/tabs/ProfileScreen";
import MovieScreen from "@screens/tabs/MovieScreen";
import TvShowScreen from "@screens/tabs/TvShowScreen";
import { MovieProvider } from "@context/MovieContex";
import { CalendarProvider } from "@context/CalendarContext";
import { BlurView } from "expo-blur";
import { Screen, ScreenContainer } from "react-native-screens";
import { i18nText } from "@utils/i18nText";
import PetCompanion from "@components/pet/PetCompanion";


const { width } = Dimensions.get("window");
const TAB_NAMES = ["tvshows", "movies", "share", "settings", "profile"];
const BACKGROUND_WARMUP_DELAY = 6000;
const BACKGROUND_WARMUP_STEP = 1200;

const TabItem = memo(({ label, icon, isActive, onPress, theme }) => {
  const scale = useSharedValue(isActive ? 1.2 : 1);
  const opacity = useSharedValue(isActive ? 1 : 0);
  const translateX = useSharedValue(isActive ? 0 : -20);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.2 : 1, { mass: 0.5, damping: 10, stiffness: 150 });
    opacity.value = withTiming(isActive ? 1 : 0, { duration: 150 });
    translateX.value = withTiming(isActive ? 0 : -20, { duration: 150 });
  }, [isActive]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

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
      {isActive ? (
        <Animated.View style={[styles.tabContent, iconStyle]}>
          {icon(20, theme.text.primary)}
          <Animated.Text
            style={[styles.tabText, styles.activeTabText, { color: theme.text.primary }, labelStyle]}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      ) : (
        <Animated.View style={iconStyle}>
          {icon(24, theme.text.secondary)}
        </Animated.View>
      )}
    </TouchableOpacity>
  );
});

function TabScreenNavigator({ navigation, route }) {
  const requestedInitialTab = TAB_NAMES.includes(route?.params?.initialTab)
    ? route.params.initialTab
    : "tvshows";
  const [activeTab, setActiveTab] = useState(requestedInitialTab);
  const [mountedTabs, setMountedTabs] = useState(() => new Set(["tvshows"]));
  const { t, language, toggleLanguage } = useLanguage();
  const { theme } = useTheme();

  useEffect(() => {
    if (!TAB_NAMES.includes(route?.params?.initialTab)) return;
    const nextTab = route.params.initialTab;
    setMountedTabs((current) => new Set(current).add(nextTab));
    setActiveTab(nextTab);
  }, [route?.params?.initialTab]);

  // Ekranlar sadece navigation değişince yeniden oluşturulsun.
      // theme/t/language burada dependency olmamalı — screen'ler kendi içlerinde context'ten alır.
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
    [navigation],
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
      icon: (size, color) => <AppIcon family="Ionicons" name="tv" size={size} color={color} />,
    },
    {
      name: "movies",
      label: t.movies,
      icon: (size, color) => (
        <AppIcon family="MaterialCommunityIcons" name="movie" size={size} color={color} />
      ),
    },
    {
      name: "share",
      label: t.share || i18nText("autoI18n.paylas", "Paylaş"),
      icon: (size, color) => (
        <AppIcon family="Ionicons" name="add-circle-outline" size={size} color={color} />
      ),
    },
    {
      name: "settings",
      label: t.settings,
      icon: (size, color) => (
        <AppIcon family="Ionicons" name="settings" size={size} color={color} />
      ),
    },
    {
      name: "profile",
      label: t.profile,
      icon: (size, color) => (
        <AppIcon family="Ionicons" name="person" size={size} color={color} />
      ),
    },
  ];

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

      <PetCompanion />

      <View style={[styles.bottomTabs]}>
        <View
          style={{
            borderRadius: 40,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <BlurView
            tint="dark"
            intensity={50}
            experimentalBlurMethod="dimezisBlurView" // Android için sihirli kod
            style={[
              styles.tabContainer,
              {
                //backgroundColor: theme.tab,
                shadowColor: theme.shadow,
                //borderWidth: 1,
                //borderColor: theme.border,
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
          </BlurView>
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
  blurContent: {
    borderRadius: 30,
    height: 60,
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
