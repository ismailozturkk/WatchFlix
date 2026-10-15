// components/SwitchToggle.js
//
// iOS'ta SİSTEM anahtarı (UISwitch): iOS 26+'da Liquid Glass başparmağı ve sistemin
// kendi yay animasyonu/haptiği otomatik gelir; iOS 18–25'te klasik iOS anahtarı.
// Diğer platformlarda (Android) aşağıdaki özel animasyonlu anahtar çizilir.
//
// Sistem anahtarının boyu sürüme göre değişir (iOS ≤25: 51×31, iOS 26+: ≈63×28,
// belirgin biçimde daha geniş). Kutu bu yüzden SABİT `size×1.61` değil, anahtarın
// gerçek (ölçekli) boyudur: `onLayout` ile okunur, `utils/nativeSwitchLayout` hem
// yüksekliğe hem genişlik bütçesine (size×1.75) sığacak ölçeği seçer. Çağıranlar
// anahtarı "kendi genişliğinde bir kardeş" olarak yerleştirir; metin tarafı
// `flex:1` ile kalan boşluğa sığar (bkz. ProfileLists, SettingRow).
// Başparmak rengi (`knobColor`) BİLEREK uygulanmaz: renk verilirse sistem cam
// başparmağı düz renge çevirir.
import React, { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Switch, View } from "react-native";
import {
  guessNativeSwitchBox,
  iosMajorVersion,
  planNativeSwitch,
  sameSwitchBox,
} from "../utils/nativeSwitchLayout";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from "react-native-reanimated";

const TOGGLE_SPRING = {
  mass: 0.5,
  damping: 12,
  stiffness: 180,
  overshootClamping: false,
};

const PRESS_SPRING = {
  mass: 0.35,
  damping: 10,
  stiffness: 280,
  overshootClamping: false,
};

// `Platform` yoksa (react-native'i kısmen taklit eden testler) özel anahtara düş.
const USE_NATIVE_SWITCH = Platform?.OS === "ios";

// Sistem anahtarının yerleşim kutusu cihaz başına sabit: ilk ölçüm sonrası tüm
// anahtarlar (ve sonraki ekranlar) doğru kutuyla İLK karede başlasın diye saklanır.
let measuredNativeBox = null;
const initialNativeBox = () =>
  measuredNativeBox ?? guessNativeSwitchBox(iosMajorVersion(Platform?.Version));

export default function SwitchToggle(props) {
  return USE_NATIVE_SWITCH ? <NativeSwitchToggle {...props} /> : <AnimatedSwitchToggle {...props} />;
}

function NativeSwitchToggle({
  value = false,
  onValueChange = () => {},
  size = 36,
  onColor = "#93ffaae0",
  offColor = "#cacacaad",
  disabled = false,
  locked = false,
  onLockedPress,
}) {
  const [nativeBox, setNativeBox] = useState(initialNativeBox);
  // `onLayout` dönüşümden ÖNCEKİ (ölçeksiz) kutuyu verir: sistemin gerçek boyu.
  const handleSwitchLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    const next = { width, height };
    measuredNativeBox = next;
    setNativeBox((prev) => (sameSwitchBox(prev, next) ? prev : next));
  }, []);
  const plan = planNativeSwitch({ size, native: nativeBox });

  return (
    <View
      style={[
        styles.nativeBox,
        // Kilitli anahtar soluk durur ama basılabilir görünmeye devam eder.
        { width: plan.width, height: plan.boxHeight, opacity: locked ? 0.6 : 1 },
      ]}
    >
      <Switch
        value={!!value}
        onValueChange={onValueChange}
        onLayout={handleSwitchLayout}
        disabled={disabled}
        trackColor={{ false: offColor, true: onColor }}
        ios_backgroundColor={offColor}
        // RN `Switch`e `alignSelf:flex-start` ekler; ölçek anahtarın KENDİ merkezinden
        // olduğundan sola yaslı bırakmak görüntüyü kutunun soluna kaydırır.
        style={{ alignSelf: "center", transform: [{ scale: plan.scale }] }}
        accessibilityRole="switch"
        accessibilityState={{ checked: !!value, disabled }}
      />
      {/* Kilitliyken anahtar OYNAMAZ: dokunuşu şeffaf katman yakalayıp yükseltme
          sayfasına yollar (özel anahtardaki `locked` davranışının aynısı). */}
      {locked && !disabled ? (
        <Pressable
          onPress={onLockedPress}
          style={StyleSheet.absoluteFill}
          accessibilityRole="switch"
          accessibilityState={{ checked: !!value, disabled }}
        />
      ) : null}
    </View>
  );
}

