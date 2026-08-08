// ============================================================
//  components/modals/DatePickerModal.js
//  Drum (wheel) tabanlı tarih seçici bottom sheet.
//  Seelogd tema sistemiyle uyumlu; izleme tarihi, hatırlatıcı
//  tarihi gibi tüm tarih seçimlerinde ortak kullanılır.
//
//  Kullanım:
//    <DatePickerModal
//      visible={show}
//      value="2024-01-15"          // YYYY-MM-DD veya ""
//      onConfirm={(iso) => ...}
//      onClose={() => setShow(false)}
//      title="İzleme Tarihi"
//      subtitle="Bu filmi ne zaman izlediniz?"
//      confirmLabel="Tarihi Onayla"
//      minDate={new Date("2020-01-01")}   // Date | ISO string | undefined
//      maxDate={new Date()}
//    />
//
//  Tasarım notları:
//   • Üç sütunun görsel hareketi native-driver scroll değerinden beslenir.
//     JS yalnız merkez satır değiştiğinde (her pikselde değil) ISO seçimini ve
//     önizlemeyi günceller; kullanıcı bırakmayı beklemek zorunda kalmaz.
//   • Yıl listesi min/max sınırlarından türetilir. Sınır yoksa
//     bugünden 100 yıl geri, 10 yıl ileri açılır — hatırlatıcılar
//     gelecek yıla da kurulabilsin diye.
//   • Sınır dışına taşan seçim en yakın geçerli tarihe çekilir ve
//     kısa süreli bir uyarı satırı gösterilir; onay butonu asla
//     "ölü" durumda kalmaz.
// ============================================================

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { alpha } from "@theme/colors";
import { i18nText } from "@utils/i18nText";
import { buildEnabledOptions } from "@utils/datePickerWheel";
import { selectionAsync } from "@services/hapticsService";
import { deviceTier } from "@services/deviceTier";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_H = 44;
const VISIBLE_COUNT = 5;
const PAD_COUNT = Math.floor(VISIBLE_COUNT / 2); // 2
const WHEEL_H = ITEM_H * VISIBLE_COUNT;
const WHEEL_PAD = 8;
const COLUMN_LABEL_H = 20;
// Hızlı kaydırmada her satır için titreşim tetiklemek cihazı boğar.
const HAPTIC_MIN_GAP_MS = 45;
const getWheelItemLayout = (_, index) => ({
  length: ITEM_H,
  offset: ITEM_H * index,
  index,
});

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

const WEEKDAYS_TR = [
  "Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi",
];

const WEEKDAYS_EN = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const currentYear = new Date().getFullYear();
export const YEARS_LIST = Array.from({ length: 150 }, (_, i) =>
  String(currentYear - i),
);

// Sınır verilmediğinde açılacak varsayılan yıl penceresi.
const YEARS_BACK = 100;
const YEARS_FORWARD = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pad2 = (n) => String(n).padStart(2, "0");

/** Verilen ay ve yıl için o aydaki maksimum gün sayısını hesapla */
function daysInMonth(month, year) {
  // month: 0-indexed (0 = Ocak)
  return new Date(year, month + 1, 0).getDate();
}

/** {y, m(0-11), d(1-31)} → "YYYY-MM-DD" */
const partsToIso = ({ y, m, d }) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

/** "YYYY-MM-DD" → {y, m(0-11), d(1-31)} */
const isoToParts = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
};

/**
 * Geriye dönük uyumluluk: modül seviyesindeki YEARS_LIST üzerinden index üretir.
 * Bileşen artık sınırlardan türetilen kendi yıl listesini kullanıyor.
 */
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

const todayIso = () => normalizeDate(new Date());

/** ISO tarihe gün ekleyip çıkarır ("2024-01-31", 1 → "2024-02-01") */
const shiftIso = (iso, deltaDays) => {
  const { y, m, d } = isoToParts(iso);
  return normalizeDate(new Date(y, m, d + deltaDays));
};

/**
 * Sütunda gösterilecek yıl aralığı. Sınır varsa tam olarak ona uyar; yoksa
 * bugünün etrafında geriye ve ileriye makul bir pencere açar. Eski sürüm
 * yalnızca geçmiş yılları listelediği için hatırlatıcılar bu yılın sonundan
 * öteye kurulamıyordu.
 */
