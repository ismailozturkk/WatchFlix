// screens/tabs/profile/BlockedUsersScreen.js
//
// Engellenen kullanıcılar — listele + engeli kaldır.
//
// NEDEN AYRI EKRAN: engelleme yalnız "engelle" düğmesiyle bırakılamaz.
// Mağaza incelemesi (Apple 1.2 / Play UGC) engellemenin GERİ ALINABİLİR ve
// kullanıcı tarafından GÖRÜLEBİLİR olmasını arıyor; ayrıca kullanıcı kimi
// engellediğini hatırlamak zorunda kalmamalı.
//
// Liste FriendsContext'ten geliyor (realtime): engeli kaldırınca satır
// kendiliğinden düşer, ayrıca yeniden çekmeye gerek yok.

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "../../../context/ThemeContext";
import { useFriends } from "../../../context/FriendsContext";
import { getUserProfile } from "../../../services/userService";
import { clampAvatarIndex, getAvatarSource } from "../../../utils/avatars";
import { appAlert } from "../../../components/AppAlert";
import ScreenDecor from "../../../components/ScreenDecor";
import { i18nText } from "../../../utils/i18nText";
import { Image } from "expo-image";

export default function BlockedUsersScreen({ navigation }) {
  const { theme } = useTheme();
  const { blockedUsers, unblock } = useFriends();

  // Engel dokümanı yalnız uid + tarih tutuyor; ad/avatar profilden çekiliyor.
  // Tek seferlik: engel listesi kısa ve nadiren değişiyor, realtime profil
  // dinlemek bu ekran için gereksiz maliyet.
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const eksikler = blockedUsers
      .map((b) => b.uid)
      .filter((uid) => uid && profiles[uid] === undefined);

    if (!eksikler.length) {
      setLoading(false);
      return undefined;
    }

    (async () => {
      const sonuc = {};
      await Promise.all(
        eksikler.map(async (uid) => {
          try {
            sonuc[uid] = (await getUserProfile(uid)) || null;
          } catch {
            // Profil silinmiş ya da okunamıyor olabilir; satır yine de
            // gösterilmeli, yoksa kullanıcı engeli kaldıramaz.
            sonuc[uid] = null;
          }
        }),
      );
      if (cancelled) return;
      setProfiles((prev) => ({ ...prev, ...sonuc }));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [blockedUsers, profiles]);

  const confirmUnblock = useCallback(
    (uid, name) => {
      appAlert(
        name || i18nText("autoI18n.engeli_kaldir", "Engeli kaldır"),
        i18nText(
          "autoI18n.engeli_kaldir_onay_metni",
          "Bu kullanıcının gönderilerini ve mesajlarını yeniden görebileceksin.",
        ),
        [
          { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
          {
            text: i18nText("autoI18n.engeli_kaldir", "Engeli kaldır"),
            onPress: () => unblock(uid),
          },
        ],
      );
    },
    [unblock],
  );

  const renderItem = ({ item }) => {
    const profile = profiles[item.uid];
    const name =
      profile?.displayName ||
      profile?.username ||
      i18nText("autoI18n.kullanici", "Kullanıcı");
    return (
      <View style={[styles.row, { borderColor: theme.border }]}>
        <Image
          source={getAvatarSource(clampAvatarIndex(profile?.avatarIndex))}
          style={styles.avatar}
          contentFit="cover"
        />
        <View style={styles.rowText}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.text.primary }]}>
            {name}
          </Text>
          {!!profile?.username && (
            <Text numberOfLines={1} style={[styles.username, { color: theme.text.muted }]}>
              @{profile.username}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => confirmUnblock(item.uid, name)}
          style={[styles.unblockBtn, { borderColor: theme.accent }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.unblockText, { color: theme.accent }]}>
            {i18nText("autoI18n.engeli_kaldir", "Engeli kaldır")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
      edges={["top"]}
    >
      <ScreenDecor iconOpacity={0.15} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text.primary }]}>
          {i18nText("autoI18n.engellenen_kullanicilar", "Engellenen kullanıcılar")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={[styles.intro, { color: theme.text.muted }]}>
        {i18nText(
          "autoI18n.engellenen_kullanicilar_alt",
          "Engellediğin kişilerin gönderileri, yorumları ve mesajları sana görünmez.",
        )}
      </Text>

      {loading && blockedUsers.length > 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={theme.accent} />
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name="account-off-outline"
                size={48}
                color={theme.text.muted}
              />
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
                {i18nText("autoI18n.engellenen_kullanici_yok", "Engellenen kullanıcı yok")}
              </Text>
              <Text style={[styles.emptyText, { color: theme.text.muted }]}>
                {i18nText(
                  "autoI18n.engellenen_kullanici_yok_alt",
                  "Birini engellediğinde burada listelenir.",
                )}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: { width: 40, alignItems: "flex-start" },
  title: { fontSize: 17, fontWeight: "800", flex: 1, textAlign: "center" },
  intro: { fontSize: 12.5, lineHeight: 18, paddingHorizontal: 18, paddingBottom: 8 },
  listContent: { padding: 16, gap: 10, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 14.5, fontWeight: "700" },
  username: { fontSize: 12, marginTop: 1 },
  unblockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  unblockText: { fontSize: 12, fontWeight: "800" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "800" },
  emptyText: { fontSize: 12.5, textAlign: "center", paddingHorizontal: 40 },
});
