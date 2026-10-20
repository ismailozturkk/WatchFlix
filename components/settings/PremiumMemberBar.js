// components/settings/PremiumMemberBar.js
//
// Ayarlar ana ekranında Premium / Premium Max abonesinin gördüğü KÜÇÜK "Aboneliği yönet"
// çubuğu (satın almamışlar büyük vitrini görür: PremiumSettingsCard). Tek dokunuşla
// Ayarlar > Kullanım ve haklar açılır (plan, kalan haklar, limitler ve mağaza aboneliğini
// yönetme düğmesi). Kurallar utils/premiumMemberBar.js'de.
//
// Boyut: iki satırlık (plan adı + eylem) ~56 px; eski vitrin ~280 px'ti.
//
// "Premium hissi" için ağır bir şey yok, ince detaylar var:
//   • Plana göre kimlik: Premium vurgu→mor, Max altın→gül; ikon karosu, 1 px degrade çerçeve,
//     yüzeydeki yumuşak renk yıkaması ve gölge aynı iki rengi taşır.
//   • İkon karosunda cam parlaması; çubuktan arada bir (≈7 sn) geçen ince ışık süpürmesi.
//   • Basınca yaylı küçülme.
//
// Süpürme yalnız ekran odaktayken ve sistem "Hareketi Azalt" kapalıyken çalışır, native
// sürücüde; kapalıyken hiç çizilmez (hareketsiz çubuk da eksiksiz).

import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import useReduceMotion from "@hooks/useReduceMotion";
import { alpha } from "@theme/colors";
import { i18nText } from "@utils/i18nText";
import { normalizeAppLanguage } from "@utils/appLanguages";
import {
  MEMBER_BAR_ROUTE,
  memberBarAccessibilityLabel,
  memberBarLook,
  memberBarTitle,
} from "@utils/premiumMemberBar";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { usePremium } from "../../context/PremiumContext";

const SWEEP_PAUSE_MS = 5200;
const SWEEP_MS = 1300;

export default function PremiumMemberBar() {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const reduceMotion = useReduceMotion();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { plan } = usePremium();
  const lang = normalizeAppLanguage(language);
  const look = memberBarLook(plan, theme);

  const press = useRef(new Animated.Value(1)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(340);

  const animate = focused && !reduceMotion;
  useEffect(() => {
    if (!animate) {
      sweep.setValue(0);
      return undefined;
    }
    // Uzun bekleme + kısa geçiş: sürekli parlayan çubuk dikkat dağıtır, arada geçen ışık
    // "canlı" hissi verir.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(SWEEP_PAUSE_MS),
        Animated.timing(sweep, {
          toValue: 1,
          duration: SWEEP_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, sweep]);

  const springTo = (toValue, bounciness) =>
    Animated.spring(press, { toValue, speed: 40, bounciness, useNativeDriver: true }).start();

  const shineX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-80, width + 30] });

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <Pressable
        testID="premium-member-bar"
        onPress={() => navigation.navigate(MEMBER_BAR_ROUTE)}
        onPressIn={() => springTo(0.98, 0)}
        onPressOut={() => springTo(1, 6)}
        accessibilityRole="button"
        accessibilityLabel={memberBarAccessibilityLabel(plan, lang)}
      >
        {/* 1 px degrade çerçeve + içte opak yüzey. Gölge çerçevede: yüzey kırpar. */}
        <LinearGradient
          colors={[alpha(look.from, 0.85), alpha(look.to, 0.45), alpha(theme.border, 0.7)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.frame, { shadowColor: look.from }]}
        >
          <View
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            style={[styles.surface, { backgroundColor: theme.secondary }]}
          >
            {/* Renk yıkaması: soldan (ikon tarafı) sağa sönen plan rengi */}
            <LinearGradient
              pointerEvents="none"
              colors={[alpha(look.from, 0.2), alpha(look.to, 0.08), alpha(theme.secondary, 0)]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            {animate ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.shine, { transform: [{ translateX: shineX }, { rotate: "18deg" }] }]}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.16)", "rgba(255,255,255,0)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            ) : null}

            <LinearGradient
              colors={[look.from, look.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconTile}
            >
              {/* Cam parlaması: karonun üst yarısında soluk beyaz bant */}
              <View style={styles.iconGloss} />
              <AppIcon name={look.icon} size={19} color="#FFFFFF" />
            </LinearGradient>

            <View style={styles.copy}>
              <View style={styles.eyebrowRow}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.eyebrow, { color: look.ink }]}
                >
                  {look.planName.toUpperCase()}
                </Text>
                <View style={[styles.dot, { backgroundColor: theme.colors.green }]} />
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.active, { color: theme.colors.green }]}
                >
                  {i18nText("autoI18n.aktif_upper", "AKTİF")}
                </Text>
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.title, { color: theme.text.primary }]}
              >
                {memberBarTitle(lang)}
              </Text>
            </View>

            <View style={[styles.chevron, { backgroundColor: alpha(look.from, 0.16) }]}>
              <AppIcon name="chevron-forward" size={15} color={look.ink} />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 18,
    padding: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  surface: {
    borderRadius: 17,
    paddingVertical: 9,
    paddingLeft: 10,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    overflow: "hidden",
  },
  shine: { position: "absolute", top: -20, bottom: -20, width: 46 },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "48%",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  copy: { flex: 1 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrow: { fontSize: 10.5, fontWeight: "900", letterSpacing: 1.3, flexShrink: 1 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  active: { fontSize: 9.5, fontWeight: "900", letterSpacing: 0.7 },
  title: { fontSize: 15, lineHeight: 19, fontWeight: "800", letterSpacing: -0.2, marginTop: 1 },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
