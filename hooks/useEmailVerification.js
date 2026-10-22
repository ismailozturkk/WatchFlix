// hooks/useEmailVerification.js
//
// Profildeki "e-posta doğrulanmadı" uyarısının davranışı:
//   • TAZELEME: Firebase `user.emailVerified` bağlantıya tıklandıktan sonra kendiliğinden
//     güncellenmez (nesne bayat kalır) — kullanıcı doğruladığı hâlde profilde "doğrulanmadı"
//     görünüyordu. Ekran odağa gelince ve uygulama öne dönünce `user.reload()` çağrılır ve
//     ekran yeniden çizilir.
//   • TEKRAR GÖNDER: doğrulama e-postası düşmüşse (kayıtta gönderim hatası dahil) ya da
//     kaybolmuşsa kullanıcı yeniden isteyebilir; 60 sn bekleme + hata türüne göre metin.
//
// `user` AuthContext'teki ham Firebase nesnesi; reload() onu yerinde günceller.

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Toast from "@components/AppToast";
import {
  authEmailErrorMessage,
  fillAuthEmailText,
  sendVerificationEmail,
} from "../services/authEmail";
import { getAuthEmailCopy } from "../utils/authEmailCopy";
import useCooldown from "./useCooldown";

export const VERIFICATION_RESEND_COOLDOWN_S = 60;

export default function useEmailVerification(user, language) {
  const [, rerender] = useReducer((n) => n + 1, 0);
  const [sending, setSending] = useState(false);
  const { remaining, start: startCooldown, active: cooling } = useCooldown();
  const copy = getAuthEmailCopy(language);
  const wasVerified = useRef(Boolean(user?.emailVerified));

  const refresh = useCallback(async () => {
    if (!user || user.emailVerified) return;
    try {
      await user.reload();
    } catch {
      return; // çevrimdışı: bir sonraki odakta tekrar
    }
    if (user.emailVerified && !wasVerified.current) {
      wasVerified.current = true;
      Toast.show({ type: "success", text1: copy.nowVerified });
    }
    rerender();
  }, [user, copy.nowVerified]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const resend = useCallback(async () => {
    if (!user || sending || cooling) return;
    setSending(true);
    try {
      const result = await sendVerificationEmail(user, { language });
      if (result.alreadyVerified) {
        wasVerified.current = true;
        Toast.show({ type: "success", text1: copy.nowVerified });
        rerender();
        return;
      }
      startCooldown(VERIFICATION_RESEND_COOLDOWN_S);
      Toast.show({
        type: "success",
        text1: fillAuthEmailText(copy.verificationSent, { email: user.email || "" }),
        text2: copy.spamHint,
      });
    } catch (error) {
      // Sınır aşıldıysa düğme hemen tekrar basılmasın.
      if (error?.code === "too-many-requests") startCooldown(VERIFICATION_RESEND_COOLDOWN_S);
      Toast.show({ type: "error", text1: authEmailErrorMessage(error, language) });
    } finally {
      setSending(false);
    }
  }, [user, sending, cooling, startCooldown, language, copy]);

  const verified = Boolean(user?.emailVerified);
  return {
    verified,
    sending,
    cooldown: remaining,
    resend,
    resendLabel: cooling
      ? fillAuthEmailText(copy.resendWait, { n: remaining })
      : copy.resendVerification,
  };
}
