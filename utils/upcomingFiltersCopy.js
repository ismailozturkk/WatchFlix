// utils/upcomingFiltersCopy.js
//
// "Yaklaşan Filmler" süzgecinin metinleri: yerel { tr, en, es, pt, de } tablosu + tarih/özet
// biçimleyicileri (SAF: RN importu yok). Anahtar ve yer tutucu eşitliği
// __tests__/copyTablesSpanish.test.js'te bekçilenir.
//
// Etiketler utils/upcomingFilters.js'teki kümelerle BİREBİR eşleşir:
//   ranges → QUICK_RANGES     scopes → SCOPES     sorts → UPCOMING_SORTS
// Tür ve dil adları YENİDEN yazılmaz: "Ne izlesem?" tablosundan gelir (screens/shared/discoverFiltersCopy).
//
// AY ADLARI burada ayrıca var: components/modals/DatePickerModal.js'teki tablo bir bileşen dosyasında
// (RN importlu), saf modül oradan okuyamaz.

import { copyLanguage } from "./appLanguages";
import { fillCopy, getDiscoverFiltersCopy } from "../screens/shared/discoverFiltersCopy";
import { monthBounds, parseIsoDay } from "./upcomingFilters";

const tr = {
  ui: {
    filters: "Filtreler",
    filtersCount: "Filtreler · {n}",
    sheetTitle: "Yaklaşan filmleri süz",
    reset: "Sıfırla",
    apply: "Sonuçları göster",
    when: "Ne zaman?",
    quickHint: "Yarından itibaren",
    pickMonth: "Ay seç",
    customRange: "Özel aralık",
    customHint: "Takvimden seçmek için başlangıca ya da bitişe dokun",
    from: "Başlangıç",
    to: "Bitiş",
    noEnd: "Sınır yok",
    pickDate: "Tarih seç",
    pickFromTitle: "Başlangıç tarihi",
    pickToTitle: "Bitiş tarihi",
    pickConfirm: "Tarihi seç",
    minFromError: "Yaklaşanlar yarından başlar",
    minToError: "Bitiş, başlangıçtan önce olamaz",
    maxError: "En fazla {n} yıl sonrası seçilebilir",
    scope: "Gösterim",
    scopeHint: "Sinemada ve Dijitalde, bölgendeki ({region}) çıkış tarihlerine göre listeler.",
    genre: "Tür",
    genreHint: "Seçtiğin türlerden herhangi birindeki filmler listelenir",
    language: "Özgün dil",
    sort: "Sıralama",
    sortHint: "Tarihe göre sıralama bölgendeki vizyon tarihlerini kullanır; seçince gösterim Sinemada'ya geçer.",
    emptyTitle: "Bu filtrelerle yaklaşan film yok",
    emptyText: "Tarih aralığını genişletmeyi ya da filtreleri sıfırlamayı dene.",
    emptyAction: "Filtreleri sıfırla",
    customChip: "{from} – {to}",
    moreGenres: "+{n}",
  },
  ranges: { "7d": "1 hafta", "1m": "1 ay", "3m": "3 ay", "6m": "6 ay", "1y": "1 yıl", all: "Tümü" },
  scopes: { all: "Tüm dünya", cinema: "Sinemada", digital: "Dijitalde" },
  sorts: { popular: "Popüler", soonest: "Tarihe göre" },
  regions: { TR: "Türkiye", US: "ABD", ES: "İspanya", BR: "Brezilya", DE: "Almanya" },
  months: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
  monthsShort: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
  formats: {
    monthYear: "{m} {y}",
    shortDate: "{d} {m}",
    shortDateYear: "{d} {m} {y}",
  },
};

