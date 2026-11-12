// utils/episodeGraphButtonCopy.js
//
// Dizi detayındaki "Bölüm puanları grafiği" düğmesinin metinleri (tr / en / es / pt / de).
// Şekil eşitliği __tests__/copyTablesSpanish.test.js'te bekçilenir.

import { copyLanguage } from "./appLanguages";

export const EPISODE_GRAPH_BUTTON_COPY = {
  tr: {
    title: "Bölüm puanları grafiği",
    subtitle: "Her bölümün puanını sezon sezon renkli tabloda gör",
    summary: (seasons, episodes, fmt = String) => `${fmt(seasons)} sezon · ${fmt(episodes)} bölüm`,
    seasonShort: "S",
    low: "Düşük",
    high: "Yüksek",
    open: "Grafiği aç",
  },
  en: {
    title: "Episode ratings chart",
    subtitle: "See every episode's rating in a color grid, season by season",
    summary: (seasons, episodes, fmt = String) =>
      `${fmt(seasons)} ${seasons === 1 ? "season" : "seasons"} · ${fmt(episodes)} ${episodes === 1 ? "episode" : "episodes"}`,
    seasonShort: "S",
    low: "Low",
    high: "High",
    open: "Open chart",
  },
  es: {
    title: "Gráfico de episodios",
    subtitle: "Mira la nota de cada episodio en una tabla de colores por temporada",
    summary: (seasons, episodes, fmt = String) =>
      `${fmt(seasons)} ${seasons === 1 ? "temporada" : "temporadas"} · ${fmt(episodes)} ${episodes === 1 ? "episodio" : "episodios"}`,
    seasonShort: "T",
    low: "Baja",
    high: "Alta",
    open: "Abrir gráfico",
  },
  pt: {
    title: "Gráfico de episódios",
    subtitle: "Veja a nota de cada episódio numa tabela colorida por temporada",
    summary: (seasons, episodes, fmt = String) =>
      `${fmt(seasons)} ${seasons === 1 ? "temporada" : "temporadas"} · ${fmt(episodes)} ${episodes === 1 ? "episódio" : "episódios"}`,
    seasonShort: "T",
    low: "Baixa",
    high: "Alta",
    open: "Abrir gráfico",
  },
  de: {
    title: "Episodenbewertungen",
    subtitle: "Sieh die Bewertung jeder Folge als Farbraster, Staffel für Staffel",
    summary: (seasons, episodes, fmt = String) =>
      `${fmt(seasons)} ${seasons === 1 ? "Staffel" : "Staffeln"} · ${fmt(episodes)} ${episodes === 1 ? "Folge" : "Folgen"}`,
    seasonShort: "S",
    low: "Niedrig",
    high: "Hoch",
    open: "Diagramm öffnen",
  },

  it: {
  title: "Grafico delle valutazioni degli episodi",
  subtitle: "Visualizza la valutazione di ogni episodio in una griglia colorata, stagione per stagione",
  summary: (seasons, episodes, fmt = String) => `${fmt(seasons)} ${seasons === 1 ? "stagione" : "stagioni"} · ${fmt(episodes)} ${episodes === 1 ? "episodio" : "episodi"}`,
  seasonShort: "S",
  low: "Bassa",
  high: "Alta",
  open: "Apri grafico"
}};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getEpisodeGraphButtonCopy = (language) =>
  EPISODE_GRAPH_BUTTON_COPY[copyLanguage(language, Object.keys(EPISODE_GRAPH_BUTTON_COPY))];
