// screens/wrapped/WrappedScreen.js
//
// Seelogd Wrapped — yıllık izleme özeti (Spotify Wrapped tarzı tam ekran hikâye).
// Veri tamamen cihazda hesaplanır (utils/wrapped.js, ProfileStatsContext'ten);
// son slayt paylaşılabilir özet kartıdır (galeriye kaydet / paylaş). Geçmiş
// yıllar Lists/{uid}/wrapped/{year} altına arşivlenir (services/wrappedService).

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  Modal,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
// SDK 57: `saveToLibraryAsync` ana giriste calisma aninda hata firlatiyor;
// legacy girisinden alinmali (izin fonksiyonlari ana giriste gecerli).
import { saveToLibraryAsync } from "expo-media-library/legacy";
import * as Haptics from "@services/hapticsService";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";

import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useProfileStats } from "../../context/ProfileStatsContext";
import { useImageQualitySettings } from "../../context/AppSettingsContext";

import { buildYearlyRecap, getAvailableYears } from "../../utils/wrapped";
import { getWrappedStrings } from "../../utils/wrappedStrings";
import { archiveWrapped, wrappedExists } from "../../services/wrappedService";
import WrappedShareCard, {
  DEFAULT_WRAPPED_CARD_OPTIONS,
  WRAPPED_CARD_THEMES,
  getWrappedCardPalette,
  foregroundForPalette,
} from "../../components/wrapped/WrappedShareCard";
import {
  WrappedProgress,
  WrappedSlideFrame,
  SLIDE_COLORS,
  IntroSlide,
  TotalTimeSlide,
  MoviesSlide,
  TvSlide,
  TopGenresSlide,
  TopShowsSlide,
  BusiestSlide,
  BusiestMonthSlide,
  PersonalitySlide,
} from "../../components/wrapped/WrappedSlides";

const SLIDE_DURATION = 5200; // ms (otomatik geçiş)
// foregroundForPalette artık karttan geliyor (açık paletler listesi tek yerde).

