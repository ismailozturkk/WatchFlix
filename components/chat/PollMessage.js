// components/chat/PollMessage.js
//
// Sohbet/grup mesajı içinde ANKET gövdesi. İki tip:
//   - type "text"  → metin seçenekleri (oy barı + yüzde)
//   - type "media" → dizi/film poster seçenekleri (oy ile seçilir)
// Oy verme tek-seçim + toggle (aynı seçeneğe tekrar basınca geri çekilir).
// Oylar message.poll.votes = { [uid]: optionId } olarak Firestore'da; sayım UI'da.

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { i18nText } from "../../utils/i18nText";

export default function PollMessage({
  poll,
  currentUid,
  accent = "#6C63FF",
  getTmdbUrl,
  onVote,
  variant = "chat",
  theme,
}) {
  const { question, type, options = [], votes = {} } = poll || {};
  const userVote = votes?.[currentUid] || null;
  const isFeed = variant === "feed" && theme;

  const { counts, total } = useMemo(() => {
    const c = {};
    let t = 0;
    Object.values(votes || {}).forEach((optId) => {
      if (optId == null) return;
      c[optId] = (c[optId] || 0) + 1;
      t += 1;
    });
    return { counts: c, total: t };
  }, [votes]);

  const pct = (optId) => (total > 0 ? Math.round(((counts[optId] || 0) / total) * 100) : 0);

  return (
    <View style={[styles.wrap, isFeed && styles.feedWrap]}>
      {/* Başlık */}
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: accent + "22", borderColor: accent + "55" }]}>
          <Ionicons name="stats-chart" size={12} color={accent} />
          <Text style={[styles.badgeText, { color: accent }]}>
            {i18nText("autoI18n.anket", "Anket")}
          </Text>
        </View>
        <Text style={[styles.totalText, isFeed && { color: theme.text.muted }]}>
          {i18nText("autoI18n.n_oy", "{{n}} oy", { n: total })}
        </Text>
      </View>

      <Text style={[styles.question, isFeed && { color: theme.text.primary }]}>{question}</Text>

      {/* ── METİN ANKETİ ── */}
      {type === "text" && (
        <View style={{ gap: 7, marginTop: 8 }}>
          {options.map((opt) => {
            const voted = userVote === opt.id;
            const p = pct(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                activeOpacity={0.85}
                onPress={() => onVote(opt.id)}
                style={[
                  styles.textOpt,
                  isFeed && {
                    borderColor: theme.border,
                    backgroundColor: theme.primary,
                  },
                  voted && { borderColor: accent },
                ]}
              >
                {/* Sonuç barı (zemin) */}
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${p}%`,
                      backgroundColor: voted
                        ? accent + "44"
                        : isFeed
                          ? theme.border
                          : "rgba(255,255,255,0.08)",
                    },
                  ]}
                />
                <View style={styles.textOptRow}>
                  <Ionicons
                    name={voted ? "checkmark-circle" : "ellipse-outline"}
                    size={17}
                    color={voted ? accent : isFeed ? theme.text.muted : "rgba(255,255,255,0.4)"}
                  />
                  <Text
                    style={[styles.optLabel, isFeed && { color: theme.text.primary }]}
                    numberOfLines={2}
                  >
                    {opt.label}
                  </Text>
                  {total > 0 && (
                    <Text style={[styles.optPct, isFeed && { color: theme.text.secondary }]}>
                      {p}%
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── MEDYA ANKETİ ── */}
      {type === "media" && (
        <View style={[styles.mediaGrid, isFeed && styles.feedMediaGrid]}>
          {options.map((opt) => {
            const voted = userVote === opt.id;
            const p = pct(opt.id);
            const poster = opt.media?.poster_path;
            return (
              <TouchableOpacity
                key={opt.id}
                activeOpacity={0.85}
                onPress={() => onVote(opt.id)}
                style={[styles.mediaOpt, isFeed && styles.feedMediaOpt]}
              >
                <View
                  style={[
                    styles.posterBox,
                    isFeed && { width: "100%", height: undefined, aspectRatio: 2 / 3, borderColor: theme.border },
                    voted && { borderColor: accent },
                  ]}
                >
                  {poster ? (
                    <Image
                      source={{ uri: getTmdbUrl(poster, "poster", 200) }}
                      style={styles.poster}
                      cachePolicy="memory-disk"
                      transition={120}
                    />
                  ) : (
                    <View
                      style={[
                        styles.poster,
                        styles.posterPh,
                        isFeed && { backgroundColor: theme.primary },
                      ]}
                    >
                      <Ionicons
                        name="film-outline"
                        size={isFeed ? 15 : 18}
                        color={isFeed ? theme.text.muted : "rgba(255,255,255,0.35)"}
                      />
                    </View>
                  )}
                  {voted && (
                    <View style={[styles.voteCheck, { backgroundColor: accent }]}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                  {total > 0 && (
                    <View style={styles.pctTag}>
                      <Text style={styles.pctTagText}>{p}%</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.mediaLabel,
                    isFeed && styles.feedMediaLabel,
                    isFeed && { color: theme.text.primary },
                  ]}
                  numberOfLines={2}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={[styles.hint, isFeed && { color: theme.text.muted }]}>
        {userVote
          ? i18nText("autoI18n.oyunu_degistirmek_icin_dokun", "Oyunu değiştirmek için dokun")
          : i18nText("autoI18n.oy_vermek_icin_dokun", "Oy vermek için dokun")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", minWidth: 230, marginBottom: 8 },
  feedWrap: { minWidth: 0, marginBottom: 4 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.3 },
  totalText: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700" },
  question: { color: "#fff", fontSize: 15, fontWeight: "800", lineHeight: 20 },

  // text
  textOpt: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    minHeight: 42,
    justifyContent: "center",
  },
  bar: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 10 },
  textOptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  optLabel: { flex: 1, color: "#fff", fontSize: 13.5, fontWeight: "600", lineHeight: 18 },
  optPct: { color: "rgba(255,255,255,0.8)", fontSize: 12.5, fontWeight: "800" },

  // media
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  mediaOpt: { width: 82 },
  feedMediaGrid: { flexWrap: "nowrap", gap: 5 },
  feedMediaOpt: { width: "23.5%", minWidth: 0 },
  posterBox: {
    width: 82,
    height: 123,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    position: "relative",
  },
  poster: { width: "100%", height: "100%" },
  posterPh: { justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)" },
  voteCheck: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  pctTag: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 7,
  },
  pctTagText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  mediaLabel: { color: "rgba(255,255,255,0.9)", fontSize: 10.5, fontWeight: "600", marginTop: 4, lineHeight: 13 },
  feedMediaLabel: { fontSize: 9, lineHeight: 11.5, marginTop: 4 },

  hint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10.5,
    fontStyle: "italic",
    marginTop: 9,
  },
});
