// components/chat/PosterStrip.js
//
// Sohbet balonlarındaki afiş şeridi: ilk ÜÇ afiş + (içerik uzunsa) dördüncü
// yuvada üst üste binmiş kartlardan oluşan YIĞIN ve üzerinde kalan adet ("+12").
// Liste (SharedListMessage) ve gönderi (SharedPostMessage) balonları ortak
// kullanır: aynı içerik, aynı biçim.
//
// Şerit HİÇBİR ZAMAN uzamaz: kalan içerik balonda açılmaz, yığına basınca tam
// görünüm (SharedListSheet / gönderi detayı) açılır. Böylece uzun içerik sohbeti
// aşağı kaydırmaz ve balon yüksekliği öğe sayısından bağımsızdır.
//
// Yerleşim ölçüleri `stripLayout(total)` ile hesaplanır; kapsayan balon aynı
// sonucu başlık/eylem genişliği için kullanır (bu yüzden dışarıya verilir).

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { PosterEdge } from "./shareKit";

const { width: SCREEN_W } = Dimensions.get("window");
const GAP = 8;
const POSTER_RADIUS = 12;
export const STRIP_SHOWN = 3; // düz afiş sayısı; dördüncü yuva yığındır
const SLOTS = STRIP_SHOWN + 1;

// Poster şeridinin toplam genişliği: SharedMediaCollection ile aynı hedef.
const STRIP_TARGET = Math.min(SCREEN_W * 0.74, 330);

// Dar ekranda (320 dp) balonun iç genişliği ~266 dp: dört yuva + boşluk + yığının
// sağa taşan kısmı bunu aşmasın (Yoga ölçümüyle doğrulandı).
const MIN_CARD_W = 56;
const MAX_CARD_W = 96;
// Yığının arkadaki kartları sağa/yukarı taşar; o pay yerleşimde AYRILIR (dönüşüm
// Yoga'da yer kaplamaz, ayrılmazsa kart balon kenarını keser).
const STACK_BLEED = 12;
// Başlık / eylem bloğunun alt genişliği: 1–2 öğede şerit dar kalır, başlık o dar
// sütuna sıkışıp 3–4 satıra uzamasın.
const MIN_BLOCK_W = 220;

/** Şerit düzeni: az öğede büyük afiş, dört yuvada dar. Genişlik hep hesaplanır. */
export function stripLayout(total) {
  const hasStack = total > STRIP_SHOWN;
  const cols = hasStack ? SLOTS : Math.max(1, total);
  const bleed = hasStack ? STACK_BLEED : 0;
  // Çift genişlik: yükseklik (1,5 x) tam sayı kalır → kutu TAM 2:3, `cover`
  // afişi kırpmaz (tek genişlikte yükseklik yukarı yuvarlanıp 0,5 dp kırpıyordu).
  const fit = Math.floor((STRIP_TARGET - bleed - GAP * (cols - 1)) / cols / 2) * 2;
  const cardW = Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, fit));
  const width = cardW * cols + GAP * (cols - 1) + bleed;
  return { cols, cardW, hasStack, width, blockWidth: Math.max(width, MIN_BLOCK_W) };
}

