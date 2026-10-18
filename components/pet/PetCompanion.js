import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDecay,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import SpritePet, {
  spriteFrameWidth,
} from "@components/pet/SpritePet";
import { usePet } from "@context/PetContext";

const MIN_X = 6;
const MIN_Y = 50;
const BOTTOM_GAP = 40; // alt tab bar payı

// NOT: Pet kapalıyken görünen yüzen CineMatch düğmesi (FAB) KALDIRILDI. Yapay zeka
// girişi artık alt çubuğun yanındaki ayrık yuvarlak düğme (bkz.
// components/navigation/AdaptiveTabShell.js `onAiPress`); pet açıkken pet'e dokunmak
// da hâlâ sohbeti açar.

const clamp = (v, min, max) => {
  "worklet";
  return Math.min(Math.max(v, min), max);
};

/**
 * Tab navigator üzerinde duran, sürüklenebilir SEÇİLİ PET.
 * - Sürükle → taşı (bırakınca clamp + kalıcı kaydet).
 * - Dokun / basılı tut → doğrudan CineMatch sohbetini açar.
 * `petEnabled` ile gösterilir/gizlenir; boyut ayarlardan (petSize) gelir.
 */
function PetCompanion() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const {
    petEnabled,
    selectedPetId,
    catalog,
    petState,
    position,
    setPetPosition,
    petSize,
    getPetSource,
    downloadPet,
    downloadingPets,
    cacheReady,
    requestAiChat,
  } = usePet();

  const pet = catalog.find((p) => p.id === selectedPetId);
  // Sprite source önbellekten gelir; indirilmemişse null.
  const petSource = pet ? getPetSource(pet.id) : null;
  const visible = petEnabled && !!pet && !!petSource;

  // Pet açıkken seçili pet henüz indirilmemişse arka planda indir (tek pet ~2MB).
  // Geri kalanlar ayarlardan istek üzerine indirilir. cacheReady şart: önbellek
  // taraması bitmeden indirme başlatılırsa diskte zaten olan pet yeniden iner.
  useEffect(() => {
    if (cacheReady && petEnabled && pet && !petSource && !downloadingPets[pet.id]) {
      downloadPet(pet.id);
    }
  }, [cacheReady, petEnabled, pet, petSource, downloadingPets, downloadPet]);

  // Boyuta bağlı sınırlar (her render'da güncellenir → gesture worklet'i yakalar).
  const petW = spriteFrameWidth(petSize);
  const maxX = screenWidth - petW - 6;
  const maxY = screenHeight - petSize - BOTTOM_GAP;

  const tx = useSharedValue(position?.x ?? maxX);
  const ty = useSharedValue(position?.y ?? maxY);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const dragDir = useSharedValue(0); // -1 sol, 1 sağ, 0 yok
  const settling = useSharedValue(0); // bırakış sonrası momentum kayması sürüyor mu
  const restored = useRef(false);

  // Sürüklerken yöne göre koşma animasyonu; bırakınca petState'e döner.
  const [dragState, setDragState] = useState(null);
  const displayState = dragState || petState;

  // Kayıtlı konumu (ilk yükleme) bir kez geri yükle.
  useEffect(() => {
    if (!restored.current && position) {
      restored.current = true;
      tx.value = clamp(position.x, MIN_X, maxX);
      ty.value = clamp(position.y, MIN_Y, maxY);
    }
  }, [position, maxX, maxY, tx, ty]);

  // Boyut değişince pet'i yeni sınırların içine çek.
  useEffect(() => {
    tx.value = withSpring(clamp(tx.value, MIN_X, maxX), {
      damping: 18,
      stiffness: 180,
    });
    ty.value = withSpring(clamp(ty.value, MIN_Y, maxY), {
      damping: 18,
      stiffness: 180,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petSize, maxX, maxY, tx, ty]);


  const openAiChat = () => {
    requestAiChat({
      origin: {
        x: tx.value + petW / 2,
        y: ty.value + petSize / 2,
      },
    });
  };

  // Momentum kayması bitince: koşmayı durdur + son konumu kaydet.
  const endDrag = (x, y) => {
    setDragState(null);
    setPetPosition({ x, y });
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .activeOffsetY([-8, 8])
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
      dragDir.value = 0;
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
      // Yatay yöne göre koşma: sol → runLeft, sağ → runRight (yalnız yön değişince)
      let dir = dragDir.value;
      if (e.velocityX < -12) dir = -1;
      else if (e.velocityX > 12) dir = 1;
      if (dir !== dragDir.value) {
        dragDir.value = dir;
        runOnJS(setDragState)(dir < 0 ? "runLeft" : "runRight");
      }
    })
    .onEnd((e) => {
      // Bırakış hızıyla bir miktar kayarak dursun (momentum); sınırlarda durur.
      settling.value = 1;
      ty.value = withDecay({
        velocity: e.velocityY,
        clamp: [MIN_Y, maxY],
        rubberBandEffect: true, // kenardan yumuşak sekme
        rubberBandFactor: 0.85,
        deceleration: 0.994,
      });
      tx.value = withDecay(
        {
          velocity: e.velocityX,
          clamp: [MIN_X, maxX],
          rubberBandEffect: true,
          rubberBandFactor: 0.85,
          deceleration: 0.994,
        },
        () => {
          // Kayma bitti: koşmayı durdur + konumu kaydet.
          settling.value = 0;
          runOnJS(endDrag)(tx.value, ty.value);
        },
      );
    })
    .onFinalize(() => {
      dragDir.value = 0;
      // Decay başladıysa koşmayı onun callback'i durdurur; başlamadıysa (iptal) burada.
      if (settling.value === 0) {
        runOnJS(setDragState)(null);
      }
    });

  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd(() => {
      // Tek dokunuş → yapay zeka sohbetini aç.
      // Durum değiştirme (cycleState) ileriki sürüme bırakıldı.
      runOnJS(openAiChat)();
    });

  const longPress = Gesture.LongPress()
    .minDuration(330)
    .onStart(() => {
      pressScale.value = withSpring(0.9);
      runOnJS(openAiChat)();
    })
    .onFinalize(() => {
      pressScale.value = withSpring(1);
    });

  const gesture = Gesture.Race(pan, longPress, tap);

  const petStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: pressScale.value },
    ],
  }));

  if (!visible) return null;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.petWrap, petStyle]}>
        <SpritePet source={petSource} state={displayState} size={petSize} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  petWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 40,
  },
});

export default PetCompanion;
