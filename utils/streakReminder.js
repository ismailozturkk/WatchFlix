// utils/streakReminder.js
//
// Seri HATIRLATMASININ zamanlama kararı (saf). Bildirim yalnız hafta gerçekten
// kaybedilmek üzereyken gider: kalan günlerin HER BİRİNDE işaretleme gerektiği ilk
// gün, akşam 19:00'da (ev saat diliminde). Örnek: bu hafta 0/2 → Cumartesi 19:00;
// 1/2 → Pazar 19:00; telafi 1/4 → Cuma 19:00.
//   • hafta zaten kazanıldıysa ya da kalkan geçen haftayı koruyacaksa: yok
//   • artık yetişmesi imkânsızsa: yok (boşuna dürtmeyiz)
//   • o günün 19:00'ı geçtiyse: yok (gece rahatsız etmeyiz)
// Zamanlama cihaz saatiyle yapıldığı için sunucu ↔ cihaz farkı düzeltilir.
//
// SAF MODÜL.

import { gunIndexi, haftaninGunu } from "./watchActivity";
import { streakFlameState } from "./streakFlame";

export const STREAK_REMINDER_ID = "seelogd-streak-reminder";
export const REMINDER_HOUR = 19;

/**
 * @param {object} args
 * @param {object} args.seriler   useWatchProgress().seriler
 * @param {string} args.bugun     seri günü ("YYYY-MM-DD", ev diliminde)
 * @param {number} args.dilim     ev saat dilimi (UTC'den dakika)
 * @param {number} args.simdi     sunucu saati (ms)
 * @param {number} args.cihazFark cihaz − sunucu (ms)
 * @param {object} args.copy      getStreakFlameCopy(...)
 * @returns {{ identifier, date: Date, title, body } | null}
 */
export function planStreakReminder({ seriler, bugun, dilim = 0, simdi, cihazFark = 0, copy }) {
  const state = streakFlameState(seriler);
  if (!state.visible || !copy) return null;
  let have;
  let need;
  let metin;
  if (state.status === "risk") {
    have = state.week.days;
    need = state.week.need;
    metin = copy.reminder.risk;
  } else if (state.status === "repair") {
    have = state.protection.repairHave;
    need = state.protection.repairNeed;
    metin = copy.reminder.repair;
  } else {
    return null; // lit / shield
  }
  const eksik = need - have;
  if (eksik <= 0) return null;
  const gi = gunIndexi(bugun);
  if (!Number.isFinite(gi)) return null;
  const bugunHaftaGunu = haftaninGunu(gi); // 0 = Pazartesi
  const kritikGun = 7 - eksik; // bu günden itibaren her gün gerekli
  // Bugün işaretleme yapıldıysa bugün zaten sayıldı: kalan günler yarından başlar.
  const bugunSayildi = Boolean(state.litToday);
  const ilkUygun = bugunSayildi ? bugunHaftaGunu + 1 : bugunHaftaGunu;
  if (kritikGun < ilkUygun) return null; // yetişmez
  const hedefGi = gi + (kritikGun - bugunHaftaGunu);
  const hedefSunucuMs = hedefGi * 86400000 + REMINDER_HOUR * 3600000 - Number(dilim || 0) * 60000;
  if (!(hedefSunucuMs > Number(simdi))) return null;
  return {
    identifier: STREAK_REMINDER_ID,
    date: new Date(hedefSunucuMs + Number(cihazFark || 0)),
    title: copy.reminder.title,
    body: metin(have, need),
  };
}
