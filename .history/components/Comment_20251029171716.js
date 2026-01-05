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
} from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import SwitchToggle from "../modules/SwitchToggle";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { AntDesign, Ionicons } from "@expo/vector-icons";

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
      ? // timestamp serverTimestamp may be a Firestore Timestamp
        typeof item.timestamp.toDate === "function"
        ? item.timestamp.toDate().toLocaleString()
        : new Date(item.timestamp).toLocaleString()
      : "";

    return (
      <View
        style={{
          marginVertical: 5,
          padding: 8,
          backgroundColor: theme.primary,
          borderRadius: 10,
          marginLeft: isReply ? 30 : 0,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          {item.avatar ? (
            <Image
              source={{ uri: item.avatar }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                marginRight: 8,
              }}
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "bold", color: theme.text.primary }}>
              {item.username}
            </Text>

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
                  name="eye-sharp"
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
                      name="eye-off-sharp"
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
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <View>
                <TouchableOpacity onPress={handleHeartPress}>
                  <Animated.Text
                    style={{
                      fontSize: 16,
                      marginRight: 12,
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
                {replies.length > 0 && !isReply && (
                  <TouchableOpacity
                    onPress={() => toggleReplyVisibility(item.id)}
                    style={{ marginRight: 12 }}
                  >
                    <Text style={{ color: theme.text.secondary, fontSize: 14 }}>
                      💬 {replies.length} yanıtı gör
                    </Text>
                  </TouchableOpacity>
                )}
                {!isReply && (
                  <TouchableOpacity
                    onPress={() =>
                      setOpenReplyBox(openReplyBox === item.id ? null : item.id)
                    }
                  >
                    <Text style={{ color: theme.text.secondary, fontSize: 14 }}>
                      Yanıtla
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 10,
                    color: theme.text.muted,
                    marginTop: 4,
                  }}
                >
                  {timeLabel}
                </Text>
              </View>
            </View>

            {/* Reply Box */}
            {openReplyBox === item.id && (
              <ReplyInput
                theme={theme}
                contextId={contextId}
                parentId={item.id}
                currentUser={currentUser}
                closeBox={() => setOpenReplyBox(null)}
              />
            )}

            {/* Nested Replies (if any) are rendered by parent component */}
          </View>
        </View>
      </View>
    );
  }
);

// ==========================
// Reply Input Component
// ==========================
const ReplyInput = ({ theme, contextId, parentId, currentUser, closeBox }) => {
  const [replyText, setReplyText] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleAddReply = async () => {
    if (!replyText.trim() || isSending) return;
    setIsSending(true);
    try {
      const commentsRef = collection(
        db,
        "MovieComment",
        contextId,
        "comments",
        parentId,
        "replies"
      );
      await addDoc(commentsRef, {
        userId: currentUser.uid,
        username: currentUser.displayName || "Anonim",
        avatar: currentUser.photoURL || null,
        text: replyText.trim(),
        isSpoiler,
        parentId,
        likes: [],
        timestamp: serverTimestamp(),
      });
      setReplyText("");
      setIsSpoiler(false);
      closeBox();
    } catch (err) {
      console.error("Yanıt eklenirken hata:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={{ marginTop: 8 }}>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 20,
          paddingHorizontal: 12,
          paddingVertical: 6,
          color: theme.text.primary,
          marginBottom: 4,
        }}
        placeholder="Yanıtınızı yazın…"
        placeholderTextColor={theme.text.muted}
        value={replyText}
        onChangeText={setReplyText}
        blurOnSubmit={false}
      />
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <SwitchToggle
          size={30}
          value={isSpoiler}
          onValueChange={setIsSpoiler}
        />
        <TouchableOpacity
          onPress={handleAddReply}
          style={{
            marginLeft: 8,
            backgroundColor: theme.accent,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
          }}
        >
          {isSending ? (
            <ActivityIndicator />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Gönder</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ==========================
// Main Comment Component
// ==========================
const Comment = ({ contextId }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const currentUser = user;

  const contextIdConvert = contextId.toString();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [openReplyBox, setOpenReplyBox] = useState(null);
  const [replyVisibility, setReplyVisibility] = useState({}); // hangi yorumların yanıtı açıldı
  const [isSending, setIsSending] = useState(false);

  // repliesMap: parentId -> [replies]
  const [repliesMap, setRepliesMap] = useState({});
  const replyListenersRef = useRef({}); // parentId -> unsubscribe fn

  // --------------------------
  // Fetch top-level comments
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
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const loaded = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setComments(loaded);
        } catch (err) {
          console.error("Yorumları çekerken hata:", err);
        }
      },
      (err) => {
        console.error("Yorum snapshot hata:", err);
      }
    );

    return () => unsubscribe();
  }, [contextIdConvert]);

  // --------------------------
  // Manage reply listeners for each top-level comment
  // - create listener for new comments that don't have one
  // - remove listeners for deleted comments
  // - cleanup on unmount
  // --------------------------
  useEffect(() => {
    if (!contextIdConvert) return;

    // Create listeners for comments that lack one
    comments.forEach((comment) => {
      if (replyListenersRef.current[comment.id]) return; // already listening

      const repliesRef = collection(
        db,
        "MovieComment",
        contextIdConvert,
        "comments",
        comment.id,
        "replies"
      );
      const q = query(repliesRef, orderBy("timestamp", "asc"));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const loadedReplies = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          setRepliesMap((prev) => ({ ...prev, [comment.id]: loadedReplies }));
        },
        (err) => {
          console.error("Reply snapshot hata:", err);
        }
      );

      replyListenersRef.current[comment.id] = unsub;
    });

    // Remove listeners for comments that were deleted
    const currentIds = new Set(comments.map((c) => c.id));
    Object.keys(replyListenersRef.current).forEach((parentId) => {
      if (!currentIds.has(parentId)) {
        // unsubscribe and remove
        try {
          replyListenersRef.current[parentId]();
        } catch (e) {
          // ignore
        }
        delete replyListenersRef.current[parentId];
        setRepliesMap((prev) => {
          const copy = { ...prev };
          delete copy[parentId];
          return copy;
        });
      }
    });

    // cleanup on unmount
    return () => {
      Object.values(replyListenersRef.current).forEach((unsub) => {
        try {
          unsub();
        } catch (e) {}
      });
      replyListenersRef.current = {};
    };
  }, [comments, contextIdConvert]);

  // ==========================
  // Add Comment
  // ==========================
  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || !currentUser?.uid || isSending) return;
    setIsSending(true);
    try {
      const commentsRef = collection(
        db,
        "MovieComment",
        contextIdConvert,
        "comments"
      );
      await addDoc(commentsRef, {
        userId: currentUser.uid,
        username: currentUser.displayName || "Anonim",
        avatar: currentUser.photoURL || null,
        text: newComment.trim(),
        isSpoiler,
        parentId: null,
        likes: [],
        timestamp: serverTimestamp(),
      });
      setNewComment("");
      setIsSpoiler(false);
    } catch (err) {
      console.error("Yorum eklenirken hata:", err);
    } finally {
      setIsSending(false);
    }
  }, [newComment, isSpoiler, currentUser, contextIdConvert, isSending]);

  // ==========================
  // Toggle Like
  // ==========================
  const handleLikeToggle = useCallback(
    async (commentId, alreadyLiked) => {
      if (!currentUser?.uid) return;
      const commentRef = doc(
        db,
        "MovieComment",
        contextIdConvert,
        "comments",
        commentId
      );
      try {
        if (alreadyLiked) {
          await updateDoc(commentRef, {
            likes: arrayRemove(currentUser.uid),
          });
        } else {
          await updateDoc(commentRef, {
            likes: arrayUnion(currentUser.uid),
          });
        }
      } catch (err) {
        console.error("Like güncellenirken hata:", err);
      }
    },
    [currentUser, contextIdConvert]
  );

  // ==========================
  // Helper: get replies from repliesMap
  // ==========================
  const getReplies = (parentId) => {
    return repliesMap[parentId] || [];
  };

  const toggleReplyVisibility = (commentId) => {
    setReplyVisibility((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{
        maxHeight: 500,
        backgroundColor: theme.secondary,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}
      keyboardShouldPersistTaps="always"
    >
      <View
        style={{
          width: "100%",
          //height: 50,
          borderBottomWidth: 1,
          borderColor: theme.border,
          justifyContent: "center",
          alignItems: "center",
          gap: 5,
          padding: 10,
        }}
      >
        <View
          style={{
            width: 30,
            height: 5,
            backgroundColor: theme.between,
            borderRadius: 5,
          }}
        />
        <Text style={{ color: theme.text.secondary }}>YORUMLAR</Text>
      </View>
      {/* Comment List */}
      <FlatList
        data={comments.filter((c) => c.parentId === null)}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <CommentItem
              item={item}
              theme={theme}
              currentUser={currentUser}
              contextId={contextIdConvert}
              replies={getReplies(item.id)}
              toggleReplyVisibility={toggleReplyVisibility}
              handleLikeToggle={handleLikeToggle}
              openReplyBox={openReplyBox}
              setOpenReplyBox={setOpenReplyBox}
            />

            {/* Replies area: only render when toggled (Instagram-like) */}
            {replyVisibility[item.id] &&
              getReplies(item.id).map((rep) => (
                <CommentItem
                  key={rep.id}
                  item={rep}
                  theme={theme}
                  currentUser={currentUser}
                  contextId={contextIdConvert}
                  replies={[]} // nested replies for reply (reply-to-reply) not implemented here
                  toggleReplyVisibility={() => {}}
                  handleLikeToggle={handleLikeToggle}
                  isReply={true}
                  openReplyBox={openReplyBox}
                  setOpenReplyBox={setOpenReplyBox}
                />
              ))}
          </View>
        )}
        contentContainerStyle={{ padding: 10, paddingBottom: 0 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="always"
      />

      {/* Main Input Area */}
      <View
        style={{
          padding: 10,
          borderColor: theme.border,
          backgroundColor: theme.background,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 25,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              paddingHorizontal: 15,
              paddingVertical: 8,
              color: theme.text.primary,
            }}
            placeholder="Yorumunuzu yazın…"
            placeholderTextColor={theme.text.muted}
            multiline
            numberOfLines={6}
            value={newComment}
            onChangeText={setNewComment}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={handleAddComment}
            style={{
              marginLeft: 8,
              backgroundColor: theme.accent,
              padding: 12,
              borderRadius: 25,
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
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <Text style={{ color: theme.text.secondary, marginRight: 8 }}>
            Spoiler
          </Text>
          <SwitchToggle
            size={36}
            value={isSpoiler}
            onValueChange={setIsSpoiler}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default Comment;
