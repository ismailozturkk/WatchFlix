// hooks/useKeyboardInset.js
//
// Bir <Modal> içindeki kaplayıcının altına, klavyenin ÖRTTÜĞÜ kadar boşluk
// vermek için. Ortalanmış diyaloglar (şifre soran hesap silme kutusu gibi) ve
// tam ekran arama listeleri içindir; alt sayfalar için useSheetTransition var.
//
//   const { animatedInset, onLayout } = useKeyboardInset(visible);
//   <Modal …>
//     <Animated.View
//       style={[styles.overlay, { paddingBottom: animatedInset }]}
//       onLayout={onLayout}
//     >
//
// `inset` aynı değerin sayı hâli (liste dolgusu gibi animasyonsuz yerler için);
// `animatedInset` klavyeyle birlikte kayar (JS sürücülü — düzen değeri).
//
// NEDEN KeyboardAvoidingView DEĞİL: Android'de modal penceresi klavyeye göre
// yeniden boyutlanıp boyutlanmadığı API düzeyine ve `statusBarTranslucent`e
// göre değişiyor (bkz. hooks/useSheetTransition.js; ChatModal'da KAV
// "height" modalde hiç tepki vermedi). Burada kaplayıcının klavye KAPALIYKEN
// ölçülen yüksekliği ile şimdikisi karşılaştırılır; pencere zaten küçüldüyse
// o kısım tekrar eklenmez (çift kayma olmaz). Hesap useSheetTransition ile
// aynı: utils/sheetKeyboardFit.js → keyboardLift.
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Platform } from "react-native";
import { keyboardLift } from "@utils/sheetKeyboardFit";

/**
 * @param {boolean} [active=true]  Modal ekranda mı (kapanınca sıfırlanır).
 * @returns {{
 *   inset: number,
 *   animatedInset: Animated.Value,
 *   onLayout: (event: any) => void,
 * }}
 */
export default function useKeyboardInset(active = true) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef(0);
  const baseOverlayHeight = useRef(0);
  const [overlayHeight, setOverlayHeight] = useState(0);
  const animatedInset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return undefined;
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const apply = (height) => {
      keyboardHeightRef.current = height;
      setKeyboardHeight(height);
    };
    const showSub = Keyboard.addListener(showEvent, (event) =>
      apply(event?.endCoordinates?.height ?? 0),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => apply(0));
    return () => {
      showSub.remove();
      hideSub.remove();
      apply(0);
    };
  }, [active]);

  const onLayout = useCallback((event) => {
    const measured = Math.round(event.nativeEvent.layout.height);
    if (measured <= 0) return;
    if (keyboardHeightRef.current === 0) baseOverlayHeight.current = measured;
    setOverlayHeight(measured);
  }, []);

  const inset = keyboardLift({
    keyboardHeight,
    baseOverlayHeight: baseOverlayHeight.current,
    overlayHeight,
  });

  useEffect(() => {
    const animation = Animated.timing(animatedInset, {
      toValue: inset,
      duration: inset > 0 ? 240 : 200,
      easing: Easing.out(Easing.ease),
      // Düzen değeri (paddingBottom) — native sürücü desteklemez.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [inset, animatedInset]);

  return { inset, animatedInset, onLayout };
}
