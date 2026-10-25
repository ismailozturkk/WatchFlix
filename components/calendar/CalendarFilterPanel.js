import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import { i18nText } from "@utils/i18nText";
import GlassTouchable from "../common/GlassTouchable";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

export const CALENDAR_RANGE_PRESETS = [
  { value: 1, label: () => i18nText("autoI18n.1_ay", "1 Ay") },
  { value: 3, label: () => i18nText("autoI18n.3_ay", "3 Ay") },
  { value: 6, label: () => i18nText("autoI18n.6_ay", "6 Ay") },
  { value: 12, label: () => i18nText("autoI18n.1_yil", "1 Yıl") },
  { value: "all", label: () => i18nText("autoI18n.tumu", "Tümü") },
];

const FILTER_OPTIONS = [
  {
    key: "all",
    label: () => i18nText("autoI18n.tumu", "Tümü"),
    icon: "apps-outline",
  },
  {
    key: "note",
    label: () => i18nText("autoI18n.notlar", "Notlar"),
    icon: "document-text-outline",
  },
  {
    key: "movie",
    label: () => i18nText("autoI18n.film", "Film"),
    icon: "film-outline",
  },
  {
    key: "tv",
    label: () => i18nText("autoI18n.dizi", "Dizi"),
    icon: "tv-outline",
  },
];

export function getCalendarRangeLabel(value) {
  return CALENDAR_RANGE_PRESETS.find((item) => item.value === value)?.label() || "1 Ay";
}

/**
 * Zaman kontrolleri: Gelecek/Geçmiş + aralık seçici + (varsa) toplu telefon
 * takvimi eylemi. Önceki "Etkinlikleri filtrele" kartı 7-10 punto etiketlerle
 * dört katman yer kaplıyordu; toplu eylem de yapılacak iş olmadığında bile
 * görünüyordu. Şimdi tek satır + yalnızca yapılacak bir şey varken çıkan şerit.
 */
export function CalendarControls({
  theme,
  viewMode,
  onViewModeChange,
  rangeLabel,
  onRangePress,
  bulkActionCount,
  isBulkLoading,
  onBulkAction,
}) {
  const isFuture = viewMode === "future";
  const bulkColor = isFuture ? theme.accent : "#ef4444";
  const showBulk = bulkActionCount > 0 || isBulkLoading;

  return (
    <View style={styles.controls}>
      <View style={styles.periodRow}>
        <View
          style={[
            styles.modeTabs,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
          accessibilityRole="tablist"
        >
          {[
            {
              key: "future",
              label: i18nText("autoI18n.gelecek", "Gelecek"),
              icon: "arrow-forward-circle",
            },
            {
              key: "past",
              label: i18nText("autoI18n.gecmis", "Geçmiş"),
              icon: "arrow-back-circle",
            },
          ].map((option) => {
            const active = viewMode === option.key;
            return (
              <GlassTouchable
                key={option.key}
                onPress={() => onViewModeChange(option.key)}
                style={[styles.modeTab, active && { backgroundColor: theme.accent }]}
                activeOpacity={0.82}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={option.icon}
                  size={15}
                  color={active ? "#fff" : theme.text.muted}
                />
                <Text
                  allowFontScaling={false}
                  style={[styles.modeTabText, { color: active ? "#fff" : theme.text.muted }]}
                >
                  {option.label}
                </Text>
              </GlassTouchable>
            );
          })}
        </View>

        <GlassTouchable
          onPress={onRangePress}
          style={[
            styles.rangeButton,
            { backgroundColor: theme.accent + "14", borderColor: theme.accent + "50" },
          ]}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.aralik_sec", "Aralık seç")}
        >
          <Ionicons name="calendar-outline" size={15} color={theme.accent} />
          <Text allowFontScaling={false} style={[styles.rangeValue, { color: theme.accent }]}>
            {rangeLabel}
          </Text>
          <Ionicons name="chevron-down" size={13} color={theme.accent} />
        </GlassTouchable>
      </View>

      {showBulk ? (
        <View
          style={[
            styles.bulkStrip,
            { backgroundColor: bulkColor + "12", borderColor: bulkColor + "38" },
          ]}
        >
          <Ionicons
            name={isFuture ? "phone-portrait-outline" : "trash-outline"}
            size={18}
            color={bulkColor}
          />
          <View style={styles.bulkCopy}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.bulkTitle, { color: theme.text.primary }]}
            >
              {isFuture
                ? i18nText("autoI18n.telefon_takvimine_aktar", "Telefon takvimine aktar")
                : i18nText("autoI18n.telefon_takviminden_kaldir", "Telefon takviminden kaldır")}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.bulkSubtitle, { color: theme.text.muted }]}
            >
              {i18nText("autoI18n.n_etkinlik_hazir", "{{count}} etkinlik hazır", {
                count: bulkActionCount,
              })}
            </Text>
          </View>
          <GlassTouchable
            onPress={onBulkAction}
            disabled={isBulkLoading}
            style={[styles.bulkButton, { backgroundColor: bulkColor }]}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityState={{ disabled: isBulkLoading, busy: isBulkLoading }}
          >
            {isBulkLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text allowFontScaling={false} style={styles.bulkButtonText}>
                {isFuture ? i18nText("autoI18n.aktar", "Aktar") : i18nText("autoI18n.sil", "Sil")}
              </Text>
            )}
          </GlassTouchable>
        </View>
      ) : null}
    </View>
  );
}

