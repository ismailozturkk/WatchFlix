// components/video/TrailerSection.js
//
// Film/Dizi detayındaki "Videolar" (fragman/trailer) bölümü.
//   • Dil seçimi: varsayılan İngilizce + uygulama dili + diğer diller (seçilebilir).
//     TMDB videoları seçilen dile göre ayrıca çekilir (append_to_response yerine
//     bağımsız /videos isteği), böylece uygulama dili Türkçe olsa bile orijinal /
//     İngilizce fragmanlara erişilebilir.
//   • Oynatıcı karartılmış sinema modalında açılır; cihazın mevcut yönüne göre
//     16:9 oranını taşmadan sığdırır ve YouTube dışa açma/kapatma kontrollerini
//     videodan bağımsız sabit tutar.
//   • İki yerleşim: `variant="section"` (varsayılan) Film/Dizi detayındaki başlıklı,
//     yatay kaydırmalı şerit; `variant="sheet"` sohbetteki fragman sayfasının
//     (TrailerModal) içeriği — başlıksız, dikey liste, kenardan kenara çipler.
//     Veri çekme, dil sırası ve oynatıcı iki yerleşimde de AYNI.

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Animated,
  Linking,
  useWindowDimensions,
} from "react-native";
import axios from "axios";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AdaptiveBlurView from "../common/AdaptiveBlurView";
import BottomSheetModal from "../common/BottomSheetModal";
import GlassCloseButton from "../common/GlassCloseButton";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import SheetScroll from "../common/SheetScroll";
import { Image } from "expo-image";
import YoutubePlayer from "react-native-youtube-iframe";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { i18nText } from "../../utils/i18nText";
import { normalizeAppLanguage } from "../../utils/appLanguages";
import { alpha } from "../../theme/colors";
import MovieVideoItem from "../../screens/movie/components/MovieVideoItem";
import TrailerVideoList, { SHEET_GUTTER } from "./TrailerVideoList";
import {
  TRAILER_LANGUAGES,
  buildTrailerLanguageOrder,
  normalizeTrailerLanguageCode,
  trailerLanguageOf,
} from "../../utils/trailerLanguages";
import GlassTouchable from "../common/GlassTouchable";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

// Fragmanları öne al (Trailer > Teaser > Clip ...), resmi olanları üste.
const TYPE_ORDER = { Trailer: 0, Teaser: 1, Clip: 2, Featurette: 3, Behind: 4 };
const sortVideos = (list) =>
  [...list].sort(
    (a, b) =>
      (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) ||
      (b.official ? 1 : 0) - (a.official ? 1 : 0),
  );

