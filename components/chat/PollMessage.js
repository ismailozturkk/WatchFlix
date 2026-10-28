// components/chat/PollMessage.js
//
// Sohbet/grup mesajı içinde ANKET gövdesi. İki tip:
//   - type "text"  → metin seçenekleri (oy barı + yüzde)
//   - type "media" → dizi/film poster seçenekleri (oy ile seçilir)
// Oy verme tek-seçim + toggle (aynı seçeneğe tekrar basınca geri çekilir).
// Oylar message.poll.votes = { [uid]: optionId } olarak Firestore'da; sayım UI'da
// (postComposer.tallyVotes — sohbet, feed ve post detayı aynı sayımı paylaşır).

import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { tallyVotes } from "../../utils/postComposer";
import { alpha } from "../../theme/colors";

// Sonuç barı: oy değişince genişlik yumuşakça yeni yüzdeye akar (eskiden anında
// zıplıyordu). İlk çizimde animasyon yok — anket zaten balonla birlikte giriyor.
function OptionBar({ pct, color, style }) {
  const anim = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // genişlik layout özelliği
    }).start();
  }, [pct, anim]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bar,
        style,
        {
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        },
      ]}
    />
  );
}

// Oy işareti belirirken yaylanarak büyür.
function PopIn({ style, children }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 180,
    }).start();
  }, [scale]);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

