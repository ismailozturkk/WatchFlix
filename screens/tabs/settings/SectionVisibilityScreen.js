// screens/tabs/settings/SectionVisibilityScreen.js
//
// Ayarlar > Kişiselleştirme > Ekran bölümleri. Diziler, Filmler, Hub ve Profil
// ekranlarındaki bölümlerin (raflar, kartlar, şeritler) hangilerinin görüneceğini
// seçtirir; ör. profilde "Notlar"ı ya da film ekranında "Gizli Cevherler"i kapatınca
// o bölümler ilgili ekrandan kalkar.
//
// BİÇİM: üstte dört ekran karosu (her birinde kaç bölümün göründüğü), seçili ekranın
// özet kartı (ilerleme çubuğu + tümünü aç/kapa) ve bölüm satırları. Her satırın anahtarı
// ilgili ekranı ANINDA günceller (ekran aynı depoyu dinler, hooks/useSectionVisibility.js).
//
// ESKİ TEK ANAHTARLI BÖLÜM: "Devam Edenler" rafının kendi ayarı zaten var (Dil ve içerik).
// Burada AYNI ayarı okuyup yazar; ikinci bir kayıt yok (bkz. utils/sectionVisibility.js).
//
// Mantık utils/sectionVisibility.js'te (saf, testli); burada yalnız çizim.

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import AppIcon from "@components/AppIcon";
import SwitchToggle from "@components/SwitchToggle";
import ConfirmSheet from "@components/common/ConfirmSheet";
import { toast } from "@components/AppToast";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useOngoingTvShowsSettings } from "@context/AppSettingsContext";
import useReduceMotion from "@hooks/useReduceMotion";
import {
  resetSectionVisibility,
  setScreenSectionsShown,
  setSectionShown,
  useSectionVisibilityMap,
} from "@hooks/useSectionVisibility";
import * as Haptics from "@services/hapticsService";
import {
  SECTION_SCREENS,
  isSectionScreen,
  isSectionVisibilityCustomized,
  isSectionVisible,
  sectionsOf,
  summarizeScreen,
} from "@utils/sectionVisibility";
import { alpha } from "@theme/colors";
import { SettingsSubScreen, buildUiColors, ui } from "./settingsUi";
import { fillCopy, getSectionVisibilityCopy } from "./sectionVisibilityCopy";

// Simge karosu renkleri: [zemin, simge].
const tintOf = (C, tint) =>
  ({
    blue: [C.iconBlue, C.blue],
    purple: [C.iconPurple, C.purple],
    green: [C.iconGreen, C.green],
    amber: [C.iconAmber, C.amber],
    teal: [C.iconTeal, C.teal],
  })[tint] ?? [C.iconBlue, C.blue];

