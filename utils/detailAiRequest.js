import { i18nText } from "./i18nText";

export const DETAIL_AI_ACTION = Object.freeze({ INFO: "info", SIMILAR: "similar" });

// TMDB film ve dizi `keywords` ekleri farklı alan adları kullanır.
export function detailAiKeywords(details) {
  const payload = details?.keywords;
  const items = Array.isArray(payload) ? payload : payload?.keywords || payload?.results;
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => typeof item === "string" ? item : item?.name)
    .filter((name) => typeof name === "string" && name.trim())
    .map((name) => name.trim())
    .slice(0, 20);
}

// Sohbet balonundaki kısa metin ile modele gönderilen ayrıntılı istek ayrı tutulur.
export function buildDetailAiRequest(mediaType, title, releaseDate, action = DETAIL_AI_ACTION.INFO) {
  if (!title) return { prompt: "", display: "" };
  const year = releaseDate ? ` (${String(releaseDate).slice(0, 4)})` : "";
  const namedTitle = `${title}${year}`;
  const isTv = mediaType === "tv";

  if (action === DETAIL_AI_ACTION.SIMILAR) {
    return isTv
      ? {
          prompt: i18nText(
            "autoI18n.dizi_ai_similar_prompt",
            "{{title}} dizisine gerçekten benzeyen en fazla 5 gerçek dizi öner. Önce ana olay örgüsünü, karakterlerin hedefini ve çatışmasını, ayırt edici tema ve motifleri karşılaştır; genel tür etiketleri tek başına benzerlik sayılmaz. Her öneri için somut hikâye benzerliğini kısaca açıkla. Güçlü eşleşme yoksa listeyi kısalt. Bu diziyi tekrar önerme ve spoiler verme.",
            { title: namedTitle },
          ),
          display: i18nText("autoI18n.dizi_ai_similar_display", "Bu diziye benzer öneriler verir misin?"),
        }
      : {
          prompt: i18nText(
            "autoI18n.film_ai_similar_prompt",
            "{{title}} filmine gerçekten benzeyen en fazla 5 gerçek film öner. Önce ana olay örgüsünü, karakterlerin hedefini ve çatışmasını, ayırt edici tema ve motifleri karşılaştır; genel tür etiketleri tek başına benzerlik sayılmaz. Her öneri için somut hikâye benzerliğini kısaca açıkla. Güçlü eşleşme yoksa listeyi kısalt. Bu filmi tekrar önerme ve spoiler verme.",
            { title: namedTitle },
          ),
          display: i18nText("autoI18n.film_ai_similar_display", "Bu filme benzer öneriler verir misin?"),
        };
  }

  return isTv
    ? {
        prompt: i18nText(
          "autoI18n.dizi_ai_prompt",
          "{{title}} dizisi hakkında spoiler vermeden bilgi ver. Konusu, türü, sezon yapısı, öne çıkan oyuncuları, atmosferi, kimlere uygun olduğu ve neden izlenebileceğini kısa başlıklarla anlat.",
          { title: namedTitle },
        ),
        display: i18nText("autoI18n.dizi_ai_display", "Bu dizi hakkında bilgi verir misin?"),
      }
    : {
        prompt: i18nText(
          "autoI18n.film_ai_prompt",
          "{{title}} filmi hakkında spoiler vermeden bilgi ver. Konusu, türü, öne çıkan oyuncuları, atmosferi, kimlere uygun olduğu ve neden izlenebileceğini kısa başlıklarla anlat.",
          { title: namedTitle },
        ),
        display: i18nText("autoI18n.film_ai_display", "Bu film hakkında bilgi verir misin?"),
      };
}
