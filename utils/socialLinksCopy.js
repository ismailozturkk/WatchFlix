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

  it: {
  title: "I tuoi account social",
  hint: "Le persone che vedono il tuo profilo possono toccarli per visitarli. Digita un nome utente o incolla il collegamento al profilo; tutto ciò che rimane vuoto rimane nascosto.",
  placeholder: "nome utente",
  invalid: platform => `Nome utente ${platform} non valido`,
  openLabel: platform => `Apri profilo ${platform}`,
  openFailed: "Impossibile aprire il collegamento",
  strip: "Account social"
},
  fr: {
    title: "Tes réseaux sociaux",
    hint: "Les personnes qui voient ton profil peuvent les toucher pour les visiter. Tape un nom d'utilisateur ou colle le lien du profil ; ce qui reste vide est masqué.",
    placeholder: "nom d'utilisateur",
    invalid: (platform) => `Nom d'utilisateur ${platform} invalide`,
    openLabel: (platform) => `Ouvrir le profil ${platform}`,
    openFailed: "Impossible d'ouvrir le lien",
    strip: "Réseaux sociaux",
  },
  ja: {
    title: "あなたのソーシャルアカウント",
    hint: "プロフィールを見た人がタップしてアクセスできます。ユーザー名を入力するかプロフィールのリンクを貼り付けてください。空欄のものは非表示になります。",
    placeholder: "ユーザー名",
    invalid: (platform) => `無効な${platform}ユーザー名`,
    openLabel: (platform) => `${platform}のプロフィールを開く`,
    openFailed: "リンクを開けませんでした",
    strip: "ソーシャルアカウント",
  }};

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
