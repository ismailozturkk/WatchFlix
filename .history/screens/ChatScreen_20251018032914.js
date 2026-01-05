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
  Alert,
  Clipboard,
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
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";
import LottieView from "lottie-react-native";

export default function ChatScreen({ route }) {
  const { friendUid, friendName } = route.params;
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [editingMessage, setEditingMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [friendIsOnline, setFriendIsOnline] = useState(false);
  const [friendLastSeen, setFriendLastSeen] = useState(null);
  const [friendTyping, setFriendTyping] = useState(false);
  const flatListRef = useRef();
  const { theme } = useTheme();

  const chatId =
    currentUser.uid > friendUid
      ? currentUser.uid + "_" + friendUid
      : friendUid + "_" + currentUser.uid;

  const messagesRef = collection(db, "chats", chatId, "messages");
  const currentUserRef = doc(db, "Users", currentUser.uid);
  const friendRef = doc(db, "Users", friendUid);

  // Çevrimiçi durumu ve son görülme
  useEffect(() => {
    const goOnline = async () => {
      await updateDoc(currentUserRef, { isOnline: true });
    };

    const goOffline = async () => {
      await updateDoc(currentUserRef, {
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
    };

    goOnline();
    return () => goOffline();
  }, []);

  // Mesajları dinle ve durum güncelle
  useEffect(() => {
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docs.forEach(async (docSnap) => {
        const msg = docSnap.data();

        // 1️⃣ Karşı tarafa iletildi (delivered)
        if (msg.senderId === currentUser.uid && msg.status === "sent") {
          await updateDoc(doc(messagesRef, docSnap.id), {
            status: "delivered",
            deliveredAt: serverTimestamp(),
          });
        }

        // 2️⃣ Mesaj görüldü (seen)
        if (msg.senderId !== currentUser.uid && msg.status !== "seen") {
          await updateDoc(doc(messagesRef, docSnap.id), {
            status: "seen",
          });
        }
      });
    });

    return () => unsubscribe();
  }, []);

  // Arkadaş durumu dinle
  useEffect(() => {
    const unsubscribe = onSnapshot(friendRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFriendIsOnline(data.isOnline || false);
        setFriendLastSeen(data.lastSeen || null);
        setFriendTyping(data.typing || false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Mesajları dinle
  useEffect(() => {
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      flatListRef.current?.scrollToEnd({ animated: true });

      // Mesaj durumu: "sent" -> "delivered"
      msgs.forEach(async (msg) => {
        if (msg.senderId === currentUser.uid && msg.status === "sent") {
          await updateDoc(doc(messagesRef, msg.id), { status: "delivered" });
        }
      });
    });
    return () => unsubscribe();
  }, []);

  const handleTyping = async (value) => {
    setText(value);
    await updateDoc(currentUserRef, { typing: value.length > 0 });
  };

  const sendMessage = async () => {
    if (text.trim() === "") return;

    if (editingMessage) {
      // Düzenleme modunda mesaj güncelle
      await updateDoc(doc(messagesRef, editingMessage.id), {
        text,
        edited: true,
        status: "edited",
      });
      setEditingMessage(null);
    } else {
      // Normal mesaj gönder
      await addDoc(messagesRef, {
        text,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        status: "sent",
      });
    }

    setText("");
    await updateDoc(currentUserRef, { typing: false });
  };

  const handleLongPress = (item) => {
    if (item.senderId !== currentUser.uid) return;
    Alert.alert("Mesaj İşlemleri", "", [
      { text: "Kopyala", onPress: () => Clipboard.setString(item.text) },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => await deleteDoc(doc(messagesRef, item.id)),
      },
      {
        text: "Düzenle",
        onPress: () => {
          setEditingMessage(item);
          setText(item.text);
        },
      },
      { text: "İptal", style: "cancel" },
    ]);
  };
  const handleEditMessage = async (item, newText) => {
    if (item.senderId !== currentUser.uid) return; // sadece kendi mesajı düzenlenebilir
    await updateDoc(doc(messagesRef, item.id), {
      text: newText,
      edited: true, // yeni alan ekleniyor
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  const formatTime = (ts) => {
    if (!ts) return "";
    const date = ts.toDate();
    return (
      date.getHours() + ":" + date.getMinutes().toString().padStart(2, "0")
    );
  };

  const renderItem = ({ item }) => {
    const isMe = item.senderId === currentUser.uid;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = item.text.split(urlRegex);

    const formatTime = (ts) => {
      if (!ts) return "";
      const date = ts.toDate();
      return `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
    };

    return (
      <TouchableOpacity
        style={[
          styles.message,
          isMe ? styles.myMsg : styles.friendMsg,
          { backgroundColor: isMe ? "#43836eff" : "#414141ff" },
        ]}
        onLongPress={() => handleLongPress(item)}
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

        {/* Mesaj durumu ve atılma zamanı */}
        {!isMe && (
          <Text style={{ fontSize: 12, color: "#ccc", marginTop: 2 }}>
            {formatTime(item.timestamp)}
          </Text>
        )}
        {isMe && (
          <Text style={{ fontSize: 12, color: "#ccc", marginTop: 2 }}>
            {item.status === "sent" && "✅ "}
            {item.status === "delivered" && "✅✅ "}
            {item.status === "seen" && "👁 "}
            {item.status === "edited" && "✏️ "}
            {formatTime(item.timestamp)}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.primary, paddingTop: 80 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View
            style={{
              padding: 16,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: theme.text.primary, fontSize: 24 }}>
              {friendName}
            </Text>
            <Text style={{ color: theme.text.secondary }}>
              {friendIsOnline
                ? "Çevrimiçi"
                : `Son görülme: ${friendLastSeen ? formatDate(friendLastSeen) : "bilinmiyor"}`}
            </Text>
          </View>
        }
        ListFooterComponent={
          friendTyping ? (
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: "#414141ff",
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginVertical: 4,
                maxWidth: "40%",
              }}
            >
              <LottieView
                source={require("../LottieJson/typingAnimation.json")}
                autoPlay
                loop
                style={{ width: 75, height: 40 }}
              />
            </View>
          ) : null
        }
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
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            {editingMessage ? "Düzenle" : "Gönder"}
          </Text>
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
  inputContainer: { flexDirection: "row", padding: 8, alignItems: "center" },
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
