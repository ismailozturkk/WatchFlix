// components/ai/AIThinking.js
//
// Cevap beklenirken gösterilen yer tutucu: dönen durum metni + kart iskeleti.
// Tek satırlık "Düşünüyor…" yerine cevabın şeklini önceden gösterir; bekleme
// (AI + TMDB çözümü birkaç saniye sürer) daha kısa hissedilir.

import React, { memo, useEffect, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Reanimated, { FadeInUp } from "react-native-reanimated";

import { alpha } from "../../theme/colors";

const STATUS_INTERVAL_MS = 1700;

function AIThinking({ theme, copy }) {
  const [index, setIndex] = useState(0);
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    const id = setInterval(() => setIndex((value) => (value + 1) % copy.thinking.length), STATUS_INTERVAL_MS);
    return () => clearInterval(id);
  }, [copy]);

  const block = { backgroundColor: alpha(theme.text.muted, 0.22) };

  return (
    <Reanimated.View entering={FadeInUp.duration(200)} style={s.row}>
      <View style={[s.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <View style={s.head}>
          <View style={[s.icon, { backgroundColor: alpha(theme.accent, 0.16) }]}>
            <Ionicons name="sparkles" size={15} color={theme.bold} />
          </View>
          <Text style={[s.status, { color: theme.text.secondary }]} numberOfLines={1}>
            {copy.thinking[index]}
          </Text>
        </View>
        <Animated.View style={{ opacity: pulse }}>
          {[0, 1].map((i) => (
            <View key={i} style={s.item}>
              <View style={[s.poster, block]} />
              <View style={{ flex: 1, gap: 7 }}>
                <View style={[s.line, block, { width: "62%", height: 12 }]} />
                <View style={[s.line, block, { width: "38%" }]} />
                <View style={[s.line, block, { width: "92%" }]} />
                <View style={[s.line, block, { width: "74%" }]} />
              </View>
            </View>
          ))}
        </Animated.View>
      </View>
    </Reanimated.View>
  );
}

export default memo(AIThinking);

const s = StyleSheet.create({
  row: { width: "100%", marginBottom: 14 },
  card: { width: "100%", borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  status: { flex: 1, fontSize: 12.5, fontWeight: "600" },
  item: { flexDirection: "row", gap: 12, marginTop: 10 },
  poster: { width: 56, height: 84, borderRadius: 10 },
  line: { height: 9, borderRadius: 5 },
});
