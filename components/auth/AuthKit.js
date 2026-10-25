// components/auth/AuthKit.js
//
// Giriş / kayıt / şifremi unuttum ekranlarının ORTAK görsel dili. Üç ekran
// eskiden aynı stil bloklarını (input kabuğu, ana düğme, Google düğmesi, "veya"
// çizgisi, geri düğmesi, başlık rozeti) üç ayrı dosyada kopyalıyordu; biri
// değişince diğerleri geride kalıyordu.
//
// Dil: tema renginden türeyen yumuşak bir ışıma (AuthBackdrop), halkalı bir
// rozet (AuthBadge), ince vurgu çizgili tek kart (AuthCard), odakta renk
// geçişi yapan alanlar (AuthField) ve accent'ten türetilmiş degrade ana düğme
// (AuthPrimaryButton). Girişlerde FadeInDown ile kademeli açılış (Reveal);
// "Hareketi Azalt" açıkken hareket yok.
//
// Sosyal giriş: Apple ve Google düğmeleri tek taban (SocialButton) üstünde —
// aynı yükseklik, ikon yuvası ve yazı boyutu; renkler markanın kendi
// yönergesinden (temadan değil). Apple düğmesi bilerek yerel
// `AppleAuthenticationButton` DEĞİL: yerel düğmenin yazısı yükseklikten türeyip
// iri kalıyordu ve ayarlanamıyordu.
//
// Ekranların KENDİ davranışı (Firebase, doğrulama, klavye zinciri) burada
// değil — bu dosya yalnız görünüm ve dokunma geri bildirimi taşır.

