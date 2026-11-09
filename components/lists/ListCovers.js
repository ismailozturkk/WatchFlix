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
//  12 → Odak             ortadaki tam boy afiş, iki yanda kısa afişler — 1 ile AYNI
//  13 → Dağınık          açılışta rastgele yerleşen beş küçük afiş — 1 ile AYNI
//  14 → DVD Kutuları     rafta duran üç 3B plastik DVD kutusu — 1 ile AYNI
//
// 5–14 sonradan eklendi; boyut hesabında bir "eş" düzen gibi davranırlar
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
import { LinearGradient } from "expo-linear-gradient";
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
  FOCUS: 12,
  SCATTER: 13,
  FLOW: 14,
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
    case LIST_LAYOUT.FOCUS:
    case LIST_LAYOUT.SCATTER:
    case LIST_LAYOUT.FLOW:
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

// Üst üste binen düzenlerde (Dağınık, Polaroid, Vitrin, Yığın) afişi OLAN yuva her
// zaman boş yuvaların ÜSTÜNDE çizilir: 2–3 içerikli listede boş kutu zaten az olan
// afişlerin üstüne çıkmasın (kullanıcı kuralı, 9 Kas). Kendi aralarındaki sıra
// (düzenin z değeri) korunur; yalnız afişliler bir kat yukarı alınır.
const POSTER_Z_LIFT = 10;
export const coverZ = (item, z) => (hasPoster(item) ? z + POSTER_Z_LIFT : z);

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

// Dağınık düzenin yerleşimi her açılışta bir kez üretilir (kullanıcı kuralı, 9 Kas):
//   • blok yatayda 5 SÜTUNA bölünür; her afişin ORTASI kendi sütununda rastgele bir
//     yere düşer (komşu sütuna en çok sütun genişliğinin %10'u kadar taşabilir),
//   • dikeyde serbesttir (yukarı / aşağı rastgele),
//   • afişler kartı boş bırakmayacak kadar büyüktür (blok yüksekliğinin ~%64'ü), kenarlıksız,
//     boyları hafifçe farklıdır,
//   • iki afiş birbirine küçük olanın alanının hedefte en çok %15'i, HİÇBİR ZAMAN
//     %50'den fazlası kadar biner,
//   • hafif açı ve rastgele üst-alt sırası doğallık katar.
// Hangi afişin hangi sütuna düşeceği de karışıktır (ilk afiş hep solda kalmaz).
export const SCATTER_COLUMNS = 5;
export const SCATTER_TARGET_OVERLAP = 0.15; // küçük afişin alanına oranla
export const SCATTER_MAX_OVERLAP = 0.5;
export const SCATTER_COLUMN_SPILL = 0.1; // sütun genişliğine oranla
const SCATTER_MARGIN = 7;
const SCATTER_MAX_ANGLE = 9;
const SCATTER_HEIGHT_SHARE = 0.64; // afiş boyu / kullanılabilir yükseklik
const SCATTER_SCALE = [0.92, 1.06];

