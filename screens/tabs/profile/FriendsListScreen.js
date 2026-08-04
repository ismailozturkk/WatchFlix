import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  arrayRemove,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../../firebase";
import { useProfileUi } from "../../../context/ProfileUiContext";
import { useTheme } from "../../../context/ThemeContext";
import Toast from "react-native-toast-message";
import { appAlert } from "@components/AppAlert";
import { useLanguage } from "../../../context/LanguageContext";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import ScreenDecor from "../../../components/ScreenDecor";
import BackButton from "../../../components/BackButton";
import { SafeAreaView } from "react-native-safe-area-context";
import { useImageQualitySettings } from "../../../context/AppSettingsContext";
import { i18nText } from "../../../utils/i18nText";

export default function FriendsListScreen({ navigation }) {
  const [friends, setFriends] = useState([]);

  const auth = getAuth();
  const user = auth.currentUser;
  const { avatars } = useProfileUi();
  const { theme } = useTheme();
  useLanguage();

  const titleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(titleAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (!user) return;
    let legacyUnsub = null;

    const unsubSub = onSnapshot(
      collection(db, "Users", user.uid, "friends"),
      (snap) => {
        if (!snap.empty) {
          if (legacyUnsub) { legacyUnsub(); legacyUnsub = null; }
          setFriends(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                uid: data.friendUid || d.id,
                displayName: data.friendName || "",
                username: data.friendUsername || "",
                avatarIndex: data.friendAvatarIndex ?? 0,
              };
            }),
          );
        } else if (!legacyUnsub) {
          legacyUnsub = onSnapshot(doc(db, "Users", user.uid), (docSnap) => {
            if (docSnap.exists()) setFriends(docSnap.data().friends || []);
          });
        }
      }
    );

    return () => {
      unsubSub();
      if (legacyUnsub) legacyUnsub();
    };
  }, [user]);

  const handleDelete = async (friend) => {
    try {
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.friend_removed_named", "{{name}} arkadaş listenizden silindi", { name: friend.displayName }),
      });
      // Subcollection sil
      await Promise.all([
        deleteDoc(doc(db, "Users", user.uid,   "friends", friend.uid)),
        deleteDoc(doc(db, "Users", friend.uid, "friends", user.uid)),
      ]);
      // Eski format root-doc array'i de temizle (varsa)
      const [userSnap, friendSnap] = await Promise.all([
        getDoc(doc(db, "Users", user.uid)),
        getDoc(doc(db, "Users", friend.uid)),
      ]);
      const legacyUserFriends   = userSnap.data()?.friends || [];
      const legacyFriendFriends = friendSnap.data()?.friends || [];
      const userEntry   = legacyUserFriends.find((f) => f.uid === friend.uid);
      const friendEntry = legacyFriendFriends.find((f) => f.uid === user.uid);
      const updates = [];
      if (userEntry)   updates.push(updateDoc(doc(db, "Users", user.uid),   { friends: arrayRemove(userEntry) }));
      if (friendEntry) updates.push(updateDoc(doc(db, "Users", friend.uid), { friends: arrayRemove(friendEntry) }));
      if (updates.length) await Promise.all(updates);
    } catch (error) {
      console.error(i18nText("autoI18n.arkadas_silme_hatasi", "Arkadaş silme hatası:"), error);
      Toast.show({ type: "error", text1: i18nText("autoI18n.silme_islemi_basarisiz", "Silme işlemi başarısız"), text2: error.message });
    }
  };

  const handleSendMessage = (friend) => {
    navigation.navigate("ChatScreen", {
      friendUid: friend.uid,
      friendName: friend.displayName,
      friendAvatarIndex: friend.avatarIndex,
    });
  };

  // Görünür silme butonuna yanlışlıkla basılabilir (swipe'ın aksine) — onay iste.
  const confirmDelete = (friend) =>
    appAlert(
      i18nText("autoI18n.arkadasi_sil", "Arkadaşı Sil"),
      i18nText(
        "autoI18n.arkadas_silme_onay",
        "{{name}} arkadaş listenden silinsin mi?",
        { name: friend.displayName },
      ),
      [
        { text: i18nText("autoI18n.vazgec", "Vazgeç"), style: "cancel" },
        {
          text: i18nText("autoI18n.sil", "Sil"),
          style: "destructive",
          onPress: () => handleDelete(friend),
        },
      ],
    );

  const renderFriend = ({ item }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() =>
          navigation.navigate("FriendProfileScreen", {
            friendUid: item.uid,
            friendName: item.displayName,
          })
        }
        style={[styles.friendCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}
      >
        <View style={[styles.avatarWrapper, { borderColor: theme.accent + "66" }]}>
          {avatars?.[item.avatarIndex] ? (
            <Image source={avatars[item.avatarIndex]} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
              <Ionicons name="person" size={22} color={theme.text?.muted ?? "#555"} />
            </View>
          )}
        </View>
        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: theme.text?.primary ?? "#fff" }]} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={[styles.friendUsername, { color: theme.text?.secondary ?? "#aaa" }]} numberOfLines={1}>
            @{item.username}
          </Text>
        </View>
        {/* Eylem butonları — eski kaydırma işlemlerinin yerine */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#5aacf022" }]}
            onPress={() => handleSendMessage(item)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={17} color="#5aacf0" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#e5393522" }]}
            onPress={() => confirmDelete(item)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="trash-outline" size={17} color="#e53935" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScreenDecor iconOpacity={0.3} />

      {/* Geri + başlık + arkadaş sayısı */}
      <View style={styles.headerBar}>
        <View style={styles.headerSide}>
          <BackButton absolute={false} />
        </View>
        <Animated.View
          style={[
            styles.headerRow,
            {
              opacity: titleAnim,
              transform: [{
                translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }),
              }],
            },
          ]}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.pageTitle, { color: theme.text?.primary ?? "#fff" }]}
          >{i18nText("autoI18n.arkadaslar", "Arkadaşlar")}</Text>
          {friends.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: theme.secondary }]}>
              <Text style={[styles.countBadgeText, { color: theme.text?.secondary ?? "#aaa" }]}>
                {friends.length}
              </Text>
            </View>
          )}
        </Animated.View>
        {/* Başlık geri butonuna rağmen ortalı kalsın diye simetrik boşluk */}
        <View style={styles.headerSide} />
      </View>

      {/* Liste */}
      {friends.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={56} color={theme.text?.muted ?? "#444"} />
          <Text style={[styles.emptyText, { color: theme.text?.secondary ?? "#aaa" }]}>{i18nText("autoI18n.henuz_hic_arkadasin_yok", "Henüz hiç arkadaşın yok")}</Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.uid}
          renderItem={renderFriend}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },

  // Geri butonu satır içinde: eskiden absolute olduğu için başlığın üstüne
  // biniyordu. headerSide iki yanda eşit boşluk bırakıp başlığı ortalı tutar.
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 14,
    marginTop: 4,
  },
  headerSide: { width: 40 },
  headerRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  pageTitle: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: { fontSize: 14, fontWeight: "700" },

  listContent: { paddingHorizontal: 16, paddingBottom: 30 },

  // ── Friend card ───────────────────────────────────────────────────────────
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    marginBottom: 2,
    borderWidth: 1,
    gap: 12,
  },
  avatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    overflow: "hidden",
  },
  avatar: { width: "100%", height: "100%", borderRadius: 26 },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  friendInfo: { flex: 1, gap: 3 },
  friendName: { fontSize: 15, fontWeight: "700" },
  friendUsername: { fontSize: 13 },
  actionsRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
