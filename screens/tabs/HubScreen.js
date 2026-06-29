// screens/tabs/HubScreen.js
//
// "Paylaş" sekmesinin yeni yapısı: bir HUB ekranı. Eskiden bu sekme doğrudan
// sosyal feed'i (ShareContentScreen) gösteriyordu; artık feed ayrı bir stack
// ekranına taşındı ve buradan modern bir widget ile açılıyor. Profildeki oyun
// modülü de (ProfileGamesModule) buraya taşındı.
//
// İçerik:
//   • Selamlama başlığı + avatar
//   • Sosyal: Feed'e yönlendiren büyük, interaktif gradyan widget
//   • Oyunlar: taşınan ProfileGamesModule (öne çıkan oyun + istatistik)

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import ProfileGamesModule from "@components/profile/ProfileGamesModule";
import TournamentWidget from "@components/hub/TournamentWidget";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useAuth } from "@context/AuthContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { i18nText } from "@utils/i18nText";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { mass: 0.4, damping: 12, stiffness: 180 };

// ─── Feed yönlendirme widget'ı (interaktif) ─────────────────────────────────
function FeedWidget({ navigation, theme }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const blue = theme.colors?.blue || "#4a7cf6";
  const colors = [
    blue,
    theme.colors?.primary || "#3b5998",
    theme.colors?.darkBlue || "#192f6a",
  ];

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={i18nText("autoI18n.paylasimlari_ac", "Paylaşımları aç")}
      onPressIn={() => { scale.value = withSpring(0.97, SPRING); }}
      onPressOut={() => { scale.value = withSpring(1, SPRING); }}
      onPress={() => navigation.navigate("ShareContentScreen")}
      style={[styles.widgetShadow, { shadowColor: theme.shadow || blue }, animStyle]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.widget}
      >
        <View pointerEvents="none" style={styles.glowOne} />
        <View pointerEvents="none" style={styles.glowTwo} />
        <View pointerEvents="none" style={styles.widgetArtwork}>
          <AppIcon family="Ionicons" name="chatbubbles" size={104} color="rgba(255,255,255,0.08)" />
        </View>

        <View style={styles.widgetIcon}>
          <AppIcon family="Ionicons" name="newspaper" size={26} color="#fff" />
        </View>

        <View style={styles.widgetCopy}>
          <Text style={styles.widgetTitle}>
            {i18nText("autoI18n.hub_paylasimlar", "Paylaşımlar")}
          </Text>
          <Text style={styles.widgetDesc} numberOfLines={2}>
            {i18nText("autoI18n.hub_feed_aciklama", "Topluluk feed'i, incelemeler ve listeler")}
          </Text>
        </View>

        <View style={styles.widgetCta}>
          <AppIcon family="Ionicons" name="arrow-forward" size={20} color="#fff" />
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

export default function HubScreen({ navigation }) {
  const { theme } = useTheme();
  useLanguage();
  const { user } = useAuth();
  const { avatar } = useProfileUi();

  const greeting = useMemo(() => {
    const name = user?.displayName?.split(" ")[0] || "";
    const hi = i18nText("autoI18n.merhaba", "Merhaba");
    return name ? `${hi}, ${name}` : hi;
  }, [user?.displayName]);

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Başlık */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: theme.text.primary }]}>{greeting}</Text>
            <Text style={[styles.greetingSub, { color: theme.text.secondary }]}>
              {i18nText("autoI18n.hub_alt_baslik", "Paylaşımlar ve oyunlar tek yerde")}
            </Text>
          </View>
          {avatar ? (
            <Image source={avatar} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: theme.secondary,
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: theme.border,
                },
              ]}
            >
              <AppIcon family="Ionicons" name="person" size={22} color={theme.text.muted} />
            </View>
          )}
        </View>

        {/* Sosyal */}
        <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
          {i18nText("autoI18n.sosyal", "Sosyal")}
        </Text>
        <FeedWidget navigation={navigation} theme={theme} />

        {/* Turnuva */}
        <Text style={[styles.sectionTitle, { color: theme.text.muted, marginTop: 18 }]}>
          {i18nText("autoI18n.tournament_section", "Turnuva")}
        </Text>
        <TournamentWidget navigation={navigation} />

        {/* Oyunlar (profilden taşındı) */}
        <ProfileGamesModule navigation={navigation} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { alignItems: "center", paddingTop: 10, paddingBottom: 110 },

  headerRow: {
    width: "90%",
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 18,
  },
  greeting: { fontSize: 22, fontWeight: "800" },
  greetingSub: { fontSize: 13, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginLeft: 12 },

  sectionTitle: {
    width: "90%",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 12,
    paddingHorizontal: 10,
  },

  // Feed widget
  widgetShadow: {
    width: "90%",
    borderRadius: 24,
    elevation: 8,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    marginBottom: 6,
  },
  widget: {
    minHeight: 116,
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  glowOne: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -50,
    top: -70,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  glowTwo: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    right: 30,
    bottom: -50,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  widgetArtwork: {
    position: "absolute",
    right: -6,
    bottom: -10,
    transform: [{ rotate: "-8deg" }],
  },
  widgetIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.17)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  widgetCopy: { flex: 1, marginLeft: 14 },
  widgetTitle: { color: "#fff", fontSize: 19, fontWeight: "900" },
  widgetDesc: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 3,
  },
  widgetCta: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
});
