// components/profile/YearlyGoalSheet.js
//
// Yıllık izleme hedefi sayfası (BottomSheetModal). Profil başlığındaki halka düğmesi bunu açar;
// hedefin TÜM ayrıntısı burada (düğmede yalnız yüzde var).
//
// YAPI (yukarıdan aşağıya, ortası kayar, eylemler altta SABİT)
//   başlık → ÖZET (genel halka + tempo + yılın saati + hat rozetleri)
//          → FİLM kartı → DİZİ kartı (her biri ayrı açılıp kapanır; dizi: dizi sayısı | bölüm sayısı)
//          → AYLIK PLAN grafiği
//   altta: Kaydet / Hedefi kaldır.
//
// TASLAK: sayfa kaydedilmiş hedefi değil bir TASLAĞI düzenler (utils/yearlyGoal.js "Taslak"). Her
// değişiklik özeti, hat kartlarının çubuk/tempo/plan hücrelerini ve aylık çizgiyi anında yeni
// hedefe göre yeniden hesaplatır; "Önizleme" etiketi kaydedilmemiş olduğunu söyler. Kaydet yalnız
// bir şey değiştiyse ve en az bir hat açıkken etkindir. Kapatmak taslağı atar.
//
// STATE yalnız sayfa AÇILIRKEN hedeften/öneriden kurulur (kapanış animasyonu sürerken sıfırlanmaz:
// BottomSheetModal kapanırken ≈260 ms daha çizer). `goal`/`suggestion` bağımlılık DEĞİL: sayfa
// açıkken sayım değişse bile kullanıcının girdiği değer ezilmesin.

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import SheetScroll from "@components/common/SheetScroll";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { triggerHaptic } from "@services/hapticsService";
import { alpha } from "../../theme/colors";
import {
  buildTrackProgress,
  combineProgress,
  computeYearClock,
  draftFromGoal,
  draftSetMeasure,
  draftSetTarget,
  draftStep,
  draftToggle,
  draftTrack,
  goalFromDraft,
  sameGoal,
} from "../../utils/yearlyGoal";
import YearlyGoalMonthChart from "./YearlyGoalMonthChart";
import YearlyGoalRing from "./YearlyGoalRing";
import YearlyGoalTrackCard from "./YearlyGoalTrackCard";
import { paceVisualOf, TRACK_VISUAL } from "./yearlyGoalTheme";
import { describeYearClock, fillCopy, formatPercent, getYearlyGoalCopy } from "./yearlyGoalCopy";

const GOLD = "#FBBF24";

