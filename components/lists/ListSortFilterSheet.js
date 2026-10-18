// components/lists/ListSortFilterSheet.js
//
// Liste ekranlarının (ListsScreen, SharedListScreen) ORTAK "Sırala ve filtrele" sayfası. Eski sayfalar uzundu
// (4 sıralama satırı + 2 görünüm satırı + 6 anahtarlı poster bilgisi satırı + tür/tarih/tür çipleri ≈ 3 ekran
// boyu) ve iki ekranda ayrı ayrı kopyalanmıştı. Burada:
//
//   • Sıralama tek sırada çipler; seçili çipte yön oku, tekrar basınca yön çevrilir.
//   • Süzgeçler (tür, tarih, türler, platform, üye…) ekrandan `sections` olarak gelir; sayfa çizer:
//       segment  — az seçenekli, tek seçim (Hepsi / Film / Dizi)
//       chips    — tek seçimli çipler (tarih aralığı)
//       multi    — çok seçimli çipler; çok olunca ilk 8 + "+N daha" (seçililer hep görünür)
//       node     — ekranın kendi bölümü (Platformlarım, Paylaşan üye)
//   • Görünüm (sütun, köşe, poster bilgisi) KAPALI bir satırda: "Görünüm · 3'lü · Normal"; açılınca çipler.
//   • Üstte etkin süzgeç sayısı + Sıfırla; altta tek büyük "N sonuç göster".
//
// Ortak alt sayfa kabuğu (BottomSheetModal: blur yerinde solar). Karar mantığı utils/listSortFilter.js (saf, testli).

