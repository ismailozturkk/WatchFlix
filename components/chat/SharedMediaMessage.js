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
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { useLanguage } from "../../context/LanguageContext";
import { useApiSettings } from "../../context/AppSettingsContext";
import { useBackdropResolver, usePosterResolver } from "../../context/PosterChoicesContext";
import { fetchMediaFacts, fetchMediaOverview, peekMediaFacts } from "../../services/tmdbFacts";
import { alpha } from "../../theme/colors";
import { hoursMinutesText } from "../../utils/durationText";

const MEDIA_GAP = 12;
// blurRadius (18) saydam kenarından geniş olmalı.
const BACKDROP_BLEED = 36;

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
  // Süre / sezon / türler: başlıkla AYNI önbellekli okuma, ek istek yok.
  const [facts, setFacts] = useState(
    () => (localizable && peekMediaFacts({ id, mediaType: type, language })) || null,
  );

  useEffect(() => {
    if (!localizable) return undefined;
    let alive = true;
    fetchMediaFacts({ apiKey: API_KEY, id, mediaType: type, language }).then((facts) => {
      if (!alive || !facts) return;
      if (facts.title) setTitle(facts.title);
      setFacts(facts);
    });
    fetchMediaOverview({ apiKey: API_KEY, id, mediaType: type, language }).then((text) => {
      if (alive && text) setOverview(text);
    });
    return () => {
      alive = false;
    };
  }, [localizable, id, type, language, API_KEY]);

  return { title, overview, facts };
}

/** Yan sütundaki süre çipi: film "2 sa 49 dk", dizi "4 sezon". Bilinmiyorsa null. */
function durationChip(facts, mediaType) {
  if (!facts) return null;
  if (mediaType === "tv") {
    const seasons = Number(facts.seasonCount);
    return seasons > 0
      ? { icon: "layers-outline", text: i18nText("autoI18n.sezon_sayisi", "{{count}} sezon", { count: seasons }) }
      : null;
  }
  const text = hoursMinutesText(facts.minutes);
  return text ? { icon: "time-outline", text } : null;
}

