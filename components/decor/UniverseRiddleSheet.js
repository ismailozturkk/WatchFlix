// components/decor/UniverseRiddleSheet.js
//
// Gizli evrenin kapı sorusu (detay sayfasındaki gizli karttan açılır). Soru evrenden, izleyenin
// kesin bileceği bir şey (utils/universeRiddles.js); ipucu yok. Doğru cevap evreni açar
// (useUniverseUnlocks().solve → tek belge, buluta bir yazma), yanlışta alan sallanır ve tekrar denenir.
// Sayfa kapanırken soru metni kaybolmasın diye `universe` çağırandan sabit gelir.

import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TextInput, View } from "react-native";
import BottomSheetModal from "../common/BottomSheetModal";
import GlassCloseButton from "../common/GlassCloseButton";
import GlassBox from "../common/GlassBox";
import GlassTouchable from "../common/GlassTouchable";
import AppIcon from "../AppIcon";
import useUniverseUnlocks from "../../hooks/useUniverseUnlocks";
import * as Haptics from "../../services/hapticsService";
import { i18nText } from "../../utils/i18nText";
import { matchesRiddle, riddleQuestion } from "../../utils/universeRiddles";

const ERROR = "#ef4444";

export default function UniverseRiddleSheet({ visible, universe, onClose, onSolved, theme }) {
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const { solve } = useUniverseUnlocks();

  useEffect(() => {
    if (visible) {
      setAnswer("");
      setWrong(false);
    }
  }, [visible]);

  const submit = () => {
    if (!answer.trim()) return;
    if (matchesRiddle(universe, answer)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Success);
      solve(universe);
      onSolved?.(universe);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Error);
    setWrong(true);
    shake.setValue(0);
    Animated.sequence(
      [8, -8, 6, -6, 0].map((toValue) =>
        Animated.timing(shake, { toValue, duration: 55, useNativeDriver: true }),
      ),
    ).start();
  };

  const accent = theme.accent;
  const canSubmit = answer.trim().length > 0;
  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <View style={styles.headerRow}>
        <View style={[styles.headerIcon, { backgroundColor: accent + "22" }]}>
          <AppIcon family="MaterialCommunityIcons" name="key-variant" size={18} color={accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {i18nText("autoI18n.evren_gizli_baslik", "Gizli bir evren buldun")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>
            {i18nText("autoI18n.evren_gizli_alt", "Kapıyı yalnız gerçekten izleyen açar.")}
          </Text>
        </View>
        <GlassCloseButton size={30} fallbackRadius={15} iconSize={16} onPress={onClose} />
      </View>

      <Text style={[styles.question, { color: theme.text.primary }]}>{riddleQuestion(universe)}</Text>

      <Animated.View style={{ transform: [{ translateX: shake }] }}>
        <GlassBox
          role="field"
          style={[
            styles.inputWrap,
            { backgroundColor: theme.primary, borderColor: wrong ? ERROR + "80" : accent + "66" },
          ]}
        >
          <AppIcon name="create-outline" size={16} color={wrong ? ERROR : accent} />
          <TextInput
            style={[styles.input, { color: theme.text.primary }]}
            placeholder={i18nText("autoI18n.evren_cevap_yer", "Cevabın…")}
            placeholderTextColor={theme.text.muted}
            value={answer}
            onChangeText={(v) => {
              setAnswer(v);
              if (wrong) setWrong(false);
            }}
            maxLength={40}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </GlassBox>
      </Animated.View>
      {wrong ? (
        <Text style={[styles.hint, { color: ERROR }]}>
          {i18nText("autoI18n.evren_cevap_yanlis", "Olmadı. Kapı hâlâ kapalı.")}
        </Text>
      ) : null}

      <GlassTouchable
        activeOpacity={0.85}
        onPress={submit}
        disabled={!canSubmit}
        style={[styles.submitBtn, { backgroundColor: accent, opacity: canSubmit ? 1 : 0.45 }]}
      >
        <AppIcon name="lock-open-outline" size={17} color="#000" />
        <Text style={styles.submitText}>{i18nText("autoI18n.evren_kapiyi_ac", "Kapıyı aç")}</Text>
      </GlassTouchable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
  },
  handle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, marginBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  headerIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: "800" },
  subtitle: { fontSize: 11, marginTop: 2 },
  question: { fontSize: 15, fontWeight: "700", lineHeight: 21, marginBottom: 12 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 11, fontSize: 14 },
  hint: { fontSize: 11.5, marginTop: 8, marginLeft: 4 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 16,
  },
  submitText: { color: "#000", fontSize: 14, fontWeight: "800" },
});