function buildYears(minIso, maxIso) {
  const now = new Date().getFullYear();
  let lo = minIso ? Number(minIso.slice(0, 4)) : null;
  let hi = maxIso ? Number(maxIso.slice(0, 4)) : null;

  if (lo === null && hi === null) {
    lo = now - YEARS_BACK;
    hi = now + YEARS_FORWARD;
  } else if (lo === null) {
    lo = Math.min(hi, now) - YEARS_BACK;
  } else if (hi === null) {
    hi = Math.max(lo, now) + YEARS_FORWARD;
  }
  if (hi < lo) hi = lo;

  const out = [];
  for (let y = lo; y <= hi; y += 1) out.push(y);
  return out;
}

// ─── WheelRow ─────────────────────────────────────────────────────────────────
//  Tek satır. Tüm görsel durumu (derinlik, opaklık, seçili renk) ortak scroll
//  değerinden türer; bu yüzden kaydırma boyunca hiç yeniden render olmaz.

const WheelRow = memo(function WheelRow({
  label,
  index,
  scrollY,
  disabled,
  onPress,
  baseColor,
  activeColor,
  disabledColor,
  flat,
}) {
  // `index` veri listesindeki gerçek indekstir. ScrollView başındaki görsel
  // padding satırları bu değere dahil edilmez; aksi halde bir satıra dokunmak
  // iki sıra aşağıdaki tarihi seçiyordu.
  const center = index * ITEM_H;
  const range = [
    center - 2 * ITEM_H,
    center - ITEM_H,
    center,
    center + ITEM_H,
    center + 2 * ITEM_H,
  ];

  const opacity = scrollY.interpolate({
    inputRange: range,
    outputRange: [0.2, 0.5, 1, 0.5, 0.2],
    extrapolate: "clamp",
  });
  const scale = scrollY.interpolate({
    inputRange: range,
    outputRange: [0.74, 0.88, 1, 0.88, 0.74],
    extrapolate: "clamp",
  });
  const rotateX = scrollY.interpolate({
    inputRange: range,
    outputRange: ["56deg", "29deg", "0deg", "-29deg", "-56deg"],
    extrapolate: "clamp",
  });
  const activeOpacity = scrollY.interpolate({
    inputRange: [center - ITEM_H, center, center + ITEM_H],
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });

  const transform = flat
    ? [{ scale }]
    : [{ perspective: 620 }, { rotateX }, { scale }];

  const handlePress = useCallback(() => onPress(index), [index, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={wheelStyles.hit}
    >
      <Animated.View style={[wheelStyles.rowInner, { opacity, transform }]}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            wheelStyles.text,
            { color: disabled ? disabledColor : baseColor },
          ]}
        >
          {label}
        </Text>
        <Animated.Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            wheelStyles.text,
            wheelStyles.textActive,
            {
              color: disabled ? disabledColor : activeColor,
              opacity: activeOpacity,
            },
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
});

// ─── WheelColumn ──────────────────────────────────────────────────────────────

