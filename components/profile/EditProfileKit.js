// components/profile/EditProfileKit.js
//
// "Profili düzenle" ekranının görsel parçaları. Ekranın KENDİ davranışı
// (kullanıcı adı denetimi, kaydetme, hesap silme akışı) EditProfileScreen'de
// kalır; burası yalnız görünüm ve dokunma geri bildirimi taşır.
//
// Dil, giriş/kayıt ekranlarıyla aynı (components/auth/AuthKit.js): accent'ten
// türeyen ışıma ve halkalar, odakta renk geçişi yapan alanlar, basınca küçülen
// yüzeyler. Eski ekranda her şey tek düz listeydi — avatar yatay bir şeritte
// aranıyor, alanlar etiket+çerçeve yığınıydı, Kaydet her zaman açıktı ve hesap
// silme modalı ortada bir kutuydu.

import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheetModal from "../common/BottomSheetModal";
import SheetScroll from "../common/SheetScroll";
import UserAvatar from "../common/UserAvatar";
import GlassIconButton from "../common/GlassIconButton";
import { AuthEyeToggle, AuthField, AuthPressable } from "../auth/AuthKit";
import { alpha } from "../../theme/colors";
import { isLightSurface, shiftLightness } from "../../utils/colorUtils";
import { i18nText } from "../../utils/i18nText";
import GlassBox from "../common/GlassBox";
import HoldToConfirmButton from "./HoldToConfirmButton";

const noop = () => {};

// ── Üst çubuk ─────────────────────────────────────────────────────────────────

/**
 * Geri düğmesi + sola yaslı başlık + Kaydet hapı. Kaydet yalnız değişiklik
 * varken (`canSave`) renkli; yokken sönük — dokunulacak bir şey olmadığını
 * göstermek için. Kaydederken renkli kalır ve içinde döner.
 */
export function EditHeader({ theme, title, onBack, onSave, canSave, saving }) {
  const accent = theme.accent;
  const fg = isLightSurface(accent) ? "#111827" : "#FFFFFF";
  const lit = canSave || saving;
  const label = i18nText("autoI18n.kaydet", "Kaydet");
  return (
    <View style={styles.header}>
      {/* iOS 26+: Liquid Glass; diğer yerlerde eski daire (zemin + çerçeve). */}
      <GlassIconButton
        icon="chevron-back"
        iconSize={20}
        size={42}
        fallbackRadius={21}
        accessibilityLabel={i18nText("autoI18n.geri", "Geri")}
        onPress={onBack}
      />

      <Text
        allowFontScaling={false}
        numberOfLines={1}
        // 320 px'lik ekranda geri düğmesi + Kaydet'ten kalan alan başlığa dar
        // geliyor; kırpmak yerine yazı küçülsün.
        adjustsFontSizeToFit
        minimumFontScale={0.78}
        style={[styles.headerTitle, { color: theme.text.primary }]}
      >
        {title}
      </Text>

      <AuthPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !canSave || saving, busy: !!saving }}
        onPress={onSave}
        disabled={!canSave || saving}
        pressedScale={0.94}
        style={[
          styles.save,
          lit
            ? [{ backgroundColor: accent, shadowColor: accent }, styles.saveLit]
            : { backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1 },
        ]}
      >
        {lit ? (
          <LinearGradient
            pointerEvents="none"
            colors={[shiftLightness(accent, 6), accent, shiftLightness(accent, -14)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
          />
        ) : null}
        {saving ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <Text
            allowFontScaling={false}
            style={[styles.saveText, { color: lit ? fg : theme.text.muted }]}
          >
            {label}
          </Text>
        )}
      </AuthPressable>
    </View>
  );
}

// ── Avatar vitrini ────────────────────────────────────────────────────────────

const RING = 132;
const HALO = RING + 36;
const BADGE = 38;
// Rozet, halkanın sağ-alt köşesinde (45°) durur.
const BADGE_OFFSET = HALO / 2 + (RING / 2) * Math.SQRT1_2 - BADGE / 2;

