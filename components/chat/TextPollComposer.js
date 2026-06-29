// components/chat/TextPollComposer.js
//
// Metin anketi oluşturma modalı: soru + 2-6 metin seçeneği. Onaylanınca
// onCreate(question, options[]) çağrılır (ChatScreen poll mesajı olarak yazar).

import React, { useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { i18nText } from "../../utils/i18nText";

const MAX_OPTS = 6;
const ACCENT = "#6C63FF";

export default function TextPollComposer({ visible, onClose, onCreate }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const reset = useCallback(() => {
    setQuestion("");
    setOptions(["", ""]);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose?.();
  }, [reset, onClose]);

  const setOpt = (i, v) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  const addOpt = () =>
    setOptions((prev) => (prev.length < MAX_OPTS ? [...prev, ""] : prev));
  const removeOpt = (i) =>
    setOptions((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));

  const clean = options.map((o) => o.trim()).filter(Boolean);
  const canCreate = question.trim().length > 0 && clean.length >= 2;

  const create = useCallback(() => {
    if (!canCreate) return;
    onCreate?.(question.trim(), clean);
    reset();
  }, [canCreate, question, clean, onCreate, reset]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.overlay} onPress={close}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheet}>
              <View style={styles.handle} />

              <View style={styles.header}>
                <View style={styles.badge}>
                  <Ionicons name="stats-chart" size={15} color={ACCENT} />
                </View>
                <Text style={styles.title}>{i18nText("autoI18n.metin_anketi", "Metin Anketi")}</Text>
                <TouchableOpacity onPress={close} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>

              {/* Soru */}
              <TextInput
                value={question}
                onChangeText={setQuestion}
                placeholder={i18nText("autoI18n.sorunuz", "Sorunuz...")}
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={styles.questionInput}
                selectionColor={ACCENT}
                maxLength={120}
                multiline
              />

              {/* Seçenekler */}
              <Text style={styles.label}>{i18nText("autoI18n.secenekler", "Seçenekler")}</Text>
              {options.map((opt, i) => (
                <View key={i} style={styles.optRow}>
                  <View style={styles.optDot} />
                  <TextInput
                    value={opt}
                    onChangeText={(v) => setOpt(i, v)}
                    placeholder={i18nText("autoI18n.secenek_n", "Seçenek {{n}}", { n: i + 1 })}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={styles.optInput}
                    selectionColor={ACCENT}
                    maxLength={60}
                  />
                  {options.length > 2 && (
                    <TouchableOpacity onPress={() => removeOpt(i)} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.35)" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {options.length < MAX_OPTS && (
                <TouchableOpacity onPress={addOpt} style={styles.addOpt}>
                  <Ionicons name="add-circle-outline" size={18} color={ACCENT} />
                  <Text style={styles.addOptText}>{i18nText("autoI18n.secenek_ekle", "Seçenek ekle")}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={create}
                disabled={!canCreate}
                activeOpacity={0.85}
                style={[styles.createBtn, { opacity: canCreate ? 1 : 0.4 }]}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.createBtnText}>{i18nText("autoI18n.anketi_olustur", "Anketi Oluştur")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.65)" },
  sheet: {
    backgroundColor: "#14142B",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.09)",
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 14,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(108,99,255,0.15)",
    borderWidth: 1,
    borderColor: ACCENT + "44",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { flex: 1, fontSize: 17, fontWeight: "700", color: "#fff" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    justifyContent: "center",
    alignItems: "center",
  },
  questionInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    minHeight: 48,
    marginBottom: 16,
  },
  label: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  optRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  optDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  optInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 11 },
  addOpt: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, alignSelf: "flex-start" },
  addOptText: { color: ACCENT, fontSize: 13.5, fontWeight: "700" },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 10,
  },
  createBtnText: { color: "#fff", fontSize: 15.5, fontWeight: "800" },
});
