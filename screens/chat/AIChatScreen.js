import { pickByLanguage } from "@utils/appLanguages";
import ComposerBlur, { COMPOSER_GLASS_PILL_STYLE, ComposerBlurTarget, useComposerBlurTarget } from "../../components/chat/ComposerBlur";
import { useLiquidGlass } from "../../services/liquidGlass";
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
//
// ARAYÜZ PARÇALARI components/ai/* içindedir (karşılama + ruh hali seçici,
// geçmiş, hızlı ayar paneli, kota ölçer, düşünüyor iskeleti); "akıllı" mantık
// (filtre doğrulama, tekrar engeli, devam çipleri…) services/aiCineInsights.js'te,
// tercih şeması utils/aiPrefs.js'te. Bu dosya yalnız bunları birbirine bağlar.

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
  StyleSheet,
  Platform,
  Keyboard,
  ActivityIndicator,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import LottieView from "lottie-react-native";
import Reanimated from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";

import useModalKeyboardLift from "@hooks/useModalKeyboardLift";
import useAiPrefs from "@hooks/useAiPrefs";
import useAiQuota from "@hooks/useAiQuota";
import useAiConversations from "@hooks/useAiConversations";

import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import {
  STREAMING_PROVIDERS,
  useAppSettings,
  useImageQualitySettings,
} from "@context/AppSettingsContext";
import { useProfileStats } from "@context/ProfileStatsContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { useUserProfile } from "@context/UserProfileContext";
import { buildFavoritesPrompt, readProfileFavorites } from "@utils/fourFavorites";
import { usePremium } from "@context/PremiumContext";
import { alpha } from "@theme/colors";
import { buildLimitCopy } from "@utils/premiumFeatures";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";

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
import {
  applyDiscoveryFilters,
  buildAvoidBlock,
  buildChatShare,
  buildContextBlock,
  buildTargetCard,
  buildVibePrompt,
  collectSuggestedTitles,
  countResponseItems,
  maxRuntimeForVibe,
  quotaMeter,
} from "@services/aiCineInsights";
import { resolveCards } from "@services/tmdbLookup";
import { makeId, summarizeTitle } from "@services/aiCineStore";
import ChatBubble from "@components/AICineCards";
import ShareToChatSheet from "@components/chat/ShareToChatSheet";
import AIThinking from "@components/ai/AIThinking";
import AIWelcome from "@components/ai/AIWelcome";
import AIHistory from "@components/ai/AIHistory";
import AIQuotaMeter from "@components/ai/AIQuotaMeter";
import AIPrefsPanel, { genreLabel } from "@components/ai/AIPrefsPanel";
import { getAiCopy } from "@utils/aiCopy";
import { countDiscoveryFilters } from "@utils/aiPrefs";
import { i18nText } from "@utils/i18nText";
import GlassIconButton from "@components/common/GlassIconButton";
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

// Filtre açıkken model, yerelde elenecekler için biraz fazla öğe üretsin.
const FILTER_HEADROOM = 2;
// Yeni cevabın başına kaydırma penceresi: içerik (posterler, kartlar) boyut
// değiştirdikçe konum korunur, sonra kullanıcıya bırakılır.
const ANSWER_SCROLL_WINDOW_MS = 900;

