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
//   3 → Karışık          2 küçük (sol) + 1 büyük (orta) + 2 küçük (sağ)
//   4 (ve tanımsız) → Yığın   üst üste devrilmiş 5 afiş
//
// NEDEN ORTAK: seçim tek bir ayar ama iki yüzeyde çiziliyordu; kopya JSX
// sessizce ayrışıp aynı listeyi profilde "karışık", Listelerim'de "yığın"
// gösterirdi. 1 ve 2'nin ölçüleri blok GENİŞLİĞİNDEN türetilir (verilen alanı
// doldururlar); 3 ve 4'ünki blok YÜKSEKLİĞİNDEN türetilir (afişler küçültülmez,
// bkz. getNaturalCoverWidth) — çağıran ekran kart kutusunu buna göre büyütür.
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
// En dıştaki afişler tam kart kenarına dayanmasın diye yelpazenin iki yanına
// bırakılan küçük nefes payı.
const STACK_SIDE_MARGIN = 6;

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

// Karışık (3) ve Yığın (4) afiş boyutunu WIDTH'ten değil HEIGHT'tan türetir
// (bkz. aşağıdaki gridStyle blokları) — bu yüzden afişleri küçültmeden
// sığdırmak için gereken DOĞAL genişlik, verilen alandan BAĞIMSIZ hesaplanabilir.
// Çağıran ekran (ProfileLists / ListsViewScreen) kart kutusunu bu genişliğe
// göre büyütür; 1 ve 2'nin doğal genişliği yok (verilen alanı doldururlar).
export function getNaturalCoverWidth(gridStyle, height) {
  if (gridStyle === 3) {
    const bigW = height / STACK_RATIO;
    return bigW * 2 + GAP * 2; // büyük + 2×(büyük/2 boyutunda küçük) + 2 boşluk
  }
  if (gridStyle !== 1 && gridStyle !== 2) {
    const w = height / STACK_RATIO;
    // afiş + 2×dıştaki_kayma (dıştaki kayma = 2×STACK_OFFSET) + iki yandaki nefes payı
    return w + STACK_OFFSET * 4 + STACK_SIDE_MARGIN * 2;
  }
  return null;
}

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
    // Karışık: iki küçük (sol) + bir büyük (orta) + iki küçük (sağ) — 5 afiş.
    // Büyük afiş bloğun İÇİNDE kaldığından (dört dış köşe küçüklerde), köşeleri
    // bloğun dış köşesi değilken hep kare kalır (cornerStyle'a {} verilir).
    // Boyut HEIGHT'tan türetilir (bkz. getNaturalCoverWidth); width yalnız kart
    // gerçekten dar kalırsa devreye giren bir GÜVENLİK sınırıdır.
    const bigW = Math.min(height / STACK_RATIO, (width - GAP * 2) / 2);
    const smallW = bigW / 2;
    const smallH = (height - GAP) / 2;
    content = (
      <View style={styles.row}>
        <View style={styles.stackRows}>
          <Cover
            {...common}
            item={ordered[1]}
            width={smallW}
            height={smallH}
            corners={cornerStyle(allCornersRounded, { tl: true })}
          />
          <Cover
            {...common}
            item={ordered[2]}
            width={smallW}
            height={smallH}
            corners={cornerStyle(allCornersRounded, { bl: true })}
          />
        </View>
        <Cover
          {...common}
          item={ordered[0]}
          width={bigW}
          height={height}
          corners={cornerStyle(allCornersRounded, {})}
        />
        <View style={styles.stackRows}>
          <Cover
            {...common}
            item={ordered[3]}
            width={smallW}
            height={smallH}
            corners={cornerStyle(allCornersRounded, { tr: true })}
          />
          <Cover
            {...common}
            item={ordered[4]}
            width={smallW}
            height={smallH}
            corners={cornerStyle(allCornersRounded, { br: true })}
          />
        </View>
      </View>
    );
  } else {
    // Yığın: afiş yüksekliğe göre ölçülür, dar kartta genişliği aşmasın diye
    // ayrıca kısıtlanır; devrilme kaymaları kalan boşluğu geçmez. 5 afiş simetrik
    // bir yelpazede: orta (i=0) en önde, yanındaki çift (i=1,2) bir adım geride,
    // en dıştaki çift (i=3,4) iki adım geride açılır.
    const w = Math.min(height / STACK_RATIO, width * 0.55);
    const maxOffset = Math.max(0, (width - w) / 2);
    // Adım (step) ÜÇLÜ gösterimdeki kaymayla AYNI (STACK_OFFSET); dıştaki çift
    // aynı oranda iki kat uzağa açılır. width dar kalırsa ikisi de sığacak
    // şekilde küçülür (güvenlik sınırı) — kart doğru boyuttaysa hiç devreye girmez.
    const step = Math.min(STACK_OFFSET, maxOffset);
    const outerOffset = Math.min(STACK_OFFSET * 2, maxOffset);
    const angles = [0, -6, 6, -12, 12];
    const offsets = [0, -step, step, -outerOffset, outerOffset];
    const zIndexes = [5, 4, 4, 3, 3];
    // Bu düzendeki her afiş bağımsız/yüzen bir kart olduğundan (bitişik bir
    // blok oluşturmadığından) dördü de her zaman "ayrı köşeli" gibi yuvarlanır.
    const corners = cornerStyle(allCornersRounded, {
      tl: true,
      tr: true,
      bl: true,
      br: true,
    });
    content = (
      <View style={[styles.stackWrap, { width, height }]}>
        {[4, 3, 2, 1, 0].map((i) => {
          // Gerçek bir afiş varsa kenarlık kaldırılır; boş (yer tutucu) kutuda
          // kenarlık şu anki hâlindeki gibi kalır.
          const hasImage = !!ordered[i]?.imagePath;
          return (
            // Çerçeve ayrı bir View: kenarlık + overflow doğrudan afişe verilince
            // Android'de köşeler kırpılmıyor.
            <View
              key={i}
              style={[
                styles.stackItem,
                corners,
                { borderColor: theme.border, borderWidth: hasImage ? 0 : 1 },
                {
                  width: w,
                  height,
                  transform: [{ rotate: `${angles[i]}deg` }, { translateX: offsets[i] }],
                  zIndex: zIndexes[i],
                },
              ]}
            >
              <Cover {...common} item={ordered[i]} width="100%" height="100%" corners={corners} />
            </View>
          );
        })}
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
  },
});
