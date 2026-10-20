// Eski modeldeki özel liste (kök dizi) birleştirme planı: mevcut öğeler korunur.

const { planRootListMerge } = require("../utils/rootListMerge");

const item = (id, type = "movie") => ({ id, type, name: `x${id}` });

describe("planRootListMerge", () => {
  test("mevcut öğeler korunur, yeniler sona eklenir (aynı gün ikinci kayıt veriyi ezmez)", () => {
    const { merged, added } = planRootListMerge([item(1), item(2)], [item(3), item(4)]);
    expect(merged.map((i) => i.id)).toEqual([1, 2, 3, 4]);
    expect(added.map((i) => i.id)).toEqual([3, 4]);
  });

  test("listede olan öğe tekrar eklenmez", () => {
    const { merged, added } = planRootListMerge([item(1), item(2)], [item(2), item(3)]);
    expect(merged.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(added.map((i) => i.id)).toEqual([3]);
  });

  test("aynı numaralı film ve dizi ayrı öğedir", () => {
    const { merged, added } = planRootListMerge([item(7, "movie")], [item(7, "tv")]);
    expect(merged).toHaveLength(2);
    expect(added).toHaveLength(1);
  });

  test("gelen listedeki tekrarlar tek sayılır", () => {
    expect(planRootListMerge([], [item(1), item(1), item(2)]).added.map((i) => i.id)).toEqual([1, 2]);
  });

  test("tipsiz kayıt film sayılır", () => {
    const { added } = planRootListMerge([{ id: 1 }], [item(1, "movie")]);
    expect(added).toEqual([]);
  });

  test("bozuk girdilerde patlamaz", () => {
    expect(planRootListMerge(undefined, undefined)).toEqual({ merged: [], added: [] });
    expect(planRootListMerge([null, item(1)], [null, { type: "movie" }, item(2)]).merged.map((i) => i.id)).toEqual([1, 2]);
  });

  test("mevcut diziyi değiştirmez", () => {
    const current = [item(1)];
    planRootListMerge(current, [item(2)]);
    expect(current).toHaveLength(1);
  });
});
