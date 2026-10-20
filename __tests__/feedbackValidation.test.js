// __tests__/feedbackValidation.test.js
//
// Geri bildirim kaydının şekli: kurala (firestore.rules → Feedback) gidecek belge
// burada üretilir. Kural tarafıyla eşitlik __tests__/feedbackRulesParity.test.js'te.

const {
  BUG_SEVERITIES,
  FEEDBACK_CATEGORIES,
  FEEDBACK_LIMITS,
  FEEDBACK_STATUSES,
  buildFeedback,
  charCount,
  checkFeedbackDraft,
  formatDeviceLine,
  normalizeFeedbackDoc,
  sortFeedback,
} = require("../utils/feedbackValidation");

const bug = (extra = {}) => ({
  kind: "bug",
  uid: "alice",
  category: "crash",
  severity: "blocking",
  title: "Listeler ekranı kapanıyor",
  message: "Listelerim ekranına girince uygulama kendiliğinden kapanıyor.",
  language: "tr",
  device: { appVersion: "v1.4.9", platform: "ios", osVersion: "26.0", deviceModel: "iPhone 16" },
  ...extra,
});

const feature = (extra = {}) => ({
  kind: "feature",
  uid: "bob",
  category: "lists",
  title: "Listeleri sürükleyerek sırala",
  message: "Özel listelerimi sürükleyip bırakarak sıralamak istiyorum.",
  language: "en",
  ...extra,
});

describe("buildFeedback", () => {
  test("hata bildirimi: tam şekil, durum open, cihaz alanları dahil", () => {
    const res = buildFeedback(bug());
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({
      uid: "alice",
      kind: "bug",
      category: "crash",
      severity: "blocking",
      title: "Listeler ekranı kapanıyor",
      message: "Listelerim ekranına girince uygulama kendiliğinden kapanıyor.",
      status: "open",
      language: "tr",
      appVersion: "v1.4.9",
      platform: "ios",
      osVersion: "26.0",
      deviceModel: "iPhone 16",
    });
  });

  test("özellik isteği: şiddet ve cihaz alanı YOK", () => {
    const res = buildFeedback(feature({ severity: "blocking" }));
    expect(res.ok).toBe(true);
    expect(res.data).not.toHaveProperty("severity");
    for (const field of ["appVersion", "platform", "osVersion", "deviceModel"]) {
      expect(res.data).not.toHaveProperty(field);
    }
  });

  test("cihaz bilgisi kapalıysa (null) hiçbir cihaz alanı yazılmaz", () => {
    const res = buildFeedback(bug({ device: null }));
    expect(res.ok).toBe(true);
    for (const field of ["appVersion", "platform", "osVersion", "deviceModel"]) {
      expect(res.data).not.toHaveProperty(field);
    }
  });

  test("boş cihaz alanı atılır, uzun olan kırpılır", () => {
    const res = buildFeedback(
      bug({ device: { appVersion: "", platform: "android", osVersion: "x".repeat(90), deviceModel: "  " } }),
    );
    expect(res.data).not.toHaveProperty("appVersion");
    expect(res.data).not.toHaveProperty("deviceModel");
    expect(res.data.platform).toBe("android");
    expect(charCount(res.data.osVersion)).toBe(FEEDBACK_LIMITS.shortMax);
  });

  test("bilinmeyen kategori 'other'a, bilinmeyen şiddet 'annoying'e düşer", () => {
    expect(buildFeedback(bug({ category: "ui" })).data.category).toBe("other");
    expect(buildFeedback(bug({ severity: "apocalypse" })).data.severity).toBe("annoying");
    // Özellik kategorisi hata türünde geçersizdir.
    expect(buildFeedback(bug({ category: "lists" })).data.category).toBe("other");
    expect(buildFeedback(feature({ category: "crash" })).data.category).toBe("other");
    // Seçilmemiş kategori (ekranda null) da "other".
    expect(buildFeedback(bug({ category: null })).data.category).toBe("other");
  });

  test("geçersiz girdi nedeniyle reddedilir", () => {
    expect(buildFeedback(bug({ kind: "post" }))).toEqual({ ok: false, error: "kind" });
    expect(buildFeedback(bug({ uid: "  " }))).toEqual({ ok: false, error: "uid" });
    expect(buildFeedback(bug({ title: "ab" }))).toEqual({ ok: false, error: "title" });
    expect(buildFeedback(bug({ message: "kısa" }))).toEqual({ ok: false, error: "message" });
    expect(buildFeedback()).toEqual({ ok: false, error: "kind" });
  });

  test("başlık tek satıra iner; mesajın satır sonları KALIR, fazla boş satır 2'ye iner", () => {
    const res = buildFeedback(
      bug({
        title: "  Çok   boşluklu\nbaşlık  ",
        message: "1) Listeler'e git\r\n\r\n\r\n\r\n2) Bir listeye dokun\n3) Uygulama kapanıyor   ",
      }),
    );
    expect(res.data.title).toBe("Çok boşluklu başlık");
    expect(res.data.message).toBe("1) Listeler'e git\n\n2) Bir listeye dokun\n3) Uygulama kapanıyor");
  });

  test("sınırlar kod noktasıyla sayılır ve kırpılır (emoji 1 karakter)", () => {
    // 5 emoji = 5 karakter (JS length 10): mesaj için 10 karakter şartını SAĞLAMAZ.
    expect(buildFeedback(bug({ message: "😀😀😀😀😀" }))).toEqual({ ok: false, error: "message" });
    const long = buildFeedback(
      bug({ title: "a".repeat(200), message: "😀".repeat(FEEDBACK_LIMITS.messageMax + 50) }),
    );
    expect(charCount(long.data.title)).toBe(FEEDBACK_LIMITS.titleMax);
    expect(charCount(long.data.message)).toBe(FEEDBACK_LIMITS.messageMax);
  });

  test("dil normalize edilir (bilinmeyen → en)", () => {
    expect(buildFeedback(bug({ language: "es" })).data.language).toBe("es");
    expect(buildFeedback(bug({ language: "xx" })).data.language).toBe("en");
    expect(buildFeedback(bug({ language: undefined })).data.language).toBe("en");
  });
});

