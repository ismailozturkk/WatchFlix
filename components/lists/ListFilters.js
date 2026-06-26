import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { i18nText } from "../../utils/i18nText";


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
        <Text>{i18nText("autoI18n.isim", "İsim")}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setSortType("release")}>
        <Text>{i18nText("autoI18n.yayin", "Yayın")}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
      >
        <Text>⬆⬇</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setTvStatus(null)}>
        <Text>{i18nText("autoI18n.tumu", "Tümü")}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setTvStatus(true)}>
        <Text>{i18nText("autoI18n.bitmis", "Bitmiş")}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setTvStatus(false)}>
        <Text>Devam</Text>
      </TouchableOpacity>
    </View>
  );
}
