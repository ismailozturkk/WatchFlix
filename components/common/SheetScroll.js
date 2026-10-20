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
import React from "react";
import { ScrollView, StyleSheet } from "react-native";

export default function SheetScroll({
  children,
  style,
  contentContainerStyle,
  ...rest
}) {
  return (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={contentContainerStyle}
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
  scroll: { flexGrow: 0, flexShrink: 1 },
});
