// screens/wrapped/WrappedScreen.js
//
// Seelogd Wrapped — yıllık izleme özeti (Spotify Wrapped tarzı tam ekran hikâye).
// Veri tamamen cihazda hesaplanır (utils/wrapped.js, ProfileStatsContext'ten);
// son slayt paylaşılabilir özet kartıdır: canlı önizleme + özelleştirme paneli +
// galeriye kaydet / paylaş (components/wrapped/WrappedShareEditor.js). Geçmiş
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
  AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
// SDK 57: `saveToLibraryAsync` ana giriste calisma aninda hata firlatiyor;
// legacy girisinden alinmali (izin fonksiyonlari ana giriste gecerli).
import { saveToLibraryAsync } from "expo-media-library/legacy";
import * as Haptics from "@services/hapticsService";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "@components/AppToast";
import ScreenToastHost from "@components/toast/ScreenToastHost";

import { useTheme } from "../../context/ThemeContext";
import GlassIconButton from "../../components/common/GlassIconButton";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useProfileStats } from "../../context/ProfileStatsContext";
import { useImageQualitySettings } from "../../context/AppSettingsContext";

import { buildYearlyRecap, getAvailableYears, getYearPace } from "../../utils/wrapped";
import { WRAPPED_CARD_CAPTURE } from "../../utils/wrappedCard";
import { captureStoryCard, toShareableUri } from "../../services/storyShare/storyShareService";
import { getWrappedStrings } from "../../utils/wrappedStrings";
import { archiveWrapped, wrappedExists } from "../../services/wrappedService";
import { canViewWrappedYear, pickViewableWrappedYear } from "../../utils/premiumFeatures";
import { usePremiumGate } from "../../hooks/usePremiumGate";
import WrappedShareEditor from "../../components/wrapped/WrappedShareEditor";
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
  ConsistencySlide,
  PersonalitySlide,
} from "../../components/wrapped/WrappedSlides";

const SLIDE_DURATION = 5200; // ms (otomatik geçiş)

export default function WrappedScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const uid = user?.uid;
  const insets = useSafeAreaInsets();
  const { getTmdbUrl } = useImageQualitySettings();
  const { listItems, flatEpisodesTv } = useProfileStats();

  const str = useMemo(() => getWrappedStrings(language), [language]);

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
  // Wrapped arşivi: Free yalnız bu yılı, Premium son 5 yılı görür, Max'te sınır
  // yok (utils/premiumFeatures.js `wrapped_archive`). Parametre yoksa görülebilen
  // en yeni yıl açılır.
  const wrappedGate = usePremiumGate("wrapped_archive");
  const initialYear =
    route?.params?.year ??
    pickViewableWrappedYear(availableYears, wrappedGate.plan) ??
    availableYears[0] ??
    new Date().getFullYear();
  const [year, setYear] = useState(initialYear);
  const yearLocked = !canViewWrappedYear(year, wrappedGate.plan);

  const recap = useMemo(
    () => buildYearlyRecap({ movies, episodes, year, language }),
    [movies, episodes, year, language]
  );

  // Geçen yıla kıyas (devam eden yılda yalnız aynı dönem — utils/wrapped.js).
  const pace = useMemo(
    () => getYearPace({ movies, episodes, year }),
    [movies, episodes, year]
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
    // Eski arşivlenmiş özetlerde ısı haritası verisi yoktur.
    if (recap.activeDays > 0 && Array.isArray(recap.dayHeat))
      list.push({ key: "consistency", Comp: ConsistencySlide });
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
  const busy = busyAction !== null;

  // Kart 360x640 yerleşir; çıktı 1080x1920 olarak yeniden çizilir (önizleme
  // küçük de olsa kayıt tam çözünürlüktedir). Gradient ve expo-image katmanları
  // boyanmadan yakalama boş çıkabilir: servis kısa bekleme + tek yeniden deneme
  // yapar; poster indirmelerini ise düzenleyici ekran bekletir.
  const capture = useCallback(async () => {
    if (!cardRef.current) throw new Error("card-not-ready");
    await new Promise((r) => requestAnimationFrame(() => r()));
    await new Promise((r) => requestAnimationFrame(() => r()));
    return captureStoryCard(cardRef, WRAPPED_CARD_CAPTURE);
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
      await Sharing.shareAsync(toShareableUri(uri), {
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
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
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

  const onSelectYear = useCallback(
    (y) => {
      if (!canViewWrappedYear(y, wrappedGate.plan)) {
        wrappedGate.showUpsell();
        return;
      }
      setYear(y);
    },
    [wrappedGate],
  );
  const close = useCallback(() => navigation.goBack(), [navigation]);

  // Kilitli bir yılla açıldıysa (eski yılın kartı) ekran içerik çizmeden
  // kapanır ve Premium uyarısı çıkar.
  useEffect(() => {
    if (!yearLocked) return;
    navigation.goBack();
    wrappedGate.showUpsell();
    // Yalnız açılışta: yıl seçici kilitli yıla zaten geçirmez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kilitli yıl: yukarıdaki efekt ekranı kapatıyor; o kareye içerik çizme.
  if (yearLocked) return null;

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
      consistency: str.consistencyTitle,
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
          <WrappedShareEditor
            cardRef={cardRef}
            recap={recap}
            str={str}
            theme={theme}
            language={language}
            getTmdbUrl={getTmdbUrl}
            userName={user?.displayName || ""}
            pace={pace}
            topInset={insets.top}
            bottomInset={insets.bottom}
            busy={busy}
            busyAction={busyAction}
            onSave={handleSave}
            onShare={handleShare}
            onBack={tapPrev}
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
              pace={pace}
              step={index}
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
            <GlassIconButton
              variant="blur"
              flatFallback
              icon="chevron-back"
              iconSize={22}
              size={48}
              fallbackRadius={24}
              fallbackStyle={styles.navBtn}
              onPress={tapPrev}
            />
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
            <GlassIconButton
              variant="blur"
              flatFallback
              icon="chevron-forward"
              iconSize={22}
              size={52}
              fallbackRadius={26}
              color="#000"
              tint="#FFFFFF"
              fallbackStyle={styles.navBtnPrimary}
              onPress={tapNext}
            />
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
      {/* Tam ekran modal: iOS'ta kökteki toast bu sayfanın ARKASINDA kalır. */}
      <ScreenToastHost />
    </View>
  );
}

// ─── Kapat butonu ────────────────────────────────────────────────────────────

function CloseButton({ onPress, top }) {
  return (
    <GlassIconButton
      variant="blur"
      flatFallback
      icon="close"
      iconSize={24}
      size={38}
      fallbackRadius={19}
      hitSlop={10}
      fallbackStyle={styles.floatingBtnFallback}
      style={[styles.closeBtn, { top }]}
      onPress={onPress}
    />
  );
}

// ─── Durdur / Devam butonu (sağ üst) ─────────────────────────────────────────

function PausePlayButton({ paused, onPress, top }) {
  return (
    <GlassIconButton
      variant="blur"
      flatFallback
      icon={paused ? "play" : "pause"}
      iconSize={20}
      size={38}
      fallbackRadius={19}
      hitSlop={10}
      fallbackStyle={styles.floatingBtnFallback}
      style={[styles.pauseBtn, { top }]}
      onPress={onPress}
    />
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
  },
  pauseBtn: {
    position: "absolute",
    right: 16,
    zIndex: 30,
  },
  // Çarpı ve durdur/devam düğmelerinin eski (cam yokken) zemini.
  floatingBtnFallback: {
    backgroundColor: "rgba(0,0,0,0.4)",
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
});
