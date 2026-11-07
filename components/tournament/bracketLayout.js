// components/tournament/bracketLayout.js
//
// Eleme ağacının (BracketTree) SAF yerleşim hesabı: düğüm kutuları, bağlantı
// yolları (SVG `d`), sütun başlıkları, aktif tur şeridi ve şampiyon yuvası.
// Bileşen yalnız çizer; tüm ölçü buradan gelir → __tests__/bracketLayout.test.js
// node'da çakışma/bağlantı/kaydırma kurallarını sınar.
//
// Düzen: klasik İKİ TARAFLI ağaç, 9 sütun (32 · 16 · ÇF · YF · FİNAL · YF · ÇF · 16 · 32).
// Kardeş maçlar birbirine yakın, çiftler arası daha geniştir (PAIR_GAP < GROUP_GAP)
// → hangi iki maçın bir üst turda buluşacağı göz ucuyla okunur. Her üst tur,
// altındaki iki maçın TAM ortasına oturur. Bağlantılar yuvarlak dirsekli.

export const POSTER_W = 34;
export const POSTER_H = 51;
export const FINAL_POSTER_W = 46;
export const FINAL_POSTER_H = 69;
export const NODE_PAD = 4;
export const POSTER_GAP = 5;
export const BAR_GAP = 4;
export const BAR_H = 3;
export const NODE_W = 2 * POSTER_W + POSTER_GAP + 2 * NODE_PAD;
export const FINAL_W = 2 * FINAL_POSTER_W + POSTER_GAP + 2 * NODE_PAD;
export const MATCH_H = 2 * NODE_PAD + POSTER_H + BAR_GAP + BAR_H;
export const FINAL_H = 2 * NODE_PAD + FINAL_POSTER_H + BAR_GAP + BAR_H;
export const PAIR_GAP = 8;
export const GROUP_GAP = 20;
export const CONN_W = 28;
export const PAD_X = 14;
export const HEADER_H = 36;
export const PAD_TOP = HEADER_H + 10;
export const PAD_BOTTOM = 16;
export const CHAMP_W = 64;
export const CHAMP_H = 96;
export const CHAMP_GAP = 18;
export const CHAMP_LABEL_H = 20;
export const LANE_PAD = 6;
const ELBOW_R = 7;

// Sütun → tur indeksi (dıştan içe, sonra ayna).
export const SLOT_ROUND = [0, 1, 2, 3, 4, 3, 2, 1, 0];
const FINAL_SLOT = 4;

// Maç ancak turu bittiyse ve kazananı varsa çözülmüştür (widget ile AYNI kural).
export const isDecided = (m) => !!(m && m.decided && m.winnerSide);

/**
 * (x1,y1) → yatay → xm'de yuvarlak dirsekle dikey → (x2,y2)'ye yatay.
 * Aynı yükseklikteyse düz çizgi. Sağ yarıda x'ler azalır (ayna).
 */
export function elbowPath(x1, y1, xm, y2, x2, radius = ELBOW_R) {
  const dy = y2 - y1;
  if (Math.abs(dy) < 0.5) return `M${x1} ${y1}H${x2}`;
  const vy = dy > 0 ? 1 : -1;
  const hx = x2 > x1 ? 1 : -1;
  const r = Math.max(0, Math.min(radius, Math.abs(dy) / 2, Math.abs(xm - x1), Math.abs(x2 - xm)));
  return (
    `M${x1} ${y1}H${xm - hx * r}` +
    `Q${xm} ${y1} ${xm} ${y1 + vy * r}` +
    `V${y2 - vy * r}` +
    `Q${xm} ${y2} ${xm + hx * r} ${y2}` +
    `H${x2}`
  );
}

/**
 * rounds (buildBracket().rounds) → yerleşim | null.
 * { width, height, colX, colW, midY, nodes[], paths[], lanes[], champ }
 */
