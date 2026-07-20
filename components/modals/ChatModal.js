import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  LayoutAnimation,
  UIManager,
  Alert,
  Dimensions,
  DeviceEventEmitter,
} from "react-native";

if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}
import { Image } from "expo-image";
import Toast from "react-native-toast-message";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import {
  useAppSettings,
  useImageQualitySettings,
} from "@context/AppSettingsContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import Markdown from "react-native-markdown-display";
import Reanimated, {
  LinearTransition,
  FadeInDown,
  FadeOutDown,
  FadeInUp,
} from "react-native-reanimated";
import LottieView from "lottie-react-native";
import { useNavigation } from "@react-navigation/native";
import { useProfileStats } from "@context/ProfileStatsContext";
import { BlurView } from "expo-blur";

import {
  askGemini,
  buildUserPrompt,
  extractTitles,
  formatForMarkdown,
} from "@services/geminiService";
import { resolveCards } from "@services/tmdbLookup";
import AIChatScreen from "@screens/chat/AIChatScreen";
import { i18nText } from "@utils/i18nText";
import { appAlert } from "@components/AppAlert";
import { AI_CHAT_EVENT } from "@context/PetContext";

import {
  loadConversations,
  persistConversations,
  upsertConversation,
  removeConversation,
  makeId,
  summarizeTitle,
} from "@services/aiConversationsStore";

const { height: SCREEN_H } = Dimensions.get("window");

// ─── Tema renk örnekleri (ayarlar kartındaki seçici) ─────────────────────────
// key → colors.js'deki tema anahtarı; bg/bc/tc → daire dolgu/kenar/✓ rengi.
const THEME_SWATCHES = [
  { key: "dark", bg: "#000000", bc: "#3A3A3A", tc: "#FFFFFF", label: "siyah" },
  { key: "light", bg: "#E8E8E8", bc: "#B0B0B0", tc: "#222222", label: "beyaz" },
  { key: "gray", bg: "#2C2C2C", bc: "#555555", tc: "#FFFFFF", label: "gri" },
  { key: "blue", bg: "#141C33", bc: "#5374AC", tc: "#8BAFD0", label: "mavi" },
  { key: "green", bg: "#A9BDBB", bc: "#1C4F4E", tc: "#143636", label: i18nText("autoI18n.yesil", "yeşil") },
];

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
const getRatingColor = (r) => {
  if (r >= 8) return "#29b864";
  if (r >= 6) return "#f5c518";
  if (r >= 4) return "#ff6400";
  return "#e33";
};

