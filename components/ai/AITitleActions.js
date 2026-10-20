// components/ai/AITitleActions.js
//
// CineMatch kartlarındaki bir yapım için hızlı liste eylemleri: izleme listesi
// (hap düğme) + favori (kalp). AI önerisini tek dokunuşla kütüphaneye taşır.
//
// YAZMA YOLU: services/libraryActions.setListMembership — projedeki tek kapı
// (sıralı, iyimser, hatada geri alır). Durum `useListStatus`tan gelir ve iyimser
// bindirmeyi içerir; burada ayrı bir "eklendi" state'i TUTULMAZ.
//
// GERİ BİLDİRİM YEREL: sonuç, düğmenin kendi durumuyla ve satır içi bir hata metniyle
// bildirilir (düğme tam ekran paneldeki kartın İÇİNDE; toast'ın yerine bağlam gösterir).
// Not: CineMatch paneli bir RN Modal; toast artık orada da görünür (AIChatScreen kendi
// <ModalToastHost>unu taşır) ama appAlert hâlâ modalın arkasında kalır.

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { alpha } from "../../theme/colors";
import { useAuth } from "../../context/AuthContext";
import { useHapticsSettings } from "../../context/AppSettingsContext";
import { useListStatus } from "../../hooks/useListStatus";
import * as Haptics from "../../services/hapticsService";
import { setListMembership } from "../../services/libraryActions";
import { libraryErrorMessage } from "../../utils/libraryErrorText";
import { todayListDate } from "../../utils/mediaFacts";
import { normMediaType, toStr } from "../../services/aiCineService";
import GlassTouchable from "../common/GlassTouchable";

const ERROR_VISIBLE_MS = 3200;

function AITitleActions({ card, theme, copy, style, compact = false, vertical = false }) {
  const { user } = useAuth();
  const { hapticsEnabled } = useHapticsSettings();
  const mediaType = normMediaType(card?.mediaType);
  const mediaId = card?.found ? card.id : null;
  const { inWatchList, inFavorites } = useListStatus(mediaId, mediaType);
  const [message, setMessage] = useState("");
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const flash = useCallback((text) => {
    setMessage(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(""), ERROR_VISIBLE_MS);
  }, []);

  const toggle = useCallback(
    async (listKey) => {
      if (mediaId == null) return;
      if (!user?.uid) {
        flash(copy.actions.signIn);
        return;
      }
      // Hedef durum GÖRÜNEN (bindirmeli) durumdan türer: art arda iki dokunuş
      // ekle→çıkar olur, ekle→ekle olmaz.
      const next = !(listKey === "favorites" ? inFavorites : inWatchList);
      if (hapticsEnabled) {
        Haptics.impactAsync(next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
      }
      try {
        await setListMembership({
          uid: user.uid,
          listKey,
          item: {
            id: mediaId,
            type: mediaType,
            name: toStr(card.title) || toStr(card.query),
            imagePath: card.posterPath || null,
            dateAdded: todayListDate(),
          },
          desired: next,
        });
        setMessage("");
      } catch (error) {
        // Bindirme ve yerel liste kendiliğinden geri döndü; yalnız bildir.
        flash(libraryErrorMessage(error));
      }
    },
    [card, copy, flash, hapticsEnabled, inFavorites, inWatchList, mediaId, mediaType, user],
  );

  if (mediaId == null) return null;

  const blue = theme.colors.blue;
  const red = theme.colors.red;
  const height = compact ? 28 : 32;

  return (
    <View style={style}>
      <View style={[s.row, vertical && s.column]}>
        <GlassTouchable
          activeOpacity={0.8}
          onPress={() => toggle("watchList")}
          accessibilityRole="button"
          accessibilityLabel={copy.actions.watchlist}
          accessibilityState={{ selected: inWatchList }}
          style={[
            s.pill,
            {
              height,
              backgroundColor: inWatchList ? alpha(blue, 0.18) : theme.between,
              borderColor: inWatchList ? alpha(blue, 0.6) : theme.border,
            },
          ]}
        >
          <Ionicons
            name={inWatchList ? "bookmark" : "bookmark-outline"}
            size={compact ? 13 : 14}
            color={inWatchList ? blue : theme.text.secondary}
          />
          {!compact && (
            <Text style={[s.pillText, { color: inWatchList ? blue : theme.text.secondary }]} numberOfLines={1}>
              {inWatchList ? copy.actions.inWatchlist : copy.actions.watchlist}
            </Text>
          )}
        </GlassTouchable>
        <GlassTouchable
          activeOpacity={0.8}
          onPress={() => toggle("favorites")}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={copy.actions.favorite}
          accessibilityState={{ selected: inFavorites }}
          style={[
            s.round,
            {
              width: height,
              height,
              borderRadius: height / 2,
              backgroundColor: inFavorites ? alpha(red, 0.16) : theme.between,
              borderColor: inFavorites ? alpha(red, 0.55) : theme.border,
            },
          ]}
        >
          <Ionicons
            name={inFavorites ? "heart" : "heart-outline"}
            size={compact ? 14 : 15}
            color={inFavorites ? red : theme.text.secondary}
          />
        </GlassTouchable>
      </View>
      {!!message && (
        <Text style={[s.error, { color: red }]} numberOfLines={2}>
          {message}
        </Text>
      )}
    </View>
  );
}

export default memo(AITitleActions);

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  column: { flexDirection: "column", alignItems: "center", gap: 6 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 32,
  },
  pillText: { fontSize: 12, fontWeight: "700" },
  round: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  error: { fontSize: 11, lineHeight: 15, marginTop: 5 },
});
