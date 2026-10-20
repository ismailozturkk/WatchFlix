// components/profile/yearlyGoalCopy.js
//
// Yıllık izleme hedefi düğmesi (profil başlığındaki halka) ve hedef sayfasının metinleri:
// yerel tr/en/es üçlüsü.
// Anahtar, yer tutucu ve parametre eşitliği __tests__/copyTablesSpanish.test.js'te bekçilenir;
// "tablodaki her anahtar kullanılıyor" kuralı __tests__/yearlyGoalSheet.test.js'te.
//
// Yer tutucular `{ad}` biçimindedir; doldurmak için `fillCopy` (aşağıda). SAYI + İSİM bitişik
// cümle kurulmaz ("1 movies" tuzağı): birim sözcüğü ("film", "movies", "películas") ayrı bir
// ETİKET olarak durur, sayılar yalnız rakam olarak geçer — üç dilde çoğul kuralı yazmak zorunda
// kalmamak için bilinçli. İstisna: gün sayısı (tekil ayrı anahtar).

import { copyLanguage } from "../../utils/appLanguages";

const tr = {
  editLabel: "{year} izleme hedefini düzenle",
  emptyTitle: "{year} hedefini koy",
  ringLabel: "{year} hedefi: {summary}",
  summaryPart: "{name} {count} / {target}",
  tracks: {
    movies: {
      name: "Film",
      unit: "film",
      hint: "Bu yıl izlediğin farklı filmler. Aynı filmi yeniden izlemek bir sayılır.",
    },
    shows: { name: "Dizi" },
  },
  measures: {
    shows: {
      name: "Dizi sayısı",
      unit: "dizi",
      hint: "Bu yıl en az bir bölümünü izlediğin farklı diziler.",
    },
    episodes: {
      name: "Bölüm sayısı",
      unit: "bölüm",
      hint: "Bu yıl izlediğin farklı bölümler. Aynı bölümü yeniden izlemek bir sayılır.",
    },
  },
  overall: {
    ahead: "Tempodan öndesin",
    onTrack: "Tam tempodasın",
    behind: "Tempoda geridesin",
    done: "Hedefe ulaştın",
  },
  pace: {
    ahead: "{n} önde",
    behind: "{n} geride",
    onTrack: "Tempoda",
    done: "Tamam",
  },
  clock: {
    line: "Yıl {pct} tamamlandı · {days}",
    daysLeft: "{n} gün kaldı",
    dayLeft: "1 gün kaldı",
    lastDay: "Son gün",
  },
  stats: {
    soFar: "Şu an {n}",
    planToday: "Plan: bugün {n} olmalı",
    remaining: "Kalan",
    over: "Fazla",
    perWeek: "Haftada",
    perMonth: "Ayda",
    projected: "Yıl sonu",
    none: "—",
  },
  chart: {
    title: "Aylık plan",
    plan: "Ayda ~{n} hedef",
    empty: "Bu yıl henüz izleme yok; çubuklar izledikçe dolar.",
  },
  sheet: {
    title: "{year} izleme hedefi",
    subtitle: "Film ve dizi için ayrı ayrı hedef koyabilirsin.",
    previewTag: "Önizleme",
    toggleMovies: "Film hedefi",
    toggleShows: "Dizi hedefi",
    measureLabel: "Neyi sayalım?",
    decrease: "Hedefi azalt",
    increase: "Hedefi artır",
    needTrack: "Kaydetmek için film ya da dizi hedefinden en az birini aç.",
    noSummary: "Bir hedef aç; ilerleme ve plan burada görünür.",
    save: "Kaydet",
    remove: "Hedefi kaldır",
    close: "Kapat",
    saveFailed: "Hedef kaydedilemedi",
  },
};

