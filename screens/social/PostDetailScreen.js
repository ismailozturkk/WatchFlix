// screens/social/PostDetailScreen.js
//
// Tek bir gönderinin detayını gösterir. Bildirimlere (beğeni / yorum / yanıt /
// bahsetme) dokununca açılır: route.params = { postId, openComments? }.
//   - postId: zorunlu, Posts/{postId}
//   - openComments: true ise yorum sayfası otomatik açılır (yorum/yanıt/mention)
//
// Post'u fetchPost ile getirir, beğeni durumunu isPostLiked ile çözer; yorumlar
// için mevcut PostCommentSheetModal yeniden kullanılır.

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { getAvatarSource } from "@utils/avatars";
import { i18nText } from "@utils/i18nText";
import AppIcon from "@components/AppIcon";
import RatingStars from "@components/RatingStars";
import PostCommentSheetModal from "@components/modals/PostCommentSheetModal";
import { PostCardSkeleton } from "@components/Skeleton";
import { fetchPost, isPostLiked, toggleLike } from "@services/postsService";

// Basit göreli zaman (MyPostsScreen ile aynı kısaltmalar).
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
  return `${Math.floor(d / 7)} hf`;
};

export default function PostDetailScreen({ route, navigation }) {
  const { postId, openComments = false } = route.params || {};
  const { theme } = useTheme();
  const { user } = useAuth();
  const { selectAvatarIndex } = useProfileUi();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsVisible, setCommentsVisible] = useState(false);

  const load = useCallback(async () => {
    if (!postId) {
      setLoading(false);
      return;
    }
    const [p, isLiked] = await Promise.all([
      fetchPost(postId),
      isPostLiked(postId, user?.uid),
    ]);
    setPost(p);
    setLiked(isLiked);
    setLikesCount(p?.likesCount || 0);
    setLoading(false);
    // Yorum bildiriminden gelindiyse yorum sayfasını otomatik aç.
    if (p && openComments) setCommentsVisible(true);
  }, [postId, user?.uid, openComments]);

  useEffect(() => {
    load();
  }, [load]);

  const onToggleLike = useCallback(async () => {
    if (!post || !user?.uid) return;
    const next = !liked;
    // Optimistic
    setLiked(next);
    setLikesCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      await toggleLike(
        post.id,
        user.uid,
        liked,
        next
          ? {
              toUid: post.authorId,
              fromName: user.displayName || "",
              fromAvatarIndex:
                typeof selectAvatarIndex === "number" ? selectAvatarIndex : 0,
              postTitle: post.title,
            }
          : null,
        {
          title: post.title,
          authorName: post.authorName,
          type: post.type,
          poster: post.mediaList?.[0]?.poster || null,
        },
      );
    } catch (e) {
      // Geri al
      setLiked(liked);
      setLikesCount((c) => Math.max(0, c + (next ? -1 : 1)));
      if (__DEV__) console.warn("PostDetail like:", e?.message);
    }
  }, [post, user, liked, selectAvatarIndex]);

  // Yorum sayfası kapanınca sayıyı tazele (yeni yorum eklenmiş olabilir).
  const onCloseComments = useCallback(() => {
    setCommentsVisible(false);
    fetchPost(postId).then((p) => {
      if (p) setPost((prev) => (prev ? { ...prev, commentsCount: p.commentsCount } : p));
    });
  }, [postId]);

  const accent =
    post?.type === "list"
      ? theme.colors?.green || "#3ddc84"
      : theme.colors?.blue || "#4a7cf6";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
      edges={["top"]}
    >
      {/* Başlık */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          style={[styles.backBtn, { backgroundColor: theme.secondary }]}
        >
          <AppIcon family="Ionicons" name="chevron-back" size={22} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
          {i18nText("autoI18n.gonderi", "Gönderi")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ paddingTop: 8 }}>
          <PostCardSkeleton />
        </View>
      ) : !post ? (
        <View style={styles.center}>
          <AppIcon
            family="MaterialCommunityIcons"
            name="file-remove-outline"
            size={44}
            color={theme.text.muted}
          />
          <Text style={[styles.missingText, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.gonderi_bulunamadi", "Gönderi bulunamadı veya silinmiş.")}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Yazar satırı */}
          <View style={styles.authorRow}>
            <Image
              source={getAvatarSource(post.authorAvatarIndex ?? 0)}
              style={styles.avatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.authorName, { color: theme.text.primary }]} numberOfLines={1}>
                {post.authorName || i18nText("autoI18n.kullanici", "Kullanıcı")}
              </Text>
              <Text style={[styles.time, { color: theme.text.muted }]}>
                {timeAgo(post._createdAtMs)}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: accent + "22", borderColor: accent + "55" }]}>
              <Text style={[styles.badgeText, { color: accent }]}>
                {post.type === "list"
                  ? i18nText("autoI18n.liste_upper", "LİSTE")
                  : i18nText("autoI18n.inceleme_upper", "İNCELEME")}
              </Text>
            </View>
          </View>

          {/* Posterler */}
          {Array.isArray(post.mediaList) && post.mediaList.some((m) => m?.poster) && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.postersRow}
              contentContainerStyle={{ gap: 10 }}
            >
              {post.mediaList
                .filter((m) => m?.poster)
                .map((m, i) => (
                  <View key={`${m.id || i}`} style={styles.posterWrap}>
                    <Image source={{ uri: m.poster }} style={styles.poster} contentFit="cover" />
                    {m.title ? (
                      <Text
                        style={[styles.posterTitle, { color: theme.text.secondary }]}
                        numberOfLines={1}
                      >
                        {m.title}
                      </Text>
                    ) : null}
                  </View>
                ))}
            </ScrollView>
          )}

          {/* Spoiler rozeti */}
          {post.hasSpoiler && (
            <View
              style={[
                styles.badge,
                styles.spoilerBadge,
                { backgroundColor: "rgba(240,79,79,0.12)", borderColor: "rgba(240,79,79,0.4)" },
              ]}
            >
              <Text style={[styles.badgeText, { color: "#f04f4f" }]}>
                {i18nText("autoI18n.spoiler", "SPOİLER")}
              </Text>
            </View>
          )}

          {/* Başlık + içerik */}
          <Text style={[styles.title, { color: theme.text.primary }]}>{post.title}</Text>
          {post.content ? (
            <Text style={[styles.content, { color: theme.text.secondary }]}>{post.content}</Text>
          ) : null}

          {/* Derecelendirme (inceleme) */}
          {post.type === "review" && post.userRating > 0 && (
            <View style={styles.ratingRow}>
              <RatingStars rating={post.userRating} max={5} size={16} />
              <Text style={[styles.ratingText, { color: theme.text.secondary }]}>
                {post.userRating}/5
              </Text>
            </View>
          )}

          {/* Aksiyon çubuğu */}
          <View style={[styles.actionsBar, { borderColor: theme.border }]}>
            <TouchableOpacity style={styles.action} onPress={onToggleLike} activeOpacity={0.7}>
              <AppIcon
                family="Ionicons"
                name={liked ? "heart" : "heart-outline"}
                size={22}
                color={liked ? "#f04f4f" : theme.text.secondary}
              />
              <Text style={[styles.actionText, { color: liked ? "#f04f4f" : theme.text.secondary }]}>
                {likesCount}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.action}
              onPress={() => setCommentsVisible(true)}
              activeOpacity={0.7}
            >
              <AppIcon
                family="Ionicons"
                name="chatbubble-outline"
                size={20}
                color={theme.text.secondary}
              />
              <Text style={[styles.actionText, { color: theme.text.secondary }]}>
                {post.commentsCount || 0}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Yorum sayfası — PostCommentSheetModal RN Modal içinde mount edilmeli. */}
      <Modal
        animationType="none"
        transparent
        visible={commentsVisible}
        onRequestClose={onCloseComments}
        statusBarTranslucent
      >
        <PostCommentSheetModal
          visible={commentsVisible}
          post={post}
          onClose={onCloseComments}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 32 },
  missingText: { fontSize: 14, textAlign: "center", lineHeight: 20 },

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

  authorRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  authorName: { fontSize: 15, fontWeight: "700" },
  time: { fontSize: 12, marginTop: 2 },

  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  spoilerBadge: { alignSelf: "flex-start", marginBottom: 10 },

  postersRow: { marginBottom: 14 },
  posterWrap: { width: 92 },
  poster: { width: 92, height: 138, borderRadius: 12 },
  posterTitle: { fontSize: 11, marginTop: 5, fontWeight: "600" },

  title: { fontSize: 20, fontWeight: "800", marginBottom: 8, letterSpacing: -0.3 },
  content: { fontSize: 15, lineHeight: 22, marginBottom: 14 },

  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  ratingText: { fontSize: 14, fontWeight: "600" },

  actionsBar: {
    flexDirection: "row",
    gap: 24,
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontSize: 14, fontWeight: "700" },
});
