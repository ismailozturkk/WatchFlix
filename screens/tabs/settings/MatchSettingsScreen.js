// screens/tabs/settings/MatchSettingsScreen.js
//
// Ayarlar > Zevk Çemberleri (Faz 4): kulvar seçimi + kulvar başına eşleşme gücü, onay metni,
// katıl / kulvarları kaydet / ayrıl. Ayarlar satırı yalnız `useMatchFeature().available` iken
// (bayrak açık + 18+ kanıtlı) çizilir; bu ekran yine de kapıyı kendisi de denetler.
// Güç hesabı yüklü verilerden (yeni okuma yok): utils/matchStrength.js. Metin: utils/matchCopy.js.

import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AppIcon from "@components/AppIcon";
import { appAlert } from "@components/AppAlert";
import { toast } from "@components/AppToast";
import * as Haptics from "@services/hapticsService";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import GlassBox from "../../../components/common/GlassBox";
import GlassTouchable from "../../../components/common/GlassTouchable";
import LensLoader from "../../../components/LensLoader";
import useMatchFeature from "../../../hooks/useMatchFeature";
import useMatchStrength from "../../../hooks/useMatchStrength";
import { intlLocaleOf } from "../../../utils/appLanguages";
import { challengeLinkLabel, getMatchCopy, stepChallengeId, stepText } from "../../../utils/matchCopy";
import { getMatchScreenCopy } from "../../../utils/matchScreenCopy";
import { MATCH_LANES } from "../../../utils/matchFeature";
import { PickRow, SectionHead } from "./BackupKit";
import { SettingsSubScreen, buildUiColors, ui } from "./settingsUi";

const LANE_ICON = { movie: "film-outline", tv: "tv-outline" };

