// screens/search/SearchFriendsScreen.js
//
// Arkadaş Ara: kullanıcı adıyla arama + sonuçta tek dokunuşla istek gönderme.
//
// Görünüm ortak arkadaş-ekranı bileşenlerinden gelir (components/friends/*):
// başlık, arama kutusu, grup kartı satırları, etiketli düğmeler, boş durumlar.
// Burada yalnız arama davranışı ve satırın duruma göre eylemi var.

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { getAuth } from "firebase/auth";
import LottieView from "lottie-react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { useFriends } from "../../context/FriendsContext";
import ScreenDecor from "../../components/ScreenDecor";
import FriendsScreenHeader from "../../components/friends/FriendsScreenHeader";
import FriendsSearchField from "../../components/friends/FriendsSearchField";
import FriendsEmptyState from "../../components/friends/FriendsEmptyState";
import PersonRow from "../../components/friends/PersonRow";
import PillButton from "../../components/friends/PillButton";
import { FRIEND_GREEN, PENDING_AMBER } from "../../components/friends/friendsTokens";
import * as Haptics from "../../services/hapticsService";
import { searchUsersByUsername } from "../../services/userService";
import { alpha } from "../../theme/colors";
import { i18nCount, i18nText } from "../../utils/i18nText";

const DEBOUNCE_MS = 500;

