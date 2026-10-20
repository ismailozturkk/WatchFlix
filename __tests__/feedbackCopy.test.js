// __tests__/feedbackCopy.test.js
//
// Geri bildirim ekranı metinleri: üç dil aynı anahtar kümesinde, boş değer yok,
// yer tutucular eşit; her kategori/şiddet/durum için metin var (yoksa kullanıcı
// ham kimliği görür).

const { FEEDBACK_COPY, fill, getFeedbackCopy } = require("../screens/tabs/settings/feedbackCopy");
const {
  BUG_SEVERITIES,
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
} = require("../utils/feedbackValidation");

/** { a: { b: "x" } } → { "a.b": "x" } */
const flatten = (value, prefix = "") =>
  Object.entries(value).reduce((acc, [key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof item === "object" && item !== null
      ? { ...acc, ...flatten(item, path) }
      : { ...acc, [path]: item };
  }, {});

const LANGS = ["tr", "en", "es", "pt"];
const placeholders = (text) => (String(text).match(/\{\w+\}/g) || []).sort().join(",");

describe("feedbackCopy", () => {
  test("üç dil aynı anahtar kümesine sahip", () => {
    const base = Object.keys(flatten(FEEDBACK_COPY.tr)).sort();
    for (const lang of LANGS) {
      expect(Object.keys(flatten(FEEDBACK_COPY[lang])).sort()).toEqual(base);
    }
  });

  test("hiçbir değer boş değil", () => {
    for (const lang of LANGS) {
      const empty = Object.entries(flatten(FEEDBACK_COPY[lang])).filter(
        ([, value]) => typeof value !== "string" || !value.trim(),
      );
      expect(empty).toEqual([]);
    }
  });

  test("yer tutucular her dilde aynı", () => {
    const tr = flatten(FEEDBACK_COPY.tr);
    for (const lang of ["en", "es"]) {
      const other = flatten(FEEDBACK_COPY[lang]);
      for (const key of Object.keys(tr)) {
        expect(placeholders(other[key])).toBe(placeholders(tr[key]));
      }
    }
  });

  test("her kategori, şiddet ve durum için metin var", () => {
    for (const lang of LANGS) {
      const copy = FEEDBACK_COPY[lang];
      for (const kind of ["bug", "feature"]) {
        for (const id of FEEDBACK_CATEGORIES[kind]) {
          expect(copy[kind].categories[id]).toBeTruthy();
        }
        for (const id of FEEDBACK_STATUSES) {
          expect(copy[kind].statuses[id]).toBeTruthy();
        }
      }
      for (const id of BUG_SEVERITIES) {
        expect(copy.bug.severities[id]).toBeTruthy();
        expect(copy.bug.severityHints[id]).toBeTruthy();
      }
    }
  });

  test("seçici ve yardımcılar", () => {
    expect(getFeedbackCopy("tr").group.bugTitle).toBe("Hata bildir");
    expect(getFeedbackCopy("es")).toBe(FEEDBACK_COPY.es);
    // Bilinmeyen dil İngilizceye düşer.
    expect(getFeedbackCopy("xx")).toBe(FEEDBACK_COPY.en);
    expect(fill("{n}/{max}", { n: 3, max: 80 })).toBe("3/80");
    expect(fill("{n} {eksik}", { n: 1 })).toBe("1 {eksik}");
  });
});