export default function MatchSettingsScreen() {
  const { theme } = useTheme();
  const C = useMemo(() => buildUiColors(theme), [theme]);
  const { language } = useLanguage();
  const copy = getMatchCopy(language);
  const locale = intlLocaleOf(language);
  const match = useMatchFeature();
  const [selected, setSelected] = useState(MATCH_LANES);
  const [busy, setBusy] = useState(false);

  // Katılmış kullanıcıda seçim kayıtlı kulvarlardan başlar.
  const savedKey = match.lanes.join(",");
  useEffect(() => {
    if (match.optedIn) setSelected(savedKey.split(",").filter(Boolean));
  }, [match.optedIn, savedKey]);

  const strength = useMatchStrength({ enabled: match.available });
  const navigation = useNavigation();
  // Puan adımı varsa ona uyan Meydan Okuma (seçili kulvarlardan ilki).
  const challengeId = strength
    ? selected.map((lane) => stepChallengeId(lane, strength[lane]?.next)).find(Boolean) || null
    : null;

  const tick = () => {
    try {
      Haptics.selectionAsync().catch(() => {});
    } catch {
      /* titreşim yoksa sessizce geç */
    }
  };
  const toggle = (lane) => {
    tick();
    setSelected((list) => (list.includes(lane) ? list.filter((l) => l !== lane) : [...list, lane]));
  };

  const submit = async () => {
    if (busy) return;
    if (!selected.length) {
      toast.info(copy.pickLane);
      return;
    }
    setBusy(true);
    try {
      const wasIn = match.optedIn;
      await match.join(selected);
      toast.success(wasIn ? copy.saved : copy.joined);
    } catch {
      toast.error(copy.error);
    } finally {
      setBusy(false);
    }
  };

  const confirmLeave = () =>
    appAlert(copy.leaveConfirmTitle, copy.leaveConfirmBody, [
      { text: copy.cancel, style: "cancel" },
      {
        text: copy.leave,
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await match.leave();
            setSelected(MATCH_LANES);
            toast.success(copy.left);
          } catch {
            toast.error(copy.error);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  if (!match.available || !strength) return <SettingsSubScreen title={copy.title} />;

  const showConsent = !match.optedIn || match.needsConsent;
  const changed = match.optedIn && [...selected].sort().join(",") !== [...match.lanes].sort().join(",");

  return (
    <SettingsSubScreen title={copy.title}>
      {/* ── Tanıtım ── */}
      <GlassBox role="card" style={[s.hero, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[s.heroIcon, { backgroundColor: C.accentDim }]}>
          <AppIcon family="Ionicons" name="people-circle-outline" size={26} color={C.accent} />
        </View>
        <View style={s.heroBody}>
          <Text allowFontScaling={false} style={[s.heroTitle, { color: C.text }]}>
            {copy.heroTitle}
          </Text>
          <Text style={[s.heroText, { color: C.muted }]}>{copy.heroText}</Text>
        </View>
      </GlassBox>

      {/* ── Kulvarlar + güç ── */}
      <SectionHead colors={C} label={copy.sectionLanes.toLocaleUpperCase(locale)} info={[copy.lanesHint]} infoLabel={copy.sectionLanes} />
      <GlassBox role="card" style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {MATCH_LANES.map((lane, index) => {
          const info = strength[lane];
          const status = info.eligible ? (info.path === "watch" ? copy.watchPath : copy.inPool) : copy.notInPool;
          return (
            <PickRow
              key={lane}
              colors={C}
              icon={LANE_ICON[lane]}
              iconBg={C.accentDim}
              iconColor={C.accent}
              title={copy.lanes[lane]}
              sub={status}
              stat={copy.strength(info.strength)}
              ratio={info.strength / 100}
              note={stepText(copy, info.next)}
              selected={selected.includes(lane)}
              onToggle={() => toggle(lane)}
              last={index === MATCH_LANES.length - 1}
            />
          );
        })}
      </GlassBox>
      {match.optedIn ? (
        <GlassTouchable
          activeOpacity={0.75}
          onPress={() => navigation.navigate("MatchScreen")}
          accessibilityRole="button"
          accessibilityLabel={getMatchScreenCopy(language).openSuggestions}
          style={[s.challenge, { backgroundColor: C.accentDim, borderColor: C.accent }]}
        >
          <AppIcon family="Ionicons" name="people-circle-outline" size={18} color={C.accentStrong} />
          <Text allowFontScaling={false} style={[s.challengeText, { color: C.accentStrong }]} numberOfLines={1}>
            {getMatchScreenCopy(language).openSuggestions}
          </Text>
          <AppIcon family="Ionicons" name="chevron-forward" size={16} color={C.accentStrong} />
        </GlassTouchable>
      ) : null}
      {challengeId ? (
        <GlassTouchable
          activeOpacity={0.75}
          onPress={() => navigation.navigate("ChallengesScreen", { openId: challengeId })}
          accessibilityRole="button"
          accessibilityLabel={challengeLinkLabel(language)}
          style={[s.challenge, { backgroundColor: C.card, borderColor: C.border }]}
        >
          <AppIcon family="Ionicons" name="star-outline" size={18} color={C.accent} />
          <Text allowFontScaling={false} style={[s.challengeText, { color: C.text }]} numberOfLines={1}>
            {challengeLinkLabel(language)}
          </Text>
          <AppIcon family="Ionicons" name="chevron-forward" size={16} color={C.muted} />
        </GlassTouchable>
      ) : null}
      <Text style={[s.hint, { color: C.muted }]}>{copy.hub.hint}</Text>

      {/* ── Onay metni (ilk katılım ya da metin sürümü değişince) ── */}
      {showConsent ? (
        <>
          <SectionHead colors={C} label={copy.sectionConsent.toLocaleUpperCase(locale)} />
          <GlassBox role="card" style={[s.consent, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.consentTitle, { color: C.text }]}>{copy.consent.title}</Text>
            {match.needsConsent ? <Text style={[s.consentPoint, { color: C.accentStrong }]}>{copy.consent.reconsent}</Text> : null}
            {copy.consent.points.map((point) => (
              <View key={point} style={s.pointRow}>
                <View style={[s.dot, { backgroundColor: C.accent }]} />
                <Text style={[s.consentPoint, { color: C.muted }]}>{point}</Text>
              </View>
            ))}
          </GlassBox>
        </>
      ) : (
        <Text style={[s.hint, { color: C.muted }]}>{copy.poolSoon}</Text>
      )}

      {/* ── Eylemler ── */}
      {showConsent || changed ? (
        <GlassTouchable
          activeOpacity={0.8}
          onPress={submit}
          accessibilityRole="button"
          accessibilityLabel={showConsent ? copy.join : copy.save}
          style={[s.primary, { backgroundColor: C.accent, opacity: busy || !selected.length ? 0.6 : 1 }]}
        >
          {busy ? <LensLoader size="small" color="#FFFFFF" /> : null}
          <Text allowFontScaling={false} style={s.primaryText}>
            {showConsent ? copy.join : copy.save}
          </Text>
        </GlassTouchable>
      ) : null}
      {match.optedIn ? (
        <GlassTouchable
          activeOpacity={0.7}
          onPress={confirmLeave}
          accessibilityRole="button"
          accessibilityLabel={copy.leave}
          style={[s.secondary, { borderColor: C.border }]}
        >
          <Text allowFontScaling={false} style={[s.secondaryText, { color: C.danger }]}>
            {copy.leave}
          </Text>
        </GlassTouchable>
      ) : null}
    </SettingsSubScreen>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "flex-start", gap: 14, borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 6 },
  heroIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  heroBody: { flex: 1, gap: 4 },
  heroTitle: { fontSize: 16, fontWeight: "800" },
  heroText: { fontSize: 12.5, fontWeight: "600", lineHeight: 18 },
  hint: { fontSize: 12, fontWeight: "600", lineHeight: 17, marginTop: 8, marginHorizontal: 4 },
  consent: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 9 },
  consentTitle: { fontSize: 14.5, fontWeight: "800" },
  pointRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  consentPoint: { flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 13, marginTop: 14 },
  primaryText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "800" },
  secondary: { alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, paddingVertical: 12, marginTop: 10 },
  secondaryText: { fontSize: 13.5, fontWeight: "700" },
  challenge: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10 },
  challengeText: { flex: 1, fontSize: 13.5, fontWeight: "700" },
});
