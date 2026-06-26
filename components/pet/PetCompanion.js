import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Dimensions,
  DeviceEventEmitter,
  TouchableOpacity,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDecay,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import LottieView from "lottie-react-native";
import SpritePet, {
  PET_STATE_ORDER,
  spriteFrameWidth,
} from "@components/pet/SpritePet";
import { usePet, AI_CHAT_EVENT } from "@context/PetContext";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const MIN_X = 6;
const MIN_Y = 50;
const BOTTOM_GAP = 40; // alt tab bar payı

// Pet kapalıyken gösterilen yapay zeka FAB'ı (AI.json Lottie). Tab bar'ın
// üstünde sağ altta durur, dokununca AI sohbet modalını açar.
const AI_FAB_SIZE = 64;
const AI_FAB_RIGHT = 20;
const AI_FAB_BOTTOM = 92;

const clamp = (v, min, max) => {
  "worklet";
  return Math.min(Math.max(v, min), max);
};

/**
 * Tab navigator üzerinde duran, sürüklenebilir SEÇİLİ PET.
 * - Sürükle → taşı (bırakınca clamp + kalıcı kaydet).
 * - Dokun → pet durumunu sıradakine geçir (PET_STATE_ORDER).
 * - Basılı tut → AI_CHAT_EVENT yayınla; ChatModal bunu dinleyip AIChatScreen'i açar
 *   (projedeki gemini Lottie FAB'ının yerini alır).
 * `petEnabled` ile gösterilir/gizlenir; boyut ayarlardan (petSize) gelir.
 */
function PetCompanion() {
  const {
    petEnabled,
    selectedPetId,
    catalog,
    petState,
    setPetState,
    position,
    setPetPosition,
    petSize,
    getPetSource,
    downloadPet,
    downloadingPets,
  } = usePet();

  const pet = catalog.find((p) => p.id === selectedPetId);
  // Sprite source önbellekten gelir; indirilmemişse null.
  const petSource = pet ? getPetSource(pet.id) : null;
  const visible = petEnabled && !!pet && !!petSource;

  // Pet açıkken seçili pet henüz indirilmemişse arka planda indir (tek pet ~2MB).
  // Geri kalanlar ayarlardan istek üzerine indirilir.
  useEffect(() => {
    if (petEnabled && pet && !petSource && !downloadingPets[pet.id]) {
      downloadPet(pet.id);
    }
  }, [petEnabled, pet, petSource, downloadingPets, downloadPet]);

  // Boyuta bağlı sınırlar (her render'da güncellenir → gesture worklet'i yakalar).
  const petW = spriteFrameWidth(petSize);
  const maxX = SCREEN_W - petW - 6;
  const maxY = SCREEN_H - petSize - BOTTOM_GAP;

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
  }, [petSize]);

  const cycleState = () => {
    const i = PET_STATE_ORDER.indexOf(petState);
    setPetState(PET_STATE_ORDER[(i + 1) % PET_STATE_ORDER.length]);
  };

  const openAiChat = () => {
    // Pet'in ekran merkezini gönder → AIChatScreen oradan büyüyerek açılır.
    DeviceEventEmitter.emit(AI_CHAT_EVENT, {
      x: tx.value + petW / 2,
      y: ty.value + petSize / 2,
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
      runOnJS(cycleState)();
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

  // Pet kapalıyken: yapay zeka modalını açmak için AI Lottie FAB göster.
  // (Pet açıkken AI'a pet'e basılı tutarak erişiliyor; pet kapatılınca bu
  // erişim kaybolmasın diye burada yedek bir giriş noktası sunuyoruz.)
  const openAiChatFromFab = () => {
    DeviceEventEmitter.emit(AI_CHAT_EVENT, {
      x: SCREEN_W - AI_FAB_RIGHT - AI_FAB_SIZE / 2,
      y: SCREEN_H - AI_FAB_BOTTOM - AI_FAB_SIZE / 2,
    });
  };

  if (!visible) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={openAiChatFromFab}
        style={styles.aiFab}
      >
        <LottieView
          style={styles.aiFabLottie}
          source={require("@lottie/gemini.json")}
          autoPlay
          loop
        />
      </TouchableOpacity>
    );
  }

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
  aiFab: {
    position: "absolute",
    right: AI_FAB_RIGHT,
    bottom: AI_FAB_BOTTOM,
    width: AI_FAB_SIZE,
    height: AI_FAB_SIZE,
    zIndex: 40,
  },
  aiFabLottie: {
    width: "80%",
    height: "80%",
  },
});

export default PetCompanion;
