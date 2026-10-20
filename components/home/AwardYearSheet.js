// components/home/AwardYearSheet.js
//
// Film Oscar / Dizi Emmy rafındaki "Yıl" modunun yıl seçici alt sayfası. Eskiden iki ekranda
// kopyalanmış ham `Modal` + 4 sütunluk düz ızgaraydı: blur yoktu, 58 yıl ayrımsız art arda
// diziliyordu, açılışta seçili yıla kaydırmıyordu, açıklanmamış yıl ayırt edilmiyordu.
//
//   ───                                     ← tutamaç
//   [🏆] Yıl Seçin                      [x]
//        1970 – 2027  ● Çok Yakında
//   [2020] [2010] [2000] [1990] [1980] [1970]   ← on yıl şeridi (dokun = o on yıla atla)
//   2020 – 2027 ────────────────────────
//   [2027•][2026][2025][2024]
//   [2023 ][2022][2021][2020]
//   2010 – 2019 ────────────────────────
//   …
//
// Kabuk ortak BottomSheetModal (blur yerinde solar, sayfa kayar — bkz. modal-blur-fade kuralı).
// Gövde (`YearSheetBody`) Modal içinde olduğundan HER AÇILIŞTA yeniden kurulur: kaydırma konumu
// ve ilk-kaydırma bayrağı bu yüzden gövdenin kendi ref'lerinde tutulur, sıfırlamak gerekmez.
//
// Seçilen yıl hemen `onSelect`e gider; sayfayı kapatmak çağıranın işi. Çıkış penceresi (≈260 ms)
// boyunca seçili hücre yeni yılı gösterir — dokunuşa anında geri bildirim.
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "../AppIcon";
import BottomSheetModal from "../common/BottomSheetModal";
import GlassCloseButton from "../common/GlassCloseButton";
import GlassTouchable from "../common/GlassTouchable";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";
import { chunkYears, decadeOf, groupYearsByDecade } from "../../utils/awardYears";
import { SECTION_GOLD } from "./SectionHeader";

const COLUMNS = 4;
const GAP = 8;
// Kaydırmada "bu on yıl üstte" sayılması için başlığın kaç px altına kadar pay verilir.
const SCROLL_SLACK = 24;
// Şerit düğmesine basıp animasyonlu kaydırırken ara on yılların şeridi titretmemesi için.
const JUMP_LOCK_MS = 500;

// 58 hücre: cam burada pahalı (hücre başına bir görsel efekt katmanı) ve liste öğesi sayılır
// (glassCoverageGuard: `*Cell` bildirimi). `memo` dışarıda sarılır ki bekçi bildirimi görsün.
function YearCell({ year, selected, pending, pendingLabel, onSelect, theme }) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onSelect(year)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={pending && pendingLabel ? `${year}, ${pendingLabel}` : String(year)}
      style={[
        styles.cell,
        {
          backgroundColor: selected ? theme.accent : theme.between,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[
          styles.cellText,
          { color: selected ? "#FFFFFF" : theme.text.primary, fontWeight: selected ? "800" : "600" },
        ]}
      >
        {year}
      </Text>
      {pending ? (
        <View
          style={[
            styles.pendingDot,
            { backgroundColor: SECTION_GOLD, borderColor: selected ? theme.accent : theme.between },
          ]}
        />
      ) : null}
    </TouchableOpacity>
  );
}
const MemoYearCell = memo(YearCell);

// Altı küçük düğme: iOS 26'da cam (GlassTouchable), diğer yerde düz TouchableOpacity.
const DecadeChip = memo(function DecadeChip({ decade, active, onPress, theme }) {
  return (
    <GlassTouchable
      activeOpacity={0.75}
      onPress={() => onPress(decade)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? alpha(theme.accent, 0.16) : theme.between,
          borderColor: active ? alpha(theme.accent, 0.5) : theme.border,
        },
      ]}
    >
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[
          styles.chipText,
          { color: active ? theme.accent : theme.text.muted, fontWeight: active ? "800" : "600" },
        ]}
      >
        {decade}
      </Text>
    </GlassTouchable>
  );
});

