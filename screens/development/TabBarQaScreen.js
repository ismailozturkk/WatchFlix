// Standalone native fixture. Reachable only through the development-only entry
// switch in index.js; no login, backend writes, or persisted preference changes.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, View, ScrollView, Modal, TouchableOpacity, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurTargetProvider } from "../../components/common/BlurTarget";
import AdaptiveTabShell from "../../components/navigation/AdaptiveTabShell";
import { TAB_DEFINITIONS } from "../../utils/tabBarModel";
import { useTabBarLayout } from "../../context/TabBarLayoutContext";
import { setEffectMode, useEffectMode } from "../../services/effectSettings";
import { tabBarNativeSupport } from "../../services/tabBarCapabilities";

// Intentionally test the native text primitives without app typography providers.
const { Text, TextInput } = require("react-native");
const PALETTE = ["#ec407a", "#42a5f5", "#ffca28", "#26a69a", "#7e57c2"];
const DARK = { primary: "#141720", secondary: "#222735", tab: "#252b3b", accent: "#7ba6ff", shadow: "#000000", text: { primary: "#f8fafc", secondary: "#aab4c8" } };
const LIGHT = { primary: "#f2f5fb", secondary: "#ffffff", tab: "#f1f5fa", accent: "#2464dc", shadow: "#000000", text: { primary: "#15213b", secondary: "#52627d" } };

function QaButton({ id, label, onPress }) {
  return <TouchableOpacity testID={id} accessibilityLabel={label} style={styles.button} onPress={onPress}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
}
function QaModal({ visible, title, onClose }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View style={styles.modal}>
        <Text style={styles.title}>{title}</Text>
        <TextInput testID="modal-input" placeholder="Modal input" style={styles.input} />
        <QaButton id="close-modal" label="Close modal" onPress={onClose} />
      </View>
    </View>
  </Modal>;
}
function Fixture({ name, theme }) {
  const { contentBottom } = useTabBarLayout();
  const [count, setCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [modal, setModal] = useState(false);
  return <View style={[styles.fill, { backgroundColor: theme.primary }]}>
    <ScrollView testID={`scroll-${name}`} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: contentBottom }}>
      <Text testID={`screen-${name}`} style={[styles.title, { color: theme.text.primary }]}>{name}</Text>
      <Text testID={`counter-${name}`} style={{ color: theme.text.primary, marginBottom: 8 }}>Count: {count}</Text>
      <View style={styles.row}>
        <QaButton id={`increment-${name}`} label="Increment" onPress={() => setCount((n) => n + 1)} />
        <QaButton id={`modal-${name}`} label="Open modal" onPress={() => setModal(true)} />
      </View>
      <TextInput testID={`draft-${name}`} placeholder="Draft survives tab switches" value={draft} onChangeText={setDraft} style={styles.input} />
      {Array.from({ length: 24 }, (_, i) => (
        <LinearGradient key={i} colors={[PALETTE[i % 5], PALETTE[(i + 1) % 5]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <Text style={styles.cardTitle}>{name} / {i + 1}</Text>
          <Text style={styles.cardText}>LIVE BACKDROP · GLASS</Text>
          <View style={styles.stripes}>{Array.from({ length: 12 }, (_, n) => <View key={n} style={[styles.stripe, { backgroundColor: n % 2 ? "#ffffff" : "#17213c" }]} />)}</View>
        </LinearGradient>
      ))}
      <QaButton id={`last-${name}`} label="Last item" onPress={() => setCount((n) => n + 1)} />
    </ScrollView>
    <QaModal visible={modal} title={`Modal ${name}`} onClose={() => setModal(false)} />
  </View>;
}

function QaApp() {
  const [light, setLight] = useState(false);
  const [route, setRoute] = useState({ params: { initialTab: "discover" } });
  const [aiModal, setAiModal] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const effect = useEffectMode();
  const inset = useSafeAreaInsets();
  const theme = light ? LIGHT : DARK;
  useEffect(() => {
    Promise.all([Ionicons.loadFont(), MaterialCommunityIcons.loadFont()]).then(() => setFontsReady(true));
    setEffectMode("full", { persist: false });
  }, []);
  const navigation = useMemo(() => ({
    setParams: (params) => setRoute((value) => ({ params: { ...value.params, ...params } })),
    navigate: () => {},
  }), []);
  const tabs = useMemo(() => TAB_DEFINITIONS.map((tab) => ({ ...tab, label: tab.name })), []);
  const screens = useMemo(() => Object.fromEntries(tabs.map(({ name }) => [name, <Fixture key={name} name={name} theme={theme} />])), [tabs, theme]);
  // Yapay zeka girişi artık çubuğun yanındaki ayrık yuvarlak düğme (onAiPress).
  const openAi = useCallback(() => setAiModal(true), []);
  return <View style={[styles.fill, { paddingTop: inset.top, backgroundColor: theme.primary }]}>
    <Text style={{ color: theme.text.primary, paddingHorizontal: 12 }} testID="qa-status">{Platform.OS} · shader {String(tabBarNativeSupport.androidGlassAvailable)} · {effect}</Text>
    <View style={styles.row}>
      <QaButton id="mode-full" label="Glass" onPress={() => setEffectMode("full", { persist: false })} />
      <QaButton id="mode-balanced" label="Blur" onPress={() => setEffectMode("balanced", { persist: false })} />
      <QaButton id="mode-off" label="Off" onPress={() => setEffectMode("off", { persist: false })} />
      <QaButton id="theme-toggle" label="Theme" onPress={() => setLight((value) => !value)} />
      <QaButton id="jump-profile" label="Profile" onPress={() => setRoute({ params: { initialTab: "profile" } })} />
    </View>
    {fontsReady && <AdaptiveTabShell navigation={navigation} route={route} tabs={tabs} screens={screens} theme={theme} onAiPress={openAi} aiLabel="CineMatch" />}
    <QaModal visible={aiModal} title="CineMatch" onClose={() => setAiModal(false)} />
  </View>;
}
export default function TabBarQaScreen() {
  return <GestureHandlerRootView style={styles.fill}><SafeAreaProvider><BlurTargetProvider><QaApp /></BlurTargetProvider></SafeAreaProvider></GestureHandlerRootView>;
}
const styles = StyleSheet.create({
  fill: { flex: 1 }, row: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 6 },
  button: { paddingHorizontal: 10, paddingVertical: 12, backgroundColor: "#3157a6", borderRadius: 10 },
  buttonText: { color: "#ffffff", fontSize: 12 }, title: { fontSize: 23, fontWeight: "700", marginBottom: 10, color: "#1a2131" },
  input: { minHeight: 48, borderRadius: 10, backgroundColor: "#ffffff", color: "#111827", padding: 12, marginVertical: 10 },
  card: { height: 144, borderRadius: 14, marginVertical: 7, padding: 16, overflow: "hidden" },
  cardTitle: { fontSize: 24, fontWeight: "700", color: "#17213c" }, cardText: { fontSize: 14, color: "#17213c", marginTop: 8 },
  stripes: { flexDirection: "row", height: 24, marginTop: 12 }, stripe: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "#000000aa", justifyContent: "center", padding: 24 },
  modal: { padding: 24, backgroundColor: "#e8edf7", borderRadius: 24 },
});
