import React, { useState, useEffect, useCallback, memo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  arrayUnion,
  arrayRemove,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
} from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { alpha } from "../theme/colors";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons, Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import LottieView from "lottie-react-native";

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
      handleLikeToggle(item.id, item.likes?.includes(currentUser.uid));
    };

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
                  : "Az önce"}
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
                <Text allowFontScaling={false} style={styles.spoilerText}>
                  Spoiler içeriği gör
                </Text>
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
                  name={
                    item.likes?.includes(currentUser.uid)
                      ? "heart"
                      : "heart-outline"
                  }
                  size={18}
                  color={
                    item.likes?.includes(currentUser.uid)
                      ? theme.colors.red
                      : theme.text.secondary
                  }
                />
              </Animated.View>
              <Text
                allowFontScaling={false}
                style={[
                  styles.actionLabel,
                  item.likes?.includes(currentUser.uid) && {
                    color: theme.colors.red,
                  },
                ]}
              >
                {item.likes?.length || 0}
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
                <Text allowFontScaling={false} style={styles.actionLabel}>
                  Yanıtla
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {!isReply && replies.length > 0 && (
            <TouchableOpacity
              onPress={() => toggleReplyVisibility(item.id)}
              style={styles.repliesToggle}
            >
              <Text allowFontScaling={false} style={styles.repliesToggleText}>
                {replies.length} Yanıt {isVisible ? "Gizle" : "Gör"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  },
);

// ── Ana Bileşen ───────────────────────────────────────────
const Comment = ({ contextId }) => {
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

  // Firestore Dinleyicileri (Orijinal Mantık Korundu)
  useEffect(() => {
    if (!contextId) return;
    const cid = contextId.toString();
    const q = query(
      collection(db, "MovieComment", cid, "comments"),
      orderBy("timestamp", "desc"),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setComments(loaded);
    });
    return () => unsub();
  }, [contextId]);

  // Yanıt Dinleyicileri
  useEffect(() => {
    if (!contextId) return;
    const cid = contextId.toString();
    comments.forEach((comment) => {
      const rq = query(
        collection(db, "MovieComment", cid, "comments", comment.id, "replies"),
        orderBy("timestamp", "asc"),
      );
      onSnapshot(rq, (snap) => {
        setRepliesMap((prev) => ({
          ...prev,
          [comment.id]: snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            parentId: comment.id,
          })),
        }));
      });
    });
  }, [comments]);

  const handleAddOrEdit = async () => {
    const { text, isSpoiler, parentId, editId, isReply } = commentInputState;
    if (!text.trim() || isSending) return;
    setIsSending(true);
    const cid = contextId.toString();

    try {
      if (editId) {
        const ref = isReply
          ? doc(
              db,
              "MovieComment",
              cid,
              "comments",
              parentId,
              "replies",
              editId,
            )
          : doc(db, "MovieComment", cid, "comments", editId);
        await updateDoc(ref, { text: text.trim(), isSpoiler });
      } else {
        const col = isReply
          ? collection(db, "MovieComment", cid, "comments", parentId, "replies")
          : collection(db, "MovieComment", cid, "comments");
        await addDoc(col, {
          userId: currentUser.uid,
          username: currentUser.displayName || "Anonim",
          avatar: currentUser.photoURL,
          text: text.trim(),
          isSpoiler,
          parentId: isReply ? parentId : null,
          likes: [],
          timestamp: serverTimestamp(),
        });
      }
      setCommentInputState({
        text: "",
        isSpoiler: false,
        parentId: null,
        editId: null,
        isReply: false,
        replieName: null,
        replieText: null,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id, pid = null) => {
    const cid = contextId.toString();
    if (pid)
      await deleteDoc(
        doc(db, "MovieComment", cid, "comments", pid, "replies", id),
      );
    else await deleteDoc(doc(db, "MovieComment", cid, "comments", id));
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
              toggleReplyVisibility={(id) =>
                setReplyVisibility((p) => ({ ...p, [id]: !p[id] }))
              }
              handleLikeToggle={(id, liked) => {
                const ref = doc(
                  db,
                  "MovieComment",
                  contextId.toString(),
                  "comments",
                  id,
                );
                updateDoc(ref, {
                  likes: liked
                    ? arrayRemove(currentUser.uid)
                    : arrayUnion(currentUser.uid),
                });
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
                      db,
                      "MovieComment",
                      contextId.toString(),
                      "comments",
                      item.id,
                      "replies",
                      id,
                    );
                    updateDoc(ref, {
                      likes: liked
                        ? arrayRemove(currentUser.uid)
                        : arrayUnion(currentUser.uid),
                    });
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
                  ? "Düzenleniyor"
                  : `${commentInputState.replieName} kişisine yanıt`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                setCommentInputState({
                  text: "",
                  isSpoiler: false,
                  parentId: null,
                  editId: null,
                  isReply: false,
                  replieName: null,
                  replieText: null,
                })
              }
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.colors.red}
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputRow}>
          {commentInputState.isSpoiler && (
            <Text
              allowFontScaling={false}
              style={[
                styles.spoilerBtnText,
                commentInputState.isSpoiler && {
                  color: theme.colors.red,
                },
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
                setCommentInputState((p) => ({
                  ...p,
                  isSpoiler: !p.isSpoiler,
                }))
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
                source={require("../LottieJson/loading15.json")}
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
    avatar: {
      width: 34,
      height: 34,
    },
    username: { color: theme.text.primary, fontSize: 13, fontWeight: "700" },
    timestamp: { color: theme.text.muted, fontSize: 10 },

    contentBody: { marginVertical: 8 },
    commentText: {
      color: theme.text.primary,
      fontSize: 14,
      lineHeight: 20,
    },
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
    spoilerText: {
      color: theme.text.secondary,
      fontSize: 12,
      fontWeight: "600",
    },

    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 10,
    },
    leftActions: { flexDirection: "row", gap: 18 },
    actionButton: { flexDirection: "row", alignItems: "center", gap: 5 },
    actionLabel: {
      color: theme.text.secondary,
      fontSize: 12,
      fontWeight: "600",
    },
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
      borderTopWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.primary,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 6,
      alignItems: "center",
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

    inputFooter: {
      flexDirection: "row",
      justifyContent: "flex-start",
    },
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
