// services/tournamentEngine.js
//
// AYLIK TURNUVA — SAF (deterministik) motor. Burada Firebase/ağ YOKTUR.
// Tüm bracket durumu (seed eşleşmeleri, kazananlar, şampiyon, faz, geri sayım)
// SADECE şu üç girdiden türetilir:
//   1) periodId ("YYYY-MM")           → hangi ay / hangi tür (sabit takvim)
//   2) o ayın aday listesi (nominees) → TMDB top-32, bir kez snapshot'lanır
//   3) toplanan oylar (votes)         → maç başına a/b sayımı
//
// Backend olmadığı için "turu ilerletmek" diye bir yazma yoktur: her istemci
// aynı kuralla aynı sonucu hesaplar. Bu dosya tek doğruluk kaynağıdır.

// ─── Zaman yardımcıları ───────────────────────────────────────────────────────
export const DAY = 24 * 60 * 60 * 1000;

// Test/önizleme için "şimdi" geçersiz kılınabilir (ör. ileri bir güne sarıp
// voting fazını görmek). __DEV__ dışında da çalışır ama yalnız geliştirici çağırır.
let _debugNowMs = null;
export const setDebugNow = (ms) => { _debugNowMs = ms == null ? null : Number(ms); };
export const getDebugNow = () => _debugNowMs;
export const now = () => (_debugNowMs == null ? Date.now() : _debugNowMs);

const pad2 = (n) => String(n).padStart(2, "0");

// ─── 12 aylık tür takvimi ─────────────────────────────────────────────────────
// monthIndex 0=Ocak ... 11=Aralık. mediaType film/dizi DÖNÜŞÜMLÜ (Ocak'ta TV ile
// başlar); böylece her TV ayı GEÇERLİ bir TMDB TV genre'ına denk gelir
// (TMDB'de film ve TV genre id'leri farklıdır; Korku/Romantik/Gerilim'in TV
// karşılığı yoktur → bunlar film aylarına düşer). sortBy, aynı TV genre'ına
// düşen iki ayı (SciFi/Fantastik=10765, Aksiyon/Macera=10759) farklılaştırır.
export const SCHEDULE = [
  { monthIndex: 0,  tr: "Bilim Kurgu", en: "Sci-Fi",     mediaType: "tv",    genreId: 10765, sortBy: "popularity.desc" },
  { monthIndex: 1,  tr: "Romantik",    en: "Romance",    mediaType: "movie", genreId: 10749, sortBy: "popularity.desc" },
  { monthIndex: 2,  tr: "Aksiyon",     en: "Action",     mediaType: "tv",    genreId: 10759, sortBy: "popularity.desc" },
  { monthIndex: 3,  tr: "Komedi",      en: "Comedy",     mediaType: "movie", genreId: 35,    sortBy: "popularity.desc" },
  { monthIndex: 4,  tr: "Macera",      en: "Adventure",  mediaType: "tv",    genreId: 10759, sortBy: "vote_count.desc"  },
  { monthIndex: 5,  tr: "Suç",         en: "Crime",      mediaType: "movie", genreId: 80,    sortBy: "popularity.desc" },
  { monthIndex: 6,  tr: "Animasyon",   en: "Animation",  mediaType: "tv",    genreId: 16,    sortBy: "popularity.desc" },
  { monthIndex: 7,  tr: "Gerilim",     en: "Thriller",   mediaType: "movie", genreId: 53,    sortBy: "popularity.desc" },
  { monthIndex: 8,  tr: "Dram",        en: "Drama",      mediaType: "tv",    genreId: 18,    sortBy: "popularity.desc" },
  { monthIndex: 9,  tr: "Korku",       en: "Horror",     mediaType: "movie", genreId: 27,    sortBy: "popularity.desc" },
  { monthIndex: 10, tr: "Fantastik",   en: "Fantasy",    mediaType: "tv",    genreId: 10765, sortBy: "vote_count.desc"  },
  { monthIndex: 11, tr: "Aile",        en: "Family",     mediaType: "movie", genreId: 10751, sortBy: "popularity.desc" },
];

