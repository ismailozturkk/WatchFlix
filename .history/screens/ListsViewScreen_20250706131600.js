import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import React, { useEffect, useState } from "react";
import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import Toast from "react-native-toast-message";
import { db } from "../firebase";
import Entypo from "@expo/vector-icons/Entypo";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonPlaceholder from "react-native-skeleton-placeholder";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function ListsViewScreen({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const [lists, setLists] = useState([]); // Firestore'dan gelen listeler
  const [modalVisible, setModalVisible] = useState(false); // Silme modalı için state
  const [selectedList, setSelectedList] = useState(null); // Silinecek liste adı

  useEffect(() => {
    if (!user?.uid) return;
    setIsLoading(true);
    const docRef = doc(db, "Lists", user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setLists(Object.entries(docSnap.data() || {}));
      } else {
        setLists([]);
      }
    });
    setIsLoading(false);
    return () => unsubscribe();
  }, [user?.uid]);

  const [newListName, setNewListName] = useState();

  const addNewList = async () => {
    if (!newListName.trim()) return;
    setIsLoading(true);

    const docRef = doc(db, "Lists", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data[newListName]) {
        Toast.show({
          type: "warning",
          text1: "Bu liste adında bir liste var zaten",
        });
        setIsLoading(false);

        return;
      }
      await updateDoc(docRef, { [newListName]: [] });
      setNewListName("");
      Toast.show({
        type: "success",
        text1: "Liste başarıyla eklendi",
      });
      setIsLoading(false);
    } else {
      Toast.show({
        type: "error",
        text1: "liste eklenirken hata oluştu",
      });
      setIsLoading(false);
    }
  };

  const deleteList = async () => {
    if (!selectedList) return;

    const docRef = doc(db, "Lists", user.uid);

    try {
      await updateDoc(docRef, {
        [selectedList]: deleteField(), // Firestore'dan alanı sil
      });

      setModalVisible(false);
      Toast.show({
        type: "success",
        text1: "Liste başarıyla silindi",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Silme hatası:" + error,
      });
    }
  };

  const protectedLists = [
    "watchedTv",
    "favorites",
    "watchList",
    "watchedMovies",
  ];
  const renderSkeleton = () => (
    <SkeletonPlaceholder>
      <View style={{ flexDirection: "row", marginBottom: 10 }}>
        {[...Array(3)].map((_, index) => (
          <View key={index} style={{ marginRight: 10 }}>
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonText} />
            <View style={styles.skeletonTextSmall} />
          </View>
        ))}
      </View>
    </SkeletonPlaceholder>
  );

  return (
    <SafeAreaView
      style={[
        styles.section,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
        Listeler
      </Text>
      <View style={styles.container}>
        <View
          style={[
            styles.input,
            {
              borderColor: theme.border,
              color: theme.text.primary,
              backgroundColor: theme.primary,
            },
          ]}
        >
          <Ionicons name="grid-outline" size={20} color={theme.border} />
          <TextInput
            style={{ color: theme.text.primary, width: "100%", height: "100%" }}
            placeholder="Yeni liste adı"
            placeholderTextColor={theme.text.muted}
            value={newListName}
            onChangeText={setNewListName}
          />
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.between }]}
          onPress={addNewList}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator />
          ) : (
            <Entypo name="plus" size={16} color="white" />
          )}
        </TouchableOpacity>
      </View>
      {lists.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.text.muted }]}>
          Liste bulunamadı
        </Text>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={([listName]) => listName}
          keyboardShouldPersistTaps="handled" // veya "always"
          numColumns={2}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const [listName, items] = item;

            return (
              <TouchableOpacity
                style={[
                  styles.listContainer,
                  { backgroundColor: theme.between },
                ]}
                onPress={() => {
                  Keyboard.dismiss();
                  navigation.navigate("ListsScreen", { listName });
                }}
                onLongPress={() => {
                  if (!protectedLists.includes(listName)) {
                    setSelectedList(listName);
                    setModalVisible(true);
                  }
                }}
              >
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
                            { backgroundColor: theme.secondary },
                          ]}
                        />
                      );
                    }
                  })}
                </View>

                <Text
                  style={{ color: theme.text.primary }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {listName === "watchedMovies"
                    ? "İzlenen Filmler"
                    : listName === "watchedTv"
                      ? "İzlenen Diziler"
                      : listName === "favorites"
                        ? "Favoriler"
                        : listName === "watchList"
                          ? "İzlenecekler"
                          : listName}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
      {/* Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
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
            onPress={() => setModalVisible(false)}
          />
          <View style={[styles.modalView, { backgroundColor: theme.primary }]}>
            <Text style={[styles.modalText, { color: theme.text.primary }]}>
              "{selectedList}" listesini silmek istiyor musunuz?
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
                onPress={deleteList}
              >
                <Text style={styles.textStyle}>{t.confirm}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  section: {
    flex: 1,
    paddingTop: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 10,
    textTransform: "uppercase",
  },
  listContainer: {
    maxWidth: 170,
    maxHeight: 140,
    padding: 7,
    alignItems: "center",
    borderRadius: 15,
    margin: 5,
    gap: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  image: { width: 50, height: 100 },
  placeholder: { width: 50, height: 100 },

  container: {
    width: "90%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 10,
    marginRight: 10,
  },
  addButton: { paddingVertical: 15, paddingHorizontal: 15, borderRadius: 10 },
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