export default function WrappedScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const uid = user?.uid;
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { getTmdbUrl } = useImageQualitySettings();
  const { listItems, flatEpisodesTv } = useProfileStats();

  const str = useMemo(() => getWrappedStrings(language), [language]);

  // Önizleme her ekran boyutunda gerçek 9:16 oranını korur. Üst chrome,
  // güvenli alanlar ve alt işlem dock'u için gereken alan düşülür.
  const shareCardSize = useMemo(() => {
    const maxWidth = Math.max(180, screenWidth - 32);
    const maxHeight = Math.max(
      320,
      screenHeight - insets.top - insets.bottom - 234
    );
    const width = Math.min(maxWidth, (maxHeight * 9) / 16);
    return { width, height: (width * 16) / 9 };
  }, [screenWidth, screenHeight, insets.top, insets.bottom]);

  // ── Kaynak veri ──
  const movies = useMemo(
    () => (listItems || []).filter((m) => m?.type === "movie"),
    [listItems]
  );
  const episodes = flatEpisodesTv || [];

  const availableYears = useMemo(
    () => getAvailableYears(movies, episodes),
    [movies, episodes]
  );

  // ── Seçili yıl ──
  const initialYear =
    route?.params?.year ?? availableYears[0] ?? new Date().getFullYear();
  const [year, setYear] = useState(initialYear);

  const recap = useMemo(
    () => buildYearlyRecap({ movies, episodes, year, language }),
    [movies, episodes, year, language]
  );

  const hasData =
    recap.totalMinutes > 0 || recap.totalMovies > 0 || recap.totalEpisodes > 0;

  // ── Slayt listesi (veri varlığına göre) ──
  const slides = useMemo(() => {
    if (!hasData) return [];
    const list = [{ key: "intro", Comp: IntroSlide }];
    if (recap.totalMinutes > 0)
      list.push({ key: "total", Comp: TotalTimeSlide });
    if (recap.totalMovies > 0) list.push({ key: "movies", Comp: MoviesSlide });
    if (recap.totalEpisodes > 0) list.push({ key: "tv", Comp: TvSlide });
    // Tür/dizi slaytları tüm listeyi gösterir → kaydırmalı + otomatik geçmez (manual).
    if (recap.allGenres.length > 0)
      list.push({ key: "genres", Comp: TopGenresSlide, manual: true });
    if (recap.allShows.length > 0)
      list.push({ key: "shows", Comp: TopShowsSlide, manual: true });
    if (recap.busiestMonth || recap.busiestDay)
      list.push({ key: "busy", Comp: BusiestSlide });
    if (recap.busiestMonth)
      list.push({ key: "busyMonth", Comp: BusiestMonthSlide });
    list.push({ key: "personality", Comp: PersonalitySlide });
    list.push({ key: "summary", Comp: null }); // özel: özet kartı
    return list;
  }, [hasData, recap]);

  const lastIndex = slides.length - 1;
  const [index, setIndex] = useState(0);
  const isSummary = index === lastIndex && slides[lastIndex]?.key === "summary";

  // ── İlerleme animasyonu (segmentli progress + otomatik geçiş) ──
  const progressAnim = useRef(new Animated.Value(0)).current;
  const slideTransition = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const pausedValRef = useRef(0); // duraklatıldığında aktif slaytta kalınan ilerleme (0-1)

  // Akış 3 bağımsız nedenden duraklayabilir; herhangi biri true ise durur:
  //   userPaused → sağ üstteki durdur/devam butonu (kalıcı, kullanıcı kontrolü)
  //   held       → slayda basılı tutma (Spotify tarzı, geçici)
  //   blurred    → ekran odakta değil / uygulama arka planda
  const [userPaused, setUserPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const paused = userPaused || held || blurred;

  useLayoutEffect(() => {
    slideTransition.setValue(0);
    Animated.timing(slideTransition, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [index, slideTransition, year]);

  const goNext = useCallback(() => {
    setIndex((i) => (i < lastIndex ? i + 1 : i));
  }, [lastIndex]);
  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : 0));
  }, []);

  // Manuel geçiş → dokunsal geri bildirim + elle duraklatmayı kaldır.
  // (Slayt değişimi ilerlemeyi her zaman 0'dan başlatır; aşağıdaki reset effect.)
  const tapNext = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setUserPaused(false);
    goNext();
  }, [goNext]);
  const tapPrev = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setUserPaused(false);
    goPrev();
  }, [goPrev]);

  // Basılı tutma (slayt bölgeleri) → geçici duraklat.
  const holdOn = useCallback(() => setHeld(true), []);
  const holdOff = useCallback(() => setHeld(false), []);

  // Sağ üst durdur/devam.
  const togglePause = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setUserPaused((p) => !p);
  }, []);

  // Bu slayt otomatik mi geçiyor? (özet ve manuel/kaydırmalı slaytlar geçmez)
  const isAuto = index < lastIndex && !slides[index]?.manual;

  // Slayt (veya yıl) DEĞİŞİNCE ilerlemeyi her zaman 0'dan başlat. Manuel geçişte
  // de sıfırlanır — eski slaytın ilerlemesi yeni slayda taşınmaz. Bu effect
  // timer effect'inden ÖNCE çalışır → timer 0'dan okur.
  useEffect(() => {
    pausedValRef.current = 0;
    progressAnim.setValue(0);
  }, [index, year, progressAnim]);

  // Tek kaynak: index/paused/isAuto durumuna göre timer'ı kur, durdur veya
  // duraklatınca kalınan yeri sakla. Duraklatma kalkınca KALINAN yerden devam
  // eder (yeni slaytta 0'dan, çünkü reset effect pausedValRef'i sıfırlamıştır).
  useEffect(() => {
    if (!hasData) return undefined;
    if (!isAuto) {
      // Özet + manuel slaytlar: barı dolu göster, otomatik geçiş yok.
      animRef.current?.stop();
      progressAnim.setValue(1);
      return undefined;
    }
    if (paused) {
      animRef.current?.stop();
      progressAnim.stopAnimation((v) => {
        if (typeof v === "number") pausedValRef.current = v;
      });
      return undefined;
    }
    const from = pausedValRef.current || 0;
    progressAnim.setValue(from);
    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: Math.max(400, SLIDE_DURATION * (1 - from)),
      useNativeDriver: false,
    });
    animRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => animRef.current?.stop();
  }, [index, paused, isAuto, hasData, goNext, progressAnim]);

  // Ekran odağı / uygulama durumu → blurred. Odakta değilken veya arka planda
  // sayaç akmasın (geri dönünce slayt hemen geçmiş gibi atlamasın).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      setBlurred(s !== "active");
    });
    const unsubBlur = navigation.addListener("blur", () => setBlurred(true));
    const unsubFocus = navigation.addListener("focus", () => setBlurred(false));
    return () => {
      sub.remove();
      unsubBlur();
      unsubFocus();
    };
  }, [navigation]);

  // Yıl değişince başa dön.
  useEffect(() => {
    setIndex(0);
  }, [year]);

  // Veri güncellemesi slayt sayısını kısaltırsa index'i aralık içine çek.
  useEffect(() => {
    if (lastIndex >= 0 && index > lastIndex) setIndex(lastIndex);
  }, [index, lastIndex]);

  // Özet (final) slaytına ulaşınca premium başarı dokunsalı.
  useEffect(() => {
    if (isSummary) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    }
  }, [isSummary]);

  // ── Arşivleme (mount/yıl değişince, yoksa yaz) ──
  useEffect(() => {
    if (!uid || !hasData) return undefined;
    let active = true;
    (async () => {
      const exists = await wrappedExists(uid, recap.year);
      if (active && !exists) archiveWrapped(uid, recap.year, recap);
    })();
    return () => {
      active = false;
    };
    // recap.year/totalMinutes değişince yeniden değerlendir (her render'da değil)
  }, [uid, hasData, recap.year, recap.totalMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Yakalama / paylaşım / kaydetme ──
  const cardRef = useRef(null);
  const [busyAction, setBusyAction] = useState(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [cardOptions, setCardOptions] = useState(DEFAULT_WRAPPED_CARD_OPTIONS);
  const busy = busyAction !== null;

  const updateCardOption = useCallback((key, value) => {
    Haptics.selectionAsync().catch(() => {});
    setCardOptions((current) => ({ ...current, [key]: value }));
  }, []);

  const resetCardOptions = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setCardOptions(DEFAULT_WRAPPED_CARD_OPTIONS);
  }, []);

  const capture = useCallback(async () => {
    const node = cardRef.current;
    if (!node) throw new Error("card-not-ready");
    // Kart zaten chrome içermiyor; doğrudan yakala. İki kare + kısa gecikme
    // bekle → gradient ve expo-image katmanları boyansın (ilk yakalama boş
    // çıkmasın). Yakalama ara sıra ilk denemede başarısız olabildiğinden bir
    // kez daha dener.
    await new Promise((r) => requestAnimationFrame(() => r()));
    await new Promise((r) => requestAnimationFrame(() => r()));
    await new Promise((r) => setTimeout(r, 90));
    const opts = { format: "png", quality: 1, result: "tmpfile" };
    try {
      return await captureRef(node, opts);
    } catch (first) {
      await new Promise((r) => setTimeout(r, 140));
      return captureRef(node, opts);
    }
  }, []);

  const handleShare = useCallback(async () => {
    if (busy) return;
    try {
      setBusyAction("share");
      // Önce paylaşım desteğini doğrula (yoksa boşuna yakalama yapma).
      if (!(await Sharing.isAvailableAsync())) {
        Toast.show({ type: "error", text1: str.shareUnavailable });
        return;
      }
      const uri = await capture();
      // view-shot bazı platformlarda şemasız yol döndürür; expo-sharing yerel
      // dosya için file:// bekler → eksikse ekle (Android'de sessiz başarısızlık).
      const shareUri = /^(file|content):\/\//.test(uri) ? uri : `file://${uri}`;
      await Sharing.shareAsync(shareUri, {
        mimeType: "image/png",
        dialogTitle: str.brand,
        UTI: "public.png",
      });
    } catch (e) {
      Toast.show({ type: "error", text1: str.errorPrefix + (e?.message || e) });
    } finally {
      setBusyAction(null);
    }
  }, [busy, capture, str]);

  const handleSave = useCallback(async () => {
    if (busy) return;
    try {
      setBusyAction("save");
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Toast.show({ type: "error", text1: str.galleryPermission });
        return;
      }
      const uri = await capture();
      await saveToLibraryAsync(uri);
      // Kaydederken arşivi de güncelle (üzerine yaz).
      if (uid) archiveWrapped(uid, recap.year, recap);
      Toast.show({ type: "success", text1: str.savedToast });
    } catch (e) {
      Toast.show({ type: "error", text1: str.errorPrefix + e.message });
    } finally {
      setBusyAction(null);
    }
  }, [busy, capture, str, uid, recap]);

  const onSelectYear = useCallback((y) => setYear(y), []);
  const close = useCallback(() => navigation.goBack(), [navigation]);

  // ── Boş durum ──
  if (!hasData) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <WrappedSlideFrame accent={SLIDE_COLORS[3]} topInset={insets.top}>
          <Ionicons
            name="film-outline"
            size={56}
            color="rgba(255,255,255,0.85)"
          />
          <Text style={styles.emptyTitle} allowFontScaling={false}>
            {str.emptyTitle}
          </Text>
          <Text style={styles.emptySub} allowFontScaling={false}>
            {str.emptySubtitle}
          </Text>
        </WrappedSlideFrame>
        <CloseButton onPress={close} top={insets.top + 10} />
      </View>
    );
  }

  const accent = SLIDE_COLORS[index % SLIDE_COLORS.length];
  const ActiveComp = slides[index]?.Comp;
  const slideLabel =
    {
      intro: str.brand,
      total: str.totalTitle,
      movies: str.moviesTitle,
      tv: str.tvTitle,
      genres: str.genresTitle,
      shows: str.topShowsTitle,
      busy: str.busiestTitle,
      busyMonth: str.busiestMonthTitle,
      personality: str.personalityTitle,
      summary: str.summaryTitle,
    }[slides[index]?.key] || str.brand;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Alt katman: dokunma navigasyon bölgeleri ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.tapRow}>
          <Pressable
            style={styles.tapLeft}
            onPress={tapPrev}
            onPressIn={holdOn}
            onPressOut={holdOff}
            onLongPress={() => {}}
            delayLongPress={180}
          />
          <Pressable
            style={styles.tapRight}
            onPress={tapNext}
            onPressIn={holdOn}
            onPressOut={holdOff}
            onLongPress={() => {}}
            delayLongPress={180}
          />
        </View>
      </View>

      {/* ── Üst katman: aktif slayt (box-none → boş alan taps alt bölgeye geçer) ── */}
      <Animated.View
        key={`${year}-${index}`}
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: slideTransition,
            transform: [
              {
                translateY: slideTransition.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
              {
                scale: slideTransition.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.975, 1],
                }),
              },
            ],
          },
        ]}
        pointerEvents="box-none"
      >
        {isSummary ? (
          <SummarySlide
            cardRef={cardRef}
            recap={recap}
            str={str}
            theme={theme}
            language={language}
            getTmdbUrl={getTmdbUrl}
            userName={user?.displayName || ""}
            topInset={insets.top}
            bottomInset={insets.bottom}
            cardWidth={shareCardSize.width}
            cardHeight={shareCardSize.height}
            busy={busy}
            busyAction={busyAction}
            cardOptions={cardOptions}
            onCustomize={() => setShowCustomizer(true)}
            onThemeChange={(themeId) => updateCardOption("themeId", themeId)}
            onSave={handleSave}
            onShare={handleShare}
          />
        ) : ActiveComp ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <ActiveComp
              recap={recap}
              str={str}
              theme={theme}
              language={language}
              getTmdbUrl={getTmdbUrl}
              topInset={insets.top}
              accent={accent}
              years={route?.params?.hideYearPicker ? [year] : availableYears}
              onSelectYear={onSelectYear}
            />
          </View>
        ) : null}
      </Animated.View>

      {/* ── Chrome: progress + kapat (en üstte, dokunmaları yakalar) ── */}
      <View style={styles.chromeTop} pointerEvents="box-none">
        <WrappedProgress
          count={slides.length}
          activeIndex={index}
          progressAnim={progressAnim}
          topInset={insets.top}
        />
      </View>

      {/* ── Alt navigasyon okları (kaydırmalı slaytlarda da güvenilir geçiş) ── */}
      {!isSummary && (
        <View
          style={[styles.navRow, { bottom: insets.bottom + 22 }]}
          pointerEvents="box-none"
        >
          {index > 0 ? (
            <TouchableOpacity
              style={styles.navBtn}
              onPress={tapPrev}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.navBtn} />
          )}
          <View style={styles.navMeta} pointerEvents="none">
            <Text style={styles.navMetaCount} allowFontScaling={false}>
              {String(index + 1).padStart(2, "0")} /{" "}
              {String(slides.length).padStart(2, "0")}
            </Text>
            <Text
              style={styles.navMetaLabel}
              allowFontScaling={false}
              numberOfLines={1}
            >
              {slideLabel}
            </Text>
          </View>
          {index < lastIndex ? (
            <TouchableOpacity
              style={styles.navBtnPrimary}
              onPress={tapNext}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-forward" size={22} color="#000" />
            </TouchableOpacity>
          ) : (
            <View style={styles.navBtn} />
          )}
        </View>
      )}

      {/* ── Çarpı sol üst, durdur/devam sağ üst ── */}
      <CloseButton onPress={close} top={insets.top + 18} />
      {isAuto && (
        <PausePlayButton
          paused={userPaused}
          onPress={togglePause}
          top={insets.top + 18}
        />
      )}

      <ShareCustomizerSheet
        visible={showCustomizer}
        options={cardOptions}
        str={str}
        theme={theme}
        hasPosterChoice={Boolean(
          recap.topShows?.length && recap.moviePosters?.length
        )}
        hasUserName={Boolean((user?.displayName || "").trim())}
        onChange={updateCardOption}
        onReset={resetCardOptions}
        onClose={() => setShowCustomizer(false)}
      />
    </View>
  );
}

