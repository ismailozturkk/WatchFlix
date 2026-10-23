// ============================================================
//  components/modals/DatePickerModal.js
//  Uygulamanın ortak tarih seçicisi: izleme tarihi, hatırlatıcı tarihi,
//  doğum tarihi — tüm tarih seçimleri buradan geçer.
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
//      initialView="years"                // "days" (varsayılan) | "years"
//    />
//
//   ───                                        ← tutamaç
//   [📅] İZLEME TARİHİ                    [x]
//        23 Ekim 2026
//        Perşembe
//   Bu filmi ne zaman izlediniz?               ← sınır uyarısı bunun yerine çıkar
//   [Dün] [Bugün] [Yarın]
//   ┌────────────────────────────────────┐
//   │ [Ekim 2026 ⌄]              [‹] [›] │    başlık: gün → ay → yıl ızgarası
//   │ Pzt Sal Çar Per Cum Cmt Paz        │
//   │  ·   ·   1   2   3   4   5         │    6 hafta SABİT: yükseklik oynamaz
//   │  …                                 │    yatay kaydırma = ay değiştir
//   └────────────────────────────────────┘
//   [        Tarihi Onayla        ]
//
//  NEDEN TAKVİM (çark değil): eski seçici üç kaydırma çarkıydı ve seçimi
//  kaydırma ofsetinden türetiyordu. Kayarken bildirilen ara değerler diğer
//  sütunların listesini yeniden kuruyor (ay değişince gün sayısı, sınıra
//  yaklaşınca kapalı aylar), programatik hizalama kullanıcının parmağıyla
//  çatışıp seçimi GERİ SEKTİRİYORDU — iki düzeltme turundan sonra da. Burada
//  seçim yalnız DOKUNUŞLA değişir; kaydırma (yıl listesi, ay geçişi) hiçbir
//  zaman değer üretmez, yarışacak bir şey kalmaz.
//
//  Davranış:
//   • Gün / ay / yıl hücresine dokunmak SEÇER; oklar ve yatay kaydırma yalnız
//     sayfayı değiştirir (seçim yerinde kalır, başlık hep seçili tarihi gösterir).
//   • Ay ya da yıl seçilince gün korunur; ay kısaysa düşer (31 → 28), sınır
//     dışına taşarsa en yakın geçerli tarihe çekilir ve uyarı satırı görünür.
//   • Sınır dışı gün/ay soluk çizilir; dokununca seçim değişmez, uyarı çıkar.
//   • Gövde Modal içinde olduğu için HER AÇILIŞTA yeniden kurulur: durum
//     `value`dan bir kez türetilir, açıkken dışarıdan gelen render'lar seçimi
//     sıfırlamaz.
//   • Saf takvim hesabı: utils/datePickerCalendar.js (testli).
// ============================================================

import { copyLanguage } from "../../utils/appLanguages";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@context/ThemeContext";
import GlassCloseButton from "@components/common/GlassCloseButton";
import { useLanguage } from "@context/LanguageContext";
import { alpha } from "@theme/colors";
import { i18nText } from "@utils/i18nText";
import useReduceMotion from "@hooks/useReduceMotion";
import {
  addMonths,
  buildMonthGrid,
  buildYears,
  canStepMonth,
  canStepYear,
  chunk,
  clampParts,
  firstDayOfWeekFor,
  isoToParts,
  monthBound,
  normalizeDate,
  partsToIso,
  shiftIso,
  todayIso,
  weekdayOrder,
  yearBound,
  GRID_WEEKS,
} from "@utils/datePickerCalendar";
import BottomSheetModal from "../common/BottomSheetModal";
import GlassPressable from "../common/GlassPressable";

// WatchedDateSheet buradan alıyor; hesap utils'e taşındı, adres değişmesin.
export { normalizeDate };

// ─── Constants ────────────────────────────────────────────────────────────────

const SHEET_MAX_W = 520;
const SHEET_PAD_X = 18;
const SHEET_BORDER = 1;
const CARD_PAD = 10;
const CARD_BORDER = 1;
const ROW_H = 42;
const WEEK_HEAD_H = 26;
// Üç görünümün (gün / ay / yıl) ORTAK gövde yüksekliği: görünüm değişince
// sayfa boyu oynamaz.
const BODY_H = WEEK_HEAD_H + GRID_WEEKS * ROW_H;
const MAX_DOT = 40;
const MONTH_COLS = 3;
const GRID_GAP = 8;
const YEAR_COLS = 4;
const YEAR_ROW_H = 52;
const SWIPE_MIN_DX = 44;
const PAGE_SHIFT = 28;
const HINT_MS = 2600;
const CONFIRM_GUARD_MS = 500;

