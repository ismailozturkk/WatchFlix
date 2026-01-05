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
  Linking, // Bu satırda bir değişiklik yok, sadece bağlam için bırakıldı.
  Alert,
  Modal,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export default function ChatScreen({ route }) {
  const { friendUid, friendName } = route.params;
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [editingMessage, setEditingMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [friendIsOnline, setFriendIsOnline] = useState(false);
  const [friendInchat, setFriendInchat] = useState(false);
  const [friendLastSeen, setFriendLastSeen] = useState(null);
  const [friendTyping, setFriendTyping] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [searchOption, setSearchOption] = useState(false);

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
    const goOnline = async () => {
      await updateDoc(currentUserRef, { isOnline: true });
      await setDoc(
        chatRef,
        {
          information: {
            inChat: { [currentUser.uid]: true },
          },
        },
        { merge: true }
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
            inChat: { [currentUser.uid]: false },
            // burada lastSeen'i map olarak saklıyorsan { [currentUser.uid]: serverTimestamp() } yap
            lastSeen: { [currentUser.uid]: serverTimestamp() },
          },
        },
        { merge: true }
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

  // Arkadaş durumu dinle (chat içindeki bilgi ve user doc'u ayrı ayrı)
  useEffect(() => {
    const unsubscribeChat = onSnapshot(chatRef, (docSnap) => {
      if (!docSnap.exists()) {
        // doküman yoksa güvenli default'lar
        setFriendInchat(false);
        setFriendLastSeen(null);
        setFriendTyping(false);
        return;
      }

      const data = docSnap.data() || {};
      const info = data.information || {};

      // inChat objesi bir map ise güvenli çek
      const inChatMap = info.inChat || {};
      setFriendInchat(Boolean(inChatMap[friendUid]));

      // lastSeen map ise güvenle çek (timestamp veya undefined)
      const lastSeenMap = info.lastSeen || {};
      const lastSeenValue = lastSeenMap[friendUid] ?? null;
      setFriendLastSeen(lastSeenValue);

      // typing map ise güvenle çek
      const typingMap = info.typing || {};
      setFriendTyping(Boolean(typingMap[friendUid]));
    });

    const unsubscribeFriend = onSnapshot(friendRef, (docSnap) => {
      if (!docSnap.exists()) {
        setFriendIsOnline(false);
        return;
      }
      const data = docSnap.data() || {};
      setFriendIsOnline(Boolean(data.isOnline));
    });

    // doğru cleanup: her iki unsubscribe'ı da çağır
    return () => {
      try {
        unsubscribeChat && unsubscribeChat();
      } catch (e) {}
      try {
        unsubscribeFriend && unsubscribeFriend();
      } catch (e) {}
    };
  }, []);

  // Mesajları dinle (ek)
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
    if (value.includes("/")) {
      // Burada tetiklenecek mekanizmayı çağır
      console.log("Slash tetiklendi!");

      // Opsiyonel: Slash'tan sonrası ile işlem
      const command = value.split("/")[1]; // / sonrası
      console.log("Komut kısmı:", command);
      setSearchOption(true);
    } else {
      setSearchOption(false);
    }
    await setDoc(
      chatRef,
      {
        information: {
          typing: { [currentUser.uid]: value.length > 0 },
        },
      },
      { merge: true }
    );
  };

  const sendMessage = async () => {
    if (text.trim() === "") return;

    try {
      let messageRef;
      if (editingMessage) {
        messageRef = doc(db, "chats", chatId, "messages", editingMessage.id);
        await updateDoc(messageRef, {
          text,
          edited: true,
        });
        setEditingMessage(null);
      } else {
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
            lastMessage: {
              [currentUser.uid]: {
                lastMessageText: text,
                lastMessageTime: serverTimestamp(),
              },
            },
            updatedAt: serverTimestamp(),
            participants: [currentUser.uid, friendUid],
            typing: { [currentUser.uid]: false },
          },
        },
        { merge: true }
      );

      setText("");
      // yine typing false'u merge ile ayarlıyoruz
      await setDoc(
        chatRef,
        {
          information: {
            typing: { [currentUser.uid]: false },
          },
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Mesaj gönderme hatası:", error);
      Alert.alert("Hata", "Mesaj gönderilemedi.");
    }
  };

  const [selectedMessage, setSelectedMessage] = useState(null);

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
  const handleContentSizeChange = () => {
    flatListRef.current.scrollToEnd({ animated: true });
  };
  const headerHeight = 35; // Yaklaşık başlık yüksekliği, bunu ayarlayabilirsiniz
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      <View style={{ flex: 1 }}>
        <View
          style={{
            padding: 16,
            justifyContent: "center",
            alignItems: "center",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          <Text style={{ color: theme.text.primary, fontSize: 24 }}>
            {friendName}
          </Text>
          <Text
            // style={{ color: friendIsOnline ? "#70ffb0ff" : theme.text.secondary }}
            style={{
              color: friendInchat
                ? "#70baffff"
                : friendIsOnline
                  ? "#70ffb0ff"
                  : theme.text.secondary,
            }}
          >
            {friendInchat
              ? "Sohbette"
              : friendIsOnline
                ? "Çevrimiçi"
                : `Son görülme: ${friendLastSeen ? formatDate(friendLastSeen) : "bilinmiyor"}`}
          </Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          //inverted
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={handleContentSizeChange}
          ListFooterComponent={
            friendTyping ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: "#414141ff",
                  borderRadius: 20,
                  borderTopLeftRadius: 0,
                  paddingHorizontal: 6,
                  paddingVertical: 4,
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
        {/* Mesaj input modalı */}
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: theme.secondary, padding: 12 },
          ]}
        >
          {searchOption && (
            <View>
              <TouchableOpacity>
                <Text>Film Ara</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text>merhaba</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text>merhaba</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
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
        </View>
      </View>

      {/* Mesaj seçenek modalı */}
      {optionsVisible && (
        <Modal
          animationType="slide"
          visible={optionsVisible}
          transparent={true}
          onRequestClose={() => setOptionsVisible(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={async () => {
                  await deleteDoc(doc(messagesRef, selectedMessage.id));
                  setOptionsVisible(false);
                }}
              >
                <Text style={[styles.modalText, { color: "red" }]}>🗑 Sil</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setEditingMessage(selectedMessage);
                  setText(selectedMessage.text);
                  setOptionsVisible(false);
                }}
              >
                <Text style={styles.modalText}>✏️ Düzenle</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { borderTopWidth: 1, borderColor: "#333" },
                ]}
                onPress={() => setOptionsVisible(false)}
              >
                <Text style={styles.modalText}>❌ İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  message: {
    padding: 12,
    borderRadius: 20,
    marginVertical: 1,
    maxWidth: "75%",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  myMsg: { alignSelf: "flex-end", borderTopRightRadius: 0 },
  friendMsg: { alignSelf: "flex-start", borderTopLeftRadius: 0 },
  messageText: { fontSize: 16 },
  inputContainer: {
    padding: 8,
    alignItems: "center",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
