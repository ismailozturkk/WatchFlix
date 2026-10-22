// screens/tabs/profile/resetAccountCopy.js
//
// "Hesabı sıfırla" metinleri (5 dil): tehlikeli bölge satırı, onay sayfası, ilerleme
// aşamaları. Aşama kimlikleri services/accountResetService.js `RESET_STAGES` ile
// birebir aynıdır — eşitliği __tests__/accountReset.test.js korur. Yeni aşama:
// servis listesine ekle + beş dilde etiket yaz. Beş dilin eşitliğini
// __tests__/copyTablesSpanish.test.js korur.

import { copyLanguage } from "../../../utils/appLanguages";

const tr = {
  rowTitle: "Hesabı Sıfırla",
  rowDescription:
    "Listelerin, izleme geçmişin, rozetlerin, Etkinliklerim (puanlar, yorumlar, gönderiler, beğeniler, taslaklar), notların, hatırlatıcıların ve oyun istatistiklerin silinir. Hesabın, profilin ve arkadaşların kalır.",
  sheetTitle: "Hesabı sıfırla",
  sheetDescription:
    "Tüm kütüphanen, izleme geçmişin, rozetlerin ve Etkinliklerim silinir; hesabın, profilin ve arkadaşların kalır. Bu işlem geri alınamaz.",
  needPassword: "Devam etmek için şifreni gir.",
  needGoogle: "Devam etmek için Google hesabınla doğrula.",
  needApple: "Devam etmek için Apple hesabınla doğrula.",
  hold: "Sıfırlamak için basılı tut",
  holdActive: "Sıfırlanana kadar basılı tut…",
  holdHint: "Onaylamak için düğmeyi {seconds} saniye basılı tut.",
  done: "Hesabın sıfırlandı",
  incomplete: "Bazı veriler sıfırlanamadı. Bağlantını kontrol edip tekrar dene.",
  title: "Hesabın sıfırlanıyor",
  hint: "Bu işlem birkaç dakika sürebilir. Lütfen uygulamayı kapatma.",
  step: "Adım {n} / {total}",
  stages: {
    verify: "Kimlik doğrulanıyor",
    library: "Listelerin ve izleme geçmişin siliniyor",
    activity: "Yorumların, gönderilerin, puanların ve beğenilerin siliniyor",
    notes: "Notların, hatırlatıcıların ve yapay zeka sohbetlerin siliniyor",
    games: "Oyun skorların ve istatistiklerin siliniyor",
    local: "Rozetler, taslaklar ve cihazdaki veriler temizleniyor",
  },
};

const en = {
  rowTitle: "Reset Account",
  rowDescription:
    "Your lists, watch history, badges, My Activity (ratings, comments, posts, likes, drafts), notes, reminders and game stats are erased. Your account, profile and friends stay.",
  sheetTitle: "Reset account",
  sheetDescription:
    "Your whole library, watch history, badges and My Activity are erased; your account, profile and friends stay. This cannot be undone.",
  needPassword: "Enter your password to continue.",
  needGoogle: "Verify with your Google account to continue.",
  needApple: "Verify with your Apple account to continue.",
  hold: "Hold to reset",
  holdActive: "Keep holding to reset…",
  holdHint: "Hold the button for {seconds} seconds to confirm.",
  done: "Your account was reset",
  incomplete: "Some data could not be reset. Check your connection and try again.",
  title: "Resetting your account",
  hint: "This can take a few minutes. Please keep the app open.",
  step: "Step {n} of {total}",
  stages: {
    verify: "Verifying your identity",
    library: "Erasing your lists and watch history",
    activity: "Erasing your comments, posts, ratings and likes",
    notes: "Erasing your notes, reminders and AI chats",
    games: "Erasing your game scores and stats",
    local: "Clearing badges, drafts and data on this device",
  },
};

const es = {
  rowTitle: "Restablecer cuenta",
  rowDescription:
    "Se borran tus listas, historial, insignias, Mi actividad (valoraciones, comentarios, publicaciones, me gusta, borradores), notas, recordatorios y estadísticas de juegos. Tu cuenta, perfil y amigos se mantienen.",
  sheetTitle: "Restablecer cuenta",
  sheetDescription:
    "Se borra toda tu biblioteca, tu historial, tus insignias y Mi actividad; tu cuenta, perfil y amigos se mantienen. No se puede deshacer.",
  needPassword: "Introduce tu contraseña para continuar.",
  needGoogle: "Verifica con tu cuenta de Google para continuar.",
  needApple: "Verifica con tu cuenta de Apple para continuar.",
  hold: "Mantén pulsado para restablecer",
  holdActive: "Sigue pulsando para restablecer…",
  holdHint: "Mantén el botón pulsado {seconds} segundos para confirmar.",
  done: "Tu cuenta se restableció",
  incomplete: "No se pudieron restablecer algunos datos. Revisa tu conexión e inténtalo de nuevo.",
  title: "Restableciendo tu cuenta",
  hint: "Esto puede tardar unos minutos. Mantén la app abierta.",
  step: "Paso {n} de {total}",
  stages: {
    verify: "Verificando tu identidad",
    library: "Borrando tus listas e historial",
    activity: "Borrando tus comentarios, publicaciones, valoraciones y me gusta",
    notes: "Borrando tus notas, recordatorios y chats de IA",
    games: "Borrando tus puntuaciones y estadísticas de juegos",
    local: "Borrando insignias, borradores y datos de este dispositivo",
  },
};

