// screens/tabs/profile/MyActivityScreen.js
//
// "Etkinliklerim" — kullanıcının tüm aktivitesi tek sayfada, sekmeli:
//   Puanlamalar | Yorumlar | Postlar | Taslaklar | Story | Etkileşimler
// Her satırda mümkünse tarih bilgisi gösterilir.
//
// Görsel dil: her sekmenin KENDİ rengi var (profildeki MyActivityButton kısayol
// hücreleriyle aynı) — aktif sekme başlıktaki ışığı ve boş durumu da o renge
// boyar. Satırlar yumuşak yüzeyli kartlar; post kartları Hub akışı ve
// Postlarım ile aynı dili (tip rengi, poster yığını) kullanır.
//
// Yoğunluk (11 Kas): bu sekmeler yüzlerce kayıt tutar → dikeyde kompakt.
//   • Puanlamalar + Etkileşimler: 2 sütunlu kutucuk ızgarası (RatingTile /
//     InteractionTile) — liste boyu yarıya iner.
//   • Yorumlar + Postlar/Taslaklar: tek sütun ama sıkı satır; düzenle/sil ve
//     beğeni/yorum sayıları ayrı alt şerit yerine üst meta satırında.

import { Image } from "expo-image";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Dimensions,
  Modal,
} from "react-native";
import LensLoader from "../../../components/LensLoader";
// Ekran kökü: Premium şeridi yüzerken üst boşluğu ona göre büyür.
import SafeAreaView from "@components/common/ScreenSafeAreaView";
import { LinearGradient } from "expo-linear-gradient";
import { getPostDrafts } from "../../../services/postDraftService";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import usePosterUri from "../../../hooks/usePosterUri";
import i18n from "../../../translations";
import { i18nText, percentText } from "@utils/i18nText";
import { intlLocaleOf } from "@utils/appLanguages";
import { postPreviewPosters, tallyVotes, tierListMediaOf } from "@utils/postComposer";
import { tierInkOf } from "@utils/tierList";
import { getTierListCopy } from "@utils/tierListCopy";
import {
  ACTIVITY_TAB_CONFIG,
  ALL,
  COMMENT_KIND_ORDER,
  DATE_RANGES,
  POST_TYPE_ORDER,
  SCORE_BUCKETS,
  applyActivityFilter,
  countActiveActivityFilters,
  emptyActivityFilter,
  presentValues,
} from "@utils/activityFilter";
import { getActivityFilterCopy } from "@utils/activityFilterCopy";
import { getListSortFilterCopy } from "@utils/listSortFilterCopy";
import ListSortFilterSheet from "@components/lists/ListSortFilterSheet";
import { getRatingColors } from "@utils/ratingColors";
import RatingStars from "@components/RatingStars";
import StaggerItem from "@components/StaggerItem";
import PosterStack from "@components/feed/PosterStack";
import { postTypeMeta } from "@components/feed/postTypeMeta";
import { ActivityListSkeleton } from "@components/Skeleton";
import { appAlert } from "@components/AppAlert";
import { toast } from "@components/AppToast";
import { subscribeToMyRatings } from "@services/ratingsService";
import {
  subscribeToMyComments,
  subscribeToMyLikes,
  subscribeToMyBookmarks,
} from "@services/activityService";
import {
  fetchUserPosts,
  toggleLike,
  toggleBookmark,
  deleteComment,
  editPostComment,
} from "@services/postsService";
import { StoryDraftService } from "@services/StoryDraftService";
import { readCache, writeCache } from "@utils/cachedRead";
import { cacheKeys } from "@utils/cacheKeys";
import useKeyboardInset from "@hooks/useKeyboardInset";
import { scopeShort } from "@components/comments/scopeTexts";
import { normalizeScope, scopeKey } from "@utils/commentScope";
import ScreenDecor from "@components/ScreenDecor";
import { alpha } from "../../../theme/colors";
import { isLightSurface } from "@utils/colorUtils";
import BackButton from "@components/BackButton";

import ModalToastHost from "@components/toast/ModalToastHost";
import GlassTouchable from "../../../components/common/GlassTouchable";
import GlassTextInput from "../../../components/common/GlassTextInput";
// ─── Tarih yardımcıları ──────────────────────────────────────────────────────
const toMs = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v.seconds) return v.seconds * 1000;
  return 0;
};
const fmtDate = (v) => {
  const ms = toMs(v);
  if (!ms) return "";
  const d = new Date(ms);
  const now = Date.now();
  const diff = now - ms;
  const day = 86400000;
  if (diff < day && d.getDate() === new Date(now).getDate())
    return i18nText("autoI18n.bugun", "Bugün");
  if (diff < 2 * day) return i18nText("autoI18n.dun", "Dün");
  // Argümansız toLocaleDateString cihaz dilini kullanır (Türkçe telefonda "2.11.2026").
  return d.toLocaleDateString(intlLocaleOf(i18n.language));
};

const TABS = [
  { key: "ratings", label: "Puanlamalar", icon: "star" },
  { key: "comments", label: "Yorumlar", icon: "chatbubble-ellipses" },
  { key: "posts", label: "Postlar", icon: "newspaper" },
  { key: "drafts", label: "Taslaklar", icon: "document-text" },
  { key: "story", label: "Story", icon: "images" },
  { key: "interactions", label: "Etkileşimler", icon: "heart" },
];

const TAB_LABEL_KEY = {
  ratings: "autoI18n.puanlamalar",
  comments: "autoI18n.yorumlar",
  posts: "autoI18n.postlar",
  drafts: "autoI18n.taslaklar",
  story: "autoI18n.story",
  interactions: "autoI18n.etkilesimler",
};

// Sekme renkleri profildeki MyActivityButton kısayol hücreleriyle AYNI.
const tabColor = (key, theme) =>
  ({
    ratings: theme.colors?.orange || "#F97316",
    comments: theme.colors?.green || "#22C55E",
    posts: theme.colors?.blue || "#3B82F6",
    drafts: theme.colors?.purple || "#A855F7",
    story: "#EC4899",
    interactions: theme.colors?.red || "#EF4444",
  })[key] || theme.accent;

// Tür → renk/etiket/ikon (label render sırasında i18nText ile çevrilir)
const KIND_META = {
  movie: { labelKey: "autoI18n.kind_film", label: "FİLM", color: "#138DF0", icon: "film" },
  tv: { labelKey: "autoI18n.kind_dizi", label: "DİZİ", color: "#8b5cf6", icon: "tv" },
  post: { labelKey: "autoI18n.kind_post", label: "POST", color: "#22C55E", icon: "newspaper" },
  list: { labelKey: "autoI18n.kind_liste", label: "LİSTE", color: "#FF7C25", icon: "list" },
  story: { labelKey: "autoI18n.kind_story", label: "STORY", color: "#EC4899", icon: "images" },
  like: { labelKey: "autoI18n.kind_begeni", label: "BEĞENİ", color: "#FF3B6B", icon: "heart" },
  bookmark: { labelKey: "autoI18n.kind_kayit", label: "KAYIT", color: "#138DF0", icon: "bookmark" },
};

const LIKE_RED = "#FF5A5F";
const SPOILER_RED = "#f04f4f";

