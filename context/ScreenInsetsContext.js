// context/ScreenInsetsContext.js
//
// Premium şeridi (components/premium/PremiumTopBannerLayout.js) ekranın ÜSTÜNDE yüzer:
// ekran gövdesi yine pencerenin tepesinden başlar, şerit durum çubuğunun hemen altına
// bindirilir. İçerik şeridin altında kalmasın diye yerleşim gövdeye
// `useSafeAreaInsets().top` değerini şeridin kapladığı kadar BÜYÜTÜLMÜŞ verir; güvenli
// alanı bağlamdan okuyan ekranlar kendiliğinden şeridin altından başlar.
//
// Bağlamı okumayan yerler için:
//
//   • Pencere kenarına çizilen içerik (RN `Modal`, Modal içi toast): React bağlamını
//     ekrandan miras alır, büyütülmüş değer ona yanlış → `useWindowSafeAreaInsets()`.
//   • Yerel `SafeAreaView` güvenli alanı bağlamdan değil konumundan okur → şeridin
//     altında kalır. Ekranlar `components/common/ScreenSafeAreaView` kullanır; o da
//     `usePremiumBannerOverlap()` kadar üst boşluk ekler.
//   • Sabit durum çubuğu boşluğu (ör. 52) kullanan başlıklar aynı kancayla kayar.
//
// Şerit olmayan her yerde (bağlam yok / gizli rota / Premium) kancalar olağan değerlere
// ve 0'a düşer.

import { createContext, useContext } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const WindowInsetsContext = createContext(null);
export const PremiumBannerOverlapContext = createContext(0);

/** Pencerenin gerçek güvenli alanı (şerit varken de). Modal / tam ekran içerik için. */
export function useWindowSafeAreaInsets() {
  const local = useSafeAreaInsets();
  return useContext(WindowInsetsContext) || local;
}

/** Şeridin gerçek güvenli alanın ALTINA taşan yüksekliği (şerit yoksa 0). */
export function usePremiumBannerOverlap() {
  return useContext(PremiumBannerOverlapContext);
}
