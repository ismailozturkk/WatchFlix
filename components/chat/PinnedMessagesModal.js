import React from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheetModal from "@components/common/BottomSheetModal";
import { i18nText } from "@utils/i18nText";

const formatPinnedTime = (value, locale) => {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
};

export default function PinnedMessagesModal({
  visible,
  pins,
  locale,
  onClose,
  onJump,
  onUnpin,
  canRemovePin,
}) {
  const insets = useSafeAreaInsets();

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}
    >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleIcon}>
              <Ionicons name="pin" size={18} color="#A9A5FF" />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{i18nText("autoI18n.sabitlenmis_mesajlar", "Sabitlenmiş mesajlar")}</Text>
              <Text style={styles.subtitle}>
                {i18nText("autoI18n.n_mesaj_sabitli", "{{n}} mesaj sabitli", { n: pins.length })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={21} color="#fff" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={pins}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={!pins.length ? styles.emptyContent : undefined}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => onJump(item.messageId)}>
                <View style={styles.rowAccent} />
                <View style={styles.rowCopy}>
                  <Text style={styles.sender} numberOfLines={1}>
                    {item.senderName || i18nText("autoI18n.sohbet_mesaji", "Mesaj")}
                  </Text>
                  <Text style={styles.preview} numberOfLines={2}>{item.preview}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {i18nText("autoI18n.x_sabitledi", "{{name}} sabitledi", {
                      name: item.pinnedByName || i18nText("autoI18n.bir_uye", "Bir üye"),
                    })}
                    {formatPinnedTime(item.pinnedAt, locale) ? ` · ${formatPinnedTime(item.pinnedAt, locale)}` : ""}
                  </Text>
                </View>
                {canRemovePin(item) ? (
                  <TouchableOpacity
                    onPress={(event) => {
                      event.stopPropagation();
                      onUnpin(item);
                    }}
                    style={styles.unpinButton}
                    accessibilityLabel={i18nText("autoI18n.sabitlemeyi_kaldir", "Sabitlemeyi kaldır")}
                  >
                    <Ionicons name="close-circle-outline" size={20} color="#FF8A8A" />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.28)" />
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="pin-outline" size={36} color="rgba(255,255,255,0.24)" />
                <Text style={styles.emptyText}>{i18nText("autoI18n.sabitli_mesaj_yok", "Sabitlenmiş mesaj yok")}</Text>
              </View>
            }
          />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "72%",
    minHeight: 360,
    backgroundColor: "#141426",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.09)",
    paddingHorizontal: 16,
  },
  handle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, marginTop: 10, marginBottom: 15, backgroundColor: "rgba(255,255,255,0.18)" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  titleIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(108,99,255,0.16)" },
  headerCopy: { flex: 1, marginLeft: 11 },
  title: { color: "#fff", fontSize: 17, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.42)", fontSize: 11.5, marginTop: 2 },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)" },
  list: { minHeight: 260 },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.045)", borderRadius: 15, marginBottom: 8, overflow: "hidden", paddingRight: 10 },
  rowAccent: { alignSelf: "stretch", width: 3, backgroundColor: "#8A83FF" },
  rowCopy: { flex: 1, paddingHorizontal: 11, paddingVertical: 10 },
  sender: { color: "#B5B1FF", fontSize: 11.5, fontWeight: "800" },
  preview: { color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 18, marginTop: 2 },
  meta: { color: "rgba(255,255,255,0.34)", fontSize: 10.5, marginTop: 4 },
  unpinButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  emptyContent: { flexGrow: 1 },
  empty: { flex: 1, minHeight: 240, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { color: "rgba(255,255,255,0.42)", fontSize: 13, fontWeight: "600" },
});
