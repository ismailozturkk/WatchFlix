// screens/tabs/profile/PrivacySettingsScreen.js
//
// Profile / Lists / Posts / Online Status için privacy seçenekleri.
// Tüm değerler Users/{uid}.privacy map'inde saklanır.

import React, { memo, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from "react-native";
// Ekran kökü: Premium şeridi yüzerken üst boşluğu ona göre büyür.
import SafeAreaView from "@components/common/ScreenSafeAreaView";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../../context/ThemeContext";
import { useUserProfile } from "../../../context/UserProfileContext";
import { useLanguage } from "../../../context/LanguageContext";
import Toast from "@components/AppToast";
import { i18nText } from "../../../utils/i18nText";
import ScreenDecor from "../../../components/ScreenDecor";
import BackButton from "@components/BackButton";
import GlassTouchable from "../../../components/common/GlassTouchable";
import { useListStatusContext } from "../../../context/ListStatusContext";
import {
  buildListVisibilityRows,
  normalizeListVisible,
  summarizeListVisibility,
} from "../../../utils/listVisibility";
import { getListVisibilityCopy } from "./listVisibilityCopy";


// Etiketler çizim anında çözülür: modül yüklenirken dondurulursa dil değişince eski dilde kalır.
const buildOptions = () => ({
  profile: [
    { value: "public",  label: i18nText("autoI18n.herkese_acik", "Herkese Açık"), icon: "earth", desc: i18nText("autoI18n.tum_kullanicilar_profilini_gorur", "Tüm kullanıcılar profilini görür") },
    { value: "friends", label: i18nText("autoI18n.arkadaslar", "Arkadaşlar"),   icon: "people", desc: i18nText("autoI18n.sadece_arkadaslarin_gorur", "Sadece arkadaşların görür") },
    { value: "private", label: i18nText("autoI18n.gizli", "Gizli"), icon: "lock-closed", desc: i18nText("autoI18n.sadece_sen_gorursun", "Sadece sen görürsün") },
  ],
  lists: [
    { value: "public",  label: i18nText("autoI18n.herkese_acik", "Herkese Açık"), icon: "earth", desc: i18nText("autoI18n.izleme_listelerini_herkes_gorur", "İzleme listelerini herkes görür") },
    { value: "friends", label: i18nText("autoI18n.arkadaslar", "Arkadaşlar"),   icon: "people", desc: i18nText("autoI18n.sadece_arkadaslarin_gorur", "Sadece arkadaşların görür") },
    { value: "private", label: i18nText("autoI18n.gizli", "Gizli"), icon: "lock-closed", desc: i18nText("autoI18n.sadece_sen_gorursun", "Sadece sen görürsün") },
  ],
  socialLinks: [
    { value: "public", label: i18nText("autoI18n.herkes", "Herkes"), icon: "earth", desc: i18nText("autoI18n.sosyal_baglantilar_herkes", "Herkes hesap bağlantılarını görebilir") },
    { value: "friends", label: i18nText("autoI18n.kisilerim", "Kişilerim"), icon: "people", desc: i18nText("autoI18n.sosyal_baglantilar_kisilerim", "Yalnızca bağlantı kurduğun kişiler görebilir") },
    { value: "private", label: i18nText("autoI18n.sadece_ben", "Sadece ben"), icon: "lock-closed", desc: i18nText("autoI18n.sosyal_baglantilar_sadece_ben", "Hesap bağlantılarını yalnızca sen görebilirsin") },
  ],
  // NOT: "posts" burada bilerek yok — paylaşım görünürlüğü post atarken
  // seçilen post-başına `visibility` alanıyla yönetiliyor (postsService),
  // Users.privacy.posts hiçbir okuma yolunda kullanılmıyor.
  onlineStatus: [
    { value: "everyone", label: i18nText("autoI18n.herkes", "Herkes"), icon: "earth", desc: i18nText("autoI18n.herkes_online_oldugunu_gorur", "Herkes online olduğunu görür") },
    { value: "friends",  label: i18nText("autoI18n.arkadaslar", "Arkadaşlar"), icon: "people", desc: i18nText("autoI18n.sadece_arkadaslarin_gorur", "Sadece arkadaşların görür") },
    { value: "none",     label: i18nText("autoI18n.hic_kimse", "Hiç Kimse"),  icon: "eye-off", desc: i18nText("autoI18n.hic_kimse_online_oldugunu_gormez", "Hiç kimse online olduğunu görmez") },
  ],
});

const buildSections = () => [
  { key: "profile",      title: i18nText("autoI18n.profil_gorunurlugu", "Profil Görünürlüğü"),     icon: "person-circle" },
  { key: "lists",        title: i18nText("autoI18n.liste_gorunurlugu", "Liste Görünürlüğü"),      icon: "list" },
  { key: "socialLinks", title: i18nText("autoI18n.hesap_baglantilari_gorunurlugu", "Hesap Bağlantıları"), icon: "link" },
  { key: "onlineStatus", title: i18nText("autoI18n.cevrimici_durumu", "Çevrimiçi Durumu"),        icon: "ellipse" },
];

const PrivacyOption = memo(function PrivacyOption({
  option, isActive, onPress, theme,
}) {
  return (
    <GlassTouchable
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.option,
        {
          backgroundColor: isActive ? theme.accent + "22" : theme.secondary,
          borderColor: isActive ? theme.accent : theme.border,
        },
      ]}
    >
      <View style={[
        styles.optionIcon,
        { backgroundColor: isActive ? theme.accent : theme.primary },
      ]}>
        <Ionicons
          name={option.icon}
          size={18}
          color={isActive ? "#fff" : theme.text.secondary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[
          styles.optionLabel,
          { color: theme.text.primary, fontWeight: isActive ? "700" : "600" },
        ]}>
          {option.label}
        </Text>
        <Text style={[styles.optionDesc, { color: theme.text.secondary }]}>
          {option.desc}
        </Text>
      </View>
      {isActive && (
        <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
      )}
    </GlassTouchable>
  );
});

