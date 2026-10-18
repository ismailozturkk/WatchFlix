// components/home/SectionChips.js
//
// Raf başlıklarının altındaki süzgeç satırları için ortak yapı taşları:
//
//   SectionChipRail    yatay kaydırılan çip satırı (Trend: Bugün/Bu hafta · En iyi: Puan/Popüler ·
//                      Tür · Platform · Yaklaşan tarih aralığı · Oscar/Emmy kategorileri)
//   SectionSegmented   2–3 seçenekli kompakt anahtar (Oscar/Emmy: Kategori | Yıl)
//
// ÇİPLER yeni bileşen DEĞİL: "Ne izlesem?" ekranının DiscoverFilterChip'i (seçili = vurgu çerçevesi +
// vurgunun %16'sı zemin + birincil yazı). Uygulamada tek çip dili var; seçili çip vurgu üstü beyaz yazı
// gerektirmediği için her temada okunur. Çipin yüksekliği DISCOVER_CHIP_HEIGHT (36); platform çipleri
// logo için 42 (`SECTION_CHIP_HEIGHT_LOGO`).
//
// DÜZ yüzey (cam değil): çipler/sekmeler "BİLEREK cam olmayanlar" listesinde
// (bkz. __tests__/glassButtonCoverage.test.js).
//
// GÖLGE YOK: yatay liste gölgeyi çip yüksekliğinde keser, alt kenar sert kalır (eski tür çiplerinde
// yaşandı). Seçim çerçeveyle anlatılır.
import React, { memo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { DISCOVER_CHIP_HEIGHT } from "./DiscoverFilterChip";

export const SECTION_CHIP_HEIGHT = DISCOVER_CHIP_HEIGHT;
export const SECTION_CHIP_HEIGHT_LOGO = 42;
export const SECTION_CHIP_GAP = 8;
export const SECTION_RAIL_PADDING = 15;

/**
 * @param {object}   props
 * @param {Array}    props.data
 * @param {(item) => string}                  props.keyExtractor
 * @param {(item, index) => React.ReactElement} props.renderChip   çip öğesini döndürür (DiscoverFilterChip)
 * @param {*}        [props.extraData]   seçim değişince satırın yeniden çizilmesi için (FlatList saf bileşendir)
 * @param {object}   [props.style]       dış kap (yan yana düzenlerde `{ flex: 1 }`)
 * @param {object}   [props.contentContainerStyle]  varsayılan yatay boşluğu ezmek için
 */
export function SectionChipRail({
  data,
  keyExtractor,
  renderChip,
  extraData,
  style,
  contentContainerStyle,
}) {
  return (
    <FlatList
      data={data}
      horizontal
      keyExtractor={keyExtractor}
      renderItem={({ item, index }) => renderChip(item, index)}
      extraData={extraData}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={style}
      contentContainerStyle={[styles.railContent, contentContainerStyle]}
      initialNumToRender={8}
      windowSize={5}
    />
  );
}

/**
 * @param {object}   props
 * @param {Array<{ key: string, label: string }>} props.options
 * @param {string}   props.value      seçili `key`
 * @param {(key: string) => void} props.onChange
 */
function SectionSegmented({ options, value, onChange, style }) {
  const { theme } = useTheme();
  const accent = theme.accent ?? "#3B82F6";
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.segmented, { backgroundColor: theme.secondary, borderColor: theme.border }, style]}
    >
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            hitSlop={4}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.segment,
              selected && { backgroundColor: alpha(accent, 0.18), borderColor: accent },
              pressed && !selected && styles.pressed,
            ]}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.segmentText,
                {
                  color: selected ? theme.text.primary : theme.text.secondary,
                  fontWeight: selected ? "700" : "600",
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const MemoSegmented = memo(SectionSegmented);
export { MemoSegmented as SectionSegmented };

const styles = StyleSheet.create({
  railContent: {
    paddingHorizontal: SECTION_RAIL_PADDING,
    gap: SECTION_CHIP_GAP,
    alignItems: "center",
  },
  segmented: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    padding: 3,
    gap: 2,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: { fontSize: 12 },
  pressed: { opacity: 0.7 },
});
