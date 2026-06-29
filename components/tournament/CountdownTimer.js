// components/tournament/CountdownTimer.js
//
// Gün : Saat : Dakika : Saniye geri sayımı. Değişen RAKAMLAR üstten alta doğru
// kayarak yenilenir (flip/odometer hissi): yeni rakam yukarıdan girer, eski
// rakam aşağı çıkar. Her hücre 0..9 değil, "eski + yeni" iki katman tutar; bu
// sayede her değişim yönü TUTARLI (her zaman üst→alt) olur, 9→0 sıçraması olmaz.
//
// Her saniye kendi içinde yeniden render olur (parent'i tetiklemez). "now()"
// motordan gelir → setDebugNow ile dondurulduğunda sayaç da durur (önizleme).

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { now } from "@services/tournamentEngine";

const DUR = 420;

// ─── Tek rakam (üstten alta kayan) ────────────────────────────────────────────
function RollingDigit({ ch, h, w, font, color }) {
  const [pair, setPair] = useState({ prev: ch, cur: ch });
  const y = useSharedValue(1); // 1 = yerleşmiş (cur görünür)

  useEffect(() => {
    if (ch === pair.cur) return;
    setPair({ prev: pair.cur, cur: ch });
    y.value = 0;                 // eski üstte (0), yeni yukarıda (-h)
    y.value = withTiming(1, { duration: DUR, easing: Easing.out(Easing.cubic) });
  }, [ch]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * h }] }));      // 0 → +h (aşağı çıkar)
  const curStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (y.value - 1) * h }] }));   // -h → 0 (yukarıdan girer)
  const tStyle = { width: w, fontSize: font, lineHeight: h, color, fontWeight: "900", textAlign: "center" };

  return (
    <View style={{ height: h, width: w, overflow: "hidden" }}>
      <Animated.Text style={[styles.abs, tStyle, prevStyle]}>{pair.prev}</Animated.Text>
      <Animated.Text style={[styles.abs, tStyle, curStyle]}>{pair.cur}</Animated.Text>
    </View>
  );
}

// ─── Bir birim (2 haneli kutu + etiket) ───────────────────────────────────────
function Unit({ value, label, dims, textColor, boxColor, labelColor }) {
  const s = String(value).padStart(2, "0");
  return (
    <View style={{ alignItems: "center" }}>
      <View style={[styles.box, { backgroundColor: boxColor }]}>
        <RollingDigit ch={s[0]} h={dims.h} w={dims.w} font={dims.font} color={textColor} />
        <RollingDigit ch={s[1]} h={dims.h} w={dims.w} font={dims.font} color={textColor} />
      </View>
      <Text style={{ color: labelColor, fontSize: dims.label, fontWeight: "800", marginTop: 3, letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );
}

export default function CountdownTimer({
  deadlineMs,
  lang = "tr",
  size = "lg",
  textColor = "#fff",
  boxColor = "rgba(255,255,255,0.16)",
  labelColor = "rgba(255,255,255,0.72)",
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => (x + 1) % 1e6), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, (deadlineMs || 0) - now());
  const tot = Math.floor(remaining / 1000);
  const d = Math.floor(tot / 86400);
  const h = Math.floor((tot % 86400) / 3600);
  const m = Math.floor((tot % 3600) / 60);
  const s = tot % 60;

  const dims = size === "lg"
    ? { h: 30, w: 17, font: 25, label: 10 }
    : { h: 19, w: 11, font: 15, label: 7 };
  const labels = lang === "tr" ? ["GÜN", "SAAT", "DK", "SN"] : ["DAY", "HR", "MIN", "SEC"];
  const values = [d, h, m, s];

  return (
    <View style={styles.row}>
      {values.map((v, i) => (
        <React.Fragment key={i}>
          <Unit value={v} label={labels[i]} dims={dims} textColor={textColor} boxColor={boxColor} labelColor={labelColor} />
          {i < 3 && (
            <Text style={[styles.sep, { color: textColor, fontSize: dims.font * 0.62, marginBottom: dims.label + 6 }]}>:</Text>
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  abs: { position: "absolute", left: 0, right: 0 },
  box: { flexDirection: "row", borderRadius: 8, paddingHorizontal: 4, paddingVertical: 3 },
  sep: { fontWeight: "900", marginHorizontal: 3, alignSelf: "center" },
});
