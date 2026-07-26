import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { i18nText } from "@utils/i18nText";

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

function SectionLabel({ icon, children, theme }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Ionicons name={icon} size={12} color={theme.text.muted} />
      <Text
        allowFontScaling={false}
        style={[styles.sectionLabel, { color: theme.text.muted }]}
      >
        {children}
      </Text>
    </View>
  );
}

export function CalendarFilterPanel({
  theme,
  viewMode,
  onViewModeChange,
  rangeLabel,
  onRangePress,
  activeFilter,
  onFilterChange,
  filterCounts,
  resultCount,
  bulkActionCount,
  isBulkLoading,
  onBulkAction,
}) {
  const isFuture = viewMode === "future";
  const bulkColor = isFuture ? theme.accent : "#ef4444";
  const bulkDisabled = isBulkLoading || bulkActionCount === 0;
  const actionLabel = isFuture
    ? i18nText("autoI18n.aktar", "Aktar")
    : i18nText("autoI18n.sil", "Sil");
  const actionDescription = isFuture
    ? i18nText(
        "autoI18n.telefon_takvimine_aktar",
        "Telefon takvimine aktar",
      )
    : i18nText(
        "autoI18n.telefon_takviminden_kaldir",
        "Telefon takviminden kaldır",
      );

  return (
    <View
      style={[
        styles.stickyShell,
        { backgroundColor: theme.primary, borderBottomColor: theme.border },
      ]}
    >
      <View
        style={[
          styles.panel,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            shadowColor: theme.shadow || "#000",
          },
        ]}
      >
        <View style={styles.panelHeader}>
          <View style={[styles.headerIcon, { backgroundColor: theme.accent + "1A" }]}>
            <Ionicons name="options" size={14} color={theme.accent} />
          </View>
          <View style={styles.headerCopy}>
            <Text
              allowFontScaling={false}
              style={[styles.panelTitle, { color: theme.text.primary }]}
            >
              {i18nText("autoI18n.etkinlikleri_filtrele", "Etkinlikleri filtrele")}
            </Text>
          </View>
          <View style={[styles.resultBadge, { backgroundColor: theme.primary }]}>
            <Text
              allowFontScaling={false}
              style={[styles.panelSubtitle, { color: theme.text.muted }]}
            >
              {i18nText("autoI18n.n_sonuc", "{{count}} sonuç", { count: resultCount })}
            </Text>
          </View>
          {activeFilter !== "all" && (
            <TouchableOpacity
              onPress={() => onFilterChange("all")}
              style={[styles.clearButton, { backgroundColor: theme.primary }]}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.filtreyi_temizle", "Filtreyi temizle")}
            >
              <Ionicons name="close" size={12} color={theme.text.muted} />
              <Text
                allowFontScaling={false}
                style={[styles.clearButtonText, { color: theme.text.muted }]}
              >
                {i18nText("autoI18n.temizle", "Temizle")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.module}>
          <SectionLabel icon="time-outline" theme={theme}>
            {i18nText("autoI18n.zaman_araligi", "ZAMAN ARALIĞI")}
          </SectionLabel>
          <View style={styles.periodRow}>
            <View
              style={[
                styles.modeTabs,
                { backgroundColor: theme.primary, borderColor: theme.border },
              ]}
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
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => onViewModeChange(option.key)}
                    style={[
                      styles.modeTab,
                      active && {
                        backgroundColor: theme.accent,
                        shadowColor: theme.accent,
                      },
                    ]}
                    activeOpacity={0.82}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={option.icon}
                      size={14}
                      color={active ? "#fff" : theme.text.muted}
                    />
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.modeTabText,
                        { color: active ? "#fff" : theme.text.muted },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={onRangePress}
              style={[
                styles.rangeButton,
                {
                  backgroundColor: theme.accent + "12",
                  borderColor: theme.accent + "44",
                },
              ]}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.aralik_sec", "Aralık seç")}
            >
              <View style={[styles.rangeIcon, { backgroundColor: theme.accent + "1F" }]}>
                <Ionicons name="calendar-outline" size={14} color={theme.accent} />
              </View>
              <View style={styles.rangeCopy}>
                <Text
                  allowFontScaling={false}
                  style={[styles.rangeHint, { color: theme.text.muted }]}
                >
                  {i18nText("autoI18n.aralik_filtre", "Aralık")}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.rangeValue, { color: theme.accent }]}
                >
                  {rangeLabel}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={13} color={theme.accent} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.module}>
          <SectionLabel icon="layers-outline" theme={theme}>
            {i18nText("autoI18n.icerik_turu", "İÇERİK TÜRÜ")}
          </SectionLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
          >
            {FILTER_OPTIONS.map((option) => {
              const active = activeFilter === option.key;
              const count = filterCounts?.[option.key] || 0;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => onFilterChange(option.key)}
                  style={[
                    styles.filterChip,
                    active
                      ? { backgroundColor: theme.accent, borderColor: theme.accent }
                      : { backgroundColor: theme.primary, borderColor: theme.border },
                  ]}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={option.icon}
                    size={14}
                    color={active ? "#fff" : theme.text.muted}
                  />
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.filterChipText,
                      { color: active ? "#fff" : theme.text.primary },
                    ]}
                  >
                    {option.label()}
                  </Text>
                  <View
                    style={[
                      styles.filterCount,
                      {
                        backgroundColor: active ? "#ffffff2E" : theme.secondary,
                        borderColor: active ? "#ffffff24" : theme.border,
                      },
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.filterCountText,
                        { color: active ? "#fff" : theme.text.muted },
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View
          style={[
            styles.bulkModule,
            { backgroundColor: theme.primary, borderColor: theme.border },
          ]}
        >
          <View
            style={[
              styles.bulkIcon,
              { backgroundColor: (bulkActionCount > 0 ? bulkColor : theme.text.muted) + "1A" },
            ]}
          >
            <Ionicons
              name={isFuture ? "phone-portrait-outline" : "trash-outline"}
              size={17}
              color={bulkActionCount > 0 ? bulkColor : theme.text.muted}
            />
          </View>
          <View style={styles.bulkCopy}>
            <Text
              allowFontScaling={false}
              style={[styles.bulkTitle, { color: theme.text.primary }]}
            >
              {actionDescription}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.bulkSubtitle, { color: theme.text.muted }]}
            >
              {bulkActionCount > 0
                ? i18nText("autoI18n.n_etkinlik_hazir", "{{count}} etkinlik hazır", {
                    count: bulkActionCount,
                  })
                : i18nText("autoI18n.islem_bekleyen_yok", "İşlem bekleyen etkinlik yok")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onBulkAction}
            disabled={bulkDisabled}
            style={[
              styles.bulkButton,
              {
                backgroundColor: bulkActionCount > 0 ? bulkColor : theme.secondary,
                borderColor: bulkActionCount > 0 ? bulkColor : theme.border,
                opacity: bulkDisabled && !isBulkLoading ? 0.58 : 1,
              },
            ]}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityState={{ disabled: bulkDisabled }}
          >
            {isBulkLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.bulkButtonText,
                    { color: bulkActionCount > 0 ? "#fff" : theme.text.muted },
                  ]}
                >
                  {actionLabel}
                </Text>
                {bulkActionCount > 0 && (
                  <View style={styles.bulkBadge}>
                    <Text allowFontScaling={false} style={styles.bulkBadgeText}>
                      {bulkActionCount}
                    </Text>
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.sheetRoot}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
        />
        <View
          style={[
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
            <TouchableOpacity
              onPress={onClose}
              style={[styles.sheetClose, { backgroundColor: theme.primary }]}
              activeOpacity={0.75}
            >
              <Ionicons name="close" size={17} color={theme.text.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.rangeGrid}>
            {CALENDAR_RANGE_PRESETS.map((preset) => {
              const active = selectedValue === preset.value;
              return (
                <TouchableOpacity
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
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stickyShell: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderBottomWidth: 1,
  },
  panel: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  headerIcon: {
    width: 27,
    height: 27,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 7,
  },
  headerCopy: { flex: 1 },
  panelTitle: { fontSize: 12, fontWeight: "800" },
  resultBadge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
  },
  panelSubtitle: { fontSize: 9, fontWeight: "700" },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 5,
  },
  clearButtonText: { fontSize: 9, fontWeight: "700" },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 10 },
  module: { paddingHorizontal: 10, paddingVertical: 7 },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 5,
  },
  sectionLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 0.55 },
  periodRow: { flexDirection: "row", alignItems: "stretch", gap: 6 },
  modeTabs: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 11,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  modeTab: {
    flex: 1,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 8,
  },
  modeTabText: { fontSize: 10, fontWeight: "700" },
  rangeButton: {
    width: 104,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 6,
    borderRadius: 11,
    borderWidth: 1,
  },
  rangeIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  rangeCopy: { flex: 1 },
  rangeHint: { fontSize: 7, fontWeight: "600" },
  rangeValue: { fontSize: 10, fontWeight: "800" },
  filterList: { gap: 6, paddingRight: 2 },
  filterChip: {
    minHeight: 31,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 8,
    paddingRight: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 10, fontWeight: "700" },
  filterCount: {
    minWidth: 20,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  filterCountText: { fontSize: 8, fontWeight: "800" },
  bulkModule: {
    marginHorizontal: 6,
    marginBottom: 6,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderRadius: 11,
    borderWidth: 1,
  },
  bulkIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 7,
  },
  bulkCopy: { flex: 1, paddingRight: 6 },
  bulkTitle: { fontSize: 10, fontWeight: "700" },
  bulkSubtitle: { fontSize: 8, fontWeight: "500", marginTop: 1 },
  bulkButton: {
    minWidth: 67,
    height: 30,
    paddingHorizontal: 7,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bulkButtonText: { fontSize: 9, fontWeight: "800" },
  bulkBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 5,
    paddingHorizontal: 3,
    backgroundColor: "#ffffff2E",
    justifyContent: "center",
    alignItems: "center",
  },
  bulkBadgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  sheetRoot: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
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
  sheetClose: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
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