describe("checkFeedbackDraft", () => {
  test("eşikler buildFeedback ile aynı", () => {
    expect(checkFeedbackDraft({ title: "ab", message: "yeterince uzun bir mesaj" }).ready).toBe(false);
    expect(checkFeedbackDraft({ title: "abc", message: "kısa" }).ready).toBe(false);
    expect(checkFeedbackDraft({ title: "abc", message: "tam on kr." }).ready).toBe(true);
    expect(checkFeedbackDraft().ready).toBe(false);
  });

  test("kalan karakter ve sayaç", () => {
    const check = checkFeedbackDraft({ title: "  abc  ", message: "x".repeat(990) });
    expect(check.titleLength).toBe(3);
    expect(check.messageLeft).toBe(10);
  });
});

describe("sabitler", () => {
  test("her türün son kategorisi 'other', hepsi benzersiz", () => {
    for (const ids of Object.values(FEEDBACK_CATEGORIES)) {
      expect(ids[ids.length - 1]).toBe("other");
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(new Set(BUG_SEVERITIES).size).toBe(BUG_SEVERITIES.length);
  });
});

describe("formatDeviceLine", () => {
  test("tam satır ve eksik parça atlama", () => {
    expect(formatDeviceLine({ appVersion: "v1.4.9", platform: "ios", osVersion: "26.0", deviceModel: "iPhone 16" })).toBe(
      "Seelogd v1.4.9 · iOS 26.0 · iPhone 16",
    );
    expect(formatDeviceLine({ platform: "android", osVersion: "15" })).toBe("Android 15");
    expect(formatDeviceLine({ deviceModel: "Pixel 9" })).toBe("Pixel 9");
    expect(formatDeviceLine(null)).toBe("");
    expect(formatDeviceLine({})).toBe("");
  });
});

describe("normalizeFeedbackDoc ve sortFeedback", () => {
  test("bozuk/eksik belge listeyi bozmaz", () => {
    const item = normalizeFeedbackDoc("x1", { kind: "??", status: "weird", severity: "huge", title: 5 });
    expect(item).toMatchObject({
      id: "x1",
      kind: "bug",
      category: "other",
      severity: null,
      title: "",
      status: "open",
      reply: "",
      createdAtMs: 0,
    });
    expect(FEEDBACK_STATUSES).toContain(item.status);
  });

  test("Firestore zaman damgası ve yönetici yanıtı okunur", () => {
    const item = normalizeFeedbackDoc("x2", {
      kind: "feature",
      category: "ai",
      title: "Fikir",
      message: "Açıklama",
      status: "planned",
      reply: "  Planlarımızda!  ",
      createdAt: { toMillis: () => 1_700_000_000_000 },
    });
    expect(item.kind).toBe("feature");
    expect(item.status).toBe("planned");
    expect(item.reply).toBe("Planlarımızda!");
    expect(item.createdAtMs).toBe(1_700_000_000_000);
    expect(normalizeFeedbackDoc("x3", { createdAt: { seconds: 10 } }).createdAtMs).toBe(10_000);
  });

  test("en yeni üstte; sunucuya yazılmamış (tarihsiz) kayıt en üstte", () => {
    const sorted = sortFeedback([
      { id: "old", createdAtMs: 100 },
      { id: "pending", createdAtMs: 0 },
      { id: "new", createdAtMs: 300 },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["pending", "new", "old"]);
  });
});
