// components/lists/ListItemActionsSheet.js
//
// Liste ekranlarının (ListsScreen, SharedListScreen) ortak "İçerik işlemleri" sayfası. Üç adım:
//
//   actions — üstte poster kartı (ad, tür · yıl · süre, türler, sıra hapı), altta gruplu eylem
//             kartı: Sırayı değiştir · Listeden kaldır.
//   move    — büyük sıra göstergesi (−/+ ve elle yazma), dokunulabilir konum çubuğu (soluk nokta
//             mevcut, dolu nokta hedef sıra), hızlı düğmeler (en başa / bir yukarı / bir aşağı /
//             en sona) ve "N. sıraya taşı".
//   delete  — kırmızı onay kartı; Vazgeç + Kaldır yan yana.
//
// Sıralama açıkken taşıma kapalı (canMove + moveDisabledHint, bkz. ListsScreen).

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import PosterImage from "@components/PosterImage";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "@theme/colors";
import { i18nText, upperText } from "@utils/i18nText";
import { hoursMinutesText } from "@utils/durationText";
import { readableTextOn } from "@utils/colorUtils";
import * as Haptics from "@services/hapticsService";
import { buildGenreMap } from "@utils/genreLabels";
import GlassTouchable from "../common/GlassTouchable";
import GlassBox from "../common/GlassBox";

const DANGER = "#ef4444";

function formatItemDuration(item) {
  if (!item) return null;
  const mins = Number(item.minutes);
  if (mins > 0) return hoursMinutesText(mins);
  let totalMins = Number(item.totalMinutes) || 0;
  if (!totalMins && Array.isArray(item.seasons)) {
    item.seasons.forEach((s) => {
      (s.episodes || []).forEach((ep) => {
        if (ep && typeof ep.episodeMinutes === "number") {
          totalMins += ep.episodeMinutes;
        }
      });
    });
  }
  if (totalMins > 0) return hoursMinutesText(totalMins);
  if (item.showEpisodeCount) {
    return i18nText("autoI18n.n_bolum", "{{count}} bölüm", { count: item.showEpisodeCount });
  }
  return null;
}

function formatItemGenres(item) {
  if (!item) return [];
  const genreMap = buildGenreMap();
  const raw = item.genres || item.genre_ids || [];
  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw
    .map((g) => {
      if (typeof g === "number") return genreMap[g] || null;
      if (typeof g === "string") {
        const num = Number(g);
        if (!isNaN(num) && genreMap[num]) return genreMap[num];
        return g;
      }
      if (typeof g === "object" && g && g.name) return g.name;
      return null;
    })
    .filter(Boolean);
}

function itemYear(item) {
  const raw = item?.releaseDate || item?.release_date || item?.first_air_date || item?.year;
  const year = String(raw || "").slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

// Konum çubuğu: soluk nokta mevcut sıra, dolu nokta hedef; arası vurgu tonuyla dolar.
// Çubuğa dokunmak hedefi o noktaya taşır.
function PositionTrack({ current, target, count, accent, theme, disabled, onPick }) {
  const [width, setWidth] = useState(0);
  const span = Math.max(count - 1, 1);
  const pct = (n) => ((Math.min(Math.max(n, 1), count) - 1) / span) * 100;
  const from = pct(current);
  const to = pct(target);
  return (
    <Pressable
      disabled={disabled || width === 0}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPress={(e) => {
        const ratio = Math.min(Math.max(e.nativeEvent.locationX / width, 0), 1);
        onPick(Math.round(ratio * span) + 1);
      }}
      hitSlop={{ top: 12, bottom: 12 }}
      style={styles.track}
    >
      <View pointerEvents="none" style={[styles.trackRail, { backgroundColor: alpha(theme.text.muted, 0.22) }]} />
      <View
        pointerEvents="none"
        style={[
          styles.trackFill,
          { left: `${Math.min(from, to)}%`, width: `${Math.abs(to - from)}%`, backgroundColor: alpha(accent, 0.45) },
        ]}
      />
      <View
        pointerEvents="none"
        style={[styles.trackDot, styles.trackDotCurrent, { left: `${from}%`, borderColor: theme.text.muted, backgroundColor: theme.secondary }]}
      />
      <View
        pointerEvents="none"
        style={[styles.trackDot, styles.trackDotTarget, { left: `${to}%`, backgroundColor: accent, borderColor: theme.secondary }]}
      />
    </Pressable>
  );
}

function ActionRow({ icon, iconSet = "feather", title, hint, tone, disabled, onPress, last, theme }) {
  const Icon = iconSet === "ion" ? Ionicons : Feather;
  return (
    <GlassTouchable
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      style={[
        styles.actionRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: alpha(tone, 0.14) }]}>
        <Icon name={icon} size={18} color={tone} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, { color: tone === DANGER && !disabled ? DANGER : theme.text.primary }]}>
          {title}
        </Text>
        <Text numberOfLines={2} style={[styles.actionHint, { color: theme.text.muted }]}>
          {hint}
        </Text>
      </View>
      {disabled ? (
        <Feather name="lock" size={15} color={theme.text.muted} />
      ) : (
        <Ionicons name="chevron-forward" size={17} color={theme.text.muted} />
      )}
    </GlassTouchable>
  );
}

