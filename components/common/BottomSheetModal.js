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
import React from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import ModalBlurBackdrop from "./ModalBlurBackdrop";
import useSheetTransition from "@hooks/useSheetTransition";
import { i18nText } from "@utils/i18nText";

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
 * @param {() => void} [props.onShow]  Modal göründüğünde (odaklama vb. için).
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
  onShow,
  children,
}) {
  const sheet = useSheetTransition(visible, { liftWithKeyboard });

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
        style={[styles.overlay, overlayStyle]}
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

        <Animated.View
          onLayout={sheet.onSheetLayout}
          style={[sheetStyle, sheet.sheetStyle]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
});
