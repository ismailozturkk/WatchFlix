const fs = require('fs');
const file = 'c:/Users/ismail/Desktop/projeler/MainProject/WhatchFlix/screens/lists/ListsViewScreen.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ ── Liste kartı ──────────────────────────────────────────────────────────────[\s\S]*?(?=            if \(\!protectedLists\.includes\(listName\)\) \{)/g;

const replacement = `// ── Liste kartı ──────────────────────────────────────────────────────────────
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

// ── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function ListsViewScreen({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
  const [isLoading, setIsLoading] = useState(false);

  const [lists, setLists] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedList, setSelectedList] = useState(null);
  const [listVisible, setListVisible] = useState({});
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

  // Firestore'dan listVisible çek (eski array formatını map'e dönüştürür)
  useEffect(() => {
    const fetchListVisible = async () => {
      if (!user) return;
      const userRef = doc(db, "Users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;
      const raw = userSnap.data().listVisible;
      if (Array.isArray(raw)) {
        // Eski format: [{listName: true}, ...] → map'e çevir ve kaydet
        const map = {};
        raw.forEach((item) => Object.assign(map, item));
        setListVisible(map);
        setDoc(userRef, { listVisible: map }, { merge: true });
      } else {
        setListVisible(raw || {});
      }
    };
    fetchListVisible();
  }, [user]);

  const addToListVisible = async (listName) => {
    if (!user) return;
    const userRef = doc(db, "Users", user.uid);
    const updated = { ...listVisible, [listName]: !listVisible[listName] };
    await setDoc(userRef, { listVisible: updated }, { merge: true });
    setListVisible(updated);
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
        Toast.show({ type: "warning", text1: i18nText("autoI18n.bu_isimde_bir_liste_zaten_var", "Bu isimde bir liste zaten var") });
        setIsLoading(false);
        return;
      }
      await updateDoc(docRef, { [newListName]: [] });
      setNewListName("");
      Keyboard.dismiss();
      Toast.show({ type: "success", text1: i18nText("autoI18n.liste_olusturuldu", "Liste oluşturuldu") });
    } else {
      Toast.show({ type: "error", text1: i18nText("autoI18n.hata_olustu", "Hata oluştu") });
    }
    setIsLoading(false);
  };

  const deleteList = async () => {
    if (!selectedList) return;
    const docRef = doc(db, "Lists", user.uid);
    try {
      await updateDoc(docRef, { [selectedList]: deleteField() });
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
`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log('Fixed ListsViewScreen.js');
