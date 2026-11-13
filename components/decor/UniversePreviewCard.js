// components/decor/UniversePreviewCard.js
//
// Film/dizi detayında zevk uyumu düğmesinin yanındaki telefon önizlemesi (gizli evrenler,
// utils/universeUnlocks.js). Yapım bir atmosfer evrenine aitse:
//   • Evren kilitli + yapım İZLENMEMİŞ: kart hiç çizilmez (evrenin varlığı sızmaz).
//   • Evren kilitli + yapım izlendi: sahnesiz gizli kart ("?"); dokununca evrenin kapı sorusu
//     (UniverseRiddleSheet). Doğru cevap evreni açar.
//   • Evren açık: sahne oynar; dokunuş seçimi o evrene çevirir, atmosfer kapalıysa açar
//     (Free'de seçim kaydedilir, yükseltme sayfası gelir). Zaten seçiliyse durum işareti.
// Önizleme: WeatherLayer `preview` + effectOverride — ekran yerleşip boşa çıkınca kurulur,
// odak/uygulama arka plandayken durur, "Hareketi Azalt" açıksa çizilmez.

import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import GlassTouchable from "../common/GlassTouchable";
import { showToast } from "../AppToast";
import WeatherLayer from "./WeatherLayer";
import { effectLabel } from "../settings/AtmosphereControls";
import { useSnowSettings } from "../../context/AppSettingsContext";
import useWeatherSettings from "../../hooks/useWeatherSettings";
import useUniverseUnlocks from "../../hooks/useUniverseUnlocks";
import { useListStatusContext } from "../../context/ListStatusContext";
import UniverseRiddleSheet from "./UniverseRiddleSheet";
import { usePremiumGate } from "../../hooks/usePremiumGate";
import useReduceMotion from "../../hooks/useReduceMotion";
import useScreenFocused from "../../hooks/useScreenFocused";
import useAppActive from "../../hooks/useAppActive";
import * as Haptics from "../../services/hapticsService";
import { runAfterInteractions } from "../../utils/afterInteractions";
import { i18nText } from "../../utils/i18nText";
import { universeFor } from "../../utils/weatherUniverses";
import { isTitleWatched } from "../../utils/universeUnlocks";

const PHONE_W = 46;
const PHONE_H = 66;
const SCREEN_W = 36;
const SCREEN_H = 56;

export default function UniversePreviewCard({ titleType, titleId, collectionId, theme }) {
  const universe = useMemo(
    () => (titleId != null ? universeFor({ type: titleType, id: titleId, collectionId }) : null),
    [titleType, titleId, collectionId],
  );
  // isSolved: evren günü (geçici açık) kartı açmaz; kalıcı açılış yine kapı sorusuyla.
  const { isSolved } = useUniverseUnlocks();
  const ctx = useListStatusContext() || {};
  const watched = isTitleWatched(ctx, titleType, titleId);
  if (!universe) return null;
  if (isSolved(universe)) return <Card universe={universe} theme={theme} />;
  if (!watched) return null;
  return <SecretCard universe={universe} theme={theme} />;
}

function SecretCard({ universe, theme }) {
  const [open, setOpen] = useState(false);
  const label = i18nText("autoI18n.evren_gizli_baslik", "Gizli bir evren buldun");
  return (
    <>
      <GlassTouchable
        glass={false}
        accessibilityRole="button"
        accessibilityLabel={label}
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Light);
          setOpen(true);
        }}
        style={[styles.phone, { backgroundColor: theme.secondary, borderColor: theme.accent + "88" }]}
      >
        <View style={[styles.screen, styles.secret, { backgroundColor: "#0b0b12" }]} pointerEvents="none">
          <Text allowFontScaling={false} style={[styles.secretMark, { color: theme.accent }]}>?</Text>
        </View>
        <View style={[styles.notch, { backgroundColor: theme.secondary }]} pointerEvents="none" />
        <View style={[styles.status, { backgroundColor: theme.accent }]} pointerEvents="none">
          <AppIcon family="MaterialCommunityIcons" name="key-variant" size={11} color="#ffffff" />
        </View>
      </GlassTouchable>
      <UniverseRiddleSheet
        visible={open}
        universe={universe}
        theme={theme}
        onClose={() => setOpen(false)}
        onSolved={(id) => {
          setOpen(false);
          showToast({
            kind: "success",
            title: i18nText("autoI18n.evren_kesfedildi", "Yeni evren keşfettin: {{name}}").replace("{{name}}", effectLabel(id)),
            message: i18nText("autoI18n.evren_kesfedildi_alt", "Artık Atmosfer'de seni bekliyor."),
          });
        }}
      />
    </>
  );
}

function Card({ universe, theme }) {
  const { choice, changeChoice } = useWeatherSettings();
  const { showSnow, snowAllowed, changeShowSnow } = useSnowSettings();
  const gate = usePremiumGate("snow_effect");
  const reduceMotion = useReduceMotion();
  const focused = useScreenFocused();
  const appActive = useAppActive();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const task = runAfterInteractions(() => setReady(true));
    return () => task.cancel?.();
  }, []);

  const name = effectLabel(universe);
  const active = choice === universe && showSnow;

  const add = () => {
    if (active) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Light);
    changeChoice(universe);
    if (!snowAllowed) {
      gate.showUpsell();
      return;
    }
    if (!showSnow) changeShowSnow(true);
    showToast({
      kind: "success",
      title: i18nText("autoI18n.evren_eklendi", "{{name}} atmosferine eklendi").replace("{{name}}", name),
    });
  };

  const btnLabel = active
    ? i18nText("autoI18n.evren_atmosferde", "Atmosferinde")
    : i18nText("autoI18n.evren_atmosfere_ekle", "Atmosfere ekle");
  return (
    <GlassTouchable
      glass={false}
      accessibilityRole="button"
      accessibilityLabel={`${btnLabel}: ${name}`}
      activeOpacity={0.8}
      onPress={add}
      style={[styles.phone, { backgroundColor: theme.secondary, borderColor: active ? theme.accent : theme.border }]}
    >
      <View style={[styles.screen, { backgroundColor: theme.primary }]} pointerEvents="none">
        {ready && !reduceMotion ? (
          <WeatherLayer
            preview
            width={SCREEN_W}
            height={SCREEN_H}
            playing={focused && appActive}
            speedScale={0.8}
            effectOverride={universe}
          />
        ) : null}
      </View>
      <View style={[styles.notch, { backgroundColor: theme.secondary }]} pointerEvents="none" />
      <View style={[styles.status, { backgroundColor: active ? theme.accent : "rgba(0,0,0,0.68)" }]} pointerEvents="none">
        <AppIcon name={active ? "checkmark" : "add"} size={11} color="#ffffff" />
      </View>
    </GlassTouchable>
  );
}

const styles = StyleSheet.create({
  phone: {
    width: PHONE_W,
    height: PHONE_H,
    borderRadius: 13,
    borderWidth: 1.5,
    padding: 3,
    overflow: "hidden",
    alignItems: "center",
  },
  screen: { width: SCREEN_W, height: SCREEN_H, borderRadius: 9, overflow: "hidden" },
  notch: { position: "absolute", top: 4, width: 15, height: 3, borderRadius: 2 },
  status: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  secret: { alignItems: "center", justifyContent: "center" },
  secretMark: { fontSize: 26, fontWeight: "900" },
});
