// __tests__/userDataDomain.test.js
//
// Yerel-öncelikli alan motoru. Ana sözleşme:
//   • yerel kopya varken buluttan HİÇ okuma yok (açılışta dahil)
//   • indirme yalnız kopya yokken, tek seferlik
//   • yazma: yerel + günlük anında, bulut arka planda
//   • çökme/silinme/indirme yarışında kullanıcı değişikliği kaybolmaz

const { boot } = require("./helpers/userDataHarness");
const { RETRY_COOLDOWN_MS } = require("../services/userData/createDomain");

jest.useFakeTimers();
afterEach(() => jest.clearAllTimers());

const note = (id, extra = {}) => ({ id, type: "note", content: id, createdAt: Number(id.replace(/\D/g, "")) || 1, ...extra });
const seedNotes = (h, uid, notes) => {
  for (const n of notes) h.remote.seed(`Notes/${uid}/items/${n.id}`, n);
};
const ids = (h, uid = "u1") => h.mods.notes.getSnapshot(uid).lists.items.map((n) => n.id);

describe("tek seferlik indirme", () => {
  test("yerel kopya yok → bir kez indirir, sonra hazır", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1"), note("n2")]);

    const once = h.mods.notes.getSnapshot("u1");
    expect(once.ready).toBe(false);
    expect(once.waiting).toBe(true); // henüz indirme başlamadı

    await h.mods.notes.ensureHydrated("u1");

    const sonra = h.mods.notes.getSnapshot("u1");
    expect(sonra.ready).toBe(true);
    expect(sonra.lists.items.map((n) => n.id).sort()).toEqual(["n1", "n2"]);
    expect(h.remote.calls.fetchCollection).toEqual(["Notes/u1/items"]);
  });

  test("hazırken tekrar çağrılırsa AĞ YOK", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    await h.mods.notes.ensureHydrated("u1");
    const okuma = h.remote.reads();

    await h.mods.notes.ensureHydrated("u1");
    await h.mods.notes.ensureHydrated("u1");
    expect(h.remote.reads()).toBe(okuma);
  });

  test("YENİDEN AÇILIŞ: disk kopyası varsa buluttan SIFIR okuma", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1"), note("n2"), note("n3")]);
    await h.mods.notes.ensureHydrated("u1");

    h.restart();
    h.remote.calls.fetchCollection.length = 0;
    h.remote.calls.fetchDoc.length = 0;

    // açılış: senkron görünüm ilk karede dolu
    const view = h.mods.notes.getSnapshot("u1");
    expect(view.ready).toBe(true);
    expect(view.lists.items).toHaveLength(3);

    await h.mods.notes.ensureHydrated("u1");
    expect(h.remote.reads()).toBe(0);
  });

  test("eşzamanlı çağrılar TEK indirme yapar", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    await Promise.all([
      h.mods.notes.ensureHydrated("u1"),
      h.mods.notes.ensureHydrated("u1"),
      h.mods.notes.ensureHydrated("u1"),
    ]);
    expect(h.remote.calls.fetchCollection).toHaveLength(1);
  });

  test("çevrimdışı yeni cihaz: hata yok, 'waiting'; internet gelince indirir", async () => {
    const h = boot({ online: false });
    seedNotes(h, "u1", [note("n1")]);

    expect(await h.mods.notes.ensureHydrated("u1")).toBe(false);
    const view = h.mods.notes.getSnapshot("u1");
    expect(view.ready).toBe(false);
    expect(view.waiting).toBe(true);
    expect(h.remote.reads()).toBe(0);

    h.env.online = true;
    expect(await h.mods.notes.ensureHydrated("u1")).toBe(true);
    expect(ids(h)).toEqual(["n1"]);
  });

  test("indirme hatasında hazır olmaz, hata bilgisi kalır, tekrar denenebilir", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    const asil = h.remote.fetchCollection;
    h.remote.fetchCollection = async () => {
      throw Object.assign(new Error("ağ"), { code: "unavailable" });
    };
    expect(await h.mods.notes.ensureHydrated("u1")).toBe(false);
    expect(h.mods.notes.getSnapshot("u1").error).toBe("unavailable");
    expect(h.mods.notes.getSnapshot("u1").hydrating).toBe(false);

    // Başarısız denemeden hemen sonra arka plan çağrıları ağa GİTMEZ (okuma fırtınası)
    h.remote.fetchCollection = asil;
    await h.mods.notes.ensureHydrated("u1");
    expect(h.remote.calls.fetchCollection).toHaveLength(0);

    // bekleme süresi dolunca tekrar dener
    jest.advanceTimersByTime(RETRY_COOLDOWN_MS + 1);
    expect(await h.mods.notes.ensureHydrated("u1")).toBe(true);
    expect(h.mods.notes.getSnapshot("u1").error).toBeNull();
  });

  test("zorla indirme bekleme süresini atlar", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    const asil = h.remote.fetchCollection;
    h.remote.fetchCollection = async () => {
      throw Object.assign(new Error("ağ"), { code: "unavailable" });
    };
    await h.mods.notes.ensureHydrated("u1");
    h.remote.fetchCollection = asil;
    expect(await h.mods.notes.resync("u1")).toBe(true);
  });

  test("kullanıcılar birbirinin verisini görmez", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    seedNotes(h, "u2", [note("n9")]);
    await h.mods.notes.ensureHydrated("u1");
    await h.mods.notes.ensureHydrated("u2");
    expect(ids(h, "u1")).toEqual(["n1"]);
    expect(ids(h, "u2")).toEqual(["n9"]);
  });
});

