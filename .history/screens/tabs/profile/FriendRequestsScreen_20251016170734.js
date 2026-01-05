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

export default function FriendRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const auth = getAuth();
  const { theme } = useTheme();
  const user = auth.currentUser;

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

    // Her iki kullanıcıyı friends listesine nesne olarak ekle
    await updateDoc(userRef, {
      friends: arrayUnion(friend),
      "friendRequests.receivedRequest": arrayRemove(friend),
    });

    const currentUserObj = {
      uid: user.uid,
      displayName: user.displayName,
      username: user.username,
      avatarIndex: 0, // Profil avatar indexini çekebilirsin
    };

    await updateDoc(friendRef, {
      friends: arrayUnion(currentUserObj),
      "friendRequests.sendRequest": arrayRemove(currentUserObj),
    });
  };

  const handleDecline = async (friend) => {
    const userRef = doc(db, "Users", user.uid);
    const friendRef = doc(db, "Users", friend.uid);

    const currentUserObj = {
      uid: user.uid,
      displayName: user.displayName,
      username: user.email.split("@")[0],
      avatarIndex: 0,
    };

    await updateDoc(userRef, {
      "friendRequests.receivedRequest": arrayRemove(friend),
    });

    await updateDoc(friendRef, {
      "friendRequests.sendRequest": arrayRemove(currentUserObj),
    });
  };

  const renderItem = ({ item }) => (
    <View style={[styles.requestItem, { backgroundColor: theme.secondary }]}>
      <View style={styles.userInfo}>
        <Image
          source={{
            uri: `https://example.com/avatars/${item.avatarIndex}.png`,
          }}
          style={styles.avatar}
        />
        <View>
          <Text style={[styles.name, { color: theme.text.primary }]}>
            {item.displayName}
          </Text>
          <Text style={[styles.username, { color: theme.text.secondary }]}>
            @{item.username}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity
          style={{ backgroundColor: "#30a75eff" }}
          onPress={() => handleAccept(item)}
        >
          <Text style={[styles.name, { color: theme.text.primary }]}>
            Kabul Et
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ backgroundColor: "#c44f4fff" }}
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
