// utils/floatingNoticeCopy.js
//
// Yüzen bildirim katmanının metinleri (components/floatingNotice/*). Davet cümleleri ve
// Kabul / Reddet etiketleri bildirim kutusuyla ORTAK kalsın diye utils/notificationInboxCopy'den
// okunur; burada yalnız katmana özgü olanlar var. Turnuva temasının adı tournamentEngine'den gelir.
import { copyLanguage } from "./appLanguages";
import { NOTICE_KIND } from "./floatingNotices";
import { INVITE_TYPES } from "./importantInvites";
import { notificationDateLabel } from "./notificationInbox";
import { notificationInboxCopy } from "./notificationInboxCopy";
import { getScheduleEntry, monthLabel, themeLabel } from "../services/tournamentEngine";

export const FLOATING_NOTICE_COPY = {
  tr: {
    inviteEyebrow: "Davet", eventEyebrow: "Turnuva",
    minimize: "Küçült", next: "Sonraki bildirim",
    bubble: (n) => `Bekleyen ${n} bildirim`, bubbleHint: "Açmak için dokun, kenara taşımak için sürükle",
    eventDone: "Tamam",
    tournament: {
      selection: { title: "Yeni turnuva başladı", detail: (theme) => `Bu ayın teması: ${theme}. Adaylar belirleniyor.`, cta: "Turnuvaya git" },
      r32: { title: "Turnuvada oylama başladı", detail: (theme) => `${theme} turnuvasında Son 32 eşleşmeleri açıldı.`, cta: "Eşleşmeleri gör" },
      final: { title: "Turnuvada final zamanı", detail: (theme) => `${theme} şampiyonunu son oylar belirleyecek.`, cta: "Finali gör" },
      results: { title: "Turnuva sonuçlandı", detail: (theme) => `${theme} turnuvasının şampiyonu belli oldu.`, cta: "Sonuçları gör" },
    },
  },
  en: {
    inviteEyebrow: "Invitation", eventEyebrow: "Tournament",
    minimize: "Minimize", next: "Next notification",
    bubble: (n) => `${n} pending notification${n === 1 ? "" : "s"}`, bubbleHint: "Tap to open, drag to move it to an edge",
    eventDone: "OK",
    tournament: {
      selection: { title: "A new tournament has started", detail: (theme) => `This month's theme: ${theme}. Nominees are being picked.`, cta: "Go to tournament" },
      r32: { title: "Tournament voting is open", detail: (theme) => `Round of 32 matches are live in the ${theme} tournament.`, cta: "See matches" },
      final: { title: "It's final time", detail: (theme) => `The last votes will crown the ${theme} champion.`, cta: "See the final" },
      results: { title: "The tournament is over", detail: (theme) => `The ${theme} champion has been decided.`, cta: "See results" },
    },
  },
  es: {
    inviteEyebrow: "Invitación", eventEyebrow: "Torneo",
    minimize: "Minimizar", next: "Siguiente notificación",
    bubble: (n) => `${n} notificación${n === 1 ? "" : "es"} pendiente${n === 1 ? "" : "s"}`, bubbleHint: "Toca para abrir, arrastra para moverlo a un borde",
    eventDone: "Vale",
    tournament: {
      selection: { title: "Empezó un nuevo torneo", detail: (theme) => `Tema del mes: ${theme}. Se están eligiendo candidatos.`, cta: "Ir al torneo" },
      r32: { title: "Comenzó la votación del torneo", detail: (theme) => `Ya están abiertos los dieciseisavos del torneo de ${theme}.`, cta: "Ver enfrentamientos" },
      final: { title: "Llegó la final", detail: (theme) => `Los últimos votos coronarán al campeón de ${theme}.`, cta: "Ver la final" },
      results: { title: "El torneo terminó", detail: (theme) => `Ya hay campeón del torneo de ${theme}.`, cta: "Ver resultados" },
    },
  },
  pt: {
    inviteEyebrow: "Convite", eventEyebrow: "Torneio",
    minimize: "Minimizar", next: "Próxima notificação",
    bubble: (n) => `${n} notificaç${n === 1 ? "ão pendente" : "ões pendentes"}`, bubbleHint: "Toque para abrir, arraste para levar a uma borda",
    eventDone: "Ok",
    tournament: {
      selection: { title: "Um novo torneio começou", detail: (theme) => `Tema do mês: ${theme}. Os candidatos estão sendo escolhidos.`, cta: "Ir ao torneio" },
      r32: { title: "A votação do torneio começou", detail: (theme) => `Os 16 avos de final do torneio de ${theme} estão abertos.`, cta: "Ver confrontos" },
      final: { title: "Chegou a final", detail: (theme) => `Os últimos votos vão coroar o campeão de ${theme}.`, cta: "Ver a final" },
      results: { title: "O torneio terminou", detail: (theme) => `O campeão do torneio de ${theme} foi definido.`, cta: "Ver resultados" },
    },
  },
  de: {
    inviteEyebrow: "Einladung", eventEyebrow: "Turnier",
    minimize: "Minimieren", next: "Nächste Benachrichtigung",
    bubble: (n) => `${n} offene Benachrichtigung${n === 1 ? "" : "en"}`, bubbleHint: "Tippen zum Öffnen, ziehen zum Verschieben an einen Rand",
    eventDone: "OK",
    tournament: {
      selection: { title: "Ein neues Turnier hat begonnen", detail: (theme) => `Thema des Monats: ${theme}. Die Kandidaten werden gewählt.`, cta: "Zum Turnier" },
      r32: { title: "Die Turnierabstimmung läuft", detail: (theme) => `Die Sechzehntelfinals im ${theme}-Turnier sind offen.`, cta: "Duelle ansehen" },
      final: { title: "Zeit für das Finale", detail: (theme) => `Die letzten Stimmen küren den ${theme}-Champion.`, cta: "Zum Finale" },
      results: { title: "Das Turnier ist entschieden", detail: (theme) => `Der Champion im ${theme}-Turnier steht fest.`, cta: "Ergebnisse ansehen" },
    },
  },
};

