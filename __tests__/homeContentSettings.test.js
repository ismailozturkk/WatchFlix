// __tests__/homeContentSettings.test.js
//
// "Ayar değişince ana ekran güncellensin" sisteminin saf çekirdeği
// (utils/homeContentSettings.js). Bağlamların gerçekten yeniden çektiği
// __tests__/homeSettingsSync.test.js'te.

import {
  ADULT_SCOPE_SUFFIX,
  HOME_SETTING_EFFECT,
  HOME_SETTING_EFFECTS,
  adultScoped,
  buildHomeContentSettings,
  dropAdult,
  normalizeProviderIds,
  providersKey,
} from "../utils/homeContentSettings";

describe("adultScoped", () => {
  test("izin yokken anahtar ESKİ biçimiyle kalır (mevcut önbellekler bozulmaz)", () => {
    expect(adultScoped("movie_bests_tr-TR_vote_count.desc_page_1", false)).toBe(
      "movie_bests_tr-TR_vote_count.desc_page_1",
    );
  });

  test("izin varken ayrı bir kovaya düşer", () => {
    expect(adultScoped("movie_bests_tr-TR_x", true)).toBe(
      `movie_bests_tr-TR_x${ADULT_SCOPE_SUFFIX}`,
    );
  });

  test("iki kova birbirinin anahtarı değildir", () => {
    const key = "tv_provider_tr-TR_TR_8_p1";
    expect(adultScoped(key, true)).not.toBe(adultScoped(key, false));
  });

  test("ek anahtarın SONUNDA — önek tabanlı kategori/temizlik kodları şaşmaz", () => {
    const scoped = adultScoped("movie_provider_tr-TR_TR_8_p1", true);
    expect(scoped.startsWith("movie_")).toBe(true);
    expect(scoped.endsWith(ADULT_SCOPE_SUFFIX)).toBe(true);
  });
});

describe("dropAdult", () => {
  const temiz = { id: 1, adult: false };
  const bilinmeyen = { id: 2 };
  const yetiskin = { id: 3, adult: true };

  test("izin yokken adult:true kayıtlar elenir", () => {
    expect(dropAdult([temiz, yetiskin, bilinmeyen], false)).toEqual([temiz, bilinmeyen]);
  });

  test("izin varken liste olduğu gibi döner", () => {
    const liste = [temiz, yetiskin];
    expect(dropAdult(liste, true)).toBe(liste);
  });

  // KİMLİK KORUNUR: bağlam değeri ve memo'lu kartlar boşuna yeniden çizilmesin.
  test("süzülecek bir şey yoksa AYNI dizi döner", () => {
    const liste = [temiz, bilinmeyen];
    expect(dropAdult(liste, false)).toBe(liste);
  });

  test("dizi olmayan değere dokunmaz", () => {
    expect(dropAdult(null, false)).toBeNull();
    expect(dropAdult(undefined, false)).toBeUndefined();
    const nesne = { results: [yetiskin] };
    expect(dropAdult(nesne, false)).toBe(nesne);
  });

  test("boş dizi bozulmaz", () => {
    const bos = [];
    expect(dropAdult(bos, false)).toBe(bos);
  });

  test("adult alanı yalnız tam olarak true ise yetişkin sayılır", () => {
    expect(dropAdult([{ id: 1, adult: "true" }, { id: 2, adult: 1 }], false)).toHaveLength(2);
  });
});

describe("providersKey / normalizeProviderIds", () => {
  test("sıra ve tekrar farkı aynı anahtarı verir (içerik kimliği)", () => {
    expect(providersKey([337, 8, 8])).toBe(providersKey([8, 337]));
    expect(providersKey([337, 8])).toBe("8-337");
  });

  test("farklı küme farklı anahtar verir", () => {
    expect(providersKey([8])).not.toBe(providersKey([8, 9]));
  });

  test("geçersiz değerleri eler, sayıya çevirir", () => {
    expect(normalizeProviderIds(["8", 0, -3, "x", null, 8.5, 9])).toEqual([8, 9]);
  });

  test("dizi olmayan girdi boş sayılır", () => {
    expect(providersKey(undefined)).toBe("");
    expect(providersKey(null)).toBe("");
    expect(normalizeProviderIds("8")).toEqual([]);
  });
});

