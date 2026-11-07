// Film Kulübü: sohbet duyurusu (utils/chatShare club), alıntı simgesi, metin tablosu, premium kaydı.
const fs = require("fs");
const path = require("path");
const {
  SHARE_KIND,
  buildClubShare,
  buildShareMessage,
  readShare,
  sharePreview,
  shareThumb,
} = require("../utils/chatShare");
const { replyGlyph } = require("../utils/chatReply");
const { CLUB_MAX_CANDIDATES } = require("../utils/filmClub");
const { FILM_CLUB_COPY, getFilmClubCopy } = require("../utils/filmClubCopy");
const { PREMIUM_FEATURES, canUseFeature, getFeatureLimit, isLockedFor } = require("../utils/premiumFeatures");
const { PREMIUM_PLAN } = require("../utils/premium");

const { FREE, PREMIUM, UNLIMITED: MAX } = PREMIUM_PLAN;

const film = (id, extra = {}) => ({ id, media_type: "movie", title: `Film ${id}`, poster_path: `/p${id}.jpg`, ...extra });
const base = { groupId: "grp_1", roundId: "r-1", number: 3 };

describe("kulüp duyurusu (chatShare)", () => {
  test("oylama: 2–6 aday; fazlası kırpılır, 2'den azı geçersiz", () => {
    const share = buildClubShare({ ...base, event: "voting", candidates: [1, 2, 3, 4, 5, 6, 7].map((id) => film(id)), endsAt: 123 });
    expect(share.candidates).toHaveLength(CLUB_MAX_CANDIDATES);
    expect(share.endsAt).toBe(123);
    expect(buildClubShare({ ...base, event: "voting", candidates: [film(1)] })).toBeNull();
    // Test ortamının dili İngilizce (önizleme izleyicinin dilinde çözülür; tr metni translations/tr.json).
    expect(sharePreview(share)).toBe("Film Club #3 · voting is open");
    expect(shareThumb(share)).toBe("/p1.jpg");
  });

  test("seçildi / bitti: film zorunlu; ortalama ve sayılar yalnız bitti kartında", () => {
    expect(buildClubShare({ ...base, event: "picked" })).toBeNull();
    const picked = buildClubShare({ ...base, event: "picked", pick: film(9, { release_date: "1999-10-15" }), avgRating: 8 });
    expect(picked.pick).toEqual({ id: 9, media_type: "movie", title: "Film 9", poster_path: "/p9.jpg", year: "1999" });
    expect(picked.avgRating).toBeUndefined();
    expect(sharePreview(picked)).toBe("Film Club #3 · Film 9");
    const done = buildClubShare({ ...base, event: "done", pick: film(9), avgRating: 7.25, watchedCount: 4, memberCount: 5, endsAt: 9 });
    expect(done).toEqual(expect.objectContaining({ avgRating: 7.3, watchedCount: 4, memberCount: 5 }));
    expect(done.endsAt).toBeUndefined();
    expect(sharePreview(done)).toBe("Film Club #3 finished · Film 9");
    const unrated = buildClubShare({ ...base, event: "done", pick: film(9), avgRating: null });
    expect(unrated.avgRating).toBeUndefined();
  });

  test("bozuk kimlik / olay / kişi adayı reddedilir", () => {
    expect(buildClubShare({ ...base, groupId: "../x", event: "picked", pick: film(1) })).toBeNull();
    expect(buildClubShare({ ...base, event: "nope", pick: film(1) })).toBeNull();
    expect(buildClubShare({ ...base, event: "picked", pick: { id: 5, media_type: "person", name: "X" } })).toBeNull();
  });

  test("mesaj alanları: kind clubShare, 🎟️ önekli metin, okunabilir", () => {
    const message = buildShareMessage(buildClubShare({ ...base, event: "picked", pick: film(2) }));
    expect(message.kind).toBe(SHARE_KIND.CLUB);
    expect(message.text.startsWith("🎟️ ")).toBe(true);
    expect(readShare(message)).toEqual(message.share);
    expect(readShare({ ...message, kind: "chainShare" })).toBeNull();
    expect(replyGlyph("club")).toBe("ticket");
  });

  test("aday tavanı chatShare ile çekirdekte aynı", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "utils", "chatShare.js"), "utf8");
    expect(src).toContain(`const MAX_CLUB_CANDIDATES = ${CLUB_MAX_CANDIDATES};`);
  });
});

describe("metin tablosu", () => {
  const keys = Object.keys(FILM_CLUB_COPY.tr).sort();

  test.each(Object.keys(FILM_CLUB_COPY))("%s aynı anahtarlar", (lang) => {
    expect(Object.keys(FILM_CLUB_COPY[lang]).sort()).toEqual(keys);
  });

  test("her anahtar bir yerde kullanılıyor", () => {
    const files = [
      "screens/club/FilmClubScreen.js",
      "screens/club/FilmClubDiscussionScreen.js",
      "components/club/ClubCandidatePicker.js",
      "components/club/ClubChatBanner.js",
      "components/chat/SharedClubMessage.js",
    ].map((rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8"));
    const unused = keys.filter((key) => !files.some((src) => src.includes(`copy.${key}`)));
    expect(unused).toEqual([]);
  });

  test("bilinmeyen dil İngilizce", () => {
    expect(getFilmClubCopy("xx")).toBe(FILM_CLUB_COPY.en);
    expect(FILM_CLUB_COPY.tr.timeLeft({ days: 0, hours: 0 })).toBe("1 sa kaldı");
    expect(FILM_CLUB_COPY.en.timeLeft({ days: 2, hours: 3 })).toBe("2 d 3 h left");
  });
});

describe("premium kaydı", () => {
  test("Film Kulübü kurmak Premium; Free yalnız katılır (30 Eki kararı)", () => {
    expect(getFeatureLimit("film_club", FREE)).toBe(false);
    expect(isLockedFor("film_club", FREE)).toBe(true);
    expect(canUseFeature("film_club", PREMIUM)).toBe(true);
    expect(canUseFeature("film_club", MAX)).toBe(true);
    const feature = PREMIUM_FEATURES.film_club;
    expect(feature.category).toBe("social");
    ["tr", "en", "es", "pt", "de"].forEach((lang) => {
      expect(feature.title[lang]).toBeTruthy();
      expect(feature.freeValue[lang]).toBeTruthy();
      expect(feature.paidValue[lang]).toBeTruthy();
      expect(feature.upsell.message[lang]).toBeTruthy();
    });
  });

  test("sunucu aynası: kulüp açma dalı ücretli plan ister", () => {
    const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
    expect(rules).toMatch(/clubFieldOk\(request\.resource\.data\.club\)[\s\S]{0,300}isPaidPlan\(\)/);
  });
});
