import React, { useState } from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { collection, query, where, getDocs } from "firebase/firestore";
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

    // Kullanıcının outgoing listesine ekle
    await updateDoc(currentUserRef, {
      "friendRequests.sendRequest": arrayUnion(friendUid),
    });

    // Karşı kullanıcının incoming listesine ekle
    await updateDoc(friendRef, {
      "friendRequests.receivedRequest": arrayUnion(currentUser.uid),
    });

    alert("Arkadaşlık isteği gönderildi!");
  };

  const renderItem = ({ item }) => (
    <View style={styles.userItem}>
      <Text>{item.displayName || item.username}</Text>
      <TouchableOpacity onPress={() => sendFriendRequest(item.uid)}>
        <Text style={styles.addBtn}>Ekle</Text>
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 40, padding: 16 },
  input: { borderWidth: 1, padding: 8, marginBottom: 12, borderRadius: 8 },
  userItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  addBtn: { color: "blue" },
});
