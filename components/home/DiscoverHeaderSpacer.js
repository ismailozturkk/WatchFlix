// components/home/DiscoverHeaderSpacer.js
//
// Film / Dizi liste sayfalarının başındaki boşluk. Ekranın tepesinde yüzen satır (Film/Dizi
// anahtarı + arama düğmesi, bkz. screens/tabs/DiscoverScreen.js) listelerin ÜSTÜNDE durur; ilk
// raf onun altından başlasın diye liste başlığı bu yüksekliği ayırır. (Eskiden bu başlıkta tam
// genişlikte arama hapı da vardı — DiscoverSearchHeader; arama düğmesi anahtarın yanına taşındı.)
//
// Güvenli alana bağlı: durum çubuğuna/çentiğe yapışmasın diye (eski sabit 50, Dynamic Island'da
// yetmiyordu). `topOffset`: yüzen satırın kapladığı yükseklik + boşluk.
//
// `ListHeaderComponent` olarak ELEMENT verilir (`<DiscoverHeaderSpacer … />`), `() => <…/>`
// gibi bir geri çağrı DEĞİL: FlatList fonksiyonu bileşen TİPİ sayar, kimliği her değiştiğinde
// başlığı sökülüp yeniden kurardı.
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabTitleTopSpacing } from "../../utils/screenTopSpacing";

/** Güvenli alan 0 raporlansa bile korunan üst boşluk (eski sabit değer). */
export const DISCOVER_TOP_MIN = 50;

/** Listenin başına konan boşluğun yüksekliği (saf; test edilir). */
export const discoverHeaderHeight = (insetTop, topOffset = 0) =>
  tabTitleTopSpacing(insetTop, { min: DISCOVER_TOP_MIN }) + topOffset;

export default function DiscoverHeaderSpacer({ topOffset = 0 }) {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" style={{ height: discoverHeaderHeight(insets.top, topOffset) }} />;
}
