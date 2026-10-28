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
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import SheetScroll from "@components/common/SheetScroll";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { alpha } from "../../theme/colors";
import GlassTouchable from "../common/GlassTouchable";
import GlassTextInput from "../common/GlassTextInput";
import GlassBox from "../common/GlassBox";

const MAX_OPTS = 6;

export default function TextPollComposer({
  visible,
  onClose,
  onCreate,
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
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
      onShow={handleShow}
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
          <Ionicons name="stats-chart" size={16} color={theme.accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {i18nText("autoI18n.metin_anketi", "Metin Anketi")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>
            {i18nText(
              "autoI18n.anket_icin_en_az_2_secenek_ekle",
              "Anket için en az 2 seçenek ekle.",
            )}
          </Text>
        </View>
        <GlassCloseButton
          size={32}
          fallbackRadius={16}
          iconSize={20}
          color={theme.text.primary}
          backgroundColor={theme.between}
          onPress={close}
        />
      </View>

      <SheetScroll contentContainerStyle={styles.formContent}>
        {/* Soru */}
        <View style={styles.sectionHead}>
          <Text style={[styles.label, { color: theme.text.muted }]}>
            {i18nText("autoI18n.sorunuz", "Sorunuz...").replace(/\.{3}$/, "")}
          </Text>
          <Text style={[styles.counter, { color: theme.text.muted }]}>
            {question.length}/120
          </Text>
        </View>
        <View style={styles.questionWrap}>
          <View style={[styles.questionIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
            <Ionicons name="help" size={15} color={theme.accent} />
          </View>
          <GlassTextInput
            ref={questionInputRef}
            value={question}
            onChangeText={setQuestion}
            placeholder={i18nText("autoI18n.sorunuz", "Sorunuz...")}
            placeholderTextColor={theme.text.muted}
            style={[
              styles.questionInput,
              {
                backgroundColor: theme.between,
                borderColor: question.trim() ? alpha(theme.accent, 0.5) : theme.border,
                color: theme.text.primary,
              },
            ]}
            selectionColor={theme.accent}
            maxLength={120}
            multiline
          />
        </View>

        {/* Seçenekler */}
        <View style={[styles.sectionHead, styles.optionsHead]}>
          <Text style={[styles.label, { color: theme.text.muted }]}>
            {i18nText("autoI18n.secenekler", "Seçenekler")}
          </Text>
          <View style={[styles.optionCount, { backgroundColor: alpha(theme.accent, 0.12) }]}>
            <Text style={[styles.optionCountText, { color: theme.accent }]}>
              {options.length}/{MAX_OPTS}
            </Text>
          </View>
        </View>
        {options.map((opt, i) => (
          <GlassBox
            role="field"
            key={i}
            style={[
              styles.optRow,
              {
                backgroundColor: theme.between,
                borderColor: opt.trim() ? alpha(theme.accent, 0.38) : theme.border,
              },
            ]}
          >
            <View
              style={[
                styles.optIndex,
                {
                  backgroundColor: opt.trim() ? theme.accent : alpha(theme.text.muted, 0.14),
                  borderColor: opt.trim() ? theme.accent : alpha(theme.text.muted, 0.35),
                },
              ]}
            >
              <Text style={[styles.optIndexText, { color: opt.trim() ? "#fff" : theme.text.muted }]}>
                {i + 1}
              </Text>
            </View>
            <TextInput
              value={opt}
              onChangeText={(v) => setOpt(i, v)}
              placeholder={i18nText("autoI18n.secenek_n", "Seçenek {{n}}", { n: i + 1 })}
              placeholderTextColor={theme.text.muted}
              style={[styles.optInput, { color: theme.text.primary }]}
              selectionColor={theme.accent}
              maxLength={60}
              returnKeyType={i === options.length - 1 ? "done" : "next"}
            />
            {options.length > 2 && (
              <TouchableOpacity
                onPress={() => removeOpt(i)}
                style={styles.removeOpt}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.sil", "Sil")}
              >
                <Ionicons name="close" size={16} color={theme.text.muted} />
              </TouchableOpacity>
            )}
          </GlassBox>
        ))}

        {options.length < MAX_OPTS && (
          <GlassTouchable
            onPress={addOpt}
            style={[styles.addOpt, { borderColor: alpha(theme.accent, 0.35) }]}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={18} color={theme.accent} />
            <Text style={[styles.addOptText, { color: theme.accent }]}>
              {i18nText("autoI18n.secenek_ekle", "Seçenek ekle")}
            </Text>
          </GlassTouchable>
        )}
      </SheetScroll>

      <GlassTouchable
        testID="text-poll-create"
        onPress={create}
        disabled={!canCreate}
        activeOpacity={0.85}
        style={[
          styles.createBtn,
          { backgroundColor: theme.accent, opacity: canCreate ? 1 : 0.4 },
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canCreate }}
      >
        <Ionicons name="checkmark-circle" size={18} color="#fff" />
        <Text style={styles.createBtnText}>
          {i18nText("autoI18n.anketi_olustur", "Anketi Oluştur")}
        </Text>
      </GlassTouchable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flexShrink: 1,
    maxHeight: "88%",
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
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 17, fontWeight: "800" },
  subtitle: { fontSize: 11.5, lineHeight: 16, marginTop: 1 },
  formContent: { paddingBottom: 4 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  optionsHead: { marginTop: 14 },
  counter: { fontSize: 10.5, fontWeight: "700" },
  questionWrap: { position: "relative" },
  questionIcon: {
    position: "absolute",
    left: 12,
    top: 12,
    zIndex: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  questionInput: {
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 46,
    paddingRight: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
    minHeight: 52,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  optionCount: {
    minWidth: 38,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
  },
  optionCountText: { fontSize: 10.5, fontWeight: "800" },
  optRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 10,
    paddingRight: 7,
    marginBottom: 8,
    minHeight: 48,
  },
  optIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  optIndexText: { fontSize: 11, fontWeight: "900" },
  optInput: { flex: 1, fontSize: 14, paddingVertical: 11 },
  removeOpt: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  addOpt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
  },
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
