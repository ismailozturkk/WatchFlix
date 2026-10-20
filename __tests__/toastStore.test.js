// Toast motoru (utils/toastStore.js): kuyruk, öncelik, yinelenen toast, yerinde
// güncelleme, duraklatma ve host devri. Saf mantık; zamanlayıcılar sahte.
import {
  EXIT_GAP_MS,
  MIN_RESUME_MS,
  QUEUE_MAX,
  QUEUE_TTL_MS,
  STICKY_MAX_LIFE_MS,
  TOAST_KINDS,
  cleanToastText,
  createToastStore,
  normalizeToast,
  readingDurationMs,
} from "../utils/toastStore";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const make = () => createToastStore();
const visible = (store) => store.getSnapshot().toast;
const titleOf = (store) => visible(store)?.title ?? null;

describe("normalizeToast", () => {
  it("eski (react-native-toast-message) imzasını anlar", () => {
    const onPress = jest.fn();
    const t = normalizeToast(
      {
        type: "error",
        text1: "Hata",
        text2: "Bağlantı yok",
        visibilityTime: 6000,
        onPress,
        props: { action: { label: "Geri Al", onPress: jest.fn() }, ek: 3 },
      },
      "x",
    );
    expect(t).toMatchObject({ id: "x", kind: "error", title: "Hata", message: "Bağlantı yok", durationMs: 6000 });
    expect(t.onPress).toBe(onPress);
    expect(t.action.label).toBe("Geri Al");
    // Eylem ayrı alana alınır; kalan `props` serbest veri olarak taşınır.
    expect(t.data).toEqual({ ek: 3 });
  });

  it("yeni imzayı (kind/title/message/duration) anlar", () => {
    const t = normalizeToast({ kind: "warning", title: "Dikkat", message: "Depo dolu", duration: 4000 }, "y");
    expect(t).toMatchObject({ kind: "warning", title: "Dikkat", message: "Depo dolu", durationMs: 4000 });
  });

  it("bilinmeyen tür bilgiye düşer (eski kütüphane burada patlıyordu)", () => {
    expect(normalizeToast({ type: "movie", text1: "x" }, "z").kind).toBe("info");
  });

  it("metin yoksa toast açılmaz; yalnız mesaj varsa başlığa yükselir", () => {
    expect(normalizeToast({ type: "success" }, "a")).toBeNull();
    expect(normalizeToast({ text1: "  ", text2: "" }, "a")).toBeNull();
    expect(normalizeToast({ text2: "Sadece mesaj" }, "a")).toMatchObject({ title: "Sadece mesaj", message: "" });
    expect(normalizeToast({ text1: "Aynı", text2: "Aynı" }, "a").message).toBe("");
  });

  it("Error nesnesini ve boşlukları temizler, uzun metni keser", () => {
    expect(cleanToastText(new Error("  satır\n\n  sonu "))).toBe("satır sonu");
    expect(cleanToastText(undefined)).toBe("");
    const long = cleanToastText("a".repeat(500));
    expect(long.length).toBe(240);
    expect(long.endsWith("…")).toBe(true);
  });

  it("süre: okuma süresi, hata çarpanı, eylem tabanı, açık değer, kalıcı", () => {
    expect(readingDurationMs("Kısa", "")).toBe(2400); // taban
    expect(readingDurationMs("x".repeat(80), "y".repeat(80))).toBe(6500); // tavan
    const ok = normalizeToast({ type: "success", text1: "Kaydedildi" }, "a");
    const err = normalizeToast({ type: "error", text1: "Kaydedildi" }, "a");
    expect(err.durationMs).toBeGreaterThan(ok.durationMs);
    expect(normalizeToast({ type: "info", text1: "Geri al", props: { action: { label: "Geri Al" } } }, "a").durationMs).toBe(6000);
    expect(normalizeToast({ type: "info", text1: "x", duration: 100 }, "a").durationMs).toBe(800); // alt sınır
    expect(normalizeToast({ type: "info", text1: "x", autoHide: false }, "a").durationMs).toBeNull();
    expect(normalizeToast({ kind: "loading", title: "Yükleniyor" }, "a").durationMs).toBeNull();
    expect(normalizeToast({ kind: "badge", title: "Rozet" }, "a").durationMs).toBe(5200);
  });

  it("etiketsiz eylem yok sayılır; titreşim tercihi geçersiz kılınabilir", () => {
    expect(normalizeToast({ text1: "x", action: { onPress: jest.fn() } }, "a").action).toBeNull();
    expect(normalizeToast({ type: "error", text1: "x" }, "a").haptic).toBe("error");
    expect(normalizeToast({ type: "error", text1: "x", haptic: false }, "a").haptic).toBeNull();
    expect(normalizeToast({ type: "success", text1: "x" }, "a").haptic).toBeNull();
    expect(normalizeToast({ type: "success", text1: "x", haptic: true }, "a").haptic).toBe("success");
  });

  it("tür sözlüğü: kutlama en yüksek, hata uyarıdan, uyarı başarıdan önemli", () => {
    const p = (k) => TOAST_KINDS[k].priority;
    expect(p("badge")).toBeGreaterThan(p("error"));
    expect(p("error")).toBeGreaterThan(p("warning"));
    expect(p("warning")).toBeGreaterThan(p("success"));
    expect(p("success")).toBeGreaterThan(p("info"));
    expect(TOAST_KINDS.loading.sticky).toBe(true);
  });
});

