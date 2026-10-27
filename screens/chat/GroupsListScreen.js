// screens/chat/GroupsListScreen.js
//
// Kullanıcının gruplarını listeler; satıra basınca ChatScreen'i grup modunda
// açar. Yeni grup aksiyonu listeyi kapatmayan sağ-alt FAB üzerinden açılır.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
// Ekran kökü: Premium şeridi yüzerken üst boşluğu ona göre büyür.
import SafeAreaView from "@components/common/ScreenSafeAreaView";
import { getAuth } from "firebase/auth";
import { useTheme } from "@context/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import BackButton from "@components/BackButton";
import ScreenDecor from "@components/ScreenDecor";
import GroupAvatar from "@components/chat/GroupAvatar";
import ChatCreateFab from "@components/chat/ChatCreateFab";
import { i18nText } from "@utils/i18nText";
import { subscribeUserGroups } from "@services/groupsService";

const formatTime = (ts) => {
  const ms = ts?.toMillis?.();
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
};

export default function GroupsListScreen({ navigation }) {
  const auth = getAuth();
  const user = auth.currentUser;
  const { theme } = useTheme();
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserGroups(user.uid, setGroups);
    return () => unsub();
  }, [user]);

  const renderGroup = ({ item }) => {
    const last = item.lastMessage;
    const lastSenderName =
      item.memberInfo?.[last?.senderId]?.name || last?.senderName || "";
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() =>
          navigation.navigate("ChatScreen", {
            groupId: item.id,
            groupName: item.name,
            groupAvatarIndex: item.avatarIndex,
          })
        }
        style={[styles.row, { backgroundColor: theme.secondary, borderColor: theme.border }]}
      >
        <GroupAvatar
          avatarIndex={item.avatarIndex}
          color={item.color || theme.accent}
          size={50}
          iconSize={34}
        />
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={[styles.gName, { color: theme.text?.primary ?? "#fff" }]} numberOfLines={1}>
              {item.name}
            </Text>
            {!!last?.time && (
              <Text style={[styles.gTime, { color: theme.text?.muted ?? "#777" }]}>
                {formatTime(last.time)}
              </Text>
            )}
          </View>
          <Text style={[styles.gLast, { color: theme.text?.secondary ?? "#aaa" }]} numberOfLines={1}>
            {last
              ? (lastSenderName ? lastSenderName + ": " : "") + (last.text || "")
              : i18nText("autoI18n.n_uye", "{{n}} üye", { n: item.members?.length || 0 })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScreenDecor scope="chat" iconOpacity={0.3} />

      <View style={styles.headerRow}>
        <BackButton absolute={false} />
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.title, { color: theme.text?.primary ?? "#fff" }]}
        >
          {i18nText("autoI18n.gruplar", "Gruplar")}
        </Text>
      </View>

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-circle-outline" size={60} color={theme.text?.muted ?? "#444"} />
          <Text style={[styles.emptyText, { color: theme.text?.secondary ?? "#aaa" }]}>
            {i18nText("autoI18n.henuz_grup_yok", "Henüz grubun yok. Yeni bir grup oluştur!")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(it) => it.id}
          renderItem={renderGroup}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}
      <ChatCreateFab
        icon="people"
        label={i18nText("autoI18n.yeni_grup", "Yeni Grup")}
        onPress={() => navigation.navigate("CreateGroupScreen")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  // Geri butonu satır içinde duruyor (absolute değil): eskiden başlığın
  // üstüne binip "Gruplar" yazısını kapatıyordu.
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
    marginTop: 4,
  },
  title: { flex: 1, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  gName: { fontSize: 15.5, fontWeight: "700", flex: 1 },
  gTime: { fontSize: 11, fontWeight: "600" },
  gLast: { fontSize: 13, marginTop: 3 },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, paddingHorizontal: 32 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
