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
import { useAutoDataCacheSettings } from "@context/AppSettingsContext";
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
import { DATA_TYPE_COUNT, countEnabledTypes, getDataTypeOptions } from "./dataTypes";

const fmtBytes = (b) =>
  b >= 1024 * 1024
    ? `${(b / 1048576).toFixed(1)} MB`
    : `${Math.max(0, Math.round(b / 1024))} KB`;

export default function PermissionsDataScreen() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const { isOnline } = useConnectivity();
  const { autoDataCacheEnabled, dataCacheTypes } = useAutoDataCacheSettings();

  // Ana anahtar kapalıyken indirme yok; açıkken yalnız seçili türler inilir.
  const enabledTypeCount = countEnabledTypes(dataCacheTypes);
  const canDownload = autoDataCacheEnabled && enabledTypeCount > 0;
  const selectedLabels = getDataTypeOptions()
    .filter((opt) => dataCacheTypes?.[opt.id] !== false)
    .map((opt) => opt.label);
  // Satır altyazısı kısa kalsın: hepsi seçiliyse tek cümle, değilse ilk 3 + kalan.
  const typeSummary =
    enabledTypeCount === DATA_TYPE_COUNT
      ? i18nText("autoI18n.tum_veri_turleri", "Tüm veri türleri")
      : selectedLabels.slice(0, 3).join(", ") +
        (selectedLabels.length > 3 ? ` +${selectedLabels.length - 3}` : "");

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
    if (!autoDataCacheEnabled) {
      appAlert(
        i18nText("autoI18n.veri_indirme_kapali", "Veri indirme kapalı"),
        i18nText(
          "autoI18n.veri_indirme_kapali_aciklama",
          "Çevrimdışı veri indirmek için Ayarlar > Genel bölümünden \"Verileri İndir\" ayarını aç.",
        ),
      );
      return;
    }
    if (enabledTypeCount === 0) {
      appAlert(
        i18nText("autoI18n.veri_turu_secilmedi", "Veri türü seçilmedi"),
        i18nText(
          "autoI18n.veri_turu_secilmedi_aciklama",
          "Ayarlar > Genel bölümünden en az bir veri türü seç.",
        ),
      );
      return;
    }
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
        types: dataCacheTypes,
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
      } else if (res.blocked) {
        // Ayar bu arada değişmiş olabilir (servis ikinci kapı olarak da bakar).
        const reasons = {
          "no-user": i18nText(
            "autoI18n.oturum_gerekli",
            "Bu işlem için oturum açman gerekiyor.",
          ),
          "no-types": i18nText(
            "autoI18n.veri_turu_secilmedi_aciklama",
            "Ayarlar > Genel bölümünden en az bir veri türü seç.",
          ),
          disabled: i18nText(
            "autoI18n.veri_indirme_kapali_aciklama",
            "Çevrimdışı veri indirmek için Ayarlar > Genel bölümünden \"Verileri İndir\" ayarını aç.",
          ),
        };
        appAlert(
          i18nText("autoI18n.veri_indirilemedi", "Veri indirilemedi"),
          reasons[res.blocked] || reasons.disabled,
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
          iconBg={canDownload ? C.iconBlue : C.closeBg}
          iconColor={canDownload ? C.blue : C.muted}
          iconFamily="MaterialCommunityIcons"
          iconName={canDownload ? "cloud-download-outline" : "cloud-off-outline"}
          title={i18nText("autoI18n.verileriIndir", "Verileri indir")}
          subtitle={
            downloading
              ? `${i18nText("autoI18n.indiriliyor", "İndiriliyor")} · %${Math.round(
                  downloadPct * 100,
                )}`
              : !autoDataCacheEnabled
                ? i18nText(
                    "autoI18n.verileriIndirKapaliAlt",
                    'Kapalı — Ayarlar > Genel\'den "Verileri İndir"i aç',
                  )
                : enabledTypeCount === 0
                  ? i18nText(
                      "autoI18n.veri_turu_secilmedi_alt",
                      "Hiçbir veri türü seçili değil",
                    )
                  : `${enabledTypeCount}/${DATA_TYPE_COUNT} · ${typeSummary}`
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
