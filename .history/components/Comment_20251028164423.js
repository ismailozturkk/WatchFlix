import React, { useState, useEffect, useCallback, memo } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { translateText } from "../modules/TranslateApi";

// ==========================
// Comment Item Component
// ==========================
const CommentItem = memo(
  ({
    item,
    theme,
    currentUser,
    contextId,
    replies,
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
      handleLikeToggle(item.id, item.likes.includes(currentUser.uid));
    };

    const timeLabel = item.timestamp
      ? item.timestamp.toDate().toLocaleString()
      : "";
    const [translated, setTranslated] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showOriginal, setShowOriginal] = useState(true);

    
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
              
                <Text style={{ marginTop: 4, color: theme.text.primary }}>
                 { item.text }
                </Text>
                
                  )}
                  {item.isSpoiler && (
                    <TouchableOpacity
                      onPress={() => setShowSpoiler(false)}
                      style={{
                        padding: 4,
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
              </View>
            

            <Text
              style={{
                fontSize: 10,
                color: theme.text.muted,
                marginTop: 4,
              }}
            >
              {timeLabel}
            </Text>

            {/* Like / Reply Row */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <TouchableOpacity onPress={handleHeartPress}>
                <Animated.Text
                  style={{
                    fontSize: 16,
                    marginRight: 12,
                    transform: [{ scale: likeAnim }],
                    color: theme.text.secondary,
                  }}
                >
                  {item.likes.includes(currentUser.uid) ? (
                    <MaterialCommunityIcons
                      name="cards-heart"
                      size={16}
                      color={theme.colors.red}
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="cards-heart-outline"
                      size={16}
                      color={theme.text.secondary}
                    />
                  )}{" "}
                  {item.likes.length}
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

            {/* Nested Replies */}
            {replies.map((rep) => (
              <CommentItem
                key={rep.id}
                item={rep}
                theme={theme}
                currentUser={currentUser}
                contextId={contextId}
                replies={[]}
                toggleReplyVisibility={() => {}}
                handleLikeToggle={handleLikeToggle}
                isReply={true}
              />
            ))}
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
      const commentsRef = collection(db, "MovieComment", contextId, "comments");
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
          <Text style={{ color: "#fff", fontWeight: "bold" }}>Gönder</Text>
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

  // Fetch Comments
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
      try {
        const loaded = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setComments(loaded);
      } catch (err) {
        console.error("Yorumları çekerken hata:", err);
      }
    });
    return () => unsubscribe();
  }, [contextIdConvert]);

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
  const handleLikeToggle = useCallback(async (commentId, alreadyLiked) => {
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
  }, []);

  // ==========================
  // Organize Replies
  // ==========================
  const getReplies = (parentId) => {
    return comments.filter((c) => c.parentId === parentId);
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
        maxHeight: 400,
        backgroundColor: theme.secondary,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}
      keyboardShouldPersistTaps="always"
    >
      {/* Comment List */}
      <FlatList
        data={comments.filter((c) => c.parentId === null)}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CommentItem
            item={item}
            theme={theme}
            currentUser={currentUser}
            contextId={contextIdConvert}
            replies={replyVisibility[item.id] ? getReplies(item.id) : []}
            toggleReplyVisibility={toggleReplyVisibility}
            handleLikeToggle={handleLikeToggle}
            openReplyBox={openReplyBox}
            setOpenReplyBox={setOpenReplyBox}
          />
        )}
        contentContainerStyle={{ padding: 10, paddingBottom: 80 }}
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
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TextInput
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 25,
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
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Gönder</Text>
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
