// utils/forceUpdate.js
//
// ZORUNLU GÜNCELLEME (16 Kas 2026) — saf kararlar + metinler. Okuyucu: services/forceUpdate.js,
// kanca: hooks/useForceUpdate.js, ekran: screens/ForceUpdateScreen.js.
//
// Uzaktan ayar `AppConfig/minVersion` (herkese okunur, kimse yazamaz; bkz. firestore.rules):
//   { ios: "1.5.2", android: "1.5.2" }            ← platform başına en düşük sürüm
//   { all: "1.5.2" }                               ← ikisi için tek değer (platform alanı ezer)
//   { url: { ios: "https://testflight…" } }        ← isteğe bağlı mağaza bağlantısı (beta: TestFlight)
//
// Neden: sunucu tarafı sıkılaştırmaları (e-posta doğrulama kapısı, App Check zorlaması) eski
// derlemeleri kırar; eski sürümdeki kullanıcıya "bozuk uygulama" yerine "güncelle" ekranı gösterilir.
//
// GÜVENLİ YÖNE DÜŞER: belge yoksa, sürüm okunamazsa ya da biçim bozuksa engel YOK.

import { copyLanguage } from "./appLanguages";

const ANDROID_PACKAGE = "com.smlztrk.seelogd";
const IOS_APP_ID = "6801549169"; // eas.json submit.production.ios.ascAppId

/** "1.5.2" / "v1.5" / "1.5.2-beta" → [1, 5, 2]; anlaşılmazsa null. */
export function parseVersion(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^v?(\d+(?:\.\d+){0,3})(?:[-+].*)?$/);
  if (!match) return null;
  return match[1].split(".").map((part) => Number(part));
}

/** a < b → -1, eşit → 0, a > b → 1; biri anlaşılmazsa null. Eksik parça 0 sayılır (1.5 = 1.5.0). */
export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/** Bu platform için istenen en düşük sürüm (platform alanı `all`'u ezer); yoksa null. */
export function requiredVersionFor(config, platform) {
  if (!config || typeof config !== "object") return null;
  const own = config[platform];
  if (typeof own === "string" && parseVersion(own)) return own.trim();
  if (typeof config.all === "string" && parseVersion(config.all)) return config.all.trim();
  return null;
}

/** Yüklü sürüm istenenden KESİN olarak eskiyse true. Her belirsizlikte false (engelleme). */
export function isUpdateRequired(currentVersion, config, platform) {
  const required = requiredVersionFor(config, platform);
  if (!required) return false;
  return compareVersions(currentVersion, required) === -1;
}

const isHttpUrl = (value) => typeof value === "string" && /^https:\/\/\S+$/i.test(value.trim());

/**
 * Mağaza bağlantıları: önce uygulamanın kendi şeması (mağaza uygulamasını doğrudan açar),
 * açılamazsa web adresi. Ayardaki `url.{platform}` (yalnız https) ikisinin yerine geçer.
 */
export function storeLinksFor(config, platform) {
  const override = config?.url?.[platform];
  if (isHttpUrl(override)) return { primary: override.trim(), fallback: override.trim() };
  if (platform === "ios") {
    return {
      primary: `itms-apps://apps.apple.com/app/id${IOS_APP_ID}`,
      fallback: `https://apps.apple.com/app/id${IOS_APP_ID}`,
    };
  }
  return {
    primary: `market://details?id=${ANDROID_PACKAGE}`,
    fallback: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
  };
}

const tr = {
  title: "Güncelleme gerekli",
  body: "Seelogd'un bu sürümü artık desteklenmiyor. Devam etmek için uygulamayı güncelle.",
  versions: "Yüklü sürüm {current} · gereken en az {required}",
  update: "Şimdi güncelle",
  openFailed: "Mağaza açılamadı. Uygulamayı mağazadan elle güncelleyebilirsin.",
  why: "Güvenlik ve hesap korumaları yenilendi; eski sürümler sunucuya bağlanamıyor. Listelerin ve verilerin hesabında güvende.",
};

