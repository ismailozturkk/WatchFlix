// components/AppToast.js (toast API cephesi): eski ve yeni imza aynı depoya iner;
// titreşim / ekran okuyucu yan etkileri; uzun iş izleme (promise).
let mockPlatformOS = "ios";
let mockScreenReader = false;
const mockAnnounce = jest.fn();
const mockHaptic = jest.fn();

jest.mock("react-native", () => ({
  get Platform() {
    return { OS: mockPlatformOS };
  },
  AccessibilityInfo: {
    announceForAccessibility: (...args) => mockAnnounce(...args),
    isScreenReaderEnabled: () => Promise.resolve(mockScreenReader),
    addEventListener: jest.fn(),
  },
}));
jest.mock("../services/hapticsService", () => ({
  triggerHaptic: (...args) => mockHaptic(...args),
}));
jest.mock("../utils/i18nText", () => ({ i18nText: (_key, fallback) => fallback }));

beforeEach(() => {
  jest.useFakeTimers();
  mockAnnounce.mockClear();
  mockHaptic.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

// Modül yüklenirken ekran okuyucu durumu bir kez okunur.
const load = async ({ screenReader = false } = {}) => {
  jest.resetModules();
  mockScreenReader = screenReader;
  const mod = require("../components/AppToast");
  const { toastStore } = require("../utils/toastStore");
  await Promise.resolve();
  await Promise.resolve();
  return { toast: mod.toast, Toast: mod.default, showToast: mod.showToast, toastStore };
};

const current = (store) => store.getSnapshot().toast;

describe("toast API", () => {
  it("kısa yollar türü ve metni doğru yazar; Error nesnesi mesaj olur", async () => {
    const { toast, toastStore } = await load();
    toast.success("Kaydedildi", "Değişiklikler uygulandı");
    expect(current(toastStore)).toMatchObject({ kind: "success", title: "Kaydedildi", message: "Değişiklikler uygulandı" });

    toast.error("Hata", new Error("Bağlantı yok"));
    expect(current(toastStore)).toMatchObject({ kind: "error", message: "Bağlantı yok" });
  });

  it("eski imza (Toast.show) aynen çalışır; varsayılan dışa aktarım toast'tır", async () => {
    const { Toast, toast, toastStore } = await load();
    expect(Toast).toBe(toast);
    Toast.show({ type: "warning", text1: "Dikkat", text2: "Depo dolu", visibilityTime: 5000 });
    expect(current(toastStore)).toMatchObject({ kind: "warning", title: "Dikkat", message: "Depo dolu", durationMs: 5000 });
  });

  it("show kimlik döner; boş metinle null", async () => {
    const { toast, toastStore } = await load();
    expect(toast.show({ type: "info" })).toBeNull();
    const id = toast.show({ type: "info", text1: "x" });
    expect(current(toastStore).id).toBe(id);
  });

  it("seçenekler (onPress, süre) geçer; türü seçenekler değiştiremez", async () => {
    const { toast, toastStore } = await load();
    const onPress = jest.fn();
    toast.success("A", undefined, { onPress, type: "error", duration: 4000 });
    expect(current(toastStore)).toMatchObject({ kind: "success", durationMs: 4000 });
    current(toastStore).onPress();
    expect(onPress).toHaveBeenCalled();
  });

  it("undo: 'Geri Al' düğmesi, ok ikonu, en az 6 sn; düğme eylemi çalıştırır", async () => {
    const { toast, toastStore } = await load();
    const undo = jest.fn();
    toast.undo("Hatırlatma kaldırıldı", undo);
    const t = current(toastStore);
    expect(t.action).toMatchObject({ label: "Geri Al", icon: "arrow-undo" });
    expect(t.durationMs).toBeGreaterThanOrEqual(6000);
    t.action.onPress();
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("undo türü seçenekle değişebilir", async () => {
    const { toast, toastStore } = await load();
    toast.undo("Silindi", jest.fn(), { kind: "success" });
    expect(current(toastStore).kind).toBe("success");
  });

  it("badge: props rozet verisi olur, süre kutlama süresi", async () => {
    const { toast, toastStore } = await load();
    const gorunum = { id: "kasif", rarity: "epic" };
    const onPress = jest.fn();
    toast.badge("Yeni rozet", "Kâşif", { gorunum, ek: 3, ipucu: "Görmek için dokun", action: null }, { onPress });
    const t = current(toastStore);
    expect(t).toMatchObject({ kind: "badge", title: "Yeni rozet", message: "Kâşif", durationMs: 5200 });
    expect(t.data).toEqual({ gorunum, ek: 3, ipucu: "Görmek için dokun" });
    expect(t.onPress).toBe(onPress);
  });

  it("premium kutlaması kalır ve en yüksek öncelikte", async () => {
    const { toast, toastStore } = await load();
    toast.error("Hata");
    toast.premium("Premium aktif", "Hazır");
    expect(current(toastStore).kind).toBe("premium");
  });

  it("hide: kimlik verilirse yalnız onu, olay nesnesi verilirse görüneni kapatır", async () => {
    const { toast, toastStore } = await load();
    const id = toast.info("A");
    toast.hide("başka");
    expect(current(toastStore)).not.toBeNull();
    toast.hide({ nativeEvent: {} }); // onPress={toast.hide} gibi kullanım
    expect(current(toastStore)).toBeNull();
    expect(id).toBeTruthy();
  });

  it("clear görünen ve bekleyenleri kaldırır", async () => {
    const { toast, toastStore } = await load();
    toast.error("A");
    toast.info("B");
    toast.clear();
    expect(current(toastStore)).toBeNull();
    expect(toastStore.getSnapshot().queued).toBe(0);
  });
});

describe("yan etkiler", () => {
  it("hata ve uyarı titreşir; başarı ve bilgi titreşmez (haptic:true ile titreşir)", async () => {
    const { toast, toastStore } = await load();
    toast.success("Kaydedildi");
    toast.info("Bilgi");
    expect(mockHaptic).not.toHaveBeenCalled();

    toast.error("Hata");
    expect(mockHaptic).toHaveBeenLastCalledWith("error");
    toast.warning("Uyarı");
    jest.advanceTimersByTime(5000);
    expect(mockHaptic).toHaveBeenCalledWith("warning");

    mockHaptic.mockClear();
    toastStore.clear();
    toast.success("Tamam", undefined, { haptic: true });
    expect(mockHaptic).toHaveBeenCalledWith("success");
    toastStore.clear();
    toast.error("Sessiz hata", undefined, { haptic: false });
    expect(mockHaptic).toHaveBeenCalledTimes(1);
  });

  it("aynı toast tekrar gelince (sayaç) yeniden titreşmez", async () => {
    const { toast } = await load();
    toast.error("Hata");
    toast.error("Hata");
    expect(mockHaptic).toHaveBeenCalledTimes(1);
  });

  it("iOS'ta ekran okuyucuya duyurulur; Android'de duyuru yok (canlı bölge yeter)", async () => {
    mockPlatformOS = "ios";
    const ios = await load();
    ios.toast.success("Kaydedildi", "Not eklendi");
    expect(mockAnnounce).toHaveBeenCalledWith("Kaydedildi. Not eklendi");

    mockAnnounce.mockClear();
    mockPlatformOS = "android";
    const android = await load();
    android.toast.success("Kaydedildi");
    expect(mockAnnounce).not.toHaveBeenCalled();
    mockPlatformOS = "ios";
  });

  it("ekran okuyucu açıkken süreler iki katına çıkar", async () => {
    const { toast, toastStore } = await load({ screenReader: true });
    toast.success("Kaydedildi"); // 2400 → 4800
    jest.advanceTimersByTime(4000);
    expect(current(toastStore)).not.toBeNull();
    jest.advanceTimersByTime(900);
    expect(current(toastStore)).toBeNull();
  });
});

describe("loading / update / promise", () => {
  it("loading kalıcıdır; update aynı kartı sonuca çevirir", async () => {
    const { toast, toastStore } = await load();
    const id = toast.loading("Yedek alınıyor");
    jest.advanceTimersByTime(30000);
    expect(current(toastStore)).toMatchObject({ id, kind: "loading" });
    toast.update(id, { kind: "success", title: "Yedek alındı" });
    expect(current(toastStore)).toMatchObject({ id, kind: "success", title: "Yedek alındı" });
  });

  it("promise: yükleniyor → başarı; değer aynen döner", async () => {
    const { toast, toastStore } = await load();
    let resolveWork;
    const work = new Promise((resolve) => {
      resolveWork = resolve;
    });
    const result = toast.promise(work, {
      loading: "Yükleniyor",
      success: (value) => ({ title: "Bitti", message: `${value} öğe` }),
      error: "Olmadı",
    });
    expect(current(toastStore)).toMatchObject({ kind: "loading", title: "Yükleniyor" });
    const id = current(toastStore).id;

    resolveWork(7);
    await expect(result).resolves.toBe(7);
    expect(current(toastStore)).toMatchObject({ id, kind: "success", title: "Bitti", message: "7 öğe" });
  });

  it("promise: hata aynı kartı hataya çevirir ve hatayı yeniden fırlatır", async () => {
    const { toast, toastStore } = await load();
    const failure = new Error("ağ yok");
    const result = toast.promise(Promise.reject(failure), {
      loading: "Gönderiliyor",
      error: (error) => ({ title: "Gönderilemedi", message: error.message }),
    });
    await expect(result).rejects.toBe(failure);
    expect(current(toastStore)).toMatchObject({ kind: "error", title: "Gönderilemedi", message: "ağ yok" });
  });

  it("promise: sonuç metni verilmediyse yükleniyor kartı sessizce kapanır", async () => {
    const { toast, toastStore } = await load();
    await toast.promise(Promise.resolve(1), { loading: "Yükleniyor" });
    expect(current(toastStore)).toBeNull();
  });

  it("promise: yükleniyor verilmezse yalnız sonuç gösterilir", async () => {
    const { toast, toastStore } = await load();
    await toast.promise(Promise.resolve(1), { success: "Tamam" });
    expect(current(toastStore)).toMatchObject({ kind: "success", title: "Tamam" });
  });
});
