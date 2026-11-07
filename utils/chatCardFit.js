// utils/chatCardFit.js
//
// Sohbetteki özel kartların İÇERİĞİNİ kart genişliğine sığdıran saf hesaplar (jest ile sınanır).
// Kart genişliğini MessageBubble belirler (mediaCardWidth, 250–306 dp; nötr yüzeyli kartlarda iç
// genişlik −22). Burada genişlik DEĞİŞTİRİLMEZ; afiş / kare / şerit ölçüleri verilen genişliğe uyar.

const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.floor(value)));

// ─── Film Kulübü aday şeridi (components/chat/SharedClubMessage) ─────────────
export const CLUB_CARD_PADDING = 13;
export const CLUB_CARD_BORDER = 1;
export const CLUB_STRIP_GAP = 6;
const CLUB_STRIP_SHOWN = 4;
const CLUB_POSTER_MAX = 56;

/** En çok 4 aday afişi + taşan varsa "+N" yuvası; hepsi aynı genişlikte ve kartın içine sığar. */
export function clubStripLayout(count, cardWidth = 260) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const shown = Math.min(total, CLUB_STRIP_SHOWN);
  const slots = shown + (total > CLUB_STRIP_SHOWN ? 1 : 0);
  const inner = cardWidth - (CLUB_CARD_PADDING + CLUB_CARD_BORDER) * 2;
  const posterW = slots > 0 ? clampInt((inner - CLUB_STRIP_GAP * (slots - 1)) / slots, 1, CLUB_POSTER_MAX) : CLUB_POSTER_MAX;
  return { shown, more: total - shown, posterW };
}

// ─── Günün Karesi tahmin kareleri (components/chat/SharedFrameMessage) ───────
export const FRAME_CARD_PADDING = 13;
export const FRAME_CARD_BORDER = 1;
export const FRAME_MARK_GAP = 5;

/** Tahmin kareleri kartın iç genişliğine yayılır: dar kartta küçülür, genişte 36 dp'yi aşmaz. */
export function frameMarkSize(count, cardWidth = 252) {
  const n = Math.max(1, Math.floor(Number(count) || 0));
  const inner = cardWidth - (FRAME_CARD_PADDING + FRAME_CARD_BORDER) * 2;
  return clampInt((inner - FRAME_MARK_GAP * (n - 1)) / n, 18, 36);
}

// ─── Zevk uyumu afişleri (components/chat/SharedTasteMatchMessage) ───────────
export const TASTE_POSTER_GAP = 6;
const TASTE_POSTER_SLOTS = 4; // utils/chatShare MAX_TASTE_SHARE_ITEMS

/** Dört afiş yuvası kart genişliğine sığar; az afişte de aynı ölçü kalır (36–60 dp). */
export function tastePosterWidth(cardWidth = 240) {
  return clampInt((cardWidth - TASTE_POSTER_GAP * (TASTE_POSTER_SLOTS - 1)) / TASTE_POSTER_SLOTS, 36, 60);
}

// ─── Sohbet anketi afişleri (components/chat/PollMessage) ────────────────────
export const POLL_POSTER_MAX = 56;
export const POLL_POSTER_GAP = 6; // PollMessage styles.mediaGrid gap
const POLL_STRIP_PAD = 2; // PollMessage styles.chatMediaGrid paddingRight

/** Sohbet anketinde afiş genişliği: verilen kart genişliğinde tüm seçenekler yan yana sığar. */
export function chatPosterWidth(count, width) {
  if (!(width > 0) || !(count > 0)) return POLL_POSTER_MAX;
  return clampInt((width - POLL_STRIP_PAD - POLL_POSTER_GAP * (count - 1)) / count, 40, POLL_POSTER_MAX);
}
