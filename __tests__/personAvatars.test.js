// Oyuncu / yönetmen fotoğrafını avatar yapma — saf katman:
//   utils/avatars.js        TMDB adresi, boyut seçimi, kırpma konumu
//   utils/avatarPhotos.js   kişi seçimi, senkronun ona DOKUNMAMASI, kopya kuralı
//   utils/personAvatars.js  seçici satırları ve bölümleri
//
// Kritik hata sınıfı: kişi fotoğrafı "photoSource" taşır ama bağlı bir hesap
// değildir. planAvatarPhotoSync onu bağlı hesap sanarsa "hesap kaldırılmış"
// deyip avatarı her açılışta rastgele hazır avatara çevirirdi.

const {
  avatarContentPosition,
  avatarRenderPx,
  getAvatarSource,
  isTmdbPhotoUrl,
  optimizeAvatarUrl,
  tmdbPersonPhotoUrl,
} = require("../utils/avatars");
const {
  PERSON_PHOTO_SOURCE,
  avatarSnapshot,
  buildAvatarChoices,
  identityAvatar,
  inferPhotoSource,
  normalizePhotoPerson,
  personAvatarChoice,
  photoKey,
  planAvatarPhotoSync,
  profileAvatarChoice,
  sameAvatarChoice,
  toAvatarChoice,
} = require("../utils/avatarPhotos");
const {
  buildPersonAvatarSections,
  chunkRows,
  personSearchState,
  toPersonAvatarRows,
} = require("../utils/personAvatars");

const BIG = "https://image.tmdb.org/t/p/h632/keanu.jpg";
const SMALL = "https://image.tmdb.org/t/p/w185/keanu.jpg";
const keanu = { id: 6384, name: "Keanu Reeves", profile_path: "/keanu.jpg", known_for_department: "Acting" };
const nolan = { id: 525, name: "Christopher Nolan", profile_path: "/nolan.jpg", known_for_department: "Directing" };

describe("TMDB adresi (utils/avatars)", () => {
  it("profile_path → kayıt biçimi (h632); güvensiz yol reddedilir", () => {
    expect(tmdbPersonPhotoUrl("/keanu.jpg")).toBe(BIG);
    expect(tmdbPersonPhotoUrl("keanu.jpg", "w185")).toBe(SMALL);
    expect(tmdbPersonPhotoUrl("/../evil.jpg")).toBeNull();
    expect(tmdbPersonPhotoUrl("/a b.jpg")).toBeNull();
    expect(tmdbPersonPhotoUrl("/x.gif")).toBeNull();
    expect(tmdbPersonPhotoUrl(null)).toBeNull();
  });

  it("yalnız image.tmdb.org görselini TMDB sayar", () => {
    expect(isTmdbPhotoUrl(BIG)).toBe(true);
    expect(isTmdbPhotoUrl("https://evil.example/t/p/h632/keanu.jpg")).toBe(false);
    expect(isTmdbPhotoUrl("http://image.tmdb.org/t/p/h632/keanu.jpg")).toBe(false);
    expect(isTmdbPhotoUrl("https://image.tmdb.org.evil.com/t/p/h632/keanu.jpg")).toBe(false);
  });

  it("küçük avatar küçük kopyayı, büyük avatar büyüğünü ister", () => {
    expect(optimizeAvatarUrl(BIG, avatarRenderPx(40))).toBe(SMALL);
    expect(optimizeAvatarUrl(SMALL, avatarRenderPx(150))).toBe(BIG);
    expect(getAvatarSource(-1, BIG, avatarRenderPx(34))).toEqual({ uri: SMALL });
    // Boyut verilmezse (ProfileUiContext.avatar) büyük kopya.
    expect(getAvatarSource(-1, SMALL)).toEqual({ uri: BIG });
  });

  it("Google adresi boyuttan bağımsız tek adreste kalır (yeniden doğrulama anahtarı)", () => {
    const g = "https://lh3.googleusercontent.com/a/X=s96-c";
    expect(getAvatarSource(-1, g, avatarRenderPx(20))).toEqual({
      uri: "https://lh3.googleusercontent.com/a/X=s500-c",
    });
  });

  it("portre üstten, diğer kaynaklar ortadan kırpılır", () => {
    expect(avatarContentPosition({ uri: BIG })).toBe("top");
    expect(avatarContentPosition({ uri: "https://lh3.googleusercontent.com/a/X=s500-c" })).toBe("center");
    expect(avatarContentPosition(12)).toBe("center");
  });
});

