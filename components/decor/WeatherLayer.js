// components/decor/WeatherLayer.js
//
// Atmosferin ayarları okuyan ince kabuğu: seçili efekt (ya da detay
// ekranında yapımın türlerinden gelen karışım), yoğunluk, efekt modu, dekor
// tohumu ve tema zemininin açık/koyu oluşu → çizim planı → ParticleField.
//
// ParticleField (ve onunla Skia) burada TEMBEL `require` edilir: efekt
// kapalıyken bu dosya hiç çizilmez, Skia'nın JS modülü açılış paketinde
// yürütülmez. Aynı kabuk tam ekran katmanda (ScreenSnow), açılış ekranında
// ve ayar satırı önizlemesinde kullanılır.

import React, { useMemo, useState } from "react";
import { Dimensions } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import useWeatherSettings from "../../hooks/useWeatherSettings";
import { useDecorSeed } from "../../services/decorSeed";
import { useEffectMode } from "../../services/effectSettings";
import { isLightSurface } from "../../utils/colorUtils";
import {
  genreEffectsFor,
  previewParticleCount,
  resolvePlan,
} from "../../utils/weatherParticles";
import { universeFor, universeTitleKey } from "../../utils/weatherUniverses";
import useUniverseUnlocks from "../../hooks/useUniverseUnlocks";

let ParticleFieldImpl = null;
function getParticleField() {
  if (!ParticleFieldImpl) ParticleFieldImpl = require("./ParticleField").default;
  return ParticleFieldImpl;
}

const genresKey = (genres) =>
  Array.isArray(genres) ? genres.map((g) => (g && typeof g === "object" ? g.id ?? g.name : g)).join(",") : "";

/**
 * @param {object} props
 * @param {boolean} props.playing
 * @param {number} [props.width]   verilmezse ekran boyutu (tam ekran katman)
 * @param {number} [props.height]
 * @param {boolean} [props.preview] dar alan: sayı alanla orantılı
 * @param {number} [props.speedScale]
 * @param {string} [props.effectOverride] önizleme: ayarı yok sayıp bu efekti çiz
 * @param {Array} [props.genres]   detay ekranı: TMDB türleri (id, {id,name} ya da ad).
 *                                 "Türe göre" açıksa ve tanınan tür varsa seçili
 *                                 efektin yerine türlerin karışımı çizilir.
 * @param {{type:"movie"|"tv", id:number, collectionId?:number}} [props.title]
 *                                 detay ekranı: yapım tanınan bir evrense (Star Wars,
 *                                 GoT…) türün yerine o evrenin sahnesi çizilir
 *                                 (öncelik: özel gün > evren > tür; "Türe göre" açıkken).
 */
function WeatherLayer({ playing, width, height, preview = false, speedScale = 1, genres, title, effectOverride }) {
  const { effect: settingEffect, density, byGenre, special } = useWeatherSettings();
  // effectOverride: ayar ekranı önizlemesinde denenen özel gün efekti (kaydedilmez).
  const effect = effectOverride || settingEffect;
  const effectMode = useEffectMode();
  const seed = useDecorSeed();
  const { theme } = useTheme();
  // Ekran boyutu bir kez (`screen`, pencere değil): klavye açılınca pencere
  // küçülüyor ve parçacıklar yeniden yerleşip zıplardı (ambiyansla aynı kural).
  const [screen] = useState(() => Dimensions.get("screen"));
  const w = width ?? screen.width;
  const h = height ?? screen.height;

  const gKey = genresKey(genres);
  const tKey = universeTitleKey(title);
  // Gizli evrenler: türe göre modda yapımın evreni yalnız AÇILMIŞSA çizilir (yoksa tür karışımı).
  const { unlocked, today: universeDay } = useUniverseUnlocks();
  const plan = useMemo(() => {
    // Özel günde (ayar açıkken) yapımın türü/evreni değil günün efekti çizilir.
    const titleUniverse = byGenre && !special && !effectOverride ? universeFor(title) : null;
    const fromTitle = titleUniverse && (unlocked.has(titleUniverse) || universeDay.has(titleUniverse)) ? titleUniverse : null;
    const fromGenres = !fromTitle && byGenre && gKey && !special && !effectOverride ? genreEffectsFor(genres) : [];
    const chosen = fromTitle ? [fromTitle] : fromGenres.length ? fromGenres : [effect];
    const base = resolvePlan(chosen, density, effectMode);
    if (!preview) return base;
    const ratioArea = w * h;
    const screenArea = screen.width * screen.height;
    return base.map(([e, c]) => [e, previewParticleCount(c, ratioArea, screenArea)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byGenre, gKey, tKey, unlocked, universeDay, special, effectOverride, effect, density, effectMode, preview, w, h, screen]);

  if (!(w > 0 && h > 0) || !plan.length) return null;

  const ParticleField = getParticleField();
  return (
    <ParticleField
      plan={plan}
      seed={seed}
      lightSurface={isLightSurface(theme?.primary)}
      width={w}
      height={h}
      playing={playing}
      effectMode={effectMode}
      speedScale={speedScale}
    />
  );
}

export default React.memo(WeatherLayer);
