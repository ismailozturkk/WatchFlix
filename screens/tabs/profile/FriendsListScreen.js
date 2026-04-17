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
  onSnapshot,
  updateDoc,
  arrayRemove,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../../firebase";
import { useProfileScreen } from "../../../context/ProfileScreenContext";
import { useTheme } from "../../../context/ThemeContext";
import SwipeCard from "../../../modules/SwipeCard";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../../context/LanguageContext";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import IconBacground from "../../../components/IconBacground";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppSettings } from "../../../context/AppSettingsContext";

const LIST_META = {
  watchedMovies: { icon: "movie-outline", iconLib: "mci", color: "#29b864", label: "İzlenen Filmler" },
  watchedTv:     { icon: "tv",           iconLib: "feather", color: "#29b864", label: "İzlenen Diziler" },
  favorites:     { icon: "heart",        iconLib: "ion",  color: "#e33",     label: "Favoriler" },
  watchList:     { icon: "bookmark",     iconLib: "ion",  color: "#64b4ff",  label: "İzlenecekler" },
};

const ListIcon = ({ name, iconLib, color, size = 14 }) => {
  if (iconLib === "mci") return <MaterialCommunityIcons name={name} size={size} color={color} />;
  if (iconLib === "feather") return <Feather name={name} size={size} color={color} />;
  return <Ionicons name={name} size={size} color={color} />;
};

const protectedLists = ["watchedTv", "watchedMovies", "watchList", "favorites"];

