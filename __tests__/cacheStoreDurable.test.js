// __tests__/cacheStoreDurable.test.js
//
// Kullanıcının kendi verisi (notlar, hatırlatıcılar, listeler…) sistemin
// silebileceği önbellek klasöründe DEĞİL, belge dizininde durur. Eski konumdaki
// kayıtlar güncellemede buluttan yeniden indirilmeden taşınır.

const load = () => {
  jest.resetModules();
  const fs = require("expo-file-system");
  fs.__reset();
  return { fs, cacheStore: require("../utils/cacheStore") };
};

const yollar = (fs) => [...fs.__files.keys()];

describe("kalıcı ad alanları", () => {
  test("notlar belge dizinine, TMDB önbelleği cache dizinine yazılır", () => {
    const { fs, cacheStore } = load();
    cacheStore.setJSON("notes", "u1", [{ id: "n1" }]);
    cacheStore.setJSON("tmdb", "https://x", { a: 1 });

    const p = yollar(fs);
    expect(p.some((x) => x.startsWith("/document/userdata/notes/"))).toBe(true);
    expect(p.some((x) => x.startsWith("/cache/datacache/tmdb/"))).toBe(true);
    expect(p.some((x) => x.startsWith("/cache/datacache/notes/"))).toBe(false);
  });

  test("profil/aktivite kalıcı DEĞİL (başkalarının yazımıyla değişir)", () => {
    const { cacheStore } = load();
    expect(cacheStore.isDurableNamespace("profile")).toBe(false);
    expect(cacheStore.isDurableNamespace("activity")).toBe(false);
    for (const ns of ["notes", "mediaNotes", "aiConversations", "reminders", "lists"]) {
      expect(cacheStore.isDurableNamespace(ns)).toBe(true);
    }
  });

  test("okuma-yazma aynı API ile çalışır", () => {
    const { cacheStore } = load();
    cacheStore.setJSON("reminders", "u1:movies", [{ movieId: 1 }]);
    expect(cacheStore.getJSON("reminders", "u1:movies")).toEqual([{ movieId: 1 }]);
  });
});

describe("önbelleği temizle kullanıcı verisini SİLMEZ", () => {
  test("clearAll yalnız önbellek klasörünü siler", () => {
    const { cacheStore } = load();
    cacheStore.setJSON("notes", "u1", [{ id: "n1" }]);
    cacheStore.setJSON("lists", "u1:root", { a: 1 });
    cacheStore.setJSON("tmdb", "k", { x: 1 });

    cacheStore.clearAll();

    expect(cacheStore.getJSON("tmdb", "k")).toBeNull();
    expect(cacheStore.getJSON("notes", "u1")).toEqual([{ id: "n1" }]);
    expect(cacheStore.getJSON("lists", "u1:root")).toEqual({ a: 1 });
  });

  test("clearAllDurable kullanıcı verisini siler, önbelleğe dokunmaz", () => {
    const { cacheStore } = load();
    cacheStore.setJSON("notes", "u1", [{ id: "n1" }]);
    cacheStore.setJSON("tmdb", "k", { x: 1 });
    cacheStore.clearAllDurable();
    expect(cacheStore.getJSON("notes", "u1")).toBeNull();
    expect(cacheStore.getJSON("tmdb", "k")).toEqual({ x: 1 });
  });
});

describe("eski konumdan taşıma (güncelleme buluttan indirme tetiklemez)", () => {
  // Eski sürüm kayıtları <cache>/datacache/<ns>/ altına yazıyordu.
  const eskiKonumaTasi = (fs) => {
    for (const yol of yollar(fs)) {
      if (!yol.startsWith("/document/userdata/")) continue;
      const hedef = yol.replace("/document/userdata/", "/cache/datacache/");
      // Gerçek dosya sisteminde dosyanın dizini de vardır; mock'ta açıkça kur.
      new fs.Directory(hedef.slice(0, hedef.lastIndexOf("/"))).create({ intermediates: true });
      fs.__files.set(hedef, fs.__files.get(yol));
      fs.__files.delete(yol);
    }
  };

  test("eski konumdaki kayıt okunur, kalıcı konuma taşınır, eskisi silinir", () => {
    const { fs, cacheStore } = load();
    cacheStore.setJSON("notes", "u1", [{ id: "eski" }]);
    eskiKonumaTasi(fs);
    expect(yollar(fs).every((p) => p.startsWith("/cache/datacache/"))).toBe(true);

    expect(cacheStore.getJSON("notes", "u1")).toEqual([{ id: "eski" }]);

    const p = yollar(fs);
    expect(p.some((x) => x.startsWith("/document/userdata/notes/"))).toBe(true);
    expect(p.some((x) => x.startsWith("/cache/datacache/notes/"))).toBe(false);
  });

  test("zaman damgası korunur (yaş yeniden sıfırlanmaz)", () => {
    const { fs, cacheStore } = load();
    cacheStore.setJSON("notes", "u1", []);
    eskiKonumaTasi(fs);
    // dosyanın içindeki t'yi eskit
    const [yol] = yollar(fs);
    const kayit = JSON.parse(fs.__files.get(yol));
    kayit.t = Date.now() - 5 * 60 * 1000;
    fs.__files.set(yol, JSON.stringify(kayit));

    expect(cacheStore.getAge("notes", "u1")).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });

  test("yeni yazım eski konumdaki bayat kopyayı siler", () => {
    const { fs, cacheStore } = load();
    cacheStore.setJSON("notes", "u1", [{ id: "v1" }]);
    eskiKonumaTasi(fs);
    cacheStore.setJSON("notes", "u1", [{ id: "v2" }]);

    expect(yollar(fs).some((p) => p.startsWith("/cache/datacache/notes/"))).toBe(false);
    expect(cacheStore.getJSON("notes", "u1")).toEqual([{ id: "v2" }]);
  });

  test("remove ve clearNamespace her iki konumu da temizler", () => {
    const { fs, cacheStore } = load();
    cacheStore.setJSON("notes", "u1", [1]);
    eskiKonumaTasi(fs);
    cacheStore.remove("notes", "u1");
    expect(yollar(fs)).toHaveLength(0);

    cacheStore.setJSON("notes", "u2", [1]);
    eskiKonumaTasi(fs);
    cacheStore.clearNamespace("notes");
    expect(yollar(fs)).toHaveLength(0);
  });

  test("bozuk JSON 'kayıt yok' sayılır (çökmez)", () => {
    const { fs, cacheStore } = load();
    cacheStore.setJSON("notes", "u1", [1]);
    const [yol] = yollar(fs);
    fs.__files.set(yol, "{bozuk");
    expect(cacheStore.getJSON("notes", "u1")).toBeNull();
  });
});