const shuffled = (values, random) => {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const overlapArea = (a, b) =>
  Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

// Sütunlar afişin kendisine değil ORTASINA göredir: ortaların gezebileceği alan
// (kenardan yarım afiş içeride) beşe bölünür — böylece kenar sütunlarında da
// oynama payı kalır ve komşular birbirinin üstüne yığılmaz.
export function scatterColumns(width, height) {
  const m = SCATTER_MARGIN;
  const innerW = width - m * 2;
  const innerH = height - m * 2;
  // Taban boy yükseklikten; dar kartta 5 afiş yan yana sığacak kadarla sınırlı.
  const baseH = Math.max(0, Math.min(innerH * SCATTER_HEIGHT_SHARE, (innerW / 3) * STACK_RATIO));
  const baseW = baseH / STACK_RATIO;
  const colW = Math.max(0, innerW - baseW) / SCATTER_COLUMNS;
  return { baseH, centerStart: m + baseW / 2, colW, spill: colW * SCATTER_COLUMN_SPILL };
}

// Saf: verilen blok için beş afişin dikdörtgeni (afiş sırasıyla). Test edilir.
export function createScatterLayout(width, height, random = Math.random) {
  const m = SCATTER_MARGIN;
  const innerH = height - m * 2;
  const { baseH, centerStart, colW, spill } = scatterColumns(width, height);
  const columns = shuffled([0, 1, 2, 3, 4], random);
  const layers = shuffled([1, 2, 3, 4, 5], random);
  const placed = [];
  const byColumn = [];
  const worstOverlap = (rect) =>
    Math.max(
      0,
      ...placed.map((p) => overlapArea(rect, p) / (Math.min(rect.width * rect.height, p.width * p.height) || 1)),
    );
  for (let column = 0; column < SCATTER_COLUMNS; column++) {
    const scale = SCATTER_SCALE[0] + random() * (SCATTER_SCALE[1] - SCATTER_SCALE[0]);
    const posterH = Math.min(innerH, baseH * scale);
    const posterW = posterH / STACK_RATIO;
    // Afişin ORTASI bu aralıkta: kendi sütunu ± %10 taşma; afiş kartın dışına çıkmaz.
    const minLeft = Math.max(m, centerStart + column * colW - spill - posterW / 2);
    const maxLeft = Math.min(width - m - posterW, centerStart + (column + 1) * colW + spill - posterW / 2);
    const maxTop = Math.max(0, innerH - posterH);
    const rectAt = (u, v) => ({
      left: minLeft + u * Math.max(0, maxLeft - minLeft),
      top: m + v * maxTop,
      width: posterW,
      height: posterH,
    });
    // Rastgele adaylar: hedefin (%15) altında kalan ilk aday alınır.
    let best = null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const rect = rectAt(random(), random());
      const worst = worstOverlap(rect);
      if (!best || worst < best.worst) best = { rect, worst };
      if (worst <= SCATTER_TARGET_OVERLAP) break;
    }
    // Şanssız kalırsa ızgarada en az binen konum: %50 tavanı hiçbir zaman aşılmaz.
    if (best.worst > SCATTER_MAX_OVERLAP) {
      for (let gx = 0; gx <= 8; gx++) {
        for (let gy = 0; gy <= 8; gy++) {
          const rect = rectAt(gx / 8, gy / 8);
          const worst = worstOverlap(rect);
          if (worst < best.worst) best = { rect, worst };
        }
      }
    }
    placed.push(best.rect);
    byColumn[column] = best.rect;
  }
  return columns.map((column, i) => ({
    ...byColumn[column],
    column,
    angle: (random() * 2 - 1) * SCATTER_MAX_ANGLE,
    z: layers[i],
  }));
}

const scatterLayouts = new Map();
const scatterLayoutFor = (ordered, width, height) => {
  const key = `${Math.round(width)}x${Math.round(height)}|${ordered
    .slice(0, 5)
    .map((item) => `${item?.type ?? ""}:${item?.id ?? ""}:${item?.imagePath ?? ""}`)
    .join("|")}`;
  if (!scatterLayouts.has(key)) {
    // Konumlar uygulama oturumunda aynı listeye dönünce korunur; sonraki açılışta yenilenir.
    if (scatterLayouts.size >= 100) scatterLayouts.delete(scatterLayouts.keys().next().value);
    scatterLayouts.set(key, createScatterLayout(width, height));
  }
  return scatterLayouts.get(key);
};

const ScatterCovers = ({ ordered, width, height, common, radius }) => {
  const rects = scatterLayoutFor(ordered, width, height);
  const corners = { borderRadius: radius(6) };
  return (
    <View style={{ width, height }}>
      {rects.map((rect, i) => (
        <View
          key={i}
          style={[
            styles.scatterItem,
            corners,
            {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              zIndex: coverZ(ordered[i], rect.z),
              transform: [{ rotate: `${rect.angle.toFixed(1)}deg` }],
            },
          ]}
        >
          <Cover {...common} item={ordered[i]} width="100%" height="100%" corners={corners} />
        </View>
      ))}
    </View>
  );
};

