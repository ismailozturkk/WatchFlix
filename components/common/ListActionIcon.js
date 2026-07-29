// components/common/ListActionIcon.js
//
// Liste eylem ikonu (favori / izleme listesi / izlendi / hatırlatıcı) —
// AÇIK↔KAPALI geçişini animasyonlu yapar.
//
// NEDEN VAR: eskiden durum değişimi `name={aktif ? "heart" : "heart-outline"}`
// ile ANINDA takla atıyordu. Basıldığında tek animasyon butonun tamamının
// hafifçe zıplamasıydı; asıl anlamlı an — içeriğin listeye GİRMESİ — hiçbir
// görsel karşılık bulmuyordu. Kullanıcı da dokunuşun işe yarayıp yaramadığını
// yalnız ikonun sıçramasından anlıyordu.
//
// Şimdi:
//   • içi boş ikon küçülüp solar, dolu ikon yaydan fırlayarak (overshoot)
//     büyür → "yerleşti" hissi,
//   • ekleme anında ikonun arkasından bir halka açılıp söner (burst),
//   • ÇIKARMA aynı animasyonun tersi DEĞİL: yaysız, daha hızlı ve sönük —
//     eklemekle çıkarmak aynı hissi vermemeli.
//
// Tüm animasyonlar `useNativeDriver` ile UI thread'inde çalışır (opacity +
// transform); JS thread'i listeler kaydırılırken bile animasyonu düşürmez.
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

// Ekleme: düşük damping = belirgin overshoot (yaydan fırlama).
const SPRING_IN = { mass: 1, stiffness: 230, damping: 11, useNativeDriver: true };
// Çıkarma: yüksek damping = zıplama yok, kararlı ve hızlı sönüm.
const SPRING_OUT = { mass: 1, stiffness: 280, damping: 20, useNativeDriver: true };

const BURST_DURATION = 460;

/**
 * @param {boolean}  active        durum (listede mi)
 * @param {any}      IconSet       Ionicons | MaterialCommunityIcons …
 * @param {string}   activeName    dolu ikon adı
 * @param {string}   inactiveName  içi boş ikon adı
 * @param {string}   activeColor   dolu renk
 * @param {string}   inactiveColor pasif renk
 * @param {number}   size          ikon boyutu (px)
 * @param {string}   [burstColor]  halka rengi (varsayılan activeColor)
 * @param {any}      [pulseKey]    AKTİFKEN değişirse küçük bir vurgu yapar —
 *   ör. dizi "kısmen izlendi" → "tamamen izlendi" geçişinde ikon aynı kalır
 *   ama durum değişir; bu olmadan geçiş sessiz kalırdı.
 */
function ListActionIcon({
  active,
  IconSet = Ionicons,
  activeName,
  inactiveName,
  activeColor,
  inactiveColor,
  size = 30,
  burstColor,
  pulseKey,
}) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  // İlk render'da animasyon YOK: ekran açılırken zaten listede olan içeriğin
  // kalbi patlayarak belirirse her giriş kutlama gibi görünür.
  const mounted = useRef(false);
  const pulseMounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return undefined;
    }
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      ...(active ? SPRING_IN : SPRING_OUT),
    }).start();

    if (active) {
      burst.setValue(0);
      Animated.timing(burst, {
        toValue: 1,
        duration: BURST_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    return undefined;
  }, [active, progress, burst]);

  // Aktif kalırken alt-durum değişimi (renk/ikon aynı kalsa bile).
  useEffect(() => {
    if (!pulseMounted.current) {
      pulseMounted.current = true;
      return undefined;
    }
    if (!active) return undefined;
    progress.setValue(0.8);
    Animated.spring(progress, { toValue: 1, ...SPRING_IN }).start();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseKey]);

  // İçi boş ikon: yarı yolda tamamen solar, bu sırada küçülür.
  const inactiveOpacity = progress.interpolate({
    inputRange: [0, 0.55],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const inactiveScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.55],
    extrapolate: "clamp",
  });

  // Dolu ikon: geç belirir, erken büyür. `extrapolate` SERBEST bırakıldı —
  // yay 1'i aştığında ölçek de 1'i aşsın (asıl "pop" hissi buradan gelir).
  const activeOpacity = progress.interpolate({
    inputRange: [0.15, 0.7],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const activeScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });

  const burstScale = burst.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1.95],
  });
  const burstOpacity = burst.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 0.45, 0],
  });

  const box = { width: size, height: size };

  return (
    <View style={[styles.wrap, box]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.burst,
          box,
          {
            borderRadius: size / 2,
            borderColor: burstColor || activeColor,
            opacity: burstOpacity,
            transform: [{ scale: burstScale }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.layer,
          { opacity: inactiveOpacity, transform: [{ scale: inactiveScale }] },
        ]}
      >
        <IconSet name={inactiveName} size={size} color={inactiveColor} />
      </Animated.View>

      <Animated.View
        style={[
          styles.layer,
          { opacity: activeOpacity, transform: [{ scale: activeScale }] },
        ]}
      >
        <IconSet name={activeName} size={size} color={activeColor} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  burst: {
    position: "absolute",
    borderWidth: 2,
  },
});

export default React.memo(ListActionIcon);