const pt = {
  rowTitle: "Redefinir conta",
  rowDescription:
    "Suas listas, histórico, emblemas, Minhas atividades (avaliações, comentários, publicações, curtidas, rascunhos), notas, lembretes e estatísticas de jogos são apagados. Sua conta, perfil e amigos permanecem.",
  sheetTitle: "Redefinir conta",
  sheetDescription:
    "Toda a sua biblioteca, o seu histórico, seus emblemas e Minhas atividades são apagados; sua conta, perfil e amigos permanecem. Isso não pode ser desfeito.",
  needPassword: "Digite sua senha para continuar.",
  needGoogle: "Verifique com sua conta do Google para continuar.",
  needApple: "Verifique com sua conta da Apple para continuar.",
  hold: "Segure para redefinir",
  holdActive: "Continue segurando para redefinir…",
  holdHint: "Segure o botão por {seconds} segundos para confirmar.",
  done: "Sua conta foi redefinida",
  incomplete: "Alguns dados não puderam ser redefinidos. Verifique sua conexão e tente de novo.",
  title: "Redefinindo sua conta",
  hint: "Isso pode levar alguns minutos. Mantenha o app aberto.",
  step: "Etapa {n} de {total}",
  stages: {
    verify: "Verificando sua identidade",
    library: "Apagando suas listas e histórico",
    activity: "Apagando seus comentários, publicações, avaliações e curtidas",
    notes: "Apagando suas notas, lembretes e conversas de IA",
    games: "Apagando suas pontuações e estatísticas de jogos",
    local: "Limpando emblemas, rascunhos e dados deste dispositivo",
  },
};

const de = {
  rowTitle: "Konto zurücksetzen",
  rowDescription:
    "Deine Listen, dein Verlauf, Markierungen, Meine Aktivität (Bewertungen, Kommentare, Beiträge, Likes, Entwürfe), Notizen, Erinnerungen und Spielstatistiken werden gelöscht. Dein Konto, dein Profil und deine Freunde bleiben.",
  sheetTitle: "Konto zurücksetzen",
  sheetDescription:
    "Deine gesamte Bibliothek, dein Verlauf, deine Markierungen und Meine Aktivität werden gelöscht; Konto, Profil und Freunde bleiben. Das kann nicht rückgängig gemacht werden.",
  needPassword: "Gib dein Passwort ein, um fortzufahren.",
  needGoogle: "Bestätige mit deinem Google-Konto, um fortzufahren.",
  needApple: "Bestätige mit deinem Apple-Konto, um fortzufahren.",
  hold: "Zum Zurücksetzen gedrückt halten",
  holdActive: "Weiter gedrückt halten…",
  holdHint: "Halte die Taste {seconds} Sekunden gedrückt, um zu bestätigen.",
  done: "Dein Konto wurde zurückgesetzt",
  incomplete: "Einige Daten konnten nicht zurückgesetzt werden. Prüfe deine Verbindung und versuche es erneut.",
  title: "Dein Konto wird zurückgesetzt",
  hint: "Das kann einige Minuten dauern. Bitte lass die App geöffnet.",
  step: "Schritt {n} von {total}",
  stages: {
    verify: "Identität wird bestätigt",
    library: "Deine Listen und dein Verlauf werden gelöscht",
    activity: "Deine Kommentare, Beiträge, Bewertungen und Likes werden gelöscht",
    notes: "Deine Notizen, Erinnerungen und KI-Chats werden gelöscht",
    games: "Deine Spielstände und Statistiken werden gelöscht",
    local: "Markierungen, Entwürfe und Daten auf diesem Gerät werden gelöscht",
  },
};

export const RESET_ACCOUNT_COPY = Object.freeze({ tr, en, es, pt, de });

/** Uygulama diline göre metin tablosu (bilinmeyen dil → İngilizce). */
export const getResetAccountCopy = (language) =>
  RESET_ACCOUNT_COPY[copyLanguage(language, Object.keys(RESET_ACCOUNT_COPY))];
