import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { i18nText } from "../utils/i18nText";


export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (__DEV__) {
      console.error("ErrorBoundary caught:", error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>{i18nText("autoI18n.bir_seyler_ters_gitti", "Bir şeyler ters gitti")}</Text>
          <Text style={styles.message}>{i18nText("autoI18n.uygulama_beklenmedik_bir_hatayla_karsilasti", "Uygulama beklenmedik bir hatayla karşılaştı.")}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.buttonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emoji:    { fontSize: 52, marginBottom: 16 },
  title:    { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 10, textAlign: "center" },
  message:  { fontSize: 14, color: "#aaa", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  button:   { backgroundColor: "#e53935", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
