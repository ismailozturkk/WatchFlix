// hooks/useSheetTransition.js
//
// Alt sayfa (bottom sheet) açılış/kapanış hareketi:
//   • BLUR arka plan YERİNDE solar (kaymaz),
//   • sayfa TAM OPAKLIKTA aşağıdan yukarı kayar.
//
// NEDEN ELDE SÜRÜLÜYOR: Modal'ın hazır animasyonlarının ikisi de bu ikisini
// ayıramıyor. `animationType="slide"` TÜM katmanı — blur dahil — blok hâlinde
// yukarı sürüyor, bulanıklık sayfayla birlikte yükselmiş gibi görünüyor.
// `animationType="fade"` ise ikisini birlikte soluyor, hiç kayma olmuyor.
// Tek yol Modal'ı `animationType="none"` bırakıp hareketi burada sürmek.
//
// Referans ve katsayıların kaynağı: components/modals/CommentSheetModal.js
//
// KULLANIM:
//   const sheet = useSheetTransition(visible);
//
//   <Modal animationType="none" transparent visible={sheet.mounted} …>
//     <View style={{ flex: 1, justifyContent: "flex-end" }}>
//       <Animated.View
//         style={[StyleSheet.absoluteFill, { opacity: sheet.backdropOpacity }]}
//       >
//         <ModalBlurBackdrop intensity={30} />
//       </Animated.View>
//       <Animated.View onSheetLayout … style={[styles.sheet, sheet.sheetStyle]}>
//
// `mounted` ŞART: Modal artık kendi çıkış animasyonunu yapmadığı için `visible`
// düşer düşmez pencereyi kapatırsak kapanış tek karede oluyor. Çıkış bitene
// kadar `mounted` true kalır.
//
// DİKKAT — o çıkış penceresi boyunca (≈260 ms) sayfa hâlâ çiziliyor: kapanışta
// sıfırlanan proplar (seçili ad, sayaç) o sırada boşalırsa ekranda görünür.
// Çağıran taraf son değerleri kendi tutmalı (bkz. ListManageSheet'teki `shown`).
//
// ── KLAVYE ──────────────────────────────────────────────────────────────────
// İçinde metin kutusu olan sayfalar klavyenin ALTINDA kalmasın diye sayfa
// klavye yüksekliği kadar yukarı kayar. `KeyboardAvoidingView` burada iş
// görmüyor: Android'de `statusBarTranslucent` modal penceresi klavyeye göre
// yeniden boyutlanmıyor. Ama boyutlandığı platformlarda sayfa ZATEN yükselmiş
// olur; iki kez yükselmemesi için kaplayıcının ölçülen yüksekliği pencereninkiyle
// karşılaştırılır ve yalnız kalan fark kaydırılır (`onOverlayLayout` bağlanmazsa
// tüm klavye yüksekliği kaydırılır — modal pencerenin küçülmediği varsayımı).
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Keyboard, Platform } from "react-native";

const { height: SCREEN_H } = Dimensions.get("window");

// Sayfa ölçülene kadar kullanılan kayma mesafesi. Gerçek yükseklikten FAZLA
// olmalı: az olursa sayfa ekranın altından değil ortasından belirir.
const FALLBACK_DISTANCE = Math.round(SCREEN_H * 0.9);

/**
 * @param {boolean} visible  Sayfa açık mı? (çağıranın kendi durumu)
 * @param {object} [options]
 * @param {boolean} [options.liftWithKeyboard=true]
 *        Klavye açılınca sayfayı yukarı kaydır. Sayfanın KENDİ klavye çözümü
 *        varsa (ör. ChatScreen'in Reanimated `paddingBottom`u) false yap —
 *        aksi halde ikisi toplanır ve sayfa iki kat yükselir.
 * @returns {{
 *   mounted: boolean,                 // Modal'ın `visible` propu
 *   backdropOpacity: Animated.Value,  // blur sarmalayıcısının `opacity`si
 *   sheetStyle: object,               // sayfaya eklenecek transform
 *   onSheetLayout: (event: any) => void,   // sayfanın `onLayout`u
 *   onOverlayLayout: (event: any) => void, // kaplayıcının `onLayout`u (klavye)
 * }}
 */
