import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Button,
  FlatList,
  Text,
  TouchableOpacity,
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

const Comment = ({ contextId }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const currentUser = getAuth().currentUser;

  useEffect(() => {
    const commentsRef = collection(db, "movies", contextId, "comments");
    const unsubscribe = onSnapshot(commentsRef, (snapshot) => {
      const loadedComments = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setComments(
        loadedComments.sort(
          (a, b) => b.timestamp?.seconds - a.timestamp?.seconds
        )
      );
    });
    return () => unsubscribe();
  }, [contextId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    await addDoc(collection(db, "movies", contextId, "comments"), {
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
      <View style={{ marginVertical: 5 }}>
        <Text style={{ fontWeight: "bold" }}>{item.username}</Text>
        {item.isSpoiler && !showSpoiler ? (
          <TouchableOpacity onPress={() => setShowSpoiler(true)}>
            <Text style={{ fontStyle: "italic", color: "gray" }}>
              Spoiler içerik – görmek için tıkla
            </Text>
          </TouchableOpacity>
        ) : (
          <Text>{item.text}</Text>
        )}
        <Text style={{ fontSize: 10, color: "gray" }}>
          {item.timestamp?.toDate().toLocaleString()}
        </Text>
      </View>
    );
  };

  return (
    <View>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        inverted // en son yorum en üstte görünür
      />
      <View
        style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}
      >
        <TextInput
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 5,
            padding: 5,
          }}
          placeholder="Yorumunuzu yazın…"
          value={newComment}
          onChangeText={setNewComment}
        />
        <Button title="Gönder" onPress={handleAddComment} />
      </View>
      <View
        style={{ flexDirection: "row", alignItems: "center", marginTop: 5 }}
      >
        <Text>Spoiler</Text>
        <Switch value={isSpoiler} onValueChange={setIsSpoiler} />
      </View>
    </View>
  );
};

export default Comment;