export default function FriendsListScreen({ navigation }) {
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [friendLists, setFriendLists] = useState([]);

  const auth = getAuth();
  const user = auth.currentUser;
  const { avatars, gridStyle } = useProfileScreen();
  const { imageQuality } = useAppSettings();
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
    const userRef = doc(db, "Users", user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) setFriends(docSnap.data().friends || []);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!selectedFriend) { setFriendLists([]); return; }
    const userRef = doc(db, "Users", selectedFriend.uid);
    const unsubscribeUser = onSnapshot(userRef, (userSnap) => {
      if (!userSnap.exists()) return;
      const listVisible = userSnap.data().listVisible || [];
      const visibleListNames = listVisible
        .filter((m) => Object.values(m)[0] === true)
        .map((m) => Object.keys(m)[0]);
      const listsRef = doc(db, "Lists", selectedFriend.uid);
      const unsubscribeLists = onSnapshot(listsRef, (listsSnap) => {
        if (!listsSnap.exists()) { setFriendLists([]); return; }
        const all = Object.entries(listsSnap.data() || {});
        setFriendLists(all.filter(([name]) => visibleListNames.includes(name)));
      });
      return () => unsubscribeLists();
    });
    return () => unsubscribeUser();
  }, [selectedFriend]);

  const handleDelete = async (friend) => {
    try {
      const userRef = doc(db, "Users", user.uid);
      const friendRef = doc(db, "Users", friend.uid);
      const [userSnap, friendSnap] = await Promise.all([getDoc(userRef), getDoc(friendRef)]);
      if (!userSnap.exists() || !friendSnap.exists()) return;
      Toast.show({ type: "success", text1: `${friend.displayName} arkadaş listenizden silindi` });
      await updateDoc(userRef, { friends: arrayRemove(friend) });
      const currentUserInFriend = friendSnap.data().friends?.find((f) => f.uid === user.uid);
      if (currentUserInFriend) await updateDoc(friendRef, { friends: arrayRemove(currentUserInFriend) });
    } catch (error) {
      console.error("Arkadaş silme hatası:", error);
      Toast.show({ type: "error", text1: "Silme işlemi başarısız", text2: error.message });
    }
  };

  const handleSendMessage = (friend) => {
    navigation.navigate("ChatScreen", { friendUid: friend.uid, friendName: friend.displayName });
  };

  const sortedLists = (lists) => [
    ...protectedLists.map((n) => lists.find(([ln]) => ln === n)).filter(Boolean),
    ...lists.filter(([ln]) => !protectedLists.includes(ln)).sort((a, b) => a[0].localeCompare(b[0])),
  ];

  const renderFriend = ({ item }) => {
    const isExpanded = selectedFriend?.uid === item.uid;
    return (
      <SwipeCard
        leftButton={{ label: "Sil", color: "#e53935", onPress: () => handleDelete(item) }}
        rightButton={{ label: "Mesaj", color: "#5aacf0", onPress: () => handleSendMessage(item) }}
      >
        {/* Arkadaş satırı */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setSelectedFriend(isExpanded ? null : item)}
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
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={theme.text?.muted ?? "#555"}
          />
        </TouchableOpacity>

        {/* Açılır liste kartları */}
        {isExpanded && (
          <View style={styles.listsSection}>
            {friendLists.length === 0 ? (
              <Text style={[styles.noListsText, { color: theme.text?.muted ?? "#666" }]}>
                Paylaşılan liste yok
              </Text>
            ) : (
              <FlatList
                horizontal
                data={sortedLists(friendLists)}
                keyExtractor={([listName]) => listName}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listCardsRow}
                renderItem={({ item: listItem }) => {
                  const [listName, items] = listItem;
                  const meta = LIST_META[listName];
                  const cols = gridStyle ? 2 : 4;
                  const imgW = gridStyle ? 52 : 36;
                  const imgH = gridStyle ? 78 : 54;

                  return (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.listCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}
                    >
                      {/* Poster grid */}
                      <View style={styles.posterGrid}>
                        {Array.from({ length: cols }).map((_, idx) => {
                          const ci = items?.[idx];
                          return ci?.imagePath ? (
                            <Image
                              key={idx}
                              source={{ uri: `https://image.tmdb.org/t/p/${imageQuality.poster}${ci.imagePath}` }}
                              style={[
                                styles.posterImg,
                                { width: imgW, height: imgH },
                                idx === 0 && styles.roundLeft,
                                idx === cols - 1 && styles.roundRight,
                              ]}
                            />
                          ) : (
                            <View
                              key={idx}
                              style={[
                                styles.posterPlaceholder,
                                { width: imgW, height: imgH, backgroundColor: theme.primary },
                                idx === 0 && styles.roundLeft,
                                idx === cols - 1 && styles.roundRight,
                              ]}
                            />
                          );
                        })}
                      </View>

                      {/* Liste etiketi */}
                      <View style={styles.listLabel}>
                        {meta ? (
                          <ListIcon name={meta.icon} iconLib={meta.iconLib} color={meta.color} />
                        ) : (
                          <Ionicons name="grid" size={13} color={theme.colors?.orange ?? "#ff6400"} />
                        )}
                        <Text
                          style={[styles.listLabelText, { color: theme.text?.primary ?? "#fff" }]}
                          numberOfLines={1}
                        >
                          {meta?.label ?? listName}
                        </Text>
                        <Text style={[styles.listCount, { color: theme.text?.muted ?? "#666" }]}>
                          {items?.length ?? 0}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        )}
      </SwipeCard>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <IconBacground opacity={0.3} />

      {/* Başlık + arkadaş sayısı */}
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
        <Text style={[styles.pageTitle, { color: theme.text?.primary ?? "#fff" }]}>
          Arkadaşlar
        </Text>
        {friends.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: theme.secondary }]}>
            <Text style={[styles.countBadgeText, { color: theme.text?.secondary ?? "#aaa" }]}>
              {friends.length}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Liste */}
      {friends.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={56} color={theme.text?.muted ?? "#444"} />
          <Text style={[styles.emptyText, { color: theme.text?.secondary ?? "#aaa" }]}>
            Henüz hiç arkadaşın yok
          </Text>
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

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 14,
    marginTop: 4,
  },
  pageTitle: {
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

  // ── Expanded lists ────────────────────────────────────────────────────────
  listsSection: { marginBottom: 10 },
  noListsText: { fontSize: 13, textAlign: "center", paddingVertical: 14 },
  listCardsRow: { paddingHorizontal: 4, paddingVertical: 10, gap: 8 },

  listCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
  },
  posterGrid: { flexDirection: "row" },
  posterImg: { resizeMode: "cover" },
  posterPlaceholder: {},
  roundLeft: { borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  roundRight: { borderTopRightRadius: 14, borderBottomRightRadius: 14 },

  listLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  listLabelText: { fontSize: 11, fontWeight: "600", flex: 1 },
  listCount: { fontSize: 10 },

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
