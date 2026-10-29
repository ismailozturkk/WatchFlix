// Rozet defterinin SIFIRLANMASI (utils/watchBadgeLedger.resetWatchLedger) ve canlı kancanın
// (hooks/useWatchProgress) bellek durumu.
//
// ESKİ HATA: hesap sıfırlanınca defter anahtarı silindi ama kanca rozet kümesini, Perde
// tabanlarını ve serileri React state'inde tutuyordu; bir sonraki mutabakat bellekteki
// ("açık" sayılan) eski kümeyle defteri YENİDEN TOHUMLADI → rozetler sıfırlanmış görünmedi.
// Aynı yarış yolda olan bir mutabakat (disk okundu, henüz yazılmadı) için de geçerliydi.
//
//   • resetWatchLedger: anahtarları siler, dinleyicileri haberdar eder, yolda olan yazmaları
//     geçersiz kılar (reconcileLedger/markCelebrated null/eski değer döner, diske yazmaz)
//   • kanca: sıfırlamada rozet sayısı düşer ve deftere ESKİ küme geri yazılmaz
//   • purgeUserScope (hesap SİLME): keepOnLogout anahtarlar dahil kullanıcının tüm kapsamı gider

import React from "react";
import { act, create } from "react-test-renderer";
import { __resetAllMMKV } from "react-native-mmkv";
import AsyncStorage from "@react-native-async-storage/async-storage";

const mockAuth = { user: { uid: "u1", metadata: {} } };
jest.mock("@context/AuthContext", () => ({ useAuth: () => mockAuth }));
const mockStats = { listItems: [], listItemsTv: [], loadingTv: false, loadingMovies: false, isloadingShowInfo: false, isloadingMovieInfo: false };
jest.mock("@context/ProfileStatsContext", () => ({ useProfileStats: () => mockStats }));
jest.mock("@services/sceneGameService", () => ({ loadGameData: jest.fn(async () => ({ level: 0 })) }));
const mockKesif = { sayilar: {}, hazir: {} };
jest.mock("@hooks/useKesifSignals", () => ({ __esModule: true, default: () => mockKesif }));
// Seri günü dönümü kancası (useWatchProgress) RN AppState'e bağlı; testte hep önde.
jest.mock("@hooks/useAppActive", () => ({ __esModule: true, default: () => true }));

const { Keys, get, set } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const { purgeUserScope, clearUserScope } = require("../services/storage/scope");
const {
  loadLedger, markCelebrated, reconcileLedger, resetWatchLedger, subscribeLedgerReset,
} = require("../utils/watchBadgeLedger");
const { WATCH_BADGES } = require("../components/badges/watchBadgeCatalog");
const useWatchProgress = require("../hooks/useWatchProgress").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

const UID = "u1";
const ROZET = WATCH_BADGES[0].id;
const tum = WATCH_BADGES.map((b) => b.id);
const flush = () => new Promise((resolve) => setImmediate(resolve));

// Defteri "ROZET kazanılmış" olarak kurar: önce sessiz tohum (boş), sonra ROZET kazanılır.
async function seedWithBadge() {
  await reconcileLedger(UID, { badgeIds: [], tumIds: tum, perde: 1, makara: 0, kare: 0, icerikSayisi: 0 });
  await reconcileLedger(UID, { badgeIds: [ROZET], tumIds: tum, perde: 1, makara: 0, kare: 0, icerikSayisi: 1 });
}

