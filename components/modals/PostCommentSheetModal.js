// components/modals/PostCommentSheetModal.js
//
// Bir post'un yorumları için bottom-sheet modal.
// Film detayındaki CommentSheetModal + Comment ikilisinin post sürümü:
//   - Bottom-sheet animasyonlu kabuk (CommentSheetModal'dan)
//   - Yorum listesi + giriş alanı (Comment.js'den uyarlandı)
// Ama Firestore tarafı postsService üzerinden çalışır (Posts/{postId}/comments).
//
// Veri modeli (flat): üst yorumlar ve yanıtlar AYNI koleksiyonda; yanıtlar
// parentId alanıyla ayrışır. UI parentId'ye göre gruplar.
//
// Kullanım:
//   <PostCommentSheetModal
//     visible={commentPost != null}
//     post={commentPost}
//     onClose={() => setCommentPost(null)}
//   />

import { Image } from "expo-image";
import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  memo,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
} from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { getAvatarSource } from "@utils/avatars";
import { i18nText } from "@utils/i18nText";
import { alpha } from "../../theme/colors";
import {
  subscribeToPostComments,
  addComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
} from "@services/postsService";

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");

const EMPTY_INPUT = {
  text: "",
  parentId: null,
  editId: null,
  isReply: false,
  replieName: null,
};