export const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const WEEKDAYS_TR = [
  "Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi",
];

const WEEKDAYS_EN = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const WEEKDAYS_ES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];

const WEEKDAYS_PT = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado",
];

const WEEKDAYS_DE = [
  "Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag",
];

// Izgara başlığı (Pazar = 0, Date#getDay sırası).
const WEEKDAYS_SHORT_TR = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const WEEKDAYS_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_SHORT_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WEEKDAYS_SHORT_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_SHORT_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const MONTH_NAMES = { tr: MONTHS_TR, en: MONTHS_EN, es: MONTHS_ES, pt: MONTHS_PT, de: MONTHS_DE };
const WEEKDAY_NAMES = { tr: WEEKDAYS_TR, en: WEEKDAYS_EN, es: WEEKDAYS_ES, pt: WEEKDAYS_PT, de: WEEKDAYS_DE };
const WEEKDAY_SHORT_NAMES = {
  tr: WEEKDAYS_SHORT_TR,
  en: WEEKDAYS_SHORT_EN,
  es: WEEKDAYS_SHORT_ES,
  pt: WEEKDAYS_SHORT_PT,
  de: WEEKDAYS_SHORT_DE,
};

/** Dile uygun ay adları (0-11); bilinmeyen dil İngilizce. YENİ DİL: tablolara ekle. */
export const monthNamesOf = (language) =>
  MONTH_NAMES[copyLanguage(language, Object.keys(MONTH_NAMES))];

/** "1998-03-05" parçaları → dile uygun uzun tarih: "5 Mart 1998" / "March 5, 1998" / "5 de marzo de 1998" / "5 de março de 1998". */
export function formatLongDateParts(language, { day, monthIndex, year }) {
  const lang = copyLanguage(language, Object.keys(MONTH_NAMES));
  const month = MONTH_NAMES[lang][monthIndex];
  if (lang === "en") return `${month} ${day}, ${year}`;
  if (lang === "es" || lang === "pt") return `${day} de ${month.toLowerCase()} de ${year}`;
  if (lang === "de") return `${day}. ${month} ${year}`;
  return `${day} ${month} ${year}`;
}

// ─── Hücreler ─────────────────────────────────────────────────────────────────
//  42 gün / 12 ay / onlarca yıl hücresi: cam burada pahalı (hücre başına bir
//  görsel efekt katmanı) ve liste öğesi sayılır (glassCoverageGuard: `*Cell`
//  bildirimi). `memo` dışarıda sarılır ki bekçi bildirimi görsün.

