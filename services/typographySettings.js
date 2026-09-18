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
//
// PREMIUM KATALOG: kullanıcının SEÇTİĞİ roller (`selected`, diske yazılan)
// ile ÇİZİLEN roller (`heading/body/numeric`) ayrıdır. Premium'a özel bir font
// seçiliyken plan Free'ye düşerse o rol sistem fontuyla çizilir ama seçim
// silinmez; abonelik yenilenince kendiliğinden geri gelir. Okuyucuların
// (AppText, font yükleyici) hiçbiri bu ayrımı bilmek zorunda değil.
import { useSyncExternalStore } from "react";
import {
  DEFAULT_FONT_PRESET,
  DEFAULT_FONT_ROLES,
  TEXT_ROLES,
  isPresetRecommendedFor,
  isValidPresetId,
  normalizeFontRoles,
} from "../utils/typographyRoles";
import { canUseFeature, isFontPresetFree } from "../utils/premiumFeatures";
import { Keys, get, set, subscribe } from "./storage";
import { getPremiumPlanSnapshot, subscribePremiumPlan } from "./premiumState";

export const FONT_ROLES_STORAGE_KEY = Keys.fontRoles.key;
/** Rol ayrımından önceki tek anahtar; göçte üç role birden taşınır. */
export const LEGACY_FONT_STORAGE_KEY = "appFontFamily";

// MMKV GEÇİŞİ: roller AÇILIŞTA SENKRON okunuyor. Eskiden sistem fontuyla
// başlanıp async okuma sonrası düzeltiliyordu — seçtiği fontu her açılışta bir
// kare boyunca göremeyen kullanıcı deneyimi buradan geliyordu. Hidrasyon
// asenkron olmadığı için "kullanıcı seçimi geç gelen kayıtla ezilmesin"
// koruması (kullaniciSecti) da gereksizleşti.
const katalogAcik = (plan) => Boolean(canUseFeature("font_catalog", plan));

// Kullanıcının seçimi (diske yazılan). Çizilen roller bundan türetilir.
let secili = Object.freeze({ ...DEFAULT_FONT_ROLES });
let premiumFontlar = katalogAcik(getPremiumPlanSnapshot());

const cizilen = (presetId) =>
  premiumFontlar || isFontPresetFree(presetId) ? presetId : DEFAULT_FONT_PRESET;

const cizilenRoller = () => {
  const roller = {};
  for (const rol of TEXT_ROLES) roller[rol] = cizilen(secili[rol]);
  return roller;
};

let durum = Object.freeze({
  ...cizilenRoller(),
  selected: secili,
  premiumFontsAllowed: premiumFontlar,
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

// Seçim ya da premium izni değişince çizilen rolleri yeniden kurar. `secili`
// yalnız gerçekten değişince yeni nesne olur (bkz. seciliGuncelle), bu yüzden
// referans karşılaştırması yeterli.
const yenidenKur = () => {
  uygula({
    ...cizilenRoller(),
    selected: secili,
    premiumFontsAllowed: premiumFontlar,
  });
};

const seciliGuncelle = (yama) => {
  const degisen = Object.keys(yama).some((rol) => secili[rol] !== yama[rol]);
  if (degisen) secili = Object.freeze({ ...secili, ...yama });
  yenidenKur();
};

subscribePremiumPlan((plan) => {
  premiumFontlar = katalogAcik(plan);
  yenidenKur();
});

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
  seciliGuncelle(yama);
};

kayittanUygula();
subscribe(Keys.fontRoles, kayittanUygula);

const kalicilastir = () => {
  // ÇİZİLEN değil SEÇİLEN roller yazılır: Free'ye düşmüş kullanıcının premium
  // seçimi diskte kalmalı ki abonelik yenilenince geri gelsin. Yazılamadıysa
  // oturum içi seçim yine de geçerli — hata depolama katmanında raporlanır.
  set(Keys.fontRoles, { ...secili });
};

/** Font bu planda seçilebilir mi (ücretsiz set veya açık premium katalog)? */
export const isFontSelectable = (presetId) =>
  premiumFontlar || isFontPresetFree(presetId);

/**
 * Tek bir rolün fontunu değiştirir. Geçersiz rol/preset ve plana kapalı
 * premium font yok sayılır; uygulandıysa true döner.
 */
export function setFontRole(role, presetId, { persist = true } = {}) {
  if (
    !TEXT_ROLES.includes(role) ||
    !isValidPresetId(presetId) ||
    !isPresetRecommendedFor(presetId, role) ||
    !isFontSelectable(presetId)
  ) return false;
  seciliGuncelle({ [role]: presetId });
  if (persist) kalicilastir();
  return true;
}

/** Üç rolü birden aynı fonta ayarlar ("Tümüne uygula"); uygulandıysa true. */
export function setAllFontRoles(presetId, { persist = true } = {}) {
  if (
    !isValidPresetId(presetId) ||
    !TEXT_ROLES.every((role) => isPresetRecommendedFor(presetId, role)) ||
    !isFontSelectable(presetId)
  ) return false;
  seciliGuncelle({ heading: presetId, body: presetId, numeric: presetId });
  if (persist) kalicilastir();
  return true;
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

/**
 * {heading, body, numeric (ÇİZİLEN), selected (SEÇİLEN), premiumFontsAllowed,
 *  fontsLoaded, catalogFontsLoaded} — tercih değişince abone yeniden çizilir.
 */
export function useTypographyState() {
  return useSyncExternalStore(abone, getTypographyState, getTypographyState);
}
