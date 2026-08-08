// screens/AIChatScreen.js
//
// CineMatch Pro — yapılandırılmış (JSON) AI cevap + zengin kart sohbeti.
// FAB'dan büyüyerek açılan / FAB'a doğru küçülerek kapanan animasyonlu MODAL.
// ChatModal tarafından { visible, onClose } ile kontrol edilir (ayrı route değil).

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Platform,
  Keyboard,
  ActivityIndicator,
    Switch,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { appAlert } from "@components/AppAlert";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Keys, get, set } from "../services/storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import LottieView from "lottie-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Reanimated, { FadeInUp } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";

import useModalKeyboardLift from "@hooks/useModalKeyboardLift";

import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useAppSettings, useImageQualitySettings } from "../context/AppSettingsContext";
import { useProfileStats } from "../context/ProfileStatsContext";
import { useListStatusContext } from "../context/ListStatusContext";
import { alpha } from "../theme/colors";

import {
  askCineStructured,
  collectTitles,
  splitTitlesForLookup,
  buildPosterMap,
  responseToHistoryText,
  friendlyError,
  } from "../services/aiCineService";
import { buildLibraryContext, applyWatchedFilter } from "../services/aiUserContext";
import { resolveCards } from "../services/tmdbLookup";
import {
  loadCineConversations,
  persistCineConversations,
  saveCineConversation,
  upsertCineConversation,
  removeCineConversation,
  makeId,
  summarizeTitle,
} from "../services/aiCineStore";
import ChatBubble from "../components/AICineCards";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
// FAB merkezi (ChatModal styles.fab: bottom 85, right 25, lottie 48x48)
const FAB_ORIGIN = [SCREEN_W - 49, SCREEN_H - 109, 0];

const TABS = ["explore", "plan", "lists"];
const PREFS_KEY = Keys.aiCinePrefs.key;
const DEFAULT_PREFS = { enabled: false, watchList: true, favorites: true, custom: true, watched: true };
const LIST_TOGGLES = [
  ["watchList", "listWatchList"],
  ["favorites", "listFavorites"],
  ["custom", "listCustom"],
  ["watched", "listWatched"],
];