/* ───────────────────────── Tam ekran oynatıcı ───────────────────────── */
function TrailerPlayerModal({ visible, video, onClose, theme }) {
  const { width: SW, height: SH } = useWindowDimensions();
  const videoId = video?.key || null;
  const videoTitle = video?.name || i18nText("autoI18n.fragman", "Fragman");
  // "loading" → player hazır olana dek kapak + spinner; "error" → tekrar dene /
  // YouTube'da aç. Player remount olduğunda tekrar "loading".
  const [playerState, setPlayerState] = useState("loading");
  const [retryKey, setRetryKey] = useState(0);
  const appearAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setRetryKey(0);
    appearAnim.setValue(0);
    Animated.timing(appearAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, videoId, appearAnim]);

  // Player remount eden her değişiklikte yükleme katmanına dön.
  useEffect(() => {
    setPlayerState("loading");
  }, [videoId, retryKey]);

  const playerFit = useMemo(() => {
    const ar = 16 / 9;
    const maxW = Math.min(SW - 24, 980);
    const reservedH = SW > SH ? 88 : 160;
    const maxH = Math.max(210, SH - reservedH);
    let w = maxW;
    let h = w / ar;
    if (h > maxH) {
      h = maxH;
      w = h * ar;
    }
    return { w: Math.round(w), h: Math.round(h) };
  }, [SH, SW]);

  const appearScale = appearAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      transparent
      supportedOrientations={["portrait", "landscape"]}
    >
      <View style={styles.playerRoot}>
        <ModalBlurBackdrop intensity={60} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          style={[
            styles.playerCard,
            {
              width: Math.min(SW - 24, 1020),
              opacity: appearAnim,
              transform: [{ scale: appearScale }],
            },
          ]}
        >
          <View style={styles.playerTopBar}>
            <View style={styles.playerTitleWrap}>
              <Text style={styles.playerKicker} allowFontScaling={false}>
                {video?.type || i18nText("autoI18n.video", "Video")}
              </Text>
              <Text style={styles.playerTitle} allowFontScaling={false} numberOfLines={1}>
                {videoTitle}
              </Text>
            </View>
            <View style={styles.playerTopActions}>
              <TouchableOpacity
                onPress={() =>
                  videoId &&
                  Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`).catch(
                    () => {},
                  )
                }
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.youtube_da_ac", "YouTube'da aç")}
              >
                <AdaptiveBlurView tint="dark" intensity={45} style={styles.playerBtn}>
                  <Ionicons name="logo-youtube" size={19} color="#fff" />
                </AdaptiveBlurView>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
              >
                <AdaptiveBlurView tint="dark" intensity={45} style={styles.playerBtn}>
                  <Ionicons name="close" size={20} color="#fff" />
                </AdaptiveBlurView>
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.playerStage,
              { width: playerFit.w, height: playerFit.h },
            ]}
          >
          {videoId && playerState !== "error" ? (
            <YoutubePlayer
              key={`${videoId}-${retryKey}`}
              width={playerFit.w}
              height={playerFit.h}
              videoId={videoId}
              play
              onReady={() => setPlayerState("ready")}
              onError={() => setPlayerState("error")}
            />
          ) : null}

          {/* Player hazır olana dek siyah kutu yerine video kapağı + spinner;
              hata durumunda tekrar dene / YouTube'a git seçenekleri. */}
          {playerState !== "ready" && videoId && (
            <View
              style={styles.playerOverlay}
              pointerEvents={playerState === "error" ? "box-none" : "none"}
            >
              <Image
                source={{ uri: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
              />
              <View style={styles.playerOverlayDim} />
              {playerState === "loading" ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <View style={styles.playerErrorBox}>
                  <Ionicons name="cloud-offline-outline" size={30} color="#fff" />
                  <Text style={styles.playerErrorText} allowFontScaling={false}>
                    {i18nText("autoI18n.video_yuklenemedi", "Video yüklenemedi")}
                  </Text>
                  <View style={styles.playerErrorActions}>
                    <TouchableOpacity
                      style={[styles.playerErrorBtn, { backgroundColor: theme.accent }]}
                      onPress={() => setRetryKey((k) => k + 1)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="refresh" size={15} color="#fff" />
                      <Text style={styles.playerErrorBtnText} allowFontScaling={false}>
                        {i18nText("autoI18n.tekrar_dene", "Tekrar Dene")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.playerErrorBtn, styles.playerErrorBtnGhost]}
                      onPress={() =>
                        Linking.openURL(
                          `https://www.youtube.com/watch?v=${videoId}`,
                        ).catch(() => {})
                      }
                      activeOpacity={0.85}
                    >
                      <Ionicons name="logo-youtube" size={15} color="#fff" />
                      <Text style={styles.playerErrorBtnText} allowFontScaling={false}>
                        {i18nText("autoI18n.youtube_da_ac", "YouTube'da aç")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ───────────────────────── Dil seçim sayfası ───────────────────────── */
function LanguageSheet({ visible, selected, originalLanguage, onSelect, onClose, theme }) {
  const insets = useSafeAreaInsets();
  const languages = useMemo(() => {
    const original = trailerLanguageOf(originalLanguage);
    return TRAILER_LANGUAGES.some((language) => language.code === original.code)
      ? TRAILER_LANGUAGES
      : [original, ...TRAILER_LANGUAGES];
  }, [originalLanguage]);
  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 18),
        },
      ]}
    >
      <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
      <View style={styles.sheetHeader}>
        <View style={[styles.sheetTitleIcon, { backgroundColor: alpha(theme.accent, 0.16) }]}>
          <Ionicons name="globe-outline" size={19} color={theme.accent} />
        </View>
        <Text style={[styles.sheetTitle, { color: theme.text.primary }]} numberOfLines={1}>
          {i18nText("autoI18n.video_dili", "Video Dili")}
        </Text>
        <GlassCloseButton
          size={36}
          fallbackRadius={18}
          iconSize={21}
          color={theme.text.primary}
          backgroundColor={theme.between}
          onPress={onClose}
        />
      </View>
      <SheetScroll style={styles.sheetListScroll} contentContainerStyle={styles.sheetList}>
        {languages.map((l) => {
          const active = l.code === selected;
          return (
            <GlassTouchable
              key={l.code}
              activeOpacity={0.8}
              style={[
                styles.sheetRow,
                {
                  backgroundColor: active ? alpha(theme.accent, 0.14) : theme.between,
                  borderColor: active ? alpha(theme.accent, 0.5) : theme.border,
                },
              ]}
              onPress={() => onSelect(l.code)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.sheetRowText, { color: theme.text.primary }]}>{l.label}</Text>
              {active ? (
                <Ionicons name="checkmark-circle" size={21} color={theme.accent} />
              ) : (
                <View style={[styles.sheetRowDot, { borderColor: theme.border }]} />
              )}
            </GlassTouchable>
          );
        })}
      </SheetScroll>
    </BottomSheetModal>
  );
}

