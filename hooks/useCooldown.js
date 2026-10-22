// hooks/useCooldown.js
//
// Geri sayım: `start(saniye)` ile başlar, her saniye `remaining` azalır, 0'da durur.
// "Tekrar gönder" düğmelerini kilitlemek için (şifre sıfırlama / doğrulama e-postası) —
// Firebase art arda isteklerde `too-many-requests` verip hesabı geçici kilitliyor.

import { useCallback, useEffect, useRef, useState } from "react";

export default function useCooldown() {
  const [remaining, setRemaining] = useState(0);
  const timer = useRef(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(
    (seconds) => {
      stop();
      const total = Math.max(0, Math.floor(Number(seconds) || 0));
      setRemaining(total);
      if (total === 0) return;
      timer.current = setInterval(() => {
        setRemaining((value) => {
          if (value <= 1) {
            stop();
            return 0;
          }
          return value - 1;
        });
      }, 1000);
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { remaining, start, active: remaining > 0 };
}