const en = {
  title: "Update required",
  body: "This version of Seelogd is no longer supported. Update the app to continue.",
  versions: "Installed {current} · requires at least {required}",
  update: "Update now",
  openFailed: "Couldn't open the store. You can update the app from the store manually.",
  why: "Security and account protections were renewed, so older versions can't reach the server. Your lists and data are safe in your account.",
};

const es = {
  title: "Actualización necesaria",
  body: "Esta versión de Seelogd ya no es compatible. Actualiza la app para continuar.",
  versions: "Versión instalada {current} · se requiere al menos {required}",
  update: "Actualizar ahora",
  openFailed: "No se pudo abrir la tienda. Puedes actualizar la app manualmente desde la tienda.",
  why: "Renovamos la seguridad y la protección de cuentas, así que las versiones antiguas no pueden conectarse al servidor. Tus listas y datos están a salvo en tu cuenta.",
};

const pt = {
  title: "Atualização necessária",
  body: "Esta versão do Seelogd não é mais compatível. Atualize o app para continuar.",
  versions: "Versão instalada {current} · requer pelo menos {required}",
  update: "Atualizar agora",
  openFailed: "Não foi possível abrir a loja. Você pode atualizar o app manualmente pela loja.",
  why: "As proteções de segurança e de conta foram renovadas, então versões antigas não conseguem se conectar ao servidor. Suas listas e dados estão seguros na sua conta.",
};

const de = {
  title: "Update erforderlich",
  body: "Diese Version von Seelogd wird nicht mehr unterstützt. Aktualisiere die App, um fortzufahren.",
  versions: "Installiert {current} · mindestens {required} erforderlich",
  update: "Jetzt aktualisieren",
  openFailed: "Der Store konnte nicht geöffnet werden. Du kannst die App manuell im Store aktualisieren.",
  why: "Sicherheits- und Kontoschutz wurden erneuert, ältere Versionen erreichen den Server nicht mehr. Deine Listen und Daten sind in deinem Konto sicher.",
};

const it = {
  title: "Aggiornamento necessario",
  body: "Questa versione di Seelogd non è più supportata. Aggiorna l'app per continuare.",
  versions: "Versione installata {current} · richiesta almeno {required}",
  update: "Aggiorna ora",
  openFailed: "Impossibile aprire lo store. Puoi aggiornare l'app manualmente dallo store.",
  why: "Abbiamo rinnovato sicurezza e protezione dell'account, quindi le versioni precedenti non raggiungono il server. Le tue liste e i tuoi dati sono al sicuro nel tuo account.",
};

const fr = {
  title: "Mise à jour requise",
  body: "Cette version de Seelogd n'est plus prise en charge. Mets l'app à jour pour continuer.",
  versions: "Version installée {current} · minimum requis {required}",
  update: "Mettre à jour",
  openFailed: "Impossible d'ouvrir le store. Tu peux mettre l'app à jour manuellement depuis le store.",
  why: "La sécurité et la protection des comptes ont été renforcées : les anciennes versions ne peuvent plus joindre le serveur. Tes listes et tes données sont en sécurité dans ton compte.",
};

const ja = {
  title: "アップデートが必要です",
  body: "このバージョンの Seelogd はサポートが終了しました。続けるにはアプリをアップデートしてください。",
  versions: "インストール済み {current} · 必要なバージョン {required} 以上",
  update: "今すぐアップデート",
  openFailed: "ストアを開けませんでした。ストアから手動でアップデートしてください。",
  why: "セキュリティとアカウント保護を強化したため、古いバージョンはサーバーに接続できません。リストやデータはアカウントに安全に保存されています。",
};

export const FORCE_UPDATE_COPY = Object.freeze({ tr, en, es, pt, de, it, fr, ja });

export const getForceUpdateCopy = (language) =>
  FORCE_UPDATE_COPY[copyLanguage(language, Object.keys(FORCE_UPDATE_COPY))];
