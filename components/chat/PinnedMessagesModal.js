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
import GlassCloseButton from "@components/common/GlassCloseButton";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { alpha } from "../../theme/colors";

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
  const { theme } = useTheme();

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 18),
        },
      ]}
    >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <View style={styles.header}>
            <View style={[styles.titleIcon, { backgroundColor: alpha(theme.accent, 0.16) }]}>
              <Ionicons name="pin" size={18} color={theme.accent} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: theme.text.primary }]}>
                {i18nText("autoI18n.sabitlenmis_mesajlar", "Sabitlenmiş mesajlar")}
              </Text>
              <Text style={[styles.subtitle, { color: theme.text.muted }]}>
                {i18nText("autoI18n.n_mesaj_sabitli", "{{n}} mesaj sabitli", { n: pins.length })}
              </Text>
            </View>
            <GlassCloseButton
              size={36}
              fallbackRadius={18}
              iconSize={21}
              color={theme.text.primary}
              backgroundColor={theme.between}
              onPress={onClose}
            />
          </View>

          <FlatList
            data={pins}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={!pins.length ? styles.emptyContent : undefined}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.row,
                  { backgroundColor: theme.between, borderColor: theme.border },
                ]}
                onPress={() => onJump(item.messageId)}
              >
                <View style={[styles.rowAccent, { backgroundColor: theme.accent }]} />
                <View style={styles.rowCopy}>
                  <Text style={[styles.sender, { color: theme.accent }]} numberOfLines={1}>
                    {item.senderName || i18nText("autoI18n.sohbet_mesaji", "Mesaj")}
                  </Text>
                  <Text
                    style={[styles.preview, { color: theme.text.primary }]}
                    numberOfLines={2}
                  >
                    {item.preview}
                  </Text>
                  <Text style={[styles.meta, { color: theme.text.muted }]} numberOfLines={1}>
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
                  <Ionicons name="chevron-forward" size={17} color={theme.text.muted} />
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="pin-outline" size={36} color={theme.text.muted} />
                <Text style={[styles.emptyText, { color: theme.text.muted }]}>
                  {i18nText("autoI18n.sabitli_mesaj_yok", "Sabitlenmiş mesaj yok")}
                </Text>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  handle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, marginTop: 10, marginBottom: 15 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  titleIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, marginLeft: 11 },
  title: { fontSize: 17, fontWeight: "800" },
  subtitle: { fontSize: 11.5, marginTop: 2 },
  list: { minHeight: 260 },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, marginBottom: 8, overflow: "hidden", paddingRight: 10 },
  rowAccent: { alignSelf: "stretch", width: 3 },
  rowCopy: { flex: 1, paddingHorizontal: 11, paddingVertical: 10 },
  sender: { fontSize: 11.5, fontWeight: "800" },
  preview: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  meta: { fontSize: 10.5, marginTop: 4 },
  unpinButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  emptyContent: { flexGrow: 1 },
  empty: { flex: 1, minHeight: 240, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { fontSize: 13, fontWeight: "600" },
});
