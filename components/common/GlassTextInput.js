// components/common/GlassTextInput.js
//
// KENDİ kutusu olan TextInput'un (stilinde dolgu + çerçeve + köşe var) YERİNE
// GEÇEN alan: iOS 26+'da kutu Liquid Glass'a devredilir, yazı iç TextInput'ta
// kalır; diğer her yerde birebir TextInput çizilir.
//
//   <TextInput style={[s.input, { color, backgroundColor: theme.secondary, borderColor }]} …>
//   <GlassTextInput style={[s.input, { … aynı … }]} …>
//
// Stilin bölünmesi utils/glassChrome.splitInputStyle'da: kutu (dolgu, çerçeve,
// köşe, boyut, kenar boşluğu) cam sarmalayıcıya, yazı + iç dolgu (padding) iç
// TextInput'a gider; böylece alanın tamamı dokunma/odak alanı kalır.
//
// Kutusu OLMAYAN, bir kap View'ın içinde duran TextInput'lar için bu bileşen
// değil kapın kendisi GlassBox role="field" olur.
import React, { forwardRef } from "react";
import { StyleSheet, TextInput } from "react-native";
import GlassBox from "./GlassBox";
import useGlassChrome from "./useGlassChrome";
import { useGlassShape } from "../../services/liquidGlass";
import { splitInputStyle } from "../../utils/glassChrome";

const GlassTextInput = forwardRef(function GlassTextInput(
  { style, glass = true, focused, accent, onLayout, ...rest },
  ref,
) {
  // Cam yokken stile hiç dokunulmaz (düzleştirme yok): eski TextInput aynen.
  const glassOn = useGlassShape();
  const { box, text } = splitInputStyle(glassOn ? StyleSheet.flatten(style) || {} : {});
  // Cam yolu mu? Karar kutu stiline bakar (cam yoksa ya da kutu cama uygun
  // değilse eski tek TextInput).
  const chrome = useGlassChrome(box, { role: "field", enabled: glass });

  if (!chrome) {
    return <TextInput ref={ref} style={style} onLayout={onLayout} {...rest} />;
  }

  // Sabit/en az yükseklikte kutuyu iç alan doldursun (dokunma alanı + dikey
  // hizalama); `flex:1` DEĞİL — otomatik yükseklikli kutuda taban 0 olup çöker.
  const fills = box.height !== undefined || box.minHeight !== undefined;
  // Üst sınırlı çok satırlı alan: sınır kutuda kalırsa uzun metin camdan taşar;
  // iç alana da (çerçeve payı düşülerek) verilir ki içeride kaysın.
  const capped =
    typeof box.maxHeight === "number"
      ? { maxHeight: box.maxHeight - 2 * (typeof box.borderWidth === "number" ? box.borderWidth : 0) }
      : null;
  return (
    <GlassBox role="field" style={box} focused={focused} accent={accent} onLayout={onLayout}>
      <TextInput ref={ref} style={[text, fills && styles.fill, capped]} {...rest} />
    </GlassBox>
  );
});

export default GlassTextInput;

const styles = StyleSheet.create({
  fill: { flexGrow: 1 },
});
