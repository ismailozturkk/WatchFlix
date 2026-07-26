import { Image } from "expo-image";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Keyboard,
} from "react-native";
import { getAuth } from "firebase/auth";
import { useTheme } from "../../context/ThemeContext";
import { appAlert } from "@components/AppAlert";
import Ionicons from "@expo/vector-icons/Ionicons";
import ScreenDecor from "../../components/ScreenDecor";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/BackButton";
import LottieView from "lottie-react-native";
import { useProfileUi } from "../../context/ProfileUiContext";
import { useFriends } from "../../context/FriendsContext";
import { searchUsersByUsername } from "../../services/userService";
import { i18nText } from "../../utils/i18nText";

;

export default function SearchFriendsScreen({ navigation }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const auth = getAuth();
  const { theme } = useTheme();
  const currentUser = auth.currentUser;
  const { avatars } = useProfileUi();
  const {
    isFriend,
    hasOutgoingTo,
    sendRequest,
    cancelRequest,
    removeFriend,
  } = useFriends();

  const titleAnim = useRef(new Animated.Value(0)).current;
  const searchBarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(searchBarAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm.trim()) {
        handleSearch(searchTerm.trim());
      } else {
        setResults([]);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Hızlı yazımda eski sorgunun yanıtı yenisini ezmesin diye istek kimliği.
  const searchReqRef = useRef(0);
  const handleSearch = useCallback(
    async (searchTerm) => {
      if (!searchTerm || !currentUser) return;
      const reqId = ++searchReqRef.current;
      try {
        const users = await searchUsersByUsername(searchTerm, {
          excludeUid: currentUser.uid,
        });
        if (reqId === searchReqRef.current) setResults(users);
      } catch (e) {
        // Ağ/Firestore hatası: sessizce yut — aksi halde setTimeout içinden
        // çağrıldığı için unhandled promise rejection olur.
        if (__DEV__) console.warn("searchUsersByUsername failed:", e?.message);
      }
    },
    [currentUser],
  );

  // Görünür silme butonuna yanlışlıkla basılabilir (swipe'ın aksine) — onay iste.
  const confirmRemove = (item) =>
    appAlert(
      i18nText("autoI18n.arkadasi_sil", "Arkadaşı Sil"),
      i18nText(
        "autoI18n.arkadas_silme_onay",
        "{{name}} arkadaş listenden silinsin mi?",
        { name: item.displayName },
      ),
      [
        { text: i18nText("autoI18n.vazgec", "Vazgeç"), style: "cancel" },
        {
          text: i18nText("autoI18n.sil", "Sil"),
          style: "destructive",
          onPress: () => removeFriend(item.uid),
        },
      ],
    );

  const renderItem = ({ item }) => {
    const alreadyFriend = isFriend(item.uid);
    const requestSent = hasOutgoingTo(item.uid);

    const statusColor = alreadyFriend
      ? theme.colors?.green ?? "#29b864"
      : requestSent
        ? "#ff9650"
        : null;

    const statusLabel = alreadyFriend
      ? i18nText("autoI18n.arkadas", "Arkadaş")
      : requestSent
        ? i18nText("autoI18n.istek_gonderildi", "İstek Gönderildi")
        : null;

    return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate("FriendProfileScreen", {
              friendUid: item.uid,
              friendName: item.displayName,
            })
          }
          style={[
            styles.userCard,
            {
              backgroundColor: theme.secondary,
              borderColor: statusColor ? statusColor + "55" : theme.border,
            },
          ]}
        >
          {/* Avatar */}
          <View style={[styles.avatarWrapper, { borderColor: statusColor ?? theme.border }]}>
            {avatars?.[item.avatarIndex] ? (
              <Image source={avatars[item.avatarIndex]} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                <Ionicons name="person" size={22} color={theme.text?.muted ?? "#555"} />
              </View>
            )}
          </View>

          {/* Bilgiler */}
          <View style={styles.userInfo}>
            <Text
              style={[styles.displayName, { color: theme.text?.primary ?? "#fff" }]}
              numberOfLines={1}
            >
              {item.displayName}
            </Text>
            <Text
              style={[styles.username, { color: theme.text?.secondary ?? "#aaa" }]}
              numberOfLines={1}
            >
              @{item.username}
            </Text>
            {item.email ? (
              <Text
                style={[styles.email, { color: theme.text?.muted ?? "#666" }]}
                numberOfLines={1}
              >
                {item.email}
              </Text>
            ) : null}
          </View>

          {/* Durum rozeti */}
          {statusLabel ? (
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          ) : null}

          {/* İşlem butonu — eski kaydırma işlemlerinin yerine */}
          {alreadyFriend ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#fa323222" }]}
              onPress={() => confirmRemove(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="trash-outline" size={17} color="#fa3232" />
            </TouchableOpacity>
          ) : requestSent ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#e56d3522" }]}
              onPress={() => cancelRequest(item.uid)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="arrow-undo-outline" size={17} color="#e56d35" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#30a75e22" }]}
              onPress={() => sendRequest(item.uid)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="person-add-outline" size={17} color="#30a75e" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
    );
  };

  const titleStyle = {
    opacity: titleAnim,
    transform: [
      {
        translateY: titleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-16, 0],
        }),
      },
    ],
  };
  const searchBarStyle = {
    opacity: searchBarAnim,
    transform: [
      {
        translateY: searchBarAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScreenDecor iconOpacity={0.3} />

      {/* Başlık */}
      <Animated.Text
        style={[styles.pageTitle, { color: theme.text?.primary ?? "#fff" }, titleStyle]}
      >{i18nText("autoI18n.arkadas_ara", "Arkadaş Ara")}</Animated.Text>

      {/* Arama kutusu */}
      <Animated.View style={[styles.searchRow, searchBarStyle]}>
        <View style={[styles.searchBar, { backgroundColor: theme.secondary }]}>
          <Ionicons
            name="search"
            size={18}
            color={theme.text?.muted ?? "#666"}
            style={{ marginRight: 8 }}
          />
          <TextInput
            placeholder={i18nText("autoI18n.kullanici_adi_ile_ara", "Kullanıcı adı ile ara...")}
            placeholderTextColor={theme.text?.muted ?? "#666"}
            value={searchTerm}
            onChangeText={setSearchTerm}
            maxLength={80}
            autoCapitalize="none"
            style={[styles.searchInput, { color: theme.text?.primary ?? "#fff" }]}
            returnKeyType="search"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearchTerm(""); setResults([]); Keyboard.dismiss(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={theme.text?.muted ?? "#666"} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* İçerik */}
      {searchTerm === "" ? (
        <View style={styles.emptyState}>
          <LottieView
            style={{ width: 300, height: 300 }}
            source={require("@lottie/search12.json")}
            autoPlay
            loop
          />
          <Text style={[styles.emptyText, { color: theme.text?.secondary ?? "#aaa" }]}>{i18nText("autoI18n.arkadaslarini_bulmak_icin_kullanici_adi_yaz", "Arkadaşlarını bulmak için kullanıcı adı yaz")}</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={52} color={theme.text?.muted ?? "#444"} />
          <Text style={[styles.emptyText, { color: theme.text?.secondary ?? "#aaa" }]}>
            "{searchTerm}{i18nText("autoI18n.icin_kullanici_bulunamadi", "\" için kullanıcı bulunamadı")}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
      <BackButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },

  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 14,
    marginTop: 4,
  },

  searchRow: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 2,
    borderRadius: 16,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },

  listContent: { paddingHorizontal: 16, paddingBottom: 30, paddingTop: 4 },

  // ── User card ────────────────────────────────────────────────────────────
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
  },
  avatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    overflow: "hidden",
  },
  avatar: { width: "100%", height: "100%", borderRadius: 26 },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  userInfo: { flex: 1, gap: 2 },
  displayName: { fontSize: 15, fontWeight: "700" },
  username: { fontSize: 13 },
  email: { fontSize: 12 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Empty state ──────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
