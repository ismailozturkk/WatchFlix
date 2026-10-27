import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import ModalBlurBackdrop from "../../components/common/ModalBlurBackdrop";
// Ekran kökü: Premium şeridi yüzerken üst boşluğu ona göre büyür.
import SafeAreaView from "@components/common/ScreenSafeAreaView";
import AppIcon from "../../components/AppIcon";
import RatingStars from "../../components/RatingStars";
import StaggerItem from "../../components/StaggerItem";
import PosterStack, { STACK_POSTER_H, STACK_POSTER_W } from "../../components/feed/PosterStack";
import { postTypeMeta } from "../../components/feed/postTypeMeta";
import StatPill from "../../components/feed/StatPill";
import CreatePostModal from "@components/modals/CreatePostModal";
import { MyPostsSkeleton } from "@components/Skeleton";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { usePosts } from "../../context/PostsContext";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import { fetchUserPosts } from "../../services/postsService";
import { i18nText } from "../../utils/i18nText";
import { formatTimeAgo } from "../../utils/postTime";
import { postTypeBadge, tallyVotes } from "../../utils/postComposer";
import { alpha } from "../../theme/colors";
import ScreenDecor from "@components/ScreenDecor";
import BackButton from "@components/BackButton";

import ModalToastHost from "@components/toast/ModalToastHost";
import GlassPressable from "../../components/common/GlassPressable";
const LIKE_RED = "#FF5A5F";
const SPOILER_RED = "#f04f4f";

// Kartın sol görseli için poster adresleri. review/list: paylaşımın posterleri;
// medya anketi: seçenek posterleri. Sohbet ve metin anketinde görsel yok —
// kartın tamamı metne kalır.
function postPosterUris(post, getTmdbUrl) {
  if (post.type === "poll") {
    return post.poll?.type === "media"
      ? (post.poll.options || [])
          .filter((o) => o?.media?.poster_path)
          .map((o) => getTmdbUrl(o.media.poster_path, "poster", 200))
      : [];
  }
  if (post.type === "text") return [];
  return (post.mediaList || []).map((m) => m?.poster).filter(Boolean);
}

