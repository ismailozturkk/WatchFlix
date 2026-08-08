// utils/ageGate.js
//
// Doğum tarihi → yaş → "yetişkin içerik" izni. Tek doğru kaynak burası.
//
// NEDEN DOĞUM TARİHİ, YAŞ DEĞİL: kayıt formunda "yaş" sormak en kısa yol ama
// diske DÜŞEN sayı bir yıl sonra yanlış oluyor — 17 yaşında kaydolan kullanıcı
// 18'ine girdiğinde profilinde hâlâ 17 yazıyor ve ayar sonsuza dek kilitli
// kalıyor. Doğum tarihi saklanıp yaş her okumada türetilince kilit kendi
// kendine ve doğru günde açılıyor. Formda kullanıcıya yine yaşı gösteriliyor.
//
// İKİ SORU, İKİSİ BİRBİRİNİN DEĞİLİ DEĞİL:
//
//   isAdultBirthDate(x)      → "bu tarih 18+ olduğunu KANITLIYOR mu?"
//   isAgeRestrictedProfile(x)→ "bu tarih 18 ALTI olduğunu kanıtlıyor mu?"
//
// Tarih bilinmiyorsa (null/bozuk) İKİSİ DE false döner. Kasıtlı:
//   • Kayıt formu `isAdultBirthDate` kullanır → tarih girilmeden ilerlenemez.
//   • Yetişkin içerik kapısı `isAgeRestrictedProfile` kullanır → bu alan
//     eklenmeden önce kaydolmuş MEVCUT kullanıcılar kısıtlanmaz. Aksi hâlde
//     sürüm günü bütün eski hesaplar ayarı kaybederdi.

import { Keys, get, remove, set } from "../services/storage";

/** 18 — yetişkin içerik için alt sınır. */
export const MIN_ADULT_AGE = 18;

/**
 * 13 — hesap açmak için alt sınır (2026-08-08 kullanıcı kararı).
 *
 * Neden 13: COPPA'nın "çocuk" eşiği. Uygulamada DM, grup sohbeti ve kullanıcı
 * üretimi içerik var; 13 altına hesap açtırmak Play hedef kitle beyanı ve IARC
 * derecelendirmesiyle tutarsız kalırdı. 13-17 arası kullanıcılar yetişkin
 * içerik kapısıyla (MIN_ADULT_AGE) ayrıca korunuyor.
 *
 * DEĞER MAĞAZA FORMLARINA DA GİRİYOR — burada değiştirilirse Play Console
 * hedef kitle beyanı ve IARC anketi de güncellenmeli.
 */
export const MIN_REGISTER_AGE = 13;

/** Makul doğum yılı aralığı (form doğrulaması). */
export const MAX_AGE = 120;

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const iki = (n) => String(n).padStart(2, "0");

/**
 * Gün/ay/yıl → "YYYY-MM-DD". Takvimde gerçekten var olmayan tarih (31 Şubat,
 * 30 Şubat, artık yılı olmayan 29 Şubat) `null` döner — `new Date(2025, 1, 31)`
 * sessizce 3 Mart'a taşıyor, o yüzden geri okuyup karşılaştırıyoruz.
 *
 * @returns {string|null}
 */
export function formatBirthDate(day, month, year) {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const probe = new Date(y, m - 1, d);
  if (
    probe.getFullYear() !== y ||
    probe.getMonth() !== m - 1 ||
    probe.getDate() !== d
  ) {
    return null;
  }
  return `${y}-${iki(m)}-${iki(d)}`;
}

/**
 * "YYYY-MM-DD" → { year, month, day }. Biçim bozuksa ya da tarih takvimde
 * yoksa `null`.
 */
export function parseBirthDate(value) {
  if (typeof value !== "string") return null;
  const match = ISO_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  // formatBirthDate ile aynı takvim kontrolünden geçir.
  if (!formatBirthDate(d, m, y)) return null;
  return { year: Number(y), month: Number(m), day: Number(d) };
}

/**
 * Tam yıl olarak yaş. Doğum günü bu yıl henüz gelmemişse bir eksiği döner.
 * Geçersiz tarih ya da gelecekteki tarih → `null`.
 *
 * @param {string} value "YYYY-MM-DD"
 * @param {Date} [now] testler için enjekte edilebilir
 * @returns {number|null}
 */