// ─── Ekran karosu ─────────────────────────────────────────────────────────────
const ScreenTile = memo(function ScreenTile({ id, icon, name, shown, total, hiddenCount, selected, onPress, C }) {
  return (
    <TouchableOpacity
      testID={`section-screen-${id}`}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}, ${shown}/${total}`}
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        s.tile,
        {
          backgroundColor: selected ? alpha(C.accent, 0.14) : C.card,
          borderColor: selected ? C.accent : C.border,
        },
      ]}
    >
      <AppIcon name={icon} size={20} color={selected ? C.accent : C.muted} />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[s.tileName, { color: selected ? C.text : C.muted }]}
      >
        {name}
      </Text>
      <Text allowFontScaling={false} style={[s.tileCount, { color: C.muted }]}>
        {shown}/{total}
      </Text>
      {hiddenCount > 0 ? (
        <View style={[s.tileBadge, { backgroundColor: C.amber }]}>
          <Text allowFontScaling={false} style={s.tileBadgeText}>
            {hiddenCount}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

// ─── Bölüm satırı ─────────────────────────────────────────────────────────────
const SectionRow = memo(function SectionRow({
  item,
  title,
  hint,
  visible,
  linkedTag,
  screenName,
  onToggle,
  last,
  C,
}) {
  const [tintBg, tintFg] = tintOf(C, item.tint);
  return (
    <TouchableOpacity
      testID={`section-row-${item.id}`}
      accessibilityRole="switch"
      accessibilityState={{ checked: visible }}
      accessibilityLabel={`${title}, ${screenName}`}
      activeOpacity={0.65}
      onPress={() => onToggle(item, !visible)}
      style={[ui.row, { borderBottomColor: C.borderMuted }, last && { borderBottomWidth: 0 }]}
    >
      {/* Gizli bölümün simgesi ve metni soluk: açık/kapalı durum anahtara bakmadan okunur. */}
      <View style={[ui.rowLeft, { opacity: visible ? 1 : 0.5 }]}>
        <View style={[ui.iconWrap, { backgroundColor: tintBg }]}>
          <AppIcon name={item.icon} size={16} color={tintFg} />
        </View>
        <View style={ui.rowTexts}>
          <View style={s.titleRow}>
            <Text allowFontScaling={false} numberOfLines={1} style={[ui.rowTitle, s.rowTitleFlex, { color: C.text }]}>
              {title}
            </Text>
            {item.legacy ? (
              <View style={[s.tag, { backgroundColor: alpha(C.green, 0.14) }]}>
                <Text allowFontScaling={false} style={[s.tagText, { color: C.green }]}>
                  {linkedTag}
                </Text>
              </View>
            ) : null}
          </View>
          <Text allowFontScaling={false} numberOfLines={3} style={[ui.rowSub, { color: C.muted }]}>
            {hint}
          </Text>
        </View>
      </View>
      <View style={s.switchBox}>
        <SwitchToggle value={visible} onValueChange={(next) => onToggle(item, next)} size={36} />
      </View>
    </TouchableOpacity>
  );
});

// ─── Ekran ────────────────────────────────────────────────────────────────────
export default function SectionVisibilityScreen() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const route = useRoute();
  const reduceMotion = useReduceMotion();
  const C = buildUiColors(theme);
  const copy = getSectionVisibilityCopy(language);
  const hidden = useSectionVisibilityMap();
  const { showOngoingTvShows, changeShowOngoingTvShows } = useOngoingTvShowsSettings();

  // Eski tek anahtarlı bölümlerin değeri ve yazıcısı (depo anahtarı → { değer, yaz }).
  const legacy = useMemo(
    () => ({ showOngoingTvShows: { value: showOngoingTvShows, write: changeShowOngoingTvShows } }),
    [showOngoingTvShows, changeShowOngoingTvShows],
  );
  const legacyValues = useMemo(
    () => Object.fromEntries(Object.entries(legacy).map(([key, entry]) => [key, entry.value])),
    [legacy],
  );

  // Başka bir ekran (ör. boş kalan Film listesi) belirli bir sekmede açtırabilir.
  const requested = route?.params?.initialScreen;
  const [screenId, setScreenId] = useState(isSectionScreen(requested) ? requested : "tv");
  // Onay bekleyen gizleme: { screen, id } (tek bölüm) ya da { screen, all: true }.
  const [pending, setPending] = useState(null);

  const summaries = useMemo(
    () => SECTION_SCREENS.map((screen) => ({ id: screen.id, icon: screen.icon, ...summarizeScreen(hidden, screen.id, legacyValues) })),
    [hidden, legacyValues],
  );
  const current = summaries.find((entry) => entry.id === screenId) ?? summaries[0];
  const screenCopy = copy.screens[current.id];
  const items = sectionsOf(current.id);
  const allShown = current.hidden === 0;
  const customized = isSectionVisibilityCustomized(hidden) || showOngoingTvShows === false;

  // İlerleme çubuğu: oran değişince yumuşakça kayar. RN Animated (genişlik, yerel
  // sürücüsüz): Reanimated'in ilk-değer geri yazımı bu çubuğu yanlış oranda bırakabilirdi.
  const ratio = current.total ? current.shown / current.total : 1;
  const progress = useRef(new Animated.Value(ratio)).current;
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(ratio);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: ratio,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [ratio, reduceMotion, progress]);
  const fillWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  const fail = useCallback(() => toast.error(copy.ui.saveFailed), [copy.ui.saveFailed]);

  const applySection = useCallback(
    (screen, item, visible) => {
      Haptics.selectionAsync();
      if (item.legacy) {
        legacy[item.legacy]?.write(visible);
        return;
      }
      if (!setSectionShown(screen, item.id, visible)) fail();
    },
    [legacy, fail],
  );

  const applyAll = useCallback(
    (screen, visible) => {
      Haptics.selectionAsync();
      const ok = setScreenSectionsShown(screen, visible);
      for (const item of sectionsOf(screen)) {
        if (item.legacy) legacy[item.legacy]?.write(visible);
      }
      if (!ok) fail();
    },
    [legacy, fail],
  );

  const onToggle = useCallback(
    (item, visible) => {
      // Başka yerden erişilemeyen bir girişi gizlemeden önce sor.
      if (!visible && item.confirmHide) {
        setPending({ screen: screenId, id: item.id });
        return;
      }
      applySection(screenId, item, visible);
    },
    [applySection, screenId],
  );

  const onToggleAll = useCallback(() => {
    const hideNow = allShown;
    if (hideNow && sectionsOf(screenId).some((item) => item.confirmHide && isSectionVisible(hidden, screenId, item.id))) {
      setPending({ screen: screenId, all: true });
      return;
    }
    applyAll(screenId, !hideNow);
  }, [allShown, applyAll, hidden, screenId]);

  const confirmPending = useCallback(() => {
    if (pending) {
      if (pending.all) {
        applyAll(pending.screen, false);
      } else {
        const item = sectionsOf(pending.screen).find((entry) => entry.id === pending.id);
        if (item) applySection(pending.screen, item, false);
      }
    }
    setPending(null);
  }, [applyAll, applySection, pending]);
  const closePending = useCallback(() => setPending(null), []);

  const onReset = useCallback(() => {
    Haptics.selectionAsync();
    resetSectionVisibility();
    for (const entry of Object.values(legacy)) {
      if (entry.value === false) entry.write(true);
    }
  }, [legacy]);

  const showConditionalNote = current.id === "tv" || current.id === "movie";

  return (
    <SettingsSubScreen title={copy.ui.title}>
      <Text allowFontScaling={false} style={[s.intro, { color: C.muted }]}>
        {copy.ui.intro}
      </Text>

      {/* Ekran seçici */}
      <View accessibilityRole="tablist" style={s.tiles}>
        {summaries.map((entry) => (
          <ScreenTile
            key={entry.id}
            C={C}
            id={entry.id}
            icon={entry.icon}
            name={copy.screens[entry.id].name}
            shown={entry.shown}
            total={entry.total}
            hiddenCount={entry.hidden}
            selected={entry.id === current.id}
            onPress={() => {
              if (entry.id !== current.id) Haptics.selectionAsync();
              setScreenId(entry.id);
            }}
          />
        ))}
      </View>

      {/* Özet kartı */}
      <View style={[s.summary, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={s.summaryTop}>
          <View style={s.summaryTexts}>
            <Text allowFontScaling={false} numberOfLines={1} style={[s.summaryTitle, { color: C.text }]}>
              {screenCopy.name}
            </Text>
            <Text allowFontScaling={false} numberOfLines={2} style={[s.summaryHint, { color: C.muted }]}>
              {screenCopy.hint}
            </Text>
          </View>
          <TouchableOpacity
            testID="section-toggle-all"
            accessibilityRole="button"
            activeOpacity={0.7}
            onPress={onToggleAll}
            style={[
              s.allBtn,
              { backgroundColor: allShown ? C.cardAlt : C.accentDim, borderColor: allShown ? C.border : C.accent },
            ]}
          >
            <AppIcon name={allShown ? "eye-off-outline" : "eye-outline"} size={14} color={allShown ? C.muted : C.accent} />
            <Text allowFontScaling={false} numberOfLines={1} style={[s.allBtnText, { color: allShown ? C.muted : C.accent }]}>
              {allShown ? copy.ui.hideAll : copy.ui.showAll}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[s.track, { backgroundColor: C.borderMuted }]}>
          <Animated.View style={[s.fill, { width: fillWidth, backgroundColor: C.accent }]} />
        </View>
        <Text allowFontScaling={false} style={[s.summaryCount, { color: C.muted }]}>
          {fillCopy(copy.ui.visibleCount, { shown: current.shown, total: current.total })}
        </Text>
      </View>

      {/* Bölüm satırları */}
      <View style={[ui.card, s.list, { backgroundColor: C.card, borderColor: C.border }]}>
        {items.map((item, index) => {
          const [title, hint] = copy.sections[current.id][item.id];
          const visible = item.legacy
            ? legacyValues[item.legacy] !== false
            : isSectionVisible(hidden, current.id, item.id);
          return (
            <SectionRow
              key={`${current.id}:${item.id}`}
              C={C}
              item={item}
              title={title}
              hint={hint}
              visible={visible}
              linkedTag={copy.ui.linkedTag}
              screenName={screenCopy.name}
              onToggle={onToggle}
              last={index === items.length - 1}
            />
          );
        })}
      </View>

      {showConditionalNote ? (
        <Text allowFontScaling={false} style={[s.note, { color: C.muted }]}>
          {copy.ui.conditionalNote}
        </Text>
      ) : null}

      {customized ? (
        <TouchableOpacity
          testID="section-reset"
          accessibilityRole="button"
          activeOpacity={0.7}
          onPress={onReset}
          style={[s.reset, { backgroundColor: C.card, borderColor: C.border }]}
        >
          <View style={[ui.iconWrap, { backgroundColor: C.iconAmber }]}>
            <AppIcon name="refresh-outline" size={16} color={C.amber} />
          </View>
          <View style={ui.rowTexts}>
            <Text allowFontScaling={false} style={[ui.rowTitle, { color: C.text }]}>
              {copy.ui.reset}
            </Text>
            <Text allowFontScaling={false} style={[ui.rowSub, { color: C.muted }]}>
              {copy.ui.resetSub}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      <ConfirmSheet
        visible={pending !== null}
        onClose={closePending}
        onConfirm={confirmPending}
        icon="people-outline"
        tone="accent"
        title={copy.ui.confirmTitle}
        message={copy.ui.confirmMessage}
        confirmLabel={copy.ui.confirmHide}
        cancelLabel={copy.ui.confirmCancel}
      />
    </SettingsSubScreen>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 12, lineHeight: 17, marginTop: 6, marginBottom: 14, marginHorizontal: 4 },
  tiles: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tile: {
    flex: 1,
    minHeight: 78,
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tileName: { fontSize: 12, fontWeight: "700", maxWidth: "100%" },
  tileCount: { fontSize: 10.5, fontWeight: "500" },
  tileBadge: {
    position: "absolute",
    top: -6,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  tileBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  summary: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12 },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryTexts: { flex: 1 },
  summaryTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  summaryHint: { fontSize: 11.5, lineHeight: 15, marginTop: 2 },
  allBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    maxWidth: 150,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
  allBtnText: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 14 },
  fill: { height: 6, borderRadius: 3 },
  summaryCount: { fontSize: 11, marginTop: 8 },
  list: { marginTop: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitleFlex: { flexShrink: 1 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 9.5, fontWeight: "700" },
  switchBox: { marginLeft: 10 },
  note: { fontSize: 11, lineHeight: 15, marginTop: 10, marginHorizontal: 4 },
  reset: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
