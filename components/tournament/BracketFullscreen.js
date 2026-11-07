// components/tournament/BracketFullscreen.js
//
// Eleme ağacının TAM EKRAN, YATAY görünümü. Uygulama dikeye kilitli
// (app.json orientation: portrait) ve ekran yönü kütüphanesi yok; bu yüzden
// yön değiştirmek yerine içerik 90° döndürülür: ekranın yüksekliği kadar geniş,
// genişliği kadar yüksek bir kutu ortalanıp `rotate: 90deg` alır. Kullanıcı
// telefonu sola yatırınca ağaç dümdüz okunur.
//
// Dönüşte güvenli alan kenarları da döner (saat yönünde 90°):
//   içeriğin solu → telefonun üstü (çentik)   → paddingLeft  = insets.top
//   içeriğin sağı → telefonun altı (ana çubuk) → paddingRight = insets.bottom
//   içeriğin üstü → telefonun sağı            → paddingTop   = insets.right
//   içeriğin altı → telefonun solu            → paddingBottom = insets.left
//
// Modal ayrı bir kök → iki parmak/kaydırma hareketleri (ZoomPanCanvas) için
// içerik GestureHandlerRootView ile sarılır.
//
// `matchCard`: döndürülmüş kutunun İÇİNDE açılan maç kartı. iOS açık bir
// Modal'ın üstüne ikinci bir kardeş Modal sunamadığı için ayrı Modal değil,
// aynı pencerede yatay bir katmandır. Yatay ekranın yüksekliği kart için az
// (≈ 330 dp): kart dar bir genişlikte çizilir, doğal yüksekliği ölçülür ve
// sığmazsa orantılı KÜÇÜLTÜLÜR (FitToBox) — hiçbir zaman ekrandan taşmaz.
//
// Animasyonsuz açılır: cam düğmeler saydamken çizilirse iOS 26.1+ camı düşürür
// (bkz. GlassSurface kuralları) — solma animasyonu bilerek yok.

import React, { useState } from "react";
import { Modal, Pressable, StatusBar, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import BracketTree from "@components/tournament/BracketTree";
import ModalToastHost from "@components/toast/ModalToastHost";

const EDGE = 10;
const CARD_W = 340;   // yatayda maç kartının çizim genişliği
const CARD_PAD = 12;  // kartın katman kenarına en yakın mesafesi

// Çocuğu `width` genişliğinde doğal boyutunda çizer; (maxW, maxH) kutusuna
// sığmazsa orantılı küçültür. RN ölçeği merkezden uyguladığı için dış kutu
// ölçeklenmiş boyutta, iç kutu ortalanmış gerçek boyutta durur.
function FitToBox({ width, maxW, maxH, children }) {
  const [h, setH] = useState(0);
  const scale = h ? Math.min(1, maxW / width, maxH / h) : 1;
  return (
    // Ölçüm karesinde opaklıkla GİZLEMEYİZ: kart cam yüzeyli, saydamken
    // çizilen camı iOS düşürür. İç kutuya yükseklik de verilmez → oy sonrası
    // kart uzayıp kısalınca onLayout yeni doğal yüksekliği yine bildirir.
    <View style={{ width: width * scale, height: h ? h * scale : undefined }}>
      <View
        style={
          h
            ? {
                position: "absolute", width,
                left: (width * scale - width) / 2, top: (h * scale - h) / 2,
                transform: [{ scale }],
              }
            : { width }
        }
        onLayout={(e) => {
          const nh = Math.round(e.nativeEvent.layout.height);
          if (nh > 0 && nh !== h) setH(nh);
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default function BracketFullscreen({
  visible, onClose, matchCard, onMatchClose, closeLabel, ...treeProps
}) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pad = {
    left: Math.max(insets.top, EDGE),
    right: Math.max(insets.bottom, EDGE),
    top: Math.max(insets.right, EDGE),
    bottom: Math.max(insets.left, EDGE),
  };
  // Döndürülmüş kutunun iç alanı (yatay): genişlik = ekran yüksekliği.
  const innerW = H - pad.left - pad.right;
  const innerH = W - pad.top - pad.bottom;

  return (
    <Modal
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={matchCard ? onMatchClose : onClose}
    >
      {visible && <StatusBar hidden />}
      <GestureHandlerRootView style={styles.root}>
        <View
          style={[
            styles.rotated,
            {
              width: H, height: W,
              left: (W - H) / 2, top: (H - W) / 2,
              paddingLeft: pad.left, paddingRight: pad.right,
              paddingTop: pad.top, paddingBottom: pad.bottom,
            },
          ]}
        >
          <BracketTree {...treeProps} fullscreen onClose={onClose} />
          {!!matchCard && (
            <View style={styles.matchLayer}>
              <Pressable
                style={[StyleSheet.absoluteFill, styles.matchBackdrop]}
                onPress={onMatchClose}
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
              />
              <FitToBox
                width={Math.min(CARD_W, innerW - 2 * CARD_PAD)}
                maxW={innerW - 2 * CARD_PAD}
                maxH={innerH - 2 * CARD_PAD}
              >
                {matchCard}
              </FitToBox>
            </View>
          )}
          <ModalToastHost visible={visible} />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05070D" },
  rotated: { position: "absolute", transform: [{ rotate: "90deg" }] },
  matchLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
  },
  matchBackdrop: { backgroundColor: "rgba(0,0,0,0.62)" },
});