function AnimatedSwitchToggle({
  value = false,
  onValueChange = () => {},
  size = 36,
  onColor = "#93ffaae0",
  offColor = "#cacacaad",
  knobColor = "#FFF",
  disabledColor = "#757575ad",
  disabled = false,
  locked = false,
  onLockedPress,
}) {
  // Reanimated shared value: represents 0 for off, 1 for on
  const progress = useSharedValue(value ? 1 : 0);
  const pressed = useSharedValue(0);

  // Sync state changes from parents to the shared value via Spring animation
  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, TOGGLE_SPRING);
  }, [value, progress]);

  // `locked`: özellik bu planda kapalı (ör. Premium'a özel ayar). `disabled`ten
  // farkı: dokunuş yutulmaz, `onLockedPress`e (yükseltme sayfası) gider. Asıl
  // önemlisi iyimser animasyon HİÇ başlamaz: aksi halde ebeveyn değeri
  // değiştirmeyince `value` aynı kalır, yukarıdaki efekt tetiklenmez ve anahtar
  // görsel olarak "açık"ta takılı kalırdı.
  const toggle = () => {
    if (disabled) return;
    if (locked) {
      onLockedPress?.();
      return;
    }
    const nextValue = !value;
    // Anında (optimistic) animasyonu başlat
    progress.value = withSpring(nextValue ? 1 : 0, TOGGLE_SPRING);
    // Daha sonra state'i güncelle (gecikmeyi önler)
    onValueChange(nextValue);
  };

  const handlePressIn = () => {
    if (!disabled) pressed.value = withSpring(1, PRESS_SPRING);
  };

  const handlePressOut = () => {
    pressed.value = withSpring(0, PRESS_SPRING);
  };

  // Switch Track style (Background color animation)
  const trackAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      [offColor, onColor]
    );

    return {
      backgroundColor: disabled ? disabledColor : backgroundColor,
      // Kilitli anahtar soluk durur ama basılabilir görünmeye devam eder:
      // dokununca yükseltme sayfası açılıyor, ölü bir düğme değil.
      opacity: disabled ? 0.72 : locked ? 0.6 : 1,
      transform: [{ scale: 1 - pressed.value * 0.035 }],
    };
  });

  // iOS anahtarı gibi knob hareket sırasında hafifçe uzar; basışta da büyür.
  const knobAnimatedStyle = useAnimatedStyle(() => {
    const translateMax = size * 0.61;
    const clampedProgress = Math.max(0, Math.min(1, progress.value));
    const travelStretch =
      1 + (1 - Math.abs(clampedProgress * 2 - 1)) * 0.13;
    const pressScale = 1 + pressed.value * 0.07;

    return {
      transform: [
        {
          translateX: progress.value * translateMax + 2,
        },
        { scaleX: travelStretch * pressScale },
        { scaleY: pressScale },
      ],
    };
  });

  return (
    <Pressable
      onPress={toggle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value, disabled }}
    >
      <Animated.View
        style={[
          styles.track,
          {
            width: size * 1.61,
            height: size,
            borderRadius: size / 2,
          },
          trackAnimatedStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.knob,
            {
              width: size - 4,
              height: size - 4,
              borderRadius: (size - 4) / 2,
              backgroundColor: knobColor,
            },
            knobAnimatedStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // `flexShrink:0`: kutu anahtarın gerçek boyudur; sıkışan satırda anahtar
  // değil metin daralmalı (taşan anahtar kartın kenarına biner).
  nativeBox: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
  track: {
    justifyContent: "center",
    padding: 0,
  },
  knob: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2.5,
    elevation: 3,
  },
});

