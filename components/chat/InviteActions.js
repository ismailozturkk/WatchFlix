// components/chat/InviteActions.js
//
// Sohbetteki davet kartlarının (günlük düello, CineSwipe odası) alt eylem satırı. Yanıtlanmamış davette
// [Reddet] [Kabul] yan yana — Profil'deki önemli davetler çubuğuyla aynı sıra; kabul edilmiş davette yalnız
// birincil düğme (Oyuna başla / Odaya dön). Yan yana düğmelere kısa etiket verilir, ekran okuyucu tam
// metni okur (`a11y`). Renkler balon paletinden (shareKit.sharePalette): birincil dolgulu, ret çerçeveli.

import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassPressable from "../common/GlassPressable";

const HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };

/**
 * @param {object} p
 * @param {{ label: string, a11y?: string, icon: string, onPress: Function }} p.accept
 * @param {{ label: string, a11y?: string, onPress: Function }|null} [p.decline]  yoksa yalnız birincil düğme
 * @param {object} p.palette  shareKit.sharePalette
 */
function InviteActions({ accept, decline = null, palette }) {
  return (
    <View style={styles.row}>
      {decline ? (
        <GlassPressable
          onPress={decline.onPress}
          accessibilityRole="button"
          accessibilityLabel={decline.a11y || decline.label}
          hitSlop={HIT_SLOP}
          style={[styles.button, styles.decline, { backgroundColor: palette.ghostBg, borderColor: palette.ghostBorder }]}
        >
          <Ionicons name="close" size={15} color={palette.ghostInk} />
          <Text allowFontScaling={false} style={[styles.label, { color: palette.ghostInk }]} numberOfLines={1}>
            {decline.label}
          </Text>
        </GlassPressable>
      ) : null}
      <GlassPressable
        onPress={accept.onPress}
        accessibilityRole="button"
        accessibilityLabel={accept.a11y || accept.label}
        hitSlop={HIT_SLOP}
        style={[styles.button, styles.accept, { backgroundColor: palette.buttonBg }]}
      >
        <Ionicons name={accept.icon} size={15} color={palette.buttonInk} />
        <Text allowFontScaling={false} style={[styles.label, { color: palette.buttonInk }]} numberOfLines={1}>
          {accept.label}
        </Text>
      </GlassPressable>
    </View>
  );
}

export default memo(InviteActions);

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  button: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 19,
  },
  decline: { borderWidth: 1 },
  accept: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: "800", flexShrink: 1 },
});
