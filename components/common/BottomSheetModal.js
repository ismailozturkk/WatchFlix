// components/common/BottomSheetModal.js
//
// Uygulamadaki TÜM alt sayfaların ortak kabuğu: Modal + bulanık arka plan +
// açılış/kapanış hareketi. Hareketin kendisi hooks/useSheetTransition.js'te —
// blur YERİNDE solar, sayfa TAM OPAKLIKTA aşağıdan yukarı kayar.
//
// NEDEN BİLEŞEN: aynı 40 satır (Modal propları, blur katmanı, kapatma
// dokunuş alanı, transform, ölçüm) 25 çağrı yerine kopyalanmıştı ve her kopya
// biraz farklıydı — kiminde blur yok, kiminde perde sayfayla birlikte kayıyor,
// kiminde dışarı dokununca kapanmıyor. Tek kabuk = tek davranış.
//
// KULLANIM — eski hâli:
//   <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
//     <View style={styles.overlay}>
//       <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
//       <View style={styles.sheet}>…içerik…</View>
//     </View>
//   </Modal>
//
// yenisi — sayfanın KENDİ stili `sheetStyle`e, İÇERİĞİ children'a gider:
//   <BottomSheetModal visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
//     …içerik…
//   </BottomSheetModal>
//
// NEDEN sayfa stili prop: `sheetStyle` doğrudan transform'u taşıyan görünüme
// uygulanır, yani sayfa kaplayıcının DOĞRUDAN çocuğu olur. `maxHeight: "80%"`
// gibi yüzdeler ancak böyle doğru çözülür — araya sarmalayıcı girerse yüzde
// yüksekliği belirsiz bir ebeveyne çözülür ve sayfa çöker.
//
// Sayfanın içine ayrıca `stopPropagation` yapan bir Pressable koymaya GEREK
// YOK: kapatma dokunuş alanı sayfanın KARDEŞİ ve ALTINDA, sayfa dokunuşu
// zaten yutuyor (eski yapıda kaplayıcı sayfayı SARDIĞI için gerekiyordu).
//
// DİKKAT — ÇIKIŞ PENCERESİ: `visible` false olduktan sonra sayfa ≈260 ms daha
// çizilmeye devam eder. Kapanışta sıfırlanan proplar (seçili ad, sayaç) o
// sırada boşalırsa ekranda görünür; çağıran taraf son değeri kendi tutmalı.
//
// KLAVYE: içinde metin kutusu olan sayfa klavye kadar yukarı kayar ve `maxHeight`ı
// klavyenin üstündeki alana indirilir (bkz. hooks/useSheetTransition.js). Bu sınır
// yalnız sayfanın İÇİNDE küçülebilen bir bölge varsa işe yarar: uzun içerik
// <SheetScroll> (ya da FlatList/ScrollView) içinde olmalı, yoksa taşan kısım
// klavyenin altında kalır. Bkz. components/common/SheetScroll.js.
//
// DİKKAT — İKİ MODAL ARDARDA: iOS, kapanmakta olan bir Modal'ın üstüne ikincisini
// sunamaz (UIKit "already presenting" der, ikinci pencere hiç çizilmez ama React
// onu açık sanır → ekran kilitlenmiş gibi kalır). Bir sayfa kapanırken ARDINDAN
// başka bir Modal açılacaksa (ör. arşivden Premium sayfası) `visible`i düşürüp
// açılışı `onDismissed`e bırak; sabit bir `setTimeout` tahmini yerine pencerenin
// gerçekten kalktığını bildirir.
import React, { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import ModalBlurBackdrop from "./ModalBlurBackdrop";
import useSheetTransition from "@hooks/useSheetTransition";
import { i18nText } from "@utils/i18nText";

// Native pencere `mounted` düştükten sonra bir sonraki işlem döngüsünde kalkar;
// sıradaki Modal'ı hemen sunmamak için küçük bir pay.
const DISMISS_SETTLE_MS = 90;

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose        Geri tuşu ve dışarı dokunuş.
 * @param {number} [props.intensity=40]     Blur şiddeti.
 * @param {"dark"|"light"} [props.tint="dark"]
 * @param {string} [props.dimColor]         Blur ÜSTÜNE ek karartma (ör.
 *                                          "rgba(0,0,0,0.45)"); kontrast gereken
 *                                          sayfalarda kullanılır.
 * @param {boolean} [props.dismissOnBackdropPress=true]
 * @param {any} [props.overlayStyle]        Kaplayıcı (varsayılan: alta yasla).
 * @param {any} [props.sheetStyle]          Transform sarmalayıcısının stili.
 * @param {boolean} [props.statusBarTranslucent=true]
 * @param {boolean} [props.liftWithKeyboard=true]
 *        Klavye açılınca sayfayı yukarı kaydır. Sayfanın KENDİ klavye çözümü
 *        varsa false yap, yoksa iki kaldırma toplanır (bkz. ChatScreen arama).
 * @param {boolean} [props.shrinkToFit=false]
 *        `liftWithKeyboard={false}` ile sayfanın kendi klavye çözümünü
 *        (marginBottom/paddingBottom) kullanan sayfalar içindir. Üstte güvenli
 *        alan kadar boşluk bırakır ve sarmalayıcıyı küçülebilir yapar; böylece
 *        çağıranın dolgusu sayfayı ekrana SIĞMAYACAK kadar yukarı itmez, sayfa
 *        küçülür. Çağıran, kendi iç görünümlerine de `flexShrink: 1` vermeli ve
 *        uzun içeriği küçülebilen bir bölgeye (FlatList/SheetScroll) koymalı.
 * @param {() => void} [props.onShow]  Modal göründüğünde (odaklama vb. için).
 * @param {() => void} [props.onDismissed]
 *        Çıkış animasyonu bitip native pencere kalktıktan SONRA bir kez çağrılır.
 *        Ardından başka bir Modal açılacaksa o işi burada başlat.
 */
export default function BottomSheetModal({
  visible,
  onClose,
  intensity = 40,
  tint = "dark",
  dimColor,
  dismissOnBackdropPress = true,
  overlayStyle,
  sheetStyle,
  statusBarTranslucent = true,
  liftWithKeyboard = true,
  shrinkToFit = false,
  onShow,
  onDismissed,
  children,
}) {
  const sheet = useSheetTransition(visible, { liftWithKeyboard });

  // Yalnız `mounted` true→false geçişinde çalışır. Güncel callback ref'ten okunur:
  // çağıran satır içi fonksiyon verip yeniden çizilirse zamanlayıcı iptal olmasın.
  const onDismissedRef = useRef(onDismissed);
  useEffect(() => {
    onDismissedRef.current = onDismissed;
  }, [onDismissed]);
  const wasMounted = useRef(false);
  useEffect(() => {
    if (sheet.mounted) {
      wasMounted.current = true;
      return undefined;
    }
    if (!wasMounted.current) return undefined;
    wasMounted.current = false;
    const timer = setTimeout(() => onDismissedRef.current?.(), DISMISS_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [sheet.mounted]);

  return (
    <Modal
      animationType="none"
      transparent
      visible={sheet.mounted}
      statusBarTranslucent={statusBarTranslucent}
      onShow={onShow}
      onRequestClose={onClose}
    >
      {/* onLayout: içinde metin kutusu olan sayfalar klavyeyle yükselirken,
          pencerenin kendisi daraldıysa çift kaymayı engeller. */}
      <View
        style={[
          styles.overlay,
          shrinkToFit && { paddingTop: sheet.topGap },
          overlayStyle,
        ]}
        onLayout={sheet.onOverlayLayout}
      >
        {/* Blur YERİNDE solar. `pointerEvents` şart: kapatma dokunuş alanının
            ÜSTÜNDE duruyor, dokunuşu yutarsa dışarı basınca kapanmaz. */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: sheet.backdropOpacity }]}
        >
          <ModalBlurBackdrop intensity={intensity} tint={tint} />
          {dimColor ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: dimColor }]}
            />
          ) : null}
        </Animated.View>

        {dismissOnBackdropPress ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
          />
        ) : null}

        {/* sheet.fit: klavye açıkken maxHeight'ı klavyenin üstündeki alana indirir;
            aksi halde yukarı kayan uzun sayfanın tepesi ekran dışında kalır. */}
        <Animated.View
          onLayout={sheet.onSheetLayout}
          style={[
            shrinkToFit && styles.shrinkable,
            sheet.fit(sheetStyle),
            sheet.sheetStyle,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  shrinkable: { flexShrink: 1 },
});