const en = {
  ui: {
    filters: "Filters",
    filtersCount: "Filters · {n}",
    sheetTitle: "Filter upcoming movies",
    reset: "Reset",
    apply: "Show results",
    when: "When?",
    quickHint: "Starting tomorrow",
    pickMonth: "Pick a month",
    customRange: "Custom range",
    customHint: "Tap start or end to pick from the calendar",
    from: "Start",
    to: "End",
    noEnd: "No limit",
    pickDate: "Pick dates",
    pickFromTitle: "Start date",
    pickToTitle: "End date",
    pickConfirm: "Choose date",
    minFromError: "Upcoming starts tomorrow",
    minToError: "The end can’t be before the start",
    maxError: "You can pick up to {n} years ahead",
    scope: "Release",
    scopeHint: "In cinemas and Digital use release dates for your region ({region}).",
    genre: "Genre",
    genreHint: "Movies in any of the selected genres are listed",
    language: "Original language",
    sort: "Sort",
    sortHint: "Sorting by date uses release dates in your region; choosing it switches Release to In cinemas.",
    emptyTitle: "No upcoming movies match these filters",
    emptyText: "Try widening the date range or resetting the filters.",
    emptyAction: "Reset filters",
    customChip: "{from} – {to}",
    moreGenres: "+{n}",
  },
  ranges: { "7d": "1 week", "1m": "1 month", "3m": "3 months", "6m": "6 months", "1y": "1 year", all: "All" },
  scopes: { all: "Worldwide", cinema: "In cinemas", digital: "Digital" },
  sorts: { popular: "Popular", soonest: "By date" },
  regions: { TR: "Türkiye", US: "US", ES: "Spain", BR: "Brazil", DE: "Germany" },
  months: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  formats: {
    monthYear: "{m} {y}",
    shortDate: "{m} {d}",
    shortDateYear: "{m} {d}, {y}",
  },
};

const es = {
  ui: {
    filters: "Filtros",
    filtersCount: "Filtros · {n}",
    sheetTitle: "Filtrar próximos estrenos",
    reset: "Restablecer",
    apply: "Mostrar resultados",
    when: "¿Cuándo?",
    quickHint: "A partir de mañana",
    pickMonth: "Elegir mes",
    customRange: "Rango personalizado",
    customHint: "Toca el inicio o el final para elegir en el calendario",
    from: "Inicio",
    to: "Fin",
    noEnd: "Sin límite",
    pickDate: "Elegir fechas",
    pickFromTitle: "Fecha de inicio",
    pickToTitle: "Fecha de fin",
    pickConfirm: "Elegir fecha",
    minFromError: "Los próximos estrenos empiezan mañana",
    minToError: "El final no puede ser anterior al inicio",
    maxError: "Puedes elegir hasta {n} años en adelante",
    scope: "Estreno",
    scopeHint: "En cines y Digital usan las fechas de estreno de tu región ({region}).",
    genre: "Género",
    genreHint: "Se muestran las películas de cualquiera de los géneros elegidos",
    language: "Idioma original",
    sort: "Orden",
    sortHint: "El orden por fecha usa los estrenos de tu región; al elegirlo, Estreno pasa a En cines.",
    emptyTitle: "No hay próximos estrenos con estos filtros",
    emptyText: "Prueba a ampliar el rango de fechas o a restablecer los filtros.",
    emptyAction: "Restablecer filtros",
    customChip: "{from} – {to}",
    moreGenres: "+{n}",
  },
  ranges: { "7d": "1 semana", "1m": "1 mes", "3m": "3 meses", "6m": "6 meses", "1y": "1 año", all: "Todo" },
  scopes: { all: "Todo el mundo", cinema: "En cines", digital: "Digital" },
  sorts: { popular: "Populares", soonest: "Por fecha" },
  regions: { TR: "Turquía", US: "EE. UU.", ES: "España", BR: "Brasil", DE: "Alemania" },
  months: [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ],
  monthsShort: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"],
  formats: {
    monthYear: "{m} de {y}",
    shortDate: "{d} {m}",
    shortDateYear: "{d} {m} {y}",
  },
};

