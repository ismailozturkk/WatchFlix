// utils/avatarPhotos.js
//
// Avatar SEÇİMİ ve bağlı hesap fotoğraflarının SAF kararları. Firebase/RN'e
// bağlı değil; test edilebilir (bkz. __tests__/avatarPhotos.test.js).
//
// Model — Users/{uid} kök belgesi:
//   avatarIndex  0..55 hazır avatar, -1 = fotoğraf (CUSTOM_AVATAR_INDEX)
//   photoURL     fotoğrafın adresi (yalnız avatarIndex -1 iken GÖSTERİLİR)
//   photoSource  fotoğrafın geldiği bağlı hesap ("google.com"…). Sağlayıcıdaki
//                fotoğraf değişince ya da bağlantı kaldırılınca avatarın neye
//                göre tazeleneceğini bu söyler. Eski hesaplarda yoktur;
//                `inferPhotoSource` adresten çıkarır ve senkron geri yazar.
//                "tmdb.person" (PERSON_PHOTO_SOURCE) = oyuncu/yönetmen
//                fotoğrafı: bağlı hesap DEĞİL, senkron ona hiç dokunmaz.
//   photoPerson  yalnız kişi fotoğrafında: { id, name } (TMDB kişi). Önizlemede
//                "kimin fotoğrafı" etiketi ve kişi sayfasına geçiş için.
//
// Bir "avatar seçimi" her yerde aynı biçimdedir:
//   { avatarIndex, photoURL, photoSource, photoPerson? }
// Hazır avatarda photoURL/photoSource null'dır; photoPerson yalnız kişi
// fotoğrafında bulunur (anahtar başka seçimde hiç yoktur).

import {
  AVATAR_COUNT,
  CUSTOM_AVATAR_INDEX,
  DEFAULT_AVATAR_INDEX,
  clampAvatarIndex,
  isTmdbPhotoUrl,
  tmdbPersonPhotoUrl,
  tmdbPhotoFile,
} from "./avatars";

// Oyuncu / yönetmen fotoğrafı avatarının kaynak adı. Sağlayıcı kimliklerinden
// ("google.com") ayrı tutulur: planAvatarPhotoSync bunu bağlı hesap sanıp
// "hesap kaldırılmış" diye avatarı geri çevirmesin.
export const PERSON_PHOTO_SOURCE = "tmdb.person";

export const isPersonPhotoSource = (source) => source === PERSON_PHOTO_SOURCE;

const PERSON_NAME_MAX = 120;

/** { id, name } — geçerli TMDB kişisi değilse null. */
export function normalizePhotoPerson(person) {
  if (!person || typeof person !== "object") return null;
  const id = Number(person.id);
  const name = typeof person.name === "string" ? person.name.trim().slice(0, PERSON_NAME_MAX) : "";
  if (!Number.isInteger(id) || id <= 0 || !name) return null;
  return { id, name };
}

/**
 * TMDB kişisinden (arama sonucu, favori oyuncu girişi, takip kaydı) avatar
 * seçimi. Yetişkin işaretli ya da fotoğrafsız kişi avatar olamaz → null.
 * Avatar herkese görünür: yetişkin içerik ayarı açık olsa bile süzülür.
 */
export function personAvatarChoice(person) {
  if (!person || typeof person !== "object" || person.adult === true) return null;
  const photoURL = tmdbPersonPhotoUrl(person.profile_path ?? person.photo ?? person.image ?? null);
  const who = normalizePhotoPerson({ id: person.id, name: person.name ?? person.title });
  if (!photoURL || !who) return null;
  return {
    avatarIndex: CUSTOM_AVATAR_INDEX,
    photoURL,
    photoSource: PERSON_PHOTO_SOURCE,
    photoPerson: who,
  };
}

// Fotoğraf verebilen sağlayıcılar, seçicide gösterim sırasıyla. Apple profil
// fotoğrafı VERMEZ (Sign in with Apple yalnız ad + e-posta paylaşır); listede
// durması ileride bir gün gelirse kendiliğinden çalışsın diye.
export const PHOTO_PROVIDER_ORDER = [
  "google.com",
  "apple.com",
  "facebook.com",
  "twitter.com",
  "github.com",
];

// Fotoğrafı olmayan / avatar kaynağı sayılmayan giriş yöntemleri.
const NON_PHOTO_PROVIDERS = new Set(["password", "phone", "firebase"]);

const GOOGLE_PHOTO_HOST = /(^|\.)(googleusercontent\.com|ggpht\.com)$/i;

