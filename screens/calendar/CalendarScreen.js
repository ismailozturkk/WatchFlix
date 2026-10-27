import { normalizeAppLanguage, pickByLanguage } from "@utils/appLanguages";
import { intlLocaleOf } from "../../utils/appLanguages";
import { isLightSurface } from "@utils/colorUtils";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { useFontFamilyForRole } from "@components/typography/AppText";
import { useTheme } from "@context/ThemeContext";
import { useCalendar, EVENT_COLORS } from "@context/CalendarContext";
import { useLanguage } from "@context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Ekran kökü: Premium şeridi yüzerken üst boşluğu ona göre büyür.
import SafeAreaView from "@components/common/ScreenSafeAreaView";
import { i18nText } from "@utils/i18nText";
import ScreenDecor from "@components/ScreenDecor";
import {
  CalendarControls,
  CalendarRangePicker,
  CalendarTypeChips,
  getCalendarRangeLabel,
} from "@components/calendar/CalendarFilterPanel";
import { AgendaDay } from "@components/calendar/CalendarAgendaDay";
import BackButton from "@components/BackButton";
import GlassIconButton from "@components/common/GlassIconButton";
import {
  countEventsInMonth,
  dayDiff,
  monthKeyOf,
  toLocalDateStr,
} from "@utils/calendarAgenda";

import {
  buildEventKey,
  loadSavedKeysSet,
  saveManyEventsToPhoneCalendar,
  removeManyEventsFromPhoneCalendar,
} from "@utils/phoneCalendar";
import GlassTouchable from "../../components/common/GlassTouchable";

/* ── Takvim yerelleştirmesi ──
   react-native-calendars ay/gün adlarını xdate'ten okur ve varsayılan yerel
   İngilizce; ayar yapılmadığı için Türkçe kullanıcı "October 2026 / Mon Tue"
   görüyordu. Kütüphane yalnız bu ekranda kullanılıyor, global ayar güvenli. */
LocaleConfig.locales.tr = {
  monthNames: [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ],
  monthNamesShort: [
    "Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
  ],
  dayNames: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
  dayNamesShort: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
  today: "Bugün",
};

LocaleConfig.locales.es = {
  monthNames: [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ],
  monthNamesShort: [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ],
  dayNames: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
  dayNamesShort: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  today: "Hoy",
};

LocaleConfig.locales.pt = {
  monthNames: [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ],
  monthNamesShort: [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ],
  dayNames: ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"],
  dayNamesShort: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  today: "Hoje",
};

LocaleConfig.locales.de = {
  monthNames: [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ],
  monthNamesShort: [
    "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
  ],
  dayNames: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
  dayNamesShort: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
  today: "Heute",
};

// "" = kütüphanenin varsayılanı (İngilizce). YENİ DİL: yukarıya LocaleConfig.locales.<kod> ekle.
const applyCalendarLocale = (language) => {
  const code = normalizeAppLanguage(language);
  LocaleConfig.defaultLocale = code === "en" ? "" : code;
};

