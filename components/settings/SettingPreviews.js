// components/settings/SettingPreviews.js
//
// Ayar SATIRININ ARKASINDA çalışan küçük önizleme. Amaç, "Kar efekti" (atmosfer)
// ayarının ne yaptığını anlatmak yerine GÖSTERMEK: kullanıcı açmadan önce
// satırın zemininde efektin küçültülmüş halini görür.
// (Ambiyans ve ikon arka planı önizlemeleri 9 Kas'ta Atmosfer ekranındaki
// components/settings/BackgroundLayerCards.js'e taşındı.)
//
// Yalnız dekor: pointerEvents="none" ile dokunmayı geçirir, satırın
// kendi metin/anahtar katmanı üstte kalır. Kırpma satırda yapılır (bkz.
// settingsUi.SettingRow → background verildiğinde overflow:"hidden").

import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import WeatherLayer from "../decor/WeatherLayer";
import useAppActive from "../../hooks/useAppActive";
import useReduceMotion from "../../hooks/useReduceMotion";
import useScreenFocused from "../../hooks/useScreenFocused";
/**
 * Hava efekti önizlemesi: satırın zemininde, SEÇİLİ türün (kar/yaprak/...)
 * küçültülmüş hali. Satır ölçülür, parçacık sayısı alanla orantılıdır.
 *
 * Ayar AÇIKKEN kullanılmaz — o durumda efekt zaten tüm ekranda, satırda ikinci
 * bir katman kurmak boşuna maliyet olurdu (bkz. PersonalizationScreen).
 */
// Opaklıklar bilerek düşük: önizleme satırın METNİNİN ARKASINDA duruyor,
// başlık/alt başlık her temada okunur kalmalı.
export function SnowPreview({ opacity = 0.6 }) {
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  // Kişiselleştirme'den daha derine geçilince bu ekran yığında bağlı kalıyor;
  // odak yokken önizleme durmalı (eskiden arkada 60 fps çizmeye devam ediyordu).
  const focused = useScreenFocused();
  const [size, setSize] = useState(null);

  // "Hareketi Azalt" açıkken hiç çizilmez: önizleme de bir animasyondur.
  if (reduceMotion) return null;

  return (
    <View
      style={[styles.fill, { opacity }]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) =>
          prev && prev.width === width && prev.height === height ? prev : { width, height },
        );
      }}
    >
      {size ? (
        <WeatherLayer
          preview
          width={size.width}
          height={size.height}
          playing={appActive && focused}
          // Tam ekranla aynı hızda akınca dar şeritte telaşlı görünüyor.
          speedScale={0.6}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  patternIcon: { position: "absolute" },
});
