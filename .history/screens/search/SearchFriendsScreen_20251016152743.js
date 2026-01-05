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
    querySnapshot.forEach((doc) => {
      if (doc.id !== currentUser.uid)
        users.push({ uid: doc.id, ...doc.data() });
    });
    setResults(users);
  };

  const sendFriendRequest = async (friendUid) => {
    const friendRef = doc(db, "Users", friendUid);
    const currentUserRef = doc(db, "Users", currentUser.uid);

    await updateDoc(currentUserRef, {
      "friendRequests.sendRequest": arrayUnion(friendUid),
    });

    await updateDoc(friendRef, {
      "friendRequests.receivedRequest": arrayUnion(currentUser.uid),
    });

    alert("Arkadaşlık isteği gönderildi!");
  };

  const renderItem = ({ item }) => (
    <View style={styles.userItem}>
      <View style={styles.userInfo}>
        <Text style={styles.name}>{item.displayName || item.username}</Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => sendFriendRequest(item.uid)}
      >
        <Text style={styles.addBtnText}>Ekle</Text>
      </TouchableOpacity>
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
  container: { flex: 1, padding: 16, backgroundColor: "#f9f9f9" },
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