// ── "Yazıyor" baloncuğu ───────────────────────────────────────────────────────
const TypingBubble = ({ theme, label }) => (
  <Reanimated.View entering={FadeInUp.duration(200)} style={[styles.row, { justifyContent: "flex-start" }]}>
    <View style={[styles.typing, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <ActivityIndicator size="small" color={theme.bold} />
      <Text style={{ color: theme.text.muted, fontSize: 12 }}>{label}</Text>
    </View>
  </Reanimated.View>
);

// ── Geçmiş satırı ─────────────────────────────────────────────────────────────
const ConversationRow = ({ conv, theme, t, isActive, onOpen, onDelete }) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={() => onOpen(conv)}
    style={[
      styles.convRow,
      { backgroundColor: isActive ? theme.between : theme.secondary, borderColor: isActive ? theme.bold : theme.border },
    ]}
  >
    <View style={[styles.convIcon, { backgroundColor: theme.primary }]}>
      <MaterialCommunityIcons name="movie-open-outline" size={18} color={theme.bold} />
    </View>
    <View style={{ flex: 1 }}>
      <Text numberOfLines={1} style={{ color: theme.text.primary, fontSize: 14, fontWeight: "600" }}>
        {conv.title}
      </Text>
      <Text style={{ color: theme.text.muted, fontSize: 11, marginTop: 2 }}>
        {(conv.messages?.length || 0)} {t?.AICineChat?.messagesCount || "mesaj"}
      </Text>
    </View>
    <TouchableOpacity hitSlop={10} onPress={() => onDelete(conv.id)} style={{ padding: 4 }}>
      <MaterialIcons name="delete-outline" size={20} color={theme.text.muted} />
    </TouchableOpacity>
  </TouchableOpacity>
);

export default function AIChatScreen({
  visible,
  onClose,
  fabOrigin,
  initialPrompt,
  // Baloncukta gösterilecek kısa metin (AI'a yine initialPrompt gider)
  initialDisplay,
  // Baloncuğa iliştirilecek yapım kartı: { mediaType, id, title, year, posterPath, rating }
  initialAttachment,
}) {
  const navigation = useNavigation();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
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
  const { combinedLists: allLists } = useListStatusContext();

  const [view, setView] = useState("chat"); // "chat" | "history"
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("explore");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  const [messages, setMessages] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const initialPromptRef = useRef(null);
  // display/attachment referansları her render'da değişebildiği için efekt
  // bağımlılığı yapılmaz; en güncel değerler bu ref üzerinden okunur.
  const initialMetaRef = useRef({ display: "", attachment: null });

  // ── Aç/kapa animasyonu (FAB'dan büyür / FAB'a küçülür) ──────────────────────
  const anim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setRendered(true);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 460,
        easing: Easing.bezier(0.22, 1, 0.36, 1), // easeOutQuint — yumuşak yavaşlama
        useNativeDriver: true,
      }).start();
    }
  }, [visible, anim]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(anim, {
      toValue: 0,
      duration: 340,
      easing: Easing.bezier(0.4, 0, 0.2, 1), // yumuşak hızlanma/yavaşlama
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setRendered(false);
        initialPromptRef.current = null;
        onClose?.();
      }
    });
  }, [anim, onClose]);

  const scrollRef = useRef(null);
  const scrollToEndSoon = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, []);

  // ── Klavye kaldırma ─────────────────────────────────────────────────────────
  // Ölçüm ve platform farkları hooks/useModalKeyboardLift.js içinde; oradaki
  // açıklama Android'de insets.bottom'ın neden ÇIKARILMAMASI gerektiğini anlatır.
  // Modal'ın statusBarTranslucent + navigationBarTranslucent olması şarttır.
  const composerKeyboardStyle = useModalKeyboardLift({
    active: rendered,
    bottomInset: insets.bottom,
    onChange: scrollToEndSoon,
  });

  // Kayıtlı sohbetleri yükle (bir kez)
  useEffect(() => {
    loadCineConversations().then(setConversations).catch(() => {});
  }, []);

  // Liste tercihlerini yükle (bir kez)
  useEffect(() => {
    const saved = get(Keys.aiCinePrefs);
    if (saved) setPrefs((p) => ({ ...p, ...saved }));
  }, []);

  const updatePrefs = useCallback((patch) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      set(Keys.aiCinePrefs, next);
      return next;
    });
  }, []);

  // Kullanıcı kütüphanesi bağlamı — yalnızca ayar açıkken kurulur (kapalıyken 0 token)
  const library = useMemo(
    () => (prefs.enabled ? buildLibraryContext(allLists, prefs, { capPerList: 100 }) : null),
    [prefs, allLists],
  );

  const movieGenres = useMemo(
    () => [mostWatchedGenre, secondWatchedGenre, threeWatchedGenre].filter(Boolean),
    [mostWatchedGenre, secondWatchedGenre, threeWatchedGenre],
  );
  const tvGenres = useMemo(
    () => [mostWatchedGenreTv, secondWatchedGenreTv, thirdWatchedGenreTv].filter(Boolean),
    [mostWatchedGenreTv, secondWatchedGenreTv, thirdWatchedGenreTv],
  );

  // Tab'a göre prompt chip'leri (+ kişiselleştirilmiş / kütüphane chip'leri)
  const chips = useMemo(() => {
    const base = t?.AICineChat?.chips?.[activeTab] || [];
    const list = Array.isArray(base) ? [...base] : [];
    if (activeTab === "explore" && mostWatchedGenre) {
      const tpl = t?.AICineChat?.personalizedChip || "Sana özel: {genre}";
      const promptTpl =
        t?.AICineChat?.personalizedPrompt ||
        "{{genre}} türünde bana birkaç film/dizi öner";
      list.unshift({
        label: `🎯 ${tpl.replace("{genre}", mostWatchedGenre)}`,
        prompt: promptTpl.replace("{{genre}}", mostWatchedGenre),
      });
    }
    if (
      activeTab === "explore" &&
      prefs.enabled &&
      prefs.watchList &&
      (allLists?.watchList?.length || 0) > 0
    ) {
      list.unshift({
        label: t?.AICineChat?.fromWatchlistChip || "📋 İzleme listemden öner",
        prompt:
          t?.AICineChat?.fromWatchlistPrompt ||
          "İzleme listemden bana ne izleyeyim diye birkaç seçim yap",
      });
    }
    return list;
  }, [t, activeTab, mostWatchedGenre, prefs.enabled, prefs.watchList, allLists]);

  // ── Aktif sohbeti diske kaydet ──
  const saveActive = useCallback((msgs, id) => {
    if (!id || !msgs.length) return;
    const now = Date.now();
    const firstUser = msgs.find((m) => m.role === "user");
    const conv = {
      id,
      title: summarizeTitle(
        firstUser?.attachment?.title || firstUser?.display || firstUser?.text || "…",
      ),
      messages: msgs,
      createdAt: now,
      updatedAt: now,
    };

    setConversations((prev) => upsertCineConversation(prev, conv));
    saveCineConversation(conv).then(setConversations).catch(() => {});
  }, []);

  // ── Asistanı çalıştır ──
  const runAssistant = useCallback(
    async (msgsIncludingUser, convId, userText) => {
      setLoading(true);
      scrollToEndSoon();
      try {
        const priorHistory = msgsIncludingUser
          .filter((m) => m.status !== "error")
          .slice(0, -1)
          .map((m) => {
            if (m.role === "assistant" && m.aiResponse) {
              return {
                role: "assistant",
                text: responseToHistoryText(m.aiResponse),
              };
            }
            return { role: m.role, text: m.text || m.display || "" };
          });

        // API anahtarı istemcide değil — istek callGemini proxy'sinden geçer.
        const response = await askCineStructured({
          history: priorHistory,
          userMessage: userText,
          language,
          movieGenres,
          tvGenres,
          offTopicReply: t?.AICineChat?.offTopic,
          userLibrary: library?.librarySummary || "",
        });

        // Başlıkları TMDB poster kartlarına çöz
        const pairs = collectTitles(response);
        let posterMap = {};
        if (pairs.length) {
          const { movies, series } = splitTitlesForLookup(pairs);
          const cards = await resolveCards({
            apiKey: API_KEY,
            movies,
            series,
            language,
            includeAdult: adultContent,
            includeDetails: response.type === "title_spotlight",
          });
          posterMap = buildPosterMap(cards);
        }

        // İzlenenleri (yalnızca açıksa) önerilerden yerelde ele
        const finalResponse =
          library && prefs.watched
            ? applyWatchedFilter(response, posterMap, library.watchedIndex)
            : response;

        const aiMsg = {
          id: makeId(),
          role: "assistant",
          aiResponse: finalResponse,
          posterMap,
          text: responseToHistoryText(finalResponse),
        };
        const finalMessages = [...msgsIncludingUser, aiMsg];
        setMessages(finalMessages);
        saveActive(finalMessages, convId);
        scrollToEndSoon();
      } catch (err) {
        const code = err?.code || "GENERIC";
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn("[CineMatch Pro] hata:", code, err?.message);
          appAlert("CineMatch Pro (DEV)", `${code}\n\n${err?.message ?? ""}`);
        }
        const errMsg = {
          id: makeId(),
          role: "assistant",
          status: "error",
          text: friendlyError(code, t),
          retry: userText,
        };
        const finalMessages = [...msgsIncludingUser, errMsg];
        setMessages(finalMessages);
        saveActive(finalMessages, convId);
        scrollToEndSoon();
      } finally {
        setLoading(false);
      }
    },
    [language, movieGenres, tvGenres, t, API_KEY, adultContent, saveActive, scrollToEndSoon, library, prefs],
  );

  // ── Gönder ──
  const handleSend = useCallback(
    (explicit) => {
      if (loading) return;
      const text = (typeof explicit === "string" ? explicit : message).trim();
      if (!text) return;

      const convId = activeId || makeId();
      if (!activeId) setActiveId(convId);

      const userMsg = { id: makeId(), role: "user", text, display: text };
      const msgs = [...messages, userMsg];
      setMessages(msgs);
      setMessage("");
      Keyboard.dismiss();
      runAssistant(msgs, convId, text);
    },
    [loading, message, activeId, messages, runAssistant],
  );

  const startPromptChat = useCallback(
    (promptText, options) => {
      if (loading) return;
      const text = String(promptText || "").trim();
      if (!text) return;
      const convId = makeId();
      const display = String(options?.display || "").trim() || text;
      const userMsg = { id: makeId(), role: "user", text, display };
      if (options?.attachment?.title) userMsg.attachment = options.attachment;
      const msgs = [userMsg];
      setView("chat");
      setActiveId(convId);
      setMessages(msgs);
      setMessage("");
      Keyboard.dismiss();
      runAssistant(msgs, convId, text);
    },
    [loading, runAssistant],
  );

  useEffect(() => {
    initialMetaRef.current = { display: initialDisplay, attachment: initialAttachment };
  }, [initialDisplay, initialAttachment]);

  useEffect(() => {
    if (!visible || !initialPrompt) return;
    const key = String(initialPrompt);
    if (initialPromptRef.current === key) return;
    initialPromptRef.current = key;
    const timer = setTimeout(() => startPromptChat(key, initialMetaRef.current), 120);
    return () => clearTimeout(timer);
  }, [visible, initialPrompt, startPromptChat]);

  const handleRetry = useCallback(
    (userText) => {
      if (loading) return;
      const cleaned = messages.filter((m) => m.status !== "error");
      setMessages(cleaned);
      const convId = activeId || makeId();
      if (!activeId) setActiveId(convId);
      runAssistant([...cleaned], convId, userText);
    },
    [loading, messages, activeId, runAssistant],
  );

  // ── Sohbet yönetimi ──
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
        const next = removeCineConversation(prev, id);
        persistCineConversations(next);
        return next;
      });
      if (id === activeId) newChat();
    },
    [activeId, newChat],
  );

  const clearAll = useCallback(() => {
    setConversations([]);
    persistCineConversations([]);
  }, []);

  // ── Poster / başlık tıklama → detay veya arama (modal kapanır) ──
  const handleTitlePress = useCallback(
    (card) => {
      const mediaType = card?.mediaType === "tv" ? "tv" : "movie";
      if (card?.found && card?.id) {
        navigation.navigate(mediaType === "movie" ? "MovieDetails" : "TvShowsDetails", { id: card.id });
      } else {
        navigation.navigate(mediaType === "movie" ? "MovieSearch" : "TvShowSearch", {
          name: card?.query || card?.title || "",
        });
      }
      handleClose();
    },
    [navigation, handleClose],
  );

  const origin = fabOrigin || FAB_ORIGIN;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Modal
      transparent
      visible={rendered}
      animationType="none"
      statusBarTranslucent
      // navigationBarTranslucent, dialog penceresini HER API seviyesinde
      // edge-to-edge yapar: pencere IME için yeniden boyutlanmaz ve alt system
      // inset'i decor tarafından padding'lenmez. Böylece klavye kaldırma
      // formülü Android 12/13/14/15/16'da aynı kalır. (statusBarTranslucent
      // olmadan verilmemeli — RN DEV uyarısı.)
      navigationBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Karartma — animasyonla belirir */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }]}
      />

      {/* FAB'dan büyüyen / küçülen kapsayıcı */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: anim,
            transformOrigin: origin,
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 1] }) }],
          },
        ]}
      >
        <SafeAreaView style={[styles.screen, { backgroundColor: theme.primary }]} edges={["top", "bottom"]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={handleClose} hitSlop={8} style={styles.headerBtn}>
              <Ionicons name="chevron-down" size={26} color={theme.text.primary} />
            </TouchableOpacity>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <LottieView
                style={{ width: 28, height: 28 }}
                source={require("@lottie/gemini.json")}
                autoPlay
                loop
              />
              <View>
                <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
                  {t?.AICineChat?.title || "CineMatch"}
                </Text>
                <Text style={[styles.headerSub, { color: theme.text.muted }]}>
                  {t?.AICineChat?.subtitle || "Film & dizi asistanı"}
                </Text>
              </View>
            </View>
            {view === "chat" ? (
              <>
                <TouchableOpacity onPress={() => setSettingsVisible((v) => !v)} hitSlop={8} style={styles.headerBtn}>
                  <Ionicons
                    name="options-outline"
                    size={22}
                    color={settingsVisible ? theme.bold : theme.text.between}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={newChat} hitSlop={8} style={styles.headerBtn}>
                  <MaterialCommunityIcons name="chat-plus-outline" size={22} color={theme.text.between} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setView("history")} hitSlop={8} style={styles.headerBtn}>
                  <MaterialIcons name="history" size={24} color={theme.text.between} />
                </TouchableOpacity>
              </>
            ) : (
              conversations.length > 0 && (
                <TouchableOpacity onPress={clearAll} hitSlop={8} style={styles.headerBtn}>
                  <MaterialCommunityIcons name="delete-sweep-outline" size={22} color={theme.text.between} />
                </TouchableOpacity>
              )
            )}
          </View>

          {view === "history" ? (
            // ── Geçmiş ──
            <View style={{ flex: 1 }}>
              <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => setView("chat")} hitSlop={8} style={styles.headerBtn}>
                  <Ionicons name="chevron-back" size={24} color={theme.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text.primary, flex: 1, marginLeft: 4 }]}>
                  {t?.AICineChat?.history || "Sohbetler"}
                </Text>
              </View>
              {conversations.length === 0 ? (
                <View style={styles.empty}>
                  <MaterialCommunityIcons name="message-off-outline" size={46} color={theme.text.muted} />
                  <Text style={[styles.emptyText, { color: theme.text.muted }]}>
                    {t?.AICineChat?.noConversations || "Henüz kayıtlı sohbet yok"}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={conversations}
                  keyExtractor={(c) => c.id}
                  contentContainerStyle={{ padding: 12, gap: 8 }}
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
          ) : (
            // ── Sohbet ──
            <Reanimated.View style={{ flex: 1 }}>
              {settingsVisible && (
                <View style={[styles.settings, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                  <View style={styles.settingRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[styles.settingTitle, { color: theme.text.primary }]}>
                        {t?.AICineChat?.useMyLists || "Listelerimi kullan"}
                      </Text>
                      <Text style={[styles.settingHint, { color: theme.text.muted }]}>
                        {t?.AICineChat?.listsHint ||
                          "Önerileri listelerine göre kişiselleştirir (daha fazla token kullanır)"}
                      </Text>
                    </View>
                    <Switch
                      value={prefs.enabled}
                      onValueChange={(v) => updatePrefs({ enabled: v })}
                      trackColor={{ true: theme.bold, false: theme.border }}
                      thumbColor="#fff"
                    />
                  </View>
                  {prefs.enabled && (
                    <View style={styles.settingChips}>
                      {LIST_TOGGLES.map(([key, lbl]) => {
                        const on = prefs[key];
                        return (
                          <TouchableOpacity
                            key={key}
                            onPress={() => updatePrefs({ [key]: !on })}
                            style={[
                              styles.setChip,
                              { borderColor: on ? theme.bold : theme.border, backgroundColor: on ? alpha(theme.bold, 0.14) : "transparent" },
                            ]}
                          >
                            <Ionicons
                              name={on ? "checkmark-circle" : "ellipse-outline"}
                              size={14}
                              color={on ? theme.bold : theme.text.muted}
                            />
                            <Text style={[styles.setChipText, { color: on ? theme.bold : theme.text.secondary }]}>
                              {t?.AICineChat?.[lbl] || key}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              <ScrollView
                ref={scrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              >
                {messages.length === 0 && !loading ? (
                  <View style={styles.welcome}>
                    <LottieView
                      style={{ width: 96, height: 96, opacity: 0.95 }}
                      source={require("@lottie/gemini.json")}
                      autoPlay
                      loop
                    />
                    <Text style={[styles.welcomeTitle, { color: theme.text.primary }]}>
                      {t?.AICineChat?.emptyTitle || "Ne izleyeceğine birlikte karar verelim"}
                    </Text>
                    <Text style={[styles.welcomeText, { color: theme.text.muted }]}>
                      {t?.AICineChat?.emptyText ||
                        "Bir öneri iste, iki yapımı karşılaştır, izleme planı yap ya da temalı liste oluştur."}
                    </Text>

                    <View style={styles.tabRow}>
                      {TABS.map((tab) => {
                        const active = activeTab === tab;
                        return (
                          <TouchableOpacity
                            key={tab}
                            onPress={() => setActiveTab(tab)}
                            style={[
                              styles.tab,
                              { borderColor: active ? theme.bold : theme.border, backgroundColor: active ? alpha(theme.bold, 0.14) : "transparent" },
                            ]}
                          >
                            <Text style={[styles.tabText, { color: active ? theme.bold : theme.text.secondary }]}>
                              {t?.AICineChat?.tabs?.[tab] || tab}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.chipWrap}>
                      {chips.map((c, i) => (
                        <TouchableOpacity
                          key={i}
                          activeOpacity={0.8}
                          onPress={() => handleSend(c.prompt)}
                          style={[styles.promptChip, { backgroundColor: theme.secondary, borderColor: theme.border }]}
                        >
                          <Text style={[styles.promptChipText, { color: theme.text.primary }]}>{c.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  messages.map((msg) => (
                    <ChatBubble
                      key={msg.id}
                      msg={msg}
                      theme={theme}
                      t={t}
                      getTmdbUrl={getTmdbUrl}
                      onTitlePress={handleTitlePress}
                      onRetry={handleRetry}
                    />
                  ))
                )}
                {loading && <TypingBubble theme={theme} label={t?.AICineChat?.typing || "Düşünüyor…"} />}
              </ScrollView>

              {/* Giriş çubuğu */}
              <Reanimated.View
                style={[
                  styles.inputWrap,
                  { backgroundColor: theme.primary, borderTopColor: theme.border },
                  composerKeyboardStyle,
                ]}
              >
                <View style={[styles.inputBar, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                  <Ionicons name="sparkles" size={16} color={theme.bold} style={{ marginLeft: 2 }} />
                  <TextInput
                    style={[styles.input, { color: theme.text.primary }]}
                    placeholder={t?.AICineChat?.placeholder || "öner iste, karşılaştır, planla, listele…"}
                    placeholderTextColor={theme.text.muted}
                    value={message}
                    onChangeText={setMessage}
                    maxLength={1000}
                    multiline
                    onSubmitEditing={() => handleSend()}
                  />
                  {message.length > 0 && !loading && (
                    <TouchableOpacity onPress={() => setMessage("")} hitSlop={8} style={styles.clearBtn}>
                      <Ionicons name="close-circle" size={18} color={theme.text.muted} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleSend()}
                  disabled={loading || !message.trim()}
                >
                  {message.trim() && !loading ? (
                    <LinearGradient
                      colors={[theme.accent, theme.bold]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.sendBtn}
                    >
                      <Ionicons name="arrow-up" size={22} color="#fff" />
                    </LinearGradient>
                  ) : (
                    <View style={[styles.sendBtn, { backgroundColor: theme.between }]}>
                      {loading ? (
                        <ActivityIndicator color={theme.bold} size="small" />
                      ) : (
                        <Ionicons name="arrow-up" size={22} color={theme.text.muted} />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </Reanimated.View>
            </Reanimated.View>
          )}
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  headerTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  headerSub: { fontSize: 11, marginTop: -1 },

  row: { width: "100%", marginBottom: 12, flexDirection: "row" },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },

  welcome: { alignItems: "center", paddingTop: 24, paddingHorizontal: 6 },
  welcomeTitle: { fontSize: 18, fontWeight: "800", textAlign: "center", marginTop: 8 },
  welcomeText: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6, maxWidth: "90%" },
  tabRow: { flexDirection: "row", gap: 8, marginTop: 20, flexWrap: "wrap", justifyContent: "center" },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  tabText: { fontSize: 12, fontWeight: "700" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16, justifyContent: "center" },
  promptChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  promptChipText: { fontSize: 13, fontWeight: "600" },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, padding: 30 },
  emptyText: { fontSize: 13, textAlign: "center" },
  convRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 14, borderWidth: 1 },
  convIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },

  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: Platform.OS === "ios" ? 6 : 2,
    paddingTop: Platform.OS === "ios" ? 6 : 2,
  },
  clearBtn: { padding: 2 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },

  // Liste ayarları paneli
  settings: {
    margin: 10,
    marginBottom: 0,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  settingRow: { flexDirection: "row", alignItems: "center" },
  settingTitle: { fontSize: 14, fontWeight: "700" },
  settingHint: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  settingChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  setChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  setChipText: { fontSize: 12, fontWeight: "600" },
});
