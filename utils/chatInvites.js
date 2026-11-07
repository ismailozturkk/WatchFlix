// utils/chatInvites.js
//
// Sohbetteki DAVET kartlarının (günlük düello "challengeShare", CineSwipe odası "cineRoomShare") yanıt
// durumu — SAF çekirdek, RN/Firebase importu YOK.
//
// TEK KAYNAK MESAJDIR; iki tarafın kartı bu alanlardan çizilir:
//   accepts.{uid}  = zaman     kabul etti
//   declines.{uid} = zaman     reddetti
//   done = { at, matches }     yalnız CineSwipe: oda bitti, ortak eşleşme sayısı
// Alıcı mesaja yalnız KENDİ anahtarını yazar; bir kişi tek yönde yanıtlar (kabul eden reddedemez, reddeden
// kabul edemez). `done` odanın içinden bir kez yazılır. Kural: firestore.rules → inviteAnswer / cineInviteDone.
//
// Aynı yanıt Profil'deki önemli davetler çubuğunun bildirim kaydında da tutulur ve İKİ YÖNLÜ eşlenir:
//   sohbet kartı → kayıt : ChatScreen.answerInviteFromCard → notificationsService.respondMatchingInvitations
//   çubuk → mesaj        : NotificationsContext.respond → services/chatInviteService.writeInviteResponse
//                          (kayıttaki `messageId`; eski kayıtta yok → kart yalnız sohbetten yanıtlanınca değişir)

export const INVITE_RESPONSES = Object.freeze(["accepted", "declined"]);
export const INVITE_RESPONSE_FIELD = Object.freeze({ accepted: "accepts", declined: "declines" });

const RESPONDER_UID = /^[A-Za-z0-9_-]{1,128}$/;
const MESSAGE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Firestore otomatik kimliği biçiminde mi (yol parçası olarak güvenli). */
export const isInviteMessageId = (id) => typeof id === "string" && MESSAGE_ID.test(id);

/** `accepts` / `declines` haritası → yanıtlayan uid'ler. Bozuk/eksik kayıt boş liste. */
export function inviteResponders(map) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return [];
  return Object.keys(map).filter((uid) => RESPONDER_UID.test(uid) && map[uid] != null);
}

/** İzleyicinin kendi yanıtı: "accepted" | "declined" | null. */
export function myInviteResponse({ accepts, declines, uid }) {
  if (!uid) return null;
  if (inviteResponders(accepts).includes(uid)) return "accepted";
  if (inviteResponders(declines).includes(uid)) return "declined";
  return null;
}

/** CineSwipe kartının bitiş kaydı → `{ matches }` (sayı bozuksa null); kayıt yoksa null. */
export function cineInviteDone(done) {
  if (!done || typeof done !== "object" || Array.isArray(done)) return null;
  return { matches: Number.isInteger(done.matches) && done.matches >= 0 ? done.matches : null };
}

const HOUR_MS = 60 * 60 * 1000;
// Yanıtsız davet 24 saat açık (yüzen davet kartı da aynı süreyi kullanır: utils/importantInvites). Kabul edilmiş
// ama bitmemiş oda bir gün daha sürebilir: sırayla odada misafir katılınca süre yeniden 24 saat olur.
export const CINE_INVITE_OPEN_MS = 24 * HOUR_MS;
export const CINE_INVITE_ACCEPTED_MS = 48 * HOUR_MS;

const timeOf = (value) => {
  if (value == null) return null;
  const raw = value?.toMillis?.() ?? (typeof value?.seconds === "number" ? value.seconds * 1000 : value);
  const ms = raw instanceof Date ? raw.getTime() : typeof raw === "string" ? Date.parse(raw) : Number(raw);
  return Number.isFinite(ms) ? ms : null;
};

/**
 * CineSwipe davet kartının izleyiciye göre durumu.
 *
 * Alıcı   : done → declined (kendi reddi) → expired → accepted (kendi kabulü) → pending
 * Gönderen: done → expired → accepted (en az bir kabul) → declined (kabul yok, ret var) → pending
 * Grupta gönderen sayıları görür; bir üyenin reddi diğer üyelerin kartını değiştirmez.
 *
 * @param {object} p
 * @param {boolean} p.isOutgoing   izleyici daveti gönderen mi
 * @param {string}  [p.viewerUid]
 * @param {object}  [p.accepts]
 * @param {object}  [p.declines]
 * @param {object}  [p.done]
 * @param {*}       [p.sentAt]     mesaj zamanı (Timestamp / ms); yazım sürerken null → süre işlemez
 * @param {number}  [p.now]
 * @returns {{
 *   phase: "pending"|"accepted"|"declined"|"done"|"expired",
 *   mine: "accepted"|"declined"|null,
 *   acceptedCount: number,
 *   declinedCount: number,
 *   matches: number|null,
 * }}
 */
export function cineInviteView({ isOutgoing, viewerUid, accepts, declines, done, sentAt, now = Date.now() }) {
  const acceptedCount = inviteResponders(accepts).length;
  const declinedCount = inviteResponders(declines).length;
  const mine = isOutgoing ? null : myInviteResponse({ accepts, declines, uid: viewerUid });
  const finished = cineInviteDone(done);
  const view = (phase) => ({ phase, mine, acceptedCount, declinedCount, matches: finished?.matches ?? null });

  if (finished) return view("done");
  if (mine === "declined") return view("declined");
  const accepted = isOutgoing ? acceptedCount > 0 : mine === "accepted";
  const sent = timeOf(sentAt);
  if (sent !== null && now >= sent + (accepted ? CINE_INVITE_ACCEPTED_MS : CINE_INVITE_OPEN_MS)) return view("expired");
  if (accepted) return view("accepted");
  if (isOutgoing && declinedCount > 0) return view("declined");
  return view("pending");
}
