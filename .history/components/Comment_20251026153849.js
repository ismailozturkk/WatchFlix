import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Button,
  FlatList,
  Text,
  TouchableOpacity,
  Switch,
} from "react-native";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useTheme } from "../context/ThemeContext";

const Comment = ({ contextId }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const { theme } = useTheme();
  const [isSpoiler, setIsSpoiler] = useState(false);
  const currentUser = getAuth().currentUser;
  if (!contextId) return null;
  console.log(contextId);
  useEffect(() => {
    if (!contextId) return;

    const commentsRef = collection(
      db,
      "MovieComment",
      contextId.toString(), // <<< burada string'e çeviriyoruz
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
          console.error("Yorumları işlerken hata oluştu:", err);
        }
      },
      (error) => {
        // onSnapshot hata callback’i
        console.error("Firestore snapshot hatası:", error);
      }
    );

    return () => unsubscribe();
  }, [contextId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    await addDoc(collection(db, "MovieComment", contextId, "comments"), {
      userId: currentUser.uid,
      username: currentUser.displayName || "Anonim",
      avatar: currentUser.photoURL || null,
      text: newComment,
      isSpoiler: isSpoiler,
      timestamp: serverTimestamp(),
    });

    setNewComment("");
    setIsSpoiler(false);
  };

  const renderComment = ({ item }) => {
    const [showSpoiler, setShowSpoiler] = useState(false);

    return (
      <View
        style={[styles.commentContainer, { borderBottomColor: theme.border }]}
      >
        <Text style={[styles.username, { color: theme.text.primary }]}>
          {item.username}
        </Text>
        {item.isSpoiler && !showSpoiler ? (
          <TouchableOpacity onPress={() => setShowSpoiler(true)}>
            <Text style={[styles.spoilerText, { color: theme.text.muted }]}>
              Spoiler içerik – görmek için tıkla
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ color: theme.text.secondary }}>{item.text}</Text>
        )}
        <Text style={[styles.timestamp, { color: theme.text.muted }]}>
          {item.timestamp?.toDate().toLocaleString()}
        </Text>
      </View>
    );
  };

  const ListFooterComponent = () => (
    <>
      <View style={[styles.inputContainer, { borderColor: theme.border }]}>
        <TextInput
          style={[styles.input, { color: theme.text.primary }]}
          placeholder="Yorumunuzu yazın…"
          placeholderTextColor={theme.text.muted}
          value={newComment}
          onChangeText={setNewComment}
        />
        <Button
          title="Gönder"
          onPress={handleAddComment}
          color={theme.accent}
        />
      </View>
      <View style={styles.spoilerContainer}>
        <Text style={{ color: theme.text.secondary }}>Spoiler</Text>
        <Switch
          trackColor={{ false: "#767577", true: theme.accent }}
          thumbColor={isSpoiler ? theme.primary : "#f4f3f4"}
          value={isSpoiler}
          onValueChange={setIsSpoiler}
        />
      </View>
    </>
  );

  return (
    <FlatList
      //nestedScrollEnabled={true}
      data={comments}
      keyExtractor={(item) => item.id}
      renderItem={renderComment}
      ListFooterComponent={ListFooterComponent}
      contentContainerStyle={{ padding: 10 }}
    />
  );
};

const styles = StyleSheet.create({
  commentContainer: {
    marginVertical: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  username: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  spoilerText: {
    fontStyle: "italic",
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 8,
    marginRight: 8,
  },
  spoilerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
});

export default Comment;