function cleanUrl(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function hostOf(url) {
  const match = /^https?:\/\/([^/?#]+)/i.exec(url || "");
  return match ? match[1].toLowerCase() : "";
}

export function isGooglePhotoUrl(url) {
  const clean = cleanUrl(url);
  return !!clean && GOOGLE_PHOTO_HOST.test(hostOf(clean));
}

/**
 * Aynı fotoğrafın farklı boyut istekleri tek anahtara iner. Google aynı resmi
 * `=s96-c`, `=s500-c`, `?sz=50` ya da `/s96-c/` yol parçasıyla verir; yalnız
 * boyut farkı "fotoğraf değişti" sayılırsa her açılışta gereksiz yazım ve tüm
 * sosyal yüzeylere fan-out olurdu.
 */
export function photoKey(url) {
  const clean = cleanUrl(url);
  if (!clean) return null;
  // TMDB aynı resmi /w185/, /h632/ … boyutlarıyla verir; dosya adı kimliktir.
  const tmdbFile = tmdbPhotoFile(clean);
  if (tmdbFile) return `tmdb:${tmdbFile}`;
  if (!isGooglePhotoUrl(clean)) return clean;
  return clean
    .replace(/[?&]sz=\d+/i, "")
    .replace(/=s\d+(-[a-z]+)*$/i, "")
    .replace(/\/s\d+(-[a-z]+)*\//i, "/")
    .replace(/[?&]$/, "");
}

export function samePhoto(a, b) {
  const ka = photoKey(a);
  const kb = photoKey(b);
  return !!ka && ka === kb;
}

/** Hesaba bağlı giriş yöntemleri (tekrarsız). */
export function linkedProviderIds(providerData) {
  return [
    ...new Set(
      (Array.isArray(providerData) ? providerData : [])
        .map((item) => item?.providerId)
        .filter((id) => typeof id === "string" && id),
    ),
  ];
}

function providerRank(providerId) {
  const i = PHOTO_PROVIDER_ORDER.indexOf(providerId);
  return i === -1 ? PHOTO_PROVIDER_ORDER.length : i;
}

/**
 * Bağlı hesapların kullanılabilir fotoğrafları.
 *
 * `providerData[i].photoURL` Firebase'in o sağlayıcıyla SON GİRİŞTE gördüğü
 * fotoğraftır — oturum açık kaldıkça tazelenmez. `fresh` sağlayıcının kendi
 * SDK'sından (Google sessiz giriş) o an okunan fotoğrafı taşır ve Firebase'in
 * kopyasını ezer; yalnız aynı hesaba aitse (`accountId` = providerData.uid):
 * cihazda başka bir Google hesabının açık kalmış yerel oturumu bu hesabın
 * avatarını değiştiremez.
 *
 * @param {Array<{providerId:string, uid?:string, photoURL?:string}>} providerData
 * @param {Object<string,{uri:string, accountId?:string}>} [fresh]
 * @returns {Array<{providerId:string, uri:string}>}
 */
export function getLinkedPhotos(providerData, fresh = {}) {
  const out = [];
  const seen = new Set();
  const entries = (Array.isArray(providerData) ? providerData : [])
    .filter((item) => item?.providerId && !NON_PHOTO_PROVIDERS.has(item.providerId))
    .sort((a, b) => providerRank(a.providerId) - providerRank(b.providerId));

  for (const item of entries) {
    const live = fresh?.[item.providerId];
    const liveMatches =
      live && cleanUrl(live.uri) && (!live.accountId || !item.uid || live.accountId === item.uid);
    const uri = liveMatches ? cleanUrl(live.uri) : cleanUrl(item.photoURL);
    const key = photoKey(uri);
    if (!uri || seen.has(key)) continue;
    seen.add(key);
    // `fresh`: resim sağlayıcıdan o an okundu. Profildeki fotoğrafı yalnız
    // böyle bir resim değiştirebilir (bkz. planAvatarPhotoSync).
    out.push(liveMatches ? { providerId: item.providerId, uri, fresh: true } : { providerId: item.providerId, uri });
  }
  return out;
}

/**
 * Profildeki fotoğraf hangi bağlı hesaptan geliyor?
 * Sırayla: kayıtlı `photoSource` → bağlı fotoğraflardan biriyle aynı resim →
 * Google adresi. Hiçbiri değilse null (kaynağı bilinmeyen eski fotoğraf;
 * senkron ona dokunmaz).
 */
export function inferPhotoSource(profile, linkedPhotos = []) {
  if (typeof profile?.photoSource === "string" && profile.photoSource) {
    return profile.photoSource;
  }
  const url = profile?.photoURL;
  if (!cleanUrl(url)) return null;
  if (isTmdbPhotoUrl(url)) return PERSON_PHOTO_SOURCE;
  const match = linkedPhotos.find((p) => samePhoto(p.uri, url));
  if (match) return match.providerId;
  if (isGooglePhotoUrl(url)) return "google.com";
  return null;
}

/**
 * Profil avatarının bağlı hesapla uyumlu kalması için ne yapılmalı?
 *
 *   { action: "none" }
 *   { action: "update", photoURL, photoSource } — sağlayıcıdaki fotoğraf
 *       değişmiş ya da `photoSource` eski hesapta eksik (geri doldurma).
 *   { action: "revert" } — fotoğrafın geldiği hesap artık bağlı değil; avatar
 *       hazır bir avatara dönmeli (yoksa kaldırılan hesabın resmi kalırdı).
 *
 * Yalnız fotoğraf avatarı (-1) kullanan profiller etkilenir: hazır avatar
 * seçmiş birinin kopyalarına her Google değişikliğinde fan-out yapılmaz.
 *
 * @param {object} p
 * @param {object} p.profile       Users/{uid} verisi
 * @param {string[]} p.providerIds Bağlı giriş yöntemleri (boşsa bilinmiyor sayılır)
 * @param {Array} p.linkedPhotos   getLinkedPhotos çıktısı
 */
export function planAvatarPhotoSync({ profile, providerIds = [], linkedPhotos = [] }) {
  const none = { action: "none" };
  if (!profile || profile.avatarIndex !== CUSTOM_AVATAR_INDEX) return none;

  const source = inferPhotoSource(profile, linkedPhotos);
  if (!source) return none;
  // Oyuncu/yönetmen fotoğrafı kullanıcının bilinçli seçimi; hiçbir bağlı
  // hesaba ait değil — tazelenecek ya da geri çevrilecek bir şey yok.
  if (isPersonPhotoSource(source)) return none;

  // providerData boş geldiyse (oturum yarı kurulmuş) hiçbir şey bilinmiyor;
  // emin olmadan kullanıcının avatarını değiştirme.
  if (providerIds.length && !providerIds.includes(source)) {
    return { action: "revert" };
  }

  const linked = linkedPhotos.find((p) => p.providerId === source);
  if (!linked) return none;

  if (!samePhoto(linked.uri, profile.photoURL)) {
    // Resmi yalnız sağlayıcıdan O AN okunan fotoğraf değiştirir. Firebase'in
    // providerData kopyası bu cihazdaki son Google girişinden kalmadır: Google
    // oturumu olmayan ikinci bir cihaz, başka cihazın tazelediği yeni resmi
    // kendi eski kopyasına geri çevirip gidip gelmeye yol açardı.
    if (!linked.fresh) return none;
    return { action: "update", photoURL: linked.uri, photoSource: source };
  }
  if (profile.photoSource !== source) {
    return { action: "update", photoURL: profile.photoURL.trim(), photoSource: source };
  }
  return none;
}

// ── Seçim modeli ────────────────────────────────────────────────────────────

/**
 * Sayı (eski çağrılar: hazır avatar indeksi ya da -1) veya seçim nesnesini
 * tek biçime çevirir. -1 fotoğrafsız gelirse `fallbackPhoto` kullanılır.
 */
export function toAvatarChoice(value, fallbackPhoto = null) {
  if (value && typeof value === "object") {
    const index = clampAvatarIndex(value.avatarIndex);
    if (index !== CUSTOM_AVATAR_INDEX) {
      return { avatarIndex: index, photoURL: null, photoSource: null };
    }
    const own = cleanUrl(value.photoURL);
    const from = own ? value : fallbackPhoto;
    const photoURL = own || cleanUrl(fallbackPhoto?.photoURL);
    if (!photoURL) {
      return { avatarIndex: DEFAULT_AVATAR_INDEX, photoURL: null, photoSource: null };
    }
    // Kaynak adresle tutarlı olmalı: TMDB adresi her zaman kişi fotoğrafıdır;
    // kişi kaynağı TMDB dışı bir adrese yapışmaz (senkron yanlış yöne gitmesin).
    const declared = from?.photoSource ?? null;
    const isPerson = isTmdbPhotoUrl(photoURL);
    const photoSource = isPerson
      ? PERSON_PHOTO_SOURCE
      : isPersonPhotoSource(declared)
        ? null
        : declared;
    const photoPerson = isPerson ? normalizePhotoPerson(from?.photoPerson) : null;
    return {
      avatarIndex: CUSTOM_AVATAR_INDEX,
      photoURL,
      photoSource,
      ...(photoPerson ? { photoPerson } : {}),
    };
  }
  return toAvatarChoice({ avatarIndex: value }, fallbackPhoto);
}

/** İki seçim aynı avatarı mı gösteriyor? */
export function sameAvatarChoice(a, b) {
  if (!a || !b) return false;
  if (a.avatarIndex !== b.avatarIndex) return false;
  if (a.avatarIndex !== CUSTOM_AVATAR_INDEX) return true;
  return samePhoto(a.photoURL, b.photoURL);
}

/**
 * Profildeki kayıtlı avatar, seçim biçiminde. avatarIndex alanı yoksa
 * `fallbackIndex` (cihazdaki son seçim) kullanılır. -1 olup fotoğraf yoksa
 * (eski/bozuk kayıt) `authPhotoURL` denenir — o da yoksa varsayılan avatar.
 */
export function profileAvatarChoice(profile, { fallbackIndex = DEFAULT_AVATAR_INDEX, authPhotoURL = null } = {}) {
  const index =
    typeof profile?.avatarIndex === "number" ? profile.avatarIndex : fallbackIndex;
  return toAvatarChoice(
    {
      avatarIndex: index,
      photoURL: cleanUrl(profile?.photoURL) || cleanUrl(authPhotoURL),
      photoSource: profile?.photoSource ?? null,
      photoPerson: profile?.photoPerson ?? null,
    },
  );
}

/**
 * Gönderi / yorum / mesaj / grup üyeliği gibi anlık kopyalara yazılacak kimlik
 * avatarı. Fotoğraf yalnız fotoğraf avatarında taşınır (hazır avatarda null) —
 * services/profilePropagation.js ile aynı kural.
 */
export function avatarSnapshot(choice) {
  const c = choice || { avatarIndex: DEFAULT_AVATAR_INDEX };
  return {
    avatarIndex: c.avatarIndex,
    photoURL: c.avatarIndex === CUSTOM_AVATAR_INDEX ? c.photoURL || null : null,
  };
}

/**
 * Serbest biçimli bir kimlikten ({ avatarIndex, photoURL } — arkadaş kaydı,
 * üye bilgisi, profil belgesi) anlık kopyaya yazılacak avatar alanları.
 * Servisler çağıranın ne geçtiğine güvenmeden bu kuralı uygular: hazır
 * avatarda fotoğraf yazılmaz, fotoğraf avatarında adres taşınır, fotoğrafı
 * olmayan -1 varsayılan avatara iner.
 */
export function identityAvatar(identity) {
  return avatarSnapshot(
    toAvatarChoice({
      avatarIndex: identity?.avatarIndex,
      photoURL: identity?.photoURL ?? null,
    }),
  );
}

/**
 * Seçicinin hücreleri: önce bağlı hesap fotoğrafları, sonra (seçili fotoğraf
 * artık hiçbir bağlı hesapta yoksa) mevcut fotoğraf, en sonda hazır avatarlar.
 * Mevcut fotoğraf listeden düşmez: kullanıcı seçiciyi açınca kendi avatarını
 * seçili görmeli.
 */
export function buildAvatarChoices({ linkedPhotos = [], current = null } = {}) {
  const photos = linkedPhotos.map((p) => ({
    key: `photo:${p.providerId}`,
    avatarIndex: CUSTOM_AVATAR_INDEX,
    photoURL: p.uri,
    photoSource: p.providerId,
  }));
  if (
    current?.avatarIndex === CUSTOM_AVATAR_INDEX &&
    cleanUrl(current.photoURL) &&
    !photos.some((p) => samePhoto(p.photoURL, current.photoURL))
  ) {
    photos.push({
      key: "photo:current",
      avatarIndex: CUSTOM_AVATAR_INDEX,
      photoURL: current.photoURL,
      photoSource: current.photoSource ?? null,
      ...(current.photoPerson ? { photoPerson: current.photoPerson } : {}),
    });
  }
  const presets = Array.from({ length: AVATAR_COUNT }, (_, i) => ({
    key: `preset:${i}`,
    avatarIndex: i,
    photoURL: null,
    photoSource: null,
  }));
  return [...photos, ...presets];
}
