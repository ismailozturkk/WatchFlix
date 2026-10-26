// screens/tabs/profile/FriendsListScreen.js
//
// Arkadaş listesi: A–Z sıralı, harf bölümlü grup kartları; uzun listede süzme
// kutusu. Satır → profil; satırdaki "mesaj" hızlı eylemi + "⋯" menüsü (mesaj /
// profil / arkadaşlıktan çıkar). Silme onayı alttan açılan ortak ConfirmSheet.
//
// Görünüm components/friends/* ortak bileşenlerinden gelir; burada Firestore
// aboneliği, silme ve gezinme davranışı var.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SectionList, StyleSheet } from "react-native";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  updateDoc,
  arrayRemove,
} from "firebase/firestore";
import { unfriend } from "../../../services/friendsService";
import { getAuth } from "firebase/auth";
import Toast from "@components/AppToast";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../../firebase";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import ScreenDecor from "../../../components/ScreenDecor";
import ConfirmSheet from "../../../components/common/ConfirmSheet";
import FriendsScreenHeader from "../../../components/friends/FriendsScreenHeader";
import FriendsSearchField from "../../../components/friends/FriendsSearchField";
import FriendsEmptyState from "../../../components/friends/FriendsEmptyState";
import FriendActionSheet from "../../../components/friends/FriendActionSheet";
import PersonRow, { FriendsSectionLabel } from "../../../components/friends/PersonRow";
import RoundIconButton from "../../../components/friends/RoundIconButton";
import {
  FILTER_MIN_ITEMS,
  groupPeopleByInitial,
  personMatchesQuery,
  shouldShowFilter,
  sortPeopleByName,
} from "../../../utils/friendsListModel";
import { i18nCount, i18nText } from "../../../utils/i18nText";

// ConfirmSheet'i, menü sayfasının kapanış animasyonu (≈260 ms) BİTTİKTEN sonra
// aç: iki Modal üst üste açılıp kapanırsa iOS ikincisini hiç göstermeyebilir.
const MENU_EXIT_MS = 320;

