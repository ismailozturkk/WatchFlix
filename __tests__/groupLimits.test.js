// Grup üye tavanı (utils/groupLimits.js) ve kural dosyasıyla eşitliği.
//
// Bozulursa: arayüz 50'ye izin verirken kural 40'ta keser (ekleme "Üye
// eklenemedi" diye sessizce düşer) ya da tersine arayüz kapıyı kapatır ama kural
// daha büyük gruba izin verir — tek mesajın yazım maliyeti tavansız büyür.

const fs = require("fs");
const path = require("path");
import { MAX_GROUP_MEMBERS, groupSlotsLeft } from "../utils/groupLimits";

describe("groupSlotsLeft", () => {
  test("tavandan kalan yeri verir", () => {
    expect(groupSlotsLeft(1)).toBe(MAX_GROUP_MEMBERS - 1);
    expect(groupSlotsLeft(MAX_GROUP_MEMBERS - 1)).toBe(1);
    expect(groupSlotsLeft(MAX_GROUP_MEMBERS)).toBe(0);
  });

  test("tavanı aşmış eski grup ya da bozuk girdi negatif vermez", () => {
    expect(groupSlotsLeft(MAX_GROUP_MEMBERS + 7)).toBe(0);
    expect(groupSlotsLeft(undefined)).toBe(MAX_GROUP_MEMBERS);
    expect(groupSlotsLeft("x")).toBe(MAX_GROUP_MEMBERS);
    expect(groupSlotsLeft(-3)).toBe(MAX_GROUP_MEMBERS);
  });
});

describe("firestore.rules üye tavanı", () => {
  test("groupSizeOk, MAX_GROUP_MEMBERS ile aynı sayıyı uygular", () => {
    const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
    const body = rules.match(/function groupSizeOk\(\)\s*\{([\s\S]*?)\n\s*\}/);
    expect(body).not.toBeNull();
    const limits = [...body[1].matchAll(/members\.size\(\)\s*<=\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(limits).toEqual([MAX_GROUP_MEMBERS]);
  });
});
