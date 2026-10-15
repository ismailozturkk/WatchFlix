// __tests__/userDataOutbox.test.js
//
// Buluta henüz yazılmamış değişikliklerin kalıcı günlüğü.

const load = () => {
  jest.resetModules();
  require("expo-file-system").__reset();
  return {
    outbox: require("../services/userData/outbox"),
    storage: require("../services/storage"),
  };
};

const set = (path, data = { v: 1 }, extra = {}) => ({ path, op: "set", data, ...extra });

describe("kalıcılık", () => {
  test("işlem süreç ölümünden sonra da durur", () => {
    const { outbox } = load();
    outbox.enqueue("u1", [set("Notes/u1/items/a", { id: "a" })]);

    outbox.__resetMemory(); // süreç öldü; MMKV kaldı
    expect(outbox.peek("u1")).toHaveLength(1);
    expect(outbox.peek("u1")[0].data).toEqual({ id: "a" });
  });

  test("kimlikler süreç ölümünden sonra da artar (çakışmaz)", () => {
    const { outbox } = load();
    outbox.enqueue("u1", [set("p/a")]);
    outbox.__resetMemory();
    const [yeni] = outbox.enqueue("u1", [set("p/b")]);
    const idler = outbox.peek("u1").map((op) => Number(op.id));
    expect(new Set(idler).size).toBe(idler.length);
    expect(Number(yeni.id)).toBeGreaterThan(1);
  });

  test("kullanıcılar birbirinin günlüğünü görmez", () => {
    const { outbox } = load();
    outbox.enqueue("u1", [set("p/a")]);
    expect(outbox.peek("u2")).toHaveLength(0);
  });

  test("boşalınca MMKV anahtarı bırakılmaz", () => {
    const { outbox, storage } = load();
    const [op] = outbox.enqueue("u1", [set("p/a")]);
    outbox.ack("u1", [op.id]);
    expect(storage.has(storage.Keys.syncOutbox, { uid: "u1" })).toBe(false);
  });

  test("geçersiz işlemler yok sayılır", () => {
    const { outbox } = load();
    expect(outbox.enqueue("u1", [{ path: "", op: "set" }, { path: "p", op: "boom" }])).toEqual([]);
    expect(outbox.peek("u1")).toHaveLength(0);
  });
});

describe("birleştirme (aynı belge → tek yazma)", () => {
  test("aynı yola ardışık işlemde SON durum kalır", () => {
    const { outbox } = load();
    outbox.enqueue("u1", [set("p/a", { v: 1 })]);
    outbox.enqueue("u1", [set("p/a", { v: 2 })]);
    outbox.enqueue("u1", [set("p/a", { v: 3 })]);
    const ops = outbox.peek("u1");
    expect(ops).toHaveLength(1);
    expect(ops[0].data).toEqual({ v: 3 });
  });

  test("ekle sonra sil → tek 'delete'", () => {
    const { outbox } = load();
    outbox.enqueue("u1", [set("p/a")]);
    outbox.enqueue("u1", [{ path: "p/a", op: "delete" }]);
    const ops = outbox.peek("u1");
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe("delete");
  });

  test("farklı yollar birleşmez", () => {
    const { outbox } = load();
    outbox.enqueue("u1", [set("p/a"), set("p/b")]);
    expect(outbox.peek("u1")).toHaveLength(2);
  });

  test("UÇUŞTAKİ işlem ezilmez; yenisi arkasına eklenir", () => {
    const { outbox } = load();
    const [eski] = outbox.enqueue("u1", [set("p/a", { v: 1 })]);
    outbox.markInflight("u1", [eski.id]);

    outbox.enqueue("u1", [set("p/a", { v: 2 })]);

    // uçuştaki zaten SDK'ya verildi → günlükte ikisi de var, peek yalnız yeniyi verir
    expect(outbox.counts("u1").pending).toBe(2);
    const bekleyen = outbox.peek("u1");
    expect(bekleyen).toHaveLength(1);
    expect(bekleyen[0].data).toEqual({ v: 2 });
  });
});

describe("onay / başarısızlık", () => {
  test("ack yalnız verilen kimlikleri siler", () => {
    const { outbox } = load();
    const [a, b] = outbox.enqueue("u1", [set("p/a"), set("p/b")]);
    outbox.ack("u1", [a.id]);
    expect(outbox.peek("u1").map((op) => op.id)).toEqual([b.id]);
  });

  test("ölü işlem gönderilmez ama günlükte KALIR ve yerel bindirmeye girer", () => {
    const { outbox } = load();
    const [op] = outbox.enqueue("u1", [
      set("Notes/u1/items/a", { id: "a" }, { domain: "notes", kind: "items", key: "a" }),
    ]);
    outbox.recordFailure("u1", [op.id], { dead: "invalid-argument" });

    expect(outbox.peek("u1")).toHaveLength(0);
    expect(outbox.counts("u1")).toEqual({ pending: 0, dead: 1 });
    // yerel kopya bu belgeyi içeriyor: kurtarmada kaybolmamalı
    expect(outbox.overlayOps("u1", "notes")).toHaveLength(1);
  });

  test("reviveDead ölüleri yeniden denenebilir yapar", () => {
    const { outbox } = load();
    const [op] = outbox.enqueue("u1", [set("p/a")]);
    outbox.recordFailure("u1", [op.id], { dead: "x" });
    expect(outbox.reviveDead("u1")).toBe(1);
    expect(outbox.peek("u1")).toHaveLength(1);
    expect(outbox.peek("u1")[0].tries).toBe(0);
  });

  test("overlayOps yalnız o alanın, yerelde karşılığı olan işlemlerini verir", () => {
    const { outbox } = load();
    outbox.enqueue("u1", [
      set("Notes/u1/items/a", {}, { domain: "notes", kind: "items", key: "a" }),
      set("MediaNotes/u1/items/b", {}, { domain: "mediaNotes", kind: "items", key: "b" }),
      set("Reminders/u1/tvShows/9", {}), // yalnız uzak yan yazım
    ]);
    expect(outbox.overlayOps("u1", "notes")).toHaveLength(1);
    expect(outbox.overlayOps("u1", "mediaNotes")).toHaveLength(1);
  });
});

describe("çıkış", () => {
  test("clearUserScope günlüğü SİLMEZ (onaysız değişiklik kaybolmasın)", () => {
    const { outbox, storage } = load();
    outbox.enqueue("u1", [set("p/a")]);
    storage.clearUserScope("u1");
    outbox.__resetMemory();
    expect(outbox.peek("u1")).toHaveLength(1);
  });

  test("clear (hesap silme) günlüğü siler", () => {
    const { outbox } = load();
    outbox.enqueue("u1", [set("p/a")]);
    outbox.clear("u1");
    outbox.__resetMemory();
    expect(outbox.peek("u1")).toHaveLength(0);
  });
});
