// utils/floatingNotices.js
//
// Yüzen bildirimlerin SAF kararları (veri: hooks/useFloatingNotices.js, çizim:
// components/floatingNotice/*). React / RN yok → düğüm ortamında test edilir.
//
// AKIŞ
//   Yeni bir kalıcı bildirim önce ekranın üstünde toast gibi açılır. Birkaç saniye içinde
//   yanıtlanmazsa küçülüp ekranın sağ ya da sol kenarında yüzen bir simgeye dönüşür;
//   simgeye basınca kart yeniden büyür. Simge sürüklenebilir, bırakınca en yakın kenara oturur.
//
// İKİ TÜR
//   • Davet (CineSwipe odası, günlük düello): seçim ZORUNLU — kapatma yok; yalnız Kabul / Reddet
//     kaldırır (ya da davetin süresi dolar). Kaynak: Users/{uid}/notifications (bkz. importantInvites).
//   • Özel an (turnuva başladı, oylama başladı, final, sonuçlar): "Tamam" ya da "Aç" kaldırır;
//     anın süresi bitince kendiliğinden düşer. Kaynak: turnuva takvimi (services/tournamentEngine,
//     sunucu yok — her istemci aynı tarihten aynı anı hesaplar).
//
// Her bildirim cihazda BİR KEZ toast olur (Keys.floatingNotices.announced); sonrasında yalnız
// kenardaki simgede bekler. Durum kaydı `{ announced: {id: ms}, dismissed: {id: ms} }`.

import { INVITE_TYPES, pendingInvitations } from "./importantInvites";
import {
  DAY,
  RESULTS_START_DAY,
  ROUNDS,
  SELECTION_DAYS,
  getActiveRoundIndex,
  getPeriodEndMs,
  getPeriodId,
  getPeriodStartMs,
  getPhase,
  parsePeriodId,
} from "../services/tournamentEngine";

export const NOTICE_KIND = Object.freeze({ invite: "invite", event: "event" });

/** Toast olarak açık kalma süresi (ms); dolunca kart simgeye küçülür. */
export const NOTICE_TOAST_MS = Object.freeze({ invite: 7000, event: 5000 });
/** Simgeden açılan kart dokunulmadan bu kadar durursa yeniden küçülür. */
export const NOTICE_IDLE_MS = 12000;
/** Durum kaydında bu kadar eski girdiler budanır (aylık turnuva anı + 24 sa davet için bol pay). */
export const NOTICE_STATE_TTL_MS = 60 * DAY;

/**
 * Katmanın çizilmediği rotalar. Gerekçeler satır yanında; yeni tam ekran oyun / tuval rotası
 * eklenirse buraya da eklenmeli. Gizliyken yeni bildirim duyurulmaz, rota dönünce duyurulur.
 */
export const FLOATING_NOTICE_HIDDEN_ROUTES = Object.freeze(
  new Set([
    // Oturum öncesi: kullanıcı yok
    "OnboardingScreen",
    "LoginScreen",
    "RegisterScreen",
    "ForgotPasswordScreen",
    "GoogleProfileCompletionScreen",
    // Sohbet: davet kartı zaten sohbette kendi Kabul / Reddet düğmeleriyle duruyor; simge yazma alanını kapatmasın
    "ChatScreen",
    // Tam ekran deneyimler: tuval/hikâye pencereyi ölçer
    "WrappedScreen",
    "StoryShareScreen",
    "StoryDraftsScreen",
    // Oyun / kaydırma ekranları: sürükleme ve süre sayacı tam alan ister (kabul edilen davet de buraya açılır)
    "CineSwipeScreen",
    "SceneGamePlayScreen",
    "QuickGameScreen",
    "OlderGameScreen",
    "CinemaBingoScreen",
    // Geliştirici ekranı
    "UsageDebugScreen",
  ]),
);

/** @param {{ signedIn?: boolean, routeName?: string|null }} input */
export function floatingNoticesAllowed({ signedIn, routeName } = {}) {
  if (!signedIn) return false;
  return !(routeName && FLOATING_NOTICE_HIDDEN_ROUTES.has(routeName));
}

const timeOf = (value) => {
  const raw = value?.toMillis?.() ?? (typeof value?.seconds === "number" ? value.seconds * 1000 : value);
  const ms = raw instanceof Date ? raw.getTime() : typeof raw === "string" ? Date.parse(raw) : Number(raw);
  return Number.isFinite(ms) ? ms : 0;
};

/** Yanıt bekleyen davetler → bildirim (en yenisi önde). Kural: utils/importantInvites.isPendingInvitation. */
export function inviteNotices(items, now = Date.now()) {
  return pendingInvitations(items, now)
    .map((item) => ({
      id: `invite:${item.id}`,
      kind: NOTICE_KIND.invite,
      type: item.type,
      sourceId: item.id,
      at: timeOf(item.createdAt),
      item,
    }))
    .sort((a, b) => b.at - a.at);
}

