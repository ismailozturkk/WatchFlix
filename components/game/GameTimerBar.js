// components/game/GameTimerBar.js
//
// Aktif oyun zamanlayici cubugu (Part 12.1 / Part 19). Saf gosterim bileseni;
// renk/genislik hesaplari prop olarak hazir gelir, dahili durum tutmaz.

import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

export default function GameTimerBar({ timeLeft, timerRunning, timerWidth, timerColor }) {
  return (
    <View style={styles.timerWrap}>
      <View style={[styles.timerTrack, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
        <Animated.View style={[styles.timerFill, { width: timerWidth, backgroundColor: timerColor }]} />
      </View>
      <Text style={[styles.timerText, { color: timerColor }]}>{timerRunning ? `${timeLeft}s` : "..."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  timerWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 12, gap: 10 },
  timerTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  timerFill: { height: "100%", borderRadius: 4 },
  timerText: { fontSize: 13, fontWeight: "800", width: 24, textAlign: "right" },
});
