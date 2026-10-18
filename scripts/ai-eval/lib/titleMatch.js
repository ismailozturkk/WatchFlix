// scripts/ai-eval/lib/titleMatch.js
//
// Model çıktısındaki başlığı TMDB adlarıyla KATI biçimde eşleştirmek için
// yardımcılar. Uygulamadaki tmdbLookup, arama sonucu varsa her zaman "found"
// döner (en popüler sonucu alır); bu yüzden uydurma bir başlık da kart
// olarak görünebilir. Burada ölçülen şey: başlık gerçekten var mı?

/** Karşılaştırma için başlığı sadeleştirir (aksan, noktalama, baştaki tanımlık, "(2021)" eki). */
export function foldTitle(value) {
  return String(value ?? "")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\s*\((?:19|20)\d{2}\)\s*$/, " ")
    .replace(/[ -⁯　-〿]/g, " ")
    .replace(/[^a-z0-9\u0080-￿]+/g, " ")
    .trim()
    .replace(/^(?:the|a|an|el|la|los|las|le|les|der|die|das|il|lo|gli)\s+(?=\S)/, "");
}

/** 0–1 arası benzerlik (Levenshtein). */
export function similarity(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

/**
 * @returns {"exact"|"close"|null} Sorgu, adaylardan biriyle eşleşiyor mu?
 *   "close": noktalama/yazım farkı (en az 5 karakterlik başlıklarda %88 benzerlik).
 */
export function matchTitle(query, names) {
  const q = foldTitle(query);
  if (!q) return null;
  let best = null;
  for (const name of names || []) {
    const f = foldTitle(name);
    if (!f) continue;
    if (f === q) return "exact";
    if (Math.min(f.length, q.length) >= 5 && similarity(f, q) >= 0.88) best = "close";
  }
  return best;
}
