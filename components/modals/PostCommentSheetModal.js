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
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import { LinearGradient } from "expo-linear-gradient";
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
} from "@expo/vector-icons";
import * as Haptics from "@services/hapticsService";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { getAvatarSource } from "@utils/avatars";
import { i18nText } from "@utils/i18nText";
import appAlert from "@components/AppAlert";
import { alpha } from "../../theme/colors";
import {
  subscribeToPostComments,
  addComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
} from "@services/postsService";

const { height: SCREEN_H } = Dimensions.get("window");

// Sheet içeriğe göre boyutlanır; bu iki sınır dengeyi kurar. Alt sınır boş ya
// da tek yorumluk listede sheet'in ince bir şeride dönmesini, üst sınır dolu
// listede ekranı tamamen kaplamasını engeller. (Aynı oranlar dizi/film yorum
// sayfasında da kullanılıyor — bkz. CommentSheetModal.js)
const SHEET_MAX_H = SCREEN_H * 0.82;
const SHEET_MIN_H = SCREEN_H * 0.5;

const EMPTY_INPUT = {
  text: "",
  parentId: null,
  editId: null,
  isReply: false,
  replieName: null,
};

const shortTimeAgo = (timestamp) => {
  const date = timestamp?.toDate?.() || (timestamp instanceof Date ? timestamp : null);
  const ms = date?.getTime?.() || 0;
  if (!ms) return i18nText("autoI18n.simdi", "şimdi");
  const minutes = Math.floor((Date.now() - ms) / 60000);
  if (minutes < 1) return i18nText("autoI18n.simdi", "şimdi");
  if (minutes < 60) return `${minutes}d`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}s`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}g`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}h`;
  return `${Math.floor(days / 365)}y`;
};

// ── Tek yorum satırı ───────────────────────────────────────
const CommentItem = memo(function CommentItem({
  item,
  currentUid,
  isReply,
  isLastReply,
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

  const timeText = shortTimeAgo(item.createdAt);

  const openOwnerMenu = () => {
    appAlert(
      i18nText("autoI18n.yorum_secenekleri", "Yorum seçenekleri"),
      undefined,
      [
        {
          text: i18nText("autoI18n.duzenle", "Düzenle"),
          onPress: () => onEdit(item, isReply),
        },
        {
          text: i18nText("autoI18n.sil", "Sil"),
          style: "destructive",
          onPress: () => onDelete(item),
        },
        { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
      ],
    );
  };

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
    <View style={[styles.threadItemContainer, isReply && styles.threadReplyItem]}>
      {isReply && <View pointerEvents="none" style={styles.replyElbow} />}
      {isReply && !isLastReply && (
        <View pointerEvents="none" style={styles.replyTrunk} />
      )}

      <View style={styles.threadAvatarColumn}>
        <View style={[styles.avatarFrame, isReply && styles.replyAvatarFrame]}>
          <Image
            source={avatarSrc}
            style={[styles.avatar, isReply && styles.replyAvatar]}
          />
        </View>
        {!isReply && replyCount > 0 && isRepliesVisible && (
          <View style={styles.threadLine} />
        )}
      </View>

      <View style={[styles.threadBody, isReply && styles.replyBody]}>
        <View style={styles.threadHeader}>
          <View style={styles.usernameRow}>
            <Text allowFontScaling={false} style={styles.username} numberOfLines={1}>
              {item.authorName || i18nText("autoI18n.kullanici", "Kullanıcı")}
            </Text>
            {!isReply && (
              <View style={styles.sourceBadge}>
                <Text allowFontScaling={false} style={styles.sourceBadgeText}>
                  {i18nText("autoI18n.topluluk", "Topluluk")}
                </Text>
              </View>
            )}
            <Text allowFontScaling={false} style={styles.timestamp}>{timeText}</Text>
          </View>
          {isOwner && (
            <TouchableOpacity onPress={openOwnerMenu} hitSlop={8}>
              <Feather name="more-horizontal" size={16} color={theme.text.muted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.threadContentBody}>
        <Text allowFontScaling={false} style={styles.commentText}>
          {item.text}
        </Text>
        </View>

        <View style={styles.threadActionsRow}>
          <TouchableOpacity onPress={onLikePress} style={styles.actionButton}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <MaterialCommunityIcons
                name={isLiked ? "heart" : "heart-outline"}
                size={18}
                color={isLiked ? theme.colors.red : theme.text.secondary}
              />
            </Animated.View>
            {likeCount > 0 && (
              <Text
                allowFontScaling={false}
                style={[styles.actionLabel, isLiked && { color: theme.colors.red }]}
              >
                {likeCount}
              </Text>
            )}
          </TouchableOpacity>

          {!isReply && (
            <TouchableOpacity onPress={() => onReply(item)} style={styles.actionButton}>
              <Ionicons
                name="chatbubble-outline"
                size={18}
                color={theme.text.secondary}
              />
              {replyCount > 0 && (
                <Text allowFontScaling={false} style={styles.actionLabel}>{replyCount}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {!isReply && replyCount > 0 && (
          <TouchableOpacity
            onPress={() => onToggleReplies(item.id)}
            style={styles.repliesToggle}
          >
            <View style={styles.repliesToggleLine} />
            <Text allowFontScaling={false} style={styles.repliesToggleText}>
              {isRepliesVisible
                ? i18nText("autoI18n.yanitlari_gizle", "Yanıtları gizle")
                : i18nText("autoI18n.yanitlari_gor", "Yanıtları gör ({{count}})", {
                    count: replyCount,
                  })}
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

  // Sheet animasyonu.
  // Yükseklik sabit değil, içerikten geliyor (bkz. styles.sheet:
  // minHeight/maxHeight); kapanışta kaydırılacak mesafe ölçümden okunuyor.
  // İlk açılışta ölçüm yokken üst sınır kullanılıyor — sheet yine ekranın
  // altında başlar, tek etkisi yolun biraz uzun olması.
  const slideAnim = useRef(new Animated.Value(SHEET_MAX_H)).current;
  const sheetHRef = useRef(SHEET_MAX_H);
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
          toValue: sheetHRef.current,
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
        toValue: sheetHRef.current,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [onClose]);

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
            replies.map((rep, index) => (
              <CommentItem
                key={rep.id}
                item={rep}
                currentUid={user?.uid}
                isReply
                isLastReply={index === replies.length - 1}
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
      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <ModalBlurBackdrop intensity={28} />
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
        onLayout={(e) => {
          sheetHRef.current = e.nativeEvent.layout.height;
        }}
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
          <View style={styles.headerTitleRow}>
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

          <View style={styles.miniPost}>
            <Image source={postAuthorAvatar} style={styles.miniPostAvatar} />

            <View style={styles.miniPostCopy}>
              <View style={styles.miniPostAuthorRow}>
                <Text allowFontScaling={false} style={styles.miniPostAuthor} numberOfLines={1}>
                  {post?.authorName || i18nText("autoI18n.kullanici", "Kullanıcı")}
                </Text>
                <View style={styles.miniPostTypeDot} />
                <Text allowFontScaling={false} style={styles.miniPostType} numberOfLines={1}>
                  {post?.type === "list"
                    ? i18nText("autoI18n.liste", "Liste")
                    : post?.type === "poll"
                      ? i18nText("autoI18n.anket", "Anket")
                      : post?.type === "text"
                        ? i18nText("autoI18n.sohbet", "Sohbet")
                        : i18nText("autoI18n.inceleme", "İnceleme")}
                </Text>
              </View>

              <Text allowFontScaling={false} style={styles.miniPostTitle} numberOfLines={1}>
                {post?.title || i18nText("autoI18n.gonderi", "Gönderi")}
              </Text>
              {!!post?.content && (
                <Text allowFontScaling={false} style={styles.miniPostContent} numberOfLines={1}>
                  {post.content}
                </Text>
              )}
            </View>

            {postPoster ? (
              <View style={styles.miniPostPosterWrap}>
                <Image source={{ uri: postPoster }} style={styles.miniPostPoster} contentFit="cover" />
                {post?.mediaList?.length > 1 && (
                  <View style={styles.miniPostMediaCount}>
                    <Text allowFontScaling={false} style={styles.miniPostMediaCountText}>
                      +{post.mediaList.length - 1}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.miniPostPosterPlaceholder}>
                <MaterialCommunityIcons
                  name={post?.type === "list" ? "format-list-bulleted" : "movie-open-outline"}
                  size={18}
                  color={theme.text.secondary}
                />
              </View>
            )}
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
              style={styles.list}
              data={topLevelSorted}
              keyExtractor={(c) => c.id}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={styles.feedSeparator} />}
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

            {/* Girdi hapı — AI sohbetindeki (screens/chat/AIChatScreen.js)
                composer ile aynı yapı: [input][gönder] tek parça, ikisi de 42px.
                Sarmalayıcı saydam ve ayırıcı çizgisiz; yalnız hap görünür. */}
            <View style={styles.composerPill}>
              <TextInput
                style={styles.input}
                placeholder={i18nText("autoI18n.yorum_yap", "Yorum yap...")}
                placeholderTextColor={theme.text.muted}
                value={input.text}
                onChangeText={(t) => setInput((p) => ({ ...p, text: t }))}
                maxLength={500}
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

    backdrop: { ...StyleSheet.absoluteFill },
    // Sheet yüksekliği değişken olduğu için kapatma alanı tüm ekranı kaplıyor;
    // sheet SONRA render edildiğinden (ve elevation'ı olduğundan) kendi
    // dokunuşlarını kendisi yakalar, buraya yalnız dışındaki boşluk kalır.
    backdropTouchable: {
      ...StyleSheet.absoluteFillObject,
    },

    sheet: {
      maxHeight: SHEET_MAX_H,
      minHeight: SHEET_MIN_H,
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
      paddingHorizontal: 18,
      paddingBottom: 12,
      gap: 10,
    },
    headerTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    miniPost: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 9,
      backgroundColor: alpha(theme.text.primary, 0.055),
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    miniPostAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: alpha(theme.text.primary, 0.16),
      alignSelf: "flex-start",
      marginTop: 1,
    },
    miniPostCopy: { flex: 1, minWidth: 0, gap: 2 },
    miniPostAuthorRow: {
      flexDirection: "row",
      alignItems: "center",
      minWidth: 0,
      marginBottom: 1,
    },
    miniPostAuthor: {
      maxWidth: "56%",
      color: theme.text.primary,
      fontSize: 12,
      fontWeight: "800",
    },
    miniPostTypeDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      marginHorizontal: 6,
      backgroundColor: theme.text.muted,
    },
    miniPostType: {
      color: theme.accent,
      fontSize: 9.5,
      fontWeight: "800",
    },
    miniPostTitle: {
      color: theme.text.primary,
      fontSize: 12.5,
      lineHeight: 17,
      fontWeight: "700",
    },
    miniPostContent: {
      color: theme.text.secondary,
      fontSize: 11,
      lineHeight: 15,
    },
    miniPostPosterWrap: {
      width: 42,
      height: 60,
      borderRadius: 9,
      overflow: "hidden",
      backgroundColor: theme.primary,
    },
    miniPostPoster: { width: "100%", height: "100%" },
    miniPostPosterPlaceholder: {
      width: 42,
      height: 60,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
    },
    miniPostMediaCount: {
      position: "absolute",
      right: 3,
      bottom: 3,
      minWidth: 20,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.7)",
    },
    miniPostMediaCountText: { color: "#fff", fontSize: 9, fontWeight: "800" },

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

    // flex:1 DEĞİL: sheet yüksekliğini içerikten aldığı için flex-basis 0
    // burayı sıfıra çökertirdi. flexBasis "auto" kalıyor; üst sınıra
    // dayanınca kısalıp içeride kaydırılıyor (shrink), alt sınır bağlarsa
    // boşluğu doldurup girdi kutusunu dipte tutuyor (grow).
    commentArea: { flexGrow: 1, flexShrink: 1, backgroundColor: theme.primary },
    list: { flexGrow: 1, flexShrink: 1 },
    listContent: { padding: 15, paddingBottom: 140, gap: 10 },
    feedSeparator: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: -15,
      backgroundColor: alpha(theme.border, 0.9),
    },

    // Yükleniyor / boş durum kutusu. flex:1 yerine sabit dolgu: sheet bu
    // kutunun yüksekliğini ölçerek boyutlanıyor. paddingBottom, mutlak
    // konumlu girdi kutusunun altta kaplayacağı yeri boş bırakıyor.
    center: {
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingTop: 34,
      paddingBottom: 150,
    },
    emptyText: { color: theme.text.muted, fontSize: 13, fontWeight: "600" },

    threadItemContainer: {
      flexDirection: "row",
      gap: 10,
    },
    threadReplyItem: { paddingLeft: 48 },
    threadAvatarColumn: {
      width: 38,
      alignItems: "center",
    },
    avatarFrame: {
      width: 38,
      height: 38,
      borderRadius: 19,
      marginTop: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: alpha(theme.border, 0.9),
      backgroundColor: theme.primary,
      overflow: "hidden",
    },
    replyAvatarFrame: {
      width: 30,
      height: 30,
      borderRadius: 15,
      marginTop: 8,
    },
    avatar: { width: 34, height: 34, borderRadius: 17 },
    replyAvatar: { width: 26, height: 26, borderRadius: 13 },
    threadLine: {
      flex: 1,
      width: 1.5,
      marginTop: 6,
      borderRadius: 1,
      backgroundColor: alpha(theme.border, 0.95),
    },
    replyElbow: {
      position: "absolute",
      left: 19,
      top: 0,
      width: 33,
      height: 23,
      borderLeftWidth: 1.5,
      borderBottomWidth: 1.5,
      borderBottomLeftRadius: 14,
      borderColor: alpha(theme.border, 0.95),
    },
    replyTrunk: {
      position: "absolute",
      left: 19,
      top: 0,
      bottom: 0,
      width: 1.5,
      backgroundColor: alpha(theme.border, 0.95),
    },
    threadBody: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 10,
    },
    replyBody: { paddingVertical: 8 },
    threadHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 3,
      gap: 8,
    },
    usernameRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    sourceBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 7,
      backgroundColor: alpha(theme.accent, 0.16),
    },
    sourceBadgeText: {
      color: theme.accent,
      fontSize: 8,
      fontWeight: "800",
    },
    username: {
      color: theme.text.primary,
      fontSize: 14,
      fontWeight: "700",
      flexShrink: 1,
    },
    timestamp: { color: theme.text.muted, fontSize: 12, fontWeight: "500" },
    threadContentBody: { marginTop: 1, marginBottom: 2 },
    commentText: { color: theme.text.primary, fontSize: 14, lineHeight: 20 },
    threadActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 22,
      marginTop: 8,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 2,
    },
    actionLabel: {
      color: theme.text.secondary,
      fontSize: 12.5,
      fontWeight: "600",
    },
    repliesToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 10,
      paddingVertical: 2,
    },
    repliesToggleLine: {
      width: 26,
      height: 1,
      backgroundColor: theme.text.muted,
      opacity: 0.5,
    },
    repliesToggleText: {
      color: theme.text.muted,
      fontSize: 12,
      fontWeight: "700",
    },

    // Girdi alanı AI sohbetindeki (screens/chat/AIChatScreen.js) composer ile
    // aynı: sarmalayıcı yalnız boşluk veriyor — arka plan ve üst ayırıcı çizgi
    // yok, gölge yalnız hapta. Liste kaydırılırken yorumlar hapın çevresindeki
    // boşluktan görünür; hedeflenen "yüzen hap" görünümü bu.
    inputWrapper: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: Platform.OS === "ios" ? 28 : 12,
    },
    composerPill: {
      flexDirection: "row",
      alignItems: "flex-end",
      borderWidth: 1.5,
      borderRadius: 28,
      borderColor: theme.border,
      backgroundColor: theme.secondary,
      padding: 5,
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 14,
      elevation: 10,
    },
    // Tek satırlık yükseklik gönder düğmesiyle aynı (42): hap flex-end
    // hizaladığı için kısa kalan input metni ikon merkezinden aşağı kayıyordu.
    input: {
      flex: 1,
      minHeight: 42,
      maxHeight: 130,
      paddingHorizontal: 12,
      paddingTop: Platform.OS === "ios" ? 11 : 8,
      paddingBottom: Platform.OS === "ios" ? 11 : 8,
      fontSize: 15,
      color: theme.text.primary,
      ...(Platform.OS === "android" ? { textAlignVertical: "center" } : null),
    },
    sendButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
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