// Puan tonu (1–10): her tam puan kademesinin KENDİ rengi. Kademe = puanın tam kısmı
// (8.5 → 8), 1–10 arasına kıstırılır.
//   • 1–9 tek yönlü, sezgisel rampa: kırmızı (kötü) → turuncu → sarı (orta) → yeşil (iyi)
//     → koyu zümrüt (çok iyi). Mavi/mor gibi "puan" anlamı taşımayan tonlar yok.
//   • 10 = başyapıt: rampanın dışında, DOLU altın rozet (koyu yazı) — 9'la karışmaz.
//   • İki tema için ayrı ton: koyu yüzeyde açık tonlar, açık yüzeyde koyu tonlar. 11 Kas'ta
//     theme/colors.js'teki 11 tema yüzeyinin hepsinde (rozet zemini dahil) ≥3.1:1 kontrast ölçüldü;
//     10'un altın rozetinde koyu yazı 9.4:1.
const SCORE_TONES_ON_DARK = [
  "#F43F5E", // 1 gül kırmızısı
  "#F87171", // 2 kırmızı
  "#FB923C", // 3 turuncu
  "#FBBF24", // 4 amber
  "#FDE047", // 5 sarı
  "#BEF264", // 6 limon
  "#86EFAC", // 7 açık yeşil
  "#4ADE80", // 8 yeşil
  "#34D399", // 9 zümrüt
];
const SCORE_TONES_ON_LIGHT = [
  "#9F1239", // 1
  "#C81E1E", // 2
  "#C2410C", // 3
  "#A85A04", // 4
  "#8A6A00", // 5
  "#4D7C0F", // 6
  "#15803D", // 7
  "#0F6B3A", // 8
  "#065F46", // 9
];
const SCORE_GOLD = "#F5B301";
const scoreStep = (score) => Math.min(10, Math.max(1, Math.floor(Number(score) || 0)));
const scoreTone = (score, onLight) => {
  const step = scoreStep(score);
  if (step === 10) return SCORE_GOLD;
  return (onLight ? SCORE_TONES_ON_LIGHT : SCORE_TONES_ON_DARK)[step - 1];
};

const STORY_COLS = 3;
const STORY_GRID_PAD = 16;
const STORY_GRID_GAP = 10;
const STORY_ITEM_W =
  (Dimensions.get("window").width -
    STORY_GRID_PAD * 2 -
    STORY_GRID_GAP * (STORY_COLS - 1)) /
  STORY_COLS;
const STORY_ITEM_H = (STORY_ITEM_W * 16) / 9;

// Puanlamalar + Etkileşimler: 2 sütunlu kutucuk ızgarası. Genişlik sabit (flex:1
// değil) — tek kalan son kutucuk tüm satıra yayılmasın.
const PAIR_COLS = 2;
const PAIR_PAD = 16;
const PAIR_GAP = 10;
const PAIR_ITEM_W = (Dimensions.get("window").width - PAIR_PAD * 2 - PAIR_GAP) / PAIR_COLS;
const isPairTab = (key) => key === "ratings" || key === "interactions";

// Arama + süzgeç (utils/activityFilter.js): sekme başına ayrı durum; dokunulmamış sekme bunu kullanır.
const DEFAULT_FILTER = Object.freeze(emptyActivityFilter());
// Sıralama karolarının Feather simgeleri (sayfa kabuğu Feather çizer).
const SORT_ICONS = { date: "calendar", score: "star", name: "type", likes: "heart", comments: "message-circle" };

