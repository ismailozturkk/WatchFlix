import {
  HALO_AVATAR_SIZE,
  HALO_RING_RADIUS,
  HALO_RING_STROKE,
  cometTail,
  glowStops,
  haloGeometry,
} from "../utils/avatarHalo";

describe("haloGeometry", () => {
  const geo = haloGeometry();

  it("halka 156 piksel, parlama halkadan reach kadar taşar", () => {
    expect(geo.ringSize).toBe(HALO_RING_RADIUS * 2);
    expect(geo.glowSize).toBe(geo.ringSize + geo.glowReach * 2);
  });

  it("kütüphanenin viewBox sıkıştırmasını hesaba katar", () => {
    // viewBox kenarı 2*(78+11)=178 birim, 156 piksele sığar.
    expect(geo.scale).toBeCloseTo(156 / 178, 6);
    // Çizgi merkezi (78 + 11/2) * scale; dış kenar tam 78 piksel olmalı.
    expect(geo.orbitRadius + geo.strokePx / 2).toBeCloseTo(HALO_RING_RADIUS, 6);
  });

  it("avatar ile halkanın iç kenarı arasında pozitif boşluk kalır", () => {
    expect(geo.gap).toBeGreaterThan(0);
    expect(geo.gap).toBeCloseTo(
      HALO_RING_RADIUS - geo.strokePx - HALO_AVATAR_SIZE / 2,
      6
    );
  });

  it("çizgi kalınlığı kütüphane varsayılanıyla ölçeklenir", () => {
    expect(geo.strokePx).toBeCloseTo(HALO_RING_STROKE * geo.scale, 6);
  });
});

describe("cometTail", () => {
  it("baş en büyük ve en opak, kuyruk küçülüp söner", () => {
    const tail = cometTail(6, 7, 11);
    expect(tail).toHaveLength(6);
    expect(tail[0]).toEqual({ lagDeg: 0, size: 11, opacity: 1 });
    for (let i = 1; i < tail.length; i += 1) {
      expect(tail[i].lagDeg).toBeGreaterThan(tail[i - 1].lagDeg);
      expect(tail[i].size).toBeLessThan(tail[i - 1].size);
      expect(tail[i].opacity).toBeLessThan(tail[i - 1].opacity);
    }
    expect(tail[tail.length - 1].opacity).toBeGreaterThan(0);
  });

  it("tek noktada bölme hatası vermez", () => {
    expect(cometTail(1)).toHaveLength(1);
    expect(cometTail(0)).toHaveLength(1);
  });

  it("lagDeg değerleri benzersizdir (React key olarak kullanılıyor)", () => {
    const keys = cometTail(6).map((d) => d.lagDeg);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("glowStops", () => {
  const geo = haloGeometry();
  const stops = glowStops(geo);
  const r = geo.glowSize / 2;
  const crest = geo.ringSize / 2 / r;

  it("durak ofsetleri artan ve benzersizdir (Stop key'i)", () => {
    const offsets = stops.map((s) => s.offset);
    expect(new Set(offsets).size).toBe(offsets.length);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
    expect(offsets[0]).toBe(0);
    expect(offsets[offsets.length - 1]).toBe(1);
  });

  it("zirve halkanın dış kenarında; merkezde ve dış sınırda sönük", () => {
    const peak = Math.max(...stops.map((s) => s.opacity));
    expect(stops.find((s) => s.opacity === peak).offset).toBeCloseTo(crest, 6);
    expect(stops[0].opacity).toBe(0);
    expect(stops[stops.length - 1].opacity).toBe(0);
  });

  it("ışıma avatarın kenarından başlar (avatarın altı boş)", () => {
    const avatarEdge = geo.avatar / 2 / r;
    for (const s of stops.filter((x) => x.offset <= avatarEdge)) {
      expect(s.opacity).toBe(0);
    }
  });

  it("eğri tek tepeli: zirveye kadar artar, sonra azalır", () => {
    const at = stops.findIndex((s) => s.offset === crest);
    for (let i = 1; i <= at; i += 1) {
      expect(stops[i].opacity).toBeGreaterThanOrEqual(stops[i - 1].opacity);
    }
    for (let i = at + 1; i < stops.length; i += 1) {
      expect(stops[i].opacity).toBeLessThanOrEqual(stops[i - 1].opacity);
    }
  });

  it("ardışık duraklar arasında sıçrama yok (bantlaşma olmasın)", () => {
    const peak = Math.max(...stops.map((s) => s.opacity));
    for (let i = 1; i < stops.length; i += 1) {
      expect(Math.abs(stops[i].opacity - stops[i - 1].opacity)).toBeLessThanOrEqual(
        peak * 0.3
      );
    }
  });
});