describe("DEĞİŞMEZ KURAL: anlık görüntü dosyası = hidrate edildi", () => {
  test("hazır değilken yapılan yazma diske ANLIK GÖRÜNTÜ yazmaz", async () => {
    const h = boot({ online: false });
    h.mods.notes.apply("u1", [{ kind: "items", doc: note("n5") }]);
    await jest.advanceTimersByTimeAsync(1000);
    h.mods.snapshot.flushSnapshotWrites();

    expect(h.mods.cacheStore.getJSON(...h.mods.cacheKeys.notes("u1"))).toBeNull();
    // ama değişiklik kaybolmaz: günlükte
    expect(h.mods.outbox.counts("u1").pending).toBe(1);
  });

  test("yarım kopya 'tam' sanılmaz: yeniden açılışta hâlâ indirme gerekir", async () => {
    const h = boot({ online: false });
    h.mods.notes.apply("u1", [{ kind: "items", doc: note("n5") }]);
    h.restart();
    expect(h.mods.notes.getSnapshot("u1").ready).toBe(false);
  });

  test("indirme tamamlanınca dosya yazılır", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    await h.mods.notes.ensureHydrated("u1");
    expect(h.mods.cacheStore.getJSON(...h.mods.cacheKeys.notes("u1"))).toHaveLength(1);
  });
});

