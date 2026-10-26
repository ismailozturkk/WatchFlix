// screens/onboarding/OnboardingScreen.js
//
// Tanıtım akışının orkestratörü: durum (seçimler, adım), analitik, gezinme ve
// slaytların dizilimi. Görünüm parçaları aynı klasörde:
//   OnboardingBackdrop  — poster duvarı + ışıma      OnboardingIntro  — marka açılışı
//   OnboardingChrome    — üst çubuk, alt düğmeler    OnboardingSlides — karşılama / önizleme / son slayt
//   OnboardingPreferences — tür ve platform seçimi   onboardingCopy   — tr/en metinler
//
// Akış: intro → [keşfet, türler, AI, platformlar, profil] → kayıt/giriş. "Atla"
// akıştan çıkarmaz, doğrudan son (kayıt) slayta götürür.

import { copyLanguage, nextAppLanguage } from "../../utils/appLanguages";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Keys, set } from "../../services/storage";
import * as Haptics from "@services/hapticsService";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import IconBacground from "../../components/IconBacground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  useApiSettings,
  useDiscoveryPreferenceSettings,
  useImageQualitySettings,
  useStreamingProviderSettings,
} from "../../context/AppSettingsContext";
import { isLightSurface } from "../../utils/colorUtils";
import useAppLogo from "@hooks/useAppLogo";
import { AiShowcase, ProfileShowcase } from "./OnboardingShowcases";
import OnboardingBackdrop from "./OnboardingBackdrop";
import OnboardingIntro from "./OnboardingIntro";
import {
  OnboardingCtaDock,
  OnboardingHeader,
  OnboardingNavDock,
} from "./OnboardingChrome";
import { CtaSlide, DiscoverSlide, ShowcaseSlide } from "./OnboardingSlides";
import PreferenceSlide from "./OnboardingPreferences";
import FavoritesSlide from "./OnboardingFavorites";
import { readPendingFavorites, writePendingFavorites } from "../../services/pendingFavorites";
import { countFavorites, emptyFavorites } from "../../utils/fourFavorites";
import {
  ONBOARDING_COPY,
  ONBOARDING_STEP_ORDER,
  getOnboardingCopy,
  onboardingStepName,
} from "./onboardingCopy";
import useOnboardingData from "./useOnboardingData";

const { width } = Dimensions.get("window");
const AnimatedScrollView = Animated.ScrollView;

// Hafif dokunsal geri bildirim — desteklemeyen cihazlarda sessizce geç.
const buzz = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

// Bir adımın "görüldü" sayılması için yerinde kalması gereken süre (ms).
const STEP_VIEW_SETTLE_MS = 400;

// Önizleme slaytlarının gösterdiği uygulama maketleri.
const MOCKS = { ai: AiShowcase, profile: ProfileShowcase };

