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
  it("tr, en ve es aynı yapıda", () => {
    expect(shape(ONBOARDING_COPY.en)).toEqual(shape(ONBOARDING_COPY.tr));
    expect(shape(ONBOARDING_COPY.es)).toEqual(shape(ONBOARDING_COPY.tr));
  });

  it("bilinmeyen dil İngilizceye düşer (Türkçeye DEĞİL)", () => {
    expect(getOnboardingCopy("de")).toBe(ONBOARDING_COPY.en);
    expect(getOnboardingCopy(undefined)).toBe(ONBOARDING_COPY.en);
    expect(getOnboardingCopy("en")).toBe(ONBOARDING_COPY.en);
    expect(getOnboardingCopy("tr")).toBe(ONBOARDING_COPY.tr);
    expect(getOnboardingCopy("es")).toBe(ONBOARDING_COPY.es);
  });

  it("dil düğmesi etiketi döngüde SIRADAKİ dili adlandırır (tr → en → es → tr)", () => {
    expect(ONBOARDING_COPY.tr.language).toBe("English");
    expect(ONBOARDING_COPY.en.language).toBe("Español");
    expect(ONBOARDING_COPY.es.language).toBe("Türkçe");
  });

  it("vurgulanan kelime başlığın içinde geçiyor (yoksa vurgu sessizce kaybolur)", () => {
    for (const lang of ["tr", "en", "es"]) {
      const copy = ONBOARDING_COPY[lang];
      const titled = [
        ...copy.features,
        copy.genre,
        copy.provider,
        copy.favorites,
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
    expect(ONBOARDING_COPY.es.provider.selected(0)).toBe("Aún no has elegido ninguna");
    expect(ONBOARDING_COPY.es.provider.selected(1)).toBe("1 elegida");
    expect(ONBOARDING_COPY.es.provider.selected(3)).toBe("3 elegidas");
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
      "favorites_preferences",
      "account_cta",
    ]);
  });

  it("favori adımı yalnız sona eklendi: önceki adımların sırası aynı kaldı", () => {
    const copy = ONBOARDING_COPY.tr;
    const names = ONBOARDING_STEP_ORDER.map((step) => onboardingStepName(step, copy));
    expect(names.slice(0, 5)).toEqual([
      "discover",
      "genre_preferences",
      "ai",
      "provider_preferences",
      "profile",
    ]);
  });

  it("favori sayacı sıfırı ve çoğulu doğru yazıyor", () => {
    expect(ONBOARDING_COPY.tr.favorites.selected(0)).toBe("Henüz seçmedin");
    expect(ONBOARDING_COPY.tr.favorites.selected(5)).toBe("5 favori seçildi");
    expect(ONBOARDING_COPY.en.favorites.selected(0)).toBe("None selected yet");
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
