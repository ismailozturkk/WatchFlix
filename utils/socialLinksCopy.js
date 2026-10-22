// utils/socialLinksCopy.js
//
// "Sosyal hesaplar" özelliğinin metinleri (tr / en / es / pt / de): Profili Düzenle
// bölümü ve profil şeridi. Platform adları markadır, çevrilmez.
// Saf veri — bkz. utils/favoritesCopy.js (aynı desen).

import { copyLanguage } from "./appLanguages";

export const SOCIAL_COPY = {
  tr: {
    title: "Sosyal hesapların",
    hint: "Profilini görenler bu hesaplara dokunup gidebilir. Kullanıcı adını ya da profil adresini yazabilirsin; boş bıraktıkların görünmez.",
    placeholder: "kullanici_adi",
    invalid: (platform) => `${platform} kullanıcı adı geçersiz`,
    openLabel: (platform) => `${platform} profilini aç`,
    openFailed: "Bağlantı açılamadı",
    strip: "Sosyal hesaplar",
  },
  en: {
    title: "Your social accounts",
    hint: "People who see your profile can tap these to visit them. Type a username or paste the profile link; anything left empty stays hidden.",
    placeholder: "username",
    invalid: (platform) => `Invalid ${platform} username`,
    openLabel: (platform) => `Open ${platform} profile`,
    openFailed: "Couldn't open the link",
    strip: "Social accounts",
  },
  es: {
    title: "Tus redes sociales",
    hint: "Quien vea tu perfil puede tocar estas cuentas para visitarlas. Escribe el nombre de usuario o pega el enlace del perfil; lo que dejes vacío no se muestra.",
    placeholder: "usuario",
    invalid: (platform) => `Nombre de usuario de ${platform} no válido`,
    openLabel: (platform) => `Abrir el perfil de ${platform}`,
    openFailed: "No se pudo abrir el enlace",
    strip: "Redes sociales",
  },
  pt: {
    title: "Suas redes sociais",
    hint: "Quem vê seu perfil pode tocar nestas contas para visitá-las. Digite o nome de usuário ou cole o link do perfil; o que ficar vazio não aparece.",
    placeholder: "usuario",
    invalid: (platform) => `Nome de usuário do ${platform} inválido`,
    openLabel: (platform) => `Abrir o perfil do ${platform}`,
    openFailed: "Não foi possível abrir o link",
    strip: "Redes sociais",
  },
  de: {
    title: "Deine Social-Media-Konten",
    hint: "Wer dein Profil sieht, kann diese Konten antippen und besuchen. Gib den Benutzernamen ein oder füge den Profil-Link ein; leere Felder bleiben unsichtbar.",
    placeholder: "benutzername",
    invalid: (platform) => `Ungültiger ${platform}-Benutzername`,
    openLabel: (platform) => `${platform}-Profil öffnen`,
    openFailed: "Link konnte nicht geöffnet werden",
    strip: "Social-Media-Konten",
  },
};

/** Platform görünen adları (marka yazımı; dile göre değişmez). */
export const SOCIAL_NAMES = Object.freeze({
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitch: "Twitch",
  letterboxd: "Letterboxd",
  snapchat: "Snapchat",
  threads: "Threads",
});

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getSocialCopy = (language) =>
  SOCIAL_COPY[copyLanguage(language, Object.keys(SOCIAL_COPY))];
