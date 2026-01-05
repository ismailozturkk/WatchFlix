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

// Comment component'ini React.memo ile sarmak,
// üst component render olduğunda gereksiz render'ları önleyebilir.
const Comment = ({ contextId }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const currentUser = user;

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);

  // Firestore snapshot (Bu kısım aynı kalıyor)
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

  // Yorum ekleme (Bu kısım aynı kalıyor)
  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return;
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

  // handleTyping fonksiyonu artık doğrudan onChangeText içinde
  // const handleTyping = (text) => setNewComment(text);

  return (
    <View
      style={{
        maxHeight: 400,
        backgroundColor: theme.secondary,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}
    >
      {/* --- DEĞİŞİKLİK 1: InputArea JSX'i doğrudan buraya taşındı --- */}
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
            value={newComment}
            onChangeText={setNewComment} // Doğrudan state'i güncelleyebiliriz
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
          <Switch
            trackColor={{ false: "#767577", true: theme.accent }}
            thumbColor={isSpoiler ? theme.primary : "#f4f3f4"}
            value={isSpoiler}
            onValueChange={setIsSpoiler}
          />
        </View>
      </View>

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        // --- DEĞİŞİKLİK 2: CommentItem JSX'i renderItem içine taşındı ---
        renderItem={({ item }) => {
          // Spoiler state'i her bir item için ayrı tutulmalı
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
              {item.avatar && (
                <Image
                  source={{ uri: item.avatar }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    marginRight: 10,
                  }}
                />
              )}
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

                <Text
                  style={{
                    fontSize: 10,
                    color: theme.text.muted,
                    marginTop: 4,
                  }}
                >
                  {item.timestamp?.toDate().toLocaleString()}
                </Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ padding: 10, paddingBottom: 80 }}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
};

export default Comment;