const en = {
  editLabel: "Edit {year} watch goal",
  emptyTitle: "Set your {year} goal",
  ringLabel: "{year} goal: {summary}",
  summaryPart: "{name} {count} of {target}",
  tracks: {
    movies: {
      name: "Movies",
      unit: "movies",
      hint: "The different movies you watched this year. Rewatching the same movie counts once.",
    },
    shows: { name: "Shows" },
  },
  measures: {
    shows: {
      name: "Show count",
      unit: "shows",
      hint: "The different shows you watched at least one episode of this year.",
    },
    episodes: {
      name: "Episode count",
      unit: "episodes",
      hint: "The different episodes you watched this year. Rewatching the same episode counts once.",
    },
  },
  overall: {
    ahead: "You're ahead of pace",
    onTrack: "Right on pace",
    behind: "You're behind pace",
    done: "Goal reached",
  },
  pace: {
    ahead: "{n} ahead",
    behind: "{n} behind",
    onTrack: "On pace",
    done: "Done",
  },
  clock: {
    line: "Year {pct} complete · {days}",
    daysLeft: "{n} days left",
    dayLeft: "1 day left",
    lastDay: "Last day",
  },
  stats: {
    soFar: "So far {n}",
    planToday: "Plan: {n} by today",
    remaining: "To go",
    over: "Extra",
    perWeek: "Per week",
    perMonth: "Per month",
    projected: "Year end",
    none: "—",
  },
  chart: {
    title: "Monthly plan",
    plan: "About {n} a month to hit it",
    empty: "Nothing watched yet this year; the bars fill as you watch.",
  },
  sheet: {
    title: "{year} watch goal",
    subtitle: "You can set separate goals for movies and shows.",
    previewTag: "Preview",
    toggleMovies: "Movie goal",
    toggleShows: "Show goal",
    measureLabel: "What do we count?",
    decrease: "Lower the goal",
    increase: "Raise the goal",
    needTrack: "Turn on a movie or show goal to save.",
    noSummary: "Turn on a goal; progress and plan show up here.",
    save: "Save",
    remove: "Remove goal",
    close: "Close",
    saveFailed: "Couldn't save the goal",
  },
};

const es = {
  editLabel: "Editar la meta de visionado {year}",
  emptyTitle: "Fija tu meta {year}",
  ringLabel: "Meta {year}: {summary}",
  summaryPart: "{name} {count} de {target}",
  tracks: {
    movies: {
      name: "Películas",
      unit: "películas",
      hint: "Las películas distintas que has visto este año. Volver a ver la misma cuenta una vez.",
    },
    shows: { name: "Series" },
  },
  measures: {
    shows: {
      name: "N.º de series",
      unit: "series",
      hint: "Las series distintas de las que has visto al menos un episodio este año.",
    },
    episodes: {
      name: "N.º de episodios",
      unit: "episodios",
      hint: "Los episodios distintos que has visto este año. Volver a ver el mismo cuenta una vez.",
    },
  },
  overall: {
    ahead: "Vas por delante del ritmo",
    onTrack: "Justo al ritmo",
    behind: "Vas por detrás del ritmo",
    done: "Meta cumplida",
  },
  pace: {
    ahead: "{n} por delante",
    behind: "{n} por detrás",
    onTrack: "Al ritmo",
    done: "Cumplida",
  },
  clock: {
    line: "Año completado al {pct} · {days}",
    daysLeft: "quedan {n} días",
    dayLeft: "queda 1 día",
    lastDay: "Último día",
  },
  stats: {
    soFar: "Hasta ahora {n}",
    planToday: "Plan: {n} para hoy",
    remaining: "Faltan",
    over: "De más",
    perWeek: "Por semana",
    perMonth: "Por mes",
    projected: "Fin de año",
    none: "—",
  },
  chart: {
    title: "Plan mensual",
    plan: "Unas {n} al mes para lograrlo",
    empty: "Aún no has visto nada este año; las barras se llenan al ver.",
  },
  sheet: {
    title: "Meta de visionado {year}",
    subtitle: "Puedes fijar metas distintas para películas y series.",
    previewTag: "Vista previa",
    toggleMovies: "Meta de películas",
    toggleShows: "Meta de series",
    measureLabel: "¿Qué contamos?",
    decrease: "Reducir la meta",
    increase: "Aumentar la meta",
    needTrack: "Activa una meta de películas o series para guardar.",
    noSummary: "Activa una meta; aquí verás el progreso y el plan.",
    save: "Guardar",
    remove: "Quitar la meta",
    close: "Cerrar",
    saveFailed: "No se pudo guardar la meta",
  },
};