describe("indirme sırasındaki / öncesindeki yerel değişiklikler kaybolmaz", () => {
  test("çevrimdışı yazılan not, sonraki indirmenin üstüne biner", async () => {
    const h = boot({ online: false });
    seedNotes(h, "u1", [note("n1")]);
    h.mods.notes.apply("u1", [{ kind: "items", doc: note("n7", { content: "offline" }) }]);

    h.env.online = true;
    await h.mods.notes.ensureHydrated("u1");
    expect(ids(h).sort()).toEqual(["n1", "n7"]);
  });

  test("çevrimdışı silinen not, indirmede geri GELMEZ", async () => {
    const h = boot({ online: false });
    seedNotes(h, "u1", [note("n1"), note("n2")]);
    h.mods.notes.apply("u1", [{ kind: "items", key: "n2" }]);

    h.env.online = true;
    await h.mods.notes.ensureHydrated("u1");
    expect(ids(h)).toEqual(["n1"]);
  });

  test("indirme SÜRERKEN yazılıp ONAYLANAN değişiklik kaybolmaz (journal)", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);

    // indirmeyi elle geciktir
    let serbest;
    const asil = h.remote.fetchCollection.bind(h.remote);
    h.remote.fetchCollection = async (path) => {
      await new Promise((r) => (serbest = r));
      return asil(path);
    };
    // bulut cevabı İNDİRME BAŞLADIĞINDA okunmuş gibi: n2 ekleneceği için sonradan değil
    const indirme = h.mods.notes.ensureHydrated("u1");
    await Promise.resolve();
    expect(h.mods.notes.getSnapshot("u1").hydrating).toBe(true);

    // kullanıcı not ekler; işçi hemen buluta yazar ve ONAYLAR (günlük boşalır)
    h.mods.worker.start("u1");
    h.mods.notes.apply("u1", [{ kind: "items", doc: note("n2", { content: "yeni" }) }]);
    await jest.advanceTimersByTimeAsync(500);
    expect(h.mods.outbox.counts("u1").pending).toBe(0);

    // bulut cevabı n2'yi İÇERMİYOR (okuma commit'ten önceydi)
    h.remote.db.delete("Notes/u1/items/n2");
    serbest();
    await indirme;

    expect(ids(h).sort()).toEqual(["n1", "n2"]);
  });

  test("zorla yeniden indirme yerelle bulutu eşitler, bekleyenleri korur", async () => {
    const h = boot({ online: false });
    seedNotes(h, "u1", [note("n1")]);
    h.env.online = true;
    await h.mods.notes.ensureHydrated("u1");

    // bulutta başka cihaz n3 ekledi, n1'i sildi
    h.remote.db.delete("Notes/u1/items/n1");
    seedNotes(h, "u1", [note("n3")]);
    // bu cihazda henüz gitmemiş bir değişiklik
    h.env.online = false;
    h.mods.notes.apply("u1", [{ kind: "items", doc: note("n4") }]);
    h.env.online = true;

    await h.mods.notes.resync("u1");
    expect(ids(h).sort()).toEqual(["n3", "n4"]);
  });
});

describe("yazma", () => {
  test("yerel görünüm ANINDA güncellenir ve abonelere haber verilir", async () => {
    const h = boot();
    seedNotes(h, "u1", []);
    await h.mods.notes.ensureHydrated("u1");
    const dinleyici = jest.fn();
    h.mods.notes.subscribe(dinleyici);
    const once = h.mods.notes.getSnapshot("u1");

    h.mods.notes.apply("u1", [{ kind: "items", doc: note("n1") }]);

    expect(dinleyici).toHaveBeenCalled();
    const sonra = h.mods.notes.getSnapshot("u1");
    expect(sonra).not.toBe(once); // yeni referans → React yeniden çizer
    expect(sonra.lists.items).toHaveLength(1);
  });

  test("değişiklik yoksa görünüm referansı DEĞİŞMEZ", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    await h.mods.notes.ensureHydrated("u1");
    const a = h.mods.notes.getSnapshot("u1");
    expect(h.mods.notes.getSnapshot("u1")).toBe(a);
    h.mods.notes.apply("u1", []);
    expect(h.mods.notes.getSnapshot("u1")).toBe(a);
  });

  test("liste createdAt azalan sıralanır", async () => {
    const h = boot();
    seedNotes(h, "u1", []);
    await h.mods.notes.ensureHydrated("u1");
    h.mods.notes.apply("u1", [
      { kind: "items", doc: note("n1", { createdAt: 100 }) },
      { kind: "items", doc: note("n2", { createdAt: 300 }) },
      { kind: "items", doc: note("n3", { createdAt: 200 }) },
    ]);
    expect(ids(h)).toEqual(["n2", "n3", "n1"]);
  });

  test("undefined alanlar atılır (Firestore reddederdi)", async () => {
    const h = boot();
    seedNotes(h, "u1", []);
    await h.mods.notes.ensureHydrated("u1");
    h.mods.worker.start("u1");
    h.mods.notes.apply("u1", [
      { kind: "items", doc: note("n1", { scheduledDate: undefined, todos: [undefined] }) },
    ]);
    await jest.advanceTimersByTimeAsync(500);
    const bulut = h.remote.db.get("Notes/u1/items/n1");
    expect("scheduledDate" in bulut).toBe(false);
    expect(bulut.todos).toEqual([null]);
  });

  test("değişiklik kaydedilen belge ile görünüm aynı nesne değil (dışarıdan mutasyon sızmaz)", async () => {
    const h = boot();
    seedNotes(h, "u1", []);
    await h.mods.notes.ensureHydrated("u1");
    const girdi = note("n1", { content: "a" });
    h.mods.notes.apply("u1", [{ kind: "items", doc: girdi }]);
    girdi.content = "DEĞİŞTİ";
    expect(h.mods.notes.getSnapshot("u1").get("items", "n1").content).toBe("a");
  });
});

