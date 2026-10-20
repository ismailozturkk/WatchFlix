// components/modals/createPost/LeaveSheet.js
//
// "Paylaşımı bırak?" / "Değişiklikleri iptal et?" onayı. Görünüşü AppAlert ile
// aynı dilde (ikon dairesi, başlık, mesaj, dolu düğmeler) ama BİR NATIVE PENCERE
// DEĞİL — pencerenin kendi görünümünün içinde çizilen bir katman.
//
// NEDEN: Eskiden burada `appAlert` çağrılıyordu. O, uygulama kökündeki
// AppAlertHost'un BottomSheetModal'ı: yani CreatePostModal zaten açıkken ikinci,
// KÖKE bağlı bir native Modal. iOS böyle bir pencereyi sunamaz (UIKit "already
// presenting" der, pencere hiç çizilmez), ama React onu açık sanır:
//   • çarpıya basınca hiçbir şey olmaz,
//   • AppAlertHost "görünür" kalır, uygulamanın GERİ KALANINDAKİ tüm uyarılar
//     da sıraya girip hiç gösterilmez → uygulama donmuş gibi davranır.
// Katman aynı native pencerenin içinde olduğu için böyle bir yarış yoktur.
// Bkz. memory/ios-modal-sequencing.md ve components/common/BottomSheetModal.js.
//
// Düğmeler yukarıdan aşağıya verilen sırayla dizilir. Boşluğa dokunmak ve
// donanım geri tuşu `onDismiss` (= "Vazgeç") çağırır.

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alpha } from "../../../theme/colors";
import { DANGER } from "./ComposerParts";

/**
 * @param {object} props
 * @param {object} props.theme
 * @param {string} props.accent                         Birincil düğme / ikon rengi.
 * @param {string} props.title
 * @param {string} [props.message]
 * @param {Array<{key:string,label:string,icon?:string,tone?:"primary"|"danger"|"neutral",onPress:()=>void}>} props.actions
 * @param {() => void} props.onDismiss
 */
export default function LeaveSheet({ theme, accent, title, message, actions, onDismiss }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [48, 0] });

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Animated.View style={[styles.dim, { opacity: progress }]}>
        {/* Boşluğa dokunma yalnız görme/dokunma kolaylığı: ekran okuyucu için
            aynı işi yapan gerçek "İptal" düğmesi var, ikinci bir etiket çıkmasın. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessible={false}
          importantForAccessibility="no"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.primary,
            borderColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 12) + 14,
            opacity: progress,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.border }]} />

        <LinearGradient colors={[accent, alpha(accent, 0.75)]} style={styles.iconCircle}>
          <Ionicons name="help-circle-outline" size={28} color="#FFFFFF" />
        </LinearGradient>

        <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
        {message ? (
          <Text style={[styles.message, { color: theme.text.secondary }]}>{message}</Text>
        ) : null}

        <View style={styles.buttons}>
          {actions.map((action) => {
            const tone = action.tone || "neutral";
            const solid = tone === "primary" ? accent : tone === "danger" ? DANGER : null;
            const fg = solid ? "#FFFFFF" : theme.text.secondary;
            return (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.btn,
                  solid
                    ? { backgroundColor: solid, borderColor: solid }
                    : { backgroundColor: theme.secondary, borderColor: theme.border },
                  { opacity: pressed ? 0.72 : 1 },
                ]}
              >
                {action.icon ? <Ionicons name={action.icon} size={17} color={fg} /> : null}
                <Text style={[styles.btnText, { color: fg }]}>{action.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Modal'ın tüm yüzeyini kaplar; en üstte çizilir (bkz. CreatePostModal).
  root: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
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
  buttons: { gap: 10, marginTop: 20 },
  btn: {
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
  btnText: { fontSize: 14.5, fontWeight: "800" },
});
