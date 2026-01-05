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
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScrollView } from "react-native-gesture-handler";
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
  const chatRef = doc(db, "chats", chatId);

  // Çevrimiçi durumu ve son görülme
  useEffect(() => {
    const chatRef = doc(db, "chats", chatId);

    const goOnline = async () => {
      await updateDoc(currentUserRef, { isOnline: true });

      // Sadece currentUser'ın değerini güncelle
      await setDoc(
        chatRef,
        {
          information: {
            inChat: {
              [currentUser.uid]: true, // sadece kendisi true
            },
          },
        },
        { merge: true } // Diğer kullanıcıları korur
      );
    };

    const goOffline = async () => {
      await updateDoc(currentUserRef, {
        isOnline: false,
        lastSeen: serverTimestamp(),
      });

      await setDoc(
        chatRef,
        {
          information: {
            inChat: {
              [currentUser.uid]: false, // sadece kendisi false
            },
            lastSeen: serverTimestamp(),
          },
        },
        { merge: true } // Diğer kullanıcıları korur
      );
    };

    goOnline();
    return () => goOffline();
  }, [chatId]);

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

    try {
      // 1️⃣ Chat dokümanını oluştur veya var olanı koru

      let messageRef;

      // 2️⃣ Mesaj gönder veya düzenle
      if (editingMessage) {
        // Düzenleme modunda
        messageRef = doc(db, "chats", chatId, "messages", editingMessage.id);
        await updateDoc(messageRef, {
          text,
          edited: true,
        });
        setEditingMessage(null);
      } else {
        // Yeni mesaj
        messageRef = await addDoc(collection(db, "chats", chatId, "messages"), {
          text,
          senderId: currentUser.uid,
          timestamp: serverTimestamp(),
          status: "sent",
        });
      }
      await setDoc(
        chatRef,
        {
          information: {
            lastMessage: text,
            lastMessageTime: serverTimestamp(),
            updatedAt: serverTimestamp(),
            participants: [currentUser.uid, friendUid],
          },
        },
        { merge: true }
      );

      // // 3️⃣ Sohbet bilgisini güncelle
      // const chatInfoRef = doc(db, "chats", chatId, "information", "meta");

      // // Firestore transaction ile totalMessages'ı güvenli güncellemek daha sağlıklı
      // await setDoc(
      //   chatInfoRef,
      //   {
      //     lastMessage: text,
      //     lastMessageTime: serverTimestamp(),
      //     updatedAt: serverTimestamp(),
      //     participants: [currentUser.uid, friendUid],
      //   },
      //   { merge: true }
      // );

      // Eğer totalMessages'ı her mesajda doğru şekilde tutmak istiyorsan transaction kullanabilirsin
      // await runTransaction(db, async (transaction) => {
      //   const infoDoc = await transaction.get(chatInfoRef);
      //   const newTotal = infoDoc.exists() ? (infoDoc.data().totalMessages || 0) + 1 : 1;
      //   transaction.set(chatInfoRef, { totalMessages: newTotal }, { merge: true });
      // });

      setText("");
      await updateDoc(currentUserRef, { typing: false });
    } catch (error) {
      console.error("Mesaj gönderme hatası:", error);
      Alert.alert("Hata", "Mesaj gönderilemedi.");
    }
  };

  const [selectedMessage, setSelectedMessage] = useState(null);
  const [optionsVisible, setOptionsVisible] = useState(false);

  const handleLongPress = (item) => {
    if (item.senderId !== currentUser.uid) return;
    setSelectedMessage(item);
    setOptionsVisible(true);
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 5,
            }}
          >
            {item.edited && (
              <MaterialIcons name="edit" size={12} color="#70ffb0ff" />
            )}
            <Text style={{ fontSize: 12, color: "#ccc", marginTop: 2 }}>
              {formatTime(item.timestamp)}
            </Text>

            {item.status === "sent" && (
              <Ionicons name="checkmark" size={16} color="#2e2e2eff" />
            )}
            {item.status === "delivered" && (
              <Ionicons name="checkmark-done" size={16} color="#2e2e2eff" />
            )}
            {item.status === "seen" && (
              <Ionicons name="checkmark-done" size={16} color="#70ffb0ff" />
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.primary }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View style={{ padding: 16, alignItems: "center" }}>
        <Text>{friendName}</Text>
        <Text>{friendIsOnline ? "Çevrimiçi" : `Son görülme: ...`}</Text>
      </View>

      {/* Mesajlar */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      />

      {/* Input */}
      <View
        style={[styles.inputContainer, { backgroundColor: theme.secondary }]}
      >
        <TextInput
          style={[styles.input, { color: theme.text.primary }]}
          value={text}
          onChangeText={handleTyping}
          placeholder="Mesaj gönder..."
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
          <Text>{editingMessage ? "Düzenle" : "Gönder"}</Text>
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
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
  modalOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#2c2c2c",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 10,
    paddingTop: 10,
  },
  modalButton: {
    paddingVertical: 15,
    alignItems: "center",
  },
  modalText: {
    color: "#fff",
    fontSize: 18,
  },
});
