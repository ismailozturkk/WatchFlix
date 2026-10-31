// Ad/avatar değişikliğine 1 gün bekleme (utils/profileIdentityCooldown.js).
// Gerekçe: kimlik değişimi profil yayılımıyla ~15 yüzeyi yeniden yazdırıyor.
const fs = require("fs");
const path = require("path");
const {
  IDENTITY_COOLDOWN_MS,
  IDENTITY_FIELDS,
  cooldownParts,
  cooldownRemainingMs,
  toMillis,
  touchesIdentity,
} = require("../utils/profileIdentityCooldown");

const HOUR = 60 * 60 * 1000;

test("bekleme süresi 1 gün", () => {
  expect(IDENTITY_COOLDOWN_MS).toBe(24 * HOUR);
});

test("yalnız yayılımı tetikleyen alanlar kapsamda", () => {
  expect(touchesIdentity({ displayName: "Ali" })).toBe(true);
  expect(touchesIdentity({ avatarIndex: 3 })).toBe(true);
  expect(touchesIdentity({ photoURL: "x" })).toBe(true);
  // photoURL null yazımı da bir değişiklik: anahtar varlığına bakılır.
  expect(touchesIdentity({ photoURL: null })).toBe(true);

  // Bunlar yayılıma girmez → beklemeye takılmaz.
  expect(touchesIdentity({ bio: "merhaba" })).toBe(false);
  expect(touchesIdentity({ fourFavorites: {} })).toBe(false);
  expect(touchesIdentity({ showcaseBadges: [] })).toBe(false);
  expect(touchesIdentity({ username: "ali" })).toBe(false);
  expect(touchesIdentity({})).toBe(false);
  expect(touchesIdentity(null)).toBe(false);
});

test("damga biçimleri: Timestamp, {seconds}, sayı, ISO", () => {
  expect(toMillis({ toMillis: () => 1234 })).toBe(1234);
  expect(toMillis({ seconds: 5 })).toBe(5000);
  expect(toMillis(99)).toBe(99);
  expect(toMillis("2026-11-01T00:00:00.000Z")).toBe(Date.parse("2026-11-01T00:00:00.000Z"));
  expect(toMillis(null)).toBeNull();
  expect(toMillis("öylesine")).toBeNull();
});

test("ilk değişiklik serbest; süre dolunca yine serbest", () => {
  const now = 1_000_000_000;
  expect(cooldownRemainingMs(null, now)).toBe(0);
  expect(cooldownRemainingMs(undefined, now)).toBe(0);
  expect(cooldownRemainingMs(now - IDENTITY_COOLDOWN_MS, now)).toBe(0);
  expect(cooldownRemainingMs(now - IDENTITY_COOLDOWN_MS - 1, now)).toBe(0);
});

test("süre dolmadan kalan süre döner", () => {
  const now = 1_000_000_000;
  expect(cooldownRemainingMs(now - HOUR, now)).toBe(23 * HOUR);
  expect(cooldownRemainingMs(now, now)).toBe(IDENTITY_COOLDOWN_MS);
});

test("cihaz saati geriye alınırsa bekleme atlanmaz", () => {
  const now = 1_000_000_000;
  expect(cooldownRemainingMs(now + 5 * HOUR, now)).toBe(IDENTITY_COOLDOWN_MS);
});

test("kalan süre saate/dakikaya çevrilir, yukarı yuvarlanır", () => {
  expect(cooldownParts(23 * HOUR)).toEqual({ unit: "hour", value: 23 });
  expect(cooldownParts(90 * 60 * 1000)).toEqual({ unit: "hour", value: 2 });
  expect(cooldownParts(60 * 60 * 1000)).toEqual({ unit: "hour", value: 1 });
  expect(cooldownParts(59 * 60 * 1000)).toEqual({ unit: "minute", value: 59 });
  expect(cooldownParts(1000)).toEqual({ unit: "minute", value: 1 });
  expect(cooldownParts(0)).toEqual({ unit: "minute", value: 1 });
});

test("kapsanan alanlar sunucudaki yayılım kümesiyle aynı (parite)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "functions", "profileIdentity.js"), "utf8");
  // functions/profileIdentity.js: nameChanged/avatarChanged displayName, avatarIndex, photoURL okur.
  for (const field of IDENTITY_FIELDS) {
    expect(src).toContain(field);
  }
  // username sunucuda yayılıyor ama kendi akışı olduğu için beklemeye DAHİL DEĞİL.
  expect(IDENTITY_FIELDS).not.toContain("username");
});

test("kullanıcı başlatmadıkça damga yazılmaz (sistem yazımları beklemeyi başlatmaz)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "services", "userService.js"), "utf8");
  expect(src).toMatch(/stampIdentity && touchesIdentity\(rest\)/);
  expect(src).toMatch(/stampIdentity = false/);
  // Bağlı hesap fotoğrafı senkronu damgasız çağırır (varsayılan false).
  expect(src).toMatch(/export async function refreshAvatarPhoto\(uid, \{ photoURL, photoSource/);
});
