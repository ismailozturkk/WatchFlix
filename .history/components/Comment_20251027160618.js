import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Switch,
} from "react-native";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const Comment = ({ contextId }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const currentUser = user;

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);

  if (!contextId) return null;

  // Firestore snapshot
  useEffect(() => {
    if (!contextId) return;

    const safeContextId = contextId.toString();
    const commentsRef = collection(
      db,
      "MovieComment",
      safeContextId,
      "comments"
    );

    const unsubscribe = onSnapshot(
      commentsRef,
      (snapshot) => {
        try {
          const loadedComments =
            snapshot.docs?.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) || [];

          const sortedComments = [...loadedComments].sort(
            (a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
          );

          setComments(sortedComments);
        } catch (err) {
          console.error("Yorumları işlerken hata:", err);
        }
      },
      (error) => console.error("Firestore snapshot hatası:", error)
    );

    return () => unsubscribe();
  }, [contextId]);

  // Yorum ekleme
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    if (!currentUser) return console.warn("Kullanıcı giriş yapmamış!");

    try {
      const safeContextId = contextId.toString();
      const commentsRef = collection(
        db,
        "MovieComment",
        safeContextId,
        "comments"
      );

      await addDoc(commentsRef, {
        userId: currentUser.uid,
        username: currentUser.displayName || "Anonim",
        avatar: currentUser.photoURL || null,
        text: newComment,
        isSpoiler,
        timestamp: serverTimestamp(),
      });

      setNewComment("");
      setIsSpoiler(false);
    } catch (err) {
      console.error("Yorum eklenirken hata oluştu:", err);
    }
  };

  // Tek yorum component’i
  const CommentItem = ({ item }) => {
    const [showSpoiler, setShowSpoiler] = useState(false);

    return (
      <View
        style={{
          flexDirection: "row",
          marginVertical: 5,
          padding: 8,
          backgroundColor: theme.secondary,
          borderRadius: 10,
        }}
      >
        {item.avatar ? (
          <Image
            source={{ uri: item.avatar }}
            style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }}
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
                backgroundColor: "#444",
                borderRadius: 6,
              }}
            >
              <Text style={{ fontStyle: "italic", color: "#ccc" }}>
                Spoiler içerik – görmek için tıkla
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ marginTop: 4, color: theme.text.primary }}>
              {item.text}
            </Text>
          )}

          <Text style={{ fontSize: 10, color: theme.text.muted, marginTop: 4 }}>
            {item.timestamp?.toDate().toLocaleString()}
          </Text>
        </View>
      </View>
    );
  };

  // Input alanı ekranın altında
  const InputArea = () => (
    <View
      style={{
        padding: 10,
        borderTopWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.background,
      }}
    >
      {/* Yorum input + Gönder */}
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
          value={newComment}
          onChangeText={setNewComment}
          blurOnSubmit={false} // ENTER’e bastığında bile klavye kapanmasın
          returnKeyType="send"
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

      {/* Spoiler switch */}
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
        <Switch
          trackColor={{ false: "#767577", true: theme.accent }}
          thumbColor={isSpoiler ? theme.primary : "#f4f3f4"}
          value={isSpoiler}
          onValueChange={setIsSpoiler}
        />
      </View>
    </View>
  );

  return (
    <View
      style={{
        maxHeight: 400,
        backgroundColor: theme.secondary,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}
    >
      <InputArea />
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CommentItem item={item} />}
        contentContainerStyle={{ padding: 10, paddingBottom: 80 }}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled" // Burası önemli!
      />
    </View>
  );
};

export default Comment;
