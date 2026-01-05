import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../../firebase";
import { useProfileScreen } from "../../../context/ProfileScreenContext";
import { useTheme } from "../../../context/ThemeContext";
import SwipeCard from "../../../modules/SwipeCard";
import Toast from "react-native-toast-message";

export default function FriendsListScreen({ navigation }) {
  const [friends, setFriends] = useState([]);
  const auth = getAuth();
  const user = auth.currentUser;
  const { avatars } = useProfileScreen();
  const { theme } = useTheme();
  const [visibleFriendList, setVisibleFriendList] = useState([]);

  const [lists, setLists] = useState([]); // Firestore'dan gelen listeler

  const visibleFriendListFonk = (friend) => {
    //if (!friend) return;
    console.log(friend);
    const docRef = doc(db, "Lists", friend?.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setVisibleFriendList(Object.entries(docSnap.data() || {}));
      } else {
        setVisibleFriendList([]);
      }
    });
    return () => unsubscribe();
  };
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
      const userData = userSnap.data();
      const friendData = friendSnap.data();

      // 🔹 Kullanıcının arkadaş listesinden çıkar
      const updatedUserFriends = userData.friends.filter(
        (f) => f.uid !== friend.uid
      );
      await updateDoc(userRef, { friends: updatedUserFriends });

      // 🔹 Arkadaşın listesinden de çıkar
      const updatedFriendFriends = friendData.friends.filter(
        (f) => f.uid !== user.uid
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
        onPress={() => {
          visibleFriendListFonk(item);
        }}
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
      {true && (
        <FlatList
          data={[
            ...protectedLists
              .map((name) => lists.find(([listName]) => listName === name))
              .filter(Boolean),
            ...lists
              .filter(([listName]) => !protectedLists.includes(listName))
              .sort((a, b) => a[0].localeCompare(b[0])),
          ]}
          keyExtractor={([listName]) => listName}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15, gap: 10 }}
          renderItem={({ visibleFriendList }) => {
            const [listName, items] = item;
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPressIn={() => onPressIn(listName)} // Add arrow function
                onPressOut={() => onPressOut(listName)} // Add arrow function
                onPress={() => {
                  navigation.navigate("ListsScreen", { listName });
                }}
                onLongPress={() => {
                  if (!protectedLists.includes(listName)) {
                    setSelectedList(listName);
                    setModalDeleteVisible(true);
                  }
                }}
              >
                <Animated.View
                  style={[
                    styles.listContainer,
                    {
                      backgroundColor: theme.secondary,
                      borderColor: theme.border,
                      transform: [{ scale: scaleValues[listName] || 1 }],
                    },
                  ]}
                >
                  {gridStyle ? (
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 2,
                      }}
                    >
                      {[0, 1, 2].map((index) => {
                        const item = items && items[index];
                        if (item && item.imagePath) {
                          return (
                            <Image
                              key={index}
                              source={{
                                uri: `https://image.tmdb.org/t/p/w500${item.imagePath}`,
                              }}
                              style={[
                                styles.image,
                                { width: 50, height: 100 },
                                index === 0
                                  ? {
                                      borderTopLeftRadius: 10,
                                      borderBottomLeftRadius: 10,
                                    }
                                  : index === 1
                                    ? {}
                                    : {
                                        borderTopRightRadius: 10,
                                        borderBottomRightRadius: 10,
                                      },
                              ]}
                            />
                          );
                        } else {
                          return (
                            <View
                              key={index}
                              style={[
                                styles.placeholder,
                                { width: 50, height: 100 },

                                index === 0
                                  ? {
                                      borderTopLeftRadius: 10,
                                      borderBottomLeftRadius: 10,
                                    }
                                  : index === 1
                                    ? {}
                                    : {
                                        borderTopRightRadius: 10,
                                        borderBottomRightRadius: 10,
                                      },
                                { backgroundColor: theme.primary },
                              ]}
                            />
                          );
                        }
                      })}
                    </View>
                  ) : (
                    <>
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 2,
                        }}
                      >
                        {[0, 1, 2, 3].map((index) => {
                          const item = items && items[index];
                          if (item && item.imagePath) {
                            return (
                              <Image
                                key={index}
                                source={{
                                  uri: `https://image.tmdb.org/t/p/w500${item.imagePath}`,
                                }}
                                style={[
                                  styles.image,
                                  index === 0
                                    ? {
                                        borderTopLeftRadius: 10,
                                        borderBottomLeftRadius: gridStyle
                                          ? 10
                                          : 0,
                                      }
                                    : index === 3
                                      ? {
                                          borderTopRightRadius: 10,
                                          borderBottomRightRadius: gridStyle
                                            ? 10
                                            : 0,
                                        }
                                      : {},
                                ]}
                              />
                            );
                          } else {
                            return (
                              <View
                                key={index}
                                style={[
                                  styles.placeholder,
                                  index === 0
                                    ? {
                                        borderTopLeftRadius: 10,
                                        borderBottomLeftRadius: gridStyle
                                          ? 10
                                          : 0,
                                      }
                                    : index === 3
                                      ? {
                                          borderTopRightRadius: 10,
                                          borderBottomRightRadius: gridStyle
                                            ? 10
                                            : 0,
                                        }
                                      : {},
                                  { backgroundColor: theme.primary },
                                ]}
                              />
                            );
                          }
                        })}
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          gap: 2,
                        }}
                      >
                        {[4, 5, 6, 7].map((index) => {
                          const item = items && items[index];
                          if (item && item.imagePath) {
                            return (
                              <Image
                                key={index}
                                source={{
                                  uri: `https://image.tmdb.org/t/p/w500${item.imagePath}`,
                                }}
                                style={[
                                  styles.image,
                                  index === 4
                                    ? {
                                        borderTopLeftRadius: gridStyle ? 10 : 0,
                                        borderBottomLeftRadius: 10,
                                      }
                                    : index === 7
                                      ? {
                                          borderTopRightRadius: gridStyle
                                            ? 10
                                            : 0,
                                          borderBottomRightRadius: 10,
                                        }
                                      : {},
                                ]}
                              />
                            );
                          } else {
                            return (
                              <View
                                key={index}
                                style={[
                                  styles.placeholder,
                                  index === 4
                                    ? {
                                        borderTopLeftRadius: gridStyle ? 10 : 0,
                                        borderBottomLeftRadius: 10,
                                      }
                                    : index === 7
                                      ? {
                                          borderTopRightRadius: gridStyle
                                            ? 10
                                            : 0,
                                          borderBottomRightRadius: 10,
                                        }
                                      : {},
                                  { backgroundColor: theme.primary },
                                ]}
                              />
                            );
                          }
                        })}
                      </View>
                    </>
                  )}

                  <View
                    style={{
                      flex: 1,
                      width: "100%",
                      maxWidth: 140,
                      marginTop: 3,
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {listName === "watchedMovies" ? (
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <MaterialCommunityIcons
                          name="movie-outline"
                          size={16}
                          color={theme.colors.green}
                        />
                        <Text style={{ color: theme.text.primary }}>
                          {"  "}
                          {t.profileScreen.ProfileLists.watchedMovies}
                        </Text>
                      </View>
                    ) : listName === "watchedTv" ? (
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Feather
                          name="tv"
                          size={15}
                          color={theme.colors.green}
                        />
                        <Text style={{ color: theme.text.primary }}>
                          {"  "}
                          {t.profileScreen.ProfileLists.watchedTvSeries}
                        </Text>
                      </View>
                    ) : listName === "favorites" ? (
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Ionicons
                          name="heart"
                          size={16}
                          color={theme.colors.red}
                        />
                        <Text style={{ color: theme.text.primary }}>
                          {"  "}
                          {t.profileScreen.ProfileLists.favorite}
                        </Text>
                      </View>
                    ) : listName === "watchList" ? (
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Ionicons
                          name="bookmark"
                          size={16}
                          color={theme.colors.blue}
                        />
                        <Text style={{ color: theme.text.primary }}>
                          {"  "}
                          {t.profileScreen.ProfileLists.watchList}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        <Ionicons
                          name="grid"
                          size={16}
                          color={theme.colors.orange}
                        />
                        <Text
                          style={{ color: theme.text.primary }}
                          numberOfLines={1}
                        >
                          {" "}
                          {listName}
                        </Text>
                      </View>
                    )}
                  </View>
                </Animated.View>
              </TouchableOpacity>
            );
          }}
        />
      )}
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
});