const MONTHS_TR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export const getScheduleEntry = (monthIndex) => SCHEDULE[((monthIndex % 12) + 12) % 12];
export const themeLabel = (entry, lang) => (lang === "tr" ? entry?.tr : entry?.en) || entry?.en || "";
export const monthLabel = (monthIndex, lang) =>
  (lang === "tr" ? MONTHS_TR : MONTHS_EN)[((monthIndex % 12) + 12) % 12];
export const mediaLabel = (mediaType, lang) =>
  mediaType === "tv"
    ? (lang === "tr" ? "Dizi" : "TV")
    : (lang === "tr" ? "Film" : "Movie");

// ─── Tur tanımları ────────────────────────────────────────────────────────────
// startDay/endDay = ayın başından gün ofseti. Her erken tur 2 gün, final 6 gün.
// 16+8+4+2 = 30 maç + 1 final = 31 maç toplam.
export const SELECTION_DAYS = 7;
export const RESULTS_START_DAY = 21;
export const ROUNDS = [
  { key: "r32",   tr: "Son 32",       en: "Round of 32",  matches: 16, startDay: 7,  endDay: 9  },
  { key: "r16",   tr: "Son 16",       en: "Round of 16",  matches: 8,  startDay: 9,  endDay: 11 },
  { key: "qf",    tr: "Çeyrek Final", en: "Quarterfinals", matches: 4, startDay: 11, endDay: 13 },
  { key: "sf",    tr: "Yarı Final",   en: "Semifinals",   matches: 2,  startDay: 13, endDay: 15 },
  { key: "final", tr: "Final",        en: "Final",        matches: 1,  startDay: 15, endDay: 21 },
];
export const roundLabel = (round, lang) => (lang === "tr" ? round?.tr : round?.en) || round?.en || "";

