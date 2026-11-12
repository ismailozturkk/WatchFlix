// components/decor/ParticleField.js
//
// Atmosfer efekti çizimi: Skia Atlas ile TÜM parçacıklar tek GPU çiziminde.
//
//   • Şekiller bir kez beyaz/gri olarak küçük bir dokuya çizilir
//     (components/decor/particleSprites.js, 512 × 1024 px); PNG yok. Doku
//     MODÜL düzeyinde TEK: kaç ekranda katman açık olursa olsun bir kez
//     çizilir, bellekte bir kopya durur (eskiden her örnek kendi dokusunu
//     üretiyordu). Renk parçacık başına Atlas `colors` + "modulate".
//   • Konum/dönüş/opaklık ve şekil karesi UI thread'de, Reanimated mapper'ında
//     hesaplanır (`useRSXformBuffer` / `useColorBuffer` / `useRectBuffer`).
//     Kare başına React render'ı, JS köprüsü ya da görünüm sayısı YOK.
//   • Değişmeyen tamponlar bir kez yazılır: kanat çırpan yoksa şekil
//     dikdörtgenleri, opaklığı zamanla değişen yoksa renkler saate bağlanmaz
//     (mapper yalnız bağlı olduğu paylaşımlı değer değişince çalışır).
//   • Saat çerçeve zaman damgasıdır (`frameInfo.timestamp`): her örnek aynı
//     saati okur → ekran geçişinde iki ekranın efekti aynı karede durur.
//   • `playing` false olunca saat durur, son kare ekranda kalır (sıfır iş).
//   • Kare hızı sınırı (frameIntervalMs): "Tam"/"Orta" 60 fps, "Kapalı" 30.
//   • Büyük çizilen şimşek ve kıyı dokuda değil, vektör (VectorLayers.js),
//     aynı saat ve aynı tuvalde. Tür ışık katmanları (sis, vinyet, ekolayzer…)
//     ve mevsim/evren sahneleri de vektör (OverlayLayers.js): OVERLAY_FRONT
//     Atlas'ın önünde, OVERLAY_UNDER kıyının da altında, gerisi arkasında.
//
// Bu modül Skia'yı içe aktarır; açılış paketine girmesin diye WeatherLayer
// onu yalnız efekt açıkken `require` eder.
//
// Mantık (parçacık üretimi + kare formülü): utils/weatherParticles.js.

import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import {
  makeMutable,
  runOnUI,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  Atlas,
  Canvas,
  FilterMode,
  Group,
  LinearGradient,
  MipmapMode,
  Rect,
  Skia,
  drawAsPicture,
  useColorBuffer,
  useRSXformBuffer,
  useRectBuffer,
  vec,
} from "@shopify/react-native-skia";
import SpriteSheet from "./particleSprites";
import { BoltLayer, ShoreLayer } from "./VectorLayers";
import OverlayLayers from "./OverlayLayers";
import {
  KIND,
  OVERLAY_FRONT,
  OVERLAY_UNDER,
  SPRITE_CELL,
  SPRITE_COLS,
  SPRITE_ROWS,
  buildPlanParticles,
  frameIntervalMs,
  isVectorParticle,
  needsAnimatedAlpha,
  needsAnimatedSprites,
  particleAlpha,
  particlePose,
  shoreStyle,
  particleSprite,
  sceneScale,
  spriteOrigin,
} from "../../utils/weatherParticles";

const TEXTURE_W = SPRITE_CELL * SPRITE_COLS;
const TEXTURE_H = SPRITE_CELL * SPRITE_ROWS;
const SAMPLING = Object.freeze({ filter: FilterMode.Linear, mipmap: MipmapMode.None });

// ── Paylaşılan doku ─────────────────────────────────────────────────────────
// Skia'nın useTexture'ı ile aynı yol (resim → UI thread'de offscreen yüzey →
// anlık görüntü), ama örnek başına değil modül başına bir kez.
const sharedTexture = makeMutable(null);
let textureRequested = false;

