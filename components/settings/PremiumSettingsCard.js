// components/settings/PremiumSettingsCard.js
//
// Ayarlar ana ekranının en üstündeki Seelogd Premium vitrini. Tüm kart tek bir
// düğme: dokununca PremiumScreen açılır (abone için "aboneliği yönet" girişi de
// aynı ekrandan).
//
// Tasarım dili:
//   • Gradyan çerçeve + yüzeyde yavaş kayan iki "aurora" ışığı; kartın arkasında
//     tema renginin yumuşak bir parıltısı.
//   • Üç cam karo (AI hakkı / rozet / sosyal limit) — eski üç satırlık çip
//     yığınının yerine tek bakışta okunan sayılar.
//   • Free kullanıcıda CTA dolu gradyan ve periyodik parlama süpürmesi taşır
//     (dönüşüm eylemi); abonede CTA sönük ikincil düğme — "yönet" bir satış
//     eylemi değil, bağırmamalı.
//   • Basınca yaylı küçülme + dokunsal geri bildirim.
//
// Sürekli dönen animasyonlar yalnız ekran odaktayken ve sistem "Hareketi Azalt"
// kapalıyken çalışır (bkz. hooks/useReduceMotion.js); hepsi native sürücüde.

import { normalizeAppLanguage } from "../../utils/appLanguages";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import * as Haptics from "@services/hapticsService";
import useReduceMotion from "@hooks/useReduceMotion";
import { alpha } from "@theme/colors";
import { i18nText } from "@utils/i18nText";
import {
  AI_PLAN_LIMITS,
  getPremiumPlanDisplayName,
  PREMIUM_PLAN,
} from "@utils/premium";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { usePremium } from "../../context/PremiumContext";

// Yumuşak parıltı: React Native'de radyal gradyan yok; azalan opaklıkta iç içe
// üç daire kenarı sert olmayan bir ışık verir.
function GlowOrb({ size, color, style }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      {[
        [1, 0.07],
        [0.68, 0.1],
        [0.38, 0.15],
      ].map(([scale, a]) => (
        <View
          key={scale}
          style={{
            position: "absolute",
            width: size * scale,
            height: size * scale,
            borderRadius: (size * scale) / 2,
            backgroundColor: alpha(color, a),
          }}
        />
      ))}
    </Animated.View>
  );
}

