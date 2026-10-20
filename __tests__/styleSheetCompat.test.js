// __tests__/styleSheetCompat.test.js
// RN 0.85'te kaldirilan StyleSheet.absoluteFillObject yamasinin sozlesmesi.
// Yamanin bozulmasi, ucuncu parti paketlerdeki mutlak konumlandirmayi SESSIZCE
// kaybettirir (belirti: profil avatarindaki ilerleme halkalarinin kaymasi), bu
// yuzden davranis testle sabitlendi.

const {
  applyStyleSheetCompat,
} = require("../utils/styleSheetCompat");

const FILL = { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 };

describe("StyleSheet.absoluteFillObject uyumluluk yamasi", () => {
  it("alan eksikse absoluteFill ile doldurur", () => {
    const ss = { absoluteFill: FILL };
    expect(applyStyleSheetCompat(ss)).toBe(true);
    expect(ss.absoluteFillObject).toBe(FILL);
  });

  it("yamalanan alan spread ile kullanilabilir (kutuphanelerin yaptigi sey)", () => {
    const ss = { absoluteFill: FILL };
    applyStyleSheetCompat(ss);
    expect({ ...ss.absoluteFillObject, backgroundColor: "red" }).toEqual({
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: "red",
    });
  });

  it("alan zaten varsa dokunmaz (eski RN surumleri)", () => {
    const mevcut = { position: "absolute" };
    const ss = { absoluteFill: FILL, absoluteFillObject: mevcut };
    expect(applyStyleSheetCompat(ss)).toBe(false);
    expect(ss.absoluteFillObject).toBe(mevcut);
  });

  it("absoluteFill de yoksa sessizce vazgecer", () => {
    const ss = {};
    expect(applyStyleSheetCompat(ss)).toBe(false);
    expect(ss.absoluteFillObject).toBeUndefined();
  });

  it("gecersiz girdide patlamaz", () => {
    expect(applyStyleSheetCompat(null)).toBe(false);
    expect(applyStyleSheetCompat(undefined)).toBe(false);
    expect(applyStyleSheetCompat("StyleSheet")).toBe(false);
  });

  it("nesne donmussa acilista cokmez", () => {
    const ss = Object.freeze({ absoluteFill: FILL });
    expect(applyStyleSheetCompat(ss)).toBe(false);
  });
});
