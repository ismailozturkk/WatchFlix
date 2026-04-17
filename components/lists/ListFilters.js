import React from "react";
import { View, TouchableOpacity, Text } from "react-native";

export default function ListFilters({
  sortType,
  setSortType,
  sortOrder,
  setSortOrder,
  tvStatus,
  setTvStatus,
}) {
  return (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 10 }}
    >
      <TouchableOpacity onPress={() => setSortType("name")}>
        <Text>İsim</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setSortType("release")}>
        <Text>Yayın</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
      >
        <Text>⬆⬇</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setTvStatus(null)}>
        <Text>Tümü</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setTvStatus(true)}>
        <Text>Bitmiş</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setTvStatus(false)}>
        <Text>Devam</Text>
      </TouchableOpacity>
    </View>
  );
}
