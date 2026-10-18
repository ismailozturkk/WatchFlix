// utils/listPosterLayout.js
//
// Liste ekranlarındaki poster ızgarasının ÖLÇÜ kararları — SAF (RN / i18n importu yok).
// Görsel: components/lists/ListPosterCard.js (ListsScreen + SharedListScreen ortak kullanır).
//
// NEDEN VAR: eski ızgarada poster genişliği modül yüklenirken bir kez okunan `Dimensions.get("window")`dan
// geliyordu (dönme / katlanır ekran / bölünmüş pencerede bayat kalıyordu); TMDB görsel boyutu poster
// genişliğinden bağımsız sabit `200` verilirdi (3'lü ızgarada 110 dp poster için w780 indiriliyordu, bu ~5x
// fazla bayt); rozet yazıları sabit 9 pt'ti (4'lü ızgarada poster dışına taşıyordu); satır yüksekliği
// bilinmediği için FlatList her kaydırmada ölçüyordu. Hepsi buradaki tek hesaptan türer.
//
// BOYUT BASAMAKLARI (poster genişliği, dp): xs <76 · s <100 · m <140 · l ≥140.
// Basamak ne gösterileceğini belirler (rozet yazısı mı yalnız simge mi, başlık kaç punto), böylece hiçbir
// rozet hiçbir posterden taşmaz.

/** TMDB posterleri 2:3. Eski 1.52 değeri görseli ~1,3% kesiyordu. */
export const POSTER_ASPECT = 1.5;
export const GRID_SIDE_PADDING = 12;
export const GRID_COLUMN_GAP = 8;
export const GRID_ROW_GAP = 12;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Pencere genişliği + sütun sayısı → poster genişliği (dp). Sütun [1,6] aralığına çekilir. */
export function posterWidthFor({ windowWidth, columns, sidePadding = GRID_SIDE_PADDING, gap = GRID_COLUMN_GAP }) {
  const cols = clamp(Math.round(Number(columns)) || 3, 1, 6);
  const usable = Number(windowWidth) - sidePadding * 2 - gap * (cols - 1);
  return Math.max(40, usable / cols);
}

export const posterHeightFor = (posterWidth) => posterWidth * POSTER_ASPECT;

/** @returns {"xs"|"s"|"m"|"l"} */
export function tierOf(posterWidth) {
  if (posterWidth < 76) return "xs";
  if (posterWidth < 100) return "s";
  if (posterWidth < 140) return "m";
  return "l";
}

/** Rozet ölçeği: components/PosterInfoBadges.usePillMetrics ile AYNI formül (110 dp = 1). */
export const badgeScaleFor = (posterWidth) => clamp(posterWidth / 110, 0.6, 1.1);

const TITLE_METRICS = {
  xs: { fontSize: 10, lineHeight: 13 },
  s: { fontSize: 11, lineHeight: 14 },
  m: { fontSize: 12, lineHeight: 15 },
  l: { fontSize: 13, lineHeight: 17 },
};
const TITLE_TOP = 6;

/** Başlık satırı ölçüleri (sabit lineHeight → satır yüksekliği önceden bilinir). */
export function titleMetricsFor(posterWidth) {
  return { ...TITLE_METRICS[tierOf(posterWidth)], marginTop: TITLE_TOP };
}

/**
 * Bir ızgara SATIRININ yüksekliği (poster + başlık bloğu + satır boşluğu). FlatList `getItemLayout` için:
 * başlık hep TEK satır ve lineHeight sabit olduğundan satırlar eşit yüksekliktedir.
 */
export function rowHeightFor({ posterWidth, showTitle }) {
  const poster = posterHeightFor(posterWidth);
  const title = showTitle ? TITLE_TOP + TITLE_METRICS[tierOf(posterWidth)].lineHeight : 0;
  return Math.round((poster + title + GRID_ROW_GAP) * 100) / 100;
}

/** Ekran yüksekliğine göre ilk çizilecek satır sayısı (+2 pay): boş alan kalmasın, fazlası da çizilmesin. */
export function initialRowsFor({ windowHeight, rowHeight }) {
  if (!(rowHeight > 0) || !(windowHeight > 0)) return 6;
  return clamp(Math.ceil(windowHeight / rowHeight) + 2, 4, 14);
}

/**
 * TMDB görsel isteği için `getTmdbUrl(path, "poster", expectedWidth)`e verilecek GENİŞLİK. getTmdbUrl bunu
 * kalite çarpanıyla (cihaz piksel oranı) çarpıp en yakın TMDB boyutuna yuvarlar; yani buraya POSTERİN GERÇEK dp
 * genişliği verilmeli. (Eskiden sabit 200 veriliyordu.)
 */
export const imageWidthFor = (posterWidth) => Math.round(posterWidth);

/**
 * Süre rozeti metni — kısa ve sabit biçim: 45 dk → "45 dk", 112 → "1:52", dizi toplamı 85 saat → "85 sa".
 * (Eskiden "112 dk" / "85 sa 20 dk" uzun yazılıyor ve 4'lü ızgarada taşıyordu.)
 * @param {number} minutes
 * @param {"movie"|"tv"} type
 * @param {{hour?:string, minute?:string}} [labels]
 */
export function durationBadgeText(minutes, type, { hour = "sa", minute = "dk" } = {}) {
  const total = Math.round(Number(minutes));
  if (!(total > 0)) return null;
  if (total < 60) return `${total} ${minute}`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (type === "tv" && h >= 10) return `${h} ${hour}`;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Dizi izleme ilerlemesi: oran [0,1], bitti mi, "12/24" metni. Toplam bilinmiyorsa null. */
export function watchProgressOf(watched, total) {
  const done = Math.max(0, Number(watched) || 0);
  const all = Number(total);
  if (!(all > 0)) return null;
  return { ratio: clamp(done / all, 0, 1), complete: done >= all, label: `${Math.min(done, all)}/${all}` };
}

/**
 * Hangi rozetler çizilsin? Ayarlar (`info`) + basamak + veri. Çıktı yalnız kararlar:
 *  - typeLabel   : tür rozetinde yazı da olsun mu (xs/s'de yalnız simge)
 *  - durationText: süre rozeti metni (ayar kapalıysa / süre yoksa null)
 *  - progressText: dizi ilerleme yazısı ("12/24") yalnız m ve l'de
 */
export function badgePlanOf({ info = {}, posterWidth, type, durationMinutes, progress }) {
  const tier = tierOf(posterWidth);
  const durationText = info.duration ? durationBadgeText(durationMinutes, type) : null;
  return {
    tier,
    showType: !!info.mediaType,
    typeLabel: tier === "m" || tier === "l",
    durationText,
    showProgress: !!progress,
    progressText: (tier === "m" || tier === "l") && !!progress,
  };
}

/** Basılı poster ölçeği: küçük posterde daha belirgin değil, büyükte hafif. */
export const PRESS_SCALE = 0.96;

/** Liste öğesinin ızgara anahtarı: film ve dizi AYNI TMDB id'sini paylaşabilir (eskiden yalnız id). */
export const posterKeyOf = (item) => `${item?.type === "tv" ? "tv" : "movie"}:${item?.id}`;
