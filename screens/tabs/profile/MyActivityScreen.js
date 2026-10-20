// screens/tabs/profile/MyActivityScreen.js
//
// "Etkinliklerim" — kullanıcının tüm aktivitesi tek sayfada, sekmeli:
//   Puanlamalar | Yorumlar | Postlar | Taslaklar | Story | Etkileşimler
// Her satırda mümkünse tarih bilgisi gösterilir.
//
// Görsel dil: her sekmenin KENDİ rengi var (profildeki MyActivityButton kısayol
// hücreleriyle aynı) — aktif sekme başlıktaki ışığı ve boş durumu da o renge
// boyar. Satırlar yumuşak yüzeyli kartlar; post kartları Hub akışı ve
// Postlarım ile aynı dili (tip rengi, poster yığını, istatistik hapları) kullanır.

import { Image } from "expo-image";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { getPostDrafts } from "../../../services/postDraftService";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import { i18nText } from "@utils/i18nText";
import { tallyVotes } from "@utils/postComposer";
import RatingStars from "@components/RatingStars";
import StaggerItem from "@components/StaggerItem";
import PosterStack from "@components/feed/PosterStack";
import StatPill from "@components/feed/StatPill";
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
  return d.toLocaleDateString();
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

// Puan tonu (0-10): yüksek yeşil, orta turuncu, düşük kırmızı.
const scoreTone = (score, theme) =>
  score >= 8
    ? theme.colors?.green || "#22C55E"
    : score >= 6
      ? theme.colors?.orange || "#F97316"
      : theme.colors?.red || "#EF4444";

const STORY_COLS = 3;
const STORY_GRID_PAD = 16;
const STORY_GRID_GAP = 10;
const STORY_ITEM_W =
  (Dimensions.get("window").width -
    STORY_GRID_PAD * 2 -
    STORY_GRID_GAP * (STORY_COLS - 1)) /
  STORY_COLS;
const STORY_ITEM_H = (STORY_ITEM_W * 16) / 9;