// ── Akış → DVD KUTULARI ───────────────────────────────────────────────────────
// Eski film DVD'lerinin plastik kutusu (Amaray tipi): 135×190 mm ön yüz, 14 mm
// sırt, siyah polipropilen gövde, ön yüzde afişi tutan şeffaf kılıf ve sırt
// tarafında menteşe oluğu. Üç kutu rafta durur gibi dizilir: ortada ilk afiş
// hafif dönük, iki yandakiler daha çok dönük — soldakinin SIRTI (afişin dilimi
// basılı), sağdakinin AÇILAN KENARI görünür.
//
// 3B: her kutu iki düz yüzdür (ön + sırt/kenar). İkisi de ORTAK KENARLARI
// çevresinde (transformOrigin) perspective + rotateY ile döner; aynı noktadan
// izdüşüldükleri için kenarda kusursuz birleşir, uzak kenar perspektifle kısalır.
// rotateY işareti iki platformda aynıdır (Android MatrixMathHelper.applyRotateY ·
// iOS CATransform3DRotate): + açıda başlangıç noktasının SAĞI uzaklaşır.
const DVD_RATIO = 190 / 135; // yükseklik / ön yüz genişliği
const DVD_DEPTH = 14 / 135; // sırt kalınlığı / ön yüz genişliği
const DVD_PERSPECTIVE = 3.2; // göz uzaklığı, ön yüz genişliği cinsinden
const DVD_SLOTS = [
  // item: ordered dizini · angle: + sağa bakar (sırt solda görünür), − sola bakar (kenar sağda)
  { item: 1, angle: 46, z: 1 },
  { item: 0, angle: 18, z: 3 },
  { item: 2, angle: -46, z: 2 },
];

// Kutunun ortak kenara göre ekrandaki yatay izdüşümü (W = 1 birim).
// Yerel x'teki bir nokta α açısıyla döner: X = x·cosα / (1 + x·sinα / P).
const dvdProjectX = (x, alphaDeg, P) => {
  const a = (alphaDeg * Math.PI) / 180;
  return (x * Math.cos(a)) / (1 + (x * Math.sin(a)) / P);
};
// Bir kutunun yüzleri: ön yüz ve yan yüz, ortak kenara göre (birim genişlikte).
function dvdFaces(angle) {
  const P = DVD_PERSPECTIVE;
  const D = DVD_DEPTH;
  if (angle >= 0) {
    // Ortak kenar ön yüzün SOLU (menteşe/sırt).
    return {
      shared: "left",
      sideKind: "spine",
      sideAngle: angle - 90,
      minX: dvdProjectX(-D, angle - 90, P),
      maxX: dvdProjectX(1, angle, P),
    };
  }
  // Ortak kenar ön yüzün SAĞI (açılan kenar).
  return {
    shared: "right",
    sideKind: "edge",
    sideAngle: angle + 90,
    minX: dvdProjectX(-1, angle, P),
    maxX: dvdProjectX(D, angle + 90, P),
  };
}

// Verilen bloğa sığan üç kutunun ölçüsü ve yerleşimi (saf; test edilir).
export function dvdShelfLayout(width, height) {
  const margin = 4;
  const minGap = 3;
  const shadowPad = 5;
  const faces = DVD_SLOTS.map((slot) => dvdFaces(slot.angle));
  const unitW = faces.reduce((sum, f) => sum + (f.maxX - f.minX), 0);
  const byWidth = (width - margin * 2 - minGap * (DVD_SLOTS.length - 1)) / unitW;
  const byHeight = (height - shadowPad - margin) / DVD_RATIO;
  const W = Math.max(0, Math.min(byWidth, byHeight));
  const H = W * DVD_RATIO;
  const D = W * DVD_DEPTH;
  const P = W * DVD_PERSPECTIVE;
  const spans = faces.map((f) => (f.maxX - f.minX) * W);
  const lefts = [margin, (width - spans[1]) / 2, width - margin - spans[2]];
  const top = height - shadowPad - H;
  return DVD_SLOTS.map((slot, i) => {
    const f = faces[i];
    const edgeX = lefts[i] - f.minX * W; // ortak kenarın ekran x'i
    const front = f.shared === "left"
      ? { left: edgeX, origin: "left" }
      : { left: edgeX - W, origin: "right" };
    const side = f.shared === "left"
      ? { left: edgeX - D, origin: "right" }
      : { left: edgeX, origin: "left" };
    return {
      ...slot,
      W,
      H,
      D,
      P,
      top,
      edgeX,
      spanLeft: lefts[i],
      span: spans[i],
      floorY: height - shadowPad,
      front: { ...front, width: W, rotate: slot.angle },
      side: { ...side, width: D, rotate: f.sideAngle, kind: f.sideKind },
    };
  });
}

