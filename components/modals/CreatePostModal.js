import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  FlatList,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Animated,
  Keyboard,
  LayoutAnimation,
  UIManager,
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useApiSettings, useContentSettings, useImageQualitySettings } from "@context/AppSettingsContext";
import axios from "axios";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPostDrafts, setPostDrafts } from "../../services/postDraftService";
import Toast from "react-native-toast-message";
import { Octicons } from "@expo/vector-icons";
import { useAuth } from "@context/AuthContext";
import { useProfileUi } from "@context/ProfileUiContext";
import UserAvatar from "@components/common/UserAvatar";
import GlassIconButton from "@components/common/GlassIconButton";
import { useUserProfile } from "@context/UserProfileContext";
import { i18nText } from "@utils/i18nText";
import {
  validatePost,
  buildPollObject,
  reorderArray,
  postTypeBadge,
  appendQuickText,
  isQuickTextPresent,
  resolveCloseIntent,
} from "@utils/postComposer";
import { shiftLightness } from "@utils/colorUtils";
import { alpha } from "../../theme/colors";
import { listItemToMedia, MAX_SHARED_LIST_ITEMS } from "@utils/listShare";
import {
  applyFacts,
  describeMediaMeta,
  formatMinutes,
  mediaSignature,
  mergeFactsIntoList,
  pickFactTargets,
  pickOverview,
  sumListMinutes,
} from "@utils/mediaFacts";
import { fetchMediaFactsBatch, fetchMediaOverview, peekMediaFacts } from "@services/tmdbFacts";
import { buildGenreMap } from "@utils/genreLabels";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import ProfileListPickerModal from "@components/modals/ProfileListPickerModal";
import {
  DANGER,
  FieldCard,
  OptionsCard,
  PillToggle,
  PosterSlot,
  QuickFillBar,
  RatingRow,
  SectionHeader,
  ToggleRow,
  TypeSelector,
} from "./createPost/ComposerParts";
import { DraftCard, DraftsEmpty } from "./createPost/DraftCard";
import LeaveSheet from "./createPost/LeaveSheet";

// Karakter sınırları — büyük Firestore dökümanlarını ve aşırı uzun
// içerikleri önler. Sayaçlar bu sabitlere göre gösterilir.
const MAX_TITLE = 100;
const MAX_CONTENT = 2000;

// Post tipi → segmented control indeksi (kayan gösterge konumu 0..3).
const TYPE_INDEX = { review: 0, list: 1, text: 2, poll: 3 };
const MAX_POLL = 4;


