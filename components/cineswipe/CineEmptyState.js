// components/cineswipe/CineEmptyState.js
//
// CineSwipe'ın tüm "kart yok" durumlarının ortak yüzü: hata, sonuç yok, deste
// bitti, kazanan, oda bitti… İkon yavaşça süzülür, içerik aşağıdan belirir.
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import AppIcon from "../AppIcon";
import PressableScale from "./PressableScale";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";

/**
 * @param {string} icon
 * @param {string} [tint]
 * @param {string} title
 * @param {string} [body]
 * @param {boolean} [loading]  İkon yerine dönen gösterge.
 * @param {Array<{ key: string, label: string, icon?: string, onPress: () => void,
 *   variant?: "primary"|"secondary", tint?: string }>} [actions]
 */
export default function CineEmptyState({
  icon,
  iconFamily = "Ionicons",
  tint,
  title,
  body,
  loading = false,
  floating = true,
  actions = [],
  colors,
  style,
}) {
  const float = useSharedValue(0);

  useEffect(() => {
    if (!floating || loading) return undefined;
    float.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(float);
  }, [floating, loading, float]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -7 * float.value }] }));
  const color = tint || colors.accent;

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={[styles.wrap, style]}>
      <Animated.View style={[styles.iconCircle, { backgroundColor: alpha(color, 0.14) }, iconStyle]}>
        {loading ? (
          <ActivityIndicator size="large" color={color} />
        ) : (
          <AppIcon family={iconFamily} name={icon} size={48} color={color} />
        )}
      </Animated.View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text> : null}
      {actions.length ? (
        <View style={styles.actions}>
          {actions.map((action) => {
            const primary = action.variant !== "secondary";
            const actionColor = action.tint || colors.accent;
            return (
              <PressableScale
                key={action.key}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => {
                  triggerHaptic("selection");
                  action.onPress();
                }}
                style={[
                  styles.action,
                  primary
                    ? { backgroundColor: actionColor }
                    : { backgroundColor: alpha(colors.surface, 0.8), borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                {action.icon ? (
                  <AppIcon
                    family="Ionicons"
                    name={action.icon}
                    size={18}
                    color={primary ? colors.onAccent : colors.text}
                  />
                ) : null}
                <Text style={[styles.actionText, { color: primary ? colors.onAccent : colors.text }]}>
                  {action.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    gap: 10,
    marginTop: 12,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 16,
    paddingHorizontal: 18,
  },
  actionText: {
    fontSize: 14.5,
    fontWeight: "800",
  },
});
