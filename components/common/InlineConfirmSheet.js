// components/common/InlineConfirmSheet.js
//
// Açık bir Modal'ın İÇİNDE çizilen onay/seçenek katmanı. Görünüşü AppAlert ile
// aynı dilde (tutamak, ikon dairesi, başlık, mesaj, dolu düğmeler) ama BİR
// NATIVE PENCERE DEĞİL — çağıran pencerenin kendi görünüm ağacındaki en üst katman.
//
// NEDEN: `appAlert` uygulama kökündeki AppAlertHost'un BottomSheetModal'ını açar,
// yani başka bir Modal zaten açıkken KÖKE bağlı ikinci bir native pencere. iOS
// bunu sunamaz (UIKit "already presenting"), ama React onu açık sanır:
//   • düğmeye basınca hiçbir şey olmaz,
//   • AppAlertHost "görünür" kalır, uygulamanın geri kalanındaki uyarılar da
//     sıraya girip hiç gösterilmez → uygulama donmuş gibi davranır.
// Katman aynı pencerenin içinde olduğu için böyle bir yarış yoktur.
// Bkz. memory/ios-modal-sequencing.md, components/common/BottomSheetModal.js.
//
// Çoğu çağıran doğrudan değil `hooks/useInlineConfirm.js` üzerinden kullanır
// (appAlert ile aynı imza). Bu bileşen yalnız çizer; durum çağıranda.
//
// YERLEŞİM: `StyleSheet.absoluteFill` kaplar — pencerenin TAM ekran kökünün son
// çocuğu olmalı. BottomSheetModal'da `overlay` propuna verilir (sayfanın içine
// değil: orada yalnız sayfayı kaplar).
//
// HAREKET: perde yerinde solar, sayfa TAM OPAKLIKTA aşağıdan kayar (alt sayfa
// kuralı, bkz. memory/modal-blur-fade-convention.md). Sayfanın kendisine opaklık
// verilmez — cam düğmeler opaklıkla soldurulamaz.

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlassPressable from "./GlassPressable";

const DEFAULT_DANGER = "#EF4444";

/**
 * @param {object} props
 * @param {object} props.theme
 * @param {string} props.accent                 Birincil düğme rengi.
 * @param {string} props.title
 * @param {string} [props.message]
 * @param {string} [props.icon="help-circle-outline"]   Ionicons adı.
 * @param {string[]} [props.iconGradient]       Varsayılan: [accent, accent].
 * @param {string} [props.dangerColor="#EF4444"]
 * @param {boolean} [props.stacked]             Düğmeler alt alta. Varsayılan: 3+ düğmede.
 * @param {Array<{key:string,label:string,icon?:string,tone?:"primary"|"danger"|"neutral",onPress:()=>void}>} props.actions
 * @param {() => void} props.onDismiss          Boşluğa dokunma.
 */
export default function InlineConfirmSheet({
  theme,
  accent,
  title,
  message,
  icon = "help-circle-outline",
  iconGradient,
  dangerColor = DEFAULT_DANGER,
  stacked,
  actions,
  onDismiss,
}) {
  const insets = useSafeAreaInsets();
  const dim = useRef(new Animated.Value(0)).current;
  // Ölçülene kadar ekran dışında; ilk yerleşimde kendi yüksekliğinden kayar.
  const slide = useRef(new Animated.Value(Dimensions.get("window").height)).current;
  const startedRef = useRef(false);

  useEffect(() => {
    Animated.timing(dim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [dim]);

  const onSheetLayout = (e) => {
    if (startedRef.current) return;
    startedRef.current = true;
    slide.setValue(e.nativeEvent.layout.height);
    Animated.spring(slide, {
      toValue: 0,
      damping: 22,
      stiffness: 180,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const column = stacked ?? actions.length > 2;
  const accentColor = accent || theme.accent;

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Animated.View style={[styles.dim, { opacity: dim }]}>
        {/* Boşluğa dokunma yalnız görme/dokunma kolaylığı: ekran okuyucu için
            aynı işi yapan gerçek düğme var, ikinci bir etiket çıkmasın. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessible={false}
          importantForAccessibility="no"
        />
      </Animated.View>

      <Animated.View
        onLayout={onSheetLayout}
        style={[
          styles.sheet,
          {
            backgroundColor: theme.primary,
            borderColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 12) + 14,
            transform: [{ translateY: slide }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.border }]} />

        <LinearGradient
          colors={iconGradient || [accentColor, accentColor]}
          style={styles.iconCircle}
        >
          <Ionicons name={icon} size={28} color="#FFFFFF" />
        </LinearGradient>

        {title ? (
          <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]}>
            {title}
          </Text>
        ) : null}
        {message ? (
          <Text allowFontScaling={false} style={[styles.message, { color: theme.text.secondary }]}>
            {message}
          </Text>
        ) : null}

        <View style={[styles.buttons, column && styles.buttonsCol]}>
          {actions.map((action) => {
            const tone = action.tone || "neutral";
            const solid =
              tone === "primary" ? accentColor : tone === "danger" ? dangerColor : null;
            const fg = solid ? "#FFFFFF" : theme.text.secondary;
            return (
              <GlassPressable
                key={action.key}
                accessibilityRole="button"
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.btn,
                  column && styles.btnFull,
                  solid
                    ? { backgroundColor: solid, borderColor: solid }
                    : { backgroundColor: theme.secondary, borderColor: theme.border },
                  { opacity: pressed ? 0.72 : 1 },
                ]}
              >
                {action.icon ? <Ionicons name={action.icon} size={17} color={fg} /> : null}
                <Text allowFontScaling={false} style={[styles.btnText, { color: fg }]}>
                  {action.label}
                </Text>
              </GlassPressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pencerenin tüm yüzeyini kaplar; en üstte çizilir.
  root: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 1000 },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 10,
    paddingHorizontal: 20,
    alignItems: "stretch",
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    marginBottom: 16,
    opacity: 0.65,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },
  title: {
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.35,
    textAlign: "center",
  },
  message: {
    fontSize: 13.5,
    fontWeight: "500",
    lineHeight: 19.5,
    textAlign: "center",
    marginTop: 7,
    paddingHorizontal: 6,
  },
  buttons: { flexDirection: "row", gap: 10, marginTop: 20 },
  buttonsCol: { flexDirection: "column" },
  btn: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  btnFull: { flex: 0, width: "100%" },
  btnText: { fontSize: 14.5, fontWeight: "800" },
});
