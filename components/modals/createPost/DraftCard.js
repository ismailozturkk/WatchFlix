// components/modals/createPost/DraftCard.js
//
// "Taslaklar" ekranının (CreatePostModal) kartı ve boş durumu. Postlarım
// kartıyla aynı görsel dil: tip rengiyle yumuşak ışık, sol poster yığını,
// rozet + zaman satırı. Silme/devam etme mantığı pencerede kalır; burada
// yalnız sunum var.

import React, { memo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Octicons } from "@expo/vector-icons";
import PosterStack, { STACK_POSTER_H, STACK_POSTER_W } from "../../feed/PosterStack";
import { postTypeMeta } from "../../feed/postTypeMeta";
import { alpha } from "../../../theme/colors";
import { DANGER } from "./ComposerParts";

const STAR = "#FFD54F";

// Taslakta medya iki biçimde olabilir: taze TMDB öğesi (poster_path) ya da
// düzenlenen gönderiden gelen tam URL (poster).
const draftPosterUri = (m, getTmdbUrl) =>
  m?.poster_path ? getTmdbUrl(m.poster_path, "poster", 200) : m?.poster || null;

export const DraftCard = memo(function DraftCard({
  draft,
  theme,
  locale,
  getTmdbUrl,
  spoilerLabel,
  continueLabel,
  onContinue,
  onDelete,
}) {
  const meta = postTypeMeta(draft.postType, theme.colors);
  const accent = meta.color;
  const media = Array.isArray(draft.selectedMedia) ? draft.selectedMedia : [];
  const uris = media.map((m) => draftPosterUri(m, getTmdbUrl)).filter(Boolean);
  const wantsPoster = draft.postType === "review" || draft.postType === "list";
  const hasVisual = uris.length > 0 || (wantsPoster && media.length > 0);
  const isText = draft.postType === "text";
  const rating = draft.userRating || 0;

  const when = new Date(draft.createdAt).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View
      style={[st.shadow, { shadowColor: theme.shadow || "#000", backgroundColor: theme.secondary }]}
    >
      <View style={[st.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <LinearGradient
          colors={[alpha(accent, 0.13), alpha(accent, 0)]}
          style={st.wash}
          pointerEvents="none"
        />

        {/* Rozet + zaman */}
        <View style={st.metaRow}>
          <View
            style={[
              st.typePill,
              { backgroundColor: alpha(accent, 0.13), borderColor: alpha(accent, 0.32) },
            ]}
          >
            <Ionicons name={meta.icon} size={11} color={accent} />
            <Text style={[st.typeText, { color: accent }]}>{meta.label}</Text>
          </View>
          {draft.hasSpoiler && (
            <View style={st.spoilerPill}>
              <Ionicons name="eye-off" size={10} color={DANGER} />
              <Text style={st.spoilerText}>{spoilerLabel}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Ionicons name="time-outline" size={12} color={theme.text.muted} />
          <Text style={[st.time, { color: theme.text.muted }]} numberOfLines={1}>
            {when}
          </Text>
        </View>

        {/* Gövde */}
        <View style={st.body}>
          {hasVisual && (
            <View style={st.visualCol}>
              {uris.length > 0 ? (
                <PosterStack uris={uris} theme={theme} />
              ) : (
                <View
                  style={[
                    st.visualFallback,
                    { backgroundColor: alpha(accent, 0.12), borderColor: alpha(accent, 0.3) },
                  ]}
                >
                  <Ionicons name="film-outline" size={26} color={accent} />
                </View>
              )}
            </View>
          )}
          <View style={st.copy}>
            {!!draft.title && (
              <Text
                fontRole="body"
                style={[st.title, { color: theme.text.primary }]}
                numberOfLines={2}
              >
                {draft.title}
              </Text>
            )}
            {!!draft.content &&
              (isText ? (
                <View
                  style={[
                    st.quote,
                    { backgroundColor: alpha(accent, 0.07), borderLeftColor: accent },
                  ]}
                >
                  <Text
                    fontRole="body"
                    style={[st.quoteText, { color: theme.text.primary }]}
                    numberOfLines={4}
                  >
                    {draft.content}
                  </Text>
                </View>
              ) : (
                <Text
                  fontRole="body"
                  style={[st.content, { color: theme.text.secondary }]}
                  numberOfLines={hasVisual ? 4 : 3}
                >
                  {draft.content}
                </Text>
              ))}
            {rating > 0 && (
              <View style={st.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Octicons
                    key={n}
                    name={rating >= n ? "star-fill" : "star"}
                    size={13}
                    color={rating >= n ? STAR : theme.text.muted}
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Aksiyonlar */}
        <View style={[st.actions, { borderTopColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onContinue(draft)}
            style={({ pressed }) => [
              st.continueBtn,
              {
                backgroundColor: alpha(accent, pressed ? 0.2 : 0.12),
                borderColor: alpha(accent, 0.38),
              },
            ]}
          >
            <Ionicons name="create-outline" size={16} color={accent} />
            <Text style={[st.continueText, { color: accent }]} numberOfLines={1}>
              {continueLabel}
            </Text>
            <Ionicons name="arrow-forward" size={15} color={accent} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onDelete(draft.id)}
            style={({ pressed }) => [
              st.deleteBtn,
              { backgroundColor: alpha(DANGER, pressed ? 0.18 : 0.1), borderColor: alpha(DANGER, 0.3) },
            ]}
          >
            <Ionicons name="trash-outline" size={18} color={DANGER} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

export const DraftsEmpty = memo(function DraftsEmpty({ theme, accent, title, desc }) {
  return (
    <View style={st.empty}>
      <View
        style={[
          st.emptyHalo,
          { backgroundColor: alpha(accent, 0.1), borderColor: alpha(accent, 0.22) },
        ]}
      >
        <View style={[st.emptyIcon, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <Ionicons name="documents-outline" size={38} color={accent} />
        </View>
      </View>
      <Text style={[st.emptyTitle, { color: theme.text.primary }]}>{title}</Text>
      <Text style={[st.emptyDesc, { color: theme.text.secondary }]}>{desc}</Text>
    </View>
  );
});

const st = StyleSheet.create({
  // iOS gölgesi overflow:hidden ile kırpılır → gölge dış sarmalayıcıda
  shadow: {
    marginBottom: 14,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  wash: { position: "absolute", left: 0, right: 0, top: 0, height: 140 },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeText: { fontSize: 9.5, fontWeight: "900", letterSpacing: 0.4 },
  spoilerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: "rgba(240,79,79,0.12)",
  },
  spoilerText: { color: DANGER, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.4 },
  time: { fontSize: 11.5, fontWeight: "500", flexShrink: 1 },

  body: { flexDirection: "row", gap: 14 },
  visualCol: { flexShrink: 0 },
  visualFallback: {
    width: STACK_POSTER_W,
    height: STACK_POSTER_H,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16.5, lineHeight: 22, fontWeight: "800", marginBottom: 6, letterSpacing: -0.2 },
  content: { fontSize: 13.5, lineHeight: 20, marginBottom: 8 },
  quote: {
    borderLeftWidth: 3,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  quoteText: { fontSize: 14, lineHeight: 21 },
  stars: { flexDirection: "row", gap: 3 },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  continueBtn: {
    flex: 1,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  continueText: { flexShrink: 1, fontSize: 13.5, fontWeight: "800" },
  deleteBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: { alignItems: "center", paddingTop: 40, paddingHorizontal: 32 },
  emptyHalo: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", marginBottom: 6 },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 21 },
});
