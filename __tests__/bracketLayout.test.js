// Eleme agaci yerlesimi (components/tournament/bracketLayout.js) icin birim testler.
// Gercek motor ciktisi (buildBracket) uzerinde: dugumler cakismaz, her baglanti
// cocuk maçin kenarindan ebeveynin kenarina gider, kazananin yolu yalniz biten
// maclarda yanar, sampiyon yuvasi finale baglidir, kaydirma kistirilir.
const {
  buildBracket, getPeriodStartMs, DAY, ROUNDS,
} = require("../services/tournamentEngine");
const {
  bracketLayout, focusScrollX, elbowPath, isDecided,
  HEADER_H, NODE_W, FINAL_W, MATCH_H, FINAL_H, CHAMP_LABEL_H, SLOT_ROUND,
} = require("../components/tournament/bracketLayout");

const PERIOD = "2026-10";
const makePool = (n) =>
  Array.from({ length: n }, (_, i) => ({
    seed: i + 1, id: 1000 + i, title: `Aday ${i + 1}`, posterPath: "/x.jpg", mediaType: "movie",
  }));
const at = (day) => getPeriodStartMs(PERIOD) + day * DAY;
const bracketOn = (day, tallies = {}) =>
  buildBracket({ nominees: makePool(32), tallies, periodId: PERIOD, ms: at(day) });

const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// "M x y ... H x2" → { x1, y1, x2, y2 } (yolun bas ve son noktasi)
const endpoints = (d) => {
  const m = d.match(/^M([\d.-]+) ([\d.-]+)/);
  const lastH = [...d.matchAll(/H([\d.-]+)/g)].pop();
  const lastY = [...d.matchAll(/(?:Q[\d.-]+ [\d.-]+ [\d.-]+ ([\d.-]+))|(?:V([\d.-]+))/g)].pop();
  return {
    x1: Number(m[1]), y1: Number(m[2]),
    x2: Number(lastH[1]),
    y2: lastY ? Number(lastY[1] ?? lastY[2]) : Number(m[2]),
  };
};

describe("bracketLayout", () => {
  test("eksik tur listesinde null", () => {
    expect(bracketLayout(null)).toBeNull();
    expect(bracketLayout([])).toBeNull();
  });

  const layout = bracketLayout(bracketOn(8).rounds);

  test("31 dugum: 30 eleme maci + final; her mac tam bir kez", () => {
    expect(layout.nodes).toHaveLength(31);
    const ids = layout.nodes.map((n) => n.match.matchId);
    expect(new Set(ids).size).toBe(31);
    expect(layout.nodes.filter((n) => n.isFinal)).toHaveLength(1);
  });

  test("dugumler cakismaz ve tuvalin icinde, baslik seridinin altinda", () => {
    const { nodes, width, height } = layout;
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(width);
      expect(n.y).toBeGreaterThanOrEqual(HEADER_H);
      expect(n.y + n.h).toBeLessThanOrEqual(height);
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(overlaps(nodes[i], nodes[j])).toBe(false);
      }
    }
  });

  test("sampiyon yuvasi finalin ustunde, baslik seridinin altinda ve hicbir dugume binmez", () => {
    const { champ, nodes } = layout;
    const final = nodes.find((n) => n.isFinal);
    const box = { x: champ.x, y: champ.labelY, w: 64, h: champ.y + 96 - champ.labelY };
    expect(champ.labelY).toBeGreaterThanOrEqual(HEADER_H);
    expect(champ.y + 96).toBeLessThan(final.y);
    for (const n of nodes) expect(overlaps(box, n)).toBe(false);
    expect(champ.labelY).toBe(champ.y - CHAMP_LABEL_H);
  });

  test("her ust tur, altindaki iki macin tam ortasinda (iki yarida da)", () => {
    const byId = Object.fromEntries(layout.nodes.map((n) => [n.match.matchId, n]));
    const cy = (n) => n.y + n.h / 2;
    for (let r = 1; r < 4; r++) {
      const half = ROUNDS[r].matches / 2;
      const prevHalf = ROUNDS[r - 1].matches / 2;
      for (let side = 0; side < 2; side++) {
        for (let j = 0; j < half; j++) {
          const parent = byId[`${ROUNDS[r].key}_${side * half + j}`];
          const a = byId[`${ROUNDS[r - 1].key}_${side * prevHalf + 2 * j}`];
          const b = byId[`${ROUNDS[r - 1].key}_${side * prevHalf + 2 * j + 1}`];
          expect(cy(parent)).toBeCloseTo((cy(a) + cy(b)) / 2, 6);
        }
      }
    }
    // Final iki yari finalle ayni hizada
    const final = byId.final_0;
    expect(cy(final)).toBeCloseTo(cy(byId.sf_0), 6);
    expect(cy(final)).toBeCloseTo(cy(byId.sf_1), 6);
  });

  test("30 baglanti (finalden baska her mactan bir yol); her biri cocugun kenarindan ebeveynin kenarina gider", () => {
    expect(layout.paths).toHaveLength(30);
    expect(new Set(layout.paths.map((p) => p.key)).size).toBe(30);
    const rects = layout.nodes;
    const touchesEdge = (x, y) =>
      rects.some((n) => (Math.abs(n.x - x) < 0.01 || Math.abs(n.x + n.w - x) < 0.01)
        && y >= n.y && y <= n.y + n.h);
    for (const p of layout.paths) {
      const e = endpoints(p.d);
      expect(touchesEdge(e.x1, e.y1)).toBe(true);
      expect(touchesEdge(e.x2, e.y2)).toBe(true);
    }
  });

  test("sutunlar: 9 sutun, ortadaki final daha genis, ayna simetrik", () => {
    expect(layout.colX).toHaveLength(SLOT_ROUND.length);
    expect(layout.colW[4]).toBe(FINAL_W);
    for (let s = 0; s < 4; s++) {
      expect(layout.colW[s]).toBe(NODE_W);
      // Sol sutunun sol kenarina uzaklik = sag sutunun sag kenarina uzaklik
      expect(layout.colX[s]).toBeCloseTo(layout.width - (layout.colX[8 - s] + NODE_W), 6);
    }
    expect(MATCH_H).toBeLessThan(FINAL_H);
  });
});

