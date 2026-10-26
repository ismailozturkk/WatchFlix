// screens/chat/MessagesScreen.js
//
// Mesajlaşma "gelen kutusu" — arkadaş listesinden AYRI. Üstte segment toggle:
//   - Sohbetler: 1-1 konuşmalar (Users/{uid}/conversations index'i)
//   - Gruplar:   kullanıcının grupları (+ yeni grup)
// Çok arkadaş olsa da yalnızca gerçekten mesajlaşılanlar görünür.
//
// Görünüm components/friends/* ortak bileşenlerinden gelir. Okunmamış sohbet:
// satır vurgu rengiyle aydınlanır, ad kalınlaşır, saat vurgulanır ve sağda
// okunmamış sayısı rozeti durur (eskiden yalnız çerçeve rengi değişiyordu).
// Gruplar da AYNI görünümü kullanır; sayaç kaynağı 1-1'de
// Users/{uid}/conversations/*.unreadCount, grupta Users/{uid}/groupInbox/*.unread.

import React, { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAuth } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useTheme } from "@context/ThemeContext";
import { useFriends } from "@context/FriendsContext";
import ScreenDecor from "@components/ScreenDecor";
import GroupAvatar from "@components/chat/GroupAvatar";
import ChatCreateFab from "@components/chat/ChatCreateFab";
import NewConversationSheet from "@components/chat/NewConversationSheet";
import FriendsScreenHeader from "@components/friends/FriendsScreenHeader";
import FriendsSegmentedTabs from "@components/friends/FriendsSegmentedTabs";
import FriendsSearchField from "@components/friends/FriendsSearchField";
import FriendsEmptyState from "@components/friends/FriendsEmptyState";
import PersonRow from "@components/friends/PersonRow";
import { UNREAD_BADGE } from "@components/friends/friendsTokens";
import { formatBadge } from "@utils/friendsBarModel";
import {
  filterConversations,
  filterGroups,
  groupUnreadCount,
  shouldShowFilter,
  toEpochMs,
  totalGroupUnread,
  totalUnread,
} from "@utils/friendsListModel";
import { i18nCount, i18nText } from "@utils/i18nText";
import { intlLocaleOf } from "@utils/appLanguages";
import { useLanguage } from "../../context/LanguageContext";
import { subscribeGroupInbox, subscribeUserGroups } from "@services/groupsService";
import { trackFirestoreRead } from "@services/usageTrackerService";