const pt = {
  editLabel: "Editar a meta de visualização {year}",
  emptyTitle: "Defina sua meta {year}",
  ringLabel: "Meta {year}: {summary}",
  summaryPart: "{name} {count} de {target}",
  tracks: {
    movies: {
      name: "Filmes",
      unit: "filmes",
      hint: "Os filmes diferentes que você assistiu este ano. Rever o mesmo conta uma vez.",
    },
    shows: { name: "Séries" },
  },
  measures: {
    shows: {
      name: "Nº de séries",
      unit: "séries",
      hint: "As séries diferentes das quais você assistiu a pelo menos um episódio este ano.",
    },
    episodes: {
      name: "Nº de episódios",
      unit: "episódios",
      hint: "Os episódios diferentes que você assistiu este ano. Rever o mesmo conta uma vez.",
    },
  },
  overall: {
    ahead: "Você está adiantado no ritmo",
    onTrack: "Bem no ritmo",
    behind: "Você está atrasado no ritmo",
    done: "Meta cumprida",
  },
  pace: {
    ahead: "{n} à frente",
    behind: "{n} atrás",
    onTrack: "No ritmo",
    done: "Cumprida",
  },
  clock: {
    line: "Ano concluído em {pct} · {days}",
    daysLeft: "faltam {n} dias",
    dayLeft: "falta 1 dia",
    lastDay: "Último dia",
  },
  stats: {
    soFar: "Até agora {n}",
    planToday: "Plano: {n} para hoje",
    remaining: "Faltam",
    over: "A mais",
    perWeek: "Por semana",
    perMonth: "Por mês",
    projected: "Fim do ano",
    none: "—",
  },
  chart: {
    title: "Plano mensal",
    plan: "Cerca de {n} por mês para chegar lá",
    empty: "Você ainda não assistiu a nada este ano; as barras se enchem conforme você assiste.",
  },
  sheet: {
    title: "Meta de visualização {year}",
    subtitle: "Você pode definir metas diferentes para filmes e séries.",
    previewTag: "Pré-visualização",
    toggleMovies: "Meta de filmes",
    toggleShows: "Meta de séries",
    measureLabel: "O que contamos?",
    decrease: "Diminuir a meta",
    increase: "Aumentar a meta",
    needTrack: "Ative uma meta de filmes ou séries para salvar.",
    noSummary: "Ative uma meta; aqui você verá o progresso e o plano.",
    save: "Salvar",
    remove: "Remover a meta",
    close: "Fechar",
    saveFailed: "Não foi possível salvar a meta",
  },
};