function BenefitTile({ icon, tint, value, label, theme }) {
  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: alpha(theme.text.primary, 0.05),
          borderColor: alpha(theme.text.primary, 0.09),
        },
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: alpha(tint, 0.18) }]}>
        <AppIcon name={icon} size={13} color={tint} />
      </View>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[styles.tileValue, { color: theme.text.primary }]}
      >
        {value}
      </Text>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={[styles.tileLabel, { color: theme.text.muted }]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function PremiumSettingsCard() {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const reduceMotion = useReduceMotion();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { isPremium, isUnlimited, loading } = usePremium();
  const tr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";

  const accent = theme.accent;
  const purple = theme.colors.purple || "#8B5CF6";
  const green = theme.colors.green;
  const gold = theme.colors.orange || "#F59E0B";

  // Kartın tanıttığı plan: abone kendi planını, Free kullanıcı Premium'u görür
  // (Free'nin kendi 3 mesajı bir "ayrıcalık" değil).
  const showcasePlan = isUnlimited ? PREMIUM_PLAN.UNLIMITED : PREMIUM_PLAN.PREMIUM;
  const limits = AI_PLAN_LIMITS[showcasePlan];

  const press = useRef(new Animated.Value(1)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const [ctaWidth, setCtaWidth] = useState(320);

  const animate = focused && !reduceMotion;
  useEffect(() => {
    if (!animate) {
      drift.setValue(0);
      sweep.setValue(0);
      return undefined;
    }
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    // Parlama süpürmesi: uzun bekleme + kısa geçiş — sürekli parlayan düğme
    // dikkat dağıtır, arada bir geçen parlama "canlı" hissi verir.
    const sweepLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    driftLoop.start();
    sweepLoop.start();
    return () => {
      driftLoop.stop();
      sweepLoop.stop();
    };
  }, [animate, drift, sweep]);

  const springTo = (toValue, bounciness) =>
    Animated.spring(press, {
      toValue,
      speed: 40,
      bounciness,
      useNativeDriver: true,
    }).start();

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    navigation.navigate("PremiumScreen");
  };

  const title = isPremium
    ? tr ? "Ayrıcalıkların Aktif" : es ? "Tus ventajas están activas" : "Your Benefits Are Active"
    : tr ? "Sinemanın Sınırlarını Kaldır" : es ? "Desbloquea el cine sin límites" : "Unlock Boundless Cinema";

  const ctaTitle = isPremium
    ? i18nText("autoI18n.yonet", "Aboneliğimi Yönet")
    : tr ? "Ayrıcalıkları ve Fiyatları Gör" : es ? "Ver planes y precios" : "View Plans & Pricing";
  const ctaSubtitle = isPremium
    ? tr ? "Plan detaylarını ve faturalandırmayı yönet" : es ? "Gestionar el plan y la facturación" : "Manage plan and billing"
    : tr ? "Doğrudan fiyatlandırma · Dilediğin an iptal" : es ? "Precios claros · Cancela cuando quieras" : "Direct pricing · Cancel anytime";

  const orbAShift = {
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) },
    ],
  };
  const orbBShift = {
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
    ],
  };
  const haloStyle = {
    opacity: drift.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.1] }),
    transform: [
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) },
    ],
  };
  const shineX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, ctaWidth + 40],
  });
  const arrowX = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 3] });

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => springTo(0.975, 0)}
        onPressOut={() => springTo(1, 6)}
        accessibilityRole="button"
        accessibilityLabel={`Seelogd Premium, ${title}`}
        accessibilityState={{ busy: loading }}
      >
        {/* Gradyan çerçeve: 1px'lik dış gradyan, içte opak yüzey */}
        <LinearGradient
          colors={[alpha(accent, 0.8), alpha(purple, 0.4), alpha(theme.border, 0.7)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.frame, { shadowColor: accent }]}
        >
          <View style={[styles.surface, { backgroundColor: theme.secondary }]}>
            <LinearGradient
              colors={[
                alpha(purple, 0.3),
                alpha(accent, 0.1),
                alpha(theme.secondary, 0),
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <GlowOrb
              size={230}
              color={purple}
              style={[{ right: -78, top: -104 }, orbAShift]}
            />
            <GlowOrb
              size={200}
              color={accent}
              style={[{ left: -92, bottom: -118 }, orbBShift]}
            />

            {/* Üst satır: ikon karosu + marka/başlık */}
            <View style={styles.header}>
              <View style={styles.iconHolder}>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.halo, { borderColor: alpha(accent, 0.7) }, haloStyle]}
                />
                <LinearGradient
                  colors={[accent, purple]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconTile}
                >
                  {/* Cam parlaması: karonun üst yarısında soluk beyaz bant */}
                  <View style={styles.iconGloss} />
                  <AppIcon
                    name={isUnlimited ? "infinite" : "diamond"}
                    size={22}
                    color="#FFFFFF"
                  />
                </LinearGradient>
              </View>

              <View style={styles.headerCopy}>
                <View style={styles.eyebrowRow}>
                  <Text
                    allowFontScaling={false}
                    style={[styles.eyebrow, { color: accent }]}
                  >
                    {getPremiumPlanDisplayName(showcasePlan).toUpperCase()}
                  </Text>
                  {loading ? (
                    <ActivityIndicator size="small" color={accent} />
                  ) : (
                    <View
                      style={[
                        styles.pill,
                        {
                          backgroundColor: isPremium
                            ? alpha(green, 0.16)
                            : alpha(theme.text.primary, 0.07),
                          borderColor: isPremium
                            ? alpha(green, 0.34)
                            : alpha(theme.text.primary, 0.12),
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.pillDot,
                          { backgroundColor: isPremium ? green : theme.text.muted },
                        ]}
                      />
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.pillText,
                          { color: isPremium ? green : theme.text.muted },
                        ]}
                      >
                        {isPremium
                          ? i18nText("autoI18n.aktif_upper", "AKTİF")
                          : getPremiumPlanDisplayName(PREMIUM_PLAN.FREE).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  allowFontScaling={false}
                  numberOfLines={2}
                  style={[styles.title, { color: theme.text.primary }]}
                >
                  {title}
                </Text>
              </View>
            </View>

            {/* Ayrıcalık karoları */}
            <View style={styles.tiles}>
              <BenefitTile
                theme={theme}
                icon="sparkles"
                tint={accent}
                value={String(limits.daily)}
                label={tr ? "AI mesajı / gün" : es ? "Chats de IA / día" : "AI chats / day"}
              />
              <BenefitTile
                theme={theme}
                icon="diamond"
                tint={gold}
                value={
                  isUnlimited
                    ? tr ? "Efsanevi" : es ? "Legendaria" : "Legend"
                    : tr ? "Epik" : es ? "Épica" : "Epic"
                }
                label={tr ? "Profil rozeti" : es ? "Insignia de perfil" : "Profile badge"}
              />
              <BenefitTile
                theme={theme}
                icon="people"
                tint={green}
                value={
                  isUnlimited
                    ? tr ? "Sınırsız" : es ? "Ilimitado" : "Unlimited"
                    : tr ? "Daha fazla" : es ? "Más" : "More"
                }
                label={tr ? "Sosyal limitler" : es ? "Límites sociales" : "Social limits"}
              />
            </View>

            {/* CTA: Free'de dolu gradyan + parlama, abonede sönük ikincil düğme */}
            <View
              onLayout={(e) => setCtaWidth(e.nativeEvent.layout.width)}
              style={[
                styles.cta,
                isPremium && {
                  backgroundColor: alpha(accent, 0.12),
                  borderWidth: 1,
                  borderColor: alpha(accent, 0.3),
                },
              ]}
            >
              {isPremium ? null : (
                <>
                  <LinearGradient
                    colors={[accent, purple]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.shine,
                      { transform: [{ translateX: shineX }, { rotate: "18deg" }] },
                    ]}
                  >
                    <LinearGradient
                      colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.34)", "rgba(255,255,255,0)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                </>
              )}
              <View style={styles.ctaCopy}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.ctaTitle, { color: isPremium ? accent : "#FFFFFF" }]}
                >
                  {ctaTitle}
                </Text>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[
                    styles.ctaSubtitle,
                    { color: isPremium ? theme.text.muted : "rgba(255,255,255,0.82)" },
                  ]}
                >
                  {ctaSubtitle}
                </Text>
              </View>
              <Animated.View
                style={[
                  styles.ctaArrow,
                  {
                    backgroundColor: isPremium
                      ? alpha(accent, 0.16)
                      : "rgba(255,255,255,0.22)",
                    transform: [{ translateX: isPremium ? 0 : arrowX }],
                  },
                ]}
              >
                <AppIcon
                  name="arrow-forward"
                  size={15}
                  color={isPremium ? accent : "#FFFFFF"}
                />
              </Animated.View>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Gölge çerçevede (opak gradyan) durur: yüzey `overflow: hidden` olduğu için
  // kendi gölgesini kırpardı.
  frame: {
    borderRadius: 24,
    padding: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  surface: {
    borderRadius: 23,
    padding: 16,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },

  header: { flexDirection: "row", alignItems: "center", gap: 13 },
  iconHolder: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 17,
    borderWidth: 1.5,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 15,
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
  headerCopy: { flex: 1 },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 22,
  },
  eyebrow: { fontSize: 10.5, fontWeight: "900", letterSpacing: 1.4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillDot: { width: 5, height: 5, borderRadius: 2.5 },
  pillText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  title: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
    letterSpacing: -0.35,
    marginTop: 1,
  },

  tiles: { flexDirection: "row", gap: 8, marginTop: 16 },
  tile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 2,
  },
  tileIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  tileValue: { fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  tileLabel: { fontSize: 10.5, fontWeight: "600" },

  cta: {
    minHeight: 54,
    borderRadius: 17,
    paddingHorizontal: 16,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  shine: { position: "absolute", top: -30, bottom: -30, width: 56 },
  ctaCopy: { flex: 1 },
  ctaTitle: { fontSize: 14.5, fontWeight: "900", letterSpacing: -0.15 },
  ctaSubtitle: { fontSize: 10.5, fontWeight: "600", marginTop: 1 },
  ctaArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
