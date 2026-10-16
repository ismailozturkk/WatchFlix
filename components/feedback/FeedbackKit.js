// components/feedback/FeedbackKit.js
//
// Geri bildirim ekranının (Ayarlar > Destek ve geri bildirim) görsel parçaları.
// Ekran mantığı screens/tabs/settings/FeedbackScreen.js'te; burada yalnız çizim
// var, veri/ağ yok. İki tür (hata bildirimi / özellik isteği) AYNI parçaları
// kullanır, farkı `tint` (vurgu rengi) ve metinler yaratır.
//
// KURALLAR
//  • Vurgu rengi üstündeki yazı/ikon BEYAZ (açık temada da okunur).
//  • Satır içi eşit bölüşen kutularda `flex: 1` yalnız ANA EKSEN genişlikse kullanılır
//    (otomatik yükseklikli kapta dikey `flex: 1` cihazda çöker; bkz. yoga-layout-harness).
//  • Girişte kayma/solma RN Animated ile (Reanimated ilk değeri geri yazma tuzağı yok).

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import SwitchToggle from "@components/SwitchToggle";
import { alpha } from "../../theme/colors";

const WHITE = "#FFFFFF";

/** Durum → renk anahtarı (palet `buildUiColors`ta) ve ikon. */
export const STATUS_LOOK = Object.freeze({
  open: { tone: "blue", icon: "mail-open-outline" },
  reviewing: { tone: "amber", icon: "eye-outline" },
  planned: { tone: "purple", icon: "calendar-outline" },
  done: { tone: "green", icon: "checkmark-circle" },
  declined: { tone: "muted", icon: "close-circle-outline" },
});

/** Şiddet → renk anahtarı. */
export const SEVERITY_TONE = Object.freeze({ minor: "green", annoying: "amber", blocking: "danger" });

/** Kategori → ikon (hata + özellik kategorileri tek tabloda; kimlikler çakışmaz, "other" ortak). */
export const CATEGORY_ICON = Object.freeze({
  crash: "alert-circle-outline",
  display: "phone-portrait-outline",
  data: "stats-chart-outline",
  notifications: "notifications-outline",
  performance: "speedometer-outline",
  discover: "compass-outline",
  lists: "albums-outline",
  social: "people-outline",
  ai: "sparkles-outline",
  design: "color-palette-outline",
  other: "ellipsis-horizontal-circle-outline",
});

/**
 * Okunması GEREKEN ikincil metin (açıklama, ipucu, özet). `C.muted` açık temada
 * ~2.3:1 kontrastta kalıyor; bu, metnin %72 opaklığı: koyuda yumuşak beyaz,
 * açıkta koyu gri. Etiket/sayaç gibi dekoratif küçük metinler `C.muted` kalır.
 */
const soft = (C) => alpha(C.text, 0.72);

const tone = (C, key) => (key === "muted" ? C.muted : C[key] || C.accent);

