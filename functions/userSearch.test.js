const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SEARCH_LIMIT,
  PREFIX_END,
  normalizeSearchTerm,
  toSearchResult,
  pickResults,
} = require("./userSearch");

test("terim: küçük harf, boşluk kırpma, Türkçe İ/I → i (istemciyle aynı)", () => {
  assert.equal(normalizeSearchTerm("  Ahmet_42 "), "ahmet_42");
  assert.equal(normalizeSearchTerm("İSMAİL"), "ismail");
  assert.equal(normalizeSearchTerm("Irmak"), "irmak");
  assert.equal(normalizeSearchTerm("a"), "a");
});

test("terim: geçersiz karakter, boş, 20'den uzun ve metin olmayan → null (sorguya gitmez)", () => {
  assert.equal(normalizeSearchTerm(""), null);
  assert.equal(normalizeSearchTerm("   "), null);
  assert.equal(normalizeSearchTerm("@ahmet"), null);
  assert.equal(normalizeSearchTerm("ah met"), null);
  assert.equal(normalizeSearchTerm("a".repeat(21)), null);
  assert.equal(normalizeSearchTerm("ahmet"), null);
  assert.equal(normalizeSearchTerm(null), null);
  assert.equal(normalizeSearchTerm(42), null);
  assert.equal(normalizeSearchTerm({ term: "a" }), null);
});

test("sonuç yalnız beş alan taşır: plan, gizlilik, e-posta dışarı çıkmaz", () => {
  const out = toSearchResult("u1", {
    username: "Ahmet",
    usernameLower: "ahmet",
    displayName: "Ahmet Y.",
    avatarIndex: 3,
    photoURL: "https://x/y.jpg",
    entitlements: { premiumPlan: "unlimited" },
    privacy: { lists: "private" },
    email: "a@b.c",
    birthDate: "2000-01-01",
  });
  assert.deepEqual(out, {
    uid: "u1",
    username: "Ahmet",
    displayName: "Ahmet Y.",
    avatarIndex: 3,
    photoURL: "https://x/y.jpg",
  });
});

test("bozuk/eksik profil alanları güvenli varsayılana düşer", () => {
  assert.deepEqual(toSearchResult("u2", { avatarIndex: "3", photoURL: 7 }), {
    uid: "u2",
    username: "",
    displayName: "",
    avatarIndex: 0,
    photoURL: null,
  });
  assert.deepEqual(toSearchResult("u3", undefined).uid, "u3");
});

test("arayan kendini görmez; sonuç SEARCH_LIMIT'e kesilir", () => {
  const docs = Array.from({ length: SEARCH_LIMIT + 1 }, (_, i) => ({
    id: i === 0 ? "me" : `u${i}`,
    data: () => ({ username: `n${i}` }),
  }));
  const picked = pickResults(docs, "me");
  assert.equal(picked.length, SEARCH_LIMIT);
  assert.ok(picked.every((row) => row.uid !== "me"));
  assert.equal(pickResults(docs.slice(1), "me").length, SEARCH_LIMIT);
  assert.deepEqual(pickResults(null, "me"), []);
});

test("ön-ek üst ucu, o ön-ekle başlayan her geçerli addan büyük", () => {
  for (const prefix of ["a", "ah", "a_9", "___"]) {
    for (const next of ["z", "_", "9", "zzzzzzzz"]) {
      assert.ok(`${prefix}${PREFIX_END}` > `${prefix}${next}`);
    }
  }
});
