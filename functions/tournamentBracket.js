// functions/tournamentBracket.js
//
// SAF (bağımsız) turnuva bracket çekirdeği — archiveTournamentWinners bunu
// kullanarak biten bir ayın şampiyonunu sunucuda türetir.
//
// ⚠️ BU DOSYA services/tournamentEngine.js'in HESAP ÇEKİRDEĞİNİN KOPYASIDIR.
// Kopya olmak zorunda: uygulama motoru ESM (`export`), functions ise CommonJS
// (`require`) ve derleme adımı yok. İkisinin AYRIŞMAMASI tek bir şeye bağlı:
//
//     __tests__/tournamentWinnerArchive.test.js
//
// O test aynı girdileri hem bu porta hem gerçek motora verip çıktıların birebir
// aynı olduğunu doğrular. Motorda sıralama/eşleşme/kazanan kuralı DEĞİŞİRSE
// test kırmızıya döner — düzeltme yolu burayı motora göre güncellemektir,
// testi gevşetmek değil. Etiket/çeviri/geri sayım gibi yalnız arayüzü
// ilgilendiren kısımlar bilerek port EDİLMEMİŞTİR.

"use strict";

const DAY = 24 * 60 * 60 * 1000;
const FINALIST_COUNT = 32;

// tournamentEngine.ROUNDS ile birebir (etiketler hariç).
const ROUNDS = [
  { key: "r32", matches: 16, startDay: 7, endDay: 9 },
  { key: "r16", matches: 8, startDay: 9, endDay: 11 },
  { key: "qf", matches: 4, startDay: 11, endDay: 13 },
  { key: "sf", matches: 2, startDay: 13, endDay: 15 },
  { key: "final", matches: 1, startDay: 15, endDay: 21 },
];

function parsePeriodId(periodId) {
  const parts = String(periodId || "").split("-");
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return { year: y, monthIndex: (m || 1) - 1 };
}

function getPeriodStartMs(periodId) {
  const p = parsePeriodId(periodId);
  return new Date(p.year, p.monthIndex, 1, 0, 0, 0, 0).getTime();
}

function getElapsedDays(periodId, ms) {
  return (ms - getPeriodStartMs(periodId)) / DAY;
}

// ─── Oy sayımı ────────────────────────────────────────────────────────────────
function tallyNominations(voteDocs) {
  const t = {};
  for (const v of voteDocs || []) {
    const noms = v && v.noms;
    if (!noms) continue;
    for (const id of Object.keys(noms)) {
      if (!noms[id]) continue;
      t[id] = (t[id] || 0) + 1;
    }
  }
  return t;
}

