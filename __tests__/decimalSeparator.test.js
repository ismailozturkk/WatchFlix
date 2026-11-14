// Ondalık ayraç: İngilizce ve Japoncada nokta, diğer uygulama dillerinde virgül.
const { formatStarAverage } = require("../utils/ratingDistribution");
const { formatStoryNumber } = require("../utils/profileStoryCard");
const { formatGoalNumber } = require("../components/profile/yearlyGoalCopy");
const { QUICK_COPY: QUICK_GAMES_COPY } = require("../utils/quickGamesCopy");

const DOT = ["en", "ja"];
const COMMA = ["tr", "es", "pt", "de", "it", "fr"];

describe("ondalık ayraç", () => {
  it.each(DOT)("%s: nokta", (lang) => {
    expect(formatStarAverage(8.5, lang)).toBe("8.5");
    expect(formatStoryNumber(15500, lang, { compact: true })).toMatch(/^15\.5/);
    expect(formatGoalNumber(2.5, lang)).toBe("2.5");
  });
  it.each(COMMA)("%s: virgül", (lang) => {
    expect(formatStarAverage(8.5, lang)).toBe("8,5");
    expect(formatStoryNumber(15500, lang, { compact: true })).toMatch(/^15,5/);
    expect(formatGoalNumber(2.5, lang)).toBe("2,5");
  });
  it("kısaltma: fr k, ja K, tr B", () => {
    expect(formatStoryNumber(15500, "fr", { compact: true })).toBe("15,5 k");
    expect(formatStoryNumber(15500, "ja", { compact: true })).toBe("15.5K");
    expect(formatStoryNumber(15500, "tr", { compact: true })).toBe("15,5B");
  });
  it("hızlı oyun puanı it/fr virgüllü, ja noktalı", () => {
    if (!QUICK_GAMES_COPY) return;
    const fmt = (lang) => (QUICK_GAMES_COPY[lang].rating || QUICK_GAMES_COPY[lang].higherLower?.rating || {}).format;
    for (const lang of ["it", "fr"]) if (fmt(lang)) expect(fmt(lang)(7.5)).toBe("★ 7,5");
    if (fmt("ja")) expect(fmt("ja")(7.5)).toBe("★ 7.5");
  });
});
