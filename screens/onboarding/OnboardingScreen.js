import { isLightSurface } from "../../utils/colorUtils";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import LottieView from "lottie-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Keys, set } from "../../services/storage";
import axios from "axios";
import * as Haptics from "@services/hapticsService";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import IconBacground from "../../components/IconBacground";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  STREAMING_PROVIDERS,
  useApiSettings,
  useDiscoveryPreferenceSettings,
  useImageQualitySettings,
  useStreamingProviderSettings,
} from "../../context/AppSettingsContext";
import { alpha } from "../../theme/colors";
import { ONBOARDING_GENRES } from "../../utils/onboardingPreferences";
import {
  AiShowcase,
  TournamentShowcase,
  ShareShowcase,
  PlayShowcase,
  ChatDuoShowcase,
  ProfileShowcase,
} from "./OnboardingShowcases";

const { width, height } = Dimensions.get("window");
const AnimatedScrollView = Animated.ScrollView;

// Onboarding'i bir kez gösterdiğimizi işaretleyen bayrak. AuthContext bu değere
// bakarak ilk açılışta OnboardingScreen'e, sonrasında LoginScreen'e yönlendirir.
export const ONBOARDING_SEEN_KEY = Keys.hasSeenOnboarding.key;

// Kayan poster ızgarasının ölçüleri
const POSTER_W = 96;
const POSTER_H = 144;
const POSTER_GAP = 10;
const ROW_GAP = 10;

// Hafif dokunsal geri bildirim — desteklemeyen cihazlarda sessizce geç
const buzz = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

// ── Metinler (tr / en) ────────────────────────────────────────────────────────
const COPY = {
  tr: {
    tagline: "Ne izleyeceğini bul. İzlediklerini hatırla. Hikâyeni paylaş.",
    introEyebrow: "SENİN İZLEME EVRENİN",
    introTap: "Devam etmek için dokun",
    skip: "Atla",
    next: "Devam Et",
    start: "Son Adım",
    back: "Geri",
    step: "ADIM",
    freeBadge: "ÜCRETSİZ BAŞLA",
    register: "Ücretsiz Kayıt Ol",
    haveAccount: "Zaten hesabın var mı?",
    login: "Giriş Yap",
    ctaBenefits: ["Listelerin her cihazda seninle", "Sana özel keşif ve öneriler", "Arkadaşlarınla ortak bir izleme alanı"],
    ctaTrust: "Ücretsiz · Kredi kartı gerekmez · 1 dakikada hazır",
    features: [
      {
        kind: "discover",
        icon: "compass-outline",
        eyebrow: "KEŞFET & TAKİP ET",
        title: "Sıradaki favorin burada.",
        titleAccent: "favorin",
        desc: "Binlerce film ve diziyi keşfet; izlediklerini, favorilerini ve izleme listeni tek bir yerde düzenle.",
        tags: ["Akıllı keşif", "Kişisel listeler", "Film & dizi"],
      },
      {
        kind: "ai",
        icon: "sparkles-outline",
        eyebrow: "SEELOGD AI",
        title: "“Ne izlesem?” sorusu bitti.",
        titleAccent: "“Ne izlesem?”",
        desc: "Tek soruya beş farklı cevap stili: öneri, karşılaştırma, izleme planı, liste ve künye — hepsi bir arada.",
        tags: ["Kişisel öneri", "Karşılaştırma", "İzleme planı"],
      },
      {
        kind: "profile",
        icon: "stats-chart-outline",
        eyebrow: "PAYLAŞ & HATIRLA",
        title: "İzleme hikâyen sana özel.",
        titleAccent: "sana özel",
        desc: "İstatistiklerini ve Wrapped'ını gör; arkadaşlarınla paylaş, sahne oyununda yarış ve izlediklerini unutma.",
        tags: ["Wrapped", "Arkadaşlar", "Oyunlar"],
      },
    ],
    cta: {
      eyebrow: "SEELOGD'A HOŞ GELDİN",
      title: "İzleme hikâyen şimdi başlıyor.",
      titleAccent: "şimdi",
      desc: "Ücretsiz hesabını oluştur; keşfetmeye, biriktirmeye ve paylaşmaya hemen başla.",
    },
  },
  en: {
    tagline: "Find what to watch. Remember what you loved. Share your story.",
    introEyebrow: "YOUR WATCHING UNIVERSE",
    introTap: "Tap to continue",
    skip: "Skip",
    next: "Continue",
    start: "Final Step",
    back: "Back",
    step: "STEP",
    freeBadge: "START FOR FREE",
    register: "Sign Up Free",
    haveAccount: "Already have an account?",
    login: "Log In",
    ctaBenefits: ["Your lists on every device", "Discovery tailored to your taste", "A shared watch space with friends"],
    ctaTrust: "Free · No credit card · Ready in a minute",
    features: [
      {
        kind: "discover",
        icon: "compass-outline",
        eyebrow: "DISCOVER & TRACK",
        title: "Your next favorite is here.",
        titleAccent: "favorite",
        desc: "Discover thousands of movies and shows, then organize everything you watched, loved and plan to see in one place.",
        tags: ["Smart discovery", "Personal lists", "Movies & shows"],
      },
      {
        kind: "ai",
        icon: "sparkles-outline",
        eyebrow: "SEELOGD AI",
        title: "Never wonder what to watch.",
        titleAccent: "what to watch",
        desc: "One question, five answer styles: picks, comparisons, watch plans, lists and spotlights — all at once.",
        tags: ["Personal picks", "Compare", "Watch plans"],
      },
      {
        kind: "profile",
        icon: "stats-chart-outline",
        eyebrow: "SHARE & REMEMBER",
        title: "Your watching story is yours.",
        titleAccent: "is yours",
        desc: "See your stats and Wrapped, share with friends, compete in scene games and never lose track of a watch.",
        tags: ["Wrapped", "Friends", "Games"],
      },
    ],
    cta: {
      eyebrow: "WELCOME TO SEELOGD",
      title: "Your watching story starts now.",
      titleAccent: "now",
      desc: "Create your free account and start discovering, collecting and sharing today.",
    },
  },
};