// ─── Period (ay) yardımcıları ─────────────────────────────────────────────────
export function getPeriodId(ms = now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
export function parsePeriodId(periodId) {
  const [y, m] = String(periodId || "").split("-").map((x) => parseInt(x, 10));
  return { year: y, monthIndex: (m || 1) - 1 };
}
// Önceki ayın periodId'si ("öne çıkan şampiyon" geçen aydan gösterilirken).
export function getPrevPeriodId(periodId) {
  const { year, monthIndex } = parsePeriodId(periodId);
  const d = new Date(year, monthIndex - 1, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
export function getPeriodStartMs(periodId) {
  const { year, monthIndex } = parsePeriodId(periodId);
  return new Date(year, monthIndex, 1, 0, 0, 0, 0).getTime();
}
export function getPeriodEndMs(periodId) {
  const { year, monthIndex } = parsePeriodId(periodId);
  return new Date(year, monthIndex + 1, 1, 0, 0, 0, 0).getTime();
}
export function getElapsedDays(periodId, ms = now()) {
  return (ms - getPeriodStartMs(periodId)) / DAY;
}

// ─── Faz / aktif tur ──────────────────────────────────────────────────────────
export function getPhase(periodId, ms = now()) {
  const e = getElapsedDays(periodId, ms);
  if (e < 0) return "upcoming";
  if (e < SELECTION_DAYS) return "selection";
  if (e < RESULTS_START_DAY) return "voting";
  return "results";
}
// Voting fazında oy verilebilen tur indeksi (0-4); selection'da -1, results'ta ROUNDS.length.
export function getActiveRoundIndex(periodId, ms = now()) {
  const e = getElapsedDays(periodId, ms);
  if (e < SELECTION_DAYS) return -1;
  if (e >= RESULTS_START_DAY) return ROUNDS.length;
  for (let r = 0; r < ROUNDS.length; r++) {
    if (e >= ROUNDS[r].startDay && e < ROUNDS[r].endDay) return r;
  }
  return ROUNDS.length;
}

// Faz + sıradaki son tarih (geri sayım için).
export function getPhaseInfo(periodId, ms = now()) {
  const phase = getPhase(periodId, ms);
  const activeRound = getActiveRoundIndex(periodId, ms);
  const startMs = getPeriodStartMs(periodId);
  let nextDeadlineMs;
  if (phase === "selection" || phase === "upcoming") {
    nextDeadlineMs = startMs + SELECTION_DAYS * DAY;        // oylama başlangıcı
  } else if (phase === "voting") {
    nextDeadlineMs = startMs + ROUNDS[activeRound].endDay * DAY; // aktif tur bitişi
  } else {
    nextDeadlineMs = getPeriodEndMs(periodId);              // ay sonu
  }
  return { phase, activeRound, nextDeadlineMs, msToNext: Math.max(0, nextDeadlineMs - ms) };
}

// ─── Aday belirleme (nomination / "hype") oylaması ────────────────────────────
// SELECTION fazında kullanıcılar havuzdaki adaylara hype verir; EN ÇOK HYPE
// ALAN 32 yapı turnuvaya katılır. Oylar picks gibi kullanıcı başına TEK
// dokümanda, `noms: { [nomineeId]: true }` map'inde tutulur.
//
// TEK OY MODELİ: kullanıcı başına TEK hype hakkı vardır ve seçim KESİNDİR
// (değiştirilemez/geri alınamaz) — eleme maç oylarıyla aynı kural. Sunucu
// tarafı yaptırım firestore.rules'ta (noms'a yalnız İLK anahtar eklenebilir).
// tallyNominations tüm anahtarları saymaya devam eder ki eski ayların (10 hak
// dönemindeki) bracket'ları retroaktif DEĞİŞMESİN.
// Havuzu ≤32 olan ESKİ aylar için davranış DEĞİŞMEZ: selectFinalists listeyi
// olduğu gibi döner, geçmiş bracket'lar aynı kalır.
export const FINALIST_COUNT = 32;
export const MAX_NOMINATIONS = 1; // kullanıcı başına hype (aday oyu) hakkı

// voteDocs → { [nomineeId]: oySayısı }
export function tallyNominations(voteDocs = []) {
  const t = {};
  for (const v of voteDocs) {
    const noms = v?.noms;
    if (!noms) continue;
    for (const id of Object.keys(noms)) {
      if (!noms[id]) continue;
      t[id] = (t[id] || 0) + 1;
    }
  }
  return t;
}

// Tek kullanıcının aday oyları → Set("id")
export function getMyNominations(voteDocs = [], uid) {
  const me = voteDocs.find((v) => (v.uid || v.id) === uid);
  const noms = me?.noms || {};
  return new Set(Object.keys(noms).filter((k) => noms[k]));
}

// Havuzu oy sayısına göre sırala (oy desc → havuz seed asc) ve her adaya
// { nomVotes, rank, finalist } ekle. Seçim ekranındaki canlı sıralama bundan çizilir.
export function rankPool(nominees = [], nomTally = {}) {
  return [...nominees]
    .sort((a, b) => {
      const av = nomTally[String(a.id)] || 0;
      const bv = nomTally[String(b.id)] || 0;
      if (av !== bv) return bv - av;
      return (a.seed || 0) - (b.seed || 0);
    })
    .map((n, i) => ({
      ...n,
      nomVotes: nomTally[String(n.id)] || 0,
      rank: i + 1,
      finalist: i < FINALIST_COUNT,
    }));
}

// Havuz > 32 ise ilk 32'yi al ve 1..32 olarak YENİDEN seed'le (bracket eşleşmeleri
// bu yeni seed'lerden türer; orijinal havuz sırası poolSeed'de saklanır).
// Havuz ≤ 32 ise (eski aylar / henüz yükseltilmemiş doküman) dokunma.
export function selectFinalists(nominees = [], nomTally = {}) {
  if (!Array.isArray(nominees) || nominees.length <= FINALIST_COUNT) return nominees;
  return rankPool(nominees, nomTally)
    .slice(0, FINALIST_COUNT)
    .map((n, i) => ({ ...n, poolSeed: n.seed, seed: i + 1 }));
}

// Kısayol: doc.nominees + tüm oy dokümanları → turnuvaya katılan 32 finalist.
export function resolveFinalists({ nominees = [], voteDocs = [] }) {
  return selectFinalists(nominees, tallyNominations(voteDocs));
}

// ─── Oyları say ───────────────────────────────────────────────────────────────
// voteDocs: [{ uid, picks: { [matchId]: "a"|"b" } }] → { [matchId]: { a, b } }
export function tallyVotes(voteDocs = []) {
  const t = {};
  for (const v of voteDocs) {
    const picks = v?.picks;
    if (!picks) continue;
    for (const matchId of Object.keys(picks)) {
      const side = picks[matchId];
      if (side !== "a" && side !== "b") continue;
      if (!t[matchId]) t[matchId] = { a: 0, b: 0 };
      t[matchId][side] += 1;
    }
  }
  return t;
}

// Tek kullanıcının seçimleri (vote dokümanından) → { [matchId]: "a"|"b" }
export function getMyPicks(voteDocs = [], uid) {
  const me = voteDocs.find((v) => (v.uid || v.id) === uid);
  return me?.picks || {};
}

// ─── Bir maçın kazananını belirle ─────────────────────────────────────────────
// Çok oy kazanır; eşitlikte DÜŞÜK seed (daha iyi) kazanır. Oy yoksa ve tur
// bitmediyse henüz kazanan yok (null). Tur bittiyse (decided) oy 0 olsa bile
// düşük seed default kazanır ki bracket ilerleyebilsin.
// Bye: rakip slotu boşsa (havuz < 32 — ör. ilk istemcinin nominee çekimi ağ
// hatasıyla kısa kalmış) mevcut taraf otomatik ilerler; aksi halde null
// final'e kadar kaskatlanır ve o ay şampiyon asla çıkamazdı.
function winnerSide(a, b, av, bv, decided) {
  if (!a && !b) return null;
  if (a && !b) return "a";
  if (!a && b) return "b";
  if (av > bv) return "a";
  if (bv > av) return "b";
  if (av + bv > 0 || decided) return (a.seed <= b.seed ? "a" : "b");
  return null;
}

// ─── Bracket'i türet ──────────────────────────────────────────────────────────
// { nominees, tallies, periodId, ms } → { rounds, champion, championDecided }
// rounds[r].matches[i] = { matchId, round, roundKey, index, a, b, aVotes, bVotes,
//                          total, winnerSide, winner, decided, votable }
export function buildBracket({ nominees = [], tallies = {}, periodId, ms = now() }) {
  const sorted = [...nominees].sort((x, y) => (x.seed || 0) - (y.seed || 0));
  const e = getElapsedDays(periodId, ms);
  const out = [];

  for (let r = 0; r < ROUNDS.length; r++) {
    const def = ROUNDS[r];
    const decided = e >= def.endDay;
    const votable = e >= def.startDay && e < def.endDay;
    const matches = [];

    for (let i = 0; i < def.matches; i++) {
      let a;
      let b;
      if (r === 0) {
        // 1v17, 2v18 ... 16v32  → idx i (seed i+1) vs idx i+16 (seed i+17)
        a = sorted[i] || null;
        b = sorted[i + 16] || null;
      } else {
        const prev = out[r - 1].matches;
        a = prev[2 * i]?.winner || null;
        b = prev[2 * i + 1]?.winner || null;
      }
      const matchId = `${def.key}_${i}`;
      const t = tallies[matchId] || { a: 0, b: 0 };
      const ws = winnerSide(a, b, t.a, t.b, decided);
      matches.push({
        matchId, round: r, roundKey: def.key, index: i,
        a, b, aVotes: t.a, bVotes: t.b, total: t.a + t.b,
        winnerSide: ws, winner: ws === "a" ? a : ws === "b" ? b : null,
        decided, votable,
      });
    }
    out.push({ round: r, key: def.key, def, decided, votable, matches });
  }

  const finalMatch = out[out.length - 1].matches[0];
  return {
    rounds: out,
    champion: finalMatch.winner || null,
    championDecided: finalMatch.decided && !!finalMatch.winner,
  };
}

// ─── Yarışmacı başına TOPLAM oy ────────────────────────────────────────────────
// Bir bracket'in tüm turlarında bir yarışmacının topladığı oyların toplamı
// { [contestantId]: oySayısı }. Şampiyon kartı (bu ay) ve podyum modalı (geçmiş
// ay) AYNI hesaplamayı paylaşır — burada tek yerde tutulur.
export function computeContestantTotals(rounds = []) {
  const totals = {};
  rounds.forEach((r) =>
    r.matches.forEach((m) => {
      if (m.a) totals[m.a.id] = (totals[m.a.id] || 0) + m.aVotes;
      if (m.b) totals[m.b.id] = (totals[m.b.id] || 0) + m.bVotes;
    }),
  );
  return totals;
}

// ─── 3.'lük adayı ───────────────────────────────────────────────────────────────
// Yarı final kaybedenlerinden DAHA İYİ olanı: YF oyu → turnuva boyu toplam oy →
// seed (düşük=daha iyi). PodiumModal (geçmiş ay) ve getChampionStats (bu ay)
// AYNI kuralı paylaşır. → { c, sfVotes, sfTotal } | null.
export function computeThirdPlace(bracket, totals) {
  const sfRound = bracket.rounds.find((r) => r.key === "sf");
  const votesOf = (m, c) => (m.a?.id === c?.id ? m.aVotes : m.bVotes);
  const sfLosers = (sfRound?.matches || [])
    .filter((m) => m.winnerSide)
    .map((m) => {
      const loser = m.winnerSide === "a" ? m.b : m.a;
      return loser
        ? { c: loser, sfVotes: votesOf(m, loser), sfTotal: m.aVotes + m.bVotes }
        : null;
    })
    .filter(Boolean)
    .sort(
      (x, y) =>
        y.sfVotes - x.sfVotes ||
        (totals[y.c.id] || 0) - (totals[x.c.id] || 0) ||
        (x.c.seed || 0) - (y.c.seed || 0),
    );
  return sfLosers[0] || null;
}

// ─── Şampiyon kartı istatistikleri ─────────────────────────────────────────────
// bracket → { totalVotes, runnerUp, finalVotes, finalTotal, pct, third } | null.
// Final maçındaki skor + turnuva boyunca toplanan oy + ikincilik/üçüncülük
// bilgisini tek çağrıda türetir (ChampionHero bunu kullanır).
export function getChampionStats(bracket) {
  if (!bracket?.champion) return null;
  const totals = computeContestantTotals(bracket.rounds);
  const finalMatch = bracket.rounds[bracket.rounds.length - 1].matches[0];
  const champ = bracket.champion;
  const runnerUp = finalMatch.winnerSide === "a" ? finalMatch.b : finalMatch.a;
  const finalTotal = finalMatch.aVotes + finalMatch.bVotes;
  const finalVotes = finalMatch.a?.id === champ.id ? finalMatch.aVotes : finalMatch.bVotes;

  const thirdRaw = computeThirdPlace(bracket, totals);
  const third = thirdRaw
    ? {
        c: thirdRaw.c,
        totalVotes: totals[thirdRaw.c.id] || 0,
        votes: thirdRaw.sfVotes,
        total: thirdRaw.sfTotal,
        pct: thirdRaw.sfTotal > 0 ? Math.round((thirdRaw.sfVotes / thirdRaw.sfTotal) * 100) : 0,
      }
    : null;

  return {
    totalVotes: totals[champ.id] || 0,
    runnerUp,
    finalVotes,
    finalTotal,
    pct: finalTotal > 0 ? Math.round((finalVotes / finalTotal) * 100) : 0,
    third,
  };
}

// ─── Geri sayım metni ─────────────────────────────────────────────────────────
export function formatCountdown(msLeft, lang = "tr") {
  const ms = Math.max(0, msLeft);
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  const L = lang === "tr"
    ? { d: "g", h: "sa", m: "dk" }
    : { d: "d", h: "h", m: "m" };
  if (d > 0) return `${d}${L.d} ${h}${L.h}`;
  if (h > 0) return `${h}${L.h} ${m}${L.m}`;
  return `${m}${L.m}`;
}
