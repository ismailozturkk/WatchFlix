// services/typographySettings.js
//
// Rol bazlı yazı tipi tercihinin (BAŞLIK / NORMAL YAZI / RAKAM) TEK KAYNAĞI.
//
// NEDEN CONTEXT DEĞİL DE STORE: bu değeri okuyan yer uygulamadaki HER metin
// (2200'den fazla <Text>). Tercihi ağacın tepesindeki bir provider'da tutmak,
// yazı tipi değişiminde tüm alt ağacı yeniden çizmek demekti; burada değer bir
// abonelik kaynağı — yalnız metin bileşenleri abone olur ve yalnız onlar
// yeniden çizilir. Aynı gerekçe services/effectSettings.js'te de yazılı.
//
// Font DOSYALARININ yüklenmesi hâlâ React tarafında (expo-font/useFonts,
// bkz. context/TypographyContext.js); provider yükleme bitince buraya
// `setFontsLoaded(true)` der. Böylece metin bileşeni tek bir kaynağa abone olur.
import { useSyncExternalStore } from "react";
import {
  DEFAULT_FONT_ROLES,
  TEXT_ROLES,
  isPresetRecommendedFor,
  isValidPresetId,
  normalizeFontRoles,
} from "../utils/typographyRoles";
import { Keys, get, set, subscribe } from "./storage";

export const FONT_ROLES_STORAGE_KEY = Keys.fontRoles.key;
/** Rol ayrımından önceki tek anahtar; göçte üç role birden taşınır. */
export const LEGACY_FONT_STORAGE_KEY = "appFontFamily";

// MMKV GEÇİŞİ: roller AÇILIŞTA SENKRON okunuyor. Eskiden sistem fontuyla
// başlanıp async okuma sonrası düzeltiliyordu — seçtiği fontu her açılışta bir
// kare boyunca göremeyen kullanıcı deneyimi buradan geliyordu. Hidrasyon
// asenkron olmadığı için "kullanıcı seçimi geç gelen kayıtla ezilmesin"
// koruması (kullaniciSecti) da gereksizleşti.
let durum = Object.freeze({
  ...DEFAULT_FONT_ROLES,
  fontsLoaded: false,
  catalogFontsLoaded: false,
});
const dinleyiciler = new Set();

const yayinla = () => {
  for (const fn of dinleyiciler) fn();
};

// Referans yalnız gerçek bir değişimde değişir: useSyncExternalStore'un
// snapshot karşılaştırması buna dayanır, her okumada yeni nesne dönersek
// sonsuz döngüye gireriz.
const uygula = (yama) => {
  let degisti = false;
  for (const anahtar of Object.keys(yama)) {
    if (durum[anahtar] !== yama[anahtar]) {
      degisti = true;
      break;
    }
  }
  if (!degisti) return;
  durum = Object.freeze({ ...durum, ...yama });
  yayinla();
};

// Kayıtlı rolleri uygular. HEM modül yüklenirken HEM de anahtar değiştiğinde
// çalışır.
//
// Aboneliğin sebebi (bkz. services/effectSettings.js'deki aynı desen): bu modül
// AsyncStorage → MMKV göçünden ÖNCE yüklenebiliyor. İlk okuma boş depoya denk
// gelirse göç anahtarı yazınca abonelik tetiklenir ve kullanıcının fontları
// aynı oturumda gelir. Bu olmadan güncelleme sonrası ilk açılışta sistem
// fontuyla kalınırdı.
//
// Tek fontlu sürümden gelen `appFontFamily` kaydını üç role yayma işi burada
// DEĞİL, tek seferlik göçte (registry: fontRoles.legacy).
const kayittanUygula = () => {
  const kayitli = get(Keys.fontRoles);
  if (!kayitli) return;
  const roller = normalizeFontRoles(kayitli);
  if (!roller) return;
  const yama = {};
  for (const rol of TEXT_ROLES) yama[rol] = roller[rol];
  uygula(yama);
};

kayittanUygula();
subscribe(Keys.fontRoles, kayittanUygula);

const kalicilastir = () => {
  const { fontsLoaded, catalogFontsLoaded, ...roller } = durum;
  // Yazılamadıysa oturum içi seçim yine de geçerli — hata depolama katmanında
  // raporlanır.
  set(Keys.fontRoles, roller);
};

/** Tek bir rolün fontunu değiştirir. Geçersiz rol/preset yok sayılır. */
export function setFontRole(role, presetId, { persist = true } = {}) {
  if (
    !TEXT_ROLES.includes(role) ||
    !isValidPresetId(presetId) ||
    !isPresetRecommendedFor(presetId, role)
  ) return;
  uygula({ [role]: presetId });
  if (persist) kalicilastir();
}

/** Üç rolü birden aynı fonta ayarlar ("Tümüne uygula"). */
export function setAllFontRoles(presetId, { persist = true } = {}) {
  if (
    !isValidPresetId(presetId) ||
    !TEXT_ROLES.every((role) => isPresetRecommendedFor(presetId, role))
  ) return;
  uygula({ heading: presetId, body: presetId, numeric: presetId });
  if (persist) kalicilastir();
}

/**
 * SEÇİLİ rollerin font dosyaları yüklendi. Yüklenmeden özel aile adı vermek
 * metni GÖRÜNMEZ kılabilir; o ana kadar sistem fontu çizilir.
 */
export function setFontsLoaded(yuklendi) {
  uygula({ fontsLoaded: Boolean(yuklendi) });
}

/**
 * Katalogdaki TÜM aileler yüklendi. Açılışta yalnız seçili rollerin dosyaları
 * gelir (fontsLoaded); kalan katalog arka planda yüklenir ve yalnız ayarlardaki
 * font önizlemelerinin beklediği bu bayrakla duyurulur
 * (bkz. context/TypographyContext.js).
 */
export function setCatalogFontsLoaded(yuklendi) {
  uygula({ catalogFontsLoaded: Boolean(yuklendi) });
}

/** React dışı çağıranlar için anlık değer. */
export const getTypographyState = () => durum;

/** Değişimi dinler; abonelikten çıkaran fonksiyonu döner. */
export const subscribeTypography = (fn) => {
  dinleyiciler.add(fn);
  return () => dinleyiciler.delete(fn);
};

const abone = subscribeTypography;

/** {heading, body, numeric, fontsLoaded, catalogFontsLoaded} — tercih değişince abone yeniden çizilir. */
export function useTypographyState() {
  return useSyncExternalStore(abone, getTypographyState, getTypographyState);
}
