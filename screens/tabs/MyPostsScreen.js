import React, { useCallback, useEffect, useState } from "react";
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
import ModalBlurBackdrop from "../../components/common/ModalBlurBackdrop";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "../../components/AppIcon";
import RatingStars from "../../components/RatingStars";
import StaggerItem from "../../components/StaggerItem";
import CreatePostModal from "@components/modals/CreatePostModal";
import { MyPostsSkeleton } from "@components/Skeleton";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { usePosts } from "../../context/PostsContext";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import { fetchUserPosts } from "../../services/postsService";
import { i18nText } from "../../utils/i18nText";
import { postTypeBadge, tallyVotes } from "../../utils/postComposer";
import ScreenDecor from "@components/ScreenDecor";


// Basit göreli zaman (TR)
const timeAgo = (ms) => {
  if (!ms) return "";
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return i18nText("autoI18n.simdi", "şimdi");
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d} g`;
  const w = Math.floor(d / 7);
  return `${w} hf`;
};

// Sol taraftaki poster yığını (liste tipinde birden çok poster arka arkaya)
function PosterStack({ mediaList, theme }) {
  const posters = (mediaList || []).filter((m) => m?.poster).slice(0, 3);
  if (posters.length === 0) {
    return (
      <View
        style={[
          styles.poster,
          { backgroundColor: theme.border, alignItems: "center", justifyContent: "center" },
        ]}
      >
        <AppIcon family="Ionicons" name="film-outline" size={22} color={theme.text.muted} />
      </View>
    );
  }
  return (
    <View style={[styles.stack, { width: 64 + (posters.length - 1) * 18 }]}>
      {posters.map((m, i) => (
        <Image
          key={`${m.id}-${i}`}
          source={{ uri: m.poster }}
          style={[
            styles.poster,
            styles.stackItem,
            { left: i * 18, zIndex: posters.length - i, borderColor: theme.secondary },
          ]}
          contentFit="cover"
        />
      ))}
    </View>
  );
}

// Görseli olmayan tipler (text/poll) için poster ölçülerinde tip ikonlu kutu
function TypeIconBox({ icon, accent }) {
  return (
    <View
      style={[
        styles.poster,
        { backgroundColor: accent + "18", alignItems: "center", justifyContent: "center" },
      ]}
    >
      <AppIcon family="Ionicons" name={icon} size={24} color={accent} />
    </View>
  );
}

function MyPostCard({ post, theme, onMenu }) {
  // Rozet + vurgu rengi feed'deki PostCard ile ortak (review/list/text/poll).
  const badge = postTypeBadge(post.type, theme.colors);
  const accent = badge.color;
  const { getTmdbUrl } = useImageQualitySettings();

  // Sol görsel alan: review/list poster yığını; text ikon kutusu;
  // poll'de medya anketiyse seçenek posterleri, yoksa ikon kutusu.
  let visual;
  if (post.type === "text") {
    visual = <TypeIconBox icon="chatbubble-ellipses" accent={accent} />;
  } else if (post.type === "poll") {
    const pollPosters =
      post.poll?.type === "media"
        ? (post.poll.options || [])
            .filter((o) => o?.media?.poster_path)
            .slice(0, 3)
            .map((o, i) => ({
              id: o.id ?? i,
              poster: getTmdbUrl(o.media.poster_path, "poster", 200),
            }))
        : [];
    visual =
      pollPosters.length > 0 ? (
        <PosterStack mediaList={pollPosters} theme={theme} />
      ) : (
        <TypeIconBox icon="stats-chart" accent={accent} />
      );
  } else {
    visual = <PosterStack mediaList={post.mediaList} theme={theme} />;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          borderLeftColor: accent,
        },
      ]}
    >
      {visual}

      <View style={{ flex: 1 }}>
        <View style={styles.metaRow}>
          <View
            style={[
              styles.badge,
              { backgroundColor: accent + "22", borderColor: accent + "55" },
            ]}
          >
            <Text style={[styles.badgeText, { color: accent }]}>
              {i18nText(badge.labelKey, badge.fallback)}
            </Text>
          </View>
          {post.hasSpoiler && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: "rgba(240,79,79,0.12)",
                  borderColor: "rgba(240,79,79,0.4)",
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: "#f04f4f" }]}>{i18nText("autoI18n.spoiler", "SPOİLER")}</Text>
            </View>
          )}
          <Text style={[styles.time, { color: theme.text.muted }]}>
            {timeAgo(post._createdAtMs)}
          </Text>
          <TouchableOpacity
            hitSlop={8}
            onPress={() => onMenu(post)}
            style={styles.dotsBtn}
          >
            <AppIcon
              family="MaterialCommunityIcons"
              name="dots-vertical"
              size={18}
              color={theme.text.secondary}
            />
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={2}>
          {post.title}
        </Text>
        {post.content ? (
          // Sohbet'te görsel alan boş kalmadığından metne bir satır daha yer var
          <Text
            style={[styles.content, { color: theme.text.secondary }]}
            numberOfLines={post.type === "text" ? 3 : 2}
          >
            {post.content}
          </Text>
        ) : null}

        {/* Anket gövdesi: en çok oy alan 2 seçenek mini bar + özet (poll verisi yoksa çizilmez) */}
        {post.type === "poll" && post.poll?.options?.length > 0 && (() => {
          const { counts, total } = tallyVotes(post.poll.votes);
          // Composer dışı/eski veride null seçenek veya id'siz seçenek olabilir
          const top2 = post.poll.options
            .map((o, i) => ({ ...(o || {}), _idx: i, _count: counts[o?.id] || 0 }))
            .sort((a, b) => b._count - a._count)
            .slice(0, 2);
          return (
            <View style={styles.pollBox}>
              {top2.map((o) => {
                const p = total > 0 ? Math.round((o._count / total) * 100) : 0;
                return (
                  <View key={o.id ?? o._idx} style={styles.pollRow}>
                    <Text
                      style={[styles.pollLabel, { color: theme.text.secondary }]}
                      numberOfLines={1}
                    >
                      {o.label ||
                        i18nText("autoI18n.secenek_n", "Seçenek {{n}}", { n: o._idx + 1 })}
                    </Text>
                    <View style={[styles.pollBarTrack, { backgroundColor: theme.border }]}>
                      <View
                        style={[
                          styles.pollBarFill,
                          { width: `${p}%`, backgroundColor: accent },
                        ]}
                      />
                    </View>
                    <Text style={[styles.pollPct, { color: theme.text.muted }]}>%{p}</Text>
                  </View>
                );
              })}
              <Text style={[styles.pollSummary, { color: theme.text.muted }]}>
                {i18nText("autoI18n.anket_ozeti", "{{options}} seçenek · {{votes}} oy", {
                  options: post.poll.options.length,
                  votes: total,
                })}
              </Text>
            </View>
          );
        })()}

        {post.type === "review" && post.userRating > 0 && (
          <View style={styles.ratingRow}>
            <RatingStars rating={post.userRating} max={5} size={12} />
            <Text style={[styles.ratingText, { color: theme.text.secondary }]}>
              {post.userRating}/5
            </Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <AppIcon family="Ionicons" name="heart-outline" size={15} color={theme.text.muted} />
            <Text style={[styles.statText, { color: theme.text.muted }]}>
              {post.likesCount || 0}
            </Text>
          </View>
          <View style={styles.stat}>
            <AppIcon
              family="Ionicons"
              name="chatbubble-outline"
              size={15}
              color={theme.text.muted}
            />
            <Text style={[styles.statText, { color: theme.text.muted }]}>
              {post.commentsCount || 0}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function MyPostsScreen({ navigation }) {
  const { theme } = useTheme();
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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
      edges={["top"]}
    >
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor iconOpacity={0.25} />
      {/* Başlık */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          style={[styles.backBtn, { backgroundColor: theme.secondary }]}
        >
          <AppIcon family="Ionicons" name="chevron-back" size={22} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>{i18nText("autoI18n.postlarim", "Postlarım")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <MyPostsSkeleton count={5} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => (
            <StaggerItem index={index}>
              <MyPostCard post={item} theme={theme} onMenu={setMenuPost} />
            </StaggerItem>
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
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
            <View style={styles.empty}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: theme.secondary, borderColor: theme.border },
                ]}
              >
                <AppIcon
                  family="MaterialCommunityIcons"
                  name="post-outline"
                  size={40}
                  color={theme.text.muted}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{i18nText("autoI18n.henuz_paylasim_yok", "Henüz paylaşım yok")}</Text>
              <Text style={[styles.emptySub, { color: theme.text.secondary }]}>{i18nText("autoI18n.paylastigin_incelemeler_ve_listeler_burada_gorunur", "Paylaştığın incelemeler ve listeler burada görünür.")}</Text>
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
                  <Pressable
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
                  </Pressable>
                  <Pressable
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
                  </Pressable>
                </View>

                <Pressable style={menu.cancelRow} onPress={() => setMenuPost(null)}>
                  <Text style={[menu.cancelText, { color: theme.text.muted }]}>{i18nText("autoI18n.iptal", "İptal")}</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
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
              <Pressable
                style={[
                  menu.dialogBtn,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
                onPress={() => setConfirmPost(null)}
              >
                <Text style={[menu.dialogBtnText, { color: theme.text.primary }]}>{i18nText("autoI18n.vazgec", "Vazgeç")}</Text>
              </Pressable>
              <Pressable
                style={[menu.dialogBtn, { backgroundColor: "#f04f4f", borderColor: "#f04f4f" }]}
                onPress={handleConfirmDelete}
              >
                <Text style={[menu.dialogBtnText, { color: "#fff" }]}>{i18nText("autoI18n.sil", "Sil")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { flex: 1, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },

  card: {
    flexDirection: "row",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginBottom: 12,
  },
  poster: { width: 64, height: 96, borderRadius: 10, flexShrink: 0 },
  stack: { height: 96, flexShrink: 0, position: "relative" },
  stackItem: { position: "absolute", top: 0, borderWidth: 1.5 },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  time: { fontSize: 11, marginLeft: "auto" },
  dotsBtn: { marginLeft: 6, padding: 2 },
  title: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  content: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  ratingText: { fontSize: 12, fontWeight: "600" },
  pollBox: { gap: 5, marginBottom: 6 },
  pollRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pollLabel: { fontSize: 10, fontWeight: "600", maxWidth: "38%" },
  pollBarTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  pollBarFill: { height: "100%", borderRadius: 2 },
  pollPct: { fontSize: 10, fontWeight: "700", minWidth: 28, textAlign: "right" },
  pollSummary: { fontSize: 10, marginTop: 1 },
  statsRow: { flexDirection: "row", gap: 16, marginTop: 2 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, fontWeight: "600" },

  empty: { alignItems: "center", paddingTop: 70, paddingHorizontal: 32 },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", marginBottom: 6 },
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
