// Bağlantı toast'ı kararı (utils/connectivityToast.js): kısa kopmalar sessiz, uzun kopma
// bir kez duyurulur, "döndü" yalnız duyurulmuş kopmanın ardından söylenir.
import { OFFLINE_DELAY_MS, createConnectivityAnnouncer } from "../utils/connectivityToast";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const make = () => {
  const onOffline = jest.fn(() => "offline-id");
  const onOnline = jest.fn();
  const announcer = createConnectivityAnnouncer({ onOffline, onOnline });
  return { announcer, onOffline, onOnline };
};

describe("createConnectivityAnnouncer", () => {
  it("çevrimiçi başlangıç sessizdir", () => {
    const { announcer, onOffline, onOnline } = make();
    announcer.update(true);
    jest.advanceTimersByTime(10000);
    expect(onOffline).not.toHaveBeenCalled();
    expect(onOnline).not.toHaveBeenCalled();
  });

  it("kopma gecikme boyunca sürerse bir kez duyurulur", () => {
    const { announcer, onOffline } = make();
    announcer.update(false);
    jest.advanceTimersByTime(OFFLINE_DELAY_MS - 1);
    expect(onOffline).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2);
    expect(onOffline).toHaveBeenCalledTimes(1);
    // Kopma sürerken yinelenen güncelleme yeniden duyurmaz.
    announcer.update(false);
    jest.advanceTimersByTime(20000);
    expect(onOffline).toHaveBeenCalledTimes(1);
  });

  it("gecikmeden önce dönen kısa kopma hiçbir şey söylemez", () => {
    const { announcer, onOffline, onOnline } = make();
    announcer.update(false);
    jest.advanceTimersByTime(1500);
    announcer.update(true);
    jest.advanceTimersByTime(10000);
    expect(onOffline).not.toHaveBeenCalled();
    expect(onOnline).not.toHaveBeenCalled();
  });

  it("duyurulmuş kopmanın ardından dönünce çevrimdışı toast kimliğiyle 'döndü' denir", () => {
    const { announcer, onOnline } = make();
    announcer.update(false);
    jest.advanceTimersByTime(OFFLINE_DELAY_MS + 10);
    announcer.update(true);
    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledWith("offline-id");
  });

  it("her kopma dönemi ayrı duyurulur", () => {
    const { announcer, onOffline, onOnline } = make();
    for (let i = 0; i < 2; i += 1) {
      announcer.update(false);
      jest.advanceTimersByTime(OFFLINE_DELAY_MS + 10);
      announcer.update(true);
    }
    expect(onOffline).toHaveBeenCalledTimes(2);
    expect(onOnline).toHaveBeenCalledTimes(2);
  });

  it("null/undefined 'çevrimiçi' sayılır (NetInfo henüz bilmiyor)", () => {
    const { announcer, onOffline } = make();
    announcer.update(undefined);
    announcer.update(null);
    jest.advanceTimersByTime(10000);
    expect(onOffline).not.toHaveBeenCalled();
  });

  it("dispose bekleyen duyuruyu iptal eder", () => {
    const { announcer, onOffline } = make();
    announcer.update(false);
    announcer.dispose();
    jest.advanceTimersByTime(10000);
    expect(onOffline).not.toHaveBeenCalled();
  });

  it("toast kimliği dönmese de akış çalışır", () => {
    const onOnline = jest.fn();
    const announcer = createConnectivityAnnouncer({ onOffline: () => undefined, onOnline });
    announcer.update(false);
    jest.advanceTimersByTime(OFFLINE_DELAY_MS + 10);
    announcer.update(true);
    expect(onOnline).toHaveBeenCalledWith(null);
  });
});
