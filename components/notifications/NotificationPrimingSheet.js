// components/notifications/NotificationPrimingSheet.js
//
// Sistem bildirim izni diyaloğundan ÖNCE gösterilen tek seferlik açıklama.
//
// NEDEN: sistem diyaloğu iOS'ta bir kez açılır ve "İzin verme" o hakkı yakar.
// Kullanıcı neyin karşılığında izin verdiğini bilirse "evet" oranı artar,
// bilmezse kalıcı bir "hayır" alırız. Buradaki "Şimdi değil" ise bedava:
// hiçbir sistem hakkını harcamaz, Ayarlar'dan her zaman geri dönülebilir.
//
// KARAR BURADA DEĞİL: sayfanın açılıp açılmayacağını
// utils/notificationPriming.js belirler; bu dosya yalnız görünüm.
//
// TEK ÖRNEK: sayfa DeviceNotificationsProvider tarafından çiziliyor, çağrı
// yerleri yalnız "aç" diyor. İç içe modal olmaması için çağıran taraf kendi
// sayfasını ÖNCE kapatmalı (bkz. MediaQuickActionsSheet'teki closeThen).
//
// GÖRÜNÜM: üstte hareketli zil sahnesi (NotificationBellHero), altında başlık,
// üç fayda satırı ve parıltılı ana düğme. İçerik kademeli (FadeInDown) açılır;
// "Hareketi Azalt" açıkken hiçbir hareket yok — sayfa yine tam ve okunur.
//
// DÜZEN: sahne + metin + faydalar KAYDIRILABİLİR alanda, düğmeler SABİT altta.
// Kısa ekranda ya da büyük yazı boyutunda içerik taşarsa "İzin ver" ekrandan
// kaçmasın diye.

import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "../common/BottomSheetModal";
import PressableScale from "../cineswipe/PressableScale";
import NotificationBellHero, { SheetGlow } from "./NotificationBellHero";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { isLightSurface, shiftLightness } from "../../utils/colorUtils";
import { i18nText } from "../../utils/i18nText";
import useReduceMotion from "../../hooks/useReduceMotion";

// Bu yükseklikten kısa ekranlarda sahne küçülür (iPhone SE sınıfı).
const COMPACT_HEIGHT = 720;

// Kullanıcının izinle ne kazandığı — soyut "bildirim al" yerine somut karşılık.
// `tone: null` = tema accent'i. Yeşil ve gül tonları hero'daki çiplerle aynı.
// `key` / `titleKey`: i18nKeys testi bu tabloyu okuyor (iki alan da paketlerde
// bulunmalı).
const BENEFITS = [
  {
    icon: "alarm-outline",
    tone: null,
    titleKey: "bildirim_on_fayda_hatirlatma_baslik",
    trTitle: "Yayın hatırlatmaları",
    key: "bildirim_on_fayda_hatirlatma",
    tr: "Takip ettiğin film ve bölümler yayınlanmadan haber ver",
  },
  {
    icon: "chatbubble-ellipses-outline",
    tone: "#22C55E",
    titleKey: "bildirim_on_fayda_arkadas_baslik",
    trTitle: "Arkadaşlar ve mesajlar",
    key: "bildirim_on_fayda_arkadas",
    tr: "Arkadaş istekleri ve mesajlar anında ulaşsın",
  },
  {
    icon: "heart-outline",
    tone: "#F43F5E",
    titleKey: "bildirim_on_fayda_etkilesim_baslik",
    trTitle: "Beğeni, yorum ve etiketler",
    key: "bildirim_on_fayda_etkilesim",
    tr: "Paylaşımlarına gelen tepkilerden ilk sen haberdar ol",
  },
];

// Giriş sırası (ms): sayfa yay hareketiyle yükselirken içerik arkasından gelir.
const DELAY = {
  title: 230,
  subtitle: 300,
  benefit: 390,
  benefitStep: 85,
  action: 680,
  footer: 760,
};

