// components/tournament/phaseMeta.js
//
// Turnuva fazlarının görsel kimliği. Hem turnuva ekranının hero'su hem de Hub
// kartı buradan okur; böylece karta basıp ekrana girince aynı renk/ikon dilini
// görürsün (mavi=seçim, turuncu/kırmızı=oylama, altın=sonuç, gri=yakında).
// `icon` aynı zamanda hero'daki soluk filigranın şeklidir.

import { copyLanguage } from "../../utils/appLanguages";

export const PHASE_META = {
  selection: {
    tr: "Aday Belirleme", en: "Selection", es: "Selección de candidatos", pt: "Seleção de candidatos", de: "Auswahl", icon: "list",
    color: "#3B82F6",
    gradient: ["#2563EB", "#7C3AED"],
  },
  voting: {
    tr: "Oylama", en: "Voting", es: "Votación", pt: "Votação", de: "Abstimmung", icon: "flame",
    color: "#F59E0B",
    gradient: ["#EA580C", "#DC2626"],
  },
  results: {
    tr: "Sonuçlar", en: "Results", es: "Resultados", pt: "Resultados", de: "Ergebnisse", icon: "trophy",
    color: "#F5C518",
    gradient: ["#D97706", "#F5C518"],
  },
  upcoming: {
    tr: "Yakında", en: "Upcoming", es: "Próximamente", pt: "Em breve", de: "Demnächst", icon: "time",
    color: "#6B7280",
    gradient: ["#4B5563", "#1F2937"],
  },
};

/** Faz adı: dile uygun, yoksa İngilizce (utils/appLanguages kuralı). */
export const phaseLabel = (meta, lang) => meta?.[copyLanguage(lang, ["tr", "en", "es", "pt", "de"])] || meta?.en || "";