function YearlyGoalSheet({ visible, onClose, year, now, goal, counts, suggestion, onSave, onRemove }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getYearlyGoalCopy(language);

  const [draft, setDraft] = useState(() => draftFromGoal(goal, suggestion));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(draftFromGoal(goal, suggestion));
    setFailed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onToggle = useCallback((track, on) => {
    triggerHaptic("selection");
    setDraft((current) => draftToggle(current, track, on));
  }, []);
  // Tek dokunuş ve basılı tutma adımları (haptik YOK: titreşim politikasında seçim sessiz).
  const onStep = useCallback((track, delta) => {
    setDraft((current) => draftStep(current, track, delta));
  }, []);
  const onTarget = useCallback((track, value) => {
    triggerHaptic("selection");
    setDraft((current) => draftSetTarget(current, track, value));
  }, []);
  const onMeasure = useCallback((measure) => {
    triggerHaptic("selection");
    setDraft((current) => draftSetMeasure(current, measure));
  }, []);

  const draftGoal = useMemo(() => goalFromDraft(draft), [draft]);
  const tracks = useMemo(
    () => buildTrackProgress({ goal: draftGoal, counts, year, now }),
    [draftGoal, counts, year, now],
  );
  const overall = useMemo(() => combineProgress(tracks), [tracks]);
  const clock = useMemo(() => computeYearClock({ year, now }), [year, now]);
  // Kaydedilmiş hedeften farklı mı? (İkisi de boşsa fark yok.)
  const dirty = !sameGoal(draftGoal, goal);
  const canSave = !!draftGoal && dirty;

  const progressOf = (track) => tracks.find((t) => t.track === track)?.progress || null;
  const series = useMemo(
    () =>
      tracks.map((t) => ({
        track: t.track,
        kind: t.kind,
        target: t.target,
        color: TRACK_VISUAL[t.track].color,
        name: copy.tracks[t.track].name,
      })),
    [tracks, copy],
  );

  const save = useCallback(() => {
    if (!draftGoal) return;
    const ok = onSave(draftGoal);
    if (ok) {
      triggerHaptic("success");
      onClose();
    } else {
      setFailed(true);
    }
  }, [draftGoal, onSave, onClose]);

  const remove = useCallback(() => {
    const ok = onRemove();
    if (ok) onClose();
    else setFailed(true);
  }, [onRemove, onClose]);

  const heroPace = overall ? paceVisualOf(overall.pace) : null;
  const ringColor = overall?.done ? GOLD : theme.accent;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {fillCopy(copy.sheet.title, { year })}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>{copy.sheet.subtitle}</Text>
        </View>
        <GlassCloseButton
          size={30}
          fallbackRadius={15}
          color={theme.text.primary}
          backgroundColor={theme.between}
          accessibilityLabel={copy.sheet.close}
          onPress={onClose}
        />
      </View>

      <SheetScroll contentContainerStyle={styles.content}>
        {/* ── Özet ── */}
        {overall ? (
          <View
            testID="yearly-goal-hero"
            style={[styles.hero, { backgroundColor: theme.between, borderColor: theme.border }]}
          >
            <YearlyGoalRing
              size={84}
              stroke={9}
              ratio={overall.ratio}
              color={ringColor}
              trackColor={alpha(theme.text.muted, 0.28)}
            >
              <Text
                testID="yearly-goal-hero-percent"
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[styles.heroPercent, { color: theme.text.primary }]}
              >
                {formatPercent(overall.percent, language)}
              </Text>
            </YearlyGoalRing>
            <View style={styles.heroCopy}>
              <View style={styles.heroTitleRow}>
                <Ionicons name={heroPace.icon} size={18} color={heroPace.color} />
                <Text
                  testID="yearly-goal-hero-title"
                  style={[styles.heroTitle, { color: theme.text.primary }]}
                  numberOfLines={2}
                >
                  {copy.overall[overall.pace === "missed" || overall.pace === "upcoming" ? "onTrack" : overall.pace]}
                </Text>
              </View>
              <Text
                testID="yearly-goal-hero-clock"
                style={[styles.heroClock, { color: theme.text.muted }]}
                numberOfLines={2}
              >
                {describeYearClock(clock, copy, language)}
              </Text>
              <View style={styles.pills}>
                {tracks.map((t) => (
                  <View
                    key={t.track}
                    testID={`yearly-goal-pill-${t.track}`}
                    style={[styles.pill, { backgroundColor: alpha(TRACK_VISUAL[t.track].color, 0.16) }]}
                  >
                    <View style={[styles.pillDot, { backgroundColor: TRACK_VISUAL[t.track].color }]} />
                    <Text style={[styles.pillText, { color: theme.text.primary }]} numberOfLines={1}>
                      {fillCopy(copy.summaryPart, {
                        name: copy.tracks[t.track].name,
                        count: t.count,
                        target: t.target,
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            {dirty ? (
              <View
                testID="yearly-goal-preview"
                style={[styles.previewTag, { backgroundColor: alpha(theme.accent, 0.18) }]}
              >
                <Text style={[styles.previewText, { color: theme.accent }]}>{copy.sheet.previewTag}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.emptyHero, { backgroundColor: theme.between, borderColor: theme.border }]}>
            <Ionicons name="flag-outline" size={22} color={theme.text.muted} />
            <Text testID="yearly-goal-no-summary" style={[styles.emptyHeroText, { color: theme.text.muted }]}>
              {copy.sheet.noSummary}
            </Text>
          </View>
        )}

        {/* ── Hatlar ── */}
        {["movies", "shows"].map((track) => {
          const slice = draftTrack(draft, track);
          return (
            <YearlyGoalTrackCard
              key={track}
              track={track}
              theme={theme}
              language={language}
              copy={copy}
              draft={slice}
              count={counts?.[slice.kind] || 0}
              progress={slice.on ? progressOf(track) : null}
              color={TRACK_VISUAL[track].color}
              icon={TRACK_VISUAL[track].icon}
              onToggle={onToggle}
              onStep={onStep}
              onMeasure={onMeasure}
              onTarget={onTarget}
            />
          );
        })}

        {/* ── Aylık plan ── */}
        <YearlyGoalMonthChart theme={theme} language={language} copy={copy} year={year} now={now} series={series} />
      </SheetScroll>

      {/* ── Eylemler (sabit) ── */}
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        {!draftGoal ? (
          <Text testID="yearly-goal-need-track" style={[styles.footerNote, { color: theme.text.muted }]}>
            {copy.sheet.needTrack}
          </Text>
        ) : null}
        {failed ? (
          <Text testID="yearly-goal-error" style={styles.error}>
            {copy.sheet.saveFailed}
          </Text>
        ) : null}
        <Pressable
          testID="yearly-goal-save"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          onPress={save}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: theme.accent, opacity: !canSave ? 0.4 : pressed ? 0.85 : 1 },
          ]}
        >
          {/* Vurgu rengi üstündeki yazı BEYAZ (tema stüdyosu kuralı). */}
          <Text style={styles.saveText}>{copy.sheet.save}</Text>
        </Pressable>
        {goal ? (
          <Pressable
            testID="yearly-goal-remove"
            accessibilityRole="button"
            onPress={remove}
            style={styles.removeButton}
            hitSlop={6}
          >
            <Text style={[styles.removeText, { color: theme.text.muted }]}>{copy.sheet.remove}</Text>
          </Pressable>
        ) : null}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  // Yüzde yükseklik: sayfa kaplayıcının DOĞRUDAN çocuğu (BottomSheetModal notu); ortadaki
  // SheetScroll küçülür, başlık ve alt eylemler ekranda kalır.
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 10,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12, opacity: 0.5 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: "900" },
  subtitle: { fontSize: 12, lineHeight: 16, fontWeight: "600", marginTop: 2 },

  // paddingTop: "Önizleme" etiketi özet kartının üst kenarına taşar; ScrollView taşanı kırpar.
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, gap: 12 },

  hero: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 18, borderWidth: 1 },
  heroPercent: { fontSize: 19, lineHeight: 23, fontWeight: "900", fontVariant: ["tabular-nums"], maxWidth: 58 },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroTitle: { flexShrink: 1, fontSize: 15.5, fontWeight: "900" },
  heroClock: { fontSize: 11.5, lineHeight: 15, fontWeight: "600" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillDot: { width: 7, height: 7, borderRadius: 3.5 },
  pillText: { fontSize: 11.5, fontWeight: "800", fontVariant: ["tabular-nums"] },
  // Kartın üst kenarında, halkanın üstünde (SOL): sağdaki metin sütununun başlığına binmez
  // (320 pt'te sütun ~162 px; sağ üst köşedeki etiket başlığı örterdi).
  previewTag: { position: "absolute", top: -9, left: 18, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  previewText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },

  emptyHero: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderRadius: 18, borderWidth: 1 },
  emptyHeroText: { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: "600" },

  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 26, borderTopWidth: StyleSheet.hairlineWidth },
  footerNote: { fontSize: 12, lineHeight: 16, fontWeight: "600", textAlign: "center", marginBottom: 8 },
  error: { color: "#EF4444", fontSize: 12, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  saveButton: { height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  removeButton: { alignSelf: "center", paddingVertical: 10, paddingHorizontal: 16, marginTop: 2 },
  removeText: { fontSize: 13, fontWeight: "700" },
});

export default memo(YearlyGoalSheet);
