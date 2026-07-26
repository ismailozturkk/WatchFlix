import { daysUntil, parseAirDate, startOfDay } from "../utils/airDate";

// Sabit bir "şimdi": 25 Temmuz 2026, öğleden sonra. Saatin ileri olması kritik —
// hatanın çıktığı durum tam olarak buydu.
const NOW = new Date(2026, 6, 25, 18, 30, 0);

describe("parseAirDate", () => {
  test('"YYYY-MM-DD" yerel gece yarısı olarak çözülür (UTC kayması yok)', () => {
    const parsed = parseAirDate("2026-07-26");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(6); // Temmuz
    expect(parsed.getDate()).toBe(26);
    expect(parsed.getHours()).toBe(0);
  });

  test("Date, ISO string ve Firestore Timestamp kabul eder", () => {
    const date = new Date(2026, 6, 26, 9, 0, 0);
    expect(parseAirDate(date)).toBe(date);
    expect(parseAirDate("2026-07-26T09:00:00.000Z").getTime()).toBe(
      Date.UTC(2026, 6, 26, 9),
    );
    expect(parseAirDate({ toDate: () => date })).toBe(date);
  });

  test("geçersiz ve boş değerler için null döner", () => {
    expect(parseAirDate("-")).toBeNull();
    expect(parseAirDate("")).toBeNull();
    expect(parseAirDate(null)).toBeNull();
    expect(parseAirDate(undefined)).toBeNull();
    expect(parseAirDate(new Date("bozuk"))).toBeNull();
  });
});

describe("daysUntil — takvim günü farkı", () => {
  // Asıl hata: 25 Temmuz saat 18:30'da, 26 Temmuz'daki bölüme kalan süre
  // 24 saatten az olduğu için eski hesap 0 ("Bugün") diyordu.
  test("yarınki bölüm, günün hangi saati olursa olsun 1 gündür", () => {
    expect(daysUntil("2026-07-26", NOW)).toBe(1);
    expect(daysUntil("2026-07-26", new Date(2026, 6, 25, 23, 59))).toBe(1);
    expect(daysUntil("2026-07-26", new Date(2026, 6, 25, 0, 1))).toBe(1);
  });

  test("bugünkü bölüm 0'dır (saat geçmiş olsa bile)", () => {
    expect(daysUntil("2026-07-25", NOW)).toBe(0);
    expect(daysUntil("2026-07-25", new Date(2026, 6, 25, 23, 59))).toBe(0);
  });

  test("geçmiş tarihler negatif döner", () => {
    expect(daysUntil("2026-07-24", NOW)).toBe(-1);
    expect(daysUntil("2026-07-18", NOW)).toBe(-7);
  });

  test("ileri tarihler bir gün eksik saymaz", () => {
    expect(daysUntil("2026-07-27", NOW)).toBe(2);
    expect(daysUntil("2026-08-01", NOW)).toBe(7);
    expect(daysUntil("2026-08-24", NOW)).toBe(30);
  });

  test("geçersiz değer için null döner", () => {
    expect(daysUntil("-", NOW)).toBeNull();
    expect(daysUntil(null, NOW)).toBeNull();
  });
});

describe("startOfDay", () => {
  test("saati sıfırlar ve kaynağı değiştirmez", () => {
    const source = new Date(2026, 6, 25, 18, 30, 15, 250);
    const rounded = startOfDay(source);
    expect(rounded.getHours()).toBe(0);
    expect(rounded.getMinutes()).toBe(0);
    expect(rounded.getSeconds()).toBe(0);
    expect(rounded.getMilliseconds()).toBe(0);
    expect(source.getHours()).toBe(18); // mutasyon yok
  });
});