// ─── Search Result Grid Item ────────────────────────────────────────────────
const SearchResultItem = ({ item, onPress, getTmdbUrl, theme }) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 70 }),
      Animated.timing(opacAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.gridItem, { transform: [{ scale: scaleAnim }], opacity: opacAnim }]}>
      <TouchableOpacity
        style={[s.gridPoster, { borderColor: theme.border }]}
        onPress={() => onPress(item)}
        activeOpacity={0.75}
      >
        {item.poster_path ? (
          <Image source={{ uri: getTmdbUrl(item.poster_path, "poster", 200) }} style={s.gridPosterImg} />
        ) : (
          <View style={[s.gridPosterImg, { backgroundColor: theme.secondary, justifyContent: "center", alignItems: "center" }]}>
            <Ionicons name="film-outline" size={22} color={theme.text.muted} />
          </View>
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.88)"]} style={s.gridOverlay}>
          <Text style={s.gridTitle} numberOfLines={2}>{item.title || item.name}</Text>
          {item.vote_average > 0 && (
            <View style={s.gridRatingRow}>
              <Octicons name="star-fill" size={9} color="#FFD54F" />
              <Text style={s.gridRatingText}>{item.vote_average.toFixed(1)}</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CreatePostModal({ visible, onClose, onSubmit, editingPost, initialPost }) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const locale = language === "tr" ? "tr-TR" : "en-US";
  const { API_KEY } = useApiSettings();
  const { adultContent } = useContentSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const { user } = useAuth();
  const { avatar, selectAvatarIndex } = useProfileUi();
  const { displayName, username, avatarIndex: profileAvatarIndex } = useUserProfile();

  const isEditing = !!editingPost;

  // Poster URI: taze TMDB öğesinde poster_path, düzenlenen gönderide tam URL (poster).
  const posterUri = (item, size = 200) =>
    item?.poster_path
      ? getTmdbUrl(item.poster_path, "poster", size)
      : item?.poster || null;

  // Kayıtlı gönderinin mediaList'ini (id,type,title,poster,year) editörün
  // selectedMedia şekline çevir — böylece düzenlemede aynı içerik korunur,
  // yeniden seçim gerekmez. poster (tam URL) submit'te fallback olarak kullanılır.
  const postMediaToSelected = (mediaList) =>
    (mediaList || []).map((m) => ({
      id: m.id,
      media_type: m.type || (m.name && !m.title ? "tv" : "movie"),
      type: m.type,
      title: m.title || m.name || "",
      name: m.title || m.name || "",
      poster: m.poster || null,
      poster_path: m.poster_path || null,
      year: m.year || "",
      genre_ids: m.genre_ids || [],
      // Tür ADLARI ve süre olguları: düzenlemede taşınmazsa TEK bir "Düzenle"
      // dokunuşu hepsini KALICI ve SESSİZ siler (updatePost mediaList'in
      // tamamını değiştiriyor, merge yok).
      genres: Array.isArray(m.genres) ? m.genres : [],
      minutes: m.minutes ?? null,
      episodeMinutes: m.episodeMinutes ?? null,
      episodeCount: m.episodeCount ?? null,
      seasonCount: m.seasonCount ?? null,
      factsAt: m.factsAt ?? null,
    }));

  // Kayıtlı anketin seçeneklerini composer şekline çevir (düzenleme için).
  const pollOptionsFromPost = (poll) =>
    (poll?.options || []).map((o) => ({
      id: o.id,
      label: o.label || "",
      media: o.media
        ? { id: o.media.id, type: o.media.type, poster_path: o.media.poster_path }
        : null,
    }));

  // Form state
  const [postType, setPostType] = useState("review"); // review | list | text | poll
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [userRating, setUserRating] = useState(0);
  const [hasSpoiler, setHasSpoiler] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [ranked, setRanked] = useState(false); // sıralı liste (#1, #2...)
  // Anket: seçenekler [{ id, label, media }] + tip ("media" | "text")
  const [pollOptions, setPollOptions] = useState([]);
  const [pollKind, setPollKind] = useState("media");

  // Search state
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("movie");
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  // Yarış koşulu koruması: her aramaya artan bir id verilir; yalnızca en güncel
  // isteğin yanıtı uygulanır (eski/yavaş yanıt yeni sonucu ezemez).
  const searchReqRef = useRef(0);
  // Ana form ScrollView referansı — doğrulama hatasında en üste kaydırmak için.
  const formScrollRef = useRef(null);

  // Drafts state
  const [drafts, setDrafts] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);

  // Çıkış onayı: null | "edit" | "draft". Pencerenin İÇİNDE çizilir (LeaveSheet);
  // appAlert'e geri dönme — bkz. LeaveSheet.js başlığı.
  const [leavePrompt, setLeavePrompt] = useState(null);

  // Profildeki listeden aktarma
  const [listPickerVisible, setListPickerVisible] = useState(false);
  // Paylaşım anındaki olgu telafisi: { done, total } — belirli ilerleme.
  const [hydrating, setHydrating] = useState(null);
  // Paylaşımın hangi listeden doğduğu — yalnız ölçüm için, Firestore'a gitmez.
  const importedListRef = useRef(null);
  // Hızlı ekle: seçili içeriğin özeti (arama sonucunda yoksa TMDB'den çekilir).
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewByKey, setOverviewByKey] = useState({});
  const quickReqRef = useRef(0);

  const handleRate = (rating) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setUserRating(rating);
  };

  const handleResetRate = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setUserRating(0);
  };

  const postTypeAnim = useRef(new Animated.Value(TYPE_INDEX[postType] ?? 0)).current;
  const searchTypeAnim = useRef(new Animated.Value(searchType === "movie" ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(postTypeAnim, { toValue: TYPE_INDEX[postType] ?? 0, useNativeDriver: false, friction: 8, tension: 60 }).start();
  }, [postType]);

  useEffect(() => {
    Animated.spring(searchTypeAnim, { toValue: searchType === "movie" ? 0 : 1, useNativeDriver: false, friction: 8, tension: 60 }).start();
  }, [searchType]);

  useEffect(() => { loadDrafts(); }, []);

  // Düzenleme: modal açıldığında gönderiyi forma yükle (yeni oluşturmada dokunma).
  useEffect(() => {
    if (visible && editingPost) {
      const type = ["review", "list", "text", "poll"].includes(editingPost.type)
        ? editingPost.type
        : "review";
      setPostType(type);
      setTitle(editingPost.title || "");
      setContent(editingPost.content || "");
      setUserRating(editingPost.userRating || 0);
      setHasSpoiler(!!editingPost.hasSpoiler);
      setRanked(!!editingPost.ranked);
      setSelectedMedia(postMediaToSelected(editingPost.mediaList));
      setPollKind(editingPost.poll?.type === "text" ? "text" : "media");
      setPollOptions(pollOptionsFromPost(editingPost.poll));
      setError("");
      setShowDrafts(false);
      setCurrentDraftId(null);
      postTypeAnim.setValue(TYPE_INDEX[type] ?? 0);
    }
  }, [visible, editingPost]);

  // Detay ekranından gelen hazır inceleme akışı: medya seçili gelir, kullanıcı
  // başlığı/içeriği düzenleyip mevcut Hub paylaşım yapısıyla gönderir.
  useEffect(() => {
    if (!visible || editingPost || !initialPost) return;
    const type = ["review", "list", "text", "poll"].includes(initialPost.postType)
      ? initialPost.postType
      : "review";
    setPostType(type);
    setTitle(initialPost.title || "");
    setContent(initialPost.content || "");
    setUserRating(initialPost.userRating || 0);
    setHasSpoiler(!!initialPost.hasSpoiler);
    setRanked(!!initialPost.ranked);
    setSelectedMedia(
      initialPost.selectedMedia || postMediaToSelected(initialPost.mediaList),
    );
    setPollKind(initialPost.pollKind === "text" ? "text" : "media");
    setPollOptions(initialPost.pollOptions || []);
    setError("");
    setShowDrafts(false);
    setCurrentDraftId(null);
    postTypeAnim.setValue(TYPE_INDEX[type] ?? 0);
  }, [visible, editingPost, initialPost]);

  const loadDrafts = async () => setDrafts(getPostDrafts());

  const isSavedDraft = useMemo(() => {
    if (!currentDraftId) return false;
    const existing = drafts.find((d) => d.id === currentDraftId);
    if (!existing) return false;
    return (
      existing.title === title &&
      existing.content === content &&
      existing.postType === postType &&
      existing.userRating === userRating &&
      existing.hasSpoiler === hasSpoiler &&
      // KİMLİK imzası, tam nesne değil: süre/tür arka planda dolarken taslak
      // "değişmiş" görünüp yer imi ikonunu söndürmesin ve kapanışta gereksiz
      // "Paylaşımı bırak?" uyarısı çıkmasın.
      mediaSignature(existing.selectedMedia) === mediaSignature(selectedMedia)
    );
  }, [currentDraftId, title, content, postType, userRating, hasSpoiler, selectedMedia, drafts]);

  // Dönüş: taslak artık diskte mi? "Taslağa kaydet ve çık" yalnız true iken
  // pencereyi kapatır; kaydedilemediyse kullanıcı yazdığıyla baş başa kalır.
  const saveDraft = async () => {
    if (!title.trim() && !content.trim() && selectedMedia.length === 0) {
      Toast.show({ type: "warning", text1: i18nText("autoI18n.bos_taslak_olusturulamadi", "Boş taslak oluşturulamadı") });
      return false;
    }
    if (isSavedDraft) {
      Toast.show({ type: "info", text1: i18nText("autoI18n.zaten_kayitli", "Zaten kayıtlı"), text2: i18nText("autoI18n.taslaginiz_zaten_kaydedilmis_durumda", "Taslağınız zaten kaydedilmiş durumda.") });
      return true;
    }
    const draftData = {
      id: currentDraftId || Date.now().toString(),
      postType, title, content, selectedMedia, userRating, hasSpoiler,
      createdAt: Date.now(),
    };
    let updatedDrafts;
    if (currentDraftId) {
      updatedDrafts = drafts.map((d) => (d.id === currentDraftId ? draftData : d));
    } else {
      updatedDrafts = [draftData, ...drafts];
      setCurrentDraftId(draftData.id);
    }
    setDrafts(updatedDrafts);
    if (setPostDrafts(updatedDrafts)) {
      Toast.show({ type: "success", text1: i18nText("autoI18n.kaydedildi", "Kaydedildi"), text2: i18nText("autoI18n.taslaginiz_basariyla_kaydedildi", "Taslağınız başarıyla kaydedildi.") });
      return true;
    }
    Toast.show({ type: "error", text1: i18nText("autoI18n.hata", "Hata"), text2: i18nText("autoI18n.taslak_kaydedilemedi", "Taslak kaydedilemedi.") });
    return false;
  };

  const loadDraftToEditor = (draft) => {
    setCurrentDraftId(draft.id);
    setPostType(draft.postType || "review");
    setTitle(draft.title || "");
    setContent(draft.content || "");
    setSelectedMedia(draft.selectedMedia || []);
    setUserRating(draft.userRating || 0);
    setHasSpoiler(draft.hasSpoiler || false);
    setShowDrafts(false);
  };

  const deleteDraft = async (id) => {
    const updated = drafts.filter((d) => d.id !== id);
    setDrafts(updated);
    setPostDrafts(updated);
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isSearchActive) return;
      const reqId = ++searchReqRef.current;
      if (searchQuery.trim().length >= 2) {
        fetchSearchResults(reqId);
      } else {
        fetchPopularMedia(reqId);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [searchQuery, searchType, isSearchActive]);

  // ─── OLGU HİDRASYONU (süre / bölüm-sezon / tür adları) ──────────────────
  // TMDB ARAMA sonucu hafiftir: süre yoktur. Profil listesi öğesi ise süreyi
  // gerçekten kullanıyor (liste ekranındaki rozet ve toplam). Seçilen her eser
  // için TEK bir detay isteği atılır, sonuç kart kart işlenir.
  //
  // Bağımlılık `selectedMedia` DEĞİL hedeflerin İMZASI: effect kendi yazdığını
  // tetikleyemez. Hidrasyon bitince imza boşalır ve durur — sonsuz döngü
  // matematiksel olarak imkânsız.
  const factsReqRef = useRef(0);
  const factsPlan = useMemo(() => {
    const targets = pickFactTargets(selectedMedia, { limit: MAX_SHARED_LIST_ITEMS });
    return { targets, sig: targets.map((t) => `${t.type}:${t.id}`).join(",") };
  }, [selectedMedia]);

  useEffect(() => {
    if (!visible || !API_KEY || !factsPlan.sig) return undefined;
    const reqId = ++factsReqRef.current;
    let alive = true;
    const cancelled = () => !alive || reqId !== factsReqRef.current;

    fetchMediaFactsBatch(factsPlan.targets, {
      apiKey: API_KEY,
      language,
      concurrency: 5,
      isCancelled: cancelled,
      // Toptan yazma YOK: kullanıcı bu sırada bir öğeyi silerse ya da
      // sıralarsa, prev üzerinden birleştirmek o işlemi geri almaz.
      onResolved: (facts) => {
        if (cancelled()) return;
        setSelectedMedia((prev) => mergeFactsIntoList(prev, [facts]));
      },
    });

    return () => {
      alive = false;
    };
  }, [factsPlan.sig, visible, API_KEY, language]);

  const fetchPopularMedia = async (reqId) => {
    setLoadingSearch(true);
    try {
      const endpoint = searchType === "movie" ? "movie/popular" : "tv/popular";
      const response = await axios.get(`https://api.themoviedb.org/3/${endpoint}`, {
        params: {
          language: language === "tr" ? "tr-TR" : "en-US",
          page: "1",
        },
        headers: { Authorization: API_KEY },
      });
      if (reqId !== searchReqRef.current) return; // eskimiş yanıt → yok say
      const results = response.data.results
        .map((item) => ({ ...item, media_type: searchType }))
        .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
      setSearchResults(results);
    } catch (err) {
      console.error(i18nText("autoI18n.populer_icerik_hatasi", "Popüler içerik hatası:"), err.message);
    } finally {
      if (reqId === searchReqRef.current) setLoadingSearch(false);
    }
  };

  const fetchSearchResults = async (reqId) => {
    setLoadingSearch(true);
    try {
      const endpoint = searchType === "movie" ? "search/movie" : "search/tv";
      const response = await axios.get(`https://api.themoviedb.org/3/${endpoint}`, {
        params: {
          query: searchQuery.trim(),
          include_adult: adultContent,
          language: language === "tr" ? "tr-TR" : "en-US",
          page: "1",
        },
        headers: { Authorization: API_KEY },
      });
      if (reqId !== searchReqRef.current) return; // eskimiş yanıt → yok say
      const results = response.data.results
        .map((item) => ({ ...item, media_type: searchType }))
        .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
      setSearchResults(results);
    } catch (err) {
      console.error(i18nText("autoI18n.arama_hatasi", "Arama hatası:"), err.message);
    } finally {
      if (reqId === searchReqRef.current) setLoadingSearch(false);
    }
  };

  const handleSelectMedia = (rawItem) => {
    // Sıcak başlangıç: bu eser daha önce çözüldüyse süre ANINDA görünür,
    // hiç "boş" aşama olmaz (hidrasyon effect'i de istek atmaz).
    const hot = peekMediaFacts({
      id: rawItem?.id,
      mediaType: rawItem?.media_type || rawItem?.type,
      language,
    });
    const item = hot ? applyFacts(rawItem, hot) : rawItem;

    if (postType === "poll") {
      // Anket medya seçeneği ekle (max 4, tekrar yok).
      setPollOptions((prev) => {
        if (prev.length >= MAX_POLL || prev.find((o) => o.media?.id === item.id)) return prev;
        return [
          ...prev,
          {
            id: `opt_${item.id}`,
            label: item.title || item.name || "",
            media: { id: item.id, type: item.media_type || "movie", poster_path: item.poster_path || null },
          },
        ];
      });
    } else if (postType === "review") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSelectedMedia([item]);
    } else if (!selectedMedia.find((m) => m.id === item.id)) {
      setSelectedMedia([...selectedMedia, item]);
    }
    closeSearch();
  };

  /**
   * Profildeki bir listeyi composer'a aktarır: başlık liste adı olur, öğeler
   * medya seçimine dönüşür. Başlıkta yazı varsa ona dokunulmaz — kullanıcının
   * yazdığı metni silmek geri alınamaz bir kayıp olurdu.
   */
  const handleImportList = (list) => {
    // İzlenen diziler listesindeki eski kayıtlarda `type` boş olabiliyor;
    // liste anahtarı tipi kesin olarak biliyor.
    const fallbackType = list?.key === "watchedTv" ? "tv" : "movie";
    const media = (list?.items || [])
      .slice(0, MAX_SHARED_LIST_ITEMS)
      .map((item) => listItemToMedia(item, { fallbackType }))
      .filter(Boolean);
    if (media.length === 0) return;

    setPostType("list");
    setSelectedMedia(media);
    if (!title.trim()) setTitle(list.label.slice(0, MAX_TITLE));
    setError("");
    importedListRef.current = { key: list.key, count: media.length };
    setListPickerVisible(false);
    // Tavan aşıldıysa bunu SÖYLE: 500 filmlik listeden 100 gelmesi sessizce
    // olursa kullanıcı eksikliği paylaştıktan sonra fark eder.
    const truncated = (list.items?.length || 0) > media.length;
    Toast.show({
      type: "success",
      text1: i18nText("autoI18n.liste_aktarildi", "Liste aktarıldı"),
      text2: truncated
        ? `${list.label} · ${i18nText("autoI18n.liste_tavani_asildi", "ilk {{count}} içerik alındı", { count: media.length })}`
        : `${list.label} · ${media.length}`,
    });
  };

  const handleRemoveMedia = (id) => setSelectedMedia(selectedMedia.filter((m) => m.id !== id));
  // Sıralı listede öğeyi bir adım sola/sağa taşı (reorderArray saf + test'li).
  const moveMedia = (idx, dir) => setSelectedMedia((prev) => reorderArray(prev, idx, idx + dir));
  const openSearch = (type) => { setSearchType(type); setIsSearchActive(true); };
  const closeSearch = () => { setIsSearchActive(false); setSearchQuery(""); setSearchResults([]); };

  const [submitting, setSubmitting] = useState(false);

  // Hata mesajını göster + hata kutusu görünür olsun diye en üste kaydır
  // (klavye açıkken/aşağıdayken hatanın gözden kaçmasını önler).
  const failWith = (msg) => {
    setError(msg);
    formScrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleShare = async () => {
    const { ok, error: vErr } = validatePost({
      type: postType,
      title,
      content,
      selectedMedia,
      pollOptions,
    });
    if (!ok) {
      const messages = {
        title: i18nText("autoI18n.lutfen_bir_baslik_gir", "Lütfen bir başlık gir."),
        content: i18nText("autoI18n.lutfen_baslik_ve_icerik_alanlarini_doldurun", "Lütfen başlık ve içerik alanlarını doldurun."),
        reviewMedia: i18nText("autoI18n.lutfen_incelemeniz_icin_bir_film_veya_dizi_secin", "Lütfen incelemeniz için bir film veya dizi seçin."),
        listMedia: i18nText("autoI18n.liste_olusturmak_icin_en_az_2_icerik_secmelisiniz", "Liste oluşturmak için en az 2 içerik seçmelisiniz."),
        pollOptions: i18nText("autoI18n.anket_icin_en_az_2_secenek_ekle", "Anket için en az 2 seçenek ekle."),
        type: i18nText("autoI18n.gecersiz_paylasim_tipi", "Geçersiz paylaşım tipi."),
      };
      failWith(messages[vErr] || messages.content);
      return;
    }
    setError("");

    // PAYLAŞIM ANI TELAFİSİ: arka plan hidrasyonu bitmeden paylaşılırsa eksik
    // kalanlar burada toplanır. Bütçeli (12 öğe / 2.5 sn) ve BLOKLAMAZ —
    // süre gelmezse paylaşım yine gider, kısmi sonuç bile kullanılır.
    let media = selectedMedia;
    if (postType !== "poll" && API_KEY) {
      const missing = pickFactTargets(media, { limit: 12 });
      if (missing.length > 0) {
        const reqId = ++factsReqRef.current;
        setHydrating({ done: 0, total: missing.length });
        try {
          const facts = await fetchMediaFactsBatch(missing, {
            apiKey: API_KEY,
            language,
            concurrency: 6,
            timeoutMs: 2500,
            isCancelled: () => reqId !== factsReqRef.current,
            onResolved: () => setHydrating((h) => (h ? { ...h, done: h.done + 1 } : h)),
          });
          // setSelectedMedia ÇAĞRILMAZ: gönderim sırasında gereksiz render yok.
          media = mergeFactsIntoList(media, facts);
        } finally {
          setHydrating(null);
        }
      }
    }

    // mediaList'i Firestore'a uygun, sade bir şekle dönüştür.
    // `poster_path`, `genres` ve süre olguları EK alanlar: paylaşılan liste
    // profile kaydedilirken poster yolunu URL'den ayrıştırmak, türü yeniden
    // aramak ve süreyi yeniden çekmek zorunda kalmamak için.
    //
    // Alan kuralı: değer yoksa `null` yazılır, ASLA `undefined` — createPost
    // hiçbir temizlik yapmıyor ve tek bir undefined tüm paylaşımı düşürür.
    const mediaList = media.map((m) => {
      const type = m.media_type || m.type || (m.title ? "movie" : "tv");
      return {
        id: m.id,
        type,
        title: m.title || m.name || "",
        poster: m.poster_path
          ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
          : m.poster || null,
        poster_path: m.poster_path || null,
        year:
          (m.release_date || m.first_air_date || "").split("-")[0] ||
          m.year ||
          "",
        genre_ids: m.genre_ids || [],
        genres: Array.isArray(m.genres) ? m.genres.filter((g) => typeof g === "string") : [],
        // `minutes` YALNIZ film: toplam izleme süresi hesapları bu alanı
        // filmler üzerinden topluyor, diziye sızdırmak onları şişirirdi.
        minutes: type === "tv" ? null : Number.isFinite(m.minutes) ? m.minutes : null,
        episodeMinutes: Number.isFinite(m.episodeMinutes) ? m.episodeMinutes : null,
        episodeCount: Number.isFinite(m.episodeCount) ? m.episodeCount : null,
        seasonCount: Number.isFinite(m.seasonCount) ? m.seasonCount : null,
        factsAt: Number.isFinite(m.factsAt) ? m.factsAt : null,
      };
    });

    const payload = {
      type: postType,
      title: title.trim(),
      content: content.trim(),
      mediaList: postType === "poll" ? [] : mediaList,
      userRating:
        postType === "text" || postType === "poll"
          ? null
          : userRating > 0
            ? userRating
            : null,
      hasSpoiler,
      ranked: postType === "list" ? ranked : false,
      visibility: "public",
      authorName: displayName || user?.displayName || "",
      authorUsername: username || "",
      // Avatar tam URL değil sadece index olarak gider.
      // utils/avatars.js içinde clampAvatarIndex bir güvenlik ağı.
      authorAvatarIndex:
        typeof profileAvatarIndex === "number"
          ? profileAvatarIndex
          : typeof selectAvatarIndex === "number"
            ? selectAvatarIndex
            : 0,
      authorPhotoURL: user?.photoURL || null,
      authorAvatar: user?.photoURL || null,
    };
    if (postType === "poll") {
      payload.poll = buildPollObject({
        pollType: pollKind,
        question: title,
        options: pollOptions,
      });
    }

    // Eğer parent `onSubmit` verdiyse (PostsContext.submitPost) onu kullan;
    // vermediyse fallback olarak sadece toast göster.
    if (typeof onSubmit === "function") {
      try {
        setSubmitting(true);
        const result = await onSubmit(payload);
        if (result === null || result === undefined) {
          // submitPost null dönerse (auth yok / hata) → modal kapatma, error göster
          failWith(i18nText("autoI18n.paylasim_gonderilemedi_lutfen_tekrar_dene", "Paylaşım gönderilemedi. Lütfen tekrar dene."));
          setSubmitting(false);
          return;
        }
        if (postType === "list" && importedListRef.current) {
          trackEvent(ANALYTICS_EVENTS.LIST_SHARED_FROM_PROFILE, {
            source_list: importedListRef.current.key,
            item_count: selectedMedia.length,
            // Aktardıktan sonra elle ekleyip çıkardıysa liste birebir değildir.
            edited: importedListRef.current.count !== selectedMedia.length,
            ranked,
          });
        }
        setSubmitting(false);
        handleClose();
      } catch (e) {
        setSubmitting(false);
        failWith(i18nText("autoI18n.hata_2", "Hata: ") + (e?.message || "bilinmeyen"));
      }
    } else {
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.paylasildi", "Paylaşıldı!"),
        text2: i18nText("autoI18n.iceriginiz_basariyla_paylasildi", "İçeriğiniz başarıyla paylaşıldı."),
      });
      handleClose();
    }
  };

  const handleClose = () => {
    setError(""); setTitle(""); setContent(""); setSelectedMedia([]);
    setPostType("review"); setShowDrafts(false); setCurrentDraftId(null);
    setHasSpoiler(false); setUserRating(0);
    setRanked(false); setPollOptions([]); setPollKind("media");
    setListPickerVisible(false);
    setLeavePrompt(null);
    importedListRef.current = null;
    // Devam eden hidrasyon yazmalarını iptal et (unmount sonrası setState yok).
    factsReqRef.current += 1;
    setHydrating(null);
    quickReqRef.current += 1;
    setOverviewLoading(false);
    setOverviewByKey({});
    postTypeAnim.setValue(0);
    searchTypeAnim.setValue(0);
    closeSearch();
    // Hemen kapat. Eskiden iOS'ta 320 ms gecikme vardı (AppAlert'in kapanışıyla
    // çakışmasın diye); onay artık pencerenin içinde olduğu için çakışacak
    // ikinci bir native pencere kalmadı, gecikme ise yalnız sıfırlanmış boş
    // formu ekranda kaydırarak kapatıyordu.
    onClose();
  };

  // Kullanıcı kaynaklı kapatma (İptal / backdrop / donanım geri). Formda
  // kaydedilmemiş içerik varsa doğrudan kapatmaz; veri kaybını önlemek için
  // onay/taslak seçeneği sunar.
  //
  // Onay `appAlert` ile DEĞİL, pencerenin içindeki LeaveSheet ile sorulur:
  // appAlert köke bağlı ikinci bir native Modal açar ve iOS bunu açık duran
  // bu pencerenin üstüne sunamaz → çarpı "çalışmıyor", uyarı sistemi kilitlenir.
  const requestClose = () => {
    const intent = resolveCloseIntent({
      promptOpen: leavePrompt !== null,
      searchActive: isSearchActive,
      hasContent: !!(
        title.trim() ||
        content.trim() ||
        selectedMedia.length > 0 ||
        userRating > 0
      ),
      isEditing,
      isSavedDraft,
    });

    switch (intent) {
      case "leave-prompt":
        setLeavePrompt(null);
        return;
      case "close-search":
        closeSearch();
        return;
      case "close":
        handleClose();
        return;
      case "confirm-edit":
      case "confirm-draft":
        // Klavye açıkken sayfa klavye payıyla yukarı itilirdi; onay temiz açılsın.
        Keyboard.dismiss();
        setLeavePrompt(intent === "confirm-edit" ? "edit" : "draft");
        return;
      default:
    }
  };

  const saveDraftAndClose = async () => {
    const saved = await saveDraft();
    if (saved) handleClose();
    else setLeavePrompt(null); // kaydedilemedi → pencere açık kalır, uyarı toast'ta
  };

  // Her render yeniden kurulur (ucuz): düğmeler güncel form durumunu kapsın.
  const buildLeaveSheet = () => {
    const cancel = {
      key: "cancel",
      tone: "neutral",
      label: leavePrompt === "edit"
        ? i18nText("autoI18n.vazgec", "Vazgeç")
        : i18nText("autoI18n.iptal", "İptal"),
      onPress: () => setLeavePrompt(null),
    };
    const leave = {
      key: "leave",
      tone: "danger",
      icon: "exit-outline",
      label: i18nText("autoI18n.cik", "Çık"),
      onPress: handleClose,
    };
    if (leavePrompt === "edit") {
      return {
        title: i18nText("autoI18n.degisiklikleri_iptal_et", "Değişiklikleri iptal et?"),
        message: i18nText("autoI18n.yaptigin_degisiklikler_kaydedilmeyecek", "Yaptığın değişiklikler kaydedilmeyecek."),
        actions: [leave, cancel],
      };
    }
    return {
      title: i18nText("autoI18n.paylasimi_birak", "Paylaşımı bırak?"),
      message: i18nText("autoI18n.degisikliklerini_taslak_olarak_kaydedebilirsin", "Değişikliklerini taslak olarak kaydedebilirsin."),
      actions: [
        {
          key: "draft",
          tone: "primary",
          icon: "bookmark-outline",
          label: i18nText("autoI18n.taslaga_kaydet", "Taslağa kaydet"),
          onPress: saveDraftAndClose,
        },
        leave,
        cancel,
      ],
    };
  };
  const leaveSheetProps = leavePrompt ? buildLeaveSheet() : null;

  // ─── Derived Colors ─────────────────────────────────────────────────────────
  // Vurgu rengi paylaşım tipinden gelir ve feed kartıyla AYNI kaynaktan
  // (postTypeBadge): inceleme/sohbet mavi, liste yeşil, anket mor.
  const accentBlue = theme.colors?.blue || "#4a7cf6";
  const accentGreen = theme.colors?.green || "#34c87e";
  const typeColor = (type) => postTypeBadge(type, theme.colors).color;
  const currentAccent = typeColor(postType);
  // Paylaş butonu degrade'i: tip renginin kendisinden koyu bir uca.
  const shareGradient = [currentAccent, shiftLightness(currentAccent, -14)];

  // ─── GENRE MAP ───────────────────────────────────────────────────────────────
  // Tablo utils/genreLabels.js'te: paylaşılan listeyi KAYDEDEN taraf da aynı
  // haritayı kullanıyor, böylece tür adları alıcının dilinde çözülüyor.
  const GENRE_MAP = useMemo(() => buildGenreMap(), [language]);

  // Süre etiketleri saf mediaFacts fonksiyonlarına PARAMETRE geçilir
  // (o modül i18nText import etmiyor).
  const durationLabels = useMemo(
    () => ({
      hourLabel: i18nText("autoI18n.saat_kisa_birim", "sa"),
      minuteLabel: i18nText("autoI18n.dakika_kisa_birim", "dk"),
      seasonLabel: i18nText("autoI18n.sezon_birim", "sezon"),
      episodeLabel: i18nText("autoI18n.bolum_birim", "bölüm"),
      perEpisodeLabel: i18nText("autoI18n.dk_bolum", "dk/bölüm"),
    }),
    [language],
  );

  // Listenin toplam süresi. `known === 0` iken çip HİÇ çizilmez: "0 dk"
  // yanlış bilgidir. Bir kısmı bilinmiyorsa "en az" öneki kullanılır.
  const listTotal = useMemo(() => sumListMinutes(selectedMedia), [selectedMedia]);
  const listTotalLabel = useMemo(() => {
    const text = formatMinutes(listTotal.total, durationLabels);
    if (!text || listTotal.known === 0) return null;
    return listTotal.unknown > 0
      ? `${i18nText("autoI18n.en_az", "en az")} ${text}`
      : text;
  }, [listTotal, durationLabels]);

  // Tür rozetleri: TMDB aramasından gelen öğede tür id'si, profildeki listeden
  // aktarılan öğede tür ADI var. İkisi de aynı rozet şeridini besler.
  const listGenres = useMemo(() => {
    const names = new Set();
    selectedMedia.forEach((m) => {
      m.genre_ids?.forEach((id) => {
        const name = GENRE_MAP[id];
        if (name) names.add(name);
      });
      m.genres?.forEach((name) => {
        if (typeof name === "string" && name.trim()) names.add(name);
      });
    });
    return Array.from(names).slice(0, 6);
  }, [selectedMedia, GENRE_MAP]);

  // Form eksiksizse Paylaş tam renkli; eksikse soluk ama YİNE DE basılabilir
  // (basınca neyin eksik olduğunu söyleyen hata kutusu açılır).
  const canShare = useMemo(
    () => validatePost({ type: postType, title, content, selectedMedia, pollOptions }).ok,
    [postType, title, content, selectedMedia, pollOptions],
  );

  // ─── HIZLI EKLE (inceleme) ───────────────────────────────────────────────────
  // Seçilen içeriğin ADI başlığa, ÖZETİ açıklamaya eklenir. Kullanıcının
  // yazdığı metin ezilmez, sonuna eklenir (bkz. appendQuickText). Özet, arama
  // sonucunda hazır gelir; düzenleme/taslaktan yüklenen içerikte yoksa TMDB'den
  // çekilir (TR boşsa EN'e düşer).
  const quickMedia = postType === "review" ? selectedMedia[0] || null : null;
  const quickName = quickMedia ? (quickMedia.title || quickMedia.name || "").trim() : "";
  const quickType = quickMedia ? quickMedia.media_type || quickMedia.type || "movie" : "movie";
  const quickKey = quickMedia ? `${quickType}:${quickMedia.id}` : null;
  const quickOverview = quickMedia ? pickOverview(quickMedia) || overviewByKey[quickKey] || "" : "";
  const quickNameDone = !!quickName && isQuickTextPresent(title, quickName);
  const quickSummaryDone = !!quickOverview && isQuickTextPresent(content, quickOverview);
  // Özet ağdan gelirken kullanıcı yazmaya devam edebilir: ekleme, dokunma anındaki
  // değil EN GÜNCEL açıklama üzerinden yapılmalı (yoksa yazdığı ezilirdi).
  const contentRef = useRef(content);
  contentRef.current = content;

  // Seçilen içerik değişirse uçuştaki özet isteği geçersiz olur.
  useEffect(() => {
    quickReqRef.current += 1;
    setOverviewLoading(false);
  }, [quickKey]);

  const notifyQuick = (result) => {
    if (result.reason === "duplicate") {
      Toast.show({ type: "info", text1: i18nText("autoI18n.composer_zaten_ekli", "Zaten ekli") });
    } else if (result.reason === "full") {
      Toast.show({ type: "warning", text1: i18nText("autoI18n.composer_sigmadi", "Karakter sınırına sığmadı") });
    }
  };

  const handleQuickName = () => {
    if (!quickName) return;
    const result = appendQuickText(title, quickName, { max: MAX_TITLE, separator: " · " });
    if (result.changed) {
      setTitle(result.text);
      setError("");
    } else {
      notifyQuick(result);
    }
  };

  const handleQuickSummary = async () => {
    if (!quickMedia || overviewLoading) return;
    let text = quickOverview;
    if (!text) {
      const reqId = ++quickReqRef.current;
      setOverviewLoading(true);
      const fetched = await fetchMediaOverview({
        apiKey: API_KEY,
        id: quickMedia.id,
        mediaType: quickType,
        language,
      });
      if (reqId !== quickReqRef.current) return; // içerik değişti / pencere kapandı
      setOverviewLoading(false);
      if (fetched === null) {
        Toast.show({ type: "error", text1: i18nText("autoI18n.composer_ozet_hata", "Özet alınamadı. Bağlantını kontrol et.") });
        return;
      }
      if (!fetched) {
        Toast.show({ type: "info", text1: i18nText("autoI18n.composer_ozet_yok", "Bu içerik için özet bulunamadı") });
        return;
      }
      setOverviewByKey((prev) => ({ ...prev, [quickKey]: fetched }));
      text = fetched;
    }
    const result = appendQuickText(contentRef.current, text, { max: MAX_CONTENT });
    if (result.changed) {
      setContent(result.text);
      setError("");
    } else {
      notifyQuick(result);
    }
  };

  // Aynı yıldıza tekrar dokunmak puanı kaldırır.
  const handleRateTap = (star) => (star === userRating ? handleResetRate() : handleRate(star));

  const typeItems = [
    { key: "review", icon: "create", label: i18nText("autoI18n.inceleme", "İnceleme"), color: typeColor("review") },
    { key: "list", icon: "list", label: i18nText("autoI18n.liste_2", "Liste"), color: typeColor("list") },
    { key: "text", icon: "chatbubble-ellipses", label: i18nText("autoI18n.sohbet", "Sohbet"), color: typeColor("text") },
    { key: "poll", icon: "stats-chart", label: i18nText("autoI18n.anket", "Anket"), color: typeColor("poll") },
  ];

  const titlePlaceholder =
    postType === "review"
      ? i18nText("autoI18n.inceleme_basligi", "İnceleme başlığı...")
      : postType === "poll"
        ? i18nText("autoI18n.anket_sorusu", "Anket sorusu (Örn: Bu akşam hangisi?)...")
        : postType === "text"
          ? i18nText("autoI18n.baslik", "Başlık...")
          : i18nText("autoI18n.liste_basligi_orn_en_iyi_10_bilim_kurgu", "Liste başlığı (Örn: En İyi 10 Bilim Kurgu)...");

  const authorName = displayName || user?.displayName || "";

  const spoilerRow = (
    <ToggleRow
      key="spoiler"
      theme={theme}
      tint={DANGER}
      icon={hasSpoiler ? "warning" : "warning-outline"}
      title={i18nText("autoI18n.composer_spoiler_baslik", "Spoiler içeriyor")}
      subtitle={postType === "text" ? undefined : i18nText("autoI18n.composer_spoiler_aciklama", "Posterler bulanık görünür, metin gizlenir")}
      value={hasSpoiler}
      onValueChange={setHasSpoiler}
    />
  );
  const ratingRow = (
    <RatingRow
      key="rating"
      theme={theme}
      rating={userRating}
      label={i18nText("autoI18n.puanla_opsiyonel", "Puanla (opsiyonel)")}
      clearLabel={i18nText("autoI18n.temizle", "Temizle")}
      onRate={handleRateTap}
      onClear={handleResetRate}
    />
  );

  // Başlık yuvarlak düğmelerinin eski (cam yokken) görünümü.
  const headerBtnFallback = {
    backgroundColor: theme.secondary,
    borderColor: theme.border,
    borderWidth: StyleSheet.hairlineWidth,
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={requestClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={s.backdrop}>
          <TouchableWithoutFeedback onPress={requestClose}>
            <View style={{ height: 60, width: "100%" }} />
          </TouchableWithoutFeedback>

          {/* ── Sheet ── */}
          <View style={[s.sheet, { backgroundColor: theme.primary }]}>
            {/* Tip rengiyle üstten yumuşak ışık — içeriğin ARKASINDA */}
            <LinearGradient
              colors={[alpha(currentAccent, 0.16), alpha(currentAccent, 0)]}
              style={s.sheetGlow}
              pointerEvents="none"
            />

            {/* Drag handle */}
            <View style={s.dragWrap}>
              <View style={[s.dragPill, { backgroundColor: theme.text.muted }]} />
            </View>

            {/* ── Header ── */}
            <View style={s.header}>
              <View style={[s.headerSide, { alignItems: "flex-start" }]}>
                {isSearchActive ? (
                  <GlassIconButton
                    icon="arrow-back"
                    iconSize={20}
                    size={38}
                    fallbackRadius={19}
                    color={theme.text.primary}
                    fallbackStyle={headerBtnFallback}
                    accessibilityLabel={i18nText("autoI18n.geri", "Geri")}
                    onPress={closeSearch}
                  />
                ) : (
                  <GlassIconButton
                    icon="close"
                    iconSize={20}
                    size={38}
                    fallbackRadius={19}
                    color={theme.text.primary}
                    fallbackStyle={headerBtnFallback}
                    accessibilityLabel={t.cancel || i18nText("autoI18n.iptal", "İptal")}
                    onPress={requestClose}
                  />
                )}
              </View>

              <Text style={[s.headerTitle, { color: theme.text.primary }]} numberOfLines={1}>
                {isSearchActive
                  ? i18nText("autoI18n.icerik_ara", "İçerik Ara")
                  : showDrafts
                    ? i18nText("autoI18n.taslaklar", "Taslaklar")
                    : isEditing
                      ? i18nText("autoI18n.gonderiyi_duzenle", "Gönderiyi Düzenle")
                      : i18nText("autoI18n.yeni_paylasim", "Yeni Paylaşım")}
              </Text>

              <View style={[s.headerSide, { alignItems: "flex-end" }]}>
                {!isSearchActive && !isEditing && (
                  <View style={s.headerRight}>
                    <GlassIconButton
                      icon={showDrafts ? "folder-open" : "folder-outline"}
                      iconSize={18}
                      size={38}
                      fallbackRadius={19}
                      color={showDrafts ? currentAccent : theme.text.secondary}
                      tint={showDrafts ? alpha(currentAccent, 0.35) : undefined}
                      fallbackStyle={[
                        headerBtnFallback,
                        showDrafts && { backgroundColor: alpha(currentAccent, 0.14), borderColor: alpha(currentAccent, 0.5) },
                      ]}
                      accessibilityLabel={i18nText("autoI18n.taslaklar", "Taslaklar")}
                      onPress={() => { setShowDrafts(!showDrafts); }}
                    />
                    <GlassIconButton
                      icon={isSavedDraft ? "bookmark" : "bookmark-outline"}
                      iconSize={18}
                      size={38}
                      fallbackRadius={19}
                      color={isSavedDraft ? currentAccent : theme.text.secondary}
                      tint={isSavedDraft ? alpha(currentAccent, 0.35) : undefined}
                      fallbackStyle={[
                        headerBtnFallback,
                        isSavedDraft && { backgroundColor: alpha(currentAccent, 0.14), borderColor: alpha(currentAccent, 0.5) },
                      ]}
                      accessibilityLabel={i18nText("autoI18n.kaydet", "Kaydet")}
                      onPress={saveDraft}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* ══════════════════════════════════════════════
                TASLAKLAR EKRANI
            ══════════════════════════════════════════════ */}
            {showDrafts && !isSearchActive && (
              <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {drafts.length === 0 ? (
                  <DraftsEmpty
                    theme={theme}
                    accent={currentAccent}
                    title={i18nText("autoI18n.henuz_taslak_yok_2", "Henüz taslak yok")}
                    desc={i18nText("autoI18n.olusturdugunuz_paylasimlari_kaybetmemek_icin_sag_u", "Oluşturduğunuz paylaşımları kaybetmemek için sağ üstteki kaydet ikonuna dokunun.")}
                  />
                ) : (
                  <>
                    <SectionHeader
                      theme={theme}
                      accent={currentAccent}
                      label={i18nText("autoI18n.taslaklarim", "Taslaklarım")}
                      badge={i18nText("autoI18n.composer_n_taslak", "{{n}} taslak", { n: drafts.length })}
                    />
                    {drafts.map((draft) => (
                      <DraftCard
                        key={draft.id}
                        draft={draft}
                        theme={theme}
                        locale={locale}
                        getTmdbUrl={getTmdbUrl}
                        spoilerLabel={i18nText("autoI18n.spoiler", "SPOİLER")}
                        continueLabel={i18nText("autoI18n.duzenlemeye_devam_et", "Düzenlemeye Devam Et")}
                        onContinue={loadDraftToEditor}
                        onDelete={deleteDraft}
                      />
                    ))}
                  </>
                )}
              </ScrollView>
            )}

            {/* ══════════════════════════════════════════════
                ANA FORM EKRANI
            ══════════════════════════════════════════════ */}
            {!isSearchActive && !showDrafts && (
              <>
                {/* Tip seçici (4 tip) */}
                <TypeSelector
                  theme={theme}
                  items={typeItems}
                  active={postType}
                  onChange={setPostType}
                  anim={postTypeAnim}
                />

                <ScrollView ref={formScrollRef} style={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {/* Error */}
                  {error ? (
                    <View style={s.errorBox}>
                      <Ionicons name="alert-circle" size={18} color={DANGER} />
                      <Text style={s.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  {/* Yazar satırı — kim olarak, kime açık paylaşıyorsun */}
                  <View style={s.authorRow}>
                    {avatar ? (
                      <UserAvatar source={avatar} isCustomPhoto size={38} borderWidth={2} borderColor={alpha(currentAccent, 0.55)} />
                    ) : (
                      <View style={[s.authorFallback, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                        <Ionicons name="person" size={18} color={theme.text.muted} />
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.authorName, { color: theme.text.primary }]} numberOfLines={1}>
                        {authorName || i18nText("autoI18n.siz", "Siz")}
                      </Text>
                      {!!username && (
                        <Text style={[s.authorSub, { color: theme.text.muted }]} numberOfLines={1}>
                          @{username}
                        </Text>
                      )}
                    </View>
                    <View style={[s.visibilityPill, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                      <Ionicons name="globe-outline" size={13} color={theme.text.secondary} />
                      <Text style={[s.visibilityText, { color: theme.text.secondary }]}>
                        {i18nText("autoI18n.herkese_acik", "Herkese Açık")}
                      </Text>
                    </View>
                  </View>

                  {/* Başlık (anket için: soru) */}
                  <FieldCard
                    theme={theme}
                    accent={currentAccent}
                    icon={postType === "poll" ? "help-circle-outline" : "text"}
                    label={postType === "poll"
                      ? i18nText("autoI18n.composer_label_soru", "Soru")
                      : i18nText("autoI18n.composer_label_baslik", "Başlık")}
                    value={title}
                    onChangeText={(text) => { setTitle(text); setError(""); }}
                    placeholder={titlePlaceholder}
                    maxLength={MAX_TITLE}
                    emphasis
                  />

                  {/* ── REVIEW LAYOUT ── */}
                  {postType === "review" && (
                    <View>
                      {/* Hızlı ekle: içerik seçildiyse adı + özeti tek dokunuşla */}
                      {!!quickName && (
                        <QuickFillBar
                          theme={theme}
                          accent={currentAccent}
                          title={i18nText("autoI18n.composer_hizli_ekle", "Hızlı ekle")}
                          mediaName={quickName}
                          nameLabel={i18nText("autoI18n.composer_isim_basliga", "İsmi başlığa ekle")}
                          summaryLabel={i18nText("autoI18n.composer_ozet_aciklamaya", "Özeti açıklamaya ekle")}
                          nameDone={quickNameDone}
                          summaryDone={quickSummaryDone}
                          summaryLoading={overviewLoading}
                          onAddName={handleQuickName}
                          onAddSummary={handleQuickSummary}
                        />
                      )}

                      {/* Poster + açıklama */}
                      <View style={s.reviewRow}>
                        <PosterSlot
                          theme={theme}
                          accent={currentAccent}
                          uri={selectedMedia.length > 0 ? posterUri(selectedMedia[0]) : null}
                          meta={selectedMedia.length > 0 ? describeMediaMeta(selectedMedia[0], durationLabels) : ""}
                          emptyLabel={i18nText("autoI18n.film_dizi", "Film / Dizi")}
                          changeLabel={i18nText("autoI18n.composer_degistir", "Değiştir")}
                          onPress={() => openSearch("movie")}
                        />
                        <FieldCard
                          theme={theme}
                          accent={currentAccent}
                          icon="create-outline"
                          label={i18nText("autoI18n.composer_label_aciklama", "Açıklama")}
                          value={content}
                          onChangeText={(text) => { setContent(text); setError(""); }}
                          placeholder={i18nText("autoI18n.dusuncelerini_paylas", "Düşüncelerini paylaş...")}
                          maxLength={MAX_CONTENT}
                          multiline
                          grow
                          minHeight={120}
                          style={[{ flex: 1 }, hasSpoiler && { borderColor: "rgba(240,79,79,0.5)" }]}
                        />
                      </View>

                      <OptionsCard theme={theme}>
                        {ratingRow}
                        {spoilerRow}
                      </OptionsCard>
                    </View>
                  )}

                  {/* ── TEXT (SOHBET) LAYOUT ── */}
                  {postType === "text" && (
                    <>
                      <FieldCard
                        theme={theme}
                        accent={currentAccent}
                        icon="chatbubble-ellipses-outline"
                        label={i18nText("autoI18n.composer_label_aciklama", "Açıklama")}
                        value={content}
                        onChangeText={(text) => { setContent(text); setError(""); }}
                        placeholder={i18nText("autoI18n.aklindan_gecenleri_paylas", "Aklından geçenleri paylaş...")}
                        maxLength={MAX_CONTENT}
                        multiline
                        minHeight={170}
                        style={[s.gapTop, hasSpoiler && { borderColor: "rgba(240,79,79,0.5)" }]}
                      />
                      <OptionsCard theme={theme}>{spoilerRow}</OptionsCard>
                    </>
                  )}

                  {/* ── POLL (ANKET) LAYOUT ── */}
                  {postType === "poll" && (
                    <>
                      <View style={s.gapTop}>
                        <PillToggle
                          theme={theme}
                          accent={currentAccent}
                          active={pollKind}
                          onChange={setPollKind}
                          items={[
                            { key: "media", icon: "film-outline", label: i18nText("autoI18n.film_dizi", "Film / Dizi") },
                            { key: "text", icon: "text-outline", label: i18nText("autoI18n.metin", "Metin") },
                          ]}
                        />
                      </View>

                      <SectionHeader
                        theme={theme}
                        accent={currentAccent}
                        label={i18nText("autoI18n.anket_secenekleri_2_4", "ANKET SEÇENEKLERİ (2-4)")}
                        badge={`${pollOptions.length}/${MAX_POLL}`}
                      />

                      {pollKind === "media" ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.posterScroll}>
                          {pollOptions.map((opt) => (
                            <View key={opt.id} style={s.listPosterWrapper}>
                              {opt.media?.poster_path ? (
                                <Image source={{ uri: getTmdbUrl(opt.media.poster_path, "poster", 200) }} style={s.listPosterImg} />
                              ) : (
                                <View style={[s.listPosterImg, { backgroundColor: theme.border, justifyContent: "center", alignItems: "center" }]}>
                                  <Ionicons name="film-outline" size={28} color={theme.text.muted} />
                                </View>
                              )}
                              <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={s.listPosterOverlay}>
                                <Text style={s.listPosterTitle} numberOfLines={2}>{opt.label}</Text>
                              </LinearGradient>
                              <TouchableOpacity style={s.removeBadge} onPress={() => setPollOptions((prev) => prev.filter((o) => o.id !== opt.id))}>
                                <Ionicons name="close-circle" size={22} color={DANGER} />
                              </TouchableOpacity>
                            </View>
                          ))}
                          {pollOptions.length < MAX_POLL && (
                            <TouchableOpacity
                              style={[s.addMoreBtn, { backgroundColor: theme.secondary, borderColor: alpha(currentAccent, 0.4) }]}
                              onPress={() => openSearch("movie")}
                            >
                              <Ionicons name="add" size={30} color={currentAccent} />
                              <Text style={[s.addMoreText, { color: theme.text.muted }]}>{i18nText("autoI18n.ekle", "Ekle")}</Text>
                            </TouchableOpacity>
                          )}
                        </ScrollView>
                      ) : (
                        <View style={{ gap: 10 }}>
                          {pollOptions.map((opt, idx) => (
                            <View key={opt.id} style={s.pollTextRow}>
                              <View style={[s.pollNum, { backgroundColor: alpha(currentAccent, 0.16) }]}>
                                <Text style={[s.pollNumText, { color: currentAccent }]}>{idx + 1}</Text>
                              </View>
                              <TextInput
                                style={[s.pollTextInput, { color: theme.text.primary, backgroundColor: theme.secondary, borderColor: theme.border }]}
                                placeholder={`${i18nText("autoI18n.secenek", "Seçenek")} ${idx + 1}`}
                                placeholderTextColor={theme.text.muted}
                                value={opt.label}
                                onChangeText={(text) => setPollOptions((prev) => prev.map((o) => (o.id === opt.id ? { ...o, label: text } : o)))}
                                maxLength={60}
                              />
                              <TouchableOpacity onPress={() => setPollOptions((prev) => prev.filter((o) => o.id !== opt.id))} style={s.pollTextDel}>
                                <Ionicons name="close-circle" size={22} color={DANGER} />
                              </TouchableOpacity>
                            </View>
                          ))}
                          {pollOptions.length < MAX_POLL && (
                            <TouchableOpacity
                              style={[s.pollAddText, { borderColor: alpha(currentAccent, 0.4), backgroundColor: alpha(currentAccent, 0.06) }]}
                              onPress={() => setPollOptions((prev) => [...prev, { id: `opt_t_${prev.length}_${Date.now()}`, label: "", media: null }])}
                              activeOpacity={0.85}
                            >
                              <Ionicons name="add" size={18} color={currentAccent} />
                              <Text style={[s.pollAddTextLabel, { color: currentAccent }]}>{i18nText("autoI18n.secenek_ekle", "Seçenek ekle")}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </>
                  )}

                  {/* ── LIST LAYOUT ── */}
                  {postType === "list" && (
                    <>
                      <FieldCard
                        theme={theme}
                        accent={currentAccent}
                        icon="create-outline"
                        label={i18nText("autoI18n.composer_label_aciklama", "Açıklama")}
                        value={content}
                        onChangeText={(text) => { setContent(text); setError(""); }}
                        placeholder={i18nText("autoI18n.liste_hakkinda_dusuncelerini_paylas", "Liste hakkında düşüncelerini paylaş...")}
                        maxLength={MAX_CONTENT}
                        multiline
                        minHeight={90}
                        style={[s.gapTop, hasSpoiler && { borderColor: "rgba(240,79,79,0.5)" }]}
                      />

                      <OptionsCard theme={theme}>
                        {ratingRow}
                        {spoilerRow}
                        <ToggleRow
                          key="ranked"
                          theme={theme}
                          tint={currentAccent}
                          icon={ranked ? "podium" : "podium-outline"}
                          title={i18nText("autoI18n.sirali_liste", "Sıralı liste (#1, #2...)")}
                          subtitle={i18nText("autoI18n.composer_sirali_aciklama", "Posterlerin üstünde sıra numarası görünür")}
                          value={ranked}
                          onValueChange={setRanked}
                        />
                      </OptionsCard>

                      <SectionHeader
                        theme={theme}
                        accent={currentAccent}
                        label={i18nText("autoI18n.liste_icerikleri", "LİSTE İÇERİKLERİ")}
                        badge={selectedMedia.length > 0 ? i18nText("autoI18n.n_icerik", "{{n}} içerik", { n: selectedMedia.length }) : null}
                      />

                      {/* Profildeki listeyi olduğu gibi aktar — tek tek
                          aramak yerine hazır listeyi paylaşmanın kısa yolu. */}
                      <TouchableOpacity
                        style={[s.importListBtn, { borderColor: `${currentAccent}55`, backgroundColor: `${currentAccent}12` }]}
                        onPress={() => setListPickerVisible(true)}
                        activeOpacity={0.85}
                      >
                        <View style={[s.importIcon, { backgroundColor: alpha(currentAccent, 0.18) }]}>
                          <Ionicons name="albums-outline" size={17} color={currentAccent} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[s.importListText, { color: currentAccent }]} numberOfLines={1}>
                            {i18nText("autoI18n.listemden_aktar", "Listemden aktar")}
                          </Text>
                          <Text style={[s.importListHint, { color: theme.text.muted }]} numberOfLines={1}>
                            {i18nText("autoI18n.listemden_aktar_aciklama", "Profilindeki bir listeyi olduğu gibi paylaş")}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
                      </TouchableOpacity>

                      {/* Toplam süre + tür çipleri. Süre çipi mavi: tür
                          çiplerinden (yeşil) farklı bir bilgi türü. */}
                      {(listGenres.length > 0 || !!listTotalLabel) && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                          {!!listTotalLabel && (
                            <View style={[s.chip, s.durationChip, { backgroundColor: `${accentBlue}14`, borderColor: `${accentBlue}35` }]}>
                              <Ionicons name="time-outline" size={11} color={accentBlue} />
                              <Text style={[s.chipText, { color: accentBlue }]}>{listTotalLabel}</Text>
                            </View>
                          )}
                          {listGenres.map((genre) => (
                            <View key={genre} style={[s.chip, { backgroundColor: `${accentGreen}14`, borderColor: `${accentGreen}35` }]}>
                              <Text style={[s.chipText, { color: accentGreen }]}>{genre}</Text>
                            </View>
                          ))}
                        </ScrollView>
                      )}

                      {/* Empty stacked cards OR poster scroll */}
                      {selectedMedia.length === 0 ? (
                        <View style={s.stackWrapper}>
                          <TouchableOpacity style={s.stackContainer} onPress={() => openSearch("movie")} activeOpacity={0.8}>
                            <View style={[s.stackCard3, { backgroundColor: theme.secondary, borderColor: theme.border }]} />
                            <View style={[s.stackCard2, { backgroundColor: theme.secondary, borderColor: theme.border }]} />
                            <View style={[s.stackCard1, { backgroundColor: theme.secondary, borderColor: alpha(currentAccent, 0.4) }]}>
                              <View style={[s.posterPlusBubble, { backgroundColor: alpha(currentAccent, 0.14) }]}>
                                <Ionicons name="add" size={26} color={currentAccent} />
                              </View>
                              <Text style={[s.stackLabel, { color: theme.text.secondary }]}>{i18nText("autoI18n.icerik_sec", "İçerik Seç")}</Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.posterScroll}>
                          {selectedMedia.map((item, idx) => (
                            <View key={item.id} style={s.listPosterWrapper}>
                              {posterUri(item) ? (
                                <Image source={{ uri: posterUri(item) }} style={s.listPosterImg} />
                              ) : (
                                <View style={[s.listPosterImg, { backgroundColor: theme.border, justifyContent: "center", alignItems: "center" }]}>
                                  <Ionicons name="film-outline" size={28} color={theme.text.muted} />
                                </View>
                              )}
                              {ranked ? (
                                <View style={[s.rankBadge, { backgroundColor: currentAccent }]}>
                                  <Text style={s.rankBadgeText}>{idx + 1}</Text>
                                </View>
                              ) : (
                                <View style={[s.mediaTypeBadge, { backgroundColor: item.media_type === 'tv' ? (theme.colors?.orange || '#f5a623') : accentBlue }]}>
                                  <Text style={s.mediaTypeText}>
                                    {item.media_type === 'tv'
                                      ? i18nText("autoI18n.dizi", "Dizi")
                                      : i18nText("autoI18n.film", "Film")}
                                  </Text>
                                </View>
                              )}
                              <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={s.listPosterOverlay}>
                                {/* Sıralı listede alt-orta ok tuşları aynı
                                    bölgeyi kullanıyor: başlık tek satıra
                                    düşer, meta satırı yine sığar. */}
                                <Text style={s.listPosterTitle} numberOfLines={ranked ? 1 : 2}>{item.title || item.name}</Text>
                                {!!describeMediaMeta(item, durationLabels) && (
                                  <Text style={s.listPosterMeta} numberOfLines={1}>
                                    {describeMediaMeta(item, durationLabels)}
                                  </Text>
                                )}
                              </LinearGradient>
                              {ranked && (
                                <View style={s.reorderRow}>
                                  <TouchableOpacity disabled={idx === 0} onPress={() => moveMedia(idx, -1)} style={[s.reorderBtn, idx === 0 && { opacity: 0.3 }]}>
                                    <Ionicons name="chevron-back" size={15} color="#fff" />
                                  </TouchableOpacity>
                                  <TouchableOpacity disabled={idx === selectedMedia.length - 1} onPress={() => moveMedia(idx, 1)} style={[s.reorderBtn, idx === selectedMedia.length - 1 && { opacity: 0.3 }]}>
                                    <Ionicons name="chevron-forward" size={15} color="#fff" />
                                  </TouchableOpacity>
                                </View>
                              )}
                              <TouchableOpacity style={s.removeBadge} onPress={() => handleRemoveMedia(item.id)}>
                                <Ionicons name="close-circle" size={22} color={DANGER} />
                              </TouchableOpacity>
                            </View>
                          ))}
                          <TouchableOpacity
                            style={[s.addMoreBtn, { backgroundColor: theme.secondary, borderColor: alpha(currentAccent, 0.4) }]}
                            onPress={() => openSearch("movie")}
                          >
                            <Ionicons name="add" size={30} color={currentAccent} />
                            <Text style={[s.addMoreText, { color: theme.text.muted }]}>{i18nText("autoI18n.ekle", "Ekle")}</Text>
                          </TouchableOpacity>
                        </ScrollView>
                      )}
                    </>
                  )}

                  <View style={{ height: 24 }} />
                </ScrollView>
              </>
            )}

            {/* ══════════════════════════════════════════════
                ARAMA EKRANI
            ══════════════════════════════════════════════ */}
            {isSearchActive && (
              <View style={{ flex: 1 }}>
                {/* Search type seg */}
                <View style={[s.segmentedControlContainer, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                  <View style={{ flex: 1, position: 'relative', flexDirection: 'row' }}>
                    <Animated.View
                      style={[
                        s.segmentedButtonActiveIndicator,
                        {
                          backgroundColor: theme.primary,
                          left: searchTypeAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "50%"] })
                        }
                      ]}
                    />
                    <TouchableOpacity
                      style={s.segmentedButton}
                      onPress={() => setSearchType("movie")}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="film" size={18} color={searchType === "movie" ? accentBlue : theme.text.secondary} />
                      <Text style={[s.segmentedButtonText, { color: searchType === "movie" ? theme.text.primary : theme.text.secondary, fontWeight: searchType === "movie" ? "700" : "500" }]}>{i18nText("autoI18n.filmler", "Filmler")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.segmentedButton}
                      onPress={() => setSearchType("tv")}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="tv" size={18} color={searchType === "tv" ? (theme.colors?.orange || "#f5a623") : theme.text.secondary} />
                      <Text style={[s.segmentedButtonText, { color: searchType === "tv" ? theme.text.primary : theme.text.secondary, fontWeight: searchType === "tv" ? "700" : "500" }]}>{i18nText("autoI18n.diziler", "Diziler")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Search bar */}
                <View style={[s.searchBar, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                  <Ionicons name="search" size={18} color={theme.text.muted} />
                  <TextInput
                    style={[s.searchInput, { color: theme.text.primary }]}
                    placeholder={i18nText("autoI18n.search_media_type", "{{type}} ara...", {
                      type: searchType === "movie" ? i18nText("autoI18n.film", "Film") : i18nText("autoI18n.dizi", "Dizi"),
                    })}
                    placeholderTextColor={theme.text.muted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    maxLength={60}
                    autoFocus
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Ionicons name="close-circle" size={20} color={theme.text.muted} />
                    </TouchableOpacity>
                  )}
                </View>

                {loadingSearch ? (
                  <View style={s.loadingWrap}>
                    <ActivityIndicator size="large" color={currentAccent} />
                  </View>
                ) : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id.toString()}
                    numColumns={3}
                    columnWrapperStyle={s.gridRow}
                    renderItem={({ item }) => (
                      <SearchResultItem item={item} onPress={handleSelectMedia} getTmdbUrl={getTmdbUrl} theme={theme} />
                    )}
                    contentContainerStyle={s.gridList}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={() => (
                      <Text style={[s.emptySearch, { color: theme.text.muted }]}>
                        {searchQuery.length > 0 ? i18nText("autoI18n.sonuc_bulunamadi", "Sonuç bulunamadı") : i18nText("autoI18n.aramaya_baslamak_icin_yazin", "Aramaya başlamak için yazın...")}
                      </Text>
                    )}
                  />
                )}
              </View>
            )}

            {/* ── Footer Share Button ── */}
            {!isSearchActive && !showDrafts && (
              <SafeAreaView edges={["bottom"]} style={[s.footer, { borderTopColor: theme.border, backgroundColor: theme.primary }]}>
                <TouchableOpacity
                  onPress={handleShare}
                  activeOpacity={0.8}
                  disabled={submitting || !!hydrating}
                >
                  <LinearGradient
                    colors={shareGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      s.shareBtn,
                      { shadowColor: currentAccent },
                      (!canShare || submitting || !!hydrating) && { opacity: 0.6 },
                    ]}
                  >
                    {/* Olgu telafisi BELİRLİ ilerleme gösterir; gönderim fazının
                        belirsiz spinner'ından ayırt edilebilsin. */}
                    {hydrating ? (
                      <>
                        <Text style={s.shareBtnText}>
                          {i18nText("autoI18n.bilgiler_aliniyor", "Bilgiler alınıyor")} {hydrating.done}/{hydrating.total}
                        </Text>
                        <ActivityIndicator size="small" color="#fff" />
                      </>
                    ) : submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={s.shareBtnText}>
                          {isEditing ? i18nText("autoI18n.duzenle", "Düzenle") : t.share || i18nText("autoI18n.paylas", "Paylaş")}
                        </Text>
                        <Ionicons
                          name={isEditing ? "checkmark" : "send"}
                          size={18}
                          color="#FFF"
                        />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </SafeAreaView>
            )}

          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Çıkış onayı: ayrı bir native pencere değil, bu pencerenin en üst
          katmanı (bkz. LeaveSheet.js — appAlert iOS'ta burada sunulamıyordu). */}
      {leaveSheetProps ? (
        <LeaveSheet
          theme={theme}
          accent={currentAccent}
          title={leaveSheetProps.title}
          message={leaveSheetProps.message}
          actions={leaveSheetProps.actions}
          onDismiss={() => setLeavePrompt(null)}
        />
      ) : null}

      <ProfileListPickerModal
        visible={listPickerVisible}
        onClose={() => setListPickerVisible(false)}
        onSelect={handleImportList}
      />
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Layout
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sheetGlow: { position: "absolute", left: 0, right: 0, top: 0, height: 200 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 0 },
  gapTop: { marginTop: 12 },

  // Drag
  dragWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 2 },
  dragPill: { width: 44, height: 5, borderRadius: 999, opacity: 0.35 },

  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerSide: { width: 84, justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  headerRight: { flexDirection: "row", gap: 8 },

  // Yazar satırı
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  authorFallback: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  authorName: { fontSize: 14.5, fontWeight: "800" },
  authorSub: { fontSize: 12, marginTop: 1 },
  visibilityPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  visibilityText: { fontSize: 11, fontWeight: "700" },

  // Arama tipi segmenti
  segmentedControlContainer: { flexDirection: "row", marginHorizontal: 16, marginTop: 4, marginBottom: 4, borderRadius: 16, padding: 4, borderWidth: StyleSheet.hairlineWidth },
  segmentedButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 12, gap: 6 },
  segmentedButtonActiveIndicator: { position: "absolute", top: 0, bottom: 0, width: "50%", borderRadius: 12, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  segmentedButtonText: { fontSize: 14 },

  // Error
  errorBox: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(240,79,79,0.1)", padding: 12, borderRadius: 14, marginBottom: 12, borderWidth: 0.5, borderColor: "rgba(240,79,79,0.35)", gap: 8 },
  errorText: { color: DANGER, fontSize: 13, fontWeight: "600", flex: 1 },

  // Review layout
  reviewRow: { flexDirection: "row", gap: 12, alignItems: "stretch", marginTop: 12 },

  // Liste
  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: 0.5, marginRight: 8 },
  durationChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  chipText: { fontSize: 11, fontWeight: "700" },

  // Stacked empty cards
  stackWrapper: { alignItems: "flex-start", paddingLeft: 4, marginBottom: 10 },
  stackContainer: { width: 140, height: 165, position: "relative" },
  stackCard3: { position: "absolute", width: 84, height: 124, right: 0, top: 20, borderRadius: 14, borderWidth: 0.5, opacity: 0.35 },
  stackCard2: { position: "absolute", width: 96, height: 143, right: 8, top: 10, borderRadius: 14, borderWidth: 0.5, opacity: 0.65 },
  stackCard1: { position: "absolute", width: 108, height: 162, left: 0, top: 0, borderRadius: 18, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", zIndex: 3 },
  posterPlusBubble: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  stackLabel: { fontSize: 11.5, fontWeight: "700", marginTop: 8, letterSpacing: 0.2 },

  // Poster scroll
  posterScroll: { paddingLeft: 4, paddingVertical: 8, gap: 10 },
  listPosterWrapper: { width: 100, height: 150, position: "relative" },
  listPosterImg: { width: "100%", height: "100%", borderRadius: 14 },
  listPosterOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 8, paddingTop: 20, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  listPosterTitle: { color: "#fff", fontSize: 10, fontWeight: "700", lineHeight: 13 },
  listPosterMeta: { color: "rgba(255,255,255,0.78)", fontSize: 9, fontWeight: "700", lineHeight: 11, marginTop: 2 },
  mediaTypeBadge: { position: "absolute", top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, zIndex: 4, opacity: 0.75 },
  mediaTypeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  removeBadge: { position: "absolute", top: -6, right: -6, backgroundColor: "#fff", borderRadius: 12, zIndex: 5 },
  addMoreBtn: { width: 100, height: 150, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4 },
  addMoreText: { fontSize: 11, fontWeight: "700" },

  // Search
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 10, marginBottom: 10, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  gridList: { paddingBottom: 100, paddingTop: 4 },
  gridRow: { paddingHorizontal: 16, marginBottom: 10, gap: 10 },
  gridItem: { flex: 1, aspectRatio: 2 / 3 },
  gridPoster: { flex: 1, borderRadius: 14, overflow: "hidden", borderWidth: 0.5, backgroundColor: "rgba(150,150,150,0.08)" },
  gridPosterImg: { width: "100%", height: "100%" },
  gridOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 8, paddingTop: 20 },
  gridTitle: { color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 14 },
  gridRatingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  gridRatingText: { color: "#FFD54F", fontSize: 10, fontWeight: "700" },
  emptySearch: { textAlign: "center", marginTop: 48, fontSize: 15 },


  // Footer
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 54, borderRadius: 20, gap: 8, elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  shareBtnText: { fontWeight: "800", fontSize: 16, color: "#FFF" },

  // Liste aktarma
  importListBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  importIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  importListText: { fontSize: 13.5, fontWeight: "800" },
  importListHint: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  rankBadge: { position: "absolute", top: 6, left: 6, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 8, alignItems: "center", justifyContent: "center", zIndex: 4 },
  rankBadgeText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  reorderRow: { position: "absolute", bottom: 6, alignSelf: "center", flexDirection: "row", gap: 6, zIndex: 5 },
  reorderBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },

  // Anket composer
  pollTextRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pollNum: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  pollNumText: { fontSize: 13, fontWeight: "900" },
  pollTextInput: { flex: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  pollTextDel: { padding: 2 },
  pollAddText: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderStyle: "dashed" },
  pollAddTextLabel: { fontSize: 13, fontWeight: "700" },
});