function tallyVotes(voteDocs) {
  const t = {};
  for (const v of voteDocs || []) {
    const picks = v && v.picks;
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

// ─── Havuz ────────────────────────────────────────────────────────────────────
function mergePool(nominees, suggested) {
  const base = Array.isArray(nominees) ? nominees : [];
  if (!Array.isArray(suggested) || suggested.length === 0) return base;

  const have = new Set(base.map((n) => String(n && n.id)));
  const extras = [];
  for (const s of suggested) {
    const key = String((s && s.id) != null ? s.id : "");
    if (!key || key === "undefined" || have.has(key)) continue;
    have.add(key);
    extras.push(s);
  }
  if (extras.length === 0) return base;

  extras.sort(
    (a, b) =>
      (a.addedAtMs || 0) - (b.addedAtMs || 0) || String(a.id).localeCompare(String(b.id)),
  );
  return base.concat(
    extras.map((s, i) => Object.assign({}, s, { seed: base.length + i + 1, suggested: true })),
  );
}

function rankPool(nominees, nomTally) {
  const t = nomTally || {};
  return (nominees || [])
    .slice()
    .sort((a, b) => {
      const av = t[String(a.id)] || 0;
      const bv = t[String(b.id)] || 0;
      if (av !== bv) return bv - av;
      return (a.seed || 0) - (b.seed || 0);
    })
    .map((n, i) =>
      Object.assign({}, n, {
        nomVotes: t[String(n.id)] || 0,
        rank: i + 1,
        finalist: i < FINALIST_COUNT,
      }),
    );
}

function selectFinalists(nominees, nomTally) {
  if (!Array.isArray(nominees) || nominees.length <= FINALIST_COUNT) return nominees;
  return rankPool(nominees, nomTally)
    .slice(0, FINALIST_COUNT)
    .map((n, i) => Object.assign({}, n, { poolSeed: n.seed, seed: i + 1 }));
}

// ─── Bracket ──────────────────────────────────────────────────────────────────
function winnerSide(a, b, av, bv, decided) {
  if (!a && !b) return null;
  if (a && !b) return "a";
  if (!a && b) return "b";
  if (av > bv) return "a";
  if (bv > av) return "b";
  if (av + bv > 0 || decided) return a.seed <= b.seed ? "a" : "b";
  return null;
}

function buildBracket(opts) {
  const nominees = (opts && opts.nominees) || [];
  const tallies = (opts && opts.tallies) || {};
  const periodId = opts && opts.periodId;
  const ms = opts && opts.ms;

  const sorted = nominees.slice().sort((x, y) => (x.seed || 0) - (y.seed || 0));
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
        a = sorted[i] || null;
        b = sorted[i + 16] || null;
      } else {
        const prev = out[r - 1].matches;
        a = (prev[2 * i] && prev[2 * i].winner) || null;
        b = (prev[2 * i + 1] && prev[2 * i + 1].winner) || null;
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

function computeContestantTotals(rounds) {
  const totals = {};
  (rounds || []).forEach((r) =>
    r.matches.forEach((m) => {
      if (m.a) totals[m.a.id] = (totals[m.a.id] || 0) + m.aVotes;
      if (m.b) totals[m.b.id] = (totals[m.b.id] || 0) + m.bVotes;
    }),
  );
  return totals;
}

function computeThirdPlace(bracket, totals) {
  const sfRound = bracket.rounds.find((r) => r.key === "sf");
  const votesOf = (m, c) => (m.a && c && m.a.id === c.id ? m.aVotes : m.bVotes);
  const sfLosers = ((sfRound && sfRound.matches) || [])
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

// ─── Arşiv kaydı ──────────────────────────────────────────────────────────────
// Biten bir ayın nihai podyumunu türetir. `ms` verilmezse ay başından 40 gün
// sonrası varsayılır: tüm turlar (en geç 21. günde) kapandığı için sonuç
// SAAT DİLİMİNDEN BAĞIMSIZ çıkar — sunucu UTC, istemci yerel saatte olsa da
// aynı şampiyonu bulur.
function resolvePodium(opts) {
  const periodId = opts.periodId;
  const nominees = mergePool(opts.nominees || [], opts.suggested || []);
  const nomTally = opts.nomTally || {};
  const tallies = opts.tallies || {};
  const ms = opts.ms != null ? opts.ms : getPeriodStartMs(periodId) + 40 * DAY;

  const finalists = selectFinalists(nominees, nomTally);
  if (!finalists || !finalists.length) return null;

  const bracket = buildBracket({ nominees: finalists, tallies, periodId, ms });
  if (!bracket.champion) return null;

  const totals = computeContestantTotals(bracket.rounds);
  const finalMatch = bracket.rounds[bracket.rounds.length - 1].matches[0];
  const champ = bracket.champion;
  const runnerUp = finalMatch.winnerSide === "a" ? finalMatch.b : finalMatch.a;
  const finalTotal = finalMatch.aVotes + finalMatch.bVotes;
  const finalVotes = finalMatch.a && finalMatch.a.id === champ.id ? finalMatch.aVotes : finalMatch.bVotes;
  const third = computeThirdPlace(bracket, totals);

  return {
    champion: champ,
    runnerUp: runnerUp || null,
    third: (third && third.c) || null,
    championTotalVotes: totals[champ.id] || 0,
    runnerUpTotalVotes: runnerUp ? totals[runnerUp.id] || 0 : 0,
    thirdTotalVotes: third && third.c ? totals[third.c.id] || 0 : 0,
    finalVotes,
    finalTotal,
    // Turnuva boyunca kullanılan toplam eleme oyu (katılım göstergesi).
    totalVotes: Object.keys(tallies).reduce(
      (acc, k) => acc + (tallies[k].a || 0) + (tallies[k].b || 0),
      0,
    ),
  };
}

module.exports = {
  DAY,
  FINALIST_COUNT,
  ROUNDS,
  parsePeriodId,
  getPeriodStartMs,
  getElapsedDays,
  tallyNominations,
  tallyVotes,
  mergePool,
  rankPool,
  selectFinalists,
  buildBracket,
  computeContestantTotals,
  computeThirdPlace,
  resolvePodium,
};
