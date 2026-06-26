import { Image } from "expo-image";
import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";

import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Linking,
  Alert,
  Modal,
  Animated,
  Dimensions,
  StatusBar,
  Pressable
} from "react-native";
import { db } from "../../firebase";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  setDoc,
  writeBatch,
  limit,
} from "firebase/firestore";
import { useTheme } from "@context/ThemeContext";
import LottieView from "lottie-react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useApiSettings,
  useContentSettings,
  useImageQualitySettings,
} from "@context/AppSettingsContext";
import { useLanguage } from "@context/LanguageContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { createSocialNotification } from "@services/socialNotificationsService";
import axios from "axios";
import {
  AntDesign,
  Entypo,
  Feather,
  FontAwesome,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import IconBacground from "@components/IconBacground"; // Arka plan dekor
import { Octicons } from "@expo/vector-icons";
import { i18nText } from "@utils/i18nText";
import { appAlert } from "@components/AppAlert";
import SharedMediaMessage from "@components/chat/SharedMediaMessage";
import TrailerModal from "@components/video/TrailerModal";


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Sabit renkler (tema üzerine katman) ────────────────────────────────────
const ACCENT = "#6C63FF";
const ACCENT_SOFT = "rgba(108,99,255,0.15)";
const SEEN_COLOR = "#5EE8A0";
const DANGER = "#FF6B6B";
const EDIT_COLOR = "#4FC3F7";

// ─── Tarih yardımcıları (mesaj gruplama + gün ayracı) ───────────────────────
const tsToDate = (ts) => {
  if (!ts) return null;
  try {
    return ts.toDate ? ts.toDate() : new Date(ts);
  } catch {
    return null;
  }
};
const isSameDay = (a, b) =>
  !!a &&
  !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatDateLabel = (date, language) => {
  if (!date) return "";
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (isSameDay(date, now)) return i18nText("autoI18n.bugun", "Bugün");
  if (isSameDay(date, yest)) return i18nText("autoI18n.dun", "Dün");
  return date.toLocaleDateString(language === "tr" ? "tr-TR" : "en-US", {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
};

// ─── Mesaj balonu ────────────────────────────────────────────────────────────
const MessageBubble = memo(
  ({
    item,
    currentUser,
    theme,
    navigation,
    getTmdbUrl,
    onLongPress,
    renderMessageText,
    onOpenTrailer,
    groupTop,
    groupBottom,
    dateLabel,
  }) => {
    const isMe = item.senderId === currentUser.uid;
    const scaleAnim = useRef(new Animated.Value(0.88)).current;
    const opacAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 9,
          tension: 65,
        }),
        Animated.timing(opacAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }, []);

    const getStatusIcon = () => {
      if (item.status === "seen")
        return <Ionicons name="checkmark-done" size={13} color={SEEN_COLOR} />;
      if (item.status === "delivered")
        return (
          <Ionicons
            name="checkmark-done"
            size={13}
            color="rgba(255,255,255,0.38)"
          />
        );
      return (
        <Ionicons name="checkmark" size={13} color="rgba(255,255,255,0.28)" />
      );
    };

    const formatTime = (ts) => {
      if (!ts) return "";
      const date = ts.toDate?.() || new Date(ts);
      return (
        date.getHours() + ":" + date.getMinutes().toString().padStart(2, "0")
      );
    };

    // Medya tipi etiketi
    const mediaTypeLabel =
      item.media?.media_type === "movie"
        ? "Film"
        : item.media?.media_type === "tv"
          ? "Dizi"
          : item.media?.media_type === "person"
            ? "Oyuncu"
            : null;

    // Ardışık aynı-gönderici gruplaması: altında aynı kişinin mesajı varsa
    // gönderici tarafındaki ALT köşe küçülür (üst köşe zaten "kuyruk" 6).
    const groupedCorner = isMe
      ? { borderBottomRightRadius: groupBottom ? 6 : 22 }
      : { borderBottomLeftRadius: groupBottom ? 6 : 22 };

    return (
      <View>
        {dateLabel ? (
          <View style={styles.dateSep}>
            <View style={styles.dateSepLine} />
            <Text allowFontScaling={false} style={styles.dateSepText}>
              {dateLabel}
            </Text>
            <View style={styles.dateSepLine} />
          </View>
        ) : null}
        <Animated.View
          style={[
            { transform: [{ scale: scaleAnim }], opacity: opacAnim },
            isMe ? styles.myMsgWrapper : styles.friendMsgWrapper,
            groupTop && { marginTop: 1 },
          ]}
        >
        <TouchableOpacity
          style={[styles.message, isMe ? styles.myMsg : styles.friendMsg, groupedCorner]}
          onLongPress={() => onLongPress(item)}
          activeOpacity={0.8}
          onPress={() =>
            item.media
              ? navigation.push(
                  item.media?.media_type === "movie"
                    ? "MovieDetails"
                    : item.media?.media_type === "tv"
                      ? "TvShowsDetails"
                      : "ActorViewScreen",
                  item.media?.media_type === "person"
                    ? { personId: item.media?.id }
                    : { id: item.media?.id },
                )
              : null
          }
        >
          {/* ── Media Kartı (eğik poster + çipler) ── */}
          {item.media && (
            <SharedMediaMessage
              media={item.media}
              text={item.text}
              accent={ACCENT}
              getTmdbUrl={getTmdbUrl}
              onOpenTrailer={() => onOpenTrailer?.(item.media)}
            />
          )}

          {/* ── Düz metin ── */}
          {!item.media && <View>{renderMessageText(item.text)}</View>}

          {/* ── Alt meta ── */}
          <View
            style={[
              styles.msgMeta,
              { justifyContent: isMe ? "flex-end" : "flex-start" },
            ]}
          >
            {item.edited && <Text style={styles.editedTag}>{i18nText("autoI18n.duzenlendi", "düzenlendi")}</Text>}
            <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
            {isMe && getStatusIcon()}
          </View>
        </TouchableOpacity>
        </Animated.View>
      </View>
    );
  },
);

