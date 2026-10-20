// components/chat/BounceIn.js
//
// Yeni gönderilen/gelen mesaj balonunun "sekme" (bounce) girişi. Yay (spring)
// bilerek az sönümlü: ilerleme 1'i aşıp geri döndüğü için balon hedef boyutunu
// önce biraz geçer, sonra yerine oturur.
//
//   send    → composer'dan yükselir (alt-sağ köşeden büyür), hızlı ve sert zıplar
//   receive → alttan-soldan daha yumuşak, biraz daha uzun zıplar
//
// `kind` yoksa HİÇ animasyon çalışmaz ve çocuk doğrudan görünür: geçmiş
// mesajlar, hücre yeniden bağlanması ve "Hareketi Azalt" böyle çalışır.
// `kind` yalnızca BAĞLANIRKEN okunur; sonradan değişmesi animasyonu tekrarlamaz.

import React, { useEffect } from "react";
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const SPRINGS = {
  send: { damping: 11, stiffness: 260, mass: 0.7 },
  receive: { damping: 9, stiffness: 170, mass: 0.8 },
};
// Başlangıçta ne kadar aşağıda duracağı (px) ve ne kadar küçük başlayacağı.
const FROM_Y = { send: 34, receive: 22 };
const FROM_SCALE = { send: 0.5, receive: 0.62 };

export default function BounceIn({ kind, isMe = false, style, children }) {
  const progress = useSharedValue(kind ? 0 : 1);

  useEffect(() => {
    if (!kind) return;
    progress.value = withSpring(1, SPRINGS[kind] || SPRINGS.receive);
    // Yalnızca bağlanırken: bkz. dosya başı notu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    if (!kind) return {};
    const fromY = FROM_Y[kind] ?? FROM_Y.receive;
    const fromScale = FROM_SCALE[kind] ?? FROM_SCALE.receive;
    return {
      // İlk üçte birde belirir; aşım sırasında 1'de kalır.
      opacity: Math.min(1, progress.value * 3),
      transform: [
        { translateY: (1 - progress.value) * fromY },
        { scale: fromScale + (1 - fromScale) * progress.value },
      ],
    };
  });

  return (
    <Reanimated.View
      style={[
        // Büyüme noktası gönderici köşesi: balon "o taraftan" fışkırır.
        { transformOrigin: isMe ? "100% 100%" : "0% 100%" },
        style,
        animatedStyle,
      ]}
    >
      {children}
    </Reanimated.View>
  );
}
