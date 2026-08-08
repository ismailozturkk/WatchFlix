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
  Platform,
  Linking,
  Animated,
  Dimensions,
  StatusBar,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Keyboard,
} from "react-native";

// Compose tepsisi / başlık girişi geçişlerinde yumuşak yeniden-yerleşim için.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const easeLayout = () =>
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
import { db } from "../../firebase";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
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
  deleteField,
  increment,
} from "firebase/firestore";
import { useTheme } from "@context/ThemeContext";
import LottieView from "lottie-react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useApiSettings,
  useContentSettings,
  useHapticsSettings,
  useImageQualitySettings,
} from "@context/AppSettingsContext";
import * as Haptics from "@services/hapticsService";
import { useLanguage } from "@context/LanguageContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { createSocialNotification } from "@services/socialNotificationsService";
import {
  subscribeToUserPresence,
  isOnlineVisible,
} from "@services/presenceService";
import {
  enterChat,
  leaveChat,
  setTyping,
  subscribeChatMeta,
} from "@services/chatRtdb";
import {
  subscribeGroup,
  memberColor,
  nextVote,
} from "@services/groupsService";
import axios from "axios";
import {
  AntDesign,
    Feather,
  FontAwesome,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import IconBacground from "@components/IconBacground"; // Arka plan dekor
import BottomSheetModal from "@components/common/BottomSheetModal";
import { i18nText } from "@utils/i18nText";
import { appAlert } from "@components/AppAlert";
import { toast } from "@components/AppToast";
import SharedMediaMessage from "@components/chat/SharedMediaMessage";
import SharedMediaCollection from "@components/chat/SharedMediaCollection";
import PollMessage from "@components/chat/PollMessage";
import TextPollComposer from "@components/chat/TextPollComposer";
import GroupInfoModal from "@components/chat/GroupInfoModal";
import GroupAvatar from "@components/chat/GroupAvatar";
import MessageReplyPreview from "@components/chat/MessageReplyPreview";
import PinnedMessagesModal from "@components/chat/PinnedMessagesModal";
import SwipeReplyContainer from "@components/chat/SwipeReplyContainer";
import {
  canManageGroup,
  isGroupCreator,
} from "@utils/groupRoles";
import {
  createMessageClientId,
  mergeServerMessages,
  removeOptimisticMessage,
} from "@utils/chatOptimistic";
import Reanimated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
// Bir media öğesini (tekli veya koleksiyon içindeki) detay ekranına yönlendir.
const openMediaDetail = (navigation, m) => {
  if (!m) return;
  const route =
    m.media_type === "movie"
      ? "MovieDetails"
      : m.media_type === "tv"
        ? "TvShowsDetails"
        : "ActorViewScreen";
  const params = m.media_type === "person" ? { personId: m.id } : { id: m.id };
  navigation.push(route, params);
};

// Arama sonucunu (TMDB) Firestore'a yazılabilir hafif media payload'a çevir.
// Firestore undefined kabul etmez — eksik alanlar null'a indirilir.
const buildMediaPayload = (item) => {
  const mediaType = item.media_type || "movie";
  const isPerson = mediaType === "person";
  const knownForTitles = Array.isArray(item.known_for)
    ? item.known_for
        .map((k) => k?.title || k?.name)
        .filter(Boolean)
        .slice(0, 4)
        .join(", ")
    : "";
  return {
    id: item.id,
    media_type: mediaType,
    title: item.title || item.name || i18nText("autoI18n.bilinmiyor", "bilinmiyor"),
    poster_path: item.poster_path || item.profile_path || null,
    ...(isPerson
      ? {
          overview: knownForTitles || null,
          known_for_department: item.known_for_department || null,
        }
      : {
          vote_average: item.vote_average ?? null,
          vote_count: item.vote_count ?? null,
          overview: item.overview || null,
          release_date:
            mediaType === "movie"
              ? item.release_date || null
              : item.first_air_date || null,
        }),
  };
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

const messagePreview = (message) => {
  if (!message) return i18nText("autoI18n.sohbet_mesaji", "Mesaj");
  if (message.kind === "poll") {
    return `📊 ${message.poll?.question || message.text || i18nText("autoI18n.anket", "Anket")}`;
  }
  if (Array.isArray(message.items) && message.items.length > 0) {
    return message.listTitle || i18nText("autoI18n.n_icerik", "{{n}} içerik", { n: message.items.length });
  }
  if (message.media) {
    return message.media.title || message.text || i18nText("autoI18n.medya", "Medya");
  }
  return String(message.text || i18nText("autoI18n.sohbet_mesaji", "Mesaj")).slice(0, 180);
};

const timestampMs = (value) => value?.toMillis?.() || value?.toDate?.()?.getTime?.() || 0;

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
    isGroup,
    avatars,
    memberInfo,
    onVote,
    onReply,
    onJumpToMessage,
    highlighted,
  }) => {
    const isMe = item.senderId === currentUser.uid;
    const hasItems = Array.isArray(item.items) && item.items.length > 0;
    const hasPoll = item.kind === "poll" && !!item.poll;
    // Grupta gelen mesajda gönderen rengi (baloncuk + ad tutarlı renkte).
    const senderColor = isGroup && !isMe ? memberColor(item.senderId) : null;
    // Gönderen ad/avatarı CANLI grup memberInfo'dan çöz (profil değişince eski
    // mesajlar da güncel görünür); üye gruptan ayrıldıysa mesajdaki donmuş değere düş.
    const minfo = isGroup ? memberInfo?.[item.senderId] : null;
    const senderName = minfo?.name || item.senderName || "";
    const senderAvatarIndex =
      typeof minfo?.avatarIndex === "number" ? minfo.avatarIndex : item.senderAvatarIndex;
    // Gönderen başlığı yalnızca ardışık bloğun İLK mesajında (groupTop yokken).
    const showSenderHeader = isGroup && !isMe && !groupTop;
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
      if (item.status === "sending")
        return <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.3)" />;
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
        date.getHours().toString().padStart(2, "0") +
        ":" +
        date.getMinutes().toString().padStart(2, "0")
      );
    };

    // Aynı göndericiden hemen altında yeni mesaj varsa, üstte kalan balonun
    // gönderici tarafındaki alt köşesi de üst "kuyruk" köşesiyle aynı radius'a iner.
    const groupedCorner = groupBottom
      ? isMe
        ? styles.myGroupedBottomCorner
        : styles.friendGroupedBottomCorner
      : null;
    const meta = (
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
    );

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
        <SwipeReplyContainer onReply={() => onReply(item)}>
        <Animated.View
          style={[
            { transform: [{ scale: scaleAnim }], opacity: opacAnim },
            isMe ? styles.myMsgWrapper : styles.friendMsgWrapper,
            // Ardışık aynı-gönderici mesajlarda araları sıkılaştır.
            groupTop && styles.groupedTop,
            groupBottom && styles.groupedBottom,
          ]}
        >
        {/* Grupta gönderen başlığı (avatar + ad) */}
        {showSenderHeader && (
          <View style={styles.senderHeader}>
            {avatars?.[senderAvatarIndex] ? (
              <Image source={avatars[senderAvatarIndex]} style={styles.senderAvatar} />
            ) : (
              <View style={[styles.senderAvatar, styles.senderAvatarPh, { backgroundColor: senderColor }]}>
                <Text style={styles.senderAvatarInitial}>
                  {(senderName || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={[styles.senderName, { color: senderColor }]} numberOfLines={1}>
              {senderName || i18nText("autoI18n.uye", "Üye")}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.message,
            (item.media || hasItems || hasPoll) && styles.mediaMessage,
            isMe ? styles.myMsg : styles.friendMsg,
            highlighted && styles.highlightedMessage,
            // Grupta gelen baloncukta gönderen renginde ince sol vurgu.
            senderColor && { borderColor: senderColor + "66" },
            groupedCorner,
          ]}
          onLongPress={() => onLongPress(item)}
          activeOpacity={0.8}
          onPress={() =>
            item.media ? openMediaDetail(navigation, item.media) : null
          }
        >
          <MessageReplyPreview
            reply={item.replyTo}
            onPress={item.replyTo?.messageId ? () => onJumpToMessage(item.replyTo.messageId) : undefined}
          />
          {/* ── Anket ── */}
          {hasPoll ? (
            <PollMessage
              poll={item.poll}
              currentUid={currentUser.uid}
              accent={ACCENT}
              getTmdbUrl={getTmdbUrl}
              onVote={(optionId) => onVote?.(item, optionId)}
            />
          ) : hasItems ? (
            <SharedMediaCollection
              items={item.items}
              listTitle={item.listTitle}
              accent={ACCENT}
              getTmdbUrl={getTmdbUrl}
              isOutgoing={isMe}
              onOpenItem={(it) => openMediaDetail(navigation, it)}
            />
          ) : item.media ? (
            /* ── Tekli media kartı (eğik poster + çipler) ── */
            <SharedMediaMessage
              media={item.media}
              text={item.text}
              accent={ACCENT}
              getTmdbUrl={getTmdbUrl}
              onOpenTrailer={() => onOpenTrailer?.(item.media)}
              isOutgoing={isMe}
            />
          ) : (
            /* ── Düz metin ── */
            <View>{renderMessageText(item.text)}</View>
          )}

          {/* ── Alt meta ── */}
          {meta}
        </TouchableOpacity>
        </Animated.View>
        </SwipeReplyContainer>
      </View>
    );
  },
);

// ─── Arama Sonuç Kartı ──────────────────────────────────────────────────────
const SearchResultCard = memo(({ item, onPress, getTmdbUrl, theme, selected }) => {
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
        style={[styles.searchCard, selected && styles.searchCardSelected]}
        onPress={() => onPress(item)}
        activeOpacity={0.75}
      >
        {/* Poster + rozetler tek oran-kutusunda → tüm absolute öğeler postere
            göre hizalanır (tik kart altına kaymaz). */}
        <View style={styles.searchCardImageWrap}>
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

          {/* Seçim göstergesi (posterin sol-alt köşesi) */}
          <View style={[styles.selectDot, selected && styles.selectDotActive]}>
            {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
          {selected && (
            <View style={styles.searchCardSelectedOverlay} pointerEvents="none" />
          )}
        </View>

        <Text style={styles.searchCardTitle} numberOfLines={2}>
          {item.title || item.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Ana Ekran ──────────────────────────────────────────────────────────────
export default function ChatScreen({ route, navigation }) {
  // İki mod: 1-1 ({friendUid, friendName, friendAvatarIndex?}) veya grup ({groupId, groupName}).
  const {
    friendUid,
    friendName,
    friendAvatarIndex,
    groupId,
    groupName,
    groupAvatarIndex,
  } = route.params;
  const isGroup = !!groupId;
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const { language, t } = useLanguage();
  const locale = language === "tr" ? "tr-TR" : "en-US";

  const { API_KEY } = useApiSettings();
  const { hapticsEnabled } = useHapticsSettings();
  const [trailerMedia, setTrailerMedia] = useState(null);
  const { adultContent } = useContentSettings();
  const { selectAvatarIndex, avatars } = useProfileUi();
  const [groupData, setGroupData] = useState(null); // grup modunda doc
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

  // ── Çoklu içerik seçimi (compose tepsisi) ──────────────────────────────────
  // Arama sonucunda postere basınca ANINDA göndermek yerine seçime ekler.
  // 1 öğe → tekli media mesajı; 2+ öğe → koleksiyon (opsiyonel başlık + 🎲).
  const [selectedItems, setSelectedItems] = useState([]);
  const [composeTitle, setComposeTitle] = useState("");
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [pollMode, setPollMode] = useState(false); // medya anketi (compose toggle)
  const [textPollVisible, setTextPollVisible] = useState(false); // metin anketi modalı
  const [groupInfoVisible, setGroupInfoVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [pinnedModalVisible, setPinnedModalVisible] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [busyPinId, setBusyPinId] = useState(null);
  const MAX_SELECT = 12;

  // Animasyon ref'leri
  const searchPanelAnim = useRef(new Animated.Value(0)).current;
  const inputBorderAnim = useRef(new Animated.Value(0)).current;

  // ── Klavye yönetimi (reanimated, UI thread) ─────────────────────────────────
  // Önceki elle ölçüm (Keyboard events + onLayout + windowShrunk telafisi)
  // edge-to-edge (Expo SDK 54) altında güvenilir değildi; input klavyenin altında
  // kalıyordu. Bunun yerine reanimated useAnimatedKeyboard gerçek klavye
  // yüksekliğini UI thread'de reaktif verir. Alt boşluk = max(güvenli alan,
  // klavye yüksekliği) ile input her zaman klavyenin/navigasyon çubuğunun
  // üstünde, takılma/gecikme olmadan kalır. iOS ve Android'de aynı yol kullanılır.
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard({
    isNavigationBarTranslucentAndroid: true,
  });
  // Kaldırma kapısı: useAnimatedKeyboard bazı kapanış yollarını (sistem geri
  // tuşu, navigasyonla ekrandan ayrılma) kaçırıp yüksekliği klavye değerinde
  // TAKILI bırakabiliyor; değere doğrudan 0 yazmak da işe yaramıyor çünkü
  // hook takılı native durumdan geri yüklüyor. Padding bu yüzden
  // yükseklik × kapı olarak hesaplanır: kapı yalnızca mesaj inputu
  // odaklanınca 1 olur, kapanış event'lerinde ve ekran odak değişiminde 0'a
  // iner. Kapı 0'dan başladığı için ekran her açılışta input ALTTA başlar —
  // bayat yükseklik hiçbir zaman görünmez.
  const kbGate = useSharedValue(0);
  const inputAreaStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(insets.bottom, keyboard.height.value * kbGate.value),
  }));

  const openKbGate = useCallback(() => {
    if (keyboard.height.value > 0 && !Keyboard.isVisible()) {
      // Takılı yükseklik varken klavye yeni açılıyor: ani sıçrama yerine
      // klavye animasyonuna kabaca eşlik et.
      kbGate.value = withTiming(1, { duration: 220 });
    } else {
      kbGate.value = 1;
    }
  }, [keyboard, kbGate]);

  const flatListRef = useRef();
  const typingTimerRef   = useRef(null);   // debounce typing writes
  const processedMsgIds  = useRef(new Set()); // guard against redundant seen/delivered writes
  const messageInputRef  = useRef(null);
  const searchInputRef   = useRef(null);   // arama input — modal açıldıktan SONRA odakla
  const pendingComposerRef = useRef(null); // "search" | "poll"
  const composerTimerRef = useRef(null);
  const searchFocusTimerRef = useRef(null);
  const keyboardVisibleRef = useRef(Keyboard.isVisible());
  const highlightTimerRef = useRef(null);
  const pendingJumpIdRef = useRef(null);
  const [composerTransitioning, setComposerTransitioning] = useState(false);
  const { theme } = useTheme();

  // React Native Modal ayrı bir native PENCEREDE açılır; useAnimatedKeyboard
  // ana pencerenin insets animasyonuna bağlı olduğundan modal açıkken değeri
  // 0'da kalıyor ve arama/anket sheet'leri klavyenin altında kalıyordu.
  // Modal padding'i bu yüzden pencereden bağımsız Keyboard event'leriyle
  // beslenen AYRI bir shared value'dan sürülür (iOS'ta willShow ile animasyona
  // eşlik eder, Android'de didShow anında yumuşak geçiş uygulanır).
  const modalKb = useSharedValue(0);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, (e) => {
      modalKb.value = withTiming(e?.endCoordinates?.height || 0, { duration: 220 });
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      modalKb.value = withTiming(0, { duration: 180 });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [modalKb]);
  const modalKeyboardStyle = useAnimatedStyle(() => ({
    paddingBottom: modalKb.value,
  }));

  // Ana mesaj inputu odaktayken modalı aynı karede açmak iki farklı native
  // katmanın klavye animasyonlarını çakıştırıyor. Modal isteğini sakla; klavye
  // tamamen kapandıktan ve ana input alt konumuna döndükten bir kare sonra aç.
  const commitPendingComposer = useCallback(() => {
    const target = pendingComposerRef.current;
    if (!target) return;

    pendingComposerRef.current = null;
    if (composerTimerRef.current) clearTimeout(composerTimerRef.current);
    composerTimerRef.current = setTimeout(() => {
      if (target === "search") {
        setSearchOption(true);
        setSearchModalVisible(true);
      } else {
        setTextPollVisible(true);
      }
      setComposerTransitioning(false);
      composerTimerRef.current = null;
    }, 48);
  }, []);

  // Native keyboardDidHide bazı üretici klavyelerinde gecikebilir veya hiç
  // gelmeyebilir. Ana inputu da taşıyan shared height tam sıfıra indiğinde
  // aynı tamamlayıcıyı çalıştırmak, modalın ancak görsel yerleşim sıfırlandıktan
  // sonra açılmasını garanti eder.
  useAnimatedReaction(
    () => keyboard.height.value * kbGate.value,
    (padding, previousPadding) => {
      if (padding <= 0 && previousPadding > 0) {
        runOnJS(commitPendingComposer)();
      }
    },
    [commitPendingComposer],
  );

  const openComposer = useCallback(
    (target) => {
      pendingComposerRef.current = target;
      setComposerTransitioning(true);

      const messageInputFocused =
        messageInputRef.current?.isFocused?.() === true;
      const keyboardIsOpen =
        keyboardVisibleRef.current || Keyboard.isVisible() || messageInputFocused;

      if (!keyboardIsOpen) {
        commitPendingComposer();
        return;
      }

      messageInputRef.current?.blur();
      Keyboard.dismiss();

      // Native event ve shared-height reaction beklenmedik biçimde gelmezse
      // geçişin kilitli kalmaması için son güvenlik ağı.
      if (composerTimerRef.current) clearTimeout(composerTimerRef.current);
      composerTimerRef.current = setTimeout(commitPendingComposer, 900);
    },
    [commitPendingComposer],
  );

  // ── FAB menüsü (anket / arama) ─────────────────────────────────────────────
  // Haptaki + butonu iki kısayolu açar; seçimler mevcut composer akışına
  // (openComposer) devreder. İkon menü açıkken 45° dönerek ×'e dönüşür.
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
  const attachSpin = useSharedValue(0);
  const fabIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${attachSpin.value * 45}deg` }],
  }));

  const closeAttachMenu = useCallback(() => {
    easeLayout();
    attachSpin.value = withTiming(0, { duration: 180 });
    setAttachMenuVisible(false);
  }, [attachSpin]);

  const toggleAttachMenu = useCallback(() => {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    easeLayout();
    const next = !attachMenuVisible;
    attachSpin.value = withTiming(next ? 1 : 0, { duration: 200 });
    setAttachMenuVisible(next);
  }, [attachMenuVisible, attachSpin, hapticsEnabled]);

  const handleAttachOption = useCallback(
    (target) => {
      closeAttachMenu();
      openComposer(target);
    },
    [closeAttachMenu, openComposer],
  );

  const closeSearchModal = useCallback((clearHashText = false) => {
    if (searchFocusTimerRef.current) {
      clearTimeout(searchFocusTimerRef.current);
      searchFocusTimerRef.current = null;
    }
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    setSearchModalVisible(false);
    setSearchResults([]);
    setSearchText("");
    setSearchOption(false);
    if (clearHashText) setText((prev) => prev.replace(/#.*/g, ""));
  }, []);

  const closeTextPollModal = useCallback(() => {
    Keyboard.dismiss();
    setTextPollVisible(false);
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      keyboardVisibleRef.current = true;
      // Klavye event'i globaldir; modal penceresindeki bir input da
      // tetikleyebilir. Kapı yalnızca ana ekrandaki mesaj inputu gerçekten
      // odaklıysa açılır (modal klavyesinde ana input yerinde kalmalı).
      if (messageInputRef.current?.isFocused?.()) {
        kbGate.value = 1;
      }
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardVisibleRef.current = false;
      // Kapanış kesinleşti: reanimated yüksekliği takılı kalmış olsa bile
      // kapı kapanınca padding sıfıra iner (normal kapanışta yükseklik zaten
      // kendi animasyonuyla indiğinden görsel fark yaratmaz).
      kbGate.value = withTiming(0, { duration: 160 });
      commitPendingComposer();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      pendingComposerRef.current = null;
      if (composerTimerRef.current) clearTimeout(composerTimerRef.current);
      if (searchFocusTimerRef.current) clearTimeout(searchFocusTimerRef.current);
      // Typing debounce'u da temizle: leaveChat typing=false yazıp onDisconnect
      // guard'larını iptal ettikten SONRA bu timer ateşlenirse karşı tarafta
      // kalıcı hayalet "yazıyor…" göstergesi kalıyordu.
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [commitPendingComposer, kbGate]);

  // Klavye açıkken navigasyonla ekrandan ayrılınca (başlıktaki geri butonu
  // veya profil ekranına geçiş) klavye kapanışı blur olmuş ekrana
  // işlenmiyor. Odaktan çıkarken klavyeyi kapat ve kapıyı ANINDA sıfırla;
  // dönüşte de klavye kapalıysa kapıyı kapalı tut — input her koşulda altta.
  useEffect(() => {
    const unsubBlur = navigation.addListener("blur", () => {
      Keyboard.dismiss();
      kbGate.value = 0;
    });
    const unsubFocus = navigation.addListener("focus", () => {
      if (!Keyboard.isVisible()) {
        kbGate.value = 0;
      }
    });
    return () => {
      unsubBlur();
      unsubFocus();
    };
  }, [navigation, kbGate]);

  const [chatData, setChatData] = useState({
    messages: [],
    friendTyping: false,
    friendIsOnline: false,
    friendInChat: false,
    friendPresence: null,
  });

  // threadId: grup → groupId; 1-1 → sıralı uid'ler. Koleksiyon kökü de moda göre.
  const chatId = useMemo(
    () =>
      isGroup
        ? groupId
        : currentUser.uid > friendUid
          ? currentUser.uid + "_" + friendUid
          : friendUid + "_" + currentUser.uid,
    [isGroup, groupId, currentUser.uid, friendUid],
  );

  const rootCol = isGroup ? "groups" : "chats";
  const messagesRef = useMemo(
    () => collection(db, rootCol, chatId, "messages"),
    [rootCol, chatId],
  );
  const pinsRef = useMemo(
    () => collection(db, rootCol, chatId, "pins"),
    [rootCol, chatId],
  );
  const chatRef = useMemo(() => doc(db, rootCol, chatId), [rootCol, chatId]);

  const currentUserIsCreator = isGroupCreator(groupData, currentUser.uid);
  const currentUserCanManageGroup = canManageGroup(groupData, currentUser.uid);

  // Çevrimiçi/typing/inChat (RTDB) yalnızca 1-1 modunda. Grupta per-üye presence
  // gösterilmez (üye sayısı header'da). enterChat/leaveChat sadece 1-1.
  useEffect(() => {
    if (isGroup) return;
    enterChat(chatId, currentUser.uid);
    return () => leaveChat(chatId, currentUser.uid);
  }, [isGroup, chatId, currentUser.uid]);

  // Sohbet açıkken gelen kutusu index'imdeki okunmamış sayacını sıfır tut:
  // girişte birikmiş sayacı, sohbet açıkken de yeni gelen artışları temizler
  // (profildeki rozet ve Mesajlar ekranındaki renkli border bu alana bakar).
  useEffect(() => {
    if (isGroup) return undefined;
    const myConvRef = doc(db, "Users", currentUser.uid, "conversations", friendUid);
    const unsub = onSnapshot(
      myConvRef,
      (snap) => {
        if (snap.exists() && (snap.data()?.unreadCount || 0) > 0) {
          updateDoc(myConvRef, { unreadCount: 0 }).catch(() => {});
        }
      },
      () => {},
    );
    return () => unsub();
  }, [isGroup, currentUser.uid, friendUid]);

  // Clear processed-message guard when switching chats
  useEffect(() => { processedMsgIds.current.clear(); }, [chatId]);

  useEffect(() => {
    const q = query(
      messagesRef,
      orderBy("timestamp", "desc"),
      limit(messageLimit),
    );

    const unsubscribeMessages = onSnapshot(
      q,
      (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          timestamp:
            data.timestamp ||
            (data.clientCreatedAt ? new Date(data.clientCreatedAt) : null),
          _pendingWrite: docSnap.metadata.hasPendingWrites,
        };
      });
      setChatData((prev) => ({
        ...prev,
        messages: mergeServerMessages(msgs, prev.messages, chatId),
      }));

      // seen/delivered yalnızca 1-1'de anlamlı (grupta çok alıcı → tek durum
      // paylaşılamaz; gereksiz yazma). Grupta atla.
      if (isGroup) return;
      const batch = writeBatch(db);
      let hasBatch = false;
      snapshot.docs.forEach((docSnap) => {
        // Optimistic yerel echo: mesaj henüz sunucuya yazılmadan snapshot tetiklenir.
        // Bu durumda batch.update "No document to update" ile patlar ve TÜM batch
        // fail eder. Sunucu commit'ini bekle — bir sonraki (server-confirmed)
        // snapshot'ta işlenir (processedMsgIds'e de eklenmez, atlanmış sayılmaz).
        if (docSnap.metadata.hasPendingWrites) return;
        const msg = docSnap.data();
        if (msg.senderId === currentUser.uid && msg.status === "sent") {
          // Gönderen tarafı one-shot: aynı mesaja tekrar delivered yazma.
          if (processedMsgIds.current.has(docSnap.id)) return;
          batch.update(doc(messagesRef, docSnap.id), {
            status: "delivered",
            deliveredAt: serverTimestamp(),
          });
          hasBatch = true;
          processedMsgIds.current.add(docSnap.id);
        } else if (msg.senderId !== currentUser.uid && msg.status !== "seen") {
          // Alıcı tarafı one-shot DEĞİL: gönderenin gecikmiş "delivered"
          // yazımı bizim "seen"i ezebilir; snapshot'ta seen değilse yeniden
          // yaz (idempotent) ki durum "seen"de sabitlensin.
          batch.update(doc(messagesRef, docSnap.id), { status: "seen" });
          hasBatch = true;
        }
      });
      if (hasBatch) batch.commit().catch(console.error);
      },
      (err) => {
        // Örn. gruptan çıkarılınca permission-denied: listener sessizce ölür,
        // ekran bayat mesajlarda donardı — en azından logla.
        if (__DEV__) console.warn("messages listener error:", err?.message);
      },
    );

    // Grup: doc'u dinle (header + memberInfo). 1-1: typing + presence.
    let unsubMeta = () => {};
    let unsubPresence = () => {};
    let unsubGroup = () => {};
    if (isGroup) {
      unsubGroup = subscribeGroup(groupId, (g) => setGroupData(g));
    } else {
      unsubMeta = subscribeChatMeta(chatId, friendUid, (meta) => {
        setChatData((prev) => ({
          ...prev,
          friendTyping: meta.typing,
          friendInChat: meta.inChat,
        }));
      });
      // Arkadaşın privacy.onlineStatus tercihi sohbette de geçerli: "none"
      // seçtiyse yeşil nokta VE son görülme gizlenir. 1-1 sohbet arkadaşlar
      // arası olduğundan viewerIsFriend=true. Privacy yüklenene dek çevrimdışı
      // varsayılır (anlık "çevrimiçi" sızıntısı olmasın); okuma başarısızsa
      // varsayılan (görünür) davranışa düşülür.
      let friendPrivacy = null;
      let privacyReady = false;
      let lastPresence = null;
      const applyPresence = () => {
        if (!privacyReady) return;
        const hidden = friendPrivacy?.onlineStatus === "none";
        setChatData((prev) => ({
          ...prev,
          friendIsOnline: isOnlineVisible(lastPresence, friendPrivacy, {
            viewerIsFriend: true,
          }),
          friendPresence: hidden ? null : lastPresence,
        }));
      };
      getDoc(doc(db, "Users", friendUid))
        .then((snap) => {
          friendPrivacy = snap.data()?.privacy || null;
        })
        .catch(() => {})
        .finally(() => {
          privacyReady = true;
          applyPresence();
        });
      unsubPresence = subscribeToUserPresence(friendUid, (presence) => {
        lastPresence = presence;
        applyPresence();
      });
    }

    return () => {
      unsubscribeMessages();
      unsubMeta();
      unsubPresence();
      unsubGroup();
    };
  }, [isGroup, groupId, chatId, friendUid, messageLimit]);

  useEffect(() => {
    const unsubscribePins = onSnapshot(
      pinsRef,
      (snapshot) => {
        const pins = snapshot.docs.map((pinDoc) => ({
          id: pinDoc.id,
          ...pinDoc.data(),
        }));
        pins.sort((a, b) => timestampMs(b.pinnedAt) - timestampMs(a.pinnedAt));
        setPinnedMessages(pins);
      },
      (error) => __DEV__ && console.warn("subscribePins:", error.message),
    );
    return unsubscribePins;
  }, [pinsRef]);

  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    },
    [],
  );

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
    if (attachMenuVisible) closeAttachMenu();
    openKbGate();
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

  // Grup mesajına eklenecek gönderen alanları (1-1'de boş).
  const senderFields = useCallback(
    () =>
      isGroup
        ? {
            senderName: currentUser.displayName || "",
            senderAvatarIndex:
              typeof selectAvatarIndex === "number" ? selectAvatarIndex : 0,
          }
        : {},
    [isGroup, currentUser.displayName, selectAvatarIndex],
  );

  const resolveSenderName = useCallback(
    (message) => {
      if (message?.senderId === currentUser.uid) {
        return currentUser.displayName || i18nText("autoI18n.sen", "Sen");
      }
      if (isGroup) {
        return (
          groupData?.memberInfo?.[message?.senderId]?.name ||
          message?.senderName ||
          i18nText("autoI18n.uye", "Üye")
        );
      }
      return friendName || i18nText("autoI18n.arkadas", "Arkadaş");
    },
    [currentUser.uid, currentUser.displayName, isGroup, groupData?.memberInfo, friendName],
  );

  const beginReply = useCallback(
    (message) => {
      if (!message?.id) return;
      if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
      setEditingMessage(null);
      setReplyingTo({
        messageId: message.id,
        senderId: message.senderId || "",
        senderName: resolveSenderName(message),
        preview: messagePreview(message),
        kind: message.kind || (message.media ? "media" : "text"),
      });
      setOptionsVisible(false);
      setTimeout(() => messageInputRef.current?.focus(), 100);
    },
    [hapticsEnabled, resolveSenderName],
  );

  const replyFields = useCallback(
    () => (replyingTo ? { replyTo: replyingTo } : {}),
    [replyingTo],
  );

  const canRemovePin = useCallback(
    (pin) =>
      Boolean(
        pin &&
          (pin.pinnedBy === currentUser.uid || (isGroup && currentUserIsCreator)),
      ),
    [currentUser.uid, isGroup, currentUserIsCreator],
  );

  const pinMessage = useCallback(
    async (message) => {
      if (!message?.id || busyPinId) return;
      if (isGroup && !currentUserCanManageGroup) {
        toast.warning(
          i18nText("autoI18n.yetki_gerekli", "Yetki gerekli"),
          i18nText("autoI18n.sadece_yoneticiler_sabitleyebilir", "Grup mesajlarını yalnız kurucu veya yöneticiler sabitleyebilir"),
        );
        return;
      }
      setBusyPinId(message.id);
      try {
        await setDoc(doc(pinsRef, message.id), {
          messageId: message.id,
          senderId: message.senderId || "",
          senderName: resolveSenderName(message),
          preview: messagePreview(message),
          kind: message.kind || (message.media ? "media" : "text"),
          pinnedBy: currentUser.uid,
          pinnedByName: currentUser.displayName || i18nText("autoI18n.bir_uye", "Bir üye"),
          pinnedAt: serverTimestamp(),
        });
        toast.success(i18nText("autoI18n.mesaj_sabitlendi", "Mesaj sabitlendi"));
        setOptionsVisible(false);
      } catch (error) {
        console.error("pinMessage:", error);
        toast.error(i18nText("autoI18n.mesaj_sabitlenemedi", "Mesaj sabitlenemedi"));
      } finally {
        setBusyPinId(null);
      }
    },
    [
      busyPinId,
      isGroup,
      currentUserCanManageGroup,
      pinsRef,
      resolveSenderName,
      currentUser.uid,
      currentUser.displayName,
    ],
  );

  const unpinMessage = useCallback(
    async (pin) => {
      if (!pin?.messageId || busyPinId || !canRemovePin(pin)) return;
      setBusyPinId(pin.messageId);
      try {
        await deleteDoc(doc(pinsRef, pin.messageId));
        toast.success(i18nText("autoI18n.sabitleme_kaldirildi", "Sabitleme kaldırıldı"));
        setOptionsVisible(false);
      } catch (error) {
        console.error("unpinMessage:", error);
        toast.error(i18nText("autoI18n.sabitleme_kaldirilamadi", "Sabitleme kaldırılamadı"));
      } finally {
        setBusyPinId(null);
      }
    },
    [busyPinId, canRemovePin, pinsRef],
  );

  // lastMessage yaz + bildirim gönder (moda göre). Grup ve 1-1 şemaları farklı.
  const finalizeThread = useCallback(
    async (previewText) => {
      const fromAvatarIndex =
        typeof selectAvatarIndex === "number" ? selectAvatarIndex : 0;
      if (isGroup) {
        await setDoc(
          chatRef,
          {
            lastMessage: {
              text: previewText,
              senderId: currentUser.uid,
              senderName: currentUser.displayName || "",
              time: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        const others = (groupData?.members || []).filter(
          (u) => u !== currentUser.uid,
        );
        others.forEach((uid) =>
          createSocialNotification({
            toUid: uid,
            fromUid: currentUser.uid,
            fromName: currentUser.displayName || "",
            fromAvatarIndex,
            type: "message",
            text: previewText,
            groupId: chatId,
            groupName: groupData?.name || groupName || "",
          }).catch(() => {}),
        );
      } else {
        createSocialNotification({
          toUid: friendUid,
          fromUid: currentUser.uid,
          fromName: currentUser.displayName || "",
          fromAvatarIndex,
          type: "message",
          text: previewText,
        }).catch(() => {});
        await setDoc(
          chatRef,
          {
            information: {
              lastMessage: {
                [currentUser.uid]: {
                  lastMessageText: previewText,
                  lastMessageTime: serverTimestamp(),
                },
              },
              updatedAt: serverTimestamp(),
              participants: [currentUser.uid, friendUid],
            },
          },
          { merge: true },
        );
        // Gelen kutusu index'i (iki taraf) — Mesajlar ekranı bunu listeler.
        const convEntry = (withUid, withName, withAvatarIndex) => ({
          withUid,
          withName: withName || "",
          ...(typeof withAvatarIndex === "number" ? { withAvatarIndex } : {}),
          lastText: previewText,
          lastTime: serverTimestamp(),
        });
        setDoc(
          doc(db, "Users", currentUser.uid, "conversations", friendUid),
          convEntry(friendUid, friendName, friendAvatarIndex),
          { merge: true },
        ).catch(() => {});
        setDoc(
          doc(db, "Users", friendUid, "conversations", currentUser.uid),
          {
            ...convEntry(currentUser.uid, currentUser.displayName, fromAvatarIndex),
            // Alıcı sohbeti açana dek biriken okunmamış sayacı; alıcının
            // ChatScreen'i sohbet açıkken sıfırlar.
            unreadCount: increment(1),
          },
          { merge: true },
        ).catch(() => {});
      }
    },
    [
      isGroup,
      chatRef,
      currentUser.uid,
      currentUser.displayName,
      selectAvatarIndex,
      groupData,
      friendUid,
      friendName,
      friendAvatarIndex,
    ],
  );

  // Anket oyu (toggle). poll.votes.{uid} alanını günceller.
  const handleVote = useCallback(
    async (msg, optionId) => {
      const nv = nextVote(msg.poll?.votes || {}, currentUser.uid, optionId);
      try {
        await updateDoc(doc(messagesRef, msg.id), {
          [`poll.votes.${currentUser.uid}`]: nv === null ? deleteField() : nv,
        });
      } catch (err) {
        if (__DEV__) console.warn("vote:", err.message);
      }
    },
    [messagesRef, currentUser.uid],
  );

  // Metin anketi gönder (TextPollComposer'dan).
  const sendTextPoll = useCallback(
    async (question, optionLabels) => {
      closeTextPollModal();
      const previewText = "📊 " + question;
      const messageData = {
        text: previewText,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        status: "sent",
        ...replyFields(),
        ...senderFields(),
        kind: "poll",
        poll: {
          question,
          type: "text",
          options: optionLabels.map((label, i) => ({ id: "o" + i, label })),
          votes: {},
        },
      };
      try {
        await addDoc(messagesRef, messageData);
        await finalizeThread(previewText);
        setReplyingTo(null);
      } catch (err) {
        console.error("textPoll:", err);
        appAlert(i18nText("autoI18n.hata", "Hata"), i18nText("autoI18n.mesaj_gonderilemedi", "Mesaj gönderilemedi."));
      }
    },
    [messagesRef, currentUser.uid, replyFields, senderFields, finalizeThread, closeTextPollModal],
  );

  const handleTyping = useCallback(
    (value) => {
      setText(value);
      setTextLink(isLink(value));
      if (isGroup) return; // grupta typing göstergesi yok
      // Debounce: write typing status at most once per 600 ms (RTDB).
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        setTyping(chatId, currentUser.uid, value.length > 0);
      }, 600);
    },
    [isLink, isGroup, chatId, currentUser.uid],
  );

  const sendMessage = useCallback(async () => {
    if (text.trim() === "") return;
    // Pending debounced typing write'ı iptal et ve typing'i hemen kapat (RTDB).
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    if (!isGroup) setTyping(chatId, currentUser.uid, false);
    const outgoing = text;
    const replySnapshot = replyingTo;

    if (editingMessage) {
      const targetMessage = editingMessage;
      const previousText = targetMessage.text || "";
      // Düzenleme de ağ onayını beklemeden balona ve inputa yansır.
      setChatData((prev) => ({
        ...prev,
        messages: prev.messages.map((message) =>
          message.id === targetMessage.id
            ? { ...message, text: outgoing, edited: true }
            : message,
        ),
      }));
      setEditingMessage(null);
      setText("");
      setTextLink(false);
      try {
        await updateDoc(doc(messagesRef, targetMessage.id), {
          text: outgoing,
          edited: true,
        });
      } catch (error) {
        setChatData((prev) => ({
          ...prev,
          messages: prev.messages.map((message) =>
            message.id === targetMessage.id
              ? { ...message, text: previousText, edited: targetMessage.edited }
              : message,
          ),
        }));
        setEditingMessage(targetMessage);
        setText((current) => current || outgoing);
        setTextLink(isLink(outgoing));
        console.error(i18nText("autoI18n.mesaj_duzenleme_hatasi", "Mesaj düzenleme hatası:"), error);
        appAlert(i18nText("autoI18n.hata", "Hata"), i18nText("autoI18n.mesaj_duzenlenemedi", "Mesaj düzenlenemedi."));
      }
      return;
    }

    const clientId = createMessageClientId(currentUser.uid);
    const messageData = {
      clientId,
      clientCreatedAt: Date.now(),
      text: outgoing,
      senderId: currentUser.uid,
      ...senderFields(),
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    };
    const optimisticMessage = {
      ...messageData,
      id: `local-${clientId}`,
      timestamp: new Date(),
      status: "sending",
      _optimistic: true,
      _chatId: chatId,
    };

    // Balon ve input aynı karede güncellenir; Firestore/bildirim gecikmesi UI'ı
    // bloke etmez. Server snapshot'ı clientId ile bu geçici balonu değiştirir.
    setChatData((prev) => ({
      ...prev,
      messages: [optimisticMessage, ...prev.messages],
    }));
    setText("");
    setTextLink(false);
    setReplyingTo(null);
    setSearchOption(false);
    setSearchModalVisible(false);

    try {
      await addDoc(messagesRef, {
        ...messageData,
        text: outgoing,
        timestamp: serverTimestamp(),
        status: "sent",
      });
      // Mesaj zaten görünür ve kalıcı yazılmıştır; özet/bildirim hatası gönderim
      // deneyimini geri almamalı.
      finalizeThread(outgoing).catch((error) => {
        if (__DEV__) console.warn("finalizeThread:", error?.message);
      });
    } catch (error) {
      setChatData((prev) => ({
        ...prev,
        messages: removeOptimisticMessage(prev.messages, clientId),
      }));
      setText((current) => current || outgoing);
      setTextLink(isLink(outgoing));
      if (replySnapshot) setReplyingTo((current) => current || replySnapshot);
      console.error(i18nText("autoI18n.mesaj_gonderme_hatasi", "Mesaj gönderme hatası:"), error);
      appAlert(i18nText("autoI18n.hata", "Hata"), i18nText("autoI18n.mesaj_gonderilemedi", "Mesaj gönderilemedi."));
    }
  }, [
    text,
    editingMessage,
    replyingTo,
    isGroup,
    chatId,
    messagesRef,
    currentUser.uid,
    isLink,
    senderFields,
    finalizeThread,
  ]);

  const handleLongPress = useCallback(
    (item) => {
      setSelectedMessage(item);
      setOptionsVisible(true);
    },
    [],
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

  const memoizedMessages = useMemo(
    () => chatData.messages,
    [chatData.messages],
  );

  const scrollToMessage = useCallback(
    (messageId) => {
      const index = memoizedMessages.findIndex((message) => message.id === messageId);
      if (index < 0) return false;
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHighlightedMessageId(messageId);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightedMessageId(null), 1500);
      setPinnedModalVisible(false);
      return true;
    },
    [memoizedMessages],
  );

  const pendingJumpTriesRef = useRef(0);
  const jumpToMessage = useCallback(
    (messageId) => {
      if (scrollToMessage(messageId)) return;
      pendingJumpIdRef.current = messageId;
      pendingJumpTriesRef.current = 0;
      setMessageLimit((current) => current + 50);
      toast.warning(
        i18nText("autoI18n.eski_mesaj_yukleniyor", "Eski mesaj yükleniyor"),
      );
    },
    [scrollToMessage],
  );

  useEffect(() => {
    const pendingId = pendingJumpIdRef.current;
    if (!pendingId) return;
    if (scrollToMessage(pendingId)) {
      pendingJumpIdRef.current = null;
      return;
    }
    // Hedef bu sayfada da yok: tavana kadar (6×50) sayfa büyütmeye devam et.
    // Önceki tek seferlik +50, bir sayfadan eski hedeflerde sonsuza dek
    // "yükleniyor" toast'ında takılı kalıyordu.
    if (pendingJumpTriesRef.current >= 6) {
      pendingJumpIdRef.current = null;
      return;
    }
    pendingJumpTriesRef.current += 1;
    setMessageLimit((current) => current + 50);
  }, [memoizedMessages, scrollToMessage]);

  const deleteMessage = useCallback(
    async (message) => {
      if (!message?.id) return;
      const pin = pinnedMessages.find((item) => item.messageId === message.id);
      try {
        // Mesaj silinmeden önce pin kaydını temizle; kurallar mesaj sahibine ve
        // grup kurucusuna bu temizlik için izin verir.
        if (pin) await deleteDoc(doc(pinsRef, message.id));
        await deleteDoc(doc(messagesRef, message.id));
        if (replyingTo?.messageId === message.id) setReplyingTo(null);
        setOptionsVisible(false);
      } catch (error) {
        console.error("deleteMessage:", error);
        toast.error(i18nText("autoI18n.mesaj_silinemedi", "Mesaj silinemedi"));
      }
    },
    [pinnedMessages, pinsRef, messagesRef, replyingTo?.messageId],
  );

  const selectedPin = selectedMessage
    ? pinnedMessages.find((pin) => pin.messageId === selectedMessage.id)
    : null;
  const canPinSelected = Boolean(
    selectedMessage && !selectedPin && (!isGroup || currentUserCanManageGroup),
  );
  const canUnpinSelected = Boolean(selectedPin && canRemovePin(selectedPin));
  const canEditSelected = Boolean(
    selectedMessage?.senderId === currentUser.uid &&
      !selectedMessage?.media &&
      !selectedMessage?.items &&
      selectedMessage?.kind !== "poll",
  );
  const canDeleteSelected = Boolean(
    selectedMessage &&
      (selectedMessage.senderId === currentUser.uid || (isGroup && currentUserIsCreator)),
  );

  const renderItem = useCallback(
    ({ item, index }) => {
      // Firestore desc + FlatList inverted:
      // index+1 ekranda fiziksel üstteki eski mesaj, index-1 fiziksel alttaki yeni mesajdır.
      const physicalAbove = memoizedMessages[index + 1];
      const physicalBelow = memoizedMessages[index - 1];
      const curDate = tsToDate(item.timestamp);
      const aboveDate = physicalAbove ? tsToDate(physicalAbove.timestamp) : null;
      const belowDate = physicalBelow ? tsToDate(physicalBelow.timestamp) : null;
      const sameDayAbove = isSameDay(curDate, aboveDate);

      // Gruplama (üniform köşe + sıkı aralık) için: zaman damgası henüz
      // çözülmemişse (yeni gönderilen mesaj -> serverTimestamp pending -> null)
      // AYNI GÜN varsay. Aksi halde art arda gönderilen mesajlar timestamp
      // çözülene kadar gruplanmıyordu; bu yüzden anlık olarak "değişiklik
      // yokmuş" gibi görünüyordu.
      const groupSameDayAbove =
        curDate == null || aboveDate == null || sameDayAbove;
      const groupSameDayBelow =
        curDate == null || belowDate == null || isSameDay(curDate, belowDate);

      const hasSameSenderAbove =
        !!physicalAbove &&
        physicalAbove.senderId === item.senderId &&
        groupSameDayAbove;
      const hasSameSenderBelow =
        !!physicalBelow &&
        physicalBelow.senderId === item.senderId &&
        groupSameDayBelow;

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
          groupTop={hasSameSenderAbove}
          groupBottom={hasSameSenderBelow}
          dateLabel={dateLabel}
          isGroup={isGroup}
          avatars={avatars}
          memberInfo={groupData?.memberInfo}
          onVote={handleVote}
          onReply={beginReply}
          onJumpToMessage={jumpToMessage}
          highlighted={highlightedMessageId === item.id}
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
      isGroup,
      avatars,
      groupData?.memberInfo,
      handleVote,
      beginReply,
      jumpToMessage,
      highlightedMessageId,
    ],
  );

  const loadMoreMessages = useCallback(
    () => setMessageLimit((prev) => prev + 20),
    [],
  );

  // ── Seçim yardımcıları ──────────────────────────────────────────────────────
  const itemKey = (it) => (it?.media_type || "x") + "-" + it?.id;
  const isItemSelected = useCallback(
    (item) => selectedItems.some((s) => itemKey(s) === itemKey(item)),
    [selectedItems],
  );

  // Bir öğenin kategori grubu: "person" (oyuncu) | "media" (dizi/film).
  // Bir liste TEK TİP olmalı — oyuncu ile dizi/film karışmaz.
  const categoryOf = (mt) => (mt === "person" ? "person" : "media");

  // Seçimi ref'te aynala — toggleSelectItem sabit kimlikli kalır (yan etkiler
  // updater DIŞINDA; kartların memo'su her seçimde gereksiz yeniden render olmaz).
  const selectedItemsRef = useRef(selectedItems);
  useEffect(() => {
    selectedItemsRef.current = selectedItems;
  }, [selectedItems]);

  // Postere basınca: seçimde varsa çıkar, yoksa ekle (anında göndermez).
  const toggleSelectItem = useCallback((item) => {
    if (!item) return;
    const cur = selectedItemsRef.current;
    const exists = cur.some((s) => itemKey(s) === itemKey(item));
    if (exists) {
      easeLayout();
      setSelectedItems((prev) => prev.filter((s) => itemKey(s) !== itemKey(item)));
      return;
    }
    if (cur.length >= MAX_SELECT) {
      toast.warning(
        i18nText("autoI18n.limit", "Limit"),
        i18nText("autoI18n.en_fazla_n_secebilirsin", "En fazla {{n}} içerik seçebilirsin", {
          n: MAX_SELECT,
        }),
      );
      return;
    }
    // Tek tip liste: mevcut seçimle kategori uyuşmazsa engelle + uyar.
    if (cur.length > 0 && categoryOf(cur[0].media_type) !== categoryOf(item.media_type)) {
      toast.warning(
        i18nText("autoI18n.karistirilamaz", "Karıştırılamaz"),
        categoryOf(item.media_type) === "person"
          ? i18nText("autoI18n.oyuncu_ayri_liste", "Oyuncular dizi/filmlerle aynı listede olamaz")
          : i18nText("autoI18n.dizifilm_ayri_liste", "Dizi/film oyuncularla aynı listede olamaz"),
      );
      return;
    }
    easeLayout();
    setSelectedItems((prev) => [...prev, buildMediaPayload(item)]);
  }, []);

  const resetCompose = useCallback(() => {
    easeLayout();
    setSelectedItems([]);
    setComposeTitle("");
    setShowTitleInput(false);
    setPollMode(false);
  }, []);

  // ── Seçilen içerikleri gönder ──────────────────────────────────────────────
  // pollMode açık + 2+ → MEDYA ANKETİ (kind:"poll", type:"media").
  // değilse: 1 öğe → tekli media; 2+ → koleksiyon (kind:"collection").
  const sendComposed = useCallback(async () => {
    if (selectedItems.length === 0) return;
    const items = selectedItems;
    const title = composeTitle.trim();
    const asPoll = pollMode && items.length >= 2;

    if (asPoll && !title) {
      toast.warning(
        i18nText("autoI18n.anket_sorusu_gerekli", "Anket sorusu gerekli"),
        i18nText("autoI18n.once_bir_soru_yaz", "Önce bir soru yaz"),
      );
      return;
    }

    let messageData;
    let previewText;
    if (asPoll) {
      previewText = "📊 " + title;
      messageData = {
        text: previewText,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        status: "sent",
        ...senderFields(),
        kind: "poll",
        poll: {
          question: title,
          type: "media",
          options: items.map((m) => ({
            id: String(m.media_type) + "-" + String(m.id),
            label: m.title,
            media: m,
          })),
          votes: {},
        },
      };
    } else if (items.length === 1) {
      const m = items[0];
      previewText = m.title;
      messageData = {
        text: m.title,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        status: "sent",
        ...senderFields(),
        media: m,
      };
    } else {
      previewText = title
        ? "📋 " + title
        : i18nText("autoI18n.n_icerik_paylasti", "📦 {{n}} içerik paylaştı", {
            n: items.length,
          });
      messageData = {
        text: previewText,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        status: "sent",
        ...senderFields(),
        kind: "collection",
        items,
        ...(title ? { listTitle: title } : {}),
      };
    }

    messageData = { ...messageData, ...replyFields() };

    // Modalı hemen kapat (optimistic), sonra yaz.
    resetCompose();
    setSearchResults([]);
    setSearchText("");
    setSearchOption(false);
    setSearchModalVisible(false);
    setSearchChoise(null);

    try {
      await addDoc(messagesRef, messageData);
      await finalizeThread(previewText);
      setReplyingTo(null);
    } catch (err) {
      console.error(i18nText("autoI18n.arama_sonucu_gonderme_hatasi", "Arama sonucu gönderme hatası:"), err);
      appAlert(i18nText("autoI18n.hata", "Hata"), i18nText("autoI18n.mesaj_gonderilemedi", "Mesaj gönderilemedi."));
    }
  }, [
    selectedItems,
    composeTitle,
    pollMode,
    messagesRef,
    currentUser.uid,
    replyFields,
    senderFields,
    finalizeThread,
    resetCompose,
  ]);

  const friendInitial = friendName ? friendName.charAt(0).toUpperCase() : "?";

  const handleHeaderPress = useCallback(() => {
    if (isGroup) {
      setGroupInfoVisible(true);
      return;
    }
    navigation.navigate("FriendProfileScreen", { friendUid, friendName });
  }, [isGroup, navigation, friendUid, friendName]);

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
        value: chatData.friendPresence?.lastSeen
          ? formatDate(chatData.friendPresence.lastSeen)
          : i18nText("autoI18n.bilinmiyor", "bilinmiyor"),
      });

  // Kategori butonları
  const CATEGORIES = [
    { key: "movie", label: i18nText("autoI18n.film", "Film"), icon: "film-outline", color: "#FF8A65" },
    { key: "tv", label: i18nText("autoI18n.dizi", "Dizi"), icon: "tv-outline", color: "#64B5F6" },
    { key: "person", label: i18nText("autoI18n.kisi", "Kişi"), icon: "person-outline", color: "#CE93D8" },
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.primary || "#0F0F1A" },
      ]}
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

        <TouchableOpacity
          activeOpacity={0.72}
          onPress={handleHeaderPress}
          style={styles.headerIdentity}
          accessibilityRole="button"
          accessibilityLabel={isGroup ? i18nText("autoI18n.grup_bilgilerini_ac", "Grup bilgilerini aç") : i18nText("autoI18n.arkadas_profilini_ac", "Arkadaş profilini aç")}
        >
        <View style={styles.avatarWrapper}>
          {isGroup ? (
            <GroupAvatar
              avatarIndex={groupData?.avatarIndex ?? groupAvatarIndex}
              color={groupData?.color || ACCENT}
              size={42}
              iconSize={29}
              style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)" }}
            />
          ) : (
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
          )}
          {!isGroup && (chatData.friendIsOnline || chatData.friendInChat) && (
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
            {isGroup ? groupData?.name || groupName || i18nText("autoI18n.grup", "Grup") : friendName}
          </Text>
          {isGroup ? (
            <Text
              allowFontScaling={false}
              style={[styles.headerStatus, { color: "rgba(255,255,255,0.5)" }]}
              numberOfLines={1}
            >
              {i18nText("autoI18n.n_uye", "{{n}} üye", { n: groupData?.members?.length || 0 })}
            </Text>
          ) : (
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
          )}
        </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerAction}
          onPress={handleHeaderPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={isGroup ? i18nText("autoI18n.grup_bilgilerini_ac", "Grup bilgilerini aç") : i18nText("autoI18n.arkadas_profilini_ac", "Arkadaş profilini aç")}
        >
          <Ionicons
            name={isGroup ? "people-outline" : "person-outline"}
            size={21}
            color="rgba(255,255,255,0.75)"
          />
        </TouchableOpacity>
      </View>

      <Reanimated.View
        style={[
          styles.container,
          { backgroundColor: "transparent" },
          inputAreaStyle,
        ]}
      >
          {/* ── MESAJ LİSTESİ ── */}
          {/* Arka plan dekor ikonu */}
          <View style={styles.iconBgWrapper} pointerEvents="none">
            <IconBacground opacity={0.5} />
          </View>
          {pinnedMessages.length > 0 && (
            <TouchableOpacity
              onPress={() => setPinnedModalVisible(true)}
              activeOpacity={0.82}
              style={styles.pinnedBanner}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.sabitlenmis_mesajlar", "Sabitlenmiş mesajlar")}
            >
              <View style={styles.pinnedBannerIcon}>
                <Ionicons name="pin" size={15} color="#B6B2FF" />
              </View>
              <View style={styles.pinnedBannerCopy}>
                <Text style={styles.pinnedBannerTitle} numberOfLines={1}>
                  {pinnedMessages[0].senderName || i18nText("autoI18n.sohbet_mesaji", "Mesaj")}
                </Text>
                <Text style={styles.pinnedBannerText} numberOfLines={1}>
                  {pinnedMessages[0].preview}
                </Text>
              </View>
              {pinnedMessages.length > 1 && (
                <View style={styles.pinnedCountBadge}>
                  <Text style={styles.pinnedCountText}>+{pinnedMessages.length - 1}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          )}
          <FlatList
            ref={flatListRef}
            style={styles.chatList}
            data={memoizedMessages}
            keyExtractor={(item) => item.clientId || item.id}
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
            onScrollToIndexFailed={() => {
              setMessageLimit((current) => current + 50);
            }}
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

          {/* FAB menüsü açıkken listeyi karartan / menüyü kapatan katman */}
          {attachMenuVisible && (
            <TouchableOpacity
              style={styles.attachBackdrop}
              activeOpacity={1}
              onPress={closeAttachMenu}
            />
          )}

          {/* ── INPUT ALANI ── */}
          <View style={styles.inputContainer}>
              {/* Düzenleme banner */}
              {replyingTo && (
                <View style={styles.replyingBanner}>
                  <MessageReplyPreview reply={replyingTo} composer />
                  <TouchableOpacity
                    onPress={() => setReplyingTo(null)}
                    hitSlop={8}
                    style={styles.replyingClose}
                    accessibilityLabel={i18nText("autoI18n.alintiyi_iptal_et", "Alıntıyı iptal et")}
                  >
                    <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.42)" />
                  </TouchableOpacity>
                </View>
              )}
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

              {/* FAB menüsü — anket & arama kısayolları */}
              {attachMenuVisible && (
                <View style={styles.attachMenuRow}>
                  <TouchableOpacity
                    style={styles.attachAction}
                    onPress={() => handleAttachOption("poll")}
                    disabled={composerTransitioning}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.attachActionIcon,
                        { backgroundColor: ACCENT_SOFT },
                      ]}
                    >
                      <Ionicons name="stats-chart" size={15} color={ACCENT} />
                    </View>
                    <Text style={styles.attachActionText} numberOfLines={1}>
                      {i18nText("autoI18n.metin_anketi", "Metin Anketi")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.attachAction}
                    onPress={() => handleAttachOption("search")}
                    disabled={composerTransitioning}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.attachActionIcon,
                        { backgroundColor: "rgba(94,232,160,0.14)" },
                      ]}
                    >
                      <Feather name="search" size={14} color={SEEN_COLOR} />
                    </View>
                    <Text style={styles.attachActionText} numberOfLines={1}>
                      {i18nText("autoI18n.film_dizi_ara", "Film & Dizi Ara")}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Tek parça hap: [+ FAB][input][gönder] */}
              <Animated.View
                style={[
                  styles.composerPill,
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

                {/* FAB — menüyü açar/kapatır */}
                <TouchableOpacity
                  style={styles.composerFab}
                  onPress={toggleAttachMenu}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={i18nText(
                    "autoI18n.anket_veya_arama_ac",
                    "Anket veya arama aç",
                  )}
                >
                  <Reanimated.View style={fabIconStyle}>
                    <Ionicons name="add" size={24} color="#fff" />
                  </Reanimated.View>
                </TouchableOpacity>

                <TextInput
                  ref={messageInputRef}
                  style={styles.input}
                  value={text}
                  multiline
                  numberOfLines={6}
                  onChangeText={handleTyping}
                  maxLength={2000}
                  placeholder={i18nText("autoI18n.mesaj_yazin", "Mesaj yazın...")}
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  selectionColor={ACCENT}
                />

                {/* Bağlantı algılandı göstergesi */}
                {textLink && !searchOption && (
                  <View style={styles.linkHint} pointerEvents="none">
                    <AntDesign name="link" size={14} color={SEEN_COLOR} />
                  </View>
                )}

                {/* Gönder butonu */}
                <TouchableOpacity
                  onPress={() => {
                    if (attachMenuVisible) closeAttachMenu();
                    sendMessage();
                  }}
                  activeOpacity={0.72}
                  disabled={!text.trim()}
                  style={[
                    styles.composerSend,
                    { opacity: text.trim() ? 1 : 0.32 },
                  ]}
                >
                  {editingMessage ? (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  ) : (
                    <Ionicons
                      name="send"
                      size={16}
                      color="#fff"
                      style={{ marginLeft: 1 }}
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>

        {/* ── # ARAMA MODALİ ── */}
        <BottomSheetModal
          visible={searchModalVisible}
          onClose={() => closeSearchModal(true)}
          intensity={35}
          dimColor="rgba(0,0,0,0.4)"
          // Bu sayfanın KENDİ klavye kaldırması var (modalKeyboardStyle →
          // paddingBottom). Kabuğunki de çalışsaydı ikisi toplanırdı.
          liftWithKeyboard={false}
          // autoFocus yerine: açılış animasyonu BİTTİKTEN sonra odakla.
          // Aksi halde açılış + klavye aynı anda çakışıp zıplama yapıyordu.
          onShow={() => {
            if (searchFocusTimerRef.current) {
              clearTimeout(searchFocusTimerRef.current);
            }
            searchFocusTimerRef.current = setTimeout(() => {
              searchInputRef.current?.focus();
              searchFocusTimerRef.current = null;
            }, 260);
          }}
        >
            <Reanimated.View style={modalKeyboardStyle}>
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
                      onPress={() => closeSearchModal()}
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
                      ref={searchInputRef}
                      value={searchText}
                      onChangeText={(val) => {
                        setSearchText(val);
                        fetchSearchResults(searchChoise, val);
                      }}
                      maxLength={80}
                      placeholder={i18nText("autoI18n.bir_seyler_yazin", "Bir şeyler yazın...")}
                      placeholderTextColor="rgba(255,255,255,0.25)"
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
                      extraData={selectedItems}
                      keyExtractor={(item) =>
                        (item.media_type || "x") + "-" + item.id
                      }
                      horizontal={false}
                      numColumns={3}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.searchGrid}
                      // Seçim tepsisi açıkken sonuç alanını kısalt → alttaki
                      // "Gönder" + seçilenler her zaman görünür kalır; sonuçlar
                      // FlatList içinde kaydırılır.
                      style={{
                        maxHeight:
                          SCREEN_HEIGHT *
                          (selectedItems.length > 0 ? 0.3 : 0.42),
                      }}
                      renderItem={({ item }) => (
                        <SearchResultCard
                          item={item}
                          onPress={toggleSelectItem}
                          selected={isItemSelected(item)}
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

                  {/* ── COMPOSE TEPSİSİ (seçilenler + gönder) ── */}
                  {selectedItems.length > 0 && (
                    <View style={styles.composeTray}>
                      {/* Aktif liste tipi rozeti (tek tip: oyuncu | dizi/film) */}
                      <View style={styles.composeTypeRow}>
                        {(() => {
                          const isPerson = categoryOf(selectedItems[0].media_type) === "person";
                          return (
                            <View style={styles.composeTypeBadge}>
                              <Ionicons
                                name={isPerson ? "people-outline" : "film-outline"}
                                size={12}
                                color={ACCENT}
                              />
                              <Text style={styles.composeTypeText}>
                                {isPerson
                                  ? i18nText("autoI18n.oyuncu_listesi", "Oyuncu listesi")
                                  : i18nText("autoI18n.dizifilm_listesi", "Dizi/Film listesi")}
                              </Text>
                            </View>
                          );
                        })()}
                        <Text style={styles.composeCountText}>{selectedItems.length}/{MAX_SELECT}</Text>
                      </View>

                      {/* Seçilen küçük posterler */}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.composeThumbsRow}
                      >
                        {selectedItems.map((it) => (
                          <View key={itemKey(it)} style={styles.composeThumb}>
                            {it.poster_path ? (
                              <Image
                                source={{ uri: getTmdbUrl(it.poster_path, "poster", 200) }}
                                style={styles.composeThumbImg}
                              />
                            ) : (
                              <View style={[styles.composeThumbImg, styles.searchCardPlaceholder]}>
                                <FontAwesome name="image" size={16} color="rgba(255,255,255,0.25)" />
                              </View>
                            )}
                            <TouchableOpacity
                              style={styles.composeThumbRemove}
                              onPress={() => toggleSelectItem(it)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="close" size={11} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>

                      {/* Liste / Anket modu (2+ dizi/film; oyuncuda anket yok) */}
                      {selectedItems.length >= 2 &&
                        categoryOf(selectedItems[0].media_type) === "media" && (
                          <View style={styles.modeRow}>
                            <TouchableOpacity
                              style={[styles.modeBtn, !pollMode && styles.modeBtnActive]}
                              onPress={() => { easeLayout(); setPollMode(false); }}
                            >
                              <Ionicons name="albums-outline" size={14} color={!pollMode ? ACCENT : "rgba(255,255,255,0.5)"} />
                              <Text style={[styles.modeBtnText, !pollMode && { color: ACCENT }]}>{i18nText("autoI18n.liste", "Liste")}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.modeBtn, pollMode && styles.modeBtnActive]}
                              onPress={() => { easeLayout(); setPollMode(true); setShowTitleInput(true); }}
                            >
                              <Ionicons name="stats-chart" size={14} color={pollMode ? ACCENT : "rgba(255,255,255,0.5)"} />
                              <Text style={[styles.modeBtnText, pollMode && { color: ACCENT }]}>{i18nText("autoI18n.anket", "Anket")}</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                      {/* Başlık (liste) veya soru (anket) */}
                      {selectedItems.length >= 2 &&
                        (pollMode ? (
                          <View style={[styles.composeTitleWrap, { borderColor: ACCENT + "66" }]}>
                            <Ionicons name="help-circle-outline" size={16} color={ACCENT} />
                            <TextInput
                              value={composeTitle}
                              onChangeText={setComposeTitle}
                              placeholder={i18nText("autoI18n.anket_sorusu", "Anket sorusu (örn. Hangisini izleyelim?)")}
                              placeholderTextColor="rgba(255,255,255,0.3)"
                              style={styles.composeTitleInput}
                              selectionColor={ACCENT}
                              maxLength={80}
                            />
                          </View>
                        ) : showTitleInput ? (
                          <View style={styles.composeTitleWrap}>
                            <Ionicons name="list" size={15} color={ACCENT} />
                            <TextInput
                              value={composeTitle}
                              onChangeText={setComposeTitle}
                              placeholder={i18nText("autoI18n.liste_basligi_ops", "Liste başlığı (örn. Bu akşam ne izlesek?)")}
                              placeholderTextColor="rgba(255,255,255,0.3)"
                              style={styles.composeTitleInput}
                              selectionColor={ACCENT}
                              maxLength={60}
                            />
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.composeAddTitle}
                            onPress={() => {
                              easeLayout();
                              setShowTitleInput(true);
                            }}
                          >
                            <Ionicons name="add-circle-outline" size={15} color="rgba(255,255,255,0.6)" />
                            <Text style={styles.composeAddTitleText}>{i18nText("autoI18n.liste_adi_ekle", "Liste adı ekle")}</Text>
                          </TouchableOpacity>
                        ))}

                      {/* Aksiyon satırı */}
                      <View style={styles.composeActions}>
                        <TouchableOpacity onPress={resetCompose} style={styles.composeClearBtn}>
                          <Text style={styles.composeClearText}>{i18nText("autoI18n.temizle", "Temizle")}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={sendComposed} style={styles.composeSendBtn} activeOpacity={0.85}>
                          <Ionicons name={pollMode ? "stats-chart" : "send"} size={15} color="#fff" />
                          <Text style={styles.composeSendText}>
                            {pollMode
                              ? i18nText("autoI18n.anket_olustur", "Anket Oluştur")
                              : i18nText("autoI18n.gonder", "Gönder") + " (" + selectedItems.length + ")"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
            </Reanimated.View>
        </BottomSheetModal>

        {/* ── UZUN BASIN MODAL ── */}
        {optionsVisible && selectedMessage && (
          <BottomSheetModal
            visible={optionsVisible}
            onClose={() => setOptionsVisible(false)}
            intensity={35}
            dimColor="rgba(0,0,0,0.4)"
            sheetStyle={styles.modalSheet}
          >
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
                          ? i18nText("autoI18n.film", "Film")
                          : selectedMessage.media.media_type === "tv"
                            ? i18nText("autoI18n.dizi", "Dizi")
                            : i18nText("autoI18n.oyuncu", "Oyuncu")}
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
                    onPress={() => beginReply(selectedMessage)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionIconBox, { backgroundColor: "rgba(108,99,255,0.16)" }]}>
                      <Ionicons name="arrow-undo" size={20} color="#A9A5FF" />
                    </View>
                    <View style={styles.actionRowText}>
                      <Text style={styles.actionRowTitle}>{i18nText("autoI18n.yanitla", "Yanıtla")}</Text>
                      <Text style={styles.actionRowSub}>{i18nText("autoI18n.mesaji_alintila", "Mesajı alıntılayarak yanıtla")}</Text>
                    </View>
                  </TouchableOpacity>

                  {(canPinSelected || canUnpinSelected) && (
                    <TouchableOpacity
                      style={styles.actionRowL}
                      onPress={() =>
                        canUnpinSelected
                          ? unpinMessage(selectedPin)
                          : pinMessage(selectedMessage)
                      }
                      disabled={busyPinId === selectedMessage.id}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.actionIconBox, { backgroundColor: "rgba(255,193,7,0.13)" }]}>
                        <Ionicons
                          name={canUnpinSelected ? "pin-outline" : "pin"}
                          size={20}
                          color="#FFD166"
                        />
                      </View>
                      <View style={styles.actionRowText}>
                        <Text style={styles.actionRowTitle}>
                          {canUnpinSelected
                            ? i18nText("autoI18n.sabitlemeyi_kaldir", "Sabitlemeyi kaldır")
                            : i18nText("autoI18n.mesaji_sabitle", "Mesajı sabitle")}
                        </Text>
                        <Text style={styles.actionRowSub}>
                          {canUnpinSelected
                            ? i18nText("autoI18n.sabitlerden_cikar", "Sabitlenmiş mesajlardan çıkar")
                            : i18nText("autoI18n.sohbetin_ustunde_goster", "Sohbetin üstünde göster")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Düzenleme yalnızca düz metin mesajlarda gösterilir;
                      paylaşılan media/koleksiyon mesajının metni başlıktır,
                      düzenlenmesi anlamsızdır. */}
                  {canEditSelected && (
                    <TouchableOpacity
                      style={styles.actionRowL}
                      onPress={() => {
                        setReplyingTo(null);
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
                  )}

                  {canDeleteSelected && (
                    <TouchableOpacity
                      style={styles.actionRowR}
                      onPress={() => deleteMessage(selectedMessage)}
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
                  )}
                </View>

                {/* İptal butonu */}
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setOptionsVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>{i18nText("autoI18n.iptal", "İptal")}</Text>
                </TouchableOpacity>
          </BottomSheetModal>
        )}

        <PinnedMessagesModal
          visible={pinnedModalVisible}
          pins={pinnedMessages}
          locale={locale}
          onClose={() => setPinnedModalVisible(false)}
          onJump={jumpToMessage}
          onUnpin={unpinMessage}
          canRemovePin={canRemovePin}
        />

        <TrailerModal
          visible={!!trailerMedia}
          mediaType={trailerMedia?.media_type}
          id={trailerMedia?.id}
          apiKey={API_KEY}
          onClose={() => setTrailerMedia(null)}
        />

        <TextPollComposer
          visible={textPollVisible}
          onClose={closeTextPollModal}
          onCreate={sendTextPoll}
          keyboardAvoidanceStyle={modalKeyboardStyle}
        />

        {isGroup && (
          <GroupInfoModal
            visible={groupInfoVisible}
            onClose={() => setGroupInfoVisible(false)}
            groupId={groupId}
            groupData={groupData}
            currentUid={currentUser.uid}
            onOpenProfile={(uid, name) => {
              setGroupInfoVisible(false);
              navigation.navigate("FriendProfileScreen", { friendUid: uid, friendName: name });
            }}
          />
        )}
      </Reanimated.View>
    </View>
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
  headerIdentity: { flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0 },
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
  pinnedBanner: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(108,99,255,0.22)",
    backgroundColor: "rgba(20,20,38,0.96)",
    zIndex: 2,
  },
  pinnedBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(108,99,255,0.16)",
  },
  pinnedBannerCopy: { flex: 1, marginHorizontal: 9 },
  pinnedBannerTitle: { color: "#B8B4FF", fontSize: 10.5, fontWeight: "800" },
  pinnedBannerText: { color: "rgba(255,255,255,0.7)", fontSize: 12.5, marginTop: 2 },
  pinnedCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginRight: 5,
    backgroundColor: "rgba(108,99,255,0.18)",
  },
  pinnedCountText: { color: "#C3C0FF", fontSize: 10.5, fontWeight: "800" },

  // wrapper — hizalama için
  myMsgWrapper: { alignItems: "flex-end", marginVertical: 3 },
  friendMsgWrapper: { alignItems: "flex-start", marginVertical: 3 },

  // grup: gönderen başlığı
  senderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 8,
    marginBottom: 3,
  },
  senderAvatar: { width: 20, height: 20, borderRadius: 10 },
  senderAvatarPh: { justifyContent: "center", alignItems: "center" },
  senderAvatarInitial: { color: "#fff", fontSize: 10, fontWeight: "800" },
  senderName: { fontSize: 11.5, fontWeight: "800", maxWidth: 180 },
  // Ardışık aynı-gönderici mesajlar: dikey aralık 6px -> 1px (üst 0 + alt 1).
  groupedTop: { marginTop: 0 },
  groupedBottom: { marginBottom: 3 },

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
  mediaMessage: {
    maxWidth: "88%",
  },
  myMsg: {
    backgroundColor: "#17245cff",
    borderTopRightRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(108,99,255,0.35)",
  },
  myGroupedBottomCorner: {
    borderBottomRightRadius: 6,
  },
  friendMsg: {
    backgroundColor: "rgba(68, 68, 68, 1)",
    borderTopLeftRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  friendGroupedBottomCorner: {
    borderBottomLeftRadius: 6,
  },
  messageText: { fontSize: 15, lineHeight: 22, color: "#fff" },
  highlightedMessage: {
    borderColor: "#FFD166",
    borderWidth: 1.5,
    shadowColor: "#FFD166",
    shadowOpacity: 0.34,
  },
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
  // Şeridin kendisi tamamen saydam; gölge yalnızca composerPill üzerinde.
  // (Android'de saydam bg + elevation kombinasyonu tüm şeride dikdörtgen
  // gölge düşürdüğünden elevation burada kullanılmıyor.)
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 8 : 12,
    zIndex: 20,
  },
  replyingBanner: {
    flexDirection: "row",
    alignItems: "center",
  },
  replyingClose: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    marginBottom: 9,
  },
  composerPill: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1.5,
    borderRadius: 28,
    backgroundColor: "rgba(26,26,42,0.97)",
    padding: 5,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 10,
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
  composerFab: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  composerSend: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "ios" ? 11 : 8,
    paddingBottom: Platform.OS === "ios" ? 11 : 8,
    fontSize: 15,
    maxHeight: 130,
    color: "#fff",
  },
  linkHint: {
    height: 42,
    justifyContent: "center",
    paddingRight: 8,
  },
  attachBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 15,
  },
  attachMenuRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  attachAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(26,26,42,0.97)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  attachActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  attachActionText: {
    flex: 1,
    color: "rgba(255,255,255,0.9)",
    fontSize: 13.5,
    fontWeight: "600",
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
  searchCardSelected: {
    transform: [{ scale: 0.96 }],
  },
  searchCardImageWrap: {
    width: "100%",
    aspectRatio: 2 / 3,
    position: "relative",
  },
  searchCardSelectedOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 13,
    borderWidth: 2.5,
    borderColor: ACCENT,
    backgroundColor: "rgba(108,99,255,0.18)",
  },
  selectDot: {
    position: "absolute",
    bottom: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  selectDotActive: {
    backgroundColor: ACCENT,
    borderColor: "#fff",
  },
  searchCardImage: {
    width: "100%",
    height: "100%",
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  searchCardPlaceholder: { justifyContent: "center", alignItems: "center" },

  // ── Compose tepsisi ──────────────────────────────────────
  composeTray: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 10,
  },
  composeTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  composeTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: ACCENT_SOFT,
    borderWidth: 1,
    borderColor: ACCENT + "44",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  composeTypeText: { color: "#fff", fontSize: 11.5, fontWeight: "700" },
  composeCountText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11.5,
    fontWeight: "700",
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  modeBtnActive: { backgroundColor: ACCENT_SOFT, borderWidth: 1, borderColor: ACCENT + "55" },
  modeBtnText: { color: "rgba(255,255,255,0.5)", fontSize: 12.5, fontWeight: "800" },
  // Üst/sağ padding: taşan "×" rozetinin ScrollView kenarında kırpılmaması için.
  composeThumbsRow: { gap: 8, paddingTop: 8, paddingRight: 10, paddingLeft: 2 },
  composeThumb: {
    width: 46,
    height: 69,
    borderRadius: 8,
    position: "relative",
  },
  composeThumbImg: {
    width: 46,
    height: 69,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  composeThumbRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: DANGER,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#0F0F1A",
  },
  composeTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  composeTitleInput: {
    flex: 1,
    color: "#fff",
    fontSize: 13.5,
    paddingVertical: 10,
  },
  composeAddTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  composeAddTitleText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12.5,
    fontWeight: "600",
  },
  composeActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  composeClearBtn: { paddingVertical: 8, paddingHorizontal: 6 },
  composeClearText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600",
  },
  composeSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  composeSendText: { color: "#fff", fontSize: 13.5, fontWeight: "800" },
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
    flexDirection: "column",
    alignItems: "stretch",
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
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionRowR: {
    width: "100%",
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
  actionRowText: { flex: 1 },
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
});
