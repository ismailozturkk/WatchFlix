import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { doc, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../../firebase";

export default function FriendsListScreen({ navigation }) {
  const [friends, setFriends] = useState([]);
  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, "Users", user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFriends(data.friends || []);
      }
    });
    return () => unsubscribe();
  }, []);

  const renderFriend = ({ item }) => (
    <TouchableOpacity
      style={styles.friendItem}
      key={item}
      onPress={() =>
        navigation.navigate("ChatScreen", {
          friendUid: item.uid,
          friendName: item.displayName,
        })
      }
    >
      <Image
        source={{ uri: item.avatar || "https://via.placeholder.com/50" }}
        style={styles.avatar}
      />
      <Text style={styles.name}>{item}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.container}>
      {friends.length === 0 ? (
        <Text>Henüz arkadaşınız yok.</Text>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.uid}
          renderItem={renderFriend}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, marginTop: 70 },
  friendItem: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  name: { fontSize: 16 },
});
