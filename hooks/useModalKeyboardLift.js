// hooks/useModalKeyboardLift.js
//
// RN <Modal> içindeki bir "composer" (input çubuğu) için, klavyenin TAM
// üstünde durmasını sağlayan kaldırma miktarını hesaplar ve marginBottom
// döndüren bir reanimated stili verir.
//
// NEDEN elle ölçüm (useAnimatedKeyboard değil):
//   RN <Modal> ayrı bir native penceredir (Dialog). Reanimated'in
//   useAnimatedKeyboard'ı ACTIVITY penceresinin decorView'una bağlanır,
//   decorFitsSystemWindows'u ve action_bar_root margin'lerini GLOBAL olarak
//   değiştirir; edge-to-edge (Expo SDK 54) bir uygulamada bu yan etki risklidir
//   ve değeri modal penceresinde 0'da kalabilir. Bu yüzden yükseklik doğrudan
//   Keyboard event'lerinden okunur.
//
// NEDEN platforma göre FARKLI formül (asıl hata buydu):
//   iOS  → endCoordinates TÜM klavye çerçevesidir; home indicator şeridini de
//          kapsar. SafeAreaView zaten insets.bottom kadar padding verdiğinden
//          fazladan kaldırma = klavyeOrtusu - insets.bottom.
//   Android API 30+ (RN 0.81 · ReactRootView.checkForKeyboardEvents) →
//          height = ime.bottom - systemBars.bottom, yani navigasyon çubuğu
//          ZATEN çıkarılmıştır. insets.bottom'ı ikinci kez çıkarmak composer'ı
//          jest navigasyonunda ~24dp, 3 tuşlu navigasyonda ~48dp klavyenin
//          ALTINDA bırakır — bildirilen hata tam olarak buydu. Ham değer kullanılır.
//   Android API <30 (checkForKeyboardEventsLegacy) → farklı formül, navigasyon
//          çubuğu DAHİL; orada iOS gibi çıkarılır. Bkz. SUBTRACT_SAFE_BOTTOM.
//
// KULLANIM ŞARTI (Android): Modal'a hem statusBarTranslucent hem
//   navigationBarTranslucent verilmelidir. Aksi halde RN, dialog penceresine
//   disableEdgeToEdge() uygular; API<=34'te pencere IME için yeniden boyutlanır
//   ve alt system-window inset'i decor tarafından ikinci kez padding'lenir —
//   yani formül cihazdan cihaza değişir. İki prop birlikte verildiğinde dialog
//   her API seviyesinde edge-to-edge olur ve tek bir formül geçerli olur.

import { useCallback, useEffect, useRef } from "react";
import { Dimensions, Keyboard, Platform } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const IS_IOS = Platform.OS === "ios";

// Android'de RN'in İKİ ayrı ölçüm yolu vardır (ReactRootView.java) ve ikisi
// FARKLI bir şey döndürür:
//   API >= 30  checkForKeyboardEvents()       → ime.bottom - systemBars.bottom
//              → navigasyon çubuğu ZATEN düşülmüş, tekrar çıkarma.
//   API <  30  checkForKeyboardEventsLegacy() → windowMetrics.height - visibleFrame.bottom
//              → navigasyon çubuğu DAHİL, iOS gibi çıkarılmalı.
// Koşulu RN'in kendi dalıyla birebir aynı tutuyoruz ki sürüm atlarken kaymasın.
const SUBTRACT_SAFE_BOTTOM = IS_IOS || Platform.Version < 30;

/**
 * @param {object}   opts
 * @param {boolean}  opts.active      Modal ekranda mı (kapanınca sıfırlanır).
 * @param {number}   opts.bottomInset SafeAreaView'in uyguladığı alt güvenli alan.
 * @param {Function} [opts.onChange]  Klavye açıldığında/büyüdüğünde çağrılır
 *                                    (ör. listeyi sona kaydırmak için).
 * @returns {object} marginBottom içeren animated style.
 */