/**
 * Büyük avatar + canlı ad/kullanıcı adı önizlemesi. Avatara ya da hapa
 * dokunmak seçiciyi açar. Ad/kullanıcı adı formla birlikte güncellenir —
 * kullanıcı profilinde nasıl görüneceğini yazarken görür.
 */
export function ProfileHero({
  theme,
  avatarIndex,
  photoURL,
  name,
  username,
  social,
  onPress,
}) {
  const accent = theme.accent;
  const fg = isLightSurface(accent) ? "#111827" : "#FFFFFF";
  const changeLabel = i18nText("autoI18n.avatari_degistir", "Avatarı değiştir");
  const trimmedName = (name || "").trim();
  return (
    <View style={styles.hero}>
      <AuthPressable
        accessibilityRole="button"
        accessibilityLabel={changeLabel}
        onPress={onPress}
        pressedScale={0.96}
        containerStyle={{ width: HALO, height: HALO }}
        style={{ width: HALO, height: HALO, alignItems: "center", justifyContent: "center" }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: HALO,
            height: HALO,
            borderRadius: HALO / 2,
            backgroundColor: alpha(accent, 0.07),
            borderWidth: 1,
            borderColor: alpha(accent, 0.14),
          }}
        />
        {/* Gölge OPAK bir tabanda durur: yarı saydam gövdeye elevation verilirse
            Android gölgeyi içeriden de gösterir. */}
        <View
          style={{
            width: RING,
            height: RING,
            borderRadius: RING / 2,
            backgroundColor: theme.primary,
            shadowColor: accent,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.34,
            shadowRadius: 20,
            elevation: 8,
          }}
        >
          <LinearGradient
            colors={[shiftLightness(accent, 8), accent, alpha(accent, 0.35)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: RING / 2, padding: 3 }}
          >
            <View
              style={{
                flex: 1,
                borderRadius: (RING - 6) / 2,
                backgroundColor: theme.primary,
                padding: 4,
              }}
            >
              <UserAvatar
                avatarIndex={avatarIndex}
                photoURL={photoURL}
                isCustomPhoto
                size={RING - 6 - 8}
              />
            </View>
          </LinearGradient>
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.badge,
            {
              left: BADGE_OFFSET,
              top: BADGE_OFFSET,
              backgroundColor: accent,
              borderColor: theme.primary,
              shadowColor: accent,
            },
          ]}
        >
          <Ionicons name="pencil" size={15} color={fg} />
        </View>
      </AuthPressable>

      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[
          styles.heroName,
          { color: trimmedName ? theme.text.primary : theme.text.muted },
        ]}
      >
        {trimmedName || i18nText("autoI18n.adin", "Adın")}
      </Text>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.heroUser, { color: username ? theme.text.secondary : theme.text.muted }]}
      >
        @{username || i18nText("autoI18n.kullanici_adi_ornegi", "kullanici_adi")}
      </Text>

      {social ? (
        <View style={styles.socialRow}>
          <Ionicons name="sparkles" size={12} color={accent} />
          <Text allowFontScaling={false} style={[styles.socialText, { color: theme.text.muted }]}>
            {i18nText("autoI18n.sosyal_profil_fotografi", "Sosyal profil fotoğrafı")}
          </Text>
        </View>
      ) : null}

      <AuthPressable
        accessibilityRole="button"
        accessibilityLabel={changeLabel}
        onPress={onPress}
        pressedScale={0.96}
        style={[
          styles.changePill,
          { backgroundColor: alpha(accent, 0.12), borderColor: alpha(accent, 0.38) },
        ]}
      >
        <Ionicons name="images-outline" size={16} color={accent} />
        <Text allowFontScaling={false} style={[styles.changeText, { color: accent }]}>
          {changeLabel}
        </Text>
      </AuthPressable>
    </View>
  );
}

// ── Form kartı ve parçaları ───────────────────────────────────────────────────

/** İkon madalyonlu başlığı olan yuvarlak köşeli kart. */
export function FormSection({ theme, icon, title, children }) {
  return (
    <GlassBox role="card" style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={styles.cardHead}>
        <View style={[styles.cardIcon, { backgroundColor: alpha(theme.accent, 0.13) }]}>
          <Ionicons name={icon} size={16} color={theme.accent} />
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.cardTitle, { color: theme.text.primary }]}
        >
          {title}
        </Text>
      </View>
      {children}
    </GlassBox>
  );
}