const pt = {
  ui: {
    filters: "Filtros",
    filtersCount: "Filtros · {n}",
    sheetTitle: "Filtrar próximos lançamentos",
    reset: "Redefinir",
    apply: "Mostrar resultados",
    when: "Quando?",
    quickHint: "A partir de amanhã",
    pickMonth: "Escolher mês",
    customRange: "Período personalizado",
    customHint: "Toque no início ou no fim para escolher no calendário",
    from: "Início",
    to: "Fim",
    noEnd: "Sem limite",
    pickDate: "Escolher datas",
    pickFromTitle: "Data de início",
    pickToTitle: "Data de fim",
    pickConfirm: "Escolher data",
    minFromError: "Os lançamentos começam amanhã",
    minToError: "O fim não pode ser antes do início",
    maxError: "Você pode escolher até {n} anos à frente",
    scope: "Lançamento",
    scopeHint: "Nos cinemas e Digital usam as datas de lançamento da sua região ({region}).",
    genre: "Gênero",
    genreHint: "Mostra filmes de qualquer um dos gêneros escolhidos",
    language: "Idioma original",
    sort: "Ordenação",
    sortHint: "A ordem por data usa os lançamentos da sua região; ao escolhê-la, Lançamento muda para Nos cinemas.",
    emptyTitle: "Nenhum lançamento com esses filtros",
    emptyText: "Tente ampliar o período ou redefinir os filtros.",
    emptyAction: "Redefinir filtros",
    customChip: "{from} – {to}",
    moreGenres: "+{n}",
  },
  ranges: { "7d": "1 semana", "1m": "1 mês", "3m": "3 meses", "6m": "6 meses", "1y": "1 ano", all: "Todos" },
  scopes: { all: "Mundo todo", cinema: "Nos cinemas", digital: "Digital" },
  sorts: { popular: "Populares", soonest: "Por data" },
  regions: { TR: "Turquia", US: "EUA", ES: "Espanha", BR: "Brasil", DE: "Alemanha" },
  months: [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ],
  monthsShort: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  formats: {
    monthYear: "{m} de {y}",
    shortDate: "{d} {m}",
    shortDateYear: "{d} {m} {y}",
  },
};

const de = {
  ui: {
    filters: "Filter",
    filtersCount: "Filter · {n}",
    sheetTitle: "Kommende Filme filtern",
    reset: "Zurücksetzen",
    apply: "Ergebnisse anzeigen",
    when: "Wann?",
    quickHint: "Ab morgen",
    pickMonth: "Monat wählen",
    customRange: "Eigener Zeitraum",
    customHint: "Tippe auf Beginn oder Ende, um im Kalender zu wählen",
    from: "Beginn",
    to: "Ende",
    noEnd: "Offen",
    pickDate: "Datum wählen",
    pickFromTitle: "Startdatum",
    pickToTitle: "Enddatum",
    pickConfirm: "Datum wählen",
    minFromError: "Kommende Filme beginnen morgen",
    minToError: "Das Ende kann nicht vor dem Beginn liegen",
    maxError: "Du kannst bis zu {n} Jahre im Voraus wählen",
    scope: "Veröffentlichung",
    scopeHint: "Im Kino und Digital nutzen die Starttermine deiner Region ({region}).",
    genre: "Genre",
    genreHint: "Filme aus einem der gewählten Genres werden angezeigt",
    language: "Originalsprache",
    sort: "Sortierung",
    sortHint: "Die Sortierung nach Datum nutzt die Starttermine deiner Region; bei Auswahl wechselt Veröffentlichung zu Im Kino.",
    emptyTitle: "Keine kommenden Filme mit diesen Filtern",
    emptyText: "Erweitere den Zeitraum oder setze die Filter zurück.",
    emptyAction: "Filter zurücksetzen",
    customChip: "{from} – {to}",
    moreGenres: "+{n}",
  },
  ranges: { "7d": "1 Woche", "1m": "1 Monat", "3m": "3 Monate", "6m": "6 Monate", "1y": "1 Jahr", all: "Alle" },
  scopes: { all: "Weltweit", cinema: "Im Kino", digital: "Digital" },
  sorts: { popular: "Beliebt", soonest: "Nach Datum" },
  regions: { TR: "Türkei", US: "USA", ES: "Spanien", BR: "Brasilien", DE: "Deutschland" },
  months: [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ],
  monthsShort: ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."],
  formats: {
    monthYear: "{m} {y}",
    shortDate: "{d}. {m}",
    shortDateYear: "{d}. {m} {y}",
  },
};

