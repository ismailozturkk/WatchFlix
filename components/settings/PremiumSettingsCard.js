// components/settings/PremiumSettingsCard.js
//
// Ayarlar ana ekranının en üstündeki Seelogd Premium alanı. İki hâli var:
//   • Free kullanıcı → bu dosyadaki VİTRİN (aşağıda): dokununca PremiumScreen açılır.
//   • Premium / Premium Max abonesi → küçük "Aboneliği yönet" çubuğu (PremiumMemberBar):
//     satın almış birine karşılaştırma + satış düğmesi göstermek yer kaplar ve anlamsızdır;
//     çubuk Kullanım ve haklar ekranını açar. Hangisinin çizileceği `PremiumSettingsCard`ın
//     (en altta, varsayılan dışa aktarım) tek işi.
//
// VİTRİNİN AMACI: Free kullanıcıya "ne kazanırım" sorusunu SOMUT sayılarla tek bakışta
// cevaplamak. Karolar "Free'de 3 → Premium'da 20" biçiminde; rakamlar utils/premiumFeatures.js
// kaydından okunur (utils/premiumShowcase.js), yani ödeme ekranındaki tabloyla çelişemez ve
// limit değişince kart kendiliğinden güncellenir. Düğmenin altında mağazanın GERÇEK fiyatı ve
// varsa kullanıcının yararlanabileceği giriş teklifi görünür; mağaza cevap vermediyse genel
// metin kalır, uydurma tutar yazılmaz.
//
// Tasarım dili:
//   • Gradyan çerçeve + yüzeyde yavaş kayan iki "aurora" ışığı; kartın arkasında
//     tema renginin yumuşak bir parıltısı.
//   • Üç karşılaştırma karosu (AI / arkadaş / özel liste): Free değeri sönük ve üstü çizili,
//     Premium değeri büyük ve renkli. Altında Free'de kapalı olan avantajların çipleri.
//   • CTA dolu gradyan ve periyodik parlama süpürmesi taşır (dönüşüm eylemi); teklif varsa
//     yanında küçük bir indirim rozeti durur.
//   • Basınca yaylı küçülme + dokunsal geri bildirim.
//
// Sürekli dönen animasyonlar yalnız ekran odaktayken ve sistem "Hareketi Azalt"
// kapalıyken çalışır (bkz. hooks/useReduceMotion.js); hepsi native sürücüde.

import { normalizeAppLanguage } from "../../utils/appLanguages";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import {
  getPremiumPlanDisplayName,
  PREMIUM_PLAN,
} from "@utils/premium";
import { shouldShowMemberBar } from "@utils/premiumMemberBar";
import {
  buildShowcaseHighlights,
  buildShowcasePerks,
  buildShowcasePricing,
  showcaseCtaSubtitle,
  showcaseOfferBadge,
} from "@utils/premiumShowcase";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { usePremium } from "../../context/PremiumContext";
import PremiumMemberBar from "./PremiumMemberBar";

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

/** Düğme bu genişlikten darsa indirim rozeti çizilmez (başlık + fiyat satırı yer kalsın). */
const BADGE_MIN_CTA_WIDTH = 300;

// Karşılaştırma karosu: "3 → 20" + etiket. Free değeri sönük/çizili, Premium değeri tek vurgu.
function CompareTile({ item, tint, theme, freeName, premiumName }) {
  return (
    <View
      accessible
      accessibilityLabel={`${item.label}: ${freeName} ${item.from}, ${premiumName} ${item.to}`}
      style={[
        styles.tile,
        {
          backgroundColor: alpha(theme.text.primary, 0.05),
          borderColor: alpha(theme.text.primary, 0.09),
        },
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: alpha(tint, 0.18) }]}>
        <AppIcon name={item.icon} size={13} color={tint} />
      </View>
      <View style={styles.tileValues}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.tileFrom, { color: theme.text.muted }]}
        >
          {item.from}
        </Text>
        <AppIcon name="arrow-forward" size={11} color={theme.text.muted} />
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[styles.tileTo, { color: tint }]}
        >
          {item.to}
        </Text>
      </View>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[styles.tileLabel, { color: theme.text.muted }]}
      >
        {item.label}
      </Text>
    </View>
  );
}

