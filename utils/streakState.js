// utils/streakState.js
//
// Defterin `aktiflik` bölümünden ekrana giden TEK seri nesnesi:
//   • günlük/haftalık aktiflik serileri (utils/watchActivity serileriHesapla) — rozetler
//   • `alev`: HAFTALIK seri alevi (utils/streakWeekly alevHesapla) — profildeki 🔥
// Gün anahtarı sunucu saatinden (utils/streakBridge) ve ev saat diliminden türer.
//
// SAF MODÜL (köprü varsayılanı cihaz saatidir).

import { serileriHesapla, seriGunuAnahtari } from "./watchActivity";
import { alevHesapla } from "./streakWeekly";
import { streakBridge } from "./streakBridge";

/** Seri günü: sunucu saati + ev dilimi. */
export const seriGunu = (aktiflik, simdi = streakBridge.simdi()) =>
  seriGunuAnahtari(simdi, aktiflik?.saatDilimi?.dakika);

/** `aktiflik` → `seriler` (+ `alev`). */
export function seriDurumu(aktiflik, simdi = streakBridge.simdi()) {
  const a = aktiflik || {};
  const gunler = Array.isArray(a.gunler) ? a.gunler : [];
  const seriler = serileriHesapla(gunler, { ...a, simdi });
  const gun = seriGunu(a, simdi);
  const alev = alevHesapla({ gunler, alev: a.alev, gunluk: a.gunluk }, gun);
  // seriGunu + dilim: hatırlatma zamanlaması ev saat diliminde yapılır (utils/streakReminder).
  return { ...seriler, alev, seriGunu: gun, dilim: a.saatDilimi?.dakika ?? null };
}