/** "az önce / 5 dk / 3 sa / dün / 12.06" gibi kısa görece zaman. */
const formatRelative = (ts) => {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "•";
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa`;
  const d = Math.floor(h / 24);
  if (d === 1) return i18nText("autoI18n.dun_lower", "dün");
  if (d < 7) return `${d} g`;
  const date = new Date(ts);
  return `${String(date.getDate()).padStart(2, "0")}.${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}`;
};

const makeMarkdownStyles = (theme) => ({
  body: { color: theme.text.secondary, fontSize: 14, lineHeight: 21 },
  heading1: {
    color: theme.text.primary,
    fontSize: 19,
    fontWeight: "800",
    marginVertical: 6,
  },
  heading2: {
    color: theme.text.primary,
    fontSize: 16,
    fontWeight: "700",
    marginVertical: 5,
  },
  heading3: {
    color: theme.text.secondary,
    fontSize: 14,
    fontWeight: "600",
    marginVertical: 4,
  },
  paragraph: {
    marginVertical: 4,
    flexWrap: "wrap",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  strong: { fontWeight: "bold", color: theme.text.primary },
  em: { fontStyle: "italic", color: theme.text.secondary },
  s: { textDecorationLine: "line-through" },
  link: { color: theme.bold, textDecorationLine: "underline" },
  bullet_list: { paddingLeft: 4, marginVertical: 2 },
  ordered_list: { paddingLeft: 4, marginVertical: 2 },
  list_item: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  bullet_list_icon: {
    marginRight: 7,
    marginTop: 3,
    color: theme.bold,
  },
  ordered_list_icon: {
    marginRight: 7,
    marginTop: 3,
    color: theme.text.secondary,
  },
  code_inline: {
    backgroundColor: theme.border,
    color: theme.text.primary,
    paddingHorizontal: 4,
    borderRadius: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 13,
  },
  fence: {
    backgroundColor: theme.border,
    color: theme.text.primary,
    padding: 10,
    borderRadius: 8,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 13,
    marginVertical: 6,
  },
  blockquote: {
    backgroundColor: theme.border,
    borderLeftWidth: 3,
    borderLeftColor: theme.bold,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 6,
    borderRadius: 4,
  },
  hr: { backgroundColor: theme.border, height: 1, marginVertical: 8 },
});

// ─── "Yazıyor" üç nokta animasyonu ────────────────────────────────────────────
const TypingDot = memo(({ color, delay }) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.delay(Math.max(0, 600 - delay)),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
        ],
      }}
    />
  );
});

const TypingBubble = memo(({ theme, label }) => (
  <Reanimated.View
    entering={FadeInUp.duration(220)}
    style={[styles.row, styles.rowAi]}
  >
    <View
      style={[
        styles.bubble,
        styles.bubbleAi,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <TypingDot color={theme.bold} delay={0} />
          <TypingDot color={theme.bold} delay={150} />
          <TypingDot color={theme.bold} delay={300} />
        </View>
        <Text style={{ color: theme.text.muted, fontSize: 12 }}>{label}</Text>
      </View>
    </View>
  </Reanimated.View>
));

// ─── Poster kartı ─────────────────────────────────────────────────────────────
const PosterCard = memo(({ card, theme, t, getTmdbUrl, onPress }) => {
  const ratingColor = getRatingColor(card.rating || 0);
  const typeLabel =
    card.mediaType === "movie" ? t?.ChatModal?.movie : t?.ChatModal?.series;
  const typeColor =
    card.mediaType === "movie"
      ? theme.notesColor.blue
      : theme.notesColor.green;

  // Bulunamayan başlık → "Ara" çipi
  if (!card.found) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onPress(card)}
        style={[
          styles.notFoundChip,
          { backgroundColor: theme.between, borderColor: theme.border },
        ]}
      >
        <Ionicons
          name={card.mediaType === "movie" ? "film-outline" : "tv-outline"}
          size={13}
          color={typeColor}
        />
        <Text
          numberOfLines={1}
          style={{ color: theme.text.primary, fontSize: 12, maxWidth: 120 }}
        >
          {card.query}
        </Text>
        <Ionicons name="search" size={12} color={theme.text.muted} />
      </TouchableOpacity>
    );
  }

  const posterUri = card.posterPath
    ? getTmdbUrl(card.posterPath, "poster", 96)
    : null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(card)}
      style={styles.posterCard}
    >
      <View style={[styles.posterWrap, { backgroundColor: theme.between }]}>
        {posterUri ? (
          <Image source={{ uri: posterUri }} style={styles.poster} contentFit="cover" />
        ) : (
          <View style={[styles.posterFallback, { backgroundColor: theme.between }]}>
            <Ionicons
              name={card.mediaType === "movie" ? "film-outline" : "tv-outline"}
              size={26}
              color={theme.text.muted}
            />
          </View>
        )}
        {card.rating > 0 && (
          <View
            style={[styles.posterRating, { backgroundColor: ratingColor + "ee" }]}
          >
            <Text style={styles.posterRatingText}>★ {card.rating.toFixed(1)}</Text>
          </View>
        )}
        <View
          style={[styles.posterTypeBadge, { backgroundColor: theme.primary + "cc" }]}
        >
          <Text style={{ color: typeColor, fontSize: 8, fontWeight: "700" }}>
            {typeLabel}
          </Text>
        </View>
      </View>
      <Text
        numberOfLines={2}
        style={[styles.posterTitle, { color: theme.text.primary }]}
      >
        {card.title}
      </Text>
      {!!card.year && (
        <Text style={[styles.posterYear, { color: theme.text.muted }]}>
          {card.year}
        </Text>
      )}
    </TouchableOpacity>
  );
});

// ─── Mesaj baloncuğu ──────────────────────────────────────────────────────────
const MessageBubble = memo(
  ({ msg, theme, t, markdownStyles, getTmdbUrl, onCardPress, onRetry }) => {
    // Kullanıcı mesajı — sağda
    if (msg.role === "user") {
      return (
        <Reanimated.View entering={FadeInUp.duration(220)} style={[styles.row, styles.rowUser]}>
          <View
            style={[
              styles.bubble,
              styles.bubbleUser,
              { backgroundColor: theme.accent },
            ]}
          >
            <Text selectable style={{ color: "#fff", fontSize: 14, lineHeight: 20 }}>
              {msg.display || msg.text}
            </Text>
          </View>
        </Reanimated.View>
      );
    }

    // Hata baloncuğu — solda, kırmızı ton + tekrar dene
    if (msg.status === "error") {
      return (
        <Reanimated.View entering={FadeInUp.duration(220)} style={[styles.row, styles.rowAi]}>
          <View
            style={[
              styles.bubble,
              styles.bubbleAi,
              {
                backgroundColor: theme.notesColor.redBackground,
                borderColor: theme.colors.red + "55",
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="alert-circle" size={16} color={theme.colors.red} />
              <Text style={{ color: theme.text.primary, fontSize: 13, flex: 1 }}>
                {msg.text}
              </Text>
            </View>
            {!!msg.retry && (
              <TouchableOpacity
                onPress={() => onRetry(msg.id, msg.retry)}
                style={[styles.retryBtn, { borderColor: theme.colors.red + "66" }]}
              >
                <Ionicons name="refresh" size={13} color={theme.colors.red} />
                <Text style={{ color: theme.colors.red, fontSize: 12, fontWeight: "600" }}>
                  {t?.ChatModal?.retry}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Reanimated.View>
      );
    }

    // Normal AI cevabı — solda, markdown + poster kartları
    return (
      <Reanimated.View entering={FadeInUp.duration(220)} style={[styles.row, styles.rowAi]}>
        <View
          style={[
            styles.bubble,
            styles.bubbleAi,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <Markdown style={markdownStyles}>{formatForMarkdown(msg.text)}</Markdown>

          {Array.isArray(msg.cards) && msg.cards.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <FlatList
                horizontal
                data={msg.cards}
                keyExtractor={(c) => c.key}
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
                renderItem={({ item }) => (
                  <PosterCard
                    card={item}
                    theme={theme}
                    t={t}
                    getTmdbUrl={getTmdbUrl}
                    onPress={onCardPress}
                  />
                )}
              />
            </View>
          )}
        </View>
      </Reanimated.View>
    );
  },
);

// ─── Geçmiş satırı (kayıtlı sohbet) ───────────────────────────────────────────
const ConversationRow = memo(({ conv, theme, t, isActive, onOpen, onDelete }) => {
  const count = conv.messages?.length || 0;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onOpen(conv)}
      style={[
        styles.convRow,
        {
          backgroundColor: isActive ? theme.between : theme.secondary,
          borderColor: isActive ? theme.bold : theme.border,
        },
      ]}
    >
      <View
        style={[styles.convIcon, { backgroundColor: theme.primary }]}
      >
        <MaterialCommunityIcons name="message-text-outline" size={18} color={theme.bold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: theme.text.primary, fontSize: 14, fontWeight: "600" }}>
          {conv.title}
        </Text>
        <Text style={{ color: theme.text.muted, fontSize: 11, marginTop: 2 }}>
          {count} {t?.ChatModal?.messagesCount} · {formatRelative(conv.updatedAt)}
        </Text>
      </View>
      <TouchableOpacity
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={() => onDelete(conv.id)}
        style={{ padding: 4 }}
      >
        <MaterialIcons name="delete-outline" size={20} color={theme.text.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
export const ChatModal = () => {
  const navigation = useNavigation();
  const { t, language, toggleLanguage } = useLanguage();
  const { theme, selectedTheme, changeTheme } = useTheme();
  const { API_KEY, adultContent } = useAppSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const {
    mostWatchedGenre,
    secondWatchedGenre,
    threeWatchedGenre,
    mostWatchedGenreTv,
    secondWatchedGenreTv,
    thirdWatchedGenreTv,
  } = useProfileStats();

  const [modalVisible, setModalVisible] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const [aiOrigin, setAiOrigin] = useState(null); // pet konumu → modal oradan açılır
  const [view, setView] = useState("chat"); // "chat" | "history"
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  // Android'de RN Modal içindeki KeyboardAvoidingView (behavior:"height")
  // edge-to-edge altında pencere yeniden boyutlanmadığı için hiç tepki
  // vermiyor; input klavyenin altında kalıyordu. Yüksekliği event'ten alıp
  // içeriği elle yukarı iteriz (iOS'ta KAV "padding" çalışmaya devam eder).
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Aktif sohbet
  const [messages, setMessages] = useState([]);
  const [activeId, setActiveId] = useState(null);
  // Kayıtlı sohbetler (geçmiş)
  const [conversations, setConversations] = useState([]);

  // Tür seçimi
  const [genres, setGenres] = useState([]);
  const [genresTv, setGenresTv] = useState([]);

  const scrollRef = useRef(null);
  const markdownStyles = useMemo(() => makeMarkdownStyles(theme), [theme]);

  const threadMaxHeight = isKeyboardVisible ? SCREEN_H * 0.34 : SCREEN_H * 0.56;

  const scrollToEndSoon = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, []);

  // ── Kayıtlı sohbetleri yükle (bir kez) ──────────────────────────────────────
  useEffect(() => {
    loadConversations().then(setConversations).catch(() => {});
  }, []);

  // ── Yüzen PET'e basılı tutunca AI sohbetini aç (eski gemini FAB'ının yerine) ──
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(AI_CHAT_EVENT, (origin) => {
      // Pet'in merkez konumu → modal o noktadan büyüyerek açılsın.
      if (origin && typeof origin.x === "number") {
        setAiOrigin([origin.x, origin.y, 0]);
      }
      setAiVisible(true);
    });
    return () => sub.remove();
  }, []);

  // ── Klavye dinleyicileri ────────────────────────────────────────────────────
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardVisible(true);
      const h = e?.endCoordinates?.height || 0;
      setKeyboardHeight(h);
      if (__DEV__) console.log("[ChatModal] keyboardDidShow height=", h);
      scrollToEndSoon();
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scrollToEndSoon]);

  const animateLayout = () =>
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  // ── Tür seçim toggle'ları ───────────────────────────────────────────────────
  const chooseGenres = () => {
    if (genres.length > 0) setGenres([]);
    else {
      setGenresTv([]);
      setGenres([mostWatchedGenre, secondWatchedGenre, threeWatchedGenre].filter(Boolean));
    }
  };
  const chooseGenresTv = () => {
    if (genresTv.length > 0) setGenresTv([]);
    else {
      setGenres([]);
      setGenresTv(
        [mostWatchedGenreTv, secondWatchedGenreTv, thirdWatchedGenreTv].filter(Boolean),
      );
    }
  };

  // ── GeminiError.code → lokalize hata mesajı ─────────────────────────────────
  const errorMessageForCode = useCallback(
    (code) => {
      const e = t?.ChatModal?.errors || {};
      switch (code) {
        case "NO_API_KEY":
          return e.noApiKey;
        case "NETWORK":
          return e.network;
        case "TIMEOUT":
          return e.timeout;
        case "RATE_LIMIT":
          return e.rateLimit;
        case "QUOTA":
          return e.quota || "Bugünlük AI hakkın doldu. Yarın tekrar dene.";
        case "AUTH":
          return e.authRequired || "AI sohbet için giriş yapman gerekiyor.";
        case "BLOCKED":
          return e.blocked;
        case "EMPTY":
          return e.empty;
        default:
          return e.generic;
      }
    },
    [t],
  );

  // ── Aktif sohbeti diske kaydet ──────────────────────────────────────────────
  const saveActiveConversation = useCallback((msgs, id) => {
    if (!id || !msgs.length) return;
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === id);
      const now = Date.now();
      const firstUser = msgs.find((m) => m.role === "user");
      const conv = {
        id,
        title: existing?.title || summarizeTitle(firstUser?.display || firstUser?.text || ""),
        messages: msgs,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      const next = upsertConversation(prev, conv);
      persistConversations(next);
      return next;
    });
  }, []);

  // ── Asistanı çalıştır (yeni gönderim + tekrar dene ortak çekirdeği) ─────────
  const runAssistant = useCallback(
    async (msgsIncludingUser, convId, userText) => {
      setLoading(true);
      scrollToEndSoon();
      try {
        const priorHistory = msgsIncludingUser
          .filter((m) => m.status !== "error")
          .slice(0, -1) // son kullanıcı mesajını çıkar (userText olarak ayrı gider)
          .map((m) => ({ role: m.role, text: m.text }));

        // API anahtarı istemcide değil — istek callGemini proxy'sinden geçer.
        const { text: rawText } = await askGemini({
          history: priorHistory,
          userMessage: userText,
          language,
          movieGenres: [mostWatchedGenre, secondWatchedGenre, threeWatchedGenre],
          tvGenres: [mostWatchedGenreTv, secondWatchedGenreTv, thirdWatchedGenreTv],
          offTopicReply: t?.ChatModal?.offTopic,
        });

        // Önerilen başlıkları TMDB'den poster kartlarına çöz
        const { movies, series } = extractTitles(rawText);
        let cards = [];
        if (movies.length || series.length) {
          cards = await resolveCards({
            apiKey: API_KEY,
            movies,
            series,
            language,
            includeAdult: adultContent,
          });
        }

        const aiMsg = { id: makeId(), role: "assistant", text: rawText, cards };
        const finalMessages = [...msgsIncludingUser, aiMsg];
        setMessages(finalMessages);
        saveActiveConversation(finalMessages, convId);
        scrollToEndSoon();
      } catch (err) {
        const code = err?.code || "GENERIC";
        if (__DEV__) {
          console.warn(i18nText("autoI18n.gemini_hata", "[Gemini] hata:"), code, err?.message);
          appAlert(i18nText("autoI18n.gemini_hatasi_dev", "Gemini hatası (DEV)"), `${code}\n\n${err?.message ?? ""}`);
        }
        const errMsg = {
          id: makeId(),
          role: "assistant",
          status: "error",
          text: errorMessageForCode(code),
          retry: userText,
        };
        const finalMessages = [...msgsIncludingUser, errMsg];
        setMessages(finalMessages);
        saveActiveConversation(finalMessages, convId);
        scrollToEndSoon();
      } finally {
        setLoading(false);
      }
    },
    [
      language,
      mostWatchedGenre,
      secondWatchedGenre,
      threeWatchedGenre,
      mostWatchedGenreTv,
      secondWatchedGenreTv,
      thirdWatchedGenreTv,
      t,
      API_KEY,
      adultContent,
      saveActiveConversation,
      errorMessageForCode,
      scrollToEndSoon,
    ],
  );

  // ── Gönder ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (loading) return;
    const hasGenres = genres.length > 0 || genresTv.length > 0;
    if (!hasGenres && message.trim() === "") return;

    const userText = buildUserPrompt({
      message,
      movieGenres: genres,
      tvGenres: genresTv,
    });
    if (!userText.trim()) return;

    const displayText = message.trim() || [...genres, ...genresTv].join(", ");
    const convId = activeId || makeId();
    if (!activeId) setActiveId(convId);

    const userMsg = {
      id: makeId(),
      role: "user",
      text: userText,
      display: displayText,
    };
    const msgs = [...messages, userMsg];
    setMessages(msgs);
    setMessage("");
    setGenres([]);
    setGenresTv([]);
    Keyboard.dismiss();
    runAssistant(msgs, convId, userText);
  }, [loading, genres, genresTv, message, activeId, messages, runAssistant]);

  const handleRetry = useCallback(
    (errId, userText) => {
      if (loading) return;
      const cleaned = messages.filter((m) => m.id !== errId);
      setMessages(cleaned);
      const convId = activeId || makeId();
      if (!activeId) setActiveId(convId);
      runAssistant(cleaned, convId, userText);
    },
    [loading, messages, activeId, runAssistant],
  );

  // ── Sohbet yönetimi ─────────────────────────────────────────────────────────
  const newChat = useCallback(() => {
    setMessages([]);
    setActiveId(null);
    setMessage("");
    setView("chat");
  }, []);

  const openConversation = useCallback(
    (conv) => {
      setMessages(conv.messages || []);
      setActiveId(conv.id);
      setView("chat");
      scrollToEndSoon();
    },
    [scrollToEndSoon],
  );

  const deleteConversation = useCallback(
    (id) => {
      setConversations((prev) => {
        const next = removeConversation(prev, id);
        persistConversations(next);
        return next;
      });
      if (id === activeId) newChat();
    },
    [activeId, newChat],
  );

  const clearAllConversations = useCallback(() => {
    setConversations([]);
    persistConversations([]);
  }, []);

  // ── Poster kartı tıklanınca ─────────────────────────────────────────────────
  const handleCardPress = useCallback(
    (card) => {
      setModalVisible(false);
      if (card.found && card.id) {
        navigation.navigate(
          card.mediaType === "movie" ? "MovieDetails" : "TvShowsDetails",
          { id: card.id },
        );
      } else {
        navigation.navigate(
          card.mediaType === "movie" ? "MovieSearch" : "TvShowSearch",
          { name: card.query },
        );
      }
    },
    [navigation],
  );

  // ── FAB animasyonlu çerçeve ─────────────────────────────────────────────────
  const animation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop;
    if (modalVisible) {
      animation.setValue(0);
      loop = Animated.loop(
        Animated.timing(animation, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: false,
        }),
      );
      loop.start();
    }
    return () => loop && loop.stop();
  }, [modalVisible]);

  const interpolateColor = animation.interpolate({
    inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1],
    outputRange: [
      "#00FF0030",
      "#0000FF30",
      "#4B008230",
      "#EE82EE30",
      "#FF000030",
      "#FFA50030",
      "#FFFF0030",
      "#00FF0030",
    ],
  });

  const closeModal = () => {
    animateLayout();
    setModalVisible(false);
    setSettingsVisible(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View>
      {/* Eski gemini Lottie FAB kaldırıldı — artık yüzen PET (PetCompanion)
          basılı tutunca AI_CHAT_EVENT yayınlıyor, yukarıdaki listener açıyor. */}
      <AIChatScreen
        visible={aiVisible}
        fabOrigin={aiOrigin}
        onClose={() => setAiVisible(false)}
      />

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <LinearGradient
          colors={["transparent", theme.shadow, theme.shadow]}
          style={{ position: "absolute", top: 0, right: 0, left: 0, bottom: 0, zIndex: 4 }}
        />
        <KeyboardAvoidingView
          // Android: behavior "height" modal penceresinde işlevsiz — kaydırma
          // aşağıdaki marginBottom (keyboardHeight) ile yapılır; KAV'ı devre
          // dışı bırakmak çifte kaymayı önler. iOS: "padding" çalışır.
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalContainer}
          keyboardVerticalOffset={0}
        >
          <View style={{ flex: 1, width: "100%" }} />
          <TouchableOpacity
            onPress={closeModal}
            style={{ position: "absolute", top: 0, right: 0, left: 0, bottom: 0, zIndex: 5 }}
          />

          <Reanimated.View
            layout={LinearTransition.springify()}
            style={[
              styles.modalContent,
              { backgroundColor: "transparent", zIndex: 11, shadowColor: theme.shadow, overflow: "hidden" },
            ]}
          >
            <BlurView
              tint="dark"
              intensity={50}
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />

            {view === "chat" ? (
              <View style={{ zIndex: 15, width: "100%" }}>
                {/* ── Başlık çubuğu ── */}
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                    <LottieView
                      style={{ width: 26, height: 26 }}
                      source={require("@lottie/gemini.json")}
                      autoPlay
                      loop
                    />
                    <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
                      CineMatch
                    </Text>
                  </View>
                  <TouchableOpacity onPress={newChat} style={styles.headerBtn} hitSlop={8}>
                    <MaterialCommunityIcons name="chat-plus-outline" size={22} color={theme.text.between} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setView("history")}
                    style={styles.headerBtn}
                    hitSlop={8}
                  >
                    <MaterialIcons name="history" size={24} color={theme.text.between} />
                  </TouchableOpacity>
                </View>

                {/* ── Mesaj akışı ── */}
                <ScrollView
                  ref={scrollRef}
                  style={{ maxHeight: threadMaxHeight }}
                  contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 12 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                >
                  {messages.length === 0 && !loading ? (
                    <View style={styles.emptyState}>
                      <LottieView
                        style={{ width: 90, height: 90, opacity: 0.9 }}
                        source={require("@lottie/gemini.json")}
                        autoPlay
                        loop
                      />
                      <Text style={[styles.emptyText, { color: theme.text.muted }]}>
                        {t?.ChatModal?.emptyChat}
                      </Text>
                    </View>
                  ) : (
                    messages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        theme={theme}
                        t={t}
                        markdownStyles={markdownStyles}
                        getTmdbUrl={getTmdbUrl}
                        onCardPress={handleCardPress}
                        onRetry={handleRetry}
                      />
                    ))
                  )}
                  {loading && <TypingBubble theme={theme} label={t?.ChatModal?.typing} />}
                </ScrollView>

                {/* ── Ayarlar (minimalist) ── */}
                {settingsVisible && (
                  <Reanimated.View
                    entering={FadeInDown.duration(240)}
                    exiting={FadeOutDown.duration(160)}
                    layout={LinearTransition.springify()}
                    style={styles.settingsBar}
                  >
                    {/* Tema noktaları + dil geçişi */}
                    <View style={styles.minRow}>
                      <View style={styles.dotRow}>
                        {THEME_SWATCHES.map((th) => {
                          const active = selectedTheme === th.key;
                          return (
                            <TouchableOpacity
                              key={th.key}
                              onPress={() => changeTheme(th.key)}
                              hitSlop={6}
                              activeOpacity={0.7}
                            >
                              <View
                                style={[
                                  styles.dot,
                                  {
                                    backgroundColor: th.bg,
                                    borderColor: active ? theme.bold : theme.border,
                                    borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                                  },
                                ]}
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <TouchableOpacity
                        onPress={() => toggleLanguage(language === "tr" ? "en" : "tr")}
                        hitSlop={6}
                        style={styles.langToggle}
                      >
                        <Text
                          style={[
                            styles.langText,
                            { color: language === "tr" ? theme.text.primary : theme.text.muted },
                          ]}
                        >
                          TR
                        </Text>
                        <Text style={[styles.langText, { color: theme.text.muted }]}> · </Text>
                        <Text
                          style={[
                            styles.langText,
                            { color: language === "en" ? theme.text.primary : theme.text.muted },
                          ]}
                        >
                          EN
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Tür filtreleri */}
                    <View style={styles.minChipRow}>
                      <TouchableOpacity
                        onPress={chooseGenres}
                        activeOpacity={0.7}
                        style={[
                          styles.minChip,
                          {
                            borderColor: genres.length > 0 ? theme.bold : theme.border,
                            backgroundColor: genres.length > 0 ? theme.bold + "1F" : "transparent",
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="movie-outline"
                          size={14}
                          color={genres.length > 0 ? theme.bold : theme.text.muted}
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.minChipText,
                            { color: genres.length > 0 ? theme.bold : theme.text.secondary },
                          ]}
                        >
                          {t?.ChatModal?.watchedMovieGenres}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={chooseGenresTv}
                        activeOpacity={0.7}
                        style={[
                          styles.minChip,
                          {
                            borderColor: genresTv.length > 0 ? theme.bold : theme.border,
                            backgroundColor: genresTv.length > 0 ? theme.bold + "1F" : "transparent",
                          },
                        ]}
                      >
                        <Ionicons
                          name="tv-outline"
                          size={14}
                          color={genresTv.length > 0 ? theme.bold : theme.text.muted}
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.minChipText,
                            { color: genresTv.length > 0 ? theme.bold : theme.text.secondary },
                          ]}
                        >
                          {t?.ChatModal?.watchedTvGenres}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </Reanimated.View>
                )}

                {/* ── Giriş çubuğu ── */}
                <Animated.View style={{ borderRadius: 20, margin: 8, backgroundColor: interpolateColor }}>
                  <View style={styles.inputRow}>
                    <TouchableOpacity
                      onPress={() => {
                        animateLayout();
                        setSettingsVisible(!settingsVisible);
                      }}
                      style={{ marginRight: genres.length > 0 || genresTv.length > 0 ? 5 : 0 }}
                    >
                      <Feather
                        name="settings"
                        size={22}
                        color={settingsVisible ? theme.text.primary : theme.text.secondary}
                      />
                    </TouchableOpacity>

                    {(genres.length > 0 || genresTv.length > 0) && (
                      <TouchableOpacity
                        style={[styles.genreChip, { backgroundColor: theme.between }]}
                        onPress={genres.length > 0 ? chooseGenres : chooseGenresTv}
                      >
                        {[...genres, ...genresTv].map((gen) => (
                          <Text key={gen} style={[styles.themeText, { color: theme.text.primary }]}>
                            {gen}
                          </Text>
                        ))}
                      </TouchableOpacity>
                    )}

                    <TextInput
                      style={[
                        styles.input,
                        {
                          color: theme.text.primary,
                          flex: 1,
                        },
                      ]}
                      placeholder={
                        genres.length > 0
                          ? t?.ChatModal?.placeholderGenresMovies
                          : genresTv.length > 0
                            ? t?.ChatModal?.placeholderGenresTv
                            : t?.ChatModal?.placeholder
                      }
                      placeholderTextColor={theme.text.muted}
                      value={message}
                      onChangeText={setMessage}
                      multiline
                      onSubmitEditing={handleSend}
                    />

                    <TouchableOpacity
                      style={[styles.sendButton, { backgroundColor: theme.border }]}
                      onPress={handleSend}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color={theme.text.primary} size="small" />
                      ) : (
                        <Ionicons
                          name="send"
                          size={22}
                          color={
                            message.length > 0 || genres.length > 0 || genresTv.length > 0
                              ? theme.text.primary
                              : theme.text.secondary
                          }
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </View>
            ) : (
              // ── Geçmiş görünümü ──
              <View style={{ zIndex: 15, width: "100%" }}>
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                  <TouchableOpacity onPress={() => setView("chat")} style={styles.headerBtn} hitSlop={8}>
                    <Ionicons name="chevron-back" size={26} color={theme.text.primary} />
                  </TouchableOpacity>
                  <Text style={[styles.headerTitle, { color: theme.text.primary, flex: 1, marginLeft: 4 }]}>
                    {t?.ChatModal?.history}
                  </Text>
                  {conversations.length > 0 && (
                    <TouchableOpacity onPress={clearAllConversations} style={styles.headerBtn} hitSlop={8}>
                      <MaterialCommunityIcons name="delete-sweep-outline" size={22} color={theme.text.between} />
                    </TouchableOpacity>
                  )}
                </View>

                {conversations.length === 0 ? (
                  <View style={[styles.emptyState, { paddingVertical: 50 }]}>
                    <MaterialCommunityIcons name="message-off-outline" size={48} color={theme.text.muted} />
                    <Text style={[styles.emptyText, { color: theme.text.muted }]}>
                      {t?.ChatModal?.noConversations}
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={conversations}
                    keyExtractor={(c) => c.id}
                    style={{ maxHeight: SCREEN_H * 0.6 }}
                    contentContainerStyle={{ padding: 10, gap: 8 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <ConversationRow
                        conv={item}
                        theme={theme}
                        t={t}
                        isActive={item.id === activeId}
                        onOpen={openConversation}
                        onDelete={deleteConversation}
                      />
                    )}
                  />
                )}
              </View>
            )}
          </Reanimated.View>

          {/* Android klavye ayracı: modal penceresi "resize" olmadığından ve
              LinearTransition'lı view'a verilen inline margin layout
              animasyonu tarafından yutulabildiğinden, flex-end düzeninde
              içeriği klavye kadar yukarı iten AYRI bir boşluk kullanılır. */}
          {Platform.OS === "android" && keyboardHeight > 0 && (
            <View style={{ height: keyboardHeight, width: "100%" }} />
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 85,
    right: 25,
    borderRadius: 40,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  modalContent: {
    width: "95%",
    borderRadius: 20,
    bottom: 10,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  // Başlık
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  headerBtn: { paddingHorizontal: 6, paddingVertical: 2 },

  // Mesaj satırı / baloncuk
  row: { width: "100%", marginBottom: 10, flexDirection: "row" },
  rowUser: { justifyContent: "flex-end" },
  rowAi: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "88%",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleUser: { borderBottomRightRadius: 5 },
  bubbleAi: { borderBottomLeftRadius: 5, borderWidth: StyleSheet.hairlineWidth },

  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },

  // Boş durum
  emptyState: {
    minHeight: 220,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 30,
    gap: 10,
  },
  emptyText: { fontSize: 13, textAlign: "center", maxWidth: "80%", lineHeight: 18 },

  // Poster kartı
  posterCard: { width: 96 },
  posterWrap: {
    width: 96,
    height: 144,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  poster: { width: "100%", height: "100%" },
  posterFallback: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  posterRating: {
    position: "absolute",
    top: 5,
    right: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 7,
  },
  posterRatingText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  posterTypeBadge: {
    position: "absolute",
    bottom: 5,
    left: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  posterTitle: { fontSize: 11, fontWeight: "600", marginTop: 5, lineHeight: 14 },
  posterYear: { fontSize: 10, marginTop: 1 },
  notFoundChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignSelf: "center",
  },

  // Geçmiş satırı
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  convIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Ayarlar (minimalist) ──
  settingsBar: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 12,
  },
  minRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dotRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: { width: 20, height: 20, borderRadius: 10 },
  langToggle: { flexDirection: "row", alignItems: "center" },
  langText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },

  // Tür filtreleri
  minChipRow: { flexDirection: "row", gap: 8 },
  minChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  minChipText: { fontSize: 12, fontWeight: "500", flexShrink: 1 },
  themeText: { fontSize: 9, fontWeight: "500", textAlign: "center" },

  // Giriş çubuğu
  inputRow: {
    flexDirection: "row",
    width: "100%",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  genreChip: {
    height: 34,
    paddingHorizontal: 6,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    maxHeight: 90,
    paddingVertical: 8,
    paddingHorizontal: 6,
    fontSize: 14,
  },
  sendButton: {
    borderRadius: 12,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
