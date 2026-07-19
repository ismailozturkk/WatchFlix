// ============================================================
//  components/DatePickerModal.js
//  Drum-picker tabanlı tarih seçici bottom sheet.
//  Watchify tema sistemiyle uyumlu, izleme listesine ekleme
//  sırasında tarih seçimi için kullanılır.
//
//  Kullanım:
//    <DatePickerModal
//      visible={show}
//      value="2024-01-15"   // YYYY-MM-DD veya ""
//      onConfirm={(iso) => ...}
//      onClose={() => setShow(false)}
//      title="İzleme Tarihi"
//      subtitle="Bu filmi ne zaman izlediniz?"
//      confirmLabel="Tarihi Onayla"
//      minDate={new Date("2020-01-01")}
//      maxDate={new Date()}
//    />
// ============================================================

import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { alpha } from "@theme/colors";
import { i18nText } from "@utils/i18nText";


const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_H = 48;
const VISIBLE_COUNT = 5;
const PAD_COUNT = Math.floor(VISIBLE_COUNT / 2); // 2

export const DAYS_LIST = Array.from({ length: 31 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);

export const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const currentYear = new Date().getFullYear();
export const YEARS_LIST = Array.from({ length: 150 }, (_, i) =>
  String(currentYear - i),
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verilen ay ve yıl için o aydaki maksimum gün sayısını hesapla */
function daysInMonth(month, year) {
  // month: 0-indexed (0 = Ocak)
  return new Date(year, month + 1, 0).getDate();
}

export function isoToIndices(iso) {
  if (!iso || !iso.includes("-")) {
    return { day: 0, month: 0, year: 0 }; // Bugün → ilk yıl (currentYear)
  }
  const [y, m, d] = iso.split("-");
  const dayIdx = Math.max(0, parseInt(d, 10) - 1);
  const monthIdx = Math.max(0, parseInt(m, 10) - 1);
  const yearIdx = Math.max(0, YEARS_LIST.indexOf(y));
  return {
    day: Math.min(dayIdx, DAYS_LIST.length - 1),
    month: Math.min(monthIdx, 11),
    year: yearIdx >= 0 ? yearIdx : 0,
  };
}

export function indicesToIso(day, month, year) {
  const y = YEARS_LIST[year] ?? YEARS_LIST[0];
  const maxDay = daysInMonth(month, parseInt(y, 10));
  const clampedDay = Math.min(day + 1, maxDay);
  const d = String(clampedDay).padStart(2, "0");
  const m = String(month + 1).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function normalizeDate(d) {
  if (!d) return null;
  if (typeof d === "string") {
    const iso = d.split("T")[0];
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return null;
    const [, year, month, day] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      parsed.getFullYear() !== Number(year) ||
      parsed.getMonth() !== Number(month) - 1 ||
      parsed.getDate() !== Number(day)
    ) return null;
    return iso;
  }
  // Date objesi ise lokal tarihi ISO'ya çevir (timezone kaymasını önlemek için)
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split("T")[0];
}

// ─── DrumColumn ───────────────────────────────────────────────────────────────

function DrumColumn({
  items,
  selectedIndex,
  onSelect,
  getIsInvalid,
  colWidth = 80,
}) {
  const { theme } = useTheme();
  const scrollRef = useRef(null);
  const pendingMomentum = useRef(false);

  const paddedItems = [
    ...Array(PAD_COUNT).fill(""),
    ...items,
    ...Array(PAD_COUNT).fill(""),
  ];

  const scrollTo = (realIndex, animated) => {
    scrollRef.current?.scrollTo({ y: realIndex * ITEM_H, animated });
  };

  const applyOffset = (offsetY) => {
    const raw = Math.round(offsetY / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, raw));
    
    if (getIsInvalid && getIsInvalid(clamped)) {
      // It's invalid, but let the parent component's useEffect handle snapping back
      // so the UI has a nice bounce-back effect to the min/max date.
    }
    
    scrollTo(clamped, true);
    onSelect(clamped);
  };

  const isFirstRender = useRef(true);

  // Çok önemli: değer dışarıdan değişirse scroll konumunu güncelle
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollTo(selectedIndex, !isFirstRender.current);
      isFirstRender.current = false;
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  return (
    <View style={{ width: colWidth, height: ITEM_H * VISIBLE_COUNT, overflow: "hidden" }}>
      {/* Selected row highlight */}
      <View
        pointerEvents="none"
        style={[
          drumStyles.highlight,
          {
            top: ITEM_H * PAD_COUNT,
            backgroundColor: theme.accent + "18",
            borderColor: theme.accent + "55",
          },
        ]}
      />
      {/* Fade top */}
      <LinearGradient
        colors={[theme.between, theme.between + "00"]}
        style={[drumStyles.fade, { top: 0, height: ITEM_H * PAD_COUNT }]}
        pointerEvents="none"
      />
      {/* Fade bottom */}
      <LinearGradient
        colors={[theme.between + "00", theme.between]}
        style={[drumStyles.fade, { bottom: 0, height: ITEM_H * PAD_COUNT }]}
        pointerEvents="none"
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        bounces={false}
        onLayout={() => scrollTo(selectedIndex, false)}
        onScrollBeginDrag={() => { pendingMomentum.current = false; }}
        onScrollEndDrag={(e) => {
          setTimeout(() => {
            if (!pendingMomentum.current) applyOffset(e.nativeEvent.contentOffset.y);
          }, 50);
        }}
        onMomentumScrollBegin={() => { pendingMomentum.current = true; }}
        onMomentumScrollEnd={(e) => {
          pendingMomentum.current = false;
          applyOffset(e.nativeEvent.contentOffset.y);
        }}
      >
        {paddedItems.map((item, i) => {
          const realIndex = i - PAD_COUNT;
          const isSelected = realIndex === selectedIndex;
          const isInvalid = realIndex >= 0 && realIndex < items.length && getIsInvalid && getIsInvalid(realIndex);
          
          return (
            <TouchableOpacity
              key={`${item}-${i}`}
              onPress={() => {
                if (realIndex >= 0 && realIndex < items.length && !isInvalid) {
                  scrollTo(realIndex, true);
                  onSelect(realIndex);
                }
              }}
              activeOpacity={isInvalid ? 1 : 0.7}
              style={drumStyles.itemWrap}
            >
              <Text
                style={[
                  drumStyles.itemText,
                  {
                    fontSize: isSelected ? 17 : 14,
                    fontWeight: isSelected ? "700" : "400",
                    color: isInvalid ? (theme.colors?.red || "#FF3232") : (isSelected ? theme.text.primary : theme.text.muted),
                    letterSpacing: isSelected ? -0.3 : 0,
                  },
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const drumStyles = StyleSheet.create({
  highlight: {
    position: "absolute",
    left: 4,
    right: 4,
    height: ITEM_H,
    borderRadius: 12,
    borderWidth: 1.5,
    zIndex: 1,
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 2,
  },
  itemWrap: {
    height: ITEM_H,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {},
});

// ─── DatePickerModal ──────────────────────────────────────────────────────────

export default function DatePickerModal({
  visible,
  value = "",        // "YYYY-MM-DD" veya ""
  onConfirm,
  onClose,
  title = i18nText("autoI18n.izleme_tarihi", "İzleme Tarihi"),
  subtitle,
  confirmLabel = "Tarihi Onayla",
  minDate,           // optional Date object veya ISO string
  maxDate,           // optional Date object veya ISO string
  minDateErrorMsg = i18nText("autoI18n.yayin_tarihinden_oncesi_secilemez", "Yayın tarihinden öncesi seçilemez"),
  maxDateErrorMsg = i18nText("autoI18n.gelecek_bir_tarih_secilemez", "Gelecek bir tarih seçilemez"),
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const init = isoToIndices(value);
  const [dayIdx, setDayIdx] = React.useState(init.day);
  const [monthIdx, setMonthIdx] = React.useState(init.month);
  const [yearIdx, setYearIdx] = React.useState(init.year);

  const minIso = normalizeDate(minDate);
  const maxIso = normalizeDate(maxDate);

  // Dışarıdan value değişirse senkronize et
  useEffect(() => {
    const parsed = isoToIndices(value);
    setDayIdx(parsed.day);
    setMonthIdx(parsed.month);
    setYearIdx(parsed.year);
  }, [value]);

  // Sınırları ve gün sayısını kontrol edip otomatik düzeltme (Snap Back)
  useEffect(() => {
    let newDay = dayIdx;
    let newMonth = monthIdx;
    let newYear = yearIdx;
    let changed = false;

    const y = parseInt(YEARS_LIST[newYear], 10);
    const maxDays = daysInMonth(newMonth, y);
    if (newDay >= maxDays) {
      newDay = maxDays - 1;
      changed = true;
    }

    const currentIso = indicesToIso(newDay, newMonth, newYear);
    
    if (minIso && currentIso < minIso) {
      const minInd = isoToIndices(minIso);
      newDay = minInd.day;
      newMonth = minInd.month;
      newYear = minInd.year;
      changed = true;
    } else if (maxIso && currentIso > maxIso) {
      const maxInd = isoToIndices(maxIso);
      newDay = maxInd.day;
      newMonth = maxInd.month;
      newYear = maxInd.year;
      changed = true;
    }

    if (changed) {
      setDayIdx(newDay);
      setMonthIdx(newMonth);
      setYearIdx(newYear);
    }
  }, [dayIdx, monthIdx, yearIdx, minIso, maxIso]);

  // Slide animasyonu
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 70,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 240,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Dinamik gün listesi (seçili ay/yıla göre)
  const selectedYear = parseInt(YEARS_LIST[yearIdx], 10);
  const maxDaysInMonth = daysInMonth(monthIdx, selectedYear);
  const dynamicDays = Array.from({ length: maxDaysInMonth }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );

  const previewDay = dynamicDays[dayIdx] || dynamicDays[dynamicDays.length - 1];
  const previewMonth = (language === "tr" ? MONTHS_TR : MONTHS_EN)[monthIdx];
  const previewYear = YEARS_LIST[yearIdx];

  const handleConfirm = () => {
    if (!isValid) return;
    const iso = indicesToIso(dayIdx, monthIdx, yearIdx);
    onConfirm?.(iso);
  };

  // ─── Doğrulama (Validation) ─────────────────────────────────────────────────
  const selectedIso = indicesToIso(dayIdx, monthIdx, yearIdx);
  let isValid = true;
  let errorMsg = "";

  if (minIso && selectedIso < minIso) {
    isValid = false;
    errorMsg = minDateErrorMsg;
  } else if (maxIso && selectedIso > maxIso) {
    isValid = false;
    errorMsg = maxDateErrorMsg;
  }

  // Renk kodlaması için yardımcı
  const isInvalidDate = (d, m, y) => {
    const iso = indicesToIso(d, m, y);
    return (minIso && iso < minIso) || (maxIso && iso > maxIso);
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            paddingBottom: Platform.OS === "ios" ? 34 : 24,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text
            allowFontScaling={false}
            style={[styles.title, { color: theme.text.primary }]}
          >
            {title}
          </Text>
          <View style={[styles.previewPill, { backgroundColor: theme.accent + "15", borderColor: theme.accent + "40" }]}>
            <Text
              allowFontScaling={false}
              style={[styles.previewText, { color: theme.accent }]}
            >
              {previewDay} {previewMonth} {previewYear}
            </Text>
          </View>
        </View>

        {subtitle && !errorMsg && (
          <Text
            allowFontScaling={false}
            style={[styles.subtitle, { color: theme.text.muted }]}
          >
            {subtitle}
          </Text>
        )}
        
        {errorMsg ? (
          <Text
            allowFontScaling={false}
            style={[styles.subtitle, { color: theme.colors?.red || "#FF3232", fontWeight: "600" }]}
          >
            {errorMsg}
          </Text>
        ) : null}

        {/* Drum picker container */}
        <View
          style={[
            styles.pickerContainer,
            {
              backgroundColor: theme.between,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Center separator lines */}
          {[ITEM_H * 2 + 8, ITEM_H * 3 + 8].map((top) => (
            <View
              key={top}
              pointerEvents="none"
              style={[
                styles.centerLine,
                { top, backgroundColor: theme.border + "80" },
              ]}
            />
          ))}

          <View style={styles.columnsRow}>
            <DrumColumn
              items={dynamicDays}
              selectedIndex={dayIdx}
              onSelect={setDayIdx}
              getIsInvalid={(i) => isInvalidDate(i, monthIdx, yearIdx)}
              colWidth={72}
            />
            <DrumColumn
              items={MONTHS_TR}
              selectedIndex={monthIdx}
              onSelect={setMonthIdx}
              getIsInvalid={(i) => isInvalidDate(dayIdx, i, yearIdx)}
              colWidth={148}
            />
            <DrumColumn
              items={YEARS_LIST}
              selectedIndex={yearIdx}
              onSelect={setYearIdx}
              getIsInvalid={(i) => isInvalidDate(dayIdx, monthIdx, i)}
              colWidth={88}
            />
          </View>
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          onPress={handleConfirm}
          activeOpacity={0.85}
          style={styles.confirmBtn}
          disabled={!isValid}
        >
          <View
            style={[
              styles.confirmBtnInner,
              { backgroundColor: isValid ? theme.accent : theme.border },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.confirmBtnText,
                { color: isValid ? "#FFF" : theme.text.muted },
              ]}
            >
              {isValid ? confirmLabel : i18nText("autoI18n.gecersiz_tarih", "Geçersiz Tarih")}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handleRow: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  previewPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  previewText: {
    fontSize: 13,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  pickerContainer: {
    borderRadius: 20,
    borderWidth: 1.5,
    marginHorizontal: 16,
    padding: 8,
    overflow: "hidden",
  },
  centerLine: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 1,
    zIndex: 3,
  },
  columnsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  confirmBtn: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  confirmBtnInner: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    overflow: "hidden",
  },
  confirmBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