export default function useModalKeyboardLift({
  active = true,
  bottomInset = 0,
  onChange,
} = {}) {
  // Klavyenin içerikle ÖRTÜŞEN yüksekliği (platformun raporladığı ham değer).
  const keyboardHeight = useSharedValue(0);
  // Alt güvenli alan; UI thread'de güncel kalsın diye shared value.
  const safeBottom = useSharedValue(bottomInset);

  const lastHeightRef = useRef(0);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    safeBottom.value = bottomInset;
  }, [bottomInset, safeBottom]);

  // Klavyenin içerikle örtüşen yüksekliği. iOS'ta klavye çerçevesinin konumundan
  // hesaplanır; böylece yüzen/undocked klavyede doğru şekilde 0 verir.
  // DİKKAT: endCoordinates.screenY, adına rağmen EKRAN değil ANA PENCERE
  // koordinatındadır (RCTKeyboardObserver.mm çerçeveyi RCTKeyWindow'a çevirir).
  // Bu yüzden "window" yüksekliğinden çıkarılmalı — "screen" kullanmak iPad'de
  // Stage Manager/Slide Over'da pencereyle hiç kesişmeyen klavye için yüzlerce
  // punto sahte kaldırma üretir. Sonuç pencere yüksekliğiyle sınırlanır.
  const overlapOf = useCallback((coords) => {
    if (!coords) return 0;
    const windowH = Dimensions.get("window").height;
    if (IS_IOS && typeof coords.screenY === "number") {
      return Math.min(Math.max(0, windowH - coords.screenY), windowH);
    }
    return Math.min(coords.height || 0, windowH);
  }, []);

  const apply = useCallback(
    (height, duration) => {
      const next = Number.isFinite(height) && height > 0 ? height : 0;
      // 1dp altındaki oynamalar layout'u boşuna tetiklemesin.
      if (Math.abs(next - lastHeightRef.current) < 1) return;
      lastHeightRef.current = next;
      keyboardHeight.value =
        duration > 0 ? withTiming(next, { duration }) : next;
      if (next > 0) onChangeRef.current?.();
    },
    [keyboardHeight],
  );

  useEffect(() => {
    if (!active) {
      // Modal kapandı: animasyonsuz sıfırla ki tekrar açılışta artık değer kalmasın.
      lastHeightRef.current = 0;
      keyboardHeight.value = 0;
      return undefined;
    }

    const subs = [];

    // Modal, klavye ZATEN açıkken açılabilir (ör. sohbet inputundan geçiş).
    // O senaryoda hiçbir show event'i gelmez; mevcut ölçümden anında tohumla,
    // yoksa composer ilk karede klavyenin altında kalır.
    if (Keyboard.isVisible()) apply(overlapOf(Keyboard.metrics()), 0);

    if (IS_IOS) {
      // willChangeFrame; göster/gizle DIŞINDA emoji-diktesi panelleri, otomatik
      // düzeltme çubuğu, donanım klavyesi (yalnız aksesuar çubuğu), split/undock
      // durumlarını da kapsar.
      subs.push(
        Keyboard.addListener("keyboardWillChangeFrame", (e) =>
          apply(overlapOf(e?.endCoordinates), e?.duration || 250),
        ),
      );
      subs.push(
        Keyboard.addListener("keyboardWillHide", (e) =>
          apply(0, e?.duration || 220),
        ),
      );
    } else {
      // Android'de willShow/willHide YOKTUR; yalnız did* event'leri gelir.
      // NOT: API 30+ yolunda RN bu event'i SADECE görünürlük değişiminde atar
      // (ReactRootView.checkForKeyboardEvents), yani aynı IME içinde emoji
      // paneline geçiş gibi YÜKSEKLİK değişimleri bildirilmez.
      subs.push(
        Keyboard.addListener("keyboardDidShow", (e) =>
          apply(overlapOf(e?.endCoordinates), 180),
        ),
      );
      subs.push(Keyboard.addListener("keyboardDidHide", () => apply(0, 150)));
    }

    return () => {
      subs.forEach((s) => s?.remove?.());
      lastHeightRef.current = 0;
      keyboardHeight.value = 0;
    };
  }, [active, apply, keyboardHeight, overlapOf]);

  return useAnimatedStyle(() => {
    const raw = keyboardHeight.value;
    if (raw <= 0) return { marginBottom: 0 };
    // SafeAreaView zaten insets.bottom kadar padding veriyor; ölçülen değer o
    // şeridi İÇERİYORSA düş, İÇERMİYORSA (Android API 30+) olduğu gibi kullan.
    const lift = SUBTRACT_SAFE_BOTTOM ? raw - safeBottom.value : raw;
    return { marginBottom: lift > 0 ? lift : 0 };
  });
}
