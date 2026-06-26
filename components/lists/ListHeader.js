import React from "react";
import { View, Text, TextInput } from "react-native";
import { i18nText } from "../../utils/i18nText";


export default function ListHeader({ title, search, setSearch, theme }) {
  return (
    <View style={{ padding: 12 }}>
      <Text
        style={{ color: theme.text.primary, fontSize: 20, fontWeight: "bold" }}
      >
        {title}
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={i18nText("autoI18n.ara", "Ara...")}
        placeholderTextColor={theme.text.muted}
        style={{
          marginTop: 10,
          padding: 10,
          borderRadius: 10,
          backgroundColor: theme.secondary,
          color: theme.text.primary,
        }}
      />
    </View>
  );
}
