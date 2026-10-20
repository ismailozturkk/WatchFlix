// utils/decorScopes.js
//
// "Hangi efekt hangi ekranlarda görünsün" kararının SAF mantığı. Burada RN
// importu YOK (jest yalnız saf modülleri test edebiliyor, bkz. jest.config.js).
//
// KAVRAMLAR
//   efekt  : üç arka plan dekoru — kar, ikon deseni, ambiyans.
//   grup   : ekranların kümesi (ör. "chat" = mesajlar + gruplar + sohbet ekranı).
//            Her ekran <ScreenDecor scope="chat" /> ile bir gruba bağlanır.
//   gizli  : kullanıcının kapattığı (efekt, grup) çiftleri.
//
// NEDEN "GİZLİ" LİSTESİ SAKLANIYOR, "GÖRÜNÜR" DEĞİL: varsayılan her efektin her
// yerde görünmesi (bugünkü davranış) ve yarın yeni bir grup eklenirse, eski
// kayıtlı tercihin onu SESSİZCE kapalı bırakmaması. Boş kayıt = her yerde.
//
// Genel anahtar (Kişiselleştirme'deki kar/ikon/ambiyans düğmesi) bunun ÜSTÜNDE:
// efekt orada kapalıysa gruplar açık olsa da hiçbir yerde görünmez. Bu modül
// yalnız grup bazını bilir.

/** Üç dekor efekti. Sıra, ayar ekranındaki sütun sırasıdır. */
export const DECOR_EFFECTS = Object.freeze(["snow", "icon", "ambient"]);

/**
 * Ekran grupları. Sıra, ayar ekranındaki satır sırasıdır. `icon` Ionicons adı.
 * Etiketler/örnekler çeviri gerektirdiği için ayar ekranında
 * (screens/tabs/settings/DecorScopesScreen.js).
 *
 * `effects` (isteğe bağlı): grubun DESTEKLEDİĞİ efektler; yoksa üçü de. Bir
 * grup bir efekti hiç çizemiyorsa burada belirtilir — ayar ekranı o kutuyu
 * soluk çizer, süzgeç de o efekti asla göstermez. Şu an tek örnek "conversation":
 * kar yok (okuma alanında dikkat dağıtır; ayrıca sürekli Lottie, mesaj
 * alanındaki Android blur hedefinin içinde oynardı).
 *
 * YENİ GRUP: buraya ekle + ayar ekranına metnini ekle. Bir ekrana
 * `<ScreenDecor scope="…" />` verirken buradaki kimliklerden birini kullan
 * (bkz. __tests__/decorScopes.test.js — bilinmeyen kimlik testi kırar).
 */
export const DECOR_SCOPES = Object.freeze(
  [
    { id: "home", icon: "home-outline" },
    { id: "search", icon: "search-outline" },
    { id: "details", icon: "film-outline" },
    { id: "lists", icon: "albums-outline" },
    { id: "chat", icon: "chatbubbles-outline" },
    {
      id: "conversation",
      icon: "chatbubble-ellipses-outline",
      effects: ["icon", "ambient"],
    },
    { id: "social", icon: "share-social-outline" },
    { id: "profile", icon: "people-outline" },
    { id: "settings", icon: "settings-outline" },
    { id: "more", icon: "game-controller-outline" },
    { id: "auth", icon: "log-in-outline" },
  ].map((scope) =>
    Object.freeze({
      ...scope,
      effects: Object.freeze(scope.effects ? [...scope.effects] : [...DECOR_EFFECTS]),
    }),
  ),
);

export const DECOR_SCOPE_IDS = Object.freeze(DECOR_SCOPES.map((s) => s.id));

const EFFECT_SET = new Set(DECOR_EFFECTS);
const SCOPE_SET = new Set(DECOR_SCOPE_IDS);
const SCOPE_BY_ID = new Map(DECOR_SCOPES.map((s) => [s.id, s]));

export const isDecorEffect = (effect) => EFFECT_SET.has(effect);
export const isDecorScope = (scope) => SCOPE_SET.has(scope);

/** Grup bu efekti çizebiliyor mu? Bilinmeyen grup/efekt için false. */
export const decorScopeSupports = (scope, effect) =>
  Boolean(SCOPE_BY_ID.get(scope)?.effects.includes(effect));

