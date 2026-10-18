// components/lists/PlatformFilterSection.js
//
// İzleme listesinin "Sırala & Filtrele" sayfasındaki PLATFORM bölümü: "Platformlarımda" çipi + durum
// satırı (utils/providerWatch.planPlatformFilter). Yalnız sunum; seçili olup olmadığı ve değişimi
// ekrandan gelir.
//
// DÜRÜSTLÜK: süzgecin dayandığı veri yalnız takip edilen başlıkları kapsar ve günde bir yazılır
// (utils/providerWatch.js başlığı). Bu yüzden çipin altında hep neyin hesaplandığı söylenir:
// "N başlıktan K tanesi…", kapsam dışı başlık sayısı, denetimin yaşı. Veri yokken çip ÇİZİLMEZ,
// yerine nedeni ve ne yapılacağı yazılır.
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { isStale } from "../../utils/providerWatch";

export default function PlatformFilterSection({ plan, selected, onToggle, copy, theme, accent }) {
  const { state, counts, ageDays } = plan;
  // Seçiliyken veri kaybolsa bile çip kalır: kullanıcı süzgeci kapatabilsin.
  const showChip = state === "ready" && (counts.yes > 0 || selected);

  let status = null;
  if (state === "off") status = copy.off;
  else if (state === "no-data") status = copy.noData;
  else if (state === "region") status = copy.region;
  else if (counts.yes === 0) status = copy.none;
  else status = copy.ready(counts.yes, counts.total);

  return (
    <>
      <Text style={[styles.section, { color: theme.text.muted }]}>{copy.section}</Text>
      {showChip ? (
        <View style={styles.chipRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onToggle}
            accessibilityRole="switch"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={copy.chipLabel(counts.yes)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? accent + "22" : theme.secondary,
                borderColor: selected ? accent : theme.border,
              },
            ]}
          >
            <Ionicons
              name={selected ? "checkmark-circle" : "tv-outline"}
              size={15}
              color={selected ? accent : theme.text.secondary}
            />
            <Text style={[styles.chipText, { color: selected ? theme.text.primary : theme.text.secondary }]}>
              {copy.chipCount(counts.yes)}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <Text style={[styles.note, { color: theme.text.muted }]}>{status}</Text>
      {state === "ready" && counts.unknown > 0 ? (
        <Text style={[styles.note, { color: theme.text.muted }]}>{copy.unknown(counts.unknown)}</Text>
      ) : null}
      {state === "ready" && isStale(ageDays) ? (
        <Text style={[styles.note, { color: theme.text.muted }]}>{copy.age(ageDays)}</Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // Üst boşluğu sayfanın bölüm kabuğu verir (ListSortFilterSheet); başlık diğer bölümlerle aynı biçimde.
  section: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.9, marginBottom: 7 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: { fontSize: 12.5, fontWeight: "700" },
  note: { fontSize: 11.5, lineHeight: 16, marginTop: 6 },
});
