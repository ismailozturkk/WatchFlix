// utils/listCoverStyle.js
//
// Liste kapak görünümü ("Liste Görünümü Seçin") profil belgesinde de saklanır,
// böylece arkadaş profilindeki liste rayı profil SAHİBİNİN seçtiği düzende
// çizilir. Cihazdaki asıl kayıt MMKV'de (listGridStyle / allCornersRounded /
// listLayoutDirections); bulut kopyası yalnız gösterim içindir.
//
// SAKLAMA: Users/{uid}.listCoverStyle = { gridStyle: 1–14, rounded: bool, direction: "left"|"right" }

export const LIST_COVER_STYLE_FIELD = "listCoverStyle";

const MIN_STYLE = 1;
const MAX_STYLE = 14;
const DIRECTIONAL_STYLES = [8, 10, 11];

const isStyleId = (v) => Number.isInteger(v) && v >= MIN_STYLE && v <= MAX_STYLE;

// Yerel tercihlerden profile yazılacak yük. Geçersiz düzende null.
export function buildListCoverStyle({ gridStyle, allCornersRounded, listLayoutDirections }) {
  if (!isStyleId(gridStyle)) return null;
  const dir = listLayoutDirections?.[gridStyle];
  return {
    gridStyle,
    rounded: !!allCornersRounded,
    direction: DIRECTIONAL_STYLES.includes(gridStyle) && dir === "left" ? "left" : "right",
  };
}

// Profil belgesinden okunan değeri doğrular; bozuk/eksikse null (çağıran
// kendi varsayılanına düşer).
export function readListCoverStyle(profile) {
  const raw = profile?.[LIST_COVER_STYLE_FIELD];
  if (!raw || typeof raw !== "object" || !isStyleId(raw.gridStyle)) return null;
  return {
    gridStyle: raw.gridStyle,
    rounded: raw.rounded === true,
    direction: raw.direction === "left" ? "left" : "right",
  };
}

export const sameListCoverStyle = (a, b) =>
  !!a && !!b && a.gridStyle === b.gridStyle && a.rounded === b.rounded && a.direction === b.direction;