/** Alanın üstündeki etiket; sağda isteğe bağlı sayaç. */
export function FieldLabel({ theme, label, counter, warn }) {
  return (
    <View style={styles.labelRow}>
      <Text
        allowFontScaling={false}
        style={[styles.label, { color: theme.text.secondary }]}
      >
        {label}
      </Text>
      {counter ? (
        <Text
          allowFontScaling={false}
          style={[styles.counter, { color: warn ? "#f39c12" : theme.text.muted }]}
        >
          {counter}
        </Text>
      ) : null}
    </View>
  );
}

/** Alanın altındaki durum satırı: küçük ikon + renkli metin. */
export function FieldHint({ icon, color, children }) {
  return (
    <View style={styles.hintRow}>
      {icon ? <Ionicons name={icon} size={13} color={color} style={styles.hintIcon} /> : null}
      <Text allowFontScaling={false} style={[styles.hint, { color }]}>
        {children}
      </Text>
    </View>
  );
}

/** Alan + etiketi + durum satırı için tek kolon. */
export function FieldBlock({ children }) {
  return <View style={styles.block}>{children}</View>;
}

// ── Tehlikeli bölge ───────────────────────────────────────────────────────────

/**
 * Tehlikeli bölge girişi (hesabı sil / sıfırla): bağıran bir düğme yerine sakin,
 * kırmızı tonlu bir satır. `icon` ile iki satır birbirinden ayrışır.
 */
export function DangerRow({ theme, title, description, onPress, icon = "trash-outline" }) {
  const red = theme.colors.red;
  return (
    <AuthPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      pressedScale={0.98}
      style={[
        styles.danger,
        { backgroundColor: alpha(red, 0.07), borderColor: alpha(red, 0.32) },
      ]}
    >
      <View style={[styles.dangerIcon, { backgroundColor: alpha(red, 0.14) }]}>
        <Ionicons name={icon} size={19} color={red} />
      </View>
      <View style={styles.dangerCopy}>
        <Text allowFontScaling={false} style={[styles.dangerTitle, { color: red }]}>
          {title}
        </Text>
        <Text style={[styles.dangerText, { color: theme.text.muted }]}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={alpha(red, 0.7)} />
    </AuthPressable>
  );
}

// ── Hesap silme sayfası ───────────────────────────────────────────────────────

/**
 * Silme sürerken gösterilen aşama listesi + ilerleme çubuğu. `progress` =
 * { stage, stages } (services/accountService.js `onProgress`); `copy` =
 * getDeleteAccountCopy(language). Biten aşama yeşil tik, sürenin dönen halkası,
 * bekleyen sönük daire. Çubuk biten aşama sayısı + sürenin yarısı kadar dolar.
 */