/** Tür çipleri (Tümü / Notlar / Film / Dizi) — sayılar seçili aralığa göre. */
export function CalendarTypeChips({ theme, activeFilter, onFilterChange, filterCounts }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterList}
    >
      {FILTER_OPTIONS.map((option) => {
        const active = activeFilter === option.key;
        const count = filterCounts?.[option.key] || 0;
        return (
          <GlassTouchable
            key={option.key}
            onPress={() => onFilterChange(option.key)}
            style={[
              styles.filterChip,
              active
                ? { backgroundColor: theme.accent, borderColor: theme.accent }
                : { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={option.icon}
              size={15}
              color={active ? "#fff" : theme.text.muted}
            />
            <Text
              allowFontScaling={false}
              style={[styles.filterChipText, { color: active ? "#fff" : theme.text.primary }]}
            >
              {option.label()}
            </Text>
            <View
              style={[
                styles.filterCount,
                { backgroundColor: active ? "#ffffff30" : theme.primary },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[styles.filterCountText, { color: active ? "#fff" : theme.text.muted }]}
              >
                {count}
              </Text>
            </View>
          </GlassTouchable>
        );
      })}
    </ScrollView>
  );
}

export function CalendarRangePicker({
  visible,
  theme,
  selectedValue,
  onSelect,
  onClose,
}) {
  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
          <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetHeaderIcon, { backgroundColor: theme.accent + "1A" }]}>
              <Ionicons name="calendar-outline" size={19} color={theme.accent} />
            </View>
            <View style={styles.sheetHeaderCopy}>
              <Text
                allowFontScaling={false}
                style={[styles.sheetTitle, { color: theme.text.primary }]}
              >
                {i18nText("autoI18n.tarih_araligi", "Tarih aralığı")}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.sheetSubtitle, { color: theme.text.muted }]}
              >
                {i18nText(
                  "autoI18n.listelenecek_donemi_sec",
                  "Listelenecek etkinlik dönemini seç",
                )}
              </Text>
            </View>
            <GlassCloseButton
              size={30}
              fallbackRadius={9}
              iconSize={17}
              backgroundColor={theme.primary}
              onPress={onClose}
            />
          </View>

          <View style={styles.rangeGrid}>
            {CALENDAR_RANGE_PRESETS.map((preset) => {
              const active = selectedValue === preset.value;
              return (
                <GlassTouchable
                  key={String(preset.value)}
                  onPress={() => onSelect(preset.value)}
                  style={[
                    styles.rangeOption,
                    active
                      ? {
                          backgroundColor: theme.accent + "1A",
                          borderColor: theme.accent,
                        }
                      : {
                          backgroundColor: theme.primary,
                          borderColor: theme.border,
                        },
                  ]}
                  activeOpacity={0.78}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.rangeOptionText,
                      { color: active ? theme.accent : theme.text.primary },
                    ]}
                  >
                    {preset.label()}
                  </Text>
                  <Ionicons
                    name={active ? "checkmark-circle" : "ellipse-outline"}
                    size={17}
                    color={active ? theme.accent : theme.text.muted}
                  />
                </GlassTouchable>
              );
            })}
          </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 10 },
  periodRow: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  modeTabs: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  modeTab: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 11,
  },
  modeTabText: { fontSize: 13, fontWeight: "800" },
  rangeButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  rangeValue: { fontSize: 13, fontWeight: "800" },
  bulkStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingLeft: 12,
    paddingRight: 9,
    borderRadius: 14,
    borderWidth: 1,
  },
  bulkCopy: { flex: 1, minWidth: 0 },
  bulkTitle: { fontSize: 13, fontWeight: "700" },
  bulkSubtitle: { fontSize: 11.5, fontWeight: "500", marginTop: 1 },
  bulkButton: {
    minWidth: 68,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  bulkButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  // Basılan cam çip kesilmesin: dikey pay GLASS_PRESS_ROOM, eski 2 pt'nin fazlası dış boşluktan düşülür.
  filterScroll: { marginVertical: 2 - GLASS_PRESS_ROOM },
  filterList: { gap: 8, paddingHorizontal: 16, paddingVertical: GLASS_PRESS_ROOM },
  filterChip: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 11,
    paddingRight: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 13, fontWeight: "700" },
  filterCount: {
    minWidth: 24,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  filterCountText: { fontSize: 11.5, fontWeight: "800" },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sheetHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  sheetHeaderCopy: { flex: 1 },
  sheetTitle: { fontSize: 14, fontWeight: "800" },
  sheetSubtitle: { fontSize: 10, fontWeight: "500", marginTop: 1 },
  rangeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rangeOption: {
    width: "31%",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
  },
  rangeOptionText: { fontSize: 11, fontWeight: "700" },
});