// ─── Özet (son) slayt: kart + Kaydet/Paylaş ──────────────────────────────────

function SummarySlide({
  cardRef,
  recap,
  str,
  theme,
  language,
  getTmdbUrl,
  userName,
  topInset,
  bottomInset,
  cardWidth,
  cardHeight,
  busy,
  busyAction,
  cardOptions,
  onCustomize,
  onThemeChange,
  onSave,
  onShare,
}) {
  const palette = getWrappedCardPalette(cardOptions.themeId, theme.accent);
  const accentForeground = foregroundForPalette(palette);
  const secondary = palette.secondary || palette.accent;

  // Başlık + dock, karttan hemen sonra hafifçe süzülerek girer (yalnız mount).
  const intro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(intro, {
      toValue: 1,
      duration: 520,
      delay: 140,
      useNativeDriver: true,
    }).start();
  }, [intro]);
  const introRise = intro.interpolate({
    inputRange: [0, 1],
    outputRange: [22, 0],
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[palette.colors[2], "#08070B", "#000"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.summaryGlow,
          { backgroundColor: palette.accent, opacity: 0.2 },
        ]}
      />
      <View
        style={[
          styles.summaryGlowAlt,
          { backgroundColor: secondary, opacity: 0.13 },
        ]}
      />

      <View
        style={[
          styles.summaryWrap,
          { paddingTop: topInset + 16, paddingBottom: bottomInset + 12 },
        ]}
      >
        <Animated.View style={[styles.summaryHeader, { opacity: intro }]}>
          <Ionicons name="sparkles" size={15} color={palette.accent} />
          <Text style={styles.summaryHeadline} allowFontScaling={false}>
            {str.shareCardReady}
          </Text>
        </Animated.View>
        <View
          ref={cardRef}
          collapsable={false}
          style={[
            styles.cardShadow,
            {
              shadowColor: palette.accent,
              borderRadius: Math.round(cardHeight * 0.053),
            },
          ]}
        >
          <WrappedShareCard
            recap={recap}
            str={str}
            theme={theme}
            language={language}
            getTmdbUrl={getTmdbUrl}
            userName={userName}
            width={cardWidth}
            height={cardHeight}
            customization={cardOptions}
          />
        </View>

        <Animated.View
          style={[
            styles.dock,
            { opacity: intro, transform: [{ translateY: introRise }] },
          ]}
        >
          <View style={styles.dockThemeRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.swatchRow}
              style={styles.swatchScroll}
            >
              {WRAPPED_CARD_THEMES.map((item) => {
                const active = cardOptions.themeId === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={str[item.labelKey]}
                    accessibilityState={{ selected: active }}
                    onPress={() => onThemeChange(item.id)}
                    disabled={busy}
                    style={styles.swatchTap}
                  >
                    <View
                      style={[
                        styles.swatchRing,
                        active && { borderColor: palette.accent },
                      ]}
                    >
                      <LinearGradient
                        colors={[item.accent, item.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.swatch}
                      />
                    </View>
                    {active && (
                      <View
                        style={[
                          styles.swatchCheck,
                          { backgroundColor: palette.accent },
                        ]}
                      >
                        <Ionicons
                          name="checkmark"
                          size={9}
                          color={accentForeground}
                        />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.customizeChip}
              onPress={onCustomize}
              disabled={busy}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={str.customize}
            >
              <Ionicons name="options-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.dockDivider} />

          <View style={styles.summaryActions}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.saveBtn,
                busy && styles.actionDisabled,
              ]}
              onPress={onSave}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busyAction === "save" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={19} color="#fff" />
                  <Text style={styles.actionText} allowFontScaling={false}>
                    {str.save}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.shareBtn,
                busy && styles.actionDisabled,
              ]}
              onPress={onShare}
              disabled={busy}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[palette.accent, palette.secondary || palette.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.shareBtnFill}
              >
                {busyAction === "share" ? (
                  <ActivityIndicator size="small" color={accentForeground} />
                ) : (
                  <>
                    <Ionicons
                      name="share-social"
                      size={19}
                      color={accentForeground}
                    />
                    <Text
                      style={[styles.shareText, { color: accentForeground }]}
                      allowFontScaling={false}
                    >
                      {str.share}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Paylaşım kartı özelleştirme paneli ───────────────────────────────────────

function ShareCustomizerSheet({
  visible,
  options,
  str,
  theme,
  hasPosterChoice,
  hasUserName,
  onChange,
  onReset,
  onClose,
}) {
  const palette = getWrappedCardPalette(options.themeId, theme.accent);
  const accentForeground = foregroundForPalette(palette);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.customizerRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.customizerSheet}>
          <View style={styles.customizerHandle} />
          <View style={styles.customizerHeader}>
            <View
              style={[
                styles.customizerHeaderIcon,
                { backgroundColor: palette.accent },
              ]}
            >
              <Ionicons name="sparkles" size={18} color={accentForeground} />
            </View>
            <View style={styles.customizerHeaderCopy}>
              <Text style={styles.customizerTitle} allowFontScaling={false}>
                {str.customizeTitle}
              </Text>
              <Text style={styles.customizerSubtitle} allowFontScaling={false}>
                {str.customizeSubtitle}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={onReset}
              activeOpacity={0.78}
            >
              <Ionicons
                name="refresh"
                size={13}
                color="rgba(255,255,255,0.72)"
              />
              <Text style={styles.resetText} allowFontScaling={false}>
                {str.reset}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Seçenekler küçük ekranlarda taşabilir → başlık/Tamam sabit, orası kayar */}
          <ScrollView
            style={styles.customizerScroll}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <CustomizerLabel
              icon="color-palette-outline"
              label={str.colorTheme}
            />
            <View style={styles.themeOptions}>
              {WRAPPED_CARD_THEMES.map((item) => {
                const active = options.themeId === item.id;
                const itemPalette = getWrappedCardPalette(
                  item.id,
                  theme.accent
                );
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.themeOption,
                      active && {
                        borderColor: itemPalette.accent,
                        backgroundColor: "rgba(255,255,255,0.1)",
                      },
                    ]}
                    onPress={() => onChange("themeId", item.id)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <LinearGradient
                      colors={[itemPalette.colors[0], itemPalette.colors[2]]}
                      style={styles.themeSwatch}
                    >
                      {active && (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      )}
                    </LinearGradient>
                    <Text
                      style={[
                        styles.themeOptionText,
                        active && { color: "#fff" },
                      ]}
                      allowFontScaling={false}
                      numberOfLines={1}
                    >
                      {str[item.labelKey]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <CustomizerLabel icon="albums-outline" label={str.cardStyle} />
            <View style={styles.variantControl}>
              {[
                {
                  value: "glow",
                  label: str.styleGlow,
                  icon: "sparkles-outline",
                },
                {
                  value: "clean",
                  label: str.styleClean,
                  icon: "remove-outline",
                },
              ].map((item) => {
                const active = options.variant === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.variantBtn,
                      active && { backgroundColor: palette.accent },
                    ]}
                    onPress={() => onChange("variant", item.value)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                  >
                    <Ionicons
                      name={item.icon}
                      size={15}
                      color={
                        active ? accentForeground : "rgba(255,255,255,0.58)"
                      }
                    />
                    <Text
                      style={[
                        styles.variantText,
                        active && { color: accentForeground },
                      ]}
                      allowFontScaling={false}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Poster bölümü dizi mi film mi göstersin (ikisi de varsa) */}
            {hasPosterChoice && (
              <>
                <CustomizerLabel
                  icon="images-outline"
                  label={str.posterContentLabel}
                />
                <View style={styles.variantControl}>
                  {[
                    {
                      value: "shows",
                      label: str.postersShows,
                      icon: "tv-outline",
                    },
                    {
                      value: "movies",
                      label: str.postersMovies,
                      icon: "film-outline",
                    },
                  ].map((item) => {
                    const active =
                      (options.posterContent || "shows") === item.value;
                    return (
                      <TouchableOpacity
                        key={item.value}
                        style={[
                          styles.variantBtn,
                          active && { backgroundColor: palette.accent },
                        ]}
                        onPress={() => onChange("posterContent", item.value)}
                        activeOpacity={0.8}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                      >
                        <Ionicons
                          name={item.icon}
                          size={15}
                          color={
                            active ? accentForeground : "rgba(255,255,255,0.58)"
                          }
                        />
                        <Text
                          style={[
                            styles.variantText,
                            active && { color: accentForeground },
                          ]}
                          allowFontScaling={false}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <CustomizerLabel icon="eye-outline" label={str.visibleSections} />
            <View style={styles.visibilityRow}>
              {[
                {
                  key: "showPersonality",
                  label: str.personalityOption,
                  icon: "happy-outline",
                },
                {
                  key: "showStats",
                  label: str.statsOption,
                  icon: "grid-outline",
                },
                {
                  key: "showGenres",
                  label: str.genresOption,
                  icon: "pricetags-outline",
                },
                {
                  key: "showPosters",
                  label: str.postersOption,
                  icon: "images-outline",
                },
                ...(hasUserName
                  ? [
                      {
                        key: "showName",
                        label: str.nameOption,
                        icon: "person-outline",
                      },
                    ]
                  : []),
              ].map((item) => {
                // Eski seçeneklerde anahtar yoksa "açık" say (kartla aynı kural).
                const active = options[item.key] !== false;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.visibilityBtn,
                      active && {
                        borderColor: palette.accent,
                        backgroundColor: "rgba(255,255,255,0.1)",
                      },
                    ]}
                    onPress={() => onChange(item.key, !active)}
                    activeOpacity={0.8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                  >
                    <View
                      style={[
                        styles.visibilityCheck,
                        active && {
                          backgroundColor: palette.accent,
                          borderColor: palette.accent,
                        },
                      ]}
                    >
                      {active && (
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={accentForeground}
                        />
                      )}
                    </View>
                    <Ionicons name={item.icon} size={16} color="#fff" />
                    <Text
                      style={styles.visibilityText}
                      allowFontScaling={false}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: palette.accent }]}
            onPress={onClose}
            activeOpacity={0.84}
          >
            <Text
              style={[styles.doneText, { color: accentForeground }]}
              allowFontScaling={false}
            >
              {str.done}
            </Text>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={accentForeground}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CustomizerLabel({ icon, label }) {
  return (
    <View style={styles.customizerLabelRow}>
      <Ionicons name={icon} size={12} color="rgba(255,255,255,0.48)" />
      <Text style={styles.customizerLabel} allowFontScaling={false}>
        {label}
      </Text>
    </View>
  );
}

// ─── Kapat butonu ────────────────────────────────────────────────────────────

function CloseButton({ onPress, top }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={[styles.closeBtn, { top }]}
    >
      <Ionicons name="close" size={24} color="#fff" />
    </TouchableOpacity>
  );
}

// ─── Durdur / Devam butonu (sağ üst) ─────────────────────────────────────────

function PausePlayButton({ paused, onPress, top }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={[styles.pauseBtn, { top }]}
    >
      <Ionicons name={paused ? "play" : "pause"} size={20} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  tapRow: { flex: 1, flexDirection: "row" },
  tapLeft: { width: "30%", height: "100%" },
  tapRight: { width: "70%", height: "100%" },

  chromeTop: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 },
  navRow: {
    position: "absolute",
    left: 22,
    right: 22,
    zIndex: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnPrimary: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  navMeta: {
    maxWidth: 170,
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.26)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  navMetaCount: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  navMetaLabel: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  closeBtn: {
    position: "absolute",
    left: 16,
    zIndex: 30,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  pauseBtn: {
    position: "absolute",
    right: 16,
    zIndex: 30,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 18,
    letterSpacing: -0.5,
  },
  emptySub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 10,
    lineHeight: 21,
  },

  summaryGlow: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    top: -140,
    right: -130,
  },
  summaryGlowAlt: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    bottom: -120,
    left: -120,
  },
  summaryWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  summaryHeadline: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  cardShadow: {
    borderRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 18,
  },
  dock: {
    width: "100%",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 12,
    gap: 11,
  },
  dockThemeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  swatchScroll: { flex: 1 },
  swatchRow: { gap: 13, paddingHorizontal: 2, alignItems: "center" },
  swatchTap: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "transparent",
    padding: 2,
  },
  swatch: { flex: 1, borderRadius: 13 },
  swatchCheck: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#0b0a0f",
    alignItems: "center",
    justifyContent: "center",
  },
  customizeChip: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  dockDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 2,
  },
  summaryActions: {
    flexDirection: "row",
    gap: 11,
    width: "100%",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 18,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  shareBtn: { flex: 1.4, overflow: "hidden" },
  shareBtnFill: {
    flex: 1,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  shareText: { fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
  actionDisabled: { opacity: 0.58 },
  actionText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  customizerRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.66)",
  },
  customizerSheet: {
    maxHeight: "86%",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#111014",
  },
  customizerScroll: { flexGrow: 0 },
  customizerHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginBottom: 13,
  },
  customizerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  customizerHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  customizerHeaderCopy: { flex: 1 },
  customizerTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  customizerSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  resetBtn: {
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.07)",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resetText: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 9,
    fontWeight: "700",
  },
  customizerLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 7,
    marginTop: 3,
  },
  customizerLabel: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.55,
    textTransform: "uppercase",
  },
  themeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 14,
  },
  themeOption: {
    // 6 palet → satır başına 3 kutu (sarma ile 2 satır)
    flexBasis: "30%",
    flexGrow: 1,
    minWidth: 0,
    alignItems: "center",
    padding: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  themeSwatch: {
    width: "100%",
    aspectRatio: 1.55,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  themeOptionText: {
    color: "rgba(255,255,255,0.52)",
    fontSize: 8,
    fontWeight: "700",
    marginTop: 5,
  },
  variantControl: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 14,
  },
  variantBtn: {
    flex: 1,
    height: 35,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  variantText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 10,
    fontWeight: "800",
  },
  visibilityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  visibilityBtn: {
    // 4-5 anahtar → 2 sütunlu ızgara (tek kalan satırı doldurur)
    flexBasis: "47%",
    flexGrow: 1,
    height: 42,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.035)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  visibilityCheck: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  visibilityText: { flex: 1, color: "#fff", fontSize: 10, fontWeight: "700" },
  doneBtn: {
    height: 48,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  doneText: { fontSize: 13, fontWeight: "900" },
});