export function bracketLayout(rounds) {
  if (!Array.isArray(rounds) || rounds.length < 5) return null;

  const colW = SLOT_ROUND.map((r) => (r === FINAL_SLOT ? FINAL_W : NODE_W));
  const colX = [];
  let x = PAD_X;
  for (let s = 0; s < SLOT_ROUND.length; s++) {
    colX[s] = x;
    x += colW[s] + CONN_W;
  }
  const width = x - CONN_W + PAD_X;
  const rightSlot = (r) => SLOT_ROUND.length - 1 - r;

  // Yarı başına maç sayısı (8 · 4 · 2 · 1) ve satır merkezleri.
  const half = (r) => Math.floor((rounds[r]?.matches?.length || 0) / 2);
  const n0 = half(0);
  const centers = [
    Array.from({ length: n0 }, (_, i) =>
      PAD_TOP + i * (MATCH_H + PAIR_GAP) + Math.floor(i / 2) * (GROUP_GAP - PAIR_GAP) + MATCH_H / 2),
  ];
  for (let r = 1; r < FINAL_SLOT; r++) {
    centers[r] = Array.from({ length: half(r) }, (_, j) =>
      (centers[r - 1][2 * j] + centers[r - 1][2 * j + 1]) / 2);
  }
  const midY = centers[FINAL_SLOT - 1][0];
  const height = centers[0][n0 - 1] + MATCH_H / 2 + PAD_BOTTOM;

  // ── Düğümler ────────────────────────────────────────────────────────────────
  const nodes = [];
  for (let r = 0; r < FINAL_SLOT; r++) {
    const h = half(r);
    for (let j = 0; j < h; j++) {
      const y = centers[r][j] - MATCH_H / 2;
      nodes.push({ key: `L${r}_${j}`, slot: r, round: r, x: colX[r], y, w: NODE_W, h: MATCH_H, match: rounds[r].matches[j] });
      nodes.push({ key: `R${r}_${j}`, slot: rightSlot(r), round: r, x: colX[rightSlot(r)], y, w: NODE_W, h: MATCH_H, match: rounds[r].matches[h + j] });
    }
  }
  const finalMatch = rounds[FINAL_SLOT].matches[0] || null;
  const finalTop = midY - FINAL_H / 2;
  nodes.push({
    key: "F", slot: FINAL_SLOT, round: FINAL_SLOT, x: colX[FINAL_SLOT], y: finalTop,
    w: FINAL_W, h: FINAL_H, match: finalMatch, isFinal: true,
  });

  // ── Bağlantılar: her çocuk maçtan ebeveynine bir yol ─────────────────────────
  // active = çocuk maç bitti → kazananı bu yoldan ilerledi.
  const paths = [];
  for (let r = 1; r < FINAL_SLOT; r++) {
    const hp = half(r - 1);
    for (let j = 0; j < half(r); j++) {
      for (const k of [2 * j, 2 * j + 1]) {
        const y1 = centers[r - 1][k];
        const y2 = centers[r][j];
        // Sol yarı (sağa akar)
        {
          const x1 = colX[r - 1] + NODE_W;
          paths.push({
            key: `pL${r}_${k}`,
            d: elbowPath(x1, y1, x1 + CONN_W / 2, y2, colX[r]),
            active: isDecided(rounds[r - 1].matches[k]),
          });
        }
        // Sağ yarı (sola akar — ayna)
        {
          const x1 = colX[rightSlot(r - 1)];
          paths.push({
            key: `pR${r}_${k}`,
            d: elbowPath(x1, y1, x1 - CONN_W / 2, y2, colX[rightSlot(r)] + NODE_W),
            active: isDecided(rounds[r - 1].matches[hp + k]),
          });
        }
      }
    }
  }
  // Yarı finallerden finale (aynı yükseklik → düz)
  paths.push({
    key: "pLsf",
    d: elbowPath(colX[FINAL_SLOT - 1] + NODE_W, midY, colX[FINAL_SLOT - 1] + NODE_W + CONN_W / 2, midY, colX[FINAL_SLOT]),
    active: isDecided(rounds[FINAL_SLOT - 1].matches[0]),
  });
  paths.push({
    key: "pRsf",
    d: elbowPath(colX[FINAL_SLOT + 1], midY, colX[FINAL_SLOT + 1] - CONN_W / 2, midY, colX[FINAL_SLOT] + FINAL_W),
    active: isDecided(rounds[FINAL_SLOT - 1].matches[1]),
  });

  // ── Şampiyon yuvası (finalin üstünde) — final bitmediyse boş kupa ───────────
  const champY = finalTop - CHAMP_GAP - CHAMP_H;
  const cx = colX[FINAL_SLOT] + FINAL_W / 2;
  const champ = {
    x: cx - CHAMP_W / 2,
    y: champY,
    labelY: champY - CHAMP_LABEL_H,
    champion: isDecided(finalMatch) ? finalMatch.winner || null : null,
    path: `M${cx} ${champY + CHAMP_H}V${finalTop}`,
  };

  // ── Tur şeritleri (aktif turu vurgulamak için) ──────────────────────────────
  const lanes = SLOT_ROUND.map((round, slot) => ({
    key: `lane${slot}`, slot, round, x: colX[slot] - LANE_PAD, w: colW[slot] + 2 * LANE_PAD,
  }));

  return { width, height, colX, colW, midY, nodes, paths, lanes, champ };
}

/**
 * Tur seçildiğinde ağacın kaydırılacağı x: o turun SOL sütunu (final: orta)
 * görünür alanın ortasına gelir; içerik sınırlarına kıstırılır.
 */
export function focusScrollX(layout, round, viewportW) {
  if (!layout || !viewportW || round == null) return 0;
  const slot = Math.max(0, Math.min(FINAL_SLOT, Math.round(round)));
  const center = layout.colX[slot] + layout.colW[slot] / 2;
  const max = Math.max(0, layout.width - viewportW);
  return Math.max(0, Math.min(max, Math.round(center - viewportW / 2)));
}
