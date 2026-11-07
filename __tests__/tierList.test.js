// Tier list saf çekirdeği (utils/tierList.js) + sohbet gövdesi (utils/chatShare tierList türü).
const {
  POOL,
  TIER_LIMITS,
  addMedia,
  addTier,
  createTierList,
  deleteTierList,
  duplicateTierList,
  locateMedia,
  moveTier,
  normalizeTierList,
  normalizeTierState,
  pickerItemsOf,
  placeMedia,
  removeMedia,
  removeTier,
  renameTierList,
  shiftMedia,
  tierInkOf,
  tierListCounts,
  tierListFromShare,
  tierListShareView,
  tierMediaOf,
  toStoredTierState,
  updateTier,
  upsertTierList,
} = require("../utils/tierList");
const {
  MAX_TIER_SHARE_ITEMS,
  MAX_TIER_SHARE_TIERS,
  buildShareMessage,
  buildTierListShare,
  readShare,
  shareThumb,
} = require("../utils/chatShare");
const { TIER_LIST_COPY, templateLabelsOf } = require("../utils/tierListCopy");

const movie = (id, extra = {}) => ({ id, media_type: "movie", title: `Film ${id}`, poster_path: `/p${id}.jpg`, ...extra });
const tv = (id) => ({ id, type: "tv", name: `Dizi ${id}`, imagePath: `/t${id}.jpg` });

const fresh = (template = "classic") =>
  createTierList({ id: "tl1", title: "  Benim   listem ", template, labels: templateLabelsOf(TIER_LIST_COPY.tr, template), now: 1 });

const withItems = (n = 3) => addMedia(fresh(), Array.from({ length: n }, (_, i) => movie(i + 1)), 2).list;

describe("oluşturma", () => {
  test("şablon kademeleri o dilin etiketleriyle, başlık sıkıştırılır", () => {
    const list = fresh("vibe");
    expect(list.title).toBe("Benim listem");
    expect(list.tiers.map((t) => t.label)).toEqual(["Zirve", "Efsane", "Harika", "Hafife alınan", "Abartılan", "Çöp"]);
    expect(list.tiers.map((t) => t.id)).toEqual(["t0", "t1", "t2", "t3", "t4", "t5"]);
    expect(list.pool).toEqual([]);
  });

  test("bilinmeyen şablon klasiğe düşer; eksik etiket sıra numarası olur", () => {
    const list = createTierList({ id: "x", template: "yok", labels: ["S"], now: 1 });
    expect(list.template).toBe("classic");
    expect(list.tiers.map((t) => t.label)).toEqual(["S", "2", "3", "4", "5", "6"]);
  });

  test("her dilde her şablonun etiket sayısı renk sayısıyla aynı", () => {
    for (const copy of Object.values(TIER_LIST_COPY)) {
      for (const template of ["classic", "vibe", "stars", "rewatch", "blank"]) {
        const list = createTierList({ id: "x", template, labels: templateLabelsOf(copy, template), now: 1 });
        expect(list.tiers.every((t, i) => t.label === templateLabelsOf(copy, template)[i])).toBe(true);
      }
    }
  });
});

describe("yapım ekleme", () => {
  test("farklı biçimler tek şekle iner; kişi ve kimliksiz kayıt düşer", () => {
    expect(tierMediaOf(tv(5))).toEqual({ id: 5, media_type: "tv", title: "Dizi 5", poster_path: "/t5.jpg" });
    expect(tierMediaOf({ id: 3, media_type: "person", name: "Biri" })).toBeNull();
    expect(tierMediaOf({ title: "Kimliksiz" })).toBeNull();
    expect(tierMediaOf(movie(9, { release_date: "1999-03-31" })).year).toBe("1999");
    expect(tierMediaOf(movie(9, { poster_path: "javascript:x" })).poster_path).toBeUndefined();
  });

  test("havuzun sonuna eklenir, tabloda olan atlanır", () => {
    const { list, added } = addMedia(fresh(), [movie(1), movie(2), movie(1)], 5);
    expect(added).toBe(2);
    expect(list.pool).toEqual(["movie_1", "movie_2"]);
    expect(list.updatedAt).toBe(5);
    const again = addMedia(list, [movie(2)], 6);
    expect(again.added).toBe(0);
    expect(again.list).toBe(list);
  });

  test("100 tavanı: fazlası eklenmez ve sayılır", () => {
    const many = Array.from({ length: TIER_LIMITS.items + 5 }, (_, i) => movie(i + 1));
    const { list, added, full } = addMedia(fresh(), many, 2);
    expect(added).toBe(TIER_LIMITS.items);
    expect(full).toBe(5);
    expect(tierListCounts(list).total).toBe(TIER_LIMITS.items);
  });
});

