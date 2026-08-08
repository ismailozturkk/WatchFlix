// screens/chat/MessagesScreen.js
//
// Mesajlaşma "gelen kutusu" — arkadaş listesinden AYRI. Üstte segment toggle:
//   - Sohbetler: 1-1 konuşmalar (Users/{uid}/conversations index'i)
//   - Gruplar:   kullanıcının grupları (+ yeni grup)
// Çok arkadaş olsa da yalnızca gerçekten mesajlaşılanlar görünür.

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAuth } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useTheme } from "@context/ThemeContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { useFriends } from "@context/FriendsContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import BackButton from "@components/BackButton";
import ScreenDecor from "@components/ScreenDecor";
import GroupAvatar from "@components/chat/GroupAvatar";
import { i18nText } from "@utils/i18nText";
import { subscribeUserGroups } from "@services/groupsService";

const toMs = (ts) => ts?.toMillis?.() || 0;
const formatTime = (ts) => {
  const ms = toMs(ts);
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

export default function MessagesScreen({ navigation }) {
  const auth = getAuth();
  const user = auth.currentUser;
  const { theme } = useTheme();
  const { avatars } = useProfileUi();

  const [tab, setTab] = useState("dm"); // "dm" | "group"
  const [convs, setConvs] = useState([]);
  const { isBlocked } = useFriends();
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "Users", user.uid, "conversations"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => toMs(b.lastTime) - toMs(a.lastTime));
        setConvs(list);
      },
      (err) => __DEV__ && console.warn("conversations:", err.message),
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserGroups(user.uid, setGroups);
    return () => unsub();
  }, [user]);

  // ── 1-1 satırı ──
  // Okunmamış mesaj varsa kart border'ı accent'e döner (sohbet açılınca
  // ChatScreen sayacı sıfırlar, border normale döner).
  const renderConv = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() =>
        navigation.navigate("ChatScreen", {
          friendUid: item.withUid,
          friendName: item.withName,
          friendAvatarIndex: item.withAvatarIndex,
        })
      }
      style={[
        styles.row,
        {
          backgroundColor: theme.secondary,
          borderColor: (item.unreadCount || 0) > 0 ? theme.accent : theme.border,
        },
      ]}
    >
      <View style={[styles.avatarWrap, { borderColor: theme.accent + "55" }]}>
        {avatars?.[item.withAvatarIndex] ? (
          <Image source={avatars[item.withAvatarIndex]} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPh, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarInitial}>
              {(item.withName || "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, { color: theme.text?.primary ?? "#fff" }]} numberOfLines={1}>
            {item.withName || i18nText("autoI18n.kullanici", "Kullanıcı")}
          </Text>
          {!!item.lastTime && (
            <Text style={[styles.time, { color: theme.text?.muted ?? "#777" }]}>
              {formatTime(item.lastTime)}
            </Text>
          )}
        </View>
        <Text style={[styles.last, { color: theme.text?.secondary ?? "#aaa" }]} numberOfLines={1}>
          {item.lastText || ""}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // ── Grup satırı ──
  const renderGroup = ({ item }) => {
    const last = item.lastMessage;
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
            <Text style={[styles.name, { color: theme.text?.primary ?? "#fff" }]} numberOfLines={1}>
              {item.name}
            </Text>
            {!!last?.time && (
              <Text style={[styles.time, { color: theme.text?.muted ?? "#777" }]}>
                {formatTime(last.time)}
              </Text>
            )}
          </View>
          <Text style={[styles.last, { color: theme.text?.secondary ?? "#aaa" }]} numberOfLines={1}>
            {last
              ? (last.senderName ? last.senderName + ": " : "") + (last.text || "")
              : i18nText("autoI18n.n_uye", "{{n}} üye", { n: item.members?.length || 0 })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const isDm = tab === "dm";
  // Engellenen kişinin sohbeti listede görünmez. Konuşma kaydı SİLİNMİYOR:
  // engel kaldırıldığında geçmiş geri gelsin (engel geri alınabilir bir
  // eylem, veri kaybı değil).
  const visibleConvs = useMemo(
    () => convs.filter((c) => !isBlocked(c.withUid)),
    [convs, isBlocked],
  );

  const data = isDm ? visibleConvs : groups;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScreenDecor iconOpacity={0.3} />

      <View style={styles.headerRow}>
        <BackButton absolute={false} />
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.title, { color: theme.text?.primary ?? "#fff" }]}
        >
          {i18nText("autoI18n.mesajlar", "Mesajlar")}
        </Text>
        {!isDm && (
          <TouchableOpacity
            onPress={() => navigation.navigate("CreateGroupScreen")}
            style={[styles.newBtn, { backgroundColor: theme.accent }]}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.newBtnText}>{i18nText("autoI18n.yeni", "Yeni")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Segment toggle */}
      <View style={[styles.segment, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.segBtn, isDm && { backgroundColor: theme.accent }]}
          onPress={() => setTab("dm")}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-ellipses" size={16} color={isDm ? "#fff" : theme.text?.muted ?? "#888"} />
          <Text style={[styles.segText, { color: isDm ? "#fff" : theme.text?.secondary ?? "#aaa" }]}>
            {i18nText("autoI18n.sohbetler", "Sohbetler")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segBtn, !isDm && { backgroundColor: theme.accent }]}
          onPress={() => setTab("group")}
          activeOpacity={0.8}
        >
          <Ionicons name="people" size={16} color={!isDm ? "#fff" : theme.text?.muted ?? "#888"} />
          <Text style={[styles.segText, { color: !isDm ? "#fff" : theme.text?.secondary ?? "#aaa" }]}>
            {i18nText("autoI18n.gruplar", "Gruplar")}
          </Text>
        </TouchableOpacity>
      </View>

      {data.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name={isDm ? "chatbubbles-outline" : "people-circle-outline"}
            size={58}
            color={theme.text?.muted ?? "#444"}
          />
          <Text style={[styles.emptyText, { color: theme.text?.secondary ?? "#aaa" }]}>
            {isDm
              ? i18nText("autoI18n.henuz_sohbet_yok", "Henüz sohbet yok. Arkadaşlarından birine mesaj at!")
              : i18nText("autoI18n.henuz_grup_yok", "Henüz grubun yok. Yeni bir grup oluştur!")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it) => it.id}
          renderItem={isDm ? renderConv : renderGroup}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  // Geri butonu satır içinde duruyor (absolute değil): eskiden başlığın
  // üstüne binip "Mesajlar" yazısını kapatıyordu.
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 4,
  },
  title: { flex: 1, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  newBtnText: { color: "#fff", fontSize: 13.5, fontWeight: "800" },

  segment: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  segText: { fontSize: 13.5, fontWeight: "800" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatarWrap: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, overflow: "hidden" },
  avatar: { width: "100%", height: "100%", borderRadius: 25 },
  avatarPh: { justifyContent: "center", alignItems: "center" },
  avatarInitial: { color: "#fff", fontSize: 18, fontWeight: "800" },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { fontSize: 15.5, fontWeight: "700", flex: 1 },
  time: { fontSize: 11, fontWeight: "600" },
  last: { fontSize: 13, marginTop: 3 },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, paddingHorizontal: 32 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
