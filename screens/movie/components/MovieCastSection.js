import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import SectionHeader from "@components/detail/SectionHeader";
import MovieCastItem from "./MovieCastItem";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";

/* Oyuncular rayı: ilk 10 kişi + "tümünü göster" düğmesi.
   showFullCast durumunu kendi içinde tutar. */
export default function MovieCastSection({ cast, navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [showFullCast, setShowFullCast] = useState(false);

  const renderCastMember = useCallback(
    ({ item }) => <MovieCastItem item={item} navigation={navigation} />,
    [navigation],
  );

  if (!cast?.length) return null;

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t.cast}
        right={
          cast.length > 6 && (
            <TouchableOpacity
              onPress={() => setShowFullCast(!showFullCast)}
              style={styles.seeAllBtn}
            >
              <Text style={[styles.seeAllText, { color: theme.accent }]}>
                {showFullCast ? t.collapse : t.showAll}
              </Text>
            </TouchableOpacity>
          )
        }
      />
      <FlatList
        data={showFullCast ? cast : cast.slice(0, 10)}
        renderItem={renderCastMember}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 4, gap: 12 }}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  seeAllBtn: { paddingHorizontal: 4 },
  seeAllText: { fontSize: 13, fontWeight: "600" },
});