describe("gösterme ve kapanma", () => {
  it("toast görünür, süresi dolunca kapanır ve onHide sebep alır", () => {
    const store = make();
    const onHide = jest.fn();
    const onShow = jest.fn();
    const id = store.show({ type: "success", text1: "Kaydedildi", onHide, onShow });
    expect(id).toBeTruthy();
    expect(titleOf(store)).toBe("Kaydedildi");
    expect(onShow).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(2399);
    expect(titleOf(store)).toBe("Kaydedildi");
    jest.advanceTimersByTime(2);
    expect(visible(store)).toBeNull();
    expect(onHide).toHaveBeenCalledWith("timeout");
  });

  it("boş metinle show null döner ve hiçbir şey açmaz", () => {
    const store = make();
    expect(store.show({ type: "success" })).toBeNull();
    expect(visible(store)).toBeNull();
  });

  it("dismiss kimliğe bakar; yanlış kimlik görünen toast'a dokunmaz", () => {
    const store = make();
    const id = store.show({ text1: "A" });
    expect(store.dismiss("yok")).toBe(false);
    expect(titleOf(store)).toBe("A");
    expect(store.dismiss(id, "swipe")).toBe(true);
    expect(visible(store)).toBeNull();
  });

  it("hatalı geri çağrı toast'ı bozmaz", () => {
    const store = make();
    store.show({ text1: "A", onShow: () => { throw new Error("boom"); } });
    expect(titleOf(store)).toBe("A");
  });

  it("anlık görüntü değişmedikçe aynı nesne, değişince yeni nesne", () => {
    const store = make();
    const a = store.getSnapshot();
    expect(store.getSnapshot()).toBe(a);
    const listener = jest.fn();
    const off = store.subscribe(listener);
    store.show({ text1: "A" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(a);
    off();
    store.dismiss();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("onPresent her toast için tam bir kez çalışır (yineleme sayacında çalışmaz)", () => {
    const store = make();
    const onPresent = jest.fn();
    store.setEffects({ onPresent });
    store.show({ type: "error", text1: "Hata" });
    store.show({ type: "error", text1: "Hata" }); // yinelenen → sayaç
    expect(onPresent).toHaveBeenCalledTimes(1);
    expect(onPresent.mock.calls[0][0]).toMatchObject({ kind: "error", haptic: "error" });
  });
});

describe("yinelenen toast", () => {
  it("aynı içerik yeni toast açmaz: kimlik sabit, sayaç artar, süre yenilenir", () => {
    const store = make();
    const first = store.show({ type: "success", text1: "Panoya kopyalandı" });
    jest.advanceTimersByTime(2000);
    const second = store.show({ type: "success", text1: "Panoya kopyalandı" });
    expect(second).toBe(first);
    expect(visible(store).count).toBe(2);
    // Süre baştan: ilk ömrün bittiği anda hâlâ görünür.
    jest.advanceTimersByTime(1000);
    expect(visible(store)).not.toBeNull();
  });

  it("yinelemede SON verilen eylem/dokunuş geçerli olur (geri alma yanlış kaydı geri yazmasın)", () => {
    const store = make();
    const undoA = jest.fn();
    const undoB = jest.fn();
    store.show({ type: "info", text1: "Kaldırıldı", props: { action: { label: "Geri Al", onPress: undoA } } });
    store.show({ type: "info", text1: "Kaldırıldı", props: { action: { label: "Geri Al", onPress: undoB } } });
    visible(store).action.onPress();
    expect(undoB).toHaveBeenCalledTimes(1);
    expect(undoA).not.toHaveBeenCalled();
  });

  it("açık anahtar (key) farklı metni de aynı toast sayar", () => {
    const store = make();
    const a = store.show({ type: "info", text1: "Eşitleniyor 1/3", key: "sync" });
    const b = store.show({ type: "info", text1: "Eşitleniyor 2/3", key: "sync" });
    expect(b).toBe(a);
    expect(titleOf(store)).toBe("Eşitleniyor 2/3");
  });
});

describe("öncelik ve kuyruk", () => {
  it("daha önemli toast görüneni hemen değiştirir", () => {
    const store = make();
    store.show({ type: "info", text1: "Bilgi" });
    store.show({ type: "error", text1: "Hata" });
    expect(titleOf(store)).toBe("Hata");
  });

  it("eşit öncelikte asgari süre dolana kadar bekler, sonra en yeni kazanır", () => {
    const store = make();
    store.show({ type: "success", text1: "A" });
    store.show({ type: "success", text1: "B" });
    expect(titleOf(store)).toBe("A");
    expect(store.getSnapshot().queued).toBe(1);
    jest.advanceTimersByTime(TOAST_KINDS.success.minVisibleMs + 5);
    expect(titleOf(store)).toBe("B");
    expect(store.getSnapshot().queued).toBe(0);
  });

  it("asgari süreden sonra gelen eşit öncelikli hemen değiştirir", () => {
    const store = make();
    store.show({ type: "success", text1: "A" });
    jest.advanceTimersByTime(TOAST_KINDS.success.minVisibleMs + 10);
    store.show({ type: "success", text1: "B" });
    expect(titleOf(store)).toBe("B");
  });

  it("DÜŞÜK öncelikli, görünen hata/kutlamanın üstüne çıkmaz; bitince gösterilir", () => {
    const store = make();
    store.show({ type: "error", text1: "Hata" });
    jest.advanceTimersByTime(2000); // asgari süreyi çoktan aştı
    store.show({ type: "success", text1: "Kaydedildi" });
    expect(titleOf(store)).toBe("Hata");
    expect(store.getSnapshot().queued).toBe(1);

    // Hata ~3 sn yaşar (2 sn geçti); kapanınca çıkış boşluğundan sonra sıradaki açılır.
    jest.advanceTimersByTime(1000 + EXIT_GAP_MS + 20);
    expect(titleOf(store)).toBe("Kaydedildi");
  });

  it("hata, görünen kutlamayı (rozet) ezmez; sırada bekler", () => {
    const store = make();
    store.show({ kind: "badge", title: "Rozet", message: "Yeni" });
    store.show({ type: "error", text1: "Hata" });
    expect(titleOf(store)).toBe("Rozet");
    expect(store.getSnapshot().queued).toBe(1);
  });

  it("kapanışla sıradakinin açılışı arasında çıkış boşluğu vardır", () => {
    const store = make();
    const id = store.show({ type: "error", text1: "Hata" });
    store.show({ type: "info", text1: "Bilgi" });
    store.dismiss(id);
    expect(visible(store)).toBeNull();
    jest.advanceTimersByTime(EXIT_GAP_MS - 1);
    expect(visible(store)).toBeNull();
    jest.advanceTimersByTime(2);
    expect(titleOf(store)).toBe("Bilgi");
  });

  it("düşük öncelikliler en yeni kazanır (eskiler atılır, onHide 'dropped')", () => {
    const store = make();
    const dropped = jest.fn();
    const id = store.show({ type: "error", text1: "Hata" });
    store.show({ type: "info", text1: "Bilgi 1", onHide: dropped });
    store.show({ type: "info", text1: "Bilgi 2" });
    store.dismiss(id);
    jest.advanceTimersByTime(EXIT_GAP_MS + 5);
    expect(titleOf(store)).toBe("Bilgi 2");
    expect(store.getSnapshot().queued).toBe(0);
    expect(dropped).toHaveBeenCalledWith("dropped");
  });

  it("hata ve uyarılar sırayla gösterilir, biri diğerini yutmaz", () => {
    const store = make();
    const first = store.show({ kind: "badge", title: "Rozet" });
    store.show({ type: "error", text1: "Hata 1" });
    store.show({ type: "error", text1: "Hata 2" });
    store.dismiss(first);
    jest.advanceTimersByTime(EXIT_GAP_MS + 5);
    expect(titleOf(store)).toBe("Hata 1");
    store.dismiss();
    jest.advanceTimersByTime(EXIT_GAP_MS + 5);
    expect(titleOf(store)).toBe("Hata 2");
  });

  it("kuyruk sınırlıdır; taşınca en düşük öncelikli atılır", () => {
    const store = make();
    store.show({ kind: "badge", title: "Rozet" });
    store.show({ type: "info", text1: "Bilgi" });
    for (let i = 0; i < QUEUE_MAX; i += 1) store.show({ type: "error", text1: `Hata ${i}` });
    expect(store.getSnapshot().queued).toBe(QUEUE_MAX);
    store.dismiss();
    jest.advanceTimersByTime(EXIT_GAP_MS + 5);
    // Bilgi atıldı; ilk hata gösterilir.
    expect(titleOf(store)).toBe("Hata 0");
  });

  it("sırada çok bekleyen toast bayatlar ve atılır", () => {
    const store = make();
    const id = store.show({ kind: "badge", title: "Rozet", duration: 30000 });
    store.show({ type: "error", text1: "Hata" });
    jest.advanceTimersByTime(QUEUE_TTL_MS + 100);
    store.dismiss(id);
    jest.advanceTimersByTime(EXIT_GAP_MS + 5);
    expect(visible(store)).toBeNull();
  });

  it("clear her şeyi kaldırır ve geri çağrıları haber verir", () => {
    const store = make();
    const hideA = jest.fn();
    const hideB = jest.fn();
    store.show({ type: "error", text1: "A", onHide: hideA });
    store.show({ type: "info", text1: "B", onHide: hideB });
    store.clear();
    expect(visible(store)).toBeNull();
    expect(store.getSnapshot().queued).toBe(0);
    expect(hideA).toHaveBeenCalledWith("cleared");
    expect(hideB).toHaveBeenCalledWith("cancelled");
    jest.advanceTimersByTime(EXIT_GAP_MS * 3);
    expect(visible(store)).toBeNull();
  });
});

describe("update ve yükleniyor", () => {
  it("yükleniyor kendiliğinden kapanmaz; update sonucu AYNI toast'ta gösterir", () => {
    const store = make();
    const onPresent = jest.fn();
    store.setEffects({ onPresent });
    const id = store.show({ kind: "loading", title: "Yedek alınıyor" });
    jest.advanceTimersByTime(20000);
    expect(titleOf(store)).toBe("Yedek alınıyor");

    store.update(id, { kind: "success", title: "Yedek alındı" });
    expect(visible(store)).toMatchObject({ id, kind: "success", title: "Yedek alındı" });
    expect(onPresent).toHaveBeenCalledTimes(2); // kind değişti → yeniden duyuru
    jest.advanceTimersByTime(3000);
    expect(visible(store)).toBeNull();
  });

  it("yükleniyor → hata: hatanın KENDİ titreşimi çalışır", () => {
    const store = make();
    const id = store.show({ kind: "loading", title: "Gönderiliyor" });
    store.update(id, { kind: "error", title: "Gönderilemedi" });
    expect(visible(store).haptic).toBe("error");
  });

  it("asılı kalan yükleniyor güvenlik kapısıyla kapanır", () => {
    const store = make();
    store.show({ kind: "loading", title: "Bekle" });
    jest.advanceTimersByTime(STICKY_MAX_LIFE_MS + 10);
    expect(visible(store)).toBeNull();
  });

  it("görünenin yerini başkası aldıysa update sonucu YENİ toast olarak gösterir", () => {
    const store = make();
    const id = store.show({ kind: "loading", title: "Yükleniyor" });
    jest.advanceTimersByTime(TOAST_KINDS.loading.minVisibleMs + 10);
    store.show({ type: "info", text1: "Başka bir şey" });
    expect(titleOf(store)).toBe("Başka bir şey");
    store.update(id, { kind: "success", title: "Bitti" });
    // Bilgi (1) < başarı (2): hemen değiştirir ya da sırada bekler; kaybolmaz.
    const seen = [titleOf(store)];
    jest.advanceTimersByTime(8000);
    seen.push(titleOf(store));
    expect(seen).toContain("Bitti");
  });

  it("sırada bekleyen toast'ı da güncelleyebilir", () => {
    const store = make();
    store.show({ type: "error", text1: "Hata" });
    const queuedId = store.show({ type: "info", text1: "Eski" });
    store.update(queuedId, { title: "Yeni" });
    store.dismiss();
    jest.advanceTimersByTime(EXIT_GAP_MS + 5);
    expect(titleOf(store)).toBe("Yeni");
  });
});

describe("duraklatma", () => {
  it("pause süreyi dondurur, resume kalanı yeniden başlatır", () => {
    const store = make();
    store.show({ type: "success", text1: "Kaydedildi" }); // ~2,4 sn
    jest.advanceTimersByTime(1000);
    const left = store.pause();
    expect(left).toBeGreaterThan(1300);
    expect(left).toBeLessThanOrEqual(1400);
    jest.advanceTimersByTime(60000); // basılı tutuluyor
    expect(visible(store)).not.toBeNull();

    const resumed = store.resume();
    expect(resumed).toBe(left);
    jest.advanceTimersByTime(left + 5);
    expect(visible(store)).toBeNull();
  });

  it("kalan çok azsa bırakınca en az MIN_RESUME_MS süre tanınır", () => {
    const store = make();
    store.show({ type: "success", text1: "Kaydedildi" });
    jest.advanceTimersByTime(2300);
    store.pause();
    expect(store.resume()).toBe(MIN_RESUME_MS);
    jest.advanceTimersByTime(MIN_RESUME_MS - 5);
    expect(visible(store)).not.toBeNull();
  });

  it("çifte pause / eşleşmeyen resume zararsızdır; kimlik uyuşmazsa dokunmaz", () => {
    const store = make();
    const id = store.show({ type: "success", text1: "A" });
    expect(store.resume()).toBeNull();
    expect(store.pause("başka")).toBeNull();
    expect(store.pause(id)).not.toBeNull();
    expect(store.pause(id)).toBeNull();
  });

  it("kalıcı (yükleniyor) toast'ta resume ilerleme değeri döndürmez", () => {
    const store = make();
    store.show({ kind: "loading", title: "Bekle" });
    store.pause();
    expect(store.resume()).toBeNull();
  });

  it("erişilebilirlik süre çarpanı yeni toast'ların ömrünü uzatır", () => {
    const store = make();
    store.setDurationScale(2);
    store.show({ type: "success", text1: "A" });
    jest.advanceTimersByTime(4000);
    expect(visible(store)).not.toBeNull();
    jest.advanceTimersByTime(1000);
    expect(visible(store)).toBeNull();
  });
});

describe("host kaydı", () => {
  it("en son kaydolan host etkindir; çıkınca öncekine döner", () => {
    const store = make();
    const offRoot = store.registerHost("root");
    expect(store.getSnapshot().hostId).toBe("root");
    const offModal = store.registerHost("modal");
    expect(store.getSnapshot().hostId).toBe("modal");
    offModal();
    expect(store.getSnapshot().hostId).toBe("root");
    offRoot();
    expect(store.getSnapshot().hostId).toBeNull();
  });

  it("aynı kimlikle yeniden kayıt çift sayılmaz", () => {
    const store = make();
    store.registerHost("a");
    store.registerHost("b");
    store.registerHost("a");
    expect(store.getSnapshot().hostId).toBe("a");
    store.registerHost("c")();
    expect(store.getSnapshot().hostId).toBe("a");
  });

  it("host değişince devralan, kalan süreyi bilir (ilerleme çubuğu baştan başlamaz)", () => {
    const store = make();
    store.registerHost("root");
    store.show({ type: "success", text1: "Kaydedildi" }); // 2400
    jest.advanceTimersByTime(1500);
    store.registerHost("modal");
    const t = visible(store);
    expect(t.resumeFrom).toBeLessThanOrEqual(900);
    expect(t.resumeFrom).toBeGreaterThan(800);
    expect(t.durationMs).toBe(2400);
  });

  it("host yokken de toast ömrü işler (modal kapanırken kaybolmaz, bayatlamaz)", () => {
    const store = make();
    const off = store.registerHost("modal");
    store.show({ type: "success", text1: "Kaydedildi" });
    off();
    expect(titleOf(store)).toBe("Kaydedildi");
    jest.advanceTimersByTime(3000);
    expect(visible(store)).toBeNull();
  });
});
