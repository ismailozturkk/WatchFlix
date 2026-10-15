// components/SwitchToggle.js
//
// iOS'ta SİSTEM anahtarı (UISwitch): iOS 26+'da Liquid Glass başparmağı ve sistemin
// kendi yay animasyonu/haptiği otomatik gelir; iOS 18–25'te klasik iOS anahtarı.
// Diğer platformlarda (Android) aşağıdaki özel animasyonlu anahtar çizilir.
//
// Native anahtar sabit 51×31 pt; çağıranların yerleşimi `size`a göre kurulu
// (genişlik size×1.61, yükseklik size) olduğundan anahtar o kutuya ölçeklenir.
// Başparmak rengi (`knobColor`) BİLEREK uygulanmaz: renk verilirse sistem cam
// başparmağı düz renge çevirir.
import React, { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Switch, View } from "react-native";
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

// Native UISwitch'in doğal yüksekliği (pt).
const NATIVE_SWITCH_HEIGHT = 31;
// `Platform` yoksa (react-native'i kısmen taklit eden testler) özel anahtara düş.
const USE_NATIVE_SWITCH = Platform?.OS === "ios";

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
  return (
    <View
      style={[
        styles.nativeBox,
        // Kilitli anahtar soluk durur ama basılabilir görünmeye devam eder.
        { width: size * 1.61, height: size, opacity: locked ? 0.6 : 1 },
      ]}
    >
      <Switch
        value={!!value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: offColor, true: onColor }}
        ios_backgroundColor={offColor}
        style={{ transform: [{ scale: size / NATIVE_SWITCH_HEIGHT }] }}
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
  nativeBox: { alignItems: "center", justifyContent: "center" },
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

