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
  setDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase";
import { useTheme } from "../../context/ThemeContext";
import SwipeCard from "../../modules/SwipeCard";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
export default function SearchFriendsScreen() {
  const [search, setSearch] = useState("");
  const [sendRequest, setSendRequest] = useState(false);
  const [results, setResults] = useState([]);
  const auth = getAuth();
  const { theme } = useTheme();
  const currentUser = auth.currentUser;

  const handleSearch = async (search) => {
    if (!search) return;
    setSearch(search);
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

    const currentUserSnap = await getDoc(currentUserRef);
    const currentUserData = currentUserSnap.data();

    if (!currentUserData) {
      alert("Profil verisi bulunamadı.");
      return;
    }
    setSendRequest(true);
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

    console.log("Gönderilen veri:", requestObj);
    console.log("Karşı tarafa gidecek veri:", receivedObj);

    await setDoc(
      currentUserRef,
      {
        friendRequests: {
          sendRequest: arrayUnion(receivedObj),
        },
      },
      { merge: true }
    );

    await setDoc(
      friendRef,
      {
        friendRequests: {
          receivedRequest: arrayUnion(requestObj),
        },
      },
      { merge: true }
    );
    handleSearch(search);
  };

  const renderItem = ({ item }) => (
    <SwipeCard
      rightButton={{
        label: "istek",
        color: "#30a75e",
        onPress: () => sendFriendRequest(item),
      }}
    >
      <View
        style={[
          styles.userItem,
          item.alreadyFriend
            ? { borderColor: "#70ffb0ff" }
            : item.requestSent
              ? { borderColor: "#ff9650ff" }
              : { borderColor: theme.border },
          { backgroundColor: theme.secondary },
        ]}
      >
        <View style={styles.userInfo}>
          <Text style={[styles.name, { color: theme.text.primary }]}>
            {item.displayName}
          </Text>
          <Text style={[styles.name, { color: theme.text.secondary }]}>
            @{item.username}
          </Text>
          <Text style={[styles.email, { color: theme.text.muted }]}>
            {item.email}
          </Text>
        </View>

        {item.alreadyFriend ? (
          <Text style={{ color: "green", fontWeight: "600" }}>Arkadaş</Text>
        ) : item.requestSent ? (
          <Text style={{ color: "orange", fontWeight: "600" }}>
            İstek Gönderildi
          </Text>
        ) : (
          <MaterialCommunityIcons
            name="arrow-left-thin"
            size={24}
            color={"#70baffff"}
          />
        )}
      </View>
    </SwipeCard>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <TextInput
        placeholder="Kullanıcı ara..."
        placeholderTextColor={theme.text.secondary}
        onChangeText={handleSearch}
        autoCapitalize="none"
        style={[
          styles.input,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            color: theme.text.primary,
            marginHorizontal: 15,
          },
        ]}
      />
      <FlatList
        data={results}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 15 }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    paddingTop: 80,
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
    borderWidth: 1,
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
