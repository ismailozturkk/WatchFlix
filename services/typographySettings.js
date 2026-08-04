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
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_FONT_ROLES,
  TEXT_ROLES,
  isPresetRecommendedFor,
  isValidPresetId,
  normalizeFontRoles,
} from "../utils/typographyRoles";

export const FONT_ROLES_STORAGE_KEY = "appFontRoles";
/** Rol ayrımından önceki tek anahtar; ilk açılışta üç role birden taşınır. */
export const LEGACY_FONT_STORAGE_KEY = "appFontFamily";

let durum = Object.freeze({ ...DEFAULT_FONT_ROLES, fontsLoaded: false });
// Kullanıcı hidrasyon tamamlanmadan seçim yaparsa geç gelen kayıt onu EZMESİN.
// Koruma ROL BAZINDA: tek bir rolü değiştirmek, diskteki DİĞER iki rolün geri
// yüklenmesini engellememeli (yoksa dokunulmayan roller sessizce sıfırlanırdı).
const kullaniciSecti = new Set();
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

const kayittanOku = async () => {
  const [ham, eski] = await Promise.all([
    AsyncStorage.getItem(FONT_ROLES_STORAGE_KEY),
    AsyncStorage.getItem(LEGACY_FONT_STORAGE_KEY),
  ]);
  if (ham) {
    try {
      return normalizeFontRoles(JSON.parse(ham));
    } catch {
      /* bozuk kayıt → eski anahtara, oradan da varsayılana düş */
    }
  }
  // GERİYE DÖNÜK TAŞIMA: tek fontlu sürümden gelen kullanıcı seçimini
  // kaybetmesin. Font yalnız uygun olduğu rollere taşınır; diğerleri sistemde
  // kalır (ör. Monoton gövde metnine uygulanmaz).
  if (isValidPresetId(eski)) {
    return normalizeFontRoles({ heading: eski, body: eski, numeric: eski });
  }
  return null;
};

kayittanOku()
  .then((roller) => {
    if (!roller) return;
    const yama = {};
    for (const rol of TEXT_ROLES) {
      if (!kullaniciSecti.has(rol)) yama[rol] = roller[rol];
    }
    uygula(yama);
  })
  .catch(() => {
    /* kayıt okunamadı → sistem fontuyla devam */
  });

const kalicilastir = () => {
  const { fontsLoaded, ...roller } = durum;
  AsyncStorage.setItem(FONT_ROLES_STORAGE_KEY, JSON.stringify(roller)).catch(
    () => {
      /* yazılamadıysa oturum içi seçim yine de geçerli */
    },
  );
};

/** Tek bir rolün fontunu değiştirir. Geçersiz rol/preset yok sayılır. */
export function setFontRole(role, presetId, { persist = true } = {}) {
  if (
    !TEXT_ROLES.includes(role) ||
    !isValidPresetId(presetId) ||
    !isPresetRecommendedFor(presetId, role)
  ) return;
  kullaniciSecti.add(role);
  uygula({ [role]: presetId });
  if (persist) kalicilastir();
}

/** Üç rolü birden aynı fonta ayarlar ("Tümüne uygula"). */
export function setAllFontRoles(presetId, { persist = true } = {}) {
  if (
    !isValidPresetId(presetId) ||
    !TEXT_ROLES.every((role) => isPresetRecommendedFor(presetId, role))
  ) return;
  for (const role of TEXT_ROLES) kullaniciSecti.add(role);
  uygula({ heading: presetId, body: presetId, numeric: presetId });
  if (persist) kalicilastir();
}

/**
 * Font dosyaları yüklendi. Yüklenmeden özel aile adı vermek metni GÖRÜNMEZ
 * kılabilir; o ana kadar sistem fontu çizilir.
 */
export function setFontsLoaded(yuklendi) {
  uygula({ fontsLoaded: Boolean(yuklendi) });
}

/** React dışı çağıranlar için anlık değer. */
export const getTypographyState = () => durum;

/** Değişimi dinler; abonelikten çıkaran fonksiyonu döner. */
export const subscribeTypography = (fn) => {
  dinleyiciler.add(fn);
  return () => dinleyiciler.delete(fn);
};

const abone = subscribeTypography;

/** {heading, body, numeric, fontsLoaded} — tercih değişince abone yeniden çizilir. */
export function useTypographyState() {
  return useSyncExternalStore(abone, getTypographyState, getTypographyState);
}
