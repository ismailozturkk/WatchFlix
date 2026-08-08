// Yaş kapısı: doğum tarihi → yaş → yetişkin içerik izni.
//
// Kilitlenen davranışlar:
//   1. Yaş SAKLANMAZ, türetilir — 18'ine giren kullanıcının kısıtı doğru günde
//      kalkmalı (yaşı sayı olarak saklasaydık bir yıl boyunca yanlış kalırdı).
//   2. "Bilinmiyor" iki soruda da HAYIR: kayıt formu tarih girilmeden
//      ilerletmez, ama bu alan eklenmeden önce kaydolmuş hesaplar kısıtlanmaz.
//   3. Takvimde olmayan tarih (30 Şubat) geçerli sayılmaz — Date onu sessizce
//      3 Mart'a taşıyor.

import {
  MIN_ADULT_AGE,
  calculateAge,
  clearAgeRestriction,
  formatBirthDate,
  isAdultBirthDate,
  isAgeRestrictedProfile,
  isAgeRestricted,
  parseBirthDate,
  syncAgeRestriction,
} from "../utils/ageGate";
import { getStore } from "../services/storage";

const gun = (iso) => new Date(iso);

beforeEach(() => {
  getStore("session").clearAll();
});

describe("formatBirthDate", () => {
  test("gün/ay tek haneliyse başına sıfır koyar", () => {
    expect(formatBirthDate("5", "3", "1998")).toBe("1998-03-05");
    expect(formatBirthDate(5, 3, 1998)).toBe("1998-03-05");
  });

  test("takvimde olmayan tarihi reddeder", () => {
    expect(formatBirthDate(30, 2, 2001)).toBeNull();
    expect(formatBirthDate(31, 4, 2001)).toBeNull();
    expect(formatBirthDate(29, 2, 2001)).toBeNull(); // artık yıl değil
  });

  test("artık yılın 29 Şubat'ını kabul eder", () => {
    expect(formatBirthDate(29, 2, 2000)).toBe("2000-02-29");
  });

  test("aralık dışı ya da sayı olmayan girdi null", () => {
    expect(formatBirthDate(0, 5, 2000)).toBeNull();
    expect(formatBirthDate(12, 13, 2000)).toBeNull();
    expect(formatBirthDate("", "", "")).toBeNull();
    expect(formatBirthDate("ab", "cd", "efgh")).toBeNull();
  });
});

describe("parseBirthDate", () => {
  test("YYYY-MM-DD çözülür", () => {
    expect(parseBirthDate("1998-03-05")).toEqual({
      year: 1998,
      month: 3,
      day: 5,
    });
  });

  test("bozuk biçim ve var olmayan tarih null", () => {
    expect(parseBirthDate("5.3.1998")).toBeNull();
    expect(parseBirthDate("1998-3-5")).toBeNull();
    expect(parseBirthDate("2001-02-30")).toBeNull();
    expect(parseBirthDate(null)).toBeNull();
    expect(parseBirthDate(19980305)).toBeNull();
  });
});

describe("calculateAge", () => {
  test("doğum günü geçtiyse tam yaş", () => {
    expect(calculateAge("2000-01-10", gun("2026-08-08"))).toBe(26);
  });

  test("doğum günü bu yıl HENÜZ gelmediyse bir eksik", () => {
    expect(calculateAge("2000-12-10", gun("2026-08-08"))).toBe(25);
  });

  test("tam doğum gününde yaş artar", () => {
    expect(calculateAge("2008-08-08", gun("2026-08-07"))).toBe(17);
    expect(calculateAge("2008-08-08", gun("2026-08-08"))).toBe(18);
  });

  test("gelecekteki tarih ve bozuk girdi null", () => {
    expect(calculateAge("2030-01-01", gun("2026-08-08"))).toBeNull();
    expect(calculateAge("bilinmiyor", gun("2026-08-08"))).toBeNull();
    expect(calculateAge(null)).toBeNull();
  });
});

describe("iki soru birbirinin değili DEĞİL", () => {
  test("18+ tarihi yalnız yetişkin sorusuna evet der", () => {
    const t = "2000-01-01";
    expect(isAdultBirthDate(t, gun("2026-08-08"))).toBe(true);
    expect(isAgeRestrictedProfile(t, gun("2026-08-08"))).toBe(false);
  });

  test("18 altı tarihi yalnız kısıt sorusuna evet der", () => {
    const t = "2012-01-01";
    expect(isAdultBirthDate(t, gun("2026-08-08"))).toBe(false);
    expect(isAgeRestrictedProfile(t, gun("2026-08-08"))).toBe(true);
  });

  test("tarih bilinmiyorsa İKİSİ DE hayır", () => {
    // Kayıt formu ilerletmez (isAdult false) ama eski hesap kısıtlanmaz
    // (isAgeRestricted false) — sürüm günü kimse ayarını kaybetmesin.
    for (const bos of [null, undefined, "", "bozuk"]) {
      expect(isAdultBirthDate(bos)).toBe(false);
      expect(isAgeRestrictedProfile(bos)).toBe(false);
    }
  });

  test("sınır tam 18'de yetişkin tarafında", () => {
    const dogum = "2008-08-08";
    expect(calculateAge(dogum, gun("2026-08-08"))).toBe(MIN_ADULT_AGE);
    expect(isAdultBirthDate(dogum, gun("2026-08-08"))).toBe(true);
    expect(isAgeRestrictedProfile(dogum, gun("2026-08-08"))).toBe(false);
  });
});

describe("cihaz aynası", () => {
  test("kayıt yokken kısıt yok", () => {
    expect(isAgeRestricted()).toBe(false);
  });

  test("18 altı profil bayrağı kaldırır, 18+ indirir", () => {
    const bugun = new Date();
    const yil = bugun.getFullYear();

    expect(syncAgeRestriction(`${yil - 10}-01-01`)).toBe(true);
    expect(isAgeRestricted()).toBe(true);

    expect(syncAgeRestriction(`${yil - 30}-01-01`)).toBe(false);
    expect(isAgeRestricted()).toBe(false);
  });

  test("doğum tarihi olmayan eski hesap kısıtlanmaz", () => {
    syncAgeRestriction(`${new Date().getFullYear() - 10}-01-01`);
    expect(isAgeRestricted()).toBe(true);

    expect(syncAgeRestriction(null)).toBe(false);
    expect(isAgeRestricted()).toBe(false);
  });

  test("çıkışta bayrak düşer", () => {
    syncAgeRestriction(`${new Date().getFullYear() - 10}-01-01`);
    clearAgeRestriction();
    expect(isAgeRestricted()).toBe(false);
  });
});
