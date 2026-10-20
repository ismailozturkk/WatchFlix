// Yükseltme sayfasının imperatif köprüsü (services/premiumUpsellHost.js):
// kapılar React dışından çağırır, tek host çizer. Host henüz mount olmadıysa
// (açılışta erken bir kapı) istek kaybolmamalı.

import {
  __resetUpsellHostForTests,
  createCloseGate,
  presentUpsell,
  registerUpsellHost,
} from "../services/premiumUpsellHost";

beforeEach(() => __resetUpsellHostForTests());

const request = (featureId, extra = {}) => ({ featureId, plan: "free", ...extra });

describe("presentUpsell", () => {
  test("host kayıtlıysa istek ANINDA iletilir", () => {
    const host = jest.fn();
    registerUpsellHost(host);
    const req = request("custom_lists", { used: 5 });
    presentUpsell(req);
    expect(host).toHaveBeenCalledTimes(1);
    expect(host).toHaveBeenCalledWith(req);
  });

  test("host yokken gelen istekler kuyruklanır, kayıtta SIRAYLA verilir", () => {
    presentUpsell(request("friends"));
    presentUpsell(request("games"));
    presentUpsell(request("custom_lists"));

    const host = jest.fn();
    registerUpsellHost(host);

    expect(host.mock.calls.map(([r]) => r.featureId)).toEqual(["friends", "games", "custom_lists"]);
  });

  test("kuyruk bir kez boşalır: ikinci kayıt eski istekleri tekrar görmez", () => {
    presentUpsell(request("friends"));
    registerUpsellHost(jest.fn());
    const second = jest.fn();
    registerUpsellHost(second);
    expect(second).not.toHaveBeenCalled();
  });

  test("geçersiz istek (kimliksiz / boş) yok sayılır", () => {
    const host = jest.fn();
    registerUpsellHost(host);
    presentUpsell(null);
    presentUpsell(undefined);
    presentUpsell({});
    presentUpsell({ plan: "free" });
    expect(host).not.toHaveBeenCalled();
  });

  test("kaydı kaldırılan host artık çağrılmaz, istekler yeniden kuyruğa girer", () => {
    const host = jest.fn();
    const unregister = registerUpsellHost(host);
    unregister();

    presentUpsell(request("games"));
    expect(host).not.toHaveBeenCalled();

    const next = jest.fn();
    registerUpsellHost(next);
    expect(next).toHaveBeenCalledWith(request("games"));
  });

  test("eski host'un kaydı silmesi, yeni host'u DÜŞÜRMEZ (hızlı yeniden mount)", () => {
    const first = jest.fn();
    const unregisterFirst = registerUpsellHost(first);
    const second = jest.fn();
    registerUpsellHost(second);

    unregisterFirst(); // eski effect temizliği, yenisi kaydolduktan SONRA çalışır

    presentUpsell(request("friends"));
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  test("onUpgrade / onDismiss callback'leri isteğin içinde korunur", () => {
    const host = jest.fn();
    registerUpsellHost(host);
    const onUpgrade = jest.fn();
    const onDismiss = jest.fn();
    presentUpsell(request("custom_lists", { onUpgrade, onDismiss }));
    const [received] = host.mock.calls[0];
    received.onUpgrade();
    received.onDismiss();
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

// iOS kapanmakta olan Modal'ın üstüne ikincisini sunamaz: sayfa kapanırken
// callback ve sıradaki istek, pencere GERÇEKTEN kalkınca çalışmalı (aksi halde
// Hub arşivinden kilitli yıla basınca ekran kilitleniyordu).
describe("createCloseGate", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("iş, pencere kalktı bildirimi (finish) gelene kadar çalışmaz", () => {
    const gate = createCloseGate(900);
    const next = jest.fn();
    gate.begin(next);
    jest.advanceTimersByTime(800);
    expect(next).not.toHaveBeenCalled();
    gate.finish();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("finish birden çok kez gelse de iş TEK kez çalışır; yedek zamanlayıcı da etkisiz kalır", () => {
    const gate = createCloseGate(900);
    const next = jest.fn();
    gate.begin(next);
    gate.finish();
    gate.finish();
    jest.advanceTimersByTime(5000);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("bildirim hiç gelmezse yedek süre dolunca devam eder (host kilitli kalmaz)", () => {
    const gate = createCloseGate(900);
    const next = jest.fn();
    gate.begin(next);
    jest.advanceTimersByTime(899);
    expect(next).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("begin olmadan gelen finish zararsız", () => {
    const gate = createCloseGate(900);
    expect(() => gate.finish()).not.toThrow();
  });

  test("cancel bekleyen işi çalıştırmaz (host kaldırılırken)", () => {
    const gate = createCloseGate(900);
    const next = jest.fn();
    gate.begin(next);
    gate.cancel();
    gate.finish();
    jest.advanceTimersByTime(5000);
    expect(next).not.toHaveBeenCalled();
  });

  test("kapı yeniden kullanılabilir: ikinci begin kendi işini çalıştırır", () => {
    const gate = createCloseGate(900);
    const first = jest.fn();
    const second = jest.fn();
    gate.begin(first);
    gate.finish();
    gate.begin(second);
    expect(second).not.toHaveBeenCalled();
    gate.finish();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