// Free kullanıcının vitrini (abone bu kartı görmez, bkz. dosya sonu).
function PremiumShowcase() {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const reduceMotion = useReduceMotion();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { loading, packages, introEligibleIds, usingTestStore } = usePremium();
  const lang = normalizeAppLanguage(language);
  const tr = lang === "tr";
  const es = lang === "es";

  const accent = theme.accent;
  const purple = theme.colors.purple || "#8B5CF6";
  const tints = {
    accent,
    green: theme.colors.green,
    orange: theme.colors.orange || "#F59E0B",
  };

  const highlights = useMemo(() => buildShowcaseHighlights(lang), [lang]);
  const perks = useMemo(() => buildShowcasePerks(lang), [lang]);
  const pricing = useMemo(
    () => buildShowcasePricing({ packages, introEligibleIds, usingTestStore, language: lang }),
    [packages, introEligibleIds, usingTestStore, lang],
  );
  const press = useRef(new Animated.Value(1)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const [ctaWidth, setCtaWidth] = useState(340);
  // Rozet yalnız düğme yeterince genişse (≥ BADGE_MIN_CTA_WIDTH) yanına sığar; dar ekranda
  // teklif ikinci satırın içine yazılır, başlık kırpılmaz.
  const showBadge = Boolean(pricing?.offer) && ctaWidth >= BADGE_MIN_CTA_WIDTH;
  const offerBadge = showBadge ? showcaseOfferBadge(pricing.offer, lang) : null;

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
    // `source`: ödeme ekranının "bu ekrana nereden geldim" ölçümü (analytics PAYWALL_VIEW).
    navigation.navigate("PremiumScreen", { source: "settings" });
  };

  const premiumName = getPremiumPlanDisplayName(PREMIUM_PLAN.PREMIUM);
  const freeName = getPremiumPlanDisplayName(PREMIUM_PLAN.FREE);
  const title = tr ? "Sinemanın Sınırlarını Kaldır" : es ? "Desbloquea el cine sin límites" : "Unlock Boundless Cinema";
  // Kısa tutulur: fiyat zaten ikinci satırda, yanındaki indirim rozeti de yer ister.
  const ctaTitle = tr ? "Planları Gör" : es ? "Ver planes" : "View Plans";
  const ctaSubtitle = showcaseCtaSubtitle(pricing, lang, {
    inlineOffer: Boolean(pricing?.offer) && !showBadge,
  });

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
        testID="premium-showcase"
        onPress={handlePress}
        onPressIn={() => springTo(0.975, 0)}
        onPressOut={() => springTo(1, 6)}
        accessibilityRole="button"
        accessibilityLabel={`Seelogd Premium, ${title}. ${ctaTitle}, ${ctaSubtitle}`}
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
                  <AppIcon name="diamond" size={22} color="#FFFFFF" />
                </LinearGradient>
              </View>

              <View style={styles.headerCopy}>
                <View style={styles.eyebrowRow}>
                  <Text
                    allowFontScaling={false}
                    style={[styles.eyebrow, { color: accent }]}
                  >
                    {premiumName.toUpperCase()}
                  </Text>
                  {loading ? (
                    <ActivityIndicator size="small" color={accent} />
                  ) : (
                    <View
                      style={[
                        styles.pill,
                        {
                          backgroundColor: alpha(theme.text.primary, 0.07),
                          borderColor: alpha(theme.text.primary, 0.12),
                        },
                      ]}
                    >
                      <View style={[styles.pillDot, { backgroundColor: theme.text.muted }]} />
                      <Text
                        allowFontScaling={false}
                        style={[styles.pillText, { color: theme.text.muted }]}
                      >
                        {freeName.toUpperCase()}
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

            {/* Karşılaştırma: Free'de şu → Premium'da şu (rakamlar kayıttan) */}
            <View style={styles.tiles}>
              {highlights.map((item) => (
                <CompareTile
                  key={item.id}
                  item={item}
                  tint={tints[item.tint] || accent}
                  theme={theme}
                  freeName={freeName}
                  premiumName={premiumName}
                />
              ))}
            </View>

            {/* Ayrıca: Free'de kapalı olan avantajlar (kayıt öyle diyorsa) */}
            {perks.length > 0 ? (
              <View style={styles.perks}>
                {perks.map((perk) => (
                  <View
                    key={perk.id}
                    style={[
                      styles.perk,
                      {
                        backgroundColor: alpha(accent, 0.1),
                        borderColor: alpha(accent, 0.22),
                      },
                    ]}
                  >
                    <AppIcon name={perk.icon} size={11} color={accent} />
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[styles.perkText, { color: theme.text.primary }]}
                    >
                      {perk.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* CTA: dolu gradyan + periyodik parlama; fiyat satırı gerçek mağaza fiyatı */}
            <View
              onLayout={(e) => setCtaWidth(e.nativeEvent.layout.width)}
              style={styles.cta}
            >
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
              <View style={styles.ctaCopy}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.ctaTitle, { color: "#FFFFFF" }]}
                >
                  {ctaTitle}
                </Text>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={[styles.ctaSubtitle, { color: "rgba(255,255,255,0.82)" }]}
                >
                  {ctaSubtitle}
                </Text>
              </View>
              {offerBadge ? (
                <View testID="premium-showcase-offer" style={styles.offer}>
                  <Text allowFontScaling={false} numberOfLines={1} style={styles.offerBig}>
                    {offerBadge.big}
                  </Text>
                  <Text allowFontScaling={false} numberOfLines={1} style={styles.offerSmall}>
                    {offerBadge.small}
                  </Text>
                </View>
              ) : null}
              <Animated.View
                style={[
                  styles.ctaArrow,
                  {
                    backgroundColor: "rgba(255,255,255,0.22)",
                    transform: [{ translateX: arrowX }],
                  },
                ]}
              >
                <AppIcon name="arrow-forward" size={15} color="#FFFFFF" />
              </Animated.View>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Ayarlar > Seelogd Premium alanı: ücretli planda küçük "Aboneliği yönet" çubuğu, Free'de
 * vitrin. Plan RevenueCat cevabı beklenirken son bilinen plandır (PremiumContext),
 * yani abone açılışta bir an vitrin görüp çubuğa atlamaz.
 */
export default function PremiumSettingsCard() {
  const { plan } = usePremium();
  return shouldShowMemberBar(plan) ? <PremiumMemberBar /> : <PremiumShowcase />;
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
    paddingHorizontal: 9,
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
  tileValues: { flexDirection: "row", alignItems: "center", gap: 4 },
  // Free değeri sönük ve üstü çizili: "bu sende var, şuna çıkıyor" okunur.
  tileFrom: {
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "line-through",
    fontVariant: ["tabular-nums"],
  },
  tileTo: {
    flexShrink: 1,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  tileLabel: { fontSize: 10.5, fontWeight: "600" },

  perks: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  perk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  perkText: { fontSize: 10.5, fontWeight: "700" },

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
  // Giriş teklifi rozeti (yalnız mağaza gerçekten teklif veriyorsa).
  offer: {
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  offerBig: { fontSize: 12.5, lineHeight: 15, fontWeight: "900", color: "#FFFFFF" },
  offerSmall: { fontSize: 8.5, lineHeight: 10, fontWeight: "800", letterSpacing: 0.3, color: "rgba(255,255,255,0.88)" },
  ctaArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