import React, { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import SheetScroll from "@components/common/SheetScroll";
import ListPosterInfoControls from "@components/lists/ListPosterInfoControls";
import { alpha } from "@theme/colors";
import { readableTextOn } from "@utils/colorUtils";
import { collapseChips, nextSort, radiusKeyOf } from "@utils/listSortFilter";
import { fillSortFilterCopy } from "@utils/listSortFilterCopy";

const COLUMN_KEYS = [3, 4];
const RADIUS_KEYS = [2, 10, 20];

function Label({ children, theme, style }) {
  return (
    <Text allowFontScaling={false} style={[styles.label, { color: theme.text.muted }, style]}>
      {children}
    </Text>
  );
}

function Segment({ options, value, onChange, theme, accent, testID }) {
  const onAccent = readableTextOn(accent);
  return (
    <View style={[styles.segment, { backgroundColor: theme.primary, borderColor: theme.border }]}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={String(option.key)}
            testID={testID ? `${testID}-${option.key}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            style={[styles.segmentItem, selected && { backgroundColor: accent }]}
          >
            {option.icon ? (
              <Feather name={option.icon} size={14} color={selected ? onAccent : theme.text.muted} />
            ) : null}
            {option.preview != null ? (
              <View
                style={[
                  styles.radiusPreview,
                  { borderRadius: option.preview, borderColor: selected ? onAccent : theme.text.muted },
                ]}
              />
            ) : null}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.segmentText, { color: selected ? onAccent : theme.text.secondary }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Chip({ label, selected, onPress, theme, accent, testID, icon, trailing }) {
  const onAccent = readableTextOn(accent);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? accent : theme.primary,
          borderColor: selected ? accent : theme.border,
        },
      ]}
    >
      {icon ? <Feather name={icon} size={14} color={selected ? onAccent : theme.text.muted} /> : null}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.chipText, { color: selected ? onAccent : theme.text.secondary }]}
      >
        {label}
      </Text>
      {trailing}
    </Pressable>
  );
}

function MultiChips({ section, theme, accent }) {
  const [expanded, setExpanded] = useState(false);
  const selected = section.value || [];
  const { visible, hiddenCount } = useMemo(
    () => collapseChips(section.options, selected, { limit: 8, expanded }),
    [section.options, selected, expanded],
  );
  return (
    <View style={styles.chips}>
      {visible.map((option) => (
        <Chip
          key={option}
          testID={`sort-filter-${section.id}-${option}`}
          label={option}
          selected={selected.includes(option)}
          onPress={() => section.onToggle(option)}
          theme={theme}
          accent={accent}
        />
      ))}
      {hiddenCount > 0 || (expanded && section.options.length > 8) ? (
        <Pressable
          testID={`sort-filter-${section.id}-more`}
          accessibilityRole="button"
          onPress={() => setExpanded((current) => !current)}
          style={[styles.chip, styles.moreChip, { borderColor: alpha(accent, 0.5) }]}
        >
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.chipText, { color: accent }]}>
            {expanded ? section.lessLabel : fillSortFilterCopy(section.moreLabel, hiddenCount)}
          </Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ListSortFilterSheet({
  visible,
  onClose,
  theme,
  accent,
  copy,
  resultCount,
  filtering = false,
  activeCount = 0,
  onReset,
  sort,
  sections = [],
  view,
}) {
  const onAccent = readableTextOn(accent);
  const [viewOpen, setViewOpen] = useState(false);

  const sortValue = { key: sort.value, dir: sort.dir };
  const radiusKey = radiusKeyOf(view.radius);
  const viewSummary = `${copy.columnsOption[view.columns] || view.columns} · ${copy.radius[radiusKey]}`;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.header}>
        <View style={[styles.headerTile, { backgroundColor: alpha(accent, 0.16) }]}>
          <Feather name="sliders" size={17} color={accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.title, { color: theme.text.primary }]}>
            {copy.title}
          </Text>
          <Text
            testID="sort-filter-results"
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.subtitle, { color: theme.text.muted }]}
          >
            {fillSortFilterCopy(copy.results, resultCount)}
          </Text>
        </View>
        <Pressable
          testID="sort-filter-reset"
          accessibilityRole="button"
          disabled={activeCount === 0}
          onPress={onReset}
          style={[
            styles.reset,
            { backgroundColor: alpha(accent, 0.14), borderColor: alpha(accent, 0.35) },
            activeCount === 0 && styles.resetDisabled,
          ]}
        >
          <Text allowFontScaling={false} style={[styles.resetText, { color: accent }]}>
            {copy.reset}
            {activeCount > 0 ? ` · ${activeCount}` : ""}
          </Text>
        </Pressable>
        <GlassCloseButton size={34} fallbackRadius={11} onPress={onClose} accessibilityLabel={copy.close} />
      </View>

      <SheetScroll contentContainerStyle={styles.body}>
        {/* ── Sıralama ── */}
        <Label theme={theme}>{copy.sort}</Label>
        <View style={styles.chips}>
          {sort.options.map((option) => {
            const selected = sort.value === option.key;
            const showDir = selected && sort.supportsDir && option.key !== "default";
            return (
              <Chip
                key={option.key}
                testID={`sort-filter-sort-${option.key}`}
                label={option.label}
                icon={option.icon}
                selected={selected}
                theme={theme}
                accent={accent}
                onPress={() => sort.onChange(nextSort(sort.supportsDir ? sortValue : { key: sort.value, dir: "desc" }, option.key))}
                trailing={
                  showDir ? (
                    <View testID="sort-filter-dir" style={styles.dir}>
                      <Feather name={sort.dir === "asc" ? "arrow-up" : "arrow-down"} size={14} color={onAccent} />
                    </View>
                  ) : null
                }
              />
            );
          })}
        </View>
        {sort.supportsDir && sort.value !== "default" ? (
          <Text
            testID="sort-filter-dir-text"
            allowFontScaling={false}
            style={[styles.hint, { color: theme.text.muted }]}
          >
            {sort.dir === "asc" ? copy.asc : copy.desc}
          </Text>
        ) : null}

        {/* ── Süzgeçler ── */}
        {sections.map((section) => (
          <View key={section.id} testID={`sort-filter-section-${section.id}`} style={styles.section}>
            {section.title ? <Label theme={theme}>{section.title}</Label> : null}
            {section.kind === "segment" ? (
              <Segment
                testID={`sort-filter-${section.id}`}
                options={section.options}
                value={section.value}
                onChange={section.onChange}
                theme={theme}
                accent={accent}
              />
            ) : null}
            {section.kind === "chips" ? (
              <View style={styles.chips}>
                {section.options.map((option) => (
                  <Chip
                    key={option.key}
                    testID={`sort-filter-${section.id}-${option.key}`}
                    label={option.label}
                    selected={section.value === option.key}
                    onPress={() => section.onChange(option.key)}
                    theme={theme}
                    accent={accent}
                  />
                ))}
              </View>
            ) : null}
            {section.kind === "multi" ? <MultiChips section={section} theme={theme} accent={accent} /> : null}
            {section.kind === "node" ? section.node : null}
          </View>
        ))}

        {/* ── Görünüm (kapalı satır) ── */}
        <View style={[styles.viewCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
          <Pressable
            testID="sort-filter-view-toggle"
            accessibilityRole="button"
            accessibilityState={{ expanded: viewOpen }}
            onPress={() => setViewOpen((current) => !current)}
            style={styles.viewHeader}
          >
            <Feather name="grid" size={16} color={accent} />
            <Text allowFontScaling={false} style={[styles.viewTitle, { color: theme.text.primary }]}>
              {copy.view}
            </Text>
            <Text
              testID="sort-filter-view-summary"
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.viewSummary, { color: theme.text.muted }]}
            >
              {viewSummary}
            </Text>
            <Ionicons name={viewOpen ? "chevron-up" : "chevron-down"} size={17} color={theme.text.muted} />
          </Pressable>

          {viewOpen ? (
            <View style={styles.viewBody}>
              <Label theme={theme}>{copy.columns}</Label>
              <Segment
                testID="sort-filter-columns"
                options={COLUMN_KEYS.map((key) => ({ key, label: copy.columnsOption[key], icon: "grid" }))}
                value={view.columns}
                onChange={view.onColumns}
                theme={theme}
                accent={accent}
              />
              <Label theme={theme} style={styles.viewGap}>
                {copy.corners}
              </Label>
              <Segment
                testID="sort-filter-radius"
                options={RADIUS_KEYS.map((key) => ({ key, label: copy.radius[key], preview: key === 2 ? 3 : key === 10 ? 8 : 14 }))}
                value={radiusKey}
                onChange={view.onRadius}
                theme={theme}
                accent={accent}
              />
              <Label theme={theme} style={styles.viewGap}>
                {copy.posterInfo}
              </Label>
              <ListPosterInfoControls
                variant="chips"
                theme={theme}
                accent={accent}
                value={view.posterInfo}
                onValueChange={view.onPosterInfo}
                showAddedBy={view.showAddedBy}
              />
            </View>
          ) : null}
        </View>
      </SheetScroll>

      <Pressable
        testID="sort-filter-apply"
        accessibilityRole="button"
        onPress={onClose}
        style={[styles.apply, { backgroundColor: accent }]}
      >
        {filtering ? (
          <ActivityIndicator size="small" color={onAccent} />
        ) : (
          <Text allowFontScaling={false} style={[styles.applyText, { color: onAccent }]}>
            {fillSortFilterCopy(copy.showResults, resultCount)}
          </Text>
        )}
      </Pressable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "86%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
  },
  handle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  headerTile: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { fontSize: 12, fontWeight: "600" },
  reset: { height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  resetDisabled: { opacity: 0.4 },
  resetText: { fontSize: 12.5, fontWeight: "800" },

  body: { paddingTop: 10, paddingBottom: 8 },
  section: { marginTop: 14 },
  label: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.9, marginBottom: 7 },
  hint: { fontSize: 11, fontWeight: "600", marginTop: 6 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
  },
  chipText: { fontSize: 12.5, fontWeight: "700", flexShrink: 1 },
  moreChip: { backgroundColor: "transparent", borderStyle: "dashed" },
  dir: { marginLeft: 1 },

  segment: { flexDirection: "row", padding: 3, gap: 3, borderRadius: 13, borderWidth: 1 },
  segmentItem: {
    flex: 1,
    minWidth: 0,
    height: 34,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 6,
  },
  segmentText: { fontSize: 12.5, fontWeight: "800", flexShrink: 1 },
  radiusPreview: { width: 12, height: 15, borderWidth: 1.5 },

  viewCard: { marginTop: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  viewHeader: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13 },
  viewTitle: { fontSize: 13.5, fontWeight: "800" },
  viewSummary: { flex: 1, fontSize: 12, fontWeight: "600", textAlign: "right" },
  viewBody: { paddingHorizontal: 13, paddingBottom: 14 },
  viewGap: { marginTop: 12 },

  apply: { height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 10 },
  applyText: { fontSize: 14.5, fontWeight: "800" },
});

export default memo(ListSortFilterSheet);
