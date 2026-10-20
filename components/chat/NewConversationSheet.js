import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getAuth } from "firebase/auth";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import GroupAvatar from "@components/chat/GroupAvatar";
import { useFriends } from "@context/FriendsContext";
import { useTheme } from "@context/ThemeContext";
import { subscribeUserGroups } from "@services/groupsService";
import { i18nText } from "@utils/i18nText";
import UserAvatar from "../common/UserAvatar";
import GlassTouchable from "../common/GlassTouchable";
import GlassBox from "../common/GlassBox";

const normalizeFriend = (friend) => ({
  uid: friend?.friendUid || friend?.uid || friend?.id,
  name: friend?.friendName || friend?.displayName || friend?.username || "",
  username: friend?.friendUsername || friend?.username || "",
  avatarIndex: friend?.friendAvatarIndex ?? friend?.avatarIndex ?? 0,
  photoURL: friend?.friendPhotoURL || friend?.photoURL || null,
});

export default function NewConversationSheet({
  visible,
  onClose,
  onSelect,
  onDismissed,
  includeGroups = false,
  title,
  subtitle,
}) {
  const { theme } = useTheme();
  const { friends, loading, isBlocked } = useFriends();
  const [query, setQuery] = useState("");
  const [recipientType, setRecipientType] = useState("friend");
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setRecipientType("friend");
    }
  }, [visible]);

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!visible || !includeGroups || !uid) return undefined;
    return subscribeUserGroups(uid, setGroups);
  }, [includeGroups, visible]);

  const data = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (includeGroups && recipientType === "group") {
      return groups.filter((group) => {
        if (!needle) return true;
        return String(group.name || "").toLocaleLowerCase().includes(needle);
      });
    }
    return (friends || [])
      .map(normalizeFriend)
      .filter((friend) => friend.uid && !isBlocked(friend.uid))
      .filter((friend) => {
        if (!needle) return true;
        return `${friend.name} ${friend.username}`
          .toLocaleLowerCase()
          .includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [friends, groups, includeGroups, isBlocked, query, recipientType]);

  // Kapanış animasyonu sürerken içeriği boşaltma; BottomSheetModal yaklaşık
  // 260 ms daha çizimde kaldığı için anlık liste sıçraması oluştururdu.
  const close = onClose;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={close}
      onDismissed={onDismissed}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.primary, borderColor: theme.border },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: theme.accent + "20" }]}>
          <Ionicons name="chatbubble-ellipses" size={21} color={theme.accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {title || i18nText("autoI18n.yeni_sohbet", "Yeni Sohbet")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>
            {subtitle || i18nText("autoI18n.sohbet_icin_arkadas_sec", "Sohbet etmek istediğin arkadaşını seç")}
          </Text>
        </View>
        <GlassCloseButton
          size={36}
          fallbackRadius={12}
          iconSize={20}
          color={theme.text.primary}
          backgroundColor={theme.secondary}
          onPress={close}
        />
      </View>

      {includeGroups && (
        <View style={[styles.tabs, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          {[
            { key: "friend", label: i18nText("autoI18n.arkadaslar", "Arkadaşlar"), icon: "person-outline" },
            { key: "group", label: i18nText("autoI18n.gruplar", "Gruplar"), icon: "people-outline" },
          ].map((tab) => {
            const selected = recipientType === tab.key;
            return (
              <GlassTouchable
                key={tab.key}
                onPress={() => {
                  setRecipientType(tab.key);
                  setQuery("");
                }}
                style={[styles.tab, selected && { backgroundColor: theme.accent }]}
              >
                <Ionicons name={tab.icon} size={16} color={selected ? "#fff" : theme.text.muted} />
                <Text style={[styles.tabText, { color: selected ? "#fff" : theme.text.muted }]}>
                  {tab.label}
                </Text>
              </GlassTouchable>
            );
          })}
        </View>
      )}

      <GlassBox role="field"
        style={[
          styles.search,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        <Ionicons name="search" size={18} color={theme.text.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={
            recipientType === "group"
              ? i18nText("autoI18n.grup_ara", "Grup ara")
              : i18nText("autoI18n.arkadas_ara", "Arkadaş ara")
          }
          placeholderTextColor={theme.text.muted}
          autoCorrect={false}
          style={[styles.searchInput, { color: theme.text.primary }]}
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.text.muted} />
          </TouchableOpacity>
        )}
      </GlassBox>

      <FlatList
        data={data}
        keyExtractor={(item) => String(item.uid || item.id)}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={data.length ? styles.list : styles.emptyList}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={42} color={theme.text.muted} />
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
              {recipientType === "group"
                ? i18nText("autoI18n.henuz_grup_yok", "Henüz bir grubun yok")
                : loading
                ? i18nText("autoI18n.yukleniyor", "Yükleniyor")
                : i18nText("autoI18n.once_arkadas_ekle", "Önce arkadaş eklemelisin")}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => {
              onSelect(
                recipientType === "group"
                  ? { ...item, recipientType: "group" }
                  : { ...item, recipientType: "friend" },
              );
              close();
            }}
            style={[
              styles.friendRow,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            {recipientType === "group" ? (
              <GroupAvatar
                avatarIndex={item.avatarIndex}
                color={item.color || theme.accent}
                size={44}
                iconSize={29}
              />
            ) : (
              <UserAvatar
                avatarIndex={item.avatarIndex}
                photoURL={item.photoURL}
                isCustomPhoto
                size={44}
                borderWidth={2}
                borderColor={theme.accent + "55"}
              />
            )}
            <View style={styles.friendCopy}>
              <Text numberOfLines={1} style={[styles.friendName, { color: theme.text.primary }]}>
                {item.name || (recipientType === "group"
                  ? i18nText("autoI18n.grup", "Grup")
                  : i18nText("autoI18n.kullanici", "Kullanıcı"))}
              </Text>
              {recipientType === "group" ? (
                <Text numberOfLines={1} style={[styles.username, { color: theme.text.muted }]}>
                  {i18nText("autoI18n.n_uye", "{{n}} üye", { n: item.members?.length || 0 })}
                </Text>
              ) : !!item.username && (
                <Text numberOfLines={1} style={[styles.username, { color: theme.text.muted }]}>
                  @{item.username}
                </Text>
              )}
            </View>
            <View style={[styles.arrow, { backgroundColor: theme.accent + "18" }]}>
              <Ionicons name="arrow-forward" size={18} color={theme.accent} />
            </View>
          </TouchableOpacity>
        )}
      />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "78%",
    minHeight: "52%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 11 },
  headerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: "900" },
  subtitle: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  search: { height: 46, borderRadius: 14, borderWidth: 1, marginTop: 16, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  tabs: { height: 42, borderRadius: 13, borderWidth: 1, marginTop: 15, padding: 3, flexDirection: "row", gap: 4 },
  tab: { flex: 1, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  tabText: { fontSize: 12.5, fontWeight: "800" },
  searchInput: { flex: 1, height: "100%", paddingVertical: 0, fontSize: 14 },
  list: { paddingTop: 12, paddingBottom: 8 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 28 },
  emptyTitle: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  friendRow: { minHeight: 66, borderRadius: 16, borderWidth: 1, paddingHorizontal: 11, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 11 },
  friendCopy: { flex: 1, minWidth: 0 },
  friendName: { fontSize: 14.5, fontWeight: "800" },
  username: { fontSize: 11.5, marginTop: 2 },
  arrow: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
