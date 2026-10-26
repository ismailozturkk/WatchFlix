// components/chat/SharedMediaMessage.js
//
// Sohbette paylaşılan dizi/film/kişi mesajının gövdesi: solda poster, sağda
// tür rozeti + başlık + yıl, altta yazılı eylem butonları. "Özet" butonu genel
// özeti animasyonlu açar; "Fragman" (yalnızca dizi/film) fragman modalını açar.
// Postere/balona basınca yönlendirme dış TouchableOpacity tarafından yapılır
// (poster düz View'dir).
//
// Tür renkleri (film turuncu, dizi mavi, oyuncu mor) arama sonucu kartı ve
// liste balonuyla aynı — aynı içerik her yerde aynı renkte tanınır.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { useLanguage } from "../../context/LanguageContext";
import { useApiSettings } from "../../context/AppSettingsContext";
import { fetchMediaFacts, fetchMediaOverview, peekMediaFacts } from "../../services/tmdbFacts";
import { alpha } from "../../theme/colors";

const POSTER_WIDTH = 92;
const POSTER_HEIGHT = 138;
const MEDIA_GAP = 12;

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TYPE_META = {
  movie: { color: "#FF8A65", label: () => i18nText("autoI18n.film", "Film") },
  tv: { color: "#64B5F6", label: () => i18nText("autoI18n.dizi", "Dizi") },
  person: { color: "#CE93D8", label: () => i18nText("autoI18n.oyuncu", "Oyuncu") },
};

/**
 * Kartın başlığı/özeti İZLEYENİN dilinde (T3 B16): mesaj gönderenin dilindeki
 * metni taşıyor, Türkçe kullanıcı Almanca "Die Tagebücher der Apothekerin"
 * görüyordu. Önbellekli detay okuması (tmdbFacts); çözülemezse mesajdaki metin.
 */
function useViewerLanguageMedia(media) {
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const id = media?.id;
  const type = media?.media_type;
  const localizable = id != null && (type === "movie" || type === "tv");
  const [title, setTitle] = useState(
    () => (localizable && peekMediaFacts({ id, mediaType: type, language })?.title) || null,
  );
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    if (!localizable) return undefined;
    let alive = true;
    fetchMediaFacts({ apiKey: API_KEY, id, mediaType: type, language }).then((facts) => {
      if (alive && facts?.title) setTitle(facts.title);
    });
    fetchMediaOverview({ apiKey: API_KEY, id, mediaType: type, language }).then((text) => {
      if (alive && text) setOverview(text);
    });
    return () => {
      alive = false;
    };
  }, [localizable, id, type, language, API_KEY]);

  return { title, overview };
}