function MyPostCard({ post, theme, t, onMenu }) {
  // Rozet + vurgu rengi feed'deki kartla ortak (review/list/text/poll).
  const meta = postTypeMeta(post.type, theme.colors);
  const accent = meta.color;
  const { getTmdbUrl } = useImageQualitySettings();

  const timeText = formatTimeAgo(post._createdAtMs, t.shareScreen?.timeAgo);
  const likes = post.likesCount || 0;
  const comments = post.commentsCount || 0;

  const posterUris = postPosterUris(post, getTmdbUrl);
  // Poster bekleyen (review/list) ama görseli olmayan kayıt: tip ikonlu kutu.
  const hasVisual =
    posterUris.length > 0 || post.type === "review" || post.type === "list";
  const visual =
    posterUris.length > 0 ? (
      <PosterStack uris={posterUris} theme={theme} />
    ) : (
      <View
        style={[
          st.visualFallback,
          { backgroundColor: alpha(accent, 0.12), borderColor: alpha(accent, 0.3) },
        ]}
      >
        <AppIcon family="Ionicons" name="film-outline" size={26} color={accent} />
      </View>
    );

  // Anket gövdesi: en çok oy alan en fazla 3 seçenek + özet (poll verisi yoksa çizilmez).
  const pollBlock =
    post.type === "poll" && post.poll?.options?.length > 0
      ? (() => {
          const { counts, total } = tallyVotes(post.poll.votes);
          // Composer dışı/eski veride null seçenek veya id'siz seçenek olabilir
          const top = post.poll.options
            .map((o, i) => ({ ...(o || {}), _idx: i, _count: counts[o?.id] || 0 }))
            .sort((a, b) => b._count - a._count)
            .slice(0, 3);
          return (
            <View
              style={[st.pollBox, { backgroundColor: theme.primary, borderColor: theme.border }]}
            >
              {top.map((o, rank) => {
                const p = total > 0 ? Math.round((o._count / total) * 100) : 0;
                return (
                  <View key={o.id ?? o._idx} style={st.pollRow}>
                    <View style={st.pollRowHead}>
                      <Text
                        style={[st.pollLabel, { color: theme.text.primary }]}
                        numberOfLines={1}
                      >
                        {o.label ||
                          i18nText("autoI18n.secenek_n", "Seçenek {{n}}", { n: o._idx + 1 })}
                      </Text>
                      <Text style={[st.pollPct, { color: rank === 0 && total > 0 ? accent : theme.text.muted }]}>
                        %{p}
                      </Text>
                    </View>
                    <View style={[st.pollTrack, { backgroundColor: theme.border }]}>
                      <View
                        style={[
                          st.pollFill,
                          {
                            width: `${p}%`,
                            backgroundColor: rank === 0 && total > 0 ? accent : alpha(accent, 0.45),
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
              <Text style={[st.pollSummary, { color: theme.text.muted }]}>
                {i18nText("autoI18n.anket_ozeti", "{{options}} seçenek · {{votes}} oy", {
                  options: post.poll.options.length,
                  votes: total,
                })}
              </Text>
            </View>
          );
        })()
      : null;

  return (
    <View
      style={[st.shadow, { shadowColor: theme.shadow || "#000", backgroundColor: theme.secondary }]}
    >
      <View style={[st.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        {/* Tip rengiyle üstten yumuşak ışık */}
        <LinearGradient
          colors={[alpha(accent, 0.13), alpha(accent, 0)]}
          style={st.wash}
          pointerEvents="none"
        />

        {/* Rozet + zaman + menü */}
        <View style={st.metaRow}>
          <View
            style={[
              st.typePill,
              { backgroundColor: alpha(accent, 0.13), borderColor: alpha(accent, 0.32) },
            ]}
          >
            <AppIcon family="Ionicons" name={meta.icon} size={11} color={accent} />
            <Text style={[st.typeText, { color: accent }]}>{meta.label}</Text>
          </View>
          {post.hasSpoiler && (
            <View style={st.spoilerPill}>
              <AppIcon family="Ionicons" name="eye-off" size={10} color={SPOILER_RED} />
              <Text style={st.spoilerText}>{i18nText("autoI18n.spoiler", "SPOİLER")}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {!!timeText && (
            <Text style={[st.time, { color: theme.text.muted }]}>{timeText}</Text>
          )}
          <TouchableOpacity
            hitSlop={8}
            onPress={() => onMenu(post)}
            style={st.dotsBtn}
            accessibilityRole="button"
          >
            <AppIcon
              family="MaterialCommunityIcons"
              name="dots-vertical"
              size={19}
              color={theme.text.secondary}
            />
          </TouchableOpacity>
        </View>

        {/* Gövde: [görsel] + başlık/içerik */}
        <View style={st.body}>
          {hasVisual && <View style={st.visualCol}>{visual}</View>}
          <View style={st.copy}>
            <Text
              fontRole="body"
              style={[st.title, { color: theme.text.primary }]}
              numberOfLines={2}
            >
              {post.title}
            </Text>
            {post.content ? (
              post.type === "text" ? (
                <View
                  style={[
                    st.quote,
                    { backgroundColor: alpha(accent, 0.07), borderLeftColor: accent },
                  ]}
                >
                  <Text
                    fontRole="body"
                    style={[st.quoteText, { color: theme.text.primary }]}
                    numberOfLines={4}
                  >
                    {post.content}
                  </Text>
                </View>
              ) : (
                <Text
                  fontRole="body"
                  style={[st.content, { color: theme.text.secondary }]}
                  numberOfLines={hasVisual ? 4 : 3}
                >
                  {post.content}
                </Text>
              )
            ) : null}

            {post.type === "review" && post.userRating > 0 && (
              <View
                style={[st.ratingPill, { backgroundColor: theme.primary, borderColor: theme.border }]}
              >
                <RatingStars rating={post.userRating} max={5} size={12} />
                <Text style={[st.ratingText, { color: theme.text.primary }]}>
                  {post.userRating}/5
                </Text>
              </View>
            )}
          </View>
        </View>

        {pollBlock}

        {/* İstatistikler */}
        <View style={[st.footer, { borderTopColor: theme.border }]}>
          <StatPill
            icon="heart"
            active={likes > 0}
            activeColor={LIKE_RED}
            count={likes}
            theme={theme}
          />
          <StatPill
            icon="chatbubble"
            active={comments > 0}
            activeColor={theme.accent}
            count={comments}
            theme={theme}
          />
          {post.type === "list" && (post.mediaList || []).length > 0 && (
            <View style={st.footerRight}>
              <AppIcon family="Ionicons" name="albums-outline" size={14} color={accent} />
              <Text style={[st.footerRightText, { color: accent }]}>
                {i18nText("autoI18n.n_icerik", "{{n}} içerik", { n: post.mediaList.length })}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// Üst özet şeridi: yüklenen paylaşımların toplam sayısı / beğeni / yorum.
// Sayfalama bitmediyse değerler "+" ile biter (henüz hepsi yüklenmedi).
function SummaryStrip({ posts, hasMore, theme }) {
  const totals = useMemo(
    () =>
      posts.reduce(
        (acc, p) => ({
          likes: acc.likes + (p.likesCount || 0),
          comments: acc.comments + (p.commentsCount || 0),
        }),
        { likes: 0, comments: 0 },
      ),
    [posts],
  );
  const suffix = hasMore ? "+" : "";
  const items = [
    {
      key: "posts",
      icon: "albums",
      color: theme.accent,
      value: `${posts.length}${suffix}`,
      label: i18nText("autoI18n.myposts_stat_paylasim", "Paylaşım"),
    },
    {
      key: "likes",
      icon: "heart",
      color: LIKE_RED,
      value: `${totals.likes}${suffix}`,
      label: i18nText("autoI18n.myposts_stat_begeni", "Beğeni"),
    },
    {
      key: "comments",
      icon: "chatbubble",
      color: theme.colors?.blue || theme.accent,
      value: `${totals.comments}${suffix}`,
      label: i18nText("autoI18n.myposts_stat_yorum", "Yorum"),
    },
  ];

  return (
    <View style={st.summary}>
      {items.map((it) => (
        <View
          key={it.key}
          style={[st.summaryTile, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <View style={[st.summaryIcon, { backgroundColor: alpha(it.color, 0.15) }]}>
            <AppIcon family="Ionicons" name={it.icon} size={16} color={it.color} />
          </View>
          <View style={{ minWidth: 0 }}>
            <Text style={[st.summaryValue, { color: theme.text.primary }]} numberOfLines={1}>
              {it.value}
            </Text>
            <Text style={[st.summaryLabel, { color: theme.text.muted }]} numberOfLines={1}>
              {it.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function MyPostsScreen({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { deletePost: ctxDeletePost, editPost: ctxEditPost } = usePosts();
  const { getTmdbUrl } = useImageQualitySettings(); // menü önizlemesi (medya anketi posterleri)
  const uid = user?.uid;

  const [posts, setPosts] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Düzenle / Sil akışı
  const [menuPost, setMenuPost] = useState(null); // 3 nokta menüsü açık post
  const [confirmPost, setConfirmPost] = useState(null); // silme onayı
  const [editingPost, setEditingPost] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleEdit = useCallback((post) => {
    setMenuPost(null);
    setEditingPost(post);
    setModalVisible(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    const p = confirmPost;
    setConfirmPost(null);
    if (!p) return;
    const ok = await ctxDeletePost(p.id); // Firestore + feed güncelle
    if (ok) setPosts((prev) => prev.filter((x) => x.id !== p.id)); // yerel listeden çıkar
  }, [confirmPost, ctxDeletePost]);

  const handleSubmitEdit = useCallback(
    async (payload) => {
      if (!editingPost) return null;
      const ok = await ctxEditPost(editingPost.id, payload); // mevcut gönderiyi güncelle
      if (ok) {
        setPosts((prev) =>
          prev.map((x) =>
            x.id === editingPost.id
              ? {
                  ...x,
                  ...payload,
                  // Composer poll'u votes:{} ile gönderir; mevcut oylar yerelde
                  // sıfırlanmasın (sunucuda zaten updatePost poll'a yazmıyor).
                  poll: payload.poll
                    ? { ...payload.poll, votes: x.poll?.votes || {} }
                    : x.poll,
                  _createdAtMs: x._createdAtMs,
                }
              : x,
          ),
        );
        return true;
      }
      return null;
    },
    [editingPost, ctxEditPost],
  );

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setEditingPost(null);
  }, []);

  const load = useCallback(
    async ({ append = false } = {}) => {
      if (!uid) {
        setLoading(false);
        return;
      }
      try {
        const cursor = append ? lastDoc : null;
        const res = await fetchUserPosts(uid, cursor);
        setPosts((prev) => (append ? [...prev, ...res.posts] : res.posts));
        setLastDoc(res.lastDoc);
        setHasMore(!!res.lastDoc && res.posts.length > 0);
      } catch (e) {
        if (__DEV__) console.warn("[MyPosts] load:", e?.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [uid, lastDoc],
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setLastDoc(null);
    setHasMore(true);
    load({ append: false });
  }, [load]);

  const onEndReached = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    load({ append: true });
  }, [loadingMore, hasMore, loading, load]);

  // Eleman olarak verilir (bileşen tipi değil): liste güncellenince başlık
  // yeniden mount olmaz.
  const listHeader = useMemo(
    () =>
      posts.length > 0 ? <SummaryStrip posts={posts} hasMore={hasMore} theme={theme} /> : null,
    [posts, hasMore, theme],
  );

  const subtitle =
    !loading && posts.length > 0
      ? i18nText("autoI18n.myposts_n_paylasim", "{{n}} paylaşım", {
          n: `${posts.length}${hasMore ? "+" : ""}`,
        })
      : null;

  return (
    <SafeAreaView
      style={[st.container, { backgroundColor: theme.primary }]}
      edges={["top"]}
    >
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor scope="social" iconOpacity={0.25} />
      {/* Başlık */}
      <View style={st.header}>
        <BackButton absolute={false} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[st.headerTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {i18nText("autoI18n.postlarim", "Postlarım")}
          </Text>
          {!!subtitle && (
            <Text style={[st.headerSub, { color: theme.text.secondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <MyPostsSkeleton count={4} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => (
            <StaggerItem index={index}>
              <MyPostCard post={item} theme={theme} t={t} onMenu={setMenuPost} />
            </StaggerItem>
          )}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.text.muted}
            />
          }
          ListEmptyComponent={
            <View style={st.empty}>
              <View
                style={[
                  st.emptyHalo,
                  { backgroundColor: alpha(theme.accent, 0.1), borderColor: alpha(theme.accent, 0.22) },
                ]}
              >
                <View
                  style={[
                    st.emptyIcon,
                    { backgroundColor: theme.secondary, borderColor: theme.border },
                  ]}
                >
                  <AppIcon
                    family="MaterialCommunityIcons"
                    name="post-outline"
                    size={38}
                    color={theme.accent}
                  />
                </View>
              </View>
              <Text style={[st.emptyTitle, { color: theme.text.primary }]}>{i18nText("autoI18n.henuz_paylasim_yok", "Henüz paylaşım yok")}</Text>
              <Text style={[st.emptySub, { color: theme.text.secondary }]}>{i18nText("autoI18n.paylastigin_incelemeler_ve_listeler_burada_gorunur", "Paylaştığın incelemeler ve listeler burada görünür.")}</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator color={theme.text.muted} />
              </View>
            ) : null
          }
        />
      )}

      {/* 3 nokta menüsü — içerik önizleme + yan yana Düzenle/Sil */}
      <Modal
        visible={!!menuPost}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuPost(null)}
      >
        <Pressable style={menu.backdrop} onPress={() => setMenuPost(null)}>
          <ModalBlurBackdrop intensity={25} />
          <View
            style={[menu.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          >
            <View style={[menu.handle, { backgroundColor: theme.border }]} />

            {menuPost && (
              <>
                {/* İçerik önizleme (yığılmış posterler) */}
                <View
                  style={[
                    menu.preview,
                    { backgroundColor: theme.primary, borderColor: theme.border },
                  ]}
                >
                  {(() => {
                    // Kartla aynı görsel dil: medya anketinde seçenek
                    // posterleri, görselsiz text/poll'de rozet renkli ikon.
                    const pBadge = postTypeBadge(menuPost.type, theme.colors);
                    let posters = (menuPost.mediaList || [])
                      .filter((m) => m?.poster)
                      .slice(0, 3);
                    if (menuPost.type === "poll" && menuPost.poll?.type === "media") {
                      const optPosters = (menuPost.poll.options || [])
                        .filter((o) => o?.media?.poster_path)
                        .slice(0, 3)
                        .map((o, i) => ({
                          id: o.id ?? i,
                          poster: getTmdbUrl(o.media.poster_path, "poster", 200),
                        }));
                      if (optPosters.length > 0) posters = optPosters;
                    }
                    if (posters.length === 0) {
                      const tinted =
                        menuPost.type === "text" || menuPost.type === "poll";
                      return (
                        <View
                          style={[
                            menu.previewPoster,
                            {
                              backgroundColor: tinted
                                ? pBadge.color + "18"
                                : theme.border,
                              alignItems: "center",
                              justifyContent: "center",
                            },
                          ]}
                        >
                          <AppIcon
                            family="Ionicons"
                            name={
                              menuPost.type === "text"
                                ? "chatbubble-ellipses"
                                : menuPost.type === "poll"
                                  ? "stats-chart"
                                  : "film-outline"
                            }
                            size={20}
                            color={tinted ? pBadge.color : theme.text.muted}
                          />
                        </View>
                      );
                    }
                    return (
                      <View
                        style={[menu.previewStack, { width: 52 + (posters.length - 1) * 16 }]}
                      >
                        {posters.map((m, i) => (
                          <Image
                            key={`${m.id}-${i}`}
                            source={{ uri: m.poster }}
                            style={[
                              menu.previewPoster,
                              menu.previewStackItem,
                              {
                                left: i * 16,
                                zIndex: posters.length - i,
                                borderColor: theme.secondary,
                              },
                            ]}
                            contentFit="cover"
                          />
                        ))}
                      </View>
                    );
                  })()}
                  <View style={{ flex: 1, gap: 5 }}>
                    <View
                      style={[
                        menu.previewBadge,
                        {
                          backgroundColor:
                            postTypeBadge(menuPost.type, theme.colors).color + "22",
                          borderColor:
                            postTypeBadge(menuPost.type, theme.colors).color + "55",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          menu.previewBadgeText,
                          { color: postTypeBadge(menuPost.type, theme.colors).color },
                        ]}
                      >
                        {i18nText(
                          postTypeBadge(menuPost.type, theme.colors).labelKey,
                          postTypeBadge(menuPost.type, theme.colors).fallback,
                        )}
                      </Text>
                    </View>
                    <Text
                      style={[menu.previewTitle, { color: theme.text.primary }]}
                      numberOfLines={1}
                    >
                      {menuPost.title}
                    </Text>
                    {menuPost.content ? (
                      <Text
                        style={[menu.previewContent, { color: theme.text.secondary }]}
                        numberOfLines={2}
                      >
                        {menuPost.content}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Yan yana aksiyonlar */}
                <View style={menu.actionRow}>
                  <GlassPressable
                    style={[
                      menu.actionHalf,
                      { backgroundColor: theme.primary, borderColor: theme.border },
                    ]}
                    onPress={() => handleEdit(menuPost)}
                  >
                    <View
                      style={[
                        menu.actionIcon,
                        { backgroundColor: (theme.colors?.blue || "#4a7cf6") + "22" },
                      ]}
                    >
                      <AppIcon
                        family="Ionicons"
                        name="create-outline"
                        size={20}
                        color={theme.colors?.blue || "#4a7cf6"}
                      />
                    </View>
                    <Text style={[menu.actionText, { color: theme.text.primary }]}>{i18nText("autoI18n.duzenle", "Düzenle")}</Text>
                  </GlassPressable>
                  <GlassPressable
                    style={[
                      menu.actionHalf,
                      { backgroundColor: theme.primary, borderColor: theme.border },
                    ]}
                    onPress={() => {
                      const p = menuPost;
                      setMenuPost(null);
                      setConfirmPost(p);
                    }}
                  >
                    <View
                      style={[menu.actionIcon, { backgroundColor: "rgba(240,79,79,0.15)" }]}
                    >
                      <AppIcon family="Ionicons" name="trash-outline" size={20} color="#f04f4f" />
                    </View>
                    <Text style={[menu.actionText, { color: "#f04f4f" }]}>{i18nText("autoI18n.sil", "Sil")}</Text>
                  </GlassPressable>
                </View>

                <Pressable style={menu.cancelRow} onPress={() => setMenuPost(null)}>
                  <Text style={[menu.cancelText, { color: theme.text.muted }]}>{i18nText("autoI18n.iptal", "İptal")}</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
        <ModalToastHost visible={!!menuPost} />
      </Modal>

      {/* Silme onayı */}
      <Modal
        visible={!!confirmPost}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmPost(null)}
      >
        <View style={menu.dialogBackdrop}>
          <ModalBlurBackdrop intensity={25} />
          <View
            style={[menu.dialog, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          >
            <View style={menu.dialogIcon}>
              <AppIcon family="Ionicons" name="alert-circle" size={36} color="#f04f4f" />
            </View>
            <Text style={[menu.dialogTitle, { color: theme.text.primary }]}>{i18nText("autoI18n.paylasimi_sil", "Paylaşımı sil")}</Text>
            <Text style={[menu.dialogMsg, { color: theme.text.secondary }]}>{i18nText("autoI18n.bu_paylasim_kalici_olarak_silinecek_bu_islem_geri_", "Bu paylaşım kalıcı olarak silinecek. Bu işlem geri alınamaz.")}</Text>
            <View style={menu.dialogActions}>
              <GlassPressable
                style={[
                  menu.dialogBtn,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
                onPress={() => setConfirmPost(null)}
              >
                <Text style={[menu.dialogBtnText, { color: theme.text.primary }]}>{i18nText("autoI18n.vazgec", "Vazgeç")}</Text>
              </GlassPressable>
              <GlassPressable
                style={[menu.dialogBtn, { backgroundColor: "#f04f4f", borderColor: "#f04f4f" }]}
                onPress={handleConfirmDelete}
              >
                <Text style={[menu.dialogBtnText, { color: "#fff" }]}>{i18nText("autoI18n.sil", "Sil")}</Text>
              </GlassPressable>
            </View>
          </View>
        </View>
        <ModalToastHost visible={!!confirmPost} />
      </Modal>

      {/* Düzenleme modalı */}
      <CreatePostModal
        visible={modalVisible}
        onClose={handleCloseModal}
        onSubmit={handleSubmitEdit}
        editingPost={editingPost}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    gap: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  headerSub: { fontSize: 13, marginTop: 1 },

  // Özet şeridi
  summary: { flexDirection: "row", gap: 8, marginBottom: 16 },
  summaryTile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: { fontSize: 17, fontWeight: "900", letterSpacing: -0.3 },
  summaryLabel: { fontSize: 10.5, fontWeight: "700", marginTop: 1 },

  // Kart (iOS gölgesi overflow:hidden ile kırpılır → gölge dış sarmalayıcıda)
  shadow: {
    marginBottom: 14,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  wash: { position: "absolute", left: 0, right: 0, top: 0, height: 140 },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeText: { fontSize: 9.5, fontWeight: "900", letterSpacing: 0.4 },
  spoilerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: "rgba(240,79,79,0.12)",
  },
  spoilerText: { color: SPOILER_RED, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.4 },
  time: { fontSize: 12, fontWeight: "500" },
  dotsBtn: { padding: 2 },

  body: { flexDirection: "row", gap: 14 },
  visualCol: { flexShrink: 0 },
  visualFallback: {
    width: STACK_POSTER_W,
    height: STACK_POSTER_H,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, lineHeight: 23, fontWeight: "800", marginBottom: 6, letterSpacing: -0.2 },
  content: { fontSize: 13.5, lineHeight: 20, marginBottom: 8 },
  quote: {
    borderLeftWidth: 3,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  quoteText: { fontSize: 14, lineHeight: 21 },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ratingText: { fontSize: 11.5, fontWeight: "800" },

  // Anket gövdesi
  pollBox: {
    gap: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginTop: 10,
  },
  pollRow: { gap: 5 },
  pollRowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pollLabel: { flex: 1, fontSize: 12.5, fontWeight: "700" },
  pollPct: { fontSize: 12, fontWeight: "900" },
  pollTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  pollFill: { height: "100%", borderRadius: 3 },
  pollSummary: { fontSize: 11, fontWeight: "600", marginTop: 1 },

  // İstatistikler
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerRight: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  footerRightText: { fontSize: 12, fontWeight: "800" },

  empty: { alignItems: "center", paddingTop: 50, paddingHorizontal: 32 },
  emptyHalo: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 19 },
});

const menu = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    paddingBottom: 30,
    paddingTop: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: 16,
    opacity: 0.5,
  },

  preview: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  previewPoster: { width: 52, height: 78, borderRadius: 9, flexShrink: 0 },
  previewStack: { height: 78, flexShrink: 0, position: "relative" },
  previewStackItem: { position: "absolute", top: 0, borderWidth: 1.5 },
  previewBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  previewBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  previewTitle: { fontSize: 14, fontWeight: "700" },
  previewContent: { fontSize: 12, lineHeight: 17 },

  actionRow: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 6 },
  actionHalf: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: { fontSize: 15, fontWeight: "700" },
  cancelRow: { paddingVertical: 14, alignItems: "center", marginTop: 6 },
  cancelText: { fontSize: 15, fontWeight: "600" },

  // Silme onayı
  dialogBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 360,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
  },
  dialogIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(240,79,79,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  dialogTitle: { fontSize: 19, fontWeight: "800", marginBottom: 8, textAlign: "center" },
  dialogMsg: { fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 24 },
  dialogActions: { flexDirection: "row", gap: 12, width: "100%" },
  dialogBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  dialogBtnText: { fontSize: 15, fontWeight: "700" },
});