beforeEach(() => {
  AsyncStorage.__reset();
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => console.error.mockRestore());

describe("resetWatchLedger", () => {
  it("defter ve katalog duyurusu işaretini siler", async () => {
    await seedWithBadge();
    set(Keys.watchCatalogSeen, 7, { uid: UID });
    expect((await loadLedger(UID)).earned.badgeIds).toContain(ROZET);

    resetWatchLedger(UID);

    expect(get(Keys.watchLedger, { uid: UID })).toBeNull();
    expect(get(Keys.watchCatalogSeen, { uid: UID })).toBe(0);
    expect((await loadLedger(UID)).earned.badgeIds).toEqual([]);
  });

  it("dinleyiciye uid ile haber verir; aboneliği bırakan fonksiyon çalışır; dinleyici hatası akışı durdurmaz", () => {
    const seen = [];
    const unsubscribe = subscribeLedgerReset((uid) => seen.push(uid));
    subscribeLedgerReset(() => { throw new Error("dinleyici patladı"); });
    resetWatchLedger(UID);
    expect(seen).toEqual([UID]);
    unsubscribe();
    resetWatchLedger(UID);
    expect(seen).toEqual([UID]);
  });

  it("YOLDA olan mutabakat sıfırlamadan sonra eski defteri geri YAZMAZ", async () => {
    await seedWithBadge();
    const inflight = reconcileLedger(UID, { badgeIds: [ROZET], tumIds: tum, perde: 1, makara: 0, kare: 0, icerikSayisi: 2 });
    resetWatchLedger(UID); // disk okunmadan hemen önce/sonra araya girer
    await expect(inflight).resolves.toBeNull();
    expect(get(Keys.watchLedger, { uid: UID })).toBeNull();
  });

  it("kutlama işaretleme de sıfırlamadan sonra yazmaz", async () => {
    await seedWithBadge();
    const ledger = await loadLedger(UID);
    const pending = markCelebrated(UID, ledger, [ROZET]);
    resetWatchLedger(UID);
    await pending;
    expect(get(Keys.watchLedger, { uid: UID })).toBeNull();
  });

  it("sıfırlamadan SONRAKİ mutabakat normal çalışır (yeni dönem, boş tohum)", async () => {
    await seedWithBadge();
    resetWatchLedger(UID);
    const r = await reconcileLedger(UID, { badgeIds: [], tumIds: tum, perde: 1, makara: 0, kare: 0, icerikSayisi: 0 });
    expect(r.ilkTohum).toBe(true);
    expect(r.ledger.earned.badgeIds).toEqual([]);
  });
});

describe("useWatchProgress — bellekteki rozet kümesi", () => {
  let renderer;
  let last;
  function Probe() {
    last = useWatchProgress();
    return null;
  }
  const mount = async () => {
    await act(async () => { renderer = create(React.createElement(Probe)); });
    await act(async () => { await flush(); });
  };
  afterEach(async () => {
    if (renderer) await act(async () => renderer.unmount());
    renderer = null;
    jest.useRealTimers();
  });

  it("defterdeki rozet, veri boş olsa bile açık görünür (rozet düşmez sözleşmesi)", async () => {
    await seedWithBadge();
    await mount();
    expect(last.acikSayisi).toBeGreaterThanOrEqual(1);
    expect(last.rozetler.find((b) => b.id === ROZET).acik).toBe(true);
  });

  it("aylık Bingo geçmişindeki tam kartları kademeli rozete bağlar", async () => {
    set(Keys.cinemaBingoMonthly, {
      "2026-08-01": { lines: 8, squares: 9, full: true },
      "2026-09-01": { lines: 8, squares: 9, full: true },
      "2026-10-01": { lines: 8, squares: 9, full: true },
    }, { uid: UID });
    await mount();
    const bingo = last.kartlar.find((b) => b.family === "bingo");
    expect(bingo).toMatchObject({ id: "bingo_3", aileKademe: 2, aileToplam: 4, acik: true });
    expect(bingo.sonrakiHedef).toMatchObject({ id: "bingo_5", ilerleme: 3, target: 5 });
  });

  it("hesap SIFIRLANINCA rozetler kalkar ve bellekteki küme deftere GERİ YAZILMAZ", async () => {
    await seedWithBadge();
    await mount();
    expect(last.rozetler.find((b) => b.id === ROZET).acik).toBe(true);

    jest.useFakeTimers();
    await act(async () => { resetWatchLedger(UID); });
    expect(last.rozetler.find((b) => b.id === ROZET).acik).toBe(false);
    expect(last.acikSayisi).toBe(0);

    // Mutabakat penceresi (1,5 sn) geçince deftere ne yazıldığına bak.
    await act(async () => { jest.advanceTimersByTime(2000); });
    jest.useRealTimers();
    await act(async () => { await flush(); await flush(); });
    const stored = await loadLedger(UID);
    expect(stored.earned.badgeIds).not.toContain(ROZET);
    expect(stored.baseline?.badgeIds || []).not.toContain(ROZET);
    expect(last.rozetler.find((b) => b.id === ROZET).acik).toBe(false);
  });

  it("başka kullanıcının sıfırlanması bu kullanıcının rozetlerini etkilemez", async () => {
    await seedWithBadge();
    await mount();
    await act(async () => { resetWatchLedger("baska-uid"); });
    expect(last.rozetler.find((b) => b.id === ROZET).acik).toBe(true);
  });
});

describe("purgeUserScope (hesap SİLME)", () => {
  it("keepOnLogout anahtarlar DAHİL kullanıcının tüm kapsamını siler; başkasına dokunmaz", () => {
    set(Keys.watchLedger, { v: 1 }, { uid: UID });
    set(Keys.yearlyGoals, { 2026: { target: 5, unit: "film" } }, { uid: UID });
    set(Keys.premiumDailyUsage, { day: "2026-10-22", counts: { a: 1 } }, { uid: UID });
    set(Keys.watchLedger, { v: 1 }, { uid: "digeri" });
    set(Keys.theme, "dark"); // global ayar

    const removed = purgeUserScope(UID);

    expect(removed).toBeGreaterThanOrEqual(3);
    expect(get(Keys.watchLedger, { uid: UID })).toBeNull();
    expect(get(Keys.yearlyGoals, { uid: UID })).toBeNull();
    expect(get(Keys.premiumDailyUsage, { uid: UID })).toBeNull();
    expect(get(Keys.watchLedger, { uid: "digeri" })).toEqual({ v: 1 });
    expect(get(Keys.theme)).toBe("dark");
  });

  it("çıkışın clearUserScope'u keepOnLogout anahtarları KORUR (ikisi bilerek ayrı)", () => {
    set(Keys.watchLedger, { v: 1 }, { uid: UID });
    set(Keys.postDrafts, [{ id: 1 }], { uid: UID });
    clearUserScope(UID);
    expect(get(Keys.watchLedger, { uid: UID })).toEqual({ v: 1 });
    expect(get(Keys.postDrafts, { uid: UID })).toEqual([]);
  });

  it("uid yoksa hiçbir şey yapmaz", () => {
    expect(purgeUserScope(undefined)).toBe(0);
  });
});