/** Seçili günün dolgusu; dokunuşla seçilince kısa bir "pop" ile belirir. */
function SelectedDisc({ size, color, animate }) {
  const scale = useRef(new Animated.Value(animate ? 0.7 : 1)).current;
  useEffect(() => {
    if (!animate) return undefined;
    const spring = Animated.spring(scale, {
      toValue: 1,
      damping: 13,
      stiffness: 340,
      mass: 0.55,
      useNativeDriver: true,
    });
    spring.start();
    return () => spring.stop();
  }, [animate, scale]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

function DayCell({
  day,
  iso,
  bound,
  today,
  selected,
  pop,
  label,
  width,
  dot,
  palette,
  onPick,
}) {
  const textColor = selected
    ? "#FFFFFF"
    : bound
      ? palette.disabled
      : today
        ? palette.accent
        : palette.text;
  return (
    <Pressable
      onPress={() => onPick(iso, bound)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!bound }}
      style={[styles.dayCell, { width }]}
    >
      {({ pressed }) => (
        <>
          {selected ? (
            <SelectedDisc size={dot} color={palette.accent} animate={pop} />
          ) : pressed && !bound ? (
            <View
              pointerEvents="none"
              style={[
                styles.disc,
                {
                  width: dot,
                  height: dot,
                  borderRadius: dot / 2,
                  backgroundColor: palette.pressed,
                },
              ]}
            />
          ) : today ? (
            <View
              pointerEvents="none"
              style={[
                styles.disc,
                styles.todayRing,
                {
                  width: dot,
                  height: dot,
                  borderRadius: dot / 2,
                  borderColor: palette.ring,
                },
              ]}
            />
          ) : null}
          <Text
            allowFontScaling={false}
            style={[
              styles.dayText,
              {
                color: textColor,
                fontWeight: selected || today ? "800" : "600",
              },
            ]}
          >
            {day}
          </Text>
        </>
      )}
    </Pressable>
  );
}
const MemoDayCell = memo(DayCell);

function MonthCell({ month, name, selected, current, bound, palette, onPick }) {
  return (
    <Pressable
      onPress={() => onPick(month)}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ selected, disabled: !!bound }}
      style={({ pressed }) => [
        styles.gridTile,
        {
          backgroundColor: selected
            ? palette.accent
            : pressed && !bound
              ? palette.pressed
              : palette.tile,
          borderColor: !selected && current ? palette.ring : "transparent",
          opacity: bound ? 0.4 : 1,
        },
      ]}
    >
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[
          styles.tileText,
          {
            color: selected ? "#FFFFFF" : current ? palette.accent : palette.text,
            fontWeight: selected ? "800" : "700",
          },
        ]}
      >
        {name}
      </Text>
    </Pressable>
  );
}
const MemoMonthCell = memo(MonthCell);

