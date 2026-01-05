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
  Modal,
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
  getDoc,
} from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";
import * as Clipboard from "expo-clipboard";
import LinkPreview from "react-native-link-preview";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function ChatScreen({ route, navigation }) {
  const { friendUid, friendName } = route.params;
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [friendStatus, setFriendStatus] = useState({
    isOnline: false,
    lastSeen: null,
  });
  const flatListRef = useRef();
  const { theme } = useTheme();

  const chatId =
    currentUser.uid > friendUid
      ? currentUser.uid + "_" + friendUid
      : friendUid + "_" + currentUser.uid;

  const messagesRef = collection(db, "chats", chatId, "messages");
  const currentUserRef = doc(db, "users", currentUser.uid);
  const friendRef = doc(db, "users", friendUid);

  // 📡 Online / LastSeen yönetimi
  useEffect(() => {
    const setOnline = async (state) => {
      await updateDoc(currentUserRef, {
        isOnline: state,
        lastSeen: serverTimestamp(),
      });
    };

    setOnline(true);
    const unsubscribe = () => setOnline(false);
    navigation.addListener("beforeRemove", unsubscribe);

    return () => setOnline(false);
  }, []);

  // 👀 Arkadaş durumu izleme
  useEffect(() => {
    const unsub = onSnapshot(friendRef, (snap) => {
      if (snap.exists()) setFriendStatus(snap.data());
    });
    return () => unsub();
  }, []);

  // 📝 Yazıyor göstergesi
  useEffect(() => {
    const unsub = onSnapshot(friendRef, (snap) => {
      if (snap.exists()) setFriendTyping(snap.data().typing);
    });
    return () => unsub();
  }, []);

  // 💬 Mesajları çek
  useEffect(() => {
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, async (querySnapshot) => {
      const msgs = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({ id: docSnap.id, ...data });
      });
      setMessages(msgs);

      // Gelen mesajlar için "delivered" güncellemesi
      for (let msg of msgs) {
        if (msg.senderId !== currentUser.uid && msg.status === "sent") {
          await updateDoc(doc(messagesRef, msg.id), { status: "delivered" });
        }
      }
    });
    return () => unsub();
  }, []);

  // ✍️ Yazıyor durumunu Firestore’a gönder
  useEffect(() => {
    const timeout = setTimeout(() => {
      updateDoc(currentUserRef, { typing: text.trim().length > 0 });
    }, 300);
    return () => clearTimeout(timeout);
  }, [text]);

  // 📤 Mesaj gönder
  const sendMessage = async () => {
    if (text.trim() === "") return;
    const newMsg = await addDoc(messagesRef, {
      text,
      senderId: currentUser.uid,
      timestamp: serverTimestamp(),
      status: "sent",
    });
    setText("");
  };

  // 📱 Mesaj uzun basınca menü
  const handleLongPress = (msg) => {
    setSelectedMsg(msg);
    setModalVisible(true);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(selectedMsg.text);
    Alert.alert("Kopyalandı", "Mesaj panoya kopyalandı.");
    setModalVisible(false);
  };

  const handleDelete = async () => {
    if (selectedMsg.senderId !== currentUser.uid)
      return Alert.alert("Uyarı", "Sadece kendi mesajını silebilirsin.");
    await deleteDoc(doc(messagesRef, selectedMsg.id));
    setModalVisible(false);
  };

  // ✅ Görüldü durumunu güncelle
  useEffect(() => {
    const unseenMsgs = messages.filter(
      (m) => m.senderId !== currentUser.uid && m.status !== "seen"
    );
    unseenMsgs.forEach((m) =>
      updateDoc(doc(messagesRef, m.id), { status: "seen" })
    );
  }, [messages]);

  const renderItem = ({ item }) => {
    const isMe = item.senderId === currentUser.uid;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const hasLink = urlRegex.test(item.text);

    return (
      <TouchableOpacity
        onLongPress={() => handleLongPress(item)}
        style={[styles.message, isMe ? styles.myMsg : styles.friendMsg]}
      >
        {hasLink ? (
          <LinkPreview
            text={item.text}
            containerStyle={{
              backgroundColor: isMe ? "#43836eff" : "#414141ff",
              borderRadius: 15,
            }}
            textContainerStyle={{ marginHorizontal: 0, marginVertical: 0 }}
            titleStyle={{ color: theme.text.primary }}
            descriptionStyle={{ color: theme.text.secondary }}
          />
        ) : (
          <Text style={[styles.messageText, { color: "#fff" }]}>
            {item.text}
          </Text>
        )}

        {isMe && (
          <Text style={styles.status}>
            {item.status === "sent" ? (
              <Ionicons name="checkmark-done" size={24} color="#535353ff" />
            ) : item.status === "delivered" ? (
              <Ionicons name="checkmark-done" size={24} color="#535353ff" />
            ) : (
              <Ionicons name="checkmark-done" size={24} color="#7dffa8ff" />
            )}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.primary }]}
    >
      <View style={styles.header}>
        <Text style={styles.friendName}>{friendName}</Text>
        {friendTyping ? (
          <Text style={styles.typing}>yazıyor...</Text>
        ) : friendStatus.isOnline ? (
          <Text style={styles.online}>Çevrimiçi</Text>
        ) : (
          <Text style={styles.offline}>
            Son görülme:{" "}
            {friendStatus.lastSeen
              ? new Date(friendStatus.lastSeen.toDate()).toLocaleTimeString()
              : "bilinmiyor"}
          </Text>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
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
          onChangeText={setText}
          placeholder={`Mesaj gönder...`}
          placeholderTextColor={theme.text.secondary}
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>Gönder</Text>
        </TouchableOpacity>
      </View>

      {/* Uzun Basma Modalı */}
      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity onPress={handleCopy}>
              <Text style={styles.modalText}>📋 Kopyala</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete}>
              <Text style={styles.modalText}>🗑 Sil</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={[styles.modalText, { color: "red" }]}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 70 },
  header: { padding: 10, alignItems: "center" },
  friendName: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  typing: { color: "#87ceeb", fontSize: 14 },
  online: { color: "#4CAF50" },
  offline: { color: "#ccc", fontSize: 12 },
  message: {
    padding: 10,
    borderRadius: 15,
    marginVertical: 4,
    maxWidth: "75%",
  },
  myMsg: { backgroundColor: "#43836eff", alignSelf: "flex-end" },
  friendMsg: { backgroundColor: "#414141ff", alignSelf: "flex-start" },
  messageText: { fontSize: 16 },
  status: { fontSize: 12, color: "#ddd", marginTop: 2, textAlign: "right" },
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    width: 200,
  },
  modalText: { fontSize: 16, marginVertical: 6, textAlign: "center" },
});
