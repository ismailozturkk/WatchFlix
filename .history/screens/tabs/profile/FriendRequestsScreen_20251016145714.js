import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../firebase";
import { getAuth } from "firebase/auth";

export default function FriendRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const auth = getAuth();
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

  const handleAccept = async (friendUid) => {
    const userRef = doc(db, "Users", user.uid);
    const friendRef = doc(db, "Users", friendUid);

    // Her iki kullanıcıyı friends listesine ekle
    await updateDoc(userRef, {
      friends: arrayUnion(friendUid),
      "friendRequests.receivedRequest": arrayRemove(friendUid),
    });
    await updateDoc(friendRef, {
      friends: arrayUnion(user.uid),
      "friendRequests.sendRequest": arrayRemove(user.uid),
    });
  };

  const handleDecline = async (friendUid) => {
    const userRef = doc(db, "Users", user.uid);
    const friendRef = doc(db, "Users", friendUid);

    await updateDoc(userRef, {
      "friendRequests.receivedRequest": arrayRemove(friendUid),
    });
    await updateDoc(friendRef, {
      "friendRequests.sendRequest": arrayRemove(user.uid),
    });
  };

  const renderItem = ({ item }) => (
    <View style={styles.requestItem}>
      <Text>{item}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity onPress={() => handleAccept(item)}>
          <Text style={styles.acceptBtn}>Kabul Et</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDecline(item)}>
          <Text style={styles.declineBtn}>Reddet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {requests.length === 0 ? (
        <Text>Gelen arkadaşlık isteği yok.</Text>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  requestItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  acceptBtn: { color: "green" },
  declineBtn: { color: "red" },
});
