// components/modals/createPost/TierListPicker.js
//
// Paylaşım penceresinde (CreatePostModal) "Tier list" türünün gövdesi.
//   • Seçili tablo varsa: koyu TierMaker zemininde önizleme + "Değiştir".
//   • Seçim kipi: cihazdaki tablolar (hooks/useTierLists — Eğlence > Tier list'te oluşturulanlar), yerleşmiş yapımı
//     olmayan tablo seçilemez (gönderide yalnız kademelere yerleşmiş yapımlar gider, havuz gitmez).
//   • "Yeni tier list oluştur": pencereyi kapatıp Tablolarım'da oluşturma sayfasını açar (CreatePostModal yönetir).
//
// `selected` paylaşım gövdesidir (utils/chatShare.buildTierListShare): Eğlence'den gelen, taslaktan / düzenlenen
// gönderiden yüklenen tablo cihazda olmayabilir; önizleme yalnız gövdeden çizilir.

import React, { memo, useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GlassTouchable from "../../common/GlassTouchable";
import TierMiniPreview from "../../tierList/TierMiniPreview";
import { alpha } from "../../../theme/colors";
import { buildTmdbUrl } from "../../../utils/tmdbImageUtils";
import { tierListCounts, tierListShareView } from "../../../utils/tierList";
import { SectionHeader } from "./ComposerParts";

const BOARD_BG = "#1A1A17";

function TierListPicker({ theme, accent, copy, lists, selected, selectedId, choosing, onChoose, onPick, onCreate }) {
  const posterUriOf = useCallback((media, width) => buildTmdbUrl(media.poster_path, "poster", width), []);
  const showPicker = choosing || !selected;

  return (
    <View>
      <SectionHeader
        theme={theme}
        accent={accent}
        label={copy.postSection}
        badge={selected ? copy.cardCount(selected.total) : null}
      />

      {selected && !showPicker ? (
        <View style={styles.board} testID="composer-tier-selected">
          <View style={styles.boardHead}>
            <View style={styles.tile}>
              <Ionicons name="podium" size={13} color="#1A1A1A" />
            </View>
            <Text style={styles.boardTitle} numberOfLines={1}>
              {selected.title || copy.untitled}
            </Text>
            <GlassTouchable
              onPress={onChoose}
              accessibilityRole="button"
              accessibilityLabel={copy.postChange}
              style={styles.changeBtn}
              testID="composer-tier-change"
            >
              <Ionicons name="swap-horizontal" size={14} color="#FFFFFF" />
              <Text style={styles.changeText}>{copy.postChange}</Text>
            </GlassTouchable>
          </View>
          <TierMiniPreview tiers={selected.tiers} posterUriOf={posterUriOf} maxRows={10} tone="onColor" moreLabel={copy.moreTiers} />
        </View>
      ) : (
        <View style={styles.pickWrap}>
          {lists.length > 0 ? (
            <Text style={[styles.pickTitle, { color: theme.text.secondary }]}>{copy.postPickTitle}</Text>
          ) : (
            <Text style={[styles.empty, { color: theme.text.muted }]}>{copy.postEmpty}</Text>
          )}
          {lists.map((list) => {
            const { ranked } = tierListCounts(list);
            const active = list.id === selectedId;
            return (
              <GlassTouchable
                key={list.id}
                glass={false}
                activeOpacity={0.8}
                disabled={!ranked}
                onPress={() => onPick(list)}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: !ranked }}
                accessibilityLabel={list.title || copy.untitled}
                testID={`composer-tier-${list.id}`}
                style={[
                  styles.row,
                  {
                    backgroundColor: active ? alpha(accent, 0.1) : theme.secondary,
                    borderColor: active ? alpha(accent, 0.6) : theme.border,
                  },
                  !ranked && styles.rowDisabled,
                ]}
              >
                <View style={styles.rowHead}>
                  <Text style={[styles.rowTitle, { color: theme.text.primary }]} numberOfLines={1}>
                    {list.title || copy.untitled}
                  </Text>
                  <Text style={[styles.rowMeta, { color: ranked ? theme.text.muted : accent }]} numberOfLines={1}>
                    {ranked ? copy.cardCount(ranked) : copy.postNotRanked}
                  </Text>
                  <Ionicons
                    name={active ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={active ? accent : theme.text.muted}
                  />
                </View>
                {ranked ? (
                  <TierMiniPreview
                    tiers={tierListShareView(list).tiers}
                    posterUriOf={posterUriOf}
                    maxRows={3}
                    maxPosters={10}
                    moreLabel={copy.moreTiers}
                  />
                ) : null}
              </GlassTouchable>
            );
          })}
          <GlassTouchable
            style={[styles.createBtn, { borderColor: alpha(accent, 0.45), backgroundColor: alpha(accent, 0.06) }]}
            onPress={onCreate}
            activeOpacity={0.85}
            accessibilityRole="button"
            testID="composer-tier-create"
          >
            <Ionicons name="add" size={18} color={accent} />
            <Text style={[styles.createText, { color: accent }]}>{copy.postCreate}</Text>
          </GlassTouchable>
        </View>
      )}
    </View>
  );
}

export default memo(TierListPicker);

const styles = StyleSheet.create({
  board: {
    borderRadius: 18,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: BOARD_BG,
    marginBottom: 6,
  },
  boardHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  tile: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#FFBF7F" },
  boardTitle: { flex: 1, color: "#FFFFFF", fontSize: 14.5, fontWeight: "900" },
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  changeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  pickWrap: { gap: 10, marginBottom: 6 },
  pickTitle: { fontSize: 12.5, fontWeight: "700" },
  empty: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  row: { borderRadius: 16, borderWidth: 1, padding: 10, gap: 8 },
  rowDisabled: { opacity: 0.55 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: "800" },
  rowMeta: { fontSize: 11.5, fontWeight: "700" },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  createText: { fontSize: 13, fontWeight: "800" },
});
