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

import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import YoutubePlayer from "react-native-youtube-iframe";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { i18nText } from "../../utils/i18nText";
import MovieVideoItem from "../../screens/movie/components/MovieVideoItem";

// Seçilebilir diller (TMDB language paramı için bölge kodlu). İlk ikisi hızlı çip.
export const TRAILER_LANGUAGES = [
  { code: "en", region: "en-US", label: "English" },
  { code: "tr", region: "tr-TR", label: "Türkçe" },
  { code: "de", region: "de-DE", label: "Deutsch" },
  { code: "fr", region: "fr-FR", label: "Français" },
  { code: "es", region: "es-ES", label: "Español" },
  { code: "it", region: "it-IT", label: "Italiano" },
  { code: "pt", region: "pt-BR", label: "Português" },
  { code: "ru", region: "ru-RU", label: "Русский" },
  { code: "ja", region: "ja-JP", label: "日本語" },
  { code: "ko", region: "ko-KR", label: "한국어" },
  { code: "zh", region: "zh-CN", label: "中文" },
  { code: "hi", region: "hi-IN", label: "हिन्दी" },
  { code: "ar", region: "ar-SA", label: "العربية" },
];

const langOf = (code) =>
  TRAILER_LANGUAGES.find((l) => l.code === code) || TRAILER_LANGUAGES[0];

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
        <BlurView
          tint="dark"
          intensity={60}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
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
                <BlurView tint="dark" intensity={45} style={styles.playerBtn}>
                  <Ionicons name="logo-youtube" size={19} color="#fff" />
                </BlurView>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
              >
                <BlurView tint="dark" intensity={45} style={styles.playerBtn}>
                  <Ionicons name="close" size={20} color="#fff" />
                </BlurView>
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
function LanguageSheet({ visible, selected, onSelect, onClose, theme }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <View style={styles.sheetHandle} />
        <Text style={[styles.sheetTitle, { color: theme.text.primary }]}>
          {i18nText("autoI18n.video_dili", "Video Dili")}
        </Text>
        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          {TRAILER_LANGUAGES.map((l) => {
            const active = l.code === selected;
            return (
              <TouchableOpacity
                key={l.code}
                style={[styles.sheetRow, { borderColor: theme.border }]}
                onPress={() => onSelect(l.code)}
              >
                <Text style={[styles.sheetRowText, { color: theme.text.primary }]}>{l.label}</Text>
                {active ? (
                  <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                ) : (
                  <View style={[styles.sheetRowDot, { borderColor: theme.border }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ───────────────────────── Ana bölüm ───────────────────────── */
export default function TrailerSection({ mediaType, id, apiKey }) {
  const { theme } = useTheme();
  const { language, t } = useLanguage();
  const appLangCode = language === "tr" ? "tr" : "en";

  const [selectedLang, setSelectedLang] = useState("en"); // varsayılan İngilizce
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .request({
        method: "GET",
        url: `https://api.themoviedb.org/3/${mediaType}/${id}/videos`,
        params: { language: langOf(selectedLang).region },
        headers: { accept: "application/json", Authorization: apiKey },
      })
      .then((res) => {
        if (cancelled) return;
        const yt = (res.data?.results || []).filter((v) => v.site === "YouTube");
        setVideos(sortVideos(yt));
      })
      .catch(() => {
        if (!cancelled) setVideos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaType, id, selectedLang, apiKey]);

  // Hızlı çipler: İngilizce + uygulama dili (+ seçili dil farklıysa o da görünsün)
  const chipCodes = useMemo(() => {
    const base = ["en"];
    if (appLangCode !== "en") base.push(appLangCode);
    if (!base.includes(selectedLang)) base.push(selectedLang);
    return base;
  }, [appLangCode, selectedLang]);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={[styles.accent, { backgroundColor: theme.accent }]} />
        <Text style={[styles.title, { color: theme.text.primary }]}>{t.videos}</Text>
      </View>

      {/* Dil seçici */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {chipCodes.map((code) => {
          const active = code === selectedLang;
          return (
            <TouchableOpacity
              key={code}
              onPress={() => setSelectedLang(code)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.accent : theme.secondary,
                  borderColor: active ? theme.accent : theme.border,
                },
              ]}
            >
              <Text
                style={[styles.chipText, { color: active ? "#fff" : theme.text.secondary }]}
              >
                {langOf(code).label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => setSheetVisible(true)}
          style={[styles.chip, styles.chipMore, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <Ionicons name="globe-outline" size={14} color={theme.text.secondary} />
          <Text style={[styles.chipText, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.diger_diller", "Diğer diller")}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* İçerik */}
      {loading ? (
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
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews
        />
      )}

      <LanguageSheet
        visible={sheetVisible}
        selected={selectedLang}
        theme={theme}
        onClose={() => setSheetVisible(false)}
        onSelect={(code) => {
          setSelectedLang(code);
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

  chipRow: { gap: 8, paddingBottom: 12, paddingRight: 4 },
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  playerOverlayDim: {
    ...StyleSheet.absoluteFillObject,
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

  // Dil sayfası
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(150,150,150,0.5)",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowText: { fontSize: 15, fontWeight: "600" },
  sheetRowDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
});