// Saat/tarih uygulama dilinde (cihaz dilinde değil): DE kullanıcıya "2:49 PM"
// yazıyordu (T3 B17).
const formatTime = (ts, locale) => {
  const ms = toEpochMs(ts);
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return sameDay
    ? d.toLocaleTimeString(locale || [], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(locale || [], { day: "2-digit", month: "2-digit" });
};

/** Okunmamış sayısı rozeti — satırın sağ ucunda. */
function UnreadPill({ count }) {
  return (
    <View style={styles.unreadPill}>
      <Text allowFontScaling={false} style={styles.unreadText}>
        {formatBadge(count)}
      </Text>
    </View>
  );
}

export default function MessagesScreen({ navigation }) {
  const auth = getAuth();
  const user = auth.currentUser;
  const { theme } = useTheme();
  const { language } = useLanguage();
  const timeLocale = intlLocaleOf(language);

  const [tab, setTab] = useState("dm"); // "dm" | "group"
  const [query, setQuery] = useState("");
  const [newConversationVisible, setNewConversationVisible] = useState(false);
  const [convs, setConvs] = useState([]);
  const { isBlocked } = useFriends();
  const [groups, setGroups] = useState([]);
  const [groupInbox, setGroupInbox] = useState({}); // groupId -> okunmamış

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "Users", user.uid, "conversations"),
      (snap) => {
        trackFirestoreRead("Users/conversations", snap.docs.length);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => toEpochMs(b.lastTime) - toEpochMs(a.lastTime));
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

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeGroupInbox(user.uid, setGroupInbox);
    return () => unsub();
  }, [user]);

  const isDm = tab === "dm";
  // Engellenen kişinin sohbeti listede görünmez. Konuşma kaydı SİLİNMİYOR:
  // engel kaldırıldığında geçmiş geri gelsin (engel geri alınabilir bir
  // eylem, veri kaybı değil).
  const visibleConvs = useMemo(
    () => convs.filter((c) => !isBlocked(c.withUid)),
    [convs, isBlocked],
  );
  const unreadTotal = useMemo(() => totalUnread(visibleConvs), [visibleConvs]);
  const groupUnreadTotal = useMemo(
    () => totalGroupUnread(groups, groupInbox),
    [groups, groupInbox],
  );

  const baseData = isDm ? visibleConvs : groups;
  const showFilter = shouldShowFilter(baseData.length);
  const data = useMemo(
    () => (isDm ? filterConversations(visibleConvs, query) : filterGroups(groups, query)),
    [isDm, visibleConvs, groups, query],
  );

  const switchTab = (next) => {
    setTab(next);
    setQuery("");
  };

  // ── 1-1 satırı ──
  const renderConv = ({ item, index }) => {
    const unread = (item.unreadCount || 0) > 0;
    return (
      <PersonRow
        avatar={{ avatarIndex: item.withAvatarIndex, photoURL: item.withPhotoURL }}
        title={item.withName || i18nText("autoI18n.kullanici", "Kullanıcı")}
        titleStrong={unread}
        subtitle={item.lastText || ""}
        subtitleStrong={unread}
        meta={formatTime(item.lastTime, timeLocale)}
        metaAccent={unread}
        highlighted={unread}
        trailing={unread ? <UnreadPill count={item.unreadCount} /> : null}
        first={index === 0}
        last={index === data.length - 1}
        onPress={() =>
          navigation.navigate("ChatScreen", {
            friendUid: item.withUid,
            friendName: item.withName,
            friendAvatarIndex: item.withAvatarIndex,
          })
        }
      />
    );
  };

  // ── Grup satırı ── okunmamış görünümü 1-1 satırıyla AYNI (vurgu, kalın ad,
  // vurgulu saat, sağda sayaç rozeti); sayaç kendi gelen kutumda grup başına durur.
  const renderGroup = ({ item, index }) => {
    const last = item.lastMessage;
    const lastSenderName =
      item.memberInfo?.[last?.senderId]?.name || last?.senderName || "";
    const unreadCount = groupUnreadCount(groupInbox, item.id);
    const unread = unreadCount > 0;
    return (
      <PersonRow
        avatarNode={
          <GroupAvatar
            avatarIndex={item.avatarIndex}
            color={item.color || theme.accent}
            size={52}
            iconSize={36}
          />
        }
        title={item.name}
        titleStrong={unread}
        subtitle={
          last
            ? (lastSenderName ? lastSenderName + ": " : "") + (last.text || "")
            : i18nText("autoI18n.n_uye", "{{n}} üye", { n: item.members?.length || 0 })
        }
        subtitleStrong={unread}
        meta={formatTime(last?.time, timeLocale)}
        metaAccent={unread}
        highlighted={unread}
        trailing={unread ? <UnreadPill count={unreadCount} /> : null}
        first={index === 0}
        last={index === data.length - 1}
        onPress={() =>
          navigation.navigate("ChatScreen", {
            groupId: item.id,
            groupName: item.name,
            groupAvatarIndex: item.avatarIndex,
          })
        }
      />
    );
  };

  const subtitle = isDm
    ? unreadTotal > 0
      ? i18nCount("autoI18n.friends_ui_unread_count", "{{n}} okunmamış mesaj", unreadTotal)
      : visibleConvs.length
        ? i18nCount("autoI18n.friends_ui_chats_count", "{{n}} sohbet", visibleConvs.length)
        : undefined
    : groupUnreadTotal > 0
      ? i18nCount("autoI18n.friends_ui_unread_count", "{{n}} okunmamış mesaj", groupUnreadTotal)
      : groups.length
        ? i18nCount("autoI18n.friends_ui_groups_count", "{{n}} grup", groups.length)
        : undefined;

  let empty = null;
  if (baseData.length === 0) {
    empty = isDm ? (
      <FriendsEmptyState
        icon="chatbubbles"
        title={i18nText("autoI18n.friends_ui_no_chats_title", "Henüz sohbet yok")}
        description={i18nText(
          "autoI18n.friends_ui_no_chats_desc",
          "Bir arkadaşına mesaj atarak ilk sohbetini başlat.",
        )}
      />
    ) : (
      <FriendsEmptyState
        icon="people-circle"
        title={i18nText("autoI18n.friends_ui_no_groups_title", "Henüz grubun yok")}
        description={i18nText(
          "autoI18n.friends_ui_no_groups_desc",
          "Arkadaşlarınla ortak sohbet için yeni bir grup oluştur.",
        )}
      />
    );
  } else if (data.length === 0) {
    empty = (
      <FriendsEmptyState
        icon="search"
        title={i18nText("autoI18n.friends_ui_no_match_title", "Eşleşen kimse yok")}
        description={i18nText(
          "autoI18n.friends_ui_no_match_desc",
          "“{{q}}” ile eşleşen biri bulunamadı.",
          { q: query.trim() },
        )}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScreenDecor scope="chat" iconOpacity={0.3} />

      <FriendsScreenHeader
        title={i18nText("autoI18n.mesajlar", "Mesajlar")}
        subtitle={subtitle}
      />

      <FriendsSegmentedTabs
        value={tab}
        onChange={switchTab}
        tabs={[
          {
            key: "dm",
            label: i18nText("autoI18n.sohbetler", "Sohbetler"),
            icon: "chatbubble-ellipses",
            badge: unreadTotal,
            badgeColor: UNREAD_BADGE,
          },
          {
            key: "group",
            label: i18nText("autoI18n.gruplar", "Gruplar"),
            icon: "people",
            badge: groupUnreadTotal,
            badgeColor: UNREAD_BADGE,
          },
        ]}
      />

      {showFilter ? (
        <FriendsSearchField
          value={query}
          onChangeText={setQuery}
          placeholder={
            isDm
              ? i18nText("autoI18n.friends_ui_filter_chats", "Sohbetlerde ara")
              : i18nText("autoI18n.friends_ui_filter_groups", "Gruplarda ara")
          }
          returnKeyType="done"
        />
      ) : null}

      {empty || (
        <FlatList
          data={data}
          keyExtractor={(it) => it.id}
          renderItem={isDm ? renderConv : renderGroup}
          // Grup sayacı satır nesnesinde değil gelen kutusunda: yalnız o
          // değişince de satırlar yeniden çizilsin.
          extraData={groupInbox}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        />
      )}

      <ChatCreateFab
        icon={isDm ? "chatbubble-ellipses" : "people"}
        label={
          isDm
            ? i18nText("autoI18n.yeni_sohbet", "Yeni Sohbet")
            : i18nText("autoI18n.yeni_grup", "Yeni Grup")
        }
        onPress={() =>
          isDm
            ? setNewConversationVisible(true)
            : navigation.navigate("CreateGroupScreen")
        }
      />

      <NewConversationSheet
        visible={newConversationVisible}
        onClose={() => setNewConversationVisible(false)}
        onSelect={(friend) =>
          navigation.navigate("ChatScreen", {
            friendUid: friend.uid,
            friendName: friend.name,
            friendAvatarIndex: friend.avatarIndex,
          })
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  // FAB (alt sağ) son satırı kapatmasın.
  listContent: { paddingBottom: 100 },
  unreadPill: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UNREAD_BADGE,
  },
  unreadText: { color: "#fff", fontSize: 12, fontWeight: "800", lineHeight: 15 },
});
