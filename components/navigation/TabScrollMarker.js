// components/navigation/TabScrollMarker.js
//
// Bir sekme ekranının ANA kaydırma görünümünü iOS'taki sekme çubuğuna tanıtır.
// Bunsuz çubuk "aşağı kaydırınca küçül, yukarı kaydırınca büyü" davranışını
// (tabBarMinimizeBehavior: "onScrollDown", iOS 26+) hiç yapmıyor.
//
// NEDEN GEREKLİ: UIKit çubuğu hangi kaydırma görünümüne bağlayacağını, sekme
// ekranının İLK ALT-GÖRÜNÜM ZİNCİRİNDE (ilk çocuk → onun ilk çocuğu → …)
// arıyor. Beş sekmenin beşinde de ilk çocuk `ScreenDecor` (mutlak konumlu arka
// plan deseni + kar); zincir oraya girip kaydırma görünümüne hiç ulaşamıyor,
// çubuk sessizce hiçbir şey yapmıyor. Dekoru kaydırma görünümünün ARKASINA
// almak katman sırasını bozar, o yüzden react-native-screens'in açık işaretleyicisi
// (`ScrollViewMarker`) kullanılıyor: kaydırma görünümünü zincire bakmadan
// doğrudan sekme ekranına kaydeder.
//
// KULLANIM — ekranın modül kapsamında, kaydırma bileşeni bir kez sarılır; JSX'te
// yalnız etiket adı değişir (yüzlerce satırlık ScrollView gövdesini iç içe
// girintilemek gerekmez):
//
//   const MarkedScrollView = markTabScroll(ScrollView);
//   …
//   <MarkedScrollView contentContainerStyle={…}> … </MarkedScrollView>
//
// SARILAN BİLEŞEN modül kapsamında olmalı: render içinde `markTabScroll(...)`
// çağırırsan her render yeni bileşen türü doğar, alt ağaç sökülüp kaydırma
// konumu sıfırlanır.
//
// İşaretleyicinin ÇOCUĞU TEK ve DOĞRUDAN ScrollView / FlatList olmalı (araya View
// koyma; işaretleyici yalnız doğrudan çocuğu çözüyor, debug derlemede aksi
// hâlde assert patlatır). `markTabScroll` bunu garanti eder.
//
// iOS DIŞINDA ve işaretleyici yüklenemezse çocuğu AYNEN döndürür — Android'de
// ve eski yerel modülde hiçbir şey değişmez. Modül `experimental` altında (API
// uyarısız değişebilir); bu yüzden tek yerde, hata yutan bir require ile.
//
// ÜST KENAR EFEKTİ KAPALI: iOS 26 kaydırma görünümü durum çubuğunun altına
// uzanıyorsa üstte yumuşak bir bulanıklık şeridi ekliyor; ekranların mevcut
// görünümü bozulmasın diye `top: "hidden"`. Alt kenar `automatic` kalır: cam
// sekme çubuğunun altındaki yumuşak geçiş sistemin kendi davranışı.

import React, { forwardRef } from "react";
import { Platform, StyleSheet } from "react-native";
import { tabBarNativeSupport } from "../../services/tabBarCapabilities";

const EDGE_EFFECTS = Object.freeze({ top: "hidden" });

function loadMarker() {
  if (Platform.OS !== "ios" || !tabBarNativeSupport.nativeTabsAvailable) return null;
  try {
    return require("react-native-screens/experimental").ScrollViewMarker ?? null;
  } catch {
    return null;
  }
}

// Modül kimliği render'lar arasında sabit kalmalı (bileşen türü değişirse alt
// ağaç — yani kaydırma konumu — sıfırlanır).
const ScrollViewMarker = loadMarker();

export default function TabScrollMarker({ children }) {
  if (!ScrollViewMarker) return children;
  return (
    <ScrollViewMarker style={styles.fill} scrollEdgeEffects={EDGE_EFFECTS}>
      {children}
    </ScrollViewMarker>
  );
}

/**
 * Kaydırma bileşenini (ScrollView, Animated.FlatList …) işaretleyiciyle sarar.
 * Tüm prop'lar ve `ref` doğrudan içteki bileşene gider.
 */
export function markTabScroll(Scrollable) {
  const Marked = forwardRef(function MarkedTabScroll(props, ref) {
    return (
      <TabScrollMarker>
        <Scrollable {...props} ref={ref} />
      </TabScrollMarker>
    );
  });
  Marked.displayName = `Marked(${Scrollable.displayName || Scrollable.name || "Scroll"})`;
  return Marked;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