describe("çökme kurtarma", () => {
  test("anlık görüntü yazılmadan süreç ölürse değişiklik GÜNLÜKTEN geri gelir", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    await h.mods.notes.ensureHydrated("u1");

    h.mods.notes.apply("u1", [{ kind: "items", doc: note("n2", { content: "son dakika" }) }]);
    // debounce (300ms) dolmadan öl: ertelenmiş yazım KAYBOLUR
    h.restart();

    expect(ids(h).sort()).toEqual(["n1", "n2"]);
    expect(h.mods.notes.getSnapshot("u1").get("items", "n2").content).toBe("son dakika");
  });

  test("kurtarılan değişiklik sonra buluta da gider", async () => {
    const h = boot();
    seedNotes(h, "u1", []);
    await h.mods.notes.ensureHydrated("u1");
    h.mods.notes.apply("u1", [{ kind: "items", doc: note("n2") }]);
    h.restart();
    h.mods.notes.getSnapshot("u1");
    h.mods.worker.start("u1");
    await jest.advanceTimersByTimeAsync(10);
    expect(h.remote.db.has("Notes/u1/items/n2")).toBe(true);
  });

  test("anlık görüntü dosyası BOZULURSA bulut + günlükle yeniden kurulur", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    await h.mods.notes.ensureHydrated("u1");
    h.env.online = false;
    h.mods.notes.apply("u1", [{ kind: "items", doc: note("n2") }]); // gitmedi

    // dosyayı boz
    const fs = require("expo-file-system");
    for (const [yol] of fs.__files) {
      if (yol.includes("/userdata/notes/")) fs.__files.set(yol, "{bozuk");
    }
    h.restart();
    expect(h.mods.notes.getSnapshot("u1").ready).toBe(false); // bozuk = kayıt yok

    h.env.online = true;
    await h.mods.notes.ensureHydrated("u1");
    expect(ids(h).sort()).toEqual(["n1", "n2"]); // bulut(n1) + günlük(n2)
  });

  test("OS önbellek/dosya silerse tek seferlik yeniden indirir, bekleyen kaybolmaz", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    await h.mods.notes.ensureHydrated("u1");
    h.env.online = false;
    h.mods.notes.apply("u1", [{ kind: "items", doc: note("n2") }]);

    h.mods.cacheStore.clearAllDurable(); // dosyalar gitti
    h.restart();
    h.env.online = true;
    await h.mods.notes.ensureHydrated("u1");
    expect(ids(h).sort()).toEqual(["n1", "n2"]);
  });
});

describe("çıkış / hesap değiştirme", () => {
  test("clearLocal yerel kopyayı siler ama GÜNLÜĞE dokunmaz", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    await h.mods.notes.ensureHydrated("u1");
    h.env.online = false;
    h.mods.notes.apply("u1", [{ kind: "items", doc: note("n2") }]);

    h.mods.notes.clearLocal("u1");
    expect(h.mods.cacheStore.getJSON(...h.mods.cacheKeys.notes("u1"))).toBeNull();
    expect(h.mods.outbox.counts("u1").pending).toBe(1);
  });

  test("aynı hesapla tekrar girişte: bulut + bekleyen günlük", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    await h.mods.notes.ensureHydrated("u1");
    h.env.online = false;
    h.mods.notes.apply("u1", [{ kind: "items", doc: note("n2") }]);
    h.mods.notes.clearLocal("u1");

    h.env.online = true;
    expect(h.mods.notes.getSnapshot("u1").ready).toBe(false);
    await h.mods.notes.ensureHydrated("u1");
    expect(ids(h).sort()).toEqual(["n1", "n2"]);
  });

  test("uid yokken boş, sabit görünüm döner", () => {
    const h = boot();
    const a = h.mods.notes.getSnapshot(null);
    expect(a.lists.items).toEqual([]);
    expect(h.mods.notes.getSnapshot(null)).toBe(a);
  });

  test("silinen durum yeni hesabın verisine sızmaz", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    await h.mods.notes.ensureHydrated("u1");
    h.mods.notes.clearLocal("u1");
    expect(h.mods.notes.getSnapshot("u2").lists.items).toEqual([]);
  });
});