import React, { forwardRef, useId, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import LottieView from "lottie-react-native";
import GlassIconButton from "../common/GlassIconButton";
import GlassSurface from "../common/GlassSurface";
import useGlassChrome from "../common/useGlassChrome";
import { useLiquidGlass } from "../../services/liquidGlass";
import { alpha } from "../../theme/colors";
import { isLightSurface, luminance, shiftLightness, toHex } from "../../utils/colorUtils";
import { i18nText } from "../../utils/i18nText";
import useReduceMotion from "../../hooks/useReduceMotion";

export const AUTH_SUCCESS = "rgb(37, 211, 102)";
export const AUTH_ERROR = "rgb(189, 8, 28)";
export const AUTH_WARN = "#f39c12";

// Ekran içeriğinin ortak sütunu: dar telefonda tam genişlik, tablette ortada.
export const authColumn = { width: "100%", maxWidth: 440, alignSelf: "center" };

const FIELD_H = 58;
const FIELD_RADIUS = 18;

// Sosyal giriş düğmeleri (Apple / Google) AYNI yükseklik, köşe, ikon yuvası ve
// yazı boyutunu paylaşır: eskiden Apple'ın yerel düğmesi yazı boyutunu
// yükseklikten türetiyordu (≈23 pt) ve yanındaki 15 pt'lik Google düğmesinin
// yanında iri kalıyordu.
const SOCIAL_H = 52;
const SOCIAL_ICON_SLOT = 24;

/**
 * Accent zeminli düğmede/işaretçide okunur ön plan rengi. Beyaz varsayılan:
 * `isLightSurface` eşiği (0.179) matematiksel en yüksek kontrastı verir ama
 * #3B82F6 gibi canlı mavilerde koyu yazıyı çamurlaştırıyordu. Koyu yazı yalnız
 * gerçekten açık accent'lerde (sarı, limon…) seçilir.
 */
export function onAccentColor(accent) {
  return luminance(toHex(accent)) > 0.38 ? "#111827" : "#FFFFFF";
}

// ── Açılış hareketi ───────────────────────────────────────────────────────────

/** Çocuğunu hafifçe yukarı kayarak belirtir. `delay` ms. */
export function Reveal({ delay = 0, style, children }) {
  const reduceMotion = useReduceMotion();
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(delay).duration(420)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

// ── Basınca küçülen dokunma yüzeyi ────────────────────────────────────────────

function PressScale({
  children,
  style,
  containerStyle,
  onPress,
  onLongPress,
  disabled,
  pressedScale = 0.97,
  glass = true,
  ...rest
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  // iOS 26+: düğmenin dolgu/çerçeve/köşe stili Liquid Glass'a devredilir.
  // Marka düğmeleri (Apple / Google) `glass={false}` ile bunun dışında kalır.
  const chrome = useGlassChrome(style, {
    role: "button",
    enabled: glass,
    interactive: true,
    catchTouches: true,
  });
  return (
    <Pressable
      {...rest}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={containerStyle}
      onPressIn={() => {
        scale.value = withSpring(pressedScale, { damping: 18, stiffness: 340 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
    >
      <Animated.View style={[chrome ? chrome.style : style, animated]} onLayout={chrome?.onLayout}>
        {chrome ? chrome.wrap(children) : children}
      </Animated.View>
    </Pressable>
  );
}

export { PressScale as AuthPressable };

// ── Arka plan ışıması ─────────────────────────────────────────────────────────

/**
 * Tema accent'inden türeyen yumuşak ışıma: üstten inen geniş bir hâle + sağ
 * altta çok hafif bir ikincisi. Radyal degrade SVG ile çiziliyor — blur
 * gerektirmediği için Android'de de, hedefsiz blur sorunu yaşamadan, aynı görünür.
 */
export function AuthBackdrop({ accent, isLightTheme }) {
  // id ÇAKIŞMASI: react-native-svg'de Defs ad alanı Android'de doküman
  // genelinde global. Stack'te bir önceki auth ekranı hâlâ monte ise aynı id'li
  // iki gradyan birbirine karışır; her örneğe ayrı id (bkz. AppBadge).
  const rid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const topId = `auth${rid}top`;
  const lowId = `auth${rid}low`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient
            id={topId}
            cx="50%"
            cy="0%"
            fx="50%"
            fy="0%"
            rx="105%"
            ry="52%"
          >
            <Stop offset="0" stopColor={accent} stopOpacity={isLightTheme ? 0.26 : 0.34} />
            <Stop offset="0.55" stopColor={accent} stopOpacity={isLightTheme ? 0.08 : 0.1} />
            <Stop offset="1" stopColor={accent} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id={lowId}
            cx="100%"
            cy="100%"
            fx="100%"
            fy="100%"
            rx="85%"
            ry="38%"
          >
            <Stop offset="0" stopColor={accent} stopOpacity={isLightTheme ? 0.14 : 0.2} />
            <Stop offset="1" stopColor={accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${topId})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${lowId})`} />
      </Svg>
    </View>
  );
}

// ── Rozet + başlık ────────────────────────────────────────────────────────────

/**
 * Halkalı rozet: dıştaki soluk halka, içte accent degradeli yuvarlak kare.
 * Gölge/yükseltme OPAK bir tabanda durur (surface) — yarı saydam gövdeye
 * `elevation` verilirse Android gölgeyi içeriden de gösterir.
 */
export function AuthBadge({ accent, surface, size = 76, tone, children }) {
  const color = tone || accent;
  const ring = size + 26;
  return (
    <View style={{ width: ring, height: ring, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          backgroundColor: alpha(color, 0.07),
          borderWidth: 1,
          borderColor: alpha(color, 0.14),
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size + 12,
          height: size + 12,
          borderRadius: (size + 12) / 2,
          borderWidth: 1,
          borderColor: alpha(color, 0.1),
        }}
      />
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size * 0.32,
            backgroundColor: surface,
            shadowColor: color,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.34,
            shadowRadius: 18,
            elevation: 8,
          },
        ]}
      >
        <LinearGradient
          colors={[alpha(color, 0.34), alpha(color, 0.08)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: size * 0.32,
              borderWidth: 1,
              borderColor: alpha(color, 0.42),
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          {children}
        </LinearGradient>
      </View>
    </View>
  );
}

export function AuthHero({ theme, badge, title, subtitle, titleSize = 28 }) {
  return (
    <View style={styles.hero}>
      {badge}
      <Text
        allowFontScaling={false}
        style={[
          styles.heroTitle,
          { color: theme.text.primary, fontSize: titleSize, lineHeight: titleSize + 6 },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          allowFontScaling={false}
          style={[styles.heroSub, { color: theme.text.secondary }]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// ── Kart ──────────────────────────────────────────────────────────────────────

export function AuthCard({ theme, accent, children, style }) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.secondary, borderColor: theme.border },
        style,
      ]}
    >
      {/* Üst kenarda ince vurgu çizgisi — kartı arka plan ışımasına bağlar */}
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(accent, 0), alpha(accent, 0.7), alpha(accent, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardLine}
      />
      {children}
    </View>
  );
}

export function AuthCardHeader({ theme, title, subtitle }) {
  return (
    <View style={styles.cardHeader}>
      <Text allowFontScaling={false} style={[styles.cardTitle, { color: theme.text.primary }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.cardSub, { color: theme.text.muted }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

/** Kayıt formundaki bölüm başlığı: küçük büyük harfli etiket + uzayan çizgi. */
export function AuthSectionLabel({ theme, accent, children }) {
  return (
    <View style={styles.sectionRow}>
      <View style={[styles.sectionDot, { backgroundColor: accent }]} />
      <Text
        allowFontScaling={false}
        style={[styles.sectionText, { color: theme.text.muted }]}
      >
        {children}
      </Text>
      <View style={[styles.sectionLine, { backgroundColor: theme.border }]} />
    </View>
  );
}

// ── Alan ──────────────────────────────────────────────────────────────────────

/**
 * Giriş alanı. `state`: null (nötr) | true (geçerli) | false (geçersiz) —
 * kenar rengi odak/durum arasında yumuşakça geçer. `icon` verilmezse (yan yana
 * dar alanlar) yalnız yazı alanı çizilir. `right`: sağ uç (göz, durum ikonu).
 * `ref` doğrudan TextInput'a gider (klavye zinciri için).
 */
export const AuthField = forwardRef(function AuthField(
  {
    theme,
    accent,
    fieldSurface,
    icon,
    state = null,
    right,
    containerStyle,
    inputStyle,
    onFocus,
    onBlur,
    ...inputProps
  },
  ref,
) {
  const [focused, setFocused] = useState(false);

  const tone =
    state === true ? AUTH_SUCCESS : state === false ? AUTH_ERROR : focused ? accent : null;
  const borderTarget = tone ?? theme.border;
  const surfaceTarget = focused ? alpha(tone ?? accent, 0.08) : fieldSurface;
  const iconColor = tone ?? theme.text.muted;

  // iOS 26+: alan Liquid Glass'tır. Odak / geçerli / geçersiz durumu YALNIZ camın
  // tonuyla anlatılır: cam üstünde çerçeve hiç çizilmez (sabit RN halkası camın
  // kenar ışığından kopuk ikinci bir hat gibi duruyordu). Kalınlık saydam kalır,
  // cam o payı da örter (alan boyutu iki yolda aynı).
  const glass = useLiquidGlass();
  const shellAnim = useAnimatedStyle(() => ({
    borderColor: glass ? "transparent" : withTiming(borderTarget, { duration: 180 }),
    backgroundColor: glass ? "transparent" : withTiming(surfaceTarget, { duration: 180 }),
  }));

  return (
    <Animated.View style={[styles.field, shellAnim, containerStyle]}>
      {glass ? (
        <GlassSurface
          radius={FIELD_RADIUS}
          tint={focused || tone ? alpha(tone ?? accent, 0.22) : alpha(fieldSurface ?? theme.secondary, 0.55)}
          pointerEvents="none"
          style={styles.fieldGlass}
        />
      ) : null}
      {icon ? (
        <View
          style={[
            styles.fieldIcon,
            { backgroundColor: alpha(iconColor, tone ? 0.16 : 0.1) },
          ]}
        >
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
      ) : null}
      <TextInput
        {...inputProps}
        ref={ref}
        allowFontScaling={false}
        style={[
          styles.fieldInput,
          { color: theme.text.primary },
          !icon && styles.fieldInputBare,
          inputStyle,
        ]}
        placeholderTextColor={theme.text.muted}
        selectionColor={accent}
        cursorColor={accent}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
      />
      {right}
    </Animated.View>
  );
});

/** Parola alanının sağındaki göster/gizle düğmesi. */
export function AuthEyeToggle({ visible, onToggle, theme }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onToggle}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={styles.eye}
    >
      <Ionicons
        name={visible ? "eye-outline" : "eye-off-outline"}
        size={20}
        color={theme.text.muted}
      />
    </Pressable>
  );
}

// ── Düğmeler ──────────────────────────────────────────────────────────────────

/**
 * Ana eylem düğmesi: accent'ten bir ton koyusuna degrade, accent renkli
 * gölge. Metin rengi accent'in parlaklığına göre seçilir (sarı/amber
 * temalarda beyaz metin okunmuyordu).
 */
export function AuthPrimaryButton({
  label,
  onPress,
  accent,
  enabled = true,
  loading = false,
  icon = "arrow-forward",
  style,
}) {
  const fg = onAccentColor(accent);
  const gradient = [shiftLightness(accent, 6), accent, shiftLightness(accent, -14)];
  // iOS 26+: degrade yerine accent tonlu Liquid Glass (PressScale cama çevirir).
  const glass = useLiquidGlass();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled, busy: loading }}
      onPress={onPress}
      disabled={!enabled || loading}
      pressedScale={0.975}
      // Android buzlu camı burada YOK: degrade + accent parıltısı (gölge) markanın
      // ana eylemi; buzlu katman gölgeyi düşürür, degrade de onu zaten örter.
      glass={glass}
      style={[
        styles.primary,
        { backgroundColor: accent, shadowColor: accent },
        !enabled && !loading && styles.primaryOff,
        style,
      ]}
    >
      {glass ? null : (
        <>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: FIELD_RADIUS }]}
          />
          {/* Üstten inen ince parlama: düz degradeye hafif bir "cam" derinliği verir */}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.65 }}
            style={[StyleSheet.absoluteFill, { borderRadius: FIELD_RADIUS }]}
          />
        </>
      )}
      {loading ? (
        <LottieView
          source={require("@lottie/loading15.json")}
          style={styles.primaryLoading}
          autoPlay
          loop
        />
      ) : (
        <>
          <Text allowFontScaling={false} style={[styles.primaryText, { color: fg }]}>
            {label}
          </Text>
          {icon ? (
            <View style={[styles.primaryArrow, { backgroundColor: alpha(fg, 0.16) }]}>
              <Ionicons name={icon} size={16} color={fg} />
            </View>
          ) : null}
        </>
      )}
    </PressScale>
  );
}

/** İkincil (çerçeveli) düğme — "Tekrar gönder" gibi. */
export function AuthSecondaryButton({ label, icon, onPress, theme, fieldSurface }) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.secondary, { backgroundColor: fieldSurface, borderColor: theme.border }]}
    >
      {icon ? <Ionicons name={icon} size={17} color={theme.text.secondary} /> : null}
      <Text
        allowFontScaling={false}
        style={[styles.secondaryText, { color: theme.text.secondary }]}
      >
        {label}
      </Text>
    </PressScale>
  );
}

// Google "G" — resmî dört renkli işaret (24x24 görünüm kutusu).
function GoogleMark({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </Svg>
  );
}

// Markaların kendi düğme renkleri: Apple HIG (açık zeminde siyah, koyu zeminde
// beyaz) ve Google marka yönergesi (aydınlık/koyu düğme: dolgu, çerçeve, yazı).
// Temadan türetilmiyor — marka düğmeleri tanınır olmak zorunda.
const APPLE_BUTTON = {
  light: { bg: "#000000", border: "#000000", fg: "#FFFFFF" },
  dark: { bg: "#FFFFFF", border: "#FFFFFF", fg: "#000000" },
};
const GOOGLE_BUTTON = {
  light: { bg: "#FFFFFF", border: "#747775", fg: "#1F1F1F" },
  dark: { bg: "#131314", border: "#8E918F", fg: "#E3E3E3" },
};

/**
 * Apple ve Google düğmelerinin ortak gövdesi: sabit genişlikli ikon yuvası +
 * tek satır yazı, ortada. Yükleme sırasında yazı yerinde kalır, yalnız ikon
 * dönen göstergeye çevrilir — düğme boyu/genişliği oynamaz.
 */
function SocialButton({ label, onPress, disabled, loading, palette, textStyle, children }) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      onPress={onPress}
      disabled={disabled}
      pressedScale={0.98}
      glass={false}
      style={[
        styles.social,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled && !loading && { opacity: 0.6 },
      ]}
    >
      <View style={styles.socialIcon}>
        {loading ? <ActivityIndicator size="small" color={palette.fg} /> : children}
      </View>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.socialText, { color: palette.fg }, textStyle]}
      >
        {label}
      </Text>
    </PressScale>
  );
}

/**
 * "Apple ile giriş/kayıt". Yerel `AppleAuthenticationButton` yerine kendi
 * çizimimiz: yerel düğme yazıyı yüksekliğin ~%43'ünden (≈23 pt) çiziyor ve
 * yanındaki Google düğmesinden iri/farklı duruyordu; boyutu ayarlanamıyordu.
 * Apple HIG'in özel düğme kuralları korunuyor: resmî Apple logosu, SF yazı
 * tipi, "Apple ile giriş yap/kayıt ol" metni, siyah/beyaz iki biçim.
 */
export function AuthAppleButton({ label, onPress, disabled, loading, theme }) {
  const palette = isLightSurface(theme.primary) ? APPLE_BUTTON.light : APPLE_BUTTON.dark;
  return (
    <SocialButton
      label={label}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      palette={palette}
      textStyle={styles.appleText}
    >
      <Ionicons name="logo-apple" size={22} color={palette.fg} />
    </SocialButton>
  );
}

export function AuthGoogleButton({ label, onPress, disabled, loading, theme }) {
  const palette = isLightSurface(theme.primary) ? GOOGLE_BUTTON.light : GOOGLE_BUTTON.dark;
  return (
    <SocialButton
      label={label}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      palette={palette}
    >
      <GoogleMark size={20} />
    </SocialButton>
  );
}

export function AuthDivider({ theme, label }) {
  return (
    <View style={styles.divider}>
      <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
      <Text allowFontScaling={false} style={[styles.dividerText, { color: theme.text.muted }]}>
        {label}
      </Text>
      <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
    </View>
  );
}

// ── Köşe düğmeleri ve alt bağlantı ────────────────────────────────────────────

export function AuthBackButton({ onPress, theme, top }) {
  return (
    // iOS 26+: Liquid Glass; diğer yerlerde eski daire (zemin + çerçeve).
    <GlassIconButton
      icon="chevron-back"
      iconSize={20}
      size={42}
      fallbackRadius={21}
      accessibilityLabel={i18nText("autoI18n.geri", "Geri")}
      onPress={onPress}
      style={[styles.cornerWrap, { top, left: 20 }]}
    />
  );
}

export function AuthFooterLink({ theme, accent, text, link, onPress }) {
  return (
    <View style={styles.footer}>
      <Text allowFontScaling={false} style={[styles.footerText, { color: theme.text.muted }]}>
        {text}
      </Text>
      <Pressable
        accessibilityRole="link"
        onPress={onPress}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
        style={styles.footerLinkWrap}
      >
        <Text allowFontScaling={false} style={[styles.footerLink, { color: accent }]}>
          {link}
        </Text>
        <Ionicons name="arrow-forward" size={14} color={accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Başlık ──
  hero: {
    alignItems: "center",
    gap: 10,
  },
  heroTitle: {
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  heroSub: {
    maxWidth: 320,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    textAlign: "center",
  },

  // ── Kart ──
  card: {
    width: "100%",
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
  },
  cardLine: {
    position: "absolute",
    top: -1,
    left: 36,
    right: 36,
    height: 2,
    borderRadius: 2,
  },
  cardHeader: {
    gap: 4,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  cardSub: {
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 19,
  },

  // ── Bölüm etiketi ──
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionText: {
    fontSize: 12,
    fontWeight: "800",
    // Büyük harf çevirinin içinde: textTransform Türkçe i/İ'yi yanlış çeviriyor.
    letterSpacing: 0.8,
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },

  // ── Alan ──
  field: {
    minHeight: FIELD_H,
    borderWidth: 1,
    borderRadius: FIELD_RADIUS,
    paddingLeft: 12,
    paddingRight: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  // Cam katmanı saydam çerçeve payını da örter (styles.field borderWidth: 1).
  fieldGlass: { position: "absolute", top: -1, left: -1, right: -1, bottom: -1 },
  fieldIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 12,
  },
  fieldInputBare: {
    paddingLeft: 4,
  },
  eye: {
    padding: 2,
  },

  // ── Düğmeler ──
  primary: {
    height: 56,
    borderRadius: FIELD_RADIUS,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 16,
    elevation: 7,
  },
  // Kapalıyken gölge de gider: soluk düğmenin altında kalan renkli hâle kirli görünüyordu.
  primaryOff: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  primaryArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLoading: {
    width: 38,
    height: 38,
  },
  secondary: {
    minHeight: 48,
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  social: {
    height: SOCIAL_H,
    borderRadius: FIELD_RADIUS,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  socialIcon: {
    width: SOCIAL_ICON_SLOT,
    height: SOCIAL_ICON_SLOT,
    alignItems: "center",
    justifyContent: "center",
  },
  socialText: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  // Apple HIG: özel düğmede de SF (sistem) yazı tipi; kullanıcının seçtiği
  // yazı tipi bu etikete uygulanmaz.
  appleText: {
    fontFamily: Platform.select({ ios: "System", default: undefined }),
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  // ── Köşe düğmesi / alt bağlantı ──
  cornerWrap: {
    position: "absolute",
    zIndex: 10,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  footerText: {
    fontSize: 14,
    fontWeight: "600",
  },
  footerLinkWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "800",
  },
});
