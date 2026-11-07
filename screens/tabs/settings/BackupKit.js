// screens/tabs/settings/BackupKit.js
//
// Yedekleme ve kütüphane dışa aktarma ekranlarının ortak parçaları:
//   SectionHead   bölüm başlığı + ünlem düğmesi; bilgi metni düğmeye basınca açılır
//   StatGrid      sayı kutuları (özet istatistik)
//   PickListHead  "n/m seçili" + tümünü seç/temizle
//   PickRow       seçilebilir içerik satırı: onay kutusu + doluluk çubuğu
//
// Çubuklar tek renklidir (vurgu): büyüklük anlatır, kimlik değil. Sayı ve etiketler
// metin rengindedir, seçili olmayan satırın çubuğu sönükleşir.

import React, { useState } from "react";
import { LayoutAnimation, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassIconButton from "@components/common/GlassIconButton";
import { alpha } from "../../../theme/colors";

const animateNext = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

/** Ünlem düğmesi + açılır bilgi metni. `info` yoksa yalnız başlık çizilir. */
export function SectionHead({ colors: C, label, info, infoLabel }) {
  const [open, setOpen] = useState(false);
  const paragraphs = [].concat(info || []).filter(Boolean);
  const toggle = () => {
    animateNext();
    setOpen((value) => !value);
  };
  return (
    <>
      <View style={s.head}>
        <Text allowFontScaling={false} style={[s.headLabel, { color: C.muted }]}>
          {label}
        </Text>
        {paragraphs.length ? (
          <GlassIconButton
            size={24}
            fallbackRadius={12}
            fallbackStyle={{ backgroundColor: open ? C.accentDim : C.closeBg }}
            accessibilityLabel={infoLabel}
            accessibilityState={{ expanded: open }}
            hitSlop={10}
            onPress={toggle}
          >
            <AppIcon
              family="Ionicons"
              name={open ? "close" : "alert"}
              size={14}
              color={open ? C.accentStrong : C.muted}
            />
          </GlassIconButton>
        ) : null}
      </View>
      {open ? (
        <View style={[s.infoPanel, { backgroundColor: C.accentDim, borderColor: alpha(C.accent, 0.3) }]}>
          {paragraphs.map((text) => (
            <Text key={text} allowFontScaling={false} style={[s.infoText, { color: C.text }]}>
              {text}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  );
}

/** items: [{ id, value, label }] — iki sütunlu sayı kutuları. */
export function StatGrid({ colors: C, items, tileColor }) {
  return (
    <View style={s.grid}>
      {items.map((item) => (
        <View
          key={item.id}
          style={[s.tile, { backgroundColor: tileColor || C.card, borderColor: C.border }]}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[s.tileValue, { color: C.text }]}
          >
            {item.value}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={[s.tileLabel, { color: C.muted }]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function PickListHead({ colors: C, summary, allSelected, selectAllLabel, selectNoneLabel, onToggleAll }) {
  return (
    <View style={[s.listHead, { borderBottomColor: C.borderMuted }]}>
      <Text allowFontScaling={false} style={[s.listSummary, { color: C.text }]}>
        {summary}
      </Text>
      <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} hitSlop={8} onPress={onToggleAll}>
        <Text allowFontScaling={false} style={[s.listAction, { color: C.accentStrong }]}>
          {allSelected ? selectNoneLabel : selectAllLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/** ratio: 0..1 doluluk; `note` çubuğun altındaki ek satır (ör. özel tema sayısı). */
export function PickRow({ colors: C, icon, iconBg, iconColor, title, sub, stat, ratio = 0, note, selected, onToggle, last }) {
  const percent = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      accessibilityLabel={`${title}, ${stat}`}
      activeOpacity={0.7}
      onPress={onToggle}
      style={[s.row, { borderBottomColor: C.borderMuted }, last && { borderBottomWidth: 0 }]}
    >
      <View style={[s.rowIcon, { backgroundColor: iconBg, opacity: selected ? 1 : 0.5 }]}>
        <AppIcon family="Ionicons" name={icon} size={16} color={iconColor} />
      </View>
      <View style={s.rowBody}>
        <View style={s.rowTop}>
          <Text allowFontScaling={false} numberOfLines={1} style={[s.rowTitle, { color: selected ? C.text : C.muted }]}>
            {title}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={[s.rowStat, { color: C.muted }]}>
            {stat}
          </Text>
        </View>
        {sub ? (
          <Text allowFontScaling={false} numberOfLines={1} style={[s.rowSub, { color: C.muted }]}>
            {sub}
          </Text>
        ) : null}
        <View style={[s.track, { backgroundColor: C.closeBg }]}>
          <View
            style={[
              s.fill,
              { width: percent, backgroundColor: selected ? C.accent : alpha(C.muted, 0.5) },
            ]}
          />
        </View>
        {note ? (
          <Text allowFontScaling={false} numberOfLines={1} style={[s.rowNote, { color: C.accentStrong }]}>
            {note}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          s.check,
          selected
            ? { backgroundColor: C.accent, borderColor: C.accent }
            : { backgroundColor: "transparent", borderColor: C.border },
        ]}
      >
        {selected ? <AppIcon family="Ionicons" name="checkmark" size={14} color={C.white} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 8, marginHorizontal: 4 },
  headLabel: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.8, flexShrink: 1 },
  infoPanel: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 7, marginBottom: 10 },
  infoText: { fontSize: 12.5, fontWeight: "500", lineHeight: 18 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { flexGrow: 1, width: "47%", borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  tileValue: { fontSize: 22, lineHeight: 27, fontWeight: "800", letterSpacing: -0.4 },
  tileLabel: { fontSize: 11.5, fontWeight: "600", marginTop: 1 },

  listHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  listSummary: { flexShrink: 1, fontSize: 12.5, fontWeight: "700" },
  listAction: { fontSize: 12.5, fontWeight: "800" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  rowIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  rowTitle: { flexShrink: 1, fontSize: 13.5, fontWeight: "700" },
  rowStat: { flexShrink: 0, fontSize: 11, fontWeight: "700" },
  rowSub: { fontSize: 11, fontWeight: "500", marginTop: 1 },
  track: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 7 },
  fill: { height: "100%", borderRadius: 2 },
  rowNote: { fontSize: 11, fontWeight: "700", marginTop: 5 },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