describe("eski sürümden güncelleme (buluttan indirme YOK)", () => {
  test("eski önbellek konumundaki notlar tohum olarak kabul edilir", async () => {
    const h = boot();
    // Eski sürüm: <cache>/datacache/notes/ altına dizi yazmıştı. Aynı dosyayı
    // kalıcı konumda üretip eski konuma taşıyarak o durumu kuruyoruz.
    h.mods.cacheStore.setJSON(...h.mods.cacheKeys.notes("u1"), [note("n1"), note("n2")]);
    const fs = require("expo-file-system");
    for (const yol of [...fs.__files.keys()]) {
      const hedef = yol.replace("/document/userdata/", "/cache/datacache/");
      new fs.Directory(hedef.slice(0, hedef.lastIndexOf("/"))).create({ intermediates: true });
      fs.__files.set(hedef, fs.__files.get(yol));
      fs.__files.delete(yol);
    }
    h.restart();
    h.remote.calls.fetchCollection.length = 0;

    // İlk karede cache'ten, ağ BEKLEMEDEN dolu
    const view = h.mods.notes.getSnapshot("u1");
    expect(view.ready).toBe(true);
    expect(view.lists.items.map((n) => n.id).sort()).toEqual(["n1", "n2"]);
    expect(h.remote.reads()).toBe(0);
  });
});