export const floatingNoticeCopy = (language) =>
  FLOATING_NOTICE_COPY[copyLanguage(language, Object.keys(FLOATING_NOTICE_COPY))];

/**
 * Kartın metinleri. `someone`: gönderenin adı yoksa (t.someone).
 * @returns {{ eyebrow:string, title:string, detail:string, meta:string,
 *             primary:string, secondary:string, error:string }}
 */
export function floatingNoticeText(notice, { language, someone = "", now = Date.now() } = {}) {
  const copy = floatingNoticeCopy(language);
  const inbox = notificationInboxCopy(language);
  if (notice?.kind === NOTICE_KIND.event) {
    const step = copy.tournament[notice.step] || copy.tournament.selection;
    const theme = themeLabel(getScheduleEntry(notice.monthIndex), language);
    return {
      eyebrow: `${copy.eventEyebrow} · ${monthLabel(notice.monthIndex, language)}`,
      title: step.title,
      detail: step.detail(theme),
      meta: "",
      primary: step.cta,
      secondary: copy.eventDone,
      error: "",
    };
  }
  const item = notice?.item || {};
  const name = item.fromName || someone || inbox.title;
  const when = notificationDateLabel(item, language, inbox, now).split(" · ")[0];
  return {
    eyebrow: copy.inviteEyebrow,
    title: `${name} ${item.type === INVITE_TYPES.cine ? inbox.cineInvite : inbox.duelInvite}`,
    detail: "",
    meta: item.groupName ? `${item.groupName} · ${when}` : when,
    primary: inbox.acceptInvite,
    secondary: inbox.declineInvite,
    error: inbox.inviteError,
  };
}
