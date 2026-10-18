// utils/discoverMedia.js
//
// Film/Dizi sekmesinin (screens/tabs/DiscoverScreen.js) iki bölümü. Saf değerler:
// ekran, geçiş anahtarı (components/home/MediaTypeSwitch.js) ve saklanan tercih
// (services/storage/registry.js `homeMediaType`) aynı listeyi buradan okur.

/** Bölüm anahtarları — aynı zamanda keşif bileşenlerinin `mediaType` değerleri. */
export const MEDIA_TYPES = Object.freeze(["tv", "movie"]);

/** Hiçbir şey saklanmamışken (ilk açılış) görünen bölüm: eskiden de ilk sekme Diziydi. */
export const DEFAULT_MEDIA_TYPE = "tv";

/** Bilinmeyen/bozuk değeri (eski kayıt, elle düzenlenmiş yedek) varsayılana çeker. */
export const normalizeMediaType = (value) => (MEDIA_TYPES.includes(value) ? value : DEFAULT_MEDIA_TYPE);
