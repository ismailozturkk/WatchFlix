// components/ai/AIResponseFooter.js
//
// Bir CineMatch cevabının altındaki şerit:
//   • notlar        filtre/kısaltma raporu ("2 öneri filtrene uymadığı için elendi")
//   • toplu eylemler  hepsini izleme listesine ekle · paylaş · sohbete gönder
//                     (hiçbiri AI hakkı HARCAMAZ)
//   • devam çipleri   türe göre sıradaki adım + "yeniden öner" (her biri bir AI
//                     mesajıdır; yalnız son cevapta çizilir)

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Share } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { alpha } from "../../theme/colors";
import { useAuth } from "../../context/AuthContext";
import { useListStatusContext } from "../../context/ListStatusContext";
import { addManyToMembership } from "../../services/libraryActions";
import {
  buildChatShare,
  buildFollowUps,
  buildShareText,
  collectLibraryItems,
} from "../../services/aiCineInsights";
import { libraryErrorMessage } from "../../utils/libraryErrorText";
import { todayListDate } from "../../utils/mediaFacts";
import { fillCopy } from "../../utils/aiCopy";
import GlassTouchable from "../common/GlassTouchable";

const FEEDBACK_MS = 3200;

/** Cevaptaki bulunmuş başlıkların KAÇI zaten izleme listesinde? (iyimser bindirmeli) */
function useWatchlistState(items) {
  const { statusIndex } = useListStatusContext() || {};
  return useMemo(() => {
    const inList = items.filter((item) => {
      const bucket = item.type === "tv" ? statusIndex?.tv : statusIndex?.movie;
      return Boolean(bucket?.[item.id]?.inWatchList);
    });
    return { inListCount: inList.length, pending: items.filter((item) => !inList.includes(item)) };
  }, [items, statusIndex]);
}

