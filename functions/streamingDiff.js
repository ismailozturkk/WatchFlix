// functions/streamingDiff.js
//
// SAF (bağımsız) yardımcılar — TMDB "watch/providers" yanıtından bölgeye göre
// izlenebilir sağlayıcı id'lerini çıkarır ve bir izleme-listesi öğesinin
// snapshot'ına göre "yeni gelen" (kullanıcının abone olduğu) sağlayıcıları
// hesaplar. React/Firebase'den bağımsız → jest ile test edilir
// (__tests__/streamingDiff.test.js). dailyStreamingAvailability bunu kullanır.

"use strict";

/**
 * TMDB /{movie|tv}/{id}/watch/providers yanıtından bir bölgenin ABONELİKLE
 * (flatrate) + ücretsiz (free) + reklamlı-ücretsiz (ads) izlenebilir sağlayıcı
 * id'lerini çıkarır. Kiralama/satın alma (rent/buy) DAHİL EDİLMEZ — para
 * gerektirir, "artık izlenebilir" sayılmaz.
 *
 * @param {any} providersResponse  TMDB yanıtı ({ results: { TR: {...}, ... } })
 * @param {string} region          "TR" | "US" | ...
 * @returns {{ ids: number[], names: Record<number,string> }}
 */
function extractRegionProviders(providersResponse, region) {
  const results = providersResponse && providersResponse.results;
  const regionData = results && region ? results[region] : null;
  const names = {};
  const idSet = new Set();

  if (regionData) {
    for (const key of ["flatrate", "free", "ads"]) {
      const list = Array.isArray(regionData[key]) ? regionData[key] : [];
      for (const p of list) {
        const id = Number(p && p.provider_id);
        if (Number.isInteger(id) && id > 0) {
          idSet.add(id);
          if (p && p.provider_name) names[id] = String(p.provider_name);
        }
      }
    }
  }

  return { ids: [...idSet].sort((a, b) => a - b), names };
}

/**
 * Bir izleme-listesi öğesi için "yeni bildirilecek" sağlayıcıları hesaplar.
 *
 * Kurallar:
 *  - Sağlayıcı p, YALNIZCA şu an izlenebilir (current) VE kullanıcının abone
 *    olduğu (subscribed) VE daha önce YOKKEN yeni gelen (prev'de yok) VE daha
 *    önce bildirilmemiş (notified'da yok) ise bildirilir.
 *  - hasPrev=false (öğeyi ilk kez görüyoruz) → HİÇBİR bildirim yok; yalnız
 *    baseline kaydedilir. Böylece kullanıcı listeye eklediğinde zaten var olan
 *    sağlayıcılar "yeni" sayılmaz (spam önlenir); yalnız SONRADAN eklenenler
 *    bildirilir.
 *  - Artık izlenebilir olmayan sağlayıcı notified'dan düşer → tekrar gelirse
 *    yeniden bildirilebilir.
 *
 * @param {Object} args
 * @param {number[]}  args.currentIds     Şu anki bölge sağlayıcı id'leri
 * @param {number[]} [args.prevIds]       Son bilinen sağlayıcı id'leri (snapshot)
 * @param {number[]} [args.notifiedIds]   Daha önce bildirilen sağlayıcı id'leri
 * @param {number[]}  args.subscribedIds  Kullanıcının abone olduğu sağlayıcılar
 * @param {boolean}   args.hasPrev        Bu öğe için snapshot var mıydı?
 * @returns {{ toNotify: number[], availableIds: number[], notifiedIds: number[] }}
 */
function computeNewlyAvailable(args) {
  const current = new Set((args.currentIds || []).map(Number));
  const prev = new Set((args.prevIds || []).map(Number));
  const subscribed = new Set((args.subscribedIds || []).map(Number));
  const notified = new Set((args.notifiedIds || []).map(Number));
  const hasPrev = !!args.hasPrev;

  const availableIds = [...current].sort((a, b) => a - b);

  let toNotify = [];
  if (hasPrev) {
    toNotify = availableIds.filter(
      (id) => subscribed.has(id) && !prev.has(id) && !notified.has(id),
    );
  }

  // Bildirilenler kümesi: yeni bildirilenleri ekle, ama artık İZLENEBİLİR
  // OLMAYANLARI düş (tekrar gelirse yeniden bildirilebilsin).
  const nextNotified = [...new Set([...notified, ...toNotify])]
    .filter((id) => current.has(id))
    .sort((a, b) => a - b);

  return { toNotify, availableIds, notifiedIds: nextNotified };
}

module.exports = { extractRegionProviders, computeNewlyAvailable };
