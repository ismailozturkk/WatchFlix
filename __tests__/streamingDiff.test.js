const {
  extractRegionProviders,
  computeNewlyAvailable,
} = require("../functions/streamingDiff");

describe("extractRegionProviders", () => {
  const resp = {
    results: {
      TR: {
        flatrate: [
          { provider_id: 8, provider_name: "Netflix" },
          { provider_id: 337, provider_name: "Disney Plus" },
        ],
        rent: [{ provider_id: 2, provider_name: "Apple TV" }],
        buy: [{ provider_id: 2, provider_name: "Apple TV" }],
        free: [{ provider_id: 300, provider_name: "Tabii" }],
      },
      US: { flatrate: [{ provider_id: 15, provider_name: "Hulu" }] },
    },
  };

  test("bölgenin flatrate + free sağlayıcılarını verir (rent/buy hariç)", () => {
    const { ids, names } = extractRegionProviders(resp, "TR");
    expect(ids).toEqual([8, 300, 337]);
    expect(names[8]).toBe("Netflix");
    expect(names[300]).toBe("Tabii");
    expect(ids).not.toContain(2); // rent/buy hariç
  });

  test("bilinmeyen bölge veya boş yanıt → boş", () => {
    expect(extractRegionProviders(resp, "DE").ids).toEqual([]);
    expect(extractRegionProviders(null, "TR").ids).toEqual([]);
    expect(extractRegionProviders({ results: {} }, "TR").ids).toEqual([]);
  });
});

describe("computeNewlyAvailable", () => {
  test("ilk gözlem (hasPrev=false) → bildirim yok, baseline kaydedilir", () => {
    const r = computeNewlyAvailable({
      currentIds: [8, 337],
      subscribedIds: [8],
      hasPrev: false,
    });
    expect(r.toNotify).toEqual([]);
    expect(r.availableIds).toEqual([8, 337]);
  });

  test("abone olunan sağlayıcı yeni gelince bildirir", () => {
    const r = computeNewlyAvailable({
      prevIds: [337],
      currentIds: [8, 337],
      subscribedIds: [8, 119],
      notifiedIds: [],
      hasPrev: true,
    });
    expect(r.toNotify).toEqual([8]);
    expect(r.notifiedIds).toContain(8);
  });

  test("abone OLUNMAYAN sağlayıcı yeni gelse de bildirmez", () => {
    const r = computeNewlyAvailable({
      prevIds: [],
      currentIds: [900],
      subscribedIds: [8],
      notifiedIds: [],
      hasPrev: true,
    });
    expect(r.toNotify).toEqual([]);
  });

  test("zaten bildirilen sağlayıcı tekrar bildirilmez", () => {
    const r = computeNewlyAvailable({
      prevIds: [8],
      currentIds: [8],
      subscribedIds: [8],
      notifiedIds: [8],
      hasPrev: true,
    });
    expect(r.toNotify).toEqual([]);
    expect(r.notifiedIds).toEqual([8]); // hâlâ izlenebilir → notified'da kalır
  });

  test("sağlayıcı ayrılınca notified'dan düşer, tekrar gelince yeniden bildirir", () => {
    const gone = computeNewlyAvailable({
      prevIds: [8],
      currentIds: [],
      subscribedIds: [8],
      notifiedIds: [8],
      hasPrev: true,
    });
    expect(gone.notifiedIds).toEqual([]); // artık izlenebilir değil → düştü

    const back = computeNewlyAvailable({
      prevIds: [],
      currentIds: [8],
      subscribedIds: [8],
      notifiedIds: [],
      hasPrev: true,
    });
    expect(back.toNotify).toEqual([8]);
  });

  test("birden çok yeni sağlayıcı sıralı döner", () => {
    const r = computeNewlyAvailable({
      prevIds: [8],
      currentIds: [8, 119, 337],
      subscribedIds: [337, 119, 8],
      notifiedIds: [],
      hasPrev: true,
    });
    expect(r.toNotify).toEqual([119, 337]);
  });
});
