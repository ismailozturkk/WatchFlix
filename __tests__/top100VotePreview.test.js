// __tests__/top100VotePreview.test.js — Top 100 oy kapısı: registry girdisi + yükseltme sayfası önizlemesi.

const fs = require("fs");
const path = require("path");
const { canUseFeature, getFeatureLimit, isLockedFor } = require("../utils/premiumFeatures");
const { buildUpsellContent, buildVotePreview } = require("../utils/premiumUpsellContent");

const POSTER = "https://image.tmdb.org/t/p/w200/abc.jpg";

describe("top100_vote kapısı (aktif oy hakkı)", () => {
  test("kullanıcı kararı: Free 0 (kapalı), Premium 10, Max 20", () => {
    expect(getFeatureLimit("top100_vote", "free")).toBe(0);
    expect(getFeatureLimit("top100_vote", "premium")).toBe(10);
    expect(getFeatureLimit("top100_vote", "unlimited")).toBe(20);
    expect(isLockedFor("top100_vote", "free")).toBe(true);
    expect(canUseFeature("top100_vote", "premium", 9)).toBe(true);
    expect(canUseFeature("top100_vote", "premium", 10)).toBe(false);
    expect(canUseFeature("top100_vote", "unlimited", 19)).toBe(true);
    expect(canUseFeature("top100_vote", "unlimited", 20)).toBe(false);
  });

  test("sunucu aynası aynı sayıları kullanır (firestore.rules hypeVoteLimit)", () => {
    const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
    const block = rules.slice(rules.indexOf("function hypeVoteLimit()"), rules.indexOf("function hypeUsedBefore()"));
    expect(block).toContain(`? ${getFeatureLimit("top100_vote", "unlimited")}`);
    expect(block).toContain(`== 'premium' ? ${getFeatureLimit("top100_vote", "premium")} : 0`);
  });

  test("Free'de kilitli başlık, Premium'da hak doldu başlığı ve kullanım göstergesi", () => {
    expect(buildUpsellContent("top100_vote", "free", "tr").title).toBe("Top 100'de oy Premium'da");
    const full = buildUpsellContent("top100_vote", "premium", "tr", { used: 10 });
    expect(full.title).toBe("Oy hakkın doldu");
    expect(full.meter).toBeTruthy();
  });
});

describe("oy önizlemesi", () => {
  test("afiş, sıra ve dilin basamak ayracıyla oy sayısı; oyun ağırlığı satırı", () => {
    expect(buildVotePreview({ kind: "vote", title: "Interstellar", posterUri: POSTER, rank: 7, votes: 37215 }, "tr")).toEqual({
      kind: "vote",
      label: "Seelogd Top 100",
      title: "Interstellar",
      posterUri: POSTER,
      rank: "#7",
      votes: "37.215 oy",
      gain: "Oyun sıralamada +100 sayılır",
    });
    expect(buildVotePreview({ kind: "vote", title: "Dune", votes: 1234 }, "en")).toMatchObject({
      rank: null,
      posterUri: null,
      votes: "1,234 votes",
      gain: "Your vote counts as +100 in the ranking",
    });
  });

  test("TMDB dışı afiş ve başlıksız önizleme kabul edilmez; uzun başlık kısalır", () => {
    expect(buildVotePreview({ kind: "vote", title: "X", posterUri: "https://evil.example/x.jpg" }, "tr").posterUri).toBeNull();
    expect(buildVotePreview({ kind: "vote", title: "  " }, "tr")).toBeNull();
    expect(buildVotePreview({ kind: "reminder", title: "X" }, "tr")).toBeNull();
    expect(buildVotePreview({ kind: "vote", title: "a".repeat(120) }, "tr").title).toHaveLength(80);
  });

  test("yükseltme sayfası içeriği oy önizlemesini taşır", () => {
    const content = buildUpsellContent("top100_vote", "free", "tr", {
      preview: { kind: "vote", title: "Interstellar", posterUri: POSTER, rank: 7, votes: 37215 },
    });
    expect(content.preview).toMatchObject({ kind: "vote", rank: "#7", votes: "37.215 oy" });
    expect(content.title).toBe("Top 100'de oy Premium'da");
  });
});
