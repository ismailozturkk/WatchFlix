// components/favorites/FavoriteSlots.js
//
// Bir kategorinin (film / dizi / oyuncu) 4 yuvalık satırı.
//
//   düzenleme  : dolu yuva = görsel + "×" (kaldır); boş yuva = kesikli "+"
//                (seçiciyi açar). Boş bırakmak geçerli — zorlayan bir şey yok.
//   salt-okuma : yalnız DOLU yuvalar çizilir (profil vitrini); dokununca detay.
//
// Yuva genişliği satırın ÖLÇÜLEN genişliğinden türer (dört eşit sütun): sabit
// piksel değeri dar telefonda taşar, tablette küçük kalır.

import React, { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AuthPressable } from "../auth/AuthKit";
import { alpha } from "../../theme/colors";
import { MAX_FAVORITES } from "../../utils/fourFavorites";
import FavoriteArt from "./FavoriteArt";

const GAP = 10;
const POSTER_RATIO = 1.5;
const TITLE_LINES = 2;
const TITLE_SIZE = 10.5;
// Tam sayı: kesirli satır yüksekliği üçüncü satırın bir kırıntısını görünür bırakıyordu.
const TITLE_LINE_HEIGHT = 13;
const TITLE_BLOCK = TITLE_LINE_HEIGHT * TITLE_LINES + 6;

function FilledSlot({
  kind,
  entry,
  width,
  theme,
  readOnly,
  showTitle,
  radius,
  removeLabel,
  openLabel,
  onRemove,
  onOpen,
}) {
  const height = kind === "people" ? width : Math.round(width * POSTER_RATIO);
  const art = (
    <FavoriteArt path={entry.image} kind={kind} width={width} height={height} radius={radius} />
  );
  return (
    <View style={{ width }}>
      {readOnly ? (
        <AuthPressable
          accessibilityRole="button"
          accessibilityLabel={`${openLabel}: ${entry.title}`}
          onPress={() => onOpen?.(kind, entry)}
          pressedScale={0.96}
        >
          {art}
        </AuthPressable>
      ) : (
        <View>
          {art}
          <AuthPressable
            accessibilityRole="button"
            accessibilityLabel={removeLabel(entry.title)}
            onPress={() => onRemove?.(kind, entry)}
            pressedScale={0.88}
            hitSlop={8}
            containerStyle={styles.removeWrap}
            style={[
              styles.remove,
              { backgroundColor: theme.primary, borderColor: theme.border },
            ]}
          >
            <Ionicons name="close" size={13} color={theme.text.primary} />
          </AuthPressable>
        </View>
      )}
      {showTitle ? (
        <Text
          allowFontScaling={false}
          numberOfLines={TITLE_LINES}
          style={[styles.title, { color: theme.text.secondary, minHeight: TITLE_BLOCK - 6 }]}
        >
          {entry.title}
        </Text>
      ) : null}
    </View>
  );
}

function EmptySlot({ kind, width, theme, accent, active, label, onPress, showTitle }) {
  const height = kind === "people" ? width : Math.round(width * POSTER_RATIO);
  return (
    <View style={{ width }}>
      <AuthPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        pressedScale={0.95}
        style={[
          styles.empty,
          {
            width,
            height,
            borderRadius: kind === "people" ? width / 2 : 12,
            borderColor: active ? alpha(accent, 0.7) : alpha(theme.text.muted, 0.35),
            backgroundColor: active ? alpha(accent, 0.08) : "transparent",
          },
        ]}
      >
        <Ionicons
          name="add"
          size={Math.min(28, Math.round(width * 0.4))}
          color={active ? accent : alpha(theme.text.muted, 0.7)}
        />
      </AuthPressable>
      {showTitle ? <View style={{ minHeight: TITLE_BLOCK }} /> : null}
    </View>
  );
}

/**
 * @param {"movies"|"shows"|"people"} props.kind
 * @param {Array} props.items                kategorideki girişler
 * @param {object} props.theme
 * @param {string} [props.accent]
 * @param {boolean} [props.readOnly=false]
 * @param {boolean} [props.showTitles=true]
 * @param {number} [props.gap]               yuvalar arası boşluk
 * @param {number} [props.maxSlotWidth]      yuva genişliği tavanı (kompakt vitrin);
 *   satır genişse yuvalar büyümez, soldan dizilir
 * @param {number} [props.radius]            poster köşe yarıçapı
 * @param {string} props.addLabel            boş yuvanın erişilebilirlik etiketi
 * @param {(title:string)=>string} props.removeLabel
 * @param {string} [props.openLabel]
 * @param {(kind:string)=>void} [props.onAdd]
 * @param {(kind:string, entry:object)=>void} [props.onRemove]
 * @param {(kind:string, entry:object)=>void} [props.onOpen]
 */
function FavoriteSlots({
  kind,
  items,
  theme,
  accent,
  readOnly = false,
  showTitles = true,
  gap = GAP,
  maxSlotWidth = Infinity,
  radius,
  addLabel,
  removeLabel,
  openLabel = "",
  onAdd,
  onRemove,
  onOpen,
}) {
  const [rowWidth, setRowWidth] = useState(0);
  const slotWidth = rowWidth
    ? Math.min(maxSlotWidth, Math.floor((rowWidth - gap * (MAX_FAVORITES - 1)) / MAX_FAVORITES))
    : 0;
  const list = Array.isArray(items) ? items : [];
  const highlight = accent || theme.accent;
  // Başlık yeri yalnız satırda başlıklı bir yuva VARKEN ayrılır; boş satır
  // (henüz hiç seçilmemiş kategori) altında gereksiz boşluk bırakmasın.
  const reserveTitle = showTitles && list.length > 0;

  return (
    <View
      style={[styles.row, { gap }]}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setRowWidth((current) => (current === next ? current : next));
      }}
    >
      {slotWidth > 0
        ? Array.from({ length: MAX_FAVORITES }, (_, index) => {
            const entry = list[index];
            if (entry) {
              return (
                <FilledSlot
                  key={`f-${entry.id}`}
                  kind={kind}
                  entry={entry}
                  width={slotWidth}
                  theme={theme}
                  readOnly={readOnly}
                  showTitle={showTitles}
                  radius={radius}
                  removeLabel={removeLabel}
                  openLabel={openLabel}
                  onRemove={onRemove}
                  onOpen={onOpen}
                />
              );
            }
            // Salt-okumada boş yuva çizilmez: 2 favorisi olan kişi 2 poster görür.
            if (readOnly) return null;
            return (
              <EmptySlot
                key={`e-${index}`}
                kind={kind}
                width={slotWidth}
                theme={theme}
                accent={highlight}
                // Sıradaki boş yuva vurgulu: "buraya ekle" okunur.
                active={index === list.length}
                label={addLabel}
                onPress={() => onAdd?.(kind)}
                showTitle={reserveTitle}
              />
            );
          })
        : null}
    </View>
  );
}

export default memo(FavoriteSlots);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", minHeight: 40 },
  title: { marginTop: 6, fontSize: TITLE_SIZE, lineHeight: TITLE_LINE_HEIGHT, fontWeight: "700" },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  removeWrap: { position: "absolute", top: -7, right: -7 },
  remove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
});
