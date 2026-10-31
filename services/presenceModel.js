// services/presenceModel.js
//
// Presence VERİ MODELİ — okuyucu tarafı. Saf modül: RN/Firebase importu yok
// (jest doğrudan yükler). Yazıcı tarafı: services/presenceSession.js.
//
// ŞEMA (RTDB):
//   /presence/{uid}/conns/{connId} : number   ← bu uygulama örneğinin açık bir
//                                                soketi var VE ön planda.
//   /presence/{uid}/lastSeen       : number   ← en son çevrimdışına düştüğü an.
//   /chatMeta/{chatId}/inChat/{uid}: connId   ← "bu sohbet ekranımda açık"
//   /chatMeta/{chatId}/typing/{uid}: connId | false
//
// NEDEN TEK `isOnline` BOOLEAN'I DEĞİL:
//   Boolean'ı iki kaynak yazıyordu (istemcinin elle yazdığı + sunucunun
//   onDisconnect'i) ve ikisi birbirini ezebiliyordu: yeniden bağlanınca ölü
//   soketin GECİKMELİ onDisconnect'i yeni oturumun "online"ını silerdi; çıkış
//   yapınca (auth düştükten sonra) offline yazımı reddedilir, bayrak sonsuza dek
//   true kalırdı. Burada her soketin KENDİ kaydı var; kullanıcı, en az bir canlı
//   kaydı varken çevrimiçidir ve her kayıt yalnız kendi soketinin ölümüyle
//   silinir — başka bir oturumu ezmesi mümkün değil.
//
// inChat/typing değeri bağlantı kimliğidir: bayrak ancak o kimliğin kaydı hâlâ
// duruyorsa geçerlidir. Soket ölünce kayıt silinir, bayrak otomatik geçersiz
// kalır — chatMeta için ayrıca onDisconnect kurmak gerekmez ve takılı kalmış
// "Sohbette"/"yazıyor" mümkün değildir.

/** presence.conns içindeki canlı bağlantı kimlikleri. */
export function liveConnectionIds(presence) {
  const conns = presence?.conns;
  if (!conns || typeof conns !== "object") return [];
  return Object.keys(conns).filter((id) => conns[id] != null);
}

/** Kullanıcının en az bir canlı bağlantısı var mı? (Gizlilik filtresiz.) */
export function isOnlineEffective(presence) {
  return liveConnectionIds(presence).length > 0;
}

/**
 * chatMeta bayrağı (inChat / typing) şu an geçerli mi?
 * @param {unknown} flag   chatMeta'daki ham değer (bağlantı kimliği ya da false)
 * @param {object|null} presence  bayrağı yazan kullanıcının presence düğümü
 */
export function isLiveFlag(flag, presence) {
  if (typeof flag !== "string" || flag.length === 0) return false;
  const conns = presence?.conns;
  return !!conns && typeof conns === "object" && conns[flag] != null;
}

/** Zaman damgası (number ms | Firestore Timestamp) → ms. */
export function toMillis(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  return null;
}

/** Son görülme (ms); yoksa null. */
export function lastSeenMs(presence) {
  return toMillis(presence?.lastSeen);
}
