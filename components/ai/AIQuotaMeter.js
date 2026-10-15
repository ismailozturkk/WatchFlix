// components/ai/AIQuotaMeter.js
//
// Üst çubuktaki kota göstergesi: bugünkü hakkın ne kadarının kaldığını ince bir
// çubuk + kısa metin olarak gösterir ("Free · 2 hakkın kaldı"). Her AI mesajı
// kullanıcının hakkından düştüğü için, mesaj göndermeden ÖNCE kalan hakkı görmek
// devam çiplerinin ve "yeniden öner"in maliyetini görünür kılar. Dokunulabilir:
// kullanım ekranına gider.

import React, { memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

import { alpha } from "../../theme/colors";
import { fillCopy } from "../../utils/aiCopy";

function AIQuotaMeter({ meter, known = true, planLabel, theme, copy, onPress }) {
  const level = meter.level;
  const tint = !known ? theme.accent : level === "empty" ? theme.colors.red : level === "low" ? theme.colors.orange : theme.accent;
  const remaining = known ? 1 - meter.ratio : 1;

  let text;
  if (!known) text = fillCopy(copy.quota.perDay, { n: meter.dailyLimit });
  else if (level === "empty") text = copy.quota.empty;
  else if (meter.left === 1) text = copy.quota.leftOne;
  else text = fillCopy(copy.quota.left, { n: meter.left });

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={`${planLabel} · ${text}`}
      style={s.row}
    >
      <View style={[s.track, { backgroundColor: alpha(theme.text.muted, 0.28) }]}>
        <View style={{ width: `${Math.max(4, Math.round(remaining * 100))}%`, height: "100%", backgroundColor: tint }} />
      </View>
      <Text numberOfLines={1} style={[s.text, { color: !known || level === "ok" ? theme.text.muted : tint }]}>
        {planLabel} · {text}
      </Text>
    </TouchableOpacity>
  );
}

export default memo(AIQuotaMeter);

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 1 },
  track: { width: 44, height: 4, borderRadius: 2, overflow: "hidden" },
  text: { flexShrink: 1, fontSize: 11, fontWeight: "600" },
});