export default function OnboardingScreen({ navigation }) {
  // Marka logosu seçili uygulama simgesini izler (hooks/useAppLogo.js).
  const { logo: appLogo } = useAppLogo();
  const { theme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const { streamingProviderIds, changeStreamingProviderIds } = useStreamingProviderSettings();
  const { onboardingGenreKeys, changeOnboardingGenreKeys } = useDiscoveryPreferenceSettings();
  const insets = useSafeAreaInsets();

  const accent = theme.accent;
  const isLightTheme = isLightSurface(theme.primary);
  const lang = copyLanguage(language, Object.keys(ONBOARDING_COPY));
  const copy = getOnboardingCopy(lang);

  const [phase, setPhase] = useState("intro"); // "intro" | "main"
  const [index, setIndex] = useState(0);
  const [selectedGenreKeys, setSelectedGenreKeys] = useState(onboardingGenreKeys);
  const [selectedProviderIds, setSelectedProviderIds] = useState(streamingProviderIds);
  // Dört favori. Hesap yok → cihaza geçici yazılır, kayıt sonrası profile taşınır
  // (services/pendingFavorites.js). Önceki oturumdan kalan seçim geri yüklenir.
  const [favorites, setFavorites] = useState(() => readPendingFavorites() || emptyFavorites());
  const favoritesRef = useRef(favorites);

  const { posters, posterPaths, mediaItems, providerCatalog } = useOnboardingData({
    apiKey: API_KEY,
    language,
    getTmdbUrl,
    accent,
  });

  const scrollRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const startedAt = useRef(Date.now());
  const startedSent = useRef(false);
  const lastTracked = useRef(null);

  const steps = ONBOARDING_STEP_ORDER;
  const count = steps.length;
  const step = steps[index] || steps[0];
  const isCta = step.type === "cta";

  // ── Analitik ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (startedSent.current) return;
    startedSent.current = true;
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_STARTED, {
      entry_language: lang,
      feature_step_count: count - 1,
    });
  }, []);

  // Adım, kısa bir süre yerinde kalınca sayılır: "Atla" ile arada kayan slaytlar
  // (ve hızlı kaydırmalar) huniye "görüldü" diye yazılmasın.
  useEffect(() => {
    if (phase !== "main") return undefined;
    // Anahtar yalnız adım: dil düğmesine basmak aynı adımı yeniden "görüldü"
    // saydırıp huninin ilk basamağını şişiriyordu (T3 B3). Olay, adımın ilk
    // görüldüğü dili taşır.
    const key = index;
    if (lastTracked.current === key) return undefined;
    const timer = setTimeout(() => {
      lastTracked.current = key;
      trackEvent(ANALYTICS_EVENTS.ONBOARDING_STEP_VIEWED, {
        step_number: index + 1,
        step_name: onboardingStepName(step, copy),
        total_steps: count,
        language: lang,
      });
    }, STEP_VIEW_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [step, index, language, phase, count, copy, lang]);

  // ── Tercihler ───────────────────────────────────────────────────────────────
  // Ayar yazımı (changeXxx) AppSettingsProvider'ı günceller. setState GÜNCELLEYİCİSİNİN içinde çağrılırsa React onu
  // render sırasında çalıştırabilir ve "Cannot update a component while rendering a different component" uyarısı
  // verir; bu yüzden güncel değer ref'te tutulur, yan etki güncelleyicinin DIŞINDA yapılır.
  const genreKeysRef = useRef(selectedGenreKeys);
  const providerIdsRef = useRef(selectedProviderIds);

  const toggleGenre = useCallback(
    (mediaType, key) => {
      buzz();
      const current = genreKeysRef.current;
      const active = current?.[mediaType] || [];
      const nextActive = active.includes(key)
        ? active.filter((item) => item !== key)
        : active.length >= 3
          ? active
          : [...active, key];
      const next = { movie: current?.movie || [], tv: current?.tv || [], [mediaType]: nextActive };
      genreKeysRef.current = next;
      setSelectedGenreKeys(next);
      changeOnboardingGenreKeys(next);
    },
    [changeOnboardingGenreKeys],
  );

  const toggleProvider = useCallback(
    (id) => {
      buzz();
      const current = providerIdsRef.current;
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      providerIdsRef.current = next;
      setSelectedProviderIds(next);
      changeStreamingProviderIds(next);
    },
    [changeStreamingProviderIds],
  );

  const changeFavorites = useCallback((next) => {
    favoritesRef.current = next;
    setFavorites(next);
    writePendingFavorites(next);
  }, []);

  // ── Gezinme ─────────────────────────────────────────────────────────────────
  const goTo = useCallback(
    async (routeName, source) => {
      trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
        destination: routeName === "RegisterScreen" ? "register" : "login",
        source: source || "cta",
        duration_seconds: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
        // Kaç favori seçildi (0 = adım geçildi). Özelliğin tanıtımdaki benimsenmesi.
        favorites_count: countFavorites(favoritesRef.current),
      });
      set(Keys.hasSeenOnboarding, true);
      navigation.reset({ index: 0, routes: [{ name: routeName }] });
    },
    [navigation],
  );

  const scrollToIndex = useCallback((i) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
  }, []);

  const handleNext = useCallback(() => {
    if (isCta) return;
    buzz();
    scrollToIndex(index + 1);
  }, [index, isCta, scrollToIndex]);

  const handleBack = useCallback(() => {
    if (index <= 0) return;
    buzz();
    scrollToIndex(index - 1);
  }, [index, scrollToIndex]);

  const handleSkip = useCallback(() => {
    buzz();
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_SKIPPED, { from_step: index + 1, total_steps: count });
    scrollToIndex(count - 1);
  }, [index, scrollToIndex, count]);

  const handleRegister = useCallback(() => {
    goTo("RegisterScreen", "register_cta");
  }, [goTo]);

  const handleLogin = useCallback(() => {
    buzz();
    goTo("LoginScreen", "login_cta");
  }, [goTo]);

  const onMomentumEnd = useCallback((e) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }, []);

  // Kaydırma sırasında index erken güncellenir → komşu slayt içeriği momentum
  // bitmeden kurulur, "pat diye belirme" olmaz.
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
        listener: (e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex((prev) => (prev === i ? prev : i));
        },
      }),
    [scrollX],
  );

  // Alt çubuklar son slaytta çapraz solar: [Devam] → [Kayıt ol].
  const navOpacity = useMemo(
    () =>
      scrollX.interpolate({
        inputRange: [(count - 2) * width, (count - 1) * width],
        outputRange: [1, 0],
        extrapolate: "clamp",
      }),
    [scrollX, count],
  );
  const ctaOpacity = useMemo(
    () =>
      scrollX.interpolate({
        inputRange: [(count - 2) * width, (count - 1) * width],
        outputRange: [0, 1],
        extrapolate: "clamp",
      }),
    [scrollX, count],
  );

  const nextLabel = index === count - 2 ? copy.start : copy.next;

  const renderSlide = (item, i) => {
    const common = {
      theme,
      accent,
      isLightTheme,
      topInset: insets.top,
      bottomInset: insets.bottom,
      scrollX,
      slideIndex: i,
    };

    if (item.type === "cta") {
      return (
        <CtaSlide
          key="cta"
          {...common}
          cta={copy.cta}
          posters={posters}
          logo={appLogo}
        />
      );
    }

    if (item.type === "preference" && item.kind === "favorites") {
      return (
        <FavoritesSlide
          key={item.kind}
          {...common}
          copy={copy}
          favorites={favorites}
          onChangeFavorites={changeFavorites}
        />
      );
    }

    if (item.type === "preference") {
      return (
        <PreferenceSlide
          key={item.kind}
          {...common}
          kind={item.kind}
          copy={copy}
          language={lang}
          selectedGenreKeys={selectedGenreKeys}
          selectedProviderIds={selectedProviderIds}
          providerCatalog={providerCatalog}
          getTmdbUrl={getTmdbUrl}
          onToggleGenre={toggleGenre}
          onToggleProvider={toggleProvider}
          onSelectionTick={buzz}
        />
      );
    }

    const feature = copy.features[item.featureIndex];
    if (feature.kind === "discover") {
      return (
        <DiscoverSlide
          key={feature.kind}
          {...common}
          feature={feature}
          hasPosters={posters.length > 0}
        />
      );
    }

    return (
      <ShowcaseSlide
        key={feature.kind}
        {...common}
        feature={feature}
        Mock={MOCKS[feature.kind]}
        mockProps={{
          theme,
          accent,
          isLightTheme,
          posters,
          posterPaths,
          mediaItems,
          getTmdbUrl,
          lang,
        }}
        active={Math.abs(index - i) <= 1}
      />
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <StatusBar
        barStyle={isLightTheme ? "dark-content" : "light-content"}
        translucent
        backgroundColor="transparent"
      />
      <IconBacground opacity={isLightTheme ? 0.05 : 0.08} />

      <OnboardingBackdrop
        theme={theme}
        accent={accent}
        isLightTheme={isLightTheme}
        posters={posters}
        scrollX={scrollX}
        settled={phase === "main"}
        wallPaused={index > 0}
      />

      {phase === "main" && (
        <>
          <AnimatedScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onMomentumEnd}
            onScroll={onScroll}
            style={styles.pager}
          >
            {steps.map(renderSlide)}
          </AnimatedScrollView>

          <OnboardingHeader
            theme={theme}
            accent={accent}
            isLightTheme={isLightTheme}
            topInset={insets.top}
            logo={appLogo}
            copy={copy}
            language={lang}
            onToggleLanguage={() => toggleLanguage(nextAppLanguage(lang))}
            showSkip={!isCta}
            onSkip={handleSkip}
            count={count}
            scrollX={scrollX}
          />

          <Animated.View style={[StyleSheet.absoluteFill, { opacity: navOpacity }]} pointerEvents="box-none">
            <OnboardingNavDock
              theme={theme}
              accent={accent}
              isLightTheme={isLightTheme}
              bottomInset={insets.bottom}
              copy={copy}
              label={nextLabel}
              showBack={index > 0}
              onBack={handleBack}
              onNext={handleNext}
              visible={!isCta}
            />
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, { opacity: ctaOpacity }]} pointerEvents="box-none">
            <OnboardingCtaDock
              theme={theme}
              accent={accent}
              bottomInset={insets.bottom}
              cta={copy.cta}
              visible={isCta}
              onRegister={handleRegister}
              onLogin={handleLogin}
            />
          </Animated.View>
        </>
      )}

      {phase === "intro" && (
        <OnboardingIntro
          theme={theme}
          accent={accent}
          isLightTheme={isLightTheme}
          copy={copy}
          onDone={() => setPhase("main")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: { flex: 1 },
});
