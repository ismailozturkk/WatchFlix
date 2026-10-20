// components/ai/aiCardKit.js
//
// CineMatch kartlarının ortak yapı taşları: poster kutusu, çipler, yıldızlar,
// uyum rozeti ve kart başlığı (poster yelpazeli). Kartların kendisi
// components/AICineCards.js'te; burada yalnız paylaşılan atomlar var.
//
// Kartlar tek bir `ctx` nesnesi alır (prop zinciri yerine):
//   { posterMap, getTmdbUrl, theme, t, copy, language, onTitlePress,
//     tasteGenres, showMatchScore }

import React, { memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

import { alpha } from "../../theme/colors";
import { normMediaType, posterKey, safeArr, safeNum, toStr } from "../../services/aiCineService";
import { MATCH_SCORE_MIN_VISIBLE, computeMatchScore, matchLevel } from "../../services/aiCineInsights";

export const ratingColor = (r) => {
  if (r >= 8) return "#29b864";
  if (r >= 6) return "#f5c518";
  if (r >= 4) return "#ff6400";
  return "#e33";
};

export const getPoster = (posterMap, mediaType, title) =>
  (posterMap || {})[posterKey(mediaType, title)] || null;

/** TMDB'de bulunamayan başlığın dokunuş verisi (arama ekranına gider). */
export const unresolvedCard = (mediaType, title) => ({
  mediaType: normMediaType(mediaType),
  query: toStr(title),
  found: false,
});

export const typeMeta = {
  recommendations: { icon: "sparkles", key: "recommendations" },
  comparison: { icon: "git-compare-outline", key: "comparison" },
  watch_plan: { icon: "calendar-outline", key: "watch_plan" },
  watchlist: { icon: "list-outline", key: "watchlist" },
  title_spotlight: { icon: "film-outline", key: "title_spotlight" },
  general: { icon: "chatbubble-ellipses-outline", key: "general" },
};

export const responseTypeLabel = (type, t) => {
  const fallback = {
    recommendations: "Sana Özel Öneriler",
    comparison: "Karşılaştırma",
    watch_plan: "İzleme Planı",
    watchlist: "İzleme Listesi",
    title_spotlight: "Yapım Detayı",
  };
  return t?.AICineChat?.responseTypes?.[type] || fallback[type] || "CineMatch";
};

/** Kartın zevk uyumu — ayar kapalıysa ya da dayanak yoksa null. */
export const matchScoreFor = (card, ctx) =>
  ctx?.showMatchScore ? computeMatchScore(card, ctx.tasteGenres) : null;

// ── Atomlar ──────────────────────────────────────────────────────────────────

export const Stars = memo(({ score, color, size = 12 }) => {
  const n = Math.round(safeNum(score));
  return (
    <View style={{ flexDirection: "row" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Ionicons
          key={i}
          name={i < n ? "star" : "star-outline"}
          size={size}
          color={i < n ? color : alpha(color, 0.35)}
          style={{ marginHorizontal: 0.5 }}
        />
      ))}
    </View>
  );
});

export const Chip = memo(({ icon, label, theme, tint }) => (
  <View
    style={[
      s.chip,
      tint
        ? { backgroundColor: alpha(tint, 0.14), borderColor: alpha(tint, 0.45) }
        : { backgroundColor: theme.between, borderColor: theme.border },
    ]}
  >
    {!!icon && <Ionicons name={icon} size={12} color={tint || theme.text.between} />}
    <Text style={[s.chipText, { color: tint || theme.text.secondary }]} numberOfLines={1}>
      {label}
    </Text>
  </View>
));

/** "Zevk uyumu %86" — yalnız yeterince güçlü bir uyumda çizilir. */
export const MatchPill = memo(({ score, theme, copy }) => {
  const level = matchLevel(score);
  if (level === "none") return null;
  const tint =
    level === "high" ? theme.colors.green : level === "good" ? theme.accent : theme.colors.orange;
  return (
    <View style={[s.matchPill, { backgroundColor: alpha(tint, 0.14), borderColor: alpha(tint, 0.5) }]}>
      <Ionicons name="sparkles" size={11} color={tint} />
      <Text style={[s.matchText, { color: tint }]} numberOfLines={1}>
        {copy.actions.matchLabel} %{score}
      </Text>
    </View>
  );
});

export { MATCH_SCORE_MIN_VISIBLE };

/**
 * Poster kutusu: görsel + puan rozeti + tür rozeti. Başlık YOK (yan yana
 * düzenlerde başlık posterin yanında durur); `PosterThumb` başlığı altına ekler.
 */
