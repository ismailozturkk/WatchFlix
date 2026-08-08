import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Animated,
  Dimensions,
  StatusBar
} from "react-native";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useProfileUi } from "@context/ProfileUiContext";
import Toast from "react-native-toast-message";
import { db } from "../../firebase";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/BackButton";
import StaggerItem from "../../components/StaggerItem";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import { useListStatusContext } from "../../context/ListStatusContext";
import { PREDEFINED_MOVIE_LISTS } from "../../services/listItemsService";
// Rezerve adlar utils/listShare'den: kopya liste sessizce ayrışırsa kök
// dokümanda öntanımlı bir alanı ezen liste oluşur ve hiç görünmez.
import { RESERVED_LIST_NAMES } from "@utils/listShare";
import ListCovers from "@components/lists/ListCovers";
import ListManageSheet from "@components/lists/ListManageSheet";
import { useSharedLists } from "../../context/SharedListsContext";
import CreateSharedListModal from "../../components/modals/CreateSharedListModal";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { i18nText } from "@utils/i18nText";
import ScreenDecor from "../../components/ScreenDecor";
// İkon/vurgu eşlemesi profil rayı ve Android widget'ı ile ORTAK.
import {
  getListAccent,
  getListIcon,
  SHARED_LIST_ACCENT,
} from "@utils/listAppearance";


const { width } = Dimensions.get("window");
const CARD_W = (width - 48) / 2;
const CARD_H = CARD_W * 1.05;
// Kapak bloğu: kart genişliğinden iç dolgu düşülür, yükseklik karttan pay alır.
// Düzeni (yığın/büyük/küçük/karışık) ListCovers seçer — profil rayıyla ORTAK.
const CARD_PADDING = 10;
const COVER_W = CARD_W - CARD_PADDING * 2;
const COVER_H = CARD_H * 0.58;

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

// ── Kart kapağı ──────────────────────────────────────────────────────────────
// Düzen artık burada değil, ORTAK ListCovers'ta: kullanıcının profil rayından
// seçtiği görünüm (Büyük/Küçük/Karışık/Yığın) bu ekranda da uygulanır.
const CardCovers = (props) => (
  <ListCovers
    {...props}
    width={COVER_W}
    height={COVER_H}
    style={styles.coverBlock}
  />
);

// ── Liste kartı ──────────────────────────────────────────────────────────────
const ListCard = ({
  listName,
  items,
  isVisible,
  onPress,
  onLongPress,
  onVisibilityToggle,
  getTmdbUrl,
  index,
  theme,
  gridStyle,
  allCornersRounded,
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
          {/* Üst alan: seçili görünüme göre kapaklar */}
          <CardCovers
            items={items}
            gridStyle={gridStyle}
            allCornersRounded={allCornersRounded}
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

const SharedListCard = ({
  list,
  previewItems,
  onPress,
  getTmdbUrl,
  theme,
  index,
  gridStyle,
  allCornersRounded,
}) => {
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
          <CardCovers
            items={previewItems}
            gridStyle={gridStyle}
            allCornersRounded={allCornersRounded}
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
  const { theme } = useTheme();
  const { user } = useAuth();
  const { getTmdbUrl } = useImageQualitySettings();
  const { watchedTvMap, combinedLists } = useListStatusContext();
  // Kapak düzeni profil rayıyla ORTAK ayar: kullanıcı orada ne seçtiyse burada
  // da o çizilir (ProfileUiContext, cihazda kalıcı).
  const { gridStyle, allCornersRounded } = useProfileUi();
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
  // Uzun basılan liste — yönetim sayfası (ad değiştir / sil) buna bakar.
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

  const protectedLists = [
    "watchedTv",
    "favorites",
    "watchList",
    "watchedMovies",
  ];

  // Ad çakışmasını yönetim sayfası CANLI gösterebilsin diye: görünen listeler +
  // kök dokümandaki diğer alanlar (ör. `customLists`) birlikte.
  const existingListNames = useMemo(
    () =>
      Array.from(
        new Set([
          ...lists.map(([name]) => name),
          ...rootLists.map(([key]) => key),
        ]),
      ),
    [lists, rootLists],
  );
  // Yönetim sayfasının başlığındaki "N içerik" sayacı.
  const selectedListCount =
    lists.find(([name]) => name === selectedList)?.[1]?.length ?? 0;

  // Ad değişince görünürlük bayrağı da yeni ada taşınır (yazmayı sayfa yapar,
  // burada yalnız ekrandaki göz ikonlarının haritası güncellenir).
  const handleRenamed = (from, to) => {
    setListVisible((prev) => {
      const next = { ...prev };
      const wasVisible = prev[from] === true;
      delete next[from];
      next[to] = wasVisible;
      return next;
    });
  };

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
            getTmdbUrl={getTmdbUrl}
            theme={theme}
            gridStyle={gridStyle}
            allCornersRounded={allCornersRounded}
            onPress={() => {
              Keyboard.dismiss();
              navigation.navigate("ListsScreen", { listName });
            }}
            onLongPress={() => {
              // Öntanımlı dörtte ne ad değişir ne silme var — sayfa da açılmaz.
              if (!protectedLists.includes(listName)) {
                Keyboard.dismiss();
                setSelectedList(listName);
              }
            }}
            onVisibilityToggle={() => addToListVisible(listName)}
          />
        </StaggerItem>
      );
    },
    [listVisible, getTmdbUrl, gridStyle, allCornersRounded, theme],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor iconOpacity={0.3} />
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
        {/* Geri tuşu satır İÇİNDE: absolute hâli (insets.top + 8) başlığın
            aynı yüksekliğine düşüp "KOLEKSİYONUM" yazısının üstüne biniyordu. */}
        <View style={styles.headerLeft}>
          <BackButton absolute={false} />
          <View style={styles.headerTitles}>
            <Text
              numberOfLines={1}
              style={[
                styles.headerSub,
                { color: theme.text?.secondary ?? "#888" },
              ]}
            >{i18nText("autoI18n.koleksiyonum", "KOLEKSİYONUM")}</Text>
            <Text
              numberOfLines={1}
              style={[
                styles.headerTitle,
                { color: theme.text?.primary ?? "#fff" },
              ]}
            >
              {i18nText("autoI18n.listelerim", "Listelerim")}
            </Text>
          </View>
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
                      getTmdbUrl={getTmdbUrl}
                      theme={theme}
                      gridStyle={gridStyle}
                      allCornersRounded={allCornersRounded}
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

      {/* ── Uzun basış: liste yönetim sayfası (ad değiştir / sil) ───────── */}
      <ListManageSheet
        listName={selectedList}
        itemCount={selectedListCount}
        existingNames={existingListNames}
        uid={user?.uid}
        onClose={() => setSelectedList(null)}
        onRenamed={handleRenamed}
      />

      {/* ── Ortak liste oluşturma ── */}
      <CreateSharedListModal
        visible={createSharedVisible}
        onClose={() => setCreateSharedVisible(false)}
        onCreated={(listId) =>
          navigation.navigate("SharedListScreen", { listId })
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 1,
  },
  headerTitles: { flexShrink: 1 },
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
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 12,
    justifyContent: "space-between",
  },
  coverBlock: { marginBottom: 10 },
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
  // Uzun basış menüsü / yeniden adlandırma / silme stilleri artık
  // components/lists/ListManageSheet.js'te (profil rayıyla ORTAK).
});
