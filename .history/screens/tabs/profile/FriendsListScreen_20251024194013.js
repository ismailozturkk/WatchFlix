import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayRemove,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../../firebase";
import { useProfileScreen } from "../../../context/ProfileScreenContext";
import { useTheme } from "../../../context/ThemeContext";
import SwipeCard from "../../../modules/SwipeCard";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../../context/LanguageContext";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function FriendsListScreen({ navigation }) {
  const [friends, setFriends] = useState([]);
  const auth = getAuth();
  const user = auth.currentUser;
  const { avatars, lists, gridStyle } = useProfileScreen(); // ProfileScreen context'inden listeleri alalım
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [selectedFriend, setSelectedFriend] = useState(null); // Hangi arkadaşın listelerinin gösterileceğini tutar
  const [friendLists, setFriendLists] = useState([]); // Seçilen arkadaşın listelerini tutar

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
  }, [user]);
  useEffect(() => {
    console.log("selectedFriend:", selectedFriend);
    console.log("friendLists:", friendLists);
  }, [selectedFriend, friendLists]);

  // Seçili arkadaş değiştiğinde listelerini çek
  // Seçili arkadaş değiştiğinde listelerini çek
  useEffect(() => {
    if (!selectedFriend) {
      setFriendLists([]);
      return;
    }

    const userRef = doc(db, "Users", selectedFriend.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const friendData = docSnap.data();

        // listVisible arrayi map’ler halinde
        const visibleLists = friendData.listVisible?.filter(
          (mapItem) => Object.values(mapItem)[0] === true
        );

        const visibleListNames = visibleLists?.map(
          (mapItem) => Object.keys(mapItem)[0]
        );

        // Tüm listeleri al
        const allLists = Object.entries(friendData || {});

        // sadece visible olanları filtrele
        const filteredLists = allLists.filter(([listName]) =>
          visibleListNames?.includes(listName)
        );

        setFriendLists(filteredLists);
      } else {
        setFriendLists([]);
      }
    });

    return () => unsubscribe();
  }, [selectedFriend]);
  console.log("friendLists:", friendLists);
  const handleSendMessage = (friend) => {
    navigation.navigate("ChatScreen", {
      friendUid: friend.uid,
      friendName: friend.displayName,
    });
  };

  const handleDelete = async (friend) => {
    try {
      const userRef = doc(db, "Users", user.uid);
      const friendRef = doc(db, "Users", friend.uid);

      const userSnap = await getDoc(userRef);
      const friendSnap = await getDoc(friendRef);

      if (!userSnap.exists() || !friendSnap.exists()) return;

      Toast.show({
        type: "success",
        text1: `${friend.displayName} arkadaş listenizden silindi`,
      });

      // 🔹 Kullanıcının arkadaş listesinden çıkar
      await updateDoc(userRef, {
        friends: arrayRemove(friend),
      });

      // 🔹 Arkadaşın listesinden de çıkar
      const currentUserDataForFriend = friendSnap
        .data()
        .friends.find((f) => f.uid === user.uid);
      if (currentUserDataForFriend) {
        await updateDoc(friendRef, {
          friends: arrayRemove(currentUserDataForFriend),
        });
      }
    } catch (error) {
      console.error("Arkadaş silme hatası:", error);
      Toast.show({
        type: "error",
        text1: "Silme işlemi başarısız",
        text2: error.message,
      });
    }
  };

  const protectedLists = [
    "watchedTv",
    "watchedMovies",
    "watchList",
    "favorites",
  ];
  const renderFriend = ({ item }) => (
    <SwipeCard
      leftButton={{
        label: "Sil",
        color: "#e53935",
        onPress: () => handleDelete(item),
      }}
      rightButton={{
        label: "Mesaj",
        color: "#5aacf0ff",
        onPress: () => handleSendMessage(item),
      }}
    >
      <TouchableOpacity
        onPress={() =>
          setSelectedFriend(selectedFriend?.uid === item.uid ? null : item)
        }
        style={[styles.friendItem, { backgroundColor: theme.secondary }]}
      >
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
      </TouchableOpacity>

      {selectedFriend?.uid === item.uid && (
        <FlatList
          data={[
            ...protectedLists
              .map((name) =>
                friendLists.find(([listName]) => listName === name)
              )
              .filter(Boolean),
            ...friendLists
              .filter(([listName]) => !protectedLists.includes(listName))
              .sort((a, b) => a[0].localeCompare(b[0])),
          ]}
          keyExtractor={([listName]) => listName}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
          renderItem={({ item: listItem }) => {
            const [listName, items] = listItem;

            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  console.log("Navigate to friend's list:", listName)
                }
              >
                <View
                  style={[
                    styles.listContainer,
                    {
                      backgroundColor: theme.secondary,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  {/* Grid style */}
                  <View style={{ flexDirection: "row" }}>
                    {(gridStyle ? [0, 1] : [0, 1, 2, 3]).map((index) => {
                      const contentItem = items && items[index];
                      if (contentItem && contentItem.imagePath) {
                        return (
                          <Image
                            key={index}
                            source={{
                              uri: `https://image.tmdb.org/t/p/w500${contentItem.imagePath}`,
                            }}
                            style={[
                              styles.listImage,
                              {
                                width: gridStyle ? 40 : 20,
                                height: gridStyle ? 60 : 30,
                              },
                            ]}
                          />
                        );
                      }
                      return (
                        <View
                          key={index}
                          style={[
                            styles.placeholder,
                            {
                              width: gridStyle ? 40 : 20,
                              height: gridStyle ? 60 : 30,
                              backgroundColor: theme.primary,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>

                  {/* List label */}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      marginTop: 3,
                    }}
                  >
                    {listName === "watchedMovies" && (
                      <>
                        <MaterialCommunityIcons
                          name="movie-outline"
                          size={16}
                          color={theme.colors.green}
                        />
                        <Text style={{ color: theme.text.primary }}>
                          İzlenen Filmler
                        </Text>
                      </>
                    )}
                    {listName === "watchedTv" && (
                      <>
                        <Feather
                          name="tv"
                          size={15}
                          color={theme.colors.green}
                        />
                        <Text style={{ color: theme.text.primary }}>
                          İzlenen Diziler
                        </Text>
                      </>
                    )}
                    {listName === "favorites" && (
                      <>
                        <Ionicons
                          name="heart"
                          size={16}
                          color={theme.colors.red}
                        />
                        <Text style={{ color: theme.text.primary }}>
                          Favoriler
                        </Text>
                      </>
                    )}
                    {listName === "watchList" && (
                      <>
                        <Ionicons
                          name="bookmark"
                          size={16}
                          color={theme.colors.blue}
                        />
                        <Text style={{ color: theme.text.primary }}>
                          İzlenecekler
                        </Text>
                      </>
                    )}
                    {![
                      "watchedMovies",
                      "watchedTv",
                      "favorites",
                      "watchList",
                    ].includes(listName) && (
                      <>
                        <Ionicons
                          name="grid"
                          size={16}
                          color={theme.colors.orange}
                        />
                        <Text
                          style={{ color: theme.text.primary, fontSize: 10 }}
                          numberOfLines={1}
                        >
                          {listName}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SwipeCard>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      {friends.length === 0 && !user ? (
        <Text>Henüz arkadaşınız yok.</Text>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.uid}
          renderItem={renderFriend}
          contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 15 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 15,
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
  listContainer: {
    padding: 7,
    alignItems: "center",
    borderRadius: 15,
    gap: 2,
    borderWidth: 1,
  },
  listImage: {
    width: 40,
    height: 60,
  },
  placeholder: {
    width: 40,
    height: 60,
  },
});