export default function SharedMediaMessage({
  item,
  getTmdbUrl,
  accent: propAccent,
  onOpenTrailer,
  isOutgoing = false,
}) {
  const { theme } = useTheme();
  const resolvePoster = usePosterResolver();
  const resolveBackdrop = useBackdropResolver();
  const accent = propAccent || theme.accent || "#6C63FF";
  const [summaryOpen, setSummaryOpen] = useState(false);

  const media = item?.media;
  const isPerson = media?.media_type === "person";
  const mediaType = media?.media_type === "tv" ? "tv" : "movie";
  const basePoster = media?.poster_path || media?.profile_path || null;
  const poster = isPerson ? basePoster : resolvePoster(mediaType, media?.id, basePoster);
  const baseBackdrop = media?.backdrop_path || media?.backdropPath || null;
  const chosenBackdrop = isPerson
    ? null
    : resolveBackdrop(mediaType, media?.id, baseBackdrop);
  // Kart fonunda yalnız arka plan görseli kullanılır. Seçilmiş/varsayılan bir
  // backdrop yoksa poster büyütülmez; koyu düz kart yüzeyi korunur.
  // Yol yoksa gönderenin yazdığı hazır URL (utils/chatMediaBackdrop) yedek fon.
  const backdropUri = chosenBackdrop
    ? getTmdbUrl(chosenBackdrop, "backdrop", 780)
    : (!isPerson && typeof media?.backdrop_url === "string" && media.backdrop_url) || null;
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
  const duration = isPerson ? null : durationChip(localized.facts, mediaType);
  // İzleyenin dilinde en fazla iki tür (tmdbFacts): "Bilim Kurgu · Dram".
  const genreLine = isPerson ? "" : (localized.facts?.genres || []).slice(0, 2).join(" · ");

  const toggleSummary = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSummaryOpen((o) => !o);
  };

  // Film/dizi kartı poster fonu nedeniyle her iki yönde de koyu bir yüzeydir.
  const onDarkCard = !isPerson;
  const primaryTextColor = onDarkCard || isOutgoing ? "#fff" : theme.text.primary;
  const secondaryTextColor = onDarkCard || isOutgoing ? "rgba(255,255,255,0.82)" : theme.text.secondary;
  const mutedTextColor = onDarkCard || isOutgoing ? "rgba(255,255,255,0.68)" : theme.text.muted;

  // Giden balon vurgu renginde: rozet/buton zeminleri beyaz-şeffaf, gelende tür/vurgu renkli.
  const pillBg = onDarkCard || isOutgoing
    ? "rgba(255,255,255,0.2)"
    : alpha(typeMeta?.color || accent, 0.16);
  const pillInk = onDarkCard || isOutgoing ? "#fff" : typeMeta?.color || accent;

  return (
    <View
      style={[
        styles.wrap,
        isPerson
          ? { backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1 }
          : { backgroundColor: "#11141C" },
      ]}
    >
      {backdropUri ? (
        <>
          <Image
            pointerEvents="none"
            source={{ uri: backdropUri }}
            style={styles.backgroundPoster}
            contentFit="cover"
            cachePolicy="memory-disk"
            blurRadius={18}
          />
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(5,7,12,0.82)", "rgba(5,7,12,0.58)", "rgba(5,7,12,0.76)"]}
            locations={[0, 0.48, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backgroundScrim}
          />
        </>
      ) : null}
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
                <Ionicons
                  name={media?.media_type === "tv" ? "tv-outline" : isPerson ? "person-outline" : "film-outline"}
                  size={11}
                  // Koyu kartta simge tür renginde: film turuncu, dizi mavi her yerde aynı tanınır.
                  color={onDarkCard && typeMeta?.color ? typeMeta.color : pillInk}
                />
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
              // Süre/tür satırı eklenince üç satırlık başlık eylemleri aşağı itiyordu.
              numberOfLines={duration || genreLine ? 2 : 3}
            >
              {text}
            </Text>

            {!isPerson && (!!releaseDateText || !!duration) && (
              <View style={styles.metaRow}>
                {!!releaseDateText && (
                  <View
                    style={styles.releaseRow}
                    accessibilityLabel={`${releaseDateLabel}: ${releaseDateText}`}
                  >
                    <Ionicons name="calendar-outline" size={12} color={mutedTextColor} />
                    <Text
                      allowFontScaling={false}
                      style={[styles.releaseText, { color: secondaryTextColor }]}
                      numberOfLines={1}
                    >
                      {releaseDateText}
                    </Text>
                  </View>
                )}
                {!!duration && (
                  <View style={styles.releaseRow}>
                    <Ionicons name={duration.icon} size={12} color={mutedTextColor} />
                    <Text
                      allowFontScaling={false}
                      style={[styles.releaseText, { color: secondaryTextColor }]}
                      numberOfLines={1}
                    >
                      {duration.text}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {!!genreLine && (
              <Text
                allowFontScaling={false}
                style={[styles.genreLine, { color: mutedTextColor }]}
                numberOfLines={1}
              >
                {genreLine}
              </Text>
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
                  { backgroundColor: onDarkCard || isOutgoing ? "rgba(255,255,255,0.24)" : accent },
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
                    backgroundColor: onDarkCard || isOutgoing
                      ? "rgba(255,255,255,0.1)"
                      : "transparent",
                    borderColor: onDarkCard || isOutgoing
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
                  color={onDarkCard || isOutgoing ? "#fff" : accent}
                />
                <Text
                  allowFontScaling={false}
                  style={[styles.actionText, { color: onDarkCard || isOutgoing ? "#fff" : accent }]}
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
              borderColor: onDarkCard || isOutgoing
                ? "rgba(255,255,255,0.3)"
                : alpha(accent, 0.4),
              backgroundColor: onDarkCard || isOutgoing
                ? "rgba(0,0,0,0.28)"
                : theme.between,
            },
          ]}
        >
          <Text style={[styles.summaryText, { color: primaryTextColor }]}>
            {summary || i18nText("autoI18n.ozet_yok", "Özet bulunmuyor.")}
          </Text>
        </View>
      )}
      {/* Film/dizi çerçevesi kabın değil, EN ÜSTTEKİ katmanın: kabın borderWidth'i
          overflow:hidden ile çocukları çerçevenin İÇİNDEN kırpıyor, fon görseli
          çerçevenin altına giremiyor ve kenarda gri bir halka kalıyordu. */}
      {!isPerson && <View pointerEvents="none" style={styles.edge} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    minWidth: 250,
    padding: 13,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 4,
  },
  // Bulanık görselin kenarları saydamlaşır (blur kutunun dışını boş örnekler);
  // kart sınırına kadar çizilince bu şerit koyu zeminle "boşluk" gibi görünüyordu.
  // Görsel her yönden BACKDROP_BLEED kadar taşar, saydam kenar `overflow:hidden`
  // ile kırpılan bölgede kalır.
  backgroundPoster: {
    position: "absolute",
    top: -BACKDROP_BLEED,
    left: -BACKDROP_BLEED,
    right: -BACKDROP_BLEED,
    bottom: -BACKDROP_BLEED,
  },
  backgroundScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  edge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: MEDIA_GAP,
  },

  posterShadow: {
    width: 92,
    height: 138,
    flexShrink: 0,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  poster: {
    width: 92,
    height: 138,
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
    minHeight: 138,
    justifyContent: "space-between",
    gap: 8,
  },
  sideTop: { gap: 5 },
  typePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 20,
    letterSpacing: -0.2,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
  },
  genreLine: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    letterSpacing: 0.1,
  },
  releaseRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  releaseText: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    includeFontPadding: false,
  },
  knownFor: { fontSize: 11.5, lineHeight: 16 },

  actions: { flexDirection: "row", alignItems: "center", gap: 7 },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 12,
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
