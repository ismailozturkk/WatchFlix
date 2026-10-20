// components/cineswipe/CineDuoLobby.js
//
// Duo giriş ekranı: yeni oda kur ya da kodla katıl.
//   • Kod kutusu yalnız rakam kabul eder (yapıştırılan "749 215" artık "geçersiz
//     kod" demez) ve 6 hane dolunca "Katıl" belirginleşir.
//   • "Panodan yapıştır": arkadaşın paylaştığı TÜM mesajdan kodu ayıklar.
//   • Hata kartı sorunu ve çıkış yollarını (yeniden kod gir / Hub) birlikte verir.
//   • Son oyun sonucu aynı kartın içinde, formun altında durur.
import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import CineEmptyState from "./CineEmptyState";
import PressableScale from "./PressableScale";
import { alpha } from "../../theme/colors";
import { sanitizeRoomCode } from "../../services/cineswipe/deckModel";
import GlassTextInput from "../common/GlassTextInput";

export default function CineDuoLobby({
  copy,
  joinText,
  resultText,
  colors,
  joining,
  inputCode,
  onChangeCode,
  inputRef,
  onCreate,
  onJoin,
  onPaste,
  joinError,
  onRetryJoin,
  onHub,
  hasLastResult,
  onOpenLastResult,
}) {
  const [focused, setFocused] = useState(false);
  const ready = inputCode.length === 6 && !joining;
  const steps = [
    { icon: "add-circle-outline", label: copy.lobby.step1 },
    { icon: "share-social-outline", label: copy.lobby.step2 },
    { icon: "swap-horizontal", label: copy.lobby.step3 },
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <CineEmptyState
        icon="people"
        tint={colors.accent}
        title={copy.lobby.title}
        body={copy.lobby.body}
        colors={colors}
        style={styles.hero}
      />

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={step.label} style={[styles.step, { backgroundColor: alpha(colors.surface, 0.55) }]}>
            <View style={[styles.stepIcon, { backgroundColor: alpha(colors.accent, 0.15) }]}>
              <AppIcon family="Ionicons" name={step.icon} size={17} color={colors.accent} />
            </View>
            <Text style={[styles.stepIndex, { color: colors.muted }]}>{index + 1}</Text>
            <Text style={[styles.stepLabel, { color: colors.textSecondary }]} numberOfLines={2}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={copy.lobby.createRoom}
        disabled={joining}
        onPress={onCreate}
        style={[styles.create, { backgroundColor: colors.accent, opacity: joining ? 0.6 : 1 }]}
      >
        {joining ? (
          <ActivityIndicator size="small" color={colors.onAccent} />
        ) : (
          <AppIcon family="Ionicons" name="add-circle" size={22} color={colors.onAccent} />
        )}
        <Text style={[styles.createText, { color: colors.onAccent }]}>{copy.lobby.createRoom}</Text>
      </PressableScale>

      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.muted }]}>{copy.lobby.or}</Text>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>

      <View style={styles.joinRow}>
        <GlassTextInput
          ref={inputRef}
          style={[
            styles.input,
            // Geniş harf aralığı yalnız rakamlar için; yer tutucu metin dağılmasın.
            inputCode ? null : styles.inputEmpty,
            {
              color: colors.text,
              borderColor: focused ? colors.accent : colors.border,
              backgroundColor: alpha(colors.surface, 0.45),
            },
          ]}
          editable={!joining}
          accessibilityLabel={joinText.placeholder}
          placeholder={joinText.placeholder}
          placeholderTextColor={colors.muted}
          value={inputCode}
          onChangeText={(value) => onChangeCode(sanitizeRoomCode(value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={() => ready && onJoin()}
          keyboardType="number-pad"
          maxLength={7}
          returnKeyType="go"
        />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={copy.lobby.paste}
          disabled={joining}
          onPress={onPaste}
          style={[styles.paste, { backgroundColor: alpha(colors.surface, 0.7), borderColor: colors.border }]}
        >
          <AppIcon family="Ionicons" name="clipboard-outline" size={20} color={colors.textSecondary} />
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ busy: joining, disabled: !ready }}
          disabled={!ready}
          onPress={onJoin}
          style={[
            styles.join,
            { backgroundColor: ready ? colors.accent : alpha(colors.surface, 0.8), opacity: joining || ready ? 1 : 0.7 },
          ]}
        >
          {joining ? <ActivityIndicator size="small" color={colors.onAccent} /> : null}
          <Text style={[styles.joinText, { color: ready || joining ? colors.onAccent : colors.textSecondary }]}>
            {joining ? joinText.joining : joinText.join}
          </Text>
        </PressableScale>
      </View>

      {joinError ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.error, { backgroundColor: alpha(colors.pass, 0.1), borderColor: alpha(colors.pass, 0.35) }]}
        >
          <View style={styles.errorHeader}>
            <AppIcon family="Ionicons" name="alert-circle" size={20} color={colors.pass} />
            <Text style={[styles.errorTitle, { color: colors.text }]}>{joinText.title}</Text>
          </View>
          <Text style={[styles.errorBody, { color: colors.textSecondary }]}>
            {joinText[joinError] || joinText.unknown}
          </Text>
          <View style={styles.errorActions}>
            <PressableScale
              accessibilityRole="button"
              onPress={onRetryJoin}
              style={[styles.errorButton, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.errorButtonText, { color: colors.onAccent }]}>{joinText.retry}</Text>
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              onPress={onHub}
              style={[styles.errorButton, { backgroundColor: alpha(colors.surface, 0.8), borderColor: colors.border, borderWidth: 1 }]}
            >
              <Text style={[styles.errorButtonText, { color: colors.text }]}>{joinText.hub}</Text>
            </PressableScale>
          </View>
        </View>
      ) : null}

      {hasLastResult ? (
        <PressableScale
          accessibilityRole="button"
          onPress={onOpenLastResult}
          style={[styles.last, { backgroundColor: alpha(colors.gold, 0.12), borderColor: alpha(colors.gold, 0.34) }]}
        >
          <AppIcon family="Ionicons" name="trophy-outline" size={18} color={colors.gold} />
          <Text style={[styles.lastText, { color: colors.text }]}>{resultText.lastResult}</Text>
          <AppIcon family="Ionicons" name="chevron-forward" size={16} color={colors.muted} />
        </PressableScale>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    alignSelf: "stretch",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 4,
  },
  hero: {
    paddingTop: 10,
    paddingBottom: 14,
  },
  steps: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  step: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
  },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndex: {
    fontSize: 10,
    fontWeight: "900",
  },
  stepLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 15,
  },
  create: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    height: 54,
    borderRadius: 18,
  },
  createText: {
    fontSize: 15.5,
    fontWeight: "900",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 16,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  joinRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    height: 54,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 12,
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
  },
  inputEmpty: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
  },
  paste: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  join: {
    minWidth: 92,
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  joinText: {
    fontSize: 14.5,
    fontWeight: "900",
  },
  error: {
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  errorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  errorBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  errorActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  errorButton: {
    flex: 1,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  errorButtonText: {
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  last: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
  },
  lastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
});
