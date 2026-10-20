// screens/tabs/profile/FriendRequestsScreen.js
//
// Arkadaşlık istekleri: Gelen / Gönderilen sekmeleri.
//
//   • Gelen: her istek kendi kartında — kim olduğu + ne zaman geldiği, altında
//     iki ETİKETLİ düğme (Kabul et / Reddet). Eskiden yalnız ✓ ve ✕ ikonları
//     vardı; hangisinin ne yaptığı okunmuyor, parmakla zor vuruluyordu.
//   • Gönderilen: ortak grup kartı satırları; sağda "Geri çek".
//
// Görünüm components/friends/* ortak bileşenlerinden gelir. Tüm yazma mantığı
// FriendsContext + friendsService'te (atomic batch); burada yalnız çağrılır.

import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useFriends } from "../../../context/FriendsContext";
import ScreenDecor from "../../../components/ScreenDecor";
import StaggerItem from "../../../components/StaggerItem";
import UserAvatar from "../../../components/common/UserAvatar";
import FriendsScreenHeader from "../../../components/friends/FriendsScreenHeader";
import FriendsSegmentedTabs from "../../../components/friends/FriendsSegmentedTabs";
import FriendsEmptyState from "../../../components/friends/FriendsEmptyState";
import PersonRow from "../../../components/friends/PersonRow";
import PillButton from "../../../components/friends/PillButton";
import { FRIEND_GREEN, PENDING_AMBER } from "../../../components/friends/friendsTokens";
import * as Haptics from "../../../services/hapticsService";
import { alpha } from "../../../theme/colors";
import { toEpochMs } from "../../../utils/friendsListModel";
import { formatTimeAgo } from "../../../utils/postTime";
import { i18nText } from "../../../utils/i18nText";

/** "@kullanici · 2 gün önce" — zaman henüz çözülmediyse (sunucu damgası) yalnız ad. */
const handleLine = (username, ago) => (ago ? `@${username} · ${ago}` : `@${username}`);

