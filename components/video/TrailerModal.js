// components/video/TrailerModal.js
//
// Sohbette paylaşılan dizi/film için fragmanları dile göre listeleyen alt sayfa.
//
// KABUK: components/common/BottomSheetModal.js — arka plan YERİNDE bulanıp solar,
// sayfa tam opaklıkta aşağıdan kayar (diğer tüm alt sayfalarla aynı hareket).
// İçerikte TrailerSection (`variant="sheet"`) yeniden kullanılır: dil çipleri +
// dikey video listesi + tam ekran oynatıcı.
//
// BAŞLIK: paylaşılan yapımın afişi, adı, türü, yılı ve puanı — kullanıcı hangi
// içeriğin fragmanına baktığını sayfada görür. Bu bilgiler sohbet mesajındaki
// `media` nesnesinden gelir; eksik olan her alan sessizce atlanır.
//
// ÇIKIŞ PENCERESİ: çağıran `media`yı kapanışta null'a çeker, ama sayfa ≈260 ms
// daha çizilir (bkz. BottomSheetModal). Son yapım burada tutulur; yoksa başlık ve
// liste çıkış animasyonu sırasında boşalırdı.
import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheetModal from "../common/BottomSheetModal";
import GlassCloseButton from "../common/GlassCloseButton";
import { PosterEdge, MEDIA_TYPE_COLOR } from "../chat/shareKit";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { alpha } from "../../theme/colors";
import TrailerSection from "./TrailerSection";

const POSTER_W = 54;
const POSTER_H = 81;

const typeLabel = (mediaType) =>
  mediaType === "tv"
    ? i18nText("autoI18n.dizi", "Dizi")
    : i18nText("autoI18n.film", "Film");

/**
 * @param {object}  props
 * @param {boolean} props.visible
 * @param {object|null} props.media   Sohbet mesajındaki yapım (media_type, id,
 *                                    title/name, poster_path, vote_average, …).
 * @param {string}  props.apiKey      TMDB yetkisi.
 * @param {(path: string, type: string, width: number) => string} [props.getTmdbUrl]
 * @param {() => void} props.onClose
 */
export default function TrailerModal({ visible, media, apiKey, getTmdbUrl, onClose }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Çıkış animasyonu boyunca son yapımı göster (bkz. dosya başı).
  const [shown, setShown] = useState(media);
  if (media && media !== shown) setShown(media);

  const tint = MEDIA_TYPE_COLOR[shown?.media_type] || theme.accent;
  const title = shown?.title || shown?.name || "";
  const rawDate = shown?.release_date || shown?.first_air_date;
  const year = rawDate ? String(rawDate).slice(0, 4) : "";
  const rating = shown?.vote_average > 0 ? Number(shown.vote_average).toFixed(1) : "";
  const poster = shown?.poster_path && getTmdbUrl ? getTmdbUrl(shown.poster_path, "poster", 200) : null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      {/* Üst köşelerdeki tür renkli ışıma. Kırpma ayrı bir kapta: sayfanın kendisine
          overflow verilirse içindeki cam kapat düğmesi de kırpılır. */}
      <View style={styles.glowClip} pointerEvents="none">
        <LinearGradient
          colors={[alpha(tint, 0.24), alpha(tint, 0)]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.header}>
        <View style={styles.posterWrap}>
          {poster ? (
            <>
              <Image
                source={{ uri: poster }}
                style={styles.poster}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={140}
              />
              <PosterEdge radius={12} color={theme.border} />
            </>
          ) : (
            <View style={[styles.poster, styles.posterEmpty, { backgroundColor: theme.between }]}>
              <Ionicons name="film-outline" size={22} color={theme.text.muted} />
            </View>
          )}
        </View>

        <View style={styles.copy}>
          <View style={styles.kickerRow}>
            <Ionicons name="play-circle" size={14} color={theme.accent} />
            <Text allowFontScaling={false} style={[styles.kicker, { color: theme.accent }]}>
              {i18nText("autoI18n.fragmanlar", "Fragmanlar")}
            </Text>
          </View>
          {title ? (
            <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {shown?.media_type ? (
            <View style={styles.metaRow}>
              <View style={[styles.typePill, { backgroundColor: alpha(tint, 0.16) }]}>
                <Text allowFontScaling={false} style={[styles.typePillText, { color: tint }]}>
                  {typeLabel(shown.media_type)}
                </Text>
              </View>
              {year ? (
                <Text allowFontScaling={false} style={[styles.meta, { color: theme.text.secondary }]}>
                  {year}
                </Text>
              ) : null}
              {rating ? (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={11} color="#FFD54F" />
                  <Text allowFontScaling={false} style={[styles.meta, { color: theme.text.secondary }]}>
                    {rating}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <GlassCloseButton
          icon="chevron-down"
          size={36}
          fallbackRadius={18}
          iconSize={21}
          color={theme.text.primary}
          backgroundColor={theme.between}
          accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
          onPress={onClose}
        />
      </View>

      {shown?.id ? (
        <TrailerSection
          variant="sheet"
          mediaType={shown.media_type}
          id={shown.id}
          apiKey={apiKey}
          originalLanguage={shown.original_language}
          bottomInset={Math.max(insets.bottom, 14)}
        />
      ) : null}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "86%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
  },
  glowClip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 14,
    opacity: 0.8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  posterWrap: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
    elevation: 4,
  },
  poster: { width: POSTER_W, height: POSTER_H, borderRadius: 12 },
  posterEmpty: { alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  kicker: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.3 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  typePill: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 8 },
  typePillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  meta: { fontSize: 11.5, fontWeight: "700" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
});
