// components/lists/ListCovers.js
//
// Liste kartının KAPAK BLOĞU — profil rayı (ProfileLists) ve Listelerim ekranı
// (ListsViewScreen) ORTAK kullanır.
//
// Düzen kullanıcının "Liste Görünümü Seçin" modalından seçtiği değerdir
// (ProfileUiContext.gridStyle, cihazda kalıcı):
//
//   1 → Büyük Kapaklar   yan yana 3 afiş
//   5 → Büyük Kapaklar   yan yana 5 afiş — blok 1 ile AYNI genişlikte; afişler
//                        yatayda uzamaz, iki yanından kırpılıp ortası kalır
//   2 → Küçük Kapaklar   4×2 = 8 afiş
//   3 → Karışık          2 küçük (sol) + 1 büyük (orta) + 2 küçük (sağ)
//   4 (ve tanımsız) → Yığın   üst üste devrilmiş 5 afiş
//   6 → Yığın (3'lü)     4 ile AYNI genişlik; arka çift daha dışa açılır
//   7 → Film Şeridi      delikli şerit üzerinde 3 kare — 1 ile AYNI genişlik
//   8 → Vitrin           derinliğe doğru küçülerek dizilen 5 afiş — 1 ile AYNI
//   9 → Polaroid         masaya saçılmış gibi hafif dönük 3 fotoğraf — 1 ile AYNI
//  10 → Diyagonal        eğik kesilmiş 5 dilim, bitişik bir pano — 1 ile AYNI
//  11 → Afiş Duvarı      yatırılmış, tuğla örgülü 4 sütunlu afiş duvarı — 1 ile AYNI
//
// 5–11 sonradan eklendi; boyut hesabında bir "eş" düzen gibi davranırlar
// (bkz. getSizingStyle) — kart genişliği düzenler arasında zıplamaz.
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
import usePosterUri from "../../hooks/usePosterUri";
import usePosterCorner from "@hooks/usePosterCorner";

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
// `radius`: RADIUS'un Kütüphane köşe ayarıyla ölçeklenmiş hâli (hooks/usePosterCorner).
const cornerStyle = (allRounded, { tl, tr, bl, br }, radius = RADIUS) =>
  allRounded
    ? { borderRadius: radius }
    : {
        borderTopLeftRadius: tl ? radius : 0,
        borderTopRightRadius: tr ? radius : 0,
        borderBottomLeftRadius: bl ? radius : 0,
        borderBottomRightRadius: br ? radius : 0,
      };

// Karışık (3) ve Yığın (4) afiş boyutunu WIDTH'ten değil HEIGHT'tan türetir
// (bkz. aşağıdaki gridStyle blokları) — bu yüzden afişleri küçültmeden
// sığdırmak için gereken DOĞAL genişlik, verilen alandan BAĞIMSIZ hesaplanabilir.
// Çağıran ekran (ProfileLists / ListsViewScreen) kart kutusunu bu genişliğe
// göre büyütür; 1 ve 2'nin doğal genişliği yok (verilen alanı doldururlar).
// Düzen kimlikleri — seçici ve çağıran ekranlar sayı yerine bunları kullanır.
export const LIST_LAYOUT = Object.freeze({
  BIG: 1,
  SMALL: 2,
  MIXED: 3,
  STACK: 4,
  BIG_5: 5,
  STACK_3: 6,
  FILMSTRIP: 7,
  SHOWCASE: 8,
  POLAROID: 9,
  DIAGONAL: 10,
  WALL: 11,
});

// Afiş sayısı seçilebilen düzen aileleri: { 3: id, 5: id }.
export const LAYOUT_COUNT_VARIANTS = Object.freeze({
  big: Object.freeze({ 3: LIST_LAYOUT.BIG, 5: LIST_LAYOUT.BIG_5 }),
  stack: Object.freeze({ 3: LIST_LAYOUT.STACK_3, 5: LIST_LAYOUT.STACK }),
});

