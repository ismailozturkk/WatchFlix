import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import IconBacground from "../../../components/IconBacground";
import ProfileReminders from "./ProfileReminders";
import { i18nText } from "../../../utils/i18nText";


/**
 * Hatırlatma içeriklerinin tamamının gösterildiği sayfa. Profil ekranındaki
 * RemindersPreviewButton buraya yönlendirir; böylece tüm hatırlatma kartları
 * profil ekranında değil, yalnızca bu sayfa açıldığında render edilir.
 */
export default function RemindersScreen({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const title = t.profileScreen?.ProfileReminder?.reminder ?? i18nText("autoI18n.hatirlatmalar", "Hatırlatmalar");

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" />
      <IconBacground opacity={0.25} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Başlık */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            style={[styles.backBtn, { backgroundColor: theme.secondary }]}
          >
            <Ionicons name="chevron-back" size={22} color={theme.text.primary} />
          </TouchableOpacity>
          <Text
            allowFontScaling={false}
            style={[styles.headerTitle, { color: theme.text.primary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 14, paddingBottom: 40 }}
        >
          <ProfileReminders navigation={navigation} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  headerSpacer: { width: 40 },
});
