// components/PermissionsSection.js
//
// Ayarlar > "İzinlerim" bölümü. Cihaz (OS) izinlerini tek yerde gösterir:
//   - Bildirimler   (expo-notifications)
//   - Galeri/Medya  (expo-media-library — story görselini kaydetme)
//   - Fotoğraflar    (expo-image-picker — avatar seçme)
//
// Her satır: durum rozeti (Verildi / Reddedildi / Belirsiz) + aksiyon.
//   • İzin verilmemişse  → "İzin ver" (tekrar sorulabiliyorsa sistem sorar,
//                          kalıcı reddedilmişse sistem ayarlarını açar).
//   • İzin verilmişse     → "Geri çek" (mobil OS uygulamanın kendi iznini
//                          program ile geri almasına izin VERMEZ; bu yüzden
//                          sistem ayarları açılır, kullanıcı oradan kapatır).
//
// Durumlar uygulama öne geldikçe (AppState 'active') tazelenir — kullanıcı
// sistem ayarından izni değiştirip döndüğünde ekran güncel kalır.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Linking,
  ActivityIndicator,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as MediaLibrary from "expo-media-library";
import * as ImagePicker from "expo-image-picker";
import AppIcon from "@components/AppIcon";
import { appAlert } from "@components/AppAlert";
import { ensureAndroidChannels } from "@services/pushNotificationsService";
import { useLanguage } from "@context/LanguageContext";

// İzin tanımları — her biri get/request fonksiyonunu kendi modülüne bağlar.
// result objeleri ortak şekle sahiptir: { status, canAskAgain, granted }.
const PERMISSIONS = [
  {
    key: "notifications",
    icon: "notifications-outline",
    colorKey: "blue",
    bgKey: "iconBlue",
    titleKey: "permNotifications",
    descKey: "permNotificationsDesc",
    get: () => Notifications.getPermissionsAsync(),
    request: async () => {
      const res = await Notifications.requestPermissionsAsync();
      if (res.status === "granted") await ensureAndroidChannels();
      return res;
    },
  },
  {
    key: "mediaLibrary",
    icon: "images-outline",
    colorKey: "green",
    bgKey: "iconGreen",
    titleKey: "permGallery",
    descKey: "permGalleryDesc",
    get: () => MediaLibrary.getPermissionsAsync(),
    request: () => MediaLibrary.requestPermissionsAsync(),
  },
  {
    key: "photos",
    icon: "image-outline",
    colorKey: "purple",
    bgKey: "iconPurple",
    titleKey: "permPhotos",
    descKey: "permPhotosDesc",
    get: () => ImagePicker.getMediaLibraryPermissionsAsync(),
    request: () => ImagePicker.requestMediaLibraryPermissionsAsync(),
  },
];

const DEFAULT_STATE = { status: "undetermined", canAskAgain: true };

function StatusPill({ status, colors: C, t }) {
  let label = t.permUndetermined || "Belirsiz";
  let color = C.muted;
  let bg = C.borderMuted;
  let icon = "help-circle-outline";
  if (status === "granted") {
    label = t.permGranted || "Verildi";
    color = C.green;
    bg = C.iconGreen;
    icon = "checkmark-circle";
  } else if (status === "denied") {
    label = t.permDenied || "Reddedildi";
    color = C.danger;
    bg = C.dangerDim;
    icon = "close-circle";
  }
  return (
    <View style={[ps.pill, { backgroundColor: bg }]}>
      <AppIcon name={icon} size={12} color={color} />
      <Text allowFontScaling={false} style={[ps.pillText, { color }]}>
        {label}
      </Text>
    </View>
  );
}

