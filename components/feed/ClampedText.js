// components/feed/ClampedText.js
//
// Feed kartındaki uzun başlık/içerik için "Devamını oku" yapısı.
//
// İKİ PARÇA, çünkü inceleme kartında başlık ve içerik tek düğmeyle birlikte
// açılır (iki ayrı düğme poster yanındaki dar sütunu boğardı):
//   • ClampedText   — metni `lines` satırla kısaltır ve KESİLİP KESİLMEDİĞİNİ
//                     `onOverflowChange` ile bildirir. Açık/kapalı durumu çağıranda.
//   • ReadMoreToggle — tek "Devamını oku / Daha az" düğmesi.
//
// SATIR SAYIMI: kısaltılmış metnin `onTextLayout`u platformlara göre kesilmiş ya
// da tam satırları bildirir; bu yüzden güvenilmez. Bunun yerine görünmez, SINIRSIZ
// bir kopya ölçülür (mutlak konumlu, opacity 0) ve gerçek satır sayısı oradan
// okunur. Kısa metinde (`mayOverflow` false) ölçer hiç kurulmaz — akışta çoğu
// kart bu yoldan geçer ve ikinci bir metin yerleşimi ödemez.

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import { mayOverflow } from "../../utils/textClamp";
import { i18nText } from "../../utils/i18nText";

const ClampedText = memo(function ClampedText({
  text,
  lines,
  expanded,
  onOverflowChange,
  style,
  fontRole = "body",
}) {
  const value = typeof text === "string" ? text : "";
  const measure = mayOverflow(value, lines);
  const [overflow, setOverflow] = useState(false);

  // Güncel callback ref'ten okunur: çağıran satır içi fonksiyon verse bile
  // efekt her render'da yeniden çalışıp bildirimi tekrarlamaz.
  const notifyRef = useRef(onOverflowChange);
  notifyRef.current = onOverflowChange;

  const onMeasured = useCallback(
    (event) => {
      const total = event?.nativeEvent?.lines?.length ?? 0;
      setOverflow(total > lines);
    },
    [lines],
  );

  // Metin kısaldıysa ölçer kalkar: eski "taşıyor" bilgisi geçerli olmaz.
  const cut = measure && overflow;
  useEffect(() => {
    notifyRef.current?.(cut);
  }, [cut]);
  // Gövde değişip metin hiç çizilmezse (ör. spoiler perdesi) çağıranda
  // bayat "taşıyor" kalmasın.
  useEffect(() => () => notifyRef.current?.(false), []);

  if (!value) return null;

  return (
    <View>
      <Text
        fontRole={fontRole}
        style={style}
        numberOfLines={expanded ? undefined : lines}
        ellipsizeMode="tail"
      >
        {value}
      </Text>
      {measure ? (
        <Text
          fontRole={fontRole}
          style={[style, styles.measurer]}
          onTextLayout={onMeasured}
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {value}
        </Text>
      ) : null}
    </View>
  );
});

export default ClampedText;

export const ReadMoreToggle = memo(function ReadMoreToggle({
  expanded,
  onPress,
  color,
  style,
}) {
  const label = expanded
    ? i18nText("autoI18n.daha_az", "Daha az")
    : i18nText("autoI18n.devamini_oku", "Devamını oku");

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      style={({ pressed }) => [styles.toggle, style, pressed && styles.toggleDown]}
    >
      <Text style={[styles.toggleText, { color }]}>{label}</Text>
      <AppIcon
        family="Ionicons"
        name={expanded ? "chevron-up" : "chevron-down"}
        size={14}
        color={color}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // Görünmez ölçer: akışa girmez, tıklanmaz, tam genişlikte yerleşir.
  measurer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 3,
    paddingVertical: 2,
  },
  toggleDown: { opacity: 0.6 },
  toggleText: { fontSize: 12.5, fontWeight: "800" },
});
