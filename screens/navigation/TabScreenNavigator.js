import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  InteractionManager,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import HubScreen from "@screens/tabs/HubScreen";
import SettingsScreen from "@screens/tabs/SettingsScreen";
import AppIcon from "@components/AppIcon";
import ProfileScreen from "@screens/tabs/ProfileScreen";
import MovieScreen from "@screens/tabs/MovieScreen";
import TvShowScreen from "@screens/tabs/TvShowScreen";
import { MovieProvider } from "@context/MovieContex";
import { CalendarProvider } from "@context/CalendarContext";
import AdaptiveBlurView from "../../components/common/AdaptiveBlurView";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, ScreenContainer } from "react-native-screens";
import PetCompanion from "@components/pet/PetCompanion";
import { alpha } from "../../theme/colors";

const TAB_NAMES = ["tvshows", "movies", "share", "settings", "profile"];
const BACKGROUND_WARMUP_DELAY = 6000;
const BACKGROUND_WARMUP_STEP = 1200;
const TAB_SPRING = { mass: 0.55, damping: 15, stiffness: 190 };

const TabItem = memo(({ name, label, icon, isActive, onPress, theme }) => {
  const activeProgress = useSharedValue(isActive ? 1 : 0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    activeProgress.value = withSpring(isActive ? 1 : 0, TAB_SPRING);
  }, [isActive]);

  const motionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -1 * activeProgress.value },
      { scale: pressScale.value },
    ],
  }));

  const activeSurfaceStyle = useAnimatedStyle(() => ({
    opacity: activeProgress.value,
    transform: [{ scale: 0.82 + activeProgress.value * 0.18 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -4 * activeProgress.value },
      { scale: 1 + activeProgress.value * 0.05 },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: activeProgress.value,
    transform: [{ translateY: 4 * (1 - activeProgress.value) }],
  }));

  return (
    <TouchableOpacity
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
      style={styles.tab}
      onPress={() => onPress(name)}
      onPressIn={() => {
        pressScale.value = withSpring(0.9, TAB_SPRING);
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, TAB_SPRING);
      }}
      activeOpacity={1}
    >
      <Animated.View style={[styles.tabMotion, motionStyle]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeSurface,
            { borderColor: alpha(theme.accent, 0.52) },
            activeSurfaceStyle,
          ]}
        >
          <LinearGradient
            colors={[
              alpha(theme.accent, 0.74),
              alpha(theme.accent, 0.5),
              alpha(theme.bold || theme.accent, 0.26),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={[styles.iconWrap, iconStyle]}>
          {icon(
            isActive ? 20 : 22,
            isActive ? "#FFFFFF" : theme.text.secondary
          )}
        </Animated.View>

        <Animated.Text
          numberOfLines={1}
          style={[styles.tabText, { color: "#FFFFFF" }, labelStyle]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

function TabScreenNavigator({ navigation, route }) {
  const requestedInitialTab = TAB_NAMES.includes(route?.params?.initialTab)
    ? route.params.initialTab
    : "tvshows";
  const [activeTab, setActiveTab] = useState(requestedInitialTab);
  // İstenen sekme baştan mount edilmeli; yoksa initialTab ile açılışta ilk
  // kare boş kalır (aktif sekme mount listesinde olmaz, effect sonradan ekler).
  const [mountedTabs, setMountedTabs] = useState(
    () => new Set(["tvshows", requestedInitialTab])
  );
  const { t, language, toggleLanguage } = useLanguage();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const tabBarWidth = Math.min(windowWidth - 80, 340);

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
      share: <HubScreen navigation={navigation} />,
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

  // useMemo: her render'da yeni icon closure'ları üretilirse memo'lu TabItem'lar
  // boşuna yeniden render olur (özellikle warmup'ta mountedTabs 4 kez değişirken).
  const tabs = useMemo(
    () => [
      {
        name: "tvshows",
        label: t.tvShows,
        icon: (size, color) => (
          <AppIcon family="Ionicons" name="tv" size={size} color={color} />
        ),
      },
      {
        name: "movies",
        label: t.movies,
        icon: (size, color) => (
          <AppIcon
            family="MaterialCommunityIcons"
            name="movie"
            size={size}
            color={color}
          />
        ),
      },
      {
        name: "share",
        label: t.hub || "Hub",
        icon: (size, color) => (
          <AppIcon
            family="Ionicons"
            name="apps-outline"
            size={size}
            color={color}
          />
        ),
      },
      {
        name: "settings",
        label: t.settings,
        icon: (size, color) => (
          <AppIcon
            family="Ionicons"
            name="settings"
            size={size}
            color={color}
          />
        ),
      },
      {
        name: "profile",
        label: t.profile,
        icon: (size, color) => (
          <AppIcon family="Ionicons" name="person" size={size} color={color} />
        ),
      },
    ],
    [t]
  );

  // useCallback: memo'lu TabItem'lara stabil referans gitsin — böylece tab
  // değişiminde yalnız aktifliği değişen iki öğe yeniden render olur.
  const handleTabPress = useCallback((name) => {
    setMountedTabs((current) => {
      if (current.has(name)) return current;
      const next = new Set(current);
      next.add(name);
      return next;
    });
    setActiveTab(name);
  }, []);

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

      <View
        pointerEvents="box-none"
        style={[styles.bottomTabs, { bottom: Math.max(10, insets.bottom + 6) }]}
      >
        <View
          style={[
            styles.tabShadow,
            {
              width: tabBarWidth,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View
            style={styles.tabClip}
          >
            {/* Sekme çubuğu içerik ÜSTÜNDE yüzer: blur kalktığında arkadaki
                posterler net göründüğü için etiketler okunamaz hale gelirdi.
                Düşük katmanda bu yüzden tema yüzeyini neredeyse opak
                (0.82 + üstteki 0.34'lük katman) çiziyoruz. */}
            <AdaptiveBlurView
              tint="dark"
              intensity={40}
              experimentalBlurMethod="dimezisBlurView"
              fallbackColor={theme.tab || theme.secondary}
              fallbackAlpha={0.82}
              style={styles.tabContainer}
            >
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: alpha(theme.tab || theme.secondary, 0.34),
                  },
                ]}
              />
              {tabs.map((tab) => (
                <TabItem
                  key={tab.name}
                  name={tab.name}
                  label={tab.label}
                  icon={tab.icon}
                  isActive={activeTab === tab.name}
                  onPress={handleTabPress}
                  theme={theme}
                />
              ))}
            </AdaptiveBlurView>
          </View>
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
    left: 0,
    right: 0,
    alignItems: "center",
    backfaceVisibility: "hidden",
    zIndex: 20,
  },
  tabShadow: {
    borderRadius: 28,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 12,
  },
  tabClip: {
    height: 60,
    borderRadius: 28,
    overflow: "hidden",
  },
  tabContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 3,
    paddingVertical: 4,
  },
  tab: {
    flex: 1,
    height: 52,
    paddingHorizontal: 2,
  },
  tabMotion: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activeSurface: {
    position: "absolute",
    top: 3,
    right: 2,
    bottom: 3,
    left: 2,
    borderRadius: 23,
    borderWidth: 1,
    overflow: "hidden",
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    position: "absolute",
    right: 3,
    bottom: 5,
    left: 3,
    fontSize: 8,
    lineHeight: 9,
    fontWeight: "800",
    letterSpacing: -0.1,
    textAlign: "center",
  },
});

export default TabScreenNavigator;
