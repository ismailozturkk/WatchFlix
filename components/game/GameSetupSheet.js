// components/game/GameSetupSheet.js
//
// Sahne Tahmin / Poster Bulmaca'nın kurulumu, ALT SAYFA olarak. Eskiden oyuna
// girmek üç ekran sürüyordu (oyun vitrini → kurulum ekranı → oyun); şimdi
// karta dokununca bu sayfa açılır, son seçimler hazır gelir, tek dokunuşla oyun
// başlar. Sonuç ekranındaki "Mod Seçimi" de aynı sayfayı açar.
//
// Seçimler: mod (3) → zorluk (3) → içerik kaynağı (yatay çipler; kişisel
// listelerde 4'ten az yapım varsa çip pasif). Seçilen modun kuralı tek satır
// altında okunur; ayrı "Nasıl oynanır?" sayfası yok.
//
// BAŞLAT SIRASI (iOS iki Modal kuralı): sayfa önce kapanır, günlük hak denetimi
// ve `onStart` `onDismissed`te çalışır. Hak bittiyse açılan yükseltme sayfası
// böylece kapanmakta olan bu sayfanın üstüne sunulmaz.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import SheetScroll from "@components/common/SheetScroll";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { useTheme } from "@context/ThemeContext";
import { usePremiumDailyGate } from "@hooks/usePremiumGate";
import { buildWatchlistPool } from "@services/sceneGameService";
import { loadSceneGamePreferences, saveSceneGamePreferences } from "@services/sceneGamePreferences";
import { i18nText } from "@utils/i18nText";
import { pickByLanguage } from "@utils/appLanguages";
import {
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_MODE_ID,
  getLocalizedGameLabel,
  SCENE_GAME_DIFFICULTIES,
  SCENE_GAME_ID,
  SCENE_GAME_SOURCES,
  SELECTABLE_GAME_MODES,
} from "@screens/game/gameConfig";
import { getModeMetaLine } from "@screens/game/gameLabels";
import { getGameEntry, resolveGameAccentColors } from "@screens/game/gameRegistry";
import { alpha } from "../../theme/colors";
import { PressableScale } from "./ui";

// Kurulum listesinde yalnız keşif + kişisel kaynaklar (günlük havuz seçilmez).
const SETUP_SOURCES = SCENE_GAME_SOURCES.filter((s) => s.group === "discover" || s.group === "personal");
const MIN_PERSONAL_POOL = 4;

const isSelectableMode = (id) => SELECTABLE_GAME_MODES.some((mode) => mode.id === id);
const isKnownDifficulty = (id) => SCENE_GAME_DIFFICULTIES.some((diff) => diff.id === id);
const isSetupSource = (id) => SETUP_SOURCES.some((source) => source.id === id);

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {string} [props.gameId]        SCENE_GAME_ID | POSTER_GAME_ID
 * @param {{modeId?:string, difficultyId?:string, sourceId?:string}} [props.initial]
 *        Açıkça verilen seçim (ör. sonuç ekranındaki son oyun) kayıtlı tercihi ezer.
 * @param {object} [props.stats]          Kayıtlı tercih yoksa son oyunun ayarları buradan.
 * @param {number} [props.bestScore]
 * @param {() => void} props.onClose
 * @param {(params:{gameId:string, modeId:string, difficultyId:string, sourceId:string}) => void} props.onStart
 *        Sayfa kapandıktan ve günlük hak denetimi geçtikten SONRA çağrılır.
 */