export const UPCOMING_FILTERS_COPY = Object.freeze({ tr, en, es, pt, de });

/** Uygulama diline göre metin tablosu (bilinmeyen dil → İngilizce). */
export const getUpcomingFiltersCopy = (language) =>
  UPCOMING_FILTERS_COPY[copyLanguage(language, Object.keys(UPCOMING_FILTERS_COPY))];

export { fillCopy };

/** "2026-11-05" → "5 Kas" (yıl bugünkünden farklıysa "5 Kas 2027"). Geçersiz → "". */
export function formatUpcomingDay(iso, copy, now = new Date()) {
  const date = parseIsoDay(iso);
  if (!date) return "";
  const sameYear = date.getFullYear() === now.getFullYear();
  return fillCopy(sameYear ? copy.formats.shortDate : copy.formats.shortDateYear, {
    d: date.getDate(),
    m: copy.monthsShort[date.getMonth()],
    y: date.getFullYear(),
  });
}

/** "2026-12" → "Aralık" (yıl bugünkünden farklıysa "Ocak 2027"). Geçersiz → "". */
export function formatUpcomingMonth(month, copy, now = new Date()) {
  const bounds = monthBounds(month);
  if (!bounds) return "";
  const date = parseIsoDay(bounds.first);
  const name = copy.months[date.getMonth()];
  return date.getFullYear() === now.getFullYear() ? name : fillCopy(copy.formats.monthYear, { m: name, y: date.getFullYear() });
}

/** Tarih seçiminin kısa etiketi (çip satırı): "1 ay" · "Aralık" · "5 Kas – 20 Ara". */
export function upcomingRangeLabel(filters, copy, now = new Date()) {
  if (filters?.range === "calendarMonth") return formatUpcomingMonth(filters.month, copy, now);
  if (filters?.range === "custom") {
    return fillCopy(copy.ui.customChip, {
      from: formatUpcomingDay(filters.from, copy, now),
      to: formatUpcomingDay(filters.to, copy, now),
    });
  }
  return copy.ranges[filters?.range] ?? "";
}

/**
 * Rafın alt başlığına giden etkin süzgeç özeti: "Sinemada · Korku, Komedi +1 · Tarihe göre".
 * Hiçbir süzgeç yoksa "" (raf kendi alt başlığını gösterir). Tarih dahil DEĞİL — çiplerde görünüyor.
 */
export function upcomingSummary(filters, language) {
  if (!filters) return "";
  const copy = getUpcomingFiltersCopy(language);
  const names = getDiscoverFiltersCopy(language);
  const parts = [];
  if (filters.scope && filters.scope !== "all") parts.push(copy.scopes[filters.scope]);
  const genres = Array.isArray(filters.genres) ? filters.genres : [];
  if (genres.length > 0) {
    const shown = genres.slice(0, 2).map((id) => names.genres?.[id] ?? String(id)).join(", ");
    parts.push(genres.length > 2 ? `${shown} ${fillCopy(copy.ui.moreGenres, { n: genres.length - 2 })}` : shown);
  }
  if (filters.language && filters.language !== "any") parts.push(names.languages?.[filters.language] ?? filters.language);
  if (filters.sort === "soonest") parts.push(copy.sorts.soonest);
  return parts.join(" · ");
}
