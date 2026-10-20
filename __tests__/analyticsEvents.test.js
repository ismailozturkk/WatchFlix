import {
  ANALYTICS_EVENTS,
  PARAM_COUNT_MAX,
  PARAM_VALUE_MAX,
  USER_PROPERTIES,
  buildEvent,
  isValidEventName,
  isValidParamName,
  sanitizeParams,
  sanitizeUserProperty,
} from "../utils/analyticsEvents";

describe("olay adı doğrulama", () => {
  test("sözlükteki tüm olaylar geçerli", () => {
    Object.values(ANALYTICS_EVENTS).forEach((name) => {
      expect(isValidEventName(name)).toBe(true);
    });
  });

  test("Firebase'in ayırdığı önekler ve adlar reddedilir", () => {
    expect(isValidEventName("firebase_start")).toBe(false);
    expect(isValidEventName("google_thing")).toBe(false);
    expect(isValidEventName("ga_session")).toBe(false);
    expect(isValidEventName("first_open")).toBe(false);
    expect(isValidEventName("session_start")).toBe(false);
    expect(isValidEventName("error")).toBe(false);
    // in_app_purchase ayrılmış; bizim kullandığımız GA4 adı "purchase".
    expect(isValidEventName("in_app_purchase")).toBe(false);
    expect(ANALYTICS_EVENTS.PURCHASE).toBe("purchase");
  });

  test("biçim kuralları", () => {
    expect(isValidEventName("1_kotu_baslangic")).toBe(false); // harfle başlamalı
    expect(isValidEventName("bosluk var")).toBe(false);
    expect(isValidEventName("tire-var")).toBe(false);
    expect(isValidEventName("türkçe_karakter")).toBe(false);
    expect(isValidEventName("")).toBe(false);
    expect(isValidEventName(null)).toBe(false);
    expect(isValidEventName("a".repeat(41))).toBe(false);
    expect(isValidEventName("a".repeat(40))).toBe(true);
  });

  test("parametre adı aynı kurallara tabi", () => {
    expect(isValidParamName("content_type")).toBe(true);
    expect(isValidParamName("firebase_x")).toBe(false);
    expect(isValidParamName("2sey")).toBe(false);
  });
});

describe("parametre normalizasyonu", () => {
  test("boolean sayıya çevrilir (Firebase boolean kabul etmez)", () => {
    expect(sanitizeParams({ is_premium: true, is_new: false })).toEqual({
      is_premium: 1,
      is_new: 0,
    });
  });

  test("uzun metin kırpılır", () => {
    const long = "x".repeat(250);
    const out = sanitizeParams({ title: long });
    expect(out.title).toHaveLength(PARAM_VALUE_MAX);
  });

  test("geçersiz değerler ve adlar düşer", () => {
    const out = sanitizeParams({
      ok: "deger",
      bos_metin: "",
      yok: null,
      tanimsiz: undefined,
      nan: NaN,
      sonsuz: Infinity,
      dizi: [1, 2],
      nesne: { a: 1 },
      "kotu-ad": "x",
      firebase_ad: "x",
    });
    expect(out).toEqual({ ok: "deger" });
  });

  test("25 parametreden sonrası düşer", () => {
    const params = {};
    for (let i = 0; i < 40; i++) params[`p${i}`] = i + 1;
    expect(Object.keys(sanitizeParams(params))).toHaveLength(PARAM_COUNT_MAX);
  });

  test("parametresiz / bozuk girdi güvenli", () => {
    expect(sanitizeParams(undefined)).toEqual({});
    expect(sanitizeParams("metin")).toEqual({});
  });
});

describe("buildEvent", () => {
  test("geçerli olayı normalize ederek döner", () => {
    expect(
      buildEvent(ANALYTICS_EVENTS.CONTENT_TRACKED, {
        content_type: "movie",
        is_rewatch: true,
        gecersiz: null,
      }),
    ).toEqual({
      name: "content_tracked",
      params: { content_type: "movie", is_rewatch: 1 },
    });
  });

  test("geçersiz adda null döner (çağıran olayı düşürür)", () => {
    expect(buildEvent("first_open", {})).toBeNull();
    expect(buildEvent("", {})).toBeNull();
  });
});

describe("kullanıcı özellikleri", () => {
  test("sözlüktekiler 24 karakter sınırına uyuyor", () => {
    Object.values(USER_PROPERTIES).forEach((name) => {
      expect(sanitizeUserProperty(name, "deger")).toEqual({ name, value: "deger" });
    });
  });

  test("değer 36 karaktere kırpılır, sayı metne çevrilir", () => {
    expect(sanitizeUserProperty("premium_tier", "y".repeat(50)).value).toHaveLength(36);
    expect(sanitizeUserProperty("premium_tier", 3)).toEqual({
      name: "premium_tier",
      value: "3",
    });
  });

  test("boş değer temizleme sayılır, geçersiz ad reddedilir", () => {
    expect(sanitizeUserProperty("premium_tier", null)).toEqual({
      name: "premium_tier",
      value: null,
    });
    expect(sanitizeUserProperty("cok_uzun_bir_ozellik_adi_gercekten", "x")).toBeNull();
    expect(sanitizeUserProperty("", "x")).toBeNull();
  });
});
