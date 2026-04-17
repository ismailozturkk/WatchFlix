import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  Keyboard,
  Animated,
  Dimensions,
  StatusBar,
} from "react-native";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import Toast from "react-native-toast-message";
import { db } from "../firebase";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppSettings } from "../context/AppSettingsContext";
import { BlurView } from "expo-blur";

const { width } = Dimensions.get("window");
const CARD_W = (width - 48) / 2;
const CARD_H = CARD_W * 1.05;

// ── Korunan liste adlarını Türkçe'ye çevir ──────────────────────────────────
const getDisplayName = (listName) => {
  switch (listName) {
    case "watchedMovies":
      return "İzlenen Filmler";
    case "watchedTv":
      return "İzlenen Diziler";
    case "favorites":
      return "Favoriler";
    case "watchList":
      return "İzlenecekler";
    default:
      return listName;
  }
};

// ── Listeye özgü ikon ────────────────────────────────────────────────────────
const getListIcon = (listName) => {
  switch (listName) {
    case "watchedMovies":
      return "film";
    case "watchedTv":
      return "tv";
    case "favorites":
      return "heart";
    case "watchList":
      return "bookmark";
    default:
      return "list";
  }
};

// ── Listeye özgü vurgu rengi ─────────────────────────────────────────────────
const getListAccent = (listName) => {
  switch (listName) {
    case "watchedMovies":
      return "#4fc3f7";
    case "watchedTv":
      return "#a78bfa";
    case "favorites":
      return "#f87171";
    case "watchList":
      return "#34d399";
    default:
      return "#fbbf24";
  }
};

