// screens/wrapped/WrappedScreen.js
//
// Watchify Wrapped — yıllık izleme özeti (Spotify Wrapped tarzı tam ekran hikâye).
// Veri tamamen cihazda hesaplanır (utils/wrapped.js, ProfileStatsContext'ten);
// son slayt paylaşılabilir özet kartıdır (galeriye kaydet / paylaş). Geçmiş
// yıllar Lists/{uid}/wrapped/{year} altına arşivlenir (services/wrappedService).

import React, {
  useCallback,
  useEffect,
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
  Dimensions,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";

import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useProfileStats } from "../../context/ProfileStatsContext";
import { useImageQualitySettings } from "../../context/AppSettingsContext";

import { buildYearlyRecap, getAvailableYears } from "../../utils/wrapped";
import { getWrappedStrings } from "../../utils/wrappedStrings";
import { archiveWrapped, wrappedExists } from "../../services/wrappedService";
import WrappedShareCard from "../../components/wrapped/WrappedShareCard";
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const SLIDE_DURATION = 5200; // ms (otomatik geçiş)

// Özet kartı boyutu (9:16, dikey alana sığacak şekilde küçülür)
let CARD_W = SCREEN_W - 48;
let CARD_H = (CARD_W * 16) / 9;
const CARD_MAX_H = SCREEN_H - 240;
if (CARD_H > CARD_MAX_H) {
  CARD_H = CARD_MAX_H;
  CARD_W = (CARD_H * 9) / 16;
}

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
    [listItems],
  );
  const episodes = flatEpisodesTv || [];

  const availableYears = useMemo(
    () => getAvailableYears(movies, episodes),
    [movies, episodes],
  );

  // ── Seçili yıl ──
  const initialYear =
    route?.params?.year ?? availableYears[0] ?? new Date().getFullYear();
  const [year, setYear] = useState(initialYear);

  const recap = useMemo(
    () => buildYearlyRecap({ movies, episodes, year, language }),
    [movies, episodes, year, language],
  );

  const hasData =
    recap.totalMinutes > 0 || recap.totalMovies > 0 || recap.totalEpisodes > 0;

  // ── Slayt listesi (veri varlığına göre) ──
  const slides = useMemo(() => {
    if (!hasData) return [];
    const list = [{ key: "intro", Comp: IntroSlide }];
    if (recap.totalMinutes > 0) list.push({ key: "total", Comp: TotalTimeSlide });
    if (recap.totalMovies > 0) list.push({ key: "movies", Comp: MoviesSlide });
    if (recap.totalEpisodes > 0) list.push({ key: "tv", Comp: TvSlide });
    // Tür/dizi slaytları tüm listeyi gösterir → kaydırmalı + otomatik geçmez (manual).
    if (recap.allGenres.length > 0) list.push({ key: "genres", Comp: TopGenresSlide, manual: true });
    if (recap.allShows.length > 0) list.push({ key: "shows", Comp: TopShowsSlide, manual: true });
    if (recap.busiestMonth || recap.busiestDay) list.push({ key: "busy", Comp: BusiestSlide });
    if (recap.busiestMonth) list.push({ key: "busyMonth", Comp: BusiestMonthSlide });
    list.push({ key: "personality", Comp: PersonalitySlide });
    list.push({ key: "summary", Comp: null }); // özel: özet kartı
    return list;
  }, [hasData, recap]);

  const lastIndex = slides.length - 1;
  const [index, setIndex] = useState(0);
  const isSummary = index === lastIndex && slides[lastIndex]?.key === "summary";

  // ── İlerleme animasyonu (segmentli progress + otomatik geçiş) ──
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const pausedValRef = useRef(0);
  const [paused, setPaused] = useState(false);

  const goNext = useCallback(() => {
    setIndex((i) => (i < lastIndex ? i + 1 : i));
  }, [lastIndex]);
  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : 0));
  }, []);

  // Manuel dokunma → hafif dokunsal geri bildirim (otomatik geçişte sessiz).
  const tapNext = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    goNext();
  }, [goNext]);
  const tapPrev = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    goPrev();
  }, [goPrev]);

  const startTimer = useCallback(
    (from = 0) => {
      animRef.current?.stop();
      progressAnim.setValue(from);
      // Son slayt (özet) ve manuel (kaydırmalı) slaytlar otomatik geçmez.
      if (index >= lastIndex || slides[index]?.manual) {
        progressAnim.setValue(1);
        return;
      }
      const anim = Animated.timing(progressAnim, {
        toValue: 1,
        duration: Math.max(400, SLIDE_DURATION * (1 - from)),
        useNativeDriver: false,
      });
      animRef.current = anim;
      anim.start(({ finished }) => {
        if (finished) goNext();
      });
    },
    [index, lastIndex, goNext, progressAnim, slides],
  );

  // Slayt değişince ilerlemeyi sıfırla ve başlat.
  useEffect(() => {
    if (!hasData) return undefined;
    setPaused(false);
    startTimer(0);
    return () => animRef.current?.stop();
  }, [index, hasData, startTimer]);

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [isSummary]);

  const pause = useCallback(() => {
    animRef.current?.stop();
    progressAnim.stopAnimation((v) => {
      pausedValRef.current = v;
    });
    setPaused(true);
  }, [progressAnim]);

  const resume = useCallback(() => {
    setPaused(false);
    startTimer(pausedValRef.current ?? 0);
  }, [startTimer]);

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
  const [busy, setBusy] = useState(false);

  const capture = useCallback(async () => {
    // Kart zaten chrome içermiyor; doğrudan yakala.
    await new Promise((r) => requestAnimationFrame(() => r()));
    await new Promise((r) => setTimeout(r, 80));
    return captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
  }, []);

  const handleShare = useCallback(async () => {
    if (busy) return;
    try {
      setBusy(true);
      const uri = await capture();
      if (!(await Sharing.isAvailableAsync())) {
        Toast.show({ type: "error", text1: str.shareUnavailable });
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: str.brand });
    } catch (e) {
      Toast.show({ type: "error", text1: str.errorPrefix + e.message });
    } finally {
      setBusy(false);
    }
  }, [busy, capture, str]);

  const handleSave = useCallback(async () => {
    if (busy) return;
    try {
      setBusy(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Toast.show({ type: "error", text1: str.galleryPermission });
        return;
      }
      const uri = await capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      // Kaydederken arşivi de güncelle (üzerine yaz).
      if (uid) archiveWrapped(uid, recap.year, recap);
      Toast.show({ type: "success", text1: str.savedToast });
    } catch (e) {
      Toast.show({ type: "error", text1: str.errorPrefix + e.message });
    } finally {
      setBusy(false);
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
          <Ionicons name="film-outline" size={56} color="rgba(255,255,255,0.85)" />
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

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Alt katman: dokunma navigasyon bölgeleri ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.tapRow}>
          <Pressable
            style={styles.tapLeft}
            onPress={tapPrev}
            onPressIn={pause}
            onPressOut={resume}
            onLongPress={() => {}}
            delayLongPress={180}
          />
          <Pressable
            style={styles.tapRight}
            onPress={tapNext}
            onPressIn={pause}
            onPressOut={resume}
            onLongPress={() => {}}
            delayLongPress={180}
          />
        </View>
      </View>

      {/* ── Üst katman: aktif slayt (box-none → boş alan taps alt bölgeye geçer) ── */}
      {isSummary ? (
        <SummarySlide
          cardRef={cardRef}
          recap={recap}
          str={str}
          theme={theme}
          language={language}
          getTmdbUrl={getTmdbUrl}
          topInset={insets.top}
          bottomInset={insets.bottom}
          busy={busy}
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
            years={availableYears}
            onSelectYear={onSelectYear}
          />
        </View>
      ) : null}

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
        <View style={[styles.navRow, { bottom: insets.bottom + 22 }]} pointerEvents="box-none">
          {index > 0 ? (
            <TouchableOpacity style={styles.navBtn} onPress={tapPrev} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.navBtn} />
          )}
          {index < lastIndex ? (
            <TouchableOpacity style={styles.navBtnPrimary} onPress={tapNext} activeOpacity={0.85}>
              <Ionicons name="chevron-forward" size={22} color="#000" />
            </TouchableOpacity>
          ) : (
            <View style={styles.navBtn} />
          )}
        </View>
      )}

      <CloseButton onPress={close} top={insets.top + 18} />
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
  topInset,
  bottomInset,
  busy,
  onSave,
  onShare,
}) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} />
      <View style={[styles.summaryWrap, { paddingTop: topInset + 56, paddingBottom: bottomInset + 18 }]}>
        <View ref={cardRef} collapsable={false} style={styles.cardShadow}>
          <WrappedShareCard
            recap={recap}
            str={str}
            theme={theme}
            language={language}
            getTmdbUrl={getTmdbUrl}
            width={CARD_W}
            height={CARD_H}
          />
        </View>

        <View style={styles.summaryActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.saveBtn]}
            onPress={onSave}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={19} color="#fff" />
                <Text style={styles.actionText}>{str.save}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.shareBtn]}
            onPress={onShare}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Ionicons name="share-social-outline" size={19} color="#000" />
            <Text style={[styles.actionText, { color: "#000" }]}>{str.share}</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  closeBtn: {
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

  emptyTitle: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 18, letterSpacing: -0.5 },
  emptySub: { color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: "600", marginTop: 10, lineHeight: 21 },

  summaryWrap: { flex: 1, alignItems: "center", justifyContent: "space-between" },
  cardShadow: {
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 16,
  },
  summaryActions: { flexDirection: "row", gap: 12, width: "100%", paddingHorizontal: 24, marginTop: 18 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
  },
  saveBtn: { backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  shareBtn: { backgroundColor: "#fff" },
  actionText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
