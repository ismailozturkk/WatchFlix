import { Image } from "expo-image";
import React, { useState, useEffect, useCallback, memo, useRef } from "react";
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
            <View>
              <Text allowFontScaling={false} style={styles.username}>
                {item.username}
              </Text>
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
const Comment = ({ contextId, collectionName = "MovieComment", mediaTitle = "", mediaPoster = null }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { user: currentUser } = useAuth();
  const [comments, setComments] = useState([]);
  const [isSending, setIsSending] = useState(false);
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
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
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
        )}
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
    listContent: { padding: 15, paddingBottom: 160 },

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
    userInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
    ownerActions: { flexDirection: "row", alignItems: "center" },
    avatar: { width: 34, height: 34 },
    username: { color: theme.text.primary, fontSize: 13, fontWeight: "700" },
    timestamp: { color: theme.text.muted, fontSize: 10 },

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
  });

export default Comment;
