// services/tmdbFacts.js
//
// ID tabanlı TMDB detay çekme — TAŞIMA KABUĞU. İş mantığı yok: hangi öğe için
// istek gerektiği ve gelen gövdeden ne çıkarılacağı utils/mediaFacts.js'te
// (saf, test edilebilir). Burada yalnız cache, tekilleme ve eşzamanlılık var.
//
// tmdbLookup.js NEDEN KULLANILMIYOR: onun girdisi BAŞLIK (AI'nın önerdiği ad),
// cache anahtarı başlık+dil, disk okuması TTL'siz ve fetch tabanlı. Burada
// elimizde id var; başlıkla arama hem gereksiz hem yanlış eşleşme riski.
// Yalnız runtime/tür çıkarma MANTIĞI ortaklaştırıldı (extractMediaFacts).

import { cachedTmdb } from "../utils/cachedRead";
import { mapWithConcurrency } from "./upNextService";
import { extractMediaFacts, factsKey, factsUrl, langOf, pickOverview } from "../utils/mediaFacts";

// `${type}:${id}|${lang}` → Facts | null | Promise
// Promise de saklanır: aynı eser için ikinci istek HİÇ atılmaz (composer arka
// planı ile paylaşım anı telafisi çakışsa bile tek istek gider).
const memo = new Map();
const MEMO_CAP = 300;
const FACTS_TTL = 7 * 24 * 60 * 60 * 1000; // süre/tür neredeyse hiç değişmiyor
const NEG_TTL = 60 * 1000; // başarısız sonuç kalıcı körleşme yapmasın

const memoKey = (id, mediaType, language) => `${factsKey(id, mediaType)}|${langOf(language)}`;

const remember = (key, value) => {
  if (memo.size >= MEMO_CAP) {
    // FIFO: en eski girdi düşer. Map ekleme sırasını koruyor.
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, value);
};

/**
 * Tek bir eserin olgularını çözer. ASLA throw etmez; her hata null döner.
 * @returns {Promise<object|null>}
 */
export async function fetchMediaFacts({ apiKey, id, mediaType, language = "en" }) {
  if (!apiKey || id == null) return null;
  const key = memoKey(id, mediaType, language);

  const cached = memo.get(key);
  if (cached !== undefined) {
    if (cached && typeof cached.then === "function") return cached;
    if (cached === null) return null;
    if (!cached.__negativeUntil || cached.__negativeUntil > Date.now()) return cached;
  }

  const request = (async () => {
    try {
      const { data } = await cachedTmdb(
        factsUrl({ id, mediaType, language }),
        { headers: { accept: "application/json", Authorization: apiKey } },
        {
          maxAge: FACTS_TTL,
          // Kategori AÇIKÇA geçilmeli: verilmezse categoryForNamespace("tmdb")
          // null döner ve kullanıcının "Verileri indir" tercihi yok sayılır.
          category: mediaType === "tv" ? "tvContent" : "movieContent",
        },
      );
      const facts = extractMediaFacts(data, mediaType);
      if (!facts) {
        remember(key, { __negativeUntil: Date.now() + NEG_TTL });
        return null;
      }
      const resolved = { ...facts, resolvedAt: Date.now() };
      remember(key, resolved);
      return resolved;
    } catch {
      remember(key, { __negativeUntil: Date.now() + NEG_TTL });
      return null;
    }
  })();

  remember(key, request);
  return request;
}

/**
 * Eserin ÖZETİNİ (overview) çözer — composer'ın "hızlı ekle" düğmesi için.
 * Olgularla AYNI detay URL'ini ve cache kategorisini kullanır: o eser için
 * hidrasyon zaten çalıştıysa ağa hiç çıkılmaz.
 *
 * TMDB'de birçok eserin Türkçe özeti boş; o zaman İngilizceye düşülür (boş
 * düğme yerine bir şey vermek daha iyi). ASLA throw etmez.
 * @returns {Promise<string|null>} özet; eserde hiç yoksa ""; istek başarısızsa null
 */
export async function fetchMediaOverview({ apiKey, id, mediaType, language = "en" }) {
  if (!apiKey || id == null) return null;
  const read = async (lang) => {
    const { data } = await cachedTmdb(
      factsUrl({ id, mediaType, language: lang }),
      { headers: { accept: "application/json", Authorization: apiKey } },
      {
        maxAge: FACTS_TTL,
        category: mediaType === "tv" ? "tvContent" : "movieContent",
      },
    );
    return pickOverview(data);
  };

  let text;
  try {
    text = await read(language);
  } catch {
    return null;
  }
  if (text || langOf(language) === "en-US") return text;

  // Yedek dil isteği başarısız olsa bile "özet yok" doğru cevap: ilk istek
  // başarılıydı ve gerçekten boş döndü.
  try {
    return await read("en");
  } catch {
    return "";
  }
}

/** Çözülmüş olguyu SENKRON okur (ağa çıkmaz). Cache sıcaksa "boş" aşama olmaz. */
export function peekMediaFacts({ id, mediaType, language = "en" }) {
  const cached = memo.get(memoKey(id, mediaType, language));
  if (!cached || typeof cached.then === "function" || cached.__negativeUntil) return null;
  return cached;
}

/**
 * Hedef listesini toplu çözer. Sonuç Map'i AŞAMALI dolar; `onResolved` her
 * çözülen öğede çağrılır, böylece kartlar tek tek zenginleşir.
 *
 * `timeoutMs` verilirse süre dolunca O ANA KADAR dolmuş Map döner — kısmi iş
 * asla çöpe gitmez. Uçuştaki istekler İPTAL EDİLMEZ: tamamlanıp cache'i
 * doldururlar, bir sonraki açılış bedava olur.
 *
 * @returns {Promise<Map<string, object>>}
 */
export async function fetchMediaFactsBatch(
  targets,
  { apiKey, language = "en", concurrency = 5, limit = 100, timeoutMs = 0, onResolved, isCancelled } = {},
) {
  const result = new Map();
  const list = (Array.isArray(targets) ? targets : []).slice(0, limit);
  if (!apiKey || list.length === 0) return result;

  const run = mapWithConcurrency(list, concurrency, async (target) => {
    if (isCancelled?.()) return null;
    const facts = await fetchMediaFacts({
      apiKey,
      id: target.id,
      mediaType: target.type,
      language,
    });
    if (!facts || isCancelled?.()) return null;
    result.set(factsKey(facts), facts);
    onResolved?.(facts);
    return facts;
  });

  if (timeoutMs > 0) {
    await Promise.race([
      run,
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } else {
    await run;
  }
  return result;
}

/** Yalnız geliştirme/test için. */
export function __resetFactsCache() {
  memo.clear();
}
