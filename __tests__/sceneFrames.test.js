// Dune, Vikings, Matrix, Spider-Man, Batman, Yüzüklerin Efendisi ve Harry Potter vektör sahnelerinin zaman çizelgeleri: saat, olay sırası, değer aralıkları, dinlenme.
import { KIND, OVERLAY, SPRITE, batFrame, buildParticles, duneFrame, hpFrame, lotrFrame, matrixFrame, solarFrame, spiderFrame, vikFrame } from "../utils/weatherParticles";
import { buildWormTrack, duneLayout } from "../components/decor/duneScene";

// duneScene bileşen modülü; yalnız saf yol hesabı (buildWormTrack) sınanıyor
jest.mock("react-native-reanimated", () => ({ useDerivedValue: () => ({ value: 0 }) }));
jest.mock("@shopify/react-native-skia", () => ({ Skia: { Path: { Make: () => ({}) } }, vec: (x, y) => ({ x, y }) }));

const layerOf = (id, part) => buildParticles(id, { count: 60, seed: 5 }).find((q) => q.kind === KIND.overlay && q.part === part);

const tAt = (p, u) => {
  // çift döngü = olay A (tek döngülerde sahnenin olay B'si oynar: eventU)
  return (4 + u / p.rest - p.y0) * p.period;
};

const first = (p, frame, pred) => {
  for (let u = 0; u <= 1; u += 0.001) if (pred(frame(p, tAt(p, u)))) return u;
  return 2;
};