export default function MyActivityScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { getTmdbUrl } = useImageQualitySettings();
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

  const renderItem = ({ item, index }) => {
    let node;
    switch (tab) {
      case "ratings":
        node = (
          <Row
            theme={theme}
            poster={item.poster ? getTmdbUrl(item.poster, "poster", 200) : null}
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
        const mediaPosters = (item.mediaList || []).map((m) => m?.poster).filter(Boolean);
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
            date={item._createdAtMs}
            likes={item.likesCount}
            comments={item.commentsCount}
            onPress={() => navigation.navigate("PostDetailScreen", { postId: item.id })}
          />
        );
        break;
      }
      case "drafts": {
        const posters = (item.selectedMedia || [])
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
          <PostMini
            theme={theme}
            type={item.postType}
            posters={item.postPoster ? [item.postPoster] : []}
            title={item.postTitle || i18nText("autoI18n.gonderi", "Gönderi")}
            content={item.postAuthorName ? `@${item.postAuthorName}` : null}
            date={item._ts}
            action={item._kind === "like" ? "like" : "bookmark"}
            onRemove={() => removeInteraction(item)}
          />
        );
        break;
    }
    return <StaggerItem index={index}>{node}</StaggerItem>;
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
        style={{ flexGrow: 0 }}
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

      {loading ? (
        <ActivityListSkeleton count={6} />
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
          key={tab === "story" ? "story-grid" : "activity-list"}
          data={data}
          keyExtractor={(it, i) => `${tab}-${it._kind || ""}-${it.id || i}`}
          renderItem={renderItem}
          numColumns={tab === "story" ? STORY_COLS : 1}
          columnWrapperStyle={tab === "story" ? st.storyGridRow : undefined}
          contentContainerStyle={
            tab === "story"
              ? st.storyGridList
              : { padding: 16, paddingTop: 6, paddingBottom: 40 }
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
                    <ActivityIndicator size="small" color="#fff" />
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
    </SafeAreaView>
  );
}

// ─── Puanlamalar / Yorumlar satırı ───────────────────────────────────────────
// [poster] [tür rozeti · tarih / başlık / yorum alıntısı] [puan rozeti | ok]
// Yorum düzenle/sil aksiyonları (yalnız post yorumlarında) kartın altında.
function Row({ theme, poster, kind, title, subtitle, date, score, onPress, badge, onEdit, onDelete }) {
  const km = KIND_META[kind] || { label: "", color: theme.accent, icon: "ellipse" };
  const Wrapper = onPress ? TouchableOpacity : View;
  const hasActions = !!(onEdit || onDelete);
  const tone = score != null ? scoreTone(score, theme) : null;

  return (
    <Wrapper
      {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}
      style={[st.row, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      {/* Tür renginde yumuşak ışık */}
      <LinearGradient
        colors={[alpha(km.color, 0.1), alpha(km.color, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={st.rowWash}
        pointerEvents="none"
      />

      <View style={st.rowMain}>
        {/* Poster veya gradient ikon */}
        {poster ? (
          <Image source={{ uri: poster }} style={st.poster} contentFit="cover" cachePolicy="memory-disk" transition={150} />
        ) : (
          <LinearGradient
            colors={[alpha(km.color, 0.24), alpha(km.color, 0.08)]}
            style={[st.iconBox, { borderColor: alpha(km.color, 0.3) }]}
          >
            <Ionicons name={km.icon} size={24} color={km.color} />
          </LinearGradient>
        )}

        {/* Orta */}
        <View style={st.info}>
          <View style={st.metaRow}>
            {km.label ? (
              <View style={[st.kindChip, { backgroundColor: alpha(km.color, 0.14), borderColor: alpha(km.color, 0.3) }]}>
                <Ionicons name={km.icon} size={9} color={km.color} />
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
            <View style={{ flex: 1 }} />
            {date ? (
              <View style={st.dateRow}>
                <Ionicons name="time-outline" size={11} color={theme.text.muted} />
                <Text style={[st.date, { color: theme.text.muted }]}>{fmtDate(date)}</Text>
              </View>
            ) : null}
          </View>

          <Text style={[st.title, { color: theme.text.primary }]} numberOfLines={2}>
            {title}
          </Text>

          {subtitle ? (
            <View
              style={[
                st.quote,
                { backgroundColor: theme.primary, borderColor: theme.border, borderLeftColor: km.color },
              ]}
            >
              <Text fontRole="body" style={[st.quoteText, { color: theme.text.secondary }]} numberOfLines={3}>
                {subtitle}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Sağ: puan rozeti ya da ok */}
        {tone != null ? (
          <View style={[st.score, { backgroundColor: alpha(tone, 0.12), borderColor: alpha(tone, 0.35) }]}>
            <Text style={[st.scoreNum, { color: tone }]}>{score.toFixed(1)}</Text>
            <RatingStars rating={score} max={10} size={8} color={tone} spacing={0} />
          </View>
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
        ) : null}
      </View>

      {hasActions ? (
        <View style={[st.rowActions, { borderTopColor: theme.border }]}>
          {onEdit ? (
            <TouchableOpacity
              onPress={onEdit}
              activeOpacity={0.8}
              hitSlop={6}
              style={[st.actionPill, { backgroundColor: alpha(theme.accent, 0.12), borderColor: alpha(theme.accent, 0.35) }]}
            >
              <Ionicons name="create-outline" size={15} color={theme.accent} />
              <Text style={[st.actionPillText, { color: theme.accent }]}>
                {i18nText("autoI18n.duzenle", "Düzenle")}
              </Text>
            </TouchableOpacity>
          ) : null}
          {onDelete ? (
            <TouchableOpacity
              onPress={onDelete}
              activeOpacity={0.8}
              hitSlop={6}
              style={[st.actionPill, { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.35)" }]}
            >
              <Ionicons name="trash-outline" size={15} color="#EF4444" />
              <Text style={[st.actionPillText, { color: "#EF4444" }]}>
                {i18nText("autoI18n.sil", "Sil")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </Wrapper>
  );
}

// ── Post kartı (Postlar / Taslaklar / Etkileşimler) — Hub akışı + Postlarım ile aynı dil ──
function PostMini({ theme, type, poll, posters = [], title, content, userRating, hasSpoiler, date, likes, comments, draft, action, onPress, onRemove }) {
  // Rozet + vurgu rengi feed'deki kartla ortak (review/list/text/poll).
  const meta = postTypeMeta(type, theme.colors);
  const accent = meta.color;
  const Wrapper = onPress ? TouchableOpacity : View;
  const isText = type === "text";
  // Sohbet ve anket görselsiz tiplerdir: kart metne/çubuklara kalır.
  const hasVisual = posters.length > 0 || type === "review" || type === "list" || (!type && !isText);
  const actionColor = action === "like" ? KIND_META.like.color : theme.accent;

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

      {/* Rozet + zaman */}
      <View style={st.pMeta}>
        <View style={[st.pBadge, { backgroundColor: alpha(accent, 0.13), borderColor: alpha(accent, 0.32) }]}>
          <Ionicons name={meta.icon} size={10} color={accent} />
          <Text style={[st.pBadgeText, { color: accent }]}>{meta.label}</Text>
        </View>
        {hasSpoiler ? (
          <View style={st.pSpoiler}>
            <Ionicons name="eye-off" size={10} color={SPOILER_RED} />
            <Text style={st.pSpoilerText}>{i18nText("autoI18n.spoiler", "SPOİLER")}</Text>
          </View>
        ) : null}
        {draft ? (
          <View style={[st.pBadge, { backgroundColor: theme.primary, borderColor: theme.border }]}>
            <Ionicons name="document-text-outline" size={10} color={theme.text.muted} />
            <Text style={[st.pBadgeText, { color: theme.text.muted }]}>{i18nText("autoI18n.taslak_upper", "TASLAK")}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {date ? (
          <View style={st.dateRow}>
            <Ionicons name="time-outline" size={11} color={theme.text.muted} />
            <Text style={[st.pTime, { color: theme.text.muted }]}>{fmtDate(date)}</Text>
          </View>
        ) : null}
      </View>

      {/* Gövde: [görsel] + başlık/içerik */}
      <View style={st.pBody}>
        {hasVisual ? (
          posters.length > 0 ? (
            <PosterStack uris={posters} theme={theme} width={64} height={96} step={14} radius={12} />
          ) : (
            <View style={[st.pFallback, { backgroundColor: alpha(accent, 0.12), borderColor: alpha(accent, 0.3) }]}>
              <Ionicons name="film-outline" size={22} color={accent} />
            </View>
          )
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text fontRole="body" style={[st.pTitle, { color: theme.text.primary }]} numberOfLines={2}>
            {title}
          </Text>
          {content ? (
            isText ? (
              <View style={[st.pQuote, { backgroundColor: alpha(accent, 0.07), borderLeftColor: accent }]}>
                <Text fontRole="body" style={[st.pQuoteText, { color: theme.text.primary }]} numberOfLines={3}>
                  {content}
                </Text>
              </View>
            ) : (
              <Text
                fontRole="body"
                style={[st.pContent, { color: action ? theme.text.muted : theme.text.secondary }]}
                numberOfLines={2}
              >
                {content}
              </Text>
            )
          ) : null}

          {type === "review" && userRating > 0 ? (
            <View style={[st.pRating, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <RatingStars rating={userRating} max={5} size={12} color={theme.colors.orange} />
              <Text style={[st.pRatingText, { color: theme.text.primary }]}>{userRating}/5</Text>
            </View>
          ) : null}
        </View>
      </View>

      {type === "poll" && poll ? <PollMiniBody poll={poll} accent={accent} theme={theme} /> : null}

      {/* Alt satır: etkileşim aksiyonu ya da istatistikler */}
      {action ? (
        <View style={[st.pFooter, { borderTopColor: theme.border }]}>
          <View style={[st.pActionPill, { backgroundColor: alpha(actionColor, 0.12), borderColor: alpha(actionColor, 0.35) }]}>
            <Ionicons name={action === "like" ? "heart" : "bookmark"} size={14} color={actionColor} />
            <Text style={[st.pActionText, { color: actionColor }]}>
              {action === "like"
                ? i18nText("autoI18n.begendin", "Beğendin")
                : i18nText("autoI18n.kaydettin", "Kaydettin")}
            </Text>
          </View>
          {onRemove ? (
            <GlassTouchable
              onPress={onRemove}
              activeOpacity={0.8}
              hitSlop={8}
              style={[st.removePill, { backgroundColor: theme.primary, borderColor: theme.border }]}
            >
              <Ionicons name="close-circle" size={14} color={theme.text.secondary} />
              <Text style={[st.removePillText, { color: theme.text.secondary }]}>
                {i18nText("autoI18n.kaldir", "Kaldır")}
              </Text>
            </GlassTouchable>
          ) : null}
        </View>
      ) : likes != null || comments != null ? (
        <View style={[st.pFooter, { borderTopColor: theme.border }]}>
          <StatPill icon="heart" active={(likes || 0) > 0} activeColor={LIKE_RED} count={likes || 0} theme={theme} />
          <StatPill icon="chatbubble" active={(comments || 0) > 0} activeColor={theme.accent} count={comments || 0} theme={theme} />
        </View>
      ) : null}
    </Wrapper>
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
              <Text style={[st.pPollBarPct, { color: lead ? accent : theme.text.muted }]}>%{pct}</Text>
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

  // Puanlamalar / Yorumlar satırı
  row: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    overflow: "hidden",
  },
  rowWash: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  poster: { width: 56, height: 84, borderRadius: 12 },
  iconBox: {
    width: 56,
    height: 84,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  info: { flex: 1, minWidth: 0, gap: 5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  kindChipText: { fontSize: 8.5, fontWeight: "900", letterSpacing: 0.6 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontSize: 8.5, fontWeight: "800", letterSpacing: 0.3 },
  title: { fontSize: 15, fontWeight: "800", lineHeight: 20, letterSpacing: -0.1 },
  quote: {
    borderLeftWidth: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  quoteText: { fontSize: 12.5, lineHeight: 18 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  date: { fontSize: 10.5, fontWeight: "600" },

  score: {
    width: 58,
    alignItems: "center",
    gap: 3,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  scoreNum: { fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },

  // Satır aksiyonları (yorum düzenle/sil)
  rowActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
  actionPillText: { fontSize: 12.5, fontWeight: "800" },

  // Etkileşim "Kaldır" pili
  removePill: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  removePillText: { fontSize: 12, fontWeight: "700" },

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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 40, paddingBottom: 60 },
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

  // PostMini (paylaşım kartı görünümü)
  pCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 12,
  },
  pWash: { position: "absolute", left: 0, right: 0, top: 0, height: 120 },
  pMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  pBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  pSpoiler: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: "rgba(240,79,79,0.12)",
  },
  pSpoilerText: { color: SPOILER_RED, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.4 },
  pTime: { fontSize: 10.5, fontWeight: "600" },
  pBody: { flexDirection: "row", gap: 12 },
  pFallback: {
    width: 64,
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pTitle: { fontSize: 15.5, lineHeight: 21, fontWeight: "800", letterSpacing: -0.1 },
  pContent: { fontSize: 12.5, marginTop: 3, lineHeight: 18 },
  pQuote: {
    borderLeftWidth: 3,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  pQuoteText: { fontSize: 13, lineHeight: 19 },
  pRating: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  pRatingText: { fontSize: 11.5, fontWeight: "800" },

  // Anket gövdesi (top-2 mini bar)
  pPollBody: {
    gap: 9,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    marginTop: 10,
  },
  pPollBarRow: { gap: 4 },
  pPollBarHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pPollBarLabel: { flex: 1, fontSize: 12, fontWeight: "700" },
  pPollBarPct: { fontSize: 11.5, fontWeight: "900" },
  pPollBarTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  pPollBarFill: { height: "100%", borderRadius: 3 },
  pPollSummary: { flexDirection: "row", alignItems: "center", gap: 5 },
  pPollSummaryText: { fontSize: 10.5, fontWeight: "600" },

  pFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pActionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  pActionText: { fontSize: 12, fontWeight: "800" },

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
