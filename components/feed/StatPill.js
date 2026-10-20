// components/feed/StatPill.js
//
// Beğeni / yorum sayacı hapı. Sayı varsa dolu ikon + vurgu rengi, yoksa soluk
// ve çizgili ikon. Postlarım ve Etkinliklerim kartları aynı hapı kullanır.

import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import AppIcon from "../AppIcon";
import { alpha } from "../../theme/colors";

/**
 * @param {string}  icon        Ionicons adı (dolu hali; çizgili hali `${icon}-outline`)
 * @param {boolean} active      sayı > 0 mu
 * @param {string}  activeColor aktifken vurgu rengi
 */
const StatPill = memo(function StatPill({ icon, active, activeColor, count, theme }) {
  return (
    <View
      style={[
        st.pill,
        {
          backgroundColor: active ? alpha(activeColor, 0.12) : theme.primary,
          borderColor: active ? alpha(activeColor, 0.35) : theme.border,
        },
      ]}
    >
      <AppIcon
        family="Ionicons"
        name={active ? icon : `${icon}-outline`}
        size={15}
        color={active ? activeColor : theme.text.muted}
      />
      <Text style={[st.text, { color: active ? activeColor : theme.text.secondary }]}>
        {count}
      </Text>
    </View>
  );
});

export default StatPill;

const st = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 12.5, fontWeight: "800" },
});
