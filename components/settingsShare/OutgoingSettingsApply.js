// components/settingsShare/OutgoingSettingsApply.js
//
// GİDEN "görünüm ayarları" balonunun alt satırı. Gönderen paylaştıktan sonra kendi
// ayarlarını değiştirdiyse (en az bir bölüm artık paylaşılandan farklı) "Bende
// uygula" düğmesi çıkar ve aynı uygulama sayfası açılır; hepsi hâlâ aynıysa yalnız
// kısa not görünür. Karşılaştırma alıcının "Zaten aynı" kuralıyla aynı
// (sectionMatchesCurrent). Ayar context'lerine bağlandığı için balon bunu TEMBEL
// yükler (bkz. SharedSettingsMessage).

import React from "react";
import { StyleSheet, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassPressable from "../common/GlassPressable";
import useSettingsShare from "../../hooks/useSettingsShare";
import { sectionMatchesCurrent, settingsShareSectionIds } from "../../utils/settingsShare";

export default function OutgoingSettingsApply({ share, copy, palette, onApply }) {
  const settings = useSettingsShare();
  const changed = settingsShareSectionIds(share).some(
    (id) => !sectionMatchesCurrent(share, id, { read: settings.read, customThemes: settings.customThemes }),
  );

  if (!changed) return <Text style={[styles.note, { color: palette.muted }]}>{copy.outgoingNote}</Text>;
  return (
    <>
      <Text style={[styles.note, { color: palette.muted }]}>{copy.outgoingChangedNote}</Text>
      <GlassPressable
        glass={false}
        testID="shared-settings-apply-own"
        accessibilityRole="button"
        onPress={onApply}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: palette.surface, borderColor: palette.surfaceBorder },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="refresh-outline" size={14} color={palette.tileInk} />
        <Text allowFontScaling={false} style={[styles.buttonText, { color: palette.tileInk }]}>
          {copy.applyToMe}
        </Text>
      </GlassPressable>
    </>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 11, fontWeight: "600", lineHeight: 15, marginTop: 8 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 32,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  pressed: { opacity: 0.8 },
  buttonText: { fontSize: 12, fontWeight: "800" },
});
