// components/theme/ColorPickerSheet.js
//
// Özel tema renk seçici (bottom sheet). İki mod:
//  • "Renk": ek bağımlılık olmadan PanResponder ile HSL slider'lar + hex girişi
//    + hazır palet → mutlak hex döner.
//  • "Bağlı": rengi başka bir token'a bağlar ve açıklık/doygunluk ofseti uygular
//    (ör. "Vurgu renginin %15 açığı") → { from, l, s } döner.
// Kendi UI'si aktif uygulama temasını kullanır; düzenlenen renk bundan bağımsızdır.

import { pickByLanguage } from "../../utils/appLanguages";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import SheetScroll from "@components/common/SheetScroll";
import { useTheme } from "@context/ThemeContext";
import * as Haptics from "@services/hapticsService";
import { clamp, contrastRatio, hexToHsl, hslToHex, normalizeHex, readableTextOn } from "@utils/colorUtils";

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
  const dragStartXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const latestValRef = useRef(value);
  latestValRef.current = value;
  const rafIdRef = useRef(null);

  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const maxRef = useRef(max);
  maxRef.current = max;

  const thumbAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const lastBoundaryHitRef = useRef(null);

  // Prop veya önayarlı renk değiştiğinde (sürükleme yapılmıyorsa) animasyonlu pozisyonu güncelle
  useEffect(() => {
    if (!isDraggingRef.current && trackW > 0) {
      const m = max || 1;
      const r = clamp(value / m, 0, 1);
      const maxTravel = Math.max(0, trackW - 24);
      thumbAnim.setValue(r * maxTravel);
    }
  }, [value, max, trackW, thumbAnim]);

  const updatePosition = useCallback(
    (x, isImmediateCommit = false) => {
      const w = widthRef.current;
      if (!w) return;
      const maxTravel = Math.max(0, w - 24);
      const clampedRatio = clamp((x - 12) / Math.max(1, maxTravel), 0, 1);
      const targetX = clampedRatio * maxTravel;

      // 1) Anlık 120 FPS native görsel güncelleme (0ms gecikme)
      thumbAnim.setValue(targetX);

      // 2) Sınır haptikleri
      if (clampedRatio === 0 && lastBoundaryHitRef.current !== "min") {
        lastBoundaryHitRef.current = "min";
        Haptics.selectionAsync();
      } else if (clampedRatio === 1 && lastBoundaryHitRef.current !== "max") {
        lastBoundaryHitRef.current = "max";
        Haptics.selectionAsync();
      } else if (clampedRatio > 0.02 && clampedRatio < 0.98) {
        lastBoundaryHitRef.current = null;
      }

      const m = maxRef.current || 1;
      const val = clampedRatio * m;
      latestValRef.current = val;

      if (isImmediateCommit) {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        changeRef.current?.(val);
      } else if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          changeRef.current?.(latestValRef.current);
        });
      }
    },
    [thumbAnim],
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        isDraggingRef.current = true;
        dragStartXRef.current = e.nativeEvent.locationX;
        updatePosition(e.nativeEvent.locationX, true);
        Animated.spring(scaleAnim, {
          toValue: 1.25,
          useNativeDriver: true,
          friction: 7,
          tension: 250,
        }).start();
      },
      onPanResponderMove: (_, g) => {
        updatePosition(dragStartXRef.current + g.dx, false);
      },
      onPanResponderRelease: (_, g) => {
        isDraggingRef.current = false;
        updatePosition(dragStartXRef.current + g.dx, true);
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
          tension: 250,
        }).start();
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
          tension: 250,
        }).start();
      },
    }),
  ).current;

  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        widthRef.current = w;
        setTrackW(w);
      }}
      style={styles.sliderContainer}
      hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
    >
      <View style={styles.sliderTrackBg} pointerEvents="none">
        <LinearGradient
          pointerEvents="none"
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sliderThumb,
          {
            backgroundColor: thumbColor,
            borderColor: theme.text.primary,
            transform: [
              { translateX: thumbAnim },
              { scale: scaleAnim },
            ],
          },
        ]}
      />
    </View>
  );
}

/**
 * @param {string} [originalHex]   düzenlenen rengin ÇÖZÜLMÜŞ hex'i; verilirse yanında
 *                                 "önceki" kutusu çıkar, dokununca renge geri döner
 * @param {{color: string, label: string}} [contrastAgainst] verilirse seçilen rengin
 *                                 bu renge karşı kontrastı canlı gösterilir
 */
