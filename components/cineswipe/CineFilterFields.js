// components/cineswipe/CineFilterFields.js
//
// Deste filtreleme sayfası ile oda ayarları sayfasının PAYLAŞTIĞI alanlar:
// kaynak ızgarası, tür çipleri, sayı çipleri, bölüm başlığı. İki sayfa aynı
// kontrolleri aynı davranışla kullanır (önceden iki ayrı kopyaydı).
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import PressableScale from "./PressableScale";
import { categoryLabel, genreLabel } from "./filterLabels";
import { GENRE_OPTIONS, genreSupports } from "../../services/cineswipe/deckModel";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";

export function SectionLabel({ children, colors, style }) {
  return <Text style={[styles.section, { color: colors.textSecondary }, style]}>{children}</Text>;
}

export function Hint({ children, colors }) {
  return (
    <View style={styles.hint}>
      <AppIcon family="Ionicons" name="information-circle-outline" size={14} color={colors.muted} />
      <Text style={[styles.hintText, { color: colors.muted }]}>{children}</Text>
    </View>
  );
}

/** Kaynak seçimi: 2 sütunlu kutucuklar; tek kalan son kutucuk satırı doldurur. */
export function CategoryGrid({ categories, value, onChange, copy, colors }) {
  return (
    <View style={styles.grid}>
      {categories.map((category) => {
        const selected = value === category.id;
        return (
          <PressableScale
            key={category.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={categoryLabel(category.id, copy)}
            onPress={() => {
              if (selected) return;
              triggerHaptic("selection");
              onChange(category.id);
            }}
            style={[
              styles.tile,
              {
                backgroundColor: selected ? alpha(colors.accent, 0.16) : alpha(colors.surface, 0.55),
                borderColor: selected ? colors.accent : "transparent",
              },
            ]}
          >
            <View
              style={[
                styles.tileIcon,
                { backgroundColor: alpha(selected ? colors.accent : colors.textSecondary, 0.14) },
              ]}
            >
              <AppIcon
                family="Ionicons"
                name={category.icon}
                size={18}
                color={selected ? colors.accent : colors.textSecondary}
              />
            </View>
            <Text
              numberOfLines={2}
              style={[
                styles.tileLabel,
                { color: selected ? colors.accent : colors.text, fontWeight: selected ? "800" : "600" },
              ]}
            >
              {categoryLabel(category.id, copy)}
            </Text>
            {selected ? (
              <AppIcon family="Ionicons" name="checkmark-circle" size={17} color={colors.accent} style={styles.tileCheck} />
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Tür çipleri. `mediaType` "tv" iken dizide karşılığı olmayanlar pasif görünür. */
export function GenreChips({ value, onChange, mediaType, disabled = false, copy, colors }) {
  return (
    <View style={[styles.chips, disabled ? styles.dim : null]}>
      {GENRE_OPTIONS.map((genre) => {
        const selected = (value ?? null) === genre.id;
        const unavailable = !genreSupports(genre.id, mediaType);
        const blocked = disabled || unavailable;
        return (
          <PressableScale
            key={String(genre.id)}
            disabled={blocked}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: blocked }}
            onPress={() => {
              if (selected) return;
              triggerHaptic("selection");
              onChange(genre.id);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.accent : alpha(colors.surface, 0.6),
                opacity: unavailable && !disabled ? 0.38 : 1,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: selected ? colors.onAccent : colors.textSecondary }]}>
              {genreLabel(genre.id, copy)}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Kart sayısı gibi tek satırlık sayı seçimi. */
export function CountChips({ options, value, onChange, format, colors }) {
  return (
    <View style={styles.counts}>
      {options.map((option) => {
        const selected = value === option;
        return (
          <PressableScale
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              triggerHaptic("selection");
              onChange(option);
            }}
            style={[
              styles.count,
              {
                backgroundColor: selected ? colors.accent : alpha(colors.surface, 0.6),
              },
            ]}
          >
            <Text style={[styles.countText, { color: selected ? colors.onAccent : colors.text }]}>
              {format(option)}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    marginTop: 18,
    marginBottom: 9,
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 9,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tile: {
    flexGrow: 1,
    flexBasis: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
  tileCheck: {
    position: "absolute",
    top: 6,
    right: 6,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dim: {
    opacity: 0.45,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  counts: {
    flexDirection: "row",
    gap: 8,
  },
  count: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 13,
  },
  countText: {
    fontSize: 13,
    fontWeight: "800",
  },
});
