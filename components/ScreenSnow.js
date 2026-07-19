// components/ScreenSnow.js
//
// Kişiselleştirme "kar efekti" için TEK, optimize edilmiş ve tüm ekranlarda
// tutarlı bileşen. Daha önce her ekran kendi LottieView overlay'ini (kimi
// scroll'un içinde, kimi dışında) elle kuruyordu; bu bileşen o kalıbı toplar:
//
//   • Sabit tam ekran overlay (scroll'dan bağımsız — kar akıp kaybolmaz).
//   • pointerEvents="none": altındaki içeriğin dokunmalarını engellemez.
//   • InteractionManager ile geçiş/animasyon bitince render edilir → ekran
//     açılışında ve sekme geçişinde ilk-kare düşmesi (jank) olmaz.
//   • `showSnow` ayarını kendi içinde okur → ekranların ayrı state'i olmasına
//     gerek yok, sadece <ScreenSnow /> koymak yeter.
//
// Kullanım: ekranın kök View'ının EN SON çocuğu olarak koy (içeriğin üstünde
// katman olsun diye). Arka plan ikonları için ayrıca <IconBacground /> ilk
// çocuk olarak kullanılır (o içeriğin ARKASINDA durur).

import React, { useEffect, useState } from "react";
import { View, StyleSheet, InteractionManager } from "react-native";
import LottieView from "lottie-react-native";
import { useSnowSettings } from "../context/AppSettingsContext";

function ScreenSnow() {
  const { showSnow } = useSnowSettings();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!showSnow) {
      setReady(false);
      return undefined;
    }
    // Ekran yerleşene / geçiş animasyonu bitene kadar bekle.
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel?.();
  }, [showSnow]);

  if (!showSnow || !ready) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <LottieView
        style={styles.fill}
        source={require("@lottie/snow.json")}
        autoPlay
        loop
      />
    </View>
  );
}

// memo: parent yeniden render olduğunda (showSnow değişmedikçe) Lottie'yi
// gereksiz yere yeniden kurmaz.
export default React.memo(ScreenSnow);

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  fill: { flex: 1 },
});