export function DeleteProgress({ theme, progress, copy }) {
  const red = theme.colors.red;
  const stages = progress?.stages?.length ? progress.stages : [];
  const activeIndex = Math.max(0, stages.indexOf(progress?.stage));
  const fraction = stages.length ? Math.min(1, (activeIndex + 0.5) / stages.length) : 0;

  const fill = useRef(new Animated.Value(fraction)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue: fraction,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fraction, fill]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: stages.length, now: activeIndex }}
      style={styles.progress}
    >
      <View style={[styles.progressTrack, { backgroundColor: theme.between, borderColor: theme.border }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: red,
              width: fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            },
          ]}
        />
      </View>
      <Text allowFontScaling={false} style={[styles.progressStep, { color: theme.text.muted }]}>
        {copy.step.replace("{n}", String(activeIndex + 1)).replace("{total}", String(stages.length))}
      </Text>
      <View style={styles.progressList}>
        {stages.map((id, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <View key={id} style={styles.progressRow}>
              <View style={styles.progressIcon}>
                {done ? (
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.green} />
                ) : active ? (
                  <ActivityIndicator size="small" color={red} />
                ) : (
                  <Ionicons name="ellipse-outline" size={18} color={alpha(theme.text.muted, 0.6)} />
                )}
              </View>
              <Text
                allowFontScaling={false}
                style={[
                  styles.progressLabel,
                  {
                    color: active ? theme.text.primary : done ? theme.text.secondary : theme.text.muted,
                    fontWeight: active ? "800" : "600",
                  },
                ]}
              >
                {copy.stages[id] ?? id}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Alt sayfa (uygulamanın ortak BottomSheetModal'ı). Doğrulama alanı sağlayıcıya
 * göre değişir: `provider` ("apple" | "google") verilirse sağlayıcı düğmesi,
 * verilmezse parola alanı. Metinler çağıran tarafta çözülür (dil dallanması
 * ekranda).
 *
 * Onay düğmesi BASILI TUTARAK çalışır (HoldToConfirmButton): `holdMs` boyunca
 * basılı tutulunca dolar ve `onConfirm` çalışır. `canStart` basışın başında
 * çağrılır; false dönerse (şifre boş…) dolum başlamaz. Aynı sayfa hem hesap
 * silme hem sıfırlama için kullanılır — `icon`, başlık ve metinler değişir.
 */
export function DeleteAccountSheet({
  visible,
  onClose,
  theme,
  deleting,
  verifying,
  progress,
  progressCopy,
  title,
  description,
  provider,
  verified,
  verifyLabel,
  verifiedLabel,
  password,
  onPasswordChange,
  onVerify,
  onConfirm,
  confirmDisabled,
  cancelLabel,
  confirmLabel,
  holdLabel,
  holdHint,
  holdMs,
  canStart,
  icon = "warning-outline",
  passwordLabel,
}) {
  const insets = useSafeAreaInsets();
  const [showPassword, setShowPassword] = useState(false);
  const red = theme.colors.red;
  const busy = deleting || verifying;
  // Silme başladıysa ve ilerleme geldiyse: doğrulama alanı ve düğmeler yerine aşama listesi.
  const showProgress = !!deleting && !!progress && !!progressCopy;
  return (
    <BottomSheetModal
      visible={visible}
      onClose={busy ? noop : onClose}
      dismissOnBackdropPress={!busy}
      intensity={35}
      dimColor="rgba(0,0,0,0.5)"
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 18) + 4,
        },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      {/* Klavye açılınca küçülen bölge: başlık + doğrulama alanı kayar, alttaki
          düğmeler hep görünür kalır (bkz. components/common/SheetScroll.js). */}
      <SheetScroll>
        <View style={styles.sheetHead}>
          <View style={[styles.medalRing, { backgroundColor: alpha(red, 0.08), borderColor: alpha(red, 0.18) }]}>
            <View style={[styles.medal, { backgroundColor: alpha(red, 0.16), borderColor: alpha(red, 0.4) }]}>
              <Ionicons name={icon} size={26} color={red} />
            </View>
          </View>
          <Text allowFontScaling={false} style={[styles.sheetTitle, { color: theme.text.primary }]}>
            {showProgress ? progressCopy.title : title}
          </Text>
          <Text style={[styles.sheetDesc, { color: theme.text.secondary }]}>
            {showProgress ? progressCopy.hint : description}
          </Text>
        </View>

        {showProgress ? (
          <DeleteProgress theme={theme} progress={progress} copy={progressCopy} />
        ) : provider ? (
          <AuthPressable
            accessibilityRole="button"
            accessibilityLabel={verified ? verifiedLabel : verifyLabel}
            onPress={onVerify}
            disabled={busy || verified}
            pressedScale={0.98}
            style={[
              styles.verify,
              {
                borderColor: verified ? theme.colors.green : theme.border,
                backgroundColor: verified ? alpha(theme.colors.green, 0.1) : theme.between,
              },
            ]}
          >
            {verifying ? (
              <ActivityIndicator size="small" color={theme.text.primary} />
            ) : (
              <>
                <Ionicons
                  name={verified ? "checkmark-circle" : provider === "apple" ? "logo-apple" : "logo-google"}
                  size={19}
                  color={verified ? theme.colors.green : theme.text.primary}
                />
                <Text
                  allowFontScaling={false}
                  style={[styles.verifyText, { color: verified ? theme.colors.green : theme.text.primary }]}
                >
                  {verified ? verifiedLabel : verifyLabel}
                </Text>
              </>
            )}
          </AuthPressable>
        ) : (
          <AuthField
            theme={theme}
            accent={red}
            fieldSurface={theme.between}
            icon="lock-closed-outline"
            value={password}
            onChangeText={onPasswordChange}
            maxLength={128}
            placeholder={passwordLabel}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!deleting}
            containerStyle={styles.passwordField}
            right={
              <AuthEyeToggle
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                theme={theme}
              />
            }
          />
        )}
      </SheetScroll>

      {showProgress ? null : (
      <View style={styles.sheetActions}>
        <AuthPressable
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          onPress={onClose}
          disabled={busy}
          pressedScale={0.97}
          containerStyle={styles.actionCancel}
          style={[styles.action, { backgroundColor: theme.between, borderColor: theme.border, borderWidth: 1 }]}
        >
          <Text allowFontScaling={false} style={[styles.actionText, { color: theme.text.primary }]}>
            {cancelLabel}
          </Text>
        </AuthPressable>
        <HoldToConfirmButton
          label={confirmLabel}
          holdLabel={holdLabel}
          hint={holdHint}
          holdMs={holdMs}
          color={red}
          disabled={confirmDisabled}
          busy={!!deleting}
          canStart={canStart}
          onConfirm={onConfirm}
          style={styles.actionConfirm}
        />
      </View>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  // ── Üst çubuk ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  save: {
    minWidth: 76,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveLit: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.34,
    shadowRadius: 12,
    elevation: 6,
  },
  saveText: { fontSize: 14.5, fontWeight: "800", letterSpacing: 0.1 },

  // ── Avatar vitrini ──
  hero: { alignItems: "center", paddingTop: 6, paddingBottom: 4 },
  badge: {
    position: "absolute",
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  heroName: {
    marginTop: 2,
    maxWidth: "88%",
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroUser: {
    marginTop: 3,
    maxWidth: "88%",
    fontSize: 14.5,
    fontWeight: "600",
  },
  socialRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  socialText: { fontSize: 11.5, fontWeight: "700" },
  changePill: {
    marginTop: 14,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  changeText: { fontSize: 13.5, fontWeight: "800" },

  // ── Form kartı ──
  card: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { flex: 1, fontSize: 15.5, fontWeight: "800", letterSpacing: -0.2 },
  block: { gap: 8 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  label: { fontSize: 12.5, fontWeight: "700" },
  counter: { fontSize: 11.5, fontWeight: "700" },
  hintRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingHorizontal: 2 },
  hintIcon: { marginTop: 1 },
  hint: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },

  // ── Tehlikeli bölge ──
  danger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
  },
  dangerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerCopy: { flex: 1, gap: 3 },
  dangerTitle: { fontSize: 15, fontWeight: "800" },
  dangerText: { fontSize: 12, lineHeight: 17, fontWeight: "500" },

  // ── Hesap silme sayfası ──
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHead: { alignItems: "center", gap: 6, marginBottom: 16 },
  medalRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  medal: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { marginTop: 6, fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  sheetDesc: {
    maxWidth: 340,
    fontSize: 13.5,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "center",
  },
  verify: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  verifyText: { fontSize: 15, fontWeight: "800" },
  passwordField: { marginTop: 0 },
  progress: { gap: 10, paddingBottom: 4 },
  progressTrack: { height: 8, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  progressStep: { fontSize: 12, fontWeight: "700", textAlign: "center", letterSpacing: 0.2 },
  progressList: { gap: 9, marginTop: 4 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressIcon: { width: 22, alignItems: "center" },
  progressLabel: { flex: 1, fontSize: 14, lineHeight: 19 },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  actionCancel: { flex: 1 },
  actionConfirm: { flex: 1.25 },
  action: {
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontSize: 15.5, fontWeight: "800" },
});
