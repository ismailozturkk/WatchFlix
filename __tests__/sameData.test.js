// __tests__/sameData.test.js
// Onbellekten gosterilip arka planda tazelenen her yuzeyin dayandigi
// "gercekten degisti mi?" karsilastirmalari.

const {
  listIdentity,
  sameJson,
  sameListIdentity,
  setIfChanged,
  setListIfChanged,
} = require("../utils/sameData");

describe("sameJson", () => {
  test("derin esit nesneleri ayni sayar", () => {
    expect(sameJson({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toBe(true);
  });

  test("farkli degeri yakalar", () => {
    expect(sameJson({ a: 1 }, { a: 2 })).toBe(false);
  });

  test("null / undefined guvenli", () => {
    expect(sameJson(null, null)).toBe(true);
    expect(sameJson(undefined, undefined)).toBe(true);
    expect(sameJson(null, undefined)).toBe(false);
  });
});

describe("setIfChanged", () => {
  // BU TESTIN VARLIK SEBEBI: ayni diziyi yeni referansla set etmek React'ta
  // yeniden cizim demek. Onbellekten gosterip arka planda tazeleyen bir rayda
  // agdan AYNI veri gelince ekran titrerdi.
  test("ayni veride ONCEKI REFERANSI korur", () => {
    const onceki = [{ id: 1 }];
    let state = onceki;
    setIfChanged((fn) => {
      state = fn(state);
    }, [{ id: 1 }]);
    expect(state).toBe(onceki);
  });

  test("degisen veride yeni referansi yazar", () => {
    const onceki = [{ id: 1 }];
    const sonraki = [{ id: 2 }];
    let state = onceki;
    setIfChanged((fn) => {
      state = fn(state);
    }, sonraki);
    expect(state).toBe(sonraki);
  });
});

describe("listIdentity", () => {
  test("kimlik ve SIRA parmak izi uretir", () => {
    expect(listIdentity([{ id: 1 }, { id: 2 }])).toBe("1,2,");
    expect(listIdentity([{ id: 2 }, { id: 1 }])).not.toBe(listIdentity([{ id: 1 }, { id: 2 }]));
  });

  test("dizi olmayan girdi bos parmak izi verir", () => {
    expect(listIdentity(null)).toBe("");
    expect(listIdentity(undefined)).toBe("");
    expect(listIdentity({})).toBe("");
  });

  test("kimligi olmayan eleman ayirt edilebilir kalir", () => {
    expect(listIdentity([{}, { id: 3 }])).toBe("?,3,");
    expect(listIdentity([null, { id: 3 }])).toBe("?,3,");
  });

  test("ozel kimlik alani desteklenir", () => {
    expect(listIdentity([{ uuid: "a" }, { uuid: "b" }], "uuid")).toBe("a,b,");
  });
});

describe("sameListIdentity", () => {
  // ASIL KAZANC: TMDB ayni listeyi her istekte biraz farkli `popularity`
  // ondaligiyla donduruyor. sameJson bunu "degisti" sayar ve hicbir kullanici
  // farki olmadan tum ray yeniden cizilir.
  test("yalniz alan degerleri degistiyse AYNI sayar", () => {
    const a = [{ id: 1, popularity: 12.345 }, { id: 2, popularity: 9.1 }];
    const b = [{ id: 1, popularity: 12.361 }, { id: 2, popularity: 9.4 }];
    expect(sameListIdentity(a, b)).toBe(true);
    expect(sameJson(a, b)).toBe(false); // eski davranis fark gorurdu
  });

  test("yeni eleman girince FARKLI sayar", () => {
    expect(sameListIdentity([{ id: 1 }], [{ id: 1 }, { id: 2 }])).toBe(false);
  });

  test("sira degisince FARKLI sayar", () => {
    expect(sameListIdentity([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 1 }])).toBe(false);
  });
});

describe("setListIfChanged", () => {
  test("alan guncellemesi yeniden cizim tetiklemez", () => {
    const onceki = [{ id: 1, vote_average: 8.1 }];
    let state = onceki;
    setListIfChanged((fn) => {
      state = fn(state);
    }, [{ id: 1, vote_average: 8.3 }]);
    expect(state).toBe(onceki);
  });

  test("icerik degisince yeni liste yazilir", () => {
    const sonraki = [{ id: 9 }];
    let state = [{ id: 1 }];
    setListIfChanged((fn) => {
      state = fn(state);
    }, sonraki);
    expect(state).toBe(sonraki);
  });
});