/* ───────────────────────── Ana bölüm ───────────────────────── */
export default function TrailerSection({
  mediaType,
  id,
  apiKey,
  originalLanguage,
  variant = "section",
  bottomInset = 0,
}) {
  const { theme } = useTheme();
  const { language, t } = useLanguage();
  const isSheet = variant === "sheet";
  // Uygulama dili fragman dili de olabilir (TRAILER_LANGUAGES: tr/en/es/…); tanınmayan → en.
  const appLangCode = normalizeAppLanguage(language);

  const normalizedOriginalLanguage = normalizeTrailerLanguageCode(originalLanguage);
  const [selectedLang, setSelectedLang] = useState(appLangCode);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  // Dil başına çekilen videoları önbelleğe alır; çipler arası geçişte aynı dil
  // için tekrar ağ isteği atılmaz.
  const videoCacheRef = useRef({});
  const runIdRef = useRef(0);

  const fetchVideosForLang = useCallback(
    async (langCode) => {
      const code = normalizeTrailerLanguageCode(langCode);
      if (videoCacheRef.current[code] !== undefined) {
        return videoCacheRef.current[code];
      }
      try {
        const res = await axios.request({
          method: "GET",
          url: `https://api.themoviedb.org/3/${mediaType}/${id}/videos`,
          params: { language: trailerLanguageOf(code).region },
          headers: { accept: "application/json", Authorization: apiKey },
        });
        const yt = (res.data?.results || []).filter((v) => v.site === "YouTube");
        const sorted = sortVideos(yt);
        videoCacheRef.current[code] = sorted;
        return sorted;
      } catch (err) {
        videoCacheRef.current[code] = [];
        return [];
      }
    },
    [mediaType, id, apiKey],
  );

  // ── İlk açılış ve dizi/film değişiminde dil öncelik sıralaması ──
  // Kural:
  //   1. Varsa ilk başta seçili dil (uygulama dili) için gösterilsin,
  //   2. Yoksa İngilizce olsun,
  //   3. O da yoksa içeriğin ana dilinde var ise o şekilde fragman gösterilsin.
  useEffect(() => {
    let cancelled = false;
    const runId = ++runIdRef.current;
    videoCacheRef.current = {};
    setLoading(true);

    const fallbackCandidates = [
      ...new Set([
        appLangCode,
        "en",
        normalizedOriginalLanguage,
      ]),
    ].filter(Boolean);

    (async () => {
      let resolvedLang = fallbackCandidates[0] || "en";
      let resolvedVideos = [];

      for (const candidate of fallbackCandidates) {
        if (cancelled || runId !== runIdRef.current) return;
        const list = await fetchVideosForLang(candidate);
        if (list.length > 0) {
          resolvedLang = candidate;
          resolvedVideos = list;
          break;
        }
      }

      if (cancelled || runId !== runIdRef.current) return;
      setSelectedLang(resolvedLang);
      setVideos(resolvedVideos);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, mediaType, appLangCode, normalizedOriginalLanguage, fetchVideosForLang]);

  // Kullanıcı çiplere veya diğer diller modalına dokunduğunda
  const handleSelectLang = useCallback(
    async (code) => {
      const normalized = normalizeTrailerLanguageCode(code);
      setSelectedLang(normalized);
      if (videoCacheRef.current[normalized] !== undefined) {
        setVideos(videoCacheRef.current[normalized]);
        return;
      }
      setLoading(true);
      const list = await fetchVideosForLang(normalized);
      setVideos(list);
      setLoading(false);
    },
    [fetchVideosForLang],
  );

  // Hızlı çipler: seçili dil → İngilizce → özgün dil
  const chipCodes = useMemo(() => {
    return buildTrailerLanguageOrder({
      originalLanguage: normalizedOriginalLanguage,
      appLanguage: appLangCode,
      selectedLanguage: selectedLang,
    });
  }, [appLangCode, normalizedOriginalLanguage, selectedLang]);

  return (
    <View style={isSheet ? styles.sheetSection : styles.section}>
      {!isSheet ? (
        <View style={styles.headerRow}>
          <View style={[styles.accent, { backgroundColor: theme.accent }]} />
          <Text style={[styles.title, { color: theme.text.primary }]}>{t.videos}</Text>
        </View>
      ) : null}

      {/* Dil seçici */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={isSheet ? styles.chipScrollSheet : styles.chipScroll}
        contentContainerStyle={isSheet ? styles.chipRowSheet : styles.chipRow}
      >
        {chipCodes.map((code) => {
          const active = code === selectedLang;
          return (
            <GlassTouchable
              key={code}
              onPress={() => handleSelectLang(code)}
              style={[
                styles.chip,
                isSheet && styles.chipSheet,
                {
                  backgroundColor: active
                    ? theme.accent
                    : isSheet
                      ? theme.between
                      : theme.secondary,
                  borderColor: active ? theme.accent : theme.border,
                },
              ]}
            >
              <Text
                style={[styles.chipText, { color: active ? "#fff" : theme.text.secondary }]}
              >
                {trailerLanguageOf(code).label}
              </Text>
            </GlassTouchable>
          );
        })}
        <GlassTouchable
          onPress={() => setSheetVisible(true)}
          style={[
            styles.chip,
            styles.chipMore,
            isSheet && styles.chipSheet,
            {
              backgroundColor: isSheet ? theme.between : theme.secondary,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons name="globe-outline" size={14} color={theme.text.secondary} />
          <Text style={[styles.chipText, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.diger_diller", "Diğer diller")}
          </Text>
          {isSheet ? (
            <Ionicons name="chevron-down" size={13} color={theme.text.muted} />
          ) : null}
        </GlassTouchable>
      </ScrollView>

      {/* İçerik */}
      {isSheet ? (
        <TrailerVideoList
          videos={videos}
          loading={loading}
          theme={theme}
          onPress={setSelectedVideo}
          bottomInset={bottomInset}
        />
      ) : loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.stateBox}>
          <Ionicons name="videocam-off-outline" size={18} color={theme.text.muted} />
          <Text style={[styles.stateText, { color: theme.text.muted }]}>
            {i18nText("autoI18n.bu_dilde_video_yok", "Bu dilde video bulunamadı")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          renderItem={({ item }) => (
            <MovieVideoItem item={item} onPress={setSelectedVideo} />
          )}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 4, gap: 14 }}
        />
      )}

      <LanguageSheet
        visible={sheetVisible}
        selected={selectedLang}
        originalLanguage={normalizedOriginalLanguage}
        theme={theme}
        onClose={() => setSheetVisible(false)}
        onSelect={(code) => {
          handleSelectLang(code);
          setSheetVisible(false);
        }}
      />

      <TrailerPlayerModal
        visible={selectedVideo !== null}
        video={selectedVideo}
        theme={theme}
        onClose={() => setSelectedVideo(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  accent: { width: 3, height: 18, borderRadius: 2 },
  title: { fontSize: 17, fontWeight: "700", letterSpacing: -0.2, flex: 1 },

  // Basılan cam dil çipi kırpma sınırında kesilmesin: üstte ve yanlarda GLASS_PRESS_ROOM
  // (dolgu + eşit negatif dış boşluk; yerleşim aynı). Altta 12 pt zaten yeterli.
  chipScroll: { marginTop: -GLASS_PRESS_ROOM, marginHorizontal: -GLASS_PRESS_ROOM },
  chipRow: {
    gap: 8,
    paddingTop: GLASS_PRESS_ROOM,
    paddingBottom: 12,
    paddingLeft: GLASS_PRESS_ROOM,
    paddingRight: 4 + GLASS_PRESS_ROOM,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipMore: {},
  chipText: { fontSize: 12.5, fontWeight: "700" },

  stateBox: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stateText: { fontSize: 13, fontWeight: "600" },

  // Oynatıcı
  playerRoot: { flex: 1, alignItems: "center", justifyContent: "center" },
  playerCard: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
  },
  playerTopBar: {
    width: "100%",
    maxWidth: 980,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playerTitleWrap: { flex: 1 },
  playerKicker: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  playerTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  playerTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  playerStage: {
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 16,
  },
  playerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // Yükleme/hata katmanı — kontrol butonlarının (zIndex 20) altında kalır.
  playerOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  playerOverlayDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  playerErrorBox: { alignItems: "center", gap: 10, paddingHorizontal: 20 },
  playerErrorText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  playerErrorActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  playerErrorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  playerErrorBtnGhost: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  playerErrorBtnText: { color: "#fff", fontSize: 12.5, fontWeight: "800" },

  // Sayfa yerleşimi (TrailerModal içinde). Kök küçülebilir: sayfa maxHeight'a
  // dayanınca çipler yerinde kalır, yalnız video listesi kısalıp kayar.
  sheetSection: { flexShrink: 1 },
  chipScrollSheet: { flexGrow: 0, flexShrink: 0, marginTop: -GLASS_PRESS_ROOM },
  chipRowSheet: { gap: 8, paddingHorizontal: SHEET_GUTTER, paddingTop: GLASS_PRESS_ROOM, paddingBottom: 14 },
  chipSheet: { height: 34, paddingHorizontal: 14, borderRadius: 17 },

  // Dil sayfası
  sheet: {
    maxHeight: "72%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 15,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 12 },
  sheetTitleIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { flex: 1, fontSize: 17, fontWeight: "800" },
  // İlk/son cam satır basılınca kaydırma bölgesinin üst/alt sınırında kesilmesin (yanlar
  // SheetScroll'da): GLASS_PRESS_ROOM dolgu + eşit negatif dış boşluk.
  sheetListScroll: { marginVertical: -GLASS_PRESS_ROOM },
  sheetList: { gap: 8, paddingVertical: GLASS_PRESS_ROOM },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetRowText: { fontSize: 15, fontWeight: "600" },
  sheetRowDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },
});