describe("yerleştirme", () => {
  test("kademenin sonuna, sonra bir afişin önüne", () => {
    let list = withItems(3);
    list = placeMedia(list, "movie_1", "t0", null, 3);
    list = placeMedia(list, "movie_2", "t0", null, 4);
    list = placeMedia(list, "movie_3", "t0", "movie_1", 5);
    expect(list.tiers[0].items).toEqual(["movie_3", "movie_1", "movie_2"]);
    expect(list.pool).toEqual([]);
    expect(locateMedia(list, "movie_1")).toEqual({ target: "t0", index: 1 });
  });

  test("başka kademeye taşınınca eski yerinden çıkar; havuza geri döner", () => {
    let list = placeMedia(withItems(2), "movie_1", "t0", null, 3);
    list = placeMedia(list, "movie_1", "t3", null, 4);
    expect(list.tiers[0].items).toEqual([]);
    expect(list.tiers[3].items).toEqual(["movie_1"]);
    list = placeMedia(list, "movie_1", POOL, "movie_2", 5);
    expect(list.pool).toEqual(["movie_1", "movie_2"]);
  });

  test("sonuç değişmiyorsa aynı nesne (gereksiz yazım yok)", () => {
    const list = placeMedia(withItems(2), "movie_1", "t0", null, 3);
    expect(placeMedia(list, "movie_1", "t0", null, 9)).toBe(list);
    expect(placeMedia(list, "movie_1", "yok", null, 9)).toBe(list);
    expect(placeMedia(list, "movie_99", "t0", null, 9)).toBe(list);
  });

  test("öne / arkaya kaydırma uçlarda durur", () => {
    let list = withItems(3);
    list = shiftMedia(list, "movie_2", -1, 3);
    expect(list.pool).toEqual(["movie_2", "movie_1", "movie_3"]);
    expect(shiftMedia(list, "movie_2", -1, 4)).toBe(list);
    expect(shiftMedia(list, "movie_3", 1, 4)).toBe(list);
  });

  test("tablodan çıkarma yapımı sözlükten de siler", () => {
    let list = placeMedia(withItems(2), "movie_1", "t1", null, 3);
    list = removeMedia(list, "movie_1", 4);
    expect(list.media.movie_1).toBeUndefined();
    expect(list.tiers[1].items).toEqual([]);
    expect(tierListCounts(list)).toEqual({ ranked: 0, pool: 1, total: 1, tiers: 6 });
  });
});

