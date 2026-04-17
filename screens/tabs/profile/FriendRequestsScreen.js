import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  Dimensions,
} from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");
// Tab bar: marginHorizontal 16 her iki yan → bar genişliği = SCREEN_W - 32
// 2 sekme eşit bölünür
const TAB_W = (SCREEN_W - 32) / 2;
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  getDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../../firebase";
import { useTheme } from "../../../context/ThemeContext";
import { useProfileScreen } from "../../../context/ProfileScreenContext";
import SwipeCard from "../../../modules/SwipeCard";
import IconBacground from "../../../components/IconBacground";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function FriendRequestsScreen() {
  const [tab, setTab] = useState("received");
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const auth = getAuth();
  const { theme } = useTheme();
  const user = auth.currentUser;
  const { avatars } = useProfileScreen();

  const tabAnim = useRef(new Animated.Value(0)).current;
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
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRequests(data.friendRequests?.receivedRequest || []);
        setSentRequests(data.friendRequests?.sendRequest || []);
      }
    });
    return () => unsubscribe();
  }, []);

  const switchTab = (t) => {
    setTab(t);
    Animated.spring(tabAnim, {
      toValue: t === "received" ? 0 : 1,
      speed: 16,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  };

  const handleAccept = async (friend) => {
    const userRef = doc(db, "Users", user.uid);
    const friendRef = doc(db, "Users", friend.uid);
    const userSnap = await getDoc(userRef);
    const friendSnap = await getDoc(friendRef);
    if (!userSnap.exists() || !friendSnap.exists()) return;
    const userData = userSnap.data();
    const friendData = friendSnap.data();
    const currentUserObj = {
      uid: user.uid,
      displayName: user.displayName,
      username: userData.username || "",
      avatarIndex: userData.avatarIndex || 0,
    };
    const friendObj = {
      uid: friend.uid,
      displayName: friend.displayName,
      username: friend.username,
      avatarIndex: friend.avatarIndex || 0,
    };
    await updateDoc(userRef, {
      friends: arrayUnion(friendObj),
      "friendRequests.receivedRequest":
        userData.friendRequests.receivedRequest.filter(
          (req) => req.uid !== friend.uid,
        ),
    });
    await updateDoc(friendRef, {
      friends: arrayUnion(currentUserObj),
      "friendRequests.sendRequest":
        friendData.friendRequests.sendRequest.filter(
          (req) => req.uid !== user.uid,
        ),
    });
  };

  const handleDecline = async (friend) => {
    const userRef = doc(db, "Users", user.uid);
    const friendRef = doc(db, "Users", friend.uid);
    const userSnap = await getDoc(userRef);
    const friendSnap = await getDoc(friendRef);
    if (!userSnap.exists() || !friendSnap.exists()) return;
    const userData = userSnap.data();
    const friendData = friendSnap.data();
    await updateDoc(userRef, {
      "friendRequests.receivedRequest":
        userData.friendRequests.receivedRequest.filter(
          (req) => req.uid !== friend.uid,
        ),
    });
    await updateDoc(friendRef, {
      "friendRequests.sendRequest":
        friendData.friendRequests.sendRequest.filter(
          (req) => req.uid !== user.uid,
        ),
    });
  };

  const handleCancelSent = async (friend) => {
    const userRef = doc(db, "Users", user.uid);
    const friendRef = doc(db, "Users", friend.uid);
    const userSnap = await getDoc(userRef);
    const friendSnap = await getDoc(friendRef);
    if (!userSnap.exists() || !friendSnap.exists()) return;
    const userData = userSnap.data();
    const friendData = friendSnap.data();
    await updateDoc(userRef, {
      "friendRequests.sendRequest": userData.friendRequests.sendRequest.filter(
        (req) => req.uid !== friend.uid,
      ),
    });
    await updateDoc(friendRef, {
      "friendRequests.receivedRequest":
        friendData.friendRequests.receivedRequest.filter(
          (req) => req.uid !== user.uid,
        ),
    });
  };

  const renderItem = ({ item }) => (
    <SwipeCard
      rightButton={{
        label: tab === "received" ? "Reddet" : "İptal Et",
        color: "#c44f4f",
        onPress: () =>
          tab === "received" ? handleDecline(item) : handleCancelSent(item),
      }}
      leftButton={
        tab === "received"
          ? {
              label: "Kabul Et",
              color: "#30a75e",
              onPress: () => handleAccept(item),
            }
          : undefined
      }
    >
      <View
        style={[
          styles.requestCard,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        {/* Avatar */}
        <View
          style={[
            styles.avatarWrapper,
            {
              borderColor:
                tab === "received"
                  ? (theme.colors?.green ?? "#29b864") + "88"
                  : "#ff965088",
            },
          ]}
        >
          {avatars?.[item?.avatarIndex] ? (
            <Image source={avatars[item.avatarIndex]} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: theme.primary },
              ]}
            >
              <Ionicons
                name="person"
                size={22}
                color={theme.text?.muted ?? "#555"}
              />
            </View>
          )}
        </View>

        {/* Bilgiler */}
        <View style={styles.userInfo}>
          <Text
            style={[
              styles.displayName,
              { color: theme.text?.primary ?? "#fff" },
            ]}
            numberOfLines={1}
          >
            {item.displayName}
          </Text>
          <Text
            style={[
              styles.username,
              { color: theme.text?.secondary ?? "#aaa" },
            ]}
            numberOfLines={1}
          >
            @{item.username}
          </Text>
        </View>

        {/* İşlem ipucu */}
        <View style={styles.hintWrapper}>
          {tab === "received" ? (
            <View style={styles.hintRow}>
              <View
                style={[
                  styles.hintBtn,
                  {
                    backgroundColor: (theme.colors?.green ?? "#29b864") + "22",
                  },
                ]}
              >
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={theme.colors?.green ?? "#29b864"}
                />
              </View>
              <View style={[styles.hintBtn, { backgroundColor: "#c44f4f22" }]}>
                <Ionicons name="close" size={16} color="#c44f4f" />
              </View>
            </View>
          ) : (
            <View style={[styles.hintBtn, { backgroundColor: "#ff965022" }]}>
              <Ionicons name="hourglass-outline" size={16} color="#ff9650" />
            </View>
          )}
        </View>
      </View>
    </SwipeCard>
  );

  const activeData = tab === "received" ? requests : sentRequests;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      <IconBacground opacity={0.3} />

      {/* Başlık */}
      <Animated.Text
        style={[
          styles.pageTitle,
          { color: theme.text?.primary ?? "#fff" },
          {
            opacity: titleAnim,
            transform: [
              {
                translateY: titleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-16, 0],
                }),
              },
            ],
          },
        ]}
      >
        Arkadaşlık İstekleri
      </Animated.Text>

      {/* Sekme çubuğu */}
      <View style={[styles.tabBar, { backgroundColor: theme.secondary }]}>
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              backgroundColor: theme.primary,
              width: TAB_W - 8,
              transform: [
                {
                  translateX: tabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [4, TAB_W + 4],
                  }),
                },
              ],
            },
          ]}
        />
        {[
          { key: "received", label: "Gelen İstekler", count: requests.length },
          { key: "sent", label: "Gönderilenler", count: sentRequests.length },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={styles.tabBtn}
            onPress={() => switchTab(t.key)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.tabLabel,
                {
                  color:
                    tab === t.key
                      ? (theme.text?.primary ?? "#fff")
                      : (theme.text?.secondary ?? "#aaa"),
                },
                tab === t.key && { fontWeight: "700" },
              ]}
            >
              {t.label}
            </Text>
            {t.count > 0 && (
              <View
                style={[
                  styles.countDot,
                  {
                    backgroundColor:
                      t.key === "received"
                        ? (theme.colors?.green ?? "#29b864")
                        : "#ff9650",
                  },
                ]}
              >
                <Text style={styles.countDotText}>{t.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste veya boş durum */}
      {activeData.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={
              tab === "received" ? "mail-open-outline" : "paper-plane-outline"
            }
            size={52}
            color={theme.text?.muted ?? "#444"}
          />
          <Text
            style={[
              styles.emptyText,
              { color: theme.text?.secondary ?? "#aaa" },
            ]}
          >
            {tab === "received"
              ? "Gelen arkadaşlık isteği yok"
              : "Gönderilen arkadaşlık isteği yok"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeData}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
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
    marginBottom: 16,
    marginTop: 4,
  },

  // ── Tab bar ──────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    height: 46,
    position: "relative",
    overflow: "hidden",
  },
  tabIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 10,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
    gap: 6,
  },
  tabLabel: { fontSize: 13, fontWeight: "500" },
  countDot: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  countDotText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  listContent: { paddingHorizontal: 16, paddingBottom: 30 },

  // ── Request card ─────────────────────────────────────────────────────────
  requestCard: {
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
  userInfo: { flex: 1, gap: 3 },
  displayName: { fontSize: 15, fontWeight: "700" },
  username: { fontSize: 13 },
  hintWrapper: { alignItems: "center", justifyContent: "center" },
  hintRow: { flexDirection: "row", gap: 6 },
  hintBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Empty state ──────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