/** Çocuğunu hafifçe yukarı kayarak belirtir. Hareketsiz modda doğrudan çizer. */
function Reveal({ delay, animate, style, children }) {
  return (
    <Animated.View
      entering={
        animate
          ? FadeInDown.delay(delay).duration(380).easing(Easing.out(Easing.cubic))
          : undefined
      }
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Ana düğme: accent degrade + periyodik parıltı süpürmesi.
 *
 * Gölge ile `overflow: hidden` AYNI görünümde duramaz (iOS gölgeyi keser); bu
 * yüzden dış kabuk gölgeyi, iç kabuk kırpmayı taşıyor.
 */
function AllowButton({ label, accent, animate, onPress }) {
  const foreground = isLightSurface(accent) ? "#111827" : "#FFFFFF";
  const gradient = [shiftLightness(accent, 8), accent, shiftLightness(accent, -14)];
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (!animate || width === 0) return undefined;
    sweep.value = 0;
    // Parıltı geçer, kısa bir sessizlik, tekrar. Sıfırlama süresiz (1 ms):
    // çubuk kapalı kenarda beklerken görünmez.
    sweep.value = withDelay(
      1300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withDelay(2800, withTiming(0, { duration: 1 })),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(sweep);
  }, [animate, width, sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(sweep.value, [0, 1], [-90, width + 40]) },
      { skewX: "-20deg" },
    ],
  }));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.97}
      style={[styles.allow, { backgroundColor: accent, shadowColor: accent }]}
    >
      <View
        style={styles.allowClip}
        onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {animate ? (
          <Animated.View pointerEvents="none" style={[styles.shine, sweepStyle]}>
            <LinearGradient
              colors={[alpha("#FFFFFF", 0), alpha("#FFFFFF", 0.38), alpha("#FFFFFF", 0)]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
        <View style={[styles.allowIcon, { backgroundColor: alpha(foreground, 0.16) }]}>
          <Ionicons name="notifications" size={16} color={foreground} />
        </View>
        <Text style={[styles.allowText, { color: foreground }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onAllow    "Bildirimleri aç" — sistem diyaloğunu açacak.
 * @param {() => void} props.onDismiss  "Şimdi değil" + dışarı dokunuş/geri tuşu.
 */
export default function NotificationPrimingSheet({ visible, onAllow, onDismiss }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  const animate = !reduceMotion;
  const compact = height < COMPACT_HEIGHT;
  const accent = theme.accent;
  const isLightTheme = isLightSurface(theme.primary);

  const handleAllow = useCallback(() => {
    onAllow?.();
  }, [onAllow]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onDismiss}
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.primary, borderColor: theme.border },
      ]}
    >
      <SheetGlow accent={accent} isLightTheme={isLightTheme} />

      {/* Üst kenarda ince vurgu çizgisi — sayfayı ışımaya bağlıyor. */}
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(accent, 0), alpha(accent, 0.75), alpha(accent, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topLine}
      />

      <View style={[styles.grabber, { backgroundColor: alpha(theme.text.muted, 0.4) }]} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <NotificationBellHero
          theme={theme}
          accent={accent}
          animate={animate}
          compact={compact}
        />

        <Reveal delay={DELAY.title} animate={animate}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.text.primary }]}
          >
            {i18nText("autoI18n.bildirim_on_baslik", "Gelişmelerden ilk sen haberdar ol")}
          </Text>
        </Reveal>
        <Reveal delay={DELAY.subtitle} animate={animate}>
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
            {i18nText(
              "autoI18n.bildirim_on_aciklama",
              "Hatırlatmaların ve mesajların telefonuna düşebilmesi için bildirim izni gerekiyor. İzin vermezsen hatırlatmalar sessizce hiç çalışmaz.",
            )}
          </Text>
        </Reveal>

        <View style={styles.benefits}>
          {BENEFITS.map((item, index) => {
            const tone = item.tone || accent;
            return (
              <Reveal
                key={item.key}
                delay={DELAY.benefit + index * DELAY.benefitStep}
                animate={animate}
              >
                <View
                  style={[
                    styles.benefit,
                    { backgroundColor: theme.secondary, borderColor: theme.border },
                  ]}
                >
                  <View style={[styles.benefitIcon, { backgroundColor: alpha(tone, 0.16) }]}>
                    <Ionicons name={item.icon} size={20} color={tone} />
                  </View>
                  <View style={styles.benefitCopy}>
                    <Text
                      numberOfLines={1}
                      style={[styles.benefitTitle, { color: theme.text.primary }]}
                    >
                      {i18nText(`autoI18n.${item.titleKey}`, item.trTitle)}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[styles.benefitDesc, { color: theme.text.muted }]}
                    >
                      {i18nText(`autoI18n.${item.key}`, item.tr)}
                    </Text>
                  </View>
                </View>
              </Reveal>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
        <Reveal delay={DELAY.action} animate={animate}>
          <AllowButton
            label={i18nText("autoI18n.bildirim_on_izin_ver", "Bildirimleri aç")}
            accent={accent}
            animate={animate}
            onPress={handleAllow}
          />
        </Reveal>

        <Reveal delay={DELAY.footer} animate={animate}>
          <PressableScale
            accessibilityRole="button"
            onPress={onDismiss}
            scaleTo={0.96}
            style={styles.ghost}
          >
            <Text style={[styles.ghostText, { color: theme.text.secondary }]}>
              {i18nText("autoI18n.bildirim_on_simdi_degil", "Şimdi değil")}
            </Text>
          </PressableScale>

          {/* Geri dönüş yolunu baştan söylüyoruz: "Şimdi değil" bir kapı kapatmıyor.
              Adres: Ayarlar › Hatırlatıcılar (NotificationPermissionNotice orada). */}
          <View style={styles.footnoteRow}>
            <Ionicons name="information-circle-outline" size={14} color={theme.text.muted} />
            <Text style={[styles.footnote, { color: theme.text.muted }]}>
              {i18nText(
                "autoI18n.bildirim_on_dipnot",
                "Bunu daha sonra Ayarlar › Hatırlatıcılar'dan açabilirsin.",
              )}
            </Text>
          </View>
        </Reveal>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  // `overflow: hidden`: ışıma ve üst çizgi köşe yuvarlağının dışına taşmasın.
  // `maxHeight` yüzdesi çözülür çünkü sayfa kaplayıcının DOĞRUDAN çocuğu
  // (bkz. BottomSheetModal).
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
    paddingTop: 10,
  },
  topLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 6,
  },
  scroll: { flexShrink: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 6,
  },
  benefits: { marginTop: 20, gap: 8 },
  benefit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  benefitIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitCopy: { flex: 1 },
  benefitTitle: { fontSize: 14.5, fontWeight: "700" },
  benefitDesc: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  allow: {
    height: 56,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  allowClip: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  allowIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  allowText: { fontSize: 16, fontWeight: "800", letterSpacing: 0.1 },
  shine: {
    position: "absolute",
    top: -8,
    bottom: -8,
    left: 0,
    width: 64,
  },
  ghost: {
    marginTop: 6,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { fontSize: 14.5, fontWeight: "600" },
  footnoteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 2,
    paddingHorizontal: 8,
  },
  footnote: {
    flexShrink: 1,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: "center",
  },
});
