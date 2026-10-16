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
//
// SIĞDIRMA: `translateY` yalnız konumu değiştirir. Sayfa "ekran − klavye"den
// uzunsa (ör. maxHeight: "88%") kaydırılınca TEPESİ ekranın dışına çıkar.
// Bu yüzden klavye açıkken sayfanın `maxHeight`ı klavyenin üstünde kalan alana
// indirilir: `sheet.fit(stil)` o sınırı çağıranın stiline ekler (BottomSheetModal
// bunu kendisi yapar; kendi `Modal`ını kuran sayfalar stilini `fit` ile sarar).
// Sınırın işe yaraması için sayfanın İÇİNDE küçülebilen bir bölge (ScrollView,
// FlatList — bkz. components/common/SheetScroll.js) bulunmalı. Hesap:
// utils/sheetKeyboardFit.js; klavye/kaplayıcı ölçümü: hooks/useKeyboardMetrics.js.
//
// KAPANIŞ: `visible` düştüğü an klavye geometrisi (yükselme + küçülme) DONDURULUR.
// Klavye kapanışla birlikte inerse (çağıran `Keyboard.dismiss()` yapar, kullanıcı
// klavyeyi önce kapatır, iOS modal inerken klavyeyi indirir) sayfa çıkış sırasında
// ne yeniden büyür ne de yerinden oynar; çıkış mesafesi de "doğal boy + o anki
// yükselme" olduğundan sayfa her koşulda ekranın altına tamamen iner. Dondurmasaydık
// sayfa, klavyesi inmiş ekranda klavye açıkmış gibi kısa ve yarım yükseklikte
// asılı kalıp hareket bitince birden kayboluyordu. Pencere kalkınca (`mounted`
// false) klavye durumu, kaplayıcı ölçüsü ve yükselme tümüyle sıfırlanır.
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  StatusBar,
  StyleSheet,
} from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import useKeyboardMetrics from "@hooks/useKeyboardMetrics";
import {
  SHEET_TOP_MARGIN,
  keyboardFitOverrides,
  keyboardLift,
  keyboardSheetBudget,
  nextNaturalHeight,
  sheetExitDistance,
} from "@utils/sheetKeyboardFit";

const { height: SCREEN_H } = Dimensions.get("window");

// Güvenli alan sağlayıcısı yoksa (test, yalıtılmış ağaç) durum çubuğu payı.
const FALLBACK_TOP_INSET = Platform.OS === "ios" ? 47 : StatusBar.currentHeight ?? 24;

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
 *   fit: (style: any) => any,         // stile klavye sınırını ekler (sığdırma)
 *   topGap: number,                   // ekranın üstünde boş kalacak pay (durum çubuğu dahil)
 *   onSheetLayout: (event: any) => void,   // sayfanın `onLayout`u
 *   onOverlayLayout: (event: any) => void, // kaplayıcının `onLayout`u (klavye)
 * }}
 */