/** Bir efekti destekleyen grupların kimlikleri (ayar sırasıyla). */
export const decorScopesFor = (effect) =>
  DECOR_SCOPE_IDS.filter((id) => decorScopeSupports(id, effect));

const emptyHidden = () => ({ snow: [], icon: [], ambient: [] });

/**
 * Depodan okunan ham değeri güvenli biçime çevirir. Bozuk/eksik/eski kayıt asla
 * hata vermez: bilinmeyen efekt ve grup kimlikleri atılır, grubun desteklemediği
 * efekt çiftleri (ör. conversation + snow) atılır, tekrarlar silinir, sıra
 * kanonik hale gelir (aynı küme = aynı JSON → gereksiz yazım olmaz).
 *
 * @returns {{snow: string[], icon: string[], ambient: string[]}}
 */
export function normalizeDecorScopes(raw) {
  const out = emptyHidden();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const effect of DECOR_EFFECTS) {
    const list = raw[effect];
    if (!Array.isArray(list)) continue;
    out[effect] = decorScopesFor(effect).filter((id) => list.includes(id));
  }
  return out;
}

/**
 * Bir efekt bu grupta görünür mü? `scope` verilmemişse FİLTRE YOK (görünür):
 * gruba bağlanmamış ekranlar (ör. tanıtım) yalnız genel anahtara uyar.
 */
export function isDecorVisible(hidden, effect, scope) {
  if (!scope) return true;
  const list = hidden && hidden[effect];
  return !(Array.isArray(list) && list.includes(scope));
}

/**
 * Bir ekranın üç efekti için görünürlük. `effects` verilirse yalnız onlar
 * değerlendirilir, kalanlar false döner (ör. yorum paneli yalnız ikon deseni
 * ister). Grubun desteklemediği efekt (bkz. DECOR_SCOPES `effects`) kullanıcı
 * seçimi ne olursa olsun false'tur. Grupsuz/bilinmeyen `scope` için destek
 * süzgeci uygulanmaz.
 */
export function decorVisibility(hidden, scope, effects) {
  const wanted = Array.isArray(effects) ? new Set(effects) : null;
  const known = isDecorScope(scope);
  const out = {};
  for (const effect of DECOR_EFFECTS) {
    out[effect] =
      (!wanted || wanted.has(effect)) &&
      (!known || decorScopeSupports(scope, effect)) &&
      isDecorVisible(hidden, effect, scope);
  }
  return out;
}

/**
 * Tek bir (efekt, grup) çiftini açar/kapatır. Yeni, normalize nesne döner.
 * Grubun desteklemediği çift (ör. conversation + snow) yok sayılır.
 */
export function setDecorVisible(hidden, effect, scope, visible) {
  const next = normalizeDecorScopes(hidden);
  if (!isDecorEffect(effect) || !decorScopeSupports(scope, effect)) return next;
  const rest = next[effect].filter((id) => id !== scope);
  return normalizeDecorScopes({
    ...next,
    [effect]: visible ? rest : [...rest, scope],
  });
}

/** Bir efekti, onu DESTEKLEYEN tüm gruplarda açar ya da kapatır. */
export function setDecorEffectVisible(hidden, effect, visible) {
  const next = normalizeDecorScopes(hidden);
  if (!isDecorEffect(effect)) return next;
  next[effect] = visible ? [] : decorScopesFor(effect);
  return next;
}

/** Efekt hiçbir grupta gizlenmemiş mi (her yerde açık)? */
export function isDecorEffectEverywhere(hidden, effect) {
  return normalizeDecorScopes(hidden)[effect]?.length === 0;
}

/** Efekt, onu destekleyen tüm gruplarda gizli mi? */
export function isDecorEffectNowhere(hidden, effect) {
  return (
    normalizeDecorScopes(hidden)[effect]?.length === decorScopesFor(effect).length
  );
}

/** Varsayılandan (her yerde) sapma var mı — "Özel" rozeti ve sıfırlama için. */
export function isDecorCustomized(hidden) {
  const n = normalizeDecorScopes(hidden);
  return DECOR_EFFECTS.some((effect) => n[effect].length > 0);
}

/** Kaç (efekt, grup) çifti gizli — özet metni için. */
export function countHiddenDecor(hidden) {
  const n = normalizeDecorScopes(hidden);
  return DECOR_EFFECTS.reduce((sum, effect) => sum + n[effect].length, 0);
}
