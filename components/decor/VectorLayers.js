// components/decor/VectorLayers.js
//
// Atmosferin BÜYÜK çizilen parçaları: şimşek ve kıyı (dalga + kum). Bunlar
// ekranda yüzlerce dp boyunda; doku hücresinden (64 px) büyütülünce bulanık ve
// kalın görünüyordu. Burada Skia yolu olarak çizilirler:
//
//   • Yollar JS'te, ekran boyutu değişince BİR KEZ kurulur
//     (utils/weatherParticles: shoreGeometry, buildBoltShape). Kare başına
//     yalnız Group dönüşümü ve opaklığı değişir (Reanimated türetilmiş değer,
//     UI thread) — yol yeniden üretilmez, React render'ı yok.
//   • Şimşek: BOLT_VARIANTS biçim önceden üretilir, her çakmada biri seçilir
//     (aynalı da). Seçilmeyenler opaklık 0'da çizilir; Skia opaklığı 0 olan
//     boyayı çizmeden atlar (nothingToDraw) → bulanıklık maliyeti yalnız
//     görünen ~0,15 sn'de.
//   • Kıyı: üç dalga katmanı ekranın İKİ katı genişlikte tek yol; yatay kayıp
//     ekran genişliğinde sarar (dikişsiz). Kum sabit; üstündeki köpük gidip
//     gelir.
//
// ParticleField içinde, Atlas ile aynı tuvalde: kıyı Atlas'ın ALTINDA (ışıltı
// ve martılar suyun üstünde), şimşek ÜSTÜNDE.

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { BlurMask, DashPathEffect, Group, LinearGradient, Path, Skia, vec } from "@shopify/react-native-skia";
import {
  BOLT_VARIANTS,
  boltStrike,
  boltStyle,
  buildBoltShape,
  shoreGeometry,
  shoreLayerOffset,
  shoreStyle,
  swashAt,
} from "../../utils/weatherParticles";

function linePath(pts, dy = 0) {
  const path = Skia.Path.Make();
  for (let i = 0; i < pts.length; i += 1) {
    const [x, y] = pts[i];
    if (i) path.lineTo(x, y + dy);
    else path.moveTo(x, y + dy);
  }
  return path;
}

// Çizginin altını ekranın dışına kadar kapatır (dolgu yolu).
function fillBelow(pts, bottom) {
  const path = linePath(pts);
  path.lineTo(pts[pts.length - 1][0], bottom);
  path.lineTo(pts[0][0], bottom);
  path.close();
  return path;
}

// ── Kıyı ───────────────────────────────────────────────────────────────────

function WaveLayer({ p, clock, width, k, layer, tone, foam }) {
  const transform = useDerivedValue(() => {
    const o = shoreLayerOffset(p, clock.value, width, k);
    return [{ translateX: o.dx }, { translateY: o.dy }];
  });
  return (
    <Group transform={transform} opacity={tone.alpha}>
      <Path path={layer.fill}>
        <LinearGradient
          start={vec(0, layer.top)}
          end={vec(0, layer.bottom)}
          colors={[tone.crest, tone.top, tone.deep]}
          positions={[0, 0.22, 1]}
        />
      </Path>
      {/* köpük çizgisi: tepenin hemen altında, suyun üstünde */}
      <Path
        path={layer.foam}
        style="stroke"
        strokeWidth={tone.foamW * k}
        strokeJoin="round"
        strokeCap="round"
        color={foam}
        opacity={tone.foam}
      />
      {layer.lace ? (
        <Path path={layer.lace} style="stroke" strokeWidth={0.9 * k} strokeCap="round" color={foam} opacity={0.3}>
          <DashPathEffect intervals={[18 * k, 11 * k, 5 * k, 13 * k]} />
        </Path>
      ) : null}
    </Group>
  );
}

function Swash({ p, clock, k, path, foam }) {
  const transform = useDerivedValue(() => [{ translateY: swashAt(p, clock.value, k).dy }]);
  const opacity = useDerivedValue(() => swashAt(p, clock.value, k).opacity);
  return (
    <Group transform={transform} opacity={opacity}>
      {/* ıslak su filmi + kesik köpük çizgisi */}
      <Path path={path} style="stroke" strokeWidth={4 * k} strokeCap="round" color={foam} opacity={0.16} />
      <Path path={path} style="stroke" strokeWidth={1.3 * k} strokeCap="round" color={foam}>
        <DashPathEffect intervals={[26 * k, 7 * k, 10 * k, 6 * k]} />
      </Path>
    </Group>
  );
}

