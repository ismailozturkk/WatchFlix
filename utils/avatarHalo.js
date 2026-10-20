// utils/avatarHalo.js
//
// Profil avatarının etrafındaki halka + parlama + "yıldız kuyruğu" animasyonunun
// SAF geometrisi (components/profile/ProfileAvatarHalo.js). Ayrı dosya: ölçüler
// hem stillerde hem SVG degradesinde hem de kuyruk noktalarının yörüngesinde
// aynı anda lazım; iki yerde elle hesaplanırsa biri kayar ve nokta halkanın
// içinden/dışından geçer.
//
// react-native-circular-progress-indicator halkayı `radius*2` piksellik bir
// Svg'ye çizer ama viewBox'ı `radius + stroke` kadar geniştir; yani çizim
// 156 piksele SIKIŞTIRILIR. Çizgi merkez yarıçapı ve kalınlığı bu yüzden
// (78 + 5.5) ve 11 değil, ölçeklenmiş değerlerdir — kuyruk noktaları bu yörüngede
// dönmezse halkanın üstünde değil yanında görünür.

export const HALO_RING_RADIUS = 78;
export const HALO_RING_STROKE = 11;
export const HALO_AVATAR_SIZE = 128;
// Parlama halkanın dış kenarından bu kadar piksel taşar. Profil satırı 16px
// yan boşlukla başladığı için daha fazlası sol kenarda ekrandan taşardı.
export const HALO_GLOW_REACH = 18;

export function haloGeometry({
  ringRadius = HALO_RING_RADIUS,
  stroke = HALO_RING_STROKE,
  avatar = HALO_AVATAR_SIZE,
  glowReach = HALO_GLOW_REACH,
} = {}) {
  const ringSize = ringRadius * 2;
  // Kütüphane: viewBox kenarı = 2 * (radius + stroke), çizim ringSize pikseline sığar.
  const scale = ringSize / (2 * (ringRadius + stroke));
  const orbitRadius = (ringRadius + stroke / 2) * scale;
  const strokePx = stroke * scale;
  const glowSize = ringSize + glowReach * 2;
  return {
    ringSize,
    scale,
    orbitRadius,
    strokePx,
    glowSize,
    glowReach,
    avatar,
    // Avatar ile halkanın iç kenarı arasındaki boşluk (parlamanın göründüğü yer).
    gap: ringSize / 2 - strokePx - avatar / 2,
  };
}

// Yıldız kuyruğu: baş + giderek küçülüp sönen noktalar. `lagDeg` noktanın
// başın KAÇ DERECE gerisinde döndüğü (saat yönünde hareket ediyor).
export function cometTail(count = 6, stepDeg = 7, headSize = 11) {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    return {
      lagDeg: i * stepDeg,
      size: Math.round(headSize * (1 - 0.68 * t) * 10) / 10,
      opacity: Math.round((1 - 0.88 * t) * 100) / 100,
    };
  });
}

const smoothstep = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

// Parlamanın radyal degrade durakları (0..1 = merkezden dış kenara). Blur
// filtresi YOK — Android'de hedefsiz blur sessizce düz katmana düşer (bkz.
// blur-android-target).
//
// Zirve halkanın DIŞ KENARINDA: ışıma halkadan dışa eş merkezli yayılır (çizginin
// ortasına koymak, dolu halkanın örttüğü kısmı boşa harcayıp görünen hâleyi
// neredeyse sıfırlıyordu). Az duraklı parça parça doğrusal eğri halkalar halinde
// "bant" görünüyordu; bu yüzden eğri çok duraktan örneklenir (içe doğru
// smoothstep, dışa doğru (1-u)^2.2 → sınırda sıfır eğim).
//
// `peak` DURAĞAN zirve değil, dokunuştaki parlamanın tavanı: boştaki parlama
// bileşende kısılır (bkz. ProfileAvatarHalo `glowStyle`); ışıma ince bir hale
// olmalı, vurgu halkanın kendisinde.
export function glowStops(
  geometry = haloGeometry(),
  peak = 0.3,
  innerSteps = 6,
  outerSteps = 12,
) {
  const r = geometry.glowSize / 2;
  const inner = geometry.avatar / 2 / r;
  const crest = geometry.ringSize / 2 / r;
  const stops = [{ offset: 0, opacity: 0 }];
  for (let i = 0; i <= innerSteps; i += 1) {
    const t = i / innerSteps;
    stops.push({
      offset: inner + (crest - inner) * t,
      opacity: peak * smoothstep(t),
    });
  }
  for (let j = 1; j <= outerSteps; j += 1) {
    const u = j / outerSteps;
    stops.push({
      offset: crest + (1 - crest) * u,
      opacity: peak * (1 - u) ** 2.2,
    });
  }
  return stops;
}
