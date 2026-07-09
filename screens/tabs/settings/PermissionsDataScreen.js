// screens/tabs/settings/PermissionsDataScreen.js
//
// Ayarlar > İzinler & Veriler. Cihaz izinleri (PermissionsSection) + çevrimdışı
// veri indirme + önbellek yönetimi tek ekranda.

import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import PermissionsSection from "@components/PermissionsSection";
import CacheManagerModal from "@components/CacheManagerModal";
import { appAlert } from "@components/AppAlert";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useConnectivity } from "@context/ConnectivityContext";
import { downloadAllData } from "@services/dataDownloader";
import { getBreakdown } from "@services/cacheInspector";
import { i18nText } from "@utils/i18nText";
import {
  SettingsSubScreen,
  SectionLabel,
  SettingRow,
  Chevron,
  buildUiColors,
} from "./settingsUi";

const fmtBytes = (b) =>
  b >= 1024 * 1024
    ? `${(b / 1048576).toFixed(1)} MB`
    : `${Math.max(0, Math.round(b / 1024))} KB`;

export default function PermissionsDataScreen() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const { isOnline } = useConnectivity();

  const [cacheSize, setCacheSize] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadPct, setDownloadPct] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);

  const refreshCacheSize = async () => {
    try {
      const breakdown = await getBreakdown();
      setCacheSize(breakdown.total);
    } catch {
      // yok say
    }
  };
  useEffect(() => {
    refreshCacheSize();
  }, []);

  const handleDownloadData = async () => {
    if (downloading) return;
    if (!isOnline) {
      appAlert(
        i18nText("autoI18n.cevrimdisi", "Çevrimdışı"),
        i18nText(
          "autoI18n.veriIndirmeInternet",
          "Verileri indirmek için internet bağlantısı gerekli.",
        ),
      );
      return;
    }
    setDownloading(true);
    setDownloadPct(0);
    try {
      const res = await downloadAllData({
        language,
        onProgress: (p) => setDownloadPct(p),
      });
      await refreshCacheSize();
      if (res.ok) {
        appAlert(
          i18nText("autoI18n.tamamlandi", "Tamamlandı"),
          i18nText(
            "autoI18n.verilerIndirildi",
            "Veriler çevrimdışı kullanım için indirildi.",
          ),
        );
      } else {
        appAlert(
          i18nText("autoI18n.kismenIndirildi", "Kısmen indirildi"),
          res.errors.join("\n"),
        );
      }
    } catch (e) {
      appAlert(i18nText("autoI18n.hata", "Hata"), e?.message || "");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SettingsSubScreen title={i18nText("autoI18n.izinlerVeVeriler", "İzinler & Veriler")}>
      <SectionLabel color={C.muted}>
        {(t.myPermissions || "İzinlerim").toUpperCase()}
      </SectionLabel>
      <PermissionsSection colors={C} />

      <SectionLabel color={C.muted}>{t.data.toUpperCase()}</SectionLabel>
      <View style={[ds.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <SettingRow
          colors={C}
          iconBg={C.iconBlue}
          iconColor={C.blue}
          iconFamily="MaterialCommunityIcons"
          iconName="cloud-download-outline"
          title={i18nText("autoI18n.verileriIndir", "Verileri indir")}
          subtitle={
            downloading
              ? `${i18nText("autoI18n.indiriliyor", "İndiriliyor")} · %${Math.round(
                  downloadPct * 100,
                )}`
              : i18nText(
                  "autoI18n.verileriIndirAlt",
                  "Çevrimdışı için listeler, notlar, hatırlatıcılar ve posterler",
                )
          }
          onPress={handleDownloadData}
          right={
            downloading ? (
              <ActivityIndicator size="small" color={C.blue} />
            ) : (
              <Chevron color={C.muted} />
            )
          }
        />
        <SettingRow
          colors={C}
          iconBg={C.iconBlue}
          iconColor={C.blue}
          iconName="server-outline"
          title={i18nText("autoI18n.onbellek", "Önbellek")}
          subtitle={
            cacheSize > 0
              ? `${fmtBytes(cacheSize)} · ${i18nText("autoI18n.goruntuleVeTemizle", "görüntüle ve temizle")}`
              : i18nText("autoI18n.goruntuleVeTemizle", "görüntüle ve temizle")
          }
          last
          onPress={() => setModalVisible(true)}
          right={<Chevron color={C.muted} />}
        />
      </View>

      <CacheManagerModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          refreshCacheSize();
        }}
        colors={C}
      />
    </SettingsSubScreen>
  );
}

const ds = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
});