export function PosterFace({ item, width, height, getTmdbUrl, palette, dim = 0 }) {
  return (
    <View style={[styles.posterBox, { width, height, backgroundColor: palette.posterBg }]}>
      {item?.poster_path ? (
        <Image
          source={{ uri: getTmdbUrl(item.poster_path, "poster", 200) }}
          style={styles.fill}
          cachePolicy="memory-disk"
          transition={120}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.fill, styles.center]}>
          <Ionicons name="film-outline" size={20} color={palette.muted} />
        </View>
      )}
      {dim > 0 && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dim})` }]} />
      )}
      <PosterEdge radius={POSTER_RADIUS} color={palette.posterEdge} />
    </View>
  );
}

function StripCard({ item, cardW, getTmdbUrl, palette, onPress, dim }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{ width: cardW }}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <PosterFace
        item={item}
        width={cardW}
        height={Math.round(cardW * 1.5)}
        getTmdbUrl={getTmdbUrl}
        palette={palette}
        dim={dim}
      />
      <Text style={[styles.cardTitle, { color: palette.primary }]} numberOfLines={2}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
}

// Arkadaki kartlar (en uzaktan yakına): sağa/yukarı kayık, hafif eğik, karartılmış.
const STACK_LAYERS = [
  { x: 10, y: -5, rotate: "9deg", dim: 0.5 },
  { x: 5, y: -2.5, rotate: "4.5deg", dim: 0.35 },
];

/**
 * Üst üste binmiş kartlar: en önde dördüncü öğenin afişi + "+N", arkasında en
 * fazla iki kart. Arka kartlar sıradaki GERÇEK öğelerden gelir (4. öğeden sonra
 * hiç öğe yoksa arka kart da yok): olmayan içeriği taklit etmez.
 * Basılabilir alan yığının taşan kısmını da kapsar.
 */
function StackCard({ items, remaining, cardW, getTmdbUrl, palette, onPress, caption, veil }) {
  const height = Math.round(cardW * 1.5);
  const [front, near, far] = items;
  // Katman sırası STACK_LAYERS ile aynı (en uzaktan yakına). Olmayan öğe için
  // katman çizilmez: derinlik kendiliğinden kalan öğe sayısıyla sınırlı.
  const back = [far, near];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{ width: cardW + STACK_BLEED }}
      accessibilityRole="button"
      accessibilityLabel={`+${remaining} ${caption}`}
    >
      <View style={{ width: cardW, height }}>
        {STACK_LAYERS.map((layer, index) =>
          back[index] ? (
            <View
              key={index}
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [
                    { translateX: layer.x },
                    { translateY: layer.y },
                    { rotate: layer.rotate },
                  ],
                },
              ]}
            >
              <PosterFace
                item={back[index]}
                width={cardW}
                height={height}
                getTmdbUrl={getTmdbUrl}
                palette={palette}
                dim={Math.max(layer.dim, veil)}
              />
            </View>
          ) : null,
        )}
        <PosterFace
          item={front}
          width={cardW}
          height={height}
          getTmdbUrl={getTmdbUrl}
          palette={palette}
          dim={Math.max(0.5, veil)}
        />
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          {/* Hap: sayı afişin üzerinde her zaman okunur (afiş yazısı karışmaz). */}
          <View style={styles.stackPill}>
            <Text allowFontScaling={false} style={styles.stackCount}>
              +{remaining}
            </Text>
          </View>
        </View>
      </View>
      <Text style={[styles.cardTitle, styles.stackCaption, { color: palette.tileInk }]} numberOfLines={2}>
        {caption}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * @param {object}   props
 * @param {object[]} props.items      { media_type, id, title, poster_path } (en az STRIP_SHOWN+3 gerekmez).
 * @param {number}   props.total      Gerçek toplam (items kırpılmış olabilir).
 * @param {object}   props.layout     `stripLayout(total)` çıktısı.
 * @param {object}   props.palette    shareKit.sharePalette çıktısı.
 * @param {(path: string, type: string, width: number) => string} props.getTmdbUrl
 * @param {(item: object) => void} [props.onOpenItem]
 * @param {() => void} [props.onOpenAll]  Yığına basınca; yoksa yığın ilk gizli öğeyi açar.
 * @param {string}   props.caption    Yığının altındaki ipucu ("Listeyi gör").
 * @param {number}  [props.veil]      0–1: tüm afişlerin üstüne ek karartma (spoiler perdesi).
 */
export default function PosterStrip({
  items,
  total,
  layout,
  palette,
  getTmdbUrl,
  onOpenItem,
  onOpenAll,
  caption,
  veil = 0,
}) {
  const shown = items.slice(0, STRIP_SHOWN);
  const stackItems = items.slice(STRIP_SHOWN, STRIP_SHOWN + 3);
  return (
    <View style={[styles.strip, { width: layout.width }]}>
      {shown.map((item) => (
        <StripCard
          key={`${item.media_type}-${item.id}`}
          item={item}
          cardW={layout.cardW}
          getTmdbUrl={getTmdbUrl}
          palette={palette}
          onPress={() => onOpenItem?.(item)}
          dim={veil}
        />
      ))}
      {layout.hasStack && (
        <StackCard
          items={stackItems}
          remaining={total - STRIP_SHOWN}
          cardW={layout.cardW}
          getTmdbUrl={getTmdbUrl}
          palette={palette}
          caption={caption}
          veil={veil}
          onPress={onOpenAll || (() => onOpenItem?.(stackItems[0]))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", gap: GAP },
  // Çerçeve YOK (kenar çizgisi PosterEdge katmanı): görsel kutuyu tam doldurur.
  posterBox: {
    borderRadius: POSTER_RADIUS,
    overflow: "hidden",
  },
  fill: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 10.5, fontWeight: "600", lineHeight: 13, marginTop: 4 },
  stackCaption: { fontWeight: "800" },
  stackPill: {
    minWidth: 34,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  stackCount: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
