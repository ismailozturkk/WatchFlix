import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { i18nText } from "@utils/i18nText";
import * as Haptics from "@services/hapticsService";
import { buildGenreMap } from "@utils/genreLabels";
import GlassTouchable from "../common/GlassTouchable";
import GlassBox from "../common/GlassBox";

const DANGER = "#ef4444";

function formatItemDuration(item) {
  if (!item) return null;
  const mins = Number(item.minutes);
  if (mins > 0) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h} sa ${m > 0 ? `${m} dk` : ""}` : `${mins} dk`;
  }
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
  if (totalMins > 0) {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return h > 0 ? `${h} sa ${m > 0 ? `${m} dk` : ""}` : `${totalMins} dk`;
  }
  if (item.showEpisodeCount) {
    return `${item.showEpisodeCount} ${i18nText("autoI18n.bolum", "bölüm")}`;
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
  const [step, setStep] = useState("actions");
  const [position, setPosition] = useState("1");

  useEffect(() => {
    if (!visible) return;
    setStep("actions");
    setPosition(String(currentIndex + 1));
  }, [visible, currentIndex, item?.id]);

  const target = Number(position);
  const validTarget =
    Number.isInteger(target) && target >= 1 && target <= itemCount;
  const moveDisabled = busy || !validTarget || target === currentIndex + 1;

  const durationText = formatItemDuration(item);
  const genres = formatItemGenres(item);

  const stepPosition = (delta) => {
    const base = validTarget ? target : currentIndex + 1;
    const next = Math.min(Math.max(base + delta, 1), Math.max(itemCount, 1));
    setPosition(String(next));
    Haptics.selectionAsync().catch(() => {});
  };

  const header = (icon, title, subtitle, color = accent) => (
    <View style={styles.header}>
      {step !== "actions" ? (
        <GlassCloseButton
          icon="chevron-back"
          size={38}
          fallbackRadius={12}
          iconSize={19}
          color={theme.text.primary}
          onPress={() => !busy && setStep("actions")}
          disabled={busy}
        />
      ) : (
        <View style={[styles.headerIcon, { backgroundColor: color + "1f" }]}>
          <Feather name={icon} size={18} color={color} />
        </View>
      )}
      <View style={styles.headerCopy}>
        <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.text.muted }]}>{subtitle}</Text>
      </View>
      <GlassCloseButton
        size={34}
        fallbackRadius={11}
        onPress={onClose}
        disabled={busy}
      />
    </View>
  );

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
          {header(
            "more-horizontal",
            i18nText("autoI18n.icerik_islemleri", "İçerik işlemleri"),
            i18nText("autoI18n.yapmak_istedigin_islemi_sec", "Yapmak istediğin işlemi seç"),
          )}
          <View style={[styles.preview, { backgroundColor: theme.primary, borderColor: theme.border }]}>
            <PosterImage
              path={item?.imagePath}
              type={item?.type}
              size={200}
              style={styles.poster}
            />
            <View style={styles.previewCopy}>
              <Text numberOfLines={2} style={[styles.itemName, { color: theme.text.primary }]}>
                {item?.name}
              </Text>

              {/* Süre ve Türler */}
              <View style={styles.metaRow}>
                {durationText ? (
                  <View style={[styles.infoChip, { backgroundColor: accent + "18", borderColor: accent + "44" }]}>
                    <Ionicons name="time-outline" size={11} color={accent} />
                    <Text style={[styles.infoChipText, { color: accent }]}>{durationText}</Text>
                  </View>
                ) : null}

                {genres.slice(0, 3).map((g, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.infoChip,
                      {
                        backgroundColor: theme.notesColor?.blueBackground || "rgba(75, 105, 255, 0.15)",
                        borderColor: (theme.notesColor?.blue || accent) + "44",
                      },
                    ]}
                  >
                    <Ionicons name="film-outline" size={11} color={theme.notesColor?.blue || accent} />
                    <Text style={[styles.infoChipText, { color: theme.notesColor?.blue || accent }]}>{g}</Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.positionText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.mevcut_sira", "Mevcut sıra")}: {currentIndex + 1}/{itemCount}
              </Text>
            </View>
          </View>

          <GlassTouchable
            activeOpacity={0.85}
            disabled={!canMove || itemCount < 2}
            onPress={() => setStep("move")}
            style={[
              styles.actionRow,
              { backgroundColor: theme.primary, borderColor: theme.border },
              (!canMove || itemCount < 2) && styles.disabled,
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: accent + "1f" }]}>
              <Feather name="move" size={17} color={accent} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: theme.text.primary }]}>
                {i18nText("autoI18n.sirayi_degistir", "Sırayı değiştir")}
              </Text>
              <Text style={[styles.actionHint, { color: theme.text.muted }]}>
                {!canMove && moveDisabledHint
                  ? moveDisabledHint
                  : itemCount < 2
                    ? i18nText("autoI18n.tasinacak_baska_konum_yok", "Taşınacak başka konum yok")
                    : i18nText("autoI18n.listedeki_yeni_konumu_sec", "Listedeki yeni konumu seç")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={theme.text.muted} />
          </GlassTouchable>

          <GlassTouchable
            activeOpacity={0.85}
            disabled={!canDelete}
            onPress={() => setStep("delete")}
            style={[
              styles.actionRow,
              { backgroundColor: theme.primary, borderColor: DANGER + "45" },
              !canDelete && styles.disabled,
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: DANGER + "1f" }]}>
              <Ionicons name="trash-outline" size={18} color={DANGER} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: canDelete ? DANGER : theme.text.muted }]}>
                {i18nText("autoI18n.listeden_kaldir", "Listeden kaldır")}
              </Text>
              <Text style={[styles.actionHint, { color: theme.text.muted }]}>
                {!canDelete && deleteDisabledHint
                  ? deleteDisabledHint
                  : i18nText("autoI18n.icerigi_bu_listeden_siler", "İçeriği yalnız bu listeden siler")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={theme.text.muted} />
          </GlassTouchable>
        </>
      ) : step === "move" ? (
        <>
          {header(
            "move",
            i18nText("autoI18n.sirayi_degistir", "Sırayı değiştir"),
            i18nText("autoI18n.yeni_konumu_sec", "İçeriğin listedeki yeni konumunu seç"),
          )}
          <Text style={[styles.fieldLabel, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.hedef_sira", "Hedef sıra")}
          </Text>
          <View style={styles.positionRow}>
            <GlassTouchable
              onPress={() => stepPosition(-1)}
              disabled={busy || target <= 1}
              style={[styles.stepButton, { backgroundColor: theme.primary, borderColor: theme.border }]}
            >
              <Feather name="minus" size={20} color={theme.text.primary} />
            </GlassTouchable>
            <GlassBox role="field" style={[styles.inputWrap, { backgroundColor: theme.primary, borderColor: accent }]}>
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
              onPress={() => stepPosition(1)}
              disabled={busy || target >= itemCount}
              style={[styles.stepButton, { backgroundColor: theme.primary, borderColor: theme.border }]}
            >
              <Feather name="plus" size={20} color={theme.text.primary} />
            </GlassTouchable>
          </View>
          <View style={styles.quickRow}>
            <GlassTouchable
              onPress={() => setPosition("1")}
              disabled={busy}
              style={[styles.quickButton, { backgroundColor: theme.primary, borderColor: theme.border }]}
            >
              <Feather name="chevrons-up" size={14} color={theme.text.muted} />
              <Text style={[styles.quickText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.ilk_sira", "İlk sıra")}
              </Text>
            </GlassTouchable>
            <GlassTouchable
              onPress={() => setPosition(String(itemCount))}
              disabled={busy}
              style={[styles.quickButton, { backgroundColor: theme.primary, borderColor: theme.border }]}
            >
              <Feather name="chevrons-down" size={14} color={theme.text.muted} />
              <Text style={[styles.quickText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.son_sira", "Son sıra")}
              </Text>
            </GlassTouchable>
          </View>
          <GlassTouchable
            onPress={() => onMove?.(target - 1)}
            disabled={moveDisabled}
            style={[styles.primaryButton, { backgroundColor: accent }, moveDisabled && styles.disabled]}
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="move" size={16} color="#fff" />}
            <Text style={styles.primaryText}>
              {busy ? i18nText("autoI18n.tasiniyor", "Taşınıyor...") : i18nText("autoI18n.tasi", "Taşı")}
            </Text>
          </GlassTouchable>
        </>
      ) : (
        <>
          {header(
            "trash-2",
            i18nText("autoI18n.listeden_kaldir", "Listeden kaldır"),
            i18nText("autoI18n.bu_islem_geri_alinamaz", "Bu işlem geri alınamaz"),
            DANGER,
          )}
          <View style={[styles.deleteBox, { backgroundColor: DANGER + "12", borderColor: DANGER + "35" }]}>
            <Text style={[styles.deleteTitle, { color: theme.text.primary }]}>
              {i18nText("autoI18n.listeden_kaldir_onay", '"{{name}}" listeden kaldırılsın mı?', { name: item?.name })}
            </Text>
            <Text style={[styles.deleteHint, { color: theme.text.muted }]}>
              {i18nText("autoI18n.diger_listeler_etkilenmez", "Diğer listelerdeki kayıtların etkilenmez.")}
            </Text>
          </View>
          <GlassTouchable
            onPress={onDelete}
            disabled={busy}
            style={[styles.primaryButton, { backgroundColor: DANGER }, busy && styles.disabled]}
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="trash-outline" size={17} color="#fff" />}
            <Text style={styles.primaryText}>
              {busy ? i18nText("autoI18n.siliniyor", "Siliniyor...") : i18nText("autoI18n.kaldir", "Kaldır")}
            </Text>
          </GlassTouchable>
        </>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30 },
  handle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  headerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, marginHorizontal: 11 },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 11.5, marginTop: 2 },
  preview: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 16, padding: 10, marginBottom: 12 },
  poster: { width: 48, height: 72, borderRadius: 9 },
  previewCopy: { flex: 1, marginLeft: 12 },
  itemName: { fontSize: 15, fontWeight: "800", lineHeight: 20 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  infoChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 0.8 },
  infoChipText: { fontSize: 11, fontWeight: "700" },
  positionText: { fontSize: 11.5, marginTop: 7, fontWeight: "600" },
  actionRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 15, padding: 12, marginTop: 9 },
  actionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionCopy: { flex: 1, marginHorizontal: 11 },
  actionTitle: { fontSize: 14.5, fontWeight: "800" },
  actionHint: { fontSize: 11, marginTop: 3 },
  fieldLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8 },
  positionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  stepButton: { width: 48, height: 48, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  inputWrap: { height: 52, minWidth: 130, borderWidth: 1.5, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  input: { minWidth: 42, textAlign: "center", fontSize: 22, fontWeight: "800", padding: 0 },
  total: { fontSize: 14, marginLeft: 5 },
  quickRow: { flexDirection: "row", gap: 9, marginTop: 12 },
  quickButton: { flex: 1, height: 42, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  quickText: { fontSize: 12, fontWeight: "700" },
  primaryButton: { minHeight: 48, borderRadius: 14, marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  deleteBox: { borderWidth: 1, borderRadius: 16, padding: 16 },
  deleteTitle: { fontSize: 15, fontWeight: "800", lineHeight: 21 },
  deleteHint: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  disabled: { opacity: 0.45 },
});