const de = {
  editLabel: "Seh-Ziel {year} bearbeiten",
  emptyTitle: "Setze dein Ziel für {year}",
  ringLabel: "Ziel {year}: {summary}",
  summaryPart: "{name} {count} von {target}",
  tracks: {
    movies: {
      name: "Filme",
      unit: "Filme",
      hint: "Die verschiedenen Filme, die du dieses Jahr gesehen hast. Erneutes Ansehen desselben Films zählt einmal.",
    },
    shows: { name: "Serien" },
  },
  measures: {
    shows: {
      name: "Anzahl der Serien",
      unit: "Serien",
      hint: "Die verschiedenen Serien, von denen du dieses Jahr mindestens eine Folge gesehen hast.",
    },
    episodes: {
      name: "Anzahl der Folgen",
      unit: "Folgen",
      hint: "Die verschiedenen Folgen, die du dieses Jahr gesehen hast. Erneutes Ansehen derselben Folge zählt einmal.",
    },
  },
  overall: {
    ahead: "Du liegst vor dem Plan",
    onTrack: "Genau im Plan",
    behind: "Du liegst hinter dem Plan",
    done: "Ziel erreicht",
  },
  pace: {
    ahead: "{n} voraus",
    behind: "{n} im Rückstand",
    onTrack: "Im Plan",
    done: "Fertig",
  },
  clock: {
    line: "Jahr zu {pct} geschafft · {days}",
    daysLeft: "Noch {n} Tage",
    dayLeft: "Noch 1 Tag",
    lastDay: "Letzter Tag",
  },
  stats: {
    soFar: "Bisher {n}",
    planToday: "Plan: {n} bis heute",
    remaining: "Noch offen",
    over: "Extra",
    perWeek: "Pro Woche",
    perMonth: "Pro Monat",
    projected: "Jahresende",
    none: "—",
  },
  chart: {
    title: "Monatsplan",
    plan: "Etwa {n} pro Monat, um es zu schaffen",
    empty: "Dieses Jahr noch nichts gesehen; die Balken füllen sich, während du schaust.",
  },
  sheet: {
    title: "Seh-Ziel {year}",
    subtitle: "Du kannst getrennte Ziele für Filme und Serien festlegen.",
    previewTag: "Vorschau",
    toggleMovies: "Filmziel",
    toggleShows: "Serienziel",
    measureLabel: "Was zählen wir?",
    decrease: "Ziel senken",
    increase: "Ziel erhöhen",
    needTrack: "Aktiviere ein Film- oder Serienziel, um zu speichern.",
    noSummary: "Aktiviere ein Ziel; Fortschritt und Plan erscheinen hier.",
    save: "Speichern",
    remove: "Ziel entfernen",
    close: "Schließen",
    saveFailed: "Das Ziel konnte nicht gespeichert werden",
  },
};

export const YEARLY_GOAL_COPY = { tr, en, es, pt, de };

/** Uygulama diline uygun tablo (tabloda olmayan dil → İngilizce). */
export const getYearlyGoalCopy = (language) =>
  YEARLY_GOAL_COPY[copyLanguage(language, ["tr", "en", "es", "pt", "de"])];

/** `{ad}` yer tutucularını doldurur; verilmeyen yer tutucu olduğu gibi kalır. */
export const fillCopy = (text, values = {}) =>
  String(text).replace(/\{(\w+)\}/g, (_, key) => (key in values ? String(values[key]) : `{${key}}`));

/** Ondalık gösterim: 1.0 → "1", 2.5 → "2.5" (tr/es virgül). */
export function formatGoalNumber(value, language) {
  const rounded = Math.round(Number(value) * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return copyLanguage(language, ["tr", "en", "es", "pt", "de"]) === "en" ? text : text.replace(".", ",");
}

/** Yüzde gösterimi: tr "%62", diğer diller "62%". */
export const formatPercent = (percent, language) =>
  copyLanguage(language, ["tr", "en", "es", "pt", "de"]) === "tr" ? `%${percent}` : `${percent}%`;

/** Yılın saati satırı: "Yıl %50 tamamlandı · 183 gün kaldı". */
export function describeYearClock(clock, copy, language) {
  let days;
  if (clock.daysLeft <= 0) days = copy.clock.lastDay;
  else if (clock.daysLeft === 1) days = copy.clock.dayLeft;
  else days = fillCopy(copy.clock.daysLeft, { n: clock.daysLeft });
  return fillCopy(copy.clock.line, { pct: formatPercent(clock.percent, language), days });
}

/** Sayılan şeyin birim etiketi: "film" / "dizi" / "bölüm" (dizi hattında ölçüye göre). */
export const unitLabel = (copy, kind) =>
  kind === "movies" ? copy.tracks.movies.unit : copy.measures[kind === "episodes" ? "episodes" : "shows"].unit;

/** Erişilebilirlik özeti: "Film 31 / 50, Dizi 6 / 12". */
export function summarizeTracks(tracks, copy) {
  return tracks
    .map((t) =>
      fillCopy(copy.summaryPart, { name: copy.tracks[t.track].name, count: t.count, target: t.target }),
    )
    .join(", ");
}