describe("kademeler", () => {
  test("ad ve renk; boş ad ve geçersiz renk eskisini korur", () => {
    let list = updateTier(fresh(), "t0", { label: "  Efsane  ", color: "#7fbfff" }, 2);
    expect(list.tiers[0]).toMatchObject({ label: "Efsane", color: "#7FBFFF" });
    const same = updateTier(list, "t0", { label: "   ", color: "kırmızı" }, 3);
    expect(same).toBe(list);
  });

  test("altına ekleme kullanılmayan renk ve çakışmayan kimlik alır; tavan 10", () => {
    let list = addTier(fresh(), { afterId: "t0" }, 2);
    expect(list.tiers.map((t) => t.id)).toEqual(["t0", "t6", "t1", "t2", "t3", "t4", "t5"]);
    expect(fresh().tiers.map((t) => t.color)).not.toContain(list.tiers[1].color);
    while (list.tiers.length < TIER_LIMITS.tiers) list = addTier(list, {}, 3);
    expect(addTier(list, {}, 4)).toBe(list);
  });

  test("silinen kademenin yapımları havuzun başına döner; en az iki kademe kalır", () => {
    let list = placeMedia(withItems(2), "movie_2", "t1", null, 3);
    list = removeTier(list, "t1", 4);
    expect(list.tiers.map((t) => t.id)).not.toContain("t1");
    expect(list.pool).toEqual(["movie_2", "movie_1"]);
    let small = fresh("blank");
    small = removeTier(small, "t2", 5);
    expect(removeTier(small, "t1", 6)).toBe(small);
  });

  test("yukarı / aşağı taşıma", () => {
    const list = moveTier(fresh(), "t1", -1, 2);
    expect(list.tiers.map((t) => t.id).slice(0, 2)).toEqual(["t1", "t0"]);
    expect(moveTier(list, "t1", -1, 3)).toBe(list);
  });

  test("etiket yazı rengi zemine göre okunur", () => {
    expect(tierInkOf("#FFFF7F")).toBe("#1A1A1A");
    expect(tierInkOf("#1A1A80")).toBe("#FFFFFF");
  });
});

describe("kayıt", () => {
  test("bozuk kayıt temizlenir: yinelenen yapım tek yerde, bilinmeyen anahtar düşer, sahipsiz yapım havuza", () => {
    const list = normalizeTierList({
      id: "a",
      title: 42,
      template: "stars",
      createdAt: 10,
      updatedAt: 20,
      tiers: [{ id: "t0", label: "", color: "mavi", items: ["movie_1", "movie_1", "movie_9"] }, null, { id: "t0", label: "B", items: ["movie_1", "tv_2"] }],
      pool: ["tv_2"],
      media: { movie_1: movie(1), tv_2: tv(2), movie_3: movie(3), "movie_4": movie(5) },
    });
    expect(list.title).toBe("");
    expect(list.tiers).toHaveLength(2);
    expect(list.tiers[0]).toMatchObject({ id: "t0", label: "1", items: ["movie_1"] });
    expect(list.tiers[1].id).not.toBe("t0");
    expect(list.tiers[1].items).toEqual(["tv_2"]);
    expect(list.pool).toEqual(["movie_3"]);
    expect(Object.keys(list.media).sort()).toEqual(["movie_1", "movie_3", "tv_2"]);
  });

  test("tek kademeli kayıt ikiye tamamlanır; kimliksiz kayıt düşer", () => {
    expect(normalizeTierList({ id: "a", tiers: [{ label: "S" }] }).tiers).toHaveLength(2);
    expect(normalizeTierList({ title: "kimliksiz" })).toBeNull();
  });

  test("durum: en son düzenlenen önce, yinelenen kimlik bir kez, boş durum silinir", () => {
    const state = normalizeTierState({
      lists: [
        { id: "a", updatedAt: 1, tiers: [] },
        { id: "b", updatedAt: 5, tiers: [] },
        { id: "a", updatedAt: 9, tiers: [] },
      ],
    });
    expect(state.lists.map((l) => l.id)).toEqual(["b", "a"]);
    expect(toStoredTierState(deleteTierList(deleteTierList(state, "a"), "b"))).toBeNull();
  });

  test("ekle / kopyala: kopya bağımsız", () => {
    const list = placeMedia(withItems(1), "movie_1", "t0", null, 3);
    const copy = duplicateTierList(list, { id: "tl2", title: "Kopya", now: 9 });
    const state = upsertTierList(upsertTierList({ lists: [] }, list), copy);
    expect(state.lists.map((l) => l.id)).toEqual(["tl2", "tl1"]);
    copy.tiers[0].items.push("x");
    expect(list.tiers[0].items).toEqual(["movie_1"]);
    expect(renameTierList(list, "Benim listem", 4)).toBe(list);
  });

  test("içerik ekleme kaynağı: tekil, en son eklenen önce, tür alanı yoksa grup türü", () => {
    const items = pickerItemsOf(
      [
        [{ id: 1, name: "A", dateAdded: 100 }, { id: 2, name: "B", dateAdded: { seconds: 5 } }],
        [{ id: 1, name: "Dizi A", dateAdded: 300 }, { id: 1, name: "Dizi A", dateAdded: 1 }],
      ],
      ["movie", "tv"],
    );
    // Firestore zaman damgası ({ seconds }) milisaniyeye çevrilir: 5 sn > 300 ms.
    expect(items.map((i) => i.key)).toEqual(["movie_2", "tv_1", "movie_1"]);
  });
});

