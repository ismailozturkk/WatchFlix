// components/home/DiscoverSearchHeader.js
//
// Film / Dizi ana ekranlarının listesinin başındaki arama girişi: güvenli alana
// bağlı üst boşluk + DiscoverSearchButton + dokununca arama ekranını (UnifiedSearch)
// düğmenin konumundan genişleyerek açan geçiş.
//
// İki ekran bunu eskiden satır satır kopyalıyordu (ref, openSearch, üst boşluk,
// renderHeader). Tek yerde durması iki ekranın ayrışmasını da engeller.
//
// ÖNEMLİ — bu bileşen `ListHeaderComponent` olarak ELEMENT verilir
// (`ListHeaderComponent={<DiscoverSearchHeader … />}`), `() => <…/>` gibi bir
// geri çağrı DEĞİL. FlatList, fonksiyon verilirse onu bileşen TİPİ sayar; fonksiyonun
// kimliği (üst boşluk, dil, navigation değişince) her değiştiğinde başlığın tamamı
// sökülüp yeniden kurulur ve düğme sıfırdan başlar. Element verilince aynı tip
// yerinde güncellenir (bkz. DiscoverSearchButton.js'deki kayboluma dair not).
import React, { useCallback, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DiscoverSearchButton, { DISCOVER_SEARCH_RADIUS } from "./DiscoverSearchButton";
import { tabTitleTopSpacing } from "../../utils/screenTopSpacing";

/** Güvenli alan 0 raporlansa bile korunan üst boşluk (eski sabit değer). */
export const DISCOVER_SEARCH_TOP_MIN = 50;

export default function DiscoverSearchHeader({
  navigation,
  mediaType,
  placeholder,
  animatedStyle,
}) {
  // Ekran kenardan kenara; düğme durum çubuğuna/çentiğe yapışmasın diye üst boşluk
  // güvenli alana bağlı (eski sabit 50, Dynamic Island'da yetmiyordu).
  const insets = useSafeAreaInsets();
  const paddingTop = tabTitleTopSpacing(insets.top, { min: DISCOVER_SEARCH_TOP_MIN });
  const buttonRef = useRef(null);

  const openSearch = useCallback(() => {
    const navigateToSearch = (searchOrigin) => {
      navigation.navigate("UnifiedSearch", {
        initialType: mediaType,
        autoFocus: true,
        searchOrigin,
      });
    };

    if (buttonRef.current?.measureInWindow) {
      buttonRef.current.measureInWindow((x, y, width, height) => {
        navigateToSearch({ x, y, width, height, radius: DISCOVER_SEARCH_RADIUS });
      });
      return;
    }

    navigateToSearch(undefined);
  }, [mediaType, navigation]);

  return (
    <View style={[styles.container, { paddingTop }]}>
      <DiscoverSearchButton
        ref={buttonRef}
        mediaType={mediaType}
        placeholder={placeholder}
        onPress={openSearch}
        animatedStyle={animatedStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // paddingTop render'da güvenli alana göre verilir.
    paddingHorizontal: 15,
    zIndex: 10, // Listenin üstünde kalması için
  },
});
