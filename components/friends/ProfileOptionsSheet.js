// components/friends/ProfileOptionsSheet.js
//
// Arkadaş profilinin "⋯" menüsü: Şikâyet et / Kullanıcıyı engelle (ya da engeli
// kaldır). Eskiden sistem uyarı kutusuydu (düz metin düğmeleri); artık
// FriendActionSheet ile aynı dilde alttan açılan sayfa: kimlik başlığı, ikon
// karolu satırlar, her satırda ne yapacağını anlatan tek satır, ayrı "Vazgeç".
//
// SIRALAMA: satıra dokunmak başka bir Modal açıyor (şikâyet sebebi sayfası,
// engelleme onayı). iOS kapanmakta olan Modal'ın üstüne ikincisini sunamaz, bu
// yüzden çağıran `visible`i düşürür ve işi `onDismissed`de başlatır
// (bkz. BottomSheetModal "İKİ MODAL ARDARDA").
//
// DİKKAT: kapanış ≈260 ms daha çizilir; çağıran `name`/`blocked`ı kapanışta
// SIFIRLAMAMALI (başlık boşalıp zıplar).

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "@components/common/BottomSheetModal";
import UserAvatar from "@components/common/UserAvatar";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "@theme/colors";
import { i18nText } from "@utils/i18nText";
import { DANGER, FRIEND_GREEN, PENDING_AMBER } from "./friendsTokens";

function OptionRow({ icon, label, description, tone, onPress, chevron, last }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: alpha(theme.border, 0.7),
        },
        pressed && { backgroundColor: alpha(theme.text?.primary ?? "#fff", 0.06) },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: alpha(tone, 0.15) }]}>
        <Ionicons name={icon} size={20} color={tone} />
      </View>
      <View style={styles.rowCopy}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.rowLabel, { color: tone === DANGER ? DANGER : theme.text?.primary ?? "#fff" }]}
        >
          {label}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[styles.rowDescription, { color: theme.text?.muted ?? "#888" }]}
        >
          {description}
        </Text>
      </View>
      {chevron ? (
        <Ionicons name="chevron-forward" size={16} color={theme.text?.muted ?? "#888"} />
      ) : null}
    </Pressable>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {() => void} [props.onDismissed]  Sayfa tamamen kalktıktan sonra (bkz. üstteki not).
 * @param {string} props.name
 * @param {string} [props.username]
 * @param {number} [props.avatarIndex]
 * @param {string} [props.photoURL]
 * @param {boolean} props.blocked
 * @param {() => void} props.onReport
 * @param {() => void} props.onToggleBlock   Engelli ise engeli kaldırma, değilse engelleme akışı.
 */
export default function ProfileOptionsSheet({
  visible,
  onClose,
  onDismissed,
  name,
  username,
  avatarIndex,
  photoURL,
  blocked,
  onReport,
  onToggleBlock,
}) {
  const { theme } = useTheme();

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.primary, borderColor: theme.border },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.header}>
        <UserAvatar
          avatarIndex={avatarIndex}
          photoURL={photoURL}
          size={52}
          shape="squircle"
        />
        <View style={styles.headerCopy}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.name, { color: theme.text?.primary ?? "#fff" }]}
          >
            {name}
          </Text>
          <View style={styles.identityRow}>
            {username ? (
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.username, { color: theme.text?.muted ?? "#888" }]}
              >
                @{username}
              </Text>
            ) : null}
            {blocked ? (
              <View style={[styles.blockedChip, { backgroundColor: alpha(DANGER, 0.14) }]}>
                <Ionicons name="ban" size={10} color={DANGER} />
                <Text allowFontScaling={false} style={[styles.blockedText, { color: DANGER }]}>
                  {i18nText("autoI18n.profil_engelli_etiketi", "Engelli")}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View
        style={[
          styles.group,
          { backgroundColor: theme.secondary, borderColor: alpha(theme.border, 0.7) },
        ]}
      >
        <OptionRow
          icon="flag"
          tone={PENDING_AMBER}
          label={i18nText("autoI18n.sikayet_et", "Şikayet et")}
          description={i18nText(
            "autoI18n.profil_sikayet_aciklama",
            "Uygunsuz davranışı bize bildir; şikâyetin incelenir.",
          )}
          onPress={onReport}
          chevron
        />
        {blocked ? (
          <OptionRow
            icon="lock-open"
            tone={FRIEND_GREEN}
            label={i18nText("autoI18n.engeli_kaldir", "Engeli kaldır")}
            description={i18nText(
              "autoI18n.profil_engeli_kaldir_aciklama",
              "Gönderilerini ve mesajlarını yeniden görürsün.",
            )}
            onPress={onToggleBlock}
            chevron
            last
          />
        ) : (
          <OptionRow
            icon="ban"
            tone={DANGER}
            label={i18nText("autoI18n.kullaniciyi_engelle", "Kullanıcıyı engelle")}
            description={i18nText(
              "autoI18n.profil_engelle_aciklama",
              "Gönderilerini ve mesajlarını görmezsin.",
            )}
            onPress={onToggleBlock}
            last
          />
        )}
      </View>

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.cancel,
          { backgroundColor: theme.secondary, borderColor: alpha(theme.border, 0.7) },
          pressed && { opacity: 0.75 },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[styles.cancelText, { color: theme.text?.secondary ?? "#aaa" }]}
        >
          {i18nText("autoI18n.vazgec", "Vazgeç")}
        </Text>
      </Pressable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  headerCopy: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  username: { fontSize: 13.5, flexShrink: 1 },
  blockedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  blockedText: { fontSize: 11, fontWeight: "800" },
  group: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontSize: 15.5, fontWeight: "800" },
  rowDescription: { fontSize: 12.5, lineHeight: 17, fontWeight: "500" },
  cancel: {
    height: 50,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 15, fontWeight: "800" },
});
