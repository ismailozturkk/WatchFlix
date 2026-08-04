import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  withSequence,
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

// Sıradaki artık sekme DEĞİL: içerik yalnız diziye dayandığı için film izleyen
// ve yeni kullanıcılarda sekme sürekli boş kalıyordu. Yapı, TV ana ekranındaki
// "Devam Eden Dizilerim" rayına taşındı (screens/tv/TvOngoingSection); tam
// liste oradaki "Tümü" düğmesinden UpNextScreen olarak açılıyor.
const TAB_NAMES = ["tvshows", "movies", "share", "settings", "profile"];
const BACKGROUND_WARMUP_DELAY = 6000;
const BACKGROUND_WARMUP_STEP = 1200;
const TAB_SPRING = { mass: 0.55, damping: 15, stiffness: 190 };
// İkon yayı bilerek daha az sönümlü: aşım, sekme değişiminde ikona küçük bir
// "pop" veriyor. Ayrı bir ayar çünkü göstergenin kayışı sakin kalmalı.
const ICON_SPRING = { mass: 0.5, damping: 11, stiffness: 240 };
const INDICATOR_SPRING = { mass: 0.6, damping: 17, stiffness: 210 };
const TAB_ICON_SIZE = 24;
// Çubuğun tüm ölçüsü bu sabitlerden türüyor:
//   • daire çapı  = yükseklik − 2×iç boşluk
//   • yuva        = daire + sekmeler arası boşluk
//   • köşe        = yükseklik / 2 → uçlar tam yarım daire (hap biçimi)
//
// İç boşluk 5'e çıkarken YÜKSEKLİK de büyütüldü: 50'de kalsaydı daire 46'dan
// 40'a düşecek, bir önceki adımda büyütülen ikon/daire oranı geri gidecekti.
// Yuvaya boşluk eklenince baştaki/sondaki daire çubuğun yuvarlak ucundan
// boşluğun yarısı kadar (3px) içeride kalır — hap biçimi bunu doğal gösterir.
const TAB_BAR_HEIGHT = 56;
const TAB_BAR_PADDING = 5;
const TAB_SLOT_GAP = 6;
const INDICATOR_SIZE = TAB_BAR_HEIGHT - TAB_BAR_PADDING * 2;
const TAB_BAR_RADIUS = TAB_BAR_HEIGHT / 2;
const TAB_BAR_NATURAL_WIDTH =
  (INDICATOR_SIZE + TAB_SLOT_GAP) * TAB_NAMES.length + TAB_BAR_PADDING * 2;

