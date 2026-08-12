// screens/chat/AIChatScreen.js
//
// CineMatch Pro — yapılandırılmış (JSON) AI cevap + zengin kart sohbeti.
// FAB'dan büyüyerek açılan / FAB'a doğru küçülerek kapanan animasyonlu MODAL.
// Ayrı bir route değil; `visible` prop'uyla kontrol edilir.
//
// TEK KOPYA: bu ekranın bir zamanlar screens/AIChatScreen.js'te ikinci bir
// kopyası vardı (film/dizi detayındaki "AI'ya sor" akışı onu kullanıyordu).
// İkisi ayrışmıştı — kota göstergesi ve i18n yalnız burada, initialPrompt
// akışı yalnız orada. Kopya silindi, akış buraya taşındı; giriş noktaları
// için bileşenin başındaki nota bak.

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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Keys, get, set } from "../../services/storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import LottieView from "lottie-react-native";
import Reanimated, { FadeInUp } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";

import useModalKeyboardLift from "@hooks/useModalKeyboardLift";

import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import {
  STREAMING_PROVIDERS,
  useAppSettings,
  useImageQualitySettings,
  useStreamingProviderSettings,
} from "@context/AppSettingsContext";
import { useProfileStats } from "@context/ProfileStatsContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { usePremium } from "@context/PremiumContext";
import { alpha } from "@theme/colors";

import {
  askCineStructured,
  collectTitles,
  splitTitlesForLookup,
  buildPosterMap,
  posterKey,
  responseToHistoryText,
  friendlyError,
} from "@services/aiCineService";
import { buildLibraryContext, applyWatchedFilter } from "@services/aiUserContext";
import { resolveCards } from "@services/tmdbLookup";
import {
  loadCineConversations,
  persistCineConversations,
  saveCineConversation,
  upsertCineConversation,
  removeCineConversation,
  makeId,
  summarizeTitle,
} from "@services/aiCineStore";
import ChatBubble from "@components/AICineCards";
import { i18nText } from "@utils/i18nText";
import { appAlert } from "@components/AppAlert";
import { ONBOARDING_GENRES } from "@utils/onboardingPreferences";
import { AI_PLAN_LIMITS } from "@utils/premium";


const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
// FAB merkezi (ChatModal styles.fab: bottom 85, right 25, lottie 48x48)
const FAB_ORIGIN = [SCREEN_W - 49, SCREEN_H - 109, 0];

const TABS = ["explore", "plan", "lists"];
const TAB_ICONS = {
  explore: "compass-outline",
  plan: "git-compare-outline",
  lists: "albums-outline",
};
const DEFAULT_PREFS = {
  enabled: false,
  watchList: true,
  favorites: true,
  custom: true,
  watched: true,
  mediaType: "all",
  providerIds: [],
  genreKeys: [],
};
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
        {(conv.messages?.length || 0)} {t?.AICineChat?.messagesCount || i18nText("autoI18n.mesaj", "mesaj")}
      </Text>
    </View>
    <TouchableOpacity hitSlop={10} onPress={() => onDelete(conv.id)} style={{ padding: 4 }}>
      <MaterialIcons name="delete-outline" size={20} color={theme.text.muted} />
    </TouchableOpacity>
  </TouchableOpacity>
);

