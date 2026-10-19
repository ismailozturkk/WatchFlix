// utils/referralCopy.js
//
// "Arkadaşını davet et" ekranının ve "Kodun var mı?" sayfasının metinleri (tr / en / es).
// Saf veri: RN içe aktarması yok. __tests__/copyTablesSpanish.test.js üç dilin aynı şekle sahip olduğunu denetler.
//
// Kural özeti (sunucu: functions/referral.js — sayılar orada, buraya parametre olarak gelir):
//   • Davet eden: arkadaşı kodunu girip İLK ücretli aboneliğini başlatınca 1 ay ücretsiz Premium.
//   • Davetli: kodu girer, ilk abonelikte %N indirim (mağaza teklifi).
//   • Promosyon kodu: yönetici üretir, sınırlı kişiye 1 ay ücretsiz Premium.

import { copyLanguage } from "./appLanguages";

export const REFERRAL_COPY = {
  tr: {
    rowTitle: "Arkadaşını davet et",
    rowSubtitle: "Kodunu paylaş, her abone arkadaşın için 1 ay ücretsiz kazan",
    screenTitle: "Arkadaşını davet et",
    hero: {
      title: "Getir, 1 ay Premium kazan",
      body: (percent) =>
        `Arkadaşın kodunu girip abone olunca sen 1 ay ücretsiz Premium kazanırsın; arkadaşın da ilk aboneliğinde %${percent} indirim alır.`,
    },
    yourCode: "Davet kodun",
    copy: "Kopyala",
    copied: "Kod kopyalandı",
    share: "Davet gönder",
    shareMessage: (code, percent, links) =>
      `Seelogd'u dene! Kayıt olduktan sonra Premium sayfasındaki "Kodun var mı?" alanına ${code} kodumu girersen ilk aboneliğinde %${percent} indirim alırsın.\n\n${links}`,
    steps: {
      title: "Nasıl çalışır?",
      one: "Kodunu arkadaşına gönder",
      two: (days) => `Arkadaşın ${days} gün içinde kodu girer`,
      three: "Arkadaşın abone olunca sen 1 ay ücretsiz Premium kazanırsın",
    },
    reward: {
      title: "Kazandığın ücretsiz aylar",
      none: "Henüz ücretsiz ay kazanmadın",
      available: (n) => (n === 1 ? "1 ücretsiz ay seni bekliyor" : `${n} ücretsiz ay seni bekliyor`),
      start: "Ücretsiz ayı başlat",
      starting: "Başlatılıyor…",
      active: (date) => `Ücretsiz Premium ${date} tarihine kadar açık`,
      started: (date) => `Ücretsiz Premium ${date} tarihine kadar açık`,
      storeActive: "Mağaza aboneliğin sürerken ücretsiz ay bekler; abonelik bitince başlatabilirsin",
      earned: (n, max) => `Toplam ${n} / ${max} ay kazandın`,
      capped: (max) => `En fazla ${max} ay kazanılabilir`,
    },
    list: {
      title: "Davet ettiklerin",
      empty: "Henüz kimse kodunu girmedi. Kodunu paylaşınca arkadaşların burada görünür.",
      counts: (registered, subscribed) =>
        `${registered} kişi kodunu girdi · ${subscribed} kişi abone oldu`,
      status: {
        registered: "Kayıt oldu",
        subscribed: "Abone oldu",
        rewarded: "Abone oldu · ücretsiz ay kazandın",
      },
      statusHint: "Arkadaşın yalnız kodunu girdiyse burada \"Kayıt oldu\" görünür",
    },
    invitedBy: {
      title: (name) => (name ? `${name} seni davet etti` : "Davetle geldin"),
      discount: (percent) =>
        `İlk aboneliğinde %${percent} indirim seni bekliyor. İndirim ödeme ekranında uygulanır.`,
      used: "Davet indirimini kullandın",
    },
    redeem: {
      entryTitle: "Kodun var mı?",
      entryHint: "Davet ya da promosyon kodunu gir",
      sheetTitle: "Kod gir",
      sheetBody: "Bir arkadaşının davet kodunu (ilk abonelikte indirim) ya da promosyon kodunu (1 ay ücretsiz Premium) gir.",
      placeholder: "ABCD-EFGH",
      apply: "Kodu kullan",
      applying: "Kontrol ediliyor…",
      promoSuccess: (days, date) => `${days} gün ücretsiz Premium açıldı · ${date} tarihine kadar`,
      referralSuccess: (percent, name) =>
        name
          ? `${name} adlı kişinin davetini kabul ettin. İlk aboneliğinde %${percent} indirim uygulanacak.`
          : `Davet kabul edildi. İlk aboneliğinde %${percent} indirim uygulanacak.`,
      discountPending: (percent) =>
        `Davet indirimi (%${percent}) mağaza teklifi hazır olduğunda ödeme ekranında görünür.`,
    },
    errors: {
      "code-not-found": "Bu kod geçerli değil. Yazımını kontrol et.",
      "code-exhausted": "Bu kodun kullanım hakkı doldu.",
      "code-expired": "Bu kodun süresi dolmuş.",
      "code-inactive": "Bu kod artık kullanılamıyor.",
      "already-redeemed": "Daha önce bir kod kullandın; her hesap yalnız bir kez kullanabilir.",
      "own-code": "Kendi davet kodunu kullanamazsın.",
      "window-closed": (days) => `Davet kodu hesap açıldıktan sonra ilk ${days} gün içinde girilebilir.`,
      "already-purchased": "Davet indirimi yalnızca ilk abonelik içindir; daha önce abone olmuşsun.",
      "store-subscription-active": "Aboneliğin sürerken bu kod kullanılamaz.",
      "rate-limited": "Çok fazla yanlış deneme. Yarın tekrar dene.",
      "no-credit": "Başlatılacak ücretsiz ayın yok.",
      generic: "İşlem tamamlanamadı. Bağlantını kontrol edip tekrar dene.",
    },
    loadFailed: "Davet bilgileri yüklenemedi",
    retry: "Tekrar dene",
  },
  en: {
    rowTitle: "Invite a friend",
    rowSubtitle: "Share your code and get 1 free month for every friend who subscribes",
    screenTitle: "Invite a friend",
    hero: {
      title: "Bring a friend, get 1 month of Premium",
      body: (percent) =>
        `When a friend enters your code and subscribes, you get 1 month of Premium free, and they get ${percent}% off their first subscription.`,
    },
    yourCode: "Your invite code",
    copy: "Copy",
    copied: "Code copied",
    share: "Send invite",
    shareMessage: (code, percent, links) =>
      `Try Seelogd! After signing up, enter my code ${code} under "Have a code?" on the Premium page to get ${percent}% off your first subscription.\n\n${links}`,
    steps: {
      title: "How it works",
      one: "Send your code to a friend",
      two: (days) => `Your friend enters it within ${days} days`,
      three: "When they subscribe, you get 1 month of Premium free",
    },
    reward: {
      title: "Your free months",
      none: "You haven't earned a free month yet",
      available: (n) => (n === 1 ? "1 free month is waiting for you" : `${n} free months are waiting for you`),
      start: "Start free month",
      starting: "Starting…",
      active: (date) => `Free Premium is active until ${date}`,
      started: (date) => `Free Premium is active until ${date}`,
      storeActive: "Free months wait while your store subscription is active; start one when it ends",
      earned: (n, max) => `${n} of ${max} months earned`,
      capped: (max) => `You can earn up to ${max} months`,
    },
    list: {
      title: "Friends you invited",
      empty: "Nobody has entered your code yet. Friends show up here once you share it.",
      counts: (registered, subscribed) =>
        `${registered} entered your code · ${subscribed} subscribed`,
      status: {
        registered: "Signed up",
        subscribed: "Subscribed",
        rewarded: "Subscribed · you earned a free month",
      },
      statusHint: "If a friend only entered your code, they show as \"Signed up\"",
    },
    invitedBy: {
      title: (name) => (name ? `${name} invited you` : "You joined with an invite"),
      discount: (percent) =>
        `${percent}% off your first subscription is waiting. The discount is applied at checkout.`,
      used: "You used your invite discount",
    },
    redeem: {
      entryTitle: "Have a code?",
      entryHint: "Enter an invite or promo code",
      sheetTitle: "Enter a code",
      sheetBody: "Enter a friend's invite code (discount on your first subscription) or a promo code (1 month of Premium free).",
      placeholder: "ABCD-EFGH",
      apply: "Redeem code",
      applying: "Checking…",
      promoSuccess: (days, date) => `${days} days of free Premium unlocked · until ${date}`,
      referralSuccess: (percent, name) =>
        name
          ? `You accepted ${name}'s invite. ${percent}% off your first subscription will apply.`
          : `Invite accepted. ${percent}% off your first subscription will apply.`,
      discountPending: (percent) =>
        `The invite discount (${percent}%) will appear at checkout once the store offer is live.`,
    },
    errors: {
      "code-not-found": "This code isn't valid. Check the spelling.",
      "code-exhausted": "This code has been used up.",
      "code-expired": "This code has expired.",
      "code-inactive": "This code can't be used anymore.",
      "already-redeemed": "You've already used a code; each account can use one.",
      "own-code": "You can't use your own invite code.",
      "window-closed": (days) => `An invite code can be entered within the first ${days} days after signing up.`,
      "already-purchased": "The invite discount is for a first subscription only; you've subscribed before.",
      "store-subscription-active": "This code can't be used while you have a subscription.",
      "rate-limited": "Too many wrong attempts. Try again tomorrow.",
      "no-credit": "You have no free month to start.",
      generic: "That didn't work. Check your connection and try again.",
    },
    loadFailed: "Couldn't load invite details",
    retry: "Try again",
  },
  es: {
    rowTitle: "Invita a un amigo",
    rowSubtitle: "Comparte tu código y gana 1 mes gratis por cada amigo que se suscriba",
    screenTitle: "Invita a un amigo",
    hero: {
      title: "Trae a un amigo, gana 1 mes de Premium",
      body: (percent) =>
        `Cuando un amigo introduce tu código y se suscribe, tú ganas 1 mes de Premium gratis y él obtiene un ${percent}% de descuento en su primera suscripción.`,
    },
    yourCode: "Tu código de invitación",
    copy: "Copiar",
    copied: "Código copiado",
    share: "Enviar invitación",
    shareMessage: (code, percent, links) =>
      `¡Prueba Seelogd! Tras registrarte, introduce mi código ${code} en "¿Tienes un código?" de la página Premium y obtén un ${percent}% de descuento en tu primera suscripción.\n\n${links}`,
    steps: {
      title: "Cómo funciona",
      one: "Envía tu código a un amigo",
      two: (days) => `Tu amigo lo introduce en un plazo de ${days} días`,
      three: "Cuando se suscribe, tú ganas 1 mes de Premium gratis",
    },
    reward: {
      title: "Tus meses gratis",
      none: "Todavía no has ganado ningún mes gratis",
      available: (n) => (n === 1 ? "Te espera 1 mes gratis" : `Te esperan ${n} meses gratis`),
      start: "Empezar mes gratis",
      starting: "Iniciando…",
      active: (date) => `Premium gratis activo hasta el ${date}`,
      started: (date) => `Premium gratis activo hasta el ${date}`,
      storeActive: "Los meses gratis esperan mientras tu suscripción de la tienda esté activa; empieza uno cuando termine",
      earned: (n, max) => `${n} de ${max} meses ganados`,
      capped: (max) => `Puedes ganar hasta ${max} meses`,
    },
    list: {
      title: "Amigos que invitaste",
      empty: "Nadie ha introducido tu código todavía. Tus amigos aparecerán aquí cuando lo compartas.",
      counts: (registered, subscribed) =>
        `${registered} introdujeron tu código · ${subscribed} se suscribieron`,
      status: {
        registered: "Registrado",
        subscribed: "Suscrito",
        rewarded: "Suscrito · ganaste un mes gratis",
      },
      statusHint: "Si un amigo solo introdujo tu código, aparece como \"Registrado\"",
    },
    invitedBy: {
      title: (name) => (name ? `${name} te invitó` : "Llegaste con una invitación"),
      discount: (percent) =>
        `Te espera un ${percent}% de descuento en tu primera suscripción. Se aplica al pagar.`,
      used: "Usaste tu descuento de invitación",
    },
    redeem: {
      entryTitle: "¿Tienes un código?",
      entryHint: "Introduce un código de invitación o promocional",
      sheetTitle: "Introduce un código",
      sheetBody: "Introduce el código de invitación de un amigo (descuento en la primera suscripción) o un código promocional (1 mes de Premium gratis).",
      placeholder: "ABCD-EFGH",
      apply: "Usar código",
      applying: "Comprobando…",
      promoSuccess: (days, date) => `${days} días de Premium gratis activados · hasta el ${date}`,
      referralSuccess: (percent, name) =>
        name
          ? `Aceptaste la invitación de ${name}. Se aplicará un ${percent}% de descuento en tu primera suscripción.`
          : `Invitación aceptada. Se aplicará un ${percent}% de descuento en tu primera suscripción.`,
      discountPending: (percent) =>
        `El descuento de invitación (${percent}%) aparecerá al pagar cuando la oferta de la tienda esté disponible.`,
    },
    errors: {
      "code-not-found": "Este código no es válido. Revisa cómo lo escribiste.",
      "code-exhausted": "Este código ya se agotó.",
      "code-expired": "Este código ha caducado.",
      "code-inactive": "Este código ya no se puede usar.",
      "already-redeemed": "Ya usaste un código; cada cuenta puede usar uno.",
      "own-code": "No puedes usar tu propio código de invitación.",
      "window-closed": (days) => `El código de invitación se puede introducir durante los primeros ${days} días tras registrarte.`,
      "already-purchased": "El descuento de invitación es solo para la primera suscripción; ya te habías suscrito.",
      "store-subscription-active": "Este código no se puede usar mientras tengas una suscripción.",
      "rate-limited": "Demasiados intentos fallidos. Vuelve a intentarlo mañana.",
      "no-credit": "No tienes ningún mes gratis para empezar.",
      generic: "No se pudo completar. Revisa tu conexión e inténtalo de nuevo.",
    },
    loadFailed: "No se pudo cargar la información de invitaciones",
    retry: "Reintentar",
  },
};

/** Uygulama diline göre metin tablosu (tabloda olmayan dil → İngilizce). */
export const getReferralCopy = (language) =>
  REFERRAL_COPY[copyLanguage(language, Object.keys(REFERRAL_COPY))];
