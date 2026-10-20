// hooks/useKeyboardMetrics.js
//
// Bir <Modal> içindeki alt sayfa / diyalog için klavye ÖLÇÜMÜ: klavyenin örttüğü
// yükseklik, kaplayıcının şimdiki boyu ve klavye KAPALIYKEN boyu (taban).
// useSheetTransition (alt sayfalar) ve useKeyboardInset (ortalanmış diyaloglar)
// bunu paylaşır; hesap utils/sheetKeyboardFit.js'te.
//
// KAPANIŞTA SIFIRLANIR: `active` false olunca klavye yüksekliği, kaplayıcı ölçüsü
// ve taban sıfırlanır. Aksi halde bir sonraki açılış, önceki oturumun klavyeli
// ölçüsüyle başlar ("klavye yok ama sayfa klavye açıkmış gibi kısa/yüksekte").
//
// OLAYLAR:
//   • iOS: keyboardWillChangeFrame (açılma, KAPANMA, emoji/öneri çubuğu gibi boy
//     değişimleri) + keyboardWillHide/keyboardDidHide. `WillShow` tek başına
//     boy değişimini kaçırır → sayfa eski klavye boyuna göre kalırdı.
//   • Android: keyboardDidShow (RN boy değişiminde de yeniden atar) + DidHide.
//   Gizleme olayı iOS'ta iki yoldan dinlenir; biri kaçsa diğeri sayfayı eski
//   boyda bırakmaz.
import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, Keyboard, Platform } from "react-native";
import { keyboardOverlap, nextBaseOverlay } from "@utils/sheetKeyboardFit";

const IS_IOS = Platform.OS === "ios";

/**
 * @param {boolean} active
 *        Sayfa/diyalog ekranda mı. false olunca tüm ölçüm sıfırlanır.
 * @param {object} [options]
 * @param {boolean} [options.track=true]
 *        false: klavye olayları dinlenmez (sayfanın kendi klavye çözümü var);
 *        kaplayıcı ölçümü yine yapılır.
 * @returns {{
 *   keyboardHeight: number,
 *   overlayHeight: number,
 *   baseOverlayHeight: number,
 *   isKeyboardOpen: () => boolean,
 *   onOverlayLayout: (event: any) => void,
 * }}
 */
export default function useKeyboardMetrics(active, { track = true } = {}) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef(0);
  const [overlayHeight, setOverlayHeight] = useState(0);
  // Taban render sırasında okunur; değişimi her zaman bir `overlayHeight`
  // güncellemesiyle birlikte geldiği için yeniden çizimi o tetikler.
  const baseRef = useRef({ height: 0, window: 0 });

  useEffect(() => {
    if (!active || !track) return undefined;
    const apply = (height) => {
      keyboardHeightRef.current = height;
      setKeyboardHeight(height);
    };
    const windowHeight = () => Dimensions.get("window").height;
    const subs = [];
    if (IS_IOS) {
      subs.push(
        Keyboard.addListener("keyboardWillChangeFrame", (event) =>
          apply(keyboardOverlap(event?.endCoordinates, windowHeight(), true)),
        ),
        Keyboard.addListener("keyboardWillHide", () => apply(0)),
        Keyboard.addListener("keyboardDidHide", () => apply(0)),
      );
    } else {
      subs.push(
        Keyboard.addListener("keyboardDidShow", (event) =>
          apply(keyboardOverlap(event?.endCoordinates, windowHeight(), false)),
        ),
        Keyboard.addListener("keyboardDidHide", () => apply(0)),
      );
    }
    return () => {
      subs.forEach((sub) => sub.remove());
      apply(0);
    };
  }, [active, track]);

  useEffect(() => {
    if (active) return;
    baseRef.current = { height: 0, window: 0 };
    setOverlayHeight(0);
  }, [active]);

  const onOverlayLayout = useCallback((event) => {
    const measured = Math.round(event.nativeEvent.layout.height);
    if (measured <= 0) return;
    baseRef.current = nextBaseOverlay(
      baseRef.current,
      measured,
      Dimensions.get("window").height,
    );
    setOverlayHeight(measured);
  }, []);

  const isKeyboardOpen = useCallback(() => keyboardHeightRef.current > 0, []);

  return {
    keyboardHeight,
    overlayHeight,
    baseOverlayHeight: baseRef.current.height,
    isKeyboardOpen,
    onOverlayLayout,
  };
}
