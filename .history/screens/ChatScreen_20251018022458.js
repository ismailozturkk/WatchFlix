import React, { useEffect, useState, useRef } from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { db } from "../firebase";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";
import EvilIcons from "@expo/vector-icons/EvilIcons";

export default function ChatScreen({ route }) {
  const { friendUid, friendName } = route.params;
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false); // 3️⃣ Yazıyor göstergesi
  const flatListRef = useRef();
  const { theme } = useTheme();

  const chatId =
    currentUser.uid > friendUid
      ? currentUser.uid + "_" + friendUid
      : friendUid + "_" + currentUser.uid;
  const messagesRef = collection(db, "chats", chatId, "messages");
  const friendStatusRef = doc(db, "Users", friendUid, "status", "chat");

  // Mesajları dinle
  useEffect(() => {
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({ id: doc.id, ...data });
      });
      setMessages(msgs);
      flatListRef.current?.scrollToEnd({ animated: true });

      // 1️⃣ Mesaj durumu kontrolü
      msgs.forEach(async (msg) => {
        if (msg.senderId === currentUser.uid && msg.status === "sent") {
          await updateDoc(doc(messagesRef, msg.id), { status: "delivered" });
        }
      });
    });
    return () => unsubscribe();
  }, []);

  // 3️⃣ Yazıyor göstergesi güncelleme
  const handleTyping = (value) => {
    setText(value);
    setTyping(value.length > 0);
    setDoc(friendStatusRef, { typing: value.length > 0 }, { merge: true });
  };

  const sendMessage = async () => {
    if (text.trim() === "") return;
    await addDoc(messagesRef, {
      text,
      senderId: currentUser.uid,
      timestamp: serverTimestamp(),
      status: "sent",
    });
    setText("");
    setTyping(false);
    setDoc(friendStatusRef, { typing: false }, { merge: true });
  };

  const handleLongPress = (item) => {
    if (item.senderId !== currentUser.uid) return; // Sadece kendi mesajını silebilirsin
    Alert.alert("Mesaj İşlemleri", "", [
      {
        text: "Kopyala",
        onPress: () => Clipboard.setString(item.text),
      },
      {
        text: "Sil",
        onPress: async () => {
          await deleteDoc(doc(messagesRef, item.id));
        },
        style: "destructive",
      },
      { text: "İptal", style: "cancel" },
    ]);
  };

  const renderItem = ({ item }) => {
    const isMe = item.senderId === currentUser.uid;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = item.text.split(urlRegex);

    return (
      <View
        style={[
          styles.message,
          isMe ? styles.myMsg : styles.friendMsg,
          { backgroundColor: isMe ? "#43836eff" : "#414141ff" },
        ]}
        onlongpress={() => handleLongPress(item)}
      >
        <Text style={[styles.messageText, { color: "#fff" }]}>
          {parts.map((part, index) =>
            urlRegex.test(part) ? (
              <Text
                key={index}
                style={{ color: "#87ceeb", textDecorationLine: "underline" }}
                onPress={() => Linking.openURL(part)}
              >
                link
              </Text>
            ) : (
              part
            )
          )}
        </Text>

        {/* 1️⃣ Mesaj durumu ikonları */}
        {isMe && (
          <Text style={{ fontSize: 12, color: "#ccc", marginTop: 2 }}>
            {item.status === "sent" && "✅"}
            {item.status === "delivered" && "✅✅"}
            {item.status === "seen" && "👁"}
          </Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.primary }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* 3️⃣ Yazıyor göstergesi */}
      {typing && (
        <Text style={{ color: theme.text.secondary, paddingLeft: 16 }}>
          {friendName} yazıyor...
        </Text>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      />

      <View
        style={[styles.inputContainer, { backgroundColor: theme.secondary }]}
      >
        <TextInput
          style={[
            styles.input,
            {
              color: theme.text.primary,
              backgroundColor: theme.primary,
              borderColor: theme.border,
            },
          ]}
          value={text}
          onChangeText={handleTyping}
          placeholder="Mesaj gönder..."
          placeholderTextColor={theme.text.secondary}
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>Gönder</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  message: {
    padding: 12,
    borderRadius: 20,
    marginVertical: 4,
    maxWidth: "75%",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  myMsg: { alignSelf: "flex-end" },
  friendMsg: { alignSelf: "flex-start" },
  messageText: { fontSize: 16 },
  inputContainer: {
    flexDirection: "row",
    padding: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    marginRight: 8,
    fontSize: 16,
  },
  sendBtn: {
    backgroundColor: "#4a90e2",
    borderRadius: 25,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
