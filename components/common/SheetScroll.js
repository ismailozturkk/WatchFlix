// components/common/SheetScroll.js
//
// Alt sayfaların (BottomSheetModal) "küçülebilen bölgesi". İçinde metin kutusu
// olan sayfada klavye açılınca sayfanın maxHeight'ı klavyenin üstündeki alana
// iner (bkz. hooks/useSheetTransition.js → fit); içerik bu bölgede kaydırılır,
// başlık ve ana düğme ekranda kalır.
//
//   <BottomSheetModal sheetStyle={styles.sheet} …>
//     <View style={styles.handle} />
//     <SheetScroll>…alanlar…</SheetScroll>      // küçülür, gerekirse kayar
//     <Button />                                // hep görünür
//   </BottomSheetModal>
//
// NEDEN AYRI BİLEŞEN: RN'in ScrollView'ı varsayılan olarak flexGrow: 1 gelir;
// otomatik yükseklikli sayfada zararsızdır ama minHeight'lı sayfada bölgeyi
// şişirir. Burada flexGrow: 0 / flexShrink: 1 — içerik sığıyorsa görünüm
// ScrollView olmayan hâliyle AYNI, sığmıyorsa küçülüp kayar.
//
// `keyboardShouldPersistTaps="handled"` şart: aksi halde klavye açıkken ilk
// dokunuş yalnız klavyeyi kapatır, düğmeler iki dokunuşta çalışır.
//
// YATAY BASMA PAYI: sayfadaki cam düğme/çipler bölgenin yan kenarına dayanır;
// basılınca büyüyen cam ScrollView sınırında kesilirdi. Kaydırıcı iki yana
// GLASS_PRESS_ROOM kadar taşar, içerik aynı kadar içeri itilir (yerleşim aynı;
// sayfanın kendi yan boşluğu bu payı karşılar). Tüketicinin yatay dolgusu korunur,
// pay ona EKLENİR. Dikeyde pay yok: negatif üst boşluk kayan içeriği başlığın
// altına sokardı.
import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

/** Tüketicinin içerik stiline iki yanda GLASS_PRESS_ROOM ekler (mevcut dolguyu koruyarak). */
function withSideRoom(contentContainerStyle) {
  const flat = StyleSheet.flatten(contentContainerStyle) || {};
  const side = (key) => flat[key] ?? flat.paddingHorizontal ?? flat.padding ?? 0;
  return [
    contentContainerStyle,
    {
      paddingLeft: side("paddingLeft") + GLASS_PRESS_ROOM,
      paddingRight: side("paddingRight") + GLASS_PRESS_ROOM,
    },
  ];
}

export default function SheetScroll({
  children,
  style,
  contentContainerStyle,
  ...rest
}) {
  return (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={withSideRoom(contentContainerStyle)}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1, marginHorizontal: -GLASS_PRESS_ROOM },
});
