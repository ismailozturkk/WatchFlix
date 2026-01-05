import React, { useState } from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
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
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase";

export default function SearchFriendsScreen() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const handleSearch = async () => {
    if (!search) return;
    const usersRef = collection(db, "Users");
    const q = query(
      usersRef,
      where("username", ">=", search),
      where("username", "<=", search + "\uf8ff")
    );

    const querySnapshot = await getDocs(q);
    const users = [];

    const currentUserRef = doc(db, "Users", currentUser.uid);
    const currentUserSnap = await getDoc(currentUserRef); // ✅ doğru
    const currentUserData = currentUserSnap.data(); // ✅ doğru

    const friends = currentUserData.friends || [];
    const sendRequests = currentUserData.friendRequests?.sendRequest || [];

    querySnapshot.forEach((doc) => {
      if (doc.id !== currentUser.uid) {
        const userData = { uid: doc.id, ...doc.data() };
        const alreadyFriend = friends.some((f) => f.uid === doc.id);
        const requestSent = sendRequests.some((r) => r.uid === doc.id);

        users.push({
          ...userData,
          alreadyFriend,
          requestSent,
        });
      }
    });

    setResults(users);
  };

  const sendFriendRequest = async (friend) => {
    const friendRef = doc(db, "Users", friend.uid);
    const currentUserRef = doc(db, "Users", currentUser.uid);
    console.log(currentUser);
    // Gönderilen arkadaşlık isteğini nesne olarak ekle
    const requestObj = {
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      username: currentUser.username,
      avatarIndex: 0, // avatar indexi, senin sistemine göre ayarlayabilirsin
    };

    const receivedObj = {
      uid: friend.uid,
      displayName: friend.displayName,
      username: friend.username,
      avatarIndex: friend.avatarIndex || 0,
    };

    // Kullanıcının outgoing listesine ekle
    await updateDoc(currentUserRef, {
      "friendRequests.sendRequest": arrayUnion(receivedObj),
    });

    // Karşı kullanıcının incoming listesine ekle
    await updateDoc(friendRef, {
      "friendRequests.receivedRequest": arrayUnion(requestObj),
    });

    alert("Arkadaşlık isteği gönderildi!");
  };

  const renderItem = ({ item }) => (
    <View style={styles.userItem}>
      <View style={styles.userInfo}>
        <Text style={styles.name}>{item.displayName}</Text>
        <Text style={styles.name}>@{item.username}</Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>

      {item.alreadyFriend ? (
        <Text style={{ color: "green", fontWeight: "600" }}>Arkadaş</Text>
      ) : item.requestSent ? (
        <Text style={{ color: "#999", fontWeight: "600" }}>
          İstek Gönderildi
        </Text>
      ) : (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => sendFriendRequest(item)}
        >
          <Text style={styles.addBtnText}>Ekle</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Kullanıcı ara..."
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={handleSearch}
        style={styles.input}
      />
      <FlatList
        data={results}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f9f9f9",
    marginTop: 70,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  userItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  email: { fontSize: 14, color: "#666" },
  addBtn: {
    backgroundColor: "#4a90e2",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
