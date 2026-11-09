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
 * @param {Array} [props.genres]   detay ekranı: TMDB türleri (id, {id,name} ya da ad).
 *                                 "Türe göre" açıksa ve tanınan tür varsa seçili
 *                                 efektin yerine türlerin karışımı çizilir.
 */
function WeatherLayer({ playing, width, height, preview = false, speedScale = 1, genres }) {
  const { effect, density, byGenre } = useWeatherSettings();
  const effectMode = useEffectMode();
  const seed = useDecorSeed();
  const { theme } = useTheme();
  // Ekran boyutu bir kez (`screen`, pencere değil): klavye açılınca pencere
  // küçülüyor ve parçacıklar yeniden yerleşip zıplardı (ambiyansla aynı kural).
  const [screen] = useState(() => Dimensions.get("screen"));
  const w = width ?? screen.width;
  const h = height ?? screen.height;

  const gKey = genresKey(genres);
  const plan = useMemo(() => {
    const fromGenres = byGenre && gKey ? genreEffectsFor(genres) : [];
    const base = resolvePlan(fromGenres.length ? fromGenres : [effect], density, effectMode);
    if (!preview) return base;
    const ratioArea = w * h;
    const screenArea = screen.width * screen.height;
    return base.map(([e, c]) => [e, previewParticleCount(c, ratioArea, screenArea)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byGenre, gKey, effect, density, effectMode, preview, w, h, screen]);

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