// ─── Arama Sonuç Kartı ──────────────────────────────────────────────────────
const SearchResultCard = memo(({ item, onPress, getTmdbUrl, theme }) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
    }).start();
  }, []);

  const typeLabel =
    item.media_type === "movie"
      ? i18nText("autoI18n.film_upper", "FİLM")
      : item.media_type === "tv"
        ? i18nText("autoI18n.dizi_upper", "DİZİ")
        : i18nText("autoI18n.kisi_upper", "KİŞİ");
  const typeColor =
    item.media_type === "movie"
      ? "#FF8A65"
      : item.media_type === "tv"
        ? "#64B5F6"
        : "#CE93D8";

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.searchCard}
        onPress={() => onPress(item)}
        activeOpacity={0.75}
      >
        {item.poster_path || item.profile_path ? (
          <Image
            source={{
              uri: getTmdbUrl(item.poster_path || item.profile_path, 'poster', 200),
            }}
            style={styles.searchCardImage}
          />
        ) : (
          <View style={[styles.searchCardImage, styles.searchCardPlaceholder]}>
            <FontAwesome
              name="image"
              size={24}
              color="rgba(255,255,255,0.25)"
            />
          </View>
        )}

        {/* Tip etiketi */}
        <View
          style={[
            styles.typeTag,
            {
              backgroundColor: typeColor + "22",
              borderColor: typeColor + "55",
            },
          ]}
        >
          <Text style={[styles.typeTagText, { color: typeColor }]}>
            {typeLabel}
          </Text>
        </View>

        {/* Rating */}
        {item.vote_average > 0 && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={9} color="#FFD54F" />
            <Text style={styles.ratingText}>
              {item.vote_average.toFixed(1)}
            </Text>
          </View>
        )}

        <Text style={styles.searchCardTitle} numberOfLines={2}>
          {item.title || item.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Ana Ekran ──────────────────────────────────────────────────────────────
export default function ChatScreen({ route, navigation }) {
  const { friendUid, friendName } = route.params;
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const { language, t } = useLanguage();
  const locale = language === "tr" ? "tr-TR" : "en-US";

  const { API_KEY } = useApiSettings();
  const [trailerMedia, setTrailerMedia] = useState(null);
  const { adultContent } = useContentSettings();
  const { selectAvatarIndex } = useProfileUi();
  const { getTmdbUrl } = useImageQualitySettings();
  const [editingMessage, setEditingMessage] = useState(null);
  const [text, setText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [textLink, setTextLink] = useState(false);
  const [messageLimit, setMessageLimit] = useState(20);

  const [searchChoise, setSearchChoise] = useState(null); // null | "movie" | "tv" | "person"
  const [searchOption, setSearchOption] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);

  // Animasyon ref'leri
  const searchPanelAnim = useRef(new Animated.Value(0)).current;
  const inputBorderAnim = useRef(new Animated.Value(0)).current;

  // ── Klavye yönetimi (Android, uyarlanabilir) ────────────────────────────────
  // KeyboardAvoidingView'ın Android "height" davranışı, pencerenin kendisi de
  // resize olduğunda çift telafi yapıp inputu klavyeden uzaklaştırıyor (eski
  // -18 ofset bunu örtmek için eklenmişti). Bunun yerine: klavyenin gerçek
  // örtüşmesi (endCoordinates.screenY) ile pencerenin kendiliğinden küçüldüğü
  // miktar (onLayout) ölçülür, yalnızca kalan fark paddingBottom uygulanır.
  const insets = useSafeAreaInsets();
  const [kbHeight, setKbHeight] = useState(0);
  const [layoutH, setLayoutH] = useState(0);
  const baseLayoutH = useRef(0); // klavye kapalıyken görülen en büyük yükseklik
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e) => {
      const winH = Dimensions.get("window").height;
      const screenY = e.endCoordinates?.screenY;
      setKbHeight(
        screenY != null
          ? Math.max(0, winH - screenY)
          : (e.endCoordinates?.height ?? 0),
      );
    };
    const onHide = () => setKbHeight(0);
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const onScreenLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    baseLayoutH.current = Math.max(baseLayoutH.current, h);
    setLayoutH(h);
  }, []);

  const windowShrunk = Math.max(0, baseLayoutH.current - layoutH);
  const androidKbPad =
    Platform.OS === "android" && kbHeight > 0
      ? Math.max(0, kbHeight - windowShrunk - insets.bottom)
      : 0;

  const flatListRef = useRef();
  const typingTimerRef   = useRef(null);   // debounce typing writes
  const processedMsgIds  = useRef(new Set()); // guard against redundant seen/delivered writes
  const { theme } = useTheme();

  const [chatData, setChatData] = useState({
    messages: [],
    friendTyping: false,
    friendIsOnline: false,
    friendInChat: false,
    friendLastSeen: null,
  });

  const chatId = useMemo(
    () =>
      currentUser.uid > friendUid
        ? currentUser.uid + "_" + friendUid
        : friendUid + "_" + currentUser.uid,
    [currentUser.uid, friendUid],
  );

  const messagesRef = useMemo(
    () => collection(db, "chats", chatId, "messages"),
    [chatId],
  );
  const currentUserRef = useMemo(
    () => doc(db, "Users", currentUser.uid),
    [currentUser.uid],
  );
  const friendRef = useMemo(() => doc(db, "Users", friendUid), [friendUid]);
  const chatRef = useMemo(() => doc(db, "chats", chatId), [chatId]);

  useEffect(() => {
    const goOnline = async () => {
      await updateDoc(currentUserRef, { isOnline: true });
      await setDoc(
        chatRef,
        { information: { inChat: { [currentUser.uid]: true } } },
        { merge: true },
      );
    };
    const goOffline = async () => {
      await updateDoc(currentUserRef, {
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
      await setDoc(
        chatRef,
        {
          information: {
            inChat: { [currentUser.uid]: false },
            lastSeen: { [currentUser.uid]: serverTimestamp() },
            typing: { [currentUser.uid]: false },
          },
        },
        { merge: true },
      );
    };
    goOnline();
    return () => goOffline();
  }, [chatId]);

  // Clear processed-message guard when switching chats
  useEffect(() => { processedMsgIds.current.clear(); }, [chatId]);

  useEffect(() => {
    const q = query(
      messagesRef,
      orderBy("timestamp", "desc"),
      limit(messageLimit),
    );

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setChatData((prev) => ({ ...prev, messages: msgs }));

      // Batch seen/delivered updates; skip messages we've already processed
      const batch = writeBatch(db);
      let hasBatch = false;
      snapshot.docs.forEach((docSnap) => {
        if (processedMsgIds.current.has(docSnap.id)) return;
        const msg = docSnap.data();
        if (msg.senderId === currentUser.uid && msg.status === "sent") {
          batch.update(doc(messagesRef, docSnap.id), {
            status: "delivered",
            deliveredAt: serverTimestamp(),
          });
          hasBatch = true;
        } else if (msg.senderId !== currentUser.uid && msg.status !== "seen") {
          batch.update(doc(messagesRef, docSnap.id), { status: "seen" });
          hasBatch = true;
        }
        processedMsgIds.current.add(docSnap.id);
      });
      if (hasBatch) batch.commit().catch(console.error);
    });

    const unsubscribeChat = onSnapshot(chatRef, (docSnap) => {
      const info = docSnap.data()?.information || {};
      setChatData((prev) => ({
        ...prev,
        friendTyping: Boolean(info.typing?.[friendUid]),
        friendInChat: Boolean(info.inChat?.[friendUid]),
        friendLastSeen: info.lastSeen?.[friendUid] || null,
      }));
    });

    const unsubscribeFriend = onSnapshot(friendRef, (docSnap) => {
      setChatData((prev) => ({
        ...prev,
        friendIsOnline: Boolean(docSnap.data()?.isOnline),
      }));
    });

    return () => {
      unsubscribeMessages();
      unsubscribeChat();
      unsubscribeFriend();
    };
  }, [chatId, messageLimit]);

  // Arama paneli animasyonu
  useEffect(() => {
    Animated.spring(searchPanelAnim, {
      toValue: searchResults.length > 0 ? 1 : 0,
      useNativeDriver: true,
      friction: 9,
    }).start();
  }, [searchResults.length]);

  // Input odaklanma animasyonu
  const handleInputFocus = () => {
    Animated.timing(inputBorderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };
  const handleInputBlur = () => {
    Animated.timing(inputBorderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const inputBorderColor = inputBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.border || "rgba(255,255,255,0.1)", ACCENT],
  });

  const isLink = useCallback(
    (value) => /(https?:\/\/[^\s]+|www\.[^\s]+)/g.test(value),
    [],
  );

  const handleTyping = useCallback(
    (value) => {
      setText(value);
      setTextLink(isLink(value));
      // Debounce: write typing status at most once per 600 ms
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        setDoc(
          chatRef,
          { information: { typing: { [currentUser.uid]: value.length > 0 } } },
          { merge: true },
        ).catch(console.error);
      }, 600);
    },
    [isLink, chatRef, currentUser.uid],
  );

  const sendMessage = useCallback(async () => {
    if (text.trim() === "") return;
    // Cancel any pending debounced typing write; the setDoc below resets typing anyway
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    try {
      if (editingMessage) {
        await updateDoc(
          doc(db, "chats", chatId, "messages", editingMessage.id),
          { text, edited: true },
        );
        setEditingMessage(null);
      } else {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          text,
          senderId: currentUser.uid,
          timestamp: serverTimestamp(),
          status: "sent",
        });
        // Alıcıya mesaj bildirimi (best-effort — gönderimi bloklamaz).
        createSocialNotification({
          toUid: friendUid,
          fromUid: currentUser.uid,
          fromName: currentUser.displayName || "",
          fromAvatarIndex:
            typeof selectAvatarIndex === "number" ? selectAvatarIndex : 0,
          type: "message",
          text,
        }).catch(() => {});
      }
      await setDoc(
        chatRef,
        {
          information: {
            lastMessage: {
              [currentUser.uid]: {
                lastMessageText: text,
                lastMessageTime: serverTimestamp(),
              },
            },
            updatedAt: serverTimestamp(),
            participants: [currentUser.uid, friendUid],
            typing: { [currentUser.uid]: false },
          },
        },
        { merge: true },
      );
      setText("");
      setTextLink(false);
      setSearchOption(false);
      setSearchModalVisible(false);
    } catch (error) {
      console.error(i18nText("autoI18n.mesaj_gonderme_hatasi", "Mesaj gönderme hatası:"), error);
      appAlert(i18nText("autoI18n.hata", "Hata"), i18nText("autoI18n.mesaj_gonderilemedi", "Mesaj gönderilemedi."));
    }
  }, [text, editingMessage, chatId, currentUser.uid, friendUid, selectAvatarIndex]);

  const handleLongPress = useCallback(
    (item) => {
      if (item.senderId !== currentUser.uid) return;
      setSelectedMessage(item);
      setOptionsVisible(true);
    },
    [currentUser.uid],
  );

  const formatDate = useCallback((timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, []);

  const fetchSearchResults = useCallback(
    async (type, currentQuery) => {
      const queryText = currentQuery || searchText;
      if (!queryText || queryText.trim().length < 1) {
        setSearchResults([]);
        return;
      }

      setLoadingSearch(true);
      try {
        const typeEndpointMap = {
          movie: "search/movie",
          tv: "search/tv",
          person: "search/person",
        };
        const endpoint = type ? typeEndpointMap[type] : "search/multi";
        const url = "https://api.themoviedb.org/3/" + endpoint;
        const params = {
          query: queryText.trim(),
          include_adult: adultContent,
          language: language === "tr" ? "tr-TR" : "en-US",
          page: 1,
        };
        const response = await axios.get(url, {
          params,
          headers: { Authorization: API_KEY },
        });
        // Kategori filtresiyle arama yapıldığında TMDB media_type döndürmez — elle ekle
        const inferredType = type || null;
        const results = response.data.results
          .filter((item) => item.media_type !== "unknown")
          .map((item) => ({
            ...item,
            media_type: item.media_type || inferredType || "movie",
          }))
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        setSearchResults(results);
      } catch (err) {
        console.error(i18nText("autoI18n.arama_hatasi", "Arama hatası:"), err.message);
      } finally {
        setLoadingSearch(false);
      }
    },
    [searchText, adultContent, language, API_KEY],
  );

  // Kategori değişince yeniden ara
  const handleCategoryChange = useCallback(
    (cat) => {
      const newCat = searchChoise === cat ? null : cat;
      setSearchChoise(newCat);
      fetchSearchResults(newCat, searchText);
    },
    [searchChoise, searchText, fetchSearchResults],
  );

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const renderMessageText = useCallback((msgText) => {
    const parts = msgText.split(urlRegex).filter(Boolean);
    return parts.map((part, index) => {
      const isUrl = urlRegex.test(part);
      if (isUrl) {
        const url = part.startsWith("http") ? part : "https://" + part;
        return (
          <Text
            key={index}
            style={styles.linkText}
            onPress={() => Linking.openURL(url)}
          >
            {part}
          </Text>
        );
      }
      return (
        <Text key={index} style={[styles.messageText, { color: "#fff" }]}>
          {part}
        </Text>
      );
    });
  }, []);

  const renderItem = useCallback(
    ({ item, index }) => {
      // Liste "inverted": index+1 ÜSTtekiler (eski), index-1 ALTtakiler (yeni).
      const above = memoizedMessages[index + 1];
      const below = memoizedMessages[index - 1];
      const curDate = tsToDate(item.timestamp);
      const aboveDate = above ? tsToDate(above.timestamp) : null;
      const sameDayAbove = isSameDay(curDate, aboveDate);

      const groupTop =
        !!above && above.senderId === item.senderId && sameDayAbove;
      const groupBottom =
        !!below &&
        below.senderId === item.senderId &&
        isSameDay(curDate, tsToDate(below.timestamp));

      // Gün ayracı: yalnızca en eski yüklü mesajda ya da bir üstteki (eski)
      // GEÇERLİ tarihli mesaj FARKLI güne aitse göster. Üst mesajın tarihi
      // henüz null/pending ise (serverTimestamp çözülmeden) ayraç GÖSTERME —
      // aksi halde her yeni mesajda araya "Bugün" düşüyordu.
      const isOldestLoaded = index === memoizedMessages.length - 1;
      const showDate =
        !!curDate &&
        (isOldestLoaded ? true : !!aboveDate && !sameDayAbove);
      const dateLabel = showDate ? formatDateLabel(curDate, language) : null;

      return (
        <MessageBubble
          item={item}
          currentUser={currentUser}
          theme={theme}
          navigation={navigation}
          getTmdbUrl={getTmdbUrl}
          onLongPress={handleLongPress}
          renderMessageText={renderMessageText}
          onOpenTrailer={setTrailerMedia}
          groupTop={groupTop}
          groupBottom={groupBottom}
          dateLabel={dateLabel}
        />
      );
    },
    [
      theme,
      navigation,
      currentUser,
      renderMessageText,
      handleLongPress,
      getTmdbUrl,
      memoizedMessages,
      language,
    ],
  );

  const loadMoreMessages = useCallback(
    () => setMessageLimit((prev) => prev + 20),
    [],
  );
  const memoizedMessages = useMemo(
    () => chatData.messages,
    [chatData.messages],
  );

  const handleSendSearchResult = useCallback(
    async (item) => {
      if (!item) return;

      // Firestore undefined değer kabul etmez — null ile doldur
      const mediaType = item.media_type || "movie";
      const isNotPerson = mediaType !== "person";

      const mediaPayload = {
        id: item.id,
        media_type: mediaType,
        poster_path: item.poster_path || item.profile_path || null,
        ...(isNotPerson && {
          vote_average: item.vote_average ?? null,
          vote_count: item.vote_count ?? null,
          overview: item.overview || null,
        }),
      };

      const messageData = {
        text: item.title || item.name || "Bilinmiyor",
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        status: "sent",
        media: mediaPayload,
      };
      try {
        await addDoc(collection(db, "chats", chatId, "messages"), messageData);
        // Alıcıya mesaj bildirimi (best-effort).
        createSocialNotification({
          toUid: friendUid,
          fromUid: currentUser.uid,
          fromName: currentUser.displayName || "",
          fromAvatarIndex:
            typeof selectAvatarIndex === "number" ? selectAvatarIndex : 0,
          type: "message",
          text: messageData.text,
        }).catch(() => {});
        await setDoc(
          chatRef,
          {
            information: {
              lastMessage: {
                [currentUser.uid]: {
                  lastMessageText: messageData.text,
                  lastMessageTime: serverTimestamp(),
                },
              },
              updatedAt: serverTimestamp(),
              participants: [currentUser.uid, friendUid],
            },
          },
          { merge: true },
        );
        setSearchResults([]);
        setText("");
        setSearchText("");
        setSearchOption(false);
        setSearchModalVisible(false);
        setSearchChoise(null);
      } catch (err) {
        console.error(i18nText("autoI18n.arama_sonucu_gonderme_hatasi", "Arama sonucu gönderme hatası:"), err);
        appAlert(i18nText("autoI18n.hata", "Hata"), i18nText("autoI18n.mesaj_gonderilemedi", "Mesaj gönderilemedi."));
      }
    },
    [chatId, currentUser.uid, friendUid, selectAvatarIndex],
  );

  const friendInitial = friendName ? friendName.charAt(0).toUpperCase() : "?";

  const statusColor = chatData.friendInChat
    ? "#64B5F6"
    : chatData.friendIsOnline
      ? SEEN_COLOR
      : "rgba(255,255,255,0.35)";
  const statusText = chatData.friendInChat
    ? i18nText("autoI18n.sohbette", "Sohbette")
    : chatData.friendIsOnline
      ? i18nText("autoI18n.cevrimici", "Çevrimiçi")
      : i18nText("autoI18n.last_seen_value", "Son görülme {{value}}", {
        value: chatData.friendLastSeen
          ? formatDate(chatData.friendLastSeen)
          : i18nText("autoI18n.bilinmiyor", "bilinmiyor"),
      });

  // Kategori butonları
  const CATEGORIES = [
    { key: "movie", label: i18nText("autoI18n.film", "Film"), icon: "film-outline", color: "#FF8A65" },
    { key: "tv", label: i18nText("autoI18n.dizi", "Dizi"), icon: "tv-outline", color: "#64B5F6" },
    { key: "person", label: i18nText("autoI18n.kisi", "Kişi"), icon: "person-outline", color: "#CE93D8" },
  ];

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        { backgroundColor: theme.primary || "#0F0F1A" },
        androidKbPad > 0 ? { paddingBottom: androidKbPad } : null,
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
      onLayout={onScreenLayout}
    >
      <StatusBar barStyle="light-content" />

      {/* ── HEADER ── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.secondaryt || "rgba(255,255,255,0.04)",
            borderBottomColor: "rgba(255,255,255,0.06)",
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>

        <View style={styles.avatarWrapper}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: ACCENT_SOFT, borderColor: ACCENT + "55" },
            ]}
          >
            <Text allowFontScaling={false} style={styles.avatarText}>
              {friendInitial}
            </Text>
          </View>
          {(chatData.friendIsOnline || chatData.friendInChat) && (
            <View
              style={[styles.onlineDot, { backgroundColor: statusColor }]}
            />
          )}
        </View>

        <View style={styles.headerInfo}>
          <Text
            allowFontScaling={false}
            style={styles.headerName}
            numberOfLines={1}
          >
            {friendName}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text
              allowFontScaling={false}
              style={[styles.headerStatus, { color: statusColor }]}
              numberOfLines={1}
            >
              {statusText}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerAction}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color="rgba(255,255,255,0.6)"
          />
        </TouchableOpacity>
      </View>

      <SafeAreaView
        edges={["bottom"]}
        style={[styles.container, { backgroundColor: "transparent" }]}
      >
          {/* ── MESAJ LİSTESİ ── */}
          {/* Arka plan dekor ikonu */}
          <View style={styles.iconBgWrapper} pointerEvents="none">
            <IconBacground opacity={0.5} />
          </View>
          <FlatList
            ref={flatListRef}
            style={styles.chatList}
            data={memoizedMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            inverted
            onEndReached={loadMoreMessages}
            onEndReachedThreshold={0.5}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews
            windowSize={10}
            maxToRenderPerBatch={12}
            initialNumToRender={15}
            updateCellsBatchingPeriod={30}
            ListHeaderComponent={
              chatData.friendTyping ? (
                <View style={styles.typingBubble}>
                  <LottieView
                    source={require("@lottie/typingAnimation.json")}
                    autoPlay
                    loop
                    style={{ width: 68, height: 34 }}
                  />
                </View>
              ) : null
            }
          />

          {/* ── INPUT ALANI ── */}
          <View style={styles.inputContainer}>
              {/* Arka plan blur katmanı */}
              <View style={styles.inputBlurBg} />

              {/* Düzenleme banner */}
              {editingMessage && (
                <View style={styles.editingBanner}>
                  <View style={styles.editingAccent} />
                  <MaterialIcons name="edit" size={13} color={EDIT_COLOR} />
                  <Text style={styles.editingText} numberOfLines={1}>
                    {i18nText("autoI18n.duzenlendi_2", "Düzenlendi:") + " " + editingMessage.text}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingMessage(null);
                      setText("");
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color="rgba(255,255,255,0.35)"
                    />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.inputRow}>
                {/* Input balonu — içinde ikon + input + sağ aksiyon */}
                <Animated.View
                  style={[
                    styles.inputWrapper,
                    { borderColor: searchOption ? ACCENT : inputBorderColor },
                  ]}
                >
                  {/* Üst glow şeridi */}
                  <View
                    style={[
                      styles.inputInnerGlow,
                      { opacity: searchOption ? 1 : 0 },
                    ]}
                  />

                  <View style={styles.inputInnerRow}>
                    {/* Sol durum ikonu */}
                    <TouchableOpacity
                      style={styles.inputLeftIcon}
                      onPress={() => {
                        setSearchOption(true);
                        setSearchModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      {searchOption ? (
                        <Feather name="search" size={16} color={ACCENT} />
                      ) : textLink ? (
                        <AntDesign name="link" size={15} color={SEEN_COLOR} />
                      ) : (
                        <Feather
                          name="search"
                          size={16}
                          color="rgba(255,255,255,0.4)"
                        />
                      )}
                    </TouchableOpacity>

                    <TextInput
                      style={styles.input}
                      value={text}
                      multiline
                      numberOfLines={6}
                      onChangeText={handleTyping}
                      placeholder={i18nText("autoI18n.mesaj_yazin", "Mesaj yazın...")}
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      selectionColor={ACCENT}
                    />
                  </View>
                </Animated.View>

                {/* Gönder butonu */}
                <TouchableOpacity
                  onPress={sendMessage}
                  activeOpacity={0.72}
                  disabled={!text.trim()}
                  style={[styles.sendBtn, { opacity: text.trim() ? 1 : 0.32 }]}
                >
                  {editingMessage ? (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  ) : (
                    <Ionicons
                      name="send"
                      size={18}
                      color="#fff"
                      style={{ marginLeft: 2 }}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

        {/* ── # ARAMA MODALİ ── */}
        <Modal
          animationType="slide"
          visible={searchModalVisible}
          transparent
          onRequestClose={() => {
            setSearchModalVisible(false);
            setSearchResults([]);
            setText(text.replace(/#.*/g, ""));
            setSearchOption(false);
          }}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
          >
            <Pressable
              style={styles.searchModalOverlay}
              onPress={() => {
                setSearchModalVisible(false);
                setSearchResults([]);
                setSearchText("");
                setSearchOption(false);
              }}
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                <View style={styles.searchModal}>
                  {/* Tutamaç */}
                  <View style={styles.dragHandle} />

                  {/* Başlık */}
                  <View style={styles.searchModalHeader}>
                    <View style={styles.searchHashBadge}>
                      <Feather name="search" size={15} color={ACCENT} />
                    </View>
                    <Text style={styles.searchModalTitle}>{i18nText("autoI18n.film_dizi_ara", "Film & Dizi Ara")}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setSearchModalVisible(false);
                        setSearchResults([]);
                        setSearchText("");
                        setSearchOption(false);
                      }}
                      style={styles.searchCloseBtn}
                    >
                      <Ionicons
                        name="close"
                        size={20}
                        color="rgba(255,255,255,0.5)"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Arama girişi (modaldaki) */}
                  <View style={styles.searchInputWrapper}>
                    <Feather
                      name="search"
                      size={16}
                      color="rgba(255,255,255,0.35)"
                      style={{ marginLeft: 12 }}
                    />
                    <TextInput
                      value={searchText}
                      onChangeText={(val) => {
                        setSearchText(val);
                        fetchSearchResults(searchChoise, val);
                      }}
                      placeholder={i18nText("autoI18n.bir_seyler_yazin", "Bir şeyler yazın...")}
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      autoFocus
                      selectionColor={ACCENT}
                      style={[styles.searchInput, { color: "#fff" }]}
                    />
                    {loadingSearch && (
                      <LottieView
                        source={require("@lottie/typingAnimation.json")}
                        autoPlay
                        loop
                        style={{ width: 40, height: 24, marginRight: 8 }}
                      />
                    )}
                  </View>

                  {/* Kategori filtreleri */}
                  <View style={styles.categoryRow}>
                    <TouchableOpacity
                      style={[
                        styles.catBtn,
                        searchChoise === null && styles.catBtnActive,
                      ]}
                      onPress={() => handleCategoryChange(null)}
                    >
                      <Text
                        style={[
                          styles.catBtnText,
                          searchChoise === null && styles.catBtnTextActive,
                        ]}
                      >{i18nText("autoI18n.tumu", "Tümü")}</Text>
                    </TouchableOpacity>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat.key}
                        style={[
                          styles.catBtn,
                          searchChoise === cat.key && {
                            backgroundColor: cat.color + "22",
                            borderColor: cat.color + "66",
                          },
                        ]}
                        onPress={() => handleCategoryChange(cat.key)}
                      >
                        <Ionicons
                          name={cat.icon}
                          size={13}
                          color={
                            searchChoise === cat.key
                              ? cat.color
                              : "rgba(255,255,255,0.45)"
                          }
                        />
                        <Text
                          style={[
                            styles.catBtnText,
                            searchChoise === cat.key && { color: cat.color },
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Sonuçlar */}
                  {searchResults.length > 0 ? (
                    <FlatList
                      data={searchResults}
                      keyExtractor={(item) =>
                        (item.media_type || "x") + "-" + item.id
                      }
                      horizontal={false}
                      numColumns={3}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.searchGrid}
                      style={{ maxHeight: SCREEN_HEIGHT * 0.42 }}
                      renderItem={({ item }) => (
                        <SearchResultCard
                          item={item}
                          onPress={(selected) =>
                            handleSendSearchResult(selected)
                          }
                          getTmdbUrl={getTmdbUrl}
                          theme={theme}
                        />
                      )}
                    />
                  ) : !loadingSearch ? (
                    <View style={styles.searchEmpty}>
                      <Ionicons
                        name="search-outline"
                        size={36}
                        color="rgba(255,255,255,0.1)"
                      />
                      <Text style={styles.searchEmptyText}>{i18nText("autoI18n.aramak_icin_bir_kelime_yaz", "Aramak için bir kelime yaz")}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* ── UZUN BASIN MODAL ── */}
        {optionsVisible && selectedMessage && (
          <Modal
            animationType="slide"
            visible={optionsVisible}
            transparent
            onRequestClose={() => setOptionsVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFillObject}
                onPress={() => setOptionsVisible(false)}
              />
              <View style={styles.modalSheet}>
                {/* Tutamaç */}
                <View style={styles.dragHandle} />

                {/* Mesaj önizleme kartı */}
                <View style={styles.previewCard}>
                  {selectedMessage.media?.poster_path && (
                    <Image
                      source={{
                      uri: getTmdbUrl(selectedMessage.media.poster_path, 'poster', 200),
                    }}
                      style={styles.previewPoster}
                    />
                  )}
                  <View style={styles.previewTextCol}>
                    {selectedMessage.media && (
                      <Text style={styles.previewMediaType}>
                        {selectedMessage.media.media_type === "movie"
                          ? "Film"
                          : selectedMessage.media.media_type === "tv"
                            ? "Dizi"
                            : "Oyuncu"}
                      </Text>
                    )}
                    <Text
                      allowFontScaling={false}
                      style={styles.previewMsgText}
                      numberOfLines={3}
                    >
                      {selectedMessage.text}
                    </Text>
                    {selectedMessage.media?.vote_average > 0 && (
                      <View style={styles.previewRatingRow}>
                        <Ionicons name="star" size={11} color="#FFD54F" />
                        <Text style={styles.previewRatingText}>
                          {selectedMessage.media.vote_average.toFixed(1)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Zaman damgası */}
                <Text style={styles.modalTimestamp}>
                  {selectedMessage.timestamp
                    ? (() => {
                        const d =
                          selectedMessage.timestamp.toDate?.() || new Date();
                        return (
                          d.toLocaleTimeString(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                          }) +
                          " · " +
                          d.toLocaleDateString(locale, {
                            day: "numeric",
                            month: "long",
                          })
                        );
                      })()
                    : ""}
                </Text>

                {/* Aksiyon listesi */}
                <View style={styles.actionList}>
                  <TouchableOpacity
                    style={styles.actionRowL}
                    onPress={() => {
                      setEditingMessage(selectedMessage);
                      setText(selectedMessage.text);
                      setOptionsVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.actionIconBox,
                        { backgroundColor: "rgba(79,195,247,0.15)" },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="pencil-outline"
                        size={20}
                        color={EDIT_COLOR}
                      />
                    </View>
                    <View style={styles.actionRowText}>
                      <Text style={[styles.actionRowTitle, { color: "#fff" }]}>{i18nText("autoI18n.duzenle", "Düzenle")}</Text>
                      <Text style={styles.actionRowSub}>{i18nText("autoI18n.mesaji_degistir", "Mesajı değiştir")}</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionRowR}
                    onPress={async () => {
                      await deleteDoc(doc(messagesRef, selectedMessage.id));
                      setOptionsVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.actionIconBox,
                        { backgroundColor: "rgba(255,107,107,0.15)" },
                      ]}
                    >
                      <Feather name="trash-2" size={20} color={DANGER} />
                    </View>
                    <View style={styles.actionRowText}>
                      <Text style={[styles.actionRowTitle, { color: DANGER }]}>{i18nText("autoI18n.sil", "Sil")}</Text>
                      <Text style={styles.actionRowSub}>{i18nText("autoI18n.bu_mesaji_kaldir", "Bu mesajı kaldır")}</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* İptal butonu */}
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setOptionsVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>{i18nText("autoI18n.iptal", "İptal")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        <TrailerModal
          visible={!!trailerMedia}
          mediaType={trailerMedia?.media_type}
          id={trailerMedia?.id}
          apiKey={API_KEY}
          onClose={() => setTrailerMedia(null)}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ─── Stiller ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  chatKeyboardView: {
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 52 : 42,
    paddingBottom: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { marginRight: 2, padding: 4 },
  avatarWrapper: { position: "relative", marginRight: 10 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  avatarText: { fontSize: 17, fontWeight: "700", color: "#fff" },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#0F0F1A",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  headerInfo: { flex: 1 },
  headerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.1,
  },
  headerStatus: { fontSize: 11.5, marginTop: 1 },
  headerAction: { padding: 6, marginLeft: 4 },

  // ── Mesaj listesi ──────────────────────────────────────
  chatList: { flex: 1 },
  listContent: { padding: 14, paddingBottom: 18 },

  // wrapper — hizalama için
  myMsgWrapper: { alignItems: "flex-end", marginVertical: 3 },
  friendMsgWrapper: { alignItems: "flex-start", marginVertical: 3 },

  // gün ayracı (yatay çizgi + ortada tarih)
  dateSep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 14,
    paddingHorizontal: 8,
  },
  dateSepLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  dateSepText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },

  message: {
    paddingVertical: 9,
    paddingHorizontal: 9,
    borderRadius: 22,
    maxWidth: "78%",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 4,
  },
  myMsg: {
    backgroundColor: "#17245cff",
    borderTopRightRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(108,99,255,0.35)",
  },
  friendMsg: {
    backgroundColor: "rgba(68, 68, 68, 1)",
    borderTopLeftRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  messageText: { fontSize: 15, lineHeight: 22, color: "#fff" },
  linkText: {
    color: "#82B4FF",
    textDecorationLine: "underline",
    fontSize: 15,
    lineHeight: 22,
  },
  msgMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 0 },
  timestamp: { fontSize: 10.5, color: "rgba(255,255,255,0.38)" },
  editedTag: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    fontStyle: "italic",
    marginRight: 2,
  },

  // ── Media kart ─────────────────────────────────────────
  mediaCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginBottom: 9,
    width: "100%",
  },
  mediaPosterWrapper: {
    position: "relative",
    flexShrink: 0,
  },
  mediaPoster: {
    width: 70,
    height: 105,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  mediaBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingVertical: 3,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    alignItems: "center",
  },
  mediaBadgeText: {
    fontSize: 9,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  mediaPosterPlaceholder: {
    width: 70,
    height: 105,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  mediaTextCol: {
    flex: 1,
    flexShrink: 1,
    gap: 4,
    justifyContent: "center",
  },
  mediaTypeInline: {
    fontSize: 10,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  mediaTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 19,
    flexWrap: "wrap",
  },
  mediaOverview: {
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(255,255,255,0.55)",
    flexWrap: "wrap",
  },
  mediaRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 1,
  },
  mediaRatingText: {
    fontSize: 11,
    color: "#FFD54F",
    fontWeight: "700",
  },
  mediaTapHint: {
    fontSize: 10,
    color: "rgba(255,255,255,0.28)",
    marginTop: 3,
    fontStyle: "italic",
  },

  // ── Typing ─────────────────────────────────────────────
  typingBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    borderTopLeftRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 4,
  },

  // ── IconBg wrapper ─────────────────────────────────────
  iconBgWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 0,
  },

  // ── Input alanı ────────────────────────────────────────
  inputContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 8 : 12,
    backgroundColor: "rgba(13,13,22,0.97)",
    overflow: "hidden",
    zIndex: 20,
    elevation: 20,
  },
  inputBlurBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(108,99,255,0.03)",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  inputInnerGlow: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 1.5,
    backgroundColor: ACCENT,
    borderRadius: 1,
  },
  inputInnerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  inputLeftIcon: {
    width: 38,
    paddingLeft: 12,
    paddingBottom: Platform.OS === "ios" ? 13 : 11,
    justifyContent: "flex-end",
  },
  input: {
    flex: 1,
    paddingRight: 14,
    paddingTop: Platform.OS === "ios" ? 12 : 10,
    paddingBottom: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    maxHeight: 130,
    color: "#fff",
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: ACCENT,
    shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },

  // ── Düzenleme banner ───────────────────────────────────
  editingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(79,195,247,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(79,195,247,0.2)",
    marginBottom: 9,
  },
  editingAccent: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
    backgroundColor: EDIT_COLOR,
  },
  editingText: { flex: 1, fontSize: 13, color: "rgba(255,255,255,0.6)" },

  // ── Arama modal ────────────────────────────────────────
  searchModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  searchModal: {
    backgroundColor: "#14142B",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.09)",
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: 12,
  },
  searchModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  searchHashBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ACCENT_SOFT,
    borderWidth: 1,
    borderColor: ACCENT + "44",
    justifyContent: "center",
    alignItems: "center",
  },
  searchModalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
  searchCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    justifyContent: "center",
    alignItems: "center",
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 12,
    overflow: "hidden",
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    color: "#fff",
  },
  categoryRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 14,
  },
  catBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  catBtnActive: {
    backgroundColor: ACCENT_SOFT,
    borderColor: ACCENT + "66",
  },
  catBtnText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "500",
  },
  catBtnTextActive: { color: ACCENT },
  searchGrid: { paddingBottom: 8 },
  searchEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 10,
  },
  searchEmptyText: {
    color: "rgba(255,255,255,0.22)",
    fontSize: 14,
    textAlign: "center",
  },
  searchCard: {
    flex: 1,
    margin: 5,
    maxWidth: (SCREEN_WIDTH - 62) / 3,
  },
  searchCardImage: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  searchCardPlaceholder: { justifyContent: "center", alignItems: "center" },
  typeTag: {
    position: "absolute",
    top: 6,
    left: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeTagText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  ratingBadge: {
    position: "absolute",
    top: 6,
    right: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: { fontSize: 9, fontWeight: "700", color: "#FFD54F" },
  searchCardTitle: {
    marginTop: 5,
    fontSize: 11.5,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 15,
    textAlign: "center",
  },

  // ── Drag handle (paylaşımlı) ───────────────────────────
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.13)",
    alignSelf: "center",
    marginBottom: 16,
  },

  // ── Uzun basma modal ───────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  modalSheet: {
    backgroundColor: "#13132A",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === "ios" ? 42 : 30,
    paddingTop: 12,
  },
  // Mesaj önizleme kartı
  previewCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 12,
    marginBottom: 5,
  },
  previewPoster: {
    width: 52,
    height: 78,
    borderRadius: 9,
    flexShrink: 0,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  previewTextCol: {
    flex: 1,
    gap: 4,
  },
  previewMediaType: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "600",
  },
  previewMsgText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 20,
    fontWeight: "500",
  },
  previewRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  previewRatingText: {
    fontSize: 12,
    color: "#FFD54F",
    fontWeight: "700",
  },
  modalTimestamp: {
    fontSize: 12,
    color: "rgba(255,255,255,0.28)",
    textAlign: "center",
    marginBottom: 5,
    letterSpacing: 0.2,
  },
  // Aksiyon listesi — dikey, iOS ayarlar stili
  actionList: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 18,
    borderWidth: 1,
    padding: 4,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginBottom: 14,
    gap: 4,
  },
  actionRowL: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionRowR: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  actionRowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  actionRowSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.38)",
    marginTop: 1,
  },
  cancelBtn: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 15,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },

  // ── Eski uyumluluk (kullanılmayan ama referans) ────────
  messageText: { fontSize: 15, lineHeight: 22, color: "#fff" },
  previewBubble: {},
  modalActions: {},
  actionBtn: {},
  actionText: { fontSize: 14, fontWeight: "600" },
  iconPill: {},
});
