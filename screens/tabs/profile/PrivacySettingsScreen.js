// screens/tabs/profile/PrivacySettingsScreen.js
//
// Profile / Lists / Posts / Online Status için privacy seçenekleri.
// Tüm değerler Users/{uid}.privacy map'inde saklanır.

import React, { memo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../../context/ThemeContext";
import { useUserProfile } from "../../../context/UserProfileContext";
import Toast from "react-native-toast-message";
import { i18nText } from "../../../utils/i18nText";


const OPTIONS = {
  profile: [
    { value: "public",  label: i18nText("autoI18n.herkese_acik", "Herkese Açık"), icon: "earth", desc: i18nText("autoI18n.tum_kullanicilar_profilini_gorur", "Tüm kullanıcılar profilini görür") },
    { value: "friends", label: i18nText("autoI18n.arkadaslar", "Arkadaşlar"),   icon: "people", desc: i18nText("autoI18n.sadece_arkadaslarin_gorur", "Sadece arkadaşların görür") },
    { value: "private", label: "Gizli",        icon: "lock-closed", desc: i18nText("autoI18n.sadece_sen_gorursun", "Sadece sen görürsün") },
  ],
  lists: [
    { value: "public",  label: i18nText("autoI18n.herkese_acik", "Herkese Açık"), icon: "earth", desc: i18nText("autoI18n.izleme_listelerini_herkes_gorur", "İzleme listelerini herkes görür") },
    { value: "friends", label: i18nText("autoI18n.arkadaslar", "Arkadaşlar"),   icon: "people", desc: i18nText("autoI18n.sadece_arkadaslarin_gorur", "Sadece arkadaşların görür") },
    { value: "private", label: "Gizli",        icon: "lock-closed", desc: i18nText("autoI18n.sadece_sen_gorursun", "Sadece sen görürsün") },
  ],
  posts: [
    { value: "public",  label: i18nText("autoI18n.herkese_acik", "Herkese Açık"), icon: "earth", desc: i18nText("autoI18n.paylasimlarini_herkes_gorur", "Paylaşımlarını herkes görür") },
    { value: "friends", label: i18nText("autoI18n.arkadaslar", "Arkadaşlar"),   icon: "people", desc: i18nText("autoI18n.sadece_arkadaslarin_gorur", "Sadece arkadaşların görür") },
  ],
  onlineStatus: [
    { value: "everyone", label: "Herkes",     icon: "earth",  desc: i18nText("autoI18n.herkes_online_oldugunu_gorur", "Herkes online olduğunu görür") },
    { value: "friends",  label: i18nText("autoI18n.arkadaslar", "Arkadaşlar"), icon: "people", desc: i18nText("autoI18n.sadece_arkadaslarin_gorur", "Sadece arkadaşların görür") },
    { value: "none",     label: i18nText("autoI18n.hic_kimse", "Hiç Kimse"),  icon: "eye-off", desc: i18nText("autoI18n.hic_kimse_online_oldugunu_gormez", "Hiç kimse online olduğunu görmez") },
  ],
};

const SECTIONS = [
  { key: "profile",      title: i18nText("autoI18n.profil_gorunurlugu", "Profil Görünürlüğü"),     icon: "person-circle" },
  { key: "lists",        title: i18nText("autoI18n.liste_gorunurlugu", "Liste Görünürlüğü"),      icon: "list" },
  { key: "posts",        title: i18nText("autoI18n.paylasim_gorunurlugu", "Paylaşım Görünürlüğü"),   icon: "share-social" },
  { key: "onlineStatus", title: i18nText("autoI18n.cevrimici_durumu", "Çevrimiçi Durumu"),        icon: "ellipse" },
];

const PrivacyOption = memo(function PrivacyOption({
  option, isActive, onPress, theme,
}) {
  return (
    <TouchableOpacity
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
    </TouchableOpacity>
  );
});

export default function PrivacySettingsScreen({ navigation }) {
  const { theme } = useTheme();
  const { privacy, updatePrivacy } = useUserProfile();

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
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
                isActive={privacy?.[section.key] === opt.value}
                onPress={() => handleChange(section.key, opt.value)}
                theme={theme}
              />
            ))}
          </View>
        ))}
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
  backBtn: {
    width: 40, height: 40,
    justifyContent: "center", alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "800" },
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
  optionLabel: { fontSize: 15 },
  optionDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
});
