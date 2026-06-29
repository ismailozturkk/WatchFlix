import React, { useCallback } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import GroupAvatarGrid, {
  GROUP_AVATAR_COUNT,
} from "@components/chat/GroupAvatarGrid";

export default function GroupAvatarPickerModal({
  visible,
  selectedIndex,
  color,
  onSelect,
  onClose,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const selectAvatar = useCallback(
    (index) => {
      onSelect(index);
      onClose();
    },
    [onSelect, onClose]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.secondary || "#171727",
              borderColor: theme.border || "rgba(255,255,255,0.08)",
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View
            style={[
              styles.handle,
              { backgroundColor: theme.border || "rgba(255,255,255,0.2)" },
            ]}
          />
          <View style={styles.header}>
            <View
              style={[styles.headerIcon, { backgroundColor: color + "1F" }]}
            >
              <Ionicons name="images-outline" size={18} color={color} />
            </View>
            <View style={styles.headerCopy}>
              <Text
                style={[styles.title, { color: theme.text?.primary || "#fff" }]}
              >
                {i18nText("autoI18n.grup_avatari_sec", "Grup avatarı seç")}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: theme.text?.muted || "#888" },
                ]}
              >
                {i18nText("autoI18n.n_ikon", "{{n}} ikon", {
                  n: GROUP_AVATAR_COUNT,
                })}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeButton,
                { backgroundColor: theme.primary || "rgba(255,255,255,0.06)" },
              ]}
            >
              <Ionicons
                name="close"
                size={20}
                color={theme.text?.primary || "#fff"}
              />
            </TouchableOpacity>
          </View>

          <GroupAvatarGrid
            selectedIndex={selectedIndex}
            color={color}
            onSelect={selectAvatar}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  sheet: {
    height: "76%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 13,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 17, fontWeight: "800", letterSpacing: -0.25 },
  subtitle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