describe("kişi seçimi (utils/avatarPhotos)", () => {
  it("TMDB kişisi → fotoğraf avatarı seçimi", () => {
    expect(personAvatarChoice(keanu)).toEqual({
      avatarIndex: -1,
      photoURL: BIG,
      photoSource: PERSON_PHOTO_SOURCE,
      photoPerson: { id: 6384, name: "Keanu Reeves" },
    });
  });

  it("favori girişi ({title,image}) ve takip kaydı ({name,photo}) da kabul edilir", () => {
    expect(personAvatarChoice({ id: 1, title: "A", image: "/a.jpg" }).photoPerson).toEqual({ id: 1, name: "A" });
    expect(personAvatarChoice({ id: 2, name: "B", photo: "/b.jpg" }).photoURL).toBe(
      "https://image.tmdb.org/t/p/h632/b.jpg",
    );
  });

  it("yetişkin işaretli, fotoğrafsız ya da kimliksiz kişi avatar olamaz", () => {
    expect(personAvatarChoice({ ...keanu, adult: true })).toBeNull();
    expect(personAvatarChoice({ ...keanu, profile_path: null })).toBeNull();
    expect(personAvatarChoice({ ...keanu, id: 0 })).toBeNull();
    expect(personAvatarChoice({ ...keanu, name: "  " })).toBeNull();
  });

  it("boyut farkı aynı fotoğraf sayılır (seçili işaret ızgarada kaybolmaz)", () => {
    expect(photoKey(SMALL)).toBe(photoKey(BIG));
    expect(sameAvatarChoice(personAvatarChoice(keanu), { avatarIndex: -1, photoURL: SMALL })).toBe(true);
    expect(sameAvatarChoice(personAvatarChoice(keanu), personAvatarChoice(nolan))).toBe(false);
  });

  it("toAvatarChoice kaynağı adresle tutarlı tutar", () => {
    // TMDB adresi kaynak etiketsiz gelse de kişi fotoğrafıdır.
    expect(toAvatarChoice({ avatarIndex: -1, photoURL: BIG }).photoSource).toBe(PERSON_PHOTO_SOURCE);
    // Kişi kaynağı TMDB dışı adrese yapışmaz.
    const g = toAvatarChoice({
      avatarIndex: -1,
      photoURL: "https://lh3.googleusercontent.com/a/X=s96-c",
      photoSource: PERSON_PHOTO_SOURCE,
      photoPerson: { id: 1, name: "X" },
    });
    expect(g.photoSource).toBeNull();
    expect(g).not.toHaveProperty("photoPerson");
    // Hazır avatarda kişi alanı hiç yok.
    expect(toAvatarChoice(5)).toEqual({ avatarIndex: 5, photoURL: null, photoSource: null });
  });

  it("profildeki kişi etiketi seçime taşınır, bozuksa düşer", () => {
    const profile = { avatarIndex: -1, photoURL: BIG, photoSource: PERSON_PHOTO_SOURCE, photoPerson: { id: 6384, name: "Keanu Reeves" } };
    expect(profileAvatarChoice(profile).photoPerson).toEqual({ id: 6384, name: "Keanu Reeves" });
    expect(profileAvatarChoice({ ...profile, photoPerson: { id: "x" } })).not.toHaveProperty("photoPerson");
    expect(normalizePhotoPerson({ id: 3, name: "a".repeat(300) }).name).toHaveLength(120);
  });

  it("anlık kopyaya yalnız indeks + adres gider (kişi etiketi değil)", () => {
    expect(avatarSnapshot(personAvatarChoice(keanu))).toEqual({ avatarIndex: -1, photoURL: BIG });
  });

  it("seçicide mevcut kişi fotoğrafı hücresi kişiyi taşır", () => {
    const choices = buildAvatarChoices({ linkedPhotos: [], current: personAvatarChoice(keanu) });
    expect(choices[0]).toMatchObject({ key: "photo:current", photoSource: PERSON_PHOTO_SOURCE, photoPerson: { id: 6384 } });
  });
});