function YearCell({ year, selected, current, bound, palette, onPick }) {
  return (
    <Pressable
      onPress={() => onPick(year)}
      accessibilityRole="button"
      accessibilityLabel={String(year)}
      accessibilityState={{ selected, disabled: !!bound }}
      style={({ pressed }) => [
        styles.gridTile,
        styles.yearTile,
        {
          backgroundColor: selected
            ? palette.accent
            : pressed && !bound
              ? palette.pressed
              : palette.tile,
          borderColor: !selected && current ? palette.ring : "transparent",
          opacity: bound ? 0.4 : 1,
        },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[
          styles.tileText,
          {
            color: selected ? "#FFFFFF" : current ? palette.accent : palette.text,
            fontWeight: selected ? "800" : "700",
          },
        ]}
      >
        {year}
      </Text>
    </Pressable>
  );
}
const MemoYearCell = memo(YearCell);

const getYearRowLayout = (_, index) => ({
  length: YEAR_ROW_H,
  offset: YEAR_ROW_H * index,
  index,
});

// ─── Gövde ────────────────────────────────────────────────────────────────────

function DatePickerBody({
  value,
  minIso,
  maxIso,
  onConfirm,
  onClose,
  title,
  subtitle,
  confirmLabel,
  minDateErrorMsg,
  maxDateErrorMsg,
  quickActions,
  initialView,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  const lang = copyLanguage(language, Object.keys(MONTH_NAMES));
  const months = MONTH_NAMES[lang];
  const weekdays = WEEKDAY_NAMES[lang];
  const weekdaysShort = WEEKDAY_SHORT_NAMES[lang];
  const firstDay = firstDayOfWeekFor(lang);

  const years = useMemo(() => buildYears(minIso, maxIso), [minIso, maxIso]);
  const bounds = useMemo(() => ({ minIso, maxIso, years }), [minIso, maxIso, years]);

  // Gövde her açılışta yeniden kurulduğu için "bugün" ve başlangıç seçimi bir
  // kez hesaplanır; açıkken gelen render'lar seçimi sıfırlamaz.
  const [today] = useState(todayIso);
  const [selected, setSelected] = useState(
    () => clampParts(isoToParts(normalizeDate(value) || today), bounds).parts,
  );
  const [page, setPage] = useState(() => ({ y: selected.y, m: selected.m }));
  const [mode, setMode] = useState(initialView === "years" ? "years" : "days");
  const [hint, setHint] = useState(null);

  // Hızlı art arda dokunuşlar render'ı beklemeden güncel değeri görsün.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const pageRef = useRef(page);
  pageRef.current = page;
  // Yalnız dokunuşla seçilen gün "pop" ile belirir; sayfa değişince sıfırlanır.
  const popIso = useRef(null);
  const hintTimer = useRef(null);
  const lastConfirmAt = useRef(0);

  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const showHint = useCallback((kind) => {
    setHint(kind);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), HINT_MS);
  }, []);

  const clearHint = useCallback(() => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = null;
    setHint(null);
  }, []);

  // ─── Geçiş animasyonları ───────────────────────────────────────────────────
  //  Değer önce ±1'e (görünmez) atanır, sonra 0'a süzülür: eski ızgara bir kare
  //  bile kaymış görünmez, yenisi gidiş yönünden gelir.

  const pageAnim = useRef(new Animated.Value(0)).current;
  const modeAnim = useRef(new Animated.Value(1)).current;

  const slidePage = useCallback(
    (direction) => {
      pageAnim.stopAnimation();
      if (reduceMotion || !direction) {
        pageAnim.setValue(0);
        return;
      }
      pageAnim.setValue(direction > 0 ? 1 : -1);
      Animated.timing(pageAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [pageAnim, reduceMotion],
  );

  const switchMode = useCallback(
    (next) => {
      setMode(next);
      modeAnim.stopAnimation();
      if (reduceMotion) {
        modeAnim.setValue(1);
        return;
      }
      modeAnim.setValue(0);
      Animated.timing(modeAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [modeAnim, reduceMotion],
  );

  const goToPage = useCallback(
    (next, direction) => {
      const current = pageRef.current;
      if (current.y === next.y && current.m === next.m) return;
      popIso.current = null;
      pageRef.current = next;
      setPage(next);
      slidePage(
        direction ?? (next.y * 12 + next.m > current.y * 12 + current.m ? 1 : -1),
      );
    },
    [slidePage],
  );

  // ─── Eylemler ──────────────────────────────────────────────────────────────

  const applySelection = useCallback(
    (result) => {
      selectedRef.current = result.parts;
      setSelected(result.parts);
      if (result.hint) showHint(result.hint);
      else clearHint();
    },
    [clearHint, showHint],
  );

  const pickDay = useCallback(
    (iso, bound) => {
      if (bound) {
        showHint(bound);
        return;
      }
      popIso.current = iso;
      applySelection({ parts: isoToParts(iso), hint: null });
    },
    [applySelection, showHint],
  );

  const stepMonth = useCallback(
    (delta) => {
      const current = pageRef.current;
      if (!canStepMonth(current, delta, bounds)) return;
      goToPage(addMonths(current, delta), delta);
    },
    [bounds, goToPage],
  );

  const stepYear = useCallback(
    (delta) => {
      const current = pageRef.current;
      if (!canStepYear(current.y, delta, bounds)) return;
      goToPage({ y: current.y + delta, m: current.m }, delta);
    },
    [bounds, goToPage],
  );

  const pickMonth = useCallback(
    (m) => {
      const { y } = pageRef.current;
      const bound = monthBound(y, m, minIso, maxIso);
      if (bound) {
        showHint(bound);
        return;
      }
      const result = clampParts({ y, m, d: selectedRef.current.d }, bounds);
      applySelection(result);
      goToPage({ y: result.parts.y, m: result.parts.m }, 0);
      switchMode("days");
    },
    [applySelection, bounds, goToPage, maxIso, minIso, showHint, switchMode],
  );

  const pickYear = useCallback(
    (y) => {
      const bound = yearBound(y, minIso, maxIso);
      if (bound) {
        showHint(bound);
        return;
      }
      const { m, d } = selectedRef.current;
      const result = clampParts({ y, m, d }, bounds);
      applySelection(result);
      goToPage({ y: result.parts.y, m: result.parts.m }, 0);
      switchMode("months");
    },
    [applySelection, bounds, goToPage, maxIso, minIso, showHint, switchMode],
  );

  const quickItems = useMemo(() => {
    if (!quickActions) return [];
    return [
      { key: "yesterday", label: i18nText("autoI18n.dun", "Dün"), iso: shiftIso(today, -1) },
      { key: "today", label: i18nText("autoI18n.bugun", "Bugün"), iso: today },
      { key: "tomorrow", label: i18nText("autoI18n.yarin", "Yarın"), iso: shiftIso(today, 1) },
    ].filter(
      (item) =>
        item.iso &&
        (!minIso || item.iso >= minIso) &&
        (!maxIso || item.iso <= maxIso),
    );
  }, [quickActions, today, minIso, maxIso, language]);

  const pickQuick = useCallback(
    (iso) => {
      const parts = isoToParts(iso);
      popIso.current = iso;
      applySelection({ parts, hint: null });
      goToPage({ y: parts.y, m: parts.m });
      if (mode !== "days") switchMode("days");
    },
    [applySelection, goToPage, mode, switchMode],
  );

  const onTitlePress = useCallback(() => {
    switchMode(mode === "days" ? "months" : mode === "months" ? "years" : "months");
  }, [mode, switchMode]);

  const handleConfirm = useCallback(() => {
    const now = Date.now();
    if (now - lastConfirmAt.current < CONFIRM_GUARD_MS) return;
    lastConfirmAt.current = now;
    onConfirm?.(partsToIso(selectedRef.current));
  }, [onConfirm]);

  // Yatay kaydırma ay değiştirir. Yalnız belirgin yatay harekette devralır;
  // dokunuşlar gün hücrelerine gider, değer hiçbir zaman ofsetten türemez.
  const stepMonthRef = useRef(stepMonth);
  stepMonthRef.current = stepMonth;
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) < SWIPE_MIN_DX && Math.abs(g.vx) < 0.3) return;
          stepMonthRef.current(g.dx < 0 ? 1 : -1);
        },
      }),
    [],
  );

  // ─── Ölçü ──────────────────────────────────────────────────────────────────
  //  İlk karede pencere genişliğinden tahmin, sonra gerçek ölçü: tahmin çoğu
  //  zaman birebir tuttuğu için ızgara yerinden oynamaz.

  const estimatedBodyW =
    Math.min(windowWidth, SHEET_MAX_W) -
    (SHEET_PAD_X + SHEET_BORDER) * 2 -
    (CARD_PAD + CARD_BORDER) * 2;
  const [bodyW, setBodyW] = useState(estimatedBodyW);
  const onBodyLayout = useCallback((event) => {
    const w = Math.round(event.nativeEvent.layout.width);
    if (w > 0) setBodyW((prev) => (Math.abs(prev - w) < 1 ? prev : w));
  }, []);
  const cellW = Math.floor(bodyW / 7);
  const dot = Math.max(28, Math.min(MAX_DOT, cellW - 4));

  // ─── Görünüm verisi ────────────────────────────────────────────────────────

  const palette = useMemo(
    () => ({
      accent: theme.accent,
      text: theme.text.primary,
      disabled: alpha(theme.text.muted, 0.45),
      pressed: alpha(theme.accent, 0.16),
      ring: alpha(theme.accent, 0.6),
      tile: alpha(theme.text.primary, 0.05),
    }),
    [theme],
  );

  const cells = useMemo(
    () =>
      buildMonthGrid({
        year: page.y,
        month: page.m,
        firstDay,
        minIso,
        maxIso,
        today,
      }),
    [page.y, page.m, firstDay, minIso, maxIso, today],
  );
  const order = useMemo(() => weekdayOrder(firstDay), [firstDay]);
  const selectedIso = partsToIso(selected);
  const todayParts = useMemo(() => isoToParts(today), [today]);

  const yearRows = useMemo(() => chunk(years, YEAR_COLS), [years]);
  const initialYearRow = useMemo(() => {
    const row = Math.floor(Math.max(0, years.indexOf(page.y)) / YEAR_COLS);
    const visibleRows = Math.floor(BODY_H / YEAR_ROW_H);
    const maxStart = Math.max(0, yearRows.length - visibleRows);
    return Math.max(0, Math.min(maxStart, row - Math.floor(visibleRows / 2)));
    // Yalnız yıl görünümü açılırken okunur (FlatList ilk konum).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode === "years", years, yearRows.length]);

  const renderYearRow = useCallback(
    ({ item: row }) => (
      <View style={styles.yearRow}>
        {row.map((year) => (
          <MemoYearCell
            key={year}
            year={year}
            selected={year === selected.y}
            current={year === todayParts.y}
            bound={yearBound(year, minIso, maxIso)}
            palette={palette}
            onPick={pickYear}
          />
        ))}
        {/* Yer tutucu hücreyle AYNI kutu (iç boşluk + çerçeve): `flex: 1` boşluğu
            bunların üstüne paylaştırır, eksik satırdaki yıl yoksa geniş çizilir. */}
        {Array.from({ length: YEAR_COLS - row.length }, (_, i) => (
          <View key={`pad-${i}`} style={[styles.gridTile, styles.yearPad]} />
        ))}
      </View>
    ),
    [maxIso, minIso, palette, pickYear, selected.y, todayParts.y],
  );

  // ─── Metinler ──────────────────────────────────────────────────────────────

  const headline = formatLongDateParts(language, {
    day: selected.d,
    monthIndex: selected.m,
    year: selected.y,
  });
  const headlineWeekday = weekdays[new Date(selected.y, selected.m, selected.d).getDay()];
  const hintText =
    hint === "min" ? minDateErrorMsg : hint === "max" ? maxDateErrorMsg : "";
  const dangerColor = theme.colors?.red || "#FF3232";

  const navTitle =
    mode === "days"
      ? `${months[page.m]} ${page.y}`
      : mode === "months"
        ? String(page.y)
        : `${years[0]} – ${years[years.length - 1]}`;
  const navTitleA11y =
    mode === "days"
      ? i18nText("autoI18n.ay_ve_yil_sec", "Ay ve yıl seç")
      : mode === "months"
        ? i18nText("autoI18n.yil_sec", "Yıl seç")
        : i18nText("autoI18n.ay_sec", "Ay seç");
  const canPrev =
    mode === "days" ? canStepMonth(page, -1, bounds) : canStepYear(page.y, -1, bounds);
  const canNext =
    mode === "days" ? canStepMonth(page, 1, bounds) : canStepYear(page.y, 1, bounds);
  const prevLabel =
    mode === "days"
      ? i18nText("autoI18n.onceki_ay", "Önceki ay")
      : i18nText("autoI18n.onceki_yil", "Önceki yıl");
  const nextLabel =
    mode === "days"
      ? i18nText("autoI18n.sonraki_ay", "Sonraki ay")
      : i18nText("autoI18n.sonraki_yil", "Sonraki yıl");

  const pageStyle = {
    opacity: pageAnim.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 1, 0],
    }),
    transform: [
      {
        translateX: pageAnim.interpolate({
          inputRange: [-1, 1],
          outputRange: [-PAGE_SHIFT, PAGE_SHIFT],
        }),
      },
    ],
  };
  const modeStyle = {
    opacity: modeAnim,
    transform: [
      {
        scale: modeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.97, 1],
        }),
      },
    ],
  };

  return (
    <>
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      {/* Başlık: ne seçildiği (eyebrow) + seçili tarih (canlı) */}
      <View style={styles.header}>
        <View
          style={[
            styles.headerIcon,
            {
              backgroundColor: alpha(theme.accent, 0.13),
              borderColor: alpha(theme.accent, 0.28),
            },
          ]}
        >
          <Ionicons name="calendar" size={20} color={theme.accent} />
        </View>
        <View
          style={styles.headerCopy}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${title}: ${headline}, ${headlineWeekday}`}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.eyebrow, { color: theme.text.muted }]}
          >
            {title}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[styles.headline, { color: theme.text.primary }]}
          >
            {headline}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.weekday, { color: theme.accent }]}
          >
            {headlineWeekday}
          </Text>
        </View>
        <GlassCloseButton
          size={34}
          fallbackRadius={11}
          backgroundColor={alpha(theme.text.muted, 0.12)}
          onPress={onClose}
        />
      </View>

      {/* Sınır uyarısı geçicidir ve alt başlığın yerini alır; sayfa boyu sabit kalır. */}
      {!!(hintText || subtitle) && (
        <View style={styles.subtitleRow} accessibilityLiveRegion="polite">
          {!!hintText && (
            <Ionicons name="alert-circle" size={15} color={dangerColor} />
          )}
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
        </View>
      )}

      {/* Hızlı seçimler */}
      {quickItems.length > 0 && (
        <View style={styles.quickRow}>
          {quickItems.map((item) => {
            const active = item.iso === selectedIso;
            return (
              <GlassPressable
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
              </GlassPressable>
            );
          })}
        </View>
      )}

      {/* Takvim kartı */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.between, borderColor: theme.border },
        ]}
      >
        <View style={styles.nav}>
          <GlassPressable
            accessibilityRole="button"
            accessibilityLabel={`${navTitle}, ${navTitleA11y}`}
            onPress={onTitlePress}
            style={({ pressed }) => [
              styles.navTitle,
              { backgroundColor: alpha(theme.accent, pressed ? 0.2 : 0.11) },
            ]}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.navTitleText, { color: theme.text.primary }]}
            >
              {navTitle}
            </Text>
            <Ionicons
              name={mode === "years" ? "chevron-up" : "chevron-down"}
              size={15}
              color={theme.accent}
            />
          </GlassPressable>

          {mode !== "years" && (
            <View style={styles.navArrows}>
              <GlassPressable
                accessibilityRole="button"
                accessibilityLabel={prevLabel}
                accessibilityState={{ disabled: !canPrev }}
                disabled={!canPrev}
                hitSlop={6}
                onPress={() => (mode === "days" ? stepMonth(-1) : stepYear(-1))}
                style={({ pressed }) => [
                  styles.navArrow,
                  {
                    backgroundColor: alpha(theme.accent, pressed ? 0.2 : 0.1),
                    opacity: canPrev ? 1 : 0.35,
                  },
                ]}
              >
                <Ionicons name="chevron-back" size={18} color={theme.accent} />
              </GlassPressable>
              <GlassPressable
                accessibilityRole="button"
                accessibilityLabel={nextLabel}
                accessibilityState={{ disabled: !canNext }}
                disabled={!canNext}
                hitSlop={6}
                onPress={() => (mode === "days" ? stepMonth(1) : stepYear(1))}
                style={({ pressed }) => [
                  styles.navArrow,
                  {
                    backgroundColor: alpha(theme.accent, pressed ? 0.2 : 0.1),
                    opacity: canNext ? 1 : 0.35,
                  },
                ]}
              >
                <Ionicons name="chevron-forward" size={18} color={theme.accent} />
              </GlassPressable>
            </View>
          )}
        </View>

        <View style={styles.body} onLayout={onBodyLayout}>
          {mode === "days" && (
            <Animated.View style={[styles.fill, modeStyle]}>
              <View style={styles.weekHead} pointerEvents="none">
                {order.map((weekday) => (
                  <Text
                    key={weekday}
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[
                      styles.weekHeadText,
                      { width: cellW, color: theme.text.muted },
                    ]}
                  >
                    {weekdaysShort[weekday]}
                  </Text>
                ))}
              </View>
              <Animated.View
                {...swipe.panHandlers}
                style={[styles.grid, { width: cellW * 7 }, pageStyle]}
              >
                {cells.map((cell, index) =>
                  cell ? (
                    <MemoDayCell
                      key={`c${index}`}
                      day={cell.day}
                      iso={cell.iso}
                      bound={cell.bound}
                      today={cell.today}
                      selected={cell.iso === selectedIso}
                      pop={!reduceMotion && cell.iso === popIso.current}
                      label={`${formatLongDateParts(language, {
                        day: cell.day,
                        monthIndex: page.m,
                        year: page.y,
                      })}, ${weekdays[cell.weekday]}`}
                      width={cellW}
                      dot={dot}
                      palette={palette}
                      onPick={pickDay}
                    />
                  ) : (
                    <View
                      key={`c${index}`}
                      style={[styles.dayCell, { width: cellW }]}
                    />
                  ),
                )}
              </Animated.View>
            </Animated.View>
          )}

          {/* İki ayrı katman: görünüm geçişi (modeStyle) ile yıl adımı
              (pageStyle) aynı stile konursa sonraki öncekini ezer. */}
          {mode === "months" && (
            <Animated.View style={[styles.fill, modeStyle]}>
              <Animated.View style={[styles.fill, styles.monthGrid, pageStyle]}>
                {chunk(months.map((name, m) => ({ name, m })), MONTH_COLS).map(
                  (row) => (
                    <View key={row[0].m} style={styles.monthRow}>
                      {row.map(({ name, m }) => (
                        <MemoMonthCell
                          key={m}
                          month={m}
                          name={name}
                          selected={page.y === selected.y && m === selected.m}
                          current={page.y === todayParts.y && m === todayParts.m}
                          bound={monthBound(page.y, m, minIso, maxIso)}
                          palette={palette}
                          onPick={pickMonth}
                        />
                      ))}
                    </View>
                  ),
                )}
              </Animated.View>
            </Animated.View>
          )}

          {mode === "years" && (
            <Animated.View style={[styles.fill, modeStyle]}>
              <FlatList
                data={yearRows}
                keyExtractor={(row) => String(row[0])}
                renderItem={renderYearRow}
                getItemLayout={getYearRowLayout}
                initialScrollIndex={initialYearRow}
                initialNumToRender={Math.ceil(BODY_H / YEAR_ROW_H) + 2}
                windowSize={7}
                showsVerticalScrollIndicator={false}
                overScrollMode="never"
                style={styles.fill}
              />
              <LinearGradient
                pointerEvents="none"
                colors={[theme.between, alpha(theme.between, 0)]}
                style={[styles.yearFade, { top: 0 }]}
              />
              <LinearGradient
                pointerEvents="none"
                colors={[alpha(theme.between, 0), theme.between]}
                style={[styles.yearFade, { bottom: 0 }]}
              />
            </Animated.View>
          )}
        </View>
      </View>

      {/* Onay */}
      <GlassPressable
        onPress={handleConfirm}
        accessibilityRole="button"
        accessibilityLabel={`${confirmLabel}: ${headline}`}
        style={({ pressed }) => [
          styles.confirmBtn,
          {
            backgroundColor: theme.accent,
            marginBottom: Math.max(insets.bottom, 14) + 6,
            opacity: pressed ? 0.86 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={19} color="#FFFFFF" />
        <Text allowFontScaling={false} style={styles.confirmBtnText}>
          {confirmLabel}
        </Text>
      </GlassPressable>
    </>
  );
}

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
  /** Açılış görünümü: "days" (ay takvimi) ya da "years" (yıl ızgarası — doğum tarihi gibi uzak tarihler). */
  initialView = "days",
}) {
  const { theme } = useTheme();
  const minIso = normalizeDate(minDate);
  const maxIso = normalizeDate(maxDate);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={38}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <DatePickerBody
        value={value}
        minIso={minIso}
        maxIso={maxIso}
        onConfirm={onConfirm}
        onClose={onClose}
        title={title}
        subtitle={subtitle}
        confirmLabel={confirmLabel}
        minDateErrorMsg={minDateErrorMsg}
        maxDateErrorMsg={maxDateErrorMsg}
        quickActions={quickActions}
        initialView={initialView}
      />
    </BottomSheetModal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    width: "100%",
    maxWidth: SHEET_MAX_W,
    alignSelf: "center",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: SHEET_BORDER,
    borderBottomWidth: 0,
    paddingHorizontal: SHEET_PAD_X,
    paddingTop: 10,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  headline: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  weekday: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  subtitle: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  quickChip: {
    paddingHorizontal: 15,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickChipText: { fontSize: 13, fontWeight: "700" },
  card: {
    marginTop: 12,
    padding: CARD_PAD,
    borderRadius: 22,
    borderWidth: CARD_BORDER,
  },
  nav: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  navTitle: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingLeft: 13,
    paddingRight: 10,
    borderRadius: 17,
    flexShrink: 1,
  },
  navTitleText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  navArrows: { flexDirection: "row", gap: 8 },
  navArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { height: BODY_H, overflow: "hidden" },
  fill: { flex: 1 },
  weekHead: {
    height: WEEK_HEAD_H,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
  },
  weekHeadText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignSelf: "center",
  },
  dayCell: {
    height: ROW_H,
    alignItems: "center",
    justifyContent: "center",
  },
  disc: { position: "absolute" },
  todayRing: { borderWidth: 1.5 },
  dayText: {
    fontSize: 15.5,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  monthGrid: { gap: GRID_GAP, paddingVertical: 2 },
  monthRow: { flex: 1, flexDirection: "row", gap: GRID_GAP },
  gridTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tileText: { fontSize: 15, letterSpacing: -0.2 },
  yearRow: {
    height: YEAR_ROW_H,
    flexDirection: "row",
    gap: GRID_GAP,
    paddingVertical: GRID_GAP / 2,
  },
  yearTile: { borderRadius: 14 },
  yearPad: { borderColor: "transparent" },
  yearFade: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 14,
  },
  confirmBtn: {
    marginTop: 14,
    height: 54,
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
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
