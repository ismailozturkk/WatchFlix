// components/comments/scopeTexts.js
//
// Kapsam (dizi / sezon / bölüm) etiketlerinin TEK i18n kaynağı.
// utils/commentScope.js bilinçli olarak saf JS'tir (jest ile test edilir), bu
// yüzden kullanıcıya görünen metinler burada toplanır ve oraya parametre
// olarak geçirilir.
//
// NOT: Biçim dizgelerinde TEK süslü parantez kullanılır ({season}) — i18next'in
// ayracı çift süslüdür ve dışarıdan değişken almayan bir anahtarda `{{season}}`
// boş dizgeye çevrilirdi.

import { i18nText } from "../../utils/i18nText";
import {
  shortScopeLabel,
  longScopeLabel,
  filterLabel,
} from "../../utils/commentScope";

/** longScopeLabel / filterLabel için metin paketi. */
export const scopeTexts = () => ({
  all: i18nText("autoI18n.tumu", "Tümü"),
  show: i18nText("autoI18n.dizi_geneli", "Dizi geneli"),
  season: i18nText("autoI18n.sezon_no", "{season}. Sezon"),
  episode: i18nText(
    "autoI18n.sezon_bolum_no",
    "{season}. Sezon · {episode}. Bölüm",
  ),
  seasonOnly: i18nText("autoI18n.sezon_geneli_no", "{season}. Sezon (genel)"),
});

/** shortScopeLabel için kısa önek paketi (tr: S/B, en: S/E). */
// autoI18n.dizi ("TV Show") rozete sığmaz — kısa varyant ayrı anahtarda.
export const scopeShortLabels = () => ({
  show: i18nText("autoI18n.dizi_kisa", "Dizi"),
  seasonPrefix: i18nText("autoI18n.sezon_onek", "S"),
  episodePrefix: i18nText("autoI18n.bolum_onek", "B"),
});

export const scopeShort = (scope) => shortScopeLabel(scope, scopeShortLabels());
export const scopeLong = (scope) => longScopeLabel(scope, scopeTexts());
export const scopeFilterLabel = (filter) => filterLabel(filter, scopeTexts());

/** "5. Bölüm" — kapsam sayfasındaki bölüm satırı. */
export const episodeRowLabel = (episodeNumber) =>
  i18nText("autoI18n.bolum_no", "{episode}. Bölüm").replace(
    /\{\{?\s*episode\s*\}?\}/g,
    String(episodeNumber),
  );

/** Sezon adı TMDB'den gelmiyorsa "2. Sezon"a düşer. */
export const seasonRowLabel = (seasonNumber, name) => {
  const fallback = i18nText("autoI18n.sezon_no", "{season}. Sezon").replace(
    /\{\{?\s*season\s*\}?\}/g,
    String(seasonNumber),
  );
  if (seasonNumber === 0) {
    return name || i18nText("autoI18n.ozel_bolumler", "Özel bölümler");
  }
  return name && name !== fallback ? `${fallback} · ${name}` : fallback;
};
