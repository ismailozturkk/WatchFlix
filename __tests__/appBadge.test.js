// Uygulama rozeti tanımı (utils/appBadge.js) — sunucudaki functions/appBadge.js
// ile birebir aynı sonucu vermeli; iki taraf ayrışırsa uygulama açıkken görünen
// sayı ile kapalıyken bildirimin taşıdığı sayı birbirini ezer.

import { computeAppBadgeCount, toCount } from "../utils/appBadge";

describe("toCount", () => {
  test("geçerli sayıyı korur, ondalığı aşağı yuvarlar", () => {
    expect(toCount(3)).toBe(3);
    expect(toCount(2.9)).toBe(2);
    expect(toCount("4")).toBe(4);
  });

  test("negatif, NaN, undefined, null ve sayı olmayanı 0 yapar", () => {
    expect(toCount(-1)).toBe(0);
    expect(toCount(NaN)).toBe(0);
    expect(toCount(undefined)).toBe(0);
    expect(toCount(null)).toBe(0);
    expect(toCount("abc")).toBe(0);
    expect(toCount(Infinity)).toBe(0);
  });
});

describe("computeAppBadgeCount", () => {
  test("okunmamış mesaj + gelen istek toplamı", () => {
    expect(computeAppBadgeCount({ unreadMessages: 3, incomingRequests: 2 })).toBe(5);
  });

  test("hiçbir bekleyen iş yoksa 0 (rozet sıfırlanır)", () => {
    expect(computeAppBadgeCount({ unreadMessages: 0, incomingRequests: 0 })).toBe(0);
    expect(computeAppBadgeCount()).toBe(0);
    expect(computeAppBadgeCount({})).toBe(0);
  });

  test("bozuk sayaç rozeti negatife / NaN'a çekemez", () => {
    expect(computeAppBadgeCount({ unreadMessages: -4, incomingRequests: 1 })).toBe(1);
    expect(computeAppBadgeCount({ unreadMessages: NaN, incomingRequests: 2 })).toBe(2);
  });
});
