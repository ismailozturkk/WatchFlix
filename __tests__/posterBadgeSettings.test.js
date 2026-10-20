// __tests__/posterBadgeSettings.test.js
//
// Poster rozetlerinin ÜÇ yerde yaşayan sözleşmesinin eşleşme bekçisi:
//   1) context/AppSettingsContext.js  → DEFAULT_POSTER_BADGES (kaydedilen anahtarlar)
//   2) screens/tabs/settings/PosterSettingsScreen.js → buildPosterBadgeOptions() (ayar satırları;
//      etiketler dil değişince yeniden çözülsün diye işlev)
//   3) components/ListBadges.js → poster üstündeki rozet yığını
//
// NEDEN: yeni rozet eklerken üçünden biri unutulursa hata sessizdir — ayarda
// satır olmayan rozet kullanıcı tarafından KAPATILAMAZ, varsayılanı olmayan
// anahtar normalize edilirken düşer, yığında olmayan satır hiçbir şey yapmaz.
// Kaynak metni okunur (bileşenler RN'ye bağlı olduğundan import edilmez).

import fs from "fs";
import path from "path";
import { REMINDER_BADGE } from "../utils/reminderBadge";

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const contextSource = read("context/AppSettingsContext.js");
const settingsSource = read("screens/tabs/settings/PosterSettingsScreen.js");
const listBadgesSource = read("components/ListBadges.js");

// `key: "x"` ya da ortak kayıttan `key: REMINDER_BADGE.key` → anahtar adı.
const KEY_PATTERN = '(?:"(\\w+)"|REMINDER_BADGE\\.key)';
const resolveKey = (quoted) => quoted ?? REMINDER_BADGE.key;

function defaultKeys() {
  const block = contextSource.match(/const DEFAULT_POSTER_BADGES = Object\.freeze\(\{([\s\S]*?)\}\);/);
  expect(block).not.toBeNull();
  return [...block[1].matchAll(/^\s*(\w+):\s*(?:true|false),/gm)].map((m) => m[1]);
}

function settingOptions() {
  const block = settingsSource.match(/const buildPosterBadgeOptions = \(\) => \[([\s\S]*?)\n\];/);
  expect(block).not.toBeNull();
  const entry = new RegExp(`\\{\\s*(?:\\/\\/[^\\n]*\\n\\s*)*key:\\s*${KEY_PATTERN},\\s*group:\\s*"(\\w+)"`, "g");
  return [...block[1].matchAll(entry)].map((m) => ({ key: resolveKey(m[1]), group: m[2] }));
}

function stackKeys() {
  const block = listBadgesSource.match(/const items = \[([\s\S]*?)\]\.filter\(Boolean\)/);
  expect(block).not.toBeNull();
  return [...block[1].matchAll(new RegExp(`key:\\s*${KEY_PATTERN}`, "g"))].map((m) => resolveKey(m[1]));
}

describe("poster rozeti sözleşmesi — üç yer birbirini tutar", () => {
  test("ayrıştırma çalışıyor (desen bozulursa test sessizce yeşile dönmesin)", () => {
    expect(defaultKeys().length).toBeGreaterThanOrEqual(12);
    expect(settingOptions().length).toBeGreaterThanOrEqual(12);
    expect(stackKeys().length).toBeGreaterThanOrEqual(8);
  });

  test("her varsayılan anahtarın bir ayar satırı var, her satırın bir varsayılanı", () => {
    const defaults = defaultKeys();
    const options = settingOptions().map((o) => o.key);
    expect(options.filter((k) => !defaults.includes(k))).toEqual([]); // varsayılansız satır
    expect(defaults.filter((k) => !options.includes(k))).toEqual([]); // kapatılamayan rozet
  });

  test("anahtarlar benzersiz", () => {
    const defaults = defaultKeys();
    const options = settingOptions().map((o) => o.key);
    expect(new Set(defaults).size).toBe(defaults.length);
    expect(new Set(options).size).toBe(options.length);
  });

  test("her ayar satırı 'status' ya da 'info' grubunda", () => {
    settingOptions().forEach((o) => expect(["status", "info"]).toContain(o.group));
  });

  test("yığındaki her rozet ayar ekranında 'status' satırı olarak var ve sıra aynı", () => {
    const status = settingOptions().filter((o) => o.group === "status").map((o) => o.key);
    expect(stackKeys()).toEqual(status);
  });

  test("hatırlatma rozeti: varsayılan açık, liste üyeliklerinden sonra, puan/yorumdan önce", () => {
    expect(defaultKeys()).toContain(REMINDER_BADGE.key);
    expect(contextSource).toMatch(/reminder:\s*true,/);

    const status = settingOptions().filter((o) => o.group === "status").map((o) => o.key);
    const at = status.indexOf(REMINDER_BADGE.key);
    expect(at).toBeGreaterThan(status.indexOf("shared"));
    expect(at).toBeLessThan(status.indexOf("rated"));
    expect(at).toBeLessThan(status.indexOf("commented"));
  });

  test("ayar satırı ortak kayıttan beslenir (simge / renk ListBadges ile ayrışmaz)", () => {
    expect(settingsSource).toMatch(/icon:\s*REMINDER_BADGE\.icon/);
    expect(settingsSource).toMatch(/color:\s*REMINDER_BADGE\.color/);
    expect(listBadgesSource).toMatch(/icon:\s*REMINDER_BADGE\.icon/);
    expect(listBadgesSource).toMatch(/color:\s*REMINDER_BADGE\.color/);
  });
});
