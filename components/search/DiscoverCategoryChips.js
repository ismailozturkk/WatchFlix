// components/search/DiscoverCategoryChips.js
//
// Arama boşken gösterilen keşif listesinin süzgeci (Popüler / Yakında / En İyi …).
// Film, dizi ve oyuncu aramasında ORTAK.
//
// NEDEN ÇİP, SEGMENT DEĞİL: hemen üstte tür anahtarı (Film · Dizi · Oyuncu) zaten
// tam genişlikte bir segment. Eskiden bu da aynı biçimde ikinci bir segment çubuğuydu
// ve iki çubuk aynı ağırlıkta okunup hangisinin üst seviye olduğu anlaşılmıyordu.
// Çip satırı ikinci seviye olduğunu biçimle söyler: sola yaslı, daha küçük, simgeli.
// Uzun çeviriler (pt "Mais bem avaliados") için satır yatay kayar.
//
// Çipler GlassTouchable: iOS 26+'da cam (seçili olan vurgu tonlu), Android'de buzlu,
// diğer yerde tema yüzeyli hap (glassCoverageGuard: çipler cam).
import React, { memo } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassTouchable from "../common/GlassTouchable";
import { useTheme } from "../../context/ThemeContext";
import { selectionAsync } from "../../services/hapticsService";
import { alpha } from "../../theme/colors";
import { CATEGORY_ICONS } from "./searchHeaderCopy";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

const CHIP_HEIGHT = 34;

/**
 * @param {string[]} props.categories  Çip kimlikleri (CATEGORY_ICONS anahtarları), sırayla
 * @param {Record<string, string>} props.labels  Kimlik → etiket (searchHeaderCopy.categories)
 * @param {number} props.activeIndex
 * @param {(index: number) => void} props.onChange
 * @param {string} [props.accessibilityLabel]
 */
function DiscoverCategoryChips({ categories, labels, activeIndex, onChange, accessibilityLabel }) {
  const { theme } = useTheme();
  const accent = theme.accent ?? "#3B82F6";

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {categories.map((id, index) => {
        const selected = index === activeIndex;
        const icon = CATEGORY_ICONS[id] ?? "ellipse";
        return (
          <GlassTouchable
            key={id}
            testID={`discover-category-${id}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            activeOpacity={0.75}
            onPress={() => {
              if (selected) return;
              selectionAsync().catch(() => {});
              onChange(index);
            }}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: alpha(accent, 0.18), borderColor: alpha(accent, 0.55) }
                : { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <Ionicons
              name={selected ? icon : `${icon}-outline`}
              size={14}
              color={selected ? accent : theme.text?.muted ?? "#8A8A8E"}
            />
            {/* Kalınlık seçimle DEĞİŞMEZ: değişseydi çip genişler, sağdakiler kayardı. */}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.label, { color: selected ? theme.text?.primary : theme.text?.secondary }]}
            >
              {labels[id] ?? id}
            </Text>
          </GlassTouchable>
        );
      })}
    </ScrollView>
  );
}

export default memo(DiscoverCategoryChips);

const styles = StyleSheet.create({
  // flexShrink 0: ScrollView varsayılan olarak büzülebilir; altındaki liste taşarsa
  // satır sıfır yüksekliğe inip çipler kaybolurdu.
  // Dikey GLASS_PRESS_ROOM: basılan cam çip satırın kırpma sınırında kesilmesin (dolgu + eşit
  // negatif dış boşluk; yerleşim aynı).
  scroll: { flexGrow: 0, flexShrink: 0, marginTop: -GLASS_PRESS_ROOM, marginBottom: 12 - GLASS_PRESS_ROOM },
  row: { paddingHorizontal: 16, paddingVertical: GLASS_PRESS_ROOM, gap: 8, alignItems: "center" },
  chip: {
    height: CHIP_HEIGHT,
    borderRadius: CHIP_HEIGHT / 2,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: { fontSize: 13, fontWeight: "700", letterSpacing: -0.1 },
});
