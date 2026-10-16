// utils/chatReply.js
//
// Sohbette "alıntılayarak yanıtla" için mesajdan çıkarılan anlık görüntü.
// Anlık görüntü yanıt mesajının İÇİNE yazılır (replyTo); alıntılanan mesaj
// sonradan silinse/düzenlense de balonda ilk halini gösterir. Bu yüzden alanlar
// küçük ve düz tutulur: görsel için yalnız TMDB yolu saklanır, tam URL değil
// (URL görüntü kalitesi ayarına göre alıcı cihazda kurulur).

import { readShare, shareThumb } from "./chatShare";

const POLL_EMOJI_PREFIX = /^📊\s*/u;

// Sohbete gönderilen zengin içerik türleri (utils/chatShare.js SHARE_TYPE değerleri).
const SHARE_REPLY_KINDS = ["list", "ai", "post", "tournament", "cineRoom"];

// "poll" | "list" | "ai" | "post" | "tournament" | "cineRoom" | "collection" | "media" | "text". Eski kayıtlarda kind
// alanı farklı olabilir (örn. "list"); tanınmayan her şey düz metin sayılır.
// "list"/"ai" = sohbete gönderilen liste / CineMatch cevabı (utils/chatShare.js,
// mesajda `kind: "listShare" | "aiShare"`).
export function replyKind(message) {
  if (!message) return "text";
  if (message.kind === "poll" && message.poll) return "poll";
  const share = readShare(message);
  if (share) return share.type;
  if (Array.isArray(message.items) && message.items.length > 0) return "collection";
  if (message.media) return "media";
  return "text";
}

// Alıntı kartındaki küçük görsel: tekli medyada posteri, koleksiyonda / liste
// paylaşımında / AI cevabında ilk posterli öğeyi ver. Anket/metinde görsel yok.
export function replyThumb(message) {
  const kind = replyKind(message);
  // Sohbete gönderilen her tür (liste, AI, gönderi, turnuva, davet) kendi küçük resmini bilir.
  if (SHARE_REPLY_KINDS.includes(kind)) return shareThumb(readShare(message));
  const source =
    kind === "media"
      ? message.media
      : kind === "collection"
        ? message.items.find((item) => item?.poster_path || item?.profile_path)
        : null;
  const path = source?.poster_path || source?.profile_path;
  return typeof path === "string" && path ? path : null;
}

export function replyMediaType(message) {
  if (replyKind(message) !== "media") return null;
  const type = message.media?.media_type;
  return type === "movie" || type === "tv" || type === "person" ? type : null;
}

// Firestore `undefined` değeri reddeder; isteğe bağlı alanlar yalnız doluysa yazılır.
export function buildReplySnapshot(message, { senderName, preview }) {
  const thumb = replyThumb(message);
  const mediaType = replyMediaType(message);
  return {
    messageId: message.id,
    senderId: message.senderId || "",
    senderName,
    preview,
    kind: replyKind(message),
    ...(thumb ? { thumb } : {}),
    ...(mediaType ? { mediaType } : {}),
  };
}

// Anket önizlemesi eskiden "📊 " önekiyle saklanıyordu; artık tür simgesi
// bileşende çiziliyor, eski kayıtlarda çift simge çıkmasın diye önek atılır.
export function cleanReplyPreview(preview, kind) {
  const text = typeof preview === "string" ? preview : "";
  return kind === "poll" ? text.replace(POLL_EMOJI_PREFIX, "") : text;
}

// Tür → Ionicons adı. Düz metinde simge yok.
export function replyGlyph(kind, mediaType) {
  if (kind === "poll") return "stats-chart";
  if (kind === "list") return "list";
  if (kind === "ai") return "sparkles";
  if (kind === "post") return "newspaper";
  if (kind === "tournament") return "trophy";
  if (kind === "cineRoom") return "film";
  if (kind === "collection") return "albums";
  if (kind === "media") {
    if (mediaType === "tv") return "tv";
    if (mediaType === "person") return "person";
    return "film";
  }
  return null;
}
