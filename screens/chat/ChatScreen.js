import { intlLocaleOf, tmdbLanguageOf } from "../../utils/appLanguages";
import { isLightSurface } from "@utils/colorUtils";
import ComposerBlur, {
  COMPOSER_GLASS_PILL_STYLE,
  COMPOSER_TARGET_IS_NATIVE,
  ComposerBlurTarget,
  useComposerBlurTarget,
} from "../../components/chat/ComposerBlur";
import { useLiquidGlass } from "../../services/liquidGlass";
import { Image } from "expo-image";
import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import UserAvatar from "../../components/common/UserAvatar";

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
  ActivityIndicator,
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
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  setDoc,
  writeBatch,
  limit,
  startAfter,
  endAt,
  deleteField,
  increment,
  getDoc,
} from "firebase/firestore";
import { trackFirestoreRead } from "../../services/usageTrackerService";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "../../theme/colors";
import LottieView from "lottie-react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAmbientBackgroundSettings,
  useApiSettings,
  useContentSettings,
  useHapticsSettings,
  useImageQualitySettings,
} from "@context/AppSettingsContext";
import * as Haptics from "@services/hapticsService";
import { useLanguage } from "@context/LanguageContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { avatarSnapshot } from "@utils/avatarPhotos";
import { useUserProfile } from "@context/UserProfileContext";
import { createSocialNotification } from "@services/socialNotificationsService";
import { prepareOutgoingMessage } from "@utils/chatPush";
import { invitationFieldsFromShare } from "@utils/importantInvites";
import { respondMatchingInvitations } from "@services/notificationsService";
import { inviteResponsePatch } from "@services/chatInviteService";
import { applyReceipts, newestIncoming, shouldMarkRead } from "@utils/chatReceipts";
import { createMessagePager } from "@services/chatMessagePager";
import { isOnlineVisible } from "@services/presenceService";
import {
  createTypingController,
  enterChat,
  leaveChat,
  setTyping,
  subscribeChatMeta,
} from "@services/chatRtdb";
import { enterActiveChat } from "@services/activeChatTracker";
import { dismissChatNotifications } from "@services/pushNotificationsService";
import { useIsFocused } from "@react-navigation/native";
import {
  subscribeGroup,
  nextVote,
  groupInboxDoc,
  queueGroupUnreadIncrements,
} from "@services/groupsService";
import axios from "axios";
import {
  AntDesign,
    Feather,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import ScreenDecor from "@components/ScreenDecor"; // Arka plan dekor
import BottomSheetModal from "@components/common/BottomSheetModal";
import SheetScroll from "@components/common/SheetScroll";
import GlassCloseButton from "@components/common/GlassCloseButton";
import GlassIconButton from "@components/common/GlassIconButton";
import { i18nText } from "@utils/i18nText";
import { appAlert } from "@components/AppAlert";
import { toast } from "@components/AppToast";
import MessageBubble, { openMediaDetail } from "@components/chat/MessageBubble";
import SharedListSheet from "@components/chat/SharedListSheet";
import ChatHeader, { CHAT_HEADER_AVATAR_SIZE } from "@components/chat/ChatHeader";
import BounceIn from "@components/chat/BounceIn";
import useReduceMotion from "../../hooks/useReduceMotion";
import useAppActive from "../../hooks/useAppActive";
import useDecorVisibility from "../../hooks/useDecorVisibility";
import {
  detectFreshMessages,
  entranceFor,
  recordFresh,
} from "@utils/chatEntrance";
import TextPollComposer from "@components/chat/TextPollComposer";
import GroupInfoModal from "@components/chat/GroupInfoModal";
import GroupAvatar from "@components/chat/GroupAvatar";
import ComposerReplyBar from "@components/chat/ComposerReplyBar";
import { buildReplySnapshot } from "@utils/chatReply";
import { buildShareMessage, readShare, sharePreview } from "@utils/chatShare";
import {
  CHAT_SEARCH_DEBOUNCE_MS,
  CHAT_SEARCH_MIN_CHARS,
  chatSearchKey,
  isSearchableQuery,
  parseSearchQuery,
  rankChatSearchResults,
} from "@utils/chatMediaSearch";
import { mediaMetaLabel } from "@components/chat/SharedMediaCollection";
import { searchMediaWithFuzzyFallback } from "@services/fuzzyMediaSearch";
import { PosterEdge } from "@components/chat/shareKit";
import SaveSharedListModal from "@components/modals/SaveSharedListModal";
import PinnedMessagesModal from "@components/chat/PinnedMessagesModal";
import ReportReasonSheet from "@components/moderation/ReportReasonSheet";
import { useFriends } from "@context/FriendsContext";
import { reportMessage } from "@services/reportService";
import {
  canManageGroup,
  isGroupCreator,
} from "@utils/groupRoles";
import {
  createMessageClientId,
  mergeServerMessages,
  removeOptimisticMessage,
} from "@utils/chatOptimistic";
import {
  isLatestMessage,
  latestAfterDelete,
  previewOf,
} from "@utils/threadPreview";
import Reanimated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import TrailerModal from "@components/video/TrailerModal";
import GlassTouchable from "../../components/common/GlassTouchable";
import GlassBox from "../../components/common/GlassBox";


const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Sabit renkler (tema üzerine katman) ────────────────────────────────────
const ACCENT = "#6C63FF";
const ACCENT_SOFT = "rgba(108,99,255,0.15)";
const SEEN_COLOR = "#5EE8A0";
const DANGER = "#FF6B6B";
const EDIT_COLOR = "#4FC3F7";
const LATEST_MESSAGE_BUTTON_THRESHOLD = 420;

// Arka plan dekoru katmanlara BÖLÜNÜR (ScreenDecor `effects`):
//   • ambiyans → kökte, TAM EKRAN: başlığın arkası ve güvenli alan şeridi de dolsun.
//     Mesaj alanının içine konunca üstte başlık, altta `paddingBottom` şeridi
//     ambiyanssız kalıyor, lekeler de o kadar kırpılıyordu.
//   • ikon deseni → mesaj hedefinin İÇİNDE (Android blur'ü onu da görsün).
const AMBIENT_ONLY = ["ambient"];
const ICON_ONLY = ["icon"];
const AMBIENT_FRAME_HEIGHT = Dimensions.get("screen").height;

// ─── Tarih yardımcıları (mesaj gruplama + gün ayracı) ───────────────────────
const tsToDate = (ts) => {
  if (!ts) return null;
  try {
    return ts.toDate ? ts.toDate() : new Date(ts);
  } catch {
    return null;
  }
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
  return date.toLocaleDateString(intlLocaleOf(language), {
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
  const share = readShare(message);
  if (share) return sharePreview(share);
  if (Array.isArray(message.items) && message.items.length > 0) {
    return message.listTitle || i18nText("autoI18n.n_icerik", "{{n}} içerik", { n: message.items.length });
  }
  if (message.media) {
    return message.media.title || message.text || i18nText("autoI18n.medya", "Medya");
  }
  return String(message.text || i18nText("autoI18n.sohbet_mesaji", "Mesaj")).slice(0, 180);
};

const timestampMs = (value) => value?.toMillis?.() || value?.toDate?.()?.getTime?.() || 0;

// Mesaj sayfaları (services/chatMessagePager.js): açılışta ve her "daha eski"de
// bu kadar mesaj; alıntıya atlamada daha büyük sayfa, en çok 6 sayfa (≈300 mesaj).
const MESSAGE_PAGE_SIZE = 30;
const JUMP_PAGE_SIZE = 50;
const JUMP_MAX_PAGES = 6;

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

  const title = item.title || item.name;
  const meta = mediaMetaLabel(item);
  const accent = theme?.accent ?? ACCENT;
  const poster = item.poster_path || item.profile_path;

  return (
    <Animated.View style={[styles.searchCardSlot, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.searchCard}
        onPress={() => onPress(item)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${title}, ${meta}`}
      >
        {/* Poster + rozetler tek oran-kutusunda → tüm absolute öğeler postere
            göre hizalanır (tik kart altına kaymaz). */}
        <View style={styles.searchCardImageWrap}>
          {poster ? (
            <Image
              source={{ uri: getTmdbUrl(poster, "poster", 200) }}
              style={[styles.searchCardImage, { backgroundColor: theme.between }]}
              cachePolicy="memory-disk"
              transition={120}
            />
          ) : (
            <View
              style={[
                styles.searchCardImage,
                styles.searchCardPlaceholder,
                { backgroundColor: theme.between },
              ]}
            >
              <Ionicons
                name={item.media_type === "person" ? "person-outline" : "film-outline"}
                size={24}
                color={theme.text.muted}
              />
            </View>
          )}
          {/* Kenar çizgisi görselin ÜSTÜNDE (borderWidth afişi kırpardı). */}
          <PosterEdge radius={12} color={alpha(theme.text.primary, 0.1)} />

          {item.media_type !== "person" && item.vote_average > 0 && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={9} color="#FFD54F" />
              <Text allowFontScaling={false} style={styles.ratingText}>
                {Number(item.vote_average).toFixed(1)}
              </Text>
            </View>
          )}

          {selected && (
            <View
              pointerEvents="none"
              style={[
                styles.searchCardSelectedOverlay,
                { borderColor: accent, backgroundColor: alpha(accent, 0.22) },
              ]}
            />
          )}
          {/* Seçim işareti: sağ üst köşe; seçili değilken boş halka. */}
          <View
            style={[
              styles.selectDot,
              selected && { backgroundColor: accent, borderColor: "#fff" },
            ]}
          >
            {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
        </View>

        <Text
          style={[styles.searchCardTitle, { color: theme.text.primary }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text
          style={[styles.searchCardMeta, { color: theme.text.muted }]}
          numberOfLines={1}
        >
          {meta}
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
    initialMedia,
    initialMediaKey,
    initialShare,
    initialShareKey,
  } = route.params;
  const isGroup = !!groupId;
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const { language } = useLanguage();
  const locale = intlLocaleOf(language);

  const { API_KEY } = useApiSettings();
  const { hapticsEnabled } = useHapticsSettings();
  const [trailerMedia, setTrailerMedia] = useState(null);
  const { adultContent } = useContentSettings();
  const { block, isBlocked, isFriend, loading: friendsLoading } = useFriends();
  const { myAvatar, avatars } = useProfileUi();
  const {
    displayName: profileDisplayName,
    username: profileUsername,
  } = useUserProfile();
  // Gönderen kimliğine yazılan avatar: tek kaynak (ProfileUiContext.myAvatar).
  const mySnapshot = avatarSnapshot(myAvatar);
  const [groupData, setGroupData] = useState(null); // grup modunda doc
  const [friendIdentity, setFriendIdentity] = useState(() => ({
    displayName: friendName || "",
    username: "",
    avatarIndex:
      typeof friendAvatarIndex === "number" ? friendAvatarIndex : 0,
    photoURL: null,
  }));
  const { getTmdbUrl } = useImageQualitySettings();
  const [editingMessage, setEditingMessage] = useState(null);
  const [text, setText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [optionsVisible, setOptionsVisible] = useState(false);
  // Şikâyet sayfasının hedefi (mesaj nesnesi); null ise sayfa kapalı.
  const [reportTarget, setReportTarget] = useState(null);
  const [textLink, setTextLink] = useState(false);

  const [searchChoise, setSearchChoise] = useState(null); // null | "movie" | "tv" | "person"
  const [searchOption, setSearchOption] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  // Ekrandaki sonuçların ait olduğu arama (chatSearchKey) — "sonuç yok" ile
  // "henüz aranmadı"yı ayırır.
  const [searchedKey, setSearchedKey] = useState(null);
  const searchSeqRef = useRef(0); // yalnız en son isteğin cevabı yazılır
  const searchTimerRef = useRef(null); // yazarken bekleme (debounce)
  const searchCacheRef = useRef(new Map()); // chatSearchKey → sıralı sonuçlar
  const [searchModalVisible, setSearchModalVisible] = useState(false);

  // ── Çoklu içerik seçimi (compose tepsisi) ──────────────────────────────────
  // Arama sonucunda postere basınca ANINDA göndermek yerine seçime ekler.
  // 1 öğe → tekli media mesajı; 2+ öğe → koleksiyon (opsiyonel başlık + 🎲).
  const [selectedItems, setSelectedItems] = useState([]);
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
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
  const pagerRef = useRef(null);           // imleçli mesaj sayfaları (chatMessagePager)
  const scrollRetryRef = useRef(0);        // scrollToIndex yeniden deneme sayacı
  const typingCtrlRef    = useRef(null);   // "yazıyor" bayrağı (ilk tuşta yaz, boşta kapat)
  const messageInputRef  = useRef(null);
  const searchInputRef   = useRef(null);   // arama input — modal açıldıktan SONRA odakla
  const pendingComposerRef = useRef(null); // "search" | "poll"
  const composerTimerRef = useRef(null);
  const searchFocusTimerRef = useRef(null);
  const keyboardVisibleRef = useRef(Keyboard.isVisible());
  const highlightTimerRef = useRef(null);
  const pendingJumpIdRef = useRef(null);
  const [composerTransitioning, setComposerTransitioning] = useState(false);
  const [showLatestMessageButton, setShowLatestMessageButton] = useState(false);
  const [composerHeight, setComposerHeight] = useState(76);
  const composerBlur = useComposerBlurTarget();
  const glass = useLiquidGlass();

  // Ambiyans bu sohbette görünüyor mu (genel anahtar VE "Ekran bazında > Sohbet
  // içi")? Başlık yalnız o zaman yarı saydam olur; kapalıyken eskisi gibi opak.
  const { showAmbientBackground } = useAmbientBackgroundSettings();
  const ambientScopeVisible = useDecorVisibility("conversation", AMBIENT_ONLY).ambient;
  const ambientVisible = showAmbientBackground && ambientScopeVisible;

  // Yalnız Android 12+ (BlurTargetView): hedefin opak arka planı kökteki ambiyansı
  // örter, bu yüzden hedefin içine AYNI desenin ekranla hizalı bir kopyası konur.
  // Hizalama için mesaj alanının pencere içindeki üst konumu gerekir (başlık +
  // sabitlenmiş mesaj bandı yüksekliği). iOS'ta/eski Androidde hedef sıradan bir
  // View ve saydam: tek ambiyans kökte kalır, ölçüm yok.
  const messageViewportRef = useRef(null);
  const [messageViewportTop, setMessageViewportTop] = useState(0);
  const measureMessageViewport = useCallback(() => {
    if (!COMPOSER_TARGET_IS_NATIVE) return;
    messageViewportRef.current?.measureInWindow?.((_x, y) => {
      if (!Number.isFinite(y)) return;
      setMessageViewportTop((prev) => (Math.abs(prev - y) < 0.5 ? prev : y));
    });
  }, []);

  const latestButtonVisibleRef = useRef(false);
  const handledInitialMediaRef = useRef(null);
  const handledInitialShareRef = useRef(null);
  // Alıcının "Listeyi kaydet"i: görünürlük ile liste ayrı tutulur ki kapanış
  // animasyonu sürerken sayfa içeriği (ad, afişler) boşalmasın.
  const [saveListPost, setSaveListPost] = useState(null);
  const [saveListVisible, setSaveListVisible] = useState(false);
  // Balondaki yığın karta basınca açılan tam liste sayfası. Görünürlük ile liste
  // ayrı: kapanış animasyonu sürerken sayfa içeriği boşalmasın. Sayfadaki
  // "Listeyi kaydet" kayıt modalını AÇMAZ, ref'e yazar; kayıt modalı sayfa
  // tamamen kalkınca açılır (iOS iki Modal'ı üst üste sunamaz).
  const [listSheet, setListSheet] = useState(null);
  const [listSheetVisible, setListSheetVisible] = useState(false);
  const pendingSavePostRef = useRef(null);
  const { theme } = useTheme();

  const handleMessageListScroll = useCallback((event) => {
    const nextVisible =
      (event?.nativeEvent?.contentOffset?.y || 0) > LATEST_MESSAGE_BUTTON_THRESHOLD;
    if (latestButtonVisibleRef.current === nextVisible) return;
    latestButtonVisibleRef.current = nextVisible;
    setShowLatestMessageButton(nextVisible);
  }, []);

  const scrollToLatestMessage = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    latestButtonVisibleRef.current = false;
    setShowLatestMessageButton(false);
  }, []);

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
    // Bekleyen/uçuştaki arama kapanmış sayfaya sonuç yazmasın.
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    searchSeqRef.current += 1;
    setLoadingSearch(false);
    setSearchedKey(null);
    setSearchModalVisible(false);
    setSearchResults([]);
    setSearchText("");
    setSearchOption(false);
    setShowSelectedPanel(false);
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
    // İlk mesaj snapshot'ı geldi mi? Yüklenmeden önceki boş liste "boş sohbet"
    // sayılmasın ki ilk yükleme yeni mesaj animasyonu tetiklemesin.
    loaded: false,
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

  // Davet kartları (CineSwipe odası, günlük düello) kabul edilince sonucun yazılacağı sohbet: bu sohbet.
  // Alan adları ekran parametreleriyle aynı (utils/importantInvites.chatTargetOf).
  const resolvedChatName = isGroup
    ? groupData?.name || groupName || ""
    : friendIdentity.displayName || friendName || "";
  const chatTarget = useMemo(
    () =>
      isGroup
        ? { groupId, groupName: resolvedChatName }
        : { friendUid, friendName: resolvedChatName },
    [isGroup, groupId, friendUid, resolvedChatName],
  );

  // Davet kartından yanıt (kabul / ret; CineSwipe odası ya da günlük düello). İki yere yazılır, hatalar
  // birbirini ve gezinmeyi engellemez:
  //   • mesaja kendi anahtarım (accepts / declines; firestore.rules → inviteAnswer): iki tarafın kartı
  //     "kabul edildi" / "reddedildi"ye döner (utils/chatInvites),
  //   • aynı davetin bildirim kaydı: Profil'deki önemli davetler çubuğu aynı şeyi yeniden sormasın.
  const answerInviteFromCard = useCallback(
    (share, senderUid, messageId, response = "accepted") => {
      if (!senderUid || senderUid === currentUser.uid) return;
      const invitation = invitationFieldsFromShare(share);
      const patch = inviteResponsePatch(currentUser.uid, response);
      if (!invitation || !patch) return;
      if (messageId) {
        updateDoc(doc(messagesRef, messageId), patch).catch((err) => {
          if (__DEV__) console.warn("inviteAnswer:", err?.message);
        });
      }
      respondMatchingInvitations(
        currentUser.uid,
        { ...invitation, fromUid: senderUid, groupId: isGroup ? groupId : null, messageId },
        response,
      ).catch(() => {});
    },
    [currentUser.uid, isGroup, groupId, messagesRef],
  );

  const currentUserIsCreator = isGroupCreator(groupData, currentUser.uid);
  const currentUserCanManageGroup = canManageGroup(groupData, currentUser.uid);

  // "Sohbet ekranda" durumu EKRANIN ODAĞINA bağlı, yalnız mount'a değil.
  // ChatScreen yığında kalıp üstüne başka ekran (arkadaş profili, başka bir
  // sohbet) açıldığında kullanıcı artık bu sohbeti görmüyor: o sırada gelen
  // mesaj için bildirim çıkmalı, okunmamış sayacı da sıfırlanmamalı. Eskiden
  // her şey mount'a bağlıydı; üstteki ekran kapanınca alttaki sohbet "açık
  // değil" sayılıyor ya da bakılmayan sohbetin bildirimi bastırılıyordu.
  const isFocused = useIsFocused();

  // Kullanıcı bu sohbeti GERÇEKTEN görüyor mu: ekran odakta VE uygulama ön
  // planda. Odak tek başına yetmez — uygulama arka plana atılınca React
  // Navigation ekranı odakta tutar; o sırada gelen mesaj "okundu" işaretleniyor,
  // okunmamış sayacı (rozet) sıfırlanıyor ve karşı taraf "Sohbette" görüyordu.
  const appActive = useAppActive();
  const isViewing = isFocused && appActive;

  // "Yazıyor" bayrağı: ilk tuşta hemen yazılır, 4 sn hareketsizlikte / gönderince /
  // odak kaybında kapanır (services/chatSignals.js). Grupta typing yok.
  useEffect(() => {
    if (isGroup) return undefined;
    const ctrl = createTypingController({
      send: (value) => setTyping(chatId, currentUser.uid, value),
    });
    typingCtrlRef.current = ctrl;
    return () => {
      ctrl.stop();
      if (typingCtrlRef.current === ctrl) typingCtrlRef.current = null;
    };
  }, [isGroup, chatId, currentUser.uid]);

  // Çevrimiçi/typing/inChat (RTDB) yalnızca 1-1 modunda. Grupta per-üye presence
  // gösterilmez (üye sayısı header'da). enterChat/leaveChat sadece 1-1.
  // Sunucu push'u bu bayrağa bakıp mesajı atlıyor (functions/index.js).
  useEffect(() => {
    if (isGroup || !isViewing) return undefined;
    enterChat(chatId, currentUser.uid);
    return () => {
      // Görünmez olunca "yazıyor" da kapanmalı: denetleyici bayrağı hâlâ açık
      // sanırsa dönüşteki ilk tuş hiç yazılmazdı.
      typingCtrlRef.current?.stop();
      leaveChat(chatId, currentUser.uid);
    };
  }, [isGroup, isViewing, chatId, currentUser.uid]);

  // Bu sohbet GÖRÜNÜRKEN chatId'yi bellekte işaretle (grup + 1-1 ikisinde de) —
  // ön plandaki bildirim handler'ı o sohbetin mesajı için banner/ses çıkarmasın
  // (bkz. utils/notificationPresentation.js). Sayaçlı: üst üste açılan
  // sohbetler birbirinin durumunu bozmaz (services/activeChatTracker.js).
  useEffect(() => {
    if (!isFocused) return undefined;
    return enterActiveChat(chatId);
  }, [isFocused, chatId]);

  // Sohbet görünürken bildirim çekmecesinde bekleyen bu sohbet bildirimleri de
  // temizlenir — okunmuş mesajın bildirimi çekmecede (ve rozette) kalmasın.
  // Uygulama arka plandan dönünce de çalışır (arada gelenler için).
  useEffect(() => {
    if (!isViewing) return;
    dismissChatNotifications(chatId, currentUser.uid);
  }, [isViewing, chatId, currentUser.uid]);

  // Sohbet açıkken gelen kutusu index'imdeki okunmamış sayacını sıfır tut:
  // girişte birikmiş sayacı, sohbet açıkken de yeni gelen artışları temizler
  // (profildeki rozet, Mesajlar ekranındaki renkli border ve uygulama simgesi
  // rozeti bu alana bakar). Yalnız sohbet görünürken: arkada kalmış ya da
  // arka plandaki bir sohbet gelen mesajı "okundu" yapmamalı.
  useEffect(() => {
    if (isGroup || !isViewing) return undefined;
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
  }, [isGroup, isViewing, currentUser.uid, friendUid]);

  // Grup karşılığı: sohbet GÖRÜNÜRKEN kendi gelen kutumdaki sayaç
  // (Users/{uid}/groupInbox/{groupId}.unread) sıfırda tutulur. Sayaç grup
  // belgesinde DEĞİL: orada her üyenin sıfırlaması belgeyi bütün üyelere
  // yeniden gönderiyordu (bkz. services/groupsService.js). Kendi belgemi
  // dinlerim; sıfırlama yalnız benim dinleyicimi tetikler, grup sıralamasına
  // (updatedAt) da dokunmaz.
  useEffect(() => {
    if (!isGroup || !isViewing) return undefined;
    const myInboxRef = groupInboxDoc(currentUser.uid, groupId);
    const unsub = onSnapshot(
      myInboxRef,
      (snap) => {
        if (snap.exists() && (snap.data()?.unread || 0) > 0) {
          updateDoc(myInboxRef, { unread: 0 }).catch(() => {});
        }
      },
      () => {},
    );
    return () => unsub();
  }, [isGroup, isViewing, currentUser.uid, groupId]);

  // Sohbet açıkken ARKADAŞLIK bitti (karşı taraf seni çıkardı ya da sen başka yerden):
  // sohbet silinmiştir, ekranda kalıp mesaj yazmak boş bir sohbeti yeniden yaratırdı.
  // Yalnız "açıldığında arkadaştı → şimdi değil" geçişinde çıkılır; arkadaş olmayan
  // biriyle bilerek açılmış sohbetler (bildirim/paylaşım girişleri) etkilenmez.
  const wasFriendRef = useRef(false);
  const friendNow = !isGroup && !friendsLoading && isFriend(friendUid);
  useEffect(() => {
    if (isGroup || friendsLoading) return;
    if (friendNow) {
      wasFriendRef.current = true;
    } else if (wasFriendRef.current) {
      wasFriendRef.current = false;
      toast.show({
        type: "info",
        text1: i18nText("autoI18n.arkadaslik_sona_erdi_sohbet_kapandi", "Arkadaşlık sona erdi, sohbet kapatıldı"),
      });
      navigation.goBack();
    }
  }, [isGroup, friendsLoading, friendNow, navigation]);

  // Mesajlar: imleçli sayfalar (services/chatMessagePager.js). Eskiden tek
  // dinleyicinin limiti büyütülüp yeniden kuruluyordu — her "daha eski" yüklenmiş
  // tüm mesajları baştan okutuyor, aynı efektteki profil/RTDB dinleyicilerini de
  // yeniden kuruyordu. Artık sohbet başına bir kez kurulur; eski sayfa eklemek
  // yalnız o sayfayı okur.
  useEffect(() => {
    const pager = createMessagePager({
      messagesRef,
      fs: { query, orderBy, limit, startAfter, endAt, onSnapshot },
      pageSize: MESSAGE_PAGE_SIZE,
      mapDoc: (docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          timestamp:
            data.timestamp ||
            (data.clientCreatedAt ? new Date(data.clientCreatedAt) : null),
          _pendingWrite: docSnap.metadata.hasPendingWrites,
        };
      },
      // Tikler bu listeden ve sohbet belgesindeki okundu işaretinden TÜRETİLİR
      // (utils/chatReceipts.js); mesajlara durum yazılmaz.
      onChange: ({ messages, loaded }) => {
        if (!loaded) return;
        setChatData((prev) => ({
          ...prev,
          loaded: true,
          messages: mergeServerMessages(messages, prev.messages, chatId),
        }));
      },
      // Örn. gruptan çıkarılınca permission-denied: dinleyici sessizce ölür,
      // ekran bayat mesajlarda donardı — en azından logla.
      onError: (err) => __DEV__ && console.warn("messages listener error:", err?.message),
      onReads: (count) => trackFirestoreRead("messages", count),
    });
    pagerRef.current = pager;
    return () => {
      pager.stop();
      if (pagerRef.current === pager) pagerRef.current = null;
    };
  }, [messagesRef, chatId]);

  useEffect(() => {
    // Grup: doc'u dinle (header + memberInfo). 1-1: typing + presence.
    let unsubMeta = () => {};
    let unsubFriendProfile = () => {};
    let unsubGroup = () => {};
    if (isGroup) {
      unsubGroup = subscribeGroup(groupId, (g) => setGroupData(g));
    } else {
      // Arkadaşın privacy.onlineStatus tercihi sohbette de geçerli: "none"
      // seçtiyse yeşil nokta, "Sohbette" VE son görülme gizlenir ("yazıyor"
      // sohbet içi etkileşim olduğundan gizlenmez). 1-1 sohbet arkadaşlar
      // arası olduğundan viewerIsFriend=true. Privacy yüklenene dek çevrimdışı
      // varsayılır (anlık "çevrimiçi" sızıntısı olmasın); okuma başarısızsa
      // varsayılan (görünür) davranışa düşülür.
      let friendPrivacy = null;
      let privacyReady = false;
      let lastPresence = null;
      let lastInChat = false;
      const applyPresence = () => {
        if (!privacyReady) return;
        const hidden = friendPrivacy?.onlineStatus === "none";
        setChatData((prev) => ({
          ...prev,
          friendIsOnline: isOnlineVisible(lastPresence, friendPrivacy, {
            viewerIsFriend: true,
          }),
          friendInChat: !hidden && lastInChat,
          friendPresence: hidden ? null : lastPresence,
        }));
      };
      // typing/inChat yalnız arkadaşın bağlantısı CANLIYSA true gelir (bkz.
      // services/chatRtdb.js): uygulamayı kapatan kullanıcı takılı kalmaz.
      unsubMeta = subscribeChatMeta(chatId, friendUid, (meta) => {
        lastPresence = meta.presence;
        lastInChat = meta.inChat;
        setChatData((prev) =>
          prev.friendTyping === meta.typing
            ? prev
            : { ...prev, friendTyping: meta.typing },
        );
        applyPresence();
      });
      unsubFriendProfile = onSnapshot(
        doc(db, "Users", friendUid),
        (snap) => {
          trackFirestoreRead("Users", 1);
          const data = snap.data() || {};
          friendPrivacy = data.privacy || null;
          setFriendIdentity((prev) => ({
            displayName: data.displayName || prev.displayName,
            username: data.username || "",
            avatarIndex:
              typeof data.avatarIndex === "number"
                ? data.avatarIndex
                : prev.avatarIndex,
            photoURL: data.photoURL || null,
          }));
          privacyReady = true;
          applyPresence();
        },
        () => {
          privacyReady = true;
          applyPresence();
        },
      );
    }

    return () => {
      unsubMeta();
      unsubFriendProfile();
      unsubGroup();
    };
  }, [isGroup, groupId, chatId, friendUid]);

  // Okundu işaretleri (1-1): sohbet belgesindeki readAt.{uid} — iki tarafın da
  // gördüğü en yeni gelen mesajın zamanı (utils/chatReceipts.js). Sohbet belgesi
  // artık mesaj başına yazılmadığı için bu dinleyici yalnız okundu değişiminde
  // tetiklenir. Belge yoksa (henüz kimse okumadı) işaretler boş.
  const [receipts, setReceipts] = useState({ chatId: null, readAt: {} });
  useEffect(() => {
    if (isGroup) return undefined;
    return onSnapshot(
      chatRef,
      (snap) => setReceipts({ chatId, readAt: snap.data()?.readAt || {} }),
      (error) => __DEV__ && console.warn("receipts:", error?.message),
    );
  }, [isGroup, chatRef, chatId]);
  const receiptsReady = receipts.chatId === chatId;
  const friendReadAt = receiptsReady ? receipts.readAt[friendUid] : null;
  const myReadAt = receiptsReady ? receipts.readAt[currentUser.uid] : null;

  // Gelen mesajları "görüldü" yap — YALNIZ sohbet gerçekten görünürken (odakta
  // + uygulama ön planda); arkada kalmış ya da arka plandaki sohbet "görüldü"
  // demez. Kaç mesaj birikmiş olursa olsun TEK yazım: işaret, görülen en yeni
  // gelen mesajın zamanına ilerler (eskiden okunmamış her mesaja ayrı "seen"
  // yazılıyordu). `participants` en üst düzeyde: hesap silme bu alanla sohbeti
  // bulur (eskiden information.participants içinde kalıp hiç eşleşmiyordu).
  useEffect(() => {
    if (isGroup || !isViewing || !receiptsReady) return;
    const latest = newestIncoming(chatData.messages, currentUser.uid);
    if (!shouldMarkRead(latest, myReadAt)) return;
    setDoc(
      chatRef,
      {
        readAt: { [currentUser.uid]: latest.timestamp },
        participants: [currentUser.uid, friendUid],
      },
      { merge: true },
    ).catch((err) => {
      if (__DEV__) console.warn("readAt:", err?.message);
    });
  }, [isGroup, isViewing, receiptsReady, chatData.messages, currentUser.uid, myReadAt, chatRef, friendUid]);

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
    // Odak gidince "yazıyor" kapanır (metin kutuda kalsa bile).
    typingCtrlRef.current?.stop();
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
            senderName: profileDisplayName || currentUser.displayName || "",
            senderUsername: profileUsername || "",
            senderAvatarIndex: mySnapshot.avatarIndex,
            senderPhotoURL: mySnapshot.photoURL,
          }
        : {},
    [isGroup, currentUser.displayName, profileDisplayName, profileUsername, mySnapshot.avatarIndex, mySnapshot.photoURL],
  );

  const resolveSenderName = useCallback(
    (message) => {
      if (message?.senderId === currentUser.uid) {
        return profileDisplayName || currentUser.displayName || i18nText("autoI18n.sen", "Sen");
      }
      if (isGroup) {
        return (
          groupData?.memberInfo?.[message?.senderId]?.name ||
          message?.senderName ||
          i18nText("autoI18n.uye", "Üye")
        );
      }
      return friendIdentity.displayName || friendName || i18nText("autoI18n.arkadas", "Arkadaş");
    },
    [currentUser.uid, currentUser.displayName, profileDisplayName, isGroup, groupData?.memberInfo, friendIdentity.displayName, friendName],
  );

  const beginReply = useCallback(
    (message) => {
      if (!message?.id) return;
      if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
      setEditingMessage(null);
      setReplyingTo(
        buildReplySnapshot(message, {
          senderName: resolveSenderName(message),
          preview: messagePreview(message),
        }),
      );
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
          pinnedByName: profileDisplayName || currentUser.displayName || i18nText("autoI18n.bir_uye", "Bir üye"),
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
      profileDisplayName,
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

  const fromAvatarIndex = mySnapshot.avatarIndex;

  // Mesajın kalıcı YAN ETKİLERİ — sohbet özeti, gelen kutusu index'i (iki taraf)
  // ve alıcının okunmamış sayacı — mesajın KENDİSİYLE aynı batch'e eklenir.
  // Eskiden mesaj yazılıp ardından üç ayrı yazım denenirdi; araya giren bir
  // kopma ya da süreç ölümü mesajı bırakıp alıcının gelen kutusunu, sayacını ve
  // rozetini güncellenmemiş bırakıyordu. Batch atomiktir: ya hepsi ya hiçbiri.
  // Grup ve 1-1 şemaları farklı.
  const queueThreadWrites = useCallback(
    (batch, previewText, groupMembers = groupData?.members) => {
      if (isGroup) {
        batch.set(
          chatRef,
          {
            lastMessage: {
              text: previewText,
              senderId: currentUser.uid,
              senderName: profileDisplayName || currentUser.displayName || "",
              senderUsername: profileUsername || "",
              time: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        // Diğer üyelerin okunmamış sayacı mesajla AYNI batch'te artar (1-1'de
        // alıcının conversations.unreadCount'u gibi): kopma/süreç ölümü mesajı
        // yazıp sayacı eksik bırakmaz. Sayaç grup belgesinde değil, her üyenin
        // kendi gelen kutusunda (services/groupsService.js).
        queueGroupUnreadIncrements(batch, chatId, groupMembers, currentUser.uid);
        return;
      }
      // 1-1'de sohbet belgesi (chats/{chatId}) mesaj başına YAZILMAZ: eskiden
      // buraya yazılan `information` özeti hiçbir yerde okunmuyordu, üstelik her
      // yazım iki tarafın okundu dinleyicisini boşuna tetiklerdi. Belge yalnız
      // okundu işaretini (+ participants) taşır.
      // Gelen kutusu index'i (iki taraf) — Mesajlar ekranı bunu listeler.
      const convEntry = (withUid, withName, withUsername, withAvatarIndex) => ({
        withUid,
        withName: withName || "",
        withUsername: withUsername || "",
        ...(typeof withAvatarIndex === "number" ? { withAvatarIndex } : {}),
        lastText: previewText,
        lastTime: serverTimestamp(),
      });
      batch.set(
        doc(db, "Users", currentUser.uid, "conversations", friendUid),
        convEntry(
          friendUid,
          friendIdentity.displayName || friendName,
          friendIdentity.username,
          friendIdentity.avatarIndex,
        ),
        { merge: true },
      );
      batch.set(
        doc(db, "Users", friendUid, "conversations", currentUser.uid),
        {
          ...convEntry(
            currentUser.uid,
            profileDisplayName || currentUser.displayName,
            profileUsername,
            fromAvatarIndex,
          ),
          // Alıcı sohbeti açana dek biriken okunmamış sayacı; alıcının
          // ChatScreen'i sohbet görünürken sıfırlar.
          unreadCount: increment(1),
        },
        { merge: true },
      );
    },
    [
      isGroup,
      chatId,
      chatRef,
      currentUser.uid,
      currentUser.displayName,
      profileDisplayName,
      profileUsername,
      fromAvatarIndex,
      friendUid,
      friendName,
      friendIdentity,
      groupData?.members,
    ],
  );

  // YALNIZ DAVET (CineSwipe odası, günlük düello) bildirim belgesi yazar: kabul/ret
  // akışı o belgede. Düz mesajın push'unu sunucu mesaj tetikleyicisi dağıtır,
  // istemci hiçbir alıcıya yazmaz (utils/chatPush.js). Davet belgeleri mesaj
  // batch'i işlendikten SONRA yazılır: sunucu push'u rozete yazacağı okunmamış
  // toplamını o an okur (functions/appBadge.js). Hata gönderimi geri almaz.
  // `messageId`: davetin kartı — Profil çubuğundaki kabul/ret o mesaja da yazılır.
  // `members`: gönderim anında çözülen grup üyeleri (dinleyici henüz gelmediyse de davet herkese gider).
  const notifyInvitation = useCallback(
    (previewText, invitation, messageId, members) => {
      if (!invitation) return;
      if (isGroup) {
        const others = (Array.isArray(members) ? members : groupData?.members || []).filter(
          (u) => u !== currentUser.uid,
        );
        others.forEach((uid) =>
          createSocialNotification({
            toUid: uid,
            fromUid: currentUser.uid,
            fromName: profileDisplayName || currentUser.displayName || "",
            fromAvatarIndex,
            ...invitation,
            text: previewText,
            groupId: chatId,
            groupName: groupData?.name || groupName || "",
            messageId,
          }).catch(() => {}),
        );
        return;
      }
      createSocialNotification({
        toUid: friendUid,
        fromUid: currentUser.uid,
        fromName: profileDisplayName || currentUser.displayName || "",
        fromAvatarIndex,
        ...invitation,
        text: previewText,
        messageId,
      }).catch(() => {});
    },
    [
      isGroup,
      chatId,
      currentUser.uid,
      currentUser.displayName,
      profileDisplayName,
      fromAvatarIndex,
      groupData,
      groupName,
      friendUid,
    ],
  );

  // TÜM gönderim yolları (metin, anket, medya, koleksiyon, detaydan paylaşım)
  // buradan geçer: mesaj + yan etkiler tek atomik batch. Düz mesaj sunucu push
  // işaretini taşır; davet ise ardından bildirim belgesi yazar.
  const postMessage = useCallback(
    async (messageData, previewText) => {
      const { message, invitation } = prepareOutgoingMessage(messageData);
      // Grup belgesi dinleyiciden henüz gelmediyse (sohbet yeni açıldı ya da
      // dinleyici düştü) üyeler gönderim anında okunur; yoksa diğer üyelerin
      // okunmamış sayacı bu mesajda artmazdı. Okuma düşerse eski davranış.
      let groupMembers = groupData?.members;
      if (isGroup && !Array.isArray(groupMembers)) {
        try {
          const snap = await getDoc(chatRef);
          groupMembers = snap.exists() ? snap.data()?.members : undefined;
        } catch (error) {
          if (__DEV__) console.warn("grup üyeleri okunamadı:", error?.message);
        }
      }
      const batch = writeBatch(db);
      const messageRef = doc(messagesRef);
      batch.set(messageRef, message);
      queueThreadWrites(batch, previewText, groupMembers);
      await batch.commit();
      notifyInvitation(previewText, invitation, messageRef.id, groupMembers);
    },
    [messagesRef, queueThreadWrites, notifyInvitation, isGroup, groupData, chatRef],
  );

  // Mesajlar listesindeki önizlemeyi sohbetin GÜNCEL son mesajına eşitler (bkz.
  // utils/threadPreview.js): son mesaj silinince ya da düzenlenince eski metin
  // karşı tarafın listesinde kalmasın. Hata önizlemeyi bayat bırakır, işlemi bozmaz.
  const syncThreadPreview = useCallback(
    async (latest) => {
      try {
        const text = previewOf(latest);
        const stamped = latest?.timestamp?.toMillis ? latest.timestamp : null;
        if (isGroup) {
          await updateDoc(chatRef, {
            lastMessage: latest
              ? {
                  text,
                  senderId: latest.senderId || "",
                  senderName: latest.senderName || "",
                  senderUsername: latest.senderUsername || "",
                  time: stamped || serverTimestamp(),
                }
              : deleteField(),
          });
          return;
        }
        const patch = { lastText: text, ...(stamped ? { lastTime: stamped } : {}) };
        await Promise.all([
          updateDoc(doc(db, "Users", currentUser.uid, "conversations", friendUid), patch),
          updateDoc(doc(db, "Users", friendUid, "conversations", currentUser.uid), patch),
        ]);
      } catch (error) {
        if (__DEV__) console.warn("syncThreadPreview:", error?.message);
      }
    },
    [isGroup, chatRef, currentUser.uid, friendUid],
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
        toast.error(i18nText("autoI18n.toast_oy_kaydedilemedi", "Oyun kaydedilemedi"), i18nText("autoI18n.toast_yeniden_dene", "Bağlantını kontrol edip tekrar dene."));
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
        await postMessage(messageData, previewText);
        setReplyingTo(null);
      } catch (err) {
        console.error("textPoll:", err);
        toast.error(i18nText("autoI18n.mesaj_gonderilemedi", "Mesaj gönderilemedi."));
      }
    },
    [currentUser.uid, replyFields, senderFields, postMessage, closeTextPollModal],
  );

  const handleTyping = useCallback(
    (value) => {
      setText(value);
      setTextLink(isLink(value));
      // Grupta typing göstergesi yok (denetleyici oluşturulmaz). İlk tuşta hemen
      // yazılır, hareketsizlikte kapanır (services/chatSignals.js).
      typingCtrlRef.current?.input(value.length > 0);
    },
    [isLink],
  );

  const sendMessage = useCallback(async () => {
    if (text.trim() === "") return;
    // Gönderince "yazıyor" hemen kapanır.
    typingCtrlRef.current?.stop();
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
        // Son mesaj düzenlendiyse liste önizlemesi de yeni metni göstersin.
        if (isLatestMessage(chatData.messages, targetMessage.id)) {
          syncThreadPreview({ ...targetMessage, text: outgoing });
        }
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
        toast.error(i18nText("autoI18n.mesaj_duzenlenemedi", "Mesaj düzenlenemedi."));
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
      // Mesaj + sohbet özeti + gelen kutusu + okunmamış sayacı TEK atomik batch;
      // bildirim bunun ardından (bkz. postMessage).
      await postMessage(
        {
          ...messageData,
          text: outgoing,
          timestamp: serverTimestamp(),
          status: "sent",
        },
        outgoing,
      );
    } catch (error) {
      setChatData((prev) => ({
        ...prev,
        messages: removeOptimisticMessage(prev.messages, clientId),
      }));
      setText((current) => current || outgoing);
      setTextLink(isLink(outgoing));
      if (replySnapshot) setReplyingTo((current) => current || replySnapshot);
      console.error(i18nText("autoI18n.mesaj_gonderme_hatasi", "Mesaj gönderme hatası:"), error);
      toast.error(i18nText("autoI18n.mesaj_gonderilemedi", "Mesaj gönderilemedi."));
    }
  }, [
    text,
    editingMessage,
    replyingTo,
    chatId,
    messagesRef,
    currentUser.uid,
    isLink,
    senderFields,
    postMessage,
    chatData.messages,
    syncThreadPreview,
  ]);

  const handleLongPress = useCallback(
    (item) => {
      setSelectedMessage(item);
      setOptionsVisible(true);
    },
    [],
  );

  // ── # araması ───────────────────────────────────────────────────────────────
  // Yazarken CHAT_SEARCH_DEBOUNCE_MS duraksayınca aranır; her istek bir sıra
  // numarası alır ve yalnız EN SON isteğin cevabı ekrana yazılır (eskiden geç
  // dönen eski sorgu yeni sonuçları eziyordu). Sıralama utils/chatMediaSearch'te.
  // include_adult yazılmaz — utils/tmdbAdultGuard uygular.
  const tmdbSearch = useCallback(
    async (endpoint, query, page = 1, extra = {}) => {
      const response = await axios.get("https://api.themoviedb.org/3/" + endpoint, {
        params: { query, language: tmdbLanguageOf(language), page, ...extra },
        headers: { Authorization: API_KEY },
      });
      return response.data?.results || [];
    },
    [language, API_KEY],
  );

  const runSearch = useCallback(
    async (type, rawQuery) => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      const seq = ++searchSeqRef.current;
      if (!isSearchableQuery(rawQuery)) {
        setSearchResults([]);
        setSearchedKey(null);
        setLoadingSearch(false);
        return;
      }
      const key = chatSearchKey(type, rawQuery);
      const cached = searchCacheRef.current.get(key);
      if (cached) {
        setSearchResults(cached);
        setSearchedKey(key);
        setLoadingSearch(false);
        return;
      }

      setLoadingSearch(true);
      const { text } = parseSearchQuery(rawQuery);
      const lang = tmdbLanguageOf(language);
      try {
        let raw;
        if (type === "person") {
          raw = await tmdbSearch("search/person", text);
        } else if (type === "movie" || type === "tv") {
          // Yazım hatasına dayanıklı yol (ana arama ekranlarıyla aynı servis).
          const { results } = await searchMediaWithFuzzyFallback({
            mediaType: type,
            query: text,
            language: lang,
            adultContent,
            API_KEY,
          });
          raw = results;
        } else {
          // İki sayfa: tek sayfada kişi/dizi kalabalığı aranan filmi dışarıda bırakabiliyor.
          const [first, second] = await Promise.all([
            tmdbSearch("search/multi", text, 1),
            tmdbSearch("search/multi", text, 2).catch(() => []),
          ]);
          raw = [...first, ...second];
          const hasMedia = raw.some((it) => it.media_type === "movie" || it.media_type === "tv");
          if (!hasMedia) {
            // "Tümü"de de yazım hatası affedilsin: film + dizi bulanık arama.
            const fuzzy = await Promise.all(
              ["movie", "tv"].map((mediaType) =>
                searchMediaWithFuzzyFallback({ mediaType, query: text, language: lang, adultContent, API_KEY })
                  .then(({ results }) => results.map((it) => ({ ...it, media_type: mediaType })))
                  .catch(() => []),
              ),
            );
            raw = [...fuzzy.flat(), ...raw];
          }
        }
        if (seq !== searchSeqRef.current) return;
        const ranked = rankChatSearchResults(raw, rawQuery, { type });
        const cache = searchCacheRef.current;
        cache.set(key, ranked);
        if (cache.size > 30) cache.delete(cache.keys().next().value);
        setSearchResults(ranked);
        setSearchedKey(key);
      } catch (err) {
        if (seq !== searchSeqRef.current) return;
        console.error(i18nText("autoI18n.arama_hatasi", "Arama hatası:"), err.message);
        setSearchedKey(key);
      } finally {
        if (seq === searchSeqRef.current) setLoadingSearch(false);
      }
    },
    [language, API_KEY, adultContent, tmdbSearch],
  );

  // Yazarken: kısa duraksamadan sonra ara (kısa sorgu sonuçları hemen temizler).
  const scheduleSearch = useCallback(
    (type, rawQuery) => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (!isSearchableQuery(rawQuery) || searchCacheRef.current.has(chatSearchKey(type, rawQuery))) {
        runSearch(type, rawQuery);
        return;
      }
      setLoadingSearch(true);
      searchTimerRef.current = setTimeout(() => {
        searchTimerRef.current = null;
        runSearch(type, rawQuery);
      }, CHAT_SEARCH_DEBOUNCE_MS);
    },
    [runSearch],
  );

  useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    },
    [],
  );

  // Kategori değişince yeniden ara (aynı çipe ikinci basış "Tümü"ne döner).
  const handleCategoryChange = useCallback(
    (cat) => {
      const newCat = searchChoise === cat ? null : cat;
      setShowSelectedPanel(false);
      setSearchChoise(newCat);
      runSearch(newCat, searchText);
    },
    [searchChoise, searchText, runSearch],
  );

  const clearSearchText = useCallback(() => {
    setSearchText("");
    runSearch(searchChoise, "");
    searchInputRef.current?.focus();
  }, [searchChoise, runSearch]);

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const renderMessageText = useCallback((msgText, isMe = false) => {
    const parts = msgText.split(urlRegex).filter(Boolean);
    return parts.map((part, index) => {
      const isUrl = urlRegex.test(part);
      if (isUrl) {
        const url = part.startsWith("http") ? part : "https://" + part;
        return (
          <Text
            key={index}
            style={[
              styles.linkText,
              { color: isMe ? "#fff" : (theme.accent || "#82B4FF") },
            ]}
            onPress={() => Linking.openURL(url)}
          >
            {part}
          </Text>
        );
      }
      return (
        <Text
          key={index}
          style={[
            styles.messageText,
            { color: isMe ? "#fff" : theme.text.primary },
          ]}
        >
          {part}
        </Text>
      );
    });
  }, [theme.accent, theme.text.primary]);

  // Yeni gelen/giden mesajları "sekme" animasyonu için işaretle. Tespit
  // renderdan ÖNCE (balonlar bağlanırken registry dolu olsun) ve idempotent:
  // aynı liste iki kez değerlendirilse (StrictMode) ikinci geçiş boş döner,
  // ilkinin kaydı kalır. Ayrıntı: utils/chatEntrance.js.
  const reduceMotion = useReduceMotion();
  const entranceRegistryRef = useRef(new Map());
  const prevMessagesRef = useRef(null);
  const memoizedMessages = useMemo(() => {
    const next = chatData.messages;
    if (!chatData.loaded) {
      prevMessagesRef.current = null;
      return next;
    }
    // İlk yüklenen liste taban çizgisidir: animasyon yok.
    if (prevMessagesRef.current !== null && prevMessagesRef.current !== next) {
      const fresh = detectFreshMessages(
        prevMessagesRef.current,
        next,
        currentUser.uid,
      );
      if (fresh.length > 0) recordFresh(entranceRegistryRef.current, fresh);
    }
    prevMessagesRef.current = next;
    // Tikler (1-1): sunucuya ulaşan = iletildi, karşı tarafın okundu işaretine
    // kadar olan = görüldü. Değişmeyen balonun nesnesi korunur.
    return isGroup ? next : applyReceipts(next, { myUid: currentUser.uid, friendReadAt });
  }, [chatData.messages, chatData.loaded, currentUser.uid, isGroup, friendReadAt]);

  const scrollToMessage = useCallback(
    (messageId) => {
      const index = memoizedMessages.findIndex((message) => message.id === messageId);
      if (index < 0) return false;
      scrollRetryRef.current = 0;
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHighlightedMessageId(messageId);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightedMessageId(null), 1500);
      setPinnedModalVisible(false);
      return true;
    },
    [memoizedMessages],
  );

  // Hedef mesaj listede yoksa eski sayfalar, bulunana ya da tavana (6×50)
  // varılana dek yüklenir. Sayfa yükleniyorsa ("busy") yeni sayfa gelince bu
  // efekt yeniden çalışır; geçmişin başına varıldıysa ("end") vazgeçilir.
  // (Önceki tek seferlik deneme, bir sayfadan eski hedeflerde sonsuza dek
  // "yükleniyor" toast'ında takılı kalıyordu.)
  const pendingJumpTriesRef = useRef(0);
  const continueJump = useCallback(() => {
    if (!pendingJumpIdRef.current) return;
    if (pendingJumpTriesRef.current >= JUMP_MAX_PAGES) {
      pendingJumpIdRef.current = null;
      return;
    }
    const result = pagerRef.current?.loadOlder(JUMP_PAGE_SIZE) ?? "end";
    if (result === "started") pendingJumpTriesRef.current += 1;
    else if (result === "end") pendingJumpIdRef.current = null;
  }, []);

  const jumpToMessage = useCallback(
    (messageId) => {
      if (scrollToMessage(messageId)) return;
      pendingJumpIdRef.current = messageId;
      pendingJumpTriesRef.current = 0;
      continueJump();
      if (!pendingJumpIdRef.current) return; // geçmişte yok (silinmiş olabilir)
      toast.warning(
        i18nText("autoI18n.eski_mesaj_yukleniyor", "Eski mesaj yükleniyor"),
      );
    },
    [scrollToMessage, continueJump],
  );

  useEffect(() => {
    const pendingId = pendingJumpIdRef.current;
    if (!pendingId) return;
    if (scrollToMessage(pendingId)) {
      pendingJumpIdRef.current = null;
      return;
    }
    continueJump();
  }, [memoizedMessages, scrollToMessage, continueJump]);

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
        // Silinen son mesajsa liste önizlemesi bir öncekine dönsün (silinen
        // metin karşı tarafın listesinde kalmasın).
        const next = latestAfterDelete(chatData.messages, message.id);
        if (next !== undefined) syncThreadPreview(next);
      } catch (error) {
        console.error("deleteMessage:", error);
        toast.error(i18nText("autoI18n.mesaj_silinemedi", "Mesaj silinemedi"));
      }
    },
    [
      pinnedMessages,
      pinsRef,
      messagesRef,
      replyingTo?.messageId,
      chatData.messages,
      syncThreadPreview,
    ],
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
      !selectedMessage?.share &&
      selectedMessage?.kind !== "poll",
  );
  const canDeleteSelected = Boolean(
    selectedMessage &&
      (selectedMessage.senderId === currentUser.uid || (isGroup && currentUserIsCreator)),
  );
  // Moderasyon eylemleri YALNIZ karşı tarafın mesajında: kendi mesajını
  // şikâyet etmek anlamsız, kendini engellemek zaten kural düzeyinde reddedilir.
  const canModerateSelected = Boolean(
    selectedMessage?.senderId && selectedMessage.senderId !== currentUser.uid,
  );

  // ── Moderasyon: şikâyet + engelle ────────────────────────────────────────
  const submitMessageReport = useCallback(
    async (reason) => {
      const target = reportTarget;
      setReportTarget(null);
      if (!target?.id || !target?.senderId) return;
      // Grup ve 1-1 mesajları farklı köklerde; moderatör kaydı tam yolla bulur.
      const targetPath = isGroup
        ? `groups/${chatId}/messages/${target.id}`
        : `chats/${chatId}/messages/${target.id}`;
      try {
        await reportMessage({
          targetPath,
          targetUserId: target.senderId,
          reporterId: currentUser.uid,
          text: target.text,
          reason,
        });
        toast.success(i18nText("autoI18n.sikayetin_alindi", "Şikayetin alındı"));
      } catch {
        toast.error(
          i18nText("autoI18n.sikayet_gonderilemedi", "Şikayet gönderilemedi"),
        );
      }
    },
    [reportTarget, isGroup, chatId, currentUser.uid],
  );

  const confirmBlockUser = useCallback(
    (targetUid) => {
      if (!targetUid || targetUid === currentUser.uid) return;
      appAlert(
        i18nText("autoI18n.kullaniciyi_engelle", "Kullanıcıyı engelle"),
        i18nText(
          "autoI18n.engelle_onay_metni",
          "Gönderilerini, yorumlarını ve mesajlarını görmezsin. Arkadaşsanız arkadaşlık da kalkar.",
        ),
        [
          { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
          {
            text: i18nText("autoI18n.engelle", "Engelle"),
            style: "destructive",
            onPress: () => block(targetUid),
          },
        ],
      );
    },
    [block, currentUser.uid],
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
          onSaveList={openSaveList}
          onOpenList={openListSheet}
          onReply={beginReply}
          onJumpToMessage={jumpToMessage}
          chatTarget={chatTarget}
          onAnswerInvite={answerInviteFromCard}
          highlighted={highlightedMessageId === item.id}
          entrance={
            reduceMotion
              ? null
              : entranceFor(entranceRegistryRef.current, item.clientId || item.id)
          }
        />
      );
    },
    [
      reduceMotion,
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
      openSaveList,
      openListSheet,
      beginReply,
      jumpToMessage,
      chatTarget,
      answerInviteFromCard,
      highlightedMessageId,
    ],
  );

  const loadMoreMessages = useCallback(() => {
    pagerRef.current?.loadOlder();
  }, []);

  // scrollToIndex, sanal listede henüz ölçülmemiş satırda başarısız olur: önce
  // tahmini konuma kaydırılır, satır çizilince yeniden denenir (en çok iki kez).
  // Eskiden burada mesaj limiti büyütülüyordu — veriyi yeniden okutup ölçüm
  // sorununu çözmüyordu.
  const handleScrollToIndexFailed = useCallback((info) => {
    if (scrollRetryRef.current >= 2) {
      scrollRetryRef.current = 0;
      return;
    }
    scrollRetryRef.current += 1;
    flatListRef.current?.scrollToOffset({
      offset: Math.max(0, (info.averageItemLength || 0) * info.index),
      animated: false,
    });
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
    }, 80);
  }, []);

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

  useEffect(() => {
    if (selectedItems.length === 0 && showSelectedPanel) {
      setShowSelectedPanel(false);
    }
  }, [selectedItems.length, showSelectedPanel]);

  const toggleSelectedPanel = useCallback(() => {
    if (selectedItemsRef.current.length === 0) return;
    easeLayout();
    if (!showSelectedPanel) {
      searchInputRef.current?.blur();
      Keyboard.dismiss();
    }
    setShowSelectedPanel((visible) => !visible);
  }, [showSelectedPanel]);

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
    setShowSelectedPanel(false);
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
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    searchSeqRef.current += 1;
    setLoadingSearch(false);
    setSearchedKey(null);
    setSearchResults([]);
    setSearchText("");
    setSearchOption(false);
    setSearchModalVisible(false);
    setSearchChoise(null);

    try {
      await postMessage(messageData, previewText);
      setReplyingTo(null);
    } catch (err) {
      console.error(i18nText("autoI18n.arama_sonucu_gonderme_hatasi", "Arama sonucu gönderme hatası:"), err);
      toast.error(i18nText("autoI18n.mesaj_gonderilemedi", "Mesaj gönderilemedi."));
    }
  }, [
    selectedItems,
    composeTitle,
    pollMode,
    currentUser.uid,
    replyFields,
    senderFields,
    postMessage,
    resetCompose,
  ]);

  // Detay ekranındaki "Gönder" akışı da sohbet aramasının ürettiği tekli
  // media mesajıyla aynı şemayı kullanır. Grup üyeleri yüklenmeden göndermeyiz;
  // aksi halde mesaj gider fakat diğer üyelere bildirim oluşturulamaz.
  useEffect(() => {
    if (!initialMedia?.id || !initialMediaKey) return;
    if (handledInitialMediaRef.current === initialMediaKey) return;
    if (isGroup && !groupData) return;

    handledInitialMediaRef.current = initialMediaKey;
    navigation.setParams({ initialMedia: undefined, initialMediaKey: undefined });

    const sendInitialMedia = async () => {
      const previewText = initialMedia.title || i18nText("autoI18n.icerik", "İçerik");
      try {
        await postMessage(
          {
            text: previewText,
            senderId: currentUser.uid,
            timestamp: serverTimestamp(),
            status: "sent",
            ...senderFields(),
            media: initialMedia,
          },
          previewText,
        );
      } catch (error) {
        console.error("detailMediaSend:", error);
        toast.error(i18nText("autoI18n.mesaj_gonderilemedi", "Mesaj gönderilemedi."));
      }
    };

    sendInitialMedia();
  }, [
    currentUser.uid,
    postMessage,
    groupData,
    initialMedia,
    initialMediaKey,
    isGroup,
    navigation,
    senderFields,
  ]);

  // "Sohbete gönder" ile gelen liste / CineMatch cevabı (utils/chatShare.js):
  // initialMedia ile AYNI kalıp — ekran açılınca mesajı kendisi gönderir,
  // parametreyi temizler, anahtar çift gönderimi önler. Grup üyeleri yüklenmeden
  // gönderilmez (aksi halde mesaj gider ama diğer üyelere bildirim oluşmaz).
  useEffect(() => {
    if (!initialShare || !initialShareKey) return;
    if (handledInitialShareRef.current === initialShareKey) return;
    if (isGroup && !groupData) return;

    handledInitialShareRef.current = initialShareKey;
    navigation.setParams({ initialShare: undefined, initialShareKey: undefined });

    const fields = buildShareMessage(initialShare);
    if (!fields) {
      toast.warning(
        i18nText("autoI18n.paylas_icerik_yok", "Paylaşılacak içerik yok"),
      );
      return;
    }

    const sendInitialShare = async () => {
      try {
        await postMessage(
          {
            ...fields,
            senderId: currentUser.uid,
            timestamp: serverTimestamp(),
            status: "sent",
            ...senderFields(),
          },
          fields.text,
        );
      } catch (error) {
        console.error("shareToChatSend:", error);
        toast.error(i18nText("autoI18n.mesaj_gonderilemedi", "Mesaj gönderilemedi."));
      }
    };

    sendInitialShare();
  }, [
    currentUser.uid,
    postMessage,
    groupData,
    initialShare,
    initialShareKey,
    isGroup,
    navigation,
    senderFields,
  ]);

  // Alıcı bir liste paylaşımını kendi profiline kaydetmek istedi: kayıt modalı
  // zaten "paylaşım gönderisi" şeklini (id, başlık, mediaList) okuyor.
  const savePostOf = useCallback(
    (message, share) => ({
      id: message?.id,
      title: share?.title || "",
      mediaList: share?.items || [],
    }),
    [],
  );
  const openSaveList = useCallback(
    (message, share) => {
      if (!share?.items?.length) return;
      setSaveListPost(savePostOf(message, share));
      setSaveListVisible(true);
    },
    [savePostOf],
  );

  const openListSheet = useCallback((message, share) => {
    if (!share?.items?.length) return;
    setListSheet({ message, share });
    setListSheetVisible(true);
  }, []);
  const closeListSheet = useCallback(() => setListSheetVisible(false), []);
  // Sayfada bir afişe basıldı: sayfa kapanır ve detay açılır (arkadaş profilindeki
  // liste sayfasıyla aynı akış).
  const openListSheetItem = useCallback(
    (item) => {
      if (!item?.id) return;
      setListSheetVisible(false);
      openMediaDetail(navigation, item);
    },
    [navigation],
  );
  const saveFromListSheet = useCallback(() => {
    if (!listSheet) return;
    pendingSavePostRef.current = savePostOf(listSheet.message, listSheet.share);
    setListSheetVisible(false);
  }, [listSheet, savePostOf]);
  const handleListSheetDismissed = useCallback(() => {
    const post = pendingSavePostRef.current;
    pendingSavePostRef.current = null;
    if (!post) return;
    setSaveListPost(post);
    setSaveListVisible(true);
  }, []);

  const resolvedFriendName = friendIdentity.displayName || friendName || "";
  const resolvedFriendAvatarIndex =
    typeof friendIdentity.avatarIndex === "number"
      ? friendIdentity.avatarIndex
      : friendAvatarIndex;
  const handleHeaderPress = useCallback(() => {
    if (isGroup) {
      setGroupInfoVisible(true);
      return;
    }
    navigation.navigate("FriendProfileScreen", {
      friendUid,
      friendName: resolvedFriendName,
    });
  }, [isGroup, navigation, friendUid, resolvedFriendName]);

  // Grup başlığının alt satırı: kendin hariç üye adları (canlı memberInfo).
  const groupMemberNames = useMemo(() => {
    if (!isGroup) return null;
    const info = groupData?.memberInfo || {};
    return (groupData?.members || [])
      .filter((uid) => uid !== currentUser.uid)
      .map((uid) => info[uid]?.name)
      .filter(Boolean);
  }, [isGroup, groupData?.members, groupData?.memberInfo, currentUser.uid]);

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
      <StatusBar barStyle={isLightSurface(theme.primary) ? "dark-content" : "light-content"} />

      {/* Ambiyans arka planı: kökün ilk çocuğu = en altta, TAM EKRAN (durum
          çubuğundan alt kenara). Başlık ve mesaj alanı bunun üstünde durur;
          mesaj hedefi saydam olduğundan (iOS/eski Android) lekeler içeriden de
          görünür. Android 12+'ta hedefin içinde hizalı kopyası var (aşağıda). */}
      <ScreenDecor scope="conversation" effects={AMBIENT_ONLY} />

      {/* ── HEADER ── */}
      <ChatHeader
        translucent={ambientVisible}
        title={
          isGroup
            ? groupData?.name || groupName || i18nText("autoI18n.grup", "Grup")
            : resolvedFriendName
        }
        isGroup={isGroup}
        avatar={
          isGroup ? (
            <GroupAvatar
              avatarIndex={groupData?.avatarIndex ?? groupAvatarIndex}
              color={groupData?.color || theme.accent || ACCENT}
              size={CHAT_HEADER_AVATAR_SIZE}
              iconSize={30}
            />
          ) : (
            <UserAvatar
              avatarIndex={resolvedFriendAvatarIndex}
              photoURL={friendIdentity?.photoURL || chatData?.friendPhotoURL}
              isCustomPhoto
              size={CHAT_HEADER_AVATAR_SIZE}
            />
          )
        }
        status={
          isGroup
            ? null
            : {
                typing: chatData.friendTyping,
                inChat: chatData.friendInChat,
                online: chatData.friendIsOnline,
                presence: chatData.friendPresence,
              }
        }
        memberNames={groupMemberNames}
        memberCount={groupData?.members?.length || 0}
        groupColor={groupData?.color}
        onBack={() => navigation.goBack()}
        onOpenInfo={handleHeaderPress}
      />

      <Reanimated.View
        style={[
          styles.container,
          { backgroundColor: "transparent" },
          inputAreaStyle,
        ]}
      >
          {/* ── MESAJ LİSTESİ ── */}
          {pinnedMessages.length > 0 && (
            <GlassTouchable
              onPress={() => setPinnedModalVisible(true)}
              activeOpacity={0.82}
              style={[
                styles.pinnedBanner,
                {
                  backgroundColor: theme.secondary,
                  borderColor: theme.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.sabitlenmis_mesajlar", "Sabitlenmiş mesajlar")}
            >
              <View
                style={[
                  styles.pinnedBannerIcon,
                  { backgroundColor: alpha(theme.accent, 0.16) },
                ]}
              >
                <Ionicons name="pin" size={15} color={theme.accent} />
              </View>
              <View style={styles.pinnedBannerCopy}>
                <Text
                  style={[styles.pinnedBannerTitle, { color: theme.accent }]}
                  numberOfLines={1}
                >
                  {pinnedMessages[0].senderName || i18nText("autoI18n.sohbet_mesaji", "Mesaj")}
                </Text>
                <Text
                  style={[
                    styles.pinnedBannerText,
                    { color: theme.text.secondary },
                  ]}
                  numberOfLines={1}
                >
                  {pinnedMessages[0].preview}
                </Text>
              </View>
              {pinnedMessages.length > 1 && (
                <View
                  style={[
                    styles.pinnedCountBadge,
                    { backgroundColor: alpha(theme.accent, 0.18) },
                  ]}
                >
                  <Text
                    style={[styles.pinnedCountText, { color: theme.accent }]}
                  >
                    +{pinnedMessages.length - 1}
                  </Text>
                </View>
              )}
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.text.muted}
              />
            </GlassTouchable>
          )}
          <View
            ref={messageViewportRef}
            style={styles.messageViewport}
            onLayout={measureMessageViewport}
          >
          {/* Hedefin arka planı yalnız Android 12+'ta (gerçek BlurTargetView) OPAK
              olmak zorunda; diğerlerinde saydam ki kökteki tam ekran ambiyans
              mesaj alanının arkasında da görünsün. */}
          <ComposerBlurTarget
            attach={composerBlur.attach}
            backgroundColor={COMPOSER_TARGET_IS_NATIVE ? theme.primary : "transparent"}
            style={{ flex: 1 }}
          >
          {/* Android 12+: opak hedef kökteki ambiyansı örter ve blur yalnız hedefin
              içini kaydeder. Bu yüzden AYNI deseni (ortak saat + ortak lekeler)
              ekranla hizalı çizen bir kopya burada durur: ambiyansın koordinatı
              ekranın sol-üstüne göre, mesaj alanı ise başlığın altından başlıyor
              → çerçeve `-messageViewportTop` kadar yukarı kayar, klip mesaj alanı
              kadar. Böylece kökteki ambiyansla dikişsiz birleşir (üst üste binmez). */}
          {COMPOSER_TARGET_IS_NATIVE && ambientVisible ? (
            <View style={styles.ambientClip} pointerEvents="none">
              <View
                style={[styles.ambientFrame, { top: -messageViewportTop }]}
                pointerEvents="none"
              >
                <ScreenDecor scope="conversation" effects={AMBIENT_ONLY} />
              </View>
            </View>
          ) : null}
          {/* Arka plan dekor ikonu — hedefin İÇİNDE, mesaj listesinin ALTINDA:
              Android'de blur bu görünümü fotoğrafladığı için desen buraya girmeli
              (dışına konursa opak katman onu görünmez kılar ve blur'a hiç yansımaz).
              Birebir VE grup sohbeti aynı ekran (isGroup); grup "conversation":
              Ekran bazında > Sohbet içi. Kar yok — grup tablosu desteklemiyor. */}
          <View style={styles.iconBgWrapper} pointerEvents="none">
            <ScreenDecor scope="conversation" iconOpacity={0.5} effects={ICON_ONLY} />
          </View>
          <FlatList
            ref={flatListRef}
            style={styles.chatList}
            data={memoizedMessages}
            keyExtractor={(item) => item.clientId || item.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.listContent, { paddingTop: composerHeight + 14 }]}
            inverted
            onScroll={handleMessageListScroll}
            scrollEventThrottle={32}
            onEndReached={loadMoreMessages}
            onEndReachedThreshold={0.5}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews
            windowSize={10}
            maxToRenderPerBatch={12}
            initialNumToRender={15}
            updateCellsBatchingPeriod={30}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            ListHeaderComponent={
              chatData.friendTyping ? (
                <BounceIn kind={reduceMotion ? null : "receive"}>
                  <View style={styles.typingBubble}>
                    <LottieView
                      source={require("@lottie/typingAnimation.json")}
                      autoPlay
                      loop
                      style={{ width: 68, height: 34 }}
                    />
                  </View>
                </BounceIn>
              ) : null
            }
          />

          </ComposerBlurTarget>

          {showLatestMessageButton && (
            <GlassIconButton
              icon="chevron-down"
              iconSize={21}
              size={44}
              fallbackRadius={22}
              color={theme.text.primary}
              fallbackStyle={[
                styles.latestMessageFallback,
                {
                  backgroundColor: theme.secondary,
                  borderColor: theme.border,
                },
              ]}
              style={[styles.latestMessageButton, { bottom: composerHeight + 12 }]}
              overlay={
                <View
                  pointerEvents="none"
                  style={[styles.latestMessageDot, { backgroundColor: theme.accent }]}
                />
              }
              accessibilityLabel={i18nText(
                "autoI18n.son_mesaja_git",
                "Son mesaja git",
              )}
              onPress={scrollToLatestMessage}
            />
          )}

          {/* FAB menüsü açıkken listeyi karartan / menüyü kapatan katman */}
          {attachMenuVisible && (
            <TouchableOpacity
              style={styles.attachBackdrop}
              activeOpacity={1}
              onPress={closeAttachMenu}
            />
          )}

          {/* ── INPUT ALANI ── */}
          <View
            style={styles.inputContainer}
            pointerEvents="box-none"
            onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
          >
              {/* Alıntı kartı */}
              {replyingTo && (
                <ComposerReplyBar
                  reply={replyingTo}
                  isSelf={replyingTo.senderId === currentUser.uid}
                  blurTarget={composerBlur.target}
                  getTmdbUrl={getTmdbUrl}
                  onClose={() => setReplyingTo(null)}
                  onPress={
                    replyingTo.messageId
                      ? () => jumpToMessage(replyingTo.messageId)
                      : undefined
                  }
                />
              )}
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

              {/* FAB menüsü — anket & arama kısayolları */}
              {attachMenuVisible && (
                <View style={styles.attachMenuRow}>
                  <GlassTouchable
                    style={[
                      styles.attachAction,
                      {
                        backgroundColor: alpha(theme.accent, 0.1),
                        borderColor: alpha(theme.accent, 0.3),
                      },
                    ]}
                    onPress={() => handleAttachOption("poll")}
                    disabled={composerTransitioning}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                  >
                    <View
                      style={[
                        styles.attachActionIcon,
                        { backgroundColor: alpha(theme.accent, 0.15) },
                      ]}
                    >
                      <Ionicons name="stats-chart" size={15} color={theme.accent} />
                    </View>
                    <Text
                      style={[
                        styles.attachActionText,
                        { color: theme.text.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {i18nText("autoI18n.metin_anketi", "Metin Anketi")}
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={theme.text.muted} />
                  </GlassTouchable>

                  <GlassTouchable
                    style={[
                      styles.attachAction,
                      {
                        backgroundColor: "rgba(94,232,160,0.09)",
                        borderColor: "rgba(94,232,160,0.28)",
                      },
                    ]}
                    onPress={() => handleAttachOption("search")}
                    disabled={composerTransitioning}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                  >
                    <View
                      style={[
                        styles.attachActionIcon,
                        { backgroundColor: "rgba(94,232,160,0.14)" },
                      ]}
                    >
                      <Feather name="search" size={14} color={SEEN_COLOR} />
                    </View>
                    <Text
                      style={[
                        styles.attachActionText,
                        { color: theme.text.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {i18nText("autoI18n.film_dizi_ara", "Film & Dizi Ara")}
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={theme.text.muted} />
                  </GlassTouchable>
                </View>
              )}

              {/* Engellenen kişiye yazma yolu KAPALI: hap yerine bilgi satırı.
                  Engeli kaldırmak profil ekranından ya da Ayarlar → Gizlilik →
                  Engellenen kullanıcılar'dan. Grup sohbetinde uygulanmıyor;
                  orada engel yalnız görünürlüğü etkiliyor. */}
              {!isGroup && isBlocked(friendUid) ? (
                <View style={[styles.composerPill, styles.composerBlocked, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                  <MaterialCommunityIcons
                    name="account-cancel-outline"
                    size={18}
                    color={theme.text.muted}
                  />
                  <Text style={[styles.composerBlockedText, { color: theme.text.muted }]}>
                    {i18nText(
                      "autoI18n.engellendi_mesaj_gonderilemez",
                      "Bu kullanıcıyı engelledin",
                    )}
                  </Text>
                </View>
              ) : (
              <Animated.View
                style={[
                  styles.composerPill,
                  {
                    backgroundColor: "transparent",
                    borderColor: searchOption ? theme.accent : inputBorderColor,
                  },
                  // Cam yolunda çerçeve halkası kalkar (camın arkasında ikinci hap
                  // gibi görünüyordu); "# arama" kipi camın tonuyla belli edilir.
                  glass && COMPOSER_GLASS_PILL_STYLE,
                ]}
              >
                <ComposerBlur
                  target={composerBlur.target}
                  theme={theme}
                  tint={searchOption ? alpha(theme.accent, 0.22) : undefined}
                />
                {/* Üst glow şeridi */}
                <View
                  style={[
                    styles.inputInnerGlow,
                    { backgroundColor: theme.accent, opacity: searchOption ? 1 : 0 },
                  ]}
                />

                {/* FAB — menüyü açar/kapatır */}
                <TouchableOpacity
                  style={[styles.composerFab, { backgroundColor: theme.accent }]}
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
                  style={[styles.input, { color: theme.text.primary }]}
                  value={text}
                  multiline
                  numberOfLines={6}
                  onChangeText={handleTyping}
                  maxLength={2000}
                  placeholder={i18nText("autoI18n.mesaj_yazin", "Mesaj yazın...")}
                  placeholderTextColor={theme.text.muted}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  selectionColor={theme.accent}
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
                    { backgroundColor: theme.accent, opacity: text.trim() ? 1 : 0.32 },
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
              )}
            </View>

          </View>

        {/* ── # ARAMA MODALİ ── */}
        <BottomSheetModal
          visible={searchModalVisible}
          onClose={() => closeSearchModal(true)}
          intensity={35}
          dimColor="rgba(0,0,0,0.4)"
          sheetStyle={[
            styles.searchModal,
            {
              backgroundColor: theme.secondary,
              borderColor: theme.border,
            },
          ]}
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
                  {/* Tutamaç */}
                  <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

                  {/* Başlık */}
                  <View style={styles.searchModalHeader}>
                    {showSelectedPanel ? (
                      <GlassIconButton
                        icon="chevron-back"
                        size={32}
                        iconSize={18}
                        fallbackRadius={16}
                        fallbackStyle={{ backgroundColor: theme.between }}
                        color={theme.text.primary}
                        onPress={toggleSelectedPanel}
                        accessibilityLabel={i18nText("autoI18n.geri", "Geri")}
                      />
                    ) : (
                      <View
                        style={[
                          styles.searchHashBadge,
                          {
                            backgroundColor: alpha(theme.accent, 0.15),
                            borderColor: alpha(theme.accent, 0.35),
                          },
                        ]}
                      >
                        <Feather name="search" size={15} color={theme.accent} />
                      </View>
                    )}
                    <View style={styles.searchModalTitleCol}>
                      <Text
                        style={[styles.searchModalTitle, { color: theme.text.primary }]}
                        numberOfLines={1}
                      >
                        {showSelectedPanel
                          ? i18nText("autoI18n.secilenler", "Seçilenler")
                          : i18nText("autoI18n.film_dizi_ara", "Film & Dizi Ara")}
                      </Text>
                      <Text
                        style={[styles.searchModalSubtitle, { color: theme.text.muted }]}
                        numberOfLines={1}
                      >
                        {showSelectedPanel
                          ? i18nText("autoI18n.sohbet_arama_panel_alt", "Liste ya da anket olarak gönder")
                          : i18nText("autoI18n.sohbet_arama_alt", "İçerik seç, tek tek ya da liste olarak gönder")}
                      </Text>
                    </View>
                    <GlassCloseButton
                      size={32}
                      fallbackRadius={16}
                      iconSize={20}
                      color={theme.text.primary}
                      backgroundColor={theme.between}
                      onPress={() => closeSearchModal()}
                    />
                  </View>

                  {/* Arama girişi (modaldaki) */}
                  {!showSelectedPanel && (
                  <GlassBox role="field"
                    style={[
                      styles.searchInputWrapper,
                      {
                        backgroundColor: theme.between,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Feather
                      name="search"
                      size={16}
                      color={theme.text.muted}
                      style={{ marginLeft: 12 }}
                    />
                    <TextInput
                      ref={searchInputRef}
                      value={searchText}
                      onChangeText={(val) => {
                        setSearchText(val);
                        scheduleSearch(searchChoise, val);
                      }}
                      onSubmitEditing={() => runSearch(searchChoise, searchText)}
                      returnKeyType="search"
                      autoCorrect={false}
                      maxLength={80}
                      placeholder={
                        searchChoise === "movie"
                          ? i18nText("autoI18n.sohbet_arama_ph_film", "Film adı yaz…")
                          : searchChoise === "tv"
                            ? i18nText("autoI18n.sohbet_arama_ph_dizi", "Dizi adı yaz…")
                            : searchChoise === "person"
                              ? i18nText("autoI18n.sohbet_arama_ph_kisi", "Oyuncu ya da yönetmen ara…")
                              : i18nText("autoI18n.sohbet_arama_ph_tumu", "Film, dizi ya da kişi ara…")
                      }
                      placeholderTextColor={theme.text.muted}
                      selectionColor={theme.accent}
                      style={[styles.searchInput, { color: theme.text.primary }]}
                    />
                    {loadingSearch ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.accent}
                        style={styles.searchInputTrail}
                      />
                    ) : searchText.length > 0 ? (
                      <TouchableOpacity
                        onPress={clearSearchText}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={styles.searchInputTrail}
                        accessibilityRole="button"
                        accessibilityLabel={i18nText("autoI18n.temizle", "Temizle")}
                      >
                        <Ionicons name="close-circle" size={18} color={theme.text.muted} />
                      </TouchableOpacity>
                    ) : null}
                  </GlassBox>
                  )}

                  {/* Kategori filtreleri */}
                  {!showSelectedPanel && (
                  <View style={styles.filterBar}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      style={styles.categoryScroll}
                      contentContainerStyle={styles.categoryRow}
                    >
                    <GlassTouchable
                      style={[
                        styles.catBtn,
                        {
                          backgroundColor: theme.between,
                          borderColor: theme.border,
                        },
                        searchChoise === null && {
                          backgroundColor: alpha(theme.accent, 0.15),
                          borderColor: alpha(theme.accent, 0.4),
                        },
                      ]}
                      onPress={() => handleCategoryChange(null)}
                    >
                      <Text
                        style={[
                          styles.catBtnText,
                          { color: theme.text.muted },
                          searchChoise === null && { color: theme.accent, fontWeight: "700" },
                        ]}
                      >{i18nText("autoI18n.tumu", "Tümü")}</Text>
                    </GlassTouchable>
                    {CATEGORIES.map((cat) => (
                      <GlassTouchable
                        key={cat.key}
                        style={[
                          styles.catBtn,
                          {
                            backgroundColor: theme.between,
                            borderColor: theme.border,
                          },
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
                          color={searchChoise === cat.key ? cat.color : theme.text.muted}
                        />
                        <Text
                          style={[
                            styles.catBtnText,
                            { color: theme.text.muted },
                            searchChoise === cat.key && { color: cat.color, fontWeight: "700" },
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </GlassTouchable>
                    ))}
                    </ScrollView>
                  </View>
                  )}

                  {/* Sonuçlar */}
                  {!showSelectedPanel && <View style={styles.searchResultsArea}>
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
                        keyboardDismissMode="on-drag"
                        contentContainerStyle={styles.searchGrid}
                        columnWrapperStyle={styles.searchGridRow}
                        style={styles.searchResultsList}
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
                    ) : loadingSearch ? (
                      <View style={styles.searchEmpty}>
                        <ActivityIndicator color={theme.accent} />
                      </View>
                    ) : (() => {
                      // Aranmış ve boş döndüyse "sonuç yok"; aksi halde ilk yönlendirme.
                      const noResults =
                        isSearchableQuery(searchText) &&
                        searchedKey === chatSearchKey(searchChoise, searchText);
                      return (
                        <View style={styles.searchEmpty}>
                          <View style={[styles.searchEmptyIcon, { backgroundColor: alpha(theme.accent, 0.1) }]}>
                            <Ionicons
                              name={noResults ? "sad-outline" : "film-outline"}
                              size={24}
                              color={theme.accent}
                            />
                          </View>
                          <Text style={[styles.searchEmptyTitle, { color: theme.text.primary }]}>
                            {noResults
                              ? i18nText("autoI18n.sonuc_bulunamadi", "Sonuç bulunamadı")
                              : i18nText("autoI18n.sohbet_arama_bos_baslik", "Ne paylaşmak istersin?")}
                          </Text>
                          <Text style={[styles.searchEmptyText, { color: theme.text.muted }]}>
                            {noResults
                              ? i18nText("autoI18n.sohbet_arama_sonuc_yok", "Yazımı kontrol et ya da başka bir kategori dene.")
                              : i18nText("autoI18n.sohbet_arama_bos_metin", "En az {{n}} harf yaz; birden fazla seçip liste ya da anket yapabilirsin.", { n: CHAT_SEARCH_MIN_CHARS })}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>}

                  {/* Seçim çubuğu: kaç içerik seçildi + Seçilenler paneline geçiş */}
                  {!showSelectedPanel && selectedItems.length > 0 && (
                    <View
                      style={[
                        styles.selectionBar,
                        { backgroundColor: theme.between, borderColor: theme.border },
                      ]}
                    >
                      <View style={styles.selectionBarThumbs}>
                        {selectedItems.slice(0, 3).map((it, idx) => (
                          <View
                            key={itemKey(it)}
                            style={[
                              styles.selectionBarThumb,
                              {
                                marginLeft: idx === 0 ? 0 : -14,
                                zIndex: 3 - idx,
                                borderColor: theme.between,
                                backgroundColor: theme.secondary,
                              },
                            ]}
                          >
                            {it.poster_path ? (
                              <Image
                                source={{ uri: getTmdbUrl(it.poster_path, "poster", 200) }}
                                style={styles.selectionBarThumbImg}
                                cachePolicy="memory-disk"
                              />
                            ) : null}
                          </View>
                        ))}
                      </View>
                      <View style={styles.selectionBarTextCol}>
                        <Text
                          style={[styles.selectionBarTitle, { color: theme.text.primary }]}
                          numberOfLines={1}
                        >
                          {i18nText("autoI18n.n_secildi", "{{n}} içerik seçildi", { n: selectedItems.length })}
                        </Text>
                        <Text
                          style={[styles.selectionBarSub, { color: theme.text.muted }]}
                          numberOfLines={1}
                        >
                          {selectedItems.length >= 2
                            ? i18nText("autoI18n.sohbet_secim_liste", "Liste ya da anket olarak gönder")
                            : i18nText("autoI18n.sohbet_secim_tek", "Liste için bir tane daha seç")}
                        </Text>
                      </View>
                      <GlassTouchable
                        onPress={toggleSelectedPanel}
                        style={[styles.selectionBarBtn, { backgroundColor: theme.accent }]}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                      >
                        <Text style={styles.selectionBarBtnText}>
                          {i18nText("autoI18n.devam", "Devam")}
                        </Text>
                        <Ionicons name="chevron-forward" size={15} color="#fff" />
                      </GlassTouchable>
                    </View>
                  )}

                  {/* ── SEÇİLENLER PANELİ (liste/anket + gönder) ── */}
                  {showSelectedPanel && selectedItems.length > 0 && (
                    <View style={[styles.composeTray, styles.composeTrayPanel]}>
                      {/* Aktif liste tipi rozeti (tek tip: oyuncu | dizi/film) */}
                      <View style={styles.composeTypeRow}>
                        {(() => {
                          const isPerson = categoryOf(selectedItems[0].media_type) === "person";
                          return (
                            <View
                              style={[
                                styles.composeTypeBadge,
                                {
                                  backgroundColor: alpha(theme.accent, 0.15),
                                  borderColor: alpha(theme.accent, 0.35),
                                },
                              ]}
                            >
                              <Ionicons
                                name={isPerson ? "people-outline" : "film-outline"}
                                size={12}
                                color={theme.accent}
                              />
                              <Text style={[styles.composeTypeText, { color: theme.accent }]}>
                                {isPerson
                                  ? i18nText("autoI18n.oyuncu_listesi", "Oyuncu listesi")
                                  : i18nText("autoI18n.dizifilm_listesi", "Dizi/Film listesi")}
                              </Text>
                            </View>
                          );
                        })()}
                        <Text style={[styles.composeCountText, { color: theme.text.muted }]}>
                          {selectedItems.length}/{MAX_SELECT}
                        </Text>
                      </View>

                      {/* Liste / Anket modu (2+ dizi/film; oyuncuda anket yok) */}
                      {selectedItems.length >= 2 &&
                        categoryOf(selectedItems[0].media_type) === "media" && (
                          <View style={[styles.modeRow, { backgroundColor: theme.between }]}>
                            <GlassTouchable
                              style={[
                                styles.modeBtn,
                                !pollMode && [
                                  styles.modeBtnActive,
                                  {
                                    backgroundColor: alpha(theme.accent, 0.15),
                                    borderColor: alpha(theme.accent, 0.4),
                                  },
                                ],
                              ]}
                              onPress={() => { easeLayout(); setPollMode(false); }}
                            >
                              <Ionicons name="albums-outline" size={14} color={!pollMode ? theme.accent : theme.text.muted} />
                              <Text style={[styles.modeBtnText, { color: !pollMode ? theme.accent : theme.text.muted }]}>
                                {i18nText("autoI18n.liste", "Liste")}
                              </Text>
                            </GlassTouchable>
                            <GlassTouchable
                              style={[
                                styles.modeBtn,
                                pollMode && [
                                  styles.modeBtnActive,
                                  {
                                    backgroundColor: alpha(theme.accent, 0.15),
                                    borderColor: alpha(theme.accent, 0.4),
                                  },
                                ],
                              ]}
                              onPress={() => { easeLayout(); setPollMode(true); setShowTitleInput(true); }}
                            >
                              <Ionicons name="stats-chart" size={14} color={pollMode ? theme.accent : theme.text.muted} />
                              <Text style={[styles.modeBtnText, { color: pollMode ? theme.accent : theme.text.muted }]}>
                                {i18nText("autoI18n.anket", "Anket")}
                              </Text>
                            </GlassTouchable>
                          </View>
                        )}

                      {/* Başlık (liste) veya soru (anket) */}
                      {selectedItems.length >= 2 &&
                        (pollMode ? (
                          <GlassBox role="field"
                            style={[
                              styles.composeTitleWrap,
                              {
                                backgroundColor: theme.between,
                                borderColor: alpha(theme.accent, 0.4),
                              },
                            ]}
                          >
                            <Ionicons name="help-circle-outline" size={16} color={theme.accent} />
                            <TextInput
                              value={composeTitle}
                              onChangeText={setComposeTitle}
                              placeholder={i18nText("autoI18n.anket_sorusu", "Anket sorusu (örn. Hangisini izleyelim?)")}
                              placeholderTextColor={theme.text.muted}
                              style={[styles.composeTitleInput, { color: theme.text.primary }]}
                              selectionColor={theme.accent}
                              maxLength={80}
                            />
                          </GlassBox>
                        ) : showTitleInput ? (
                          <GlassBox role="field"
                            style={[
                              styles.composeTitleWrap,
                              {
                                backgroundColor: theme.between,
                                borderColor: theme.border,
                              },
                            ]}
                          >
                            <Ionicons name="list" size={15} color={theme.accent} />
                            <TextInput
                              value={composeTitle}
                              onChangeText={setComposeTitle}
                              placeholder={i18nText("autoI18n.liste_basligi_ops", "Liste başlığı (örn. Bu akşam ne izlesek?)")}
                              placeholderTextColor={theme.text.muted}
                              style={[styles.composeTitleInput, { color: theme.text.primary }]}
                              selectionColor={theme.accent}
                              maxLength={60}
                            />
                          </GlassBox>
                        ) : (
                          <TouchableOpacity
                            style={styles.composeAddTitle}
                            onPress={() => {
                              easeLayout();
                              setShowTitleInput(true);
                            }}
                          >
                            <Ionicons name="add-circle-outline" size={15} color={theme.text.secondary} />
                            <Text style={[styles.composeAddTitleText, { color: theme.text.secondary }]}>
                              {i18nText("autoI18n.liste_adi_ekle", "Liste adı ekle")}
                            </Text>
                          </TouchableOpacity>
                        ))}

                      {selectedItems.length === 1 && (
                        <Text style={[styles.composeHint, { color: theme.text.muted }]}>
                          {i18nText("autoI18n.sohbet_tek_icerik_ipucu", "Tek içerik kart olarak gider. Liste ya da anket için en az 2 içerik seç.")}
                        </Text>
                      )}

                      {/* Seçilen içerikler — sığmazsa bu bölge kayar (flexGrow, basis auto:
                          flex:1 + SheetScroll'un flexGrow:0'ı bölgeyi 0 yüksekliğe çökertiyordu). */}
                      <SheetScroll
                        style={styles.composeTrayScroll}
                        contentContainerStyle={styles.composeList}
                      >
                        {selectedItems.map((it, idx) => (
                          <View
                            key={itemKey(it)}
                            style={[styles.composeRow, { backgroundColor: theme.between }]}
                          >
                            <Text style={[styles.composeRowIndex, { color: theme.text.muted }]}>
                              {idx + 1}
                            </Text>
                            <View style={[styles.composeRowThumb, { backgroundColor: theme.secondary }]}>
                              {it.poster_path ? (
                                <Image
                                  source={{ uri: getTmdbUrl(it.poster_path, "poster", 200) }}
                                  style={styles.composeRowThumbImg}
                                  cachePolicy="memory-disk"
                                />
                              ) : (
                                <Ionicons
                                  name={it.media_type === "person" ? "person-outline" : "film-outline"}
                                  size={16}
                                  color={theme.text.muted}
                                />
                              )}
                            </View>
                            <View style={styles.composeRowTextCol}>
                              <Text
                                style={[styles.composeRowTitle, { color: theme.text.primary }]}
                                numberOfLines={1}
                              >
                                {it.title}
                              </Text>
                              <Text
                                style={[styles.composeRowMeta, { color: theme.text.muted }]}
                                numberOfLines={1}
                              >
                                {mediaMetaLabel(it)}
                              </Text>
                            </View>
                            <GlassTouchable
                              style={[styles.composeRowRemove, { backgroundColor: alpha(theme.text.primary, 0.08) }]}
                              onPress={() => toggleSelectItem(it)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              accessibilityRole="button"
                              accessibilityLabel={i18nText("autoI18n.kaldir", "Kaldır") + ": " + it.title}
                            >
                              <Ionicons name="close" size={15} color={theme.text.secondary} />
                            </GlassTouchable>
                          </View>
                        ))}
                      </SheetScroll>

                      {/* Aksiyon satırı — klavye açıkken de ekranın içinde kalır */}
                      <View style={styles.composeActions}>
                        <TouchableOpacity onPress={resetCompose} style={styles.composeClearBtn}>
                          <Text style={[styles.composeClearText, { color: theme.text.muted }]}>
                            {i18nText("autoI18n.temizle", "Temizle")}
                          </Text>
                        </TouchableOpacity>
                        <GlassTouchable
                          onPress={sendComposed}
                          style={[
                            styles.composeSendBtn,
                            {
                              backgroundColor: theme.accent,
                              shadowColor: theme.accent,
                            },
                          ]}
                          activeOpacity={0.85}
                        >
                          <Ionicons name={pollMode ? "stats-chart" : "send"} size={15} color="#fff" />
                          <Text style={styles.composeSendText}>
                            {pollMode
                              ? i18nText("autoI18n.anket_olustur", "Anket Oluştur")
                              : selectedItems.length >= 2
                                ? i18nText("autoI18n.listeyi_gonder_n", "Listeyi gönder ({{n}})", { n: selectedItems.length })
                                : i18nText("autoI18n.gonder", "Gönder")}
                          </Text>
                        </GlassTouchable>
                      </View>
                    </View>
                  )}
        </BottomSheetModal>

        {/* ── UZUN BASIN MODAL ── */}
        {optionsVisible && selectedMessage && (
          <BottomSheetModal
            visible={optionsVisible}
            onClose={() => setOptionsVisible(false)}
            intensity={35}
            dimColor="rgba(0,0,0,0.4)"
            sheetStyle={[
              styles.modalSheet,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border,
              },
            ]}
          >
                {/* Tutamaç */}
                <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

                {/* Mesaj önizleme kartı */}
                <View
                  style={[
                    styles.previewCard,
                    {
                      backgroundColor: theme.between,
                      borderColor: theme.border,
                    },
                  ]}
                >
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
                      <Text style={[styles.previewMediaType, { color: theme.text.muted }]}>
                        {selectedMessage.media.media_type === "movie"
                          ? i18nText("autoI18n.film", "Film")
                          : selectedMessage.media.media_type === "tv"
                            ? i18nText("autoI18n.dizi", "Dizi")
                            : i18nText("autoI18n.oyuncu", "Oyuncu")}
                      </Text>
                    )}
                    <Text
                      allowFontScaling={false}
                      style={[styles.previewMsgText, { color: theme.text.primary }]}
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
                <Text style={[styles.modalTimestamp, { color: theme.text.muted }]}>
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
                <View
                  style={[
                    styles.actionList,
                    {
                      backgroundColor: theme.between,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <GlassTouchable
                    style={[styles.actionRowL, { backgroundColor: theme.secondary }]}
                    onPress={() => beginReply(selectedMessage)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionIconBox, { backgroundColor: alpha(theme.accent, 0.16) }]}>
                      <Ionicons name="arrow-undo" size={20} color={theme.accent} />
                    </View>
                    <View style={styles.actionRowText}>
                      <Text style={[styles.actionRowTitle, { color: theme.text.primary }]}>
                        {i18nText("autoI18n.yanitla", "Yanıtla")}
                      </Text>
                      <Text style={[styles.actionRowSub, { color: theme.text.muted }]}>
                        {i18nText("autoI18n.mesaji_alintila", "Mesajı alıntılayarak yanıtla")}
                      </Text>
                    </View>
                  </GlassTouchable>

                  {(canPinSelected || canUnpinSelected) && (
                    <GlassTouchable
                      style={[styles.actionRowL, { backgroundColor: theme.secondary }]}
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
                        <Text style={[styles.actionRowTitle, { color: theme.text.primary }]}>
                          {canUnpinSelected
                            ? i18nText("autoI18n.sabitlemeyi_kaldir", "Sabitlemeyi kaldır")
                            : i18nText("autoI18n.mesaji_sabitle", "Mesajı sabitle")}
                        </Text>
                        <Text style={[styles.actionRowSub, { color: theme.text.muted }]}>
                          {canUnpinSelected
                            ? i18nText("autoI18n.sabitlerden_cikar", "Sabitlenmiş mesajlardan çıkar")
                            : i18nText("autoI18n.sohbetin_ustunde_goster", "Sohbetin üstünde göster")}
                        </Text>
                      </View>
                    </GlassTouchable>
                  )}

                  {/* Düzenleme yalnızca düz metin mesajlarda gösterilir;
                      paylaşılan media/koleksiyon mesajının metni başlıktır,
                      düzenlenmesi anlamsızdır. */}
                  {canEditSelected && (
                    <GlassTouchable
                      style={[styles.actionRowL, { backgroundColor: theme.secondary }]}
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
                        <Text style={[styles.actionRowTitle, { color: theme.text.primary }]}>
                          {i18nText("autoI18n.duzenle", "Düzenle")}
                        </Text>
                        <Text style={[styles.actionRowSub, { color: theme.text.muted }]}>
                          {i18nText("autoI18n.mesaji_degistir", "Mesajı değiştir")}
                        </Text>
                      </View>
                    </GlassTouchable>
                  )}

                  {canDeleteSelected && (
                    <GlassTouchable
                      style={[styles.actionRowR, { backgroundColor: theme.secondary }]}
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
                        <Text style={[styles.actionRowSub, { color: theme.text.muted }]}>{i18nText("autoI18n.bu_mesaji_kaldir", "Bu mesajı kaldır")}</Text>
                      </View>
                    </GlassTouchable>
                  )}

                  {/* Şikâyet + engelle (yalnız karşı tarafın mesajında).
                      Mağaza şartı: her UGC yüzeyinde bildirme yolu olmalı. */}
                  {canModerateSelected && (
                    <GlassTouchable
                      style={[styles.actionRowL, { backgroundColor: theme.secondary }]}
                      onPress={() => {
                        setOptionsVisible(false);
                        setReportTarget(selectedMessage);
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.actionIconBox,
                          { backgroundColor: "rgba(255,167,38,0.15)" },
                        ]}
                      >
                        <Feather name="flag" size={20} color="#FFA726" />
                      </View>
                      <View style={styles.actionRowText}>
                        <Text style={[styles.actionRowTitle, { color: theme.text.primary }]}>
                          {i18nText("autoI18n.sikayet_et", "Şikayet et")}
                        </Text>
                        <Text style={[styles.actionRowSub, { color: theme.text.muted }]}>
                          {i18nText("autoI18n.mesaji_sikayet_et", "Mesajı şikâyet et")}
                        </Text>
                      </View>
                    </GlassTouchable>
                  )}

                  {canModerateSelected && (
                    <GlassTouchable
                      style={[styles.actionRowR, { backgroundColor: theme.secondary }]}
                      onPress={() => {
                        setOptionsVisible(false);
                        confirmBlockUser(selectedMessage.senderId);
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.actionIconBox,
                          { backgroundColor: "rgba(255,107,107,0.15)" },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="account-cancel-outline"
                          size={20}
                          color={DANGER}
                        />
                      </View>
                      <View style={styles.actionRowText}>
                        <Text style={[styles.actionRowTitle, { color: DANGER }]}>
                          {i18nText("autoI18n.kullaniciyi_engelle", "Kullanıcıyı engelle")}
                        </Text>
                        <Text style={[styles.actionRowSub, { color: theme.text.muted }]}>
                          {i18nText("autoI18n.engelle", "Engelle")}
                        </Text>
                      </View>
                    </GlassTouchable>
                  )}
                </View>

                {/* İptal butonu */}
                <GlassTouchable
                  style={[
                    styles.cancelBtn,
                    {
                      backgroundColor: theme.between,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setOptionsVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.text.primary }]}>
                    {i18nText("autoI18n.iptal", "İptal")}
                  </Text>
                </GlassTouchable>
          </BottomSheetModal>
        )}

        <ReportReasonSheet
          visible={!!reportTarget}
          onClose={() => setReportTarget(null)}
          onSelect={submitMessageReport}
          subtitle={i18nText(
            "autoI18n.sikayet_hedefi_mesaj",
            "{{name}} kişisinin mesajı bildiriliyor.",
            { name: resolveSenderName(reportTarget) },
          )}
        />

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
          media={trailerMedia}
          apiKey={API_KEY}
          getTmdbUrl={getTmdbUrl}
          onClose={() => setTrailerMedia(null)}
        />

        <TextPollComposer
          visible={textPollVisible}
          onClose={closeTextPollModal}
          onCreate={sendTextPoll}
        />

        <SharedListSheet
          visible={listSheetVisible}
          share={listSheet?.share}
          getTmdbUrl={getTmdbUrl}
          onClose={closeListSheet}
          onDismissed={handleListSheetDismissed}
          onOpenItem={openListSheetItem}
          onSave={
            listSheet?.message?.senderId !== currentUser.uid ||
            listSheet?.share?.source === "cineswipe"
              ? saveFromListSheet
              : undefined
          }
        />

        <SaveSharedListModal
          visible={saveListVisible}
          post={saveListPost}
          onClose={() => setSaveListVisible(false)}
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

  // ── Mesaj listesi ──────────────────────────────────────
  chatList: { flex: 1 },
  listContent: { padding: 14, paddingBottom: 18 },
  latestMessageButton: {
    position: "absolute",
    right: 16,
    zIndex: 8,
    elevation: 7,
  },
  // Gölge/çerçeve YALNIZ eski yolda (cam kendi derinliğini çizer; RN gölgesi
  // cam yüzeyde eklenmez — bkz. GlassSurface kuralları).
  latestMessageFallback: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 6,
  },
  latestMessageDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
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

  messageText: { fontSize: 15, lineHeight: 22, color: "#fff" },
  linkText: {
    color: "#82B4FF",
    textDecorationLine: "underline",
    fontSize: 15,
    lineHeight: 22,
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
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 4,
  },

  // ── Ambiyans (Android 12+ hedef içi kopya) ─────────────
  ambientClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 0,
  },
  ambientFrame: {
    position: "absolute",
    left: 0,
    right: 0,
    height: AMBIENT_FRAME_HEIGHT,
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
  // Liste alt kenara kadar uzanır; yalnız mesaj kutusu dolguludur.
  // Ters listede paddingTop, son mesajı ölçülen kutunun üstünde tutar.
  messageViewport: { flex: 1 },
  inputContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 8 : 12,
    zIndex: 20,
  },
  composerPill: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1.5,
    borderRadius: 28,
    backgroundColor: "transparent",
    padding: 5,
  },
  // Engel bilgisi hapın yerini alıyor: aynı yükseklikte durur ki sohbet
  // listesi engelleme anında zıplamasın.
  composerBlocked: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    borderColor: "rgba(255,255,255,0.14)",
  },
  composerBlockedText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
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
  // Tek satırlık yükseklik FAB/gönder ile aynı (42) olmalı: hap flex-end
  // hizaladığı için kısa kalan input metni ikon merkezlerinden aşağı kayıyordu.
  // Android'de çok satırlı input metni tepeye yapışır, ortalamayı açıkça
  // istiyoruz; iOS textAlignVertical desteklemiyor, simetrik padding yetiyor.
  input: {
    backgroundColor: "transparent",
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "ios" ? 11 : 8,
    paddingBottom: Platform.OS === "ios" ? 11 : 8,
    fontSize: 15,
    maxHeight: 130,
    color: "#fff",
    ...(Platform.OS === "android" ? { textAlignVertical: "center" } : null),
  },
  linkHint: {
    height: 42,
    justifyContent: "center",
    paddingRight: 8,
  },
  attachBackdrop: {
    ...StyleSheet.absoluteFill,
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
    minHeight: 54,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "rgba(26,26,42,0.97)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  attachActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  attachActionText: {
    flex: 1,
    color: "rgba(255,255,255,0.9)",
    fontSize: 13.5,
    fontWeight: "700",
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
    flexShrink: 1,
    minHeight: "56%",
    maxHeight: "88%",
    overflow: "hidden",
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
  searchModalTitleCol: { flex: 1, minWidth: 0 },
  searchModalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
  searchModalSubtitle: { fontSize: 12, fontWeight: "500", marginTop: 1 },
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
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    color: "#fff",
  },
  searchInputTrail: { marginRight: 12 },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
  },
  categoryScroll: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: -4,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 4,
    paddingRight: 12,
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
  searchResultsArea: { flex: 1, minHeight: 76 },
  searchResultsList: { flex: 1 },
  searchGrid: { paddingBottom: 8, paddingHorizontal: 0 },
  searchGridRow: { alignItems: "flex-start" },
  searchEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22,
    paddingHorizontal: 24,
    gap: 8,
  },
  searchEmptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  searchEmptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  searchEmptyText: {
    color: "rgba(255,255,255,0.22)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  searchCardSlot: {
    flex: 1,
    minWidth: 0,
    maxWidth: (SCREEN_WIDTH - 32) / 3,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  searchCard: { width: "100%" },
  searchCardImageWrap: {
    width: "100%",
    aspectRatio: 2 / 3,
    position: "relative",
  },
  searchCardSelectedOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 12,
    borderWidth: 2.5,
  },
  selectDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  searchCardImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  searchCardPlaceholder: { justifyContent: "center", alignItems: "center" },
  ratingBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.68)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: { fontSize: 9.5, fontWeight: "800", color: "#fff" },
  searchCardTitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 15,
  },
  searchCardMeta: { marginTop: 2, fontSize: 10.5, fontWeight: "500" },

  // ── Seçim çubuğu (sonuçların altında) ────────────────────
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  selectionBarThumbs: { flexDirection: "row", alignItems: "center" },
  selectionBarThumb: {
    width: 30,
    height: 45,
    borderRadius: 6,
    borderWidth: 2,
    overflow: "hidden",
  },
  selectionBarThumbImg: { width: "100%", height: "100%" },
  selectionBarTextCol: { flex: 1, minWidth: 0 },
  selectionBarTitle: { fontSize: 13.5, fontWeight: "800" },
  selectionBarSub: { fontSize: 11.5, fontWeight: "500", marginTop: 1 },
  selectionBarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 9,
    borderRadius: 14,
  },
  selectionBarBtnText: { color: "#fff", fontSize: 13.5, fontWeight: "800" },

  // ── Seçilenler paneli ────────────────────────────────────
  composeTray: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    flexShrink: 1,
    minHeight: 0,
  },
  // flexGrow (basis auto): panel içeriği kadar uzar (sayfa en çok maxHeight'a
  // kadar büyür), sığmazsa küçülür ve yalnız liste bölgesi kayar.
  composeTrayPanel: {
    flexGrow: 1,
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
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
  // SheetScroll flexGrow:0 / flexShrink:1 verir; burada flexGrow:1 ile alanı
  // doldurur. `flex: 1` YAZMA: flexBasis 0 + SheetScroll'un flexGrow:0'ı bölgeyi
  // 0 yüksekliğe çökertiyordu (seçilen içerikler hiç görünmüyordu).
  composeTrayScroll: { flexGrow: 1 },
  composeList: { gap: 6, paddingBottom: 4 },
  composeHint: { fontSize: 12, lineHeight: 17 },
  composeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 14,
  },
  composeRowIndex: { width: 16, fontSize: 12, fontWeight: "800", textAlign: "center" },
  composeRowThumb: {
    width: 34,
    height: 51,
    borderRadius: 6,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  composeRowThumbImg: { width: "100%", height: "100%" },
  composeRowTextCol: { flex: 1, minWidth: 0 },
  composeRowTitle: { fontSize: 13.5, fontWeight: "700" },
  composeRowMeta: { fontSize: 11.5, fontWeight: "500", marginTop: 2 },
  composeRowRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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
    paddingTop: 2,
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
    // overflow YOK: cam satırlar basılınca kutunun sınırında kesilirdi. Satır köşesi (14) +
    // dolgu (4) = kutunun köşesi (18); kırpılacak taşma yok.
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
