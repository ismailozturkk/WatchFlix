import React, { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { DETAIL_AI_ACTION } from "@utils/detailAiRequest";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import GlassTouchable from "@components/common/GlassTouchable";

export default function DetailAiActionSheet({ visible, onClose, onSelect }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const pendingAction = useRef(null);

  const close = () => {
    pendingAction.current = null;
    onClose();
  };
  const select = (action) => {
    pendingAction.current = action;
    onClose();
  };
  const onDismissed = () => {
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) onSelect(action);
  };

  const actions = [
    { id: DETAIL_AI_ACTION.INFO, label: i18nText("autoI18n.bilgi_al", "Bilgi al"), icon: "information-circle-outline" },
    { id: DETAIL_AI_ACTION.SIMILAR, label: i18nText("autoI18n.buna_benzer_oneri_ver", "Buna benzer öneri ver"), icon: "sparkles-outline" },
  ];

  return (
    <BottomSheetModal
      visible={visible}
      onClose={close}
      onDismissed={onDismissed}
      sheetStyle={[styles.sheet, { backgroundColor: theme.primary, borderColor: theme.border, paddingBottom: Math.max(insets.bottom, 16) }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>
          {i18nText("autoI18n.yapay_zeka", "Yapay Zeka")}
        </Text>
        <GlassCloseButton onPress={close} backgroundColor={theme.secondary} color={theme.text.primary} />
      </View>
      {actions.map((action) => (
        <GlassTouchable
          key={action.id}
          onPress={() => select(action.id)}
          style={[styles.option, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Ionicons name={action.icon} size={21} color={theme.accent} />
          <Text style={[styles.optionText, { color: theme.text.primary }]}>{action.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
        </GlassTouchable>
      ))}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 20, paddingTop: 10, gap: 10 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 6 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { fontSize: 18, fontWeight: "800" },
  option: { minHeight: 58, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  optionText: { flex: 1, fontSize: 15, fontWeight: "700" },
});