export default function PollMessage({
  poll,
  currentUid,
  accent,
  getTmdbUrl,
  onVote,
  variant = "chat",
  theme,
  isOutgoing = false,
}) {
  const { theme: contextTheme } = useTheme();
  const activeTheme = theme || contextTheme;
  const activeAccent = accent || activeTheme.accent || "#6C63FF";

  const { question, type, options = [], votes = {} } = poll || {};
  const userVote = votes?.[currentUid] || null;
  const isFeed = variant === "feed";

  const { counts, total } = useMemo(() => tallyVotes(votes), [votes]);

  const pct = (optId) => (total > 0 ? Math.round(((counts[optId] || 0) / total) * 100) : 0);

  const primaryTextColor = isOutgoing ? "#fff" : activeTheme.text.primary;
  const mutedTextColor = isOutgoing ? "rgba(255,255,255,0.75)" : activeTheme.text.muted;
  const secondaryTextColor = isOutgoing ? "rgba(255,255,255,0.9)" : activeTheme.text.secondary;
  const voteHint = userVote
    ? i18nText("autoI18n.oyunu_degistirmek_icin_dokun", "Oyunu değiştirmek için dokun")
    : i18nText("autoI18n.oy_vermek_icin_dokun", "Oy vermek için dokun");
  // Feed'de anket, kartın içindeki `primary` zeminli panelde durur; seçenekler
  // `secondary` ile paneldan ayrışır. Sohbet balonunda eski `between` kalır.
  const optBgColor = isOutgoing
    ? "rgba(255,255,255,0.12)"
    : isFeed
      ? activeTheme.secondary
      : activeTheme.between;
  // Az seçenekte posterler büyük, 4'te dört sütun (eski sabit %23.5 iki
  // seçenekte posterleri minik bırakıyordu).
  const feedMediaWidth =
    options.length <= 2 ? "34%" : options.length === 3 ? "31%" : "23.5%";
  const optBorderColor = isOutgoing ? "rgba(255,255,255,0.25)" : activeTheme.border;

  return (
    <View style={[styles.wrap, isFeed && styles.feedWrap]}>
      {/* Başlık — feed'de kartın kendi tip rozeti var, burada tekrarlanmaz */}
      {!isFeed && (
      <View style={styles.head}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isOutgoing
                ? "rgba(255,255,255,0.2)"
                : alpha(activeAccent, 0.15),
              borderColor: isOutgoing
                ? "rgba(255,255,255,0.4)"
                : alpha(activeAccent, 0.35),
            },
          ]}
        >
          <Ionicons
            name="stats-chart"
            size={12}
            color={isOutgoing ? "#fff" : activeAccent}
          />
          <Text
            style={[
              styles.badgeText,
              { color: isOutgoing ? "#fff" : activeAccent },
            ]}
          >
            {i18nText("autoI18n.anket", "Anket")}
          </Text>
        </View>
        <View
          style={[
            styles.totalChip,
            {
              backgroundColor: isOutgoing
                ? "rgba(255,255,255,0.14)"
                : alpha(activeAccent, 0.1),
            },
          ]}
        >
          <Ionicons name="people-outline" size={12} color={mutedTextColor} />
          <Text style={[styles.totalText, { color: mutedTextColor }]}>
            {i18nText("autoI18n.n_oy", "{{n}} oy", { n: total })}
          </Text>
        </View>
      </View>
      )}

      {/* Stili başlık imzası taşısa da bu, KULLANICININ yazdığı anket sorusu —
          dekoratif başlık fontuna sokulmamalı (bkz. utils/typographyRoles.js). */}
      <View
        style={[
          !isFeed && styles.questionBlock,
          !isFeed && {
            backgroundColor: isOutgoing
              ? "rgba(255,255,255,0.1)"
              : alpha(activeAccent, 0.08),
            borderColor: isOutgoing
              ? "rgba(255,255,255,0.16)"
              : alpha(activeAccent, 0.18),
          },
        ]}
      >
        {!isFeed && (
          <View
            style={[
              styles.questionRail,
              { backgroundColor: isOutgoing ? "rgba(255,255,255,0.8)" : activeAccent },
            ]}
          />
        )}
        <Text
          fontRole="body"
          style={[styles.question, isFeed && styles.feedQuestion, { color: primaryTextColor }]}
        >
          {question}
        </Text>
      </View>

      {/* ── METİN ANKETİ ── */}
      {type === "text" && (
        <View style={{ gap: isFeed ? 8 : 7, marginTop: isFeed ? 12 : 8 }}>
          {options.map((opt) => {
            const voted = userVote === opt.id;
            const p = pct(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                testID={`poll-option-${opt.id}`}
                activeOpacity={0.85}
                onPress={() => onVote(opt.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: voted }}
                accessibilityLabel={`${opt.label}${total > 0 ? `, ${p}%` : ""}`}
                accessibilityHint={voteHint}
                style={[
                  styles.textOpt,
                  isFeed && styles.feedTextOpt,
                  {
                    borderColor: voted
                      ? isOutgoing
                        ? "#fff"
                        : activeAccent
                      : optBorderColor,
                    backgroundColor: optBgColor,
                  },
                ]}
              >
                {/* Sonuç barı (zemin) */}
                <OptionBar
                  pct={p}
                  style={isFeed && styles.feedBar}
                  color={
                    voted
                      ? isOutgoing
                        ? "rgba(255,255,255,0.3)"
                        : alpha(activeAccent, 0.28)
                      : isOutgoing
                        ? "rgba(255,255,255,0.08)"
                        : alpha(activeTheme.border, 0.5)
                  }
                />
                <View style={styles.textOptRow}>
                  <View
                    style={[
                      styles.choiceMark,
                      {
                        borderColor: voted
                          ? isOutgoing
                            ? "#fff"
                            : activeAccent
                          : mutedTextColor,
                        backgroundColor: voted
                          ? isOutgoing
                            ? "#fff"
                            : activeAccent
                          : "transparent",
                      },
                    ]}
                  >
                    {voted && (
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={isOutgoing ? activeAccent : "#fff"}
                      />
                    )}
                  </View>
                  <Text
                    style={[styles.optLabel, { color: primaryTextColor }]}
                    numberOfLines={2}
                  >
                    {opt.label}
                  </Text>
                  {total > 0 && (
                    <View
                      style={[
                        styles.pctPill,
                        {
                          backgroundColor: isOutgoing
                            ? "rgba(255,255,255,0.14)"
                            : alpha(activeAccent, voted ? 0.16 : 0.08),
                        },
                      ]}
                    >
                      <Text style={[styles.optPct, { color: secondaryTextColor }]}>
                        {p}%
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── MEDYA ANKETİ ── */}
      {type === "media" && (
        <View
          style={[
            styles.mediaGrid,
            isFeed && styles.feedMediaGrid,
            isFeed && options.length < 4 && { justifyContent: "center" },
            isFeed && { marginTop: 12 },
          ]}
        >
          {options.map((opt) => {
            const voted = userVote === opt.id;
            const p = pct(opt.id);
            const poster = opt.media?.poster_path;
            return (
              <TouchableOpacity
                key={opt.id}
                testID={`poll-option-${opt.id}`}
                activeOpacity={0.85}
                onPress={() => onVote(opt.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: voted }}
                accessibilityLabel={`${opt.label}${total > 0 ? `, ${p}%` : ""}`}
                accessibilityHint={voteHint}
                style={[
                  styles.mediaOpt,
                  !isFeed && styles.chatMediaOpt,
                  isFeed && styles.feedMediaOpt,
                  isFeed && { width: feedMediaWidth },
                ]}
              >
                <View
                  style={[
                    styles.posterBox,
                    !isFeed && styles.chatPosterBox,
                    isFeed && {
                      width: "100%",
                      height: undefined,
                      aspectRatio: 2 / 3,
                      borderColor: activeTheme.border,
                    },
                    {
                      borderColor: voted
                        ? isOutgoing
                          ? "#fff"
                          : activeAccent
                        : optBorderColor,
                      backgroundColor: activeTheme.between,
                    },
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
                        { backgroundColor: activeTheme.between },
                      ]}
                    >
                      <Ionicons
                        name="film-outline"
                        size={isFeed ? 15 : 18}
                        color={mutedTextColor}
                      />
                    </View>
                  )}
                  {voted && (
                    <PopIn
                      style={[
                        styles.voteCheck,
                        {
                          backgroundColor: isOutgoing ? "#fff" : activeAccent,
                          borderColor: isOutgoing ? activeAccent : "#fff",
                        },
                      ]}
                    >
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={isOutgoing ? activeAccent : "#fff"}
                      />
                    </PopIn>
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
                    { color: primaryTextColor },
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

      <View style={[styles.hintRow, isFeed && styles.feedHintRow]}>
        {!isFeed && <Ionicons name="information-circle-outline" size={13} color={mutedTextColor} />}
        <Text style={[styles.hint, isFeed && styles.feedHint, { color: mutedTextColor }]}>
          {isFeed ? `${i18nText("autoI18n.n_oy", "{{n}} oy", { n: total })} · ` : ""}
          {voteHint}
        </Text>
      </View>
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
  totalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  totalText: { fontSize: 11, fontWeight: "700" },
  question: { fontSize: 15, fontWeight: "800", lineHeight: 20 },
  questionBlock: {
    position: "relative",
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    overflow: "hidden",
  },
  questionRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  feedQuestion: { fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },

  // text
  textOpt: {
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: "hidden",
    minHeight: 48,
    justifyContent: "center",
  },
  bar: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 10 },
  feedTextOpt: { borderRadius: 14, minHeight: 48 },
  feedBar: { borderRadius: 12 },
  textOptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 11,
  },
  choiceMark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  optLabel: { flex: 1, fontSize: 13.5, fontWeight: "600", lineHeight: 18 },
  optPct: { fontSize: 12.5, fontWeight: "800" },
  pctPill: { minWidth: 42, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9, alignItems: "center" },

  // media
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  mediaOpt: { width: 82 },
  chatMediaOpt: { width: "48%", flexGrow: 1, maxWidth: "49%" },
  feedMediaGrid: { flexWrap: "nowrap", gap: 5 },
  feedMediaOpt: { width: "23.5%", minWidth: 0 },
  posterBox: {
    width: 82,
    height: 123,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    position: "relative",
  },
  chatPosterBox: { width: "100%", height: undefined, aspectRatio: 2 / 3, borderRadius: 12 },
  poster: { width: "100%", height: "100%" },
  posterPh: { justifyContent: "center", alignItems: "center" },
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
  mediaLabel: { fontSize: 10.5, fontWeight: "600", marginTop: 4, lineHeight: 13 },
  feedMediaLabel: { fontSize: 10.5, lineHeight: 13, marginTop: 6 },

  hint: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10, paddingHorizontal: 2 },
  feedHintRow: { marginTop: 12, paddingHorizontal: 0 },
  feedHint: { fontStyle: "normal", fontWeight: "600", fontSize: 11.5 },
});