// ── Tek yorum satırı ───────────────────────────────────────
const CommentItem = memo(function CommentItem({
  item,
  currentUid,
  isReply,
  replyCount,
  isRepliesVisible,
  onToggleReplies,
  onLike,
  onReply,
  onEdit,
  onDelete,
  theme,
  styles,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isLiked = !!item.likedBy?.[currentUid];
  const likeCount = item.likesCount || 0;
  const isOwner = item.authorId === currentUid;

  const avatarSrc =
    typeof item.authorAvatarIndex === "number"
      ? getAvatarSource(item.authorAvatarIndex)
      : getAvatarSource(0);

  const timeText = item.createdAt?.toDate
    ? item.createdAt.toDate().toLocaleString()
    : i18nText("autoI18n.az_once", "Az önce");

  const onLikePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
    onLike(item, isLiked);
  };

  return (
    <View
      style={[
        styles.itemContainer,
        isReply && styles.replyMargin,
        isOwner && styles.ownComment,
      ]}
    >
      <View style={styles.itemHeader}>
        <View style={styles.userInfo}>
          <Image source={avatarSrc} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text allowFontScaling={false} style={styles.username} numberOfLines={1}>
              {item.authorName || i18nText("autoI18n.kullanici", "Kullanıcı")}
            </Text>
            <Text allowFontScaling={false} style={styles.timestamp}>
              {timeText}
            </Text>
          </View>
        </View>

        {isOwner && (
          <View style={styles.ownerActions}>
            <TouchableOpacity onPress={() => onEdit(item, isReply)} hitSlop={8}>
              <Feather
                name="edit-2"
                size={14}
                color={theme.colors.green}
                style={{ marginRight: 12 }}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(item)} hitSlop={8}>
              <Feather name="trash-2" size={14} color={theme.colors.red} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.contentBody}>
        <Text allowFontScaling={false} style={styles.commentText}>
          {item.text}
        </Text>
      </View>

      <View style={styles.actionsRow}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={onLikePress} style={styles.actionButton}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <MaterialCommunityIcons
                name={isLiked ? "heart" : "heart-outline"}
                size={18}
                color={isLiked ? theme.colors.red : theme.text.secondary}
              />
            </Animated.View>
            <Text
              allowFontScaling={false}
              style={[styles.actionLabel, isLiked && { color: theme.colors.red }]}
            >
              {likeCount}
            </Text>
          </TouchableOpacity>

          {!isReply && (
            <TouchableOpacity onPress={() => onReply(item)} style={styles.actionButton}>
              <MaterialCommunityIcons
                name="reply-outline"
                size={18}
                color={theme.text.secondary}
              />
              <Text allowFontScaling={false} style={styles.actionLabel}>
                {i18nText("autoI18n.yanitla", "Yanıtla")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!isReply && replyCount > 0 && (
          <TouchableOpacity
            onPress={() => onToggleReplies(item.id)}
            style={styles.repliesToggle}
          >
            <Text allowFontScaling={false} style={styles.repliesToggleText}>
              {replyCount}{" "}
              {i18nText("autoI18n.yanit", "Yanıt")}{" "}
              {isRepliesVisible
                ? i18nText("autoI18n.gizle", "Gizle")
                : i18nText("autoI18n.gor", "Gör")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

export default function PostCommentSheetModal({ visible, post, onClose }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { selectAvatarIndex } = useProfileUi();
  const styles = getStyles(theme);

  const postId = post?.id;
  const postPoster = post?.mediaList?.find((item) => item?.poster)?.poster || null;
  const postAuthorAvatar =
    typeof post?.authorAvatarIndex === "number"
      ? getAvatarSource(post.authorAvatarIndex)
      : typeof post?.authorAvatar === "string"
        ? { uri: post.authorAvatar }
        : post?.authorAvatar || getAvatarSource(0);

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [replyVisibility, setReplyVisibility] = useState({});
  const [input, setInput] = useState(EMPTY_INPUT);

  // Sheet animasyonu
  const SHEET_H = SCREEN_H * 0.82;
  const slideAnim = useRef(new Animated.Value(SHEET_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 180,
          mass: 0.9,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_H,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Realtime yorum listener — modal görünür ve postId varken aktif.
  useEffect(() => {
    if (!visible || !postId) return;
    setLoading(true);
    const unsub = subscribeToPostComments(postId, (loaded) => {
      setComments(loaded);
      setLoading(false);
    });
    return () => unsub();
  }, [visible, postId]);

  // Modal kapanınca giriş alanını ve açık yanıtları sıfırla.
  useEffect(() => {
    if (!visible) {
      setInput(EMPTY_INPUT);
      setReplyVisibility({});
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SHEET_H,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [onClose, SHEET_H]);

  // ── Gruplama: üst yorumlar + parentId'ye göre yanıtlar ──
  const topLevel = [];
  const repliesByParent = {};
  for (const c of comments) {
    if (c.parentId) {
      (repliesByParent[c.parentId] = repliesByParent[c.parentId] || []).push(c);
    } else {
      topLevel.push(c);
    }
  }
  // En yeni üstte (createdAt artan geliyor → ters çevir)
  const topLevelSorted = [...topLevel].reverse();

  const toggleReplies = useCallback((id) => {
    setReplyVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ── Ekle / Düzenle ──
  const handleSubmit = useCallback(async () => {
    const { text, parentId, editId } = input;
    if (!text.trim() || isSending || !postId) return;
    if (!user?.uid) return;
    setIsSending(true);
    try {
      if (editId) {
        await updateComment(postId, editId, text, user.uid);
      } else {
        await addComment(postId, user, text, {
          parentId: parentId || null,
          authorAvatarIndex:
            typeof selectAvatarIndex === "number" ? selectAvatarIndex : 0,
          postTitle: post?.title || "",
          postPoster: post?.mediaList?.[0]?.poster || null,
        });
        // Yanıt yazıldıysa o thread'i otomatik aç
        if (parentId) {
          setReplyVisibility((prev) => ({ ...prev, [parentId]: true }));
        }
      }
      setInput(EMPTY_INPUT);
    } catch (e) {
      if (__DEV__) console.warn("post comment submit failed:", e.message);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, postId, user, selectAvatarIndex, post]);

  // ── Sil ──
  const handleDelete = useCallback(
    async (item) => {
      if (!postId) return;
      try {
        await deleteComment(postId, item.id, user?.uid);
        // Silinen düzenleniyorsa giriş alanını temizle
        setInput((p) => (p.editId === item.id ? EMPTY_INPUT : p));
      } catch (e) {
        if (__DEV__) console.warn("post comment delete failed:", e.message);
      }
    },
    [postId, user?.uid],
  );

  // ── Beğeni ──
  const handleLike = useCallback(
    async (item, isLiked) => {
      if (!postId || !user?.uid) return;
      try {
        await toggleCommentLike(postId, item.id, user.uid, isLiked);
      } catch (e) {
        if (__DEV__) console.warn("post comment like failed:", e.message);
      }
    },
    [postId, user?.uid],
  );

  // ── Düzenleme / Yanıt başlat ──
  const startEdit = useCallback((item) => {
    setInput({
      text: item.text,
      parentId: item.parentId || null,
      editId: item.id,
      isReply: !!item.parentId,
      replieName: item.authorName,
    });
  }, []);

  const startReply = useCallback((item) => {
    setInput({
      text: "",
      parentId: item.id,
      editId: null,
      isReply: true,
      replieName: item.authorName,
    });
  }, []);

  const renderItem = useCallback(
    ({ item }) => {
      const replies = repliesByParent[item.id] || [];
      const visible = replyVisibility[item.id];
      return (
        <View>
          <CommentItem
            item={item}
            currentUid={user?.uid}
            isReply={false}
            replyCount={replies.length}
            isRepliesVisible={visible}
            onToggleReplies={toggleReplies}
            onLike={handleLike}
            onReply={startReply}
            onEdit={startEdit}
            onDelete={handleDelete}
            theme={theme}
            styles={styles}
          />
          {visible &&
            replies.map((rep) => (
              <CommentItem
                key={rep.id}
                item={rep}
                currentUid={user?.uid}
                isReply
                onLike={handleLike}
                onEdit={startEdit}
                onDelete={handleDelete}
                theme={theme}
                styles={styles}
              />
            ))}
        </View>
      );
    },
    // repliesByParent/replyVisibility her render'da yeniden hesaplanıyor; kasıtlı
    [repliesByParent, replyVisibility, user?.uid, theme, styles],
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Karartma */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <BlurView
          tint="dark"
          intensity={28}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.82)"]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <TouchableOpacity
        style={styles.backdropTouchable}
        activeOpacity={1}
        onPress={handleClose}
      />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY: slideAnim }],
            backgroundColor: theme.secondary,
          },
        ]}
      >
        <View style={[styles.sheetTopGlow, { backgroundColor: theme.accent }]} />

        <View style={styles.handleWrapper}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.postPill}>
            {postPoster ? (
              <Image source={{ uri: postPoster }} style={styles.postPillPoster} contentFit="cover" />
            ) : (
              <View style={styles.postPillPosterPlaceholder}>
                <MaterialCommunityIcons
                  name={post?.type === "list" ? "format-list-bulleted" : "movie-open-outline"}
                  size={15}
                  color={theme.text.secondary}
                />
              </View>
            )}

            <Image source={postAuthorAvatar} style={styles.postAuthorAvatar} />
            <Text allowFontScaling={false} style={styles.postAuthorName} numberOfLines={1}>
              {post?.authorName || i18nText("autoI18n.kullanici", "Kullanıcı")}
            </Text>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.headerTitleGroup}>
              <MaterialCommunityIcons
                name="comment-text-multiple-outline"
                size={18}
                color={theme.text.secondary}
              />
              <Text allowFontScaling={false} style={styles.headerTitle}>
                {i18nText("autoI18n.yorumlar", "Yorumlar")}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Liste */}
        <View style={styles.commentArea}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.text.muted} />
            </View>
          ) : topLevelSorted.length === 0 ? (
            <View style={styles.center}>
              <MaterialCommunityIcons
                name="comment-outline"
                size={40}
                color={theme.text.muted}
              />
              <Text allowFontScaling={false} style={styles.emptyText}>
                {i18nText("autoI18n.ilk_yorumu_sen_yap", "İlk yorumu sen yap")}
              </Text>
            </View>
          ) : (
            <FlatList
              data={topLevelSorted}
              keyExtractor={(c) => c.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Giriş */}
          <View style={styles.inputWrapper}>
            {(input.isReply || input.editId) && (
              <View style={styles.activeModeIndicator}>
                <View style={styles.indicatorBadge}>
                  <Text allowFontScaling={false} style={styles.indicatorText}>
                    {input.editId
                      ? i18nText("autoI18n.duzenleniyor", "Düzenleniyor")
                      : i18nText("autoI18n.replying_to_user", "{{name}} kişisine yanıt", {
                          name: input.replieName,
                        })}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setInput(EMPTY_INPUT)}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.red} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder={i18nText("autoI18n.yorum_yap", "Yorum yap...")}
                placeholderTextColor={theme.text.muted}
                value={input.text}
                onChangeText={(t) => setInput((p) => ({ ...p, text: t }))}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendButton, !input.text.trim() && styles.disabledBtn]}
                onPress={handleSubmit}
                disabled={isSending || !input.text.trim()}
              >
                {isSending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Feather name="arrow-up" size={22} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },

    backdrop: { ...StyleSheet.absoluteFillObject },
    backdropTouchable: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: SCREEN_H * 0.82,
    },

    sheet: {
      height: SCREEN_H * 0.82,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.55,
      shadowRadius: 24,
      elevation: 28,
    },
    sheetTopGlow: {
      position: "absolute",
      top: 0,
      left: "15%",
      right: "15%",
      height: 1.5,
      opacity: 0.7,
      borderRadius: 1,
    },

    handleWrapper: { alignItems: "center", paddingTop: 10, paddingBottom: 6 },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.14)",
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingBottom: 12,
      gap: 10,
    },
    postPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: alpha(theme.text.primary, 0.06),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 5,
      paddingLeft: 5,
      paddingRight: 9,
      gap: 7,
      flex: 1,
      maxWidth: SCREEN_W * 0.54,
    },
    postPillPoster: {
      width: 28,
      height: 40,
      borderRadius: 8,
      backgroundColor: theme.primary,
    },
    postPillPosterPlaceholder: {
      width: 28,
      height: 40,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
    },
    postAuthorAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: alpha(theme.text.primary, 0.16),
    },
    postAuthorName: {
      flex: 1,
      fontSize: 12,
      fontWeight: "700",
      color: theme.text.primary,
      letterSpacing: 0.1,
    },

    headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    headerTitleGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
    headerTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text.primary,
      letterSpacing: 0.2,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: alpha(theme.text.primary, 0.07),
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
    },

    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
    },

    commentArea: { flex: 1 },
    listContent: { padding: 15, paddingBottom: 140 },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingBottom: 120,
    },
    emptyText: { color: theme.text.muted, fontSize: 13, fontWeight: "600" },

    itemContainer: {
      marginBottom: 14,
      backgroundColor: theme.primary,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    ownComment: {
      borderColor: alpha(theme.accent, 0.4),
      borderLeftWidth: 3,
      borderLeftColor: theme.accent,
    },
    replyMargin: {
      marginLeft: 32,
      borderLeftWidth: 2,
      borderLeftColor: theme.accent,
    },

    itemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    userInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    ownerActions: { flexDirection: "row", alignItems: "center" },
    avatar: { width: 34, height: 34, borderRadius: 17 },
    username: { color: theme.text.primary, fontSize: 13, fontWeight: "700" },
    timestamp: { color: theme.text.muted, fontSize: 10, marginTop: 1 },

    contentBody: { marginVertical: 6 },
    commentText: { color: theme.text.primary, fontSize: 14, lineHeight: 20 },

    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 8,
    },
    leftActions: { flexDirection: "row", gap: 18 },
    actionButton: { flexDirection: "row", alignItems: "center", gap: 5 },
    actionLabel: { color: theme.text.secondary, fontSize: 12, fontWeight: "600" },
    repliesToggle: { paddingVertical: 4 },
    repliesToggleText: {
      color: theme.text.secondary,
      fontSize: 12,
      fontWeight: "700",
    },

    inputWrapper: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 15,
      paddingBottom: Platform.OS === "ios" ? 28 : 15,
      borderTopWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.secondary,
    },
    inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    input: {
      flex: 1,
      minHeight: 45,
      maxHeight: 100,
      backgroundColor: theme.primary,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      color: theme.text.primary,
    },
    sendButton: {
      width: 45,
      height: 45,
      borderRadius: 22.5,
      backgroundColor: theme.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    disabledBtn: { opacity: 0.5 },

    activeModeIndicator: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    indicatorBadge: {
      backgroundColor: alpha(theme.accent, 0.15),
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    indicatorText: { color: theme.accent, fontSize: 11, fontWeight: "700" },
  });
