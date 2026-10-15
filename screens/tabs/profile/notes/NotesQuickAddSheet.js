// screens/tabs/profile/notes/NotesQuickAddSheet.js
//
// Profildeki "Notlar" kartına BASILI TUTUNCA açılan hızlı ekleme sayfası: iki
// büyük düğme — Yeni not / Yeni liste. Seçim burada YAPILIR ama editör burada
// açılmaz; çağıran `onSelect(type)` ile haberdar olur, sayfa kapanır ve editör
// `onDismissed`ta açılır (BottomSheetModal başlığındaki "iki Modal ardarda" notu:
// iOS kapanmakta olan Modal'ın üstüne ikincisini sunamaz).

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import BottomSheetModal from "@components/common/BottomSheetModal";
import * as Haptics from "../../../../services/hapticsService";
import { i18nText } from "../../../../utils/i18nText";
import { alpha } from "../../../../theme/colors";

const OptionTile = ({ icon, tint, label, description, onPress, theme }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel={`${label}, ${description}`}
    style={[
      st.tile,
      { backgroundColor: alpha(tint, 0.12), borderColor: alpha(tint, 0.34) },
    ]}
  >
    <View style={st.tileTop}>
      <LinearGradient
        colors={[tint, alpha(tint, 0.72)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={st.tileIcon}
      >
        <Ionicons name={icon} size={22} color="#fff" />
      </LinearGradient>
      <View style={[st.tilePlus, { backgroundColor: alpha(tint, 0.18) }]}>
        <Ionicons name="add" size={16} color={tint} />
      </View>
    </View>
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[st.tileLabel, { color: theme.text.primary }]}
    >
      {label}
    </Text>
    <Text
      allowFontScaling={false}
      numberOfLines={3}
      style={[st.tileDesc, { color: theme.text.muted }]}
    >
      {description}
    </Text>
  </TouchableOpacity>
);

export default function NotesQuickAddSheet({
  visible,
  theme,
  onClose,
  onSelect,
  onDismissed,
}) {
  const accent = theme.accent;
  const listTint = theme.notesColor?.blue ?? accent;

  const choose = (type) => {
    Haptics.selectionAsync();
    onSelect(type);
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[st.sheet, { backgroundColor: theme.secondary }]}
    >
      <View style={[st.handle, { backgroundColor: theme.border }]} />

      <View style={st.header}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[st.title, { color: theme.text.primary }]}
        >
          {i18nText("autoI18n.notes_hizli_ekle", "Hızlı ekle")}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[st.subtitle, { color: theme.text.muted }]}
        >
          {i18nText(
            "autoI18n.notes_hizli_ekle_alt",
            "Profilden çıkmadan yeni bir kayıt oluştur",
          )}
        </Text>
      </View>

      <View style={st.row}>
        <OptionTile
          icon="document-text"
          tint={accent}
          label={i18nText("autoI18n.notes_yeni_not", "Yeni not")}
          description={i18nText(
            "autoI18n.notes_hizli_not_aciklama",
            "Bir düşünce, fikir veya metin yaz",
          )}
          onPress={() => choose("note")}
          theme={theme}
        />
        <OptionTile
          icon="checkbox"
          tint={listTint}
          label={i18nText("autoI18n.notes_yeni_liste", "Yeni liste")}
          description={i18nText(
            "autoI18n.notes_hizli_liste_aciklama",
            "Maddeleri tek tek işaretleyebileceğin liste",
          )}
          onPress={() => choose("todo")}
          theme={theme}
        />
      </View>
    </BottomSheetModal>
  );
}

const st = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 32,
    gap: 16,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center" },

  header: { gap: 3 },
  title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, fontWeight: "600", lineHeight: 17 },

  row: { flexDirection: "row", gap: 12 },
  tile: {
    flex: 1,
    minHeight: 148,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  tileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tilePlus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  tileDesc: { fontSize: 11.5, fontWeight: "600", lineHeight: 16 },
});
