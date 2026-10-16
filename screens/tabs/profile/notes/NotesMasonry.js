// screens/tabs/profile/notes/NotesMasonry.js
//
// Notlar ekranının iki sütunlu ızgarası. Satır tabanlı FlatList ızgarasında kısa
// kartın altı, yanındaki uzun kartın boyuna kadar boş kalıyordu; burada kartlar
// SÜTUN SÜTUN dizilir (her kart en kısa sütuna girer, utils/notesView.js
// splitIntoColumns) ve sütun içinde arka arkaya durur — boşluk oluşmaz.
//
// Sanallaştırma yok: notlar kısıtlı sayıda (ücretsiz planda 5+5) ve kartların
// yüksekliği değişken. Tek ScrollView, boş/yükleme durumu `empty` ile gelir.

import React, { memo, useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { estimateGridCardHeight, splitIntoColumns } from "../../../../utils/notesView";

function NotesMasonry({
  data,
  columnWidth,
  columnGap,
  rowGap,
  renderItem,
  empty,
  contentContainerStyle,
}) {
  const columns = useMemo(
    () => splitIntoColumns(data, (note) => estimateGridCardHeight(note, columnWidth)),
    [data, columnWidth],
  );

  return (
    <ScrollView
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {data.length === 0 ? (
        empty
      ) : (
        <View style={[st.row, { gap: columnGap }]}>
          {columns.map((column, index) => (
            <View key={index} style={{ width: columnWidth, gap: rowGap }}>
              {column.map((item) => (
                <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  // Sütunlar üstten hizalı: kısa sütun uzun olanı esnetmesin.
  row: { flexDirection: "row", alignItems: "flex-start" },
});

export default memo(NotesMasonry);