/* ── Tarih formatlama ── */
function formatDisplayDate(dateStr, lang) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(intlLocaleOf(lang), {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
}

function dayRelativeLabel(dateStr, todayStr) {
  const diff = dayDiff(dateStr, todayStr);
  if (diff == null) return "";
  if (diff === 0) return i18nText("autoI18n.bugun", "Bugün");
  if (diff === 1) return i18nText("autoI18n.yarin", "Yarın");
  if (diff === -1) return i18nText("autoI18n.dun", "Dün");
  if (diff > 0) return i18nText("autoI18n.days_after", "{{count}} gün sonra", { count: diff });
  return i18nText("autoI18n.days_before", "{{count}} gün önce", { count: Math.abs(diff) });
}

function rangeTitle(viewMode, rangeMonths) {
  const rangeLabel =
    rangeMonths === "all"
      ? i18nText("autoI18n.all_time", "tüm zaman")
      : rangeMonths === 12
        ? i18nText("autoI18n.one_year", "1 yıl")
        : i18nText("autoI18n.month_count", "{{count}} ay", { count: rangeMonths });

  return viewMode === "future"
    ? i18nText("autoI18n.upcoming_range", "Önümüzdeki {{range}}", { range: rangeLabel })
    : i18nText("autoI18n.past_range", "Geçmiş {{range}}", { range: rangeLabel });
}

/* ── Ana bileşen ── */
export default function CalendarScreen({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const {
    noteEvents,
    reminderEvents,
    markedDates,
    getEventsForDate,
    isLoadingEvents,
    refreshEvents,
  } = useCalendar();

  applyCalendarLocale(language);

  const [activeFilter, setActiveFilter] = useState("all");
  const [viewMode, setViewMode] = useState("future");   // "future" | "past"
  const [rangeMonths, setRangeMonths] = useState(1);    // 1, 3, 6, 12, "all"
  const [focusDate, setFocusDate] = useState(null);     // tıklanmış gün (varsa)
  const [savedSet, setSavedSet] = useState(new Set());
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  // Takvimin gösterdiği ay ("YYYY-MM"). Başlıktaki ay özeti ve "Bugün" düğmesinin
  // görünürlüğü buna bağlı; `calendarKey` "Bugün"e basınca takvimi o aya geri
  // getirmek için (Calendar yalnız `initialDate` DEĞİŞİNCE ay atlar).
  const [calendarKey, setCalendarKey] = useState(0);

  // Telefon takvimine eklenmiş eventleri başta oku
  useEffect(() => {
    loadSavedKeysSet().then(setSavedSet);
  }, []);

  const onSavedChange = useCallback((key, saved) => {
    setSavedSet((prev) => {
      const next = new Set(prev);
      if (saved) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  /* ── Bugün (yerel) ── modül kapsamında hesaplanırsa uygulama gece yarısını
     açık geçtiğinde bayat kalıyordu; bileşen içinde tutuluyor. */
  const todayLocal = useMemo(() => toLocalDateStr(new Date()), []);
  const todayMonth = monthKeyOf(todayLocal);
  const [visibleMonth, setVisibleMonth] = useState(todayMonth);

  /* ── Aralık başlangıç/bitiş tarihleri ── */
  const { startDate, endDate } = useMemo(() => {
    const todayD = new Date();
    todayD.setHours(0, 0, 0, 0);
    const todayStr = toLocalDateStr(todayD);

    if (rangeMonths === "all") {
      return viewMode === "future"
        ? { startDate: todayStr, endDate: "9999-12-31" }
        : { startDate: "0000-01-01", endDate: todayStr };
    }
    const d = new Date(todayD);
    if (viewMode === "future") {
      d.setMonth(d.getMonth() + rangeMonths);
      return { startDate: todayStr, endDate: toLocalDateStr(d) };
    }
    d.setMonth(d.getMonth() - rangeMonths);
    return { startDate: toLocalDateStr(d), endDate: todayStr };
  }, [viewMode, rangeMonths]);

  /* ── Aralıktaki tüm event'leri tarihe göre grupla ── */
  const dateGroups = useMemo(() => {
    if (focusDate) {
      return { [focusDate]: getEventsForDate(focusDate) };
    }
    const result = {};
    const allDates = new Set([
      ...Object.keys(noteEvents),
      ...Object.keys(reminderEvents),
    ]);
    allDates.forEach((d) => {
      if (d >= startDate && d <= endDate) {
        const evs = getEventsForDate(d);
        if (evs.notes.length || evs.movies.length || evs.tvs.length) {
          result[d] = evs;
        }
      }
    });
    return result;
  }, [focusDate, getEventsForDate, noteEvents, reminderEvents, startDate, endDate]);

  /* ── Sıralı tarih anahtarları ── */
  const sortedDateKeys = useMemo(() => {
    const keys = Object.keys(dateGroups).sort();
    if (focusDate) return keys;
    return viewMode === "past" ? keys.reverse() : keys;
  }, [dateGroups, focusDate, viewMode]);

  /* ── Toplam sayım ── */
  const totalCount = useMemo(() => {
    let n = 0;
    Object.values(dateGroups).forEach((e) => {
      if (activeFilter === "all" || activeFilter === "note")  n += e.notes.length;
      if (activeFilter === "all" || activeFilter === "movie") n += e.movies.length;
      if (activeFilter === "all" || activeFilter === "tv")    n += e.tvs.length;
    });
    return n;
  }, [dateGroups, activeFilter]);

  // Dikey ajandayı tek tek React elemanlarıyla bir ScrollView içine basmak,
  // uzun hatırlatıcı geçmişinde görünmeyen tüm satırları da aynı anda
  // oluşturuyordu. FlatList yalnız görünür tarih gruplarını mount eder.
  const agendaGroups = useMemo(
    () =>
      sortedDateKeys
        .map((dateStr) => {
          const group = dateGroups[dateStr];
          if (!group) return null;
          const notes = activeFilter === "all" || activeFilter === "note" ? group.notes : [];
          const movies = activeFilter === "all" || activeFilter === "movie" ? group.movies : [];
          const tvs = activeFilter === "all" || activeFilter === "tv" ? group.tvs : [];
          const count = notes.length + movies.length + tvs.length;
          return count ? { dateStr, notes, movies, tvs, count } : null;
        })
        .filter(Boolean),
    [activeFilter, dateGroups, sortedDateKeys],
  );

  /* Filtre çiplerinde, seçili türden bağımsız aralık dağılımı */
  const filterCounts = useMemo(() => {
    let note = 0;
    let movie = 0;
    let tv = 0;
    Object.values(dateGroups).forEach((events) => {
      note += events.notes.length;
      movie += events.movies.length;
      tv += events.tvs.length;
    });
    return { all: note + movie + tv, note, movie, tv };
  }, [dateGroups]);

  /* Takvimin gösterdiği ayın tür dağılımı (açıklama çiplerinde + başlıkta) */
  const monthCounts = useMemo(
    () => countEventsInMonth(noteEvents, reminderEvents, visibleMonth),
    [noteEvents, reminderEvents, visibleMonth],
  );

  const monthLabel = useMemo(() => {
    const d = new Date(`${visibleMonth}-01T00:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(intlLocaleOf(language), {
      month: "long",
      year: "numeric",
    });
  }, [visibleMonth, language]);

  // Range tetikleyicileri focus modunu temizler
  const changeViewMode = useCallback((m) => {
    setViewMode(m);
    setFocusDate(null);
  }, []);
  const changeRangeMonths = useCallback((r) => {
    setRangeMonths(r);
    setFocusDate(null);
  }, []);

  // Aralıktaki filtrelenmiş tüm öğelerin düz listesi
  const flatRangeItems = useMemo(() => {
    const items = [];
    sortedDateKeys.forEach((d) => {
      const g = dateGroups[d];
      if (!g) return;
      if (activeFilter === "all" || activeFilter === "note")  items.push(...g.notes);
      if (activeFilter === "all" || activeFilter === "movie") items.push(...g.movies);
      if (activeFilter === "all" || activeFilter === "tv")    items.push(...g.tvs);
    });
    return items;
  }, [sortedDateKeys, dateGroups, activeFilter]);

  // Yeni aktarılabilecek (henüz kaydedilmemiş) öğe sayısı (Gelecek modu için)
  const pendingTransferCount = useMemo(
    () => flatRangeItems.filter((it) => !savedSet.has(buildEventKey(it))).length,
    [flatRangeItems, savedSet],
  );

  // Telefonda kayıtlı olan aralık öğelerinin sayısı (Geçmiş modu için)
  const savedInRangeCount = useMemo(
    () => flatRangeItems.filter((it) => savedSet.has(buildEventKey(it))).length,
    [flatRangeItems, savedSet],
  );

  // Mode'a göre buton aksiyonu
  const bulkActionCount =
    viewMode === "future" ? pendingTransferCount : savedInRangeCount;

  // Toplu aktarım / toplu silme
  const handleBulkAction = useCallback(async () => {
    if (isBulkLoading) return;
    if (flatRangeItems.length === 0) return;

    setIsBulkLoading(true);
    try {
      if (viewMode === "future") {
        const res = await saveManyEventsToPhoneCalendar(flatRangeItems, { onSavedChange });
        if (res.addedKeys && res.addedKeys.length > 0) {
          setSavedSet((prev) => {
            const next = new Set(prev);
            res.addedKeys.forEach((k) => next.add(k));
            return next;
          });
        }
      } else {
        // past mode → kayıtlı olanları sil
        const itemsToDelete = flatRangeItems.filter((it) =>
          savedSet.has(buildEventKey(it)),
        );
        if (itemsToDelete.length === 0) return;
        const res = await removeManyEventsFromPhoneCalendar(itemsToDelete, { onSavedChange });
        if (res.removedKeys && res.removedKeys.length > 0) {
          setSavedSet((prev) => {
            const next = new Set(prev);
            res.removedKeys.forEach((k) => next.delete(k));
            return next;
          });
        }
      }
    } finally {
      setIsBulkLoading(false);
    }
  }, [flatRangeItems, isBulkLoading, viewMode, savedSet, onSavedChange]);

  const currentRangeLabel = useMemo(
    () => getCalendarRangeLabel(rangeMonths),
    [rangeMonths, language],
  );

  /* ── Takvim theme overrides ── */
  // react-native-calendars metni node_modules içinde çizer; babel dönüşümü
  // oraya ulaşmaz, font ancak theme'e düz bir aile adı yazılarak uygulanır.
  // Üç yüzey üç role denk düşüyor: ay başlığı BAŞLIK, hafta günü satırı
  // NORMAL YAZI, gün rakamları RAKAM.
  const ayFontu = useFontFamilyForRole("heading", { fontWeight: "700" });
  const gunBasligiFontu = useFontFamilyForRole("body", { fontWeight: "500" });
  const gunFontu = useFontFamilyForRole("numeric", { fontWeight: "500" });
  const calendarTheme = useMemo(
    () => ({
      calendarBackground: "transparent",
      backgroundColor: "transparent",
      textSectionTitleColor: theme.text.muted,
      selectedDayBackgroundColor: theme.accent,
      selectedDayTextColor: "#fff",
      todayTextColor: theme.accent,
      dayTextColor: theme.text.primary,
      textDisabledColor: theme.text.muted + "55",
      dotColor: theme.accent,
      arrowColor: theme.accent,
      monthTextColor: theme.text.primary,
      indicatorColor: theme.accent,
      // Aile adı doğru ağırlık dosyasını zaten gösteriyor; ayrıca fontWeight
      // vermek Android'de sentetik kalınlık ekler.
      textDayFontFamily: gunFontu,
      textDayFontWeight: gunFontu ? "400" : "600",
      textMonthFontFamily: ayFontu,
      textMonthFontWeight: ayFontu ? "400" : "800",
      textDayHeaderFontFamily: gunBasligiFontu,
      textDayHeaderFontWeight: gunBasligiFontu ? "400" : "700",
      textMonthFontSize: 18,
      textDayFontSize: 15,
      textDayHeaderFontSize: 11.5,
    }),
    [ayFontu, gunBasligiFontu, gunFontu, theme],
  );

  /* ── markedDates + odak gün ──
     Bir gün seçiliyse dolu vurgu; seçili yokken bugün yalnızca yumuşak halka
     (ajanda aralık modunda olduğundan "bir şey seçilmiş" izlenimi vermesin). */
  const combinedMarked = useMemo(() => {
    const base = { ...markedDates };
    const sel = focusDate || todayLocal;
    const solid = Boolean(focusDate);
    base[sel] = {
      ...(base[sel] || {}),
      selected: true,
      selectedColor: solid ? theme.accent : theme.accent + "30",
      selectedTextColor: solid ? "#fff" : theme.accent,
    };
    return base;
  }, [markedDates, focusDate, theme.accent, todayLocal]);

  const onDayPress = useCallback(
    (day) => {
      setFocusDate((prev) => (prev === day.dateString ? null : day.dateString));
    },
    [],
  );

  const onMonthChange = useCallback((month) => {
    const key = monthKeyOf(month?.dateString);
    if (key) setVisibleMonth(key);
  }, []);

  const focusOnDate = useCallback((dateStr) => {
    setFocusDate(dateStr);
  }, []);

  // "Bugün": bugünü seç, takvimi bu aya getir. Takvim yalnız `initialDate`
  // değişince ay atladığı için (bugün zaten seçiliyse değişmez) yeniden mount.
  const goToToday = useCallback(() => {
    setFocusDate(todayLocal);
    setVisibleMonth(todayMonth);
    setCalendarKey((key) => key + 1);
  }, [todayLocal, todayMonth]);

  const showTodayButton = focusDate !== todayLocal || visibleMonth !== todayMonth;

  const handleItemPress = useCallback(
    (entry) => {
      if (entry.kind === "note") {
        // TabScreen gerçek bir navigator değil; sekme seçimi initialTab param'ıyla
        // yapılır ("screen" param'ı sessizce yok sayılıyordu → hep dizi sekmesi açılırdı).
        navigation.navigate("TabScreen", { initialTab: "profile" });
      } else if (entry.kind === "movie") {
        navigation.navigate("MovieDetails", { id: entry.item.id });
      } else {
        navigation.navigate("TvShowsDetails", { id: entry.item.id });
      }
    },
    [navigation],
  );

  const agendaRows = useMemo(
    () => [
      { type: "controls", key: "controls" },
      { type: "summary", key: "summary" },
      ...(agendaGroups.length
        ? agendaGroups.map((group) => ({ type: "group", key: group.dateStr, group }))
        : [{ type: "empty", key: "empty" }]),
    ],
    [agendaGroups],
  );

  const renderAgendaRow = useCallback(({ item }) => {
    if (item.type === "controls") {
      return (
        <CalendarControls
          theme={theme}
          viewMode={viewMode}
          onViewModeChange={changeViewMode}
          rangeLabel={currentRangeLabel}
          onRangePress={() => setShowRangeDropdown(true)}
          bulkActionCount={bulkActionCount}
          isBulkLoading={isBulkLoading}
          onBulkAction={handleBulkAction}
        />
      );
    }

    // Sabit (sticky) blok: başlık + tür çipleri. Arka planı OPAK olmak zorunda;
    // yoksa altından kayan ajanda satırları başlığın içinden görünür.
    if (item.type === "summary") {
      return (
        <View
          style={[
            styles.stickyBlock,
            { backgroundColor: theme.primary, borderBottomColor: theme.border },
          ]}
        >
          <View style={styles.summaryRow}>
            <View style={styles.summaryCopy}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.summaryTitle, { color: theme.text.primary }]}
              >
                {focusDate
                  ? formatDisplayDate(focusDate, language)
                  : rangeTitle(viewMode, rangeMonths)}
              </Text>
              {focusDate ? (
                <Text
                  allowFontScaling={false}
                  style={[styles.summarySub, { color: theme.accent }]}
                >
                  {dayRelativeLabel(focusDate, todayLocal)}
                </Text>
              ) : null}
            </View>
            {focusDate ? (
              <TouchableOpacity
                onPress={() => setFocusDate(null)}
                style={[
                  styles.clearFocusBtn,
                  { borderColor: theme.border, backgroundColor: theme.secondary },
                ]}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Ionicons name="close" size={13} color={theme.text.muted} />
                <Text
                  allowFontScaling={false}
                  style={[styles.clearFocusText, { color: theme.text.muted }]}
                >
                  {i18nText("autoI18n.araliga_don", "Aralığa dön")}
                </Text>
              </TouchableOpacity>
            ) : null}
            <View
              style={[
                styles.countBadge,
                { backgroundColor: theme.accent + "22", borderColor: theme.accent + "55" },
              ]}
            >
              <Text allowFontScaling={false} style={[styles.countText, { color: theme.accent }]}>
                {totalCount}
              </Text>
            </View>
          </View>
          <CalendarTypeChips
            theme={theme}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            filterCounts={filterCounts}
          />
        </View>
      );
    }

    if (item.type === "empty") {
      // Boş ekranda tek dokunuşla çıkış: filtre yüzünden boşsa filtreyi aç,
      // gün odağındaysa aralığa dön, aralık dardaysa tüm zamanı göster.
      let action = null;
      if (activeFilter !== "all" && filterCounts.all > 0) {
        action = {
          label: i18nText("autoI18n.filtreyi_temizle", "Filtreyi temizle"),
          onPress: () => setActiveFilter("all"),
        };
      } else if (focusDate) {
        action = {
          label: i18nText("autoI18n.araliga_don", "Aralığa dön"),
          onPress: () => setFocusDate(null),
        };
      } else if (rangeMonths !== "all") {
        action = {
          label: i18nText("autoI18n.takvim_tum_zamani_goster", "Tüm zamanı göster"),
          onPress: () => changeRangeMonths("all"),
        };
      }

      return (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <Ionicons name="calendar-outline" size={36} color={theme.accent} />
          </View>
          <Text allowFontScaling={false} style={[styles.emptyText, { color: theme.text.primary }]}>
            {focusDate
              ? i18nText("autoI18n.bugun_icin_hatirlatma_yok", "Bu gün için hatırlatma yok")
              : viewMode === "future"
                ? i18nText("autoI18n.aralikta_yaklasan_hatirlatma_yok", "Bu aralıkta yaklaşan hatırlatma yok")
                : i18nText("autoI18n.aralikta_gecmis_hatirlatma_yok", "Bu aralıkta geçmiş hatırlatma yok")}
          </Text>
          <Text allowFontScaling={false} style={[styles.emptySubText, { color: theme.text.muted }]}>
            {i18nText(
              "autoI18n.notlariniza_tarih_ekleyerek_veya_film_dizi_hatirla",
              "Notlarınıza tarih ekleyerek veya film/dizi hatırlatması kurarak burada görebilirsiniz",
            )}
          </Text>
          {action ? (
            <TouchableOpacity
              onPress={action.onPress}
              activeOpacity={0.82}
              style={[
                styles.emptyAction,
                { backgroundColor: theme.accent + "18", borderColor: theme.accent + "55" },
              ]}
              accessibilityRole="button"
            >
              <Text allowFontScaling={false} style={[styles.emptyActionText, { color: theme.accent }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    return (
      <AgendaDay
        group={item.group}
        todayStr={todayLocal}
        language={language}
        theme={theme}
        savedSet={savedSet}
        onSavedChange={onSavedChange}
        viewMode={viewMode}
        onFocus={focusOnDate}
        onItemPress={handleItemPress}
      />
    );
  }, [
    activeFilter,
    bulkActionCount,
    changeRangeMonths,
    changeViewMode,
    currentRangeLabel,
    filterCounts,
    focusDate,
    focusOnDate,
    handleBulkAction,
    handleItemPress,
    isBulkLoading,
    language,
    onSavedChange,
    rangeMonths,
    savedSet,
    theme,
    todayLocal,
    totalCount,
    viewMode,
  ]);

  const calendarHeader = useMemo(
    () => (
      <View
        style={[
          styles.calendarWrapper,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        {isLoadingEvents && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color={theme.accent} />
          </View>
        )}
        <Calendar
          // Dil/tema değişince Calendar yeniden kurulmalı: stil ve yerel adlar
          // yalnız mount'ta okunuyor.
          key={`cal-${language}-${theme.accent}-${theme.secondary}-${calendarKey}`}
          initialDate={focusDate || todayLocal}
          onDayPress={onDayPress}
          onMonthChange={onMonthChange}
          markingType="multi-dot"
          markedDates={combinedMarked}
          theme={calendarTheme}
          // Pazar başlangıcı: İngilizce ve Brezilya Portekizcesi; diğerleri Pazartesi.
          firstDay={["en", "pt"].includes(normalizeAppLanguage(language)) ? 0 : 1}
          enableSwipeMonths
          hideExtraDays
          renderArrow={(direction) => (
            <View
              style={[
                styles.arrowBtn,
                { backgroundColor: theme.primary, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name={direction === "left" ? "chevron-back" : "chevron-forward"}
                size={16}
                color={theme.accent}
              />
            </View>
          )}
          style={styles.calendar}
        />
        <View style={[styles.legend, { borderTopColor: theme.border }]}>
          {[
            { key: "note", label: i18nText("autoI18n.not", "Not") },
            { key: "movie", label: i18nText("autoI18n.film", "Film") },
            { key: "tv", label: i18nText("autoI18n.dizi", "Dizi") },
          ].map((legend) => {
            const color = EVENT_COLORS[legend.key];
            const count = monthCounts[legend.key];
            return (
              <View
                key={legend.key}
                style={[
                  styles.legendChip,
                  { backgroundColor: color + "1A", opacity: count ? 1 : 0.55 },
                ]}
              >
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text allowFontScaling={false} style={[styles.legendText, { color }]}>
                  {legend.label}
                </Text>
                <Text allowFontScaling={false} style={[styles.legendCount, { color }]}>
                  {count}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    ),
    [
      calendarKey,
      calendarTheme,
      combinedMarked,
      focusDate,
      isLoadingEvents,
      language,
      monthCounts,
      onDayPress,
      onMonthChange,
      theme,
      todayLocal,
    ],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScreenDecor scope="more" iconOpacity={0.25} />
      <StatusBar barStyle={isLightSurface(theme.primary) ? "dark-content" : "light-content"} />

      {/* Header */}
      <LinearGradient
        colors={[theme.accent + "33", "transparent"]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <SafeAreaView style={styles.header}>
        <BackButton absolute={false} onPress={() => navigation.goBack()} />
        <View style={styles.headerCenter}>
          <Text
            allowFontScaling={false}
            style={[styles.headerTitle, { color: theme.text.primary }]}
          >
            {i18nText("autoI18n.takvim", "Takvim")}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.headerSub, { color: theme.text.muted }]}
          >
            {monthLabel}
            {" · "}
            {monthCounts.total
              ? i18nText("autoI18n.n_etkinlik", "{{n}} etkinlik", { n: monthCounts.total })
              : i18nText("autoI18n.takvim_ay_bos", "Etkinlik yok")}
          </Text>
        </View>
        {showTodayButton ? (
          <GlassTouchable
            onPress={goToToday}
            style={[
              styles.todayBtn,
              { backgroundColor: theme.accent + "1F", borderColor: theme.accent + "55" },
            ]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.takvim_bugune_git", "Bugüne git")}
          >
            <Ionicons name="today-outline" size={15} color={theme.accent} />
            <Text allowFontScaling={false} style={[styles.todayBtnText, { color: theme.accent }]}>
              {i18nText("autoI18n.bugun", "Bugün")}
            </Text>
          </GlassTouchable>
        ) : null}
        <GlassIconButton
          icon="refresh"
          iconSize={18}
          color={theme.accent}
          size={40}
          fallbackRadius={12}
          onPress={refreshEvents}
          disabled={isLoadingEvents}
          accessibilityLabel={pickByLanguage(language, { tr: "Takvimi yenile", en: "Refresh calendar", es: "Actualizar calendario", pt: "Atualizar calendário", de: "Kalender aktualisieren" })}
        >
          {isLoadingEvents ? <ActivityIndicator size="small" color={theme.accent} /> : null}
        </GlassIconButton>
      </SafeAreaView>

      <FlatList
        data={agendaRows}
        renderItem={renderAgendaRow}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={7}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        ListHeaderComponent={calendarHeader}
      />

      <CalendarRangePicker
        visible={showRangeDropdown}
        theme={theme}
        selectedValue={rangeMonths}
        onSelect={(value) => {
          changeRangeMonths(value);
          setShowRangeDropdown(false);
        }}
        onClose={() => setShowRangeDropdown(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  headerCenter: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  headerSub: { fontSize: 12, marginTop: 1, fontWeight: "600" },
  todayBtn: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  todayBtnText: { fontSize: 13, fontWeight: "800" },

  calendarWrapper: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  calendar: { borderRadius: 24, paddingBottom: 4 },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOverlay: {
    position: "absolute",
    zIndex: 10,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#00000033",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexWrap: "wrap",
  },
  legendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: "700" },
  legendCount: { fontSize: 12, fontWeight: "900" },

  stickyBlock: {
    paddingTop: 6,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  summarySub: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  clearFocusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  clearFocusText: { fontSize: 12, fontWeight: "700" },
  countBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  countText: { fontSize: 13, fontWeight: "800" },

  emptyState: { alignItems: "center", paddingTop: 28, gap: 12, paddingHorizontal: 16 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  emptyText: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptySubText: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 19,
  },
  emptyAction: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyActionText: { fontSize: 13.5, fontWeight: "800" },
});
