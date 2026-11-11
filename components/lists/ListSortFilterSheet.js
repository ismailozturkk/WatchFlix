// components/lists/ListSortFilterSheet.js
//
// Liste ekranlarının (ListsScreen, SharedListScreen) ORTAK "Sırala ve filtrele" sayfası. Eski sayfalar uzundu
// (4 sıralama satırı + 2 görünüm satırı + 6 anahtarlı poster bilgisi satırı + tür/tarih/tür çipleri ≈ 3 ekran
// boyu) ve iki ekranda ayrı ayrı kopyalanmıştı. Burada:
//
//   • Sıralama tek sırada karolar (simge üstte, ad altta); seçili karoda yön oku, tekrar basınca yön çevrilir.
//     Başlık satırının sağında yön hapı ("↓ Azalan") — dokununca yön çevrilir.
//   • Süzgeçler (tür, tarih, türler, platform, üye…) ekrandan `sections` olarak gelir; sayfa çizer:
//       segment  — az seçenekli, tek seçim (Hepsi / Film / Dizi)
//       chips    — tek seçimli çipler (tarih aralığı)
//       multi    — çok seçimli çipler; çok olunca ilk 8 + "+N daha" (seçililer hep görünür); başlıkta seçili sayısı
//       node     — ekranın kendi bölümü (Platformlarım, Paylaşan üye)
//     Bölümler ince çizgiyle ayrılır.
//   • Görünüm (sütun, köşe, poster bilgisi) KAPALI bir kartta: "Görünüm · 3'lü · Normal"; açılınca sütun
//     karoları (küçük ızgara çizimi), köşe karoları (köşe çizimi) ve poster bilgisi çipleri.
//   • Altta sabit çubuk: Sıfırla (etkin süzgeç sayısı rozeti) + büyük "N sonuç göster".
//
// Ortak alt sayfa kabuğu (BottomSheetModal: blur yerinde solar). Karar mantığı utils/listSortFilter.js (saf, testli).

import React, { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View} from "react-native";
import LensLoader from "../LensLoader";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import SheetScroll from "@components/common/SheetScroll";
import ListPosterInfoControls from "@components/lists/ListPosterInfoControls";
import { alpha } from "@theme/colors";
import { readableTextOn } from "@utils/colorUtils";
import { collapseChips, nextSort, radiusKeyOf } from "@utils/listSortFilter";
import { POSTER_CORNER_SCALES } from "@utils/posterCorners";
import { fillSortFilterCopy } from "@utils/listSortFilterCopy";
import GlassPressable from "../common/GlassPressable";

const COLUMN_KEYS = [3, 4];
const RADIUS_KEYS = POSTER_CORNER_SCALES.grid;
// Seçici simgesindeki köşe: gerçek oranla (≈ değer/8) beş kademe ayırt edilmiyor;
// abartılı çizilir (en çok 7; 18 pt'lik köşe çiziminde ×1.6).
const RADIUS_PREVIEW = [1, 2.5, 4, 5.5, 7];

function Label({ children, theme, style, trailing }) {
  return (
    <View style={[styles.labelRow, style]}>
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.label, { color: theme.text.muted }]}>
        {children}
      </Text>
      {trailing}
    </View>
  );
}

function CountBadge({ count, accent, testID }) {
  if (!count) return null;
  return (
    <View testID={testID} style={[styles.countBadge, { backgroundColor: alpha(accent, 0.16) }]}>
      <Text allowFontScaling={false} style={[styles.countBadgeText, { color: accent }]}>
        {count}
      </Text>
    </View>
  );
}

