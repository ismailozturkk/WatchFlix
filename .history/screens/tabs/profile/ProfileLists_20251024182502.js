import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Modal,
  Animated,
} from "react-native";
import React, { useEffect, useState } from "react";
import { useLanguage } from "../../../context/LanguageContext";
import { useTheme } from "../../../context/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ListsSkeleton } from "../../../components/Skeleton";
import { LinearGradient } from "expo-linear-gradient";
import { useProfileScreen } from "../../../context/ProfileScreenContext";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
export default function ProfileLists({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const {
    lists,
    isLoadingLists,
    selectedList,
    setSelectedList,
    modalDeleteVisible,
    setModalDeleteVisible,
    deleteList,
    gridStyle,
    setGridStyle,
    saveListGridStyle,
  } = useProfileScreen();
  // ...existing code...
  const [scaleValues, setScaleValues] = useState({});

  useEffect(() => {
    const newScaleValues = {};
    lists.forEach((list) => {
      newScaleValues[list[0]] = new Animated.Value(1);
    });
    setScaleValues(newScaleValues);
  }, [lists]);

  const onPressIn = (listName) => {
    Animated.timing(scaleValues[listName], {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (listName) => {
    Animated.timing(scaleValues[listName], {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };
  const protectedLists = [
    "watchedTv",
    "watchedMovies",
    "watchList",
    "favorites",
  ];

  return (
    <View style={styles.section}>
      <View style={styles.container}>
        <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
          {t.profileScreen.ProfileLists.lists}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
            onPress={() => {
              saveListGridStyle(!gridStyle);
            }}
          >
            <MaterialCommunityIcons
              name={gridStyle ? "grid-large" : "grid"}
              size={18}
              color="white"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
            onPress={() => {
              navigation.navigate("ListsViewScreen");
            }}
          >
            <Ionicons name="arrow-forward-outline" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
      {isLoadingLists ? (
        <ListsSkeleton />
      ) : (
        <View style={styles.sectionView}>
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
            renderItem={({ item }) => {
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
                                          borderTopLeftRadius: gridStyle
                                            ? 10
                                            : 0,
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
                                          borderTopLeftRadius: gridStyle
                                            ? 10
                                            : 0,
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
                          <TouchableOpacity>
                            <Ionicons
                              name="eye"
                              size={20}
                              color={theme.colors.green}
                            />
                          </TouchableOpacity>
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
                          <TouchableOpacity>
                            <Ionicons
                              name="eye"
                              size={20}
                              color={theme.colors.green}
                            />
                          </TouchableOpacity>
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
                          <TouchableOpacity>
                            <Ionicons
                              name="eye"
                              size={20}
                              color={theme.colors.green}
                            />
                          </TouchableOpacity>
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
                          <TouchableOpacity>
                            <Ionicons
                              name="eye"
                              size={20}
                              color={theme.colors.green}
                            />
                          </TouchableOpacity>
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
                            width: "100%",
                            maxWidth: 150,
                          }}
                        >
                          <TouchableOpacity>
                            <Ionicons
                              name="eye"
                              size={20}
                              color={theme.colors.green}
                            />
                          </TouchableOpacity>
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
        </View>
      )}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalDeleteVisible}
        onRequestClose={() => setModalDeleteVisible(false)}
      >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={["transparent", theme.shadow, "transparent"]}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
              zIndex: 0,
            }}
          />
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setModalDeleteVisible(false)}
          />
          <View style={[styles.modalView, { backgroundColor: theme.primary }]}>
            <Text style={[styles.modalText, { color: theme.text.primary }]}>
              "{selectedList}" listesini silmek istiyor musunuz?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonCancel]}
                onPress={() => setModalDeleteVisible(false)}
              >
                <Text style={styles.textStyle}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonConfirm]}
                onPress={deleteList}
              >
                <Text style={styles.textStyle}>{t.confirm}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: "100%" },
  sectionTitle: {
    fontSize: 14,
    textTransform: "uppercase",
  },
  listContainer: {
    padding: 7,
    alignItems: "center",
    borderRadius: 15,
    marginBottom: 10,
    gap: 2,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  image: { width: 37.5, height: 55 },
  placeholder: { width: 37.5, height: 55 },
  sectionView: {
    justifyContent: "center",
    alignItems: "center",
    minHeight: 140,
  },
  container: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 10,
  },
  addButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalBackdrop: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  modalView: { padding: 20, borderRadius: 10, alignItems: "center" },
  modalButtons: { flexDirection: "row", marginTop: 10 },
  button: { padding: 10, marginHorizontal: 5, borderRadius: 5 },

  buttonCancel: {
    backgroundColor: "#f44336",
  },
  buttonConfirm: {
    backgroundColor: "#4CAF50",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
});