// ─── Turnuva anları ─────────────────────────────────────────────────────────
// Her turun başlangıcı duyurulmaz (iki günde bir bildirim gürültü olurdu): yalnız turnuvanın
// açılışı, oylamanın başlangıcı (Son 32), final ve sonuçlar.
export const TOURNAMENT_NOTICE_STEPS = Object.freeze(["selection", "r32", "final", "results"]);

/**
 * `ms` anında süren turnuva anı; duyurulan dört andan biri değilse null.
 * @returns {{ periodId:string, monthIndex:number, step:string, startsAt:number, endsAt:number }|null}
 */
export function tournamentStepAt(ms = Date.now()) {
  const periodId = getPeriodId(ms);
  const start = getPeriodStartMs(periodId);
  const { monthIndex } = parsePeriodId(periodId);
  const phase = getPhase(periodId, ms);
  let step = null;
  let startsAt = start;
  let endsAt = start + SELECTION_DAYS * DAY;
  if (phase === "selection") {
    step = "selection";
  } else if (phase === "voting") {
    const round = ROUNDS[getActiveRoundIndex(periodId, ms)];
    if (!round) return null;
    step = round.key;
    startsAt = start + round.startDay * DAY;
    endsAt = start + round.endDay * DAY;
  } else if (phase === "results") {
    step = "results";
    startsAt = start + RESULTS_START_DAY * DAY;
    endsAt = getPeriodEndMs(periodId);
  }
  if (!TOURNAMENT_NOTICE_STEPS.includes(step)) return null;
  return { periodId, monthIndex, step, startsAt, endsAt };
}

/** Turnuva anı → bildirim. Kimlik ay + an: aynı an ikinci kez duyurulmaz. */
export function tournamentNotice(stepInfo) {
  if (!stepInfo?.step || !stepInfo.periodId) return null;
  return {
    id: `event:tournament:${stepInfo.periodId}:${stepInfo.step}`,
    kind: NOTICE_KIND.event,
    type: "tournament",
    step: stepInfo.step,
    periodId: stepInfo.periodId,
    monthIndex: stepInfo.monthIndex,
    at: stepInfo.startsAt,
    endsAt: stepInfo.endsAt,
  };
}

/** Özel anın gittiği ekran. */
export function eventDestination(notice) {
  return notice?.type === "tournament" ? { name: "TournamentScreen" } : null;
}

/** Görünen bildirimler: önce davetler (yanıt zorunlu), sonra kapatılmamış özel anlar. */
export function visibleNotices({ invites = [], events = [], dismissed = {} } = {}) {
  const open = events.filter((notice) => notice && !dismissed?.[notice.id]).sort((a, b) => b.at - a.at);
  return [...invites, ...open];
}

/**
 * Henüz toast olmamış bildirimlerden hangisi şimdi açılsın: en yeni davet, yoksa en yeni an.
 * @returns {{ target: object|null, fresh: string[] }} fresh = duyurulmuş sayılacak tüm kimlikler
 */
export function nextAnnouncement(notices, announced = {}) {
  const fresh = (notices || []).filter((notice) => !announced?.[notice.id]);
  if (!fresh.length) return { target: null, fresh: [] };
  const newest = (kind) =>
    fresh.filter((notice) => notice.kind === kind).sort((a, b) => b.at - a.at)[0] || null;
  return { target: newest(NOTICE_KIND.invite) || newest(NOTICE_KIND.event), fresh: fresh.map((n) => n.id) };
}

const readState = (state) => ({
  announced: state?.announced && typeof state.announced === "object" ? state.announced : {},
  dismissed: state?.dismissed && typeof state.dismissed === "object" ? state.dismissed : {},
});

const prune = (map, now) =>
  Object.fromEntries(
    Object.entries(map).filter(([, at]) => Number.isFinite(at) && now - at < NOTICE_STATE_TTL_MS),
  );

/** Kimlikleri "toast oldu" işaretler; eski girdileri budar. */
export function markNoticesAnnounced(state, ids, now = Date.now()) {
  const current = readState(state);
  const announced = prune(current.announced, now);
  (ids || []).forEach((id) => {
    if (id) announced[id] = now;
  });
  return { announced, dismissed: prune(current.dismissed, now) };
}

/** Özel anı kapatır (davetler kapatılamaz: yalnız yanıtla düşer). */
export function markNoticeDismissed(state, id, now = Date.now()) {
  const current = readState(state);
  const dismissed = prune(current.dismissed, now);
  if (id) dismissed[id] = now;
  return { announced: prune(current.announced, now), dismissed };
}

export const noticeIndex = (notices, id) => Math.max(0, (notices || []).findIndex((n) => n.id === id));

/** Sayfalayıcı: bir sonraki bildirimin kimliği (sona gelince başa döner). */
export function nextNoticeId(notices, id) {
  if (!notices?.length) return null;
  return notices[(noticeIndex(notices, id) + 1) % notices.length].id;
}