const WheelColumn = memo(function WheelColumn({
  items,
  disabledFlags,
  selectedIndex,
  onSelect,
  flexBasis,
  baseColor,
  activeColor,
  disabledColor,
  flat,
  accessibilityLabel,
}) {
  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(selectedIndex * ITEM_H)).current;
  const committed = useRef(selectedIndex);
  const lastTick = useRef(selectedIndex);
  const lastHaptic = useRef(0);
  const momentum = useRef(false);
  const dragEndTimer = useRef(null);
  const programmaticTimer = useRef(null);
  const liveFrame = useRef(null);
  const pendingLiveIndex = useRef(null);
  const programmaticScroll = useRef(false);
  const didLayout = useRef(false);
  const initialContentOffset = useRef({
    x: 0,
    y: selectedIndex * ITEM_H,
  }).current;
  const lenRef = useRef(items.length);
  const disabledRef = useRef(disabledFlags);
  const onSelectRef = useRef(onSelect);

  lenRef.current = items.length;
  disabledRef.current = disabledFlags;
  onSelectRef.current = onSelect;

  const clearPendingLive = useCallback(() => {
    if (liveFrame.current !== null) {
      cancelAnimationFrame(liveFrame.current);
      liveFrame.current = null;
    }
    pendingLiveIndex.current = null;
  }, []);

  const scrollToIndex = useCallback((idx, animated) => {
    clearPendingLive();
    if (programmaticTimer.current) clearTimeout(programmaticTimer.current);
    programmaticScroll.current = true;
    scrollRef.current?.scrollToOffset({
      offset: idx * ITEM_H,
      animated,
    });
    // `scrollToOffset` kullanıcı kaydırmasıyla aynı onScroll yolunu üretir.
    // Kısa süre işaretleyerek canlı seçim dinleyicisinin bu düzeltmeyi yeni bir
    // kullanıcı seçimi sanmasını engelliyoruz.
    programmaticTimer.current = setTimeout(() => {
      programmaticScroll.current = false;
      programmaticTimer.current = null;
    }, animated ? 700 : 32);
  }, [clearPendingLive]);

  const commitLiveIndex = useCallback((idx) => {
    if (idx < 0 || idx >= lenRef.current) return;
    if (disabledRef.current?.[idx]) return;
    pendingLiveIndex.current = idx;
    if (liveFrame.current !== null) return;
    liveFrame.current = requestAnimationFrame(() => {
      liveFrame.current = null;
      const next = pendingLiveIndex.current;
      pendingLiveIndex.current = null;
      if (programmaticScroll.current || next === null) return;
      if (next === committed.current) return;
      committed.current = next;
      onSelectRef.current?.(next);
    });
  }, []);

  // Native driver ile beslenen scroll değeri + yalnız merkez satır değiştiğinde
  // canlı seçimi/haptic'i çalıştıran hafif JS dinleyicisi.
  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (event) => {
          const y = event.nativeEvent.contentOffset.y;
          const idx = Math.round(y / ITEM_H);
          if (idx === lastTick.current) return;
          if (idx < 0 || idx >= lenRef.current) return;
          lastTick.current = idx;
          if (!programmaticScroll.current) commitLiveIndex(idx);
          if (programmaticScroll.current) return;
          const now = Date.now();
          if (now - lastHaptic.current < HAPTIC_MIN_GAP_MS) return;
          lastHaptic.current = now;
          selectionAsync().catch(() => {});
        },
      }),
    [commitLiveIndex, scrollY],
  );

  // Kaydırma durduğunda seçimi kesinleştir. snapToInterval sayesinde offset
  // zaten hizalı geldiği için ek bir scrollTo çağrısı (ve titreme) yapılmaz.
  const settle = useCallback((offsetY) => {
    // Hızlı momentumda son onScroll RAF'i, momentum-end olayından sonra
    // çalışıp seçimi bir önceki satıra geri alabiliyordu. Son fiziksel offset
    // tek otoritedir; kuyruktaki canlı seçim önce iptal edilir.
    clearPendingLive();
    const len = lenRef.current;
    if (!len) return;
    const idx = Math.max(0, Math.min(len - 1, Math.round(offsetY / ITEM_H)));
    if (Math.abs(offsetY - idx * ITEM_H) > 0.5) {
      scrollToIndex(idx, true);
    }
    const changed = committed.current !== idx;
    committed.current = idx;
    lastTick.current = idx;
    if (changed) onSelectRef.current?.(idx);
  }, [clearPendingLive, scrollToIndex]);

  const handlePress = useCallback((idx) => {
    if (idx < 0 || idx >= lenRef.current) return;
    if (idx === committed.current) return;
    committed.current = idx;
    lastTick.current = idx;
    scrollToIndex(idx, true);
    onSelectRef.current?.(idx);
    selectionAsync().catch(() => {});
  }, [scrollToIndex]);

  useEffect(
    () => () => {
      if (dragEndTimer.current) clearTimeout(dragEndTimer.current);
      if (programmaticTimer.current) clearTimeout(programmaticTimer.current);
      clearPendingLive();
    },
    [clearPendingLive],
  );

  // Dışarıdan gelen düzeltmeler (sınır clamp'i, ay kısalınca gün düşmesi…)
  useEffect(() => {
    if (selectedIndex === committed.current) return;
    committed.current = selectedIndex;
    lastTick.current = selectedIndex;
    scrollToIndex(selectedIndex, didLayout.current);
  }, [selectedIndex, scrollToIndex]);

  const data = useMemo(
    () => [
      ...Array(PAD_COUNT).fill(null),
      ...items,
      ...Array(PAD_COUNT).fill(null),
    ],
    [items],
  );

  const renderRow = useCallback(
    ({ item: label, index: i }) =>
      label === null ? (
        <View style={wheelStyles.hit} />
      ) : (
        <WheelRow
          label={String(label)}
          index={i - PAD_COUNT}
          scrollY={scrollY}
          disabled={!!disabledFlags?.[i - PAD_COUNT]}
          onPress={handlePress}
          baseColor={baseColor}
          activeColor={activeColor}
          disabledColor={disabledColor}
          flat={flat}
        />
      ),
    [
      activeColor,
      baseColor,
      disabledColor,
      disabledFlags,
      flat,
      handlePress,
      scrollY,
    ],
  );

  return (
    <View
      style={{ flex: flexBasis, height: WHEEL_H }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.FlatList
        ref={scrollRef}
        data={data}
        renderItem={renderRow}
        keyExtractor={(_, index) => String(index)}
        getItemLayout={getWheelItemLayout}
        initialNumToRender={9}
        maxToRenderPerBatch={12}
        windowSize={5}
        contentOffset={initialContentOffset}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onLayout={() => {
          scrollToIndex(committed.current, false);
          didLayout.current = true;
        }}
        onScrollBeginDrag={() => {
          clearPendingLive();
          if (dragEndTimer.current) clearTimeout(dragEndTimer.current);
          if (programmaticTimer.current) {
            clearTimeout(programmaticTimer.current);
            programmaticTimer.current = null;
          }
          // Kullanıcı devam eden bir otomatik hizalamayı parmağıyla devraldı.
          programmaticScroll.current = false;
          momentum.current = false;
        }}
        onScrollEndDrag={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          // Parmak kalkınca momentum başlayabilir; başlamazsa burada oturt.
          if (dragEndTimer.current) clearTimeout(dragEndTimer.current);
          dragEndTimer.current = setTimeout(() => {
            dragEndTimer.current = null;
            if (!momentum.current) settle(y);
          }, 60);
        }}
        onMomentumScrollBegin={() => {
          if (dragEndTimer.current) {
            clearTimeout(dragEndTimer.current);
            dragEndTimer.current = null;
          }
          momentum.current = true;
        }}
        onMomentumScrollEnd={(e) => {
          if (dragEndTimer.current) {
            clearTimeout(dragEndTimer.current);
            dragEndTimer.current = null;
          }
          if (programmaticTimer.current) {
            clearTimeout(programmaticTimer.current);
            programmaticTimer.current = null;
          }
          programmaticScroll.current = false;
          momentum.current = false;
          settle(e.nativeEvent.contentOffset.y);
        }}
      />
    </View>
  );
});

