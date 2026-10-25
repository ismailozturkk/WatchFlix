// screens/tabs/profile/ListVisibilityScreen.js
//
// Ayarlar > Gizlilik > Profilinde görünen listeler.
//
// NEDEN AYRI EKRAN: bu ayar eskiden Listelerim'deki her kartın köşesinde yazısız bir
// göz simgesiydi; ne yaptığı (arkadaşının profilinde o listenin görünüp görünmemesi)
// anlaşılmıyordu ve "kim görüyor" sorusunun diğer yarısı (privacy.lists) başka
// ekrandaydı. Burada ikisi bir arada: üstte KİM görebilir, altta HANGİ listeler.
//
// Veri: Users/{uid}.listVisible (UserProfileContext, canlı) + listeler
// (ListStatusContext.combinedLists). Mantık utils/listVisibility.js'te (saf, testli).

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import SwitchToggle from "@components/SwitchToggle";
import { toast } from "@components/AppToast";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useUserProfile } from "@context/UserProfileContext";
import { useListStatusContext } from "@context/ListStatusContext";
import * as Haptics from "@services/hapticsService";
import { setListVisibility } from "@services/userService";
import { alpha } from "@theme/colors";
import { intlLocaleOf } from "@utils/appLanguages";
import { i18nText } from "@utils/i18nText";
import { getListAccent, getListIcon } from "@utils/listAppearance";
import {
  buildListVisibilityRows,
  bulkVisibilityChanges,
  effectiveListAudience,
  normalizeListVisible,
  summarizeListVisibility,
} from "@utils/listVisibility";
import GlassBox from "../../../components/common/GlassBox";
import GlassTouchable from "../../../components/common/GlassTouchable";
import { SettingsSubScreen, buildUiColors, ui } from "../settings/settingsUi";
import { getListVisibilityCopy } from "./listVisibilityCopy";

const AUDIENCES = [
  { value: "public", icon: "earth" },
  { value: "friends", icon: "people" },
  { value: "private", icon: "lock-closed" },
];

// Öntanımlı dört listenin görünen adı (Listelerim ile aynı anahtarlar).
const displayNameOf = (name) => {
  switch (name) {
    case "watchedMovies":
      return i18nText("autoI18n.izlenen_filmler", "İzlenen Filmler");
    case "watchedTv":
      return i18nText("autoI18n.izlenen_diziler", "İzlenen Diziler");
    case "favorites":
      return i18nText("autoI18n.favoriler", "Favoriler");
    case "watchList":
      return i18nText("autoI18n.izlenecekler", "İzlenecekler");
    default:
      return name;
  }
};