export default function SearchFriendsScreen({ navigation }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  // Sonuçların HANGİ sorguya ait olduğu: yazı değişti ama istek henüz dönmediyse
  // (term !== resultsTerm) ekranda "bulunamadı" yerine arama göstergesi çıkar.
  const [resultsTerm, setResultsTerm] = useState("");
  const [searchFailed, setSearchFailed] = useState(false);
  const auth = getAuth();
  const { theme } = useTheme();
  const currentUser = auth.currentUser;
  const { isFriend, hasOutgoingTo, sendRequest, cancelRequest, isBlocked } = useFriends();

  const trimmed = searchTerm.trim();

  // Engellenen kullanıcı arama sonuçlarında çıkmaz — çıksa "Ekle" düğmesi
  // görünür ve istek kural düzeyinde (notBlocked) reddedilirdi; kullanıcı
  // sebebini anlamadan bir hata görürdü.
  const visibleResults = useMemo(
    () => results.filter((u) => !isBlocked(u?.uid || u?.id)),
    [results, isBlocked],
  );

  // Hızlı yazımda eski sorgunun yanıtı yenisini ezmesin diye istek kimliği.
  const searchReqRef = useRef(0);
  const handleSearch = useCallback(
    async (term) => {
      if (!term || !currentUser) return;
      const reqId = ++searchReqRef.current;
      try {
        const users = await searchUsersByUsername(term, { excludeUid: currentUser.uid });
        if (reqId !== searchReqRef.current) return;
        setResults(users);
        setSearchFailed(false);
        setResultsTerm(term);
      } catch (e) {
        // Ağ/Firestore hatası: kullanıcıya "bulunamadı" demek yanlış olurdu —
        // ayrı bir hata durumu göster (setTimeout içinden çağrıldığı için ayrıca
        // yutmazsak unhandled promise rejection olur).
        if (__DEV__) console.warn("searchUsersByUsername failed:", e?.message);
        if (reqId !== searchReqRef.current) return;
        setResults([]);
        setSearchFailed(true);
        setResultsTerm(term);
      }
    },
    [currentUser],
  );

  useEffect(() => {
    if (!trimmed) {
      // Kutu boşaldı: uçuştaki isteğin yanıtı eski sonucu geri getirmesin.
      searchReqRef.current += 1;
      setResults([]);
      setResultsTerm("");
      setSearchFailed(false);
      return undefined;
    }
    const handler = setTimeout(() => handleSearch(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [trimmed, handleSearch]);

  const pending = trimmed.length > 0 && resultsTerm !== trimmed;

  const openProfile = (item) =>
    navigation.navigate("FriendProfileScreen", {
      friendUid: item.uid,
      friendName: item.displayName,
    });

  const renderItem = ({ item, index }) => {
    const alreadyFriend = isFriend(item.uid);
    const requestSent = hasOutgoingTo(item.uid);
    const statusColor = alreadyFriend ? FRIEND_GREEN : requestSent ? PENDING_AMBER : null;
    const statusLabel = alreadyFriend
      ? i18nText("autoI18n.arkadas", "Arkadaş")
      : requestSent
        ? i18nText("autoI18n.istek_gonderildi", "İstek Gönderildi")
        : null;

    const subtitle = (
      <Text allowFontScaling={false} numberOfLines={1} style={styles.subtitle}>
        <Text style={{ color: theme.text?.muted ?? "#888" }}>@{item.username}</Text>
        {statusLabel ? (
          <Text style={{ color: statusColor, fontWeight: "700" }}>{` · ${statusLabel}`}</Text>
        ) : null}
      </Text>
    );

    let trailing;
    if (alreadyFriend) {
      trailing = (
        <View style={[styles.friendChip, { backgroundColor: alpha(FRIEND_GREEN, 0.15) }]}>
          <Ionicons name="checkmark-circle" size={15} color={FRIEND_GREEN} />
        </View>
      );
    } else if (requestSent) {
      trailing = (
        <PillButton
          size="sm"
          variant="soft"
          tone={PENDING_AMBER}
          icon="arrow-undo"
          label={i18nText("autoI18n.geri_al", "Geri Al")}
          onPress={() => cancelRequest(item.uid)}
        />
      );
    } else {
      trailing = (
        <PillButton
          size="sm"
          variant="primary"
          icon="person-add"
          label={i18nText("autoI18n.ekle", "Ekle")}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            sendRequest(item.uid);
          }}
        />
      );
    }

    return (
      <PersonRow
        avatar={{ avatarIndex: item.avatarIndex, photoURL: item.photoURL }}
        ringColor={statusColor}
        title={item.displayName}
        subtitle={subtitle}
        trailing={trailing}
        onPress={() => openProfile(item)}
        first={index === 0}
        last={index === visibleResults.length - 1}
      />
    );
  };

  let body;
  if (!trimmed) {
    body = (
      <FriendsEmptyState
        art={
          <LottieView
            style={styles.lottie}
            source={require("@lottie/search12.json")}
            autoPlay
            loop
          />
        }
        title={i18nText("autoI18n.friends_ui_search_idle_title", "Arkadaşlarını bul")}
        description={i18nText(
          "autoI18n.arkadaslarini_bulmak_icin_kullanici_adi_yaz",
          "Arkadaşlarını bulmak için kullanıcı adı yaz",
        )}
      />
    );
  } else if (pending) {
    // İlk sonuç henüz gelmediyse boş ekran bırakma; önceki sonuçlar varsa onları
    // göstermeye devam et (alan içindeki gösterge aramanın sürdüğünü anlatır).
    body = visibleResults.length ? null : <View style={styles.flex} />;
  } else if (searchFailed) {
    body = (
      <FriendsEmptyState
        icon="cloud-offline"
        tone={PENDING_AMBER}
        title={i18nText("autoI18n.friends_ui_search_error_title", "Arama yapılamadı")}
        description={i18nText(
          "autoI18n.friends_ui_search_error_desc",
          "Bağlantını kontrol edip tekrar dene.",
        )}
        actionLabel={i18nText("autoI18n.friends_ui_retry", "Tekrar dene")}
        actionIcon="refresh"
        onAction={() => {
          // Yeniden dene: önceki hatayı ve "bu sorgu tamamlandı" işaretini sıfırla ki
          // alan içinde arama göstergesi dönsün.
          setSearchFailed(false);
          setResultsTerm("");
          handleSearch(trimmed);
        }}
      />
    );
  } else if (visibleResults.length === 0) {
    body = (
      <FriendsEmptyState
        icon="person-outline"
        title={i18nText("autoI18n.friends_ui_no_results_title", "Kullanıcı bulunamadı")}
        description={i18nText(
          "autoI18n.friends_ui_no_results_desc",
          "“{{q}}” ile eşleşen biri yok. Kullanıcı adını kontrol et.",
          { q: trimmed },
        )}
      />
    );
  }

  const showList = trimmed.length > 0 && visibleResults.length > 0 && !searchFailed;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScreenDecor scope="profile" iconOpacity={0.3} />

      <FriendsScreenHeader
        title={i18nText("autoI18n.arkadas_ara", "Arkadaş Ara")}
        subtitle={i18nText(
          "autoI18n.friends_ui_search_subtitle",
          "Kullanıcı adıyla yeni arkadaşlar bul",
        )}
      />

      <FriendsSearchField
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholder={i18nText("autoI18n.kullanici_adi_ile_ara", "Kullanıcı adı ile ara...")}
        loading={pending}
        autoFocus
      />

      {showList ? (
        <FlatList
          data={visibleResults}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          ListHeaderComponent={
            <Text
              allowFontScaling={false}
              style={[styles.resultsLabel, { color: theme.text?.muted ?? "#888" }]}
            >
              {i18nCount("autoI18n.friends_ui_results_count", "{{n}} sonuç", visibleResults.length)}
            </Text>
          }
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        />
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  flex: { flex: 1 },
  listContent: { paddingBottom: 30 },
  resultsLabel: {
    marginLeft: 20,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  subtitle: { fontSize: 13 },
  // Klavye açıkken (autoFocus) kalan alana sığsın diye küçük.
  lottie: { width: 170, height: 170 },
  friendChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
