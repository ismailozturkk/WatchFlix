// components/theme/ColorPickerSheet.js
//
// Özel tema renk seçici (bottom sheet). İki mod:
//  • "Renk": ek bağımlılık olmadan PanResponder ile HSL slider'lar + hex girişi
//    + hazır palet → mutlak hex döner.
//  • "Bağlı": rengi başka bir token'a bağlar ve açıklık/doygunluk ofseti uygular
//    (ör. "Vurgu renginin %15 açığı") → { from, l, s } döner.
// Kendi UI'si aktif uygulama temasını kullanır; düzenlenen renk bundan bağımsızdır.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { useTheme } from "@context/ThemeContext";
import { clamp, hexToHsl, hslToHex, normalizeHex, readableTextOn } from "@utils/colorUtils";

const HUE_GRADIENT = ["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF", "#FF0000"];
const OFFSET_GRADIENT = ["#000000", "#808080", "#FFFFFF"];

const PRESETS = [
  "#FFFFFF", "#000000", "#141414", "#1E1E1E", "#2C2C2C", "#666666",
  "#F8F8F8", "#E8E8E8", "#138DF0", "#2196F3", "#0551A3", "#23324B",
  "#62BEB4", "#2A7473", "#2ECC71", "#64FF64", "#FF3232", "#FF6B6B",
  "#FF7C25", "#E8B931", "#FFEB3B", "#A100A1", "#C084FC", "#FFC0CB",
];

const applyRel = (baseHex, l, s) => {
  const hsl = hexToHsl(baseHex || "#808080");
  return hslToHex(hsl.h, clamp(hsl.s + s, 0, 100), clamp(hsl.l + l, 0, 100));
};

function ColorSlider({ value, max, onChange, gradient, thumbColor, theme }) {
  const [trackW, setTrackW] = useState(0);
  const widthRef = useRef(0);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => emit(e.nativeEvent.locationX),
      onPanResponderMove: (e) => emit(e.nativeEvent.locationX),
    }),
  ).current;

  function emit(x) {
    const w = widthRef.current;
    if (!w) return;
    changeRef.current(clamp(x / w, 0, 1) * max);
  }

  const ratio = max ? clamp(value / max, 0, 1) : 0;
  const thumbLeft = clamp(ratio * trackW - 12, 0, Math.max(0, trackW - 24));

  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => { const w = e.nativeEvent.layout.width; widthRef.current = w; setTrackW(w); }}
      style={styles.sliderTrack}
      hitSlop={{ top: 10, bottom: 10 }}
    >
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.sliderThumb, { left: thumbLeft, backgroundColor: thumbColor, borderColor: theme.text.primary }]} />
    </View>
  );
}

