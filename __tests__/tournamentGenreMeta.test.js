// Turnuva tur kimligi (components/tournament/genreMeta.js) icin bekci testleri.
// Saf modul: renk tablosu, animasyonlu simge hareketleri ve anahtar kare ornekleyici.
const path = require("path");
const { SCHEDULE, getScheduleEntry } = require("../services/tournamentEngine");
const {
  GENRE_META,
  FALLBACK_GENRE_META,
  GLYPH_MOTIONS,
  MOTION_META_FIELDS,
  REST_VALUE,
  genreMetaFor,
  sampleKeyframes,
  mixHex,
  arenaColors,
} = require("../components/tournament/genreMeta");

const HEX = /^#[0-9A-F]{6}$/i;
const glyphmap = (family) =>
  require(path.join(
    __dirname, "..", "node_modules", "@expo", "vector-icons", "build", "vendor",
    "react-native-vector-icons", "glyphmaps", `${family}.json`,
  ));

// WCAG goreli parlaklik (0 = siyah, 1 = beyaz)
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("takvim -> tur kimligi", () => {
  test("12 ayin her biri benzersiz bir tur anahtari tasir ve kimligi tanimli", () => {
    const keys = SCHEDULE.map((e) => e.key);
    expect(keys).toHaveLength(12);
    expect(new Set(keys).size).toBe(12);
    for (const k of keys) expect(GENRE_META[k]).toBeDefined();
    // Tabloda takvimde olmayan (olu) giris yok
    expect(Object.keys(GENRE_META).sort()).toEqual([...keys].sort());
  });

  test("ayni TMDB turunu paylasan aylar (Bilim Kurgu/Fantastik, Aksiyon/Macera) FARKLI kimlik alir", () => {
    const sciFi = getScheduleEntry(0);
    const fantasy = getScheduleEntry(10);
    expect(sciFi.genreId).toBe(fantasy.genreId);
    expect(genreMetaFor(sciFi)).not.toBe(genreMetaFor(fantasy));
    const action = getScheduleEntry(2);
    const adventure = getScheduleEntry(4);
    expect(action.genreId).toBe(adventure.genreId);
    expect(genreMetaFor(action)).not.toBe(genreMetaFor(adventure));
  });

  test("bilinmeyen tur yedek kimlige duser (kart boyasiz kalmaz)", () => {
    expect(genreMetaFor(null)).toBe(FALLBACK_GENRE_META);
    expect(genreMetaFor({ key: "western" })).toBe(FALLBACK_GENRE_META);
    expect(genreMetaFor(getScheduleEntry(9))).toBe(GENRE_META.horror);
  });

  test("her turun gradyani ayirt edilir (ilk duraklar tekrar etmez)", () => {
    const firsts = Object.values(GENRE_META).map((m) => m.gradient[0].toUpperCase());
    expect(new Set(firsts).size).toBe(firsts.length);
  });
});

describe.each([...Object.entries(GENRE_META), ["fallback", FALLBACK_GENRE_META]])("kimlik: %s", (_key, meta) => {
  test("renkler gecerli #RRGGBB, gradyan 3 durak", () => {
    expect(meta.gradient).toHaveLength(3);
    for (const c of [...meta.gradient, meta.ink, meta.glow]) expect(c).toMatch(HEX);
  });

  test("simge, ailesinin glyphmap'inde VAR (yoksa AppIcon kirmizi uyari cizer)", () => {
    expect(glyphmap(meta.icon.family)[meta.icon.name]).toBeDefined();
  });

  test("hareket tanimli", () => {
    expect(GLYPH_MOTIONS[meta.motion]).toBeDefined();
  });

  test("arena zemini koyu: ustundeki beyaz yazi her temada AAA (>= 7:1)", () => {
    for (const c of arenaColors(meta)) expect(contrast("#FFFFFF", c)).toBeGreaterThanOrEqual(7);
  });

  test("parilti rengi arenada belirgin (kazananin yolu, onay rozeti >= 4.5:1)", () => {
    for (const c of arenaColors(meta)) expect(contrast(meta.glow, c)).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each(Object.entries(GLYPH_MOTIONS))("hareket: %s", (_name, motion) => {
  const tracks = Object.keys(motion).filter((k) => !MOTION_META_FIELDS.includes(k));

  test("duraklar 0'dan 1'e kesin artan", () => {
    expect(motion.input[0]).toBe(0);
    expect(motion.input[motion.input.length - 1]).toBe(1);
    for (let i = 1; i < motion.input.length; i++) {
      expect(motion.input[i]).toBeGreaterThan(motion.input[i - 1]);
    }
    expect(motion.period).toBeGreaterThan(0);
  });

  test("en az bir donusum izi var ve izler bilinen alanlar", () => {
    expect(tracks.length).toBeGreaterThan(0);
    for (const k of tracks) expect(Object.keys(REST_VALUE)).toContain(k);
  });

  test("her iz duraklarla ayni uzunlukta", () => {
    for (const k of tracks) expect(motion[k]).toHaveLength(motion.input.length);
  });

  // Reanimated ilk degeri her render'da geri yazabilir; "hareketi azalt" t'yi
  // uca atlatir; dongu basa sarar. Uc degerler dinlenme durumu olmali ki simge
  // her durumda GORUNUR ve duz kalsin, dongu dikissiz donsun.
  test("ilk ve son deger dinlenme durumu (gorunur, duz)", () => {
    for (const k of tracks) {
      expect(motion[k][0]).toBe(REST_VALUE[k]);
      expect(motion[k][motion[k].length - 1]).toBe(REST_VALUE[k]);
    }
  });

  test("opaklik hicbir anda tamamen sifira inmez", () => {
    if (!motion.opacity) return;
    for (const v of motion.opacity) expect(v).toBeGreaterThan(0.2);
  });
});

describe("sampleKeyframes", () => {
  const input = [0, 0.5, 1];
  const out = [0, 10, 0];

  test("duraklarda tam degeri verir, disinda kistirir", () => {
    expect(sampleKeyframes(0, input, out)).toBe(0);
    expect(sampleKeyframes(0.5, input, out)).toBe(10);
    expect(sampleKeyframes(1, input, out)).toBe(0);
    expect(sampleKeyframes(-1, input, out)).toBe(0);
    expect(sampleKeyframes(2, input, out)).toBe(0);
  });

  test("duraklar arasi ease-in-out: ortada yarisi, kenarlarda yavas", () => {
    expect(sampleKeyframes(0.25, input, out)).toBeCloseTo(5, 6);
    // Ilk %10'luk dilim dogrusal paydan (2) az ilerler → yumusak kalkis
    expect(sampleKeyframes(0.05, input, out)).toBeLessThan(1);
    // Segment icinde monoton
    let prev = -Infinity;
    for (let t = 0; t <= 0.5; t += 0.01) {
      const v = sampleKeyframes(t, input, out);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });
});

describe("mixHex", () => {
  test("uclar ve orta nokta", () => {
    expect(mixHex("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(mixHex("#000000", "#FFFFFF", 1)).toBe("#ffffff");
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });
});
