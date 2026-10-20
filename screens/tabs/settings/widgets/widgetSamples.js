// screens/tabs/settings/widgets/widgetSamples.js
//
// Önizlemelerde gösterilen ÖRNEK veri (saf modül).
//
// Önceden satırlar sabit "Bugün / 30 Tem / 3 gün" gibi Türkçe metinlerdi: İngilizce
// kullanan biri önizlemede Türkçe geri sayım görüyordu ve tarihler hiçbir zaman
// bugüne denk gelmiyordu. Burada geri sayım ve kısa tarih, widget'ın kendi yazdığı
// biçimde (ReminderWidgetRemoteViewsService.kt: `countdown`, `shortDate` = "d MMM")
// BUGÜNDEN türetilir; böylece "Bugün" satırı gerçekten bugündür.

import { legacyFlagToLanguage, pickByLanguage } from "../../../../utils/appLanguages";

const MONTHS = {
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  de: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
};

const REMINDER_TEMPLATES = [
  { title: "Spider-Man: Brand New Day", type: "movie", offset: 0 },
  { title: "Silo", type: "tv", season: 3, episode: 5, offset: 1 },
  { title: "House of the Dragon", type: "tv", season: 3, episode: 7, offset: 3 },
  { title: "Dune: Part Three", type: "movie", offset: 6 },
  { title: "Silo", type: "tv", season: 3, episode: 6, offset: 7 },
  { title: "The Batman: Part II", type: "movie", offset: 12 },
  { title: "Severance", type: "tv", season: 3, episode: 1, offset: 18 },
  { title: "Avatar: Fire and Ash", type: "movie", offset: 24 },
];

/** Eski çağrılar `isTr` boolean'ı geçiyordu; artık uygulama dili ("tr" | "en" | "es") da kabul edilir. */
const langOf = legacyFlagToLanguage;

/** ReminderWidgetRemoteViewsService.kt `countdown` ile aynı metinler. */
export const countdownLabel = (days, isTr) => {
  const lang = langOf(isTr);
  if (days <= 0) return pickByLanguage(lang, { tr: "Bugün", en: "Today", es: "Hoy", pt: "Hoje", de: "Heute" });
  if (days === 1) return pickByLanguage(lang, { tr: "Yarın", en: "Tomorrow", es: "Mañana", pt: "Amanhã", de: "Morgen" });
  return pickByLanguage(lang, { tr: `${days} gün`, en: `${days} days`, es: `${days} días`, pt: `${days} dias`, de: `${days} Tage` });
};

/** `SimpleDateFormat("d MMM")` karşılığı. */
export const shortDate = (date, isTr) =>
  `${date.getDate()} ${pickByLanguage(langOf(isTr), MONTHS)[date.getMonth()]}`;

/**
 * @param {{ now?: Date, isTr: boolean|string }} options  isTr: boolean (eski) ya da dil kodu
 * @returns {{ id: string, title: string, type: "movie"|"tv", sub: string,
 *   daysLeft: number, when: string, date: string }[]}
 */
export function buildReminderSamples({ now = new Date(), isTr }) {
  const lang = langOf(isTr);
  return REMINDER_TEMPLATES.map((template, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + template.offset);
    const sub =
      template.type === "tv"
        ? pickByLanguage(lang, {
            tr: `S${template.season} · ${template.episode}. Bölüm`,
            en: `S${template.season} · Episode ${template.episode}`,
            es: `T${template.season} · Episodio ${template.episode}`,
            pt: `T${template.season} · Episódio ${template.episode}`,
            de: `S${template.season} · Folge ${template.episode}`,
          })
        : "";
    return {
      id: `sample-${index}`,
      title: template.title,
      type: template.type,
      sub,
      daysLeft: template.offset,
      when: countdownLabel(template.offset, lang),
      date: shortDate(day, lang),
    };
  });
}

/** Listelerim örnekleri (iOS satırları ve Android liste adı). Sayılar listsWidgetService şekliyle aynı. */
export function buildListSamples({ isTr }) {
  const lang = langOf(isTr);
  const L = (tr, en, es, pt, de) => pickByLanguage(lang, { tr, en, es, pt: pt ?? en, de: de ?? en });
  return [
    { id: "watchedTv", name: L("İzlenen Diziler", "Watched Series", "Series vistas", "Séries assistidas", "Gesehene Serien"), icon: "tv", count: 37 },
    { id: "watchedMovies", name: L("İzlenen Filmler", "Watched Movies", "Películas vistas", "Filmes assistidos", "Gesehene Filme"), icon: "film", count: 184 },
    { id: "watchList", name: L("İzlenecekler", "Watchlist", "Lista de seguimiento", "Lista para assistir", "Merkliste"), icon: "bookmark", count: 52 },
    { id: "favorites", name: L("Favoriler", "Favorites", "Favoritos", "Favoritos", "Favoriten"), icon: "heart", count: 24 },
    { id: "custom1", name: L("Hafta Sonu Filmleri", "Weekend Movies", "Películas de fin de semana", "Filmes de fim de semana", "Wochenend-Filme"), icon: "list", count: 12 },
    { id: "custom2", name: L("Korku Gecesi", "Horror Night", "Noche de terror", "Noite de terror", "Horrornacht"), icon: "list", count: 9 },
    { id: "custom3", name: L("Animeler", "Anime", "Anime", "Anime", "Anime"), icon: "list", count: 15 },
    { id: "custom4", name: L("Kısa Filmler", "Short Films", "Cortometrajes", "Curtas-metragens", "Kurzfilme"), icon: "list", count: 6 },
  ];
}