export default function SharedMediaMessage({
  item,
  getTmdbUrl,
  accent: propAccent,
  onOpenTrailer,
  isOutgoing = false,
}) {
  const { theme } = useTheme();
  const accent = propAccent || theme.accent || "#6C63FF";
  const [summaryOpen, setSummaryOpen] = useState(false);

  const media = item?.media;
  const poster = media?.poster_path || media?.profile_path;
  const isPerson = media?.media_type === "person";
  const localized = useViewerLanguageMedia(media);
  const text = localized.title || item?.text || media?.title || media?.name || "";
  const summary = (!isPerson && localized.overview) || media?.overview;
  const typeMeta = TYPE_META[media?.media_type];

  const rawDate = media?.release_date || media?.first_air_date;
  const releaseDateText = rawDate ? String(rawDate).slice(0, 4) : "";
  const releaseDateLabel =
    media?.media_type === "movie"
      ? i18nText("autoI18n.vizyon", "Vizyon")
      : i18nText("autoI18n.yayin", "Yayın");

  const toggleSummary = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSummaryOpen((o) => !o);
  };

  const primaryTextColor = isOutgoing ? "#fff" : theme.text.primary;
  const secondaryTextColor = isOutgoing ? "rgba(255,255,255,0.8)" : theme.text.secondary;
  const mutedTextColor = isOutgoing ? "rgba(255,255,255,0.65)" : theme.text.muted;

  // Giden balon vurgu renginde: rozet/buton zeminleri beyaz-şeffaf, gelende tür/vurgu renkli.
  const pillBg = isOutgoing
    ? "rgba(255,255,255,0.2)"
    : alpha(typeMeta?.color || accent, 0.16);
  const pillInk = isOutgoing ? "#fff" : typeMeta?.color || accent;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {/* Poster (basınca dış balon yönlendirir) */}
        <View style={styles.posterShadow}>
          {poster ? (
            <Image
              source={{ uri: getTmdbUrl(poster, "poster", 500) }}
              style={styles.poster}
              cachePolicy="memory-disk"
              transition={120}
            />
          ) : (
            <View
              style={[
                styles.poster,
                styles.posterPlaceholder,
                {
                  backgroundColor: isOutgoing
                    ? "rgba(255,255,255,0.1)"
                    : theme.between,
                  borderColor: isOutgoing
                    ? "rgba(255,255,255,0.2)"
                    : theme.border,
                },
              ]}
            >
              <Ionicons
                name={isPerson ? "person" : "film-outline"}
                size={28}
                color={mutedTextColor}
              />
            </View>
          )}
          {media?.vote_average > 0 && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={10} color="#FFD54F" />
              <Text allowFontScaling={false} style={styles.ratingText}>
                {media.vote_average.toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Sağ sütun: tür rozeti + başlık + yıl; altta eylemler */}
        <View style={styles.side}>
          <View style={styles.sideTop}>
            {!!typeMeta && (
              <View style={[styles.typePill, { backgroundColor: pillBg }]}>
                <Text
                  allowFontScaling={false}
                  style={[styles.typePillText, { color: pillInk }]}
                >
                  {typeMeta.label()}
                </Text>
              </View>
            )}
            <Text
              style={[styles.title, { color: primaryTextColor }]}
              numberOfLines={3}
            >
              {text}
            </Text>

            {!!releaseDateText && !isPerson && (
              <View style={styles.releaseRow}>
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={mutedTextColor}
                />
                <Text
                  allowFontScaling={false}
                  style={[styles.releaseText, { color: secondaryTextColor }]}
                  numberOfLines={1}
                >
                  {releaseDateLabel}: {releaseDateText}
                </Text>
              </View>
            )}

            {/* Oyuncuda overview alanı "bilinen yapımlar" listesidir. */}
            {isPerson && !!summary && (
              <Text
                style={[styles.knownFor, { color: secondaryTextColor }]}
                numberOfLines={3}
              >
                {summary}
              </Text>
            )}
          </View>

          {!isPerson && (
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={toggleSummary}
                activeOpacity={0.85}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                style={[
                  styles.action,
                  styles.actionPrimary,
                  { backgroundColor: isOutgoing ? "rgba(255,255,255,0.24)" : accent },
                ]}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.ozet", "Özet")}
                accessibilityState={{ expanded: summaryOpen }}
              >
                <Ionicons
                  name={summaryOpen ? "chevron-up" : "document-text-outline"}
                  size={14}
                  color="#fff"
                />
                <Text allowFontScaling={false} style={[styles.actionText, { color: "#fff" }]}>
                  {i18nText("autoI18n.ozet", "Özet")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onOpenTrailer}
                activeOpacity={0.85}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                style={[
                  styles.action,
                  styles.actionOutline,
                  {
                    backgroundColor: isOutgoing
                      ? "rgba(255,255,255,0.1)"
                      : "transparent",
                    borderColor: isOutgoing
                      ? "rgba(255,255,255,0.4)"
                      : alpha(accent, 0.5),
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.fragman", "Fragman")}
              >
                <Ionicons
                  name="play-circle-outline"
                  size={15}
                  color={isOutgoing ? "#fff" : accent}
                />
                <Text
                  allowFontScaling={false}
                  style={[styles.actionText, { color: isOutgoing ? "#fff" : accent }]}
                >
                  {i18nText("autoI18n.fragman", "Fragman")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Animasyonlu genel özet */}
      {!isPerson && summaryOpen && (
        <View
          style={[
            styles.summaryBox,
            {
              borderColor: isOutgoing
                ? "rgba(255,255,255,0.3)"
                : alpha(accent, 0.4),
              backgroundColor: isOutgoing
                ? "rgba(255,255,255,0.1)"
                : theme.between,
            },
          ]}
        >
          <Text style={[styles.summaryText, { color: primaryTextColor }]}>
            {summary || i18nText("autoI18n.ozet_yok", "Özet bulunmuyor.")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", minWidth: 250 },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: MEDIA_GAP,
  },

  posterShadow: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    flexShrink: 0,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  poster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  posterPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 9,
  },
  ratingText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  side: {
    flex: 1,
    minWidth: 0,
    minHeight: POSTER_HEIGHT,
    justifyContent: "space-between",
    gap: 8,
  },
  sideTop: { gap: 5 },
  typePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: { fontSize: 15.5, fontWeight: "800", lineHeight: 20 },
  releaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  releaseText: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    includeFontPadding: false,
  },
  knownFor: { fontSize: 11.5, lineHeight: 16 },

  actions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 15,
  },
  actionPrimary: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  actionOutline: { borderWidth: 1 },
  actionText: { fontSize: 12, fontWeight: "800" },

  summaryBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
});