// ─── Kitle seçeneği ───────────────────────────────────────────────────────────
const AudienceChip = memo(function AudienceChip({ value, icon, label, selected, onPress, C }) {
  return (
    <GlassTouchable
      testID={`list-audience-${value}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      activeOpacity={0.75}
      onPress={() => onPress(value)}
      style={[
        s.chip,
        {
          backgroundColor: selected ? alpha(C.accent, 0.14) : C.card,
          borderColor: selected ? C.accent : C.border,
        },
      ]}
    >
      <AppIcon name={selected ? icon : `${icon}-outline`} size={18} color={selected ? C.accent : C.muted} />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[s.chipText, { color: selected ? C.text : C.muted }]}
      >
        {label}
      </Text>
    </GlassTouchable>
  );
});

// ─── Liste satırı ─────────────────────────────────────────────────────────────
const ListRow = memo(function ListRow({ row, title, subtitle, onToggle, last, C }) {
  const accent = getListAccent(row.name, C.card);
  return (
    <GlassTouchable
      testID={`list-visibility-row-${row.name}`}
      accessibilityRole="switch"
      accessibilityState={{ checked: row.shown }}
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      activeOpacity={0.65}
      onPress={() => onToggle(row.name, !row.shown)}
      style={[ui.row, { borderBottomColor: C.borderMuted }, last && { borderBottomWidth: 0 }]}
    >
      {/* Kapalı listenin simgesi ve metni soluk: durum anahtara bakmadan okunur. */}
      <View style={[ui.rowLeft, { opacity: row.shown ? 1 : 0.5 }]}>
        <View style={[ui.iconWrap, { backgroundColor: alpha(accent, 0.16) }]}>
          <AppIcon name={getListIcon(row.name)} size={16} color={accent} />
        </View>
        <View style={ui.rowTexts}>
          <Text allowFontScaling={false} numberOfLines={1} style={[ui.rowTitle, { color: C.text }]}>
            {title}
          </Text>
          <Text allowFontScaling={false} numberOfLines={2} style={[ui.rowSub, { color: C.muted }]}>
            {subtitle}
          </Text>
        </View>
      </View>
      <View style={s.switchBox}>
        <SwitchToggle value={row.shown} onValueChange={(next) => onToggle(row.name, next)} size={36} />
      </View>
    </GlassTouchable>
  );
});

// ─── Ekran ────────────────────────────────────────────────────────────────────
export default function ListVisibilityScreen() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const copy = getListVisibilityCopy(language);
  const { uid, profile, privacy, updatePrivacy } = useUserProfile();
  const { combinedLists } = useListStatusContext() || {};

  const rawVisible = profile?.listVisible;
  const storedMap = useMemo(() => normalizeListVisible(rawVisible), [rawVisible]);

  // Yazım yolda iken anahtar geri sekmesin: profil anlık görüntüsü gelene kadar
  // seçilen değer burada tutulur; yeni görüntü gelince düşer.
  const [overrides, setOverrides] = useState({});
  useEffect(() => setOverrides({}), [rawVisible]);
  const [pendingAudience, setPendingAudience] = useState(null);

  const visibleMap = useMemo(() => ({ ...storedMap, ...overrides }), [storedMap, overrides]);
  const rows = useMemo(
    () => buildListVisibilityRows(combinedLists, visibleMap, intlLocaleOf(language)),
    [combinedLists, visibleMap, language],
  );
  const summary = summarizeListVisibility(rows);
  const allShown = summary.total > 0 && summary.shown === summary.total;

  const selectedAudience = pendingAudience ?? privacy?.lists ?? "public";
  const effective = effectiveListAudience({ ...privacy, lists: selectedAudience });
  const note = effective.limitedByProfile
    ? copy.limitedNote[effective.audience]
    : copy.audienceNote[effective.audience];
  const nobodySees = effective.audience === "private";

  const write = useCallback(
    async (changes) => {
      if (!uid || Object.keys(changes).length === 0) return;
      setOverrides((prev) => ({ ...prev, ...changes }));
      try {
        // Eski dizi biçimi tek alan yazımında haritaya dönerken diğer bayrakları
        // düşürürdü; o durumda haritanın tamamı yazılır.
        await setListVisibility(uid, Array.isArray(rawVisible) ? { ...storedMap, ...changes } : changes);
      } catch {
        setOverrides((prev) => {
          const next = { ...prev };
          Object.keys(changes).forEach((name) => delete next[name]);
          return next;
        });
        toast.error(copy.saveFailed);
      }
    },
    [uid, rawVisible, storedMap, copy.saveFailed],
  );

  const onToggle = useCallback(
    (name, shown) => {
      Haptics.selectionAsync();
      write({ [name]: shown });
    },
    [write],
  );

  const onToggleAll = useCallback(() => {
    Haptics.selectionAsync();
    write(bulkVisibilityChanges(rows, !allShown));
  }, [write, rows, allShown]);

  const onAudience = useCallback(
    async (value) => {
      if (value === selectedAudience) return;
      Haptics.selectionAsync();
      setPendingAudience(value);
      try {
        await updatePrivacy({ lists: value });
      } catch {
        toast.error(copy.saveFailed);
      } finally {
        setPendingAudience(null);
      }
    },
    [selectedAudience, updatePrivacy, copy.saveFailed],
  );

  const subtitleOf = (row) => {
    if (!row.shown) return copy.hiddenSub(row.count);
    return row.count === 0 ? copy.emptySub : copy.shownSub(row.count);
  };

  return (
    <SettingsSubScreen title={copy.title}>
      <Text allowFontScaling={false} style={[s.intro, { color: C.muted }]}>
        {copy.intro}
      </Text>

      {/* ── Kim görebilir (privacy.lists) ── */}
      <Text allowFontScaling={false} style={[ui.sectionLabel, s.firstLabel, { color: C.muted }]}>
        {copy.whoLabel}
      </Text>
      <View accessibilityRole="radiogroup" style={s.chips}>
        {AUDIENCES.map((option) => (
          <AudienceChip
            key={option.value}
            C={C}
            value={option.value}
            icon={option.icon}
            label={copy.audience[option.value]}
            selected={selectedAudience === option.value}
            onPress={onAudience}
          />
        ))}
      </View>
      <View
        style={[
          s.note,
          {
            backgroundColor: nobodySees ? alpha(C.amber, 0.12) : C.card,
            borderColor: nobodySees ? alpha(C.amber, 0.4) : C.border,
          },
        ]}
      >
        <AppIcon
          name={nobodySees ? "lock-closed-outline" : "information-circle-outline"}
          size={16}
          color={nobodySees ? C.amber : C.muted}
        />
        <Text allowFontScaling={false} style={[s.noteText, { color: nobodySees ? C.text : C.muted }]}>
          {note}
        </Text>
      </View>

      {/* ── Hangi listeler (listVisible) ── */}
      <View style={s.whichHeader}>
        <View style={s.whichTexts}>
          <Text allowFontScaling={false} style={[ui.sectionLabel, s.inlineLabel, { color: C.muted }]}>
            {copy.whichLabel}
          </Text>
          <Text allowFontScaling={false} style={[s.count, { color: C.muted }]}>
            {copy.shownCount(summary.shown, summary.total)}
          </Text>
        </View>
        <GlassTouchable
          testID="list-visibility-toggle-all"
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
            {allShown ? copy.hideAll : copy.showAll}
          </Text>
        </GlassTouchable>
      </View>
      <GlassBox role="card" style={[ui.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {rows.map((row, index) => (
          <ListRow
            key={row.name}
            C={C}
            row={row}
            title={displayNameOf(row.name)}
            subtitle={subtitleOf(row)}
            onToggle={onToggle}
            last={index === rows.length - 1}
          />
        ))}
      </GlassBox>

      <Text allowFontScaling={false} style={[s.footer, { color: C.muted }]}>
        {copy.footer}
      </Text>
    </SettingsSubScreen>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 12, lineHeight: 17, marginTop: 6, marginHorizontal: 4 },
  firstLabel: { marginTop: 18 },
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    minHeight: 64,
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  chipText: { fontSize: 12.5, fontWeight: "700", maxWidth: "100%" },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  whichHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 22,
    marginBottom: 10,
  },
  whichTexts: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  inlineLabel: { marginTop: 0, marginBottom: 0 },
  count: { fontSize: 11, fontWeight: "600" },
  allBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    maxWidth: 170,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  allBtnText: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
  switchBox: { marginLeft: 10 },
  footer: { fontSize: 11, lineHeight: 16, marginTop: 10, marginHorizontal: 4 },
});
