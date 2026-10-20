// components/common/ModalBlurBackdrop.js
//
// Modal/sheet arka planındaki bulanık katman.
//
// NEDEN AYRI BİR BİLEŞEN: Android'de blur, bulanıklaştıracağı yüzeyi açıkça
// hedeflemek zorunda (bkz. components/common/BlurTarget.js). Hedefi 23 modal
// çağrı yerine tek tek geçirmek yerine burada bir kez bağlanıyor — ve daha
// önemlisi, "hangi çağrı yeri hedef ALMALI" sorusu tek yerde cevaplanıyor.
//
// ── BUNU HER BLUR İÇİN KULLANMAYIN ──────────────────────────────────────────
//
// Yalnız EKRANIN ÜSTÜNDE yüzen, arkasında uygulamanın kendisi olan katmanlar
// içindir (`StyleSheet.absoluteFill` arka planlar). Kullanılmaması gerekenler:
//
//   • Ekran içeriğinin İÇİNDEKİ blur'lar (geri butonu, spoiler örtüsü, rozet):
//     bunlar hedefin içinde kalır ve kendi kayıtlarını okumaya çalışırlar.
//   • Modalın İÇİNDEKİ butonlar (ör. video oynatıcı kontrolleri): arkalarındaki
//     içerik modalın kendi penceresinde, hedefte değil — hedeflerlerse videonun
//     yerine altta kalan uygulamayı bulanıklaştırıp gösterirler.
//
// Bu iki grup `AdaptiveBlurView`i doğrudan kullanmaya devam eder ve Android'de
// düz katmana düşer (bugünkü davranış).
import React from "react";
import { StyleSheet } from "react-native";
import AdaptiveBlurView from "./AdaptiveBlurView";
import { BLUR_SCOPES, useBlurTargetRef } from "./BlurTarget";

/**
 * @param {object} props
 * @param {number} [props.intensity=40]
 * @param {"dark"|"light"} [props.tint="dark"]
 * @param {any} [props.style]  Verilmezse `StyleSheet.absoluteFill`.
 */
export default function ModalBlurBackdrop({
  intensity = 40,
  tint = "dark",
  style,
  children,
  ...rest
}) {
  // Modal Android'de ayrı bir pencereye çizildiği için, React ağacında "root"
  // yüzeyinin altında olsa da native olarak onun çocuğu değil — hedefleyebilir.
  const blurTarget = useBlurTargetRef(BLUR_SCOPES.root);

  return (
    <AdaptiveBlurView
      tint={tint}
      intensity={intensity}
      blurTarget={blurTarget}
      style={style || StyleSheet.absoluteFill}
      {...rest}
    >
      {children}
    </AdaptiveBlurView>
  );
}