export default function GameSetupSheet({ visible, gameId = SCENE_GAME_ID, initial, stats, bestScore = 0, onClose, onStart }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { combinedLists } = useListStatusContext();
  const insets = useSafeAreaInsets();
  const gamesGate = usePremiumDailyGate("games");

  const game = getGameEntry(gameId);
  const accent = resolveGameAccentColors(game, theme);

  const [modeId, setModeId] = useState(DEFAULT_MODE_ID);
  const [difficultyId, setDifficultyId] = useState(DEFAULT_DIFFICULTY_ID);
  const [sourceId, setSourceId] = useState("popular");
  const pendingStartRef = useRef(null);

  const counts = useMemo(
    () => Object.fromEntries(
      SETUP_SOURCES.filter((item) => item.personal).map((item) => [
        item.id,
        buildWatchlistPool(combinedLists?.[item.listKey] || []).length,
      ]),
    ),
    [combinedLists],
  );

  // Her açılışta: açık seçim > kayıtlı tercih > son oyun > varsayılan.
  // Kişisel kaynak artık 4 yapımın altına düştüyse Popüler'e döner.
  useEffect(() => {
    if (!visible) return undefined;
    pendingStartRef.current = null;
    let active = true;
    loadSceneGamePreferences(user?.uid).then((saved) => {
      if (!active) return;
      const fromStats = stats
        ? { modeId: stats.lastModeId, difficultyId: stats.lastDifficultyId, sourceId: stats.lastSourceId }
        : null;
      const pick = (key, valid, fallback) =>
        [initial?.[key], saved?.[key], fromStats?.[key]].find(valid) || fallback;
      const nextSource = pick("sourceId", isSetupSource, "popular");
      const personal = SETUP_SOURCES.find((s) => s.id === nextSource)?.personal;
      setModeId(pick("modeId", isSelectableMode, DEFAULT_MODE_ID));
      setDifficultyId(pick("difficultyId", isKnownDifficulty, DEFAULT_DIFFICULTY_ID));
      setSourceId(personal && (counts[nextSource] ?? 0) < MIN_PERSONAL_POOL ? "popular" : nextSource);
    });
    return () => {
      active = false;
    };
    // Yalnız açılışta: açıkken liste sayısı değişse de kullanıcının seçimi ezilmesin.
  }, [visible, gameId]);

  const selectedMode = SELECTABLE_GAME_MODES.find((m) => m.id === modeId) || SELECTABLE_GAME_MODES[0];

  const start = async () => {
    const params = { gameId, modeId, difficultyId, sourceId };
    await saveSceneGamePreferences(user?.uid, { modeId, difficultyId, sourceId });
    pendingStartRef.current = params;
    onClose();
  };

  const handleDismissed = () => {
    const params = pendingStartRef.current;
    pendingStartRef.current = null;
    if (!params) return;
    // Hak bittiyse uyarı burada açılır (sayfa artık kapalı).
    if (!gamesGate.check()) return;
    onStart(params);
  };

  const allowanceText = gamesGate.unlimited
    ? null
    : language === "tr" ? `Bugün ${gamesGate.remaining}/${gamesGate.limit} oyun hakkın kaldı` : language === "es" ? `${gamesGate.remaining}/${gamesGate.limit} partidas restantes hoy` : language === "pt" ? `${gamesGate.remaining}/${gamesGate.limit} partidas restantes hoje` : language === "de" ? `${gamesGate.remaining}/${gamesGate.limit} Spiele heute übrig` : `${gamesGate.remaining}/${gamesGate.limit} games left today`;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      onDismissed={handleDismissed}
      intensity={38}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border, maxHeight: "88%" }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      {/* Başlık: oyunun kimliği + rekor */}
      <View style={styles.header}>
        <LinearGradient colors={accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameIcon}>
          <AppIcon family={game.icon.family} name={game.icon.name} size={20} color="#FFFFFF" />
        </LinearGradient>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1} allowFontScaling={false}>
            {i18nText(game.titleKey, game.id)}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={2} allowFontScaling={false}>
            {i18nText(game.descriptionKey, "")}
          </Text>
        </View>
        <GlassCloseButton size={34} fallbackRadius={11} iconSize={18} color={theme.text.primary} onPress={onClose} />
      </View>
      {bestScore > 0 ? (
        <View style={[styles.record, { backgroundColor: alpha("#FFC83D", 0.14) }]}>
          <AppIcon family="Ionicons" name="trophy" size={12} color="#E8B931" />
          <Text style={[styles.recordText, { color: theme.text.primary }]} allowFontScaling={false}>
            {i18nText("autoI18n.en_iyi_skor", "En İyi Skor")} · {bestScore}
          </Text>
        </View>
      ) : null}

      <SheetScroll contentContainerStyle={styles.body}>
        {/* 1. Mod */}
        <Text style={[styles.label, { color: theme.text.muted }]} allowFontScaling={false}>
          {i18nText("autoI18n.oyun_modu", "Oyun Modu")}
        </Text>
        <View style={styles.segment}>
          {SELECTABLE_GAME_MODES.map((mode) => {
            const selected = mode.id === modeId;
            return (
              <PressableScale
                key={mode.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={getLocalizedGameLabel(mode, language)}
                onPress={() => setModeId(mode.id)}
                scaleTo={0.96}
                style={[
                  styles.option,
                  {
                    backgroundColor: selected ? alpha(accent[1], 0.14) : theme.primary,
                    borderColor: selected ? accent[1] : theme.border,
                  },
                ]}
              >
                <AppIcon family="Ionicons" name={mode.icon} size={18} color={selected ? accent[1] : theme.text.muted} />
                <Text
                  style={[styles.optionTitle, { color: selected ? accent[1] : theme.text.primary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  allowFontScaling={false}
                >
                  {getLocalizedGameLabel(mode, language)}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        <Text style={[styles.rule, { color: theme.text.secondary }]} numberOfLines={2} allowFontScaling={false}>
          {i18nText(selectedMode.ruleKey, "")}
        </Text>
        <Text style={[styles.meta, { color: accent[1] }]} numberOfLines={1} allowFontScaling={false}>
          {getModeMetaLine(selectedMode, language)}
        </Text>

        {/* 2. Zorluk */}
        <Text style={[styles.label, styles.labelSpaced, { color: theme.text.muted }]} allowFontScaling={false}>
          {i18nText("autoI18n.zorluk", "Zorluk")}
        </Text>
        <View style={styles.segment}>
          {SCENE_GAME_DIFFICULTIES.map((diff) => {
            const selected = diff.id === difficultyId;
            return (
              <PressableScale
                key={diff.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={getLocalizedGameLabel(diff, language)}
                onPress={() => setDifficultyId(diff.id)}
                scaleTo={0.96}
                style={[
                  styles.option,
                  {
                    backgroundColor: selected ? alpha(diff.color, 0.14) : theme.primary,
                    borderColor: selected ? diff.color : theme.border,
                  },
                ]}
              >
                <Text style={[styles.optionTitle, { color: selected ? diff.color : theme.text.primary }]} allowFontScaling={false}>
                  {getLocalizedGameLabel(diff, language)}
                </Text>
                <Text style={[styles.optionMeta, { color: theme.text.muted }]} numberOfLines={1} allowFontScaling={false}>
                  {diff.timeSeconds}{i18nText("autoI18n.saniye_kisa", "sn")} · {diff.optionCount} {i18nText("autoI18n.secenek", "şık")}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {/* 3. İçerik kaynağı */}
        <Text style={[styles.label, styles.labelSpaced, { color: theme.text.muted }]} allowFontScaling={false}>
          {pickByLanguage(language, { tr: "İçerik", en: "Content", es: "Contenido", pt: "Conteúdo", de: "Inhalte" })}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sources}
          style={styles.sourcesScroll}
        >
          {SETUP_SOURCES.map((item) => {
            const count = item.personal ? counts[item.id] ?? 0 : null;
            const disabled = Boolean(item.personal) && count < MIN_PERSONAL_POOL;
            const selected = item.id === sourceId;
            return (
              <PressableScale
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={getLocalizedGameLabel(item, language)}
                disabled={disabled}
                onPress={() => setSourceId(item.id)}
                scaleTo={0.96}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? accent[1] : theme.primary,
                    borderColor: selected ? accent[1] : theme.border,
                    opacity: disabled ? 0.45 : 1,
                  },
                ]}
              >
                <AppIcon family="Ionicons" name={item.icon} size={14} color={selected ? "#FFFFFF" : theme.text.secondary} />
                <Text style={[styles.chipText, { color: selected ? "#FFFFFF" : theme.text.primary }]} numberOfLines={1} allowFontScaling={false}>
                  {getLocalizedGameLabel(item, language)}
                </Text>
                {item.personal ? (
                  <Text style={[styles.chipCount, { color: selected ? "rgba(255,255,255,0.85)" : disabled ? "#FF6B6B" : theme.text.muted }]} allowFontScaling={false}>
                    {disabled ? `${count}/${MIN_PERSONAL_POOL}` : count}
                  </Text>
                ) : null}
              </PressableScale>
            );
          })}
        </ScrollView>
      </SheetScroll>

      {/* Başlat: hep görünür */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.oyunu_baslat", "Oyunu Başlat")}
          onPress={start}
          style={styles.startWrap}
        >
          <LinearGradient colors={accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.startButton}>
            <AppIcon family="Ionicons" name="play" size={17} color="#FFFFFF" />
            <Text style={styles.startText} allowFontScaling={false}>
              {i18nText("autoI18n.oyunu_baslat", "Oyunu Başlat")}
            </Text>
          </LinearGradient>
        </PressableScale>
        {allowanceText ? (
          <Text style={[styles.allowance, { color: theme.text.muted }]} allowFontScaling={false}>
            {allowanceText}
          </Text>
        ) : null}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 11,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18 },
  gameIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  title: { fontSize: 19, fontWeight: "900" },
  subtitle: { fontSize: 11.5, lineHeight: 15, fontWeight: "600", marginTop: 2 },
  record: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    marginLeft: 18,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
  },
  recordText: { fontSize: 11, fontWeight: "800" },

  body: { paddingHorizontal: 18, paddingTop: 16 },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 },
  labelSpaced: { marginTop: 18 },
  segment: { flexDirection: "row", gap: 8 },
  option: {
    flex: 1,
    minHeight: 58,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  optionTitle: { fontSize: 12.5, fontWeight: "900", textAlign: "center" },
  optionMeta: { fontSize: 10, fontWeight: "700" },
  rule: { fontSize: 11.5, lineHeight: 16, fontWeight: "600", marginTop: 10 },
  meta: { fontSize: 10.5, fontWeight: "800", marginTop: 4 },

  // Çipler sayfa kenarına kadar kaysın: gövdenin yatay dolgusu geri alınır.
  sourcesScroll: { flexGrow: 0, marginHorizontal: -18 },
  sources: { gap: 8, paddingHorizontal: 18 },
  chip: {
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
  },
  chipText: { fontSize: 12, fontWeight: "800" },
  chipCount: { fontSize: 10.5, fontWeight: "800" },

  footer: { paddingHorizontal: 18, paddingTop: 16 },
  startWrap: { borderRadius: 16, overflow: "hidden" },
  startButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 20 },
  startText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  allowance: { fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 8 },
});