// ─── Görünüm ─────────────────────────────────────────────────────────────────
// Simge gövdesi `colors[0] → colors[1]` geçişi, üstündeki glif BEYAZ (vurgu üstü yazı beyaz
// kuralı) — bu yüzden renkler beyaz glifle okunacak kadar doygun/koyu.
const APPEARANCE = {
  [INVITE_TYPES.cine]: { icon: "film", colors: ["#F43F5E", "#BE123C"] },
  [INVITE_TYPES.duel]: { icon: "flash", colors: ["#F59E0B", "#C2410C"] },
  selection: { icon: "trophy", colors: ["#2563EB", "#7C3AED"] },
  r32: { icon: "flame", colors: ["#EA580C", "#DC2626"] },
  final: { icon: "flame", colors: ["#EA580C", "#DC2626"] },
  results: { icon: "medal", colors: ["#D97706", "#B45309"] },
};
const FALLBACK_APPEARANCE = { icon: "notifications", colors: ["#6D5DFB", "#4338CA"] };

/** @returns {{ icon: string, colors: [string, string], accent: string }} Ionicons adı + geçiş */
export function noticeAppearance(notice) {
  const look = (notice?.kind === NOTICE_KIND.event ? APPEARANCE[notice.step] : APPEARANCE[notice?.type])
    || FALLBACK_APPEARANCE;
  return { ...look, accent: look.colors[0] };
}

// ─── Kenar yuvası (yüzen simge) ──────────────────────────────────────────────
export const BUBBLE_SIZE = 56;
/** Simgenin ekran kenarına uzaklığı. */
export const DOCK_EDGE = 10;
/** Üstte başlık / Premium şeridi, altta sekme çubuğu için bırakılan pay (güvenli alan hariç). */
export const DOCK_TOP_RESERVE = 72;
export const DOCK_BOTTOM_RESERVE = 112;
/** Kayıt yokken simgenin dikey yeri: kullanılabilir yüksekliğin bu oranı. */
export const DOCK_DEFAULT_RATIO = 0.62;

/** Simgenin konabileceği alan (sol-üst köşe koordinatları). */
export function dockBounds({ width = 0, height = 0, insetTop = 0, insetBottom = 0 } = {}) {
  const minY = Math.max(0, insetTop) + DOCK_TOP_RESERVE;
  const maxY = Math.max(minY, height - Math.max(0, insetBottom) - DOCK_BOTTOM_RESERVE - BUBBLE_SIZE);
  return { minY, maxY, leftX: DOCK_EDGE, rightX: Math.max(DOCK_EDGE, width - BUBBLE_SIZE - DOCK_EDGE), width };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Kayıtlı yuva (`{side, y}`) → alana sığdırılmış yuva. Kayıt yok/bozuksa sağ kenar, alt-orta. */
export function resolveDock(saved, bounds) {
  const side = saved?.side === "left" ? "left" : "right";
  const fallback = bounds.minY + (bounds.maxY - bounds.minY) * DOCK_DEFAULT_RATIO;
  const y = Number.isFinite(saved?.y) ? saved.y : fallback;
  return { side, y: Math.round(clamp(y, bounds.minY, bounds.maxY)) };
}

/** Yuvanın sol-üst köşesi. */
export const dockOrigin = (dock, bounds) => ({
  x: dock.side === "left" ? bounds.leftX : bounds.rightX,
  y: dock.y,
});

/**
 * Bırakılan simgenin oturacağı yuva: merkezi (fırlatma hızıyla biraz ileri taşınmış) ekranın
 * hangi yarısındaysa o kenar; dikeyde alana sığdırılır.
 * @param {{ x:number, y:number, velocityX?:number }} drop  bırakıldığı sol-üst köşe
 */
export function snapDock({ x, y, velocityX = 0 }, bounds) {
  const center = x + BUBBLE_SIZE / 2 + clamp(velocityX, -1500, 1500) * 0.12;
  return {
    side: center < bounds.width / 2 ? "left" : "right",
    y: Math.round(clamp(y, bounds.minY, bounds.maxY)),
  };
}

/**
 * Kart ↔ simge dönüşümü: kartın merkezini simgenin merkezine taşıyan kayma ve kartı simge
 * genişliğine indiren ölçek. Kart üstte ortalı (`top` = kartın üst kenarı).
 */
export function morphToDock({ screenWidth, cardTop, cardWidth, cardHeight, dockX, dockY }) {
  const width = Math.max(1, cardWidth);
  return {
    dx: Math.round(dockX + BUBBLE_SIZE / 2 - screenWidth / 2),
    dy: Math.round(dockY + BUBBLE_SIZE / 2 - (cardTop + cardHeight / 2)),
    scale: Math.min(1, BUBBLE_SIZE / width),
  };
}
