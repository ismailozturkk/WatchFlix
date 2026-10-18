// utils/listSortFilterCopy.js
//
// "Sırala & Filtrele" sayfasının (components/lists/ListSortFilterSheet.js) kendi metinleri — tr / en / es. Saf veri.
// Ekranlara özgü seçenek adları (Eklenme tarihi, Tür…) ekranlardan gelir; burada yalnız sayfa kabuğu var.
// __tests__/copyTablesSpanish.test.js üç dilin aynı şekle sahip olduğunu denetler.

import { copyLanguage } from "./appLanguages";

export const LIST_SORT_FILTER_COPY = {
  tr: {
    title: "Sırala ve filtrele",
    results: "{n} sonuç",
    showResults: "{n} sonuç göster",
    reset: "Sıfırla",
    close: "Kapat",
    sort: "SIRALA",
    asc: "Artan",
    desc: "Azalan",
    view: "Görünüm",
    columns: "SÜTUN",
    corners: "KÖŞE",
    posterInfo: "POSTERDE GÖSTER",
    moreChips: "+{n} daha",
    lessChips: "Daralt",
    radius: { 2: "Köşeli", 10: "Normal", 20: "Yuvarlak" },
    columnsOption: { 3: "3'lü", 4: "4'lü" },
  },
  en: {
    title: "Sort & filter",
    results: "{n} results",
    showResults: "Show {n} results",
    reset: "Reset",
    close: "Close",
    sort: "SORT BY",
    asc: "Ascending",
    desc: "Descending",
    view: "View",
    columns: "COLUMNS",
    corners: "CORNERS",
    posterInfo: "SHOW ON POSTER",
    moreChips: "+{n} more",
    lessChips: "Show less",
    radius: { 2: "Square", 10: "Normal", 20: "Round" },
    columnsOption: { 3: "3 across", 4: "4 across" },
  },
  es: {
    title: "Ordenar y filtrar",
    results: "{n} resultados",
    showResults: "Mostrar {n} resultados",
    reset: "Restablecer",
    close: "Cerrar",
    sort: "ORDENAR POR",
    asc: "Ascendente",
    desc: "Descendente",
    view: "Vista",
    columns: "COLUMNAS",
    corners: "ESQUINAS",
    posterInfo: "MOSTRAR EN EL PÓSTER",
    moreChips: "+{n} más",
    lessChips: "Mostrar menos",
    radius: { 2: "Rectas", 10: "Normales", 20: "Redondas" },
    columnsOption: { 3: "De 3", 4: "De 4" },
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getListSortFilterCopy = (language) =>
  LIST_SORT_FILTER_COPY[copyLanguage(language, Object.keys(LIST_SORT_FILTER_COPY))];

/** "{n}" yer tutucusunu doldurur. */
export const fillSortFilterCopy = (template, n) => String(template ?? "").replace("{n}", String(n));
