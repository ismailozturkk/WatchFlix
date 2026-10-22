// screens/tabs/profile/deleteAccountCopy.js
//
// Hesap silme ilerleme görünümünün metinleri (5 dil). Aşama kimlikleri
// services/accountService.js `DELETE_STAGES` ile birebir aynıdır — eşitliği
// __tests__/deleteAccountProgress.test.js korur (ekranda ham kimlik görünmesin).
//
// YENİ AŞAMA: servis listesine ekle + buraya beş dilde etiket yaz.
// `hold*`: onay düğmesinin basılı-tut metinleri (components/profile/HoldToConfirmButton).
// Hesap SIFIRLAMA metinleri resetAccountCopy.js'te.

import { copyLanguage } from "../../../utils/appLanguages";

const tr = {
  title: "Hesabın siliniyor",
  hint: "Bu işlem birkaç dakika sürebilir. Lütfen uygulamayı kapatma.",
  step: "Adım {n} / {total}",
  hold: "Silmek için basılı tut",
  holdActive: "Silinene kadar basılı tut…",
  holdHint: "Onaylamak için düğmeyi {seconds} saniye basılı tut.",
  stages: {
    verify: "Kimlik doğrulanıyor",
    local: "Cihazdaki veriler temizleniyor",
    social: "Arkadaşlık, takip ve bildirim izleri siliniyor",
    comments: "Yorumların siliniyor",
    content: "Gönderilerin, beğenilerin ve puanların siliniyor",
    chats: "Sohbetler, gruplar ve ortak listeler siliniyor",
    games: "Oyun skorları, turnuva oyları ve odalar siliniyor",
    records: "Geri bildirim ve davet kayıtları siliniyor",
    profile: "Profilin ve kişisel verilerin siliniyor",
    fallback: "Kalan veriler kontrol edilip siliniyor",
    account: "Hesabın kapatılıyor",
  },
};

const en = {
  title: "Deleting your account",
  hint: "This can take a few minutes. Please keep the app open.",
  step: "Step {n} of {total}",
  hold: "Hold to delete",
  holdActive: "Keep holding to delete…",
  holdHint: "Hold the button for {seconds} seconds to confirm.",
  stages: {
    verify: "Verifying your identity",
    local: "Clearing data on this device",
    social: "Removing friendships, follows and notifications",
    comments: "Removing your comments",
    content: "Removing your posts, likes and ratings",
    chats: "Removing chats, groups and shared lists",
    games: "Removing game scores, tournament votes and rooms",
    records: "Removing feedback and invite records",
    profile: "Removing your profile and personal data",
    fallback: "Checking and removing leftover data",
    account: "Closing your account",
  },
};

const es = {
  title: "Eliminando tu cuenta",
  hint: "Esto puede tardar unos minutos. Mantén la app abierta.",
  step: "Paso {n} de {total}",
  hold: "Mantén pulsado para eliminar",
  holdActive: "Sigue pulsando para eliminar…",
  holdHint: "Mantén el botón pulsado {seconds} segundos para confirmar.",
  stages: {
    verify: "Verificando tu identidad",
    local: "Borrando datos de este dispositivo",
    social: "Eliminando amistades, seguimientos y notificaciones",
    comments: "Eliminando tus comentarios",
    content: "Eliminando tus publicaciones, me gusta y valoraciones",
    chats: "Eliminando chats, grupos y listas compartidas",
    games: "Eliminando puntuaciones, votos de torneo y salas",
    records: "Eliminando comentarios de la app e invitaciones",
    profile: "Eliminando tu perfil y datos personales",
    fallback: "Comprobando y eliminando datos restantes",
    account: "Cerrando tu cuenta",
  },
};

const pt = {
  title: "Excluindo sua conta",
  hint: "Isso pode levar alguns minutos. Mantenha o app aberto.",
  step: "Etapa {n} de {total}",
  hold: "Segure para excluir",
  holdActive: "Continue segurando para excluir…",
  holdHint: "Segure o botão por {seconds} segundos para confirmar.",
  stages: {
    verify: "Verificando sua identidade",
    local: "Limpando dados deste dispositivo",
    social: "Removendo amizades, seguidores e notificações",
    comments: "Removendo seus comentários",
    content: "Removendo suas publicações, curtidas e avaliações",
    chats: "Removendo conversas, grupos e listas compartilhadas",
    games: "Removendo pontuações, votos de torneio e salas",
    records: "Removendo feedbacks e convites",
    profile: "Removendo seu perfil e dados pessoais",
    fallback: "Verificando e removendo dados restantes",
    account: "Encerrando sua conta",
  },
};

const de = {
  title: "Dein Konto wird gelöscht",
  hint: "Das kann einige Minuten dauern. Bitte lass die App geöffnet.",
  step: "Schritt {n} von {total}",
  hold: "Zum Löschen gedrückt halten",
  holdActive: "Weiter gedrückt halten…",
  holdHint: "Halte die Taste {seconds} Sekunden gedrückt, um zu bestätigen.",
  stages: {
    verify: "Identität wird bestätigt",
    local: "Daten auf diesem Gerät werden gelöscht",
    social: "Freundschaften, Follows und Benachrichtigungen werden entfernt",
    comments: "Deine Kommentare werden entfernt",
    content: "Deine Beiträge, Likes und Bewertungen werden entfernt",
    chats: "Chats, Gruppen und geteilte Listen werden entfernt",
    games: "Spielstände, Turnierstimmen und Räume werden entfernt",
    records: "Feedback und Einladungen werden entfernt",
    profile: "Dein Profil und deine persönlichen Daten werden entfernt",
    fallback: "Restdaten werden geprüft und entfernt",
    account: "Dein Konto wird geschlossen",
  },
};

export const DELETE_ACCOUNT_COPY = Object.freeze({ tr, en, es, pt, de });

/** Uygulama diline göre metin tablosu (bilinmeyen dil → İngilizce). */
export const getDeleteAccountCopy = (language) =>
  DELETE_ACCOUNT_COPY[copyLanguage(language, Object.keys(DELETE_ACCOUNT_COPY))];