describe("güncellemeden gelen (işaretsiz) kopya: bir kez doğrulanır", () => {
  // Eski sürümün dinleyici dönemi önbelleğini kurar: işaret YOK.
  const eskiOnbellek = (h, notes) => {
    h.mods.cacheStore.setJSON(...h.mods.cacheKeys.notes("u1"), notes);
    h.restart();
  };

  test("kopya ANINDA gösterilir, arka planda bir kez buluttan doğrulanır", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1"), note("n2")]);
    eskiOnbellek(h, [note("n1"), note("n2")]);

    const view = h.mods.notes.getSnapshot("u1");
    expect(view.ready).toBe(true); // ilk karede dolu, skeleton yok
    expect(h.remote.reads()).toBe(0);

    const dogrulama = h.mods.notes.ensureHydrated("u1");
    // doğrulama sürerken bile hazır görünür (kullanıcı yükleme ekranı görmez)
    expect(h.mods.notes.getSnapshot("u1")).toMatchObject({ ready: true, hydrating: true });
    await dogrulama;
    expect(h.remote.calls.fetchCollection).toEqual(["Notes/u1/items"]);
  });

  test("EKSİK eski önbellek buluttaki tam veriyle tamamlanır (kısmi yazım hatası)", async () => {
    const h = boot();
    // bulutta 3 not var; eski sürüm uygulama kapanırken yalnız 1'ini yazabilmişti
    seedNotes(h, "u1", [note("n1"), note("n2"), note("n3")]);
    eskiOnbellek(h, [note("n1")]);
    expect(ids(h)).toEqual(["n1"]);

    await h.mods.notes.ensureHydrated("u1");
    expect(ids(h).sort()).toEqual(["n1", "n2", "n3"]);
  });

  test("doğrulamadan sonra yeniden açılış: SIFIR okuma (tek seferlik)", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    eskiOnbellek(h, [note("n1")]);
    await h.mods.notes.ensureHydrated("u1");

    h.restart();
    h.remote.calls.fetchCollection.length = 0;
    await h.mods.notes.ensureHydrated("u1");
    expect(h.remote.reads()).toBe(0);
  });

  test("çevrimdışıyken kopya gösterilir; internet gelince doğrulanır", async () => {
    const h = boot({ online: false });
    seedNotes(h, "u1", [note("n1"), note("n2")]);
    eskiOnbellek(h, [note("n1")]);

    expect(await h.mods.notes.ensureHydrated("u1")).toBe(true); // hazır (cache)
    expect(h.remote.reads()).toBe(0);
    expect(ids(h)).toEqual(["n1"]);

    h.env.online = true;
    await h.mods.notes.ensureHydrated("u1");
    expect(ids(h).sort()).toEqual(["n1", "n2"]);
  });

  test("doğrulama bekleyen yerel değişiklikleri EZMEZ", async () => {
    const h = boot({ online: false });
    seedNotes(h, "u1", [note("n1")]);
    eskiOnbellek(h, [note("n1")]);
    h.mods.notes.apply("u1", [{ kind: "items", doc: note("yerel") }]); // gitmedi

    h.env.online = true;
    await h.mods.notes.ensureHydrated("u1");
    expect(ids(h).sort()).toEqual(["n1", "yerel"]);
  });

  test("alan sürümü yükselirse herkes bir kez daha doğrulanır", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    await h.mods.notes.ensureHydrated("u1");
    h.restart();
    h.remote.calls.fetchCollection.length = 0;
    await h.mods.notes.ensureHydrated("u1");
    expect(h.remote.reads()).toBe(0);

    // veri modeli değişti → sürüm 2
    h.restart();
    const { createUserDataDomain } = require("../services/userData/createDomain");
    const deps = {
      snapshot: h.mods.snapshot,
      outbox: h.mods.outbox,
      remote: h.remote,
      requestFlush: () => {},
      canFetch: () => true,
      marker: h.mods.marker,
    };
    const v2 = createUserDataDomain({ ...h.mods.domains.notesSpec, version: 2 }, deps);
    expect(v2.getSnapshot("u1").ready).toBe(true); // kopya yine anında
    await v2.ensureHydrated("u1");
    expect(h.remote.calls.fetchCollection).toEqual(["Notes/u1/items"]);
  });

  test("çıkış işareti de siler: aynı hesapla dönünce kopya yok → indirir", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    await h.mods.notes.ensureHydrated("u1");
    expect(h.mods.marker.get("u1", "notes")).toBe(1);
    h.mods.notes.clearLocal("u1");
    expect(h.mods.marker.get("u1", "notes")).toBeNull();
  });
});

describe("eski şema göçü (Notes/{uid}.notes[])", () => {
  test("alt koleksiyon boşsa eski diziyi bulur, taşır ve gösterir", async () => {
    const h = boot();
    h.remote.seed("Notes/u1", { notes: [note("n1"), note("n2")] });
    await h.mods.notes.ensureHydrated("u1");

    expect(ids(h).sort()).toEqual(["n1", "n2"]);
    expect(h.remote.db.has("Notes/u1/items/n1")).toBe(true); // taşındı
  });

  test("alt koleksiyon doluysa eski belgeye BAKILMAZ", async () => {
    const h = boot();
    seedNotes(h, "u1", [note("n1")]);
    await h.mods.notes.ensureHydrated("u1");
    expect(h.remote.calls.fetchDoc).toHaveLength(0);
  });
});

describe("medya notları", () => {
  test("ayrı alan, ayrı yol, updatedAt azalan", async () => {
    const h = boot();
    h.remote.seed("MediaNotes/u1/items/movie_1", { id: "movie_1", type: "movie", updatedAt: 1 });
    h.remote.seed("MediaNotes/u1/items/tv_2", { id: "tv_2", type: "tv", updatedAt: 9 });
    await h.mods.mediaNotes.ensureHydrated("u1");
    expect(h.mods.mediaNotes.getSnapshot("u1").lists.items.map((n) => n.id)).toEqual([
      "tv_2",
      "movie_1",
    ]);

    h.mods.worker.start("u1");
    h.mods.mediaNotes.apply("u1", [
      { kind: "items", doc: { id: "movie_5", type: "movie", updatedAt: 5 } },
    ]);
    await jest.advanceTimersByTimeAsync(500);
    expect(h.remote.db.has("MediaNotes/u1/items/movie_5")).toBe(true);
  });
});