function BulkActions({ response, ctx, showAdd, onShare }) {
  const { theme, copy, posterMap, language } = ctx;
  const { user } = useAuth();
  const items = useMemo(() => collectLibraryItems(response, posterMap), [response, posterMap]);
  const { pending } = useWatchlistState(items);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({ text: "", error: false });
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
    },
    [],
  );

  const show = useCallback((text, error = false) => {
    if (!mountedRef.current) return;
    setFeedback({ text, error });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => mountedRef.current && setFeedback({ text: "", error: false }), FEEDBACK_MS);
  }, []);

  const addAll = useCallback(async () => {
    if (busy || pending.length === 0) return;
    if (!user?.uid) {
      show(copy.actions.signIn, true);
      return;
    }
    setBusy(true);
    const count = pending.length;
    try {
      await addManyToMembership({
        uid: user.uid,
        listKey: "watchList",
        items: pending.map((item) => ({ ...item, dateAdded: todayListDate() })),
      });
      show(fillCopy(copy.actions.addedAll, { n: count }));
    } catch (error) {
      show(libraryErrorMessage(error), true);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [busy, copy, pending, show, user]);

  const share = useCallback(() => {
    const message = buildShareText(response, posterMap, { language });
    if (!message) return;
    Share.share({ message }).catch(() => {});
  }, [language, posterMap, response]);

  // Sohbete gönder: uygulama içi zengin balon (utils/chatShare.js). Gönderilecek
  // bir şey yoksa (boş genel cevap) düğme hiç çıkmaz.
  const canSend = useMemo(
    () => typeof onShare === "function" && buildChatShare(response, posterMap) !== null,
    [onShare, response, posterMap],
  );
  // Ekleme ve sistem paylaşımı yalnız bulunmuş başlık varken ve cevap türü
  // izin veriyorsa (yapım detayında toplu ekleme anlamsız).
  const canAdd = showAdd && items.length > 0;
  const canShare = canAdd;

  if (!canAdd && !canSend) return null;

  const allIn = pending.length === 0;
  const tint = allIn ? theme.colors.green : theme.accent;

  return (
    <View style={s.bulkWrap}>
      {canAdd && (
        <GlassTouchable
          activeOpacity={0.8}
          disabled={busy || allIn}
          onPress={addAll}
          style={[s.bulkBtn, { backgroundColor: alpha(tint, 0.14), borderColor: alpha(tint, 0.5) }]}
        >
          <Ionicons name={allIn ? "checkmark-done" : "bookmarks-outline"} size={14} color={tint} />
          <Text style={[s.bulkText, { color: tint }]} numberOfLines={1}>
            {busy
              ? copy.actions.adding
              : allIn
                ? copy.actions.allAlreadyIn
                : fillCopy(copy.actions.addAll, { n: pending.length })}
          </Text>
        </GlassTouchable>
      )}
      {(canShare || canSend) && (
        <View style={[s.bulkRow, canAdd && s.bulkRowGap]}>
          {canShare && (
            <GlassTouchable
              activeOpacity={0.8}
              onPress={share}
              accessibilityLabel={copy.actions.share}
              style={[s.bulkBtn, s.bulkHalf, { backgroundColor: theme.secondary, borderColor: theme.border }]}
            >
              <Ionicons name="share-outline" size={15} color={theme.text.secondary} />
              <Text style={[s.bulkText, { color: theme.text.secondary }]} numberOfLines={1}>
                {copy.actions.share}
              </Text>
            </GlassTouchable>
          )}
          {canSend && (
            <GlassTouchable
              activeOpacity={0.8}
              onPress={onShare}
              accessibilityLabel={copy.actions.sendToChat}
              style={[
                s.bulkBtn,
                s.bulkHalf,
                { backgroundColor: alpha(theme.accent, 0.14), borderColor: alpha(theme.accent, 0.5) },
              ]}
            >
              <Ionicons name="paper-plane-outline" size={15} color={theme.accent} />
              <Text style={[s.bulkText, { color: theme.accent }]} numberOfLines={1}>
                {copy.actions.sendToChat}
              </Text>
            </GlassTouchable>
          )}
        </View>
      )}
      {!!feedback.text && (
        <Text style={[s.feedback, { color: feedback.error ? theme.colors.red : theme.colors.green }]}>
          {feedback.text}
        </Text>
      )}
    </View>
  );
}

function Notes({ notes, ctx }) {
  const { theme, copy } = ctx;
  const lines = [];
  if (notes?.relaxed) lines.push(copy.notes.relaxed);
  else if (notes?.removed > 0) lines.push(fillCopy(copy.notes.filtered, { n: notes.removed }));
  if (notes?.seen > 0) lines.push(fillCopy(copy.notes.seen, { n: notes.seen }));
  if (notes?.truncated) lines.push(copy.notes.truncated);
  if (!lines.length) return null;
  return (
    <View style={s.notes}>
      {lines.map((line) => (
        <View key={line} style={s.noteRow}>
          <Ionicons name="information-circle-outline" size={13} color={theme.text.muted} />
          <Text style={[s.noteText, { color: theme.text.muted }]}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

function FollowUps({ response, ctx, disabled, onFollowUp, onRegenerate }) {
  const { theme, copy, language, posterMap } = ctx;
  const chips = useMemo(
    () => buildFollowUps(response, { language, limit: 3, posterMap }),
    [response, language, posterMap],
  );
  return (
    <View style={s.followWrap}>
      <Text style={[s.followTitle, { color: theme.text.muted }]}>{copy.actions.followUps}</Text>
      <View style={s.followRow}>
        {chips.map((chip) => (
          <GlassTouchable
            key={chip.id}
            disabled={disabled}
            activeOpacity={0.8}
            onPress={() => onFollowUp(chip.prompt, chip.label)}
            style={[
              s.followChip,
              { backgroundColor: theme.secondary, borderColor: theme.border, opacity: disabled ? 0.5 : 1 },
            ]}
          >
            <Ionicons name={chip.icon} size={13} color={theme.bold} />
            <Text style={[s.followText, { color: theme.text.primary }]} numberOfLines={1}>
              {chip.label}
            </Text>
          </GlassTouchable>
        ))}
        {!!onRegenerate && (
          <GlassTouchable
            disabled={disabled}
            activeOpacity={0.8}
            onPress={onRegenerate}
            style={[
              s.followChip,
              { backgroundColor: "transparent", borderColor: theme.border, opacity: disabled ? 0.5 : 1 },
            ]}
          >
            <Ionicons name="refresh" size={13} color={theme.text.secondary} />
            <Text style={[s.followText, { color: theme.text.secondary }]} numberOfLines={1}>
              {copy.actions.regenerate}
            </Text>
          </GlassTouchable>
        )}
      </View>
      <Text style={[s.costHint, { color: theme.text.muted }]}>{copy.actions.costHint}</Text>
    </View>
  );
}

function AIResponseFooter({
  response,
  notes,
  ctx,
  isLast,
  loading,
  showFollowUps,
  onFollowUp,
  onRegenerate,
  onShare,
  showBulk = true,
}) {
  const hasFollowUps = isLast && showFollowUps && buildFollowUps(response, { limit: 1 }).length > 0;
  return (
    <View>
      <Notes notes={notes} ctx={ctx} />
      <BulkActions response={response} ctx={ctx} showAdd={showBulk} onShare={onShare} />
      {isLast && (hasFollowUps || onRegenerate) ? (
        <FollowUps
          response={response}
          ctx={ctx}
          disabled={loading}
          onFollowUp={onFollowUp}
          onRegenerate={onRegenerate}
        />
      ) : null}
    </View>
  );
}

export default memo(AIResponseFooter);

const s = StyleSheet.create({
  notes: { marginTop: 8, gap: 3, paddingHorizontal: 2 },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  noteText: { flex: 1, fontSize: 11, lineHeight: 15 },

  bulkWrap: { marginTop: 8 },
  bulkRow: { flexDirection: "row", gap: 8 },
  bulkRowGap: { marginTop: 8 },
  bulkHalf: { flex: 1 },
  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  bulkText: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
  feedback: { fontSize: 11.5, lineHeight: 16, marginTop: 6, marginLeft: 2, fontWeight: "600" },

  followWrap: { marginTop: 12 },
  followTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, marginBottom: 7, marginLeft: 2 },
  followRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  followChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 11,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
  },
  followText: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
  costHint: { fontSize: 10, marginTop: 7, marginLeft: 2 },
});
