import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Reanimated from "react-native-reanimated";
import BottomSheetModal from "@components/common/BottomSheetModal";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { alpha } from "../../theme/colors";

const MAX_OPTS = 6;

export default function TextPollComposer({
  visible,
  onClose,
  onCreate,
  keyboardAvoidanceStyle,
}) {
  const { theme } = useTheme();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const questionInputRef = useRef(null);
  const focusTimerRef = useRef(null);

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

  const handleShow = useCallback(() => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      questionInputRef.current?.focus();
      focusTimerRef.current = null;
    }, 260);
  }, []);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, []);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={close}
      intensity={35}
      dimColor="rgba(0,0,0,0.4)"
      liftWithKeyboard={false}
      onShow={handleShow}
    >
      <Reanimated.View style={keyboardAvoidanceStyle}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <View style={styles.header}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: alpha(theme.accent, 0.15),
                  borderColor: alpha(theme.accent, 0.35),
                },
              ]}
            >
              <Ionicons name="stats-chart" size={15} color={theme.accent} />
            </View>
            <Text style={[styles.title, { color: theme.text.primary }]}>
              {i18nText("autoI18n.metin_anketi", "Metin Anketi")}
            </Text>
            <TouchableOpacity
              onPress={close}
              style={[styles.closeBtn, { backgroundColor: theme.between }]}
            >
              <Ionicons name="close" size={20} color={theme.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Soru */}
          <TextInput
            ref={questionInputRef}
            value={question}
            onChangeText={setQuestion}
            placeholder={i18nText("autoI18n.sorunuz", "Sorunuz...")}
            placeholderTextColor={theme.text.muted}
            style={[
              styles.questionInput,
              {
                backgroundColor: theme.between,
                borderColor: theme.border,
                color: theme.text.primary,
              },
            ]}
            selectionColor={theme.accent}
            maxLength={120}
            multiline
          />

          {/* Seçenekler */}
          <Text style={[styles.label, { color: theme.text.muted }]}>
            {i18nText("autoI18n.secenekler", "Seçenekler")}
          </Text>
          {options.map((opt, i) => (
            <View
              key={i}
              style={[
                styles.optRow,
                { backgroundColor: theme.between, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.optDot,
                  { borderColor: theme.text.muted },
                ]}
              />
              <TextInput
                value={opt}
                onChangeText={(v) => setOpt(i, v)}
                placeholder={i18nText("autoI18n.secenek_n", "Seçenek {{n}}", { n: i + 1 })}
                placeholderTextColor={theme.text.muted}
                style={[styles.optInput, { color: theme.text.primary }]}
                selectionColor={theme.accent}
                maxLength={60}
              />
              {options.length > 2 && (
                <TouchableOpacity onPress={() => removeOpt(i)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={theme.text.muted} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {options.length < MAX_OPTS && (
            <TouchableOpacity onPress={addOpt} style={styles.addOpt}>
              <Ionicons name="add-circle-outline" size={18} color={theme.accent} />
              <Text style={[styles.addOptText, { color: theme.accent }]}>
                {i18nText("autoI18n.secenek_ekle", "Seçenek ekle")}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={create}
            disabled={!canCreate}
            activeOpacity={0.85}
            style={[
              styles.createBtn,
              { backgroundColor: theme.accent, opacity: canCreate ? 1 : 0.4 },
            ]}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.createBtnText}>
              {i18nText("autoI18n.anketi_olustur", "Anketi Oluştur")}
            </Text>
          </TouchableOpacity>
        </View>
      </Reanimated.View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { flex: 1, fontSize: 17, fontWeight: "700" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  questionInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
    minHeight: 48,
    marginBottom: 16,
  },
  label: {
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
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  optDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  optInput: { flex: 1, fontSize: 14, paddingVertical: 11 },
  addOpt: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, alignSelf: "flex-start" },
  addOptText: { fontSize: 13.5, fontWeight: "700" },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 10,
  },
  createBtnText: { color: "#fff", fontSize: 15.5, fontWeight: "800" },
});
