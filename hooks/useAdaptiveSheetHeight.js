// hooks/useAdaptiveSheetHeight.js
//
// Yorum sheet'lerinin (CommentSheetModal, PostCommentSheetModal) yüksekliğini
// İÇERİĞE göre canlı hesaplar:
//   • hiç yorum yoksa      → minHeight
//   • yorum sayısı arttıkça → kademeli olarak büyür
//   • listeyi doldurunca   → maxHeight (neredeyse tam ekran)
// Klavye açıkken üst sınır ekran - klavye yüksekliğine düşer; sheet klavyenin
// üstüne SIĞACAK kadar küçülür, asla klavyenin altına taşmaz.
//
// NOT: RN'de FlatList/ScrollView açık flex/height verilmeden kendi içeriğine
// göre doğal boy alamaz (native tarafta viewport'suz ölçülemez) — bu yüzden
// sheet'in dış yüksekliği burada YORUM SAYISINA göre elle hesaplanıp Animated
// bir `height` olarak veriliyor; iç FlatList o sabit yükseklik içinde taşarsa
// kendi kaydırmasını yapar (bkz. Comment.js / PostCommentSheetModal.js
// commentArea: flexGrow/flexShrink).

import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Keyboard, Platform } from "react-native";

const { height: SCREEN_H } = Dimensions.get("window");

// Yorum sayısı → min/max arası konum oranı (0 = minHeight, 1 = maxHeight).
// Az sayıda yorumda hızlı büyür, sonra yavaşlayarak maxHeight'a yaklaşır.
const COUNT_BREAKPOINTS = [0, 1, 3, 6, 12, 24];
const COUNT_FRACTIONS = [0, 0.22, 0.42, 0.6, 0.8, 1];

function fractionForCount(count) {
  for (let i = 0; i < COUNT_BREAKPOINTS.length; i++) {
    if (count <= COUNT_BREAKPOINTS[i]) return COUNT_FRACTIONS[i];
  }
  return 1;
}

// Klavye açıkken sheet ekrana sığsın diye bırakılan tavan yükseklik bile
// çok küçük düşerse (katlanır telefon, split-screen vb.) diye alt sınır.
const HARD_FLOOR = 220;

/**
 * @param {object} opts
 * @param {boolean} opts.visible     Sheet ekranda mı (animasyon yalnız o zaman çalışır).
 * @param {number}  opts.count       Görünen yorum sayısı (sıfırsa minHeight).
 * @param {number}  opts.minHeight   Piksel — boş listede hedeflenen yükseklik.
 * @param {number}  opts.maxHeight   Piksel — dolu listede hedeflenen tavan.
 * @param {number}  [opts.topInset]  Durum çubuğu vb. — tavan hesabından düşülür.
 * @returns {{ heightAnim: Animated.Value, keyboardHeight: number }}
 */
export default function useAdaptiveSheetHeight({
  visible,
  count,
  minHeight,
  maxHeight,
  topInset = 0,
}) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const heightAnim = useRef(new Animated.Value(minHeight)).current;
  const lastTargetRef = useRef(minHeight);

  useEffect(() => {
    if (!visible) return undefined;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e?.endCoordinates?.height || 0);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
      setKeyboardHeight(0);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const fraction = fractionForCount(count || 0);
    const desired = minHeight + fraction * (maxHeight - minHeight);

    // Klavye açıkken tavan: ekran - klavye - üst boşluk. Bu değer normal
    // maxHeight'tan düşükse sheet ona göre küçülür (asla klavyenin altında
    // kalmaz); minHeight'tan bile düşükse yine de sığdırmak öncelikli.
    const availableWithKeyboard =
      keyboardHeight > 0 ? SCREEN_H - keyboardHeight - topInset : maxHeight;
    const target = Math.max(
      HARD_FLOOR,
      Math.min(desired, availableWithKeyboard, maxHeight),
    );

    if (Math.abs(target - lastTargetRef.current) < 1) return;
    lastTargetRef.current = target;
    Animated.spring(heightAnim, {
      toValue: target,
      useNativeDriver: false,
      damping: 24,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [visible, count, minHeight, maxHeight, keyboardHeight, topInset, heightAnim]);

  return { heightAnim, keyboardHeight };
}
