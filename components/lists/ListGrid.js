import React from "react";
import { FlatList } from "react-native";
import ListItemCard from "./ListItemCard";

export default function ListGrid({
  data,
  gridMode,
  imageQuality,
  theme,
  navigation,
}) {
  return (
    <FlatList
      data={data}
      key={gridMode}
      numColumns={gridMode}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <ListItemCard
          item={item}
          imageQuality={imageQuality}
          theme={theme}
          onPress={() =>
            navigation.navigate(
              item.type === "movie" ? "MovieDetails" : "TvShowsDetails",
              { id: item.id },
            )
          }
        />
      )}
    />
  );
}
