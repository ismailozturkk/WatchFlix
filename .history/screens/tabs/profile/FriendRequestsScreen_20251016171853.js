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
  arrayRemove,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../../firebase";
import { useTheme } from "../../../context/ThemeContext";
import { useProfileScreen } from "../../../context/ProfileScreenContext";

export default function FriendRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const auth = getAuth();
  const { theme } = useTheme();
  const user = auth.currentUser;
  const { avatars, avatar } = useProfileScreen();

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, "Users", user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setRequests(docSnap.data().friendRequests.receivedRequest || []);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAccept = async (friend) => {
    const userRef = doc(db, "Users", user.uid);
    const friendRef = doc(db, "Users", friend.uid);

    // 🔹 Her iki kullanıcıyı çek
    const userSnap = await getDoc(userRef);
    const friendSnap = await getDoc(friendRef);

    if (!userSnap.exists() || !friendSnap.exists()) return;

    const userData = userSnap.data();
    const friendData = friendSnap.data();

    // 🔹 Yeni arkadaş objeleri
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

    // 🔹 receivedRequest listesinden sil
    const updatedReceived = (
      userData.friendRequests?.receivedRequest || []
    ).filter((req) => req.uid !== friend.uid);

    // 🔹 sendRequest listesinden sil
    const updatedSend = (friendData.friendRequests?.sendRequest || []).filter(
      (req) => req.uid !== user.uid
    );

    // 🔹 Güncelle
    await updateDoc(userRef, {
      friends: arrayUnion(friendObj),
      "friendRequests.receivedRequest": updatedReceived,
    });

    await updateDoc(friendRef, {
      friends: arrayUnion(currentUserObj),
      "friendRequests.sendRequest": updatedSend,
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

    const updatedReceived = (
      userData.friendRequests?.receivedRequest || []
    ).filter((req) => req.uid !== friend.uid);

    const updatedSend = (friendData.friendRequests?.sendRequest || []).filter(
      (req) => req.uid !== user.uid
    );

    await updateDoc(userRef, {
      "friendRequests.receivedRequest": updatedReceived,
    });

    await updateDoc(friendRef, {
      "friendRequests.sendRequest": updatedSend,
    });
  };

  const renderItem = ({ item }) => (
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
      <View
        style={{
          flexDirection: "row",
          gap: 10,
        }}
      >
        <TouchableOpacity
          style={{
            backgroundColor: "#30a75eff",
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderRadius: 10,
          }}
          onPress={() => handleAccept(item)}
        >
          <Text style={[styles.name, { color: theme.text.primary }]}>
            Kabul Et
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            backgroundColor: "#c44f4fff",
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderRadius: 10,
          }}
          onPress={() => handleDecline(item)}
        >
          <Text style={[styles.name, { color: theme.text.primary }]}>
            Reddet
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      {requests.length === 0 ? (
        <Text>Gelen arkadaşlık isteği yok.</Text>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 70,
    backgroundColor: "#f9f9f9",
  },
  requestItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
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
  username: { fontSize: 14, color: "#666" },
  acceptBtn: { color: "green", fontWeight: "600" },
  declineBtn: { color: "white", fontWeight: "600" },
});
