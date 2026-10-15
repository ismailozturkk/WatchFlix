const {
  ONBOARDING_COPY,
  ONBOARDING_STEP_ORDER,
  getOnboardingCopy,
  onboardingStepName,
} = require("../screens/onboarding/onboardingCopy");

// Anahtar yapısı (nesne/dizi uzunluğu/fonksiyon) iki dilde de aynı olmalı:
// biri eksik kalırsa o dilde slayt boş ya da çökük görünür.
const shape = (value) => {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  }
  return typeof value;
};

describe("onboarding metinleri", () => {
  it("tr ve en aynı yapıda", () => {
    expect(shape(ONBOARDING_COPY.en)).toEqual(shape(ONBOARDING_COPY.tr));
  });

  it("bilinmeyen dil Türkçeye düşer", () => {
    expect(getOnboardingCopy("de")).toBe(ONBOARDING_COPY.tr);
    expect(getOnboardingCopy("en")).toBe(ONBOARDING_COPY.en);
  });

  it("vurgulanan kelime başlığın içinde geçiyor (yoksa vurgu sessizce kaybolur)", () => {
    for (const lang of ["tr", "en"]) {
      const copy = ONBOARDING_COPY[lang];
      const titled = [
        ...copy.features,
        copy.genre,
        copy.provider,
        copy.cta,
      ];
      for (const item of titled) {
        expect(item.title).toContain(item.titleAccent);
      }
    }
  });

  it("platform sayacı sıfırı ve çoğulu doğru yazıyor", () => {
    expect(ONBOARDING_COPY.tr.provider.selected(0)).toBe("Henüz seçmedin");
    expect(ONBOARDING_COPY.tr.provider.selected(3)).toBe("3 platform seçildi");
    expect(ONBOARDING_COPY.en.provider.selected(2)).toBe("2 selected");
  });
});

describe("onboarding adım sırası", () => {
  it("analitik adım adları değişmedi (huni raporları bunlara bağlı)", () => {
    const copy = ONBOARDING_COPY.tr;
    expect(ONBOARDING_STEP_ORDER.map((step) => onboardingStepName(step, copy))).toEqual([
      "discover",
      "genre_preferences",
      "ai",
      "provider_preferences",
      "profile",
      "account_cta",
    ]);
  });

  it("son adım her zaman kayıt/giriş slaytı", () => {
    expect(ONBOARDING_STEP_ORDER[ONBOARDING_STEP_ORDER.length - 1].type).toBe("cta");
  });

  it("her özellik adımı var olan bir metne bağlı", () => {
    for (const step of ONBOARDING_STEP_ORDER.filter((item) => item.type === "feature")) {
      expect(ONBOARDING_COPY.tr.features[step.featureIndex]).toBeTruthy();
      expect(ONBOARDING_COPY.en.features[step.featureIndex]).toBeTruthy();
    }
  });
});
