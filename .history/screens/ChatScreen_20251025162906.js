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
  Image,
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
import { useAppSettings } from "../context/AppSettingsContext";
import { useLanguage } from "../context/LanguageContext";
import axios from "axios";
import {
  Entypo,
  Feather,
  FontAwesome,
  MaterialCommunityIcons,
} from "@expo/vector-icons";

export default function ChatScreen({ route, navigation }) {
  const { friendUid, friendName } = route.params;
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const { language, t } = useLanguage();

  const { API_KEY, adultContent } = useAppSettings();
  const [editingMessage, setEditingMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [friendIsOnline, setFriendIsOnline] = useState(false);
  const [friendInchat, setFriendInchat] = useState(false);
  const [friendLastSeen, setFriendLastSeen] = useState(null);
  const [friendTyping, setFriendTyping] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [messageSend, setMessageSend] = useState([]);
  const [searchChoise, setSearchChoise] = useState(null);
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
            typing: { [currentUser.uid]: false },
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
    if (value.includes("#")) {
      fetchSearchResults(searchChoise);
      setSearchOption(true);
    } else {
      setSearchOption(false);
      setSearchChoise(null);
      setLoadingSearch(false);
      setSearchResults([]);
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

  //!------------------------------------------------------------------
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const fetchSearchResults = async (type) => {
    if (!text.includes("#")) return;

    const queryText = text.split("#")[1]; // slash sonrası
    if (!queryText) return;

    setLoadingSearch(true);
    try {
      const typeEndpointMap = {
        movie: "search/movie",
        tv: "search/tv",
        person: "search/person",
      };

      const endpoint = type ? typeEndpointMap[type] : "search/multi";
      const url = `https://api.themoviedb.org/3/${endpoint}`;

      const params = {
        query: queryText,
        include_adult: adultContent,
        language: language === "tr" ? "tr-TR" : "en-US",
        page: 1,
      };
      const headers = { Authorization: API_KEY };
      const response = await axios.get(url, { params, headers });

      let results = response.data.results.filter(
        (item) => item.media_type !== "unknown"
      );
      console.log(results);

      // if (type) {
      //   results = results.filter((item) => {
      //     if (type === "movie") return item.media_type === "movie";
      //     if (type === "tv") return item.media_type === "tv";
      //     if (type === "person") return item.media_type === "person";
      //     return true;
      //   });
      // }

      setSearchResults(
        results
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .sort((a, b) => b.vote_average - a.vote_average)
      );
    } catch (err) {
      console.error("Search error:", err.message);
    } finally {
      setLoadingSearch(false);
    }
  };

  //!------------------------------------------------------------------
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
          { backgroundColor: isMe ? "#43836eff" : theme.secondary },
        ]}
        onLongPress={() => handleLongPress(item)}
        onPress={() =>
          navigation.push(
            item.media?.media_type == "movie"
              ? "MovieDetails"
              : "TvShowsDetails",
            { id: item.media?.id }
          )
        }
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
            {item.media?.poster_path ? (
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
            ) : null}

            <Text
              style={[styles.messageText, { color: "#fff", maxWidth: "70%" }]}
              numberOfLines={6}
            >
              {item.media?.overview}
            </Text>
          </View>
        )}
        <Text style={[styles.messageText, { color: "#fff" }]}>{item.text}</Text>

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

  const handleSendSearchResult = async (item) => {
    if (!item) return;

    const messageData = {
      text: item.title || item.name || "Bilinmiyor", // Mesaj gövdesi
      senderId: currentUser.uid,
      timestamp: serverTimestamp(),
      status: "sent",
      media: {
        id: item.id,
        poster_path: item.poster_path || item.profile_path || null,
        media_type: item.media_type,
        vote_average: item.vote_average,
        vote_count: item.vote_count,
        overview: item.overview,
      },
    };

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), messageData);

      // Son mesajı chat doc’a güncelle
      await setDoc(
        chatRef,
        {
          information: {
            lastMessage: {
              [currentUser.uid]: {
                lastMessageText: messageData.text,
                lastMessageTime: serverTimestamp(),
              },
            },
            updatedAt: serverTimestamp(),
            participants: [currentUser.uid, friendUid],
          },
        },
        { merge: true }
      );

      // Arama sonuçları panelini kapat
      setSearchResults([]);
      setText("");
      setSearchOption(false);
      setSearchChoise(null);
    } catch (err) {
      console.error("Arama sonucu gönderme hatası:", err);
      Alert.alert("Hata", "Mesaj gönderilemedi.");
    }
  };

  return (
    <SafeAreaView
      keyboardShouldPersistTaps="handled"
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
          contentContainerStyle={{
            padding: 12,
            paddingBottom: 60,
            paddingTop: 60,
          }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={handleContentSizeChange}
          ListFooterComponent={
            friendTyping ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: theme.secondary,
                  borderRadius: 20,
                  borderTopLeftRadius: 0,
                  paddingHorizontal: 3,
                  paddingVertical: 2,
                  marginVertical: 2,
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
            { backgroundColor: theme.secondary, padding: 3 },
          ]}
        >
          {searchResults.length > 0 && (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => `${item.media_type}-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSendSearchResult(item)}
                  style={{
                    padding: 5,
                    borderColor: theme.border,
                  }}
                >
                  {item.poster_path || item.profile_path ? (
                    <Image
                      source={{
                        uri: `https://image.tmdb.org/t/p/w500${item.poster_path || item.profile_path}`,
                      }}
                      style={{
                        width: 70,
                        height: 105,
                        borderRadius: 12,
                      }}
                    />
                  ) : (
                    <FontAwesome
                      name="image"
                      size={70}
                      color={theme.secondary}
                    />
                  )}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
            />
          )}

          {/* {searchOption && (
            <View
              style={{
                flex: 1,

                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                marginVertical: 5,
              }}
            >
              <TouchableOpacity
                onPress={() => setSearchChoise("movie")}
                style={{
                  backgroundColor: theme.border,
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 10,
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: theme.text.primary }}>Film Ara</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSearchChoise("tv")}
                style={{
                  backgroundColor: theme.border,
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 10,
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: theme.text.primary }}>Dizi Ara</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSearchChoise("actor")}
                style={{
                  backgroundColor: theme.border,
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 10,
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: theme.text.primary }}>Oyuncu Ara</Text>
              </TouchableOpacity>
            </View>
          )} */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TextInput
              style={[
                styles.input,
                {
                  color: searchOption ? theme.colors.green : theme.text.primary,
                  backgroundColor: theme.primary,
                  borderColor: searchOption ? theme.colors.green : theme.border,
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
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.secondary },
                ]}
                onPress={async () => {
                  await deleteDoc(doc(messagesRef, selectedMessage.id));
                  setOptionsVisible(false);
                }}
              >
                <Feather name="trash-2" size={16} color="red" />
                <Text style={[styles.modalText, { color: "red" }]}>Sil</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setEditingMessage(selectedMessage);
                  setText(selectedMessage.text);
                  setOptionsVisible(false);
                }}
              >
                <MaterialCommunityIcons name="pencil" size={18} color="green" />
                <Text style={styles.modalText}>Düzenle</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { borderTopWidth: 1, borderColor: "#333" },
                ]}
                onPress={() => setOptionsVisible(false)}
              >
                <Entypo name="cross" size={20} color="red" />
                <Text style={styles.modalText}>İptal</Text>
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
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#2c2c2c",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalButton: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    alignItems: "center",
  },
  modalText: {
    color: "#fff",
    fontSize: 18,
  },
});
