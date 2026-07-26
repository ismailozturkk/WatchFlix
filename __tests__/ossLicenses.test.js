// __tests__/ossLicenses.test.js
//
// assets/ossLicenses.json bir derleme ciktisidir (npm run licenses). Bu testler
// uyumluluk bekcisidir: veri bozuk olmasin, bagimlilik eklendiginde liste bayat
// kalmasin ve store'a gonderilemeyecek bir lisans sessizce iceri girmesin.

const path = require("path");
const rootPkg = require("../package.json");
const db = require("../assets/ossLicenses.json");

// Guvenle dagitilabilen izinli (permissive) lisanslar. Yeni bir kimlik cikarsa
// bilerek incelenip buraya eklenmeli — testin amaci bu incelemeyi zorlamak.
const ALLOWED = new Set([
  "MIT",
  "ISC",
  "Apache-2.0",
  "Apache 2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "BlueOak-1.0.0",
  "CC0-1.0",
  "CC-BY-4.0",
  "Unlicense",
  "Python-2.0",
  "Beerware",
  "MPL-2.0",
  "(MIT OR CC0-1.0)",
  "(MIT OR GPL-2.0)",
  "(BSD-3-Clause OR GPL-2.0)",
  "(BSD-2-Clause OR MIT OR Apache-2.0)",
]);

// Kapali kaynak bir mobil uygulamada dagitilmasi sorunlu olan lisanslar.
const FORBIDDEN_RE = /\b(AGPL|GPL-3\.0|LGPL-3\.0|SSPL|CC-BY-NC|Commons-Clause)\b/i;

describe("acik kaynak lisans verisi", () => {
  it("beklenen sekilde uretilmis", () => {
    expect(Array.isArray(db.packages)).toBe(true);
    expect(db.packages.length).toBeGreaterThan(0);
    expect(db.packageCount).toBe(db.packages.length);
    expect(typeof db.texts).toBe("object");
    expect(db.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("her paketin adi, surumu ve lisansi var", () => {
    const bozuk = db.packages.filter(
      (p) => !p.name || !p.version || !p.license || p.license === "UNKNOWN",
    );
    expect(bozuk.map((p) => p.name)).toEqual([]);
  });

  it("her metin referansi cozulebiliyor", () => {
    const kirik = db.packages.filter(
      (p) =>
        (p.textId && !db.texts[p.textId]) || (p.noticeId && !db.texts[p.noticeId]),
    );
    expect(kirik.map((p) => p.name)).toEqual([]);
  });

  it("kullanilmayan lisans metni tasimiyor", () => {
    const kullanilan = new Set();
    for (const p of db.packages) {
      if (p.textId) kullanilan.add(p.textId);
      if (p.noticeId) kullanilan.add(p.noticeId);
    }
    const sahipsiz = Object.keys(db.texts).filter((id) => !kullanilan.has(id));
    expect(sahipsiz).toEqual([]);
  });

  it("dogrudan bagimliliklarin tamami listede (liste bayat degil)", () => {
    const listede = new Set(db.packages.map((p) => p.name));
    const eksik = Object.keys(rootPkg.dependencies || {}).filter(
      (name) => !listede.has(name),
    );
    // Eksik varsa: `npm run licenses` calistirilmali.
    expect(eksik).toEqual([]);
  });

  it("dagitimi engelleyecek bir lisans icermiyor", () => {
    const riskli = db.packages.filter((p) => FORBIDDEN_RE.test(p.license));
    expect(riskli.map((p) => `${p.name}: ${p.license}`)).toEqual([]);
  });

  it("incelenmemis lisans kimligi yok", () => {
    const yeni = [...new Set(db.packages.map((p) => p.license))].filter(
      (id) => !ALLOWED.has(id),
    );
    // Yeni bir kimlik cikarsa hukuki olarak incelenip ALLOWED'a eklenmeli.
    expect(yeni).toEqual([]);
  });

  it("MIT/BSD paketlerinin buyuk cogunlugu tam lisans metni tasiyor", () => {
    // MIT ve BSD, lisans metninin ve telif bildiriminin birebir dagitilmasini
    // zorunlu kilar; metinsiz kalanlar elle takip edilmeli.
    const zorunlu = db.packages.filter((p) => /^(MIT|BSD-[23]-Clause)$/.test(p.license));
    const metinsiz = zorunlu.filter((p) => !p.textId);
    expect(metinsiz.length / zorunlu.length).toBeLessThan(0.2);
  });

  it("uretici script repoda duruyor", () => {
    expect(() =>
      require.resolve(path.join(__dirname, "..", "scripts", "generate-oss-licenses.js")),
    ).not.toThrow();
  });
});
