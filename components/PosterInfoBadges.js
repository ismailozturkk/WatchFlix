// components/PosterInfoBadges.js
//
// Ana ekran (TV & Film) rail posterlerinin ÜZERINDE gösterilen "bilgi" rozetleri:
//   • RatingBadge      — TMDB puanı (+ isteğe bağlı oy sayısı)
//   • CountdownBadge   — vizyona/yayına kalan gün ("Bugün" / "Yarın" / "N gün")
//   • ReleaseDateBadge — çıkış/ilk yayın tarihi (okunur biçimde: "15 Ağu")
//
// BOYUTLANDIRMA — TÜM ölçüler (font, ikon, dolgu, boşluk, köşe) poster boyutuna
// (railPosterSize / listsGridColumns / posterWidth) bağlı `s` ölçek çarpanıyla
// orantılı olarak küçülür. Böylesine rozetler hiçbir posterden taşmaz.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useListLayoutSettings } from "../context/AppSettingsContext";
import { useLanguage } from "../context/LanguageContext";

// Poster boyutu → rozet ölçeği.
const SCALE_FOR = { small: 0.82, normal: 1 };

// Hazır köşe konumları (sabit; ölçekli konum için `corner` prop'unu kullan).
export const POSTER_BADGE_POS = {
  topLeft: { position: "absolute", top: 5, left: 5 },
  topRight: { position: "absolute", top: 5, right: 5 },
  bottomRight: { position: "absolute", right: 5, bottom: 5 },
  bottomLeft: { position: "absolute", left: 5, bottom: 5 },
};

const CORNER_EDGES = {
  topLeft: ["top", "left"],
  topRight: ["top", "right"],
  bottomRight: ["bottom", "right"],
  bottomLeft: ["bottom", "left"],
};

// Ölçeğe göre köşe konumu (kenar boşluğu poster boyutuyla küçülür).
function cornerStyle(corner, s) {
  const edges = CORNER_EDGES[corner];
  if (!edges) return null;
  const inset = Math.max(4, Math.round(6 * s));
  return { position: "absolute", [edges[0]]: inset, [edges[1]]: inset };
}

// ── Yardımcılar ───────────────────────────────────────────────────────────────

function ratingAccent(v) {
  const n = Number(v) || 0;
  if (n <= 0) return "#9aa3ad"; // puansız / N/A → nötr gri
  if (n >= 8) return "#34d17a"; // çok iyi → yeşil
  if (n >= 6.5) return "#f5b301"; // iyi → amber
  if (n >= 5) return "#ff8a3d"; // orta → turuncu
  return "#ff5a5f"; // düşük → kırmızı
}