const wheelStyles = StyleSheet.create({
  hit: { height: ITEM_H, width: "100%" },
  rowInner: { flex: 1 },
  text: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: ITEM_H,
    letterSpacing: -0.2,
    textAlign: "center",
    textAlignVertical: "center",
  },
  textActive: { fontWeight: "800" },
});

// ─── DatePickerModal ──────────────────────────────────────────────────────────

export default function DatePickerModal({
  visible,
  value = "",        // "YYYY-MM-DD" veya ""
  onConfirm,
  onClose,
  title = i18nText("autoI18n.izleme_tarihi", "İzleme Tarihi"),
  subtitle,
  confirmLabel = i18nText("autoI18n.tarihi_onayla", "Tarihi Onayla"),
  minDate,           // optional Date object veya ISO string
  maxDate,           // optional Date object veya ISO string
  minDateErrorMsg = i18nText("autoI18n.yayin_tarihinden_oncesi_secilemez", "Yayın tarihinden öncesi seçilemez"),
  maxDateErrorMsg = i18nText("autoI18n.gelecek_bir_tarih_secilemez", "Gelecek bir tarih seçilemez"),
  quickActions = true,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const isEn = language === "en";

  const minIso = normalizeDate(minDate);
  const maxIso = normalizeDate(maxDate);

  const months = isEn ? MONTHS_EN : MONTHS_TR;
  const weekdays = isEn ? WEEKDAYS_EN : WEEKDAYS_TR;
  const years = useMemo(() => buildYears(minIso, maxIso), [minIso, maxIso]);

  // Sınırlar dışına taşan her seçimi en yakın geçerli tarihe çeker.
  const clamp = useCallback(
    (input) => {
      const yLo = years[0];
      const yHi = years[years.length - 1];
      const y = Math.min(Math.max(input.y, yLo), yHi);
      const m = Math.min(Math.max(input.m, 0), 11);
      const d = Math.min(Math.max(input.d, 1), daysInMonth(m, y));

      let iso = partsToIso({ y, m, d });
      let hint = null;
      if (minIso && iso < minIso) {
        iso = minIso;
        hint = "min";
      }
      if (maxIso && iso > maxIso) {
        iso = maxIso;
        if (!hint) hint = "max";
      }

      // Sonuç her zaman sütunlarda gösterilebilen bir tarih olmalı; aksi halde
      // (ör. minDate > maxDate gibi bozuk aralıklarda) çark ile seçili değer
      // birbirinden ayrışır.
      const out = isoToParts(iso);
      out.y = Math.min(Math.max(out.y, yLo), yHi);
      out.d = Math.min(out.d, daysInMonth(out.m, out.y));
      return { parts: out, hint };
    },
    [years, minIso, maxIso],
  );

  const initialParts = () =>
    clamp(isoToParts(normalizeDate(value) || todayIso())).parts;

  const [parts, setParts] = useState(initialParts);
  const partsRef = useRef(parts);
  const [hint, setHint] = useState(null);
  const hintTimer = useRef(null);
  const lastConfirmAt = useRef(0);

  const showHint = useCallback((kind) => {
    setHint(kind);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 2600);
  }, []);

  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const apply = useCallback(
    (patch) => {
      const result = clamp({ ...partsRef.current, ...patch });
      partsRef.current = result.parts;
      setParts(result.parts);
      if (result.hint) showHint(result.hint);
    },
    [clamp, showHint],
  );

  // Dışarıdan value / sınır değişirse senkronize et.
  useEffect(() => {
    const next = clamp(isoToParts(normalizeDate(value) || todayIso())).parts;
    partsRef.current = next;
    setParts(next);
    setHint(null);
  }, [value, clamp]);

  // ─── Sütun verileri ────────────────────────────────────────────────────────

  const dayCount = daysInMonth(parts.m, parts.y);
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => pad2(i + 1)),
    [dayCount],
  );

  const dayIndex = Math.min(parts.d - 1, days.length - 1);
  const monthIndex = parts.m;
  const yearIndex = Math.max(0, years.indexOf(parts.y));

  // Bir gün geçersizdir; bir ay/yıl ise ancak TAMAMI aralık dışındaysa geçersiz
  // sayılır. Eski sürüm seçili günü sabit tutarak kontrol ettiği için ayın
  // tamamını yanlışlıkla kırmızıya boyayabiliyordu.
  const dayDisabled = useMemo(
    () =>
      days.map((_, i) => {
        const iso = partsToIso({ y: parts.y, m: parts.m, d: i + 1 });
        return !!((minIso && iso < minIso) || (maxIso && iso > maxIso));
      }),
    [days, parts.y, parts.m, minIso, maxIso],
  );

  const monthDisabled = useMemo(
    () =>
      months.map((_, m) => {
        const first = partsToIso({ y: parts.y, m, d: 1 });
        const last = partsToIso({ y: parts.y, m, d: daysInMonth(m, parts.y) });
        return !!((minIso && last < minIso) || (maxIso && first > maxIso));
      }),
    [months, parts.y, minIso, maxIso],
  );

  const yearDisabled = useMemo(
    () =>
      years.map(
        (y) =>
          !!((minIso && `${y}-12-31` < minIso) ||
            (maxIso && `${y}-01-01` > maxIso)),
      ),
    [years, minIso, maxIso],
  );

  const yearLabels = useMemo(() => years.map(String), [years]);

  // Geçersiz tarihler yalnız pasif çizilmez; FlatList verisinden çıkarıldığı
  // için momentum o satırı merkeze getiremez. sourceIndex gerçek gün/ay/yıl
  // değerine dönüşü korur.
  const dayOptions = useMemo(
    () => buildEnabledOptions(days, dayDisabled, 0),
    [days, dayDisabled],
  );
  const monthOptions = useMemo(
    () => buildEnabledOptions(months, monthDisabled, 0),
    [months, monthDisabled],
  );
  const yearOptions = useMemo(
    () => buildEnabledOptions(yearLabels, yearDisabled, 0),
    [yearLabels, yearDisabled],
  );
  const dayWheelItems = useMemo(
    () => dayOptions.map((item) => item.label),
    [dayOptions],
  );
  const monthWheelItems = useMemo(
    () => monthOptions.map((item) => item.label),
    [monthOptions],
  );
  const yearWheelItems = useMemo(
    () => yearOptions.map((item) => item.label),
    [yearOptions],
  );

  const dayWheelIndex = Math.max(
    0,
    dayOptions.findIndex((item) => item.sourceIndex === dayIndex),
  );
  const monthWheelIndex = Math.max(
    0,
    monthOptions.findIndex((item) => item.sourceIndex === monthIndex),
  );
  const yearWheelIndex = Math.max(
    0,
    yearOptions.findIndex((item) => item.sourceIndex === yearIndex),
  );

  const onSelectDay = useCallback(
    (i) => {
      const sourceIndex = dayOptions[i]?.sourceIndex;
      if (sourceIndex !== undefined) apply({ d: sourceIndex + 1 });
    },
    [apply, dayOptions],
  );
  const onSelectMonth = useCallback(
    (i) => {
      const sourceIndex = monthOptions[i]?.sourceIndex;
      if (sourceIndex !== undefined) apply({ m: sourceIndex });
    },
    [apply, monthOptions],
  );
  const onSelectYear = useCallback(
    (i) => {
      const sourceIndex = yearOptions[i]?.sourceIndex;
      const year = years[sourceIndex];
      if (year !== undefined) apply({ y: year });
    },
    [apply, yearOptions, years],
  );

  // ─── Hızlı seçimler ────────────────────────────────────────────────────────

  const selectedIso = partsToIso(parts);

  const quickItems = useMemo(() => {
    if (!quickActions) return [];
    const t = todayIso();
    return [
      { key: "yesterday", label: i18nText("autoI18n.dun", "Dün"), iso: shiftIso(t, -1) },
      { key: "today", label: i18nText("autoI18n.bugun", "Bugün"), iso: t },
      { key: "tomorrow", label: i18nText("autoI18n.yarin", "Yarın"), iso: shiftIso(t, 1) },
    ].filter(
      (item) =>
        item.iso &&
        (!minIso || item.iso >= minIso) &&
        (!maxIso || item.iso <= maxIso),
    );
  }, [quickActions, minIso, maxIso, language]);

  const pickQuick = useCallback(
    (iso) => {
      selectionAsync().catch(() => {});
      apply(isoToParts(iso));
    },
    [apply],
  );

  const canPickPrevious = !minIso || selectedIso > minIso;
  const canPickNext = !maxIso || selectedIso < maxIso;
  const pickAdjacent = useCallback(
    (delta) => {
      const next = shiftIso(partsToIso(partsRef.current), delta);
      if (!next) return;
      if ((minIso && next < minIso) || (maxIso && next > maxIso)) return;
      selectionAsync().catch(() => {});
      apply(isoToParts(next));
    },
    [apply, minIso, maxIso],
  );

  // ─── Hareket tercihleri ────────────────────────────────────────────────────

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (alive) setReduceMotion(!!enabled);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (enabled) => setReduceMotion(!!enabled),
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  // Düşük katman cihazlarda 3B çevirme kapalı: aynı his, daha ucuz transform.
  const flatWheel = reduceMotion || deviceTier === "low";
  const previewScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      previewScale.setValue(1);
      return undefined;
    }
    previewScale.stopAnimation();
    previewScale.setValue(0.985);
    const animation = Animated.spring(previewScale, {
      toValue: 1,
      damping: 16,
      stiffness: 260,
      mass: 0.45,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [selectedIso, reduceMotion, previewScale]);

  // ─── Açılış / kapanış animasyonu ───────────────────────────────────────────

  const [rendered, setRendered] = useState(visible);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      if (reduceMotion) {
        Animated.timing(anim, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.spring(anim, {
          toValue: 1,
          friction: 11,
          tension: 72,
          useNativeDriver: true,
        }).start();
      }
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: reduceMotion ? 120 : 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRendered(false);
    });
  }, [visible, reduceMotion, anim]);

  // Sabit mesafe: ölçülen yükseklik animasyon sırasında değişirse native
  // interpolasyon düğümü yeniden kurulur ve panel zıplar.
  const translateY = useMemo(
    () =>
      anim.interpolate({
        inputRange: [0, 1],
        outputRange: [SCREEN_HEIGHT * 0.9, 0],
      }),
    [anim],
  );

  // ─── Önizleme ──────────────────────────────────────────────────────────────

  const previewDate = new Date(parts.y, parts.m, parts.d);
  const previewText = isEn
    ? `${months[parts.m]} ${parts.d}, ${parts.y}`
    : `${parts.d} ${months[parts.m]} ${parts.y}`;
  const previewWeekday = weekdays[previewDate.getDay()];

  const hintText =
    hint === "min" ? minDateErrorMsg : hint === "max" ? maxDateErrorMsg : "";

  const handleConfirm = useCallback(() => {
    const now = Date.now();
    if (now - lastConfirmAt.current < 500) return;
    lastConfirmAt.current = now;
    onConfirm?.(partsToIso(partsRef.current));
  }, [onConfirm]);

  const dangerColor = theme.colors?.red || "#FF3232";

  return (
    <Modal
      transparent
      visible={rendered}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
          onPress={onClose}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            paddingBottom: Platform.OS === "ios" ? 34 : 24,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View
            style={[
              styles.headerIcon,
              { backgroundColor: alpha(theme.accent, 0.13) },
            ]}
          >
            <Ionicons name="calendar-outline" size={20} color={theme.accent} />
          </View>
          <View style={styles.headerCopy}>
            <Text
              allowFontScaling={false}
              style={[styles.title, { color: theme.text.primary }]}
            >
              {title}
            </Text>
            {/* Sınır uyarısı geçicidir ve altyazının yerini alır; panel
                yüksekliği sabit kalsın diye ayrı satır açılmaz. */}
            {!!(hintText || subtitle) && (
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                style={[
                  styles.subtitle,
                  hintText
                    ? { color: dangerColor, fontWeight: "700" }
                    : { color: theme.text.muted },
                ]}
              >
                {hintText || subtitle}
              </Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: pressed
                  ? alpha(theme.text.muted, 0.22)
                  : alpha(theme.text.muted, 0.12),
              },
            ]}
          >
            <Ionicons name="close" size={18} color={theme.text.muted} />
          </Pressable>
        </View>

        {/* Seçili tarih önizlemesi */}
        <Animated.View
          style={[
            styles.previewCard,
            {
              backgroundColor: alpha(theme.accent, 0.12),
              borderColor: alpha(theme.accent, 0.32),
              transform: [{ scale: previewScale }],
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.onceki_gun", "Önceki gün")}
            accessibilityState={{ disabled: !canPickPrevious }}
            disabled={!canPickPrevious}
            hitSlop={6}
            onPress={() => pickAdjacent(-1)}
            style={({ pressed }) => [
              styles.dayStepButton,
              {
                backgroundColor: alpha(theme.accent, pressed ? 0.2 : 0.1),
                opacity: canPickPrevious ? 1 : 0.35,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={17} color={theme.accent} />
          </Pressable>
          <View
            style={styles.previewCopy}
            accessibilityLabel={`${previewText}, ${previewWeekday}`}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.previewText, { color: theme.accent }]}
            >
              {previewText}
            </Text>
            <Text
              allowFontScaling={false}
              style={[
                styles.previewWeekday,
                { color: alpha(theme.accent, 0.75) },
              ]}
            >
              {previewWeekday}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.sonraki_gun", "Sonraki gün")}
            accessibilityState={{ disabled: !canPickNext }}
            disabled={!canPickNext}
            hitSlop={6}
            onPress={() => pickAdjacent(1)}
            style={({ pressed }) => [
              styles.dayStepButton,
              {
                backgroundColor: alpha(theme.accent, pressed ? 0.2 : 0.1),
                opacity: canPickNext ? 1 : 0.35,
              },
            ]}
          >
            <Ionicons name="chevron-forward" size={17} color={theme.accent} />
          </Pressable>
        </Animated.View>

        {/* Hızlı seçimler */}
        {quickItems.length > 0 && (
          <View style={styles.quickRow}>
            {quickItems.map((item) => {
              const active = item.iso === selectedIso;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => pickQuick(item.iso)}
                  style={({ pressed }) => [
                    styles.quickChip,
                    {
                      backgroundColor: active
                        ? alpha(theme.accent, 0.16)
                        : theme.between,
                      borderColor: active ? theme.accent : theme.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.quickChipText,
                      { color: active ? theme.accent : theme.text.secondary },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Drum picker */}
        <View
          style={[
            styles.pickerContainer,
            { backgroundColor: theme.between, borderColor: theme.border },
          ]}
        >
          <View style={styles.columnLabels} pointerEvents="none">
            <Text
              allowFontScaling={false}
              style={[styles.columnLabel, { color: theme.text.muted }]}
            >
              {i18nText("autoI18n.gun", "Gün")}
            </Text>
            <Text
              allowFontScaling={false}
              style={[
                styles.columnLabel,
                styles.monthColumnLabel,
                { color: theme.text.muted },
              ]}
            >
              {i18nText("autoI18n.ay", "Ay")}
            </Text>
            <Text
              allowFontScaling={false}
              style={[
                styles.columnLabel,
                styles.yearColumnLabel,
                { color: theme.text.muted },
              ]}
            >
              {i18nText("autoI18n.yil_kucuk", "Yıl")}
            </Text>
          </View>
          {/* Seçili satır bandı */}
          <View
            pointerEvents="none"
            style={[
              styles.highlight,
              {
                top: WHEEL_PAD + COLUMN_LABEL_H + PAD_COUNT * ITEM_H,
                backgroundColor: alpha(theme.accent, 0.1),
                borderColor: alpha(theme.accent, 0.34),
              },
            ]}
          />

          <View style={styles.columnsRow}>
            <WheelColumn
              items={dayWheelItems}
              selectedIndex={dayWheelIndex}
              onSelect={onSelectDay}
              flexBasis={1}
              baseColor={theme.text.muted}
              activeColor={theme.text.primary}
              disabledColor={alpha(dangerColor, 0.75)}
              flat={flatWheel}
              accessibilityLabel={i18nText("autoI18n.gun_seciniz", "Gün seçiniz")}
            />
            <WheelColumn
              items={monthWheelItems}
              selectedIndex={monthWheelIndex}
              onSelect={onSelectMonth}
              flexBasis={1.9}
              baseColor={theme.text.muted}
              activeColor={theme.text.primary}
              disabledColor={alpha(dangerColor, 0.75)}
              flat={flatWheel}
              accessibilityLabel={i18nText("autoI18n.ay", "Ay")}
            />
            <WheelColumn
              items={yearWheelItems}
              selectedIndex={yearWheelIndex}
              onSelect={onSelectYear}
              flexBasis={1.3}
              baseColor={theme.text.muted}
              activeColor={theme.text.primary}
              disabledColor={alpha(dangerColor, 0.75)}
              flat={flatWheel}
              accessibilityLabel={i18nText("autoI18n.yil_kucuk", "yıl")}
            />
          </View>

          {/* Üst / alt sönümleme */}
          <LinearGradient
            colors={[theme.between, alpha(theme.between, 0)]}
            style={[styles.fade, { top: 0 }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={[alpha(theme.between, 0), theme.between]}
            style={[styles.fade, { bottom: 0 }]}
            pointerEvents="none"
          />
        </View>

        {/* Onay */}
        <Pressable
          onPress={handleConfirm}
          accessibilityRole="button"
          accessibilityLabel={`${confirmLabel}: ${previewText}`}
          style={({ pressed }) => [
            styles.confirmBtn,
            {
              backgroundColor: theme.accent,
              opacity: pressed ? 0.86 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
        >
          <Text allowFontScaling={false} style={styles.confirmBtnText}>
            {confirmLabel}
          </Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
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
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 20,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCard: {
    alignSelf: "center",
    width: "auto",
    minWidth: 250,
    maxWidth: "92%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  dayStepButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCopy: { flex: 1, minWidth: 0, alignItems: "center" },
  previewText: { fontSize: 14.5, fontWeight: "800", letterSpacing: -0.2 },
  previewWeekday: { fontSize: 11.5, fontWeight: "600", marginTop: 1 },
  quickRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickChipText: { fontSize: 12.5, fontWeight: "700" },
  pickerContainer: {
    borderRadius: 20,
    borderWidth: 1.5,
    marginHorizontal: 16,
    marginTop: 12,
    padding: WHEEL_PAD,
    overflow: "hidden",
  },
  columnLabels: {
    height: COLUMN_LABEL_H,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  columnLabel: {
    flex: 1,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.7,
    textAlign: "center",
    textTransform: "uppercase",
  },
  monthColumnLabel: { flex: 1.9 },
  yearColumnLabel: { flex: 1.3 },
  highlight: {
    position: "absolute",
    left: 10,
    right: 10,
    height: ITEM_H,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  columnsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    height: WHEEL_PAD + COLUMN_LABEL_H + PAD_COUNT * ITEM_H - 4,
  },
  confirmBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});