// ── Kart destesi poster bileşeni ─────────────────────────────────────────────
const PosterStack = ({ items, accent, imageQuality }) => {
  const angles = [-6, 0, 6];
  const offsets = [-8, 0, 8];

  return (
    <View style={stackStyles.container}>
      {[2, 1, 0].map((i) => {
        const item = items && items[i];
        return (
          <View
            key={i}
            style={[
              stackStyles.poster,
              {
                transform: [
                  { rotate: `${angles[i]}deg` },
                  { translateX: offsets[i] },
                ],
                zIndex: i === 1 ? 3 : i === 0 ? 2 : 1,
                shadowColor: accent,
              },
            ]}
          >
            {item?.imagePath ? (
              <Image
                source={{
                  uri: `https://image.tmdb.org/t/p/${imageQuality?.poster ?? "w185"}${item.imagePath}`,
                }}
                style={stackStyles.posterImage}
              />
            ) : (
              <View
                style={[
                  stackStyles.posterEmpty,
                  { borderColor: accent + "40" },
                ]}
              >
                <Ionicons name="film-outline" size={20} color={accent + "80"} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const stackStyles = StyleSheet.create({
  container: {
    width: "100%",
    height: CARD_H * 0.58,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  poster: {
    position: "absolute",
    width: CARD_W * 0.44,
    height: CARD_H * 0.54,
    borderRadius: 10,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  posterImage: { width: "100%", height: "100%", resizeMode: "cover" },
  posterEmpty: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
});

// ── Liste kartı ──────────────────────────────────────────────────────────────
const ListCard = ({
  listName,
  items,
  isVisible,
  onPress,
  onLongPress,
  onVisibilityToggle,
  imageQuality,
  index,
}) => {
  const accent = getListAccent(listName);
  const icon = getListIcon(listName);
  const displayName = getDisplayName(listName);

  const scale = useRef(new Animated.Value(1)).current;
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enterAnim, {
      toValue: 1,
      delay: index * 70,
      speed: 12,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, []);

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.95,
      speed: 20,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      speed: 20,
      bounciness: 4,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View
      style={{
        opacity: enterAnim,
        transform: [
          {
            scale: Animated.multiply(
              scale,
              enterAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.85, 1],
              }),
            ),
          },
        ],
      }}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.cardWrapper}
      >
        {/* Aksan gölgesi */}
        <View
          style={[
            styles.cardGlow,
            { backgroundColor: accent + "18", borderColor: accent + "25" },
          ]}
        />

        <View style={styles.card}>
          {/* Üst alan: poster destesi */}
          <PosterStack
            items={items}
            accent={accent}
            imageQuality={imageQuality}
          />

          {/* Ayırıcı çizgi */}
          <View style={[styles.divider, { backgroundColor: accent + "30" }]} />

          {/* Alt alan: isim + sayaç */}
          <View style={styles.cardFooter}>
            <View style={styles.cardFooterLeft}>
              <View
                style={[styles.iconDot, { backgroundColor: accent + "20" }]}
              >
                <Ionicons name={icon} size={12} color={accent} />
              </View>
              <Text style={styles.cardName} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
            <View style={styles.cardFooterRight}>
              <TouchableOpacity
                onPress={onVisibilityToggle}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={isVisible ? "eye" : "eye-off-outline"}
                  size={16}
                  color={isVisible ? accent : "rgba(255,255,255,0.25)"}
                />
              </TouchableOpacity>
              <Text style={[styles.countBadge, { color: accent }]}>
                {items?.length ?? 0}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function ListsViewScreen({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { imageQuality } = useAppSettings();
  const [isLoading, setIsLoading] = useState(false);

  const [lists, setLists] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedList, setSelectedList] = useState(null);
  const [listVisible, setListVisible] = useState([]);
  const [newListName, setNewListName] = useState("");
  const [inputFocused, setInputFocused] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Firestore'dan listVisible çek
  useEffect(() => {
    const fetchListVisible = async () => {
      if (!user) return;
      const userRef = doc(db, "Users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setListVisible(userSnap.data().listVisible || []);
      }
    };
    fetchListVisible();
  }, [user]);

  const addToListVisible = async (listName) => {
    if (!user) return;
    const userRef = doc(db, "Users", user.uid);
    const updatedList = [...listVisible];
    let found = false;
    for (let i = 0; i < updatedList.length; i++) {
      if (listName in updatedList[i]) {
        updatedList[i][listName] = !updatedList[i][listName];
        found = true;
        break;
      }
    }
    if (!found) updatedList.push({ [listName]: true });
    await setDoc(userRef, { listVisible: updatedList }, { merge: true });
    setListVisible(updatedList);
  };

  // Firestore listeleri dinle
  useEffect(() => {
    if (!user?.uid) return;
    const docRef = doc(db, "Lists", user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setLists(Object.entries(docSnap.data() || {}));
      } else {
        setLists([]);
      }
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const addNewList = async () => {
    if (!newListName.trim()) return;
    setIsLoading(true);
    const docRef = doc(db, "Lists", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data[newListName]) {
        Toast.show({ type: "warning", text1: "Bu isimde bir liste zaten var" });
        setIsLoading(false);
        return;
      }
      await updateDoc(docRef, { [newListName]: [] });
      setNewListName("");
      Keyboard.dismiss();
      Toast.show({ type: "success", text1: "Liste oluşturuldu" });
    } else {
      Toast.show({ type: "error", text1: "Hata oluştu" });
    }
    setIsLoading(false);
  };

  const deleteList = async () => {
    if (!selectedList) return;
    const docRef = doc(db, "Lists", user.uid);
    try {
      await updateDoc(docRef, { [selectedList]: deleteField() });
      setModalVisible(false);
      Toast.show({ type: "success", text1: "Liste silindi" });
    } catch (error) {
      Toast.show({ type: "error", text1: "Silme hatası: " + error });
    }
  };

  const protectedLists = [
    "watchedTv",
    "favorites",
    "watchList",
    "watchedMovies",
  ];

  const isListVisible = (listName) =>
    listVisible.some((list) => list[listName] === true);

  const renderItem = useCallback(
    ({ item, index }) => {
      const [listName, items] = item;
      return (
        <ListCard
          listName={listName}
          items={items}
          isVisible={isListVisible(listName)}
          index={index}
          imageQuality={imageQuality}
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
          onVisibilityToggle={() => addToListVisible(listName)}
        />
      );
    },
    [listVisible, imageQuality],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      <StatusBar barStyle="light-content" />

      {/* ── Başlık ──────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View>
          <Text
            style={[
              styles.headerSub,
              { color: theme.text?.secondary ?? "#888" },
            ]}
          >
            KOLEKSİYONUM
          </Text>
          <Text
            style={[
              styles.headerTitle,
              { color: theme.text?.primary ?? "#fff" },
            ]}
          >
            Listelerim
          </Text>
        </View>
        <View style={[styles.countChip, { backgroundColor: theme.secondary }]}>
          <Text
            style={[
              styles.countChipText,
              { color: theme.text?.secondary ?? "#aaa" },
            ]}
          >
            {lists.length} liste
          </Text>
        </View>
      </Animated.View>

      {/* ── Yeni liste input ─────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.inputRow,
          {
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: theme.secondary,
              borderColor: inputFocused ? "#fbbf24" + "60" : "transparent",
            },
          ]}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={inputFocused ? "#fbbf24" : (theme.text?.muted ?? "#555")}
          />
          <TextInput
            style={[styles.input, { color: theme.text?.primary ?? "#fff" }]}
            placeholder="Yeni liste adı..."
            placeholderTextColor={theme.text?.muted ?? "#555"}
            value={newListName}
            onChangeText={setNewListName}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            returnKeyType="done"
            onSubmitEditing={addNewList}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.addBtn,
            {
              backgroundColor: newListName.trim()
                ? "#fbbf24"
                : (theme.secondary ?? "#222"),
              opacity: isLoading ? 0.6 : 1,
            },
          ]}
          onPress={addNewList}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Ionicons
              name="arrow-forward"
              size={18}
              color={
                newListName.trim() ? "#000" : (theme.text?.muted ?? "#555")
              }
            />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* ── Liste ────────────────────────────────────────────────────────── */}
      {lists.length === 0 ? (
        <View style={styles.emptyBox}>
          <View
            style={[styles.emptyIcon, { backgroundColor: theme.secondary }]}
          >
            <Ionicons
              name="albums-outline"
              size={32}
              color={theme.text?.muted ?? "#555"}
            />
          </View>
          <Text
            style={[
              styles.emptyText,
              { color: theme.text?.secondary ?? "#888" },
            ]}
          >
            Henüz liste yok
          </Text>
          <Text
            style={[styles.emptyHint, { color: theme.text?.muted ?? "#555" }]}
          >
            Yukarıdan yeni bir liste oluştur
          </Text>
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={([listName]) => listName}
          keyboardShouldPersistTaps="handled"
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={renderItem}
        />
      )}

      {/* ── Silme Modalı ─────────────────────────────────────────────────── */}
      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setModalVisible(false)}
          />
          <Animated.View
            style={[styles.modalBox, { backgroundColor: theme.secondary }]}
          >
            {/* İkon */}
            <View style={styles.modalIconWrap}>
              <LinearGradient
                colors={["#f87171", "#ef4444"]}
                style={styles.modalIconGrad}
              >
                <Ionicons name="trash-outline" size={24} color="#fff" />
              </LinearGradient>
            </View>
            <Text
              style={[
                styles.modalTitle,
                { color: theme.text?.primary ?? "#fff" },
              ]}
            >
              Listeyi Sil
            </Text>
            <Text
              style={[
                styles.modalDesc,
                { color: theme.text?.secondary ?? "#aaa" },
              ]}
            >
              <Text style={{ color: "#f87171", fontWeight: "700" }}>
                "{selectedList && getDisplayName(selectedList)}"
              </Text>{" "}
              listesini silmek istediğinize emin misiniz?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={() => setModalVisible(false)}
              >
                <Text
                  style={[
                    styles.modalBtnText,
                    { color: theme.text?.secondary ?? "#aaa" },
                  ]}
                >
                  {t.cancel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={deleteList}
              >
                <Ionicons
                  name="trash-outline"
                  size={14}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  {t.confirm}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 3,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  countChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 4,
  },
  countChipText: { fontSize: 12, fontWeight: "600" },

  // ── Input ─────────────────────────────────────────────────────────────────
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 10,
    borderWidth: 1.5,
  },
  input: { flex: 1, fontSize: 14, fontWeight: "500" },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── FlatList ──────────────────────────────────────────────────────────────
  listContent: { paddingHorizontal: 12, paddingBottom: 30 },
  columnWrapper: { justifyContent: "space-between", marginBottom: 12 },

  // ── Kart ──────────────────────────────────────────────────────────────────
  cardWrapper: { width: CARD_W },
  cardGlow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 4,
    bottom: -4,
    borderRadius: 20,
    borderWidth: 1,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingTop: 16,
    paddingHorizontal: 10,
    paddingBottom: 12,
    justifyContent: "space-between",
  },
  divider: { height: 1, marginHorizontal: 4, marginBottom: 10 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardFooterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  cardFooterRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  cardName: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    letterSpacing: -0.2,
  },
  countBadge: {
    fontSize: 12,
    fontWeight: "800",
  },

  // ── Boş durum ─────────────────────────────────────────────────────────────
  emptyBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyText: { fontSize: 16, fontWeight: "700" },
  emptyHint: { fontSize: 13 },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    width: "100%",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  modalIconWrap: { marginBottom: 4 },
  modalIconGrad: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  modalDesc: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  modalBtnDanger: { backgroundColor: "#ef4444" },
  modalBtnText: { fontSize: 14, fontWeight: "700" },
});