const finite = (p, frame, windows = [], signed = []) => {
  for (let u = 0; u <= 1; u += 0.0025) {
    for (const [key, v] of Object.entries(frame(p, tAt(p, u)))) {
      expect(Number.isFinite(v)).toBe(true);
      if (key === "u") continue;
      if (signed.includes(key)) {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      } else if (windows.includes(key)) expect(v === -1 || (v >= 0 && v <= 1)).toBe(true);
      else {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  }
};

describe("Dune (duneFrame)", () => {
  const p = layerOf("dune", OVERLAY.dunes);

  it("72 sn döngü, 30 sn olay; değerler 0–1 (pencereler −1)", () => {
    expect(p.period).toBe(72);
    expect(p.rest).toBe(2.4);
    finite(p, duneFrame, ["leap", "ride", "burst", "dive"]);
  });

  it("sıra: Fremen iner → vurucu → iz → solucan yükselir → ağız açılır → devrilir → atlar → sürer", () => {
    const planted = first(p, duneFrame, (f) => f.plant > 0.99);
    const thump = first(p, duneFrame, (f) => f.thump > 0.99);
    const wake = first(p, duneFrame, (f) => f.wake > 0.5);
    const rise = first(p, duneFrame, (f) => f.rise > 0.5);
    const open = first(p, duneFrame, (f) => f.open > 0.9);
    const fall = first(p, duneFrame, (f) => f.fall > 0.5);
    const leap = first(p, duneFrame, (f) => f.leap >= 0);
    const ride = first(p, duneFrame, (f) => f.ride >= 0);
    expect(first(p, duneFrame, (f) => f.walk >= 1)).toBeLessThan(planted);
    expect(planted).toBeLessThan(thump);
    expect(thump).toBeLessThan(wake);
    expect(wake).toBeLessThan(rise);
    expect(rise).toBeLessThan(open);
    expect(open).toBeLessThan(fall);
    expect(fall).toBeLessThan(ride);
    expect(leap).toBeLessThan(ride);
    // vurucu solucan yükselirken susar
    expect(duneFrame(p, tAt(p, 0.5)).thump).toBe(0);
  });

  it("dinlenmede solucan, iz ve sürme yok", () => {
    const f = duneFrame(p, tAt(p, 1.8));
    expect(f.u).toBeGreaterThan(1);
    expect(f.rise + f.open + f.fall + f.wake + f.thump + f.shake).toBe(0);
    expect(f.ride).toBe(-1);
  });
});

describe("Vikings (vikFrame)", () => {
  const p = layerOf("vikings", OVERLAY.river);

  it("90 sn döngü, 30 sn olay; değerler 0–1", () => {
    expect(p.period).toBe(90);
    expect(p.rest).toBe(3);
    finite(p, vikFrame);
  });

  it("sıra: gemiler gelir → oklar (yay gerilir) → yangın + çan → gemiler çekilir; döngü sonunda yangın sönük", () => {
    const draw = first(p, vikFrame, (f) => f.draw > 0.5);
    const burn = first(p, vikFrame, (f) => f.burn > 0.5);
    const bell = first(p, vikFrame, (f) => f.bell > 0.5);
    const leave = first(p, vikFrame, (f) => f.leave > 0.05);
    expect(first(p, vikFrame, (f) => f.sail > 0.5)).toBeLessThan(draw);
    expect(draw).toBeLessThan(burn);
    expect(burn).toBeLessThan(leave);
    expect(bell).toBeLessThan(leave);
    const end = vikFrame(p, tAt(p, 0.995));
    expect(end.burn).toBeLessThan(0.05);
    expect(end.bell).toBe(0);
  });

  it("dinlenmede gemi ve yangın yok", () => {
    const f = vikFrame(p, tAt(p, 2.4));
    expect(f.u).toBeGreaterThan(1);
    expect(f.sail + f.burn + f.smoke + f.bell + f.draw).toBe(0);
  });
});

describe("Matrix (matrixFrame)", () => {
  const p = layerOf("matrix", OVERLAY.matrixCity);

  it("matrixCity katmanı: 72 sn döngü, 30 sn olay; değerler 0–1", () => {
    expect(p.period).toBe(72);
    expect(p.rest).toBe(2.4);
    finite(p, matrixFrame);
  });

  it("sıra: Ajan gelir → nişan → mermi zamanı (Neo bükülür) → doğrulur → el kalkar, mermiler durur → Ajan koda dağılır", () => {
    const walk = first(p, matrixFrame, (f) => f.walk > 0.99);
    const aim = first(p, matrixFrame, (f) => f.aim > 0.9);
    const lean = first(p, matrixFrame, (f) => f.lean > 0.9);
    const hand = first(p, matrixFrame, (f) => f.hand > 0.9);
    const hold = first(p, matrixFrame, (f) => f.hold > 0.9);
    const dissolve = first(p, matrixFrame, (f) => f.dissolve > 0.5);
    expect(walk).toBeLessThan(aim);
    expect(aim).toBeLessThan(lean);
    expect(lean).toBeLessThan(hand);
    expect(hand).toBeLessThan(hold);
    expect(hold).toBeLessThan(dissolve);
    // Neo el kaldırdığında artık bükülmüş değil
    expect(matrixFrame(p, tAt(p, 0.66)).lean).toBe(0);
  });

  it("dinlenmede Ajan ve mermi zamanı yok; atlas mermileri kaldırıldı", () => {
    const f = matrixFrame(p, tAt(p, 1.8));
    expect(f.u).toBeGreaterThan(1);
    expect(f.walk + f.aim + f.slow + f.lean + f.hand + f.hold + f.dissolve + f.flash).toBe(0);
    const list = buildParticles("matrix", { count: 140, seed: 5 });
    expect(list.some((q) => q.kind === KIND.track && q.sprite === SPRITE.bullet)).toBe(false);
  });
});

describe("Dune solucan yolu (buildWormTrack)", () => {
  it("gövde tek yol: önce zeminden çıkar, kemer çizip ikinci zemin geçişinde kuma dalar", () => {
    const W = 390;
    const L = duneLayout(W, 844);
    const T = buildWormTrack(L, W);
    expect(T.sg1).toBeGreaterThan(0);
    expect(T.sApex).toBeGreaterThan(T.sg1);
    expect(T.sg2).toBeGreaterThan(T.sApex);
    expect(T.diveX).toBeLessThan(L.tx - 60 * L.k);
    expect(T.diveX).toBeGreaterThan(0);
    // gövde, kemerin tamamını taşıyacak kadar uzun
    expect(T.Lw).toBeGreaterThan(T.sg2 - T.sg1);
    for (const v of T.pts) expect(Number.isFinite(v)).toBe(true);
  });
});

describe("Spider-Man (spiderFrame)", () => {
  const p = layerOf("spiderMan", OVERLAY.skyline);

  it("66 sn döngü, 30 sn olay; değerler 0–1 (pencereler −1)", () => {
    expect(p.period).toBe(66);
    expect(p.rest).toBe(2.2);
    finite(p, spiderFrame, ["s1", "f1", "s2", "f2", "zip"], ["look"]);
  });

  it("sıra: salınım → takla → salınım → konma → bakınma → ağ atışı → çekilip çıkış", () => {
    const s1 = first(p, spiderFrame, (f) => f.s1 >= 0);
    const f1 = first(p, spiderFrame, (f) => f.f1 >= 0);
    const s2 = first(p, spiderFrame, (f) => f.s2 >= 0);
    const perch = first(p, spiderFrame, (f) => f.perch > 0);
    const look = first(p, spiderFrame, (f) => f.look < 0);
    const zl = first(p, spiderFrame, (f) => f.zipLine > 0.5);
    const zip = first(p, spiderFrame, (f) => f.zip >= 0);
    expect(s1).toBeLessThan(f1);
    expect(f1).toBeLessThan(s2);
    expect(s2).toBeLessThan(perch);
    expect(perch).toBeLessThan(look);
    expect(look).toBeLessThan(zl);
    expect(zl).toBeLessThan(zip);
  });

  it("dinlenmede figür yok", () => {
    const f = spiderFrame(p, tAt(p, 1.8));
    expect(f.u).toBeGreaterThan(1);
    expect([f.s1, f.f1, f.s2, f.f2, f.zip]).toEqual([-1, -1, -1, -1, -1]);
    expect(f.perch + f.siren).toBe(0);
  });
});

describe("Batman (batFrame)", () => {
  const p = layerOf("batman", OVERLAY.gotham);

  it("75 sn döngü, 30 sn olay; değerler 0–1 (pencereler −1)", () => {
    expect(p.period).toBe(75);
    expect(p.rest).toBe(2.5);
    finite(p, batFrame, ["leap", "glide", "grap", "back"]);
  });

  it("sıra: işaret → şimşek → doğrulma → atlayış → süzülüş → kanca → dönüş; döngü sonunda işaret sönük", () => {
    const sig = first(p, batFrame, (f) => f.sig > 0.9);
    const flash = first(p, batFrame, (f) => f.flash > 0.5);
    const stand = first(p, batFrame, (f) => f.stand > 0.9);
    const leap = first(p, batFrame, (f) => f.leap >= 0);
    const glide = first(p, batFrame, (f) => f.glide >= 0);
    const grap = first(p, batFrame, (f) => f.grap >= 0);
    const back = first(p, batFrame, (f) => f.back >= 0);
    expect(sig).toBeLessThan(flash);
    expect(flash).toBeLessThan(stand);
    expect(stand).toBeLessThan(leap);
    expect(leap).toBeLessThan(glide);
    expect(glide).toBeLessThan(grap);
    expect(grap).toBeLessThan(back);
    expect(batFrame(p, tAt(p, 0.995)).sig).toBe(0);
  });
});

describe("Yüzüklerin Efendisi (lotrFrame)", () => {
  const p = layerOf("lotr", OVERLAY.mordor);

  it("75 sn döngü, 30 sn olay; değerler 0–1 (pencereler −1)", () => {
    expect(p.period).toBe(75);
    expect(p.rest).toBe(2.5);
    finite(p, lotrFrame, ["climb", "boom", "beastFall", "eagles"]);
  });

  it("sıra: tırmanış → Yüzük → patlama → Göz söner → kule çöker → kartallar; döngü sonunda kule geri", () => {
    const glint = first(p, lotrFrame, (f) => f.glint > 0.5);
    const erupt = first(p, lotrFrame, (f) => f.erupt > 0.5);
    const die = first(p, lotrFrame, (f) => f.eyeDie > 0.5);
    const fall = first(p, lotrFrame, (f) => f.collapse > 0.5);
    const eagles = first(p, lotrFrame, (f) => f.eagles >= 0);
    expect(first(p, lotrFrame, (f) => f.climb >= 0)).toBeLessThan(glint);
    expect(glint).toBeLessThan(erupt);
    expect(erupt).toBeLessThan(die);
    expect(die).toBeLessThan(fall);
    expect(fall).toBeLessThan(eagles);
    const end = lotrFrame(p, tAt(p, 0.999));
    expect(end.restore).toBeGreaterThan(0.95);
    expect(end.eyeDie).toBeLessThan(0.05);
  });
});

describe("Harry Potter (hpFrame)", () => {
  const p = layerOf("harryPotter", OVERLAY.hogwarts);

  it("75 sn döngü, 30 sn olay; değerler 0–1 (pencereler −1)", () => {
    expect(p.period).toBe(75);
    expect(p.rest).toBe(2.5);
    finite(p, hpFrame, ["burst", "stag", "sparks"]);
  });

  it("sıra: Ruh Emiciler → buz → asa → Patronus → kaçış → zerreler; dinlenmede sakin", () => {
    const dem = first(p, hpFrame, (f) => f.dem > 0.5);
    const frost = first(p, hpFrame, (f) => f.frost > 0.5);
    const wand = first(p, hpFrame, (f) => f.wand > 0.5);
    const stag = first(p, hpFrame, (f) => f.stag >= 0);
    const flee = first(p, hpFrame, (f) => f.flee > 0.5);
    const sparks = first(p, hpFrame, (f) => f.sparks >= 0);
    expect(dem).toBeLessThan(frost);
    expect(frost).toBeLessThan(wand);
    expect(wand).toBeLessThan(stag);
    expect(stag).toBeLessThan(flee);
    expect(flee).toBeLessThan(sparks);
    const r = hpFrame(p, tAt(p, 1.8));
    expect(r.dem + r.dark + r.frost + r.wand).toBe(0);
  });
});

describe("Güneş sistemi (solarFrame)", () => {
  const p = buildParticles("solarSystem", { count: 60, seed: 5 }).find((q) => q.kind === KIND.overlay && q.part === OVERLAY.orbits);

  it("75 sn döngü, 30 sn olay; değerler 0–1 (pencereler −1)", () => {
    expect(p.period).toBe(75);
    finite(p, solarFrame, ["comet", "cme"]);
  });

  it("kuyruklu yıldız günberiye varınca Güneş patlar, ardından taç kütle atımı; dinlenmede sakin", () => {
    const comet = first(p, solarFrame, (f) => f.comet >= 0);
    const peri = first(p, solarFrame, (f) => f.comet >= 0.5);
    const flare = first(p, solarFrame, (f) => f.flare > 0.9);
    const cme = first(p, solarFrame, (f) => f.cme >= 0);
    expect(comet).toBeLessThan(peri);
    expect(Math.abs(flare - peri)).toBeLessThan(0.03);
    expect(cme).toBeGreaterThan(comet);
    const r = solarFrame(p, tAt(p, 1.8));
    expect([r.comet, r.cme, r.flare]).toEqual([-1, -1, 0]);
  });
});