export default function ColorPickerSheet({ visible, initialValue, title, language = "tr", sources = [], originalHex, contrastAgainst, onClose, onConfirm }) {
  const { theme } = useTheme();
  // Üç dilli seçici: es verilmezse İngilizce (utils/appLanguages kuralı).
  const t = (trText, enText, esText) => pickByLanguage(language, { tr: trText, en: enText, es: esText ?? enText });

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

  const restoreOriginal = () => {
    const base = normalizeHex(originalHex);
    if (!base) return;
    Haptics.selectionAsync().catch(() => {});
    setMode("absolute");
    setHsl(hexToHsl(base));
  };

  // Canlı kontrast: seçilen renk, `contrastAgainst` üzerinde yazı gibi çizilir.
  const against = contrastAgainst ? normalizeHex(contrastAgainst.color) : null;
  const ratio = against ? contrastRatio(displayHex, against) : 0;
  const ratioTone = ratio >= 4.5 ? theme.colors.green : ratio >= 3 ? theme.colors.orange : theme.colors.red;
  const ratioIcon = ratio >= 4.5 ? "checkmark-circle" : ratio >= 3 ? "alert-circle" : "warning";

  const satGradient = [hslToHex(hsl.h, 0, hsl.l), hslToHex(hsl.h, 100, hsl.l)];
  const lightGradient = ["#000000", hslToHex(hsl.h, hsl.s, 50), "#FFFFFF"];
  const offsetLabel = (v) => `${v > 0 ? "+" : ""}${Math.round(v)}`;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.38)"
    >
      <SafeAreaView edges={["bottom"]} style={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {/* Hex kutusuna odaklanınca klavye açılır ve sayfa küçülür: önizleme +
              kanallar kayar, Vazgeç/Seç satırı klavyenin hemen üstünde sabit kalır. */}
          <SheetScroll>
          {/* Büyük önizleme */}
          <View style={styles.previewRow}>
            <View style={[styles.preview, styles.previewMain, { backgroundColor: displayHex, borderColor: theme.border }]}>
              <Text style={[styles.previewTitle, { color: previewText }]} numberOfLines={1}>{title}</Text>
              <Text style={[styles.previewHex, { color: previewText }]}>{displayHex}</Text>
            </View>
            {normalizeHex(originalHex) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("Önceki renk", "Previous color", "Color anterior")} ${normalizeHex(originalHex)}`}
                onPress={restoreOriginal}
                style={[styles.preview, styles.previewPrev, { backgroundColor: normalizeHex(originalHex), borderColor: theme.border }]}
              >
                <AppIcon family="Ionicons" name="arrow-undo" size={15} color={readableTextOn(normalizeHex(originalHex))} />
                <Text style={[styles.previewPrevText, { color: readableTextOn(normalizeHex(originalHex)) }]} numberOfLines={1}>
                  {t("Önceki", "Previous", "Anterior")}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {against ? (
            <View style={[styles.contrastRow, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <View style={[styles.contrastSample, { backgroundColor: against, borderColor: theme.border }]}>
                <Text style={[styles.contrastSampleText, { color: displayHex }]}>Aa</Text>
              </View>
              <Text style={[styles.contrastLabel, { color: theme.text.secondary }]} numberOfLines={1}>
                {contrastAgainst.label}
              </Text>
              <Text style={[styles.contrastRatio, { color: ratioTone }]}>{ratio.toFixed(1)}:1</Text>
              <AppIcon family="Ionicons" name={ratioIcon} size={17} color={ratioTone} />
            </View>
          ) : null}

          {/* Mod seçimi */}
          {sources.length > 0 ? (
            <View style={[styles.segment, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <SegBtn active={mode === "absolute"} icon="color-palette-outline" label={t("Renk", "Color", "Color")} onPress={() => setMode("absolute")} theme={theme} />
              <SegBtn active={mode === "relative"} icon="git-network-outline" label={t("Bağlı", "Linked", "Vinculado")} onPress={() => setMode("relative")} theme={theme} />
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

              <Channel label={t("Ton", "Hue", "Tono")} theme={theme}>
                <ColorSlider value={hsl.h} max={360} onChange={(v) => setChannel("h", v)} gradient={HUE_GRADIENT} thumbColor={hslToHex(hsl.h, 100, 50)} theme={theme} />
              </Channel>
              <Channel label={t("Doygunluk", "Saturation", "Saturación")} theme={theme}>
                <ColorSlider value={hsl.s} max={100} onChange={(v) => setChannel("s", v)} gradient={satGradient} thumbColor={absHex} theme={theme} />
              </Channel>
              <Channel label={t("Parlaklık", "Lightness", "Luminosidad")} theme={theme}>
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
              <Text style={[styles.channelLabel, { color: theme.text.muted, marginTop: 13 }]}>{t("Kaynak renk", "Source color", "Color de origen")}</Text>
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

              <Channel label={`${t("Açıklık", "Lightness", "Luminosidad")}  ${offsetLabel(rel.l)}`} theme={theme}>
                <ColorSlider value={rel.l + 100} max={200} onChange={(v) => setRel((p) => ({ ...p, l: Math.round(v) - 100 }))} gradient={OFFSET_GRADIENT} thumbColor={relHex} theme={theme} />
              </Channel>
              <Channel label={`${t("Doygunluk", "Saturation", "Saturación")}  ${offsetLabel(rel.s)}`} theme={theme}>
                <ColorSlider value={rel.s + 100} max={200} onChange={(v) => setRel((p) => ({ ...p, s: Math.round(v) - 100 }))} gradient={["#808080", sourceColor]} thumbColor={relHex} theme={theme} />
              </Channel>

              <View style={[styles.relHint, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                <AppIcon family="Ionicons" name="link-outline" size={14} color={theme.accent} />
                <Text style={[styles.relHintText, { color: theme.text.secondary }]} numberOfLines={2}>
                  {sourceLabel}{" · "}{rel.l === 0 && rel.s === 0
                    ? t("aynı renk", "same color", "mismo color")
                    : `${rel.l !== 0 ? `${t("açıklık", "lightness", "luminosidad")} ${offsetLabel(rel.l)}` : ""}${rel.l !== 0 && rel.s !== 0 ? " · " : ""}${rel.s !== 0 ? `${t("doygunluk", "saturation", "saturación")} ${offsetLabel(rel.s)}` : ""}`}
                </Text>
              </View>
            </>
          )}
          </SheetScroll>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.cancelBtn, { borderColor: theme.border }]}>
              <Text style={[styles.cancelText, { color: theme.text.secondary }]}>{t("Vazgeç", "Cancel", "Cancelar")}</Text>
            </Pressable>
            <Pressable onPress={confirm} style={[styles.confirmBtn, { backgroundColor: theme.accent }]}>
              <AppIcon family="Ionicons" name="checkmark" size={19} color="#fff" />
              <Text style={styles.confirmText}>{t("Seç", "Apply", "Aplicar")}</Text>
            </Pressable>
          </View>
      </SafeAreaView>
    </BottomSheetModal>
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
  sheet: { flexShrink: 1, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 14 },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  previewRow: { flexDirection: "row", gap: 10 },
  preview: { height: 72, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  previewMain: { flex: 1 },
  previewPrev: { width: 76 },
  previewPrevText: { fontSize: 11, fontWeight: "800" },
  contrastRow: { marginTop: 10, minHeight: 44, borderRadius: 13, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10 },
  contrastSample: { width: 38, height: 28, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  contrastSampleText: { fontSize: 13, fontWeight: "900" },
  contrastLabel: { flex: 1, fontSize: 12, fontWeight: "750" },
  contrastRatio: { fontSize: 12.5, fontWeight: "900", letterSpacing: 0.3 },
  previewTitle: { fontSize: 14, fontWeight: "850" },
  previewHex: { fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  segment: { flexDirection: "row", marginTop: 12, padding: 4, borderRadius: 14, borderWidth: 1, gap: 4 },
  segBtn: { flex: 1, minHeight: 38, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  segText: { fontSize: 12, fontWeight: "800" },
  hexRow: { marginTop: 12, minHeight: 46, borderRadius: 13, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13 },
  hexInput: { flex: 1, fontSize: 15, fontWeight: "800", letterSpacing: 1, paddingVertical: 10 },
  channel: { marginTop: 13 },
  channelLabel: { fontSize: 11, fontWeight: "800", marginBottom: 7 },
  sliderContainer: { height: 32, justifyContent: "center" },
  sliderTrackBg: { height: 24, borderRadius: 12, overflow: "hidden", justifyContent: "center" },
  sliderThumb: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    top: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
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
