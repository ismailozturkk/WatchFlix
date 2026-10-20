// components/friends/FriendActionSheet.js
//
// Arkadaş satırının "⋯" menüsü: Mesaj gönder / Profili gör / Arkadaşlıktan çıkar.
//
// Eskiden satırda yan yana iki ikon düğmesi vardı (mesaj + çöp kutusu); yıkıcı
// eylem her an parmağın altındaydı. Artık satırda tek hızlı eylem (mesaj) +
// "⋯" var, silme menünün içinde ve kırmızı.
//
// DİKKAT: BottomSheetModal kapanırken ≈260 ms daha çizilir. Çağıran taraf
// `friend`i kapanışta SIFIRLAMAMALI (satır içeriği boşalıp zıplar) — kendi
// `visible` bayrağını yönetmeli, son arkadaşı state'te tutmalı.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "@components/common/BottomSheetModal";
import UserAvatar from "@components/common/UserAvatar";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "@theme/colors";
import { i18nText } from "@utils/i18nText";
import { DANGER } from "./friendsTokens";

function ActionRow({ icon, label, tone, onPress, last }) {
  const { theme } = useTheme();
  const color = tone || theme.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: alpha(theme.border, 0.6),
        },
        pressed && { backgroundColor: alpha(theme.text?.primary ?? "#fff", 0.06) },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: alpha(color, 0.15) }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <Text
        allowFontScaling={false}
        style={[
          styles.actionLabel,
          { color: tone === DANGER ? DANGER : theme.text?.primary ?? "#fff" },
        ]}
      >
        {label}
      </Text>
      {tone === DANGER ? null : (
        <Ionicons name="chevron-forward" size={16} color={theme.text?.muted ?? "#888"} />
      )}
    </Pressable>
  );
}

export default function FriendActionSheet({
  visible,
  friend,
  onClose,
  onMessage,
  onProfile,
  onRemove,
}) {
  const { theme } = useTheme();

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.primary, borderColor: theme.border },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      {friend ? (
        <View style={styles.header}>
          <UserAvatar
            avatarIndex={friend.avatarIndex}
            photoURL={friend.photoURL}
            isCustomPhoto
            size={52}
          />
          <View style={styles.headerCopy}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.name, { color: theme.text?.primary ?? "#fff" }]}
            >
              {friend.displayName}
            </Text>
            {friend.username ? (
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.username, { color: theme.text?.muted ?? "#888" }]}
              >
                @{friend.username}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.group,
          { backgroundColor: theme.secondary, borderColor: alpha(theme.border, 0.7) },
        ]}
      >
        <ActionRow
          icon="chatbubble-ellipses"
          label={i18nText("autoI18n.friends_ui_send_message", "Mesaj gönder")}
          onPress={onMessage}
        />
        <ActionRow
          icon="person"
          label={i18nText("autoI18n.profili_gor", "Profili gör")}
          onPress={onProfile}
        />
        <ActionRow
          icon="person-remove"
          tone={DANGER}
          label={i18nText("autoI18n.friends_ui_remove_friend", "Arkadaşlıktan çıkar")}
          onPress={onRemove}
          last
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
  username: { fontSize: 13.5 },
  group: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { flex: 1, fontSize: 15.5, fontWeight: "700" },
});