export default function useSheetTransition(visible, { liftWithKeyboard = true } = {}) {
  const insets = useContext(SafeAreaInsetsContext);
  const topGap = (insets?.top ?? FALLBACK_TOP_INSET) + SHEET_TOP_MARGIN;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(FALLBACK_DISTANCE)).current;
  const keyboardShift = useRef(new Animated.Value(0)).current;
  // Kayma mesafesi sayfanın GERÇEK ve klavyesiz ("doğal") yüksekliği; içerik
  // değiştikçe (adım, sezon sayısı, filtre satırları) `onSheetLayout` ile
  // tazelenir. Klavye sayfayı küçülttüyse küçülmüş ölçü buraya YAZILMAZ.
  const distance = useRef(FALLBACK_DISTANCE);
  const [mounted, setMounted] = useState(false);
  const mountedRef = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  // ── Klavye ölçümü (açık/kapalı + kaplayıcı boyu) ────────────────────────
  // Kaplayıcının KLAVYE KAPALIYKEN boyu: "pencere küçüldü mü" sorusunun tek
  // doğru referansı. Pencere yüksekliğiyle karşılaştırmak yanıltıyor — durum
  // çubuğu, KeyboardAvoidingView dolgusu ve translucent modal farkı her
  // platformda başka bir sabit fark bırakıyor.
  const { keyboardHeight, overlayHeight, baseOverlayHeight, isKeyboardOpen, onOverlayLayout } =
    useKeyboardMetrics(mounted, { track: liftWithKeyboard });

  // Klavyenin sayfayı fiilen kaldırdığı miktar ve bütçe (klavye kapalıyken null).
  const liveLift = keyboardLift({ keyboardHeight, baseOverlayHeight, overlayHeight });
  const liveBudget = keyboardSheetBudget({
    keyboardHeight,
    baseOverlayHeight,
    overlayHeight,
    windowHeight: Dimensions.get("window").height,
    topGap,
  });

  // Açıkken son bilinen geometri. Kapanış başlayınca bu değerler DONAR; pencere
  // kalkınca sıfırlanır. (Efektle yazılır: kapanışın ilk render'ında bir önceki
  // `visible` render'ının değerini hâlâ taşır.)
  const lastOpenGeometry = useRef({ lift: 0, budget: null });
  useEffect(() => {
    if (visible) lastOpenGeometry.current = { lift: liveLift, budget: liveBudget };
    else if (!mounted) lastOpenGeometry.current = { lift: 0, budget: null };
  });
  const keyboardBudget = visible ? liveBudget : lastOpenGeometry.current.budget;

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
        // `translateY − keyboardShift` bileşiminde sayfa `lift` kadar yukarıda;
        // yalnız sayfa boyu kadar inilirse `lift` kadar ekranda asılı kalır.
        toValue: sheetExitDistance(distance.current, lastOpenGeometry.current.lift),
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
  useEffect(() => {
    // Pencere kalktı: yükselmeyi ANİMASYONSUZ sıfırla. Sıfırlanmazsa bir sonraki
    // açılış önceki oturumun klavye yükselmesiyle başlayabilir.
    if (!mounted) {
      keyboardShift.setValue(0);
      return undefined;
    }
    // Kapanış sürüyor: yükselme donuk kalır (bkz. dosya başı "KAPANIŞ"). Klavye
    // bu sırada inse bile sayfa çıkış hareketinin ortasında yer değiştirmez.
    if (!visible) return undefined;
    const animation = Animated.timing(keyboardShift, {
      // Kaplayıcı klavyeyle birlikte daraldıysa sayfa zaten o kadar yükselmiştir
      // (`liveLift` bunu düşer).
      toValue: liveLift,
      // Kısa gecikme: pencere daralıyorsa `onLayout` bu süre içinde gelir ve
      // hedef daha hareket başlamadan düzelir (yükselip geri inme olmaz).
      delay: keyboardHeight > 0 ? 60 : 0,
      duration: 240,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [mounted, visible, keyboardHeight, liveLift, keyboardShift]);

  return useMemo(
    () => ({
      mounted,
      backdropOpacity,
      sheetStyle: {
        transform: [{ translateY: Animated.subtract(translateY, keyboardShift) }],
      },
      topGap,
      // Bütçe yoksa stil AYNEN döner (kimlik korunur, gereksiz yeniden çizim yok).
      fit: (style) => {
        const overrides = keyboardFitOverrides(
          StyleSheet.flatten(style),
          keyboardBudget,
          overlayHeight,
        );
        return overrides ? [style, overrides] : style;
      },
      onSheetLayout: (event) => {
        // Kapanırken ölçü güncellenmez: klavye inip sayfa dondurulmuş boyda
        // kalırken küçülmüş boy "doğal boy" diye kaydedilmesin.
        if (!visibleRef.current) return;
        const measured = Math.round(event.nativeEvent.layout.height);
        distance.current = nextNaturalHeight(distance.current, measured, isKeyboardOpen());
      },
      onOverlayLayout,
    }),
    [
      mounted,
      backdropOpacity,
      translateY,
      keyboardShift,
      keyboardBudget,
      overlayHeight,
      topGap,
      isKeyboardOpen,
      onOverlayLayout,
    ],
  );
}
