// __tests__/followedPeople.test.js
//
// Oyuncu / yönetmen takibi: saf çekirdek (utils/followedPeople.js) + metin tablosu.
const {
  MAX_FOLLOWED,
  daysUntil,
  describePeople,
  followPerson,
  followedList,
  isFollowed,
  localDateKey,
  mergeUpcoming,
  normalizeFollowed,
  toFollowRecord,
  toStoredFollowed,
  unfollowPerson,
  upcomingFromCredits,
} = require("../utils/followedPeople");
const { FOLLOWED_PEOPLE_COPY, departmentLabel, getFollowedPeopleCopy } = require("../utils/followedPeopleCopy");

const NOW = new Date(2026, 9, 18, 12, 0, 0); // 18 Ekim 2026, yerel öğlen

const person = (id, extra = {}) => ({ id, name: `Kişi ${id}`, profile_path: `/p${id}.jpg`, known_for_department: "Acting", ...extra });

describe("kayıt: normalize / takip / bırak", () => {
  it("bozuk girdiyi boş sözlüğe çevirir", () => {
    for (const raw of [null, undefined, 5, "x", [], [{ id: 1, name: "A" }]]) {
      expect(normalizeFollowed(raw)).toEqual({});
    }
  });

  it("geçersiz kayıtları atar, geçerlileri temizler", () => {
    const out = normalizeFollowed({
      1: { id: 1, name: "  Ada  ", photo: "/a.jpg", department: "Acting", at: 5 },
      2: { id: 2, name: "" },
      x: { id: "x", name: "Kötü" },
      3: { name: "Anahtardan gelen id", at: 9 },
    });
    expect(Object.keys(out).sort()).toEqual(["1", "3"]);
    expect(out["1"].name).toBe("Ada");
    expect(out["3"].id).toBe(3);
  });

  it("üst sınırı en yeni takip önde olacak biçimde uygular", () => {
    const raw = {};
    for (let i = 1; i <= MAX_FOLLOWED + 5; i += 1) raw[i] = { id: i, name: `K${i}`, at: i };
    const out = normalizeFollowed(raw);
    expect(Object.keys(out)).toHaveLength(MAX_FOLLOWED);
    expect(out[String(MAX_FOLLOWED + 5)]).toBeDefined();
    expect(out["1"]).toBeUndefined();
  });

  it("takibe alır, ikinci kez eklemez, sınırda durur", () => {
    const first = followPerson({}, person(7), 100);
    expect(first.status).toBe("added");
    expect(first.followed["7"]).toMatchObject({ id: 7, name: "Kişi 7", photo: "/p7.jpg", department: "Acting", at: 100 });
    expect(followPerson(first.followed, person(7), 200).status).toBe("exists");

    let full = {};
    for (let i = 1; i <= MAX_FOLLOWED; i += 1) full = followPerson(full, person(i), i).followed;
    const over = followPerson(full, person(9999), 1);
    expect(over.status).toBe("limit");
    expect(isFollowed(over.followed, 9999)).toBe(false);
  });

  it("kimliği ya da adı olmayan kişiyi reddeder", () => {
    expect(followPerson({}, { id: 0, name: "A" }).status).toBe("invalid");
    expect(followPerson({}, { id: 3, name: " " }).status).toBe("invalid");
    expect(toFollowRecord(null)).toBeNull();
  });

  it("bırakınca siler; olmayanı bırakmak girdiyi değiştirmez", () => {
    const { followed } = followPerson({}, person(1), 1);
    expect(unfollowPerson(followed, 1)).toEqual({});
    expect(unfollowPerson(followed, 2)).toEqual(followed);
  });

  it("liste en yeni takip üstte; boşsa depoya null yazılır", () => {
    let map = followPerson({}, person(1), 10).followed;
    map = followPerson(map, person(2), 30).followed;
    map = followPerson(map, person(3), 20).followed;
    expect(followedList(map).map((p) => p.id)).toEqual([2, 3, 1]);
    expect(toStoredFollowed({})).toBeNull();
    expect(toStoredFollowed(map)).toEqual(map);
  });

  it("girdi nesnesini değiştirmez", () => {
    const base = followPerson({}, person(1), 1).followed;
    const frozen = JSON.stringify(base);
    followPerson(base, person(2), 2);
    unfollowPerson(base, 1);
    expect(JSON.stringify(base)).toBe(frozen);
  });
});