export default function FriendsListScreen({ navigation }) {
  const [friends, setFriends] = useState([]);
  const [query, setQuery] = useState("");
  // Menüde SON seçilen arkadaş kapanışta sıfırlanmaz (bkz. FriendActionSheet):
  // sayfa ≈260 ms daha çizilir, içerik boşalıp zıplamasın.
  const [menuFriend, setMenuFriend] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [removing, setRemoving] = useState(false);
  const confirmTimerRef = useRef(null);

  const auth = getAuth();
  const user = auth.currentUser;
  const { theme } = useTheme();
  const { language } = useLanguage();

  useEffect(() => () => clearTimeout(confirmTimerRef.current), []);

  useEffect(() => {
    if (!user) return;
    let legacyUnsub = null;

    const unsubSub = onSnapshot(
      collection(db, "Users", user.uid, "friends"),
      (snap) => {
        if (!snap.empty) {
          if (legacyUnsub) { legacyUnsub(); legacyUnsub = null; }
          setFriends(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                uid: data.friendUid || d.id,
                displayName: data.friendName || "",
                username: data.friendUsername || "",
                avatarIndex: data.friendAvatarIndex ?? 0,
                photoURL: data.friendPhotoURL || data.photoURL || null,
              };
            }),
          );
        } else if (!legacyUnsub) {
          legacyUnsub = onSnapshot(
            doc(db, "Users", user.uid),
            (docSnap) => {
              if (docSnap.exists()) setFriends(docSnap.data().friends || []);
            },
            (err) => __DEV__ && console.warn("FriendsList legacy:", err.message),
          );
        }
      },
      // Çıkış yapılırken oturum, dinleyici kapanmadan düşebilir.
      (err) => __DEV__ && console.warn("FriendsList friends:", err.message),
    );

    return () => {
      unsubSub();
      if (legacyUnsub) legacyUnsub();
    };
  }, [user]);

  const handleDelete = async (friend) => {
    try {
      // Ortak yol: arkadaşlık + iki taraftaki friendsCount + 1-1 sohbet
      // (friendsService.unfriend). Eskiden burada yalnız iki friends belgesi
      // siliniyordu; onay "sohbet de silinir" dediği halde sohbet ve sayaç
      // kalıyordu (T3 B13).
      const { chatFailed } = await unfriend(user.uid, friend.uid);
      // Eski format root-doc array'i de temizle (varsa)
      const [userSnap, friendSnap] = await Promise.all([
        getDoc(doc(db, "Users", user.uid)),
        getDoc(doc(db, "Users", friend.uid)),
      ]);
      const legacyUserFriends   = userSnap.data()?.friends || [];
      const legacyFriendFriends = friendSnap.data()?.friends || [];
      const userEntry   = legacyUserFriends.find((f) => f.uid === friend.uid);
      const friendEntry = legacyFriendFriends.find((f) => f.uid === user.uid);
      const updates = [];
      if (userEntry)   updates.push(updateDoc(doc(db, "Users", user.uid),   { friends: arrayRemove(userEntry) }));
      if (friendEntry) updates.push(updateDoc(doc(db, "Users", friend.uid), { friends: arrayRemove(friendEntry) }));
      if (updates.length) await Promise.all(updates);
      // Başarı toast'ı silme GERÇEKTEN bittikten sonra. Eskiden en başta
      // gösteriliyordu; izin/ağ hatasında kullanıcı hem "silindi" hem
      // "başarısız" bildirimini arka arkaya görüyordu.
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.friend_removed_named", "{{name}} arkadaş listenizden silindi", { name: friend.displayName }),
      });
      // Arkadaşlık çözüldü ama sohbetin bir kısmı silinemediyse (çevrimdışı…) söyle.
      if (chatFailed?.length) {
        Toast.show({
          type: "warning",
          text1: i18nText(
            "autoI18n.sohbet_tam_silinemedi",
            "Arkadaşlıktan çıkarıldı ancak sohbet tamamen silinemedi",
          ),
        });
      }
    } catch (error) {
      console.error(i18nText("autoI18n.arkadas_silme_hatasi", "Arkadaş silme hatası:"), error);
      Toast.show({ type: "error", text1: i18nText("autoI18n.silme_islemi_basarisiz", "Silme işlemi başarısız"), text2: error.message });
    }
  };

  const openMenu = (friend) => {
    setMenuFriend(friend);
    setMenuVisible(true);
  };

  const openChat = (friend) =>
    navigation.navigate("ChatScreen", {
      friendUid: friend.uid,
      friendName: friend.displayName,
      friendAvatarIndex: friend.avatarIndex,
    });

  const openProfile = (friend) =>
    navigation.navigate("FriendProfileScreen", {
      friendUid: friend.uid,
      friendName: friend.displayName,
    });

  const handleMenuMessage = () => {
    setMenuVisible(false);
    if (menuFriend) openChat(menuFriend);
  };
  const handleMenuProfile = () => {
    setMenuVisible(false);
    if (menuFriend) openProfile(menuFriend);
  };
  const handleMenuRemove = () => {
    setMenuVisible(false);
    clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirmVisible(true), MENU_EXIT_MS);
  };

  const confirmRemove = async () => {
    if (!menuFriend || removing) return;
    setRemoving(true);
    try {
      await handleDelete(menuFriend);
    } finally {
      setRemoving(false);
      setConfirmVisible(false);
    }
  };

  const showFilter = shouldShowFilter(friends.length);
  // Harf başlıkları yalnız uzun listede: 3 arkadaşa "A, B, C" başlığı gürültü.
  const showLetters = friends.length >= FILTER_MIN_ITEMS;

  const sections = useMemo(() => {
    const matching = friends.filter((f) => personMatchesQuery(f, query));
    return showLetters
      ? groupPeopleByInitial(matching, language)
      : matching.length
        ? [{ key: "", data: sortPeopleByName(matching, language) }]
        : [];
  }, [friends, query, language, showLetters]);

  const matchCount = sections.reduce((sum, s) => sum + s.data.length, 0);

  const renderFriend = ({ item, index, section }) => (
    <PersonRow
      avatar={{ avatarIndex: item.avatarIndex, photoURL: item.photoURL, isCustomPhoto: true }}
      title={item.displayName}
      subtitle={item.username ? `@${item.username}` : undefined}
      onPress={() => openProfile(item)}
      first={index === 0}
      last={index === section.data.length - 1}
      trailing={
        <>
          <RoundIconButton
            icon="chatbubble-ellipses"
            accessibilityLabel={i18nText("autoI18n.friends_ui_send_message", "Mesaj gönder")}
            onPress={() => openChat(item)}
          />
          <RoundIconButton
            icon="ellipsis-horizontal"
            variant="ghost"
            accessibilityLabel={i18nText("autoI18n.friends_ui_more_options", "Diğer seçenekler")}
            onPress={() => openMenu(item)}
          />
        </>
      }
    />
  );

  const goSearch = () => navigation.navigate("SearchFriendsScreen");

  let empty = null;
  if (friends.length === 0) {
    empty = (
      <FriendsEmptyState
        icon="people"
        title={i18nText("autoI18n.henuz_hic_arkadasin_yok", "Henüz hiç arkadaşın yok")}
        description={i18nText(
          "autoI18n.friends_ui_no_friends_desc",
          "Kullanıcı adıyla arayıp istek gönder; kabul edilince burada görünür.",
        )}
        actionLabel={i18nText("autoI18n.arkadas_ara", "Arkadaş Ara")}
        actionIcon="search"
        onAction={goSearch}
      />
    );
  } else if (matchCount === 0) {
    empty = (
      <FriendsEmptyState
        icon="search"
        title={i18nText("autoI18n.friends_ui_no_match_title", "Eşleşen kimse yok")}
        description={i18nText(
          "autoI18n.friends_ui_no_match_desc",
          "“{{q}}” ile eşleşen biri bulunamadı.",
          { q: query.trim() },
        )}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScreenDecor scope="profile" iconOpacity={0.3} />

      <FriendsScreenHeader
        title={i18nText("autoI18n.arkadaslar", "Arkadaşlar")}
        subtitle={
          friends.length
            ? i18nCount("autoI18n.friends_ui_friends_count", "{{n}} arkadaş", friends.length)
            : undefined
        }
        right={
          <RoundIconButton
            icon="person-add"
            size={42}
            accessibilityLabel={i18nText("autoI18n.arkadas_ara", "Arkadaş Ara")}
            onPress={goSearch}
          />
        }
      />

      {showFilter ? (
        <FriendsSearchField
          value={query}
          onChangeText={setQuery}
          placeholder={i18nText("autoI18n.friends_ui_filter_friends", "Arkadaşlarında ara")}
          returnKeyType="done"
        />
      ) : null}

      {empty || (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.uid}
          renderItem={renderFriend}
          renderSectionHeader={({ section }) =>
            section.key ? (
              <FriendsSectionLabel label={section.key} first={sections[0]?.key === section.key} />
            ) : null
          }
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        />
      )}

      <FriendActionSheet
        visible={menuVisible}
        friend={menuFriend}
        onClose={() => setMenuVisible(false)}
        onMessage={handleMenuMessage}
        onProfile={handleMenuProfile}
        onRemove={handleMenuRemove}
      />

      <ConfirmSheet
        visible={confirmVisible}
        onClose={() => !removing && setConfirmVisible(false)}
        onConfirm={confirmRemove}
        busy={removing}
        icon="person-remove-outline"
        tone="danger"
        title={i18nText("autoI18n.arkadasi_sil", "Arkadaşı Sil")}
        message={i18nText(
          "autoI18n.arkadas_silme_onay",
          "{{name}} arkadaş listenden silinsin mi?",
          { name: menuFriend?.displayName || "" },
        )}
        confirmLabel={i18nText("autoI18n.friends_ui_remove_friend", "Arkadaşlıktan çıkar")}
        cancelLabel={i18nText("autoI18n.vazgec", "Vazgeç")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  listContent: { paddingBottom: 30 },
});
