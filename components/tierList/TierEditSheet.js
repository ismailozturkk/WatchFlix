// components/tierList/TierEditSheet.js
//
// Kademe sayfası (düzenleyicide etiket hücresine dokununca): ad, renk, yukarı / aşağı, altına kademe ekle, sil.
// Renk ve taşıma anında uygulanır; ad "Tamam"da ya da sayfa kapanırken (boş ad kabul edilmez, eskisi kalır).
// Silme ONAYI sayfanın içinde (iki adımlı düğme): iOS'ta açık Modal'ın üstüne uyarı penceresi sunulamaz.

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassTextInput from "@components/common/GlassTextInput";
import GlassTouchable from "@components/common/GlassTouchable";
import { TIER_COLORS, TIER_LIMITS, tierInkOf } from "@utils/tierList";
import { SheetButton, SheetLabel, TierSheet } from "./tierSheetKit";

export default function TierEditSheet({ visible, tier, index, count, copy, theme, onClose, onDismissed, onChange, onMove, onAddBelow, onDelete }) {
  const [label, setLabel] = useState(tier?.label || "");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (visible && tier) {
      setLabel(tier.label);
      setConfirming(false);
    }
    // Yalnız açılışta / başka kademeye geçince: yazarken dışarıdan gelen aynı ad yazılanı ezmesin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tier?.id]);

  if (!tier) return null;
  const commitLabel = () => {
    if (label.trim() && label.trim() !== tier.label) onChange({ label });
  };
  const close = () => {
    commitLabel();
    onClose();
  };
  const canDelete = count > TIER_LIMITS.minTiers;
  const canAdd = count < TIER_LIMITS.tiers;

  return (
    <TierSheet
      visible={visible}
      onClose={close}
      onDismissed={onDismissed}
      theme={theme}
      title={copy.tierEditTitle}
      footer={<SheetButton theme={theme} label={copy.done} icon="checkmark" onPress={close} />}
    >
      <View style={[styles.preview, { backgroundColor: tier.color }]}>
        <Text style={[styles.previewText, { color: tierInkOf(tier.color) }]} numberOfLines={1}>
          {label.trim() || tier.label}
        </Text>
      </View>

      <SheetLabel theme={theme} text={copy.tierLabel} />
      <GlassTextInput
        value={label}
        onChangeText={setLabel}
        onSubmitEditing={commitLabel}
        onBlur={commitLabel}
        maxLength={TIER_LIMITS.label}
        returnKeyType="done"
        placeholder={tier.label}
        placeholderTextColor={theme.text.muted}
        style={[styles.input, { backgroundColor: theme.between, borderColor: theme.border, color: theme.text.primary }]}
        accessibilityLabel={copy.tierLabel}
        testID="tier-label-input"
      />

      <SheetLabel theme={theme} text={copy.tierColor} />
      <View style={styles.swatches}>
        {TIER_COLORS.map((color) => {
          const active = color === tier.color;
          return (
            <GlassTouchable
              key={color}
              glass={false}
              activeOpacity={0.8}
              onPress={() => onChange({ color })}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={color}
              style={[styles.swatch, { backgroundColor: color, borderColor: active ? theme.text.primary : "transparent" }]}
            >
              {active ? <AppIcon family="Ionicons" name="checkmark" size={18} color={tierInkOf(color)} /> : null}
            </GlassTouchable>
          );
        })}
      </View>

      <View style={styles.moveRow}>
        <SheetButton
          theme={theme}
          tone="secondary"
          label={copy.tierUp}
          icon="arrow-up"
          disabled={index <= 0}
          onPress={() => onMove(-1)}
          style={styles.flex}
        />
        <SheetButton
          theme={theme}
          tone="secondary"
          label={copy.tierDown}
          icon="arrow-down"
          disabled={index >= count - 1}
          onPress={() => onMove(1)}
          style={styles.flex}
        />
      </View>
      <SheetButton
        theme={theme}
        tone="secondary"
        label={copy.tierAddBelow}
        icon="add"
        disabled={!canAdd}
        onPress={onAddBelow}
        style={styles.gapTop}
      />
      {!canAdd ? <Text style={[styles.note, { color: theme.text.muted }]}>{copy.tierMax(TIER_LIMITS.tiers)}</Text> : null}

      <SheetButton
        theme={theme}
        tone={confirming ? "danger" : "secondary"}
        label={copy.tierDelete}
        icon="trash-outline"
        disabled={!canDelete}
        onPress={() => (confirming ? onDelete() : setConfirming(true))}
        style={styles.gapTop}
      />
      <Text style={[styles.note, { color: theme.text.muted }]}>
        {canDelete ? copy.tierDeleteNote(tier.items.length) : copy.tierMin(TIER_LIMITS.minTiers)}
      </Text>
    </TierSheet>
  );
}

const styles = StyleSheet.create({
  preview: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  previewText: { fontSize: 20, fontWeight: "900" },
  input: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 16, fontWeight: "700" },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: { width: 40, height: 40, borderRadius: 12, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  moveRow: { flexDirection: "row", gap: 8, marginTop: 18 },
  flex: { flex: 1 },
  gapTop: { marginTop: 8 },
  note: { fontSize: 12, fontWeight: "600", marginTop: 6, marginLeft: 4 },
});