// Kutunun tek yüzü: dışta döndürülen kap (kırpmaz), içte kırpan plastik gövde.
// Gölge kabın içinde alt kenarın hemen ALTINDA durur — aynı dönüşü aldığı için
// kutunun perspektifle eğilen alt kenarını birebir izler (düz bir çubuk gibi taşmaz).
const DvdFace = ({ f, layout, testID, rounded, children }) => {
  const { top, H, P, z } = layout;
  return (
    <View
      testID={testID}
      style={{
        position: "absolute",
        left: f.left,
        top,
        width: f.width,
        height: H,
        zIndex: z,
        transformOrigin: `${f.origin} center`,
        transform: [{ perspective: P }, { rotateY: `${f.rotate.toFixed(2)}deg` }],
      }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.5)", "rgba(0,0,0,0)"]}
        style={[styles.dvdContactShadow, { top: H - 0.5, height: Math.max(3, H * 0.05) }]}
      />
      <View style={[styles.dvdFace, { borderRadius: rounded }]}>{children}</View>
    </View>
  );
};

const DvdCase = ({ layout, item, common, radius }) => {
  const { front, side, angle, H } = layout;
  const turn = Math.abs(Math.sin((angle * Math.PI) / 180));
  // Işık soldan: sağa bakan yüz aydınlık, sola bakan gölgede.
  const frontShade = angle >= 0 ? 0.03 + 0.08 * turn : 0.1 + 0.24 * turn;
  const lip = Math.max(1, H * 0.022);
  const faceRadius = radius(2.5);
  const Face = DvdFace;
  return (
    <>
      <Face f={side} layout={layout} testID={side.kind === "spine" ? "dvd-spine" : "dvd-edge"} rounded={faceRadius / 2}>
        {side.kind === "spine" ? (
          // Sırt baskısı: afişin orta dilimi, koyu plastiğin altında; üstte ve altta plastik kapak.
          <>
            <Cover {...common} item={item} width="100%" height="100%" corners={null} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]} />
            <View style={[styles.dvdSpineCap, { top: 0, height: lip * 1.6 }]} />
            <View style={[styles.dvdSpineCap, { bottom: 0, height: lip * 1.6 }]} />
          </>
        ) : (
          // Açılan kenar: düz plastik, ortada kapanma oluğu.
          <>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.35)" }]} />
            <View style={[styles.dvdEdgeGroove, { left: "46%" }]} />
          </>
        )}
        {/* Kılıfın şeffaf kenarı: ön yüzle birleşen köşede ince bir ışık. */}
        <View style={[styles.dvdEdgeShine, side.kind === "spine" ? { right: 0 } : { left: 0 }]} />
      </Face>
      <Face f={front} layout={layout} testID="dvd-front" rounded={faceRadius}>
        {/* Şeffaf kılıfın altındaki afiş: plastik dudak payı kadar içeride. */}
        <View
          style={{
            position: "absolute",
            top: lip,
            bottom: lip,
            left: lip * 0.6,
            right: lip,
            overflow: "hidden",
            borderRadius: faceRadius / 2,
          }}
        >
          <Cover {...common} item={item} width="100%" height="100%" corners={null} />
        </View>
        {/* Menteşe tarafındaki iki kalıp oluğu */}
        <View style={[styles.dvdHinge, { left: "5%" }]} />
        <View style={[styles.dvdHinge, { left: "8.5%" }]} />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${frontShade.toFixed(3)})` }]}
        />
        {/* Kılıfın parlaması: köşeden çapraz bir ışık, karşı köşede hafif yansıma. */}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.26)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0)", "rgba(255,255,255,0.1)"]}
          locations={[0, 0.32, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dvdRim, { borderRadius: faceRadius }]} />
      </Face>
    </>
  );
};

const FlowCovers = ({ ordered, width, height, common, radius }) => {
  const shelf = useMemo(() => dvdShelfLayout(width, height), [width, height]);
  return (
    <View style={{ width, height }}>
      {shelf.map((layout) => (
        <DvdCase key={layout.item} layout={layout} item={ordered[layout.item]} common={common} radius={radius} />
      ))}
    </View>
  );
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
  direction = "right",
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
  } else if (gridStyle === LIST_LAYOUT.FOCUS) {
    // Ortadaki ilk afiş tam boy; yan afişler kısa ve biraz geride. Üçü de
    // mevcut Büyük Kapaklar bloğunun içinde kalır.
    const centerW = Math.min(height / STACK_RATIO, width * 0.44);
    const sideH = height * 0.78;
    const sideW = (width - centerW - GAP * 4) / 2;
    const fullCorners = cornersOf(allCornersRounded, { tl: true, tr: true, bl: true, br: true });
    content = (
      <View style={[styles.row, { width, height, alignItems: "center", justifyContent: "center", gap: GAP * 2 }]}>
        <View style={{ opacity: 0.76 }}>
          <Cover {...common} item={ordered[1]} width={sideW} height={sideH} corners={fullCorners} />
        </View>
        <View style={[styles.focusCenter, { width: centerW, height, borderRadius: R }]}>
          <Cover {...common} item={ordered[0]} width={centerW} height={height} corners={fullCorners} />
        </View>
        <View style={{ opacity: 0.76 }}>
          <Cover {...common} item={ordered[2]} width={sideW} height={sideH} corners={fullCorners} />
        </View>
      </View>
    );
  } else if (gridStyle === LIST_LAYOUT.SCATTER) {
    content = <ScatterCovers ordered={ordered} width={width} height={height} common={common} radius={corner} />;
  } else if (gridStyle === LIST_LAYOUT.FLOW) {
    content = <FlowCovers ordered={ordered} width={width} height={height} common={common} radius={corner} />;
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
    // Vitrin: ilk afiş seçilen yönde önde; sonrakiler öncekinin ARKASINA dizilir
    // ve giderek koyulaşır — derinlik hissi. Afişler KÜÇÜLMEZ (kullanıcı kararı,
    // 9 Kas): beşi de tam boy. Son afiş bloğun karşı kenarına dayanır; adım bundan türetilir.
    const posterW = Math.min(height / STACK_RATIO, width * 0.45);
    const sizes = [0, 1, 2, 3, 4].map(() => ({ h: height, w: posterW }));
    const step = Math.max(0, (width - posterW) / 4);
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
                left: direction === "left" ? width - sizes[i].w - i * step : i * step,
                top: (height - sizes[i].h) / 2,
                width: sizes[i].w,
                height: sizes[i].h,
                zIndex: coverZ(ordered[i], 5 - i),
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
                zIndex: coverZ(ordered[slot.item], slot.z),
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
    const SKEW = direction === "left" ? -12 : 12;
    const extra = height * Math.tan((Math.abs(SKEW) * Math.PI) / 180);
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
                transform: [{ skewX: `${-SKEW}deg` }],
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
                item={ordered[direction === "left" ? 4 - i : i]}
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
    const TILT = direction === "left" ? -14 : 14;
    const rad = (Math.abs(TILT) * Math.PI) / 180;
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
        const shifted = (c + (direction === "left" ? 1 : 0)) % 2 === 1;
        const y = (shifted ? -tileH / 2 : 0) + r * (tileH + wallGap) + tileH / 2 - wallH / 2;
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
              transform: [{ rotate: `${-TILT}deg` }],
            },
          ]}
        >
          {Array.from({ length: cols }, (_, c) => (
            <View key={c} style={{ gap: wallGap, marginTop: (c + (direction === "left" ? 1 : 0)) % 2 ? -tileH / 2 : 0 }}>
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
                  zIndex: coverZ(ordered[i], zIndexes[i]),
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
  focusCenter: {
    overflow: "hidden",
  },
  scatterItem: {
    position: "absolute",
    overflow: "hidden",
  },
  dvdFace: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    backgroundColor: "#0c0c0e",
  },
  dvdContactShadow: {
    position: "absolute",
    left: "3%",
    right: "3%",
  },
  dvdRim: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
  },
  dvdHinge: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(255,255,255,0.14)",
  },
  dvdSpineCap: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#0c0c0e",
  },
  dvdEdgeGroove: {
    position: "absolute",
    top: "6%",
    bottom: "6%",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  dvdEdgeShine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.22)",
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