// Sütun karosundaki küçük ızgara: n sütunlu iki sıra poster.
function GridGlyph({ columns, color }) {
  return (
    <View style={styles.gridGlyph}>
      {[0, 1].map((row) => (
        <View key={row} style={styles.gridGlyphRow}>
          {Array.from({ length: columns }, (_, i) => (
            <View key={i} style={[styles.gridGlyphCell, { backgroundColor: color, width: columns === 3 ? 5 : 3.6 }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Segment({ options, value, onChange, theme, accent, testID, stacked = false }) {
  const onAccent = readableTextOn(accent);
  return (
    <View style={[styles.segment, { backgroundColor: theme.primary, borderColor: theme.border }]}>
      {options.map((option) => {
        const selected = option.key === value;
        const tint = selected ? onAccent : theme.text.muted;
        return (
          <GlassPressable
            key={String(option.key)}
            testID={testID ? `${testID}-${option.key}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            style={[styles.segmentItem, stacked && styles.segmentItemStacked, selected && { backgroundColor: accent }]}
          >
            {option.icon ? <Feather name={option.icon} size={14} color={tint} /> : null}
            {option.grid ? <GridGlyph columns={option.grid} color={tint} /> : null}
            {option.preview != null ? (
              <View style={[styles.radiusPreview, { borderTopLeftRadius: option.preview * 1.6, borderColor: tint }]} />
            ) : null}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.segmentText, stacked && styles.segmentTextStacked, { color: selected ? onAccent : theme.text.secondary }]}
            >
              {option.label}
            </Text>
          </GlassPressable>
        );
      })}
    </View>
  );
}

function Chip({ label, selected, onPress, theme, accent, testID, icon, trailing, check = false }) {
  const onAccent = readableTextOn(accent);
  return (
    <GlassPressable
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
      {check && selected ? <Feather name="check" size={13} color={onAccent} /> : null}
      {icon ? <Feather name={icon} size={14} color={selected ? onAccent : theme.text.muted} /> : null}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.chipText, { color: selected ? onAccent : theme.text.secondary }]}
      >
        {label}
      </Text>
      {trailing}
    </GlassPressable>
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
          check
        />
      ))}
      {hiddenCount > 0 || (expanded && section.options.length > 8) ? (
        <GlassPressable
          testID={`sort-filter-${section.id}-more`}
          accessibilityRole="button"
          onPress={() => setExpanded((current) => !current)}
          style={[styles.chip, styles.moreChip, { borderColor: alpha(accent, 0.5) }]}
        >
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.chipText, { color: accent }]}>
            {expanded ? section.lessLabel : fillSortFilterCopy(section.moreLabel, hiddenCount)}
          </Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={accent} />
        </GlassPressable>
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
  // `view` isteğe bağlı: görünüm ayarı olmayan ekranlar (Etkinliklerim) kartı hiç çizmez.
  const radiusKey = view ? radiusKeyOf(view.radius) : null;
  const viewSummary = view ? `${copy.columnsOption[view.columns] || view.columns} · ${copy.radius[radiusKey]}` : "";
  const showDir = sort.supportsDir && sort.value !== "default";

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.header}>
        <View style={[styles.headerTile, { backgroundColor: alpha(accent, 0.16) }]}>
          <Feather name="sliders" size={18} color={accent} />
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
        <GlassCloseButton size={36} fallbackRadius={18} onPress={onClose} accessibilityLabel={copy.close} />
      </View>

      <SheetScroll contentContainerStyle={styles.body}>
        {/* ── Sıralama ── */}
        <Label
          theme={theme}
          trailing={
            showDir ? (
              <GlassPressable
                testID="sort-filter-dir-toggle"
                accessibilityRole="button"
                onPress={() => sort.onChange({ key: sort.value, dir: sort.dir === "asc" ? "desc" : "asc" })}
                hitSlop={8}
                style={[styles.dirPill, { backgroundColor: alpha(accent, 0.14) }]}
              >
                <Feather name={sort.dir === "asc" ? "arrow-up" : "arrow-down"} size={12} color={accent} />
                <Text testID="sort-filter-dir-text" allowFontScaling={false} style={[styles.dirPillText, { color: accent }]}>
                  {sort.dir === "asc" ? copy.asc : copy.desc}
                </Text>
              </GlassPressable>
            ) : null
          }
        >
          {copy.sort}
        </Label>
        <View style={styles.sortRow}>
          {sort.options.map((option) => {
            const selected = sort.value === option.key;
            const tileDir = selected && sort.supportsDir && option.key !== "default";
            return (
              <GlassPressable
                key={option.key}
                testID={`sort-filter-sort-${option.key}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => sort.onChange(nextSort(sort.supportsDir ? sortValue : { key: sort.value, dir: "desc" }, option.key))}
                style={[
                  styles.sortTile,
                  selected
                    ? { backgroundColor: alpha(accent, 0.16), borderColor: accent }
                    : { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
              >
                <View style={[styles.sortIcon, { backgroundColor: selected ? accent : alpha(theme.text.muted, 0.14) }]}>
                  <Feather name={option.icon} size={15} color={selected ? onAccent : theme.text.secondary} />
                </View>
                <Text
                  allowFontScaling={false}
                  numberOfLines={2}
                  style={[styles.sortText, { color: selected ? theme.text.primary : theme.text.secondary }]}
                >
                  {option.label}
                </Text>
                {tileDir ? (
                  <View testID="sort-filter-dir" style={[styles.sortDir, { backgroundColor: accent }]}>
                    <Feather name={sort.dir === "asc" ? "arrow-up" : "arrow-down"} size={11} color={onAccent} />
                  </View>
                ) : null}
              </GlassPressable>
            );
          })}
        </View>

        {/* ── Süzgeçler ── */}
        {sections.map((section) => (
          <View
            key={section.id}
            testID={`sort-filter-section-${section.id}`}
            style={[styles.section, { borderTopColor: theme.border }]}
          >
            {section.title ? (
              <Label
                theme={theme}
                trailing={
                  section.kind === "multi" ? (
                    <CountBadge testID={`sort-filter-${section.id}-count`} count={(section.value || []).length} accent={accent} />
                  ) : null
                }
              >
                {section.title}
              </Label>
            ) : null}
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

        {/* ── Görünüm (kapalı kart) ── */}
        {view ? (
        <View style={[styles.viewCard, { backgroundColor: theme.primary, borderColor: theme.border }]}>
          <Pressable
            testID="sort-filter-view-toggle"
            accessibilityRole="button"
            accessibilityState={{ expanded: viewOpen }}
            onPress={() => setViewOpen((current) => !current)}
            style={styles.viewHeader}
          >
            <View style={[styles.viewIcon, { backgroundColor: alpha(accent, 0.14) }]}>
              <Feather name="layout" size={15} color={accent} />
            </View>
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
            <View style={[styles.viewBody, { borderTopColor: theme.border }]}>
              <Label theme={theme}>{copy.columns}</Label>
              <Segment
                testID="sort-filter-columns"
                options={COLUMN_KEYS.map((key) => ({ key, label: copy.columnsOption[key], grid: key }))}
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
                options={RADIUS_KEYS.map((key, i) => ({ key, label: copy.radius[key], preview: RADIUS_PREVIEW[i] }))}
                value={radiusKey}
                onChange={view.onRadius}
                theme={theme}
                accent={accent}
                stacked
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
        ) : null}
      </SheetScroll>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <GlassPressable
          testID="sort-filter-reset"
          accessibilityRole="button"
          accessibilityLabel={activeCount > 0 ? `${copy.reset} · ${activeCount}` : copy.reset}
          disabled={activeCount === 0}
          onPress={onReset}
          style={[
            styles.reset,
            { backgroundColor: theme.primary, borderColor: theme.border },
            activeCount === 0 && styles.resetDisabled,
          ]}
        >
          <Feather name="rotate-ccw" size={15} color={theme.text.primary} />
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.resetText, { color: theme.text.primary }]}>
            {copy.reset}
          </Text>
          {activeCount > 0 ? (
            <View style={[styles.resetBadge, { backgroundColor: accent }]}>
              <Text allowFontScaling={false} style={[styles.resetBadgeText, { color: onAccent }]}>
                {activeCount}
              </Text>
            </View>
          ) : null}
        </GlassPressable>
        <GlassPressable
          testID="sort-filter-apply"
          accessibilityRole="button"
          onPress={onClose}
          style={[styles.apply, { backgroundColor: accent }]}
        >
          {filtering ? (
            <LensLoader tone="mono" size="small" color={onAccent} />
          ) : (
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.applyText, { color: onAccent }]}>
              {fillSortFilterCopy(copy.showResults, resultCount)}
            </Text>
          )}
        </GlassPressable>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  headerTile: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, fontWeight: "600" },

  body: { paddingTop: 12, paddingBottom: 10 },
  section: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 22, marginBottom: 8 },
  label: { flex: 1, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.9 },
  countBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  countBadgeText: { fontSize: 11, fontWeight: "800" },

  dirPill: { flexDirection: "row", alignItems: "center", gap: 4, height: 24, paddingHorizontal: 9, borderRadius: 12 },
  dirPillText: { fontSize: 11.5, fontWeight: "800" },

  sortRow: { flexDirection: "row", gap: 8 },
  sortTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 78,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  sortIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sortText: { fontSize: 11.5, fontWeight: "700", textAlign: "center", lineHeight: 14 },
  sortDir: { position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
  },
  chipText: { fontSize: 12.5, fontWeight: "700", flexShrink: 1 },
  moreChip: { backgroundColor: "transparent", borderStyle: "dashed" },

  segment: { flexDirection: "row", padding: 4, gap: 4, borderRadius: 16, borderWidth: 1 },
  segmentItem: {
    flex: 1,
    minWidth: 0,
    height: 36,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 6,
  },
  // Beş seçenekli köşe satırı: önizleme üstte, ad altta (yan yana sığmıyor).
  segmentItemStacked: { height: 58, flexDirection: "column", gap: 6, paddingHorizontal: 2 },
  segmentText: { fontSize: 12.5, fontWeight: "800", flexShrink: 1 },
  segmentTextStacked: { fontSize: 11, flexShrink: 0 },
  // Köşe çizimi: yalnız sol üst köşe yuvarlanan bir çerçeve parçası — kademeler arası fark net görünür.
  radiusPreview: { width: 18, height: 18, borderTopWidth: 2, borderLeftWidth: 2 },
  gridGlyph: { gap: 2 },
  gridGlyphRow: { flexDirection: "row", gap: 2 },
  gridGlyphCell: { height: 7, borderRadius: 1.5 },

  viewCard: { marginTop: 18, borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  viewHeader: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12 },
  viewIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  viewTitle: { fontSize: 14, fontWeight: "800" },
  viewSummary: { flex: 1, fontSize: 12, fontWeight: "600", textAlign: "right" },
  viewBody: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth },
  viewGap: { marginTop: 14 },

  footer: { flexDirection: "row", gap: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, marginHorizontal: -16, paddingHorizontal: 16 },
  reset: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  resetDisabled: { opacity: 0.4 },
  resetText: { fontSize: 13.5, fontWeight: "800" },
  resetBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  resetBadgeText: { fontSize: 11, fontWeight: "800" },
  apply: { flex: 1, minWidth: 0, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  applyText: { fontSize: 15, fontWeight: "800" },
});

export default memo(ListSortFilterSheet);