export default function PermissionsSection({ colors: C }) {
  const { t } = useLanguage();
  const [states, setStates] = useState(() =>
    PERMISSIONS.reduce((acc, p) => ((acc[p.key] = DEFAULT_STATE), acc), {}),
  );
  const [refreshing, setRefreshing] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const entries = await Promise.all(
        PERMISSIONS.map(async (p) => {
          try {
            const res = await p.get();
            return [
              p.key,
              {
                status: res?.status ?? "undetermined",
                canAskAgain: res?.canAskAgain !== false,
              },
            ];
          } catch {
            return [p.key, DEFAULT_STATE];
          }
        }),
      );
      setStates(Object.fromEntries(entries));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // İlk yüklemede + uygulama öne geldikçe tazele.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const handleGrant = useCallback(
    async (perm) => {
      if (busyRef.current) return;
      const cur = states[perm.key] || DEFAULT_STATE;
      // Kalıcı reddedilmiş (tekrar sorulamaz) → sistem ayarlarını aç.
      if (cur.status !== "granted" && cur.canAskAgain === false) {
        appAlert(
          t.permOpenSettingsTitle || "Sistem ayarları",
          t.permOpenSettingsMessage ||
            "Bu izin kalıcı olarak reddedilmiş. Açmak için sistem ayarlarına gidin.",
          [
            { text: t.cancel || "İptal", style: "cancel" },
            {
              text: t.permOpenSettings || "Ayarları aç",
              onPress: () => Linking.openSettings().catch(() => {}),
            },
          ],
        );
        return;
      }
      busyRef.current = true;
      setBusyKey(perm.key);
      try {
        const res = await perm.request();
        await refresh();
        // Sorulamaz hâle geldiyse kullanıcıyı ayarlara yönlendir.
        if (res?.status !== "granted" && res?.canAskAgain === false) {
          appAlert(
            t.permOpenSettingsTitle || "Sistem ayarları",
            t.permOpenSettingsMessage ||
              "İzni açmak için sistem ayarlarına gidin.",
            [
              { text: t.cancel || "İptal", style: "cancel" },
              {
                text: t.permOpenSettings || "Ayarları aç",
                onPress: () => Linking.openSettings().catch(() => {}),
              },
            ],
          );
        }
      } catch {
        appAlert(
          t.permRequestErrorTitle || "İzin güncellenemedi",
          t.permRequestErrorMessage ||
            "İzin durumu değiştirilemedi. Lütfen sistem ayarlarından tekrar deneyin.",
        );
      } finally {
        busyRef.current = false;
        setBusyKey(null);
      }
    },
    [states, refresh, t],
  );

  // OS, uygulamanın kendi iznini program ile geri almasına izin vermez →
  // sistem ayarlarını açıp kullanıcıya bırakıyoruz.
  const handleRevoke = useCallback(
    (perm) => {
      appAlert(
        t.permRevokeTitle || "İzni geri çek",
        t.permRevokeMessage ||
          "İzni geri çekmek için sistem ayarlarını açmanız gerekir. Oradan bu uygulamanın iznini kapatabilirsiniz.",
        [
          { text: t.cancel || "İptal", style: "cancel" },
          {
            text: t.permOpenSettings || "Ayarları aç",
            onPress: () => Linking.openSettings().catch(() => {}),
          },
        ],
      );
    },
    [t],
  );

  const grantedCount = PERMISSIONS.reduce(
    (count, permission) =>
      count + (states[permission.key]?.status === "granted" ? 1 : 0),
    0,
  );
  const allGranted = grantedCount === PERMISSIONS.length;
  const progress = `${(grantedCount / PERMISSIONS.length) * 100}%`;

  return (
    <View style={[ps.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={[ps.summary, { borderBottomColor: C.borderMuted }]}>
        <View style={ps.summaryTop}>
          <View style={[ps.summaryIcon, { backgroundColor: C.accentDim }]}>
            <AppIcon
              name={allGranted ? "shield-checkmark" : "shield-checkmark-outline"}
              size={22}
              color={C.accentStrong}
            />
          </View>
          <View style={ps.summaryCopy}>
            <Text allowFontScaling={false} style={[ps.summaryTitle, { color: C.text }]}>
              {refreshing
                ? t.permChecking || "İzinler kontrol ediliyor"
                : `${grantedCount}/${PERMISSIONS.length} ${t.permActive || "izin etkin"}`}
            </Text>
            <Text allowFontScaling={false} style={[ps.summarySub, { color: C.muted }]}>
              {t.permSummary || "İzin özeti"}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t.permRefresh || "İzinleri yenile"}
            style={[ps.refreshBtn, { backgroundColor: C.cardAlt, borderColor: C.border }]}
            onPress={refresh}
            disabled={refreshing || busyKey !== null}
            activeOpacity={0.7}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={C.accentStrong} />
            ) : (
              <AppIcon name="refresh" size={17} color={C.accentStrong} />
            )}
          </TouchableOpacity>
        </View>
        <View style={[ps.progressTrack, { backgroundColor: C.cardAlt }]}>
          <View
            style={[
              ps.progressFill,
              { width: progress, backgroundColor: allGranted ? C.green : C.accent },
            ]}
          />
        </View>
      </View>

      {PERMISSIONS.map((perm, index) => {
        const st = states[perm.key] || DEFAULT_STATE;
        const granted = st.status === "granted";
        const busy = busyKey === perm.key;
        const last = index === PERMISSIONS.length - 1;
        return (
          <TouchableOpacity
            key={perm.key}
            accessibilityRole="button"
            accessibilityLabel={`${t[perm.titleKey] || perm.key}: ${
              granted
                ? t.permManage || "Yönet"
                : st.canAskAgain === false
                  ? t.permOpenSettings || "Ayarları aç"
                  : t.permGrant || "İzin ver"
            }`}
            style={[
              ps.row,
              { borderBottomColor: C.borderMuted },
              last && { borderBottomWidth: 0 },
            ]}
            onPress={() => (granted ? handleRevoke(perm) : handleGrant(perm))}
            disabled={busy || refreshing}
            activeOpacity={0.65}
          >
            <View style={[ps.iconWrap, { backgroundColor: C[perm.bgKey] }]}>
              <AppIcon name={perm.icon} size={16} color={C[perm.colorKey]} />
            </View>
            <View style={ps.rowTexts}>
              <Text
                allowFontScaling={false}
                style={[ps.rowTitle, { color: C.text }]}
              >
                {t[perm.titleKey] || perm.key}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[ps.rowSub, { color: C.muted }]}
              >
                {t[perm.descKey] || ""}
              </Text>
            </View>
            <View style={ps.rowAction}>
              {busy ? (
                <ActivityIndicator size="small" color={C.accentStrong} />
              ) : (
                <>
                  <StatusPill status={st.status} colors={C} t={t} />
                  <View style={ps.manageRow}>
                    <Text allowFontScaling={false} style={[ps.manageText, { color: C.muted }]}>
                      {granted
                        ? t.permManage || "Yönet"
                        : st.canAskAgain === false
                          ? t.permOpenSettings || "Ayarları aç"
                          : t.permGrant || "İzin ver"}
                    </Text>
                    <AppIcon name="chevron-forward" size={11} color={C.muted} />
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const ps = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 8,
  },
  summary: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  summaryCopy: {
    flex: 1,
    paddingRight: 8,
  },
  summaryTitle: {
    fontSize: 14.5,
    fontWeight: "800",
  },
  summarySub: {
    fontSize: 10,
    marginTop: 1,
  },
  refreshBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 3,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 9,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowTexts: {
    flex: 1,
    paddingRight: 6,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  rowSub: {
    fontSize: 9.5,
    marginTop: 1,
    lineHeight: 13,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 9,
    fontWeight: "700",
  },
  rowAction: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minWidth: 72,
  },
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  manageText: {
    fontSize: 8.5,
    fontWeight: "700",
  },
});
