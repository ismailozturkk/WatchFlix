import React, { useCallback } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import SectionHeader from "./SectionHeader";
import SimilarMediaItem from "./SimilarMediaItem";

/* Yatay içerik rayı: benzer/önerilen film-dizi listeleri.
   Veri boşsa hiç render edilmez. */
export default function MediaRailSection({ title, data, mediaType, navigation }) {
  const renderItem = useCallback(
    ({ item }) => (
      <SimilarMediaItem item={item} mediaType={mediaType} navigation={navigation} />
    ),
    [mediaType, navigation],
  );

  if (!data?.length) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <FlatList
        data={data.slice(0, 20)}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 4, gap: 10 }}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
});
