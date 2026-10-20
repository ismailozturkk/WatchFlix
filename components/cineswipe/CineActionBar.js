// components/cineswipe/CineActionBar.js
//
// Kartın altındaki eylem çubuğu: [geri al] [pas] [beğen] [ayrıntı].
// Düğmeler karta oy verdirir (aynı fırlatma animasyonu), basınca yaylanır.
import React from "react";
import { StyleSheet, View } from "react-native";
import AppIcon from "../AppIcon";
import PressableScale from "./PressableScale";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";

function RoundButton({ icon, size, iconSize, color, filled, label, disabled, onPress, colors }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      scaleTo={0.88}
      onPress={onPress}
      style={[
        styles.round,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: filled ? alpha(color, 0.14) : alpha(colors.surface, 0.75),
          borderColor: filled ? color : colors.border,
          borderWidth: filled ? 2 : 1,
          opacity: disabled ? 0.38 : 1,
        },
        filled ? { shadowColor: color } : null,
      ]}
    >
      <AppIcon family="Ionicons" name={icon} size={iconSize} color={filled ? color : colors.textSecondary} />
    </PressableScale>
  );
}

/**
 * @param {boolean} showUndo   Solo'da true; Duo'da boş yer korunur (hizalama bozulmasın).
 * @param {boolean} canUndo
 * @param {boolean} disabled   Oy yazılırken tüm oy düğmeleri pasif.
 */
export default function CineActionBar({
  showUndo,
  canUndo,
  disabled,
  onPass,
  onLike,
  onUndo,
  onInfo,
  copy,
  colors,
}) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {showUndo ? (
          <RoundButton
            icon="arrow-undo"
            size={48}
            iconSize={21}
            label={copy.undoAction}
            disabled={!canUndo || disabled}
            onPress={() => {
              triggerHaptic("selection");
              onUndo();
            }}
            colors={colors}
          />
        ) : null}
      </View>

      <RoundButton
        icon="close"
        size={68}
        iconSize={32}
        color={colors.pass}
        filled
        label={copy.passAction}
        disabled={disabled}
        onPress={onPass}
        colors={colors}
      />
      <RoundButton
        icon="heart"
        size={68}
        iconSize={30}
        color={colors.like}
        filled
        label={copy.likeAction}
        disabled={disabled}
        onPress={onLike}
        colors={colors}
      />

      <View style={styles.side}>
        <RoundButton
          icon="information"
          size={48}
          iconSize={21}
          label={copy.detailsAction}
          onPress={() => {
            triggerHaptic("selection");
            onInfo();
          }}
          colors={colors}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  side: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  round: {
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
});
