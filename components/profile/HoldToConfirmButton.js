// components/profile/HoldToConfirmButton.js
//
// "Basılı tutarak onayla" düğmesi — hesap silme / sıfırlama gibi geri alınamaz
// işlemlerin son adımı. Parmak düğmenin üstünde durdukça düğme soldan sağa bir
// ilerleme çubuğu gibi dolar (`holdMs` sürede); dolunca `onConfirm` BİR kez
// çalışır. Süre dolmadan bırakılırsa çubuk geri çekilir ve hiçbir şey olmaz —
// kazara dokunuş bu yüzden hiçbir şeyi silemez.
//
// Görünüm: boşken kırmızı tonlu yüzey + kırmızı yazı; dolan kısım düz kırmızı + beyaz
// yazı (aynı yazı iki katman: dolan katman kırpılır, yazı tam genişlikte kalır).
//
// Erişilebilirlik: basılı tutmak ekran okuyucu kullanan biri için engeldir; bu
// yüzden "activate" erişilebilirlik eylemi onayı doğrudan verir (parmakla dokunma
// ise yine basılı tutmayı ister). Normal dokunuş `onPress` kullanmaz — kısa bir
// dokunuş onay SAYILMAZ.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "../../services/hapticsService";
import { alpha } from "../../theme/colors";

const RELEASE_MS = 220;

export default function HoldToConfirmButton({
  label,
  holdLabel,
  hint,
  holdMs = 2000,
  color,
  disabled = false,
  busy = false,
  canStart,
  onConfirm,
  style,
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const holding = useRef(false);
  const fired = useRef(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(false);

  const reset = useCallback(
    (animated) => {
      progress.stopAnimation();
      if (animated) {
        Animated.timing(progress, {
          toValue: 0,
          duration: RELEASE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      } else {
        progress.setValue(0);
      }
    },
    [progress],
  );

  // Onaylandıktan sonra düğmeyi yeniden basılabilir kılar. Parmak o anda hâlâ üstündeyse
  // (dolum parmak basılıyken biter) `holding` de bırakılır: sonraki onPressOut zararsız,
  // yeni basış yeni bir tur başlatır.
  const rearm = useCallback(() => {
    fired.current = false;
    holding.current = false;
    setActive(false);
    reset(true);
  }, [reset]);

  // İşlem bitti (hata ile geri döndü) → düğme yeniden basılabilir olsun.
  useEffect(() => {
    if (!busy && fired.current) rearm();
  }, [busy, rearm]);

  const confirm = useCallback(() => {
    fired.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    onConfirm?.();
    // onConfirm hiçbir işlem başlatmadıysa (busy hiç açılmadıysa) çubuk dolu kalmasın.
    setTimeout(() => {
      if (!busyRef.current && fired.current) rearm();
    }, 700);
  }, [onConfirm, rearm]);

  const onPressIn = () => {
    if (disabled || busy || fired.current) return;
    if (canStart && !canStart()) return;
    holding.current = true;
    setActive(true);
    progress.stopAnimation((value) => {
      Animated.timing(progress, {
        toValue: 1,
        duration: Math.max(1, holdMs * (1 - (value || 0))),
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && holding.current && !fired.current) confirm();
      });
    });
  };

  const onPressOut = () => {
    if (!holding.current) return;
    holding.current = false;
    setActive(false);
    if (!fired.current) reset(true);
  };

  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [0, width] });
  const idleText = active ? holdLabel || label : label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: disabled || busy, busy }}
      accessibilityActions={[{ name: "activate", label }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName !== "activate") return;
        if (disabled || busy || fired.current) return;
        if (canStart && !canStart()) return;
        confirm();
      }}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        styles.root,
        {
          backgroundColor: alpha(color, 0.14),
          borderColor: alpha(color, 0.55),
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {/* Dolan katman: kırpılır, yazı tam genişlikte kaldığı için dolgunun üstünde beyaz görünür. */}
      <Animated.View pointerEvents="none" style={[styles.fill, { width: fillWidth, backgroundColor: color }]}>
        <View style={[styles.fillLabel, { width }]}>
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.text, { color: "#fff" }]}>
              {idleText}
            </Text>
          )}
        </View>
      </Animated.View>
      <View pointerEvents="none" style={styles.label}>
        {busy ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.text, { color }]}>
            {idleText}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
  },
  fillLabel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  label: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  text: { fontSize: 15.5, fontWeight: "800" },
});
