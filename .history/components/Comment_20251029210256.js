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
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import SwitchToggle from "../modules/SwitchToggle";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import SwipeCard from "../modules/SwipeCard";

// ==========================
// Comment Item Component
// ==========================
const CommentItem = memo(
  ({
    item,
    theme,
    currentUser,
    contextId,
    replies = [],
    toggleReplyVisibility,
    handleLikeToggle,
    isReply = false,
    setCommentInputState,
    openReplyBox,
    setOpenReplyBox,
  }) => {
    const [showSpoiler, setShowSpoiler] = useState(false);
    const [likeAnim] = useState(new Animated.Value(1));

    const handleHeartPress = () => {
      Animated.sequence([
        Animated.spring(likeAnim, { toValue: 1.5, useNativeDriver: true }),
        Animated.spring(likeAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();
      handleLikeToggle(item.id, item.likes?.includes(currentUser.uid));
    };

    const timeLabel = item.timestamp
      ? typeof item.timestamp.toDate === "function"
        ? item.timestamp.toDate().toLocaleString()
        : new Date(item.timestamp).toLocaleString()
      : "";

    const handleDeleteComment = async (commentId) => {
      try {
        const commentRef = doc(
          db,
          "MovieComment",
          contextId,
          "comments",
          commentId
        );
        await deleteDoc(commentRef);

        const repliesRef = collection(
          db,
          "MovieComment",
          contextId,
          "comments",
          commentId,
          "replies"
        );
        const repliesSnapshot = await getDocs(repliesRef);
        repliesSnapshot.forEach(async (repDoc) => {
          await deleteDoc(repDoc.ref);
        });
      } catch (err) {
        console.error("Yorum silinirken hata:", err);
      }
    };

    const handleDeleteReply = async (parentId, replyId) => {
      try {
        const replyRef = doc(
          db,
          "MovieComment",
          contextId,
          "comments",
          parentId,
          "replies",
          replyId
        );
        await deleteDoc(replyRef);
      } catch (err) {
        console.error("Yanıt silinirken hata:", err);
      }
    };

    return (
      <View
        style={{
          marginVertical: 5,
          padding: 8,
          backgroundColor: theme.primary,
          borderLeftWidth: 0.5,
          borderLeftColor:
            item.userId === currentUser.uid ? theme.colors.green : theme.border,
          borderRadius: 10,
          marginLeft: isReply ? 30 : 0,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          {item.avatar && (
            <Image
              source={{ uri: item.avatar }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                marginRight: 8,
              }}
            />
          )}
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontWeight: "bold", color: theme.text.primary }}>
                {item.username}
              </Text>
              <Text
                style={{ fontSize: 10, color: theme.text.muted, marginTop: 4 }}
              >
                {timeLabel}
              </Text>
            </View>

            {item.isSpoiler && !showSpoiler ? (
              <TouchableOpacity
                onPress={() => setShowSpoiler(true)}
                style={{
                  marginTop: 4,
                  padding: 6,
                  backgroundColor: theme.secondary,
                  borderRadius: 6,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontStyle: "italic", color: "#ccc" }}>
                  Spoiler içerik – görmek için tıkla
                </Text>
                <Ionicons
                  name="eye-off-sharp"
                  size={16}
                  color={theme.text.secondary}
                />
              </TouchableOpacity>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ marginTop: 4, color: theme.text.primary }}>
                  {item.text}
                </Text>

                {item.isSpoiler && (
                  <TouchableOpacity
                    onPress={() => setShowSpoiler(false)}
                    style={{
                      marginTop: 4,
                      padding: 6,
                      backgroundColor: theme.secondary,
                      borderRadius: 6,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Ionicons
                      name="eye-sharp"
                      size={16}
                      color={theme.text.secondary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Like / Reply Row */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 15 }}
              >
                <TouchableOpacity onPress={handleHeartPress}>
                  <Animated.Text
                    style={{
                      fontSize: 16,
                      transform: [{ scale: likeAnim }],
                      color: theme.text.secondary,
                    }}
                  >
                    {item.likes?.includes(currentUser.uid) ? (
                      <MaterialCommunityIcons
                        name="cards-heart"
                        size={16}
                        color={theme.colors?.red || "red"}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="cards-heart-outline"
                        size={16}
                        color={theme.text.secondary}
                      />
                    )}{" "}
                    {item.likes ? item.likes.length : 0}
                  </Animated.Text>
                </TouchableOpacity>

                {!isReply && (
                  <>
                    {replies.length > 0 && (
                      <TouchableOpacity
                        onPress={() => toggleReplyVisibility(item.id)}
                      >
                        <Text
                          style={{ color: theme.text.secondary, fontSize: 14 }}
                        >
                          <MaterialCommunityIcons
                            name="comment-text-multiple-outline"
                            size={16}
                            color={theme.text.secondary}
                          />
                          {"  "}
                          {replies.length} yanıtı gör
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() =>
                        setCommentInputState({
                          text: "",
                          isSpoiler: false,
                          parentId: item.id,
                          editId: null,
                          isReply: true,
                        })
                      }
                    >
                      <Text
                        style={{ color: theme.text.secondary, fontSize: 14 }}
                      >
                        Yanıtla
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {item.userId === currentUser.uid && (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        isReply
                          ? handleDeleteReply(item.parentId, item.id)
                          : handleDeleteComment(item.id);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Feather name="trash-2" size={16} color="red" />
                      <Text
                        style={{ color: theme.text.secondary, fontSize: 14 }}
                      >
                        Sil
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        setCommentInputState({
                          text: item.text,
                          isSpoiler: item.isSpoiler,
                          parentId: isReply ? item.parentId : null,
                          editId: item.id,
                          isReply: isReply,
                        })
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="pencil"
                        size={18}
                        color="green"
                      />
                      <Text
                        style={{ color: theme.text.secondary, fontSize: 14 }}
                      >
                        Düzenle
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }
);

// ==========================
// Main Comment Component
// ==========================
const Comment = ({ contextId }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const currentUser = user;
  const contextIdConvert = contextId.toString();

  const [comments, setComments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [replyVisibility, setReplyVisibility] = useState({});
  const [repliesMap, setRepliesMap] = useState({});
  const replyListenersRef = useRef({});

  const [commentInputState, setCommentInputState] = useState({
    text: "",
    isSpoiler: false,
    parentId: null,
    editId: null,
    isReply: false,
  });

  // --------------------------
  // Fetch comments
  // --------------------------
  useEffect(() => {
    if (!contextIdConvert) return;
    const commentsRef = collection(
      db,
      "MovieComment",
      contextIdConvert,
      "comments"
    );
    const q = query(commentsRef, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setComments(loaded);
    });
    return () => unsubscribe();
  }, [contextIdConvert]);

  // --------------------------
  // Manage reply listeners
  // --------------------------
  useEffect(() => {
    if (!contextIdConvert) return;

    comments.forEach((comment) => {
      if (replyListenersRef.current[comment.id]) return;
      const repliesRef = collection(
        db,
        "MovieComment",
        contextIdConvert,
        "comments",
        comment.id,
        "replies"
      );
      const q = query(repliesRef, orderBy("timestamp", "asc"));
      replyListenersRef.current[comment.id] = onSnapshot(q, (snap) => {
        const loaded = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          parentId: comment.id,
        }));
        setRepliesMap((prev) => ({ ...prev, [comment.id]: loaded }));
      });
    });

    return () => {
      Object.values(replyListenersRef.current).forEach((unsub) => unsub());
      replyListenersRef.current = {};
    };
  }, [comments]);

  // --------------------------
  // Toggle reply visibility
  // --------------------------
  const toggleReplyVisibility = (commentId) => {
    setReplyVisibility((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  // --------------------------
  // Like toggle
  // --------------------------
  const handleLikeToggle = async (id, liked) => {
    try {
      const ref = doc(db, "MovieComment", contextIdConvert, "comments", id);
      await updateDoc(ref, {
        likes: liked
          ? arrayRemove(currentUser.uid)
          : arrayUnion(currentUser.uid),
      });
    } catch (err) {
      console.error("Beğeni işlemi hata:", err);
    }
  };

  // --------------------------
  // Add or edit comment/reply
  // --------------------------
  const handleAddOrEdit = async () => {
    const { text, isSpoiler, parentId, editId, isReply } = commentInputState;
    if (!text.trim() || isSending) return;
    setIsSending(true);

    try {
      if (editId) {
        // Düzenleme
        const editRef = isReply
          ? doc(
              db,
              "MovieComment",
              contextIdConvert,
              "comments",
              parentId,
              "replies",
              editId
            )
          : doc(db, "MovieComment", contextIdConvert, "comments", editId);
        await updateDoc(editRef, { text: text.trim(), isSpoiler });
      } else {
        // Yeni
        const collectionPath = isReply
          ? collection(
              db,
              "MovieComment",
              contextIdConvert,
              "comments",
              parentId,
              "replies"
            )
          : collection(db, "MovieComment", contextIdConvert, "comments");
        await addDoc(collectionPath, {
          userId: currentUser.uid,
          username: currentUser.displayName || "Anonim",
          avatar: currentUser.photoURL || null,
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
      });
    } catch (err) {
      console.error("Yorum/reply ekleme/düzenleme hatası:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : null}
      style={{ flex: 1 }}
    >
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 10 }}
        renderItem={({ item }) => (
          <View>
            <CommentItem
              item={item}
              theme={theme}
              currentUser={currentUser}
              contextId={contextIdConvert}
              replies={repliesMap[item.id] || []}
              toggleReplyVisibility={toggleReplyVisibility}
              handleLikeToggle={handleLikeToggle}
              setCommentInputState={setCommentInputState}
            />
            {replyVisibility[item.id] &&
              repliesMap[item.id]?.map((rep) => (
                <CommentItem
                  key={rep.id}
                  item={rep}
                  theme={theme}
                  currentUser={currentUser}
                  contextId={contextIdConvert}
                  isReply
                  setCommentInputState={setCommentInputState}
                />
              ))}
          </View>
        )}
      />

      {/* ===================== */}
      {/* Input Section */}
      {/* ===================== */}
      <View
        style={{
          padding: 10,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          backgroundColor: theme.primary,
        }}
      >
        {commentInputState.isReply && (
          <View
            style={{
              width: 300,
              height: 50,
            }}
          >
            <Text>{commentInputState.text}</Text>
          </View>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 25,
            backgroundColor: theme.secondary,
            paddingHorizontal: 10,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              paddingVertical: 10,
              color: theme.text.primary,
            }}
            placeholder={
              commentInputState.isReply
                ? "Yanıtınızı yazın…"
                : "Yorumunuzu yazın…"
            }
            placeholderTextColor={theme.text.muted}
            multiline
            value={commentInputState.text}
            onChangeText={(txt) =>
              setCommentInputState((prev) => ({ ...prev, text: txt }))
            }
          />

          <TouchableOpacity
            onPress={handleAddOrEdit}
            style={{
              padding: 10,
              borderRadius: 20,
              backgroundColor: theme.accent,
              marginLeft: 5,
            }}
          >
            {isSending ? (
              <ActivityIndicator color={theme.text.secondary} />
            ) : (
              <MaterialCommunityIcons
                name="send-outline"
                size={20}
                color={theme.text.secondary}
              />
            )}
          </TouchableOpacity>
        </View>

        <View
          style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}
        >
          <Text style={{ color: theme.text.secondary, marginRight: 8 }}>
            Spoiler
          </Text>
          <SwitchToggle
            size={36}
            value={commentInputState.isSpoiler}
            onValueChange={(val) =>
              setCommentInputState((prev) => ({ ...prev, isSpoiler: val }))
            }
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default Comment;
