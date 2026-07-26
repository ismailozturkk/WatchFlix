import React, { memo } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";


function SaveDraftModalComponent({
  visible,
  draftName,
  saving,
  isUpdate,
  onChangeName,
  onClose,
  onSave,
}) {
  const { theme } = useTheme();
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => !saving && onClose()}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={() => !saving && onClose()}
        />
        <View style={[styles.box, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]}>
            {isUpdate ? i18nText("autoI18n.taslagi_guncelle", "Taslağı Güncelle") : i18nText("autoI18n.taslak_kaydet", "Taslak Kaydet")}
          </Text>
          <TextInput
            value={draftName}
            onChangeText={onChangeName}
            maxLength={40}
            placeholder={i18nText("autoI18n.taslak_adi_orn_inception_story", "Taslak adı (örn: Inception story)")}
            placeholderTextColor={theme.text.muted}
            autoFocus
            editable={!saving}
            style={[
              styles.input,
              { backgroundColor: theme.primary, color: theme.text.primary, borderColor: theme.border },
            ]}
          />
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onClose}
              disabled={saving}
              style={[styles.btn, { opacity: saving ? 0.4 : 1 }]}
            >
              <Text allowFontScaling={false} style={[styles.btnText, { color: theme.text.muted }]}>{i18nText("autoI18n.iptal", "İptal")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSave}
              disabled={saving}
              style={[styles.btn, styles.saveBtn, { backgroundColor: theme.accent, opacity: saving ? 0.7 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text allowFontScaling={false} style={[styles.btnText, { color: "#fff" }]}>
                  {isUpdate ? i18nText("autoI18n.guncelle", "Güncelle") : "Kaydet"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const SaveDraftModal = memo(SaveDraftModalComponent);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  box: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: "900", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 18,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {},
  btnText: { fontSize: 14, fontWeight: "800" },
});
