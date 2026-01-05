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
import { useProfileScreen } from "../../../context/ProfileScreenContext";
import { useTheme } from "../../../context/ThemeContext";
import SwipeCard from "../../../modules/SwipeCard";

export default function FriendsListScreen({ navigation }) {
  const [friends, setFriends] = useState([]);
  const auth = getAuth();
  const user = auth.currentUser;
  const { avatars } = useProfileScreen();
  const { theme } = useTheme();
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

  const handleSendMessage = (friend) => {
    navigation.navigate("ChatScreen", {
      friendUid: friend.uid,
      friendName: friend.displayName,
    });
  };
  //console.log(avatars[0]);
  const renderFriend = ({ item }) => (
    <SwipeCard
      leftButton={{
        label: "Sil",
        color: "#e53935",
        onPress: () => handleDelete(post),
      }}
      rightButton={{
        label: "Mesaj",
        color: "#5aacf0ff",
        onPress: () => handleMessage(post),
      }}
    >
      <View style={[styles.friendItem, { backgroundColor: theme.secondary }]}>
        <View style={styles.userInfo}>
          <Image source={avatars[item.avatarIndex]} style={styles.avatar} />
          <View>
            <Text style={[styles.name, { color: theme.text.primary }]}>
              {item.displayName}
            </Text>
            <Text style={[styles.username, { color: theme.text.secondary }]}>
              @{item.username}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.messageBtn, { backgroundColor: theme.accent }]}
          onPress={() => handleSendMessage(item)}
        >
          <Text style={[styles.messageBtnText, { color: theme.text.primary }]}>
            Mesaj Gönder
          </Text>
        </TouchableOpacity>
      </View>
    </SwipeCard>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      {friends.length === 0 ? (
        <Text>Henüz arkadaşınız yok.</Text>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.uid}
          renderItem={renderFriend}
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
    paddingTop: 80,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  name: { fontSize: 16, fontWeight: "600" },
  username: { fontSize: 14, color: "#666" },
  messageBtn: {
    backgroundColor: "#4a90e2",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  messageBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
