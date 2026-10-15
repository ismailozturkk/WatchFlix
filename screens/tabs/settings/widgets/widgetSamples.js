// screens/tabs/settings/widgets/widgetSamples.js
//
// Önizlemelerde gösterilen ÖRNEK veri (saf modül).
//
// Önceden satırlar sabit "Bugün / 30 Tem / 3 gün" gibi Türkçe metinlerdi: İngilizce
// kullanan biri önizlemede Türkçe geri sayım görüyordu ve tarihler hiçbir zaman
// bugüne denk gelmiyordu. Burada geri sayım ve kısa tarih, widget'ın kendi yazdığı
// biçimde (ReminderWidgetRemoteViewsService.kt: `countdown`, `shortDate` = "d MMM")
// BUGÜNDEN türetilir; böylece "Bugün" satırı gerçekten bugündür.

const MONTHS = {
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
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

/** ReminderWidgetRemoteViewsService.kt `countdown` ile aynı metinler. */
export const countdownLabel = (days, isTr) => {
  if (days <= 0) return isTr ? "Bugün" : "Today";
  if (days === 1) return isTr ? "Yarın" : "Tomorrow";
  return isTr ? `${days} gün` : `${days} days`;
};

/** `SimpleDateFormat("d MMM")` karşılığı. */
export const shortDate = (date, isTr) =>
  `${date.getDate()} ${MONTHS[isTr ? "tr" : "en"][date.getMonth()]}`;

/**
 * @param {{ now?: Date, isTr: boolean }} options
 * @returns {{ id: string, title: string, type: "movie"|"tv", sub: string,
 *   daysLeft: number, when: string, date: string }[]}
 */
export function buildReminderSamples({ now = new Date(), isTr }) {
  return REMINDER_TEMPLATES.map((template, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + template.offset);
    const sub =
      template.type === "tv"
        ? isTr
          ? `S${template.season} · ${template.episode}. Bölüm`
          : `S${template.season} · Episode ${template.episode}`
        : "";
    return {
      id: `sample-${index}`,
      title: template.title,
      type: template.type,
      sub,
      daysLeft: template.offset,
      when: countdownLabel(template.offset, isTr),
      date: shortDate(day, isTr),
    };
  });
}

/** Listelerim örnekleri (iOS satırları ve Android liste adı). Sayılar listsWidgetService şekliyle aynı. */
export function buildListSamples({ isTr }) {
  return [
    { id: "watchedTv", name: isTr ? "İzlenen Diziler" : "Watched Series", icon: "tv", count: 37 },
    { id: "watchedMovies", name: isTr ? "İzlenen Filmler" : "Watched Movies", icon: "film", count: 184 },
    { id: "watchList", name: isTr ? "İzlenecekler" : "Watchlist", icon: "bookmark", count: 52 },
    { id: "favorites", name: isTr ? "Favoriler" : "Favorites", icon: "heart", count: 24 },
    { id: "custom1", name: isTr ? "Hafta Sonu Filmleri" : "Weekend Movies", icon: "list", count: 12 },
    { id: "custom2", name: isTr ? "Korku Gecesi" : "Horror Night", icon: "list", count: 9 },
    { id: "custom3", name: isTr ? "Animeler" : "Anime", icon: "list", count: 15 },
    { id: "custom4", name: isTr ? "Kısa Filmler" : "Short Films", icon: "list", count: 6 },
  ];
}