export default function FriendRequestsScreen({ navigation }) {
  const [tab, setTab] = useState("received");
  const { theme } = useTheme();
  const { t } = useLanguage();
  const {
    incomingRequests,
    outgoingRequests,
    acceptRequest,
    declineRequest,
    cancelRequest,
  } = useFriends();

  // Context (alt koleksiyon modeli) verisini kartın beklediği
  // {id, uid, displayName, username, avatarIndex, photoURL, createdAt} şekline normalize et.
  const requests = useMemo(
    () =>
      incomingRequests.map((r) => ({
        id: r.id,
        uid: r.fromUid,
        displayName: r.fromName,
        username: r.fromUsername,
        avatarIndex: r.fromAvatarIndex,
        photoURL: r.fromPhotoURL || null,
        createdAt: r.createdAt,
      })),
    [incomingRequests],
  );
  const sentRequests = useMemo(
    () =>
      outgoingRequests.map((r) => ({
        id: r.id,
        uid: r.toUid,
        displayName: r.toName,
        username: r.toUsername,
        avatarIndex: r.toAvatarIndex,
        photoURL: r.toPhotoURL || null,
        createdAt: r.createdAt,
      })),
    [outgoingRequests],
  );

  // Tüm yazma mantığı FriendsContext + friendsService'te (atomic batch).
  const handleAccept = (friend) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    acceptRequest(friend.uid);
  };
  const handleDecline = (friend) => declineRequest(friend.uid);
  const handleCancelSent = (friend) => cancelRequest(friend.uid);

  const openProfile = (item) =>
    navigation?.navigate("FriendProfileScreen", {
      friendUid: item.uid,
      friendName: item.displayName,
    });
  const goSearch = () => navigation?.navigate("SearchFriendsScreen");

  const agoOf = (item) => formatTimeAgo(toEpochMs(item.createdAt), t.shareScreen?.timeAgo);

  const isReceived = tab === "received";
  const activeData = isReceived ? requests : sentRequests;

  // ── Gelen istek kartı ──
  const renderReceived = ({ item, index }) => (
    <StaggerItem index={index}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.secondary, borderColor: alpha(theme.border, 0.7) },
        ]}
      >
        <Pressable
          onPress={() => openProfile(item)}
          style={({ pressed }) => [styles.cardTop, pressed && { opacity: 0.8 }]}
        >
          <UserAvatar
            avatarIndex={item.avatarIndex}
            photoURL={item.photoURL}
            isCustomPhoto
            size={56}
            borderWidth={2}
            borderColor={alpha(FRIEND_GREEN, 0.55)}
          />
          <View style={styles.cardCopy}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.cardName, { color: theme.text?.primary ?? "#fff" }]}
            >
              {item.displayName}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.cardMeta, { color: theme.text?.muted ?? "#888" }]}
            >
              {handleLine(item.username, agoOf(item))}
            </Text>
          </View>
        </Pressable>

        <View style={styles.cardActions}>
          <PillButton
            style={styles.flex}
            variant="primary"
            tone={FRIEND_GREEN}
            icon="checkmark"
            label={i18nText("autoI18n.friends_ui_accept", "Kabul et")}
            onPress={() => handleAccept(item)}
          />
          <PillButton
            style={styles.flex}
            variant="ghost"
            icon="close"
            label={i18nText("autoI18n.friends_ui_decline", "Reddet")}
            onPress={() => handleDecline(item)}
          />
        </View>
      </View>
    </StaggerItem>
  );

  // ── Gönderilen istek satırı ──
  const renderSent = ({ item, index }) => {
    const ago = agoOf(item);
    return (
      <PersonRow
        avatar={{ avatarIndex: item.avatarIndex, photoURL: item.photoURL, isCustomPhoto: true }}
        ringColor={alpha(PENDING_AMBER, 0.55)}
        title={item.displayName}
        subtitle={
          <Text allowFontScaling={false} numberOfLines={1} style={styles.sentSubtitle}>
            <Text style={{ color: theme.text?.muted ?? "#888" }}>@{item.username}</Text>
            <Text style={{ color: PENDING_AMBER, fontWeight: "700" }}>
              {` · ${i18nText("autoI18n.friends_ui_pending", "Bekliyor")}`}
            </Text>
            {ago ? <Text style={{ color: theme.text?.muted ?? "#888" }}>{` · ${ago}`}</Text> : null}
          </Text>
        }
        trailing={
          <PillButton
            size="sm"
            variant="soft"
            tone={PENDING_AMBER}
            label={i18nText("autoI18n.friends_ui_withdraw", "Geri çek")}
            onPress={() => handleCancelSent(item)}
          />
        }
        onPress={() => openProfile(item)}
        first={index === 0}
        last={index === sentRequests.length - 1}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScreenDecor scope="profile" iconOpacity={0.3} />

      <FriendsScreenHeader
        title={i18nText("autoI18n.arkadaslik_istekleri", "Arkadaşlık İstekleri")}
        subtitle={
          requests.length
            ? i18nText("autoI18n.friends_ui_requests_pending", "{{n}} bekleyen istek", {
                n: requests.length,
              })
            : i18nText("autoI18n.friends_ui_requests_none", "Bekleyen istek yok")
        }
      />

      <FriendsSegmentedTabs
        value={tab}
        onChange={setTab}
        tabs={[
          {
            key: "received",
            label: i18nText("autoI18n.gelen_istekler", "Gelen İstekler"),
            badge: requests.length,
            badgeColor: FRIEND_GREEN,
          },
          {
            key: "sent",
            label: i18nText("autoI18n.gonderilenler", "Gönderilenler"),
            badge: sentRequests.length,
            badgeColor: PENDING_AMBER,
          },
        ]}
      />

      {activeData.length === 0 ? (
        <FriendsEmptyState
          icon={isReceived ? "mail-open" : "paper-plane"}
          tone={isReceived ? FRIEND_GREEN : PENDING_AMBER}
          title={
            isReceived
              ? i18nText("autoI18n.gelen_arkadaslik_istegi_yok", "Gelen arkadaşlık isteği yok")
              : i18nText("autoI18n.gonderilen_arkadaslik_istegi_yok", "Gönderilen arkadaşlık isteği yok")
          }
          description={
            isReceived
              ? i18nText(
                  "autoI18n.friends_ui_empty_received_desc",
                  "Biri sana istek gönderdiğinde burada görünür.",
                )
              : i18nText(
                  "autoI18n.friends_ui_empty_sent_desc",
                  "Gönderdiğin istekler kabul edilene kadar burada bekler.",
                )
          }
          actionLabel={i18nText("autoI18n.arkadas_ara", "Arkadaş Ara")}
          actionIcon="search"
          onAction={goSearch}
        />
      ) : (
        <FlatList
          // Sekme değişince liste sıfırdan çizilsin: StaggerItem giriş animasyonu
          // yalnız mount'ta çalışır, aynı FlatList'te veri değişirse tekrarlanmaz.
          key={tab}
          data={activeData}
          keyExtractor={(item) => item.uid}
          renderItem={isReceived ? renderReceived : renderSent}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  flex: { flex: 1 },
  listContent: { paddingBottom: 30 },

  // ── Gelen istek kartı ────────────────────────────────────────────────────
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  cardCopy: { flex: 1, minWidth: 0, gap: 3 },
  cardName: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  cardMeta: { fontSize: 13 },
  cardActions: { flexDirection: "row", gap: 10 },

  sentSubtitle: { fontSize: 13 },
});
