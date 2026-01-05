import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { useAppSettings } from "../context/AppSettingsContext";
import { useLanguage } from "../context/LanguageContext";
import axios from "axios";
import LottieView from "lottie-react-native";
import {
  AntDesign,
  Entypo,
  Feather,
  FontAwesome,
  MaterialCommunityIcons,
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";

export default function ChatScreen({ route, navigation }) {
  const { friendUid, friendName } = route.params;
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const { language, t } = useLanguage();
  const { API_KEY, adultContent } = useAppSettings();
  const { theme } = useTheme();

  const flatListRef = useRef();

  const chatId =
    currentUser.uid > friendUid
      ? currentUser.uid + "_" + friendUid
      : friendUid + "_" + currentUser.uid;

  const messagesRef = collection(db, "chats", chatId, "messages");
  const currentUserRef = doc(db, "Users", currentUser.uid);
  const friendRef = doc(db, "Users", friendUid);
  const chatRef = doc(db, "chats", chatId);

  const [text, setText] = useState("");
  const [editingMessage, setEditingMessage] = useState(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchOption, setSearchOption] = useState(false);
  const [searchChoise, setSearchChoise] = useState(null);
  const [textLink, setTextLink] = useState(false);

  const [friendStatus, setFriendStatus] = useState({
    isOnline: false,
    inChat: false,
    lastSeen: null,
    typing: false,
  });

  const [messages, setMessages] = useState([]);

  // Tek onSnapshot listener ile mesajlar ve friend status
  useEffect(() => {
    // Kullanıcı online
    const goOnline = async () => {
      await updateDoc(currentUserRef, { isOnline: true });
      await setDoc(
        chatRef,
        { information: { inChat: { [currentUser.uid]: true } } },
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
            lastSeen: { [currentUser.uid]: serverTimestamp() },
            typing: { [currentUser.uid]: false },
          },
        },
        { merge: true }
      );
    };

    goOnline();
    const unsubMessages = onSnapshot(
      query(messagesRef, orderBy("timestamp", "asc")),
      (snapshot) => {
        const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(msgs);

        // Mesaj durumu güncelle
        msgs.forEach(async (msg) => {
          if (msg.senderId === currentUser.uid && msg.status === "sent") {
            await updateDoc(doc(messagesRef, msg.id), { status: "delivered" });
          }
          if (msg.senderId !== currentUser.uid && msg.status !== "seen") {
            await updateDoc(doc(messagesRef, msg.id), { status: "seen" });
          }
        });

        flatListRef.current?.scrollToEnd({ animated: true });
      }
    );

    const unsubChat = onSnapshot(chatRef, (docSnap) => {
      const data = docSnap.data() || {};
      const info = data.information || {};
      setFriendStatus({
        inChat: Boolean(info?.inChat?.[friendUid]),
        lastSeen: info?.lastSeen?.[friendUid] || null,
        typing: Boolean(info?.typing?.[friendUid]),
        isOnline: friendStatus.isOnline, // friendRef ile aşağıda güncellenecek
      });
    });

    const unsubFriend = onSnapshot(friendRef, (docSnap) => {
      const data = docSnap.data() || {};
      setFriendStatus((prev) => ({
        ...prev,
        isOnline: Boolean(data.isOnline),
      }));
    });

    return () => {
      goOffline();
      unsubMessages();
      unsubChat();
      unsubFriend();
    };
  }, []);

  // useMemo ile performans artır
  const memoizedMessages = useMemo(() => messages, [messages]);

  // URL kontrol
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const isLink = (value) => urlRegex.test(value);

  const handleTyping = async (value) => {
    setText(value);
    setTextLink(isLink(value));

    if (value.includes("#")) {
      fetchSearchResults(searchChoise);
      setSearchOption(true);
    } else {
      setSearchOption(false);
      setSearchChoise(null);
      setSearchResults([]);
    }

    await setDoc(
      chatRef,
      { information: { typing: { [currentUser.uid]: value.length > 0 } } },
      { merge: true }
    );
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    try {
      if (editingMessage) {
        await updateDoc(doc(messagesRef, editingMessage.id), {
          text,
          edited: true,
        });
        setEditingMessage(null);
      } else {
        await addDoc(messagesRef, {
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
      setTextLink(false);
      setSearchOption(false);
    } catch (err) {
      Alert.alert("Hata", "Mesaj gönderilemedi.");
      console.error(err);
    }
  };

  const renderMessageText = useCallback(
    (text) => {
      const parts = text.split(urlRegex).filter(Boolean);
      return parts.map((part, i) => {
        if (isLink(part)) {
          const url = part.startsWith("http") ? part : `https://${part}`;
          return (
            <Text
              key={i}
              style={{ color: "skyblue", textDecorationLine: "underline" }}
              onPress={() => Linking.openURL(url)}
            >
              {part}
            </Text>
          );
        }
        return (
          <Text
            key={i}
            style={[styles.messageText, { color: theme.text.primary }]}
          >
            {part}
          </Text>
        );
      });
    },
    [theme]
  );

  const handleLongPress = (item) => {
    if (item.senderId !== currentUser.uid) return;
    setSelectedMessage(item);
    setOptionsVisible(true);
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    const date = ts.toDate();
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

  const renderItem = useCallback(
    ({ item }) => {
      const isMe = item.senderId === currentUser.uid;

      return (
        <TouchableOpacity
          style={[
            styles.message,
            isMe ? styles.myMsg : styles.friendMsg,
            {
              backgroundColor: isMe ? theme.secondary : theme.secondaryt,
              borderColor: theme.border,
              borderWidth: 1,
            },
          ]}
          onLongPress={() => handleLongPress(item)}
          activeOpacity={0.8}
        >
          {item.media && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                overflow: "hidden",
                gap: 5,
              }}
            >
              {item.media?.poster_path && (
                <Image
                  source={{
                    uri: `https://image.tmdb.org/t/p/w500${item.media.poster_path}`,
                  }}
                  style={{
                    width: 70,
                    height: 105,
                    borderRadius: 12,
                    marginBottom: 5,
                  }}
                />
              )}
              <Text
                style={[
                  styles.messageText,
                  { color: theme.text.primary, maxWidth: "70%" },
                ]}
                numberOfLines={6}
              >
                {item.media?.overview}
              </Text>
            </View>
          )}
          {renderMessageText(item.text)}
          <Text
            style={{ fontSize: 12, color: theme.text.secondary, marginTop: 2 }}
          >
            {formatTime(item.timestamp)}
          </Text>
        </TouchableOpacity>
      );
    },
    [theme, renderMessageText]
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.secondary }]}
    >
      {/* FlatList ve Input modal burada yukarıdaki optimized FlatList kodu ile aynı */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  message: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 15,
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
  MsgOp: { alignSelf: "flex-start" },
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
    paddingVertical: 10,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalButton: {
    width: "30%",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  modalText: { color: "#fff", fontSize: 14 },
  messageOptions: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 30,
    marginVertical: 1,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
});
