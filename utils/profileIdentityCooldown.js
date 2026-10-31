// utils/profileIdentityCooldown.js
//
// Ad / avatar değişikliğine bekleme süresi (1 gün).
//
// NEDEN: kimlik değişikliği `onUserProfileUpdated` ile ~15 yüzeye yayılıyor (gönderiler,
// yorumlar, arkadaş kayıtları, sohbetler, liderlik satırları…). Kullanıcının bütün geçmişi
// yeniden yazıldığı için maliyet kişinin içerik sayısıyla büyüyor; sık değiştiren biri bunu
// her seferinde ödetiyordu. Bkz. docs/maliyet/KULLANIM_VE_MALIYET_ANALIZI_2026-11-01.md §3.2.
//
// KAPSAM: yalnız KULLANICININ KENDİ başlattığı değişiklik beklemeye takılır. Sistem yazımları
// (bağlı hesap fotoğrafının tazelenmesi, fotoğraf kaybolunca rastgele avatara düşme) beklemeyi
// ne başlatır ne de ona takılır — kullanıcı onları istemedi.
//
// Kullanıcı adı (`username`) bu kapsamda DEĞİL: onun kendi benzersizlik/çakışma akışı var
// (Usernames koleksiyonu) ve zaten nadiren değişiyor.

export const IDENTITY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Değişince kimlik yayılımını tetikleyen kök alanlar (functions/profileIdentity.js ile aynı küme). */
export const IDENTITY_FIELDS = Object.freeze(["displayName", "avatarIndex", "photoURL"]);

/** Bu yazım kimlik alanlarından birine dokunuyor mu? */
export function touchesIdentity(patch) {
  if (!patch || typeof patch !== "object") return false;
  return IDENTITY_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(patch, field));
}

/** Firestore Timestamp | {seconds} | sayı | ISO metin → ms; çözülemezse null. */
export function toMillis(value) {
  if (value == null) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
  if (Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Beklemenin bitmesine kalan süre (ms); serbestse 0.
 * Damga yoksa (hiç değiştirmemiş ya da alan eski hesapta yok) 0 — kimse ilk değişikliği
 * beklemez. Damga gelecekteyse (cihaz saati geri alınmış / sunucu damgası henüz çözülmemiş)
 * tam süre beklenir: saati geriye almak beklemeyi atlatmasın.
 */
export function cooldownRemainingMs(lastChangedAt, now = Date.now()) {
  const last = toMillis(lastChangedAt);
  if (last == null) return 0;
  const elapsed = now - last;
  if (elapsed < 0) return IDENTITY_COOLDOWN_MS;
  return elapsed >= IDENTITY_COOLDOWN_MS ? 0 : IDENTITY_COOLDOWN_MS - elapsed;
}

/**
 * Kalan süreyi kullanıcıya gösterilecek parçaya çevirir.
 * 1 saatten uzunsa saat (yukarı yuvarlanır), kısaysa dakika (en az 1).
 * @returns {{ unit: "hour"|"minute", value: number }}
 */
export function cooldownParts(remainingMs) {
  const ms = Math.max(0, Number(remainingMs) || 0);
  if (ms >= 60 * 60 * 1000) return { unit: "hour", value: Math.ceil(ms / (60 * 60 * 1000)) };
  return { unit: "minute", value: Math.max(1, Math.ceil(ms / (60 * 1000))) };
}