function paintTexture(target, picture, w, h) {
  "worklet";
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) return;
  surface.getCanvas().drawPicture(picture);
  surface.flush();
  target.value = surface.makeImageSnapshot();
}

function ensureTexture() {
  if (textureRequested) return;
  textureRequested = true;
  drawAsPicture(<SpriteSheet />, { x: 0, y: 0, width: TEXTURE_W, height: TEXTURE_H })
    .then((picture) => runOnUI(paintTexture)(sharedTexture, picture, TEXTURE_W, TEXTURE_H))
    .catch(() => {
      textureRequested = false; // bir sonraki örnek yeniden dener
    });
}

/**
 * @param {object} props
 * @param {Array<[string, number]>} props.plan  [[efekt, sayı], ...] (tek efekt ya da tür karışımı)
 * @param {number} props.seed        dekor tohumu (aynı tohum → aynı desen)
 * @param {boolean} props.lightSurface açık tema zemini (koyu palet)
 * @param {number} props.width       çizim alanı (dp)
 * @param {number} props.height
 * @param {boolean} props.playing    false → saat durur, son kare kalır
 * @param {string} props.effectMode  "full" | "balanced" | "off" (kare hızı sınırı)
 * @param {number} [props.speedScale] önizleme gibi dar alanlarda yavaşlatma
 */