export default function PrivacySettingsScreen({ navigation }) {
  const { theme } = useTheme();
  const { privacy, updatePrivacy, profile } = useUserProfile();
  const { language } = useLanguage();
  const OPTIONS = useMemo(buildOptions, [language]);
  const SECTIONS = useMemo(buildSections, [language]);
  const listCopy = getListVisibilityCopy(language);
  const { combinedLists } = useListStatusContext() || {};
  const listSummary = useMemo(
    () =>
      summarizeListVisibility(
        buildListVisibilityRows(combinedLists, normalizeListVisible(profile?.listVisible)),
      ),
    [combinedLists, profile?.listVisible],
  );

  const handleChange = useCallback(
    async (key, value) => {
      try {
        await updatePrivacy({ [key]: value });
      } catch (e) {
        Toast.show({ type: "error", text1: i18nText("autoI18n.ayar_kaydedilemedi", "Ayar kaydedilemedi") });
      }
    },
    [updatePrivacy],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.primary }]}
      edges={["top"]}
    >
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor scope="settings" iconOpacity={0.15} />
      {/* Header */}
      <View style={styles.header}>
        <BackButton absolute={false} variant="plain" onPress={() => navigation?.goBack?.()} />
        <Text style={[styles.title, { color: theme.text.primary }]}>{i18nText("autoI18n.gizlilik_ayarlari", "Gizlilik Ayarları")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {SECTIONS.map((section) => (
          <View key={section.key} style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="shield-key-outline"
                size={16}
                color={theme.accent}
              />
              <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
                {section.title}
              </Text>
            </View>
            {OPTIONS[section.key].map((opt) => (
              <PrivacyOption
                key={opt.value}
                option={opt}
                isActive={(privacy?.[section.key] ?? (section.key === "socialLinks" ? "public" : undefined)) === opt.value}
                onPress={() => handleChange(section.key, opt.value)}
                theme={theme}
              />
            ))}
            {/* "Kim" seçeneklerinin hemen altında "hangi listeler": iki ayar birlikte
                okunur. Eskiden Listelerim kartlarındaki yazısız göz simgesiydi. */}
            {section.key === "lists" ? (
              <GlassTouchable
                testID="privacy-list-visibility"
                onPress={() => navigation?.navigate?.("ListVisibilityScreen")}
                activeOpacity={0.85}
                style={[styles.linkRow, { backgroundColor: theme.secondary, borderColor: theme.border }]}
              >
                <View style={[styles.optionIcon, { backgroundColor: theme.primary }]}>
                  <Ionicons name="albums-outline" size={18} color={theme.text.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: theme.text.primary, fontWeight: "600" }]}>
                    {listCopy.rowTitle}
                  </Text>
                  <Text style={[styles.optionDesc, { color: theme.text.secondary }]}>
                    {listCopy.rowSub(listSummary.shown, listSummary.total)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
              </GlassTouchable>
            ) : null}
            {section.key === "socialLinks" ? (
              <View style={[styles.linkRow, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <View style={[styles.optionIcon, { backgroundColor: theme.primary }]}>
                  <Ionicons name="eye-outline" size={18} color={theme.text.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: theme.text.primary, fontWeight: "600" }]}>
                    {i18nText("autoI18n.profil_sekmemde_goster", "Profil sekmemde göster")}
                  </Text>
                  <Text style={[styles.optionDesc, { color: theme.text.secondary }]}>
                    {i18nText("autoI18n.profil_sekmemde_goster_alt", "Yalnızca kendi profil sekmendeki bağlantı alanını gizler")}
                  </Text>
                </View>
                <Switch
                  testID="own-profile-social-links-toggle"
                  value={privacy?.showSocialLinksOnOwnProfile !== false}
                  onValueChange={(value) => handleChange("showSocialLinksOnOwnProfile", value)}
                  trackColor={{ true: theme.accent, false: theme.border }}
                />
              </View>
            ) : null}
          </View>
        ))}

        {/* Engellenen kullanıcılar — görünürlük ayarlarının devamı: engelleme
            de "kim beni görebilir / ben kimi görürüm" kararı. Mağaza incelemesi
            engellemenin geri alınabilir ve görülebilir olmasını arıyor. */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="account-off-outline"
              size={16}
              color={theme.accent}
            />
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              {i18nText("autoI18n.engellenen_kullanicilar", "Engellenen kullanıcılar")}
            </Text>
          </View>
          <GlassTouchable
            onPress={() => navigation?.navigate?.("BlockedUsersScreen")}
            activeOpacity={0.85}
            style={[styles.blockedRow, { borderColor: theme.border }]}
          >
            <Text style={[styles.blockedText, { color: theme.text.secondary }]}>
              {i18nText(
                "autoI18n.engellenen_kullanicilar_alt",
                "Engellediğin kişilerin gönderileri, yorumları ve mesajları sana görünmez.",
              )}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
          </GlassTouchable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: { fontSize: 18, fontWeight: "800" },
  blockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  blockedText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  section: { paddingHorizontal: 16, marginBottom: 22 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  optionIcon: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  optionLabel: { fontSize: 15 },
  optionDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
});
