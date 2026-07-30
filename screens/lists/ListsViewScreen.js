import { Image } from "expo-image";
import {
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
  StatusBar
} from "react-native";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  deleteField,
  doc,
  FieldPath,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import Toast from "react-native-toast-message";
import { db } from "../../firebase";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/BackButton";
import StaggerItem from "../../components/StaggerItem";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import { useListStatusContext } from "../../context/ListStatusContext";
import { PREDEFINED_MOVIE_LISTS } from "../../services/listItemsService";
import { useSharedLists } from "../../context/SharedListsContext";
import CreateSharedListModal from "../../components/modals/CreateSharedListModal";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { i18nText } from "@utils/i18nText";
// İkon/vurgu eşlemesi profil rayı ve Android widget'ı ile ORTAK.
import {
  getListAccent,
  getListIcon,
  SHARED_LIST_ACCENT,
} from "@utils/listAppearance";


const { width } = Dimensions.get("window");
const CARD_W = (width - 48) / 2;
const CARD_H = CARD_W * 1.05;

// ── Korunan liste adlarını Türkçe'ye çevir ──────────────────────────────────
const getDisplayName = (listName) => {
  switch (listName) {
    case "watchedMovies":
      return i18nText("autoI18n.izlenen_filmler", "İzlenen Filmler");
    case "watchedTv":
      return i18nText("autoI18n.izlenen_diziler", "İzlenen Diziler");
    case "favorites":
      return i18nText("autoI18n.favoriler", "Favoriler");
    case "watchList":
      return i18nText("autoI18n.izlenecekler", "İzlenecekler");
    default:
      return listName;
  }
};

