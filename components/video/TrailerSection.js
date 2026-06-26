// components/video/TrailerSection.js
//
// Film/Dizi detayındaki "Videolar" (fragman/trailer) bölümü.
//   • Dil seçimi: varsayılan İngilizce + uygulama dili + diğer diller (seçilebilir).
//     TMDB videoları seçilen dile göre ayrıca çekilir (append_to_response yerine
//     bağımsız /videos isteği), böylece uygulama dili Türkçe olsa bile orijinal /
//     İngilizce fragmanlara erişilebilir.
//   • Oynatıcı tam ekran açılır; varsayılan olarak YATAY (landscape) gelir.
//     Kapatma tuşunun karşısında bir "yan çevir" tuşu vardır; basınca dikey/yatay
//     arasında geçiş yapar. (Cihaz yönelimi kilidi gerektirmeyen transform tabanlı
//     yaklaşım — yeniden derleme gerektirmez.)

import React, { useEffect, useMemo, useState } from "react";
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
  useWindowDimensions,
} from "react-native";
import axios from "axios";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
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
function TrailerPlayerModal({ visible, videoId, onClose, theme }) {
  const { width: SW, height: SH } = useWindowDimensions();
  const [landscape, setLandscape] = useState(true);

  // Her yeni video açılışında yatay başlasın.
  useEffect(() => {
    if (visible) setLandscape(true);
  }, [visible, videoId]);

  const portraitW = Math.min(SW - 24, 720);
  const portraitH = Math.round((portraitW * 9) / 16);

  // 16:9'u yatay tuvale (SH x SW) sığdır.
  const landscapeFit = useMemo(() => {
    const ar = 16 / 9;
    let w = SH;
    let h = SH / ar;
    if (h > SW) {
      h = SW;
      w = SW * ar;
    }
    return { w: Math.round(w), h: Math.round(h) };
  }, [SH, SW]);

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

        <View
          style={[
            styles.playerStage,
            landscape
              ? { width: SH, height: SW, transform: [{ rotate: "90deg" }] }
              : { width: portraitW, height: portraitH, borderRadius: 14 },
          ]}
        >
          {videoId ? (
            <YoutubePlayer
              key={`${videoId}-${landscape}`}
              width={landscape ? landscapeFit.w : portraitW}
              height={landscape ? landscapeFit.h : portraitH}
              videoId={videoId}
              play
            />
          ) : null}

          {/* Kontroller: solda yan çevir, karşısında (sağda) kapat */}
          <View style={styles.playerControls} pointerEvents="box-none">
            <TouchableOpacity
              onPress={() => setLandscape((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.yan_cevir", "Yan çevir")}
            >
              <BlurView tint="dark" intensity={50} style={styles.playerBtn}>
                <Ionicons
                  name={landscape ? "phone-portrait-outline" : "phone-landscape-outline"}
                  size={20}
                  color="#fff"
                />
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
            >
              <BlurView tint="dark" intensity={50} style={styles.playerBtn}>
                <Ionicons name="close" size={20} color="#fff" />
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>
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
        videoId={selectedVideo}
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
  playerStage: {
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  playerControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    zIndex: 20,
  },
  playerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

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
