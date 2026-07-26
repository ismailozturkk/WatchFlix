// components/ScreenDecor.js
//
// Ekran arka plan dekorunun TEK giriş noktası. Ekranlar tek tek <IconBacground />
// ve <ScreenSnow /> kurmak yerine sadece bunu koyar:
//
//   <View style={[styles.root, { backgroundColor: theme.primary }]}>
//     <ScreenDecor iconOpacity={0.3} />
//     …içerik…
//   </View>
//
// Neden ayrı bir bileşen:
//   • Katman sırası (ikon deseni → kar → içerik) tek yerde tanımlı; ekranlar
//     yanlış sırada kuramaz.
//   • Yeni bir arka plan efekti eklemek/çıkarmak 30+ ekran yerine bu dosyada
//     bir satır.
//   • İleride "dekoru ekran başına değil uygulama kökünde tek sefer monte et"
//     denirse, değişecek yer yine sadece burası olur.
//
// Katman: her iki çocuk da position:absolute + inset 0, yani ekranın arka plan
// renginin ÜSTÜNDE ama içeriğin ARKASINDA durur. İkisi de pointerEvents="none".
//
// Not: kar `showSnow`, desen `showIconBackground` ayarına bağlı — biri kapalıyken
// diğeri çalışmaya devam eder, ikisi birbirine bağlı değildir.

import React from "react";
import IconBacground from "./IconBacground";
import ScreenSnow from "./ScreenSnow";

function ScreenDecor({ iconOpacity = 0.5 }) {
  return (
    <>
      <IconBacground opacity={iconOpacity} />
      <ScreenSnow />
    </>
  );
}

export default React.memo(ScreenDecor);
