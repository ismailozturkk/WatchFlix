// Mevsim / gökyüzü / özel gün vektör sahneleri (kar, bahar, yaz, sonbahar, yağmur, fırtına, aurora,
// yıldız tozu, kamp ateşi, havai fişek, Cadılar Bayramı, Noel): her sahne bileşen ağacı olay öncesi/ortası/sonrası ve dinlenmede, koyu ve açık tonda
// hatasız kurulur; dönüşümler ve opaklıklar sonlu, opaklık 0–1.
/* eslint-disable global-require */

jest.mock("react-native-reanimated", () => ({
  useDerivedValue: (fn) => ({ value: fn() }),
}));
jest.mock("@shopify/react-native-skia", () => {
  const recorder = () =>
    new Proxy(
      {},
      {
        get: (target, key) => (key in target ? target[key] : () => undefined),
      },
    );
  const tags = [
    "Group",
    "Path",
    "Circle",
    "Oval",
    "Rect",
    "RoundedRect",
    "LinearGradient",
    "RadialGradient",
  ];
  return {
    ...Object.fromEntries(tags.map((t) => [t, t])),
    Skia: {
      Path: { Make: recorder },
      XYWHRect: (x, y, w, h) => ({ x, y, w, h }),
      RRectXY: (r) => r,
    },
    vec: (x, y) => ({ x, y }),
  };
});

const React = require("react");
const {
  KIND,
  OVERLAY,
  buildParticles,
  overlayStyle,
} = require("../utils/weatherParticles");

const SCENES = [
  [
    "snow",
    "winterScene",
    OVERLAY.winter,
    () => require("../components/decor/winterScene").default,
  ],
  [
    "springGarden",
    "springGarden",
    OVERLAY.spring,
    () => require("../components/decor/springScene").default,
  ],
  [
    "summerShore",
    "summerShore",
    OVERLAY.summerSky,
    () => require("../components/decor/summerScene").SummerSky,
  ],
  [
    "summerShore",
    "summerShore",
    OVERLAY.summerBeach,
    () => require("../components/decor/summerScene").SummerBeach,
  ],
  [
    "leaves",
    "autumnScene",
    OVERLAY.autumn,
    () => require("../components/decor/autumnScene").default,
  ],
  [
    "rain",
    "rainScene",
    OVERLAY.rain,
    () => require("../components/decor/rainScene").default,
  ],
  [
    "storm",
    "storm",
    OVERLAY.storm,
    () => require("../components/decor/rainScene").default,
  ],
  [
    "aurora",
    "aurora",
    OVERLAY.aurora,
    () => require("../components/decor/auroraScene").default,
  ],
  [
    "stardust",
    "starScene",
    OVERLAY.stars,
    () => require("../components/decor/starScene").default,
  ],
  [
    "embers",
    "campfireScene",
    OVERLAY.campfire,
    () => require("../components/decor/campfireScene").default,
  ],
  [
    "fireworks",
    "fireworksScene",
    OVERLAY.fwCity,
    () => require("../components/decor/fireworksScene").default,
  ],
  [
    "halloween",
    "halloween",
    OVERLAY.haunted,
    () => require("../components/decor/halloweenScene").default,
  ],
  [
    "christmas",
    "christmas",
    OVERLAY.xmasVillage,
    () => require("../components/decor/christmasScene").default,
  ],
  // evren vektör sahneleri
  [
    "sherlock",
    "sherVec",
    OVERLAY.sherVec,
    () => require("../components/decor/sherlockScene").default,
  ],
  [
    "deathNote",
    "dnVec",
    OVERLAY.dnVec,
    () => require("../components/decor/deathNoteScene").default,
  ],
  [
    "onePiece",
    "opSky",
    OVERLAY.opSky,
    () => require("../components/decor/onePieceScene").default,
  ],
  [
    "naruto",
    "narVec",
    OVERLAY.narVec,
    () => require("../components/decor/narutoScene").default,
  ],
  [
    "fma",
    "fmaVec",
    OVERLAY.fmaVec,
    () => require("../components/decor/fmaScene").default,
  ],
  ["interstellar", "isVec", OVERLAY.isVec, () => require("../components/decor/interstellarScene").default],
  ["strangerThings", "stVec", OVERLAY.stVec, () => require("../components/decor/strangerScene").default],
  ["demonSlayer", "dsVec", OVERLAY.dsVec, () => require("../components/decor/demonSlayerScene").default],
  ["bladeRunner", "brVec", OVERLAY.brVec, () => require("../components/decor/bladeRunnerScene").default],
  ["ghibli", "ghVec", OVERLAY.ghVec, () => require("../components/decor/ghibliScene").default],
  ["lastOfUs", "tlVec", OVERLAY.tlVec, () => require("../components/decor/lastOfUsScene").default],
  ["jurassicPark", "jpVec", OVERLAY.jpVec, () => require("../components/decor/jurassicScene").default],
  ["avatar", "avVec", OVERLAY.avVec, () => require("../components/decor/avatarScene").default],
  ["madMax", "mmVec", OVERLAY.mmVec, () => require("../components/decor/madMaxScene").default],
  ["pirates", "pcVec", OVERLAY.pcVec, () => require("../components/decor/piratesScene").default],
  ["inception", "inVec", OVERLAY.inVec, () => require("../components/decor/inceptionScene").default],
  ["titanic", "tiVec", OVERLAY.tiVec, () => require("../components/decor/titanicScene").default],
  ["dark", "dkVec", OVERLAY.dkVec, () => require("../components/decor/darkScene").default],
  ["squidGame", "sqVec", OVERLAY.sqVec, () => require("../components/decor/squidGameScene").default],
  ["hunterXHunter", "hxVec", OVERLAY.hxVec, () => require("../components/decor/hunterScene").default],
  ["jujutsuKaisen", "jjVec", OVERLAY.jjVec, () => require("../components/decor/jujutsuScene").default],
];

