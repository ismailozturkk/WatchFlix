// components/modals/gallery/GalleryFlier.js
//
// Galeri geçişinde kaynak yuva ile büyük görsel arasında uçan kopya.
//
// • Yerleşimi SABİT: hedef dikdörtgende durur; hareket yalnız UI iş
//   parçacığında transform (öteleme + eşit ölçek) + köşe yarıçapı. JS meşgulken
//   (TMDB isteği, liste çizimi) takılmaz, her karede yeniden yerleşim yapılmaz.
// • Görsel, detay ekranındakiyle AYNI bileşen (RN Image) ve AYNI URL: bellek
//   önbelleğinden ilk karede çizilir. Android'in varsayılan 300 ms belirme
//   solması (`fadeDuration`) kapalı — yoksa kopya ilk anda saydam başlar.
// • Kısa ömürlü: her uçuşta yeni anahtarla bağlanır, iniş bitince sökülür.
//   (Reanimated 4.5 animasyonlu stilin İLK değerini yeniden çizimlerde geri
//   yazabiliyor; kalıcı bir yüzeyde bu kaybolma hatası verir — burada bileşen
//   zaten uçuş boyunca yaşar.)
import React, { useEffect, useRef } from "react";
import { Image, StyleSheet } from "react-native";
import Reanimated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from "react-native-reanimated";
import { flightOpacity, flightRadius, isFlightCovering } from "./galleryGeometry";

export default function GalleryFlier({
  uri,
  target,
  start,
  fromRadius = 0,
  toRadius = 0,
  progress,
  onMounted,
  onReady,
  onFailed,
  onCoverChange,
}) {
  const readyFired = useRef(false);
  const { dx, dy, scale } = start;

  useEffect(() => {
    onMounted?.();
    // Bir uçuşun ömrü boyunca yalnızca bağlanma anını bildir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const k = 1 - p;
    const s = scale + (1 - scale) * p;
    return {
      opacity: flightOpacity(p),
      borderRadius: flightRadius(p, { scale }, fromRadius, toRadius),
      transform: [{ translateX: dx * k }, { translateY: dy * k }, { scale: s }],
    };
  }, [dx, dy, scale, fromRadius, toRadius]);

  // Kopya yuvayı tam örtmeye başladı / örtmeyi bıraktı → yuva gizlenir / görünür.
  // Eşik UI iş parçacığında, karesi karesine yakalanır (zamanlayıcı tahmini yok).
  useAnimatedReaction(
    () => isFlightCovering(progress.value),
    (covering, previous) => {
      if (previous !== null && covering !== previous && onCoverChange) {
        runOnJS(onCoverChange)(covering);
      }
    },
    [onCoverChange],
  );

  // GÖRSEL çizildi = hazır. Yalnız yerleşmek yetmez: önbellekteki görsel bile bu
  // boyutta yeniden çözülür, o arada kopya boş bir kutudur. Kaynak yuva ancak
  // bundan sonra gizlenir / liste ancak bundan sonra saklanır. Bir kare daha
  // beklenir ki görsel gerçekten ekranda olsun. Yükleme hatasında uçuş yerine
  // hemen solma geçişi kullanılır.
  const handleLoaded = () => {
    if (readyFired.current) return;
    readyFired.current = true;
    const fire = () => onReady?.();
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(fire);
    else setTimeout(fire, 16);
  };

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        styles.box,
        { left: target.x, top: target.y, width: target.width, height: target.height },
        animatedStyle,
      ]}
    >
      <Image
        source={{ uri }}
        style={styles.image}
        resizeMode="cover"
        fadeDuration={0}
        onLoad={handleLoaded}
        onError={() => {
          if (readyFired.current) return;
          readyFired.current = true;
          onFailed?.();
        }}
      />
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: "absolute",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
