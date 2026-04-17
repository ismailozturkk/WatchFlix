import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Keyboard,
} from "react-native";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase";
import { useTheme } from "../../context/ThemeContext";
import SwipeCard from "../../modules/SwipeCard";
import Ionicons from "@expo/vector-icons/Ionicons";
import IconBacground from "../../components/IconBacground";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import { useProfileScreen } from "../../context/ProfileScreenContext";
import { Image } from "react-native";

export default function SearchFriendsScreen() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const auth = getAuth();
  const { theme } = useTheme();
  const currentUser = auth.currentUser;
  const { avatars } = useProfileScreen();

  const titleAnim = useRef(new Animated.Value(0)).current;
  const searchBarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(searchBarAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm.trim()) {
        handleSearch(searchTerm.trim());
      } else {
        setResults([]);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleSearch = useCallback(
    async (search) => {
      if (!search || !currentUser) return;
      const usersRef = collection(db, "Users");
      const q = query(
        usersRef,
        where("username", ">=", search),
        where("username", "<=", search + "\uf8ff"),
      );
      const querySnapshot = await getDocs(q);
      const users = [];
      const currentUserDocRef = doc(db, "Users", currentUser.uid);
      const currentUserSnap = await getDoc(currentUserDocRef);
      const currentUserData = currentUserSnap.data();
      const friends = currentUserData.friends || [];
      const sendRequests = currentUserData.friendRequests?.sendRequest || [];

      querySnapshot.forEach((docSnap) => {
        if (docSnap.id !== currentUser.uid) {
          const userData = { uid: docSnap.id, ...docSnap.data() };
          const alreadyFriend = friends.some((f) => f.uid === docSnap.id);
          const requestSent = sendRequests.some((r) => r.uid === docSnap.id);
          users.push({ ...userData, alreadyFriend, requestSent });
        }
      });
      setResults(users);
    },
    [currentUser],
  );

  const sendFriendRequest = async (friend) => {
    const friendRef = doc(db, "Users", friend.uid);
    const currentUserRef = doc(db, "Users", currentUser.uid);
    const currentUserData = (await getDoc(currentUserRef)).data();
    const requestObj = {
      uid: currentUser.uid,
      displayName: currentUserData.displayName || "",
      username: currentUserData.username || "",
      avatarIndex: currentUserData.avatarIndex || 0,
    };
    const receivedObj = {
      uid: friend.uid,
      displayName: friend.displayName || "",
      username: friend.username || "",
      avatarIndex: friend.avatarIndex || 0,
    };
    await setDoc(
      currentUserRef,
      { friendRequests: { sendRequest: arrayUnion(receivedObj) } },
      { merge: true },
    );
    await setDoc(
      friendRef,
      { friendRequests: { receivedRequest: arrayUnion(requestObj) } },
      { merge: true },
    );
    setResults((prev) =>
      prev.map((u) => (u.uid === friend.uid ? { ...u, requestSent: true } : u)),
    );
  };

  const handleCancelSent = async (friend) => {
    const userRef = doc(db, "Users", currentUser.uid);
    const friendRef = doc(db, "Users", friend.uid);
    const [userDoc, friendDoc] = await Promise.all([
      getDoc(userRef),
      getDoc(friendRef),
    ]);
    if (!userDoc.exists() || !friendDoc.exists()) return;
    await updateDoc(userRef, {
      "friendRequests.sendRequest": userDoc
        .data()
        .friendRequests.sendRequest.filter((req) => req.uid !== friend.uid),
    });
    await updateDoc(friendRef, {
      "friendRequests.receivedRequest": friendDoc
        .data()
        .friendRequests.receivedRequest.filter(
          (req) => req.uid !== currentUser.uid,
        ),
    });
    setResults((prev) =>
      prev.map((u) =>
        u.uid === friend.uid ? { ...u, requestSent: false } : u,
      ),
    );
  };

  const handleDelete = async (friend) => {
    try {
      const userRef = doc(db, "Users", currentUser.uid);
      const friendRef = doc(db, "Users", friend.uid);
      const userSnap = await getDoc(userRef);
      const friendSnap = await getDoc(friendRef);
      if (!userSnap.exists() || !friendSnap.exists()) return;
      const userData = userSnap.data();
      const friendData = friendSnap.data();
      await updateDoc(userRef, {
        friends: userData.friends.filter((f) => f.uid !== friend.uid),
      });
      await updateDoc(friendRef, {
        friends: friendData.friends.filter((f) => f.uid !== currentUser.uid),
      });
      setResults((prev) =>
        prev.map((u) =>
          u.uid === friend.uid ? { ...u, alreadyFriend: false } : u,
        ),
      );
    } catch (error) {
      console.error("Arkadaş silme hatası:", error);
    }
  };

  const renderItem = ({ item }) => {
    const statusColor = item.alreadyFriend
      ? theme.colors?.green ?? "#29b864"
      : item.requestSent
        ? "#ff9650"
        : null;

    const statusLabel = item.alreadyFriend
      ? "Arkadaş"
      : item.requestSent
        ? "İstek Gönderildi"
        : null;

    return (
      <SwipeCard
        rightButton={
          item.requestSent
            ? { label: "Geri Al", color: "#e56d35", onPress: () => handleCancelSent(item) }
            : item.alreadyFriend
              ? { label: "Sil", color: "#fa3232", onPress: () => handleDelete(item) }
              : { label: "İstek Gönder", color: "#30a75e", onPress: () => sendFriendRequest(item) }
        }
      >
        <View
          style={[
            styles.userCard,
            {
              backgroundColor: theme.secondary,
              borderColor: statusColor ? statusColor + "55" : theme.border,
            },
          ]}
        >
          {/* Avatar */}
          <View style={[styles.avatarWrapper, { borderColor: statusColor ?? theme.border }]}>
            {avatars?.[item.avatarIndex] ? (
              <Image source={avatars[item.avatarIndex]} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                <Ionicons name="person" size={22} color={theme.text?.muted ?? "#555"} />
              </View>
            )}
          </View>

          {/* Bilgiler */}
          <View style={styles.userInfo}>
            <Text
              style={[styles.displayName, { color: theme.text?.primary ?? "#fff" }]}
              numberOfLines={1}
            >
              {item.displayName}
            </Text>
            <Text
              style={[styles.username, { color: theme.text?.secondary ?? "#aaa" }]}
              numberOfLines={1}
            >
              @{item.username}
            </Text>
            {item.email ? (
              <Text
                style={[styles.email, { color: theme.text?.muted ?? "#666" }]}
                numberOfLines={1}
              >
                {item.email}
              </Text>
            ) : null}
          </View>

          {/* Durum */}
          {statusLabel ? (
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          ) : (
            <View style={[styles.addHint, { backgroundColor: theme.primary }]}>
              <Ionicons name="person-add-outline" size={18} color={theme.accent} />
            </View>
          )}
        </View>
      </SwipeCard>
    );
  };

  const titleStyle = {
    opacity: titleAnim,
    transform: [
      {
        translateY: titleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-16, 0],
        }),
      },
    ],
  };
  const searchBarStyle = {
    opacity: searchBarAnim,
    transform: [
      {
        translateY: searchBarAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <IconBacground opacity={0.3} />

      {/* Başlık */}
      <Animated.Text
        style={[styles.pageTitle, { color: theme.text?.primary ?? "#fff" }, titleStyle]}
      >
        Arkadaş Ara
      </Animated.Text>

      {/* Arama kutusu */}
      <Animated.View style={[styles.searchRow, searchBarStyle]}>
        <View style={[styles.searchBar, { backgroundColor: theme.secondary }]}>
          <Ionicons
            name="search"
            size={18}
            color={theme.text?.muted ?? "#666"}
            style={{ marginRight: 8 }}
          />
          <TextInput
            placeholder="Kullanıcı adı ile ara..."
            placeholderTextColor={theme.text?.muted ?? "#666"}
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
            style={[styles.searchInput, { color: theme.text?.primary ?? "#fff" }]}
            returnKeyType="search"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearchTerm(""); setResults([]); Keyboard.dismiss(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={theme.text?.muted ?? "#666"} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* İçerik */}
      {searchTerm === "" ? (
        <View style={styles.emptyState}>
          <LottieView
            style={{ width: 300, height: 300 }}
            source={require("../../LottieJson/search12.json")}
            autoPlay
            loop
          />
          <Text style={[styles.emptyText, { color: theme.text?.secondary ?? "#aaa" }]}>
            Arkadaşlarını bulmak için kullanıcı adı yaz
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={52} color={theme.text?.muted ?? "#444"} />
          <Text style={[styles.emptyText, { color: theme.text?.secondary ?? "#aaa" }]}>
            "{searchTerm}" için kullanıcı bulunamadı
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },

  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 14,
    marginTop: 4,
  },

  searchRow: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 2,
    borderRadius: 16,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },

  listContent: { paddingHorizontal: 16, paddingBottom: 30, paddingTop: 4 },

  // ── User card ────────────────────────────────────────────────────────────
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
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
  userInfo: { flex: 1, gap: 2 },
  displayName: { fontSize: 15, fontWeight: "700" },
  username: { fontSize: 13 },
  email: { fontSize: 12 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  addHint: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Empty state ──────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
