// components/StaggerItem.js
//
// Liste öğeleri için kademeli (staggered) giriş animasyonu.
// FlatList renderItem içinde her öğeyi sarmalar; öğeler sırayla,
// hafif yukarı kayarak ve solarak belirir.
//
//   renderItem={({ item, index }) => (
//     <StaggerItem index={index}>
//       <Card ... />
//     </StaggerItem>
//   )}

import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

export default function StaggerItem({
  index = 0,
  children,
  style,
  duration = 360,
  step = 55,      // öğeler arası gecikme (ms)
  maxStaggered = 10, // bu indeksten sonra gecikme sabitlenir (scroll'da takılmasın)
  offsetY = 16,   // başlangıç dikey kayma
  // false → animasyonsuz, doğrudan tam görünür. YALNIZ bağlanma anında okunur
  // (bkz. hooks/useEntranceGate.js: ilk yükleme penceresi / Hareketi Azalt).
  animate = true,
}) {
  const anim = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.timing(anim, {
      toValue: 1,
      duration,
      delay: Math.min(index, maxStaggered) * step,
      useNativeDriver: true,
    }).start();
    // sadece mount'ta çalışsın
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [offsetY, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