const lastIndexWhere = (list, predicate) => {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (predicate(list[i])) return i;
  }
  return -1;
};

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

  // Tercihler Ayarlar > Yapay zeka ile AYNI kayıttır (Keys.aiCinePrefs).
  const { prefs, updatePrefs } = useAiPrefs();

  const [view, setView] = useState("chat"); // "chat" | "history"
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("explore");
  const [settingsVisible, setSettingsVisible] = useState(false);
  // Son cevapla gelen sunucu kotası (canlı kullanım okunana kadar ölçerin kaynağı)
  const [quota, setQuota] = useState(null);

  const [messages, setMessages] = useState([]);
  const [activeId, setActiveId] = useState(null);
  // Sohbet geçmişi hesaba (Firestore) yedeklenir ve yerel kopyadan SENKRON okunur
  // (hooks/useAiConversations). Yazmalar yerelde anında, buluta arka planda gider.
  const {
    conversations,
    ready: chatsReady,
    hydrating: chatsHydrating,
    waiting: chatsWaiting,
    save: saveConversation,
    remove: removeConversation,
    clearAll: clearConversations,
    refresh: refreshConversations,
  } = useAiConversations();
  const [refreshingChats, setRefreshingChats] = useState(false);
  // Aynı initialPrompt ile ikinci kez sohbet açılmasın (panel yeniden render
  // olduğunda efekt tekrar çalışır); panel kapanınca sıfırlanır.
  const initialPromptRef = useRef(null);
  // display/attachment referansları her render'da değişebildiği için efekt
  // bağımlılığı yapılmaz; en güncel değerler bu ref üzerinden okunur.
  const initialMetaRef = useRef({ display: "", attachment: null });

  const quotaPlan = AI_PLAN_LIMITS[premiumPlan] ? premiumPlan : "free";

  // ── Aç/kapa animasyonu (FAB'dan büyür / FAB'a küçülür) ──────────────────────
  const anim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(false);
  const [blurReady, setBlurReady] = useState(false);

  const insets = useSafeAreaInsets();

  // Panel kapalıyken Firestore dinleyicisi açılmaz.
  const liveUsage = useAiQuota({ active: rendered });

  const quotaState = useMemo(() => {
    const serverPlan = AI_PLAN_LIMITS[quota?.plan] ? quota.plan : quotaPlan;
    const input = liveUsage
      ? {
          daily: { used: liveUsage.dailyUsed, limit: quota?.daily?.limit },
          monthly: { used: liveUsage.monthlyUsed, limit: quota?.monthly?.limit },
        }
      : quota;
    return {
      meter: quotaMeter(input, AI_PLAN_LIMITS[serverPlan]),
      known: Boolean(liveUsage || quota),
      planLabel: t?.AICineChat?.plans?.[serverPlan] || serverPlan,
    };
  }, [liveUsage, quota, quotaPlan, t]);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      setBlurReady(false);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 460,
        easing: Easing.bezier(0.22, 1, 0.36, 1), // easeOutQuint — yumuşak yavaşlama
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setBlurReady(true);
      });
    }
    return () => anim.stopAnimation();
  }, [visible, anim]);

  const handleClose = useCallback(() => {
    setBlurReady(false);
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
  // Kaydırma niyeti: "end" = en alta yapış (kullanıcı mesajı / düşünüyor),
  // "message" = yeni cevabın BAŞINA (uzun cevap ortadan başlamasın), null = bırak.
  const scrollTargetRef = useRef({ mode: "end", id: null });
  const messageYRef = useRef({});
  const [composerHeight, setComposerHeight] = useState(76);
  const composerBlur = useComposerBlurTarget();
  const glass = useLiquidGlass();
  const scrollToEndSoon = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, []);

  const applyScrollTarget = useCallback(() => {
    const target = scrollTargetRef.current;
    if (target.mode === "end") {
      scrollRef.current?.scrollToEnd({ animated: true });
    } else if (target.mode === "message") {
      const y = messageYRef.current[target.id];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 6), animated: true });
    }
  }, []);

  const focusAnswer = useCallback((id) => {
    scrollTargetRef.current = { mode: "message", id };
    setTimeout(() => {
      if (scrollTargetRef.current.id === id) scrollTargetRef.current = { mode: null, id: null };
    }, ANSWER_SCROLL_WINDOW_MS);
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

  // Kullanıcı kütüphanesi bağlamı — yalnızca ayar açıkken kurulur (kapalıyken 0 token)
  // Dört favori ("profilimin vitrini") AI'a da gider: kullanıcının açıkça seçtiği
  // en güçlü zevk işareti. Aynı ana anahtara (prefs.enabled) bağlı — kütüphane
  // bağlamı kapalıyken hiçbir kişisel veri modele gitmez.
  const { profile: userProfile } = useUserProfile();
  const favoritesBlock = useMemo(
    () => buildFavoritesPrompt(readProfileFavorites(userProfile)),
    [userProfile],
  );
  const library = useMemo(
    () =>
      prefs.enabled
        ? buildLibraryContext(allLists, prefs, { capPerList: 100, favoritesBlock })
        : null,
    [prefs, allLists, favoritesBlock],
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
  const selectedGenreLabels = useMemo(
    () => prefs.genreKeys
      .map((key) => ONBOARDING_GENRES.find((genre) => genre.key === key))
      .filter(Boolean)
      .map((genre) => genreLabel(genre, prefs.mediaType, language)),
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

  const copy = useMemo(() => getAiCopy(language), [language]);

  const filterSummary = useMemo(() => {
    const parts = [];
    if (prefs.mediaType === "movie") parts.push(pickByLanguage(language, { tr: "Film", en: "Movies", es: "Películas" }));
    if (prefs.mediaType === "tv") parts.push(pickByLanguage(language, { tr: "Dizi", en: "Series", es: "Series" }));
    if (selectedProviders.length) parts.push(selectedProviders.map((provider) => provider.name).join(", "));
    if (selectedGenreLabels.length) parts.push(selectedGenreLabels.join(", "));
    if (prefs.enabled) parts.push(pickByLanguage(language, { tr: "Listelerim açık", en: "My lists on", es: "Mis listas activadas" }));
    return parts.join(" · ");
  }, [language, prefs.enabled, prefs.mediaType, selectedGenreLabels, selectedProviders]);

  // Tab'a göre prompt chip'leri (+ kişiselleştirilmiş / kütüphane chip'leri)
  const chips = useMemo(() => {
    const base = t?.AICineChat?.chips?.[activeTab] || [];
    const list = Array.isArray(base) ? [...base] : [];
    if (activeTab === "explore" && discoveryPreferences) {
      list.unshift({
        label: pickByLanguage(language, { tr: "🎯 Seçimlerime göre öner", en: "🎯 Recommend from my filters", es: "🎯 Recomienda según mis filtros" }),
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
    if (activeTab === "explore") {
      list.push({ label: copy.vibe.surprise, prompt: copy.vibe.surprisePrompt });
    }
    return list;
  }, [t, activeTab, mostWatchedGenre, prefs.enabled, prefs.watchList, allLists, discoveryPreferences, language, copy]);

  // ── Aktif sohbeti kaydet (yerel kopya + kalıcı günlük anında, bulut arka planda) ──
  // Oluşturulma zamanı depoda korunur; saklama sınırını aşan en eski sohbetler
  // aynı adımda hem cihazdan hem hesaptan silinir.
  const saveActive = useCallback((msgs, id) => {
    if (!id || !msgs.length) return;
    const now = Date.now();
    const firstUser = msgs.find((m) => m.role === "user");
    saveConversation(
      {
        id,
        // Detaydan açılan sohbette ilk mesajın metni uzun bir yönerge olabiliyor;
        // iliştirilmiş yapımın adı geçmiş listesinde çok daha okunur bir başlık.
        title: summarizeTitle(
          firstUser?.attachment?.title || firstUser?.display || firstUser?.text || "…",
        ),
        messages: msgs,
        createdAt: now,
        updatedAt: now,
      },
      { limit: prefs.historyLimit },
    );
  }, [prefs.historyLimit, saveConversation]);

  // ── Asistanı çalıştır ──
  // options.avoidSource: "tekrar öneri engeli" için taranacak mesajlar. "Yeniden
  // öner"de atılan cevap msgsIncludingUser'da YOKTUR ama yine de tekrarlanmamalı.
  // options.regenerate: aynı soru, farklı seçimler.
  const runAssistant = useCallback(
    async (msgsIncludingUser, convId, userText, options = {}) => {
      setLoading(true);
      scrollTargetRef.current = { mode: "end", id: null };
      scrollToEndSoon();
      try {
        const lastUserIndex = lastIndexWhere(msgsIncludingUser, (m) => m.role === "user");
        const lastUserMsg = lastUserIndex >= 0 ? msgsIncludingUser[lastUserIndex] : null;
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

        // Yalnız SON mesajın ataçı cevabı kilitler (title_spotlight). Önceki
        // mesajlardaki ataç yalnız "bu / onu" zamirlerini çözer; aksi hâlde
        // takip soruları hep aynı yapımın tanıtımını döndürürdü.
        const targetMedia = lastUserMsg?.attachment?.title ? lastUserMsg.attachment : null;
        const focusMedia = targetMedia
          ? null
          : [...msgsIncludingUser].reverse().find((item) => item.role === "user" && item.attachment?.title)?.attachment || null;

        const filterActive = countDiscoveryFilters(prefs) > 0;
        const requestedProviders = selectedProviders.map((provider) => provider.name);
        const avoidSource = options.avoidSource || msgsIncludingUser;
        const avoidBlock = prefs.avoidRepeats
          ? buildAvoidBlock(collectSuggestedTitles(avoidSource))
          : "";
        const contextBlock = prefs.timeContext ? buildContextBlock(new Date()) : "";
        const maxRuntime = lastUserMsg?.maxRuntime || null;

        // API anahtarı istemcide değil — istek callGemini proxy'sinden geçer.
        const response = await askCineStructured({
          history: priorHistory,
          userMessage: options.regenerate
            ? `${userText}\n\n(Give me a clearly different set of picks than before.)`
            : userText,
          language,
          movieGenres,
          tvGenres,
          offTopicReply: t?.AICineChat?.offTopic,
          userLibrary: library?.librarySummary || "",
          discoveryPreferences,
          targetMedia,
          focusMedia,
          responseStyle: prefs.responseStyle,
          spoilerLevel: prefs.spoilerLevel,
          maxItems: filterActive ? prefs.maxItems + FILTER_HEADROOM : prefs.maxItems,
          contextBlock,
          avoidBlock,
          onQuota: setQuota,
        });

        // Başlıkları TMDB poster kartlarına çöz. Spotlight'ta tam detay (oyuncu,
        // benzer yapım); diğerlerinde "lite" (süre + tür + platform): zevk uyumu,
        // süre rozeti, platform/tür doğrulaması bunlara bağlı.
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
            includeDetails: response.type === "title_spotlight" ? true : "lite",
          });
          posterMap = buildPosterMap(cards);
          if (targetMedia?.title) {
            const key = posterKey(targetMedia.mediaType, targetMedia.title);
            const targetCard = buildTargetCard(targetMedia, posterMap[key]);
            posterMap[posterKey(targetCard.mediaType, targetCard.title)] = targetCard;
          }
        }

        // Model filtreleri sistem yönergesinden alır; sonuç kartları TMDB'den
        // çözüldükten sonra platform/tür/içerik tipi/süre yerelde de doğrulanır
        // ve öneri sayısı ayardaki sınıra çekilir.
        const filtered = applyDiscoveryFilters(response, posterMap, {
          mediaType: prefs.mediaType,
          providers: requestedProviders,
          genres: selectedGenreLabels,
          maxRuntime,
          maxItems: prefs.maxItems,
        });

        const watchedChecked =
          library && prefs.watched
            ? applyWatchedFilter(filtered.response, posterMap, library.watchedIndex)
            : filtered.response;
        const seen = Math.max(0, countResponseItems(filtered.response) - countResponseItems(watchedChecked));

        const notes = {
          removed: filtered.report.removed,
          relaxed: filtered.report.relaxed,
          seen,
          truncated: Boolean(response.truncated),
        };
        const hasNotes = notes.removed > 0 || notes.relaxed || notes.seen > 0 || notes.truncated;

        const aiMsg = {
          id: makeId(),
          role: "assistant",
          aiResponse: watchedChecked,
          posterMap,
          text: responseToHistoryText(watchedChecked),
          ...(hasNotes ? { notes } : null),
        };
        const finalMessages = [...msgsIncludingUser, aiMsg];
        focusAnswer(aiMsg.id);
        setMessages(finalMessages);
        saveActive(finalMessages, convId);
      } catch (err) {
        const code = err?.code || "GENERIC";
        if (err?.quota) setQuota(err.quota);
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn(i18nText("autoI18n.cinematch_pro_hata", "[CineMatch Pro] hata:"), code, err?.message);
          appAlert("CineMatch Pro (DEV)", `${code}\n\n${err?.message ?? ""}`);
        }
        // Kota doldu: en güçlü satış anı. Üst plan varsa "Tekrar dene" yerine
        // planları gösteren buton çıkar (ChatBubble → ErrorBubble).
        const quotaHit = code === "QUOTA" || code === "MONTHLY_QUOTA";
        const limitCopy = quotaHit
          ? buildLimitCopy("ai_messages", err?.quota?.plan || premiumPlan, language)
          : null;
        if (quotaHit) {
          trackEvent(ANALYTICS_EVENTS.PREMIUM_GATE_HIT, {
            feature: "ai_messages",
            plan: err?.quota?.plan || premiumPlan,
            can_upgrade: Boolean(limitCopy?.canUpgrade),
          });
        }
        const errMsg = {
          id: makeId(),
          role: "assistant",
          status: "error",
          text: friendlyError(code, t),
          retry: userText,
          upsell: limitCopy?.canUpgrade
            ? {
                message: limitCopy.message,
                cta: pickByLanguage(language, { tr: "Planları gör", en: "See plans", es: "Ver planes" }),
              }
            : null,
        };
        const finalMessages = [...msgsIncludingUser, errMsg];
        scrollTargetRef.current = { mode: "end", id: null };
        setMessages(finalMessages);
        saveActive(finalMessages, convId);
        scrollToEndSoon();
      } finally {
        setLoading(false);
      }
    },
    [
      language, movieGenres, tvGenres, t, API_KEY, adultContent, saveActive, scrollToEndSoon,
      focusAnswer, library, prefs, selectedProviders, selectedGenreLabels, discoveryPreferences, premiumPlan,
    ],
  );

  // ── Gönder ──
  // options.display: baloncukta görünecek metin (model yine `text`'i alır; devam
  // çipleri ve ruh hali seçicisi İngilizce yönerge gönderir, kullanıcı kendi dilini görür).
  // options.maxRuntime: "kısa" süre seçimi için yerel doğrulama üst sınırı (dk).
  const handleSend = useCallback(
    (explicit, options) => {
      if (loading) return;
      const text = (typeof explicit === "string" ? explicit : message).trim();
      if (!text) return;

      const convId = activeId || makeId();
      if (!activeId) setActiveId(convId);

      const display = String(options?.display || "").trim() || text;
      const userMsg = { id: makeId(), role: "user", text, display };
      if (options?.maxRuntime) userMsg.maxRuntime = options.maxRuntime;
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

  // startPromptChat kimliği tercihler/listeler değiştikçe değişir; efektin
  // bağımlılığı yapılırsa 120 ms'lik zamanlayıcı iptal olur ve ilk mesaj hiç
  // gönderilmezdi. Bu yüzden en güncel işlev ref üzerinden çağrılır, "gönderildi"
  // kilidi de zamanlayıcı ATEŞLENİRKEN konur (iptal olan zamanlayıcı kilit bırakmaz).
  const startPromptChatRef = useRef(startPromptChat);
  startPromptChatRef.current = startPromptChat;

  useEffect(() => {
    if (!visible || !initialPrompt) return undefined;
    const key = String(initialPrompt);
    if (initialPromptRef.current === key) return undefined;
    // Kısa gecikme: açılış animasyonu başlasın, ilk balon boş panele değil
    // görünen panele düşsün.
    const timer = setTimeout(() => {
      initialPromptRef.current = key;
      startPromptChatRef.current(key, initialMetaRef.current);
    }, 120);
    return () => clearTimeout(timer);
  }, [visible, initialPrompt]);

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

  // "Yeniden öner": son soru aynı kalır, son cevap atılır; atılan cevaptaki
  // başlıklar tekrar-engeline girer ki gerçekten farklı seçimler gelsin.
  const handleRegenerate = useCallback(() => {
    if (loading) return;
    const lastUserIndex = lastIndexWhere(messages, (m) => m.role === "user");
    if (lastUserIndex < 0) return;
    const kept = messages.slice(0, lastUserIndex + 1);
    const convId = activeId || makeId();
    if (!activeId) setActiveId(convId);
    setMessages(kept);
    runAssistant(kept, convId, messages[lastUserIndex].text, {
      regenerate: true,
      avoidSource: messages,
    });
  }, [loading, messages, activeId, runAssistant]);

  // ── Sohbet yönetimi ──
  const newChat = useCallback(() => {
    setMessages([]);
    setActiveId(null);
    setMessage("");
    setView("chat");
  }, []);

  const openConversation = useCallback(
    (conv) => {
      scrollTargetRef.current = { mode: "end", id: null };
      setMessages(conv.messages || []);
      setActiveId(conv.id);
      setView("chat");
      scrollToEndSoon();
    },
    [scrollToEndSoon],
  );

  const deleteConversation = useCallback(
    (id) => {
      removeConversation(id);
      if (id === activeId) newChat();
    },
    [activeId, newChat, removeConversation],
  );

  const clearAll = useCallback(() => {
    clearConversations();
    // Açık sohbet de silinmiş sayılır; sonraki mesaj eski bir kayda yazmasın.
    setMessages([]);
    setActiveId(null);
  }, [clearConversations]);

  // Geçmişte aşağı çek: başka cihazdaki sohbetleri hesaptan getirir (yerel kopya
  // buluttan YENİDEN kurulur; bekleyen yerel değişiklikler korunur).
  const refreshChats = useCallback(async () => {
    if (refreshingChats) return;
    setRefreshingChats(true);
    try {
      await refreshConversations();
    } finally {
      setRefreshingChats(false);
    }
  }, [refreshConversations, refreshingChats]);

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

  // Kota doldu balonundaki "Planları gör": panel kapanır, ödeme ekranı açılır
  // (başlık dokunuşuyla aynı sıra: önce yönlendir, sonra kapat).
  const handleUpgrade = useCallback(() => {
    navigation.navigate("PremiumScreen", { source: "ai_messages" });
    handleClose();
  }, [navigation, handleClose]);

  // "Sohbete gönder": cevap, sorulan soruyla birlikte zengin bir balon olarak
  // arkadaşa/gruba gider (utils/chatShare.js). Alıcı seçilince ChatScreen açılır
  // ve mesajı kendisi yazar; panel alıcı sayfası TAMAMEN kapandıktan sonra
  // kapanır (iki Modal'ın üst üste kapanması iOS'ta sorunlu).
  const [shareDraft, setShareDraft] = useState(null);
  const handleShareToChat = useCallback(
    (msg) => {
      const at = messages.findIndex((item) => item.id === msg?.id);
      const asked = at > 0 && messages[at - 1]?.role === "user" ? messages[at - 1] : null;
      const share = buildChatShare(msg?.aiResponse, msg?.posterMap, {
        question: asked ? asked.display || asked.text : "",
      });
      if (share) setShareDraft(share);
    },
    [messages],
  );

  // Üst çubuktaki kota ölçerine dokunuş: ayrıntılı kullanım ekranı.
  const handleOpenUsage = useCallback(() => {
    navigation.navigate("PremiumUsageScreen");
    handleClose();
  }, [navigation, handleClose]);

  // Hızlı paneldeki "Tüm yapay zeka ayarları".
  const handleOpenAllSettings = useCallback(() => {
    navigation.navigate("AISettingsScreen");
    handleClose();
  }, [navigation, handleClose]);

  // Kartların ortak bağlamı (components/AICineCards → ChatBubble `baseCtx`).
  const tasteGenres = useMemo(() => {
    const out = [];
    const size = Math.max(movieGenres.length, tvGenres.length);
    for (let i = 0; i < size; i += 1) {
      [movieGenres[i], tvGenres[i]].forEach((genre) => {
        if (genre && !out.includes(genre)) out.push(genre);
      });
    }
    return out;
  }, [movieGenres, tvGenres]);
  const baseCtx = useMemo(
    () => ({
      theme, t, copy, language, getTmdbUrl,
      onTitlePress: handleTitlePress,
      tasteGenres,
      showMatchScore: prefs.showMatchScore,
    }),
    [theme, t, copy, language, getTmdbUrl, handleTitlePress, tasteGenres, prefs.showMatchScore],
  );

  const handleFollowUp = useCallback((prompt, label) => handleSend(prompt, { display: label }), [handleSend]);

  // Ruh hali seçicisi: seçimler istek metnine girer; "kısa" süre ayrıca yerelde doğrulanır.
  const handleVibe = useCallback(
    (vibe) => {
      const labels = [
        vibe.mood && copy.vibe.mood[vibe.mood],
        vibe.length && copy.vibe.length[vibe.length],
        vibe.company && copy.vibe.company[vibe.company],
      ].filter(Boolean);
      handleSend(buildVibePrompt(vibe), {
        display: labels.join(" · "),
        maxRuntime: maxRuntimeForVibe(vibe),
      });
    },
    [copy, handleSend],
  );

  const handleSendChip = useCallback((prompt) => handleSend(prompt), [handleSend]);
  const handleOpenFilters = useCallback(() => setSettingsVisible(true), []);

  const filterCount = countDiscoveryFilters(prefs);
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
            {view === "chat" ? (
              <GlassIconButton
                variant="plain"
                icon="chevron-down"
                iconSize={26}
                size={36}
                color={theme.text.primary}
                accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
                onPress={handleClose}
              />
            ) : (
              <GlassIconButton
                variant="plain"
                icon="chevron-back"
                iconSize={24}
                size={36}
                color={theme.text.primary}
                accessibilityLabel={i18nText("autoI18n.geri", "Geri")}
                onPress={() => setView("chat")}
              />
            )}
            {view === "chat" ? (
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
                  <AIQuotaMeter
                    meter={quotaState.meter}
                    known={quotaState.known}
                    planLabel={quotaState.planLabel}
                    theme={theme}
                    copy={copy}
                    onPress={handleOpenUsage}
                  />
                </View>
              </View>
            ) : (
              <Text style={[styles.headerTitle, { color: theme.text.primary, flex: 1, marginLeft: 4 }]}>
                {t?.AICineChat?.history || copy.history.title}
              </Text>
            )}
            {view === "chat" ? (
              <>
                <GlassIconButton
                  variant="plain"
                  icon="options-outline"
                  iconSize={22}
                  size={36}
                  color={settingsVisible || filterCount > 0 ? theme.bold : theme.text.between}
                  accessibilityLabel={i18nText("autoI18n.filtrele", "Filtrele")}
                  onPress={() => setSettingsVisible((v) => !v)}
                />
                <GlassIconButton
                  variant="plain"
                  size={36}
                  accessibilityLabel={i18nText("autoI18n.yeni_sohbet", "Yeni Sohbet")}
                  onPress={newChat}
                >
                  <MaterialCommunityIcons name="chat-plus-outline" size={22} color={theme.text.between} />
                </GlassIconButton>
                <GlassIconButton
                  variant="plain"
                  size={36}
                  accessibilityLabel={i18nText("autoI18n.gecmis", "Geçmiş")}
                  onPress={() => setView("history")}
                >
                  <MaterialIcons name="history" size={24} color={theme.text.between} />
                </GlassIconButton>
              </>
            ) : null}
          </View>

          {view === "history" ? (
            // ── Geçmiş ──
            <AIHistory
              theme={theme}
              t={t}
              copy={copy}
              language={language}
              conversations={conversations}
              activeId={activeId}
              getTmdbUrl={getTmdbUrl}
              onOpen={openConversation}
              onDelete={deleteConversation}
              onClearAll={clearAll}
              sync={{ ready: chatsReady, hydrating: chatsHydrating, waiting: chatsWaiting }}
              onRefresh={refreshChats}
              refreshing={refreshingChats}
            />
          ) : (
            // ── Sohbet ──
            <Reanimated.View style={[styles.chatBody, composerKeyboardStyle]}>
              {settingsVisible && (
                <AIPrefsPanel
                  theme={theme}
                  t={t}
                  copy={copy}
                  language={language}
                  prefs={prefs}
                  updatePrefs={updatePrefs}
                  onOpenAllSettings={handleOpenAllSettings}
                />
              )}

              <ComposerBlurTarget attach={composerBlur.attach} backgroundColor={theme.primary} style={{ flex: 1 }}>
              <ScrollView
                ref={scrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 12, paddingBottom: composerHeight + 16 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={applyScrollTarget}
              >
                {messages.length === 0 && !loading ? (
                  <AIWelcome
                    theme={theme}
                    t={t}
                    copy={copy}
                    tabs={TABS}
                    tabIcons={TAB_ICONS}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    chips={chips}
                    chipIcon={TAB_ICONS[activeTab]}
                    filterSummary={filterSummary}
                    onOpenFilters={handleOpenFilters}
                    onSendChip={handleSendChip}
                    onVibe={handleVibe}
                  />
                ) : (
                  messages.map((msg, index) => (
                    <View
                      key={msg.id}
                      onLayout={(event) => {
                        messageYRef.current[msg.id] = event.nativeEvent.layout.y;
                        // İçerik boyutu olayı konumdan ÖNCE gelirse yeni cevabın
                        // başına kaydırma atlanırdı; ölçüm bitince de dene.
                        if (scrollTargetRef.current.mode === "message" && scrollTargetRef.current.id === msg.id) {
                          applyScrollTarget();
                        }
                      }}
                    >
                      <ChatBubble
                        msg={msg}
                        baseCtx={baseCtx}
                        isLast={index === messages.length - 1}
                        loading={loading}
                        showFollowUps={prefs.showFollowUps}
                        onRetry={handleRetry}
                        onUpgrade={handleUpgrade}
                        onFollowUp={handleFollowUp}
                        onRegenerate={handleRegenerate}
                        onShareToChat={handleShareToChat}
                      />
                    </View>
                  ))
                )}
                {loading && <AIThinking theme={theme} copy={copy} />}
              </ScrollView>

              </ComposerBlurTarget>

              {/* Giriş çubuğu — arkadaş sohbetindeki hap ile aynı yapı:
                  [rozet][input][gönder] tek parça, odakta kenarlık vurguya döner.
                  Liste kutunun arkasına kadar uzanır; dış şerit saydamdır. */}
              <Reanimated.View
                style={styles.inputWrap}
                pointerEvents="box-none"
                onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
              >
                <Animated.View
                  style={[
                    styles.composerPill,
                    { backgroundColor: "transparent", borderColor: inputBorderColor },
                    // Cam yolunda çerçeve halkası kalkar (camın arkasında ikinci hap gibi görünüyordu).
                    glass && COMPOSER_GLASS_PILL_STYLE,
                  ]}
                >
                  <ComposerBlur target={blurReady ? composerBlur.target : null} theme={theme} />
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

      {/* "Sohbete gönder" alıcı sayfası bu Modal'ın İÇİNDE durur: iOS ikinci bir
          Modal'ı ancak ilkinin çocuğu olarak sunabilir. Alıcı seçilip sayfa
          kapandıktan sonra panel de kapanır ve açılmış sohbet ortaya çıkar. */}
      <ShareToChatSheet
        visible={!!shareDraft}
        share={shareDraft}
        onClose={() => setShareDraft(null)}
        onSent={handleClose}
      />
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
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },

  // Mesaj kutusu listenin üzerinde; dış şerit saydam ve dokunmaları geçirir.
  inputWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "transparent",
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

    backgroundColor: "transparent",
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
    backgroundColor: "transparent",
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
});