export default function MyActivityScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { getTmdbUrl } = useImageQualitySettings();
  const posterUri = usePosterUri();
  const uid = user?.uid;

  const requestedInitialTab = TABS.some((item) => item.key === route?.params?.initialTab)
    ? route.params.initialTab
    : "ratings";
  const [tab, setTab] = useState(requestedInitialTab);

  // Profil kartındaki kategori kısayolları ekranı doğrudan ilgili sekmede açar.
  useEffect(() => {
    if (TABS.some((item) => item.key === route?.params?.initialTab)) {
      setTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  // Sekme şeridi yatay kaydırılıyor: aktif sekme (ör. kısayoldan açılan
  // "Etkileşimler") ekran dışında kalmasın diye görünür alana getirilir.
  const tabScrollRef = useRef(null);
  const tabX = useRef({});
  const scrollTabIntoView = useCallback((key, animated) => {
    const x = tabX.current[key];
    if (x == null) return;
    tabScrollRef.current?.scrollTo({ x: Math.max(0, x - 48), animated });
  }, []);
  useEffect(() => {
    scrollTabIntoView(tab, true);
  }, [tab, scrollTabIntoView]);

  const [ratings, setRatings] = useState([]);
  const [comments, setComments] = useState([]);
  const [posts, setPosts] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [storyDrafts, setStoryDrafts] = useState([]);
  const [likes, setLikes] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1) İlk açılışta cache'ten anında hidrasyon (offline-first)
  useEffect(() => {
    if (!uid) return;
    const cached = readCache(...cacheKeys.activity(uid));
    if (cached) {
      setRatings(cached.ratings || []);
      setComments(cached.comments || []);
      setLikes(cached.likes || []);
      setBookmarks(cached.bookmarks || []);
      setPosts(cached.posts || []);
      setLoading(false); // cache varsa boş ekran gösterme
    }
  }, [uid]);

  // 2) Firestore canlı kaynaklar
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    const unsubs = [
      subscribeToMyRatings(uid, setRatings),
      subscribeToMyComments(uid, setComments),
      subscribeToMyLikes(uid, setLikes),
      subscribeToMyBookmarks(uid, setBookmarks),
    ];
    fetchUserPosts(uid)
      .then((res) => setPosts(res.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  // 3) Veri değiştikçe cache'e yaz (Settings → Önbellek burada görünür).
  //    Yalnız anlamlı veri varken yaz; debounce ile.
  useEffect(() => {
    if (!uid || loading) return;
    const id = setTimeout(() => {
      writeCache(...cacheKeys.activity(uid), {
        ratings,
        comments,
        likes,
        bookmarks,
        posts,
      });
    }, 600);
    return () => clearTimeout(id);
  }, [uid, loading, ratings, comments, likes, bookmarks, posts]);

  // Yerel (cihaz) kaynaklar — sayfa odaklandığında tazele
  const loadLocal = useCallback(async () => {
    setDrafts(getPostDrafts());
    try {
      setStoryDrafts(await StoryDraftService.getDrafts());
    } catch {
      setStoryDrafts([]);
    }
  }, []);
  useEffect(() => {
    const unsub = navigation.addListener("focus", loadLocal);
    loadLocal();
    return unsub;
  }, [navigation, loadLocal]);

  const counts = {
    ratings: ratings.length,
    comments: comments.length,
    posts: posts.length,
    drafts: drafts.length,
    story: storyDrafts.length,
    interactions: likes.length + bookmarks.length,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const interactions = useMemo(() => {
    const l = likes.map((x) => ({ ...x, _kind: "like", _ts: x.likedAt }));
    const b = bookmarks.map((x) => ({ ...x, _kind: "bookmark", _ts: x.bookmarkedAt }));
    return [...l, ...b].sort((a, b2) => toMs(b2._ts) - toMs(a._ts));
  }, [likes, bookmarks]);

  const openMedia = useCallback(
    (mediaType, id, params) => {
      navigation.navigate(mediaType === "movie" ? "MovieDetails" : "TvShowsDetails", {
        id,
        ...(params || {}),
      });
    },
    [navigation],
  );

  // "Yorumlarım" satırı → içeriğin yorum sayfasını doğrudan aç. Dizide yorum
  // bir sezona/bölüme referans veriyorsa sayfa o kapsamda süzülü açılır
  // (components/Comment.js#initialScope) — kullanıcı kendi yorumunu aramasın.
  const openMediaComment = useCallback(
    (item) => {
      const scope = normalizeScope(item);
      openMedia(item.kind, item.targetId, {
        openComments: true,
        ...(item.kind === "tv" && scopeKey(scope) !== "show"
          ? { commentScope: scope }
          : {}),
      });
    },
    [openMedia],
  );

  // ── Etkileşim kaldır (beğeni / kayıt) ──
  // item.id = postId, item._kind = "like" | "bookmark". Canlı snapshot listeyi
  // otomatik günceller; ekstra state tutmaya gerek yok.
  const removeInteraction = useCallback(
    (item) => {
      if (!uid) return;
      const isLike = item._kind === "like";
      const name = item.postTitle || i18nText("autoI18n.gonderi", "Gönderi");
      appAlert(
        isLike
          ? i18nText("autoI18n.begeniyi_kaldir", "Beğeniyi kaldır")
          : i18nText("autoI18n.kaydi_kaldir", "Kaydı kaldır"),
        isLike
          ? i18nText("autoI18n.x_begenisi_kaldir_onay", '"{{name}}" gönderisinin beğenisini kaldırmak istiyor musun?', { name })
          : i18nText("autoI18n.x_kaydi_kaldir_onay", '"{{name}}" gönderisini kayıtlardan kaldırmak istiyor musun?', { name }),
        [
          { text: i18nText("autoI18n.vazgec", "Vazgeç"), style: "cancel" },
          {
            text: i18nText("autoI18n.kaldir", "Kaldır"),
            style: "destructive",
            onPress: async () => {
              try {
                if (isLike) await toggleLike(item.id, uid, true);
                else await toggleBookmark(item.id, uid, true);
                toast.success(
                  isLike
                    ? i18nText("autoI18n.begeni_kaldirildi", "Beğeni kaldırıldı")
                    : i18nText("autoI18n.kayit_kaldirildi", "Kayıt kaldırıldı"),
                );
              } catch (e) {
                toast.error(i18nText("autoI18n.islem_basarisiz", "İşlem başarısız"), e?.message);
              }
            },
          },
        ],
      );
    },
    [uid],
  );

  // ── Post yorumu sil ──
  const removeComment = useCallback(
    (item) => {
      if (!uid) return;
      appAlert(
        i18nText("autoI18n.yorumu_sil", "Yorumu sil"),
        i18nText("autoI18n.yorumu_sil_onay", "Bu yorumu kalıcı olarak silmek istiyor musun?"),
        [
          { text: i18nText("autoI18n.vazgec", "Vazgeç"), style: "cancel" },
          {
            text: i18nText("autoI18n.sil", "Sil"),
            style: "destructive",
            onPress: async () => {
              try {
                await deleteComment(item.targetId, item.id, uid);
                toast.success(i18nText("autoI18n.yorum_silindi", "Yorum silindi"));
              } catch (e) {
                toast.error(i18nText("autoI18n.silinemedi", "Silinemedi"), e?.message);
              }
            },
          },
        ],
      );
    },
    [uid],
  );

  // ── Post yorumu düzenle (modal) ──
  const [editing, setEditing] = useState(null); // myComments item | null
  // Düzenleme kartı ortalanmış; klavye açılınca KeyboardAvoidingView Android modal
  // penceresinde güvenilir değil — kaplayıcının alt boşluğu ölçümle verilir.
  const { animatedInset: editKeyboardInset, onLayout: onEditLayout } = useKeyboardInset(!!editing);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  const openEdit = useCallback((item) => {
    setEditing(item);
    setEditText(item.text || "");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editing) return;
    const t = editText.trim();
    if (!t) {
      toast.warning(i18nText("autoI18n.yorum_bos_olamaz", "Yorum boş olamaz"));
      return;
    }
    if (t === (editing.text || "").trim()) {
      setEditing(null);
      return;
    }
    setSaving(true);
    try {
      await editPostComment(editing.targetId, editing.id, uid, t);
      toast.success(i18nText("autoI18n.yorum_guncellendi", "Yorum güncellendi"));
      setEditing(null);
    } catch (e) {
      toast.error(i18nText("autoI18n.guncellenemedi", "Güncellenemedi"), e?.message);
    } finally {
      setSaving(false);
    }
  }, [editing, editText, uid]);

  const data =
    tab === "ratings"
      ? ratings
      : tab === "comments"
      ? comments
      : tab === "posts"
      ? posts
      : tab === "drafts"
      ? drafts
      : tab === "story"
      ? storyDrafts
      : interactions;

  // ── Arama + süzgeç + sıralama (sekme başına ayrı; sekme değişince korunur) ──
  const [filters, setFilters] = useState({});
  const [filterOpen, setFilterOpen] = useState(false);
  const filterState = filters[tab] || DEFAULT_FILTER;
  const updateFilter = useCallback(
    (patch) => setFilters((prev) => ({ ...prev, [tab]: { ...(prev[tab] || DEFAULT_FILTER), ...patch } })),
    [tab],
  );
  const resetFilter = useCallback(
    () => setFilters((prev) => ({ ...prev, [tab]: { ...DEFAULT_FILTER, query: (prev[tab] || DEFAULT_FILTER).query } })),
    [tab],
  );
  const clearAll = useCallback(() => setFilters((prev) => ({ ...prev, [tab]: DEFAULT_FILTER })), [tab]);
  const shown = useMemo(() => applyActivityFilter(tab, data, filterState), [tab, data, filterState]);
  const activeFilterCount = countActiveActivityFilters(tab, filterState);

  const fc = getActivityFilterCopy(i18n.language);
  const sheetCopy = getListSortFilterCopy(i18n.language);
  const tabConfig = ACTIVITY_TAB_CONFIG[tab];
  const optionList = (keys, labels) => [
    { key: ALL, label: fc.all },
    ...keys.map((key) => ({ key, label: labels?.[key] || key })),
  ];
  const filterSections = tabConfig.filters
    .map((id) => {
      if (id === "kind") {
        const keys = tab === "ratings" ? ["movie", "tv"] : presentValues(tab, data, "kind", COMMENT_KIND_ORDER);
        if (keys.length < 2 && filterState.kind === ALL) return null;
        return { id, kind: "segment", title: fc.sections.kind, options: optionList(keys, fc.kinds), value: filterState.kind, onChange: (v) => updateFilter({ kind: v }) };
      }
      if (id === "score") {
        return { id, kind: "chips", title: fc.sections.score, options: optionList(SCORE_BUCKETS, fc.scores), value: filterState.score, onChange: (v) => updateFilter({ score: v }) };
      }
      if (id === "postType") {
        const keys = presentValues(tab, data, "postType", POST_TYPE_ORDER);
        if (keys.length < 2 && filterState.postType === ALL) return null;
        return { id, kind: "chips", title: fc.sections.postType, options: optionList(keys, fc.postTypes), value: filterState.postType, onChange: (v) => updateFilter({ postType: v }) };
      }
      if (id === "action") {
        return { id, kind: "segment", title: fc.sections.action, options: optionList(["like", "bookmark"], fc.actions), value: filterState.action, onChange: (v) => updateFilter({ action: v }) };
      }
      return { id, kind: "chips", title: fc.sections.date, options: optionList(DATE_RANGES, fc.dates), value: filterState.date, onChange: (v) => updateFilter({ date: v }) };
    })
    .filter(Boolean);
  const sortConfig = {
    value: filterState.sort.key,
    dir: filterState.sort.dir,
    supportsDir: true,
    options: tabConfig.sorts.map((key) => ({ key, label: fc.sorts[key], icon: SORT_ICONS[key] })),
    onChange: (next) => updateFilter({ sort: { key: next.key, dir: next.dir } }),
  };

  const renderItem = ({ item, index }) => {
    let node;
    switch (tab) {
      case "ratings":
        node = (
          <RatingTile
            theme={theme}
            poster={posterUri(item.mediaType, item.mediaId, item.poster)}
            kind={item.mediaType}
            title={item.title}
            date={item.updatedAt}
            score={Number(item.rating || 0)}
            onPress={() => openMedia(item.mediaType, item.mediaId)}
          />
        );
        break;
      case "comments":
        node = (
          <Row
            theme={theme}
            poster={item.poster || null}
            kind={item.kind}
            title={item.title || (item.kind === "post" ? i18nText("autoI18n.gonderi", "Gönderi") : "")}
            subtitle={item.text}
            // Dizi yorumu bir sezona/bölüme referans veriyorsa rozetle göster
            // (components/Comment.js mirror'a kapsam alanlarını da yazar).
            badge={
              item.kind === "tv" && item.scopeKey && item.scopeKey !== "show"
                ? scopeShort(item)
                : undefined
            }
            date={item.createdAt}
            onPress={item.kind === "post" ? undefined : () => openMediaComment(item)}
            onEdit={item.kind === "post" ? () => openEdit(item) : undefined}
            onDelete={item.kind === "post" ? () => removeComment(item) : undefined}
          />
        );
        break;
      case "posts": {
        // Medya anketinde yığın, mediaList yerine seçenek posterlerinden kurulur.
        const pollPosters =
          item.type === "poll" && item.poll?.type === "media"
            ? (item.poll.options || [])
                .map((o) => o?.media?.poster_path)
                .filter(Boolean)
                .slice(0, 3)
                .map((p) => getTmdbUrl(p, "poster", 200))
            : [];
        const mediaPosters = postPreviewPosters(item);
        node = (
          <PostMini
            theme={theme}
            type={item.type}
            poll={item.poll}
            posters={pollPosters.length > 0 ? pollPosters : mediaPosters}
            title={item.title}
            content={item.content}
            userRating={item.userRating}
            hasSpoiler={item.hasSpoiler}
            tierList={item.type === "tierlist" ? item.tierList : null}
            tvGraph={item.type === "tvgraph" ? item.tvGraph : null}
            date={item._createdAtMs}
            likes={item.likesCount}
            comments={item.commentsCount}
            onPress={() => navigation.navigate("PostDetailScreen", { postId: item.id })}
          />
        );
        break;
      }
      case "drafts": {
        // Tier list taslağının yapımları tablodadır (selectedMedia boş); diğerleri seçili yapımlardan.
        const draftMedia =
          item.postType === "tierlist" ? tierListMediaOf(item.tierList) : item.selectedMedia || [];
        const posters = draftMedia
          .map((m) => m?.poster || (m?.poster_path ? getTmdbUrl(m.poster_path, "poster", 300) : null))
          .filter(Boolean);
        node = (
          <PostMini
            theme={theme}
            type={item.postType}
            posters={posters}
            title={item.title || i18nText("autoI18n.basliksiz_taslak", "Başlıksız taslak")}
            content={item.content}
            userRating={item.userRating}
            hasSpoiler={item.hasSpoiler}
            tierList={item.postType === "tierlist" ? item.tierList : null}
            tvGraph={item.postType === "tvgraph" ? item.tvGraph : null}
            date={item.createdAt}
            draft
          />
        );
        break;
      }
      case "story":
        node = (
          <StoryMini
            theme={theme}
            thumbnail={item.thumbnailUri || item.thumbnail || null}
            name={item.name || item.title || i18nText("autoI18n.story_taslagi", "Story taslağı")}
            date={item.updatedAt || item.createdAt}
            onPress={() =>
              navigation.navigate("StoryShareScreen", {
                ...(item.params || {}),
                draftId: item.id,
              })
            }
          />
        );
        break;
      case "interactions":
      default:
        node = (
          <InteractionTile
            theme={theme}
            type={item.postType}
            poster={item.postPoster || null}
            title={item.postTitle || i18nText("autoI18n.gonderi", "Gönderi")}
            author={item.postAuthorName || null}
            date={item._ts}
            action={item._kind === "like" ? "like" : "bookmark"}
            onPress={() => navigation.navigate("PostDetailScreen", { postId: item.id })}
            onRemove={() => removeInteraction(item)}
          />
        );
        break;
    }
    return (
      <StaggerItem index={index} style={isPairTab(tab) ? st.pairCell : undefined}>
        {node}
      </StaggerItem>
    );
  };

  const activeTab = TABS.find((tb) => tb.key === tab) || TABS[0];
  const activeColor = tabColor(activeTab.key, theme);

  return (
    <SafeAreaView style={[st.container, { backgroundColor: theme.primary }]} edges={["top"]}>
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor scope="profile" iconOpacity={0.25} />
      {/* ── Aktif sekmenin rengiyle başlık ışığı ── */}
      <LinearGradient
        colors={[alpha(activeColor, 0.2), alpha(activeColor, 0)]}
        style={st.headerGlow}
        pointerEvents="none"
      />
      <View style={st.header}>
        <BackButton absolute={false} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <Text style={[st.headerTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {i18nText("autoI18n.etkinliklerim", "Etkinliklerim")}
          </Text>
          <Text style={[st.headerSub, { color: theme.text.muted }]} numberOfLines={1}>
            {i18nText("autoI18n.n_etkinlik", "{{n}} etkinlik", { n: total })}
          </Text>
        </View>
        <LinearGradient
          colors={[activeColor, alpha(activeColor, 0.7)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={st.headerBadge}
        >
          <Ionicons name="sparkles" size={18} color="#fff" />
        </LinearGradient>
      </View>

      {/* ── Sekmeler ── */}
      <ScrollView
        ref={tabScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.tabRow}
        // Yatay ScrollView'ın varsayılanı flexShrink:1 — alttaki içerik yer isteyince (klavye açık,
        // "sonuç yok" görünümü, küçük ekran) şerit eziliyor ve arama çubuğu çiplerin üstüne biniyordu.
        style={st.tabScroll}
        keyboardShouldPersistTaps="handled"
      >
        {TABS.map((tb) => {
          const active = tab === tb.key;
          const color = tabColor(tb.key, theme);
          return (
            <GlassTouchable
              key={tb.key}
              onPress={() => setTab(tb.key)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onLayout={(e) => {
                tabX.current[tb.key] = e.nativeEvent.layout.x;
                if (tb.key === tab) scrollTabIntoView(tb.key, false);
              }}
              style={[
                st.tabChip,
                active
                  ? { backgroundColor: alpha(color, 0.16), borderColor: alpha(color, 0.6) }
                  : { backgroundColor: theme.secondary, borderColor: theme.border },
              ]}
            >
              <View style={[st.tabIcon, { backgroundColor: active ? color : alpha(color, 0.14) }]}>
                <Ionicons name={tb.icon} size={12} color={active ? "#fff" : color} />
              </View>
              <Text
                allowFontScaling={false}
                style={[
                  st.tabText,
                  {
                    color: active ? theme.text.primary : theme.text.secondary,
                    fontWeight: active ? "800" : "700",
                  },
                ]}
              >
                {i18nText(TAB_LABEL_KEY[tb.key], tb.label)}
              </Text>
              {counts[tb.key] > 0 && (
                <View style={[st.tabBadge, { backgroundColor: active ? color : theme.primary }]}>
                  <Text style={[st.tabBadgeText, { color: active ? "#fff" : theme.text.muted }]}>
                    {counts[tb.key]}
                  </Text>
                </View>
              )}
            </GlassTouchable>
          );
        })}
      </ScrollView>

      {/* ── Arama + filtre çubuğu (sekmede kayıt varken) ── */}
      {!loading && data.length > 0 ? (
        <View style={st.filterBar}>
          <View style={st.searchWrap}>
            <GlassTextInput
              value={filterState.query}
              onChangeText={(text) => updateFilter({ query: text })}
              placeholder={fc.search}
              placeholderTextColor={theme.text.muted}
              returnKeyType="search"
              autoCorrect={false}
              style={[
                st.searchInput,
                { backgroundColor: theme.secondary, borderColor: theme.border, color: theme.text.primary },
              ]}
            />
            <View style={st.searchIcon} pointerEvents="none">
              <Ionicons name="search" size={15} color={theme.text.muted} />
            </View>
            {filterState.query ? (
              <TouchableOpacity
                onPress={() => updateFilter({ query: "" })}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={sheetCopy.reset}
                style={st.searchClear}
              >
                <Ionicons name="close-circle" size={17} color={theme.text.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <GlassTouchable
            onPress={() => setFilterOpen(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={activeFilterCount > 0 ? `${fc.filter} · ${activeFilterCount}` : fc.filter}
            style={[
              st.filterBtn,
              activeFilterCount > 0
                ? { backgroundColor: alpha(activeColor, 0.16), borderColor: alpha(activeColor, 0.6) }
                : { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <Ionicons name="options-outline" size={17} color={activeFilterCount > 0 ? activeColor : theme.text.secondary} />
            {activeFilterCount > 0 ? (
              <View style={[st.filterBadge, { backgroundColor: activeColor, borderColor: theme.primary }]}>
                <Text allowFontScaling={false} style={st.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </GlassTouchable>
        </View>
      ) : null}

      {loading ? (
        <ActivityListSkeleton count={6} />
      ) : data.length > 0 && shown.length === 0 ? (
        <View style={st.center}>
          <View style={[st.emptyCircle, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <Ionicons name="search" size={32} color={activeColor} />
          </View>
          <Text style={[st.emptyText, { color: theme.text.primary }]}>{fc.noMatch}</Text>
          <GlassTouchable
            onPress={clearAll}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={[st.emptyChip, { backgroundColor: alpha(activeColor, 0.12), borderColor: alpha(activeColor, 0.35) }]}
          >
            <Ionicons name="refresh" size={12} color={activeColor} />
            <Text style={[st.emptyChipText, { color: activeColor }]}>{fc.clear}</Text>
          </GlassTouchable>
        </View>
      ) : data.length === 0 ? (
        <View style={st.center}>
          <View
            style={[
              st.emptyHalo,
              { backgroundColor: alpha(activeColor, 0.1), borderColor: alpha(activeColor, 0.24) },
            ]}
          >
            <View style={[st.emptyCircle, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <Ionicons name={activeTab.icon} size={36} color={activeColor} />
            </View>
          </View>
          <Text style={[st.emptyText, { color: theme.text.primary }]}>
            {i18nText("autoI18n.bu_bolumde_henuz_kayit_yok", "Bu bölümde henüz kayıt yok")}
          </Text>
          <View
            style={[
              st.emptyChip,
              { backgroundColor: alpha(activeColor, 0.12), borderColor: alpha(activeColor, 0.35) },
            ]}
          >
            <Ionicons name={activeTab.icon} size={12} color={activeColor} />
            <Text style={[st.emptyChipText, { color: activeColor }]}>
              {i18nText(TAB_LABEL_KEY[activeTab.key], activeTab.label)}
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          // numColumns değişince FlatList yeniden kurulmalı → düzen başına ayrı key.
          key={tab === "story" ? "story-grid" : isPairTab(tab) ? "pair-grid" : "activity-list"}
          data={shown}
          // flex:1 (basis 0): liste kalan alanı doldurur; içerik boyuyla üstteki şeritleri sıkıştırmaz.
          style={st.listFill}
          keyExtractor={(it, i) => `${tab}-${it._kind || ""}-${it.id || i}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={renderItem}
          numColumns={tab === "story" ? STORY_COLS : isPairTab(tab) ? PAIR_COLS : 1}
          columnWrapperStyle={
            tab === "story" ? st.storyGridRow : isPairTab(tab) ? st.pairGridRow : undefined
          }
          contentContainerStyle={
            tab === "story"
              ? st.storyGridList
              : isPairTab(tab)
              ? st.pairGridList
              : st.list
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Yorum düzenleme modalı ── */}
      <Modal
        visible={!!editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <Animated.View
          style={[st.editBackdrop, { paddingBottom: Animated.add(24, editKeyboardInset) }]}
          onLayout={onEditLayout}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => !saving && setEditing(null)}
          />
          <View style={[st.editCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <View style={st.editHeader}>
              <View style={[st.editIcon, { backgroundColor: alpha(theme.accent, 0.16) }]}>
                <Ionicons name="create-outline" size={19} color={theme.accent} />
              </View>
              <Text style={[st.editTitle, { color: theme.text.primary }]} numberOfLines={1}>
                {i18nText("autoI18n.yorumu_duzenle", "Yorumu düzenle")}
              </Text>
              <Text style={[st.editCounter, { color: editText.length >= 500 ? "#EF4444" : theme.text.muted }]}>
                {editText.length}/500
              </Text>
            </View>
            <GlassTextInput
              value={editText}
              onChangeText={setEditText}
              maxLength={500}
              multiline
              autoFocus
              placeholder={i18nText("autoI18n.yorumunu_yaz", "Yorumunu yaz…")}
              placeholderTextColor={theme.text.muted}
              style={[
                st.editInput,
                { backgroundColor: theme.primary, borderColor: theme.border, color: theme.text.primary },
              ]}
            />
            <View style={st.editActions}>
              <GlassTouchable
                onPress={() => setEditing(null)}
                disabled={saving}
                activeOpacity={0.85}
                style={[st.editBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
              >
                <Text style={[st.editBtnText, { color: theme.text.secondary }]}>
                  {i18nText("autoI18n.vazgec", "Vazgeç")}
                </Text>
              </GlassTouchable>
              <TouchableOpacity
                onPress={saveEdit}
                disabled={saving}
                activeOpacity={0.85}
                style={{ flex: 1, opacity: saving ? 0.7 : 1 }}
              >
                <LinearGradient
                  colors={[theme.accent, alpha(theme.accent, 0.75)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[st.editBtn, { borderColor: theme.accent }]}
                >
                  {saving ? (
                    <LensLoader tone="mono" size="small" color="#fff" />
                  ) : (
                    <Text style={[st.editBtnText, { color: "#fff" }]}>
                      {i18nText("autoI18n.kaydet", "Kaydet")}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
        <ModalToastHost visible={!!editing} />
      </Modal>

      {/* ── Sırala ve filtrele (liste ekranlarıyla ortak sayfa; görünüm kartı yok) ── */}
      <ListSortFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        theme={theme}
        accent={activeColor}
        copy={sheetCopy}
        resultCount={shown.length}
        activeCount={activeFilterCount}
        onReset={resetFilter}
        sort={sortConfig}
        sections={filterSections}
      />
    </SafeAreaView>
  );
}

// ─── Kutucuk posteri (2 sütunlu ızgara) ─────────────────────────────────────
// Poster (yoksa renkli ikon kutusu) + sol alt köşede tür/aksiyon noktası.
function TilePoster({ theme, uri, color, icon, dotColor, dotIcon }) {
  return (
    <View style={st.tilePosterWrap}>
      {uri ? (
        <Image source={{ uri }} style={st.tilePoster} contentFit="cover" cachePolicy="memory-disk" transition={150} />
      ) : (
        <LinearGradient
          colors={[alpha(color, 0.24), alpha(color, 0.08)]}
          style={[st.tilePoster, st.tilePosterEmpty, { borderColor: alpha(color, 0.3) }]}
        >
          <Ionicons name={icon} size={18} color={color} />
        </LinearGradient>
      )}
      <View style={[st.tileDot, { backgroundColor: dotColor || color, borderColor: theme.secondary }]}>
        <Ionicons name={dotIcon || icon} size={8} color="#fff" />
      </View>
    </View>
  );
}

// ─── Puanlama kutucuğu (2 sütun) ────────────────────────────────────────────
// [poster • tür noktası] [başlık (2 satır) / ★ puan hapı · tarih]
function RatingTile({ theme, poster, kind, title, date, score, onPress }) {
  const km = KIND_META[kind] || { color: theme.accent, icon: "ellipse" };
  const onLight = isLightSurface(theme.secondary);
  const tone = scoreTone(score, onLight);
  // 10: dolu altın rozet + koyu yazı; diğerleri tonlu zemin + ton renginde yazı.
  const perfect = scoreStep(score) === 10;
  const chipStyle = perfect
    ? { backgroundColor: SCORE_GOLD, borderColor: SCORE_GOLD }
    : { backgroundColor: alpha(tone, onLight ? 0.1 : 0.14), borderColor: alpha(tone, 0.4) };
  const chipInk = perfect ? "#1A1A1A" : tone;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[st.tile, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <LinearGradient
        colors={[alpha(tone, 0.12), alpha(tone, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={st.rowWash}
        pointerEvents="none"
      />
      <TilePoster theme={theme} uri={poster} color={km.color} icon={km.icon} />
      <View style={st.tileInfo}>
        <Text style={[st.tileTitle, { color: theme.text.primary }]} numberOfLines={2}>
          {title}
        </Text>
        <View style={st.tileBottom}>
          <View style={[st.scoreChip, chipStyle]}>
            <Ionicons name="star" size={9} color={chipInk} />
            <Text style={[st.scoreChipText, { color: chipInk }]}>{score.toFixed(1)}</Text>
          </View>
          {date ? (
            <Text style={[st.tileDate, { color: theme.text.muted }]} numberOfLines={1}>
              {fmtDate(date)}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Etkileşim kutucuğu (2 sütun) ───────────────────────────────────────────
// [poster • beğeni/kayıt noktası] [gönderi başlığı (2 satır) / @yazar · tarih  ⊗]
function InteractionTile({ theme, type, poster, title, author, date, action, onPress, onRemove }) {
  const meta = postTypeMeta(type, theme.colors);
  const isLike = action === "like";
  const actionColor = isLike ? KIND_META.like.color : KIND_META.bookmark.color;
  const actionIcon = isLike ? "heart" : "bookmark";
  const sub = [author ? `@${author}` : null, date ? fmtDate(date) : null].filter(Boolean).join(" · ");
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[st.tile, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <LinearGradient
        colors={[alpha(actionColor, 0.1), alpha(actionColor, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={st.rowWash}
        pointerEvents="none"
      />
      <TilePoster
        theme={theme}
        uri={poster}
        color={meta.color}
        icon={meta.icon}
        dotColor={actionColor}
        dotIcon={actionIcon}
      />
      <View style={st.tileInfo}>
        <Text style={[st.tileTitle, { color: theme.text.primary }]} numberOfLines={2}>
          {title}
        </Text>
        <View style={st.tileBottom}>
          {/* Gönderi tipi (tier list / bölüm grafiği / anket…): afişte görünmediği için küçük ikonla */}
          {type ? (
            <View style={[st.tileType, { backgroundColor: alpha(meta.color, 0.16) }]}>
              <Ionicons name={meta.icon} size={9} color={meta.color} />
            </View>
          ) : null}
          <Text style={[st.tileDate, { flex: 1, color: theme.text.muted }]} numberOfLines={1}>
            {sub}
          </Text>
          {onRemove ? (
            <TouchableOpacity
              onPress={onRemove}
              activeOpacity={0.8}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                isLike
                  ? i18nText("autoI18n.begeniyi_kaldir", "Beğeniyi kaldır")
                  : i18nText("autoI18n.kaydi_kaldir", "Kaydı kaldır")
              }
              style={[st.iconBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
            >
              <Ionicons name="close" size={13} color={theme.text.secondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Yorumlar satırı (kompakt, tek sütun) ───────────────────────────────────
// [poster] [tür · kapsam · tarih · düzenle/sil / başlık (1 satır) / alıntı (2 satır)]
// Düzenle/sil (yalnız post yorumlarında) ayrı alt şerit yerine meta satırında.
function Row({ theme, poster, kind, title, subtitle, date, onPress, badge, onEdit, onDelete }) {
  const km = KIND_META[kind] || { label: "", color: theme.accent, icon: "ellipse" };
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}
      style={[st.row, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <LinearGradient
        colors={[alpha(km.color, 0.1), alpha(km.color, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={st.rowWash}
        pointerEvents="none"
      />

      {poster ? (
        <Image source={{ uri: poster }} style={st.poster} contentFit="cover" cachePolicy="memory-disk" transition={150} />
      ) : (
        <LinearGradient
          colors={[alpha(km.color, 0.24), alpha(km.color, 0.08)]}
          style={[st.iconBox, { borderColor: alpha(km.color, 0.3) }]}
        >
          <Ionicons name={km.icon} size={18} color={km.color} />
        </LinearGradient>
      )}

      <View style={st.info}>
        <View style={st.metaRow}>
          {km.label ? (
            <View style={[st.kindChip, { backgroundColor: alpha(km.color, 0.14), borderColor: alpha(km.color, 0.3) }]}>
              <Ionicons name={km.icon} size={8} color={km.color} />
              <Text style={[st.kindChipText, { color: km.color }]}>
                {km.labelKey ? i18nText(km.labelKey, km.label) : km.label}
              </Text>
            </View>
          ) : null}
          {badge ? (
            <View style={[st.badge, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <Text style={[st.badgeText, { color: theme.text.secondary }]}>{badge}</Text>
            </View>
          ) : null}
          {date ? (
            <Text style={[st.date, { color: theme.text.muted }]} numberOfLines={1}>
              {fmtDate(date)}
            </Text>
          ) : null}
          <View style={{ flex: 1 }} />
          {onEdit ? (
            <TouchableOpacity
              onPress={onEdit}
              activeOpacity={0.8}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.duzenle", "Düzenle")}
              style={[st.iconBtn, { backgroundColor: alpha(theme.accent, 0.12), borderColor: alpha(theme.accent, 0.35) }]}
            >
              <Ionicons name="create-outline" size={13} color={theme.accent} />
            </TouchableOpacity>
          ) : null}
          {onDelete ? (
            <TouchableOpacity
              onPress={onDelete}
              activeOpacity={0.8}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.sil", "Sil")}
              style={[st.iconBtn, { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.35)" }]}
            >
              <Ionicons name="trash-outline" size={13} color="#EF4444" />
            </TouchableOpacity>
          ) : null}
          {onPress && !onEdit && !onDelete ? (
            <Ionicons name="chevron-forward" size={15} color={theme.text.muted} />
          ) : null}
        </View>

        <Text style={[st.title, { color: theme.text.primary }]} numberOfLines={1}>
          {title}
        </Text>

        {subtitle ? (
          <Text
            fontRole="body"
            style={[st.quoteText, { color: theme.text.secondary, borderLeftColor: alpha(km.color, 0.7) }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Wrapper>
  );
}

// ── Post kartı (Postlar / Taslaklar) — Hub akışı + Postlarım ile aynı dil, kompakt ──
// Beğeni/yorum sayıları ayrı alt şerit yerine üst meta satırında (tarihin yanında).
// Tipe özel gövde (tek satırlık özet, kart boyunu büyütmez):
//   tierlist → kademe çipleri ("S 3 · A 5 …", tablo renkleriyle) — tablonun kendisi akışta/detayda
//   tvgraph  → sezon ortalaması renk kareleri (bölüm grafiğiyle aynı renk ölçeği) + "N sezon · M bölüm"
function PostMini({ theme, type, poll, posters = [], title, content, userRating, hasSpoiler, tierList, tvGraph, date, likes, comments, draft, onPress }) {
  // Rozet + vurgu rengi feed'deki kartla ortak (review/list/text/poll/tierlist/tvgraph).
  const meta = postTypeMeta(type, theme.colors);
  const accent = meta.color;
  const Wrapper = onPress ? TouchableOpacity : View;
  const isText = type === "text";
  const isTier = type === "tierlist" && Array.isArray(tierList?.tiers);
  const isGraph = type === "tvgraph" && Array.isArray(tvGraph?.seasons);
  // Sohbet ve anket görselsiz tiplerdir: kart metne/çubuklara kalır.
  const hasVisual =
    posters.length > 0 || type === "review" || type === "list" || isTier || isGraph || (!type && !isText);
  const showStats = likes != null || comments != null;
  // Özet şeridi olan tiplerde açıklama tek satır — kart dikeyde büyümesin.
  const contentLines = isTier || isGraph ? 1 : 2;

  return (
    <Wrapper
      {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}
      style={[st.pCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <LinearGradient
        colors={[alpha(accent, 0.13), alpha(accent, 0)]}
        style={st.pWash}
        pointerEvents="none"
      />

      {/* Rozet + sayılar + zaman */}
      <View style={st.pMeta}>
        <View style={[st.pBadge, { backgroundColor: alpha(accent, 0.13), borderColor: alpha(accent, 0.32) }]}>
          <Ionicons name={meta.icon} size={9} color={accent} />
          <Text style={[st.pBadgeText, { color: accent }]}>{meta.label}</Text>
        </View>
        {hasSpoiler ? (
          <View style={st.pSpoiler}>
            <Ionicons name="eye-off" size={9} color={SPOILER_RED} />
            <Text style={st.pSpoilerText}>{i18nText("autoI18n.spoiler", "SPOİLER")}</Text>
          </View>
        ) : null}
        {draft ? (
          <View style={[st.pBadge, { backgroundColor: theme.primary, borderColor: theme.border }]}>
            <Ionicons name="document-text-outline" size={9} color={theme.text.muted} />
            <Text style={[st.pBadgeText, { color: theme.text.muted }]}>{i18nText("autoI18n.taslak_upper", "TASLAK")}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {showStats ? (
          <>
            <View style={st.pStat}>
              <Ionicons
                name={(likes || 0) > 0 ? "heart" : "heart-outline"}
                size={11}
                color={(likes || 0) > 0 ? LIKE_RED : theme.text.muted}
              />
              <Text style={[st.pStatText, { color: theme.text.secondary }]}>{likes || 0}</Text>
            </View>
            <View style={st.pStat}>
              <Ionicons
                name={(comments || 0) > 0 ? "chatbubble" : "chatbubble-outline"}
                size={10}
                color={(comments || 0) > 0 ? theme.accent : theme.text.muted}
              />
              <Text style={[st.pStatText, { color: theme.text.secondary }]}>{comments || 0}</Text>
            </View>
          </>
        ) : null}
        {date ? <Text style={[st.pTime, { color: theme.text.muted }]}>{fmtDate(date)}</Text> : null}
      </View>

      {/* Gövde: [görsel] + başlık/içerik */}
      <View style={st.pBody}>
        {hasVisual ? (
          posters.length > 0 ? (
            <PosterStack uris={posters} theme={theme} width={44} height={66} step={9} radius={9} />
          ) : (
            <View style={[st.pFallback, { backgroundColor: alpha(accent, 0.12), borderColor: alpha(accent, 0.3) }]}>
              <Ionicons name={isTier || isGraph ? meta.icon : "film-outline"} size={18} color={accent} />
            </View>
          )
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text fontRole="body" style={[st.pTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {title}
          </Text>
          {content ? (
            isText ? (
              <View style={[st.pQuote, { backgroundColor: alpha(accent, 0.07), borderLeftColor: accent }]}>
                <Text fontRole="body" style={[st.pQuoteText, { color: theme.text.primary }]} numberOfLines={2}>
                  {content}
                </Text>
              </View>
            ) : (
              <Text fontRole="body" style={[st.pContent, { color: theme.text.secondary }]} numberOfLines={contentLines}>
                {content}
              </Text>
            )
          ) : null}

          {isTier ? <TierChipsMini tiers={tierList.tiers} theme={theme} /> : null}
          {isGraph ? <GraphStripMini graph={tvGraph} theme={theme} /> : null}

          {type === "review" && userRating > 0 ? (
            <View style={[st.pRating, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <RatingStars rating={userRating} max={5} size={10} color={theme.colors.orange} />
              <Text style={[st.pRatingText, { color: theme.text.primary }]}>{userRating}/5</Text>
            </View>
          ) : null}
        </View>
      </View>

      {type === "poll" && poll ? <PollMiniBody poll={poll} accent={accent} theme={theme} /> : null}
    </Wrapper>
  );
}

// ── Tier list özeti (PostMini içi): dolu kademeler, etiket rengiyle çip + yapım sayısı ──
const TIER_CHIP_MAX = 5;
function TierChipsMini({ tiers, theme }) {
  const filled = tiers.filter((tier) => Array.isArray(tier?.items) && tier.items.length > 0);
  const shown = filled.slice(0, TIER_CHIP_MAX);
  const hidden = filled.length - shown.length;
  const total = filled.reduce((sum, tier) => sum + tier.items.length, 0);
  if (shown.length === 0) return null;
  return (
    <View style={st.miniStrip}>
      {shown.map((tier, index) => (
        <View key={`${tier.label}-${index}`} style={[st.tierChip, { backgroundColor: alpha(tier.color || theme.accent, 0.16) }]}>
          <View style={[st.tierChipLabel, { backgroundColor: tier.color || theme.accent }]}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[st.tierChipLabelText, { color: tierInkOf(tier.color || theme.accent) }]}
            >
              {tier.label}
            </Text>
          </View>
          <Text allowFontScaling={false} style={[st.tierChipCount, { color: theme.text.primary }]}>
            {tier.items.length}
          </Text>
        </View>
      ))}
      {hidden > 0 ? (
        <Text allowFontScaling={false} style={[st.miniMore, { color: theme.text.muted }]}>{`+${hidden}`}</Text>
      ) : null}
      <Text allowFontScaling={false} numberOfLines={1} style={[st.miniMore, { flexShrink: 1, color: theme.text.muted }]}>
        {`· ${getTierListCopy(i18n.language).cardCount(total)}`}
      </Text>
    </View>
  );
}

// ── Bölüm grafiği özeti (PostMini içi): sezon başına ortalama puan karesi + sayılar ──
const GRAPH_CELL_MAX = 16;
function GraphStripMini({ graph, theme }) {
  const seasons = graph.seasons.slice(0, GRAPH_CELL_MAX);
  const hidden = graph.seasons.length - seasons.length;
  const counts = i18nText("autoI18n.tvgraph_n_sezon_bolum", "{{s}} sezon · {{e}} bölüm", {
    s: graph.totalSeasons || graph.seasons.length,
    e: graph.totalEpisodes || graph.seasons.reduce((sum, season) => sum + (season?.r?.length || 0), 0),
  });
  const rating = Number(graph.rating) > 0 ? ` · ★ ${Number(graph.rating).toFixed(1)}` : "";
  return (
    <View style={st.graphMini}>
      <View style={st.miniStrip}>
        {seasons.map((season) => {
          const rated = (season?.r || []).filter((value) => value > 0);
          const avg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
          const colors = avg > 0 ? getRatingColors(avg) : null;
          return (
            <View
              key={season.s}
              style={[st.graphCell, { backgroundColor: colors ? colors.bg : alpha(theme.text.muted, 0.25) }]}
            />
          );
        })}
        {hidden > 0 ? (
          <Text allowFontScaling={false} style={[st.miniMore, { color: theme.text.muted }]}>{`+${hidden}`}</Text>
        ) : null}
      </View>
      <Text allowFontScaling={false} numberOfLines={1} style={[st.graphCounts, { color: theme.text.muted }]}>
        {counts + rating}
      </Text>
    </View>
  );
}

// ── Anket gövdesi (PostMini içi): en çok oy alan 2 seçenek + özet satırı ──
function PollMiniBody({ poll, accent, theme }) {
  const { counts, total } = tallyVotes(poll.votes);
  // 0 oy → yüzde 0 (bölme/NaN yok); etiketi boş medya seçeneği için sıra no fallback'i.
  const top = (poll.options || [])
    .map((o, i) => ({ opt: o, idx: i, count: counts[o?.id] || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);
  return (
    <View style={[st.pPollBody, { backgroundColor: theme.primary, borderColor: theme.border }]}>
      {top.map(({ opt, idx, count }, rank) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const label =
          (opt?.label || "").trim() ||
          i18nText("autoI18n.secenek_n", "Seçenek {{n}}", { n: idx + 1 });
        const lead = rank === 0 && total > 0;
        return (
          <View key={opt?.id || idx} style={st.pPollBarRow}>
            <View style={st.pPollBarHead}>
              <Text style={[st.pPollBarLabel, { color: theme.text.primary }]} numberOfLines={1}>
                {label}
              </Text>
              <Text style={[st.pPollBarPct, { color: lead ? accent : theme.text.muted }]}>{percentText(pct)}</Text>
            </View>
            <View style={[st.pPollBarTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  st.pPollBarFill,
                  { backgroundColor: lead ? accent : alpha(accent, 0.45), width: `${pct}%` },
                ]}
              />
            </View>
          </View>
        );
      })}
      <View style={st.pPollSummary}>
        <Ionicons name="stats-chart" size={11} color={accent} />
        <Text style={[st.pPollSummaryText, { color: theme.text.muted }]}>
          {i18nText("autoI18n.anket_ozeti", "{{options}} seçenek · {{votes}} oy", {
            options: poll.options?.length || 0,
            votes: total,
          })}
        </Text>
      </View>
    </View>
  );
}

// ── Story taslak kartı: 9:16 kutucuk, ad ve tarih görselin üstünde ──
function StoryMini({ theme, thumbnail, name, date, onPress }) {
  const pink = "#EC4899";
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={st.storyDraftCard}>
      <View style={[st.storyDraftThumbWrap, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={st.storyDraftThumb} contentFit="cover" />
        ) : (
          <LinearGradient colors={[alpha(pink, 0.28), alpha(pink, 0.08)]} style={st.storyDraftEmpty}>
            <Ionicons name="image-outline" size={28} color={pink} />
          </LinearGradient>
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.35)", "transparent"]}
          style={st.storyTopFade}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.88)"]}
          style={st.storyBottomFade}
          pointerEvents="none"
        />
        <View style={st.storyDraftOverlay} pointerEvents="none">
          <View style={st.storyTopRow}>
            <View style={st.storyDraftTypeBadge}>
              <Ionicons name="images" size={10} color="#fff" />
              <Text style={st.storyDraftTypeText}>{i18nText("autoI18n.kind_story", "STORY")}</Text>
            </View>
            <View style={[st.storyDraftEditBadge, { backgroundColor: pink }]}>
              <Ionicons name="create-outline" size={12} color="#fff" />
            </View>
          </View>
          <View>
            <Text allowFontScaling={false} numberOfLines={2} style={st.storyDraftName}>
              {name}
            </Text>
            {!!fmtDate(date) && (
              <Text allowFontScaling={false} numberOfLines={1} style={st.storyDraftDate}>
                {fmtDate(date)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },

  headerGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 180 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  headerSub: { fontSize: 12.5, fontWeight: "600", marginTop: 1 },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  // Sekmeler
  tabRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 7,
    paddingRight: 12,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  tabText: { fontSize: 13 },
  tabBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  tabBadgeText: { fontSize: 10.5, fontWeight: "800" },

  // Arama + filtre çubuğu
  // Sekme şeridi + arama çubuğu ASLA küçülmez; yer darsa alttaki liste/boş durum daralır.
  tabScroll: { flexGrow: 0, flexShrink: 0 },
  listFill: { flex: 1 },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexShrink: 0,
    zIndex: 1,
  },
  searchWrap: { flex: 1, justifyContent: "center" },
  searchInput: {
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 34,
    paddingRight: 34,
    fontSize: 13.5,
  },
  searchIcon: { position: "absolute", left: 12 },
  searchClear: { position: "absolute", right: 10 },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: { color: "#fff", fontSize: 9.5, fontWeight: "900" },

  // Liste (tek sütun) ve 2 sütunlu kutucuk ızgarası
  list: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40 },
  pairGridList: { paddingHorizontal: PAIR_PAD, paddingTop: 6, paddingBottom: 40 },
  pairGridRow: { gap: PAIR_GAP },
  pairCell: { width: PAIR_ITEM_W },

  // Kutucuk (Puanlamalar / Etkileşimler)
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 7,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: PAIR_GAP,
    overflow: "hidden",
  },
  tilePosterWrap: { width: 42, height: 63 },
  tilePoster: { width: 42, height: 63, borderRadius: 9 },
  tilePosterEmpty: { borderWidth: 1, justifyContent: "center", alignItems: "center" },
  tileDot: {
    position: "absolute",
    right: -4,
    bottom: -3,
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  tileInfo: { flex: 1, minWidth: 0, alignSelf: "stretch", justifyContent: "space-between", paddingVertical: 1 },
  tileTitle: { fontSize: 12.5, fontWeight: "800", lineHeight: 16, letterSpacing: -0.1 },
  tileBottom: { flexDirection: "row", alignItems: "center", gap: 5 },
  tileDate: { flexShrink: 1, fontSize: 10, fontWeight: "600" },
  tileType: { width: 16, height: 16, borderRadius: 5, justifyContent: "center", alignItems: "center" },
  scoreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  scoreChipText: { fontSize: 11.5, fontWeight: "900", letterSpacing: -0.2 },
  iconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },

  // Yorumlar satırı (kompakt)
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 9,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    overflow: "hidden",
  },
  rowWash: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  poster: { width: 40, height: 60, borderRadius: 9 },
  iconBox: {
    width: 40,
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  info: { flex: 1, minWidth: 0, gap: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 24 },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  kindChipText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontSize: 8, fontWeight: "800", letterSpacing: 0.3 },
  title: { fontSize: 13.5, fontWeight: "800", lineHeight: 18, letterSpacing: -0.1 },
  quoteText: { fontSize: 12, lineHeight: 16.5, borderLeftWidth: 2, paddingLeft: 7 },
  date: { flexShrink: 1, fontSize: 10, fontWeight: "600" },

  // Yorum düzenleme modalı
  editBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  editCard: { flexShrink: 1, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  editHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  editIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  editTitle: { flex: 1, fontSize: 17, fontWeight: "800" },
  editCounter: { fontSize: 11.5, fontWeight: "700" },
  editInput: {
    flexShrink: 1,
    minHeight: 110,
    maxHeight: 220,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    fontSize: 14.5,
    lineHeight: 21,
    textAlignVertical: "top",
  },
  editActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  editBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  editBtnText: { fontSize: 15, fontWeight: "800" },

  // Boş durum
  // minHeight 0 + overflow hidden: klavye açıkken boş durum kendi alanında kırpılır, üstteki şeride taşmaz.
  center: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyHalo: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  emptyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  emptyChipText: { fontSize: 12, fontWeight: "800" },

  // PostMini (paylaşım kartı görünümü, kompakt)
  pCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    marginBottom: 8,
  },
  pWash: { position: "absolute", left: 0, right: 0, top: 0, height: 90 },
  pMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 7 },
  pBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pBadgeText: { fontSize: 8.5, fontWeight: "900", letterSpacing: 0.4 },
  pSpoiler: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(240,79,79,0.12)",
  },
  pSpoilerText: { color: SPOILER_RED, fontSize: 8, fontWeight: "900", letterSpacing: 0.4 },
  pStat: { flexDirection: "row", alignItems: "center", gap: 3 },
  pStatText: { fontSize: 10.5, fontWeight: "800" },
  pTime: { fontSize: 10, fontWeight: "600" },
  pBody: { flexDirection: "row", gap: 10 },
  pFallback: {
    width: 44,
    height: 66,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pTitle: { fontSize: 14, lineHeight: 19, fontWeight: "800", letterSpacing: -0.1 },
  pContent: { fontSize: 12, marginTop: 2, lineHeight: 16.5 },
  pQuote: {
    borderLeftWidth: 3,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  pQuoteText: { fontSize: 12.5, lineHeight: 17 },
  pRating: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 5,
  },
  pRatingText: { fontSize: 10.5, fontWeight: "800" },

  // Tipe özel tek satırlık özetler (tier list çipleri / bölüm grafiği kareleri)
  miniStrip: { flexDirection: "row", alignItems: "center", flexWrap: "nowrap", gap: 4, marginTop: 6, overflow: "hidden" },
  miniMore: { fontSize: 10.5, fontWeight: "800" },
  tierChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 6, height: 18, borderRadius: 5, overflow: "hidden" },
  tierChipLabel: { minWidth: 18, maxWidth: 40, height: 18, paddingHorizontal: 4, justifyContent: "center", alignItems: "center" },
  tierChipLabelText: { fontSize: 10, fontWeight: "900" },
  tierChipCount: { fontSize: 10.5, fontWeight: "800" },
  graphMini: { gap: 0 },
  graphCell: { width: 11, height: 11, borderRadius: 3 },
  graphCounts: { fontSize: 10.5, fontWeight: "700", marginTop: 4 },

  // Anket gövdesi (top-2 mini bar)
  pPollBody: {
    gap: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginTop: 7,
  },
  pPollBarRow: { gap: 3 },
  pPollBarHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pPollBarLabel: { flex: 1, fontSize: 11.5, fontWeight: "700" },
  pPollBarPct: { fontSize: 11, fontWeight: "900" },
  pPollBarTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  pPollBarFill: { height: "100%", borderRadius: 2 },
  pPollSummary: { flexDirection: "row", alignItems: "center", gap: 5 },
  pPollSummaryText: { fontSize: 10, fontWeight: "600" },

  // StoryMini: 9:16 kutucuk ızgarası
  storyGridList: {
    paddingHorizontal: STORY_GRID_PAD,
    paddingTop: 6,
    paddingBottom: 40,
    gap: 14,
    flexGrow: 1,
  },
  storyGridRow: { gap: STORY_GRID_GAP },
  storyDraftCard: { width: STORY_ITEM_W },
  storyDraftThumbWrap: {
    width: STORY_ITEM_W,
    height: STORY_ITEM_H,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  storyDraftThumb: { width: "100%", height: "100%" },
  storyDraftEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  storyTopFade: { position: "absolute", left: 0, right: 0, top: 0, height: 56 },
  storyBottomFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "46%" },
  storyDraftOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
    padding: 8,
  },
  storyTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  storyDraftTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  storyDraftTypeText: { color: "#fff", fontSize: 8, fontWeight: "900", letterSpacing: 0.4 },
  storyDraftEditBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  storyDraftName: { color: "#fff", fontSize: 12, fontWeight: "800", lineHeight: 15 },
  storyDraftDate: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "600", marginTop: 2 },
});