const TabItem = memo(({ name, label, icon, isActive, onPress, theme }) => {
  const activeProgress = useSharedValue(isActive ? 1 : 0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    activeProgress.value = withSpring(isActive ? 1 : 0, ICON_SPRING);
  }, [isActive]);

  const motionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + activeProgress.value * 0.12 }],
  }));

  // Renk geçişi iki ikon kopyasının çapraz sönümlemesiyle yapılıyor: vektör
  // ikon rengi worklet'ten animasyonlanamıyor, anlık renk sıçraması ise kayan
  // göstergenin ortasında göze batıyordu. Yay aşabildiği için opaklık kırpılır.
  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, activeProgress.value)),
  }));
  const idleIconStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, 1 - activeProgress.value)),
  }));

  return (
    <TouchableOpacity
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
      style={styles.tab}
      onPress={() => onPress(name)}
      onPressIn={() => {
        pressScale.value = withSpring(0.88, TAB_SPRING);
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, TAB_SPRING);
      }}
      activeOpacity={1}
    >
      {/* Etiket YOK: adlar `accessibilityLabel` ile ekran okuyucuya kalıyor,
          çubuk yalnız ikonlarla çalışıyor. Aktif yüzey de burada değil —
          sekmeler arasında KAYAN tek bir gösterge olarak çubukta duruyor. */}
      <Animated.View style={[styles.tabMotion, motionStyle]}>
        <Animated.View style={[styles.iconWrap, iconStyle]}>
          <Animated.View style={[styles.iconLayer, idleIconStyle]}>
            {icon(TAB_ICON_SIZE, theme.text.secondary)}
          </Animated.View>
          <Animated.View style={[styles.iconLayer, activeIconStyle]}>
            {icon(TAB_ICON_SIZE, "#FFFFFF")}
          </Animated.View>
        </Animated.View>
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
  // Etiketler kalkınca sekmenin genişliğe ihtiyacı kalmadı: çubuk yuvaların
  // toplamı kadar — ortada yüzen bir hap. Kısıt yalnızca çok dar ekranlar için.
  const tabBarWidth = Math.min(windowWidth - 32, TAB_BAR_NATURAL_WIDTH);
  // Gösterge mutlak konumlu olduğu için yuvanın genişliği elle hesaplanıyor:
  // çubuk genişliği eksi tabContainer'ın yatay iç boşluğu.
  const slotWidth = (tabBarWidth - TAB_BAR_PADDING * 2) / TAB_NAMES.length;
  const activeIndex = Math.max(0, TAB_NAMES.indexOf(activeTab));

  const indicatorX = useSharedValue(activeIndex * slotWidth);
  const indicatorPop = useSharedValue(1);
  const indicatorPlaced = useRef(false);

  useEffect(() => {
    const target = activeIndex * slotWidth;
    // İlk yerleşim ve ekran döndürme animasyonsuz: açılışta göstergenin soldan
    // süzülmesi olmayan bir "sekme değişti" hissi verirdi.
    if (!indicatorPlaced.current) {
      indicatorPlaced.current = true;
      indicatorX.value = target;
      return;
    }
    indicatorX.value = withSpring(target, INDICATOR_SPRING);
    // Ölçek TEK EKSENDE değil, her iki eksende birden: yalnız yatayda esnetmek
    // daireyi elipse çevirirdi. Yola çıkarken büzülüp yerine oturduğunda yayla
    // toparlanıyor — yuvarlaklık hiç bozulmuyor.
    indicatorPop.value = withSequence(
      withTiming(0.86, { duration: 120 }),
      withSpring(1, ICON_SPRING)
    );
  }, [activeIndex, slotWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: indicatorX.value },
      { scale: indicatorPop.value },
    ],
  }));

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
  // SIRA TAB_NAMES İLE AYNI OLMALI: kayan gösterge konumunu oradaki indeksten
  // hesaplıyor.
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
        style={[styles.bottomTabs, { bottom: Math.max(18, insets.bottom + 12) }]}
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

              {/* Aktif yüzey sekme başına açılıp kapanmıyor; TEK daire seçilen
                  sekmeye kayıyor. Sarmalayıcı yuva genişliğinde (translateX
                  hesabı buna dayanıyor), daire onun ortasında duruyor. */}
              <Animated.View
                pointerEvents="none"
                style={[styles.indicator, { width: slotWidth }, indicatorStyle]}
              >
                <View style={styles.indicatorCircle}>
                  <LinearGradient
                    colors={[
                      alpha(theme.accent, 0.82),
                      alpha(theme.accent, 0.58),
                      alpha(theme.bold || theme.accent, 0.32),
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
              </Animated.View>

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
  // ── Kompakt sekme çubuğu ──
  // Yükseklik 60 → 48, etiketler kaldırıldı, genişlik 390 → 304. Çubuk içerik
  // ÜSTÜNDE yüzdüğü için kapladığı her piksel ekrandan çalınıyor.
  tabShadow: {
    borderRadius: TAB_BAR_RADIUS,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 10,
  },
  tabClip: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_RADIUS,
    overflow: "hidden",
  },
  tabContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: TAB_BAR_PADDING,
    paddingVertical: TAB_BAR_PADDING,
  },
  // Yuva tam daire genişliğinde; yatay iç boşluk dokunma alanını daraltırdı.
  tab: {
    flex: 1,
    height: INDICATOR_SIZE,
  },
  tabMotion: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Kayan aktif gösterge: yatay konumu translateX ile sürüldüğü için `left`
  // sabit, sarmalayıcının genişliği yuva genişliğinden geliyor. Daire yuvanın
  // ortasında; yatayda yuvaya yayılmıyor, çapını çubuğun YÜKSEKLİĞİ veriyor.
  indicator: {
    position: "absolute",
    top: TAB_BAR_PADDING,
    bottom: TAB_BAR_PADDING,
    left: TAB_BAR_PADDING,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorCircle: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    overflow: "hidden",
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default TabScreenNavigator;