function YearSheetBody({ title, groups, selectedYear, pending, pendingLabel, onSelect, onClose, bottomInset }) {
  const { theme } = useTheme();
  const scrollRef = useRef(null);
  const offsets = useRef({}); // decade → içerik içindeki y
  const contentReady = useRef(false);
  const didInitialScroll = useRef(false);
  const lockUntil = useRef(0);

  const initialDecade = useMemo(() => {
    const wanted = decadeOf(selectedYear);
    return groups.some((group) => group.decade === wanted) ? wanted : groups[0]?.decade;
    // Yalnız açılışta: sonradan seçim değişince şerit kaydırmayı izlesin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [activeDecade, setActiveDecade] = useState(initialDecade);

  const first = groups[0]?.max;
  const last = groups[groups.length - 1]?.min;
  const showLegend = !!pendingLabel && pending.size > 0;

  // Açılışta seçili yılın on yılına atla. Konum (onLayout) ve içerik boyutu (contentReady) ikisi de
  // hazır olunca bir kez; aksi halde kaydırma henüz kısa içeriğe kenetlenip sıfırda kalabilir.
  const tryInitialScroll = useCallback(() => {
    if (didInitialScroll.current || !contentReady.current) return;
    const y = offsets.current[initialDecade];
    if (y == null) return;
    didInitialScroll.current = true;
    if (y > SCROLL_SLACK) {
      // Atlama sonda kenetlenebilir (ör. 1980'ler seçili, 1970'ler altında): "sona vardı" kuralı
      // şeridi hemen 1970'e çekmesin. Şerit açılışta SEÇİLİ yılın on yılını gösterir, kullanıcı
      // kaydırmaya başlayınca kaydırma izlemeye geçer.
      lockUntil.current = Date.now() + JUMP_LOCK_MS;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: false });
    }
  }, [initialDecade]);

  const onDecadeLayout = useCallback(
    (decade, y) => {
      offsets.current[decade] = y;
      if (decade === initialDecade) tryInitialScroll();
    },
    [initialDecade, tryInitialScroll],
  );

  const onContentSizeChange = useCallback(() => {
    contentReady.current = true;
    tryInitialScroll();
  }, [tryInitialScroll]);

  const jumpTo = useCallback((decade) => {
    try { triggerHaptic("selection"); } catch (e) {}
    setActiveDecade(decade);
    lockUntil.current = Date.now() + JUMP_LOCK_MS;
    const y = offsets.current[decade];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: true });
  }, []);

  // Şerit, kaydırılırken ekranın üstündeki on yılı izler. Sona varınca (son on yıl üste hiç
  // çıkamayabilir) son on yıl etkin sayılır.
  const onScroll = useCallback(
    (event) => {
      if (Date.now() < lockUntil.current) return;
      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
      const y = contentOffset.y;
      let next = groups[0]?.decade;
      if (y > 0 && y + layoutMeasurement.height >= contentSize.height - 6) {
        next = groups[groups.length - 1]?.decade;
      } else {
        for (const group of groups) {
          const offset = offsets.current[group.decade];
          if (offset != null && offset <= y + SCROLL_SLACK) next = group.decade;
        }
      }
      setActiveDecade((prev) => (prev === next ? prev : next));
    },
    [groups],
  );

  return (
    <>
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.header}>
        <View
          style={[
            styles.tile,
            { backgroundColor: alpha(SECTION_GOLD, 0.14), borderColor: alpha(SECTION_GOLD, 0.3) },
          ]}
        >
          <AppIcon family="MaterialCommunityIcons" name="trophy-award" size={21} color={SECTION_GOLD} />
        </View>
        <View style={styles.headerText}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            accessibilityRole="header"
            style={[styles.title, { color: theme.text.primary }]}
          >
            {title}
          </Text>
          <View style={styles.subtitleRow}>
            <Text allowFontScaling={false} style={[styles.subtitle, { color: theme.text.muted }]}>
              {first != null && last != null ? `${last} – ${first}` : " "}
            </Text>
            {showLegend ? (
              <View style={styles.legend}>
                <View style={[styles.legendDot, { backgroundColor: SECTION_GOLD }]} />
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.subtitle, { color: theme.text.muted }]}
                >
                  {pendingLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <GlassCloseButton size={34} fallbackRadius={11} backgroundColor={theme.between} onPress={onClose} />
      </View>

      {groups.length > 1 ? (
        <View style={styles.rail}>
          {groups.map((group) => (
            <DecadeChip
              key={group.decade}
              decade={group.decade}
              active={group.decade === activeDecade}
              onPress={jumpTo}
              theme={theme}
            />
          ))}
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={32}
        onScroll={onScroll}
        onContentSizeChange={onContentSizeChange}
      >
        {groups.map((group) => (
          <View
            key={group.decade}
            style={styles.decade}
            onLayout={(event) => onDecadeLayout(group.decade, event.nativeEvent.layout.y)}
          >
            <View style={styles.decadeHead}>
              <Text allowFontScaling={false} style={[styles.decadeTitle, { color: theme.text.muted }]}>
                {group.min} – {group.max}
              </Text>
              <View style={[styles.decadeLine, { backgroundColor: theme.border }]} />
            </View>
            {chunkYears(group.years, COLUMNS).map((row) => (
              <View key={row[0]} style={styles.row}>
                {row.map((year) => (
                  <MemoYearCell
                    key={year}
                    year={year}
                    selected={year === selectedYear}
                    pending={pending.has(year)}
                    pendingLabel={pendingLabel}
                    onSelect={onSelect}
                    theme={theme}
                  />
                ))}
                {/* Son satır eksikse boş yer tutucu: hücreler hep aynı genişlikte kalsın. */}
                {Array.from({ length: COLUMNS - row.length }, (_, i) => (
                  <View key={`pad-${i}`} style={styles.pad} />
                ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {string} props.title                 "Oscar Yılı Seçin" vb.
 * @param {number[]} props.years               Yeniden eskiye (bkz. utils/awardYears.buildAwardYears).
 * @param {Set<number>} [props.pendingYears]   Sonucu açıklanmamış yıllar (altın nokta).
 * @param {string} [props.pendingLabel]        "Çok Yakında" — başlık altında açıklama olarak çıkar.
 * @param {number} props.selectedYear
 * @param {(year:number) => void} props.onSelect
 */
function AwardYearSheet({ visible, onClose, title, years, pendingYears, pendingLabel, selectedYear, onSelect }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const groups = useMemo(() => groupYearsByDecade(years), [years]);
  const pending = pendingYears || EMPTY_SET;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={38}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.secondary, borderColor: theme.border, maxHeight: "86%" },
      ]}
    >
      <YearSheetBody
        title={title}
        groups={groups}
        selectedYear={selectedYear}
        pending={pending}
        pendingLabel={pendingLabel}
        onSelect={onSelect}
        onClose={onClose}
        bottomInset={Math.max(insets.bottom + 12, 28)}
      />
    </BottomSheetModal>
  );
}

const EMPTY_SET = new Set();

export default memo(AwardYearSheet);

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 11,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 14 },
  tile: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, flexShrink: 1 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "800", letterSpacing: -0.25 },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 1 },
  subtitle: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  legend: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  rail: { flexDirection: "row", gap: 6, marginBottom: 6 },
  chip: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 12.5 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { paddingTop: 4 },
  decade: { marginTop: 10 },
  decadeHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 9 },
  decadeTitle: { fontSize: 11.5, lineHeight: 15, fontWeight: "800", letterSpacing: 0.4 },
  decadeLine: { flex: 1, height: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", gap: GAP, marginBottom: GAP },
  cell: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { fontSize: 15 },
  // Hücreyle AYNI kenarlık: flex payı dış boyuta göre dağıtıldığından kenarlıksız yer tutucu,
  // son satırdaki hücreleri diğer satırlardan 1 px geniş bırakıyordu.
  pad: { flex: 1, height: 46, borderWidth: 1, borderColor: "transparent" },
  pendingDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});
