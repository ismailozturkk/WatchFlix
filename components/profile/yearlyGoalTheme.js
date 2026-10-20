// components/profile/yearlyGoalTheme.js
//
// Hedef sayfasının hat renkleri ve simgeleri. Renkler Wrapped'ın film (amber) / dizi (gökyüzü)
// renkleriyle AYNI (components/hub/HubWrappedModule.js rakam şeridi): kullanıcı iki yerde aynı
// türü aynı renkte görür. Yalnız dolgu/simge/çerçeve rengi — metin bu renklerle yazılmaz
// (açık temada amber metin okunmaz).

export const TRACK_VISUAL = Object.freeze({
  movies: Object.freeze({ color: "#FBBF24", icon: "film" }),
  shows: Object.freeze({ color: "#38BDF8", icon: "tv" }),
});

/** Dizi ölçülerinin çip sırası. */
export const SHOW_MEASURE_ORDER = Object.freeze(["shows", "episodes"]);

/** Tempo durumu → simge + renk (rozet ve özet). */
export const PACE_VISUAL = Object.freeze({
  ahead: Object.freeze({ icon: "trending-up", color: "#22C55E" }),
  onTrack: Object.freeze({ icon: "checkmark-circle", color: "#22C55E" }),
  behind: Object.freeze({ icon: "trending-down", color: "#F59E0B" }),
  done: Object.freeze({ icon: "trophy", color: "#FBBF24" }),
});

/** Bilinmeyen/uç durumları (missed, upcoming) "tam tempoda"ya düşürür. */
export const paceVisualOf = (pace) => PACE_VISUAL[pace] || PACE_VISUAL.onTrack;
