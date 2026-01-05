import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
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

export default function FriendRequestsScreen() {
  const [tab, setTab] = useState("received"); // 🔹 aktif sekme
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const auth = getAuth();
  const { theme } = useTheme();
  const user = auth.currentUser;
  const { avatars } = useProfileScreen();

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

    // 🔹 Güncelle
    await updateDoc(userRef, {
      friends: arrayUnion(friendObj),
      "friendRequests.receivedRequest":
        userData.friendRequests.receivedRequest.filter(
          (req) => req.uid !== friend.uid
        ),
    });

    await updateDoc(friendRef, {
      friends: arrayUnion(currentUserObj),
      "friendRequests.sendRequest":
        friendData.friendRequests.sendRequest.filter(
          (req) => req.uid !== user.uid
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
          (req) => req.uid !== friend.uid
        ),
    });

    await updateDoc(friendRef, {
      "friendRequests.sendRequest":
        friendData.friendRequests.sendRequest.filter(
          (req) => req.uid !== user.uid
        ),
    });
  };

  const handleCancelSent = async (friend) => {
    // 🔹 Gönderilen isteği iptal et
    const userRef = doc(db, "Users", user.uid);
    const friendRef = doc(db, "Users", friend.uid);
    const userSnap = await getDoc(userRef);
    const friendSnap = await getDoc(friendRef);
    if (!userSnap.exists() || !friendSnap.exists()) return;

    const userData = userSnap.data();
    const friendData = friendSnap.data();

    await updateDoc(userRef, {
      "friendRequests.sendRequest": userData.friendRequests.sendRequest.filter(
        (req) => req.uid !== friend.uid
      ),
    });

    await updateDoc(friendRef, {
      "friendRequests.receivedRequest":
        friendData.friendRequests.receivedRequest.filter(
          (req) => req.uid !== user.uid
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
          : undefined // 'received' değilse butonu gösterme
      }
    >
      <View style={[styles.requestItem, { backgroundColor: theme.secondary }]}>
        <View style={styles.userInfo}>
          <Image source={avatars[item?.avatarIndex]} style={styles.avatar} />
          <View>
            <Text style={[styles.name, { color: theme.text.primary }]}>
              {item.displayName}
            </Text>
            <Text style={[styles.username, { color: theme.text.secondary }]}>
              @{item.username}
            </Text>
          </View>
        </View>
      </View>
    </SwipeCard>
  );

  const activeData = tab === "received" ? requests : sentRequests;

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      {/* 🔹 Sekme Başlıkları */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setTab("received")}
          style={[
            styles.tab,
            {
              backgroundColor:
                tab === "received" ? theme.accent : theme.secondary,
            },
          ]}
        >
          <Text style={{ color: theme.text.primary, fontWeight: "600" }}>
            Gelen İstekler
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab("sent")}
          style={[
            styles.tab,
            {
              backgroundColor: tab === "sent" ? theme.accent : theme.secondary,
            },
          ]}
        >
          <Text style={{ color: theme.text.primary, fontWeight: "600" }}>
            Gönderilen İstekler
          </Text>
        </TouchableOpacity>
      </View>

      {/* 🔹 Liste */}
      {activeData.length === 0 ? (
        <Text
          style={{
            textAlign: "center",
            marginTop: 30,
            color: theme.text.secondary,
          }}
        >
          {tab === "received"
            ? "Gelen arkadaşlık isteği yok."
            : "Gönderilen arkadaşlık isteği yok."}
        </Text>
      ) : (
        <FlatList
          data={activeData}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 80 },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    elevation: 2,
  },
  requestItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  name: { fontSize: 16, fontWeight: "600" },
  username: { fontSize: 14 },
  btn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
});
