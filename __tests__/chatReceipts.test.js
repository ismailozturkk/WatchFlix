// 1-1 sohbet tikleri (utils/chatReceipts.js).
//
// Bozulursa: alıcı sohbeti açınca okundu işareti hiç ilerlemez (mavi tik çıkmaz),
// her render'da tekrar yazılır (yazım döngüsü), henüz görülmemiş mesaj "görüldü"
// sayılır ya da tik değişmeyen balonlar her güncellemede yeniden çizilir.

import {
  applyReceipts,
  newestIncoming,
  receiptMs,
  shouldMarkRead,
} from "../utils/chatReceipts";

// Firestore Timestamp taklidi (yalnız toMillis kullanılıyor).
const ts = (ms) => ({ toMillis: () => ms });
const msg = (id, senderId, ms, extra = {}) => ({
  id,
  senderId,
  timestamp: ts(ms),
  status: "sent",
  ...extra,
});

describe("receiptMs", () => {
  test("Timestamp, Date ve sayı okunur; geçersiz 0", () => {
    expect(receiptMs(ts(5))).toBe(5);
    expect(receiptMs(new Date(7))).toBe(7);
    expect(receiptMs(9)).toBe(9);
    expect(receiptMs(null)).toBe(0);
    expect(receiptMs({})).toBe(0);
    expect(receiptMs(NaN)).toBe(0);
  });
});

describe("newestIncoming", () => {
  test("karşı taraftan gelen, sunucu zamanlı en yeni mesaj", () => {
    const list = [
      msg("m3", "me", 300),
      msg("m2", "ali", 200),
      msg("m1", "ali", 100),
    ];
    expect(newestIncoming(list, "me").id).toBe("m2");
  });

  test("benim, bekleyen ya da iyimser mesajlar sayılmaz", () => {
    const list = [
      msg("p", "ali", 900, { _pendingWrite: true }),
      { id: "local-1", senderId: "ali", timestamp: new Date(800), _optimistic: true },
      msg("mine", "me", 700),
      msg("ok", "ali", 100),
    ];
    expect(newestIncoming(list, "me").id).toBe("ok");
    expect(newestIncoming([msg("mine", "me", 1)], "me")).toBeNull();
    expect(newestIncoming(undefined, "me")).toBeNull();
  });
});

describe("shouldMarkRead", () => {
  test("yalnız işaretten YENİ mesaj varsa yazılır (döngü yok)", () => {
    const latest = msg("m", "ali", 200);
    expect(shouldMarkRead(latest, undefined)).toBe(true);
    expect(shouldMarkRead(latest, ts(100))).toBe(true);
    expect(shouldMarkRead(latest, ts(200))).toBe(false);
    expect(shouldMarkRead(latest, ts(300))).toBe(false);
    expect(shouldMarkRead(null, undefined)).toBe(false);
  });
});

describe("applyReceipts", () => {
  test("sunucuya ulaşan mesajım iletildi, okundu işaretine kadar olanlar görüldü", () => {
    const list = [
      msg("m3", "me", 300),
      msg("m2", "me", 200),
      msg("in", "ali", 150),
      msg("m1", "me", 100),
    ];
    const out = applyReceipts(list, { myUid: "me", friendReadAt: ts(200) });
    expect(out.map((m) => m.status)).toEqual(["delivered", "seen", "sent", "seen"]);
    // Gelen mesaj olduğu gibi kalır.
    expect(out[2]).toBe(list[2]);
  });

  test("gönderiliyor/bekleyen mesajım dokunulmadan kalır", () => {
    const sending = { id: "local-1", senderId: "me", timestamp: new Date(1), status: "sending", _optimistic: true };
    const pending = msg("p", "me", 50, { _pendingWrite: true });
    const out = applyReceipts([sending, pending], { myUid: "me", friendReadAt: ts(999) });
    expect(out[0]).toBe(sending);
    expect(out[1]).toBe(pending);
  });

  test("eski istemcinin yazdığı status 'seen' görüldü sayılmaya devam eder", () => {
    const old = msg("old", "me", 500, { status: "seen" });
    const out = applyReceipts([old], { myUid: "me", friendReadAt: ts(100) });
    expect(out[0]).toBe(old);
    expect(out[0].status).toBe("seen");
  });

  test("hiçbir tik değişmezse AYNI dizi döner", () => {
    const list = [msg("a", "me", 100, { status: "delivered" }), msg("b", "ali", 90)];
    expect(applyReceipts(list, { myUid: "me", friendReadAt: ts(50) })).toBe(list);
  });

  test("okundu işareti yoksa mesajlarım iletildi görünür", () => {
    const out = applyReceipts([msg("a", "me", 100)], { myUid: "me" });
    expect(out[0].status).toBe("delivered");
  });
});
