// utils/authEmailCopy.js
//
// E-posta doğrulama / şifre sıfırlama akışlarının metinleri (5 dil). Mantık
// services/authEmail.js'te. Beş dilin eşitliğini __tests__/copyTablesSpanish.test.js korur.
//
// Eskiden şifre sıfırlamadaki HER hata "Geçersiz e posta adresi" diye gösteriliyordu
// (çevrimdışı ve çok fazla deneme dahil); artık hata türüne göre ayrı metin var.

import { copyLanguage } from "./appLanguages";

const tr = {
  invalidEmail: "Geçerli bir e-posta adresi gir.",
  offline: "İnternet bağlantısı yok. Bağlanınca tekrar dene.",
  tooMany: "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.",
  noSession: "Oturum bulunamadı. Lütfen tekrar giriş yap.",
  generic: "E-posta gönderilemedi. Biraz sonra tekrar dene.",
  resendVerification: "Doğrulama e-postasını tekrar gönder",
  resendWait: "Tekrar göndermek için {n} sn bekle",
  verificationSent: "Doğrulama e-postası {email} adresine gönderildi",
  nowVerified: "E-postan doğrulandı",
  sendWait: "Gönder ({n})",
  spamHint: "Gelmezse spam/gereksiz klasörünü de kontrol et.",
};

const en = {
  invalidEmail: "Enter a valid email address.",
  offline: "No internet connection. Try again when you are online.",
  tooMany: "Too many attempts. Wait a bit and try again.",
  noSession: "No session found. Please sign in again.",
  generic: "The email could not be sent. Try again in a moment.",
  resendVerification: "Resend verification email",
  resendWait: "Wait {n} s to resend",
  verificationSent: "Verification email sent to {email}",
  nowVerified: "Your email is verified",
  sendWait: "Send ({n})",
  spamHint: "If it does not arrive, check your spam folder too.",
};

const es = {
  invalidEmail: "Introduce un correo electrónico válido.",
  offline: "Sin conexión a internet. Inténtalo de nuevo cuando estés conectado.",
  tooMany: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
  noSession: "No se encontró la sesión. Inicia sesión de nuevo.",
  generic: "No se pudo enviar el correo. Inténtalo de nuevo en un momento.",
  resendVerification: "Reenviar correo de verificación",
  resendWait: "Espera {n} s para reenviar",
  verificationSent: "Correo de verificación enviado a {email}",
  nowVerified: "Tu correo está verificado",
  sendWait: "Enviar ({n})",
  spamHint: "Si no llega, revisa también la carpeta de spam.",
};

const pt = {
  invalidEmail: "Digite um e-mail válido.",
  offline: "Sem conexão com a internet. Tente de novo quando estiver online.",
  tooMany: "Muitas tentativas. Aguarde um pouco e tente novamente.",
  noSession: "Sessão não encontrada. Entre novamente.",
  generic: "Não foi possível enviar o e-mail. Tente novamente em instantes.",
  resendVerification: "Reenviar e-mail de verificação",
  resendWait: "Aguarde {n} s para reenviar",
  verificationSent: "E-mail de verificação enviado para {email}",
  nowVerified: "Seu e-mail foi verificado",
  sendWait: "Enviar ({n})",
  spamHint: "Se não chegar, verifique também a pasta de spam.",
};

const de = {
  invalidEmail: "Gib eine gültige E-Mail-Adresse ein.",
  offline: "Keine Internetverbindung. Versuche es erneut, sobald du online bist.",
  tooMany: "Zu viele Versuche. Warte einen Moment und versuche es erneut.",
  noSession: "Keine Sitzung gefunden. Bitte melde dich erneut an.",
  generic: "Die E-Mail konnte nicht gesendet werden. Versuche es gleich noch einmal.",
  resendVerification: "Bestätigungs-E-Mail erneut senden",
  resendWait: "Warte {n} Sek. zum erneuten Senden",
  verificationSent: "Bestätigungs-E-Mail an {email} gesendet",
  nowVerified: "Deine E-Mail ist bestätigt",
  sendWait: "Senden ({n})",
  spamHint: "Kommt sie nicht an, prüfe auch den Spam-Ordner.",
};

export const AUTH_EMAIL_COPY = Object.freeze({ tr, en, es, pt, de });

export const getAuthEmailCopy = (language) =>
  AUTH_EMAIL_COPY[copyLanguage(language, Object.keys(AUTH_EMAIL_COPY))];

/** "{n}" / "{email}" yer tutucularını doldurur. */
export const fillAuthEmailText = (text, values = {}) =>
  Object.entries(values).reduce((out, [key, value]) => out.split(`{${key}}`).join(String(value)), text);
