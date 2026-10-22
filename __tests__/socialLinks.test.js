const fs = require("fs");
const path = require("path");
const {
  SOCIAL_KEYS,
  SOCIAL_PLATFORMS,
  hasAnySocialLinks,
  normalizeSocialLinks,
  parseSocialHandle,
  resolveSocialDraft,
  socialLinksEqual,
  socialUrl,
} = require("../utils/socialLinks");
const { SOCIAL_COPY, SOCIAL_NAMES, getSocialCopy } = require("../utils/socialLinksCopy");
const { isProfileEditDirty } = require("../utils/profileEdit");

describe("kullanıcı adı çıkarma", () => {
  it("düz ad ve @ad kabul edilir", () => {
    expect(parseSocialHandle("instagram", "ismail.dev")).toBe("ismail.dev");
    expect(parseSocialHandle("instagram", "@ismail.dev")).toBe("ismail.dev");
    expect(parseSocialHandle("x", "  @seelogd ")).toBe("seelogd");
  });

  it("platformun kendi adresinden kullanıcı adı çıkar", () => {
    expect(parseSocialHandle("instagram", "https://www.instagram.com/ismail.dev/")).toBe("ismail.dev");
    expect(parseSocialHandle("instagram", "instagram.com/ismail.dev")).toBe("ismail.dev");
    expect(parseSocialHandle("x", "https://x.com/seelogd?s=20")).toBe("seelogd");
    expect(parseSocialHandle("x", "https://twitter.com/seelogd")).toBe("seelogd");
    expect(parseSocialHandle("tiktok", "https://www.tiktok.com/@seelogd")).toBe("seelogd");
    expect(parseSocialHandle("youtube", "https://youtube.com/@seelogd")).toBe("seelogd");
    expect(parseSocialHandle("snapchat", "https://www.snapchat.com/add/seelogd")).toBe("seelogd");
    expect(parseSocialHandle("letterboxd", "https://letterboxd.com/seelogd/")).toBe("seelogd");
  });

  it("başka sitenin adresi ve içerik adresleri REDDEDİLİR", () => {
    expect(parseSocialHandle("instagram", "https://evil.example/ismail")).toBeNull();
    expect(parseSocialHandle("instagram", "https://instagram.com.evil.example/ismail")).toBeNull();
    expect(parseSocialHandle("x", "https://instagram.com/seelogd")).toBeNull();
    expect(parseSocialHandle("youtube", "https://www.youtube.com/watch?v=abc")).toBeNull();
    expect(parseSocialHandle("youtube", "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv")).toBeNull();
    expect(parseSocialHandle("instagram", "https://instagram.com/p/Cabc123")).toBeNull();
  });

  it("biçime uymayan değer null, boş metin boş döner", () => {
    expect(parseSocialHandle("x", "çok uzun ve boşluklu")).toBeNull();
    expect(parseSocialHandle("x", "abcdefghijklmnopq")).toBeNull(); // 17 > 15
    expect(parseSocialHandle("twitch", "abc")).toBeNull(); // en az 4
    expect(parseSocialHandle("x", "   ")).toBe("");
    expect(parseSocialHandle("bilinmeyen", "a")).toBeNull();
  });
});

describe("adres kurma", () => {
  it("adres her zaman platformun sabit alan adından kurulur", () => {
    expect(socialUrl("instagram", "ismail.dev")).toBe("https://www.instagram.com/ismail.dev");
    expect(socialUrl("x", "@seelogd")).toBe("https://x.com/seelogd");
    expect(socialUrl("tiktok", "seelogd")).toBe("https://www.tiktok.com/@seelogd");
    expect(socialUrl("letterboxd", "seelogd")).toBe("https://letterboxd.com/seelogd/");
  });

  it("geçersiz kullanıcı adı adres üretmez (yol/URL enjeksiyonu yok)", () => {
    expect(socialUrl("instagram", "../../evil")).toBeNull();
    expect(socialUrl("x", "a/b")).toBeNull();
    expect(socialUrl("x", "javascript:alert(1)")).toBeNull();
    expect(socialUrl("bilinmeyen", "a")).toBeNull();
  });
});

describe("normalizasyon ve karşılaştırma", () => {
  it("bilinmeyen anahtar, boş ve geçersiz değer atılır", () => {
    expect(
      normalizeSocialLinks({ instagram: "@ismail", x: "", tiktok: 5, evil: "a", youtube: "a b" }),
    ).toEqual({ instagram: "ismail" });
    expect(normalizeSocialLinks(null)).toEqual({});
    expect(normalizeSocialLinks("x")).toEqual({});
  });

  it("alan yok ile boş harita eşit sayılır (eski hesap kirlenmez)", () => {
    expect(socialLinksEqual(undefined, {})).toBe(true);
    expect(socialLinksEqual({ x: "a" }, { x: "a" })).toBe(true);
    expect(socialLinksEqual({ x: "a" }, { x: "b" })).toBe(false);
    expect(socialLinksEqual({ x: "a" }, {})).toBe(false);
    expect(hasAnySocialLinks({})).toBe(false);
    expect(hasAnySocialLinks({ x: "a" })).toBe(true);
  });

  it("taslak çözümü: dolu alanlar kaydedilir, hatalılar işaretlenir", () => {
    expect(resolveSocialDraft({ instagram: "instagram.com/ismail", x: "", tiktok: "!!", youtube: "  " })).toEqual({
      links: { instagram: "ismail" },
      invalid: ["tiktok"],
    });
  });
});

describe("Profili Düzenle — Kaydet durumu", () => {
  const base = {
    displayName: "A",
    username: "a",
    bio: "",
    avatarIndex: 0,
    birthDate: "2000-01-01",
  };
  it("sosyal hesap değişince açılır, değişmeyince kapalı kalır", () => {
    const saved = { ...base, socialLinks: { x: "a" } };
    expect(isProfileEditDirty({ ready: true, saved, draft: { ...base, socialLinks: { x: "a" } } })).toBe(false);
    expect(isProfileEditDirty({ ready: true, saved, draft: { ...base, socialLinks: { x: "b" } } })).toBe(true);
    expect(isProfileEditDirty({ ready: true, saved, draft: { ...base, socialLinks: {} } })).toBe(true);
  });
  it("hatalı alan varken Kaydet açık kalır (hata mesajı gösterilebilsin)", () => {
    expect(
      isProfileEditDirty({
        ready: true,
        saved: { ...base },
        draft: { ...base, socialLinks: {}, socialInvalid: ["x"] },
      }),
    ).toBe(true);
  });
});

describe("metinler ve kural eşleşmesi", () => {
  it("her dilde aynı yapı; bilinmeyen dil İngilizceye düşer", () => {
    const shape = (v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x]));
    for (const lang of ["en", "es", "pt", "de"]) {
      expect(shape(SOCIAL_COPY[lang])).toEqual(shape(SOCIAL_COPY.tr));
    }
    expect(getSocialCopy("fr")).toBe(SOCIAL_COPY.en);
    expect(SOCIAL_COPY.tr.invalid("X")).toContain("X");
  });

  it("her platformun görünen adı var", () => {
    for (const key of SOCIAL_KEYS) expect(SOCIAL_NAMES[key]).toBeTruthy();
  });

  it("firestore.rules aynı platform anahtarlarını izinli sayıyor", () => {
    const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
    const fn = rules.slice(rules.indexOf("function socialLinksOk"));
    for (const p of SOCIAL_PLATFORMS) {
      expect(fn).toContain(`'${p.key}'`);
      expect(fn).toContain(`s.get('${p.key}', '')`);
    }
  });
});