/** Mount'ta hafifçe yukarı kayarak beliren sarmalayıcı. */
export function FadeIn({ delay = 0, style, children }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function Pill({ icon, label, color, textColor, soft }) {
  return (
    <View
      style={[
        k.pill,
        {
          backgroundColor: alpha(color, soft ? 0.1 : 0.16),
          borderColor: alpha(color, soft ? 0.24 : 0.42),
        },
      ]}
    >
      <AppIcon family="Ionicons" name={icon} size={11} color={textColor || color} />
      <Text allowFontScaling={false} numberOfLines={1} style={[k.pillText, { color: textColor || color }]}>
        {label}
      </Text>
    </View>
  );
}

/** Üstteki tanıtım kartı: büyük ikon, başlık, açıklama ve iki küçük hap. */
export function FeedbackHero({ C, tint, icon, title, text, planLabel, benefit, benefitIcon }) {
  return (
    <View style={[k.hero, { borderColor: alpha(tint, 0.4) }]}>
      <LinearGradient
        colors={[alpha(tint, 0.26), alpha(tint, 0.04)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={k.heroInner}
      >
        {/* Süs: köşede büyük, silik ikon. Dokunmayı ve okumayı etkilemez. */}
        <View pointerEvents="none" style={k.heroWatermark}>
          <AppIcon family="Ionicons" name={icon} size={132} color={alpha(tint, 0.12)} />
        </View>
        <View style={k.heroTop}>
          <View style={[k.heroIcon, { backgroundColor: tint, shadowColor: tint }]}>
            <AppIcon family="Ionicons" name={icon} size={26} color={WHITE} />
          </View>
          <View style={k.heroCopy}>
            <Text allowFontScaling={false} style={[k.heroTitle, { color: C.text }]}>
              {title}
            </Text>
            <Text allowFontScaling={false} style={[k.heroText, { color: soft(C) }]}>
              {text}
            </Text>
          </View>
        </View>
        <View style={k.pillRow}>
          <Pill icon="diamond" label={planLabel} color={tint} />
          <Pill icon={benefitIcon} label={benefit} color={C.muted} textColor={soft(C)} soft />
        </View>
      </LinearGradient>
    </View>
  );
}

/** Alan başlığı (küçük, büyük harf) + sağda isteğe bağlı sayaç. */
export function FieldLabel({ C, children, right, rightColor }) {
  return (
    <View style={k.labelRow}>
      <Text allowFontScaling={false} style={[k.label, { color: C.muted }]}>
        {children}
      </Text>
      {right ? (
        <Text allowFontScaling={false} style={[k.counter, { color: rightColor || C.muted }]}>
          {right}
        </Text>
      ) : null}
    </View>
  );
}

/** Tek seçimli hap grubu (kategori). */
export function ChipGroup({ C, tint, options, value, onChange }) {
  return (
    <View style={k.chips}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <TouchableOpacity
            key={option.id}
            activeOpacity={0.75}
            onPress={() => onChange(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={[
              k.chip,
              {
                backgroundColor: active ? alpha(tint, 0.16) : C.cardAlt,
                borderColor: active ? tint : C.borderMuted,
              },
            ]}
          >
            <AppIcon
              family="Ionicons"
              name={option.icon}
              size={14}
              color={active ? tint : C.muted}
            />
            <Text
              allowFontScaling={false}
              style={[
                k.chipText,
                { color: active ? C.text : soft(C), fontWeight: active ? "700" : "600" },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Üçlü şiddet seçici: renkli nokta + ad + tek satır ipucu. */
export function SeverityRail({ C, options, value, onChange }) {
  return (
    <View style={k.severityRow}>
      {options.map((option) => {
        const active = option.id === value;
        const color = tone(C, SEVERITY_TONE[option.id]);
        return (
          <TouchableOpacity
            key={option.id}
            activeOpacity={0.75}
            onPress={() => onChange(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${option.label}. ${option.hint}`}
            style={[
              k.severity,
              {
                backgroundColor: active ? alpha(color, 0.14) : C.cardAlt,
                borderColor: active ? color : C.borderMuted,
              },
            ]}
          >
            <View style={k.severityTop}>
              <View style={[k.dot, { backgroundColor: color, opacity: active ? 1 : 0.55 }]} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[k.severityName, { color: active ? C.text : soft(C) }]}
              >
                {option.label}
              </Text>
            </View>
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={[k.severityHint, { color: soft(C) }]}
            >
              {option.hint}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Odakta vurgu renginde çerçeve alan; çok satırlı olabilir. */
export function TextField({
  C,
  tint,
  value,
  onChangeText,
  placeholder,
  maxLength,
  multiline,
  minHeight,
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        k.field,
        {
          backgroundColor: C.cardAlt,
          borderColor: focused ? tint : C.borderMuted,
        },
      ]}
    >
      <TextInput
        allowFontScaling={false}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={alpha(C.muted, 0.8)}
        maxLength={maxLength}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        selectionColor={tint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          k.input,
          { color: C.text },
          multiline && { minHeight, paddingTop: 12 },
        ]}
      />
    </View>
  );
}

/** "Cihaz bilgisini ekle" satırı: anahtar + gönderilecek özet satırı. */
export function DeviceCard({ C, tint, enabled, onToggle, title, line, hint }) {
  return (
    <View style={[k.device, { backgroundColor: C.cardAlt, borderColor: C.borderMuted }]}>
      <View style={k.deviceTop}>
        <View style={[k.deviceIcon, { backgroundColor: alpha(tint, 0.14) }]}>
          <AppIcon family="Ionicons" name="hardware-chip-outline" size={16} color={tint} />
        </View>
        <View style={k.deviceCopy}>
          <Text allowFontScaling={false} style={[k.deviceTitle, { color: C.text }]}>
            {title}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[k.deviceLine, { color: enabled ? tint : soft(C) }]}
          >
            {enabled ? line : hint}
          </Text>
        </View>
        <SwitchToggle value={enabled} onValueChange={onToggle} size={36} />
      </View>
    </View>
  );
}

/** Ana gönder düğmesi: hazırken vurgu degradesi, değilken soluk + neden altta. */
export function SubmitButton({ C, tint, label, busy, disabled, hint, onPress }) {
  const inactive = disabled || busy;
  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={inactive}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ disabled: inactive, busy: Boolean(busy) }}
        accessibilityLabel={label}
        style={[k.submit, disabled && !busy && { backgroundColor: C.closeBg }]}
      >
        {disabled && !busy ? null : (
          <LinearGradient
            colors={[tint, alpha(tint, 0.78)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {busy ? (
          <ActivityIndicator size="small" color={WHITE} />
        ) : (
          <AppIcon
            family="Ionicons"
            name="paper-plane"
            size={16}
            color={disabled ? C.muted : WHITE}
          />
        )}
        <Text
          allowFontScaling={false}
          style={[k.submitText, { color: disabled && !busy ? C.muted : WHITE }]}
        >
          {label}
        </Text>
      </TouchableOpacity>
      {hint ? (
        <Text allowFontScaling={false} style={[k.submitHint, { color: soft(C) }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Gönderim sonrası form yerine çıkan teşekkür kartı. */
export function SentCard({ C, title, text, actionLabel, onAction }) {
  return (
    <FadeIn>
      <View style={[k.sent, { backgroundColor: C.card, borderColor: alpha(C.green, 0.45) }]}>
        <View style={[k.sentBadge, { backgroundColor: alpha(C.green, 0.16) }]}>
          <View style={[k.sentCheck, { backgroundColor: C.green }]}>
            <AppIcon family="Ionicons" name="checkmark" size={26} color={WHITE} />
          </View>
        </View>
        <Text allowFontScaling={false} style={[k.sentTitle, { color: C.text }]}>
          {title}
        </Text>
        <Text allowFontScaling={false} style={[k.sentText, { color: soft(C) }]}>
          {text}
        </Text>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={onAction}
          accessibilityRole="button"
          style={[k.sentAction, { backgroundColor: C.cardAlt, borderColor: C.border }]}
        >
          <AppIcon family="Ionicons" name="add" size={16} color={C.text} />
          <Text allowFontScaling={false} style={[k.sentActionText, { color: C.text }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </FadeIn>
  );
}

/** Durum hapı: "Alındı", "İnceleniyor"… */
export function StatusChip({ C, status, label }) {
  const look = STATUS_LOOK[status] || STATUS_LOOK.open;
  const color = tone(C, look.tone);
  return (
    <View
      style={[k.status, { backgroundColor: alpha(color, 0.14), borderColor: alpha(color, 0.38) }]}
    >
      <AppIcon family="Ionicons" name={look.icon} size={11} color={color} />
      <Text allowFontScaling={false} numberOfLines={1} style={[k.statusText, { color }]}>
        {label}
      </Text>
    </View>
  );
}

/** "Gönderdiklerim" satırı: kategori ikonu, başlık, durum hapı, özet ve varsa yanıt. */
export function HistoryItem({ C, tint, copy, item, dateLabel, categoryLabel }) {
  const icon = CATEGORY_ICON[item.category] || CATEGORY_ICON.other;
  return (
    <View style={[k.history, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={k.historyTop}>
        <View style={[k.historyIcon, { backgroundColor: alpha(tint, 0.14) }]}>
          <AppIcon family="Ionicons" name={icon} size={16} color={tint} />
        </View>
        <View style={k.historyCopy}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[k.historyTitle, { color: C.text }]}
          >
            {item.title}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[k.historyMeta, { color: soft(C) }]}
          >
            {[categoryLabel, dateLabel].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <StatusChip C={C} status={item.status} label={copy.statuses[item.status]} />
      </View>
      {item.message ? (
        <Text
          allowFontScaling={false}
          numberOfLines={3}
          style={[k.historyMessage, { color: soft(C) }]}
        >
          {item.message}
        </Text>
      ) : null}
      {item.reply ? (
        <View style={[k.reply, { backgroundColor: alpha(tint, 0.1) }]}>
          <View style={[k.replyBar, { backgroundColor: tint }]} />
          <View style={k.replyCopy}>
            <Text allowFontScaling={false} style={[k.replyLabel, { color: tint }]}>
              {copy.common.reply}
            </Text>
            <Text allowFontScaling={false} style={[k.replyText, { color: C.text }]}>
              {item.reply}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Boş geçmiş / yükleme hatası kutusu. */
export function HistoryNotice({ C, icon, title, text, actionLabel, onAction }) {
  return (
    <View style={[k.notice, { borderColor: C.border }]}>
      <View style={[k.noticeIcon, { backgroundColor: C.closeBg }]}>
        <AppIcon family="Ionicons" name={icon} size={20} color={C.muted} />
      </View>
      <Text allowFontScaling={false} style={[k.noticeTitle, { color: C.text }]}>
        {title}
      </Text>
      {text ? (
        <Text allowFontScaling={false} style={[k.noticeText, { color: soft(C) }]}>
          {text}
        </Text>
      ) : null}
      {actionLabel ? (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={onAction}
          accessibilityRole="button"
          style={[k.noticeAction, { backgroundColor: C.accentDim }]}
        >
          <Text allowFontScaling={false} style={[k.noticeActionText, { color: C.accent }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const k = StyleSheet.create({
  hero: { borderRadius: 22, borderWidth: 1, overflow: "hidden", marginTop: 8 },
  heroInner: { padding: 16, gap: 14 },
  heroWatermark: { position: "absolute", right: -22, top: -26 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  heroText: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 11, fontWeight: "700" },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 9,
    marginHorizontal: 2,
  },
  label: { fontSize: 10.5, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase" },
  counter: { fontSize: 11, fontWeight: "600" },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1,
  },
  chipText: { fontSize: 12.5 },

  severityRow: { flexDirection: "row", gap: 8 },
  // Satır içi eşit bölüşüm: ana eksen genişlik → flex: 1 güvenli.
  severity: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 9, gap: 5 },
  severityTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  severityName: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
  severityHint: { fontSize: 10.5, lineHeight: 14 },

  field: { borderRadius: 14, borderWidth: 1.5 },
  input: { fontSize: 14.5, paddingHorizontal: 14, paddingVertical: 12, lineHeight: 20 },

  device: { borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 18 },
  deviceTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  deviceIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  deviceCopy: { flex: 1 },
  deviceTitle: { fontSize: 13.5, fontWeight: "600" },
  deviceLine: { fontSize: 11, lineHeight: 15, marginTop: 2 },

  submit: {
    height: 52,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 20,
  },
  submitText: { fontSize: 15, fontWeight: "800", letterSpacing: 0.2 },
  submitHint: { fontSize: 11.5, textAlign: "center", marginTop: 9 },

  sent: {
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 26,
    marginTop: 18,
  },
  sentBadge: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  sentCheck: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  sentTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3, marginTop: 16, textAlign: "center" },
  sentText: { fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: "center" },
  sentAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 13,
    borderWidth: 1,
    marginTop: 20,
  },
  sentActionText: { fontSize: 13.5, fontWeight: "700" },

  history: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10 },
  historyTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  historyIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  historyCopy: { flex: 1 },
  historyTitle: { fontSize: 14, fontWeight: "700" },
  historyMeta: { fontSize: 11, marginTop: 2 },
  historyMessage: { fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 120,
  },
  statusText: { fontSize: 10.5, fontWeight: "800" },
  reply: { flexDirection: "row", borderRadius: 12, overflow: "hidden", marginTop: 10 },
  replyBar: { width: 3 },
  replyCopy: { flex: 1, padding: 10, gap: 3 },
  replyLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.5 },
  replyText: { fontSize: 12.5, lineHeight: 18 },

  notice: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  noticeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  noticeTitle: { fontSize: 14, fontWeight: "700", marginTop: 12, textAlign: "center" },
  noticeText: { fontSize: 12, lineHeight: 17, marginTop: 5, textAlign: "center" },
  noticeAction: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, marginTop: 14 },
  noticeActionText: { fontSize: 12.5, fontWeight: "700" },
});