export function calculateAge(value, now = new Date()) {
  const parts = parseBirthDate(value);
  if (!parts) return null;
  if (Number.isNaN(now?.getTime?.())) return null;

  let age = now.getFullYear() - parts.year;
  const ayFarki = now.getMonth() + 1 - parts.month;
  if (ayFarki < 0 || (ayFarki === 0 && now.getDate() < parts.day)) age -= 1;

  if (age < 0 || age > MAX_AGE) return null;
  return age;
}

/** Tarih 18+ olduğunu kanıtlıyor mu? Bilinmiyorsa false (bkz. dosya başı). */
export function isAdultBirthDate(value, now) {
  const age = calculateAge(value, now);
  return age !== null && age >= MIN_ADULT_AGE;
}

/** Tarih 18 ALTI olduğunu kanıtlıyor mu? Bilinmiyorsa false (bkz. dosya başı). */
export function isAgeRestrictedProfile(birthDate, now) {
  const age = calculateAge(birthDate, now);
  return age !== null && age < MIN_ADULT_AGE;
}

/**
 * Bu doğum tarihiyle hesap açılabilir mi?
 *
 * Yetişkin içerik kapısının aksine burada "bilinmiyor" GEÇERLİ SAYILMAZ:
 * orada bilinmezlik kısıtı açık bırakıyor (kullanıcıyı korumak için), burada
 * ise kaydı engelliyor — geçersiz/eksik tarihle hesap açılmamalı. Tarih
 * seçici zaten yalnız var olan tarihleri üretiyor, yani bu yalnızca ikinci
 * kapı.
 *
 * @returns {boolean} tarih geçerli VE yaş >= MIN_REGISTER_AGE
 */
export function canRegister(birthDate, now) {
  const age = calculateAge(birthDate, now);
  return age !== null && age >= MIN_REGISTER_AGE;
}

/* ------------------------------------------------------------------ */
/* Cihaz aynası                                                        */
/* ------------------------------------------------------------------ */
//
// Gerçek doğum tarihi Users/{uid}.birthDate'te. Ama yetişkin içerik süzgeci
// (utils/tmdbAdultGuard.js) her istekte SENKRON bir cevap istiyor ve Firestore
// asenkron. Bu yüzden profil yüklendiğinde TÜRETİLMİŞ tek bir bayrak diske
// yazılıyor: "oturumdaki hesap 18 altı mı?".
//
// Doğum tarihinin kendisi cihaza yazılmıyor — kapı için gereken tek bilgi bu
// boolean, gereksiz kişisel veriyi diskte tutmuyoruz.
//
// `session` deposunda: çıkışta clearUserScope zaten bu depoyu komple
// boşaltıyor, yani bayrak bir sonraki hesaba sızmıyor ve ayrı temizlik koduna
// gerek kalmıyor. Kaybı zararsız — sonraki girişte profilden yeniden türetilir.

/** Oturumdaki hesap yaş kısıtlı mı? Bilinmiyorsa `false`. */
export function isAgeRestricted() {
  return get(Keys.ageRestricted) === true;
}

/**
 * Yetişkin içerik ŞU AN gösterilebilir mi? İki koşul birden: ayar açık olacak
 * VE hesap yaş kısıtlı olmayacak.
 *
 * `Keys.adultContent`i çıplak okuyan her yer bu kuralı tekrar etmek zorunda
 * kalırdı; ayar merkezîleştirilmeden önce tam olarak bu tür bir dağınıklık
 * yüzünden bazı çağrı yerleri ayarı hiç dikkate almıyordu (bkz.
 * utils/tmdbAdultGuard.js dosya başı).
 */
export function adultContentAllowed() {
  return get(Keys.adultContent) === true && !isAgeRestricted();
}

/**
 * Profilden gelen doğum tarihine göre cihaz aynasını tazeler.
 * `birthDate` yoksa (eski hesap) kısıt kaldırılır.
 *
 * @param {string|null|undefined} birthDate "YYYY-MM-DD"
 * @returns {boolean} yeni kısıt durumu
 */
export function syncAgeRestriction(birthDate) {
  const restricted = isAgeRestrictedProfile(birthDate);
  set(Keys.ageRestricted, restricted);
  return restricted;
}

/** Oturum kapandığında bayrağı düşürür. */
export function clearAgeRestriction() {
  remove(Keys.ageRestricted);
}