export default function ListItemActionsSheet({
  visible,
  item,
  currentIndex = 0,
  itemCount = 0,
  accent = "#4b69ff",
  canMove = true,
  moveDisabledHint,
  canDelete = true,
  deleteDisabledHint,
  busy = false,
  onClose,
  onMove,
  onDelete,
}) {
  const { theme } = useTheme();
  const onAccent = readableTextOn(accent);
  const [step, setStep] = useState("actions");
  const [position, setPosition] = useState("1");

  useEffect(() => {
    if (!visible) return;
    setStep("actions");
    setPosition(String(currentIndex + 1));
  }, [visible, currentIndex, item?.id]);

  const current = currentIndex + 1;
  const target = Number(position);
  const validTarget =
    Number.isInteger(target) && target >= 1 && target <= itemCount;
  const effectiveTarget = validTarget ? target : current;
  const moveDisabled = busy || !validTarget || target === current;
  const moveLocked = !canMove || itemCount < 2;

  const durationText = formatItemDuration(item);
  const genres = formatItemGenres(item);
  const year = itemYear(item);
  const metaLine = [
    item?.type === "tv"
      ? i18nText("autoI18n.dizi", "Dizi")
      : item?.type === "movie"
        ? i18nText("autoI18n.film", "Film")
        : null,
    year,
    durationText,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const pick = (next) => {
    const clamped = Math.min(Math.max(next, 1), Math.max(itemCount, 1));
    if (String(clamped) === position) return;
    setPosition(String(clamped));
    Haptics.selectionAsync().catch(() => {});
  };

  const header = (title, subtitle, icon, color = accent) => (
    <View style={styles.stepHeader}>
      <GlassCloseButton
        icon="chevron-back"
        size={36}
        fallbackRadius={18}
        iconSize={19}
        color={theme.text.primary}
        onPress={() => !busy && setStep("actions")}
        disabled={busy}
        accessibilityLabel={i18nText("autoI18n.geri", "Geri")}
      />
      <View style={styles.stepHeaderCopy}>
        <View style={styles.stepTitleRow}>
          <Feather name={icon} size={15} color={color} />
          <Text numberOfLines={1} style={[styles.stepTitle, { color: theme.text.primary }]}>{title}</Text>
        </View>
        <Text numberOfLines={1} style={[styles.stepSubtitle, { color: theme.text.muted }]}>{subtitle}</Text>
      </View>
      <GlassCloseButton size={36} fallbackRadius={18} onPress={onClose} disabled={busy} />
    </View>
  );

  const quick = [
    { key: "first", icon: "chevrons-up", label: i18nText("autoI18n.ilk_sira", "İlk sıra"), to: 1 },
    { key: "up", icon: "chevron-up", label: i18nText("autoI18n.bir_yukari", "Bir yukarı"), to: effectiveTarget - 1 },
    { key: "down", icon: "chevron-down", label: i18nText("autoI18n.bir_asagi", "Bir aşağı"), to: effectiveTarget + 1 },
    { key: "last", icon: "chevrons-down", label: i18nText("autoI18n.son_sira", "Son sıra"), to: itemCount },
  ];

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      {step === "actions" ? (
        <>
          <View style={styles.hero}>
            <View style={[styles.posterFrame, { shadowColor: accent }]}>
              <PosterImage
                path={item?.imagePath}
                type={item?.type}
                mediaId={item?.id}
                size={200}
                style={styles.poster}
              />
            </View>
            <View style={styles.heroCopy}>
              <Text numberOfLines={2} style={[styles.itemName, { color: theme.text.primary }]}>
                {item?.name}
              </Text>
              {metaLine ? (
                <Text numberOfLines={1} style={[styles.metaLine, { color: theme.text.secondary }]}>
                  {metaLine}
                </Text>
              ) : null}
              {genres.length > 0 ? (
                <Text numberOfLines={1} style={[styles.genreLine, { color: theme.text.muted }]}>
                  {genres.slice(0, 3).join(", ")}
                </Text>
              ) : null}
              <View style={[styles.positionPill, { backgroundColor: alpha(accent, 0.14) }]}>
                <Feather name="hash" size={11} color={accent} />
                <Text style={[styles.positionPillText, { color: accent }]}>
                  {i18nText("autoI18n.mevcut_sira", "Mevcut sıra")}: {current}/{itemCount}
                </Text>
              </View>
            </View>
            <View style={styles.heroClose}>
              <GlassCloseButton size={34} fallbackRadius={17} onPress={onClose} disabled={busy} />
            </View>
          </View>

          <Text style={[styles.groupLabel, { color: theme.text.muted }]}>
            {upperText(i18nText("autoI18n.icerik_islemleri", "İçerik işlemleri"))}
          </Text>
          <GlassBox role="card" style={[styles.group, { backgroundColor: theme.primary, borderColor: theme.border }]}>
            <ActionRow
              theme={theme}
              icon="move"
              tone={accent}
              disabled={moveLocked}
              onPress={() => setStep("move")}
              title={i18nText("autoI18n.sirayi_degistir", "Sırayı değiştir")}
              hint={
                !canMove && moveDisabledHint
                  ? moveDisabledHint
                  : itemCount < 2
                    ? i18nText("autoI18n.tasinacak_baska_konum_yok", "Taşınacak başka konum yok")
                    : i18nText("autoI18n.listedeki_yeni_konumu_sec", "Listedeki yeni konumu seç")
              }
            />
            <ActionRow
              theme={theme}
              icon="trash-outline"
              iconSet="ion"
              tone={DANGER}
              disabled={!canDelete}
              onPress={() => setStep("delete")}
              title={i18nText("autoI18n.listeden_kaldir", "Listeden kaldır")}
              hint={
                !canDelete && deleteDisabledHint
                  ? deleteDisabledHint
                  : i18nText("autoI18n.icerigi_bu_listeden_siler", "İçeriği yalnız bu listeden siler")
              }
              last
            />
          </GlassBox>
        </>
      ) : step === "move" ? (
        <>
          {header(
            i18nText("autoI18n.sirayi_degistir", "Sırayı değiştir"),
            item?.name || i18nText("autoI18n.yeni_konumu_sec", "İçeriğin listedeki yeni konumunu seç"),
            "move",
          )}

          <View style={[styles.moveCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
            <Text style={[styles.fieldLabel, { color: theme.text.muted }]}>
              {upperText(i18nText("autoI18n.hedef_sira", "Hedef sıra"))}
            </Text>
            <View style={styles.positionRow}>
              <GlassTouchable
                onPress={() => pick(effectiveTarget - 1)}
                disabled={busy || effectiveTarget <= 1}
                accessibilityLabel={i18nText("autoI18n.bir_yukari", "Bir yukarı")}
                style={[
                  styles.stepButton,
                  { backgroundColor: alpha(accent, 0.12) },
                  (busy || effectiveTarget <= 1) && styles.disabled,
                ]}
              >
                <Feather name="minus" size={22} color={accent} />
              </GlassTouchable>
              <GlassBox role="field" style={[styles.inputWrap, { backgroundColor: theme.secondary, borderColor: alpha(accent, 0.55) }]}>
                <TextInput
                  value={position}
                  onChangeText={(text) => setPosition(text.replace(/[^0-9]/g, ""))}
                  editable={!busy}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  maxLength={String(Math.max(itemCount, 1)).length}
                  style={[styles.input, { color: theme.text.primary }]}
                />
                <Text style={[styles.total, { color: theme.text.muted }]}>/ {itemCount}</Text>
              </GlassBox>
              <GlassTouchable
                onPress={() => pick(effectiveTarget + 1)}
                disabled={busy || effectiveTarget >= itemCount}
                accessibilityLabel={i18nText("autoI18n.bir_asagi", "Bir aşağı")}
                style={[
                  styles.stepButton,
                  { backgroundColor: alpha(accent, 0.12) },
                  (busy || effectiveTarget >= itemCount) && styles.disabled,
                ]}
              >
                <Feather name="plus" size={22} color={accent} />
              </GlassTouchable>
            </View>

            <PositionTrack
              current={current}
              target={effectiveTarget}
              count={itemCount}
              accent={accent}
              theme={theme}
              disabled={busy}
              onPick={pick}
            />
            <View style={styles.trackLegend}>
              <Text style={[styles.trackLegendText, { color: theme.text.muted }]}>1</Text>
              <Text style={[styles.trackLegendMid, { color: theme.text.secondary }]}>
                {target === current || !validTarget
                  ? `${i18nText("autoI18n.mevcut_sira", "Mevcut sıra")}: ${current}`
                  : i18nText("autoI18n.siradan_siraya", "{{from}}. sıradan {{to}}. sıraya", { from: current, to: target })}
              </Text>
              <Text style={[styles.trackLegendText, { color: theme.text.muted }]}>{itemCount}</Text>
            </View>
          </View>

          <View style={styles.quickRow}>
            {quick.map((q) => {
              const off = busy || q.to < 1 || q.to > itemCount || q.to === effectiveTarget;
              return (
                <GlassTouchable
                  key={q.key}
                  onPress={() => pick(q.to)}
                  disabled={off}
                  accessibilityLabel={q.label}
                  style={[
                    styles.quickButton,
                    { backgroundColor: theme.primary, borderColor: theme.border },
                    off && styles.disabled,
                  ]}
                >
                  <Feather name={q.icon} size={16} color={theme.text.primary} />
                  <Text numberOfLines={1} style={[styles.quickText, { color: theme.text.secondary }]}>
                    {q.label}
                  </Text>
                </GlassTouchable>
              );
            })}
          </View>

          <GlassTouchable
            onPress={() => onMove?.(target - 1)}
            disabled={moveDisabled}
            style={[styles.primaryButton, { backgroundColor: accent }, moveDisabled && styles.disabled]}
          >
            {busy ? <ActivityIndicator size="small" color={onAccent} /> : <Feather name="corner-down-right" size={17} color={onAccent} />}
            <Text style={[styles.primaryText, { color: onAccent }]}>
              {busy
                ? i18nText("autoI18n.tasiniyor", "Taşınıyor...")
                : validTarget && target !== current
                  ? i18nText("autoI18n.siraya_tasi", "{{n}}. sıraya taşı", { n: target })
                  : i18nText("autoI18n.tasi", "Taşı")}
            </Text>
          </GlassTouchable>
        </>
      ) : (
        <>
          {header(
            i18nText("autoI18n.listeden_kaldir", "Listeden kaldır"),
            i18nText("autoI18n.bu_islem_geri_alinamaz", "Bu işlem geri alınamaz"),
            "trash-2",
            DANGER,
          )}
          <View style={[styles.deleteCard, { backgroundColor: alpha(DANGER, 0.08), borderColor: alpha(DANGER, 0.3) }]}>
            <View>
              <PosterImage
                path={item?.imagePath}
                type={item?.type}
                mediaId={item?.id}
                size={200}
                style={styles.deletePoster}
              />
              <View style={[styles.deleteBadge, { borderColor: theme.secondary }]}>
                <Ionicons name="trash" size={12} color="#fff" />
              </View>
            </View>
            <View style={styles.deleteCopy}>
              <Text style={[styles.deleteTitle, { color: theme.text.primary }]}>
                {i18nText("autoI18n.listeden_kaldir_onay", '"{{name}}" listeden kaldırılsın mı?', { name: item?.name })}
              </Text>
              <Text style={[styles.deleteHint, { color: theme.text.muted }]}>
                {i18nText("autoI18n.diger_listeler_etkilenmez", "Diğer listelerdeki kayıtların etkilenmez.")}
              </Text>
            </View>
          </View>
          <View style={styles.buttonRow}>
            <GlassTouchable
              onPress={() => setStep("actions")}
              disabled={busy}
              style={[
                styles.secondaryButton,
                { backgroundColor: theme.primary, borderColor: theme.border },
                busy && styles.disabled,
              ]}
            >
              <Text style={[styles.secondaryText, { color: theme.text.primary }]}>
                {i18nText("autoI18n.vazgec", "Vazgeç")}
              </Text>
            </GlassTouchable>
            <GlassTouchable
              onPress={onDelete}
              disabled={busy}
              style={[styles.primaryButton, styles.buttonRowPrimary, { backgroundColor: DANGER }, busy && styles.disabled]}
            >
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="trash-outline" size={17} color="#fff" />}
              <Text style={[styles.primaryText, { color: "#fff" }]}>
                {busy ? i18nText("autoI18n.siliniyor", "Siliniyor...") : i18nText("autoI18n.kaldir", "Kaldır")}
              </Text>
            </GlassTouchable>
          </View>
        </>
      )}
    </BottomSheetModal>
  );
}

const DOT = 14;

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30 },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 16 },

  hero: { flexDirection: "row", alignItems: "flex-start", marginBottom: 20 },
  posterFrame: { borderRadius: 12, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  poster: { width: 70, height: 105, borderRadius: 12 },
  heroCopy: { flex: 1, minWidth: 0, marginLeft: 14, paddingTop: 2 },
  heroClose: { marginLeft: 8 },
  itemName: { fontSize: 18, fontWeight: "800", lineHeight: 23, letterSpacing: -0.3 },
  metaLine: { fontSize: 12.5, fontWeight: "600", marginTop: 5 },
  genreLine: { fontSize: 12, marginTop: 3 },
  positionPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, height: 24, borderRadius: 12, marginTop: 10 },
  positionPillText: { fontSize: 11.5, fontWeight: "800" },

  groupLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.9, marginBottom: 8, marginLeft: 4 },
  group: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  actionRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13 },
  actionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionCopy: { flex: 1, minWidth: 0, marginHorizontal: 12 },
  actionTitle: { fontSize: 15, fontWeight: "700" },
  actionHint: { fontSize: 12, lineHeight: 16, marginTop: 2 },

  stepHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  stepHeaderCopy: { flex: 1, minWidth: 0, marginHorizontal: 12 },
  stepTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  stepTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2, flexShrink: 1 },
  stepSubtitle: { fontSize: 12, marginTop: 2 },

  moveCard: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  fieldLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.9, textAlign: "center", marginBottom: 10 },
  positionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 },
  stepButton: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  inputWrap: { height: 64, minWidth: 128, borderWidth: 1.5, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  input: { minWidth: 44, textAlign: "center", fontSize: 32, fontWeight: "800", padding: 0, letterSpacing: -0.5 },
  total: { fontSize: 15, fontWeight: "600", marginLeft: 4 },

  track: { height: 28, justifyContent: "center", marginTop: 18, marginHorizontal: DOT / 2 },
  trackRail: { height: 4, borderRadius: 2 },
  trackFill: { position: "absolute", height: 4, borderRadius: 2 },
  trackDot: { position: "absolute", width: DOT, height: DOT, borderRadius: DOT / 2, marginLeft: -DOT / 2, borderWidth: 2 },
  trackDotCurrent: {},
  trackDotTarget: { width: DOT + 4, height: DOT + 4, borderRadius: (DOT + 4) / 2, marginLeft: -(DOT + 4) / 2, borderWidth: 3 },
  trackLegend: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  trackLegendText: { fontSize: 11, fontWeight: "700", minWidth: 24 },
  trackLegendMid: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "700" },

  quickRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  quickButton: { flex: 1, minWidth: 0, height: 58, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 4 },
  quickText: { fontSize: 11, fontWeight: "700" },

  primaryButton: { minHeight: 52, borderRadius: 16, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { fontSize: 15, fontWeight: "800" },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  buttonRowPrimary: { flex: 1.4, marginTop: 0 },
  secondaryButton: { flex: 1, minHeight: 52, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontSize: 15, fontWeight: "700" },

  deleteCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 20, padding: 14 },
  deletePoster: { width: 54, height: 81, borderRadius: 10 },
  deleteBadge: { position: "absolute", right: -6, bottom: -6, width: 24, height: 24, borderRadius: 12, borderWidth: 2, backgroundColor: DANGER, alignItems: "center", justifyContent: "center" },
  deleteCopy: { flex: 1, minWidth: 0, marginLeft: 16 },
  deleteTitle: { fontSize: 15, fontWeight: "800", lineHeight: 21 },
  deleteHint: { fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  disabled: { opacity: 0.4 },
});
