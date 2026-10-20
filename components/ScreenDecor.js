// components/ScreenDecor.js
//
// Ekran arka plan dekorunun TEK giriş noktası. Ekranlar tek tek <IconBacground />
// ve <ScreenSnow /> kurmak yerine sadece bunu koyar:
//
//   <View style={[styles.root, { backgroundColor: theme.primary }]}>
//     <ScreenDecor scope="lists" iconOpacity={0.3} />
//     …içerik…
//   </View>
//
// Neden ayrı bir bileşen:
//   • Katman sırası (ambiyans → ikon deseni → kar → içerik) tek yerde tanımlı;
//     ekranlar yanlış sırada kuramaz.
//   • Yeni bir arka plan efekti eklemek/çıkarmak 30+ ekran yerine bu dosyada
//     bir satır.
//   • "Hangi efekt hangi ekranda" süzgeci tek yerde (aşağıdaki `scope`).
//   • İleride "dekoru ekran başına değil uygulama kökünde tek sefer monte et"
//     denirse, değişecek yer yine sadece burası olur.
//
// Katman: her çocuk position:absolute + inset 0, yani ekranın arka plan
// renginin ÜSTÜNDE ama içeriğin ARKASINDA durur. Hepsi pointerEvents="none".
//
// İKİ KAPI: bir efekt ancak (1) genel anahtarı açıksa (Kişiselleştirme'deki
// kar/ikon/ambiyans düğmesi — efektin kendi bileşeni okur) VE (2) bu ekranın
// grubunda gizlenmemişse görünür (Kişiselleştirme > Ekran bazında). İkisi
// birbirine bağlı değil; biri kapalıyken diğerleri çalışır.
//
// PROPLAR
//   scope   ekran grubu kimliği (utils/decorScopes.js DECOR_SCOPES). ZORUNLU
//           sayılır: yeni ekran grubunu bilmezse kullanıcının seçimini yok sayar
//           (__tests__/decorScopes.test.js her <ScreenDecor> çağrısını denetler).
//   effects bu ekranın çizebildiği efektler (varsayılan hepsi). Örn. yorum
//           paneli yalnız ["icon"] ister: dar/kaydırmalı alanda kar ve ambiyans
//           dikkat dağıtıyordu.

import React from "react";
import AmbientBackground from "./AmbientBackground";
import IconBacground from "./IconBacground";
import ScreenSnow from "./ScreenSnow";
import useDecorVisibility from "../hooks/useDecorVisibility";

function ScreenDecor({ iconOpacity = 0.5, scope, effects }) {
  const show = useDecorVisibility(scope, effects);
  return (
    <>
      {show.ambient ? <AmbientBackground /> : null}
      {show.icon ? <IconBacground opacity={iconOpacity} /> : null}
      {show.snow ? <ScreenSnow /> : null}
    </>
  );
}

export default React.memo(ScreenDecor);
