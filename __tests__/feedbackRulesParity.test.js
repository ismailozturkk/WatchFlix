// __tests__/feedbackRulesParity.test.js
//
// firestore.rules → Feedback bloğu ile istemcideki utils/feedbackValidation.js
// AYNI şekli konuşmalı. Emülatör gerektirmez (kural dosyasını METİN olarak okur),
// bu yüzden `npm test` ile her seferinde çalışır; davranış testleri ise
// __tests__/rules/firestore.rules.test.js'te (npm run test:rules).
// Biri değişip diğeri unutulursa kullanıcı "gönderilemedi" görür.

const fs = require("fs");
const path = require("path");
const {
  BUG_SEVERITIES,
  FEEDBACK_CATEGORIES,
  FEEDBACK_LIMITS,
  buildFeedback,
} = require("../utils/feedbackValidation");

const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");

// `match /Feedback/{...} {` ile bir sonraki üst düzey `match /` arası.
const start = rules.indexOf("match /Feedback/");
const rest = rules.slice(start + 1);
const nextMatch = rest.search(/\n {4}match \//);
const block = rules.slice(start, nextMatch === -1 ? undefined : start + 1 + nextMatch);

const strings = (text) => [...text.matchAll(/'([^']*)'/g)].map((match) => match[1]);
const listAfter = (pattern) => {
  const found = block.match(pattern);
  return found ? strings(found[1]) : null;
};

describe("Feedback kuralı ↔ istemci doğrulaması", () => {
  test("Feedback bloğu bulundu", () => {
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain("allow create");
  });

  test("zorunlu ve izinli alan listeleri istemcinin ürettiği belgeyle uyumlu", () => {
    const hasAll = listAfter(/hasAll\(\s*\[([^\]]*)\]/);
    const hasOnly = listAfter(/hasOnly\(\s*\[([^\]]*)\]/);
    expect(hasAll).toBeTruthy();
    expect(hasOnly).toBeTruthy();

    // createdAt'ı servis ekler.
    const withServerFields = (data) => Object.keys({ ...data, createdAt: true });
    const common = {
      title: "Başlık yeterli",
      message: "Mesaj yeterince uzun yazıldı.",
      uid: "alice",
      language: "tr",
    };
    const fullBug = buildFeedback({
      kind: "bug",
      ...common,
      device: { appVersion: "v1", platform: "ios", osVersion: "26", deviceModel: "iPhone" },
    }).data;
    const minimalFeature = buildFeedback({ kind: "feature", ...common }).data;

    // Her belge: zorunlular hepsi var, izinlilerin dışında alan yok.
    for (const data of [fullBug, minimalFeature]) {
      const keys = withServerFields(data);
      for (const required of hasAll) expect(keys).toContain(required);
      for (const key of keys) expect(hasOnly).toContain(key);
    }
    // Tersi: kuralın izin verdiği her alanı istemci üretebiliyor (ölü alan kalmasın).
    const producible = new Set([...withServerFields(fullBug)]);
    for (const key of hasOnly) expect(producible).toContain(key);
  });

  test("kategori ve şiddet listeleri aynı", () => {
    const lists = [...block.matchAll(/\bin\s*\[([^\]]*)\]/g)].map((match) => strings(match[1]));
    const sorted = (items) => [...items].sort();
    // Sıra: hata kategorileri, şiddetler, özellik kategorileri.
    expect(lists).toHaveLength(3);
    expect(sorted(lists[0])).toEqual(sorted(FEEDBACK_CATEGORIES.bug));
    expect(sorted(lists[1])).toEqual(sorted(BUG_SEVERITIES));
    expect(sorted(lists[2])).toEqual(sorted(FEEDBACK_CATEGORIES.feature));
  });

  test("uzunluk sınırları aynı", () => {
    const num = (pattern) => {
      const found = block.match(pattern);
      return found ? Number(found[1]) : null;
    };
    expect(num(/title\.size\(\) >= (\d+)/)).toBe(FEEDBACK_LIMITS.titleMin);
    expect(num(/title\.size\(\) <= (\d+)/)).toBe(FEEDBACK_LIMITS.titleMax);
    expect(num(/message\.size\(\) >= (\d+)/)).toBe(FEEDBACK_LIMITS.messageMin);
    expect(num(/message\.size\(\) <= (\d+)/)).toBe(FEEDBACK_LIMITS.messageMax);
    expect(num(/language\.size\(\) <= (\d+)/)).toBe(FEEDBACK_LIMITS.languageMax);
    expect(num(/\[field\]\.size\(\) <= (\d+)/)).toBe(FEEDBACK_LIMITS.shortMax);
  });

  test("plan kapısı: hata bildirimi ücretli plan, özellik isteği yalnız Max", () => {
    const bugBranch = block.match(/kind == 'bug'[\s\S]*?isPaidPlan\(\)/);
    const featureBranch = block.match(/kind == 'feature'[\s\S]*?isMaxPlan\(\)/);
    expect(bugBranch).toBeTruthy();
    expect(featureBranch).toBeTruthy();
    // Kapılar yer değiştirmesin: 'bug' dalında isMaxPlan, 'feature' dalında isPaidPlan çağrısı yok.
    expect(bugBranch[0]).not.toContain("isMaxPlan()");
    expect(featureBranch[0]).not.toContain("isPaidPlan()");
  });

  test("istemci yalnız 'open' durumu yazar; kural da yalnız onu kabul eder", () => {
    expect(block).toContain("status == 'open'");
    expect(
      buildFeedback({
        kind: "bug",
        uid: "a",
        title: "Başlık yeterli",
        message: "Mesaj yeterince uzun yazıldı.",
      }).data.status,
    ).toBe("open");
  });
});
