// components/cineswipe/CineCardStack.js
//
// Kart yığını: alanı ölçer, ilk 3 kartı derinlikle çizer, üstteki kartın
// sürüklemesini (`dragX`) arkadakilerle paylaşır ve sıradaki afişleri önceden yükler.
//
// Ekran boyutu `Dimensions` ile sabit alınmıyordu (ekranın %64'ü): küçük
// telefonlarda alt düğmeler kırpılıyordu. Kart artık bu alanın ölçüsüne sığar.
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useSharedValue, withTiming } from "react-native-reanimated";
import SwipeCard from "./SwipeCard";
import CineCardSkeleton from "./CineCardSkeleton";
import { cineMediaKey, posterUrl } from "../../services/cineswipe/deckModel";

const MAX_CARD_WIDTH = 460;
const SIDE_GUTTER = 14;

/**
 * @param {Array<object>} cards  Gösterilecek kartlar; [0] üstteki kart.
 * @param {number} revision      Değişince kartlar yeniden kurulur (hata sonrası geri dönüş).
 * @param {boolean} loading      İskelet kart çizer.
 * @param {Array<object>} upcoming  Afişi önceden yüklenecek sıradaki kartlar.
 */
const CineCardStack = forwardRef(function CineCardStack(
  {
    cards,
    revision = 0,
    loading = false,
    disabled = false,
    swipesAllowed = true,
    upcoming = [],
    onSwipe,
    onBlocked,
    onOpenDetails,
    copy,
    colors,
  },
  ref,
) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const dragX = useSharedValue(0);
  const topRef = useRef(null);

  useImperativeHandle(ref, () => ({ swipe: (action) => topRef.current?.swipe(action) ?? false }), []);

  const topKey = cards[0] ? cineMediaKey(cards[0]) : "";

  // Sıra ilerleyince paylaşılan sürükleme yavaşça sıfırlanır; arkadaki kart
  // öne yükselirken boyutu zıplamaz (bkz. SwipeCard'daki `depthNow`).
  useEffect(() => {
    dragX.value = withTiming(0, { duration: 220 });
  }, [topKey, dragX]);
  useEffect(() => {
    dragX.value = 0;
  }, [revision, dragX]);

  const prefetchKey = upcoming.map((media) => media.poster_path).join("|");
  useEffect(() => {
    const urls = upcoming.map((media) => posterUrl(media.poster_path)).filter(Boolean);
    if (urls.length) Image.prefetch(urls, "memory-disk").catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetchKey]);

  const cardWidth = Math.max(0, Math.min(box.width - SIDE_GUTTER * 2, MAX_CARD_WIDTH));
  const cardHeight = Math.max(0, Math.min(box.height - 12, cardWidth * 1.55));
  const measured = box.width > 0 && box.height > 0 && cardWidth > 0 && cardHeight > 0;
  const visible = cards.slice(0, 3);

  return (
    <View
      style={styles.area}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox((prev) =>
          Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1 ? prev : { width, height },
        );
      }}
    >
      {measured && loading ? <CineCardSkeleton width={cardWidth} height={cardHeight} colors={colors} /> : null}
      {measured && !loading
        ? [...visible].reverse().map((media, reversedIndex) => {
            const depth = visible.length - 1 - reversedIndex;
            return (
              <SwipeCard
                key={`${cineMediaKey(media)}_${revision}`}
                ref={depth === 0 ? topRef : null}
                media={media}
                depth={depth}
                dragX={dragX}
                width={cardWidth}
                height={cardHeight}
                disabled={disabled}
                swipesAllowed={swipesAllowed}
                onSwipe={onSwipe}
                onBlocked={onBlocked}
                onOpenDetails={onOpenDetails}
                copy={copy}
                colors={colors}
              />
            );
          })
        : null}
    </View>
  );
});

export default CineCardStack;

const styles = StyleSheet.create({
  area: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
});
