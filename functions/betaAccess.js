"use strict";

// Beta dönemi: uygulamayı kullanan HERKES Premium Max olur.
//
// NASIL: mağaza aboneliği değil, mevcut promosyon mekanizması (referral.js). Her kullanıcının
// `Users/{uid}.entitlements`'ına `promoPlan: "unlimited"` + `promoUntil` yazılır; AI kotası,
// Firestore kuralları ve istemci kapıları zaten oradan okuduğu için yeni uygulama sürümü gerekmez.
// Yazımı index.js yapar: yeni hesap açılınca (grantBetaOnUserCreated) ve saatlik süpürmede
// (applyBetaAccess, mevcut hesaplar). Beta verilen hesaplar `BetaGrants/{uid}` altında izlenir.
//
// AÇMA / KAPATMA / TARİH DEĞİŞTİRME: aşağıdaki BETA_ACCESS'i değiştirip functions deploy et.
//   • open: false  → bir sonraki süpürmede betadan gelen haklar geri alınır (mağaza aboneliğine
//                    ve sonradan kodla alınan daha uzun promosyona dokunulmaz).
//   • untilMs      → yeni bitiş. Uzatma: büyütüp deploy et; süpürme herkesin bitişini yeniler.
//                    Kısaltma için önce open:false deploy edilir (hak geri alınır), sonra yeni
//                    tarihle open:true.
// Beta sonrası "1 ay hediye": beta bitince e-postalara functions/scripts/promoCodes.js ile
// `--plan max --days 30` kodları üretilip gönderilir.

const referral = require("./referral");

const BETA_ACCESS = Object.freeze({
  open: true,
  // 1 Şubat 2027 gün sonu (UTC).
  untilMs: Date.UTC(2027, 1, 1, 23, 59, 59),
  plan: "unlimited",
});

function isBetaActive(config = BETA_ACCESS, nowMs = Date.now()) {
  return config?.open === true && Number.isFinite(config.untilMs) && config.untilMs > nowMs;
}

/** Bu hesaba beta Max yazılmalı mı? Zaten aynı/daha iyi haktan varsa hayır. */
function needsBetaGrant(entitlements, config = BETA_ACCESS, nowMs = Date.now()) {
  if (!isBetaActive(config, nowMs)) return false;
  // Mağazadan alınmış Max abonelik: dokunma.
  if (
    entitlements?.premiumSource !== "promo" &&
    entitlements?.premiumPlan === "unlimited" &&
    entitlements?.premium === true
  ) {
    return false;
  }
  const promo = referral.readPromo(entitlements, nowMs);
  if (
    promo?.active &&
    promo.plan === "unlimited" &&
    promo.untilMs >= config.untilMs &&
    entitlements?.premiumPlan === "unlimited"
  ) {
    return false;
  }
  return true;
}

/** Yazılacak bitiş: beta tarihi ile hesapta süren (daha uzun) promosyonun büyüğü. */
function betaGrantUntilMs(entitlements, config = BETA_ACCESS, nowMs = Date.now()) {
  const promo = referral.readPromo(entitlements, nowMs);
  return promo?.active ? Math.max(promo.untilMs, config.untilMs) : config.untilMs;
}

/**
 * Beta kapanınca bu hak geri alınmalı mı? Yalnız hesabın bitişi, betanın yazdığı bitişle AYNI
 * ise (sonradan kodla uzatılmış / değişmiş promosyon korunur).
 */
function shouldRevokeBetaGrant(grant, entitlements, nowMs = Date.now()) {
  const promo = referral.readPromo(entitlements, nowMs);
  return Boolean(promo?.active && grant && promo.untilMs === grant.untilMs);
}

module.exports = {
  BETA_ACCESS,
  isBetaActive,
  needsBetaGrant,
  betaGrantUntilMs,
  shouldRevokeBetaGrant,
};
