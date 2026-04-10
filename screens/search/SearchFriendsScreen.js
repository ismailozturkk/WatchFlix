import React, { useState, useEffect, useCallback } from "react";
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
import IconBacground from "../../components/IconBacground";
import { SafeAreaView } from "react-native-safe-area-context";
export default function SearchFriendsScreen() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const auth = getAuth();
  const { theme } = useTheme();
  const currentUser = auth.currentUser;

  // Arama için Debouncing (gecikme) ekleyelim
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm.trim()) {
        handleSearch(searchTerm.trim());
      } else {
        setResults([]); // Arama terimi boşsa sonuçları temizle
      }
    }, 500); // Kullanıcı yazmayı bıraktıktan 500ms sonra ara

    return () => {
      clearTimeout(handler); // Her tuş vuruşunda önceki zamanlayıcıyı temizle
    };
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
    },
    [currentUser],
  );

  const sendFriendRequest = async (friend) => {
    const friendRef = doc(db, "Users", friend.uid);
    const currentUserRef = doc(db, "Users", currentUser.uid);

    // currentUser verisini tekrar çekmek yerine Auth context'ten veya state'ten alabiliriz.
    // Şimdilik basitleştirmek için direkt auth objesini kullanalım.
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
      {
        friendRequests: {
          sendRequest: arrayUnion(receivedObj),
        },
      },
      { merge: true },
    );

    await setDoc(
      friendRef,
      {
        friendRequests: {
          receivedRequest: arrayUnion(requestObj),
        },
      },
      { merge: true },
    );

    // Arayüzü veritabanı sorgusu yapmadan güncelle
    setResults((prevResults) =>
      prevResults.map((user) =>
        user.uid === friend.uid ? { ...user, requestSent: true } : user,
      ),
    );
  };

  const handleCancelSent = async (friend) => {
    const userRef = doc(db, "Users", currentUser.uid);
    const friendRef = doc(db, "Users", friend.uid);

    // Veriyi tekrar çekmek yerine filter kullanmak daha verimli.
    // Ancak arrayRemove gibi bir operatör olmadığı için, önce dokümanı okumalıyız.
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

    // Arayüzü veritabanı sorgusu yapmadan güncelle
    setResults((prevResults) =>
      prevResults.map((user) =>
        user.uid === friend.uid ? { ...user, requestSent: false } : user,
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
      Toast.show({
        type: "success",
        text1: `${friend.displayName} arkadaş listenizden silindi`,
      });
      const userData = userSnap.data();
      const friendData = friendSnap.data();

      // 🔹 Kullanıcının arkadaş listesinden çıkar
      const updatedUserFriends = userData.friends.filter(
        (f) => f.uid !== friend.uid,
      );
      await updateDoc(userRef, { friends: updatedUserFriends });

      // 🔹 Arkadaşın listesinden de çıkar
      const updatedFriendFriends = friendData.friends.filter(
        (f) => f.uid !== currentUser.uid,
      );
      await updateDoc(friendRef, { friends: updatedFriendFriends });
    } catch (error) {
      console.error("Arkadaş silme hatası:", error);
      Toast.show({
        type: "error",
        text1: "Silme işlemi başarısız",
        text2: error.message,
      });
    }
  };
  const renderItem = ({ item }) => (
    <SwipeCard
      rightButton={
        item.requestSent
          ? {
              label: "Geri al",
              color: "#e56d35ff",
              onPress: () => handleCancelSent(item),
            }
          : item.alreadyFriend
            ? {
                label: "Sil",
                color: "#fa3232ff",
                onPress: () => handleDelete(item),
              }
            : {
                label: "istek",
                color: "#30a75e",
                onPress: () => sendFriendRequest(item),
              }
      }
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
          <Text
            allowFontScaling={false}
            style={[styles.name, { color: theme.text.primary }]}
          >
            {item.displayName}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.name, { color: theme.text.secondary }]}
          >
            @{item.username}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.email, { color: theme.text.muted }]}
          >
            {item.email}
          </Text>
        </View>

        {item.alreadyFriend ? (
          <Text
            allowFontScaling={false}
            style={{ color: "#70ffb0ff", fontWeight: "600" }}
          >
            Arkadaş
          </Text>
        ) : item.requestSent ? (
          <Text
            allowFontScaling={false}
            style={{ color: "#ff9650ff", fontWeight: "600" }}
          >
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      <IconBacground opacity={0.3} />
      <Text
        style={{
          color: theme.text.primary,
          fontSize: 24,
          textAlign: "center",
          fontWeight: 900,
          marginBottom: 10,
        }}
      >
        Arkadaşları Ara
      </Text>
      <TextInput
        placeholder="Kullanıcı ara..."
        placeholderTextColor={theme.text.secondary}
        onChangeText={setSearchTerm}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    paddingTop: 10,
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
