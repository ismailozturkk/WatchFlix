import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { Octicons } from "@expo/vector-icons";
import { useAuth } from "@context/AuthContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { appAlert } from "@components/AppAlert";
import { i18nText } from "@utils/i18nText";
import { validatePost, buildPollObject, reorderArray } from "@utils/postComposer";

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

// ─── Star Row ────────────────────────────────────────────────────────────────
const StarRow = ({ rating, onRate, theme }) => (
  <View style={[s.starPill, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
    {[1, 2, 3, 4, 5].map((star) => (
      <TouchableOpacity key={star} onPress={() => onRate(star)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
        <Octicons
          name={rating >= star ? "star-fill" : "star"}
          size={24}
          color={rating >= star ? "#FFD54F" : theme.text.muted}
        />
      </TouchableOpacity>
    ))}
  </View>
);

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

  const loadDrafts = async () => {
    try {
      const stored = await AsyncStorage.getItem("post_drafts");
      if (stored) setDrafts(JSON.parse(stored));
    } catch (e) { console.log(e); }
  };

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
      JSON.stringify(existing.selectedMedia) === JSON.stringify(selectedMedia)
    );
  }, [currentDraftId, title, content, postType, userRating, hasSpoiler, selectedMedia, drafts]);

  const saveDraft = async () => {
    if (!title.trim() && !content.trim() && selectedMedia.length === 0) {
      Toast.show({ type: "warning", text1: i18nText("autoI18n.bos_taslak_olusturulamadi", "Boş taslak oluşturulamadı") });
      return;
    }
    if (isSavedDraft) {
      Toast.show({ type: "info", text1: i18nText("autoI18n.zaten_kayitli", "Zaten kayıtlı"), text2: i18nText("autoI18n.taslaginiz_zaten_kaydedilmis_durumda", "Taslağınız zaten kaydedilmiş durumda.") });
      return;
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
    try {
      await AsyncStorage.setItem("post_drafts", JSON.stringify(updatedDrafts));
      Toast.show({ type: "success", text1: i18nText("autoI18n.kaydedildi", "Kaydedildi"), text2: i18nText("autoI18n.taslaginiz_basariyla_kaydedildi", "Taslağınız başarıyla kaydedildi.") });
    } catch (e) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.hata", "Hata"), text2: i18nText("autoI18n.taslak_kaydedilemedi", "Taslak kaydedilemedi.") });
    }
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
    await AsyncStorage.setItem("post_drafts", JSON.stringify(updated));
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

  const handleSelectMedia = (item) => {
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
      setSelectedMedia([item]);
    } else if (!selectedMedia.find((m) => m.id === item.id)) {
      setSelectedMedia([...selectedMedia, item]);
    }
    closeSearch();
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

    // mediaList'i Firestore'a uygun, sade bir şekle dönüştür.
    const mediaList = selectedMedia.map((m) => ({
      id: m.id,
      type: m.media_type || m.type || (m.title ? "movie" : "tv"),
      title: m.title || m.name || "",
      poster: m.poster_path
        ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
        : m.poster || null,
      year:
        (m.release_date || m.first_air_date || "").split("-")[0] ||
        m.year ||
        "",
      genre_ids: m.genre_ids || [],
    }));

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
      // Avatar tam URL değil sadece index olarak gider.
      // utils/avatars.js içinde clampAvatarIndex bir güvenlik ağı.
      authorAvatarIndex:
        typeof selectAvatarIndex === "number" ? selectAvatarIndex : 0,
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
    postTypeAnim.setValue(0);
    searchTypeAnim.setValue(0);
    closeSearch();
    onClose();
  };

  // Kullanıcı kaynaklı kapatma (İptal / backdrop / donanım geri). Formda
  // kaydedilmemiş içerik varsa doğrudan kapatmaz; veri kaybını önlemek için
  // onay/taslak seçeneği sunar.
  const requestClose = () => {
    if (isSearchActive) { closeSearch(); return; }
    const hasContent = !!(
      title.trim() ||
      content.trim() ||
      selectedMedia.length > 0 ||
      userRating > 0
    );
    if (!hasContent) { handleClose(); return; }

    if (isEditing) {
      appAlert(
        i18nText("autoI18n.degisiklikleri_iptal_et", "Değişiklikleri iptal et?"),
        i18nText("autoI18n.yaptigin_degisiklikler_kaydedilmeyecek", "Yaptığın değişiklikler kaydedilmeyecek."),
        [
          { text: i18nText("autoI18n.vazgec", "Vazgeç"), style: "cancel" },
          { text: i18nText("autoI18n.cik", "Çık"), style: "destructive", onPress: handleClose },
        ],
      );
      return;
    }

    if (isSavedDraft) { handleClose(); return; }

    appAlert(
      i18nText("autoI18n.paylasimi_birak", "Paylaşımı bırak?"),
      i18nText("autoI18n.degisikliklerini_taslak_olarak_kaydedebilirsin", "Değişikliklerini taslak olarak kaydedebilirsin."),
      [
        { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
        { text: i18nText("autoI18n.cik", "Çık"), style: "destructive", onPress: handleClose },
        {
          text: i18nText("autoI18n.taslaga_kaydet", "Taslağa kaydet"),
          onPress: async () => { await saveDraft(); handleClose(); },
        },
      ],
    );
  };

  // ─── Derived Colors ─────────────────────────────────────────────────────────
  const accentBlue = theme.colors?.blue || "#4a7cf6";
  const accentGreen = theme.colors?.green || "#34c87e";
  const currentAccent = postType === "list" || postType === "poll" ? accentGreen : accentBlue;
  // Paylaş butonu degrade'i aktif post tipine göre değişir (liste/anket = yeşil).
  const shareGradient =
    postType === "list" || postType === "poll" ? [accentGreen, "#1f8f5a"] : [accentBlue, "#2b5fb0"];

  // ─── GENRE MAP ───────────────────────────────────────────────────────────────
  // useMemo([language]): dil değişince yeniden çözülür, her render'da kurulmaz.
  const GENRE_MAP = useMemo(
    () => ({
      28: i18nText("autoI18n.aksiyon", "Aksiyon"),
      12: i18nText("autoI18n.macera", "Macera"),
      16: i18nText("autoI18n.animasyon", "Animasyon"),
      35: i18nText("autoI18n.komedi", "Komedi"),
      80: i18nText("autoI18n.suc", "Suç"),
      99: i18nText("autoI18n.belgesel", "Belgesel"),
      18: i18nText("autoI18n.dram", "Dram"),
      10751: i18nText("autoI18n.aile", "Aile"),
      14: i18nText("autoI18n.fantastik", "Fantastik"),
      36: i18nText("autoI18n.tarih", "Tarih"),
      27: i18nText("autoI18n.korku", "Korku"),
      10402: i18nText("autoI18n.muzik", "Müzik"),
      9648: i18nText("autoI18n.gizem", "Gizem"),
      10749: i18nText("autoI18n.romantik", "Romantik"),
      878: i18nText("autoI18n.bilim_kurgu", "Bilim Kurgu"),
      53: i18nText("autoI18n.gerilim", "Gerilim"),
      10752: i18nText("autoI18n.savas", "Savaş"),
      37: i18nText("autoI18n.vahsi_bati", "Vahşi Batı"),
      10759: i18nText("autoI18n.aksiyon_macera", "Aksiyon & Macera"),
      10762: i18nText("autoI18n.cocuk", "Çocuk"),
      10765: i18nText("autoI18n.bilim_kurgu_fantastik", "Bilim Kurgu & Fantastik"),
    }),
    [language],
  );

  const listGenres = useMemo(() => {
    const ids = new Set();
    selectedMedia.forEach((m) => m.genre_ids?.forEach((id) => ids.add(id)));
    return Array.from(ids).map((id) => GENRE_MAP[id]).filter(Boolean).slice(0, 6);
  }, [selectedMedia, GENRE_MAP]);

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

            {/* Drag handle */}
            <View style={s.dragWrap}>
              <View style={[s.dragPill, { backgroundColor: theme.text.muted }]} />
            </View>

            {/* ── Header ── */}
            <View style={[s.header, { borderBottomColor: theme.border }]}>
              {isSearchActive ? (
                <TouchableOpacity onPress={closeSearch} style={s.headerBtn}>
                  <Ionicons name="arrow-back" size={22} color={theme.text.primary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={requestClose} style={s.headerBtn}>
                  <Text style={[s.cancelText, { color: theme.text.secondary }]}>{t.cancel || i18nText("autoI18n.iptal", "İptal")}</Text>
                </TouchableOpacity>
              )}

              <Text style={[s.headerTitle, { color: theme.text.primary }]}>
                {isSearchActive
                  ? i18nText("autoI18n.icerik_ara", "İçerik Ara")
                  : showDrafts
                    ? i18nText("autoI18n.taslaklar", "Taslaklar")
                    : isEditing
                      ? i18nText("autoI18n.gonderiyi_duzenle", "Gönderiyi Düzenle")
                      : i18nText("autoI18n.yeni_paylasim", "Yeni Paylaşım")}
              </Text>

              {!isSearchActive && !isEditing ? (
                <View style={s.headerRight}>
                  <TouchableOpacity
                    style={[s.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
                    onPress={() => { setShowDrafts(!showDrafts); }}
                  >
                    <Ionicons name={showDrafts ? "folder-open" : "folder-outline"} size={18} color={showDrafts ? currentAccent : theme.text.secondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
                    onPress={saveDraft}
                  >
                    <Ionicons name={isSavedDraft ? "bookmark" : "bookmark-outline"} size={18} color={isSavedDraft ? currentAccent : theme.text.secondary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ width: 72 }} />
              )}
            </View>

            {/* ══════════════════════════════════════════════
                TASLAKLAR EKRANI
            ══════════════════════════════════════════════ */}
            {showDrafts && !isSearchActive && (
              <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {drafts.length === 0 ? (
                  <View style={s.emptyState}>
                    <Ionicons name="documents-outline" size={52} color={theme.text.muted} />
                    <Text style={[s.emptyTitle, { color: theme.text.secondary }]}>{i18nText("autoI18n.henuz_taslak_yok_2", "Henüz taslak yok")}</Text>
                    <Text style={[s.emptyDesc, { color: theme.text.muted }]}>{i18nText("autoI18n.olusturdugunuz_paylasimlari_kaybetmemek_icin_sag_u", "Oluşturduğunuz paylaşımları kaybetmemek için sağ üstteki kaydet ikonuna dokunun.")}</Text>
                  </View>
                ) : (
                  drafts.map((draft) => (
                    <View key={draft.id} style={[s.draftCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                      {/* Draft header */}
                      <View style={s.draftHeader}>
                        {avatar ? (
                          <Image source={avatar} style={[s.draftAvatar, { backgroundColor: theme.border }]} />
                        ) : (
                          <View style={[s.draftAvatar, { backgroundColor: theme.border }]}>
                            <Ionicons name="person" size={20} color={theme.text.muted} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={[s.draftName, { color: theme.text.primary }]}>{user?.displayName || i18nText("autoI18n.siz", "Siz")}</Text>
                            <View style={[s.badge, {
                              backgroundColor: draft.postType === "list"
                                ? `${accentGreen}18` : `${accentBlue}18`,
                              borderColor: draft.postType === "list"
                                ? `${accentGreen}45` : `${accentBlue}45`,
                            }]}>
                              <Text style={[s.badgeText, { color: draft.postType === "list" ? accentGreen : accentBlue }]}>
                                {draft.postType === "review" ? i18nText("autoI18n.inceleme_upper", "İNCELEME") : i18nText("autoI18n.liste_upper", "LİSTE")}
                              </Text>
                            </View>
                            {draft.hasSpoiler && (
                              <View style={[s.badge, { backgroundColor: "rgba(240,79,79,0.12)", borderColor: "rgba(240,79,79,0.3)" }]}>
                                <Text style={[s.badgeText, { color: "#f04f4f" }]}>{i18nText("autoI18n.spoiler", "SPOİLER")}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[s.draftTime, { color: theme.text.muted }]}>
                            {new Date(draft.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        </View>
                      </View>

                      {/* Draft body */}
                      {draft.postType === "review" ? (
                        <View style={s.draftReviewRow}>
                          <View style={[s.draftMiniPoster, { backgroundColor: theme.border }]}>
                            {draft.selectedMedia?.[0]?.poster_path ? (
                              <Image source={{ uri: getTmdbUrl(draft.selectedMedia[0].poster_path, "poster", 200) }} style={s.draftMiniPosterImg} />
                            ) : (
                              <Ionicons name="film-outline" size={22} color={theme.text.muted} />
                            )}
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            {(draft.userRating || 0) > 0 && (
                              <View style={{ flexDirection: "row", gap: 2 }}>
                                {[1, 2, 3, 4, 5].map((s2) => (
                                  <Octicons key={s2} name={(draft.userRating || 0) >= s2 ? "star-fill" : "star"} size={13} color="#FFD54F" />
                                ))}
                              </View>
                            )}
                            {draft.title ? <Text style={[s.draftTitle, { color: theme.text.primary }]} numberOfLines={2}>{draft.title}</Text> : null}
                            {draft.content ? <Text style={[s.draftContent, { color: theme.text.secondary }]} numberOfLines={4}>{draft.content}</Text> : null}
                          </View>
                        </View>
                      ) : (
                        <>
                          {draft.title ? <Text style={[s.draftTitle, { color: theme.text.primary }]}>{draft.title}</Text> : null}
                          {draft.content ? <Text style={[s.draftContent, { color: theme.text.secondary }]} numberOfLines={2}>{draft.content}</Text> : null}
                          {draft.selectedMedia?.length > 0 && (
                            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                              {draft.selectedMedia.slice(0, 3).map((m) => (
                                <View key={m.id} style={[s.draftThumb, { backgroundColor: theme.border }]}>
                                  {m.poster_path ? (
                                    <Image source={{ uri: getTmdbUrl(m.poster_path, "poster", 92) }} style={s.draftThumbImg} />
                                  ) : null}
                                </View>
                              ))}
                              {draft.selectedMedia.length > 3 && (
                                <View style={[s.draftThumb, { backgroundColor: theme.border, justifyContent: "center", alignItems: "center" }]}>
                                  <Text style={[s.draftThumbMore, { color: theme.text.secondary }]}>+{draft.selectedMedia.length - 3}</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </>
                      )}

                      {/* Draft actions */}
                      <View style={[s.draftActions, { borderTopColor: theme.border }]}>
                        <TouchableOpacity
                          style={[s.draftEditBtn, { backgroundColor: `${accentBlue}14`, borderColor: `${accentBlue}35` }]}
                          onPress={() => loadDraftToEditor(draft)}
                        >
                          <Ionicons name="create-outline" size={15} color={accentBlue} />
                          <Text style={[s.draftEditText, { color: accentBlue }]}>{i18nText("autoI18n.duzenlemeye_devam_et", "Düzenlemeye Devam Et")}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.draftDelBtn, { backgroundColor: "rgba(240,79,79,0.1)", borderColor: "rgba(240,79,79,0.25)" }]}
                          onPress={() => deleteDraft(draft.id)}
                        >
                          <Ionicons name="trash-outline" size={17} color="#f04f4f" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            {/* ══════════════════════════════════════════════
                ANA FORM EKRANI
            ══════════════════════════════════════════════ */}
            {!isSearchActive && !showDrafts && (
              <>
                {/* Segmented control (4 tip) */}
                <View style={[s.segmentedControlContainer, { backgroundColor: theme.secondary }]}>
                  <View style={{ flex: 1, position: 'relative', flexDirection: 'row' }}>
                    <Animated.View
                      style={[
                        s.segmentedButtonActiveIndicator,
                        {
                          width: "25%",
                          backgroundColor: theme.primary,
                          left: postTypeAnim.interpolate({ inputRange: [0, 1, 2, 3], outputRange: ["0%", "25%", "50%", "75%"] }),
                        },
                      ]}
                    />
                    {[
                      { key: "review", icon: "create", label: i18nText("autoI18n.inceleme", "İnceleme"), color: accentBlue },
                      { key: "list", icon: "list", label: i18nText("autoI18n.liste_2", "Liste"), color: accentGreen },
                      { key: "text", icon: "chatbubble-ellipses", label: i18nText("autoI18n.sohbet", "Sohbet"), color: accentBlue },
                      { key: "poll", icon: "stats-chart", label: i18nText("autoI18n.anket", "Anket"), color: accentGreen },
                    ].map((seg) => (
                      <TouchableOpacity
                        key={seg.key}
                        style={s.segmentedButton}
                        onPress={() => setPostType(seg.key)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={seg.icon} size={16} color={postType === seg.key ? seg.color : theme.text.secondary} />
                        <Text style={[s.segmentedButtonText, { fontSize: 11.5, color: postType === seg.key ? theme.text.primary : theme.text.secondary, fontWeight: postType === seg.key ? "700" : "500" }]}>{seg.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <ScrollView ref={formScrollRef} style={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {/* Error */}
                  {error ? (
                    <View style={s.errorBox}>
                      <Ionicons name="alert-circle" size={18} color="#f04f4f" />
                      <Text style={s.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  {/* Title input */}
                  <TextInput
                    style={[s.titleInput, { color: theme.text.primary, backgroundColor: theme.secondary, borderColor: theme.border }]}
                    placeholder={
                      postType === "review"
                        ? i18nText("autoI18n.inceleme_basligi", "İnceleme başlığı...")
                        : postType === "poll"
                          ? i18nText("autoI18n.anket_sorusu", "Anket sorusu (Örn: Bu akşam hangisi?)...")
                          : postType === "text"
                            ? i18nText("autoI18n.baslik", "Başlık...")
                            : i18nText("autoI18n.liste_basligi_orn_en_iyi_10_bilim_kurgu", "Liste başlığı (Örn: En İyi 10 Bilim Kurgu)...")
                    }
                    placeholderTextColor={theme.text.muted}
                    value={title}
                    onChangeText={(text) => { setTitle(text); setError(""); }}
                    maxLength={MAX_TITLE}
                  />
                  <Text style={[s.counterText, { color: theme.text.muted }, title.length >= MAX_TITLE && { color: "#f04f4f" }]}>
                    {title.length}/{MAX_TITLE}
                  </Text>

                  {/* ── REVIEW LAYOUT ── */}
                  {postType === "review" && (
                    <View>
                      {/* Poster + Textarea */}
                      <View style={s.reviewRow}>
                        <View style={{ alignItems: "center" }}>
                          <TouchableOpacity
                            style={[s.posterSlot, { backgroundColor: theme.secondary, borderColor: theme.border },
                              selectedMedia.length > 0 && { borderStyle: "solid", borderColor: `${accentBlue}50` }]}
                            onPress={() => openSearch("movie")}
                            activeOpacity={0.75}
                          >
                            {selectedMedia.length > 0 ? (
                              <>
                                <Image source={{ uri: posterUri(selectedMedia[0]) }} style={s.posterSlotImg} />
                                <LinearGradient
                                  colors={["transparent", "rgba(0,0,0,0.7)"]}
                                  style={s.posterSlotGradient}
                                >
                                  <Ionicons name="swap-horizontal" size={14} color="rgba(255,255,255,0.7)" />
                                </LinearGradient>
                              </>
                            ) : (
                              <>
                                <Ionicons name="add" size={28} color={theme.text.muted} />
                                <Text style={[s.posterSlotLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.film_dizi", "Film / Dizi")}</Text>
                              </>
                            )}
                          </TouchableOpacity>

                          {userRating > 0 && (
                            <TouchableOpacity 
                              style={[s.miniStarBadge, { backgroundColor: theme.secondary, borderColor: theme.border }]} 
                              onPress={handleResetRate}
                              activeOpacity={0.8}
                            >
                              <Octicons name="star-fill" size={14} color="#FFD54F" />
                              <Text style={[s.miniStarText, { color: theme.text.primary }]}>{userRating} / 5</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <TextInput
                          style={[
                            s.reviewTextarea, 
                            { color: theme.text.primary, backgroundColor: theme.secondary, borderColor: theme.border },
                            hasSpoiler && { borderColor: "rgba(240,79,79,0.5)", borderWidth: 1 }
                          ]}
                          placeholder={i18nText("autoI18n.dusuncelerini_paylas", "Düşüncelerini paylaş...")}
                          placeholderTextColor={theme.text.muted}
                          value={content}
                          onChangeText={(text) => { setContent(text); setError(""); }}
                          multiline
                          textAlignVertical="top"
                          maxLength={MAX_CONTENT}
                        />
                      </View>
                      <Text style={[s.counterText, { color: theme.text.muted }, content.length >= MAX_CONTENT && { color: "#f04f4f" }]}>
                        {content.length}/{MAX_CONTENT}
                      </Text>
                      {/* Stars + Spoiler row */}
                      <View style={[s.metaRow, userRating > 0 && { justifyContent: "flex-end", minHeight: 40 }]}>
                        {userRating === 0 && (
                          <StarRow rating={userRating} onRate={handleRate} theme={theme} />
                        )}
                        <TouchableOpacity
                          style={[s.spoilerBtn, { backgroundColor: theme.secondary, borderColor: theme.border },
                            hasSpoiler && { backgroundColor: "rgba(240,79,79,0.1)", borderColor: "rgba(240,79,79,0.4)" }]}
                          onPress={() => setHasSpoiler(!hasSpoiler)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name={hasSpoiler ? "warning" : "warning-outline"} size={14} color={hasSpoiler ? "#f04f4f" : theme.text.muted} />
                          <Text style={[s.spoilerText, { color: hasSpoiler ? "#f04f4f" : theme.text.muted }]}>
                            Spoiler
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* ── TEXT (SOHBET) LAYOUT ── */}
                  {postType === "text" && (
                    <>
                      <TextInput
                        style={[s.listTextarea, { color: theme.text.primary, backgroundColor: theme.secondary, borderColor: theme.border, minHeight: 150 }]}
                        placeholder={i18nText("autoI18n.aklindan_gecenleri_paylas", "Aklından geçenleri paylaş...")}
                        placeholderTextColor={theme.text.muted}
                        value={content}
                        onChangeText={(text) => { setContent(text); setError(""); }}
                        multiline
                        textAlignVertical="top"
                        maxLength={MAX_CONTENT}
                      />
                      <Text style={[s.counterText, { color: theme.text.muted }, content.length >= MAX_CONTENT && { color: "#f04f4f" }]}>
                        {content.length}/{MAX_CONTENT}
                      </Text>
                      <View style={s.listMetaRow}>
                        <TouchableOpacity
                          style={[s.spoilerBtn, { backgroundColor: theme.secondary, borderColor: theme.border },
                            hasSpoiler && { backgroundColor: "rgba(240,79,79,0.1)", borderColor: "rgba(240,79,79,0.4)" }]}
                          onPress={() => setHasSpoiler(!hasSpoiler)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name={hasSpoiler ? "warning" : "warning-outline"} size={14} color={hasSpoiler ? "#f04f4f" : theme.text.muted} />
                          <Text style={[s.spoilerText, { color: hasSpoiler ? "#f04f4f" : theme.text.muted }]}>Spoiler</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* ── POLL (ANKET) LAYOUT ── */}
                  {postType === "poll" && (
                    <>
                      <View style={s.pollKindRow}>
                        <TouchableOpacity
                          style={[s.pollKindBtn, { borderColor: theme.border, backgroundColor: theme.secondary }, pollKind === "media" && { borderColor: accentGreen, backgroundColor: `${accentGreen}14` }]}
                          onPress={() => setPollKind("media")}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="film-outline" size={15} color={pollKind === "media" ? accentGreen : theme.text.secondary} />
                          <Text style={[s.pollKindText, { color: pollKind === "media" ? accentGreen : theme.text.secondary }]}>{i18nText("autoI18n.film_dizi", "Film / Dizi")}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.pollKindBtn, { borderColor: theme.border, backgroundColor: theme.secondary }, pollKind === "text" && { borderColor: accentGreen, backgroundColor: `${accentGreen}14` }]}
                          onPress={() => setPollKind("text")}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="text-outline" size={15} color={pollKind === "text" ? accentGreen : theme.text.secondary} />
                          <Text style={[s.pollKindText, { color: pollKind === "text" ? accentGreen : theme.text.secondary }]}>{i18nText("autoI18n.metin", "Metin")}</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={[s.sectionLabel, { color: theme.text.muted, marginTop: 4 }]}>
                        {i18nText("autoI18n.anket_secenekleri_2_4", "ANKET SEÇENEKLERİ (2-4)")}
                      </Text>

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
                                <Ionicons name="close-circle" size={22} color="#f04f4f" />
                              </TouchableOpacity>
                            </View>
                          ))}
                          {pollOptions.length < MAX_POLL && (
                            <TouchableOpacity
                              style={[s.addMoreBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
                              onPress={() => openSearch("movie")}
                            >
                              <Ionicons name="add" size={30} color={theme.text.muted} />
                              <Text style={[s.addMoreText, { color: theme.text.muted }]}>{i18nText("autoI18n.ekle", "Ekle")}</Text>
                            </TouchableOpacity>
                          )}
                        </ScrollView>
                      ) : (
                        <View style={{ gap: 10 }}>
                          {pollOptions.map((opt, idx) => (
                            <View key={opt.id} style={s.pollTextRow}>
                              <TextInput
                                style={[s.pollTextInput, { color: theme.text.primary, backgroundColor: theme.secondary, borderColor: theme.border }]}
                                placeholder={`${i18nText("autoI18n.secenek", "Seçenek")} ${idx + 1}`}
                                placeholderTextColor={theme.text.muted}
                                value={opt.label}
                                onChangeText={(text) => setPollOptions((prev) => prev.map((o) => (o.id === opt.id ? { ...o, label: text } : o)))}
                                maxLength={60}
                              />
                              <TouchableOpacity onPress={() => setPollOptions((prev) => prev.filter((o) => o.id !== opt.id))} style={s.pollTextDel}>
                                <Ionicons name="close-circle" size={22} color="#f04f4f" />
                              </TouchableOpacity>
                            </View>
                          ))}
                          {pollOptions.length < MAX_POLL && (
                            <TouchableOpacity
                              style={[s.pollAddText, { borderColor: theme.border, backgroundColor: theme.secondary }]}
                              onPress={() => setPollOptions((prev) => [...prev, { id: `opt_t_${prev.length}_${Date.now()}`, label: "", media: null }])}
                              activeOpacity={0.85}
                            >
                              <Ionicons name="add" size={18} color={accentGreen} />
                              <Text style={[s.pollAddTextLabel, { color: accentGreen }]}>{i18nText("autoI18n.secenek_ekle", "Seçenek ekle")}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </>
                  )}

                  {/* ── LIST LAYOUT ── */}
                  {postType === "list" && (
                    <>
                      <TextInput
                        style={[s.listTextarea, { color: theme.text.primary, backgroundColor: theme.secondary, borderColor: theme.border }]}
                        placeholder={i18nText("autoI18n.liste_hakkinda_dusuncelerini_paylas", "Liste hakkında düşüncelerini paylaş...")}
                        placeholderTextColor={theme.text.muted}
                        value={content}
                        onChangeText={(text) => { setContent(text); setError(""); }}
                        multiline
                        textAlignVertical="top"
                        maxLength={MAX_CONTENT}
                      />
                      <Text style={[s.counterText, { color: theme.text.muted }, content.length >= MAX_CONTENT && { color: "#f04f4f" }]}>
                        {content.length}/{MAX_CONTENT}
                      </Text>

                      {/* Puan + Spoiler (liste için de) */}
                      <View style={s.listMetaRow}>
                        {userRating > 0 ? (
                          <TouchableOpacity
                            style={[s.miniStarBadgeInline, { backgroundColor: theme.secondary, borderColor: theme.border }]}
                            onPress={handleResetRate}
                            activeOpacity={0.8}
                          >
                            <Octicons name="star-fill" size={14} color="#FFD54F" />
                            <Text style={[s.miniStarText, { color: theme.text.primary }]}>{userRating} / 5</Text>
                          </TouchableOpacity>
                        ) : (
                          <StarRow rating={userRating} onRate={handleRate} theme={theme} />
                        )}
                        <TouchableOpacity
                          style={[s.spoilerBtn, { backgroundColor: theme.secondary, borderColor: theme.border },
                            hasSpoiler && { backgroundColor: "rgba(240,79,79,0.1)", borderColor: "rgba(240,79,79,0.4)" }]}
                          onPress={() => setHasSpoiler(!hasSpoiler)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name={hasSpoiler ? "warning" : "warning-outline"} size={14} color={hasSpoiler ? "#f04f4f" : theme.text.muted} />
                          <Text style={[s.spoilerText, { color: hasSpoiler ? "#f04f4f" : theme.text.muted }]}>
                            Spoiler
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={s.listSection}>
                        <Text style={[s.sectionLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.liste_icerikleri", "LİSTE İÇERİKLERİ")}</Text>

                        {/* Sıralı liste toggle (#1, #2...) */}
                        <TouchableOpacity
                          style={[s.rankedToggle, { borderColor: theme.border, backgroundColor: theme.secondary }, ranked && { borderColor: accentGreen, backgroundColor: `${accentGreen}14` }]}
                          onPress={() => setRanked((v) => !v)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name={ranked ? "podium" : "podium-outline"} size={16} color={ranked ? accentGreen : theme.text.secondary} />
                          <Text style={[s.rankedToggleText, { color: ranked ? accentGreen : theme.text.secondary }]}>
                            {i18nText("autoI18n.sirali_liste", "Sıralı liste (#1, #2...)")}
                          </Text>
                          <Ionicons name={ranked ? "checkmark-circle" : "ellipse-outline"} size={18} color={ranked ? accentGreen : theme.text.muted} />
                        </TouchableOpacity>

                        {/* Genre chips */}
                        {listGenres.length > 0 && (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
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
                              <View style={[s.stackCard1, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                                <Ionicons name="add" size={36} color={theme.text.muted} />
                                <Text style={[s.stackLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.icerik_sec", "İçerik Seç")}</Text>
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
                                  <View style={[s.rankBadge, { backgroundColor: accentGreen }]}>
                                    <Text style={s.rankBadgeText}>{idx + 1}</Text>
                                  </View>
                                ) : (
                                  <View style={[s.mediaTypeBadge, { backgroundColor: item.media_type === 'tv' ? (theme.colors?.orange || '#f5a623') : accentBlue }]}>
                                    <Text style={s.mediaTypeText}>{item.media_type === 'tv' ? 'Dizi' : 'Film'}</Text>
                                  </View>
                                )}
                                <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={s.listPosterOverlay}>
                                  <Text style={s.listPosterTitle} numberOfLines={2}>{item.title || item.name}</Text>
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
                                  <Ionicons name="close-circle" size={22} color="#f04f4f" />
                                </TouchableOpacity>
                              </View>
                            ))}
                            <TouchableOpacity
                              style={[s.addMoreBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
                              onPress={() => openSearch("movie")}
                            >
                              <Ionicons name="add" size={30} color={theme.text.muted} />
                              <Text style={[s.addMoreText, { color: theme.text.muted }]}>{i18nText("autoI18n.ekle", "Ekle")}</Text>
                            </TouchableOpacity>
                          </ScrollView>
                        )}
                      </View>
                    </>
                  )}

                  <View style={{ height: 16 }} />
                </ScrollView>
              </>
            )}

            {/* ══════════════════════════════════════════════
                ARAMA EKRANI
            ══════════════════════════════════════════════ */}
            {isSearchActive && (
              <View style={{ flex: 1 }}>
                {/* Search type seg */}
                <View style={[s.segmentedControlContainer, { backgroundColor: theme.secondary, marginTop: 16, marginBottom: 4 }]}>
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
                    <ActivityIndicator size="large" color={accentBlue} />
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
                  disabled={submitting}
                >
                  <LinearGradient
                    colors={shareGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[s.shareBtn, { shadowColor: currentAccent }, submitting && { opacity: 0.6 }]}
                  >
                    {submitting ? (
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
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Layout
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },

  // Drag
  dragWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 2 },
  dragPill: { width: 44, height: 5, borderRadius: 999, opacity: 0.35 },

  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  headerBtn: { padding: 6, minWidth: 52 },
  headerTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  cancelText: { fontSize: 15, fontWeight: "500" },
  headerRight: { flexDirection: "row", gap: 6, width: 72, justifyContent: "flex-end" },
  iconBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 0.5, alignItems: "center", justifyContent: "center" },

  // Segmented Control (orijinal tasarım)
  segmentedControlContainer: { flexDirection: "row", marginHorizontal: 16, marginTop: 16, marginBottom: 8, borderRadius: 12, padding: 4 },
  segmentedButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, gap: 6 },
  segmentedButtonActiveIndicator: { position: "absolute", top: 0, bottom: 0, width: "50%", borderRadius: 10, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  segmentedButtonText: { fontSize: 14 },

  // Error
  errorBox: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(240,79,79,0.1)", padding: 12, borderRadius: 12, marginBottom: 14, borderWidth: 0.5, borderColor: "rgba(240,79,79,0.35)", gap: 8 },
  errorText: { color: "#f04f4f", fontSize: 13, fontWeight: "600", flex: 1 },

  // Title input
  titleInput: { fontSize: 18, fontWeight: "700", paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 0.5, marginBottom: 14, letterSpacing: -0.3 },

  // Karakter sayacı (başlık + içerik)
  counterText: { alignSelf: "flex-end", fontSize: 11, fontWeight: "600", marginTop: -6, marginBottom: 8, marginRight: 2 },

  // Review layout
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  starPill: { flexDirection: "row", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 0.5 },
  spoilerBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 0.5 },
  spoilerText: { fontSize: 12, fontWeight: "700" },
  reviewRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  posterSlot: { width: 108, height: 160, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  posterSlotImg: { width: "100%", height: "100%" },
  posterSlotGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 40, alignItems: "center", justifyContent: "flex-end", paddingBottom: 6 },
  posterSlotLabel: { fontSize: 11, fontWeight: "600", marginTop: 5, letterSpacing: 0.2 },
  reviewTextarea: { flex: 1, minHeight: 160, borderRadius: 16, padding: 14, borderWidth: 0.5, fontSize: 15, lineHeight: 23 },
  miniStarBadge: { position: "absolute", top: 172, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 0.5 },
  miniStarText: { fontSize: 12, fontWeight: "700" },

  // List layout
  listTextarea: { fontSize: 15, minHeight: 95, lineHeight: 23, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 0.5, marginBottom: 14 },
  listMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  miniStarBadgeInline: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 0.5 },
  listSection: { marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 12 },
  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: 0.5, marginRight: 8 },
  chipText: { fontSize: 11, fontWeight: "700" },

  // Stacked empty cards
  stackWrapper: { alignItems: "flex-start", paddingLeft: 4, marginBottom: 10 },
  stackContainer: { width: 140, height: 165, position: "relative" },
  stackCard3: { position: "absolute", width: 84, height: 124, right: 0, top: 20, borderRadius: 12, borderWidth: 0.5, opacity: 0.35 },
  stackCard2: { position: "absolute", width: 96, height: 143, right: 8, top: 10, borderRadius: 12, borderWidth: 0.5, opacity: 0.65 },
  stackCard1: { position: "absolute", width: 108, height: 162, left: 0, top: 0, borderRadius: 16, borderWidth: 0.5, alignItems: "center", justifyContent: "center", zIndex: 3 },
  stackLabel: { fontSize: 11, fontWeight: "700", marginTop: 6, letterSpacing: 0.2 },

  // Poster scroll
  posterScroll: { paddingLeft: 4, paddingVertical: 8, gap: 10 },
  listPosterWrapper: { width: 100, height: 150, position: "relative" },
  listPosterImg: { width: "100%", height: "100%", borderRadius: 12 },
  listPosterOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 8, paddingTop: 20, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  listPosterTitle: { color: "#fff", fontSize: 10, fontWeight: "700", lineHeight: 13 },
  mediaTypeBadge: { position: "absolute", top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, zIndex: 4, opacity: 0.75 },
  mediaTypeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  removeBadge: { position: "absolute", top: -6, right: -6, backgroundColor: "#fff", borderRadius: 12, zIndex: 5 },
  addMoreBtn: { width: 100, height: 150, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4 },
  addMoreText: { fontSize: 11, fontWeight: "700" },

  // Search
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 10, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 16, borderWidth: 0.5 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  gridList: { paddingBottom: 100, paddingTop: 4 },
  gridRow: { paddingHorizontal: 16, marginBottom: 10, gap: 10 },
  gridItem: { flex: 1, aspectRatio: 2 / 3 },
  gridPoster: { flex: 1, borderRadius: 12, overflow: "hidden", borderWidth: 0.5, backgroundColor: "rgba(150,150,150,0.08)" },
  gridPosterImg: { width: "100%", height: "100%" },
  gridOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 8, paddingTop: 20 },
  gridTitle: { color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 14 },
  gridRatingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  gridRatingText: { color: "#FFD54F", fontSize: 10, fontWeight: "700" },
  emptySearch: { textAlign: "center", marginTop: 48, fontSize: 15 },

  // Drafts
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 21 },
  draftCard: { borderRadius: 20, borderWidth: 0.5, padding: 16, marginBottom: 12 },
  draftHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  draftAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  draftName: { fontSize: 14, fontWeight: "700" },
  draftTime: { fontSize: 11, marginTop: 2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 0.5 },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  draftReviewRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  draftMiniPoster: { width: 58, height: 88, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  draftMiniPosterImg: { width: "100%", height: "100%" },
  draftTitle: { fontSize: 14, fontWeight: "700", marginBottom: 3, lineHeight: 19 },
  draftContent: { fontSize: 13, lineHeight: 19 },
  draftThumb: { width: 50, height: 76, borderRadius: 8, overflow: "hidden" },
  draftThumbImg: { width: "100%", height: "100%" },
  draftThumbMore: { fontSize: 13, fontWeight: "700" },
  draftActions: { flexDirection: "row", gap: 8, borderTopWidth: 0.5, paddingTop: 12, marginTop: 8, alignItems: "center" },
  draftEditBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", borderWidth: 0.5, borderRadius: 10, paddingVertical: 9 },
  draftEditText: { fontSize: 13, fontWeight: "700" },
  draftDelBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 0.5, alignItems: "center", justifyContent: "center" },

  // Footer
  footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, borderRadius: 18, gap: 8, elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  shareBtnText: { fontWeight: "700", fontSize: 16, color: "#FFF" },

  // Sıralı liste
  rankedToggle: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 0.5, marginBottom: 14 },
  rankedToggleText: { flex: 1, fontSize: 13, fontWeight: "700" },
  rankBadge: { position: "absolute", top: 6, left: 6, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 8, alignItems: "center", justifyContent: "center", zIndex: 4 },
  rankBadgeText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  reorderRow: { position: "absolute", bottom: 6, alignSelf: "center", flexDirection: "row", gap: 6, zIndex: 5 },
  reorderBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },

  // Anket composer
  pollKindRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  pollKindBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1 },
  pollKindText: { fontSize: 13, fontWeight: "700" },
  pollTextRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pollTextInput: { flex: 1, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 0.5 },
  pollTextDel: { padding: 2 },
  pollAddText: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" },
  pollAddTextLabel: { fontSize: 13, fontWeight: "700" },
});