export default function useSheetTransition(visible, { liftWithKeyboard = true } = {}) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(FALLBACK_DISTANCE)).current;
  const keyboardShift = useRef(new Animated.Value(0)).current;
  // Kayma mesafesi sayfanın GERÇEK yüksekliği; içerik değiştikçe (adım, sezon
  // sayısı, filtre satırları) `onSheetLayout` ile tazelenir.
  const distance = useRef(FALLBACK_DISTANCE);
  const [mounted, setMounted] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      mountedRef.current = true;
      setMounted(true);
      return undefined;
    }
    if (!mountedRef.current) return undefined;
    const animation = Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: distance.current,
        duration: 260,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (!finished) return;
      mountedRef.current = false;
      setMounted(false);
    });
    return () => animation.stop();
  }, [visible, backdropOpacity, translateY]);

  // Giriş animasyonu Modal GERÇEKTEN göründükten sonra başlar. Mount'tan önce
  // başlatılırsa native görünümler henüz yokken ilk kareler düşüyor ve fade
  // anlık bir sıçramaya dönüşüyor.
  useEffect(() => {
    if (!mounted || !visible) return undefined;
    backdropOpacity.setValue(0);
    translateY.setValue(distance.current);
    const animation = Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 22,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [mounted, visible, backdropOpacity, translateY]);

  // ── Klavye ile birlikte yükselme ────────────────────────────────────────
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardHeightRef = useRef(0);
  // Kaplayıcının KLAVYE KAPALIYKEN ölçülen yüksekliği: "pencere küçüldü mü"
  // sorusunun tek doğru referansı. Pencere yüksekliğiyle karşılaştırmak
  // yanıltıyor — durum çubuğu, KeyboardAvoidingView dolgusu ve translucent
  // modal farkı her platformda başka bir sabit fark bırakıyor.
  const baseOverlayHeight = useRef(0);
  const [overlayHeight, setOverlayHeight] = useState(0);

  useEffect(() => {
    if (!mounted || !liftWithKeyboard) return undefined;
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const apply = (height) => {
      keyboardHeightRef.current = height;
      setKeyboardHeight(height);
    };
    const showSub = Keyboard.addListener(showEvent, (event) =>
      apply(event?.endCoordinates?.height ?? 0),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => apply(0));
    return () => {
      showSub.remove();
      hideSub.remove();
      apply(0);
    };
  }, [mounted, liftWithKeyboard]);

  useEffect(() => {
    const base = baseOverlayHeight.current;
    // Kaplayıcı klavyeyle birlikte daraldıysa sayfa zaten o kadar yükselmiştir.
    const absorbed =
      base > 0 && overlayHeight > 0 ? Math.max(0, base - overlayHeight) : 0;
    const animation = Animated.timing(keyboardShift, {
      toValue: Math.max(0, keyboardHeight - absorbed),
      // Kısa gecikme: pencere daralıyorsa `onLayout` bu süre içinde gelir ve
      // hedef daha hareket başlamadan düzelir (yükselip geri inme olmaz).
      delay: keyboardHeight > 0 ? 60 : 0,
      duration: 240,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [keyboardHeight, overlayHeight, keyboardShift]);

  return useMemo(
    () => ({
      mounted,
      backdropOpacity,
      sheetStyle: {
        transform: [{ translateY: Animated.subtract(translateY, keyboardShift) }],
      },
      onSheetLayout: (event) => {
        const measured = Math.round(event.nativeEvent.layout.height);
        if (measured > 0) distance.current = measured;
      },
      onOverlayLayout: (event) => {
        const measured = Math.round(event.nativeEvent.layout.height);
        if (measured <= 0) return;
        if (keyboardHeightRef.current === 0) baseOverlayHeight.current = measured;
        setOverlayHeight(measured);
      },
    }),
    [mounted, backdropOpacity, translateY, keyboardShift],
  );
}
