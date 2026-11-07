// Günlük seri — CANLI damgalama (hooks/useWatchProgress → utils/watchBadgeLedger).
//
//   • bugün yeni film eklenince seri aynı oturumda bir gün uzar
//   • ekleyip HEMEN arka plana geçince (1,5 sn yerleşme beklenmeden) gün yine yazılır;
//     eskiden zamanlayıcı askıya alınıyor, damga bir sonraki açılış gününe kayıyordu
//   • gün cihazın yerel gece yarısında döner (00:30'daki ekleme yeni güne sayılır)
//   • listeler henüz inmemişken (yeni cihaz) defter BOŞ veriyle tohumlanmaz

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
let mockActive = true;
const mockListe = { loading: false, watchedTvLoaded: true };
jest.mock("@context/ListStatusContext", () => ({ useListStatusContext: () => mockListe }));
jest.mock("@hooks/useAppActive", () => ({ __esModule: true, default: () => mockActive }));

const { Keys, set } = require("../services/storage");
const { __resetStoreCaches } = require("../services/storage/store");
const { __resetStores } = require("../services/storage/instances");
const { loadLedger, reconcileLedger } = require("../utils/watchBadgeLedger");
const { WATCH_BADGES } = require("../components/badges/watchBadgeCatalog");
const { seriGunuAnahtari, gunIndexi, indekstenGun } = require("../utils/watchActivity");
const useWatchProgress = require("../hooks/useWatchProgress").default;

global.IS_REACT_ACT_ENVIRONMENT = true;
const UID = "u1";
const tum = WATCH_BADGES.map((b) => b.id);
const flush = () => new Promise((r) => setImmediate(r));
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const film = (i) => ({ id: i, type: "movie", name: `F${i}`, minutes: 100, dateAdded: new Date().toISOString(), genres: [] });

// Dünde biten 5 günlük seri + 5 filmle tohumlanmış defter.
async function kur() {
  await reconcileLedger(UID, { badgeIds: [], tumIds: tum, perde: 1, makara: 0, kare: 0, icerikSayisi: 5 });
  const l = await loadLedger(UID);
  const D = gunIndexi(seriGunuAnahtari());
  l.aktiflik.gunler = [5, 4, 3, 2, 1].map((n) => indekstenGun(D - n));
  set(Keys.watchLedger, l, { uid: UID });
  __resetStoreCaches();
  mockStats.listItems = [1, 2, 3, 4, 5].map(film);
}

let renderer;
let last;
function Probe() {
  last = useWatchProgress();
  return null;
}
const ciz = () => React.createElement(Probe);

beforeEach(() => {
  AsyncStorage.__reset();
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  mockActive = true;
  mockListe.loading = false;
  mockListe.watchedTvLoaded = true;
  mockStats.listItems = [];
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = null;
  console.error.mockRestore();
});

async function ac() {
  await act(async () => { renderer = create(ciz()); });
  await act(async () => { await flush(); });
  await act(async () => { await bekle(1700); await flush(); });
}

test("bugün film eklenince seri aynı oturumda uzar", async () => {
  await kur();
  await ac();
  expect(last.seriler).toMatchObject({ gunSerisi: 5, bugunAktif: false });

  mockStats.listItems = [...mockStats.listItems, film(6)];
  await act(async () => { renderer.update(ciz()); });
  await act(async () => { await bekle(1700); await flush(); await flush(); });

  expect(last.seriler).toMatchObject({ gunSerisi: 6, bugunAktif: true });
  expect((await loadLedger(UID)).aktiflik.gunler).toContain(seriGunuAnahtari());
});

test("ekleyip hemen arka plana geçince gün beklemeden yazılır", async () => {
  await kur();
  await ac();

  mockStats.listItems = [...mockStats.listItems, film(6)];
  await act(async () => { renderer.update(ciz()); });
  // Yerleşme beklemesi (1,5 sn) dolmadan uygulama arka plana geçer.
  mockActive = false;
  await act(async () => { renderer.update(ciz()); });
  await act(async () => { await flush(); await flush(); });

  expect((await loadLedger(UID)).aktiflik.gunler).toContain(seriGunuAnahtari());
  expect(last.seriler).toMatchObject({ gunSerisi: 6, bugunAktif: true });
});

// ESKİ HATA: ProfileStats'in yükleme bayrakları hiç true olmadığından, yeni cihazda
// listeler ağdan inerken defter 0 içerikle tohumlanıyor; liste gelince rozetler "yeni"
// diye kutlanıyor ve o gün seriye sahte bir işaretleme yazılıyordu.
test("listeler yüklenirken defter tohumlanmaz; gelince gerçek sayıyla, damgasız tohumlanır", async () => {
  mockListe.loading = true;
  mockListe.watchedTvLoaded = false;
  await ac();
  expect((await loadLedger(UID)).baseline).toBeNull();

  mockStats.listItems = [1, 2, 3, 4, 5, 6, 7].map(film);
  mockListe.loading = false;
  mockListe.watchedTvLoaded = true;
  await act(async () => { renderer.update(ciz()); });
  await act(async () => { await bekle(1700); await flush(); await flush(); });

  const defter = await loadLedger(UID);
  expect(defter.baseline).not.toBeNull();
  expect(defter.aktiflik).toMatchObject({ sonSayim: 7, gunler: [] });
  expect(last.kutlama).toBeNull();
});
