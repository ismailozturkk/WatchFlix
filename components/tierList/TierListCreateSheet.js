// components/tierList/TierListCreateSheet.js
//
// Yeni tier list: başlık (isteğe bağlı) + şablon. Şablon kartı kademe renklerini ve o dildeki etiketleri gösterir.
// "Oluştur" → onCreate({ title, template, labels }); düzenleyiciye geçiş çağıranın işi (sayfa kapandıktan sonra).

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassTextInput from "@components/common/GlassTextInput";
import GlassTouchable from "@components/common/GlassTouchable";
import { DEFAULT_TEMPLATE, TIER_LIMITS, TIER_TEMPLATES, templateColors, tierInkOf } from "@utils/tierList";
import { templateLabelsOf } from "@utils/tierListCopy";
import { SheetButton, SheetLabel, TierSheet } from "./tierSheetKit";

export default function TierListCreateSheet({ visible, copy, theme, onClose, onDismissed, onCreate }) {
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setTemplate(DEFAULT_TEMPLATE);
    }
  }, [visible]);

  const submit = () => onCreate({ title: title.trim(), template, labels: templateLabelsOf(copy, template) });

  return (
    <TierSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      theme={theme}
      title={copy.createTitle}
      footer={<SheetButton theme={theme} label={copy.createAction} icon="add-circle" onPress={submit} />}
    >
      <SheetLabel theme={theme} text={copy.titleLabel} style={styles.firstLabel} />
      <GlassTextInput
        value={title}
        onChangeText={setTitle}
        maxLength={TIER_LIMITS.title}
        placeholder={copy.titlePlaceholder}
        placeholderTextColor={theme.text.muted}
        returnKeyType="done"
        style={[styles.input, { backgroundColor: theme.between, borderColor: theme.border, color: theme.text.primary }]}
        accessibilityLabel={copy.titleLabel}
        testID="tier-create-title"
      />

      <SheetLabel theme={theme} text={copy.templateLabel} />
      <View style={styles.templates}>
        {TIER_TEMPLATES.map((id) => {
          const active = id === template;
          const colors = templateColors(id);
          const labels = templateLabelsOf(copy, id);
          return (
            <GlassTouchable
              key={id}
              glass={false}
              activeOpacity={0.8}
              onPress={() => setTemplate(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={copy.templates[id].name}
              testID={`tier-template-${id}`}
              style={[
                styles.template,
                { backgroundColor: theme.between, borderColor: active ? theme.accent : theme.border },
              ]}
            >
              <View style={styles.templateHead}>
                <Text style={[styles.templateName, { color: theme.text.primary }]} numberOfLines={1}>
                  {copy.templates[id].name}
                </Text>
                {active ? <AppIcon family="Ionicons" name="checkmark-circle" size={18} color={theme.accent} /> : null}
              </View>
              <View style={styles.strip}>
                {colors.map((color, index) => (
                  <View key={`${id}-${index}`} style={[styles.stripCell, { backgroundColor: color }]}>
                    <Text style={[styles.stripText, { color: tierInkOf(color) }]} numberOfLines={1} allowFontScaling={false}>
                      {labels[index]}
                    </Text>
                  </View>
                ))}
              </View>
            </GlassTouchable>
          );
        })}
      </View>
    </TierSheet>
  );
}

const styles = StyleSheet.create({
  firstLabel: { marginTop: 0 },
  input: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 16, fontWeight: "700" },
  templates: { gap: 10 },
  template: { borderRadius: 16, borderWidth: 1.5, padding: 12, gap: 9 },
  templateHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  templateName: { flex: 1, fontSize: 14.5, fontWeight: "800" },
  strip: { flexDirection: "row", borderRadius: 8, overflow: "hidden" },
  stripCell: { flex: 1, height: 26, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  stripText: { fontSize: 9.5, fontWeight: "900" },
});