function ParticleField({
  plan,
  seed,
  lightSurface,
  width,
  height,
  playing,
  effectMode,
  speedScale = 1,
}) {
  useEffect(ensureTexture, []);

  // plan dizisi her render'da yeni olabilir → içerik anahtarıyla bellekle.
  const planKey = (plan || []).map(([e, c]) => `${e}:${c}`).join("|");
  const all = useMemo(
    () => buildPlanParticles(plan, { seed, lightSurface }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planKey, seed, lightSurface],
  );
  // Şimşek çizgisi ve dalga/kum vektör katmanda (VectorLayers); gerisi Atlas'ta.
  const { particles, waves, sand, bolts, underLights, backLights, frontLights } = useMemo(() => {
    const vectorParts = all.filter(isVectorParticle);
    const shore = vectorParts.filter((p) => p.kind === KIND.tile);
    const lights = vectorParts.filter((p) => p.kind === KIND.overlay);
    return {
      particles: all.filter((p) => !isVectorParticle(p)),
      waves: shore.filter((p) => p.part < 3),
      sand: shore.find((p) => p.part === 3) || null,
      bolts: vectorParts.filter((p) => p.kind === KIND.bolt),
      underLights: lights.filter((p) => OVERLAY_UNDER.includes(p.part)),
      backLights: lights.filter((p) => !OVERLAY_FRONT.includes(p.part) && !OVERLAY_UNDER.includes(p.part)),
      frontLights: lights.filter((p) => OVERLAY_FRONT.includes(p.part)),
    };
  }, [all]);
  const animatedSprites = useMemo(() => needsAnimatedSprites(particles), [particles]);
  const animatedAlpha = useMemo(() => needsAnimatedAlpha(particles), [particles]);

  const clock = useSharedValue(0);
  const still = useSharedValue(0); // hiç değişmez: statik tamponların "saati"
  const lastFrame = useSharedValue(0);
  const fade = useSharedValue(0);
  const interval = frameIntervalMs(effectMode) - 2;
  const scale = speedScale;

  const frame = useFrameCallback((info) => {
    "worklet";
    if (info.timestamp - lastFrame.value < interval) return;
    if (lastFrame.value === 0) fade.value = withTiming(1, { duration: 700 });
    lastFrame.value = info.timestamp;
    clock.value = (info.timestamp / 1000) * scale;
  }, false);

  useEffect(() => {
    frame.setActive(Boolean(playing));
  }, [playing, frame]);

  const w = width;
  const h = height;
  const n = particles.length;
  const alphaClock = animatedAlpha ? clock : still;
  const spriteClock = animatedSprites ? clock : still;

  const transforms = useRSXformBuffer(n, (val, i) => {
    "worklet";
    const pose = particlePose(particles[i], clock.value, w, h);
    val.set(pose.scos, pose.ssin, pose.tx, pose.ty);
  });
  const colors = useColorBuffer(n, (val, i) => {
    "worklet";
    const p = particles[i];
    val[0] = p.r;
    val[1] = p.g;
    val[2] = p.b;
    val[3] = particleAlpha(p, alphaClock.value, h);
  });
  // Şekil dikdörtgeni: hücre köşesi + şeklin hücre içi (dar) dikdörtgeni.
  const sprites = useRectBuffer(n, (val, i) => {
    "worklet";
    const p = particles[i];
    const o = spriteOrigin(particleSprite(p, spriteClock.value));
    val.setXYWH(o.x + p.rx, o.y + p.ry, p.cw, p.ch);
  });

  const hasShore = waves.length > 0 || sand !== null;
  // evren denizi (One Piece) / yaz kıyısı: tab çubuğunun üstüne kaldırılır, altı derin su ya da kumla dolar
  const seaLift = waves.length && waves[0].lift ? waves[0].lift * sceneScale(w, h) : 0;
  if (!n && !hasShore && !bolts.length && !underLights.length && !backLights.length && !frontLights.length) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={styles.fill}>
        {/* kıyının da altındaki katman (yaz: gök + ufuk denizi) */}
        {underLights.length ? (
          <Group opacity={fade}>
            <OverlayLayers overlays={underLights} clock={clock} width={w} height={h} lightSurface={lightSurface} />
          </Group>
        ) : null}
        {/* kıyı Atlas'ın altında: ışıltı ve martılar suyun üstünde */}
        {hasShore ? (
          <Group opacity={fade}>
            {seaLift > 0 && !sand ? (
              <Rect x={0} y={h - seaLift} width={w} height={seaLift + 4}>
                <LinearGradient
                  start={vec(0, h - seaLift)}
                  end={vec(0, h)}
                  colors={lightSurface ? ["#2a6d9f", "#1d4f78"] : ["#17648c", "#0d3a57"]}
                />
              </Rect>
            ) : null}
            <Group transform={seaLift > 0 ? [{ translateY: -seaLift }] : undefined}>
              <ShoreLayer waves={waves} sand={sand} clock={clock} width={w} height={h} lightSurface={lightSurface} seed={seed} />
            </Group>
            {/* yaz kıyısı: kumun sekme çubuğu arkasında kalan devamı (taşan dalga dolgusunu da örter) */}
            {seaLift > 0 && sand ? (
              <Rect x={0} y={h - seaLift - 0.5} width={w} height={seaLift + 4}>
                <LinearGradient
                  start={vec(0, h - seaLift)}
                  end={vec(0, h)}
                  colors={[shoreStyle(lightSurface).sand.bottom, shoreStyle(lightSurface).sand.wet]}
                />
              </Rect>
            ) : null}
          </Group>
        ) : null}
        {backLights.length ? (
          <Group opacity={fade}>
            <OverlayLayers overlays={backLights} clock={clock} width={w} height={h} lightSurface={lightSurface} />
          </Group>
        ) : null}
        {n ? (
          <Atlas
            image={sharedTexture}
            sprites={sprites}
            transforms={transforms}
            colors={colors}
            colorBlendMode="modulate"
            sampling={SAMPLING}
            opacity={fade}
          />
        ) : null}
        {bolts.length ? (
          <Group opacity={fade}>
            {bolts.map((b) => (
              <BoltLayer key={b.salt} bolt={b} clock={clock} width={w} height={h} lightSurface={lightSurface} />
            ))}
          </Group>
        ) : null}
        {frontLights.length ? (
          <Group opacity={fade}>
            <OverlayLayers overlays={frontLights} clock={clock} width={w} height={h} lightSurface={lightSurface} />
          </Group>
        ) : null}
      </Canvas>
    </View>
  );
}

export default React.memo(ParticleField);

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
