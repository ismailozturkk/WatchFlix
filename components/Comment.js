import { Image } from "expo-image";
import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  StyleSheet,
  Dimensions
} from "react-native";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  increment,
} from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { alpha } from "../theme/colors";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons, Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import LottieView from "lottie-react-native";
import { i18nText } from "../utils/i18nText";


const { height: SCREEN_H } = Dimensions.get("window");

const resolveTmdbAvatar = (path) => {
  if (!path) return null;
  if (path.startsWith("/http")) return path.slice(1);
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w185${path}`;
};

const getFeedTimestamp = (item) => {
  if (item.source === "tmdb") {
    return new Date(item.created_at || item.updated_at || 0).getTime() || 0;
  }
  if (typeof item.timestamp?.toMillis === "function") return item.timestamp.toMillis();
  return (item.timestamp?.seconds || 0) * 1000;
};

const TmdbReviewItem = memo(({ item, theme }) => {
  const styles = getStyles(theme);
  const [expanded, setExpanded] = useState(false);
  const avatarUri = resolveTmdbAvatar(item.author_details?.avatar_path);
  const author =
    item.author_details?.name ||
    item.author ||
    item.author_details?.username ||
    i18nText("autoI18n.tmdb_kullanicisi", "TMDB kullanıcısı");
  const rating = Number(item.author_details?.rating);
  const canExpand = (item.content || "").length > 220;
  const reviewDate = item.created_at
    ? new Date(item.created_at).toLocaleDateString()
    : "";

  return (
    <View style={[styles.itemContainer, styles.tmdbReviewContainer]}>
      <View style={styles.itemHeader}>
        <View style={styles.userInfo}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={[styles.avatar, styles.roundAvatar]} />
          ) : (
            <View style={[styles.avatar, styles.tmdbAvatarPlaceholder]}>
              <Ionicons name="person" size={17} color={theme.accent} />
            </View>
          )}
          <View style={styles.userTextGroup}>
            <View style={styles.usernameRow}>
              <Text allowFontScaling={false} style={styles.username} numberOfLines={1}>
                {author}
              </Text>
              <View style={[styles.sourceBadge, styles.tmdbSourceBadge]}>
                <Text allowFontScaling={false} style={[styles.sourceBadgeText, styles.tmdbSourceBadgeText]}>
                  TMDB
                </Text>
              </View>
            </View>
            <Text allowFontScaling={false} style={styles.timestamp}>
              {reviewDate}
            </Text>
          </View>
        </View>
        {Number.isFinite(rating) && rating > 0 && (
          <View style={styles.tmdbRatingBadge}>
            <Ionicons name="star" size={12} color="#FFD54F" />
            <Text allowFontScaling={false} style={styles.tmdbRatingText}>
              {rating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      <Text
        allowFontScaling={false}
        style={styles.commentText}
        numberOfLines={expanded ? undefined : 5}
      >
        {item.content}
      </Text>

      {canExpand && (
        <TouchableOpacity style={styles.readMoreButton} onPress={() => setExpanded((value) => !value)}>
          <Text allowFontScaling={false} style={styles.readMoreText}>
            {expanded
              ? i18nText("autoI18n.daha_az", "Daha az")
              : i18nText("autoI18n.devamini_oku", "Devamını oku")}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={theme.accent}
          />
        </TouchableOpacity>
      )}
    </View>
  );
});

// ── Yorum Satırı Bileşeni ──────────────────────────────────
const CommentItem = memo(
  ({
    item,
    currentUser,
    contextId,
    replies = [],
    toggleReplyVisibility,
    handleLikeToggle,
    isReply = false,
    setCommentInputState,
    handleDeleteComment,
    handleDeleteReply,
    isVisible,
    theme,
  }) => {
    const styles = getStyles(theme);
    const [showSpoiler, setShowSpoiler] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Yeni likedBy map formatı, eski likes array'ine fallback
    const isLiked = item.likedBy?.[currentUser.uid] ?? item.likes?.includes(currentUser.uid) ?? false;
    const likeCount = item.likeCount ?? item.likes?.length ?? 0;

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
      handleLikeToggle(item.id, isLiked);
    };

    // Show the reply count: prefer server-tracked field, fall back to loaded list length
    const totalReplies = Math.max(0, item.replyCount ?? 0) || replies.length;

    return (
      <View
        style={[
          styles.itemContainer,
          isReply && styles.replyMargin,
          item.userId === currentUser.uid && styles.ownComment,
        ]}
      >
        <View style={styles.itemHeader}>
          <View style={styles.userInfo}>
            {(item.avatar && (
              <Image
                source={
                  item.avatar
                    ? { uri: item.avatar }
                    : require("../assets/avatar/0.png")
                }
                style={styles.avatar}
              />
            )) || <Feather name="user" size={32} color="#fff" />}
            <View style={styles.userTextGroup}>
              <View style={styles.usernameRow}>
                <Text allowFontScaling={false} style={styles.username} numberOfLines={1}>
                  {item.username}
                </Text>
                {!isReply && (
                  <View style={styles.sourceBadge}>
                    <Text allowFontScaling={false} style={styles.sourceBadgeText}>
                      {i18nText("autoI18n.topluluk", "Topluluk")}
                    </Text>
                  </View>
                )}
              </View>
              <Text allowFontScaling={false} style={styles.timestamp}>
                {item.timestamp?.toDate
                  ? item.timestamp.toDate().toLocaleString()
                  : i18nText("autoI18n.az_once", "Az önce")}
              </Text>
            </View>
          </View>

          {/* Düzenle / Sil Aksiyonları */}
          {item.userId === currentUser.uid && (
            <View style={styles.ownerActions}>
              <TouchableOpacity
                onPress={() =>
                  setCommentInputState({
                    text: item.text,
                    isSpoiler: item.isSpoiler,
                    parentId: isReply ? item.parentId : null,
                    editId: item.id,
                    isReply: isReply,
                    replieName: item.username,
                    replieText: item.text,
                  })
                }
              >
                <Feather
                  name="edit-2"
                  size={14}
                  color={theme.colors.green}
                  style={{ marginRight: 10 }}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  isReply
                    ? handleDeleteReply(item.parentId, item.id)
                    : handleDeleteComment(item.id)
                }
              >
                <Feather name="trash-2" size={14} color={theme.colors.red} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.contentBody}>
          {item.isSpoiler && !showSpoiler ? (
            <TouchableOpacity
              onPress={() => setShowSpoiler(true)}
              style={styles.spoilerCover}
            >
              <BlurView intensity={25} tint="dark" style={styles.spoilerBlur}>
                <Ionicons
                  name="eye-off"
                  size={16}
                  color={theme.text.secondary}
                />
                <Text allowFontScaling={false} style={styles.spoilerText}>{i18nText("autoI18n.spoiler_icerigi_gor", "Spoiler içeriği gör")}</Text>
              </BlurView>
            </TouchableOpacity>
          ) : (
            <View style={styles.commentContentWrapper}>
              <Text allowFontScaling={false} style={styles.commentText}>
                {item.text}
              </Text>
              {item.isSpoiler && (
                <TouchableOpacity
                  onPress={() => setShowSpoiler(false)}
                  style={styles.eyeIconSmall}
                >
                  <Ionicons name="eye" size={14} color={theme.accent} />
                </TouchableOpacity>
              )}
            </View>
          )}
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
              <TouchableOpacity
                onPress={() =>
                  setCommentInputState((p) => ({
                    ...p,
                    parentId: item.id,
                    isReply: true,
                    replieName: item.username,
                    replieText: item.text,
                    editId: null,
                  }))
                }
                style={styles.actionButton}
              >
                <MaterialCommunityIcons
                  name="reply-outline"
                  size={18}
                  color={theme.text.secondary}
                />
                <Text allowFontScaling={false} style={styles.actionLabel}>{i18nText("autoI18n.yanitla", "Yanıtla")}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Only show toggle when there are (or were) replies */}
          {!isReply && totalReplies > 0 && (
            <TouchableOpacity
              onPress={() => toggleReplyVisibility(item.id)}
              style={styles.repliesToggle}
            >
              <Text allowFontScaling={false} style={styles.repliesToggleText}>
                {totalReplies}{i18nText("autoI18n.yanit", "Yanıt")}{isVisible ? "Gizle" : i18nText("autoI18n.gor", "Gör")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  },
);

// ── Ana Bileşen ───────────────────────────────────────────
// collectionName: "MovieComment" (film) | "TvComment" (dizi). Yapı birebir aynı.
const Comment = ({
  contextId,
  collectionName = "MovieComment",
  mediaTitle = "",
  mediaPoster = null,
  tmdbReviews = [],
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { user: currentUser } = useAuth();
  const [comments, setComments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [repliesMap, setRepliesMap] = useState({});
  const [replyVisibility, setReplyVisibility] = useState({});
  const [commentInputState, setCommentInputState] = useState({
    text: "",
    isSpoiler: false,
    parentId: null,
    editId: null,
    isReply: false,
    replieName: null,
    replieText: null,
  });

  // One ref per comment — stores its active onSnapshot unsubscribe fn
  const replyUnsubsRef = useRef({});

  const normalizedTmdbReviews = useMemo(
    () =>
      (Array.isArray(tmdbReviews) ? tmdbReviews : [])
        .filter((review) => review?.content)
        .map((review, index) => ({
          ...review,
          source: "tmdb",
          feedId: `tmdb:${review.id || index}`,
        })),
    [tmdbReviews],
  );

  const feedItems = useMemo(() => {
    const communityItems = comments.map((comment) => ({
      ...comment,
      source: "community",
      feedId: `community:${comment.id}`,
    }));

    if (sourceFilter === "community") return communityItems;
    if (sourceFilter === "tmdb") return normalizedTmdbReviews;

    return [...communityItems, ...normalizedTmdbReviews].sort((a, b) => {
      const timeDiff = getFeedTimestamp(b) - getFeedTimestamp(a);
      if (timeDiff !== 0) return timeDiff;
      return a.source === "community" ? -1 : 1;
    });
  }, [comments, normalizedTmdbReviews, sourceFilter]);

  const sourceFilters = [
    {
      key: "all",
      label: i18nText("autoI18n.tumu", "Tümü"),
      count: comments.length + normalizedTmdbReviews.length,
    },
    {
      key: "community",
      label: i18nText("autoI18n.topluluk", "Topluluk"),
      count: comments.length,
    },
    { key: "tmdb", label: "TMDB", count: normalizedTmdbReviews.length },
  ];

  // ── Comments listener ────────────────────────────────────
  useEffect(() => {
    if (!contextId) return;
    const cid = contextId.toString();
    const q = query(
      collection(db, collectionName, cid, "comments"),
      orderBy("timestamp", "desc"),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setComments(loaded);
    });
    return () => unsub();
  }, [contextId]);

  // ── Cleanup all reply subscriptions on unmount ───────────
  useEffect(() => {
    return () => {
      Object.values(replyUnsubsRef.current).forEach((u) => u());
      replyUnsubsRef.current = {};
    };
  }, []);

  // ── Lazy reply subscription: open on expand, close on collapse ──
  const toggleReplyVisibility = useCallback(
    (id) => {
      setReplyVisibility((prev) => {
        const willBeVisible = !prev[id];

        if (willBeVisible && !replyUnsubsRef.current[id]) {
          const cid = contextId.toString();
          const rq = query(
            collection(db, collectionName, cid, "comments", id, "replies"),
            orderBy("timestamp", "asc"),
          );
          replyUnsubsRef.current[id] = onSnapshot(rq, (snap) => {
            setRepliesMap((rm) => ({
              ...rm,
              [id]: snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
                parentId: id,
              })),
            }));
          });
        } else if (!willBeVisible && replyUnsubsRef.current[id]) {
          replyUnsubsRef.current[id]();
          delete replyUnsubsRef.current[id];
        }

        return { ...prev, [id]: willBeVisible };
      });
    },
    [contextId],
  );

  // ── Add / Edit ───────────────────────────────────────────
  const handleAddOrEdit = async () => {
    const { text, isSpoiler, parentId, editId, isReply } = commentInputState;
    if (!text.trim() || isSending) return;
    setIsSending(true);
    const cid = contextId.toString();

    try {
      let newRef = null;
      if (editId) {
        const ref = isReply
          ? doc(db, collectionName, cid, "comments", parentId, "replies", editId)
          : doc(db, collectionName, cid, "comments", editId);
        await updateDoc(ref, { text: text.trim(), isSpoiler });
      } else if (isReply) {
        newRef = await addDoc(
          collection(db, collectionName, cid, "comments", parentId, "replies"),
          {
            userId:    currentUser.uid,
            username:  currentUser.displayName || "Anonim",
            avatar:    currentUser.photoURL,
            text:      text.trim(),
            isSpoiler,
            parentId,
            likeCount: 0,
            likedBy:   {},
            timestamp: serverTimestamp(),
          },
        );
        // Increment replyCount on parent comment
        await updateDoc(doc(db, collectionName, cid, "comments", parentId), {
          replyCount: increment(1),
        });
      } else {
        newRef = await addDoc(
          collection(db, collectionName, cid, "comments"),
          {
            userId:     currentUser.uid,
            username:   currentUser.displayName || "Anonim",
            avatar:     currentUser.photoURL,
            text:       text.trim(),
            isSpoiler,
            parentId:   null,
            likeCount:  0,
            likedBy:    {},
            replyCount: 0,
            timestamp:  serverTimestamp(),
          },
        );
      }

      // Yeni yorum/yanıt eklendiyse: kullanıcının yorum sayacını artır VE
      // "Etkinliklerim → Yorumlarım" için denormalize kopya yaz (best-effort).
      // mirror doc id = yorum/yanıt id'si → silmede senkron kaldırılır.
      if (!editId && newRef) {
        updateDoc(doc(db, "Users", currentUser.uid), {
          mediaCommentCount: increment(1),
        }).catch(() => {});
        setDoc(doc(db, "Users", currentUser.uid, "myComments", newRef.id), {
          kind: collectionName === "TvComment" ? "tv" : "movie",
          targetId: cid,
          text: text.trim(),
          title: mediaTitle || "",
          poster: mediaPoster || null,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }

      setCommentInputState({
        text: "", isSpoiler: false, parentId: null,
        editId: null, isReply: false, replieName: null, replieText: null,
      });
    } finally {
      setIsSending(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────
  const handleDelete = async (id, pid = null) => {
    const cid = contextId.toString();
    if (pid) {
      await deleteDoc(
        doc(db, collectionName, cid, "comments", pid, "replies", id),
      );
      // Decrement replyCount (guard against going below 0)
      await updateDoc(doc(db, collectionName, cid, "comments", pid), {
        replyCount: increment(-1),
      });
    } else {
      // Close any open reply subscription before deleting the comment
      if (replyUnsubsRef.current[id]) {
        replyUnsubsRef.current[id]();
        delete replyUnsubsRef.current[id];
      }
      await deleteDoc(doc(db, collectionName, cid, "comments", id));
    }
    // Kullanıcının yorum sayacını azalt + denormalize kopyayı kaldır (best-effort).
    updateDoc(doc(db, "Users", currentUser.uid), {
      mediaCommentCount: increment(-1),
    }).catch(() => {});
    deleteDoc(doc(db, "Users", currentUser.uid, "myComments", id)).catch(() => {});
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : null}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      style={styles.container}
    >
      <View style={styles.sourceFilterRow}>
        {sourceFilters.map((filter) => {
          const selected = sourceFilter === filter.key;
          return (
            <TouchableOpacity
              key={filter.key}
              activeOpacity={0.8}
              onPress={() => setSourceFilter(filter.key)}
              style={[styles.sourceFilterButton, selected && styles.sourceFilterButtonActive]}
            >
              <Text
                allowFontScaling={false}
                style={[styles.sourceFilterText, selected && styles.sourceFilterTextActive]}
              >
                {filter.label}
              </Text>
              <View style={[styles.sourceFilterCount, selected && styles.sourceFilterCountActive]}>
                <Text
                  allowFontScaling={false}
                  style={[styles.sourceFilterCountText, selected && styles.sourceFilterCountTextActive]}
                >
                  {filter.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        style={styles.commentList}
        data={feedItems}
        keyExtractor={(item) => item.feedId}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="comment-text-multiple-outline"
              size={28}
              color={theme.text.muted}
            />
            <Text allowFontScaling={false} style={styles.emptyStateTitle}>
              {i18nText("autoI18n.henuz_yorum_yok", "Henüz yorum yok")}
            </Text>
            <Text allowFontScaling={false} style={styles.emptyStateText}>
              {sourceFilter === "tmdb"
                ? i18nText("autoI18n.tmdb_yorumu_bulunamadi", "Bu içerik için TMDB yorumu bulunamadı.")
                : i18nText("autoI18n.ilk_yorumu_sen_yap", "İlk yorumu sen yap.")}
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          item.source === "tmdb" ? (
            <TmdbReviewItem item={item} theme={theme} />
          ) : (
          <View>
            <CommentItem
              item={item}
              currentUser={currentUser}
              contextId={contextId}
              theme={theme}
              replies={repliesMap[item.id] || []}
              isVisible={replyVisibility[item.id]}
              toggleReplyVisibility={toggleReplyVisibility}
              handleLikeToggle={(id, liked) => {
                const ref = doc(db, collectionName, contextId.toString(), "comments", id);
                if (liked) {
                  updateDoc(ref, {
                    likeCount: increment(-1),
                    [`likedBy.${currentUser.uid}`]: deleteField(),
                  });
                } else {
                  updateDoc(ref, {
                    likeCount: increment(1),
                    [`likedBy.${currentUser.uid}`]: true,
                  });
                }
              }}
              setCommentInputState={setCommentInputState}
              handleDeleteComment={(id) => handleDelete(id)}
              handleDeleteReply={(pid, id) => handleDelete(id, pid)}
            />
            {replyVisibility[item.id] &&
              repliesMap[item.id]?.map((rep) => (
                <CommentItem
                  key={rep.id}
                  item={rep}
                  currentUser={currentUser}
                  isReply
                  theme={theme}
                  setCommentInputState={setCommentInputState}
                  handleDeleteReply={(pid, id) => handleDelete(id, pid)}
                  handleLikeToggle={(id, liked) => {
                    const ref = doc(
                      db, collectionName, contextId.toString(),
                      "comments", item.id, "replies", id,
                    );
                    if (liked) {
                      updateDoc(ref, {
                        likeCount: increment(-1),
                        [`likedBy.${currentUser.uid}`]: deleteField(),
                      });
                    } else {
                      updateDoc(ref, {
                        likeCount: increment(1),
                        [`likedBy.${currentUser.uid}`]: true,
                      });
                    }
                  }}
                />
              ))}
          </View>
          )
        }
      />

      {/* Input Section */}
      <View style={styles.inputWrapper}>
        {(commentInputState.isReply || commentInputState.editId) && (
          <View style={styles.activeModeIndicator}>
            <View style={styles.indicatorBadge}>
              <Text allowFontScaling={false} style={styles.indicatorText}>
                {commentInputState.editId
                  ? i18nText("autoI18n.duzenleniyor", "Düzenleniyor")
                  : i18nText("autoI18n.replying_to_user", "{{name}} kişisine yanıt", { name: commentInputState.replieName })}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                setCommentInputState({
                  text: "", isSpoiler: false, parentId: null,
                  editId: null, isReply: false, replieName: null, replieText: null,
                })
              }
            >
              <Ionicons name="close-circle" size={20} color={theme.colors.red} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputRow}>
          {commentInputState.isSpoiler && (
            <Text
              allowFontScaling={false}
              style={[
                styles.spoilerBtnText,
                commentInputState.isSpoiler && { color: theme.colors.red },
              ]}
            >
              Spoiler
            </Text>
          )}
          <TextInput
            style={[
              styles.input,
              commentInputState.isSpoiler && styles.spoilerCoverInput,
            ]}
            placeholder="Yorum yap..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={commentInputState.text}
            onChangeText={(t) =>
              setCommentInputState((p) => ({ ...p, text: t }))
            }
            multiline
          />

          <View style={styles.inputFooter}>
            <TouchableOpacity
              onPress={() =>
                setCommentInputState((p) => ({ ...p, isSpoiler: !p.isSpoiler }))
              }
              style={[
                styles.spoilerButton,
                commentInputState.isSpoiler && styles.spoilerActive,
              ]}
            >
              <MaterialCommunityIcons
                name="alert-decagram"
                size={16}
                color={
                  commentInputState.isSpoiler
                    ? theme.colors.red
                    : theme.text.muted
                }
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              !commentInputState.text.trim() && styles.disabledBtn,
            ]}
            onPress={handleAddOrEdit}
            disabled={isSending}
          >
            {isSending ? (
              <LottieView
                source={require("@lottie/loading15.json")}
                autoPlay
                loop
                style={{ width: 35, height: 35 }}
              />
            ) : (
              <Feather name="arrow-up" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.primary },
    commentList: { flex: 1 },
    listContent: { padding: 15, paddingBottom: 160, flexGrow: 1 },

    sourceFilterRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 15,
      paddingTop: 12,
      paddingBottom: 4,
      backgroundColor: theme.primary,
    },
    sourceFilterButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.secondary,
    },
    sourceFilterButtonActive: {
      borderColor: alpha(theme.accent, 0.55),
      backgroundColor: alpha(theme.accent, 0.16),
    },
    sourceFilterText: { color: theme.text.muted, fontSize: 12, fontWeight: "700" },
    sourceFilterTextActive: { color: theme.text.primary },
    sourceFilterCount: {
      minWidth: 19,
      height: 19,
      paddingHorizontal: 5,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
    },
    sourceFilterCountActive: { backgroundColor: alpha(theme.accent, 0.3) },
    sourceFilterCountText: { color: theme.text.muted, fontSize: 10, fontWeight: "800" },
    sourceFilterCountTextActive: { color: theme.text.primary },

    itemContainer: {
      marginBottom: 18,
      backgroundColor: theme.primary,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    ownComment: {
      borderColor: alpha(theme.accent, 0.3),
      backgroundColor: alpha(theme.accent, 0.5),
      borderWidth: 1,
      borderLeftWidth: 3,
      borderLeftColor: theme.accent,
    },
    replyMargin: {
      marginLeft: 35,
      borderLeftWidth: 2,
      borderLeftColor: theme.accent,
    },

    itemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    userInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    userTextGroup: { flex: 1, minWidth: 0 },
    usernameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    ownerActions: { flexDirection: "row", alignItems: "center" },
    avatar: { width: 34, height: 34 },
    roundAvatar: { borderRadius: 17 },
    username: { color: theme.text.primary, fontSize: 13, fontWeight: "700", flexShrink: 1 },
    timestamp: { color: theme.text.muted, fontSize: 10 },
    sourceBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 7,
      backgroundColor: alpha(theme.accent, 0.16),
    },
    sourceBadgeText: { color: theme.accent, fontSize: 8, fontWeight: "800" },
    tmdbSourceBadge: { backgroundColor: "rgba(1,180,228,0.14)" },
    tmdbSourceBadgeText: { color: "#01B4E4" },

    tmdbReviewContainer: {
      borderColor: "rgba(1,180,228,0.28)",
      borderLeftWidth: 3,
      borderLeftColor: "#01B4E4",
    },
    tmdbAvatarPlaceholder: {
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: alpha(theme.accent, 0.14),
    },
    tmdbRatingBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: "rgba(255,213,79,0.1)",
    },
    tmdbRatingText: { color: "#FFD54F", fontSize: 11, fontWeight: "800" },
    readMoreButton: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginTop: 10,
    },
    readMoreText: { color: theme.accent, fontSize: 12, fontWeight: "700" },

    contentBody: { marginVertical: 8 },
    commentText: { color: theme.text.primary, fontSize: 14, lineHeight: 20 },
    commentContentWrapper: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    eyeIconSmall: { padding: 4 },

    spoilerCover: { borderRadius: 12, overflow: "hidden" },
    spoilerBlur: {
      padding: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    spoilerText: { color: theme.text.secondary, fontSize: 12, fontWeight: "600" },

    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 10,
    },
    leftActions: { flexDirection: "row", gap: 18 },
    actionButton: { flexDirection: "row", alignItems: "center", gap: 5 },
    actionLabel: { color: theme.text.secondary, fontSize: 12, fontWeight: "600" },
    repliesToggle: { paddingVertical: 4 },
    repliesToggleText: { color: theme.text.secondary, fontSize: 12, fontWeight: "700" },

    inputWrapper: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 15,
      borderTopWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.primary,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      justifyContent: "space-between",
    },
    input: {
      flex: 1,
      minHeight: 45,
      maxHeight: 100,
      backgroundColor: theme.secondary,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      color: theme.text.primary,
    },
    spoilerCoverInput: {
      borderWidth: 1,
      borderColor: theme.notesColor.redBackground,
      overflow: "hidden",
    },

    sendButton: {
      width: 45,
      height: 45,
      borderRadius: 22.5,
      backgroundColor: theme.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    disabledBtn: { backgroundColor: theme.secondaryt, opacity: 0.5 },

    inputFooter: { flexDirection: "row", justifyContent: "flex-start" },
    spoilerButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 24,
      backgroundColor: theme.secondary,
    },
    spoilerActive: { backgroundColor: alpha(theme.colors.red, 0.1) },
    spoilerBtnText: {
      position: "absolute",
      top: -10,
      left: 15,
      color: theme.text.muted,
      fontSize: 12,
      fontWeight: "600",
      zIndex: 1,
    },

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
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      paddingBottom: 80,
    },
    emptyStateTitle: {
      color: theme.text.primary,
      fontSize: 15,
      fontWeight: "700",
      marginTop: 10,
    },
    emptyStateText: {
      color: theme.text.muted,
      fontSize: 12,
      textAlign: "center",
      marginTop: 4,
    },
  });

export default Comment;