describe("paylaşım", () => {
  const ranked = () => {
    let list = withItems(3);
    list = placeMedia(list, "movie_1", "t0", null, 3);
    list = placeMedia(list, "movie_2", "t2", null, 4);
    return list;
  };

  test("görünüm yalnız yerleştirilmişleri taşır (havuz paylaşılmaz)", () => {
    const view = tierListShareView(ranked());
    expect(view.tiers).toHaveLength(6);
    expect(view.tiers[0].items.map((m) => m.id)).toEqual([1]);
    expect(view.tiers.flatMap((t) => t.items).map((m) => m.id)).not.toContain(3);
  });

  test("sohbet gövdesi: geçerli, önizleme 🏅 önekli, küçük resim ilk afiş", () => {
    const share = buildTierListShare({ ...tierListShareView(ranked()), host: "İsmail" });
    expect(share).toMatchObject({ type: "tierList", title: "Benim listem", total: 2, host: "İsmail" });
    const message = buildShareMessage(share);
    expect(message.kind).toBe("tierListShare");
    expect(message.text.startsWith("🏅")).toBe(true);
    expect(readShare(message)).toEqual(share);
    expect(shareThumb(share)).toBe("/p1.jpg");
    expect(readShare({ kind: "listShare", share })).toBeNull();
  });

  test("boş tablo gönderilmez; tavanlar ve renk/etiket temizliği", () => {
    expect(buildTierListShare(tierListShareView(fresh()))).toBeNull();
    const tiers = Array.from({ length: 14 }, (_, i) => ({
      label: i === 0 ? "" : `K${i}`.repeat(20),
      color: i === 1 ? "url(x)" : "#ff7f7f",
      items: Array.from({ length: 30 }, (_, j) => movie(i * 100 + j + 1)),
    }));
    const share = buildTierListShare({ title: "T", tiers });
    expect(share.tiers).toHaveLength(MAX_TIER_SHARE_TIERS);
    expect(share.total).toBe(MAX_TIER_SHARE_ITEMS);
    expect(share.tiers[0].label).toBe("1");
    expect(share.tiers[1].color).toBe("#CFCFCF");
    expect(share.tiers[2].color).toBe("#FF7F7F");
    expect(share.tiers[2].label.length).toBeLessThanOrEqual(24);
  });

  test("sohbet sınırları çekirdekle aynı", () => {
    expect(MAX_TIER_SHARE_TIERS).toBe(TIER_LIMITS.tiers);
    expect(MAX_TIER_SHARE_ITEMS).toBe(TIER_LIMITS.items);
  });

  test("gelen tablonun kopyası: kademeler ve sıra aynı, havuz boş", () => {
    const share = buildTierListShare(tierListShareView(ranked()));
    const copy = tierListFromShare(share, { id: "tl9", now: 50 });
    expect(copy.id).toBe("tl9");
    expect(copy.tiers.map((t) => t.label)).toEqual(["S", "A", "B", "C", "D", "F"]);
    expect(copy.tiers[0].items).toEqual(["movie_1"]);
    expect(copy.tiers[2].items).toEqual(["movie_2"]);
    expect(copy.pool).toEqual([]);
    expect(copy.updatedAt).toBe(50);
  });
});
