// components/lists/ListCovers.js
//
// Liste kartının KAPAK BLOĞU — profil rayı (ProfileLists) ve Listelerim ekranı
// (ListsViewScreen) ORTAK kullanır.
//
// Düzen kullanıcının "Liste Görünümü Seçin" modalından seçtiği değerdir
// (ProfileUiContext.gridStyle, cihazda kalıcı):
//
//   1 → Büyük Kapaklar   yan yana 3 afiş
//   2 → Küçük Kapaklar   4×2 = 8 afiş
//   3 → Karışık          1 büyük + 2 küçük
//   4 (ve tanımsız) → Yığın   üst üste devrilmiş 3 afiş
//
// NEDEN ORTAK: seçim tek bir ayar ama iki yüzeyde çiziliyordu; kopya JSX
// sessizce ayrışıp aynı listeyi profilde "karışık", Listelerim'de "yığın"
// gösterirdi. Ölçüler blok GENİŞLİĞİNDEN türetilir, böylece dar Listelerim
// kartı ile geniş profil kartı aynı düzeni orantılı çizer (profil rayının
// eski sabit ölçüleri —60×112, 37,5×55, 75×112— bu formüllerin çıktısıdır).
//
// Afiş SIRASI utils/listOrder'dan: karttaki ilk üç afiş ile widget'ın ilk üç
// afişi tutmak zorunda (bkz. sortItemsByListOrder).

import React, { useMemo } from "react";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { sortItemsByListOrder } from "@utils/listOrder";

// Afişler arası boşluk ve köşe yarıçapı — iki yüzeyde de aynı.
const GAP = 2;
const RADIUS = 10;
// Yığın düzenindeki afiş oranı (profil rayındaki 75×112 bloktan).
const STACK_RATIO = 112 / 75;
const STACK_OFFSET = 22;

// `allCornersRounded` (Ayarlar: "Ayrı Köşeli Afişler") açıkken her afiş tek tek
// yuvarlanır; kapalıyken yalnız BLOĞUN dış köşeleri yuvarlanıp afişler tek
// parça gibi görünür.
const cornerStyle = (allRounded, { tl, tr, bl, br }) =>
  allRounded
    ? { borderRadius: RADIUS }
    : {
        borderTopLeftRadius: tl ? RADIUS : 0,
        borderTopRightRadius: tr ? RADIUS : 0,
        borderBottomLeftRadius: bl ? RADIUS : 0,
        borderBottomRightRadius: br ? RADIUS : 0,
      };

const Cover = ({ item, width, height, corners, getTmdbUrl, theme }) => {
  const box = [{ width, height }, corners];
  if (item?.imagePath) {
    return (
      <Image source={{ uri: getTmdbUrl(item.imagePath, "poster", 200) }} style={box} />
    );
  }
  return <View style={[...box, { backgroundColor: theme?.primary || "#1c1c1e" }]} />;
};

export default function ListCovers({
  items,
  gridStyle,
  allCornersRounded,
  width,
  height,
  getTmdbUrl,
  theme,
  style,
}) {
  const ordered = useMemo(() => sortItemsByListOrder(items), [items]);
  const common = { getTmdbUrl, theme };

  let content = null;

  if (gridStyle === 1) {
    const w = (width - GAP * 2) / 3;
    content = (
      <View style={styles.row}>
        {[0, 1, 2].map((i) => (
          <Cover
            key={i}
            {...common}
            item={ordered[i]}
            width={w}
            height={height}
            corners={cornerStyle(allCornersRounded, {
              tl: i === 0,
              bl: i === 0,
              tr: i === 2,
              br: i === 2,
            })}
          />
        ))}
      </View>
    );
  } else if (gridStyle === 2) {
    const w = (width - GAP * 3) / 4;
    const h = (height - GAP) / 2;
    content = (
      <View style={styles.stackRows}>
        {[0, 4].map((offset) => (
          <View key={offset} style={styles.row}>
            {[0, 1, 2, 3].map((col) => (
              <Cover
                key={col}
                {...common}
                item={ordered[offset + col]}
                width={w}
                height={h}
                corners={cornerStyle(allCornersRounded, {
                  tl: offset === 0 && col === 0,
                  tr: offset === 0 && col === 3,
                  bl: offset === 4 && col === 0,
                  br: offset === 4 && col === 3,
                })}
              />
            ))}
          </View>
        ))}
      </View>
    );
  } else if (gridStyle === 3) {
    const smallW = (width - GAP) / 3;
    const bigW = smallW * 2;
    const smallH = (height - GAP) / 2;
    content = (
      <View style={styles.row}>
        <Cover
          {...common}
          item={ordered[0]}
          width={bigW}
          height={height}
          corners={cornerStyle(allCornersRounded, { tl: true, bl: true })}
        />
        <View style={styles.stackRows}>
          <Cover
            {...common}
            item={ordered[1]}
            width={smallW}
            height={smallH}
            corners={cornerStyle(allCornersRounded, { tr: true })}
          />
          <Cover
            {...common}
            item={ordered[2]}
            width={smallW}
            height={smallH}
            corners={cornerStyle(allCornersRounded, { br: true })}
          />
        </View>
      </View>
    );
  } else {
    // Yığın: afiş yüksekliğe göre ölçülür, dar kartta genişliği aşmasın diye
    // ayrıca kısıtlanır; devrilme kaymaları kalan boşluğu geçmez.
    const w = Math.min(height / STACK_RATIO, width * 0.55);
    const offset = Math.min(STACK_OFFSET, Math.max(0, (width - w) / 2));
    const angles = [0, -6, 6];
    const offsets = [0, -offset, offset];
    const zIndexes = [3, 2, 1];
    content = (
      <View style={[styles.stackWrap, { width, height }]}>
        {[2, 1, 0].map((i) => (
          // Çerçeve ayrı bir View: kenarlık + overflow doğrudan afişe verilince
          // Android'de köşeler kırpılmıyor.
          <View
            key={i}
            style={[
              styles.stackItem,
              {
                width: w,
                height,
                transform: [{ rotate: `${angles[i]}deg` }, { translateX: offsets[i] }],
                zIndex: zIndexes[i],
              },
            ]}
          >
            <Cover {...common} item={ordered[i]} width="100%" height="100%" />
          </View>
        ))}
      </View>
    );
  }

  return <View style={[{ width, height }, styles.center, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: GAP },
  stackRows: { gap: GAP },
  stackWrap: { alignItems: "center", justifyContent: "center" },
  stackItem: {
    position: "absolute",
    overflow: "hidden",
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
});