// Özellik slaytlarının tanımı: hangi mock gösterilecek + ikon.
// index 0 (discover) kayan poster arka planı kullanır; diğerleri mock gösterir.
const DISCOVER_LOTTIE = require("@lottie/dizi_film_animation.json");
export default function OnboardingScreen({ navigation }) {
  const { theme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const { streamingProviderIds, changeStreamingProviderIds } =
    useStreamingProviderSettings();
  const { onboardingGenreKeys, changeOnboardingGenreKeys } =
    useDiscoveryPreferenceSettings();
  const insets = useSafeAreaInsets();

  const accent = theme.accent;
  const isLightTheme = isLightSurface(theme.primary);
  const copy = COPY[language === "en" ? "en" : "tr"];

  const [phase, setPhase] = useState("intro"); // "intro" | "main"
  const [selectedGenreKeys, setSelectedGenreKeys] = useState(onboardingGenreKeys);
  const [selectedProviderIds, setSelectedProviderIds] = useState(streamingProviderIds);
  const [providerCatalog, setProviderCatalog] = useState(
    STREAMING_PROVIDERS.map((provider, priority) => ({
      ...provider,
      logoPath: null,
      priority,
      mediaTypes: ["movie", "tv"],
    })),
  );
  const [index, setIndex] = useState(0);
  const [posters, setPosters] = useState([]); // TMDB poster URI'leri (kayan arka plan)
  const [posterPaths, setPosterPaths] = useState([]); // ham poster_path'ler (turnuva ağacı için)
  const [mediaItems, setMediaItems] = useState([]); // tam film/dizi nesneleri (gerçek içerik için)
  const onboardingStartedAt = useRef(Date.now());
  const startedEventSent = useRef(false);
  const lastTrackedStep = useRef(null);

  const scrollRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onboardingSteps = useMemo(
    () => [
      { type: "feature", feature: copy.features[0] },
      { type: "preference", kind: "genre" },
      { type: "feature", feature: copy.features[1] },
      { type: "preference", kind: "provider" },
      { type: "feature", feature: copy.features[2] },
      { type: "cta" },
    ],
    [copy.features],
  );
  const SLIDE_COUNT = onboardingSteps.length;
  const currentStep = onboardingSteps[index] || onboardingSteps[0];
  const isCtaSlide = currentStep.type === "cta";

  useEffect(() => {
    if (startedEventSent.current) return;
    startedEventSent.current = true;
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_STARTED, {
      entry_language: language === "en" ? "en" : "tr",
      feature_step_count: SLIDE_COUNT - 1,
    });
  }, []);

  useEffect(() => {
    if (phase !== "main") return;
    const stepKey = `${index}:${language}`;
    if (lastTrackedStep.current === stepKey) return;
    lastTrackedStep.current = stepKey;
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_STEP_VIEWED, {
      step_number: index + 1,
      step_name:
        currentStep.type === "cta"
          ? "account_cta"
          : currentStep.type === "preference"
            ? `${currentStep.kind}_preferences`
            : currentStep.feature?.kind || "unknown",
      total_steps: SLIDE_COUNT,
      language: language === "en" ? "en" : "tr",
    });
  }, [currentStep, index, language, phase, SLIDE_COUNT]);

  // En çok oy alan film + dizi verisini (tam nesne + tür isimleri) çek.
  // Tüm mock içerikleri bu GERÇEK verilerden üretilir → poster/başlık/puan/yıl tutarlı.
  useEffect(() => {
    let alive = true;
    const tmdbLang = language === "tr" ? "tr-TR" : "en-US";
    const headers = { accept: "application/json", Authorization: API_KEY };
    (async () => {
      try {
        const [mv, tv, mg, tg] = await Promise.all([
          axios.get("https://api.themoviedb.org/3/discover/movie", {
            params: { sort_by: "vote_count.desc", language: tmdbLang, page: 1 },
            headers,
          }),
          axios.get("https://api.themoviedb.org/3/discover/tv", {
            params: { sort_by: "vote_count.desc", language: tmdbLang, page: 1 },
            headers,
          }),
          axios.get("https://api.themoviedb.org/3/genre/movie/list", {
            params: { language: tmdbLang },
            headers,
          }),
          axios.get("https://api.themoviedb.org/3/genre/tv/list", {
            params: { language: tmdbLang },
            headers,
          }),
        ]);

        const gmap = (arr) => {
          const o = {};
          (arr || []).forEach((g) => {
            o[g.id] = g.name;
          });
          return o;
        };
        const movieGenres = gmap(mg.data?.genres);
        const tvGenres = gmap(tg.data?.genres);

        const norm = (arr, type, gm) =>
          (arr || [])
            .filter((x) => x.poster_path)
            .map((x) => {
              const date = type === "movie" ? x.release_date : x.first_air_date;
              return {
                id: x.id,
                media_type: type,
                title: type === "movie" ? x.title : x.name,
                poster_path: x.poster_path,
                vote_average: Math.round((x.vote_average || 0) * 10) / 10,
                release_date: date,
                year: String(date || "").slice(0, 4),
                overview: x.overview || "",
                genres: (x.genre_ids || []).map((id) => gm[id]).filter(Boolean).slice(0, 3),
              };
            });

        // Tanınırlık için popülerlik sırasını koru (film önce, dizi sonra).
        const items = [
          ...norm(mv.data?.results, "movie", movieGenres),
          ...norm(tv.data?.results, "tv", tvGenres),
        ];
        if (!items.length) return;

        // Kayan arka plan + turnuva için karıştırılmış poster yolu kopyası.
        const shuffled = items.map((i) => i.poster_path);
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const uris = shuffled.map((p) => getTmdbUrl(p, "poster", 200)).filter(Boolean);

        if (alive) {
          setMediaItems(items);
          setPosterPaths(shuffled);
          if (uris.length) setPosters(uris);
        }
      } catch (e) {
        // sessizce geç — veri çekilemezse slaytlar yine de düzgün görünür
      }
    })();
    return () => {
      alive = false;
    };
  }, [API_KEY, getTmdbUrl, language]);

  // Bölgeye uygun film ve dizi platformlarını TMDB'den al; aynı sağlayıcının
  // iki katalogdaki varlığını birleştir ve gerçek logo_path bilgisini koru.
  useEffect(() => {
    let alive = true;
    const tmdbLanguage = language === "tr" ? "tr-TR" : "en-US";
    const tmdbRegion = language === "tr" ? "TR" : "US";
    const headers = { accept: "application/json", Authorization: API_KEY };

    const loadProviders = async () => {
      try {
        const [movieResponse, tvResponse] = await Promise.all([
          axios.get("https://api.themoviedb.org/3/watch/providers/movie", {
            params: { language: tmdbLanguage, watch_region: tmdbRegion },
            headers,
          }),
          axios.get("https://api.themoviedb.org/3/watch/providers/tv", {
            params: { language: tmdbLanguage, watch_region: tmdbRegion },
            headers,
          }),
        ]);
        const merged = new Map();
        const addProviders = (items, mediaType) => {
          (items || []).forEach((provider) => {
            if (!provider?.provider_id) return;
            const current = merged.get(provider.provider_id);
            merged.set(provider.provider_id, {
              id: provider.provider_id,
              name: provider.provider_name,
              color:
                STREAMING_PROVIDERS.find((item) => item.id === provider.provider_id)?.color ||
                accent,
              logoPath: provider.logo_path || current?.logoPath || null,
              priority: Math.min(
                Number(provider.display_priority ?? 9999),
                Number(current?.priority ?? 9999),
              ),
              mediaTypes: [...new Set([...(current?.mediaTypes || []), mediaType])],
            });
          });
        };
        addProviders(movieResponse.data?.results, "movie");
        addProviders(tvResponse.data?.results, "tv");
        const next = [...merged.values()].sort(
          (a, b) => a.priority - b.priority || a.name.localeCompare(b.name),
        );
        if (alive && next.length) setProviderCatalog(next);
      } catch (error) {
        // Başlangıçtaki temel katalog çevrimdışıyken de seçimi kullanılabilir tutar.
      }
    };

    loadProviders();
    return () => {
      alive = false;
    };
  }, [API_KEY, accent, language]);

  const toggleGenrePreference = useCallback(
    (mediaType, key) => {
      buzz();
      setSelectedGenreKeys((current) => {
        const active = current?.[mediaType] || [];
        const nextActive = active.includes(key)
          ? active.filter((item) => item !== key)
          : active.length >= 3
            ? active
            : [...active, key];
        const next = { movie: current?.movie || [], tv: current?.tv || [], [mediaType]: nextActive };
        changeOnboardingGenreKeys(next);
        return next;
      });
    },
    [changeOnboardingGenreKeys],
  );

  const toggleProviderPreference = useCallback(
    (id) => {
      buzz();
      setSelectedProviderIds((current) => {
        const next = current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id];
        changeStreamingProviderIds(next);
        return next;
      });
    },
    [changeStreamingProviderIds],
  );

  const markSeen = useCallback(async () => {
    set(Keys.hasSeenOnboarding, true);
  }, []);

  const goTo = useCallback(
    async (routeName, source) => {
      trackEvent(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, {
        destination: routeName === "RegisterScreen" ? "register" : "login",
        source: source || "cta",
        duration_seconds: Math.max(
          1,
          Math.round((Date.now() - onboardingStartedAt.current) / 1000),
        ),
      });
      await markSeen();
      navigation.reset({ index: 0, routes: [{ name: routeName }] });
    },
    [markSeen, navigation],
  );

  const scrollToIndex = useCallback((i) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
  }, []);

  const handleNext = useCallback(() => {
    if (isCtaSlide) return;
    buzz();
    scrollToIndex(index + 1);
  }, [index, isCtaSlide, scrollToIndex]);

  const handleBack = useCallback(() => {
    if (index <= 0) return;
    buzz();
    scrollToIndex(index - 1);
  }, [index, scrollToIndex]);

  // "Atla" kullanıcıyı akıştan çıkarmaz; doğrudan kayıt (CTA) slaytına götürür.
  const handleSkip = useCallback(() => {
    buzz();
    trackEvent(ANALYTICS_EVENTS.ONBOARDING_SKIPPED, {
      from_step: index + 1,
      total_steps: SLIDE_COUNT,
    });
    scrollToIndex(SLIDE_COUNT - 1);
  }, [index, scrollToIndex, SLIDE_COUNT]);

  const onMomentumEnd = useCallback((e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  }, []);

  // Kayan poster arka planı TÜM onboarding ekranlarında görünür.
  // Slayt 0'da tam görünür; diğer slaytlarda okunabilirlik için tema rengine
  // doğru soluklaştırılır (scrim). Intro kendi yarı saydam fonunu kullanır.
  const scrimMax = isLightTheme ? 0.93 : 0.9;
  const marqueeScrim = useMemo(
    () =>
      scrollX.interpolate({
        inputRange: [0, width],
        outputRange: [0, scrimMax],
        extrapolate: "clamp",
      }),
    [scrollX, scrimMax],
  );
  // Renkli şekiller slayt 0'da posterlerin üzerinde durmasın diye gizlenir.
  const shapesReveal = useMemo(
    () =>
      scrollX.interpolate({
        inputRange: [0, width],
        outputRange: [0, 1],
        extrapolate: "clamp",
      }),
    [scrollX],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.primary }}>
      <StatusBar
        barStyle={isLightTheme ? "dark-content" : "light-content"}
        translucent
        backgroundColor="transparent"
      />
      <IconBacground opacity={isLightTheme ? 0.05 : 0.08} />

      {/* Tüm onboarding boyunca görünen kayan poster arka planı + scrim */}
      {posters.length > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <PosterMarquee posters={posters} />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: theme.primary },
              phase === "main" ? { opacity: marqueeScrim } : { opacity: 0 },
            ]}
          />
        </View>
      )}

      {/* Renkli arka plan yıkaması */}
      <View style={styles.backdropWash} pointerEvents="none">
        <LinearGradient
          colors={[
            alpha(accent, isLightTheme ? 0.24 : 0.36),
            alpha(theme.bold, isLightTheme ? 0.1 : 0.18),
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Animated.View
        style={[
          styles.shapeLayer,
          phase === "main" && posters.length > 0 ? { opacity: shapesReveal } : null,
        ]}
        pointerEvents="none"
      >
        <View
          style={[
            styles.colorShape,
            styles.shapeOne,
            { backgroundColor: alpha(accent, isLightTheme ? 0.2 : 0.26) },
          ]}
        />
        <View
          style={[
            styles.colorShape,
            styles.shapeTwo,
            { backgroundColor: alpha(theme.colors.orange, isLightTheme ? 0.16 : 0.22) },
          ]}
        />
        <View
          style={[
            styles.colorShape,
            styles.shapeThree,
            { backgroundColor: alpha(theme.colors.green, isLightTheme ? 0.12 : 0.16) },
          ]}
        />
      </Animated.View>

      {/* ── MAIN: özellik + CTA pager ────────────────────────────────────── */}
      {phase === "main" && (
        <>
          <View style={[styles.mainHeader, { top: insets.top + 8 }]}>
            <View style={styles.headerBrand}>
              <Image source={require("../../assets/android-icon-foreground.png")} style={styles.headerLogo} />
              <Text style={[styles.headerBrandText, { color: theme.text.primary }]}>
                See<Text style={{ color: accent }}>logd</Text>
              </Text>
            </View>

            <View style={styles.headerActions}>
              {!isCtaSlide && (
                <View
                  style={[
                    styles.stepPill,
                    {
                      backgroundColor: alpha(theme.secondary, isLightTheme ? 0.92 : 0.76),
                      borderColor: alpha(theme.border, 0.8),
                    },
                  ]}
                >
                  <Text style={[styles.stepPillText, { color: theme.text.muted }]}>
                    {copy.step} {index + 1}
                  </Text>
                  <Text style={[styles.stepPillText, { color: accent }]}>/{SLIDE_COUNT - 1}</Text>
                </View>
              )}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={language === "tr" ? "English" : "Türkçe"}
                style={[
                  styles.languageButton,
                  {
                    backgroundColor: alpha(theme.secondary, isLightTheme ? 0.92 : 0.76),
                    borderColor: alpha(theme.border, 0.8),
                  },
                ]}
                onPress={() => toggleLanguage(language === "tr" ? "en" : "tr")}
                activeOpacity={0.75}
              >
                <Ionicons name="globe-outline" size={14} color={accent} />
                <Text style={[styles.languageButtonText, { color: theme.text.primary }]}>
                  {(language || "tr").toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <AnimatedScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onMomentumEnd}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              {
                useNativeDriver: true,
                // Kaydırma sırasında index'i erken güncelle → komşu slayt içeriği
                // momentum bitmeden mount olur, "pat diye belirme" görülmez.
                listener: (e) => {
                  const i = Math.round(e.nativeEvent.contentOffset.x / width);
                  setIndex((prev) => (prev === i ? prev : i));
                },
              },
            )}
            style={{ flex: 1 }}
          >
            {onboardingSteps.map((step, i) => {
              if (step.type === "cta") {
                return (
                  <CtaSlide
                    key="cta"
                    copy={copy}
                    theme={theme}
                    accent={accent}
                    isLightTheme={isLightTheme}
                    topInset={insets.top}
                    bottomInset={insets.bottom}
                    posters={posters}
                    onRegister={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      goTo("RegisterScreen", "register_cta");
                    }}
                    onLogin={() => {
                      buzz();
                      goTo("LoginScreen", "login_cta");
                    }}
                  />
                );
              }
              if (step.type === "preference") {
                return (
                  <PersonalizationSlide
                    key={step.kind}
                    kind={step.kind}
                    language={language}
                    theme={theme}
                    accent={accent}
                    isLightTheme={isLightTheme}
                    topInset={insets.top}
                    bottomInset={insets.bottom}
                    selectedGenreKeys={selectedGenreKeys}
                    selectedProviderIds={selectedProviderIds}
                    providerCatalog={providerCatalog}
                    getTmdbUrl={getTmdbUrl}
                    onToggleGenre={toggleGenrePreference}
                    onToggleProvider={toggleProviderPreference}
                  />
                );
              }
              const f = step.feature;
              return f.kind === "discover" ? (
                <DiscoverSlide
                  key={i}
                  title={f.title}
                  titleAccent={f.titleAccent}
                  desc={f.desc}
                  eyebrow={f.eyebrow}
                  tags={f.tags}
                  posters={posters}
                  icon={f.icon}
                  theme={theme}
                  accent={accent}
                  isLightTheme={isLightTheme}
                  topInset={insets.top}
                  scrollX={scrollX}
                  slideIndex={i}
                />
              ) : (
                <MockSlide
                  key={i}
                  kind={f.kind}
                  icon={f.icon}
                  title={f.title}
                  titleAccent={f.titleAccent}
                  desc={f.desc}
                  eyebrow={f.eyebrow}
                  tags={f.tags}
                  theme={theme}
                  accent={accent}
                  isLightTheme={isLightTheme}
                  topInset={insets.top}
                  posters={posters}
                  posterPaths={posterPaths}
                  mediaItems={mediaItems}
                  getTmdbUrl={getTmdbUrl}
                  t={t}
                  lang={language === "en" ? "en" : "tr"}
                  scrollX={scrollX}
                  slideIndex={i}
                  active={Math.abs(index - i) <= 1}
                />
              );
            })}
          </AnimatedScrollView>

          {!isCtaSlide && (
            <>
              <LinearGradient
                pointerEvents="none"
                colors={["transparent", alpha(theme.primary, 0.92), theme.primary]}
                locations={[0, 0.32, 0.72]}
                style={styles.bottomFade}
              />

              <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
                <View style={styles.progressRow}>
              {Array.from({ length: SLIDE_COUNT }).map((_, i) => {
                const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                const progressScale = scrollX.interpolate({
                  inputRange,
                  outputRange: [0, 1, 0],
                  extrapolate: "clamp",
                });
                return (
                  <View key={i} style={[styles.progressTrack, { backgroundColor: alpha(theme.text.muted, 0.18) }]}>
                    <Animated.View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: accent,
                          opacity: progressScale,
                          transform: [{ scaleX: progressScale }],
                        },
                      ]}
                    />
                  </View>
                );
              })}
                </View>

                <View style={styles.navRow}>
                <View style={styles.navLeft}>
                  {index > 0 && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={copy.back}
                      style={[
                        styles.backButton,
                        { backgroundColor: theme.secondary, borderColor: theme.border },
                      ]}
                      onPress={handleBack}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="arrow-back" size={20} color={theme.text.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.skipButton}
                    onPress={handleSkip}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[styles.skipText, { color: theme.text.muted }]}>
                      {copy.skip}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.nextButton, { shadowColor: accent }]}
                  onPress={handleNext}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[accent, theme.bold]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.nextGradient}
                  >
                    <Text style={styles.nextText}>
                      {index === SLIDE_COUNT - 2 ? copy.start : copy.next}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </>
      )}

      {/* ── INTRO: animasyonlu marka açılışı (en üstte) ──────────────────── */}
      {phase === "intro" && (
        <IntroOverlay
          theme={theme}
          accent={accent}
          isLightTheme={isLightTheme}
          tagline={copy.tagline}
          eyebrow={copy.introEyebrow}
          tapHint={copy.introTap}
          onDone={() => setPhase("main")}
        />
      )}
    </View>
  );
}