describe("yaklaşan ayıklama", () => {
  const movie = (id, date, extra = {}) => ({
    id,
    media_type: "movie",
    title: `Film ${id}`,
    poster_path: `/m${id}.jpg`,
    release_date: date,
    character: "Rol",
    genre_ids: [18],
    ...extra,
  });

  it("yerel gün anahtarı: yerel takvim günü, UTC değil", () => {
    expect(localDateKey(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
    expect(localDateKey(NOW)).toBe("2026-10-18");
  });

  it("bugün ve sonrası alınır; geçmiş ve tarihsiz elenir", () => {
    const items = upcomingFromCredits(
      {
        cast: [
          movie(1, "2026-10-17"), // dün
          movie(2, "2026-10-18"), // bugün
          movie(3, "2027-03-01"),
          movie(4, ""), // tarihsiz
          movie(5, undefined),
        ],
      },
      "movie",
      NOW,
    );
    expect(items.map((i) => i.id).sort()).toEqual([2, 3]);
    expect(items.find((i) => i.id === 2)._date).toBe("2026-10-18");
  });

  it("türe göre ayırır: dizi için first_air_date okunur", () => {
    const credits = {
      cast: [
        movie(1, "2027-01-01"),
        { id: 9, media_type: "tv", name: "Dizi", poster_path: "/t.jpg", first_air_date: "2027-02-02", character: "X", genre_ids: [18] },
      ],
    };
    expect(upcomingFromCredits(credits, "movie", NOW).map((i) => i.id)).toEqual([1]);
    expect(upcomingFromCredits(credits, "tv", NOW).map((i) => i.id)).toEqual([9]);
  });

  it("posteri olmayan, yetişkin, kendisi olarak çıktığı ve talk-show kredileri elenir", () => {
    const items = upcomingFromCredits(
      {
        cast: [
          movie(1, "2027-01-01", { poster_path: null }),
          movie(2, "2027-01-01", { adult: true }),
          movie(3, "2027-01-01", { character: "Self" }),
          movie(4, "2027-01-01", { character: "Himself - Guest" }),
          movie(5, "2027-01-01", { genre_ids: [10767] }),
          movie(6, "2027-01-01"),
        ],
      },
      "movie",
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual([6]);
  });

  it("yönetmen kredisi alınır, diğer ekip işleri alınmaz; dizide yaratıcı da sayılır", () => {
    const crew = [
      { ...movie(10, "2027-05-05"), job: "Director" },
      { ...movie(11, "2027-05-05"), job: "Producer" },
      { ...movie(12, "2027-05-05"), job: "Creator" },
    ];
    const asMovie = upcomingFromCredits({ crew }, "movie", NOW);
    expect(asMovie.map((i) => i.id)).toEqual([10]);
    expect(asMovie[0]._roles).toEqual(["director"]);

    const tvCrew = [
      { id: 20, media_type: "tv", poster_path: "/t.jpg", first_air_date: "2027-01-01", job: "Creator", genre_ids: [] },
      { id: 21, media_type: "tv", poster_path: "/t.jpg", first_air_date: "2027-01-01", job: "Executive Producer", genre_ids: [] },
    ];
    expect(upcomingFromCredits({ crew: tvCrew }, "tv", NOW).map((i) => i.id)).toEqual([20]);
  });

  it("hem oynayıp hem yöneten kişide aynı yapım tek kayıt, iki rol", () => {
    const both = upcomingFromCredits(
      { cast: [movie(30, "2027-06-06")], crew: [{ ...movie(30, "2027-06-06"), job: "Director" }] },
      "movie",
      NOW,
    );
    expect(both).toHaveLength(1);
    expect(both[0]._roles.sort()).toEqual(["cast", "director"]);
  });

  it("bozuk cevapta çökmez", () => {
    expect(upcomingFromCredits(null, "movie", NOW)).toEqual([]);
    expect(upcomingFromCredits({ cast: [null, 3, {}] }, "movie", NOW)).toEqual([]);
  });
});

describe("birleştirme", () => {
  const item = (id, date) => ({ id, _date: date, _roles: ["cast"], poster_path: "/x.jpg" });

  it("yakın tarih önce; aynı yapım tek kart ve iki kişiyi taşır", () => {
    const merged = mergeUpcoming([
      { person: { id: 1, name: "Ada" }, items: [item(5, "2027-03-01"), item(6, "2027-01-01")] },
      { person: { id: 2, name: "Bora" }, items: [item(5, "2027-03-01"), item(7, "2027-02-01")] },
    ]);
    expect(merged.map((i) => i.id)).toEqual([6, 7, 5]);
    expect(merged.find((i) => i.id === 5)._people).toEqual(["Ada", "Bora"]);
  });

  it("aynı tarihte daha çok kişiyle ilgili olan önde", () => {
    const merged = mergeUpcoming([
      { person: { id: 1, name: "Ada" }, items: [item(1, "2027-01-01"), item(2, "2027-01-01")] },
      { person: { id: 2, name: "Bora" }, items: [item(2, "2027-01-01")] },
    ]);
    expect(merged.map((i) => i.id)).toEqual([2, 1]);
  });

  it("aynı kişiden iki kez gelen kayıt kişiyi çoğaltmaz", () => {
    const merged = mergeUpcoming([{ person: { id: 1, name: "Ada" }, items: [item(1, "2027-01-01"), item(1, "2027-01-01")] }]);
    expect(merged[0]._people).toEqual(["Ada"]);
  });

  it("exclude ve limit uygulanır", () => {
    const groups = [{ person: { id: 1, name: "Ada" }, items: [item(1, "2027-01-01"), item(2, "2027-01-02"), item(3, "2027-01-03")] }];
    expect(mergeUpcoming(groups, { exclude: [1] }).map((i) => i.id)).toEqual([2, 3]);
    expect(mergeUpcoming(groups, { limit: 1 }).map((i) => i.id)).toEqual([1]);
    expect(mergeUpcoming(null)).toEqual([]);
  });
});

describe("yardımcılar", () => {
  it("kişi adlarını özetler", () => {
    expect(describePeople(["A", "B"])).toBe("A, B");
    expect(describePeople(["A", "B", "C", "D"])).toBe("A, B +2");
    expect(describePeople(["A", "B", "C"], { limit: 1, more: (n) => `ve ${n}` })).toBe("A ve 2");
    expect(describePeople(null)).toBe("");
  });

  it("gün farkı yerel takvime göre", () => {
    expect(daysUntil("2026-10-18", NOW)).toBe(0);
    expect(daysUntil("2026-10-19", NOW)).toBe(1);
    expect(daysUntil("2026-10-17", NOW)).toBe(-1);
    expect(daysUntil("bozuk", NOW)).toBeNull();
  });
});

describe("metin tablosu", () => {
  it("bilinmeyen dil İngilizceye düşer; bölüm etiketi bilinmeyende 'Kişi'", () => {
    expect(getFollowedPeopleCopy("xx")).toBe(FOLLOWED_PEOPLE_COPY.en);
    expect(getFollowedPeopleCopy("tr")).toBe(FOLLOWED_PEOPLE_COPY.tr);
    expect(departmentLabel(FOLLOWED_PEOPLE_COPY.tr, "Directing")).toBe("Yönetmen");
    expect(departmentLabel(FOLLOWED_PEOPLE_COPY.tr, "Sound")).toBe("Kişi");
  });

  it("işlevler ad / sayı ile beklenen cümleyi kurar", () => {
    const tr = FOLLOWED_PEOPLE_COPY.tr;
    expect(tr.toast.followed("Ada")).toContain("Ada");
    expect(tr.rail.quietBody(1)).toBe("1 kişiyi takip ediyorsun");
    expect(tr.rail.quietBody(4)).toBe("4 kişiyi takip ediyorsun");
    expect(FOLLOWED_PEOPLE_COPY.en.rail.quietBody(1)).toBe("You follow 1 person");
  });
});

describe("telefon takvimi öğesi", () => {
  // phoneCalendar yalnız anahtar üretimi için yüklenir; native modüller taklit.
  jest.mock("expo-calendar", () => ({}));
  jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
  jest.mock("../components/AppToast", () => ({ __esModule: true, default: { show: jest.fn() }, toast: {} }));
  jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));
  const { upcomingToCalendarItem } = require("../utils/followedPeople");
  const { buildEventKey } = require("../utils/phoneCalendar");

  it("film: hatırlatıcıyla AYNI anahtar (takvimde çift etkinlik açılmaz)", () => {
    const item = upcomingToCalendarItem({ id: 7, title: "Film", _date: "2027-03-01" }, "movie");
    expect(item).toEqual({ eventType: "reminder_movie", id: 7, title: "Film", date: "2027-03-01" });
    expect(buildEventKey(item)).toBe("movie_7_2027-03-01");
  });

  it("dizi: ilk bölüm (S1E1) olarak, hatırlatıcıyla aynı anahtar", () => {
    const item = upcomingToCalendarItem({ id: 9, name: "Dizi", _date: "2027-02-02" }, "tv");
    expect(item).toMatchObject({ eventType: "reminder_tv", id: 9, title: "Dizi", seasonNumber: 1, episodeNumber: 1 });
    expect(buildEventKey(item)).toBe("tv_9_1_1_2027-02-02");
  });

  it("tarihi, kimliği ya da adı olmayan öğede null", () => {
    expect(upcomingToCalendarItem({ id: 1, title: "x" }, "movie")).toBeNull();
    expect(upcomingToCalendarItem({ id: 0, title: "x", _date: "2027-01-01" }, "movie")).toBeNull();
    expect(upcomingToCalendarItem({ id: 1, title: " ", _date: "2027-01-01" }, "movie")).toBeNull();
    expect(upcomingToCalendarItem(null, "movie")).toBeNull();
  });
});