describe("senkron kişi fotoğrafına dokunmaz", () => {
  const profile = { avatarIndex: -1, photoURL: BIG, photoSource: PERSON_PHOTO_SOURCE };

  it("bağlı hesaplar arasında olmasa da geri çevrilmez", () => {
    expect(planAvatarPhotoSync({ profile, providerIds: ["password"], linkedPhotos: [] })).toEqual({ action: "none" });
  });

  it("Google bağlı ve fotoğrafı tazeyken bile kişi fotoğrafını ezmez", () => {
    const linkedPhotos = [{ providerId: "google.com", uri: "https://lh3.googleusercontent.com/a/NEW", fresh: true }];
    expect(planAvatarPhotoSync({ profile, providerIds: ["google.com"], linkedPhotos })).toEqual({ action: "none" });
  });

  it("kaynak etiketi eksik eski kayıt da adresten kişi fotoğrafı sayılır", () => {
    const legacy = { avatarIndex: -1, photoURL: BIG };
    expect(inferPhotoSource(legacy)).toBe(PERSON_PHOTO_SOURCE);
    expect(planAvatarPhotoSync({ profile: legacy, providerIds: ["password"] })).toEqual({ action: "none" });
  });
});

describe("identityAvatar (servis kopyaları)", () => {
  it("hazır avatarda fotoğraf yazılmaz (Auth'un Google resmi sızmaz)", () => {
    expect(identityAvatar({ avatarIndex: 7, photoURL: "https://lh3.googleusercontent.com/a/X" })).toEqual({
      avatarIndex: 7,
      photoURL: null,
    });
  });
  it("fotoğraf avatarı adresiyle taşınır; fotoğrafsız -1 varsayılana iner", () => {
    expect(identityAvatar({ avatarIndex: -1, photoURL: BIG })).toEqual({ avatarIndex: -1, photoURL: BIG });
    expect(identityAvatar({ avatarIndex: -1 })).toEqual({ avatarIndex: 0, photoURL: null });
  });
  it("avatarIndex'i olmayan kimlik (Auth kullanıcısı) varsayılana iner", () => {
    expect(identityAvatar({ uid: "u", photoURL: "https://lh3.googleusercontent.com/a/X" })).toEqual({
      avatarIndex: 0,
      photoURL: null,
    });
    expect(identityAvatar(null)).toEqual({ avatarIndex: 0, photoURL: null });
  });
});

describe("seçici satırları (utils/personAvatars)", () => {
  it("yalnız oyuncu ve yönetmen; mesleği bilinmeyen kabul, bilinen başka meslek değil", () => {
    const rows = toPersonAvatarRows([
      keanu,
      nolan,
      { id: 9, name: "Writer", profile_path: "/w.jpg", known_for_department: "Writing" },
      { id: 10, name: "Fav", profile_path: "/f.jpg" },
    ]);
    expect(rows.map((r) => r.id)).toEqual([6384, 525, 10]);
    expect(rows[1]).toMatchObject({ key: "person:525", department: "Directing" });
  });

  it("popülerde mesleği olmayan kayıt elenir, tekrarlar atılır", () => {
    const rows = toPersonAvatarRows([keanu, keanu, { id: 10, name: "X", profile_path: "/x.jpg" }], {
      requireDepartment: true,
    });
    expect(rows.map((r) => r.id)).toEqual([6384]);
  });

  it("bölümler: kişi ilk bölümünde görünür, boş bölüm atılır", () => {
    const sections = buildPersonAvatarSections({
      favorites: [{ id: 6384, title: "Keanu Reeves", image: "/keanu.jpg" }],
      followed: [],
      popular: [keanu, nolan],
    });
    expect(sections.map((s) => s.id)).toEqual(["favorites", "popular"]);
    expect(sections[1].rows.map((r) => r.id)).toEqual([525]);
  });

  it("ızgara satırları", () => {
    expect(chunkRows([1, 2, 3, 4, 5], 4)).toEqual([[1, 2, 3, 4], [5]]);
    expect(chunkRows(null)).toEqual([]);
  });

  it("arama durumu", () => {
    expect(personSearchState({ query: "k" })).toBe("idle");
    expect(personSearchState({ query: "ke", loading: true, rows: [] })).toBe("loading");
    expect(personSearchState({ query: "ke", error: true, rows: [] })).toBe("error");
    expect(personSearchState({ query: "ke", rows: [] })).toBe("empty");
    expect(personSearchState({ query: "ke", loading: true, rows: [1] })).toBe("results");
  });
});