// Boyut hesabında hangi temel düzenin ölçüsünü kullanacağı. Kart genişliği bu
// eşe göre verilir: 3/5 seçimi ve yeni düzenler kartı daraltıp genişletmez.
export function getSizingStyle(gridStyle) {
  switch (gridStyle) {
    case LIST_LAYOUT.BIG_5:
    case LIST_LAYOUT.FILMSTRIP:
    case LIST_LAYOUT.SHOWCASE:
    case LIST_LAYOUT.POLAROID:
    case LIST_LAYOUT.DIAGONAL:
    case LIST_LAYOUT.WALL:
      return LIST_LAYOUT.BIG;
    case LIST_LAYOUT.STACK_3:
      return LIST_LAYOUT.STACK;
    default:
      return gridStyle;
  }
}

export function getNaturalCoverWidth(rawGridStyle, height) {
  const gridStyle = getSizingStyle(rawGridStyle);
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

// Afişi olan öğe: TMDB yolu ya da paketli yerel kaynak (görünüm seçicisinin
// örnek afişleri, bkz. ProfileLists) — yer tutucu kenarlığı buna bakar.
const hasPoster = (item) => !!(item?.imagePath || item?.localSource);

const Cover = ({ item, width, height, corners, theme }) => {
  // Özel afiş: liste sahibinin (arkadaş profilinde PosterChoicesScope) ya da kendi seçimin.
  const posterUri = usePosterUri();
  const box = [{ width, height }, corners];
  if (item?.localSource) {
    return <Image source={item.localSource} style={box} />;
  }
  const uri = posterUri(item?.type, item?.id, item?.imagePath);
  if (uri) {
    return (
      <Image source={{ uri }} style={box} />
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
  // Ayarlar > Poster görünümü > Kütüphane: tüm düzenlerin köşeleri aynı çarpanla.
  const corner = usePosterCorner("library");
  const R = corner(RADIUS);
  const cornersOf = (allRounded, sides) => cornerStyle(allRounded, sides, R);

  let content = null;

  if (gridStyle === 1 || gridStyle === LIST_LAYOUT.BIG_5) {
    // 5'li gösterimde blok genişliği 3'lüyle aynı kalır; her afiş daha dar bir
    // kutuya düşer ve expo-image'ın varsayılan `cover` kırpması onu yatayda
    // uzatmadan iki yanından keser — ortası görünür.
    const count = gridStyle === 1 ? 3 : 5;
    const w = (width - GAP * (count - 1)) / count;
    content = (
      <View style={styles.row}>
        {Array.from({ length: count }, (_, i) => i).map((i) => (
          <Cover
            key={i}
            {...common}
            item={ordered[i]}
            width={w}
            height={height}
            corners={cornersOf(allCornersRounded, {
              tl: i === 0,
              bl: i === 0,
              tr: i === count - 1,
              br: i === count - 1,
            })}
          />
        ))}
      </View>
    );
  } else if (gridStyle === LIST_LAYOUT.FILMSTRIP) {
    // Film Şeridi: koyu bir şerit, üstte ve altta delik sırası, arada 3 kare.
    // Delikler kartın kendi rengiyle (theme.secondary) boyanır — şerit
    // "delinmiş" görünür. Kareler aynı `cover` kırpmasıyla doldurulur.
    const band = Math.max(8, Math.round(height * 0.12));
    const frameH = height - band * 2;
    const framePad = 4;
    const frameGap = 4;
    const frameW = (width - framePad * 2 - frameGap * 2) / 3;
    const holeW = Math.max(4, Math.round(band * 0.6));
    const holeH = Math.max(3, Math.round(band * 0.45));
    const holeCount = Math.max(1, Math.floor((width - 4) / (holeW + holeW * 0.9)));
    const holes = (
      <View style={[styles.filmHoles, { height: band }]}>
        {Array.from({ length: holeCount }, (_, i) => (
          <View
            key={i}
            style={{
              width: holeW,
              height: holeH,
              borderRadius: 1.5,
              backgroundColor: theme?.secondary || "#2c2c2e",
            }}
          />
        ))}
      </View>
    );
    const frameCorners = allCornersRounded ? { borderRadius: corner(4) } : null;
    content = (
      <View
        style={[
          styles.filmStrip,
          { width, height },
          cornersOf(allCornersRounded, { tl: true, tr: true, bl: true, br: true }),
        ]}
      >
        {holes}
        <View style={[styles.row, { gap: frameGap, paddingHorizontal: framePad }]}>
          {[0, 1, 2].map((i) => (
            <Cover
              key={i}
              {...common}
              item={ordered[i]}
              width={frameW}
              height={frameH}
              corners={frameCorners}
            />
          ))}
        </View>
        {holes}
      </View>
    );
  } else if (gridStyle === LIST_LAYOUT.SHOWCASE) {
    // Vitrin: ilk afiş solda tam boy önde; sonrakiler sağa doğru adım adım
    // küçülüp öncekinin ARKASINA dizilir, giderek koyulaşır — derinlik hissi.
    // Son afiş bloğun sağ kenarına dayanır; adım bundan türetilir.
    const SHRINK = 0.085;
    const sizes = [0, 1, 2, 3, 4].map((i) => {
      const h = height * (1 - SHRINK * i);
      return { h, w: Math.min(h / STACK_RATIO, width * 0.45) };
    });
    const step = Math.max(0, (width - sizes[4].w) / 4);
    const corners = cornersOf(allCornersRounded, {
      tl: true,
      tr: true,
      bl: true,
      br: true,
    });
    content = (
      <View style={{ width, height }}>
        {[4, 3, 2, 1, 0].map((i) => (
          <View
            key={i}
            style={[
              styles.showcaseItem,
              corners,
              {
                left: i * step,
                top: (height - sizes[i].h) / 2,
                width: sizes[i].w,
                height: sizes[i].h,
                zIndex: 5 - i,
                borderColor: theme.border,
                borderWidth: hasPoster(ordered[i]) ? 0 : 1,
              },
            ]}
          >
            <Cover {...common} item={ordered[i]} width="100%" height="100%" corners={corners} />
            {i > 0 && (
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${0.1 * i})` }]}
              />
            )}
          </View>
        ))}
      </View>
    );
  } else if (gridStyle === LIST_LAYOUT.POLAROID) {
    // Polaroid: krem çerçeveli (altı kalın) 3 fotoğraf, hafifçe dönük ve üst
    // üste saçılmış; ortadaki (ilk afiş) en üstte. Dönüşte köşeler taşmasın diye
    // iki yana küçük bir pay bırakılır.
    const frameH = height * 0.9;
    const pad = Math.max(3, Math.round(height * 0.035));
    const bottomPad = Math.round(pad * 3.4);
    const photoH = frameH - pad - bottomPad;
    const photoW = Math.min(photoH / STACK_RATIO, width * 0.4);
    const frameW = photoW + pad * 2;
    const inset = Math.round(height * 0.06);
    const step = Math.max(0, (width - inset * 2 - frameW) / 2);
    // Görsel sıra soldan sağa: ordered[1], ordered[0] (orta), ordered[2].
    const slots = [
      { item: 1, rotate: -7, dy: height * 0.04, z: 1 },
      { item: 0, rotate: 2, dy: -height * 0.03, z: 3 },
      { item: 2, rotate: 8, dy: height * 0.05, z: 2 },
    ];
    const frameRadius = corner(allCornersRounded ? 5 : 2);
    content = (
      <View style={{ width, height }}>
        {slots.map((slot, i) => (
          <View
            key={slot.item}
            style={[
              styles.polaroidFrame,
              {
                left: inset + i * step,
                top: (height - frameH) / 2 + slot.dy,
                width: frameW,
                height: frameH,
                padding: pad,
                paddingBottom: bottomPad,
                borderRadius: frameRadius,
                zIndex: slot.z,
                transform: [{ rotate: `${slot.rotate}deg` }],
              },
            ]}
          >
            <Cover
              {...common}
              item={ordered[slot.item]}
              width={photoW}
              height={photoH}
              corners={{ borderRadius: allCornersRounded ? corner(3) : 0 }}
            />
          </View>
        ))}
      </View>
    );
  } else if (gridStyle === LIST_LAYOUT.DIAGONAL) {
    // Diyagonal: blok eğik kesilmiş 5 dilime bölünür. Her dilim skewX ile
    // paralelkenar olur ve taşanı kırpar; içindeki afiş ters yönde eğilip düz
    // durur (kırpma `cover`la ortadan). Dış dilimler bloğun kenarından taşar,
    // bloğun kendi overflow'u keser — kenarlar dik kalır.
    const SKEW = 12;
    const extra = height * Math.tan((SKEW * Math.PI) / 180);
    // +GAP: son dilimin eğik kenarı sağ köşede boşluk bırakmasın.
    const sliceW = (width + extra + GAP) / 5;
    content = (
      <View
        style={[
          styles.diagonalWrap,
          { width, height },
          cornersOf(allCornersRounded, { tl: true, tr: true, bl: true, br: true }),
        ]}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.diagonalSlice,
              {
                left: -extra / 2 + i * sliceW,
                width: sliceW - GAP,
                height,
                transform: [{ skewX: `-${SKEW}deg` }],
              },
            ]}
          >
            <View
              style={{
                position: "absolute",
                left: -extra / 2,
                transform: [{ skewX: `${SKEW}deg` }],
              }}
            >
              <Cover
                {...common}
                item={ordered[i]}
                width={sliceW - GAP + extra}
                height={height}
                corners={null}
              />
            </View>
          </View>
        ))}
      </View>
    );
  } else if (gridStyle === LIST_LAYOUT.WALL) {
    // Afiş Duvarı: küçük afişlerden bir duvar, hafifçe yatırılmış; tek sütunlar
    // yarım afiş aşağı kaymış (tuğla örgüsü). Duvar dönünce köşeler boş kalmasın
    // diye bloktan büyük kurulur, bloğun overflow'u keser. Afişler ORTADAN
    // dışa doğru yerleşir (ilk afiş merkeze en yakın kutuda); liste kısaysa
    // kalan kutular diğer düzenlerdeki gibi aynı boyda boş yer tutucu kalır.
    const TILT = 14;
    const rad = (TILT * Math.PI) / 180;
    const cols = 4;
    const wallGap = 4;
    // 4 sütun, dönmüş bloğu yatayda örtecek kadar geniş afiş.
    const tileH = height * 0.66;
    const tileW = tileH / STACK_RATIO;
    // Dönmüş bloğu örtmek için gereken duvar boyu (+ kaydırma payı).
    const needW = width * Math.cos(rad) + height * Math.sin(rad);
    const needH = width * Math.sin(rad) + height * Math.cos(rad) + tileH;
    const rows = Math.ceil((needH + wallGap) / (tileH + wallGap)) + 1;
    const wallW = Math.max(needW, cols * tileW + (cols - 1) * wallGap);
    const wallH = rows * (tileH + wallGap);
    const perCol = rows + 1;
    const gridW = cols * tileW + (cols - 1) * wallGap;
    // Kutuları duvarın merkezine uzaklığa göre sırala (dönüş merkez etrafında
    // olduğundan uzaklık değişmez) ve afişleri bu sırayla dağıt.
    const slotOf = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < perCol; r++) {
        const x = (wallW - gridW) / 2 + c * (tileW + wallGap) + tileW / 2 - wallW / 2;
        const y = (c % 2 ? -tileH / 2 : 0) + r * (tileH + wallGap) + tileH / 2 - wallH / 2;
        slotOf.push({ c, r, d: x * x + y * y });
      }
    }
    const rank = {};
    slotOf
      .slice()
      .sort((a, b) => a.d - b.d)
      .forEach((slot, i) => {
        rank[`${slot.c}:${slot.r}`] = i;
      });
    const tileCorners = { borderRadius: corner(allCornersRounded ? 4 : 2) };
    content = (
      <View
        style={[
          styles.wallWrap,
          { width, height },
          cornersOf(allCornersRounded, { tl: true, tr: true, bl: true, br: true }),
        ]}
      >
        <View
          style={[
            styles.row,
            {
              position: "absolute",
              gap: wallGap,
              width: wallW,
              height: wallH,
              left: (width - wallW) / 2,
              top: (height - wallH) / 2,
              justifyContent: "center",
              transform: [{ rotate: `-${TILT}deg` }],
            },
          ]}
        >
          {Array.from({ length: cols }, (_, c) => (
            <View key={c} style={{ gap: wallGap, marginTop: c % 2 ? -tileH / 2 : 0 }}>
              {Array.from({ length: perCol }, (_, r) => (
                <Cover
                  key={r}
                  {...common}
                  item={ordered[rank[`${c}:${r}`]]}
                  width={tileW}
                  height={tileH}
                  corners={tileCorners}
                />
              ))}
            </View>
          ))}
        </View>
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
                corners={cornersOf(allCornersRounded, {
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
            corners={cornersOf(allCornersRounded, { tl: true })}
          />
          <Cover
            {...common}
            item={ordered[2]}
            width={smallW}
            height={smallH}
            corners={cornersOf(allCornersRounded, { bl: true })}
          />
        </View>
        <Cover
          {...common}
          item={ordered[0]}
          width={bigW}
          height={height}
          corners={cornersOf(allCornersRounded, {})}
        />
        <View style={styles.stackRows}>
          <Cover
            {...common}
            item={ordered[3]}
            width={smallW}
            height={smallH}
            corners={cornersOf(allCornersRounded, { tr: true })}
          />
          <Cover
            {...common}
            item={ordered[4]}
            width={smallW}
            height={smallH}
            corners={cornersOf(allCornersRounded, { br: true })}
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
    // 3'lü yığın (6) aynı kutuya çizilir; arkadaki çift 5'lideki ilk adımda
    // değil en dıştaki konumda durur — daha dışa açılmış görünür, genişlik aynı.
    const isThree = gridStyle === LIST_LAYOUT.STACK_3;
    const angles = isThree ? [0, -9, 9] : [0, -6, 6, -12, 12];
    const offsets = isThree
      ? [0, -outerOffset, outerOffset]
      : [0, -step, step, -outerOffset, outerOffset];
    const zIndexes = isThree ? [5, 4, 4] : [5, 4, 4, 3, 3];
    const drawOrder = isThree ? [2, 1, 0] : [4, 3, 2, 1, 0];
    // Bu düzendeki her afiş bağımsız/yüzen bir kart olduğundan (bitişik bir
    // blok oluşturmadığından) dördü de her zaman "ayrı köşeli" gibi yuvarlanır.
    const corners = cornersOf(allCornersRounded, {
      tl: true,
      tr: true,
      bl: true,
      br: true,
    });
    content = (
      <View style={[styles.stackWrap, { width, height }]}>
        {drawOrder.map((i) => {
          // Gerçek bir afiş varsa kenarlık kaldırılır; boş (yer tutucu) kutuda
          // kenarlık şu anki hâlindeki gibi kalır.
          const hasImage = hasPoster(ordered[i]);
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
  showcaseItem: {
    position: "absolute",
    overflow: "hidden",
  },
  polaroidFrame: {
    position: "absolute",
    backgroundColor: "#f6f3ec",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  wallWrap: {
    overflow: "hidden",
  },
  diagonalWrap: {
    overflow: "hidden",
  },
  diagonalSlice: {
    position: "absolute",
    top: 0,
    overflow: "hidden",
  },
  filmStrip: {
    backgroundColor: "#0e0e10",
    overflow: "hidden",
    justifyContent: "space-between",
  },
  filmHoles: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
  },
});