// ── Kart destesi poster bileşeni ─────────────────────────────────────────────
const PosterStack = ({ items, accent, imageQuality, getTmdbUrl, theme }) => {
  const angles = [0, -6, 6];
  const offsets = [0, -22, 22];
  const zIndexes = [3, 2, 1];

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
                zIndex: zIndexes[i],
                shadowColor: accent,
              },
            ]}
          >
            {item?.imagePath ? (
              <Image
                source={{
                  uri: getTmdbUrl(item.imagePath, "poster", 200),
                }}
                style={stackStyles.posterImage}
              />
            ) : (
              <View
                style={[
                  stackStyles.posterEmpty,
                  { borderColor: accent + "40", backgroundColor: theme?.primary || '#1c1c1e' },
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
  posterImage: { width: "100%", height: "100%", contentFit: "cover" },
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
  getTmdbUrl,
  index,
  theme,
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
            getTmdbUrl={getTmdbUrl}
            theme={theme}
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

// ── Ortak liste kartı ────────────────────────────────────────────────────────
// ListCard ile aynı çerçeve; isim yerine üye sayısı çipi ve "people" ikonu.
const SHARED_ACCENT = SHARED_LIST_ACCENT;

const SharedListCard = ({ list, previewItems, onPress, imageQuality, getTmdbUrl, theme, index }) => {
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

  return (
    <Animated.View
      style={{
        opacity: enterAnim,
        transform: [
          {
            scale: enterAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.85, 1],
            }),
          },
        ],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={styles.cardWrapper}
      >
        <View
          style={[
            styles.cardGlow,
            {
              backgroundColor: SHARED_ACCENT + "18",
              borderColor: SHARED_ACCENT + "25",
            },
          ]}
        />
        <View style={styles.card}>
          <PosterStack
            items={previewItems}
            accent={SHARED_ACCENT}
            imageQuality={imageQuality}
            getTmdbUrl={getTmdbUrl}
            theme={theme}
          />
          <View
            style={[styles.divider, { backgroundColor: SHARED_ACCENT + "30" }]}
          />
          <View style={styles.cardFooter}>
            <View style={styles.cardFooterLeft}>
              <View
                style={[
                  styles.iconDot,
                  { backgroundColor: SHARED_ACCENT + "20" },
                ]}
              >
                <Ionicons name="people" size={12} color={SHARED_ACCENT} />
              </View>
              <Text style={styles.cardName} numberOfLines={1}>
                {list.name}
              </Text>
            </View>
            <View style={styles.cardFooterRight}>
              <Ionicons
                name="person"
                size={11}
                color="rgba(255,255,255,0.4)"
              />
              <Text style={[styles.countBadge, { color: SHARED_ACCENT }]}>
                {list.memberIds?.length ?? 1}
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
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
  const { watchedTvMap, combinedLists } = useListStatusContext();
  const [isLoading, setIsLoading] = useState(false);

  // Kök doc'tan gelen ham listeler (watchedTv burada artık boş — subcollection'a taşındı).
  const [rootLists, setRootLists] = useState([]);
  // Öntanımlı listeler subcollection'dan (combinedLists), watchedTv map'ten;
  // özel listeler kök doc array'lerinden (Part B'de customItems'a taşınacak).
  const lists = useMemo(() => {
    const tvItems = Object.values(watchedTvMap || {}).map((s) => ({
      ...s,
      dateAdded: s.dateAdded ?? s.addedShowDate ?? null,
    }));
    const result = [
      ["favorites", combinedLists?.favorites || []],
      ["watchList", combinedLists?.watchList || []],
      ["watchedMovies", combinedLists?.watchedMovies || []],
      ["watchedTv", tvItems],
    ];
    // Özel listeler: kök doc'taki öntanımlı olmayan array key'leri.
    rootLists.forEach(([k, v]) => {
      if (
        PREDEFINED_MOVIE_LISTS.includes(k) ||
        k === "watchedTv" ||
        k === "customLists" ||
        !Array.isArray(v)
      )
        return;
      result.push([k, v]);
    });
    return result;
  }, [rootLists, watchedTvMap, combinedLists]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedList, setSelectedList] = useState(null);
  const [listVisible, setListVisible] = useState({});
  const [newListName, setNewListName] = useState("");
  const [inputFocused, setInputFocused] = useState(false);

  // ── Ortak listeler ─────────────────────────────────────────────────────────
  const { sharedLists } = useSharedLists();
  const [createSharedVisible, setCreateSharedVisible] = useState(false);
  // listId → ilk 3 öğe (kart destesi önizlemesi). updatedAt değişince tazelenir.
  const [sharedPreviews, setSharedPreviews] = useState({});
  const sharedPreviewKey = sharedLists
    .map((l) => `${l.id}:${l.updatedAt?.toMillis?.() ?? 0}`)
    .join("|");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const previews = {};
      await Promise.all(
        sharedLists.map(async (l) => {
          try {
            const snap = await getDocs(
              query(collection(db, "SharedLists", l.id, "items"), limit(3)),
            );
            previews[l.id] = snap.docs.map((d) => d.data());
          } catch {
            previews[l.id] = [];
          }
        }),
      );
      if (!cancelled) setSharedPreviews(previews);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedPreviewKey]);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Firestore'dan listVisible çek (eski array formatını map'e dönüştürür)
  useEffect(() => {
    const fetchListVisible = async () => {
      if (!user) return;
      try {
        const userRef = doc(db, "Users", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;
        const raw = userSnap.data().listVisible;
        if (Array.isArray(raw)) {
          // Eski format: [{listName: true}, ...] → map'e çevir ve kaydet
          const map = {};
          raw.forEach((item) => Object.assign(map, item));
          setListVisible(map);
          setDoc(userRef, { listVisible: map }, { merge: true }).catch(() => {});
        } else {
          setListVisible(raw || {});
        }
      } catch (e) {
        // Offline ilk açılış: getDoc cache'siz reddeder — unhandled olmasın.
        if (__DEV__) console.warn("fetchListVisible:", e?.message);
      }
    };
    fetchListVisible();
  }, [user]);

  const addToListVisible = async (listName) => {
    if (!user) return;
    const userRef = doc(db, "Users", user.uid);
    const updated = { ...listVisible, [listName]: !listVisible[listName] };
    try {
      await setDoc(userRef, { listVisible: updated }, { merge: true });
      setListVisible(updated);
    } catch (e) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.islem_basarisiz", "İşlem başarısız") });
    }
  };

  // Firestore listeleri dinle
  useEffect(() => {
    if (!user?.uid) return;
    const docRef = doc(db, "Lists", user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setRootLists(Object.entries(docSnap.data() || {}));
      } else {
        setRootLists([]);
      }
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Öntanımlı liste alanlarıyla çakışan adlar: aynı ada izin verilirse liste
  // kök dokümanda oluşur ama UI filtresi onu "öntanımlı" sayıp gizler.
  const RESERVED_LIST_NAMES = [
    "watchedTv",
    "favorites",
    "watchList",
    "watchedMovies",
    "customLists",
    "listOrder",
  ];

  const addNewList = async () => {
    const name = newListName.trim();
    if (!name) return;
    if (RESERVED_LIST_NAMES.includes(name)) {
      Toast.show({ type: "warning", text1: i18nText("autoI18n.bu_isimde_bir_liste_zaten_var", "Bu isimde bir liste zaten var") });
      return;
    }
    setIsLoading(true);
    try {
      const docRef = doc(db, "Lists", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data[name]) {
          Toast.show({ type: "warning", text1: i18nText("autoI18n.bu_isimde_bir_liste_zaten_var", "Bu isimde bir liste zaten var") });
          return;
        }
        // setDoc+merge: updateDoc string anahtardaki noktaları field-path
        // ayracı sayar ("S.W.A.T." → iç içe map, liste asla görünmez);
        // setDoc data anahtarlarını literal işler.
        await setDoc(docRef, { [name]: [] }, { merge: true });
        setNewListName("");
        Keyboard.dismiss();
        Toast.show({ type: "success", text1: i18nText("autoI18n.liste_olusturuldu", "Liste oluşturuldu") });
      } else {
        Toast.show({ type: "error", text1: i18nText("autoI18n.hata_olustu", "Hata oluştu") });
      }
    } catch (e) {
      // try/finally olmadan hata isLoading'i true'da bırakıp ekle butonunu
      // kalıcı spinner'da kilitliyordu.
      Toast.show({ type: "error", text1: i18nText("autoI18n.hata_olustu", "Hata oluştu") });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteList = async () => {
    if (!selectedList) return;
    const docRef = doc(db, "Lists", user.uid);
    try {
      // FieldPath: liste adında nokta varsa updateDoc'un string anahtarı
      // nested path'e çözmesini engeller (ad literal tek segment kalır).
      await updateDoc(docRef, new FieldPath(selectedList), deleteField());
      setModalVisible(false);
      Toast.show({ type: "success", text1: i18nText("autoI18n.liste_silindi", "Liste silindi") });
    } catch (error) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.silme_hatasi", "Silme hatası: ") + error });
    }
  };

  const protectedLists = [
    "watchedTv",
    "favorites",
    "watchList",
    "watchedMovies",
  ];

  const isListVisible = (listName) => listVisible[listName] === true;

  const renderItem = useCallback(
    ({ item, index }) => {
      const [listName, items] = item;
      return (
        <StaggerItem index={index}>
          <ListCard
            listName={listName}
            items={items}
            isVisible={isListVisible(listName)}
            index={index}
            imageQuality={imageQuality}
            getTmdbUrl={getTmdbUrl}
            theme={theme}
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
        </StaggerItem>
      );
    },
    [listVisible, imageQuality, getTmdbUrl],
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
          >{i18nText("autoI18n.koleksiyonum", "KOLEKSİYONUM")}</Text>
          <Text
            style={[
              styles.headerTitle,
              { color: theme.text?.primary ?? "#fff" },
            ]}
          >
            {i18nText("autoI18n.listelerim", "Listelerim")}
          </Text>
        </View>
        <View style={[styles.countChip, { backgroundColor: theme.secondary }]}>
          <Text
            style={[
              styles.countChipText,
              { color: theme.text?.secondary ?? "#aaa" },
            ]}
          >
            {lists.length}{i18nText("autoI18n.liste", "liste")}</Text>
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
            placeholder={i18nText("autoI18n.yeni_liste_adi", "Yeni liste adı...")}
            placeholderTextColor={theme.text?.muted ?? "#555"}
            value={newListName}
            onChangeText={setNewListName}
            maxLength={40}
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
        {/* Ortak liste oluştur */}
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: SHARED_ACCENT }]}
          onPress={() => setCreateSharedVisible(true)}
        >
          <Ionicons name="people" size={18} color="#000" />
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
          >{i18nText("autoI18n.henuz_liste_yok", "Henüz liste yok")}</Text>
          <Text
            style={[styles.emptyHint, { color: theme.text?.muted ?? "#555" }]}
          >{i18nText("autoI18n.yukaridan_yeni_bir_liste_olustur", "Yukarıdan yeni bir liste oluştur")}</Text>
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
          ListHeaderComponent={
            sharedLists.length > 0 ? (
              <View style={styles.sharedSection}>
                <View style={styles.sharedSectionHeader}>
                  <Ionicons name="people" size={13} color={SHARED_ACCENT} />
                  <Text
                    style={[
                      styles.sharedSectionTitle,
                      { color: theme.text?.muted ?? "#888" },
                    ]}
                  >
                    {i18nText("autoI18n.ortak_listeler", "ORTAK LİSTELER")}
                  </Text>
                </View>
                <View style={styles.sharedGrid}>
                  {sharedLists.map((l, i) => (
                    <SharedListCard
                      key={l.id}
                      list={l}
                      index={i}
                      previewItems={sharedPreviews[l.id] || []}
                      imageQuality={imageQuality}
                      getTmdbUrl={getTmdbUrl}
                      theme={theme}
                      onPress={() => {
                        Keyboard.dismiss();
                        navigation.navigate("SharedListScreen", {
                          listId: l.id,
                        });
                      }}
                    />
                  ))}
                </View>
                <View style={styles.sharedSectionHeader}>
                  <Ionicons name="albums" size={13} color="#fbbf24" />
                  <Text
                    style={[
                      styles.sharedSectionTitle,
                      { color: theme.text?.muted ?? "#888" },
                    ]}
                  >
                    {i18nText("autoI18n.listelerim_upper", "LİSTELERİM")}
                  </Text>
                </View>
              </View>
            ) : null
          }
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
            >{i18nText("autoI18n.listeyi_sil", "Listeyi Sil")}</Text>
            <Text
              style={[
                styles.modalDesc,
                { color: theme.text?.secondary ?? "#aaa" },
              ]}
            >
              <Text style={{ color: "#f87171", fontWeight: "700" }}>
                "{selectedList && getDisplayName(selectedList)}"
              </Text>{" "}{i18nText("autoI18n.listesini_silmek_istediginize_emin_misiniz", "listesini silmek istediğinize emin misiniz?")}</Text>
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

      {/* ── Ortak liste oluşturma ── */}
      <CreateSharedListModal
        visible={createSharedVisible}
        onClose={() => setCreateSharedVisible(false)}
        onCreated={(listId) =>
          navigation.navigate("SharedListScreen", { listId })
        }
      />
      <BackButton />
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

  // ── Ortak listeler bölümü ──────────────────────────────────────────────────
  sharedSection: { marginBottom: 4 },
  sharedSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: 10,
    marginTop: 2,
  },
  sharedSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  sharedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 14,
  },

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
