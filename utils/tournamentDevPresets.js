// utils/tournamentDevPresets.js
//
// __DEV__ turnuva faz önizlemesi: gerçek zamanı (tournamentService.setDebugNow) bu
// ayın ilgili gününe sabitler. Hem TournamentScreen'in üstteki DEV şeridi hem de
// Ayarlar > Geliştirici Laboratuvarı aynı listeyi kullanır. `offset` = dönem
// başından gün, `tab` = açılacak tur sekmesi (null: dokunma).
export const TOURNAMENT_DEV_PRESETS = Object.freeze([
  { key: "real", label: "Gerçek", offset: null, tab: null },
  { key: "sel", label: "Seçim", offset: 2, tab: 0 },
  { key: "r32", label: "Son 32", offset: 8, tab: 0 },
  { key: "r16", label: "Son 16", offset: 10, tab: 1 },
  { key: "qf", label: "Çeyrek", offset: 12, tab: 2 },
  { key: "sf", label: "Yarı", offset: 14, tab: 3 },
  { key: "final", label: "Final", offset: 18, tab: 4 },
  { key: "res", label: "Sonuç", offset: 24, tab: 4 },
]);

export const findTournamentDevPreset = (key) =>
  TOURNAMENT_DEV_PRESETS.find((p) => p.key === key) || null;
