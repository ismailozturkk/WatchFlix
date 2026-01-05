import React, { useState, useEffect, useCallback, memo } from "react"; // useCallback ekledik
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
  orderBy,
  limit,
} from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import SwitchToggle from "../modules/SwitchToggle";

// 1. ADIM: CommentItem'ı render döngüsünün dışına taşıdık.
// Gerekli 'theme' ve 'item' bilgilerini artık prop olarak alıyor.
const CommentItem = memo(({ item, theme }) => {
  const [showSpoiler, setShowSpoiler] = useState(false);
  const timeLabel = item.timestamp
    ? item.timestamp.toDate().toLocaleString()
    : "";

  return (
    <View style={styles.commentContainer}>
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.username, { color: theme.text.primary }]}>
          {item.username}
        </Text>
        {item.isSpoiler && !showSpoiler ? (
          <TouchableOpacity
            onPress={() => setShowSpoiler(true)}
            style={styles.spoilerBox}
          >
            <Text style={styles.spoilerText}>
              Spoiler içerik – görmek için tıkla
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ marginTop: 4, color: theme.text.primary }}>
            {item.text}
          </Text>
        )}
        <Text style={{ fontSize: 10, color: theme.text.muted, marginTop: 4 }}>
          {timeLabel}
        </Text>
      </View>
    </View>
  );
});

// 2. ADIM: InputArea'yı render döngüsünün dışına taşıdık.
// İhtiyacı olan tüm state ve fonksiyonları artık prop olarak alıyor.
const InputArea = ({
  theme,
  newComment,
  isSpoiler,
  handleTyping,
  handleAddComment,
  setIsSpoiler,
}) => (
  <View
    style={{
      padding: 10,
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
        onChangeText={handleTyping}
        blurOnSubmit={false} // Gönder butonuna basıldığında klavyenin kapanmasını engeller
        // keyboardShouldPersistTaps="handled" // Bu prop burada gerekli değil
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
      <SwitchToggle size={36} value={isSpoiler} onValueChange={setIsSpoiler} />
    </View>
  </View>
);

// Ana component'iniz
const Comment = ({ contextId }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const currentUser = user;

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);

  // Firestore snapshot (değişiklik yok)

  useEffect(() => {
    if (!contextId) return;
    const safeContextId = contextId.toString();
    const commentsRef = collection(
      db,
      "MovieComment",
      safeContextId,
      "comments"
    );

    const q = query(commentsRef, orderBy("timestamp", "desc"), limit(200));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const loadedComments = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setComments(loadedComments);
        } catch (err) {
          console.error("Yorumları işlerken hata:", err);
        }
      },
      (error) => console.error("Firestore snapshot hatası:", error)
    );

    return () => unsubscribe();
  }, [contextId]);

  // 3. ADIM: Fonksiyonları useCallback ile sarmaladık.
  // Bu, gereksiz yere yeniden oluşturulmalarını engeller ve performansı artırır.
  const [isSending, setIsSending] = useState(false);

  const handleAddComment = useCallback(async () => {
    if (isSending) return;
    if (!newComment.trim() || !currentUser?.uid) return;

    setIsSending(true);
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
        text: newComment.trim(),
        isSpoiler,
        timestamp: serverTimestamp(),
      });

      setNewComment("");
      setIsSpoiler(false);
    } catch (err) {
      console.error("Yorum eklenirken hata oluştu:", err);
      // toast burada göster
    } finally {
      setIsSending(false);
    }
  }, [newComment, isSpoiler, currentUser, contextId, isSending]);

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
      {/* 4. ADIM: Dışarı taşıdığımız component'i burada çağırıyoruz ve prop'ları iletiyoruz. */}
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        // renderItem içinde de dışarıdaki component'i çağırıyoruz.
        renderItem={({ item }) => <CommentItem item={item} theme={theme} />}
        contentContainerStyle={{ padding: 10, paddingBottom: 80 }}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="always"
      />
      <InputArea
        theme={theme}
        newComment={newComment}
        isSpoiler={isSpoiler}
        handleTyping={handleTyping}
        handleAddComment={handleAddComment}
        setIsSpoiler={setIsSpoiler}
      />
    </KeyboardAvoidingView>
  );
};

export default Comment;