describe("kazananin yolu ve sampiyon", () => {
  test("ilk tur suruyorken (gun 8) hicbir yol yanmaz, sampiyon yok", () => {
    const l = bracketLayout(bracketOn(8).rounds);
    expect(l.paths.every((p) => !p.active)).toBe(true);
    expect(l.champ.champion).toBeNull();
  });

  test("ilk tur bitince (gun 10) yalniz ilk turdan cikan 16 yol yanar", () => {
    const b = bracketOn(10);
    const l = bracketLayout(b.rounds);
    const active = l.paths.filter((p) => p.active);
    expect(active).toHaveLength(16);
    expect(b.rounds[0].matches.every(isDecided)).toBe(true);
    expect(b.rounds[1].matches.some(isDecided)).toBe(false);
  });

  test("final bitince (gun 22) tum yollar yanar ve sampiyon motorla AYNI", () => {
    const b = bracketOn(22, { final_0: { a: 0, b: 3 } });
    const l = bracketLayout(b.rounds);
    expect(l.paths.every((p) => p.active)).toBe(true);
    expect(b.championDecided).toBe(true);
    expect(l.champ.champion).toBe(b.champion);
    expect(l.champ.champion.id).toBe(b.rounds[4].matches[0].b.id);
  });

  test("final suruyorken (gun 18) sampiyon yuvasi bos bekler", () => {
    const l = bracketLayout(bracketOn(18).rounds);
    expect(l.champ.champion).toBeNull();
    // Yari finaller bitti → finale giden iki yol yanik
    expect(l.paths.find((p) => p.key === "pLsf").active).toBe(true);
    expect(l.paths.find((p) => p.key === "pRsf").active).toBe(true);
  });
});

describe("focusScrollX", () => {
  const l = bracketLayout(bracketOn(8).rounds);

  test("ilk tur basa, final ortaya; sinirlar icinde", () => {
    expect(focusScrollX(l, 0, 360)).toBe(0);
    const center = l.colX[4] + l.colW[4] / 2;
    expect(focusScrollX(l, 4, 360)).toBe(Math.round(center - 180));
    for (let r = 0; r < 5; r++) {
      const x = focusScrollX(l, r, 360);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(l.width - 360);
    }
  });

  test("tur ilerledikce kaydirma saga gider (sol yari)", () => {
    const xs = [0, 1, 2, 3, 4].map((r) => focusScrollX(l, r, 360));
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
  });

  test("gorunum agactan genisse 0; gecersiz girdide 0", () => {
    expect(focusScrollX(l, 3, l.width + 100)).toBe(0);
    expect(focusScrollX(null, 2, 360)).toBe(0);
    expect(focusScrollX(l, null, 360)).toBe(0);
    expect(focusScrollX(l, 2, 0)).toBe(0);
  });
});

describe("elbowPath", () => {
  test("ayni yukseklikte duz cizgi", () => {
    expect(elbowPath(0, 10, 5, 10, 20)).toBe("M0 10H20");
  });

  test("dirsek yuvarlak, uc noktalar korunur (sag yari aynasi dahil)", () => {
    const d = elbowPath(10, 0, 20, 40, 30);
    expect(d.startsWith("M10 0H13")).toBe(true);
    expect(d).toContain("Q20 0 20 7");
    expect(d.endsWith("H30")).toBe(true);
    const mirror = elbowPath(30, 0, 20, 40, 10);
    expect(mirror.startsWith("M30 0H27")).toBe(true);
    expect(mirror.endsWith("H10")).toBe(true);
  });

  test("dar dirsekte yaricap kisalir (yol kendini kesmez)", () => {
    const d = elbowPath(0, 0, 2, 4, 4);
    expect(d).toContain("Q2 0 2 2");
  });
});
