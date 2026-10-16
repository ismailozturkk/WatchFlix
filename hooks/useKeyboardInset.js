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
// o kısım tekrar eklenmez (çift kayma olmaz). Ölçüm hooks/useKeyboardMetrics.js,
// hesap utils/sheetKeyboardFit.js → keyboardLift.
//
// `active` false olunca ölçüm sıfırlanır ve boşluk 0'a iner: modal yeniden
// açılınca önceki oturumun klavye boşluğuyla başlamaz.
import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import useKeyboardMetrics from "@hooks/useKeyboardMetrics";
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
  const { keyboardHeight, overlayHeight, baseOverlayHeight, onOverlayLayout } =
    useKeyboardMetrics(active);
  const animatedInset = useRef(new Animated.Value(0)).current;

  const inset = keyboardLift({ keyboardHeight, baseOverlayHeight, overlayHeight });

  useEffect(() => {
    // `active` false iken `inset` zaten 0'dır (ölçüm sıfırlandı); iOS'ta modal
    // solarken boşluk yumuşakça iner.
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

  return { inset, animatedInset, onLayout: onOverlayLayout };
}