function formatVotes(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}B`;
  return String(v);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000);
}

const MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatReleaseDate(dateStr, variant, isEn) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr).slice(0, 4);
  if (variant === "year") return String(d.getFullYear());
  const mon = (isEn ? MONTHS_EN : MONTHS_TR)[d.getMonth()];
  if (variant === "full") return `${d.getDate()} ${mon} ${d.getFullYear()}`;
  return `${d.getDate()} ${mon}`;
}

// Ortak: poster boyutuna ve genişliğine göre ölçek + ölçekli taban hap stilleri.
function usePillMetrics(scale, posterWidth) {
  const { railPosterSize, listsGridColumns } = useListLayoutSettings();
  let s = 1;
  if (scale != null) {
    s = scale;
  } else if (posterWidth != null) {
    s = Math.min(1.1, Math.max(0.6, posterWidth / 110));
  } else {
    s = SCALE_FOR[railPosterSize] || 1;
    if (listsGridColumns === 4) s *= 0.82;
  }

  const r = (n) => Math.max(7, Math.round(n * s * 2) / 2);
  const box = {
    gap: Math.max(1, Math.round(2.5 * s)),
    paddingHorizontal: Math.max(3, Math.round(5.5 * s)),
    paddingVertical: Math.max(1.5, Math.round(2 * s)),
    borderRadius: Math.max(4, Math.round(8 * s)),
    maxWidth: "92%",
  };
  return { s, r, box };
}

// ── RatingBadge ───────────────────────────────────────────────────────────────
export function RatingBadge({ value, votes, corner, style, scale, posterWidth, showVotes = true }) {
  const { posterBadges } = useListLayoutSettings();
  const { s, r, box } = usePillMetrics(scale, posterWidth);
  const v = Number(value) || 0;
  if (posterBadges?.tmdbRating === false || v <= 0) return null;

  const accent = ratingAccent(v);
  // Küçük poster boyutunda veya s < 0.80 olduğunda oy sayısını gizle ki pil posterden taşmasın
  const withVotes =
    showVotes && s >= 0.8 && posterBadges?.voteCount !== false && Number(votes) > 0;
  const dot = Math.max(2, Math.round(2.5 * s));

  return (
    <View style={[styles.pill, box, cornerStyle(corner, s), style]}>
      <Ionicons name="star" size={r(10.5)} color={accent} />
      <Text allowFontScaling={false} style={[styles.score, { fontSize: r(10.5) }]}>
        {v.toFixed(1)}
      </Text>
      {withVotes && (
        <>
          <View
            style={{
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: "rgba(255,255,255,0.4)",
              marginHorizontal: Math.max(1, Math.round(1 * s)),
            }}
          />
          <Ionicons name="people" size={r(8.5)} color="rgba(255,255,255,0.6)" />
          <Text allowFontScaling={false} style={[styles.votes, { fontSize: r(9) }]}>
            {formatVotes(votes)}
          </Text>
        </>
      )}
    </View>
  );
}

// ── CountdownBadge ────────────────────────────────────────────────────────────
export function CountdownBadge({ date, days: daysProp, corner, style, scale, posterWidth }) {
  const { posterBadges } = useListLayoutSettings();
  const { language } = useLanguage();
  const { s, r, box } = usePillMetrics(scale, posterWidth);
  const isEn = language === "en";

  if (posterBadges?.countdown === false) return null;
  const days = daysProp != null ? Number(daysProp) : daysUntil(date);
  if (days == null || Number.isNaN(days) || days < 0) return null;

  const bg = days <= 7 ? "#ff7a45" : "#22b866";
  const label =
    days === 0
      ? isEn ? "Today" : "Bugün"
      : days === 1
        ? isEn ? "Tomorrow" : "Yarın"
        : `${days} ${isEn ? "d" : "gün"}`;

  return (
    <View style={[styles.solidPill, box, { backgroundColor: bg }, cornerStyle(corner, s), style]}>
      <Ionicons name="time-outline" size={r(10)} color="#fff" />
      <Text allowFontScaling={false} style={[styles.solidText, { fontSize: r(9.5) }]}>
        {label}
      </Text>
    </View>
  );
}

// ── ReleaseDateBadge ──────────────────────────────────────────────────────────
export function ReleaseDateBadge({ date, variant = "day", corner, style, scale, posterWidth }) {
  const { posterBadges } = useListLayoutSettings();
  const { language } = useLanguage();
  const { s, r, box } = usePillMetrics(scale, posterWidth);

  if (posterBadges?.releaseDate === false) return null;
  const label = formatReleaseDate(date, variant, language === "en");
  if (!label) return null;

  return (
    <View style={[styles.pill, box, cornerStyle(corner, s), style]}>
      <Ionicons name="calendar-outline" size={r(9.5)} color="rgba(255,255,255,0.85)" />
      <Text allowFontScaling={false} style={[styles.dateText, { fontSize: r(9.5) }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(10,12,18,0.78)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
  },
  score: { color: "#fff", fontWeight: "800", letterSpacing: 0.1 },
  votes: { color: "rgba(255,255,255,0.72)", fontWeight: "700" },
  dateText: { color: "rgba(255,255,255,0.92)", fontWeight: "700" },
  solidPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.18)",
  },
  solidText: { color: "#fff", fontWeight: "800", letterSpacing: 0.1 },
});