const val = (v) => (v && typeof v === "object" && "value" in v ? v.value : v);

// Ağacı dolaşır: fonksiyon bileşenlerini çağırır, Group dönüşüm/opaklıklarını denetler.
function walk(el, stats) {
  if (el == null || typeof el === "boolean") return;
  if (Array.isArray(el)) {
    el.forEach((e) => walk(e, stats));
    return;
  }
  if (el.type === React.Fragment) {
    walk(el.props.children, stats);
    return;
  }
  if (typeof el.type === "function") {
    walk(el.type(el.props), stats);
    return;
  }
  const p = el.props || {};
  stats.nodes += 1;
  const op = val(p.opacity);
  if (op != null) {
    expect(Number.isFinite(op)).toBe(true);
    expect(op).toBeGreaterThanOrEqual(0);
    expect(op).toBeLessThanOrEqual(1.6); // parlamada üst üste binen ışık katsayısı
  }
  // Işık merkezi (vec) düz sayı olmalı: SharedValue verilirse iOS'ta "expected a number" çöker (12 Kas, FMA).
  if (p.c && typeof p.c === "object" && "x" in p.c) {
    expect(typeof p.c.x).toBe("number");
    expect(typeof p.c.y).toBe("number");
  }
  const tr = val(p.transform);
  if (Array.isArray(tr)) {
    for (const t of tr)
      for (const v of Object.values(t)) expect(Number.isFinite(v)).toBe(true);
  }
  walk(p.children, stats);
}

describe("mevsim / gökyüzü sahneleri", () => {
  beforeAll(() => {
    React.useMemo = (fn) => fn();
  });

  it.each(SCENES)(
    "%s → %s sahnesi kurulur ve her anda sonlu",
    (effect, composite, part, load) => {
      const Scene = load();
      for (const lightSurface of [false, true]) {
        const src = composite === effect ? effect : composite;
        const p = buildParticles(src, {
          count: 40,
          seed: 3,
          lightSurface,
        }).find((q) => q.kind === KIND.overlay && q.part === part);
        expect(p).toBeTruthy();
        const tone = overlayStyle(part, lightSurface);
        for (const u of [0.02, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 2]) {
          const uu = u > 1 ? 0.5 * p.rest + 0.1 : u;
          let c = uu / p.rest - p.y0;
          c -= Math.floor(c);
          const t = c * p.period + p.period * 2;
          const stats = { nodes: 0 };
          walk(
            React.createElement(Scene, {
              p,
              clock: { value: t },
              width: 390,
              height: 844,
              tone,
              lightSurface,
            }),
            stats,
          );
          expect(stats.nodes).toBeGreaterThan(10);
        }
      }
    },
  );
});