function PersonalizationSlide({
  kind,
  language,
  theme,
  accent,
  isLightTheme,
  topInset,
  bottomInset,
  selectedGenreKeys,
  selectedProviderIds,
  providerCatalog,
  getTmdbUrl,
  onToggleGenre,
  onToggleProvider,
}) {
  const isTr = language !== "en";
  const isGenreStep = kind === "genre";
  const [mediaType, setMediaType] = useState("movie");
  const activeGenreKeys = selectedGenreKeys?.[mediaType] || [];
  const availableGenres = ONBOARDING_GENRES.filter((genre) =>
    mediaType === "movie" ? genre.movieId : genre.tvId,
  );
  const availableProviders = useMemo(
    () =>
      (providerCatalog || [])
        .filter((provider) => provider.mediaTypes?.includes(mediaType))
        .sort((a, b) => {
          const selectedDiff = Number(selectedProviderIds.includes(b.id)) - Number(selectedProviderIds.includes(a.id));
          return selectedDiff || a.priority - b.priority;
        })
        .slice(0, 12),
    [mediaType, providerCatalog, selectedProviderIds],
  );
  const surface = alpha(theme.secondary, isLightTheme ? 0.92 : 0.78);
  const text = isGenreStep
    ? {
        eyebrow: isTr ? "SANA GÖRE KEŞİF" : "DISCOVERY FOR YOU",
        title: isTr ? "Film ve dizi zevkini ayrı ayrı seç." : "Shape movies and shows separately.",
        description: isTr
          ? "Her bölüm için en fazla 3 tür seç. Film ve dizi keşif alanların kendi tercihlerine göre hazırlanacak."
          : "Pick up to 3 for each. Movie and TV discovery will use their own preferences.",
        count: isTr
          ? `${selectedGenreKeys?.movie?.length || 0}/3 film · ${selectedGenreKeys?.tv?.length || 0}/3 dizi`
          : `${selectedGenreKeys?.movie?.length || 0}/3 movies · ${selectedGenreKeys?.tv?.length || 0}/3 shows`,
      }
    : {
        eyebrow: isTr ? "PLATFORMLARIN" : "YOUR SERVICES",
        title: isTr ? "İzlediğin platformları ekle." : "Add the services you watch.",
        description: isTr
          ? "Bölgendeki gerçek film ve dizi kataloglarını ayrı ayrı gösteriyoruz. Seçtiklerin üyelik önerilerini ve platform sıralamasını belirler."
          : "Browse real regional movie and TV catalogs separately. Your choices shape subscription picks and provider order.",
        count: isTr
          ? `${selectedProviderIds.length} platform seçildi`
          : `${selectedProviderIds.length} selected`,
      };

  return (
    <View style={styles.preferenceSlide}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.preferenceContent,
          { paddingTop: topInset + 86, paddingBottom: bottomInset + 150 },
        ]}
      >
        <View style={[styles.preferenceIcon, { backgroundColor: alpha(accent, 0.14) }]}>
          <Ionicons
            name={isGenreStep ? "color-palette-outline" : "play-circle-outline"}
            size={25}
            color={accent}
          />
        </View>
        <Text style={[styles.preferenceEyebrow, { color: accent }]}>{text.eyebrow}</Text>
        <Text style={[styles.preferenceTitle, { color: theme.text.primary }]}>{text.title}</Text>
        <Text style={[styles.preferenceDescription, { color: theme.text.secondary }]}>
          {text.description}
        </Text>
        <View style={[styles.preferenceCount, { backgroundColor: alpha(accent, 0.12) }]}>
          <Text style={[styles.preferenceCountText, { color: accent }]}>{text.count}</Text>
        </View>

        <View style={[styles.mediaTypeSwitch, { backgroundColor: surface, borderColor: theme.border }]}>
          {[
            { key: "movie", tr: "Filmler", en: "Movies", icon: "film-outline" },
            { key: "tv", tr: "Diziler", en: "TV Shows", icon: "tv-outline" },
          ].map((item) => {
            const active = mediaType === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => {
                  buzz();
                  setMediaType(item.key);
                }}
                style={[styles.mediaTypeButton, active && { backgroundColor: accent }]}
              >
                <Ionicons name={item.icon} size={15} color={active ? "#fff" : theme.text.secondary} />
                <Text style={[styles.mediaTypeButtonText, { color: active ? "#fff" : theme.text.secondary }]}>
                  {isTr ? item.tr : item.en}
                </Text>
                {isGenreStep && (
                  <View style={[styles.mediaTypeBadge, { backgroundColor: active ? "#ffffff2E" : alpha(accent, 0.12) }]}>
                    <Text style={[styles.mediaTypeBadgeText, { color: active ? "#fff" : accent }]}>
                      {selectedGenreKeys?.[item.key]?.length || 0}/3
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {isGenreStep ? (
          <View style={styles.preferenceGrid}>
            {availableGenres.map((genre) => {
              const selected = activeGenreKeys.includes(genre.key);
              const locked = !selected && activeGenreKeys.length >= 3;
              return (
                <TouchableOpacity
                  key={genre.key}
                  activeOpacity={0.82}
                  disabled={locked}
                  onPress={() => onToggleGenre(mediaType, genre.key)}
                  style={[
                    styles.preferenceChoice,
                    {
                      backgroundColor: selected ? alpha(accent, 0.16) : surface,
                      borderColor: selected ? accent : alpha(theme.border, 0.9),
                      opacity: locked ? 0.42 : 1,
                    },
                  ]}
                >
                  <View style={[styles.preferenceChoiceIcon, { backgroundColor: alpha(accent, 0.12) }]}>
                    <Ionicons name={genre.icon} size={18} color={accent} />
                  </View>
                  <Text style={[styles.preferenceChoiceText, { color: theme.text.primary }]}>
                    {mediaType === "tv"
                      ? isTr ? genre.tvTr || genre.tr : genre.tvEn || genre.en
                      : isTr ? genre.tr : genre.en}
                  </Text>
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={19}
                    color={selected ? accent : theme.text.muted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.providerGrid}>
            {availableProviders.map((provider) => {
              const selected = selectedProviderIds.includes(provider.id);
              return (
                <TouchableOpacity
                  key={provider.id}
                  activeOpacity={0.82}
                  onPress={() => onToggleProvider(provider.id)}
                  style={[
                    styles.providerChoice,
                    {
                      backgroundColor: selected ? alpha(provider.color, 0.18) : surface,
                      borderColor: selected ? provider.color : alpha(theme.border, 0.9),
                    },
                  ]}
                >
                  {provider.logoPath ? (
                    <ExpoImage
                      source={{ uri: getTmdbUrl(provider.logoPath, "logo", 150) }}
                      style={styles.providerLogoImage}
                      contentFit="cover"
                      transition={180}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.providerInitial, { backgroundColor: provider.color }]}>
                      <Text style={styles.providerInitialText}>{provider.name.slice(0, 1)}</Text>
                    </View>
                  )}
                  <Text
                    numberOfLines={1}
                    style={[styles.providerChoiceText, { color: theme.text.primary }]}
                  >
                    {provider.name}
                  </Text>
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={19}
                    color={selected ? provider.color : theme.text.muted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Kayan poster satırı (tek yön, sonsuz döngü) ──────────────────────────────
function MarqueeRow({ posters, direction, speed, paused }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const stripW = posters.length * (POSTER_W + POSTER_GAP);

  useEffect(() => {
    // Slayt görünür değilken animasyonu durdur (CPU/batarya tasarrufu)
    if (!posters.length || !stripW || paused) return undefined;
    const duration = (stripW / speed) * 1000;
    const from = direction === "left" ? 0 : -stripW;
    const to = direction === "left" ? -stripW : 0;
    translateX.setValue(from);
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: to,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [stripW, direction, speed, posters.length, paused]);

  // İki kopya → kesintisiz döngü
  const doubled = useMemo(() => [...posters, ...posters], [posters]);

  return (
    <View style={{ height: POSTER_H, marginBottom: ROW_GAP }}>
      <Animated.View
        style={{ flexDirection: "row", transform: [{ translateX }] }}
      >
        {doubled.map((uri, i) => (
          <ExpoImage
            key={i}
            source={{ uri }}
            style={styles.marqueePoster}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={250}
          />
        ))}
      </Animated.View>
    </View>
  );
}

// ── Diyagonal, çok satırlı kayan poster ızgarası ──────────────────────────────
function PosterMarquee({ posters, paused }) {
  const rows = useMemo(() => {
    if (!posters.length) return [];
    // Kapsama alanını kaybettirmeden görsel sayısını azalt (perf)
    const visibleCount =
      Math.ceil((width * 1.45) / (POSTER_W + POSTER_GAP)) + 2;
    const rowsCount = Math.ceil((height * 1.05) / (POSTER_H + ROW_GAP)) + 1;
    const out = [];
    for (let r = 0; r < rowsCount; r++) {
      const start = (r * 5) % posters.length;
      const rowPosters = [];
      for (let i = 0; i < visibleCount; i++) {
        rowPosters.push(posters[(start + i) % posters.length]);
      }
      out.push(rowPosters);
    }
    return out;
  }, [posters]);

  return (
    <View style={styles.marqueeClip} pointerEvents="none">
      <View style={styles.marqueeInner}>
        {rows.map((rp, i) => (
          <MarqueeRow
            key={i}
            posters={rp}
            direction={i % 2 === 0 ? "right" : "left"}
            speed={20 + (i % 3) * 5}
            paused={paused}
          />
        ))}
      </View>
    </View>
  );
}

// ── Marka intro overlay'i: logo + "Seelogd" adı animasyonlu belirir ─────────
function IntroOverlay({ theme, accent, isLightTheme, tagline, eyebrow, tapHint, onDone }) {
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.55)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.7)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordTranslate = useRef(new Animated.Value(22)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  const finish = useCallback(() => {
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => onDone?.());
  }, [onDone, overlayOpacity]);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(wordOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(wordTranslate, {
          toValue: 0,
          duration: 340,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.delay(320),
    ]).start(({ finished }) => {
      if (finished) finish();
    });
  }, []);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.introContainer,
        {
          // Yarı saydam fon: kayan posterler intro'da da hafifçe görünür
          backgroundColor: alpha(theme.primary, isLightTheme ? 0.94 : 0.9),
          opacity: overlayOpacity,
        },
      ]}
    >
      <IconBacground opacity={isLightTheme ? 0.05 : 0.08} />
      <View style={styles.backdropWash} pointerEvents="none">
        <LinearGradient
          colors={[alpha(accent, isLightTheme ? 0.26 : 0.4), "transparent"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <Pressable style={styles.introPress} onPress={finish}>
        <Animated.View
          style={[
            styles.introEyebrowPill,
            {
              backgroundColor: alpha(accent, 0.12),
              borderColor: alpha(accent, 0.3),
              opacity: taglineOpacity,
            },
          ]}
        >
          <View style={[styles.liveDot, { backgroundColor: accent }]} />
          <Text style={[styles.introEyebrow, { color: accent }]}>{eyebrow}</Text>
        </Animated.View>

        <View style={styles.logoWrap}>
          <Animated.View
            style={[
              styles.logoGlow,
              {
                backgroundColor: alpha(accent, 0.28),
                opacity: logoOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
          <Animated.View
            style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}
          >
            <Image
              source={require("../../assets/android-icon-foreground.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        <Animated.Text
          style={[
            styles.brandName,
            {
              color: theme.text.primary,
              opacity: wordOpacity,
              transform: [{ translateY: wordTranslate }],
            },
          ]}
        >
          Watch<Text style={{ color: accent }}>ify</Text>
        </Animated.Text>

        <Animated.Text
          style={[
            styles.brandTagline,
            { color: theme.text.secondary, opacity: taglineOpacity },
          ]}
        >
          {tagline}
        </Animated.Text>

        <Animated.View style={[styles.introFeatureRow, { opacity: taglineOpacity }]}>
          {["film-outline", "sparkles-outline", "people-outline"].map((icon) => (
            <View
              key={icon}
              style={[
                styles.introFeatureIcon,
                {
                  backgroundColor: alpha(theme.secondary, 0.72),
                  borderColor: alpha(theme.border, 0.8),
                },
              ]}
            >
              <Ionicons name={icon} size={17} color={accent} />
            </View>
          ))}
        </Animated.View>

        {!!tapHint && (
          <Animated.Text
            style={[
              styles.introTapHint,
              { color: theme.text.muted, opacity: taglineOpacity },
            ]}
          >
            {tapHint}
          </Animated.Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// Başlığın içinde tek bir kelime/öbek vurgu rengiyle boyanır (pazarlama vurgusu)
function renderAccentedTitle(title, accentWord, accentColor) {
  if (!accentWord) return title;
  const at = title.indexOf(accentWord);
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <Text style={{ color: accentColor }}>{accentWord}</Text>
      {title.slice(at + accentWord.length)}
    </>
  );
}

function FeatureHeading({
  eyebrow,
  title,
  titleAccent,
  desc,
  tags = [],
  icon,
  theme,
  accent,
  inverse = false,
}) {
  const titleColor = inverse ? "#fff" : theme.text.primary;
  const bodyColor = inverse ? "rgba(255,255,255,0.82)" : theme.text.secondary;
  const chipText = inverse ? "rgba(255,255,255,0.9)" : theme.text.secondary;
  return (
    <View style={styles.featureCopy}>
      <View style={styles.featureEyebrowRow}>
        <View
          style={[
            styles.featureIcon,
            { backgroundColor: inverse ? alpha("#fff", 0.14) : alpha(accent, 0.14) },
          ]}
        >
          <Ionicons name={icon} size={15} color={inverse ? "#fff" : accent} />
        </View>
        <Text style={[styles.featureEyebrow, { color: inverse ? "rgba(255,255,255,0.78)" : accent }]}>
          {eyebrow}
        </Text>
      </View>
      <Text style={[styles.slideTitle, { color: titleColor }]}>
        {renderAccentedTitle(title, titleAccent, accent)}
      </Text>
      <Text style={[styles.slideDesc, { color: bodyColor }]}>{desc}</Text>
      <View style={styles.tagRow}>
        {tags.map((tag) => (
          <View
            key={tag}
            style={[
              styles.tagPill,
              {
                backgroundColor: inverse ? alpha("#fff", 0.11) : alpha(accent, 0.09),
                borderColor: inverse ? alpha("#fff", 0.16) : alpha(accent, 0.16),
              },
            ]}
          >
            <View style={[styles.tagDot, { backgroundColor: inverse ? "#fff" : accent }]} />
            <Text style={[styles.tagText, { color: chipText }]}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Slayt içeriği için scrollX'e bağlı parallax stilleri (native driver).
// head: yatay kayma + fade · stage: hafif küçülme + fade
function useSlideParallax(scrollX, slideIndex) {
  return useMemo(() => {
    if (!scrollX) return { head: null, stage: null };
    const inputRange = [
      (slideIndex - 1) * width,
      slideIndex * width,
      (slideIndex + 1) * width,
    ];
    const fade = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: "clamp",
    });
    return {
      head: {
        opacity: fade,
        transform: [
          {
            translateX: scrollX.interpolate({
              inputRange,
              outputRange: [width * 0.28, 0, -width * 0.28],
              extrapolate: "clamp",
            }),
          },
        ],
      },
      stage: {
        opacity: fade,
        transform: [
          {
            scale: scrollX.interpolate({
              inputRange,
              outputRange: [0.93, 1, 0.93],
              extrapolate: "clamp",
            }),
          },
        ],
      },
    };
  }, [scrollX, slideIndex]);
}

// ── Keşfet slaytı: kayan poster arka planı ───────────────────────────────────
function DiscoverSlide({
  eyebrow,
  title,
  titleAccent,
  desc,
  tags,
  posters,
  icon,
  theme,
  accent,
  isLightTheme,
  topInset,
  scrollX,
  slideIndex = 0,
}) {
  const parallax = useSlideParallax(scrollX, slideIndex);

  // Posterler henüz gelmediyse standart lottie slaytına düş
  if (!posters.length) {
    return (
      <FeatureSlide
        title={title}
        titleAccent={titleAccent}
        desc={desc}
        eyebrow={eyebrow}
        tags={tags}
        visual={{ lottie: DISCOVER_LOTTIE, icon }}
        theme={theme}
        accent={accent}
        isLightTheme={isLightTheme}
        topInset={topInset}
      />
    );
  }

  // Kayan posterler artık kök katmanda (tüm ekranlarda ortak arka plan);
  // bu slayt yalnız okunabilirlik gradyanını ve metni çizer.
  return (
    <View style={{ width, flex: 1 }}>

      {/* Okunabilirlik için karartma katmanı */}
      <LinearGradient
        colors={[
          alpha(theme.primary, 0.62),
          alpha(theme.primary, 0.32),
          alpha(theme.primary, 0.9),
          theme.primary,
        ]}
        locations={[0, 0.42, 0.82, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.discoverAccentWash} pointerEvents="none">
        <LinearGradient
          colors={[alpha(accent, 0.28), "transparent"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={[styles.discoverContent, { paddingTop: topInset + 78 }]}>
        <Animated.View style={[{ width: "100%" }, parallax.head]}>
          <FeatureHeading
            eyebrow={eyebrow}
            title={title}
            titleAccent={titleAccent}
            desc={desc}
            tags={tags}
            icon={icon}
            theme={theme}
            accent={accent}
            inverse
          />
        </Animated.View>
      </View>
    </View>
  );
}

// ── Mock (fake gösterim) slaytı: başlık + açıklama + özellik önizlemesi ───────
function MockSlide({
  kind,
  icon,
  title,
  titleAccent,
  desc,
  eyebrow,
  tags,
  theme,
  accent,
  isLightTheme,
  topInset,
  posters,
  posterPaths,
  mediaItems,
  getTmdbUrl,
  t,
  lang,
  scrollX,
  slideIndex = 0,
  active = true,
}) {
  const parallax = useSlideParallax(scrollX, slideIndex);

  // Lazy mount: ağır showcase içeriği yalnız slayt görünür/komşu olunca kurulur,
  // bir kez kurulunca da sökülmez (geri kaydırmada titreme olmasın).
  const [mounted, setMounted] = useState(!!active);
  useEffect(() => {
    if (active && !mounted) setMounted(true);
  }, [active, mounted]);

  const renderMock = () => {
    const props = { theme, accent, posters, posterPaths, mediaItems, getTmdbUrl, t, lang, isLightTheme };
    switch (kind) {
      case "ai":
        return <AiShowcase {...props} />;
      case "tournament":
        return <TournamentShowcase {...props} />;
      case "share":
        return <ShareShowcase {...props} />;
      case "play":
        return <PlayShowcase {...props} />;
      case "chat":
      case "group":
        return <ChatDuoShowcase {...props} />;
      case "profile":
        return <ProfileShowcase {...props} />;
      default:
        return null;
    }
  };

  return (
    <View style={{ width, flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.mockScroll, { paddingTop: topInset + 78 }]}
        bounces={false}
      >
        <Animated.View style={[{ width: "100%" }, parallax.head]}>
          <FeatureHeading
            eyebrow={eyebrow}
            title={title}
            titleAccent={titleAccent}
            desc={desc}
            tags={tags}
            icon={icon}
            theme={theme}
            accent={accent}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.showcaseStage,
            {
              backgroundColor: alpha(accent, isLightTheme ? 0.055 : 0.07),
              borderColor: alpha(accent, 0.14),
            },
            parallax.stage,
          ]}
        >
          <View style={styles.showcaseTopRail}>
            <View style={[styles.showcaseRailDot, { backgroundColor: alpha(accent, 0.55) }]} />
            <View style={[styles.showcaseRailDot, { backgroundColor: alpha(theme.text.muted, 0.3) }]} />
            <View style={[styles.showcaseRailLine, { backgroundColor: alpha(theme.text.muted, 0.16) }]} />
          </View>
          <View style={styles.showcaseContent}>
            {mounted ? renderMock() : <View style={{ height: 320 }} />}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── Tek bir özellik slaytı (lottie kart) ─────────────────────────────────────
function FeatureSlide({ eyebrow, title, titleAccent, desc, tags, visual, theme, accent, isLightTheme, topInset }) {
  const surface = isLightTheme
    ? "rgba(255,255,255,0.6)"
    : "rgba(255,255,255,0.05)";
  return (
    <View style={[styles.slide, { paddingTop: topInset + 78 }]}>
      <View
        style={[
          styles.visualCard,
          { backgroundColor: surface, borderColor: alpha(accent, 0.2) },
        ]}
      >
        <View style={styles.visualAccent} pointerEvents="none">
          <LinearGradient
            colors={[alpha(accent, 0.22), "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <LottieView source={visual.lottie} style={styles.visualAnimation} autoPlay loop />
      </View>

      <FeatureHeading
        eyebrow={eyebrow}
        title={title}
        titleAccent={titleAccent}
        desc={desc}
        tags={tags}
        icon={visual.icon}
        theme={theme}
        accent={accent}
      />
    </View>
  );
}

function PosterFan({ posters, theme, accent }) {
  const cards = posters.slice(0, 3);
  if (!cards.length) {
    return (
      <View style={[styles.ctaLogoFallback, { backgroundColor: alpha(accent, 0.12), borderColor: alpha(accent, 0.24) }]}>
        <Image source={require("../../assets/android-icon-foreground.png")} style={styles.ctaLogoImage} />
      </View>
    );
  }

  const cardStyles = [styles.posterLeft, styles.posterCenter, styles.posterRight];
  return (
    <View style={styles.posterFan}>
      <View style={[styles.posterGlow, { backgroundColor: alpha(accent, 0.28) }]} />
      {cards.map((uri, i) => (
        <View
          key={`${uri}-${i}`}
          style={[
            styles.posterFanCard,
            cardStyles[i],
            { borderColor: alpha(theme.text.primary, 0.16), shadowColor: "#000" },
          ]}
        >
          <ExpoImage source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.42)"]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ))}
      <View style={[styles.posterFanBadge, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <Ionicons name="checkmark-circle" size={16} color={accent} />
        <Text style={[styles.posterFanBadgeText, { color: theme.text.primary }]}>Seelogd</Text>
      </View>
    </View>
  );
}

// ── Son slayt: kayıt / giriş CTA'sı ──────────────────────────────────────────
function CtaSlide({ copy, theme, accent, isLightTheme, topInset, bottomInset, posters, onRegister, onLogin }) {
  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[
        styles.ctaSlide,
        { paddingTop: topInset + 76, paddingBottom: bottomInset + 28 },
      ]}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <PosterFan posters={posters} theme={theme} accent={accent} />

      <View
        style={[
          styles.freeBadge,
          {
            backgroundColor: alpha(accent, isLightTheme ? 0.1 : 0.14),
            borderColor: alpha(accent, 0.24),
          },
        ]}
      >
        <Ionicons name="sparkles" size={13} color={accent} />
        <Text style={[styles.freeBadgeText, { color: accent }]}>{copy.freeBadge}</Text>
      </View>

      <Text style={[styles.ctaEyebrow, { color: theme.text.muted }]}>{copy.cta.eyebrow}</Text>
      <Text style={[styles.ctaTitle, { color: theme.text.primary }]}>
        {renderAccentedTitle(copy.cta.title, copy.cta.titleAccent, accent)}
      </Text>
      <Text style={[styles.ctaDesc, { color: theme.text.secondary }]}>{copy.cta.desc}</Text>

      {/* Özellik özeti: karar anında uygulamanın genişliğini hatırlat */}
      <View style={styles.recapRow}>
        {[
          "compass-outline",
          "sparkles-outline",
          "chatbubbles-outline",
          "game-controller-outline",
          "stats-chart-outline",
        ].map((name) => (
          <View
            key={name}
            style={[
              styles.recapIcon,
              {
                backgroundColor: alpha(accent, isLightTheme ? 0.08 : 0.12),
                borderColor: alpha(accent, 0.2),
              },
            ]}
          >
            <Ionicons name={name} size={15} color={accent} />
          </View>
        ))}
      </View>

      <View style={styles.benefitList}>
        {copy.ctaBenefits.map((benefit) => (
          <View key={benefit} style={styles.benefitRow}>
            <View style={[styles.benefitCheck, { backgroundColor: alpha(accent, 0.13) }]}>
              <Ionicons name="checkmark" size={14} color={accent} />
            </View>
            <Text style={[styles.benefitText, { color: theme.text.secondary }]}>{benefit}</Text>
          </View>
        ))}
      </View>

      <View style={styles.ctaButtons}>
        <TouchableOpacity
          style={[styles.registerButton, { shadowColor: accent }]}
          onPress={onRegister}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[accent, theme.bold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.registerGradient}
          >
            <Text style={styles.registerText}>{copy.register}</Text>
            <View style={styles.buttonArrowBubble}>
              <Ionicons name="arrow-forward" size={17} color="#fff" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginButton, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          onPress={onLogin}
          activeOpacity={0.75}
        >
          <Text style={[styles.loginPrompt, { color: theme.text.muted }]}>{copy.haveAccount}</Text>
          <Text style={[styles.loginButtonText, { color: accent }]}>{copy.login}</Text>
        </TouchableOpacity>

        <View style={styles.trustRow}>
          <Ionicons name="shield-checkmark" size={12} color={theme.text.muted} />
          <Text style={[styles.trustText, { color: theme.text.muted }]}>{copy.ctaTrust}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  preferenceSlide: { width, height },
  preferenceContent: {
    minHeight: height,
    paddingHorizontal: 20,
  },
  preferenceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Math.max(22, height * 0.035),
  },
  preferenceBrandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  preferenceLogo: { width: 30, height: 30 },
  preferenceBrand: { fontSize: 18, fontWeight: "900", letterSpacing: -0.35 },
  preferenceSteps: { flexDirection: "row", alignItems: "center", gap: 6 },
  preferenceStepDot: { width: 18, height: 5, borderRadius: 3 },
  preferenceStepDotActive: { width: 30 },
  preferenceIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  preferenceEyebrow: { fontSize: 10.5, fontWeight: "900", letterSpacing: 1.25 },
  preferenceTitle: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "900",
    letterSpacing: -0.55,
    marginTop: 7,
  },
  preferenceDescription: { fontSize: 13.5, lineHeight: 20, marginTop: 7, maxWidth: 380 },
  preferenceCount: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    marginTop: 13,
    marginBottom: 15,
  },
  preferenceCountText: { fontSize: 10.5, fontWeight: "800" },
  mediaTypeSwitch: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginBottom: 14,
  },
  mediaTypeButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  mediaTypeButtonText: { fontSize: 12, fontWeight: "800" },
  mediaTypeBadge: { borderRadius: 7, paddingHorizontal: 5, paddingVertical: 2 },
  mediaTypeBadgeText: { fontSize: 9, fontWeight: "900" },
  preferenceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  preferenceChoice: {
    width: "48%",
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.25,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  preferenceChoiceIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  preferenceChoiceText: { flex: 1, fontSize: 12, fontWeight: "800" },
  providerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  providerChoice: {
    width: "31%",
    minHeight: 104,
    borderRadius: 16,
    borderWidth: 1.25,
    paddingHorizontal: 7,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  providerLogoImage: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#FFFFFF" },
  providerChoiceText: { width: "100%", fontSize: 10.5, fontWeight: "800", textAlign: "center" },
  providerInitial: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  providerInitialText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  preferenceActions: { marginTop: 20 },
  preferenceSecondaryActions: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  preferenceTextButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
  },
  preferenceTextButtonLabel: { fontSize: 11.5, fontWeight: "700" },
  preferenceContinue: { borderRadius: 16, overflow: "hidden" },
  preferenceContinueGradient: {
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  preferenceContinueText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "800" },
  backdropWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.5,
    zIndex: 0,
  },
  shapeLayer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  colorShape: {
    position: "absolute",
    borderRadius: 20,
  },
  shapeOne: {
    width: 180,
    height: 80,
    top: height * 0.12,
    left: -50,
    transform: [{ rotate: "-18deg" }],
  },
  shapeTwo: {
    width: 140,
    height: 96,
    top: height * 0.24,
    right: -36,
    transform: [{ rotate: "22deg" }],
  },
  shapeThree: {
    width: 210,
    height: 56,
    top: height * 0.42,
    left: width * 0.34,
    transform: [{ rotate: "-10deg" }],
  },
  mainHeader: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  headerLogo: {
    width: 28,
    height: 28,
  },
  headerBrandText: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepPill: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  stepPillText: {
    fontSize: 10.5,
    fontWeight: "850",
    letterSpacing: 0.4,
  },
  languageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  languageButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Kayan poster ızgarası ──
  marqueeClip: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  marqueeInner: {
    position: "absolute",
    top: -POSTER_H,
    left: -width * 0.35,
    width: width * 1.7,
    bottom: -POSTER_H,
    justifyContent: "center",
    transform: [{ rotate: "-9deg" }, { scale: 1.15 }],
  },
  marqueePoster: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 10,
    marginRight: POSTER_GAP,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  // ── Slide ──
  slide: {
    width,
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 22,
  },
  mockScroll: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 138,
  },
  visualCard: {
    width: Math.min(width - 80, 320),
    height: Math.min(width - 80, 320),
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 22,
  },
  visualAccent: {
    ...StyleSheet.absoluteFill,
  },
  visualAnimation: {
    width: "78%",
    height: "78%",
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  slideTitle: {
    width: "100%",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "left",
    letterSpacing: -0.65,
    lineHeight: 33,
  },
  slideDesc: {
    width: "100%",
    fontSize: 14,
    lineHeight: 20.5,
    textAlign: "left",
    marginTop: 9,
  },
  featureCopy: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
  },
  featureEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 11,
  },
  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.35,
  },
  tagRow: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 14,
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    height: 27,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  tagText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  showcaseStage: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 27,
    borderWidth: 1,
    marginTop: 20,
    padding: 10,
    overflow: "hidden",
  },
  showcaseTopRail: {
    height: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 3,
    marginBottom: 4,
  },
  showcaseRailDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  showcaseRailLine: {
    width: 32,
    height: 4,
    borderRadius: 2,
    marginLeft: 3,
  },
  showcaseContent: {
    width: "100%",
    alignItems: "center",
  },

  // ── Keşfet slaytı ──
  discoverAccentWash: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: height * 0.5,
  },
  discoverContent: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    paddingHorizontal: 22,
    paddingBottom: 34,
  },

  ctaSlide: {
    alignItems: "center",
    paddingHorizontal: 22,
  },
  posterFan: {
    width: 270,
    height: 205,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  posterGlow: {
    position: "absolute",
    width: 185,
    height: 130,
    borderRadius: 65,
    transform: [{ scaleX: 1.25 }],
  },
  posterFanCard: {
    position: "absolute",
    width: 103,
    height: 155,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.32,
    shadowRadius: 13,
    elevation: 8,
  },
  posterLeft: {
    left: 21,
    top: 25,
    transform: [{ rotate: "-12deg" }, { scale: 0.92 }],
  },
  posterCenter: {
    top: 9,
    zIndex: 3,
  },
  posterRight: {
    right: 21,
    top: 25,
    transform: [{ rotate: "12deg" }, { scale: 0.92 }],
  },
  posterFanBadge: {
    position: "absolute",
    bottom: 2,
    zIndex: 5,
    height: 34,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  posterFanBadgeText: {
    fontSize: 11.5,
    fontWeight: "850",
  },
  ctaLogoFallback: {
    width: 142,
    height: 142,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 26,
  },
  ctaLogoImage: {
    width: 104,
    height: 104,
  },
  freeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 29,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    marginTop: 8,
  },
  freeBadgeText: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 0.85,
  },
  ctaEyebrow: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.25,
    marginTop: 18,
  },
  ctaTitle: {
    width: "100%",
    maxWidth: 380,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.7,
    textAlign: "center",
    marginTop: 8,
  },
  ctaDesc: {
    width: "100%",
    maxWidth: 360,
    fontSize: 14,
    lineHeight: 20.5,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 10,
  },
  recapRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 9,
    marginTop: 16,
  },
  recapIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 4,
  },
  trustText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  benefitList: {
    width: "100%",
    maxWidth: 360,
    gap: 9,
    marginTop: 20,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  benefitCheck: {
    width: 25,
    height: 25,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "650",
  },
  ctaButtons: {
    width: "100%",
    maxWidth: 360,
    marginTop: 22,
    alignItems: "center",
    gap: 10,
  },
  registerButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  registerGradient: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 20,
    paddingRight: 10,
  },
  registerText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  buttonArrowBubble: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.17)",
    alignItems: "center",
    justifyContent: "center",
  },
  loginButton: {
    width: "100%",
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  loginPrompt: {
    fontSize: 13,
    fontWeight: "550",
  },
  loginButtonText: {
    fontSize: 13,
    fontWeight: "850",
  },

  // ── Bottom bar ──
  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 150,
    zIndex: 8,
  },
  bottomBar: {
    zIndex: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 13,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 2,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  skipButton: {
    minWidth: 48,
    height: 48,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontSize: 15,
    fontWeight: "600",
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nextButton: {
    flex: 1,
    marginLeft: 12,
    borderRadius: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  nextGradient: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 22,
  },
  nextText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },

  // ── Intro overlay ──
  introContainer: {
    zIndex: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  introPress: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  introEyebrowPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  introEyebrow: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.15,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 21,
  },
  logoGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  logoImage: {
    width: 128,
    height: 128,
  },
  brandName: {
    fontSize: 43,
    fontWeight: "900",
    letterSpacing: -1.1,
  },
  brandTagline: {
    maxWidth: 340,
    fontSize: 15.5,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
    fontWeight: "550",
  },
  introFeatureRow: {
    flexDirection: "row",
    gap: 9,
    marginTop: 24,
  },
  introFeatureIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  introTapHint: {
    position: "absolute",
    bottom: 34,
    alignSelf: "center",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
