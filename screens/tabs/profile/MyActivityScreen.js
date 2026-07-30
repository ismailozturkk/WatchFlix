// screens/tabs/profile/MyActivityScreen.js
//
// "Etkinliklerim" — kullanıcının tüm aktivitesi tek sayfada, sekmeli:
//   Puanlamalar | Yorumlar | Postlar | Taslaklar | Story | Etkileşimler
// Her satırda mümkünse tarih bilgisi gösterilir.

import { Image } from "expo-image";
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Animated,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import { i18nText } from "@utils/i18nText";
import { postTypeBadge, tallyVotes } from "@utils/postComposer";
import RatingStars from "@components/RatingStars";
import StaggerItem from "@components/StaggerItem";
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

  // Yerel (AsyncStorage) kaynaklar — sayfa odaklandığında tazele
  const loadLocal = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("post_drafts");
      setDrafts(raw ? JSON.parse(raw) : []);
    } catch {
      setDrafts([]);
    }
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
    (mediaType, id) => {
      navigation.navigate(mediaType === "movie" ? "MovieDetails" : "TvShowsDetails", { id });
    },
    [navigation],
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
            onPress={() => openMedia(item.mediaType, item.mediaId)}
            right={
              <View style={st.scorePill}>
                <RatingStars rating={item.rating} max={10} size={11} color={theme.colors.orange} />
                <Text style={[st.scoreTxt, { color: theme.colors.orange }]}>
                  {Number(item.rating || 0).toFixed(1)}
                </Text>
              </View>
            }
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
            date={item.createdAt}
            onPress={item.kind === "post" ? undefined : () => openMedia(item.kind, item.targetId)}
            onEdit={item.kind === "post" ? () => openEdit(item) : undefined}
            onDelete={item.kind === "post" ? () => removeComment(item) : undefined}
          />
        );
        break;
      case "posts":
        node = (
          <PostMini
            theme={theme}
            type={item.type}
            poll={item.poll}
            posters={(item.mediaList || []).map((m) => m?.poster).filter(Boolean)}
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
            draft={item}
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

  return (
    <SafeAreaView style={[st.container, { backgroundColor: theme.primary }]} edges={["top"]}>
      {/* ── Gradient başlık ── */}
      <LinearGradient
        colors={[theme.accent + "26", "transparent"]}
        style={st.headerGlow}
        pointerEvents="none"
      />
      <View style={st.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          style={[st.backBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={theme.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[st.headerTitle, { color: theme.text.primary }]}>
            {i18nText("autoI18n.etkinliklerim", "Etkinliklerim")}
          </Text>
          <Text style={[st.headerSub, { color: theme.text.muted }]}>
            {i18nText("autoI18n.n_etkinlik", "{{n}} etkinlik", { n: total })}
          </Text>
        </View>
        <View style={[st.headerBadge, { backgroundColor: theme.accent + "1A", borderColor: theme.accent + "44" }]}>
          <Ionicons name="sparkles" size={18} color={theme.accent} />
        </View>
      </View>

      {/* ── Sekmeler ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.tabRow}
        style={{ flexGrow: 0 }}
      >
        {TABS.map((tb) => {
          const active = tab === tb.key;
          const Chip = active ? LinearGradient : View;
          const chipProps = active
            ? { colors: [theme.accent, theme.accent + "CC"], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }
            : {};
          return (
            <TouchableOpacity key={tb.key} onPress={() => setTab(tb.key)} activeOpacity={0.85}>
              <Chip
                {...chipProps}
                style={[
                  st.tabChip,
                  active
                    ? { shadowColor: theme.accent, borderWidth: 1, borderColor: "transparent" }
                    : { backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1 },
                ]}
              >
                <Ionicons name={tb.icon} size={14} color={active ? "#fff" : theme.text.muted} />
                <Text
                  allowFontScaling={false}
                  style={[st.tabText, { color: active ? "#fff" : theme.text.secondary }]}
                >
                  {i18nText(TAB_LABEL_KEY[tb.key], tb.label)}
                </Text>
                {counts[tb.key] > 0 && (
                  <View
                    style={[
                      st.tabBadge,
                      { backgroundColor: active ? "rgba(255,255,255,0.28)" : theme.primary },
                    ]}
                  >
                    <Text style={[st.tabBadgeText, { color: active ? "#fff" : theme.text.muted }]}>
                      {counts[tb.key]}
                    </Text>
                  </View>
                )}
              </Chip>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityListSkeleton count={7} />
      ) : data.length === 0 ? (
        <View style={st.center}>
          <View style={[st.emptyCircle, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="timeline-text-outline" size={40} color={theme.text.muted} />
          </View>
          <Text style={[st.emptyText, { color: theme.text.primary }]}>
            {i18nText("autoI18n.bu_bolumde_henuz_kayit_yok", "Bu bölümde henüz kayıt yok")}
          </Text>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={st.editBackdrop}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => !saving && setEditing(null)}
          />
          <View style={[st.editCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <View style={st.editHeader}>
              <View style={[st.editIcon, { backgroundColor: theme.accent + "1A" }]}>
                <Ionicons name="create-outline" size={18} color={theme.accent} />
              </View>
              <Text style={[st.editTitle, { color: theme.text.primary }]}>
                {i18nText("autoI18n.yorumu_duzenle", "Yorumu düzenle")}
              </Text>
            </View>
            <TextInput
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
              <TouchableOpacity
                onPress={() => setEditing(null)}
                disabled={saving}
                activeOpacity={0.85}
                style={[st.editBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
              >
                <Text style={[st.editBtnText, { color: theme.text.secondary }]}>
                  {i18nText("autoI18n.vazgec", "Vazgeç")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEdit}
                disabled={saving}
                activeOpacity={0.85}
                style={[st.editBtn, { backgroundColor: theme.accent, borderColor: theme.accent, opacity: saving ? 0.7 : 1 }]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[st.editBtnText, { color: "#fff" }]}>
                    {i18nText("autoI18n.kaydet", "Kaydet")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Genel satır ──────────────────────────────────────────────────────────────
function Row({ theme, poster, kind, title, subtitle, date, right, onPress, badge, onEdit, onDelete }) {
  const km = KIND_META[kind] || { label: "", color: theme.accent, icon: "ellipse" };
  const Wrapper = onPress ? TouchableOpacity : View;
  const hasActions = !!(onEdit || onDelete);
  return (
    <Wrapper
      {...(onPress ? { onPress, activeOpacity: 0.8 } : {})}
      style={[st.row, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      {/* Sol renk aksanı */}
      <View style={[st.accentBar, { backgroundColor: km.color }]} />

      {/* Poster veya gradient ikon */}
      {poster ? (
        <Image source={{ uri: poster }} style={st.poster} contentFit="cover" cachePolicy="memory-disk" transition={150} />
      ) : (
        <LinearGradient
          colors={[km.color + "33", km.color + "14"]}
          style={[st.iconBox, { borderColor: km.color + "3A" }]}
        >
          <Ionicons name={km.icon} size={22} color={km.color} />
        </LinearGradient>
      )}

      {/* Orta */}
      <View style={st.info}>
        <View style={st.metaRow}>
          {km.label ? (
            <View style={[st.kindChip, { backgroundColor: km.color + "1F" }]}>
              <Ionicons name={km.icon} size={9} color={km.color} />
              <Text style={[st.kindChipText, { color: km.color }]}>
                {km.labelKey ? i18nText(km.labelKey, km.label) : km.label}
              </Text>
            </View>
          ) : null}
          {badge ? (
            <View style={[st.badge, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <Text style={[st.badgeText, { color: theme.text.muted }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[st.title, { color: theme.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[st.subtitle, { color: theme.text.secondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {date ? (
          <View style={st.dateRow}>
            <Ionicons name="time-outline" size={11} color={theme.text.muted} />
            <Text style={[st.date, { color: theme.text.muted }]}>{fmtDate(date)}</Text>
          </View>
        ) : null}
      </View>

      {/* Sağ */}
      {right ? (
        right
      ) : hasActions ? (
        <View style={st.rowActions}>
          {onEdit ? (
            <TouchableOpacity
              onPress={onEdit}
              activeOpacity={0.8}
              hitSlop={8}
              style={[st.rowActionBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
            >
              <Ionicons name="create-outline" size={16} color={theme.accent} />
            </TouchableOpacity>
          ) : null}
          {onDelete ? (
            <TouchableOpacity
              onPress={onDelete}
              activeOpacity={0.8}
              hitSlop={8}
              style={[st.rowActionBtn, { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.35)" }]}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
      ) : null}
    </Wrapper>
  );
}

// ── Üst üste binen poster yığını (MyPostsScreen görünümü) ──
function PosterStack({ posters = [], theme }) {
  const list = posters.slice(0, 3);
  if (list.length === 0) {
    return (
      <View style={[st.pPoster, st.pPosterEmpty, { backgroundColor: theme.border }]}>
        <Ionicons name="film-outline" size={22} color={theme.text.muted} />
      </View>
    );
  }
  return (
    <View style={[st.pPosterStack, { width: 60 + (list.length - 1) * 18 }]}>
      {list.map((p, i) => (
        <Image
          key={i}
          source={{ uri: p }}
          style={[st.pPoster, st.pPosterStackItem, { left: i * 18, zIndex: list.length - i, borderColor: theme.secondary }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
      ))}
    </View>
  );
}

// ── Post kartı (Postlar / Taslaklar / Beğeniler) — paylaşım ekranı görünümü ──
function PostMini({ theme, type, poll, posters = [], title, content, userRating, hasSpoiler, date, likes, comments, draft, action, onPress, onRemove }) {
  // Rozet + vurgu rengi feed'deki PostCard ile ortak (review/list/text/poll).
  const badge = postTypeBadge(type, theme.colors);
  const accent = badge.color;
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      {...(onPress ? { onPress, activeOpacity: 0.85 } : {})}
      style={[st.pCard, { backgroundColor: theme.secondary, borderColor: theme.border, borderLeftColor: accent }]}
    >
      <PosterStack posters={posters} theme={theme} />
      <View style={{ flex: 1 }}>
        <View style={st.pMeta}>
          <View style={[st.pBadge, { backgroundColor: accent + "22", borderColor: accent + "55" }]}>
            <Text style={[st.pBadgeText, { color: accent }]}>
              {i18nText(badge.labelKey, badge.fallback)}
            </Text>
          </View>
          {hasSpoiler ? (
            <View style={[st.pBadge, { backgroundColor: "rgba(240,79,79,0.12)", borderColor: "rgba(240,79,79,0.4)" }]}>
              <Text style={[st.pBadgeText, { color: "#f04f4f" }]}>{i18nText("autoI18n.spoiler", "SPOİLER")}</Text>
            </View>
          ) : null}
          {draft ? (
            <View style={[st.pBadge, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <Text style={[st.pBadgeText, { color: theme.text.muted }]}>{i18nText("autoI18n.taslak_upper", "TASLAK")}</Text>
            </View>
          ) : null}
          {date ? <Text style={[st.pTime, { color: theme.text.muted }]}>{fmtDate(date)}</Text> : null}
        </View>

        <Text style={[st.pTitle, { color: theme.text.primary }]} numberOfLines={2}>
          {title}
        </Text>
        {content ? (
          <Text style={[st.pContent, { color: theme.text.secondary }]} numberOfLines={2}>
            {content}
          </Text>
        ) : null}

        {type === "review" && userRating > 0 ? (
          <View style={st.pRatingRow}>
            <RatingStars rating={userRating} max={5} size={12} color={theme.colors.orange} />
            <Text style={[st.pRatingText, { color: theme.text.secondary }]}>{userRating}/5</Text>
          </View>
        ) : null}

        {type === "poll" && poll ? (
          <View style={st.pRatingRow}>
            <Ionicons name="stats-chart" size={12} color={accent} />
            <Text style={[st.pRatingText, { color: theme.text.secondary }]}>
              {i18nText("autoI18n.anket_ozeti", "{{options}} seçenek · {{votes}} oy", {
                options: poll.options?.length || 0,
                votes: tallyVotes(poll.votes).total,
              })}
            </Text>
          </View>
        ) : null}

        {action ? (
          <View style={st.pActionRow}>
            <Ionicons
              name={action === "like" ? "heart" : "bookmark"}
              size={14}
              color={action === "like" ? KIND_META.like.color : theme.accent}
            />
            <Text style={[st.pActionText, { color: action === "like" ? KIND_META.like.color : theme.accent }]}>
              {action === "like"
                ? i18nText("autoI18n.begendin", "Beğendin")
                : i18nText("autoI18n.kaydettin", "Kaydettin")}
            </Text>
            {onRemove ? (
              <TouchableOpacity
                onPress={onRemove}
                activeOpacity={0.8}
                hitSlop={8}
                style={[st.removePill, { backgroundColor: theme.primary, borderColor: theme.border }]}
              >
                <Ionicons name="close-circle" size={13} color={theme.text.secondary} />
                <Text style={[st.removePillText, { color: theme.text.secondary }]}>
                  {i18nText("autoI18n.kaldir", "Kaldır")}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : likes != null || comments != null ? (
          <View style={st.pStats}>
            <Ionicons name="heart-outline" size={15} color={theme.text.muted} />
            <Text style={[st.pStatText, { color: theme.text.muted }]}>{likes || 0}</Text>
            <Ionicons name="chatbubble-outline" size={14} color={theme.text.muted} style={{ marginLeft: 10 }} />
            <Text style={[st.pStatText, { color: theme.text.muted }]}>{comments || 0}</Text>
          </View>
        ) : null}
      </View>
    </Wrapper>
  );
}

// ── Story taslak kartı (StoryDraftsScreen görünümü) ──
function StoryMini({ theme, thumbnail, name, date, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={st.storyDraftCard}
    >
      <View style={[st.storyDraftThumbWrap, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={st.storyDraftThumb} contentFit="cover" />
        ) : (
          <View style={st.storyDraftEmpty}>
            <Ionicons name="image-outline" size={26} color={theme.text.muted} />
          </View>
        )}
        <View style={st.storyDraftOverlay} pointerEvents="none">
          <View style={[st.storyDraftTypeBadge, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
            <Ionicons name="images" size={10} color="#fff" />
            <Text style={st.storyDraftTypeText}>{i18nText("autoI18n.kind_story", "STORY")}</Text>
          </View>
          <View style={[st.storyDraftEditBadge, { backgroundColor: theme.accent }]}>
            <Ionicons name="create-outline" size={12} color="#fff" />
          </View>
        </View>
      </View>
      <Text allowFontScaling={false} numberOfLines={1} style={[st.storyDraftName, { color: theme.text.primary }]}>
        {name}
      </Text>
      <Text allowFontScaling={false} numberOfLines={1} style={[st.storyDraftDate, { color: theme.text.muted }]}>
        {fmtDate(date)}
      </Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },

  headerGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 160 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "800", letterSpacing: 0.2 },
  headerSub: { fontSize: 12, fontWeight: "600", marginTop: 1 },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  tabRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabText: { fontSize: 13, fontWeight: "700" },
  tabBadge: {
    minWidth: 18,
    paddingHorizontal: 5,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  tabBadgeText: { fontSize: 10, fontWeight: "800" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingRight: 14,
    paddingLeft: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderRadius: 4 },
  poster: { width: 48, height: 70, borderRadius: 10 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  info: { flex: 1, gap: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  kindChipText: { fontSize: 8, fontWeight: "800", letterSpacing: 0.6 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  badgeText: { fontSize: 8, fontWeight: "700", letterSpacing: 0.3 },
  title: { fontSize: 14.5, fontWeight: "700" },
  subtitle: { fontSize: 12 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  date: { fontSize: 10.5, fontWeight: "600" },

  scorePill: { alignItems: "flex-end", gap: 3 },
  scoreTxt: { fontSize: 14, fontWeight: "800" },

  // ── Satır aksiyon butonları (yorum düzenle/sil) ──
  rowActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Etkileşim "Kaldır" pili ──
  removePill: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 11,
    borderWidth: 1,
  },
  removePillText: { fontSize: 11.5, fontWeight: "700" },

  // ── Yorum düzenleme modalı ──
  editBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  editCard: { borderRadius: 22, borderWidth: 1, padding: 18 },
  editHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  editIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  editTitle: { fontSize: 17, fontWeight: "800" },
  editInput: {
    minHeight: 96,
    maxHeight: 200,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    fontSize: 14.5,
    textAlignVertical: "top",
  },
  editActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  editBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  editBtnText: { fontSize: 15, fontWeight: "800" },
  postStats: { flexDirection: "row", alignItems: "center", gap: 3 },
  statTxt: { fontSize: 11, fontWeight: "700" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 40 },
  emptyCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 15, fontWeight: "700", textAlign: "center" },

  // ── PostMini (paylaşım kartı görünümü) ──
  pCard: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  pPosterStack: { height: 88 },
  pPoster: { width: 60, height: 88, borderRadius: 8 },
  pPosterEmpty: { justifyContent: "center", alignItems: "center" },
  pPosterStackItem: { position: "absolute", top: 0, borderWidth: 2 },
  pMeta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 },
  pBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  pBadgeText: { fontSize: 8.5, fontWeight: "800", letterSpacing: 0.5 },
  pTime: { fontSize: 10.5, fontWeight: "600" },
  pTitle: { fontSize: 15, fontWeight: "800" },
  pContent: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  pRatingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  pRatingText: { fontSize: 12, fontWeight: "700" },
  pStats: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  pStatText: { fontSize: 12, fontWeight: "700" },
  pActionRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  pActionText: { fontSize: 12, fontWeight: "800" },

  // ── StoryMini: StoryDraftsScreen grid görünümü ──
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
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
  storyDraftThumb: { width: "100%", height: "100%" },
  storyDraftEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  storyDraftOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: 6,
  },
  storyDraftTypeBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  storyDraftTypeText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  storyDraftEditBadge: {
    alignSelf: "flex-start",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  storyDraftName: { fontSize: 12, fontWeight: "800", marginTop: 6 },
  storyDraftDate: { fontSize: 10, marginTop: 1 },
});