export default function ColorPickerSheet({ visible, initialValue, title, isEn = false, sources = [], onClose, onConfirm }) {
  const { theme } = useTheme();
  const t = (trText, enText) => (isEn ? enText : trText);

  const [mode, setMode] = useState("absolute");
  const [hsl, setHsl] = useState({ h: 0, s: 0, l: 0 });
  const [hexInput, setHexInput] = useState("#000000");
  const [rel, setRel] = useState({ from: "", l: 0, s: 0 });

  // Sheet açıldığında başlangıç değerinden modu ve durumu kur.
  useEffect(() => {
    if (!visible) return;
    if (initialValue && typeof initialValue === "object" && initialValue.from) {
      const from = sources.some((s) => s.key === initialValue.from) ? initialValue.from : (sources[0]?.key || "");
      setRel({ from, l: Number(initialValue.l) || 0, s: Number(initialValue.s) || 0 });
      setMode("relative");
      const base = sources.find((s) => s.key === from)?.color || "#808080";
      setHsl(hexToHsl(base));
    } else {
      const base = normalizeHex(initialValue) || "#000000";
      setHsl(hexToHsl(base));
      setHexInput(base);
      setRel({ from: sources[0]?.key || "", l: 0, s: 0 });
      setMode("absolute");
    }
  }, [visible, initialValue, sources]);

  const absHex = useMemo(() => hslToHex(hsl.h, hsl.s, hsl.l), [hsl]);
  useEffect(() => { if (mode === "absolute") setHexInput(absHex); }, [absHex, mode]);

  const sourceColor = sources.find((s) => s.key === rel.from)?.color || "#808080";
  const sourceLabel = sources.find((s) => s.key === rel.from)?.label || "";
  const relHex = applyRel(sourceColor, rel.l, rel.s);
  const displayHex = mode === "relative" ? relHex : absHex;
  const previewText = readableTextOn(displayHex);

  const setChannel = useCallback((key, raw) => setHsl((p) => ({ ...p, [key]: Math.round(raw) })), []);
  const applyHexInput = useCallback((text) => { const n = normalizeHex(text); if (n) setHsl(hexToHsl(n)); }, []);

  const confirm = () => {
    if (mode === "relative" && rel.from) onConfirm({ from: rel.from, l: Math.round(rel.l), s: Math.round(rel.s) });
    else onConfirm(absHex);
  };

  const satGradient = [hslToHex(hsl.h, 0, hsl.l), hslToHex(hsl.h, 100, hsl.l)];
  const lightGradient = ["#000000", hslToHex(hsl.h, hsl.s, 50), "#FFFFFF"];
  const offsetLabel = (v) => `${v > 0 ? "+" : ""}${Math.round(v)}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Kapat", "Close")} onPress={onClose} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={["bottom"]} style={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {/* Büyük önizleme */}
          <View style={[styles.preview, { backgroundColor: displayHex, borderColor: theme.border }]}>
            <Text style={[styles.previewTitle, { color: previewText }]} numberOfLines={1}>{title}</Text>
            <Text style={[styles.previewHex, { color: previewText }]}>{displayHex}</Text>
          </View>

          {/* Mod seçimi */}
          {sources.length > 0 ? (
            <View style={[styles.segment, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <SegBtn active={mode === "absolute"} icon="color-palette-outline" label={t("Renk", "Color")} onPress={() => setMode("absolute")} theme={theme} />
              <SegBtn active={mode === "relative"} icon="git-network-outline" label={t("Bağlı", "Linked")} onPress={() => setMode("relative")} theme={theme} />
            </View>
          ) : null}

          {mode === "absolute" ? (
            <>
              <View style={[styles.hexRow, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                <AppIcon family="Ionicons" name="color-fill-outline" size={17} color={theme.text.muted} />
                <TextInput
                  value={hexInput}
                  onChangeText={setHexInput}
                  onEndEditing={(e) => applyHexInput(e.nativeEvent.text)}
                  onSubmitEditing={(e) => applyHexInput(e.nativeEvent.text)}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={7}
                  placeholder="#RRGGBB"
                  placeholderTextColor={theme.text.muted}
                  style={[styles.hexInput, { color: theme.text.primary }]}
                />
              </View>

              <Channel label={t("Ton", "Hue")} theme={theme}>
                <ColorSlider value={hsl.h} max={360} onChange={(v) => setChannel("h", v)} gradient={HUE_GRADIENT} thumbColor={hslToHex(hsl.h, 100, 50)} theme={theme} />
              </Channel>
              <Channel label={t("Doygunluk", "Saturation")} theme={theme}>
                <ColorSlider value={hsl.s} max={100} onChange={(v) => setChannel("s", v)} gradient={satGradient} thumbColor={absHex} theme={theme} />
              </Channel>
              <Channel label={t("Parlaklık", "Lightness")} theme={theme}>
                <ColorSlider value={hsl.l} max={100} onChange={(v) => setChannel("l", v)} gradient={lightGradient} thumbColor={absHex} theme={theme} />
              </Channel>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets} style={styles.presetsWrap}>
                {PRESETS.map((preset) => (
                  <Pressable
                    key={preset}
                    accessibilityRole="button"
                    accessibilityLabel={preset}
                    onPress={() => setHsl(hexToHsl(preset))}
                    style={[styles.presetSwatch, { backgroundColor: preset, borderColor: normalizeHex(absHex) === preset ? theme.accent : theme.border, borderWidth: normalizeHex(absHex) === preset ? 2.5 : 1 }]}
                  />
                ))}
              </ScrollView>
            </>
          ) : (
            <>
              {/* Kaynak token seçimi */}
              <Text style={[styles.channelLabel, { color: theme.text.muted, marginTop: 13 }]}>{t("Kaynak renk", "Source color")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sourceRow} style={styles.sourceWrap}>
                {sources.map((src) => {
                  const active = rel.from === src.key;
                  return (
                    <Pressable
                      key={src.key}
                      accessibilityRole="button"
                      accessibilityLabel={src.label}
                      onPress={() => setRel((p) => ({ ...p, from: src.key }))}
                      style={[styles.sourceChip, { backgroundColor: theme.primary, borderColor: active ? theme.accent : theme.border, borderWidth: active ? 2 : 1 }]}
                    >
                      <View style={[styles.sourceSwatch, { backgroundColor: src.color, borderColor: theme.border }]} />
                      <Text style={[styles.sourceLabel, { color: active ? theme.accent : theme.text.secondary }]} numberOfLines={1}>{src.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Channel label={`${t("Açıklık", "Lightness")}  ${offsetLabel(rel.l)}`} theme={theme}>
                <ColorSlider value={rel.l + 100} max={200} onChange={(v) => setRel((p) => ({ ...p, l: Math.round(v) - 100 }))} gradient={OFFSET_GRADIENT} thumbColor={relHex} theme={theme} />
              </Channel>
              <Channel label={`${t("Doygunluk", "Saturation")}  ${offsetLabel(rel.s)}`} theme={theme}>
                <ColorSlider value={rel.s + 100} max={200} onChange={(v) => setRel((p) => ({ ...p, s: Math.round(v) - 100 }))} gradient={["#808080", sourceColor]} thumbColor={relHex} theme={theme} />
              </Channel>

              <View style={[styles.relHint, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                <AppIcon family="Ionicons" name="link-outline" size={14} color={theme.accent} />
                <Text style={[styles.relHintText, { color: theme.text.secondary }]} numberOfLines={2}>
                  {sourceLabel}{" · "}{rel.l === 0 && rel.s === 0
                    ? t("aynı renk", "same color")
                    : `${rel.l !== 0 ? `${t("açıklık", "lightness")} ${offsetLabel(rel.l)}` : ""}${rel.l !== 0 && rel.s !== 0 ? " · " : ""}${rel.s !== 0 ? `${t("doygunluk", "saturation")} ${offsetLabel(rel.s)}` : ""}`}
                </Text>
              </View>
            </>
          )}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.cancelBtn, { borderColor: theme.border }]}>
              <Text style={[styles.cancelText, { color: theme.text.secondary }]}>{t("Vazgeç", "Cancel")}</Text>
            </Pressable>
            <Pressable onPress={confirm} style={[styles.confirmBtn, { backgroundColor: theme.accent }]}>
              <AppIcon family="Ionicons" name="checkmark" size={19} color="#fff" />
              <Text style={styles.confirmText}>{t("Seç", "Apply")}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function SegBtn({ active, icon, label, onPress, theme }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.segBtn, active && { backgroundColor: theme.accent }]}>
      <AppIcon family="Ionicons" name={icon} size={15} color={active ? "#fff" : theme.text.secondary} />
      <Text style={[styles.segText, { color: active ? "#fff" : theme.text.secondary }]}>{label}</Text>
    </Pressable>
  );
}

function Channel({ label, theme, children }) {
  return (
    <View style={styles.channel}>
      <Text style={[styles.channelLabel, { color: theme.text.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 14 },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  preview: { height: 72, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  previewTitle: { fontSize: 14, fontWeight: "850" },
  previewHex: { fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  segment: { flexDirection: "row", marginTop: 12, padding: 4, borderRadius: 14, borderWidth: 1, gap: 4 },
  segBtn: { flex: 1, minHeight: 38, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  segText: { fontSize: 12, fontWeight: "800" },
  hexRow: { marginTop: 12, minHeight: 46, borderRadius: 13, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13 },
  hexInput: { flex: 1, fontSize: 15, fontWeight: "800", letterSpacing: 1, paddingVertical: 10 },
  channel: { marginTop: 13 },
  channelLabel: { fontSize: 11, fontWeight: "800", marginBottom: 7 },
  sliderTrack: { height: 26, borderRadius: 13, overflow: "hidden", justifyContent: "center" },
  sliderThumb: { position: "absolute", width: 24, height: 24, borderRadius: 12, borderWidth: 3, top: 1 },
  presetsWrap: { marginTop: 16, marginHorizontal: -18, flexGrow: 0 },
  presets: { flexDirection: "row", gap: 9, paddingHorizontal: 18 },
  presetSwatch: { width: 34, height: 34, borderRadius: 10 },
  sourceWrap: { marginHorizontal: -18, flexGrow: 0 },
  sourceRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18 },
  sourceChip: { minHeight: 38, borderRadius: 11, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 7 },
  sourceSwatch: { width: 18, height: 18, borderRadius: 6, borderWidth: 1 },
  sourceLabel: { fontSize: 12, fontWeight: "800", maxWidth: 110 },
  relHint: { marginTop: 14, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  relHintText: { flex: 1, fontSize: 11, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 11, marginTop: 18 },
  cancelBtn: { flex: 1, minHeight: 50, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 15, fontWeight: "800" },
  confirmBtn: { flex: 2, minHeight: 50, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  confirmText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