export function ShoreLayer({ waves, sand, clock, width, height, lightSurface, seed }) {
  const geo = useMemo(() => {
    const g = shoreGeometry(width, height, seed);
    const k = g.metrics.k;
    const bottom = height + 24;
    const layers = g.layers.map((l, i) => ({
      fill: fillBelow(l.crest, bottom),
      foam: linePath(l.crest, 0.6 * k),
      lace: i === 2 ? linePath(l.crest, 5 * k) : null,
      top: l.top,
      bottom: g.metrics.sandTop + 10 * k,
    }));
    const grainDark = Skia.Path.Make();
    const grainLight = Skia.Path.Make();
    for (const [x, y, r, light] of g.grains) (light ? grainLight : grainDark).addCircle(x, y, r);
    return {
      k,
      layers,
      sandFill: fillBelow(g.sandEdge, height + 4),
      sandFoam: linePath(g.sandEdge, 1 * k),
      sandMin: g.sandMin,
      grainDark,
      grainLight,
    };
  }, [width, height, seed]);
  const style = useMemo(() => shoreStyle(lightSurface), [lightSurface]);
  const { k } = geo;

  return (
    <Group>
      {waves.map((p) => {
        const li = Math.max(0, Math.min(2, p.part));
        return (
          <WaveLayer
            key={li}
            p={p}
            clock={clock}
            width={width}
            k={k}
            layer={geo.layers[li]}
            tone={style.sea[li]}
            foam={style.foam}
          />
        );
      })}
      {sand ? (
        <Group>
          <Path path={geo.sandFill}>
            <LinearGradient
              start={vec(0, geo.sandMin)}
              end={vec(0, height)}
              colors={[style.sand.wet, style.sand.wet, style.sand.top, style.sand.bottom]}
              positions={[0, 0.16, 0.42, 1]}
            />
          </Path>
          <Path path={geo.grainDark} color={style.sand.grainDark} opacity={0.35} />
          <Path path={geo.grainLight} color={style.sand.grainLight} opacity={0.55} />
          <Swash p={sand} clock={clock} k={k} path={geo.sandFoam} foam={style.foam} />
        </Group>
      ) : null}
    </Group>
  );
}

// ── Şimşek ─────────────────────────────────────────────────────────────────

function BoltVariant({ strike, index, shape, tone, k }) {
  const opacity = useDerivedValue(() => (strike.value.variant === index ? strike.value.alpha : 0));
  return (
    <Group opacity={opacity}>
      {/* dış hale → iç parıltı → incelen beyaz çekirdek */}
      <Path path={shape.mainSpine} style="stroke" strokeWidth={12 * k} strokeCap="round" strokeJoin="round" color={tone.halo} opacity={0.2}>
        <BlurMask blur={9 * k} style="normal" />
      </Path>
      <Path path={shape.spine} style="stroke" strokeWidth={3.4 * k} strokeCap="round" strokeJoin="round" color={tone.glow} opacity={0.6}>
        <BlurMask blur={2 * k} style="normal" />
      </Path>
      <Path path={shape.core} color={tone.core} />
    </Group>
  );
}

export function BoltLayer({ bolt, clock, width, height, lightSurface }) {
  const k = Math.max(0.6, Math.min(1.25, width / 390));
  const length = bolt.size * height;
  const shapes = useMemo(
    () =>
      Array.from({ length: BOLT_VARIANTS }, (_, v) => {
        const pieces = buildBoltShape(bolt.salt * 7 + v + 1, length, k);
        const core = Skia.Path.Make();
        const spine = Skia.Path.Make();
        let mainSpine = null;
        for (const piece of pieces) {
          const outline = linePath(piece.outline);
          outline.close();
          core.addPath(outline);
          const s = linePath(piece.spine);
          spine.addPath(s);
          if (piece.main) mainSpine = s;
        }
        return { core, spine, mainSpine: mainSpine || spine };
      }),
    [bolt.salt, length, k],
  );
  const tone = boltStyle(lightSurface);
  const strike = useDerivedValue(() => boltStrike(bolt, clock.value, width));
  const transform = useDerivedValue(() => {
    const s = strike.value;
    return [{ translateX: s.x }, { translateY: -6 }, { rotate: s.angle }, { scaleX: s.flip }];
  });
  return (
    <Group transform={transform}>
      {shapes.map((shape, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <BoltVariant key={i} strike={strike} index={i} shape={shape} tone={tone} k={k} />
      ))}
    </Group>
  );
}
