import React, { useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  Modal,
  Text,
  StyleSheet,
  FlatList,
  Animated,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "../context/ThemeContext";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { LinearGradient } from "expo-linear-gradient";
import Entypo from "@expo/vector-icons/Entypo";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLanguage } from "../context/LanguageContext";
import LottieView from "lottie-react-native";

const ListViewTv = ({
  updateList,
  type,
  navigation,
  openModal,
  addShowToFirestore,
  isSeasonWatched,
  listStates,
  isLoading,
}) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [otherLists, setOtherLists] = useState();
  const [fullLists, setFullLists] = useState();
  const trueCount = otherLists?.filter((list) => listStates[list]).length; //! other list var ise değilde other listin içerisinde var ise görünümleri değiştir

  const [scaleValues, setScaleValues] = useState({});
  useEffect(() => {
    const newScaleValues = {};
    // otherLists dizisinde tüm liste isimleri var
    (fullLists || []).forEach((listName) => {
      newScaleValues[listName] = new Animated.Value(1);
    });
    setScaleValues(newScaleValues);
  }, [fullLists]);
  const onPressIn = (listName) => {
    if (!scaleValues[listName]) return;

    Animated.spring(scaleValues[listName], {
      toValue: 0.8,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start(() => {});
  };

  const onPressOut = (listName) => {
    if (!scaleValues[listName]) return;
    Animated.spring(scaleValues[listName], {
      toValue: 1,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const OtherLists = () => {
    const docRef = doc(db, "Lists", user.uid);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        // 4 özel liste
        const predefinedLists = [
          "watchedTv",
          "favorites",
          "watchList",
          "watchedMovies",
        ];
        setFullLists(Object.keys(data));
        // Dinamik olarak diğer listeleri bul
        const otherLists = Object.keys(data).filter(
          (list) => !predefinedLists.includes(list)
        );

        setOtherLists(otherLists);
      } else {
        console.log("Belge bulunamadı.");
        setModalVisible(false); // Eğer belge bulunmazsa modal'ı kapat
      }
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  };

  useEffect(() => {
    const unsubscribe = OtherLists();
    return () => unsubscribe(); // Cleanup on unmount
  }, [user]);
  return (
    <View
      style={[
        styles.stats,
        { backgroundColor: theme.secondary, shadowColor: theme.shadow },
      ]}
    >
      <TouchableOpacity
        onPressIn={() => onPressIn("watchList")}
        onPressOut={() => onPressOut("watchList")}
        onPress={() => {
          updateList("watchList", type);
        }}
      >
        <Animated.View
          style={[
            {
              transform: [{ scale: scaleValues["watchList"] || 1 }],
            },
          ]}
        >
          {listStates["watchList"] ? (
            <Ionicons name="bookmark" size={32} color={theme.colors.blue} />
          ) : (
            <Ionicons
              name="bookmark-outline"
              size={32}
              color={theme.text.secondary}
            />
          )}
        </Animated.View>
      </TouchableOpacity>
      <TouchableOpacity
        onPressIn={() => onPressIn("watchedTv")}
        onPressOut={() => onPressOut("watchedTv")}
        onPress={() => {
          !listStates["watchedTv"]
            ? openModal()
            : addShowToFirestore(new Date());
        }}
      >
        <Animated.View
          style={[
            {
              transform: [{ scale: scaleValues["watchedTv"] || 1 }],
            },
          ]}
        >
          {isLoading ? (
            <LottieView
              source={require("../LottieJson/loading15.json")}
              style={{ width: 32, height: 32 }}
              autoPlay
              loop
            />
          ) : listStates["watchedTv"] ? (
            <Ionicons
              name="eye"
              size={32}
              color={
                isSeasonWatched === 1 ? theme.colors.green : theme.colors.orange
              }
            />
          ) : (
            <Ionicons
              name="eye-outline"
              size={32}
              color={theme.text.secondary}
            />
          )}
        </Animated.View>
      </TouchableOpacity>
      <TouchableOpacity
        onPressIn={() => onPressIn("favorites")}
        onPressOut={() => onPressOut("favorites")}
        onPress={() => {
          updateList("favorites", type);
        }}
      >
        <Animated.View
          style={[
            {
              transform: [{ scale: scaleValues["favorites"] || 1 }],
            },
          ]}
        >
          {listStates["favorites"] ? (
            <Ionicons name="heart" size={32} color={theme.colors.red} />
          ) : (
            <Ionicons
              name="heart-outline"
              size={32}
              color={theme.text.secondary}
            />
          )}
        </Animated.View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          {
            setModalVisible(true), OtherLists();
          }
        }}
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <View
          style={{
            flexDirection: "row",
            gap: 0,
          }}
        >
          <Ionicons
            name="square"
            size={14}
            color={
              otherLists?.length > 0
                ? trueCount > 0
                  ? theme.colors.green
                  : theme.accent
                : theme.between
            }
          />
          <Ionicons
            name="square"
            size={14}
            color={
              otherLists?.length > 1
                ? trueCount > 1
                  ? theme.colors.green
                  : theme.accent
                : theme.between
            }
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            gap: 0,
          }}
        >
          <Ionicons
            name="square"
            size={14}
            color={
              otherLists?.length > 2
                ? trueCount > 2
                  ? theme.colors.green
                  : theme.accent
                : theme.between
            }
          />
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                gap: 0,
              }}
            >
              <Ionicons
                name="square"
                size={6}
                color={
                  otherLists?.length > 3
                    ? trueCount > 3
                      ? theme.colors.green
                      : theme.accent
                    : theme.between
                }
              />
              <Ionicons
                name="square"
                size={6}
                color={
                  otherLists?.length > 4
                    ? trueCount > 4
                      ? theme.colors.green
                      : theme.accent
                    : theme.between
                }
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                gap: 0,
              }}
            >
              <Ionicons
                name="square"
                size={6}
                color={
                  otherLists?.length > 5
                    ? trueCount > 5
                      ? theme.colors.green
                      : theme.accent
                    : theme.between
                }
              />
              <Ionicons
                name="square"
                size={6}
                color={
                  otherLists?.length > 6
                    ? trueCount > 6
                      ? theme.colors.green
                      : theme.accent
                    : theme.between
                }
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {otherLists?.length > 0 ? (
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainerList}>
            <LinearGradient
              colors={["transparent", theme.shadow, theme.shadow]}
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
              onPress={() => setModalVisible(false)}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                left: 0,
                bottom: 0,
                zIndex: 0,
              }}
            />
            <View
              style={[styles.modalViewList, { backgroundColor: theme.primary }]}
            >
              <Text
                style={[styles.modalTextList, { color: theme.text.primary }]}
              >
                Diğer Listeler
              </Text>

              <FlatList
                data={otherLists || []} // otherLists undefined olursa boş dizi ver
                keyExtractor={(item) => item}
                numColumns={3}
                contentContainerStyle={styles.listContainerList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPressIn={() => onPressIn(item)}
                    onPressOut={() => onPressOut(item)}
                    style={[
                      styles.buttonList,
                      {
                        backgroundColor: theme.secondary,
                      },
                    ]}
                    onPress={() => updateList(item, type)}
                  >
                    <Animated.View
                      style={{
                        transform: [{ scale: scaleValues[item] || 1 }],
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Ionicons
                        name="grid"
                        size={48}
                        color={
                          listStates[item] ? theme.colors.green : theme.between
                        }
                      />

                      <Text style={styles.buttonTextList} numberOfLines={3}>
                        {item}
                      </Text>
                    </Animated.View>
                  </TouchableOpacity>
                )}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.accent }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.buttonTextList}>Kapat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.accent }]}
                  onPress={() => {
                    setModalVisible(false),
                      navigation.navigate("ListsViewScreen");
                  }}
                >
                  <Text style={styles.buttonTextList}>Listeler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : (
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              onPress={() => setModalVisible(false)}
            />
            <LinearGradient
              colors={["transparent", theme.shadow, "transparent"]}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                left: 0,
                bottom: 0,
                zIndex: -1,
              }}
            />
            <View
              style={[styles.modalView, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.modalText, { color: theme.text.primary }]}>
                liste bulunamadı yeni oluşturmak istermisn
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonCancel]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.textStyle}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonConfirm]}
                  onPress={() => {
                    navigation.navigate("ListsViewScreen");
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.textStyle}>{t.confirm}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  modalContainerList: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalViewList: {
    margin: 20,
    borderRadius: 20,
    padding: 15,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTextList: {
    marginBottom: 15,
    textAlign: "center",
    fontSize: 18,
  },
  listContainerList: {
    alignItems: "center",
    justifyContent: "center",
  },
  buttonList: {
    margin: 5,
    padding: 10,
    width: 100,
    alignItems: "center",
    borderRadius: 10,
  },
  buttonTextList: {
    color: "white",
    textAlign: "center",
  },

  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalView: {
    margin: 20,
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
    fontSize: 18,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    width: "45%",
    alignItems: "center",
  },
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

export default ListViewTv;