export const PosterBox = memo(({ item, ctx, width = 70, radius = 10, badges = true }) => {
  const { posterMap, getTmdbUrl, theme, t, onTitlePress } = ctx;
  const mediaType = normMediaType(item?.mediaType);
  const title = toStr(item?.title);
  const pcard = getPoster(posterMap, mediaType, title);
  const found = !!pcard?.found;
  const typeLabel = mediaType === "movie" ? t?.AICineChat?.movie : t?.AICineChat?.series;
  const typeColor = mediaType === "movie" ? theme.notesColor.blue : theme.notesColor.green;
  const uri =
    found && pcard.posterPath ? getTmdbUrl(pcard.posterPath, "poster", Math.max(154, width * 2)) : null;
  const rating = safeNum(pcard?.rating);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onTitlePress(pcard || unresolvedCard(mediaType, title))}
    >
      <View style={[s.posterWrap, { width, height: width * 1.5, borderRadius: radius, backgroundColor: theme.between }]}>
        {uri ? (
          <Image source={{ uri }} style={s.posterImg} contentFit="cover" transition={160} />
        ) : (
          <View style={s.posterFallback}>
            <Ionicons name={mediaType === "movie" ? "film-outline" : "tv-outline"} size={22} color={theme.text.muted} />
            {!found && <Ionicons name="search" size={12} color={theme.text.muted} style={{ marginTop: 4 }} />}
          </View>
        )}
        {badges && found && rating > 0 && (
          <View style={[s.posterBadge, { backgroundColor: alpha(ratingColor(rating), 0.92) }]}>
            <Text style={s.posterBadgeText}>★ {rating.toFixed(1)}</Text>
          </View>
        )}
        {badges && (
          <View style={[s.posterType, { backgroundColor: alpha(theme.primary, 0.8) }]}>
            <Text style={{ color: typeColor, fontSize: 8, fontWeight: "800" }}>{typeLabel}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

/** Poster + altında başlık/yıl — yatay şeritlerde kullanılır. */
export const PosterThumb = memo(({ item, ctx, width = 70, showMeta = true }) => {
  const { posterMap, theme, onTitlePress } = ctx;
  const mediaType = normMediaType(item?.mediaType);
  const title = toStr(item?.title);
  const pcard = getPoster(posterMap, mediaType, title);
  const found = !!pcard?.found;
  return (
    <View style={{ width }}>
      <PosterBox item={item} ctx={ctx} width={width} />
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onTitlePress(pcard || unresolvedCard(mediaType, title))}
      >
        <Text numberOfLines={2} style={[s.posterTitle, { color: theme.text.primary }]}>
          {found ? pcard.title : title}
        </Text>
        {showMeta && found && !!pcard.year && (
          <Text style={[s.posterYear, { color: theme.text.muted }]}>{pcard.year}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
});

/**
 * Kart başlığı: degrade şerit + simge + etiket + öğe sayısı. `fan` verilirse
 * sağ tarafa üst üste binen, hafif eğik posterler yerleşir (kartı "resimli" yapar).
 */
export const CardHero = memo(({ type, ctx, count, fan }) => {
  const { theme, t } = ctx;
  const meta = typeMeta[type] || typeMeta.general;
  const posters = safeArr(fan).slice(0, 4);
  return (
    <LinearGradient
      colors={[theme.accent, theme.bold]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.hero, posters.length > 0 && { minHeight: 74 }]}
    >
      <View style={s.heroIcon}>
        <Ionicons name={meta.icon} size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.heroTitle} numberOfLines={1}>{responseTypeLabel(type, t)}</Text>
        {count > 0 && (
          <Text style={s.heroSub} numberOfLines={1}>
            {count} {ctx.copy.actions.titles}
          </Text>
        )}
      </View>
      {posters.length > 0 && (
        <View style={[s.fan, { width: 28 + posters.length * 26 }]} pointerEvents="none">
          {posters.map((uri, index) => {
            const mid = (posters.length - 1) / 2;
            return (
              <View
                key={`${uri}-${index}`}
                style={[
                  s.fanPoster,
                  {
                    left: index * 26,
                    zIndex: index,
                    transform: [{ rotate: `${(index - mid) * 7}deg` }, { translateY: Math.abs(index - mid) * 2 }],
                  },
                ]}
              >
                <Image source={{ uri }} style={s.posterImg} contentFit="cover" />
              </View>
            );
          })}
        </View>
      )}
    </LinearGradient>
  );
});

export const s = StyleSheet.create({
  // Kart kabuğu
  card: {
    width: "100%",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  body: { padding: 12 },

  // Hero
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    overflow: "hidden",
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroTitle: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  heroSub: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600", marginTop: 1 },
  fan: { height: 58, justifyContent: "center", marginRight: -2 },
  fanPoster: {
    position: "absolute",
    top: 0,
    width: 38,
    height: 57,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  // Poster
  posterWrap: { overflow: "hidden", position: "relative" },
  posterImg: { width: "100%", height: "100%" },
  posterFallback: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  posterBadge: { position: "absolute", top: 4, right: 4, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6 },
  posterBadgeText: { color: "#fff", fontSize: 8, fontWeight: "800" },
  posterType: { position: "absolute", bottom: 4, left: 4, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 5 },
  posterTitle: { fontSize: 11, fontWeight: "600", marginTop: 4, lineHeight: 14 },
  posterYear: { fontSize: 10, marginTop: 1 },

  // Çip / rozet
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 11, fontWeight: "600", maxWidth: 130 },
  matchPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 11,
    borderWidth: 1,
  },
  matchText: { fontSize: 10.5, fontWeight: "800" },
});