/**
 * İKİ GİRİŞ NOKTASI, TEK BİLEŞEN:
 *   1. FAB / pet akışı — components/modals/ChatModal.js: boş sohbet açar.
 *   2. "Bu yapım hakkında sor" — film/dizi detayı: `initialPrompt` ile açılır,
 *      panel görünür görünmez ilk mesaj kendiliğinden gönderilir.
 * (Detay ekranları için ayrı bir kopya vardı; kota göstergesi ve i18n yalnız
 *  buradaki sürümde olduğu için o kopya silinip akış buraya taşındı.)
 */
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
  const { streamingProviderIds } = useStreamingProviderSettings();
  const {
    mostWatchedGenre,
    secondWatchedGenre,
    threeWatchedGenre,
    mostWatchedGenreTv,
    secondWatchedGenreTv,
    thirdWatchedGenreTv,
  } = useProfileStats();
  const { combinedLists: allLists } = useListStatusContext();
  const { plan: premiumPlan } = usePremium();

  const [view, setView] = useState("chat"); // "chat" | "history"
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("explore");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [quota, setQuota] = useState(null);

  const [messages, setMessages] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const prefsLoadedRef = useRef(false);
  // Aynı initialPrompt ile ikinci kez sohbet açılmasın (panel yeniden render
  // olduğunda efekt tekrar çalışır); panel kapanınca sıfırlanır.
  const initialPromptRef = useRef(null);
  // display/attachment referansları her render'da değişebildiği için efekt
  // bağımlılığı yapılmaz; en güncel değerler bu ref üzerinden okunur.
  const initialMetaRef = useRef({ display: "", attachment: null });

  const quotaPlan = AI_PLAN_LIMITS[premiumPlan] ? premiumPlan : "free";
  const quotaText = useMemo(() => {
    const serverPlan = AI_PLAN_LIMITS[quota?.plan] ? quota.plan : quotaPlan;
    const planLabel = t?.AICineChat?.plans?.[serverPlan] || serverPlan;
    const daily = quota?.daily;
    const monthly = quota?.monthly;
    const template = daily && monthly
      ? t?.AICineChat?.quotaUsage || "{plan} · Bugün {dailyUsed}/{dailyLimit} · Bu ay {monthlyUsed}/{monthlyLimit}"
      : t?.AICineChat?.quotaLimits || "{plan} · Günlük {dailyLimit} · Aylık {monthlyLimit}";
    const limits = AI_PLAN_LIMITS[serverPlan];
    return template
      .replace("{plan}", planLabel)
      .replace("{dailyUsed}", String(daily?.used ?? 0))
      .replace("{dailyLimit}", String(daily?.limit ?? limits.daily))
      .replace("{monthlyUsed}", String(monthly?.used ?? 0))
      .replace("{monthlyLimit}", String(monthly?.limit ?? limits.monthly));
  }, [premiumPlan, quota, quotaPlan, t]);

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
        // Aynı yapım için "AI'ya sor" ikinci kez basıldığında prop değeri
        // değişmemiş olabilir; kilidi burada açmazsak sohbet hiç başlamaz.
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

  // ── Composer odak animasyonu ────────────────────────────────────────────────
  // Arkadaş sohbetiyle (screens/chat/ChatScreen.js) aynı davranış: odakta
  // kenarlık vurgu rengine geçer.
  // Renk animasyonu native driver ile yapılamaz.
  const inputBorderAnim = useRef(new Animated.Value(0)).current;
  const handleInputFocus = useCallback(() => {
    Animated.timing(inputBorderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [inputBorderAnim]);
  const handleInputBlur = useCallback(() => {
    Animated.timing(inputBorderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [inputBorderAnim]);
  const inputBorderColor = inputBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.border, theme.accent],
  });

  // Kayıtlı sohbetleri yükle (bir kez)
  useEffect(() => {
    loadCineConversations().then(setConversations).catch(() => {});
  }, []);

  // Kişiselleştirme tercihlerini yükle. AI'ya özel platform seçimi daha önce
  // yapılmadıysa uygulamadaki "Platform üyeliklerim" seçimi başlangıç olur.
  useEffect(() => {
    if (prefsLoadedRef.current) return;
    prefsLoadedRef.current = true;
    const saved = get(Keys.aiCinePrefs);
    const validGenreKeys = new Set(ONBOARDING_GENRES.map((genre) => genre.key));
    const providerIds = Array.isArray(saved?.providerIds)
      ? saved.providerIds.map(Number).filter((id) => STREAMING_PROVIDERS.some((provider) => provider.id === id))
      : streamingProviderIds;
    const genreKeys = Array.isArray(saved?.genreKeys)
      ? [...new Set(saved.genreKeys)].filter((key) => validGenreKeys.has(key))
      : [];
    setPrefs((current) => ({
      ...current,
      ...(saved || {}),
      mediaType: ["all", "movie", "tv"].includes(saved?.mediaType) ? saved.mediaType : "all",
      providerIds,
      genreKeys,
    }));
  }, [streamingProviderIds]);

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

  const selectedProviders = useMemo(
    () => STREAMING_PROVIDERS.filter((provider) => prefs.providerIds.includes(provider.id)),
    [prefs.providerIds],
  );
  const availableGenres = useMemo(
    () => ONBOARDING_GENRES.filter((genre) => (
      prefs.mediaType === "movie"
        ? genre.movieId
        : prefs.mediaType === "tv"
          ? genre.tvId
          : genre.movieId || genre.tvId
    )),
    [prefs.mediaType],
  );
  const selectedGenreLabels = useMemo(
    () => prefs.genreKeys
      .map((key) => ONBOARDING_GENRES.find((genre) => genre.key === key))
      .filter(Boolean)
      .map((genre) => {
        if (prefs.mediaType === "tv") return genre[language === "tr" ? "tvTr" : "tvEn"] || genre[language === "tr" ? "tr" : "en"];
        return genre[language === "tr" ? "tr" : "en"];
      }),
    [language, prefs.genreKeys, prefs.mediaType],
  );
  const discoveryPreferences = useMemo(() => {
    const lines = [];
    if (prefs.mediaType === "movie") lines.push("- Content type: movies only.");
    if (prefs.mediaType === "tv") lines.push("- Content type: TV series only.");
    if (selectedGenreLabels.length) lines.push(`- Preferred genres: ${selectedGenreLabels.join(", ")}.`);
    if (selectedProviders.length) {
      lines.push(`- Streaming services: recommend titles available on ${selectedProviders.map((provider) => provider.name).join(", ")} only.`);
    }
    return lines.length
      ? `AI DISCOVERY FILTERS (chosen explicitly by the user):\n${lines.join("\n")}`
      : "";
  }, [prefs.mediaType, selectedGenreLabels, selectedProviders]);

  const toggleProvider = useCallback((providerId) => {
    const next = prefs.providerIds.includes(providerId)
      ? prefs.providerIds.filter((id) => id !== providerId)
      : [...prefs.providerIds, providerId];
    updatePrefs({ providerIds: next });
  }, [prefs.providerIds, updatePrefs]);

  const changeMediaType = useCallback((mediaType) => {
    const supports = (genre) => (
      mediaType === "movie" ? genre.movieId : mediaType === "tv" ? genre.tvId : genre.movieId || genre.tvId
    );
    const validGenres = prefs.genreKeys.filter((key) => {
      const genre = ONBOARDING_GENRES.find((item) => item.key === key);
      return genre && supports(genre);
    });
    updatePrefs({ mediaType, genreKeys: validGenres });
  }, [prefs.genreKeys, updatePrefs]);

  const toggleGenre = useCallback((genreKey) => {
    const next = prefs.genreKeys.includes(genreKey)
      ? prefs.genreKeys.filter((key) => key !== genreKey)
      : [...prefs.genreKeys, genreKey];
    updatePrefs({ genreKeys: next });
  }, [prefs.genreKeys, updatePrefs]);

  const clearDiscoveryFilters = useCallback(() => {
    updatePrefs({ mediaType: "all", providerIds: [], genreKeys: [] });
  }, [updatePrefs]);

  const discoveryFilterCount =
    (prefs.mediaType === "all" ? 0 : 1) + prefs.providerIds.length + prefs.genreKeys.length;
  const filterSummary = useMemo(() => {
    const parts = [];
    if (prefs.mediaType === "movie") parts.push(language === "tr" ? "Film" : "Movies");
    if (prefs.mediaType === "tv") parts.push(language === "tr" ? "Dizi" : "Series");
    if (selectedProviders.length) parts.push(selectedProviders.map((provider) => provider.name).join(", "));
    if (selectedGenreLabels.length) parts.push(selectedGenreLabels.join(", "));
    if (prefs.enabled) parts.push(language === "tr" ? "Listelerim açık" : "My lists on");
    return parts.join(" · ");
  }, [language, prefs.enabled, prefs.mediaType, selectedGenreLabels, selectedProviders]);

  // Tab'a göre prompt chip'leri (+ kişiselleştirilmiş / kütüphane chip'leri)
  const chips = useMemo(() => {
    const base = t?.AICineChat?.chips?.[activeTab] || [];
    const list = Array.isArray(base) ? [...base] : [];
    if (activeTab === "explore" && discoveryPreferences) {
      list.unshift({
        label: language === "tr" ? "🎯 Seçimlerime göre öner" : "🎯 Recommend from my filters",
        prompt: language === "tr"
          ? "Seçtiğim platform, içerik türü ve tür filtrelerine göre bana en uygun 5 yapımı öner"
          : "Recommend the 5 best titles matching my selected streaming, content-type and genre filters",
      });
    }
    if (activeTab === "explore" && mostWatchedGenre) {
      const tpl = t?.AICineChat?.personalizedChip || i18nText("autoI18n.sana_ozel_genre", "Sana özel: {genre}");
      list.unshift({
        label: `🎯 ${tpl.replace("{genre}", mostWatchedGenre)}`,
        prompt: i18nText("autoI18n.genre_recommendation_prompt", "{{genre}} türünde bana birkaç film/dizi öner", {
          genre: mostWatchedGenre,
        }),
      });
    }
    if (
      activeTab === "explore" &&
      prefs.enabled &&
      prefs.watchList &&
      (allLists?.watchList?.length || 0) > 0
    ) {
      list.unshift({
        label: t?.AICineChat?.fromWatchlistChip || i18nText("autoI18n.izleme_listemden_oner", "📋 İzleme listemden öner"),
        prompt:
          t?.AICineChat?.fromWatchlistPrompt ||
          i18nText("autoI18n.from_watchlist_prompt", "İzleme listemden bana ne izleyeyim diye birkaç seçim yap"),
      });
    }
    return list;
  }, [t, activeTab, mostWatchedGenre, prefs.enabled, prefs.watchList, allLists, discoveryPreferences, language]);

  // ── Aktif sohbeti diske kaydet ──
  const saveActive = useCallback((msgs, id) => {
    if (!id || !msgs.length) return;
    const now = Date.now();
    const firstUser = msgs.find((m) => m.role === "user");
    const conv = {
      id,
      // Detaydan açılan sohbette ilk mesajın metni uzun bir yönerge olabiliyor;
      // iliştirilmiş yapımın adı geçmiş listesinde çok daha okunur bir başlık.
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
        const requestedProviders = selectedProviders.map((provider) => provider.name);
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
        const targetMedia = msgsIncludingUser.find(
          (item) => item.role === "user" && item.attachment?.title,
        )?.attachment;
        const response = await askCineStructured({
          history: priorHistory,
          userMessage: userText,
          language,
          movieGenres,
          tvGenres,
          offTopicReply: t?.AICineChat?.offTopic,
          userLibrary: library?.librarySummary || "",
          discoveryPreferences,
          targetMedia,
          onQuota: setQuota,
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
            includeDetails:
              response.type === "title_spotlight" ||
              requestedProviders.length > 0 ||
              selectedGenreLabels.length > 0,
          });
          posterMap = buildPosterMap(cards);
          if (targetMedia?.title) {
            const targetCard = {
              key: `${targetMedia.mediaType}-${targetMedia.id}`,
              mediaType: targetMedia.mediaType,
              query: targetMedia.title,
              found: true,
              id: targetMedia.id,
              title: targetMedia.title,
              posterPath: targetMedia.posterPath,
              year: targetMedia.year,
              rating: targetMedia.rating,
              overview: targetMedia.overview,
              genres: targetMedia.genres,
              cast: targetMedia.cast,
              director: targetMedia.director,
              providers: targetMedia.providers,
              similar: [],
            };
            posterMap[posterKey(targetCard.mediaType, targetCard.title)] = targetCard;
          }
        }

        // Model filtreleri sistem yönergesinden alır; sonuç kartları TMDB'den
        // çözüldükten sonra platform/tür/içerik tipi yerelde de doğrulanır.
        let preferenceCheckedResponse = response;
        const hasDiscoveryFilter =
          requestedProviders.length > 0 || selectedGenreLabels.length > 0 || prefs.mediaType !== "all";
        if (hasDiscoveryFilter && ["recommendations", "watchlist"].includes(response.type)) {
          const normalizedRequested = requestedProviders.map((name) => name.toLowerCase());
          const normalizedGenres = selectedGenreLabels.map((name) => name.toLowerCase());
          const matchesFilters = (item) => {
            if (prefs.mediaType !== "all" && item.mediaType !== prefs.mediaType) return false;
            const card = posterMap[posterKey(item.mediaType, item.title)];
            const providerMatch = normalizedRequested.length === 0 || (card?.providers || []).some((provider) => {
              const value = String(provider).toLowerCase();
              return normalizedRequested.some((wanted) => value.includes(wanted) || wanted.includes(value));
            });
            const genreMatch = normalizedGenres.length === 0 || (card?.genres || []).some((genre) => {
              const value = String(genre).toLowerCase();
              return normalizedGenres.some((wanted) => value.includes(wanted) || wanted.includes(value));
            });
            return providerMatch && genreMatch;
          };

          if (response.type === "recommendations") {
            const verifiedItems = (response.items || []).filter(matchesFilters);
            if (verifiedItems.length > 0) {
              preferenceCheckedResponse = { ...response, items: verifiedItems };
            }
          } else {
            const sections = (response.sections || [])
              .map((section) => ({ ...section, items: (section.items || []).filter(matchesFilters) }))
              .filter((section) => section.items.length > 0);
            if (sections.length > 0) {
              preferenceCheckedResponse = { ...response, sections };
            }
          }
        }

        const finalResponse =
          library && prefs.watched
            ? applyWatchedFilter(preferenceCheckedResponse, posterMap, library.watchedIndex)
            : preferenceCheckedResponse;

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
        if (err?.quota) setQuota(err.quota);
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn(i18nText("autoI18n.cinematch_pro_hata", "[CineMatch Pro] hata:"), code, err?.message);
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
    [language, movieGenres, tvGenres, t, API_KEY, adultContent, saveActive, scrollToEndSoon, library, prefs.mediaType, prefs.watched, selectedProviders, selectedGenreLabels, discoveryPreferences],
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

  // ── Hazır bir soruyla YENİ sohbet başlat ──
  // handleSend'den farkı: mevcut sohbetin üstüne eklemez, HER ZAMAN yeni bir
  // konuşma açar (detay ekranından gelen soru geçmiş bir sohbetin devamı gibi
  // görünmesin) ve baloncukta ham yönerge yerine kısa `display` metnini gösterir.
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
    // Kısa gecikme: açılış animasyonu başlasın, ilk balon boş panele değil
    // görünen panele düşsün.
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
        {/* RN Modal içinde SafeAreaView'in özellikle iOS alt inset'i güvenilir
            uygulanmayabiliyor. Klavye kaldırma hesabı bu inset'i düşürdüğü için
            üst ve alt güvenli alanı doğrudan uyguluyoruz; böylece composer
            klavyenin altında kalmıyor. */}
        <View
          style={[
            styles.screen,
            {
              backgroundColor: theme.primary,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
        >
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
              <View style={styles.headerCopy}>
                <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
                  {t?.AICineChat?.title || "CineMatch"}
                </Text>
                <Text numberOfLines={1} style={[styles.headerSub, { color: theme.text.muted }]}>
                  {quotaText}
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
                    {t?.AICineChat?.noConversations || i18nText("autoI18n.henuz_kayitli_sohbet_yok", "Henüz kayıtlı sohbet yok")}
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
            <Reanimated.View style={styles.chatBody}>
              {settingsVisible && (
                <View style={[styles.settings, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.settingsContent}
                  >
                    <View style={styles.settingsHeading}>
                      <View style={[styles.settingsHeadingIcon, { backgroundColor: alpha(theme.accent, 0.16) }]}>
                        <Ionicons name="options-outline" size={18} color={theme.bold} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.settingsTitle, { color: theme.text.primary }]}>
                          {t?.AICineChat?.personalizeTitle || "CineMatch'i özelleştir"}
                        </Text>
                        <Text style={[styles.settingHint, { color: theme.text.muted }]}>
                          {t?.AICineChat?.personalizeHint || "Öneriler seçtiğin liste, platform ve türlere göre hazırlanır."}
                        </Text>
                      </View>
                      {discoveryFilterCount > 0 ? (
                        <View style={[styles.filterCount, { backgroundColor: theme.accent }]}>
                          <Text style={styles.filterCountText}>{discoveryFilterCount}</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={[styles.settingsDivider, { backgroundColor: theme.border }]} />

                    <View style={styles.settingRow}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={[styles.settingTitle, { color: theme.text.primary }]}>
                          {t?.AICineChat?.useMyLists || "Listelerimi kullan"}
                        </Text>
                        <Text style={[styles.settingHint, { color: theme.text.muted }]}>
                          {t?.AICineChat?.listsHint ||
                            i18nText("autoI18n.onerileri_listelerine_gore_kisisellestirir", "Önerileri listelerine göre kişiselleştirir (daha fazla token kullanır)")}
                        </Text>
                      </View>
                      <Switch
                        value={prefs.enabled}
                        onValueChange={(v) => updatePrefs({ enabled: v })}
                        trackColor={{ true: theme.bold, false: theme.border }}
                        thumbColor="#fff"
                      />
                    </View>
                    {prefs.enabled ? (
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
                    ) : null}

                    <View style={[styles.settingsDivider, { backgroundColor: theme.border }]} />

                    <View style={styles.settingSectionTitleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.settingTitle, { color: theme.text.primary }]}>
                          {t?.AICineChat?.platformsTitle || "Platformlar"}
                        </Text>
                        <Text style={[styles.settingHint, { color: theme.text.muted }]}>
                          {t?.AICineChat?.platformsHint || "Boş bırakırsan tüm platformlarda arar."}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.settingChips}>
                      <TouchableOpacity
                        onPress={() => updatePrefs({ providerIds: [] })}
                        style={[
                          styles.setChip,
                          {
                            borderColor: prefs.providerIds.length === 0 ? theme.bold : theme.border,
                            backgroundColor: prefs.providerIds.length === 0 ? alpha(theme.bold, 0.14) : "transparent",
                          },
                        ]}
                      >
                        <Ionicons name="globe-outline" size={14} color={prefs.providerIds.length === 0 ? theme.bold : theme.text.muted} />
                        <Text style={[styles.setChipText, { color: prefs.providerIds.length === 0 ? theme.bold : theme.text.secondary }]}>
                          {t?.AICineChat?.allPlatforms || "Tümü"}
                        </Text>
                      </TouchableOpacity>
                      {STREAMING_PROVIDERS.map((provider) => {
                        const on = prefs.providerIds.includes(provider.id);
                        return (
                          <TouchableOpacity
                            key={provider.id}
                            onPress={() => toggleProvider(provider.id)}
                            style={[
                              styles.setChip,
                              { borderColor: on ? theme.bold : theme.border, backgroundColor: on ? alpha(theme.bold, 0.14) : "transparent" },
                            ]}
                          >
                            <View style={[styles.providerDot, { backgroundColor: provider.color }]} />
                            <Text style={[styles.setChipText, { color: on ? theme.bold : theme.text.secondary }]}>
                              {provider.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={[styles.settingsDivider, { backgroundColor: theme.border }]} />

                    <Text style={[styles.settingTitle, { color: theme.text.primary }]}>
                      {t?.AICineChat?.contentTypeTitle || "İçerik türü"}
                    </Text>
                    <View style={styles.settingChips}>
                      {[
                        ["all", t?.AICineChat?.contentAll || "Film + Dizi", "apps-outline"],
                        ["movie", t?.AICineChat?.contentMovies || "Yalnız film", "film-outline"],
                        ["tv", t?.AICineChat?.contentSeries || "Yalnız dizi", "tv-outline"],
                      ].map(([key, label, icon]) => {
                        const on = prefs.mediaType === key;
                        return (
                          <TouchableOpacity
                            key={key}
                            onPress={() => changeMediaType(key)}
                            style={[
                              styles.setChip,
                              { borderColor: on ? theme.bold : theme.border, backgroundColor: on ? alpha(theme.bold, 0.14) : "transparent" },
                            ]}
                          >
                            <Ionicons name={icon} size={14} color={on ? theme.bold : theme.text.muted} />
                            <Text style={[styles.setChipText, { color: on ? theme.bold : theme.text.secondary }]}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.genreHeading}>
                      <Text style={[styles.settingTitle, { color: theme.text.primary }]}>
                        {t?.AICineChat?.genresTitle || "Türler"}
                      </Text>
                      {prefs.genreKeys.length ? (
                        <TouchableOpacity onPress={() => updatePrefs({ genreKeys: [] })}>
                          <Text style={[styles.clearInline, { color: theme.bold }]}>{t?.AICineChat?.clear || "Temizle"}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text style={[styles.settingHint, { color: theme.text.muted }]}>
                      {t?.AICineChat?.genresHint || "Birden fazla tür seçebilirsin."}
                    </Text>
                    <View style={styles.settingChips}>
                      {availableGenres.map((genre) => {
                        const on = prefs.genreKeys.includes(genre.key);
                        const label = prefs.mediaType === "tv"
                          ? genre[language === "tr" ? "tvTr" : "tvEn"] || genre[language === "tr" ? "tr" : "en"]
                          : genre[language === "tr" ? "tr" : "en"];
                        return (
                          <TouchableOpacity
                            key={genre.key}
                            onPress={() => toggleGenre(genre.key)}
                            style={[
                              styles.setChip,
                              { borderColor: on ? theme.bold : theme.border, backgroundColor: on ? alpha(theme.bold, 0.14) : "transparent" },
                            ]}
                          >
                            <Ionicons name={genre.icon} size={14} color={on ? theme.bold : theme.text.muted} />
                            <Text style={[styles.setChipText, { color: on ? theme.bold : theme.text.secondary }]}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {discoveryFilterCount > 0 ? (
                      <TouchableOpacity onPress={clearDiscoveryFilters} style={styles.clearFiltersBtn}>
                        <Ionicons name="refresh-outline" size={15} color={theme.bold} />
                        <Text style={[styles.clearFiltersText, { color: theme.bold }]}>
                          {t?.AICineChat?.clearDiscoveryFilters || "Platform ve tür filtrelerini temizle"}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </ScrollView>
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
                      {t?.AICineChat?.emptyTitle || i18nText("autoI18n.ne_izleyecegine_birlikte_karar_verelim", "Ne izleyeceğine birlikte karar verelim")}
                    </Text>
                    <Text style={[styles.welcomeText, { color: theme.text.muted }]}>
                      {t?.AICineChat?.emptyText ||
                        i18nText("autoI18n.oner_iste_karsilastir_planla_liste_olustur", "Bir öneri iste, iki yapımı karşılaştır, izleme planı yap ya da temalı liste oluştur.")}
                    </Text>

                    {filterSummary ? (
                      <TouchableOpacity
                        activeOpacity={0.82}
                        onPress={() => setSettingsVisible(true)}
                        style={[
                          styles.activeFilters,
                          { backgroundColor: alpha(theme.accent, 0.12), borderColor: alpha(theme.accent, 0.35) },
                        ]}
                      >
                        <Ionicons name="options-outline" size={15} color={theme.bold} />
                        <Text numberOfLines={2} style={[styles.activeFiltersText, { color: theme.bold }]}>
                          {filterSummary}
                        </Text>
                        <Ionicons name="chevron-forward" size={15} color={theme.bold} />
                      </TouchableOpacity>
                    ) : null}

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
                            <View style={[
                              styles.tabIcon,
                              { backgroundColor: active ? alpha(theme.bold, 0.18) : theme.secondary },
                            ]}>
                              <Ionicons
                                name={TAB_ICONS[tab]}
                                size={18}
                                color={active ? theme.bold : theme.text.muted}
                              />
                            </View>
                            <Text style={[styles.tabText, { color: active ? theme.bold : theme.text.primary }]}>
                              {t?.AICineChat?.tabs?.[tab] || tab}
                            </Text>
                            <Text numberOfLines={2} style={[styles.tabHint, { color: theme.text.muted }]}>
                              {t?.AICineChat?.tabHints?.[tab] || ""}
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
                          <View style={[styles.promptIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
                            <Ionicons name={TAB_ICONS[activeTab]} size={17} color={theme.bold} />
                          </View>
                          <Text style={[styles.promptChipText, { color: theme.text.primary }]}>{c.label}</Text>
                          <Ionicons name="arrow-forward" size={16} color={theme.text.muted} />
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
                {loading && <TypingBubble theme={theme} label={t?.AICineChat?.typing || i18nText("autoI18n.dusunuyor", "Düşünüyor…")} />}
              </ScrollView>

              {/* Giriş çubuğu — arkadaş sohbetindeki hap ile aynı yapı:
                  [rozet][input][gönder] tek parça, odakta kenarlık vurguya döner.
                  Sarmalayıcı saydam ve ayırıcı çizgisiz: ekranda yalnız hap görünür. */}
              <Reanimated.View
                style={[styles.inputWrap, composerKeyboardStyle]}
              >
                <Animated.View
                  style={[
                    styles.composerPill,
                    { backgroundColor: theme.secondary, borderColor: inputBorderColor },
                  ]}
                >
                  <View style={[styles.composerBadge, { backgroundColor: alpha(theme.accent, 0.16) }]}>
                    <Ionicons name="sparkles" size={19} color={theme.bold} />
                  </View>

                  <TextInput
                    style={[styles.input, { color: theme.text.primary }]}
                    placeholder={t?.AICineChat?.placeholder || i18nText("autoI18n.oner_iste_karsilastir_planla_listele", "öner iste, karşılaştır, planla, listele…")}
                    placeholderTextColor={theme.text.muted}
                    value={message}
                    onChangeText={setMessage}
                    maxLength={1000}
                    multiline
                    numberOfLines={6}
                    selectionColor={theme.accent}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    onSubmitEditing={() => handleSend()}
                  />

                  {message.length > 0 && !loading && (
                    <TouchableOpacity onPress={() => setMessage("")} hitSlop={8} style={styles.clearBtn}>
                      <Ionicons name="close-circle" size={18} color={theme.text.muted} />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    activeOpacity={0.72}
                    onPress={() => handleSend()}
                    disabled={loading || !message.trim()}
                    style={[
                      styles.composerSend,
                      {
                        backgroundColor: theme.accent,
                        opacity: message.trim() && !loading ? 1 : 0.32,
                      },
                    ]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Ionicons name="arrow-up" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </Reanimated.View>
            </Reanimated.View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  chatBody: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  headerCopy: { flex: 1, minWidth: 0 },
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

  welcome: { alignItems: "center", paddingTop: 18, paddingHorizontal: 6 },
  welcomeTitle: { fontSize: 18, fontWeight: "800", textAlign: "center", marginTop: 8 },
  welcomeText: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6, maxWidth: "90%" },
  activeFilters: { width: "100%", marginTop: 14, minHeight: 42, borderRadius: 14, borderWidth: 1, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 7 },
  activeFiltersText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  tabRow: { width: "100%", flexDirection: "row", gap: 8, marginTop: 18 },
  tab: { flex: 1, minHeight: 92, paddingHorizontal: 7, paddingVertical: 9, borderRadius: 17, borderWidth: 1, alignItems: "center" },
  tabIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  tabText: { fontSize: 11, lineHeight: 14, fontWeight: "800", textAlign: "center" },
  tabHint: { fontSize: 9, lineHeight: 12, textAlign: "center", marginTop: 3 },
  chipWrap: { width: "100%", gap: 8, marginTop: 14 },
  promptChip: { width: "100%", minHeight: 52, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 9 },
  promptIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  promptChipText: { flex: 1, fontSize: 13, fontWeight: "600" },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, padding: 30 },
  emptyText: { fontSize: 13, textAlign: "center" },
  convRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 14, borderWidth: 1 },
  convIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },

  // Composer ölçüleri arkadaş sohbetindekiyle (screens/chat/ChatScreen.js)
  // birebir aynı; oradaki hap sabit koyu renkler, buradaki tema renkleri
  // kullanıyor. Sarmalayıcı yalnız boşluk veriyor — arka plan ve üst ayırıcı
  // çizgi yok, gölge de yalnız hapta.
  inputWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 8 : 12,
  },
  composerPill: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1.5,
    borderRadius: 28,
    padding: 5,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 10,
  },
  composerBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  composerSend: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  // Tek satırlık yükseklik rozet/gönder ile aynı (42) olmalı: hap flex-end
  // hizaladığı için kısa kalan input metni ikon merkezlerinden aşağı kayıyordu.
  // Android'de çok satırlı input metni tepeye yapışır, ortalamayı açıkça
  // istiyoruz; iOS textAlignVertical desteklemiyor, simetrik padding yetiyor.
  input: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "ios" ? 11 : 8,
    paddingBottom: Platform.OS === "ios" ? 11 : 8,
    fontSize: 15,
    maxHeight: 130,
    ...(Platform.OS === "android" ? { textAlignVertical: "center" } : null),
  },
  clearBtn: { height: 42, justifyContent: "center", paddingHorizontal: 4 },

  // Liste + keşif filtreleri paneli
  settings: {
    margin: 10,
    marginBottom: 0,
    maxHeight: "58%",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  settingsContent: { padding: 13, paddingBottom: 18 },
  settingsHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  settingsHeadingIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  settingsTitle: { fontSize: 15, fontWeight: "800" },
  filterCount: { minWidth: 25, height: 25, borderRadius: 13, paddingHorizontal: 7, alignItems: "center", justifyContent: "center" },
  filterCountText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  settingsDivider: { height: StyleSheet.hairlineWidth, marginVertical: 13 },
  settingRow: { flexDirection: "row", alignItems: "center" },
  settingSectionTitleRow: { flexDirection: "row", alignItems: "center" },
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
  providerDot: { width: 9, height: 9, borderRadius: 5 },
  genreHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 15 },
  clearInline: { fontSize: 11, fontWeight: "700" },
  clearFiltersBtn: { minHeight: 40, marginTop: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  clearFiltersText: { fontSize: 12, fontWeight: "700" },
});