describe("buildHomeContentSettings", () => {
  const base = {
    adultContent: false,
    streamingProviderIds: [8],
    imageQualityLevel: "good",
    railPosterSize: "normal",
    railPosterRadius: 15,
    posterBadges: { tmdbRating: true, status: false },
  };

  test("adultScope ayara göre", () => {
    expect(buildHomeContentSettings(base).adultScope).toBe("");
    expect(buildHomeContentSettings({ ...base, adultContent: true }).adultScope).toBe(
      ADULT_SCOPE_SUFFIX,
    );
  });

  test("adultContent yalnız tam true ise açık sayılır", () => {
    expect(buildHomeContentSettings({ ...base, adultContent: "true" }).adultContent).toBe(false);
    expect(buildHomeContentSettings({ ...base, adultContent: undefined }).adultContent).toBe(false);
  });

  test("girdisiz çağrı patlamaz", () => {
    expect(() => buildHomeContentSettings()).not.toThrow();
    expect(buildHomeContentSettings().providersKey).toBe("");
  });

  // KAYIT DEFTERİ DEĞİŞMEZİ: yeni bir ayar HOME_SETTING_EFFECTS'e yazılıp çıktıya
  // bağlanmazsa (ya da tersi) bu test patlar — ayar eklenip ana ekranın haberi
  // olmaması, bu sistemin kapatmaya çalıştığı hatanın kendisi.
  describe("kayıt defteri her ayarın çıktıyı GERÇEKTEN değiştirdiğini kilitler", () => {
    const degisiklikler = {
      adultContent: { ...base, adultContent: true },
      streamingProviderIds: { ...base, streamingProviderIds: [8, 337] },
      imageQualityLevel: { ...base, imageQualityLevel: "low" },
      railPosterSize: { ...base, railPosterSize: "small" },
      railPosterRadius: { ...base, railPosterRadius: 24 },
      posterBadges: { ...base, posterBadges: { tmdbRating: false, status: false } },
    };

    test("her kayıtlı ayar için bir değişiklik örneği var", () => {
      expect(Object.keys(degisiklikler).sort()).toEqual(
        Object.keys(HOME_SETTING_EFFECTS).sort(),
      );
    });

    test.each(Object.keys(HOME_SETTING_EFFECTS))("%s", (ayar) => {
      const once = buildHomeContentSettings(base);
      const sonra = buildHomeContentSettings(degisiklikler[ayar]);
      const sinif = HOME_SETTING_EFFECTS[ayar];

      const veriDegisti =
        once.adultContent !== sonra.adultContent ||
        once.adultScope !== sonra.adultScope ||
        once.providersKey !== sonra.providersKey;
      const cizimDegisti = once.renderKey !== sonra.renderKey;

      if (sinif === HOME_SETTING_EFFECT.DATA) {
        expect(veriDegisti).toBe(true);
        // VERİ ayarı çizim anahtarını oynatmaz: gereksiz hücre yenilemesi olmasın.
        expect(cizimDegisti).toBe(false);
      } else {
        expect(cizimDegisti).toBe(true);
        // ÇİZİM ayarı veri anahtarlarını oynatmaz: yeniden ağ isteği olmasın.
        expect(veriDegisti).toBe(false);
      }
    });
  });

  test("aynı değerlerle yeniden çağrı aynı anahtarları üretir", () => {
    expect(buildHomeContentSettings(base)).toEqual(buildHomeContentSettings({ ...base }));
  });

  test("rozet anahtarlarının sırası renderKey'i etkilemez", () => {
    const a = buildHomeContentSettings({ ...base, posterBadges: { a: true, b: false } });
    const b = buildHomeContentSettings({ ...base, posterBadges: { b: false, a: true } });
    expect(a.renderKey).toBe(b.renderKey);
  });

  test("platformların sırası providersKey'i etkilemez", () => {
    const a = buildHomeContentSettings({ ...base, streamingProviderIds: [337, 8] });
    const b = buildHomeContentSettings({ ...base, streamingProviderIds: [8, 337] });
    expect(a.providersKey).toBe(b.providersKey);
  });
});
