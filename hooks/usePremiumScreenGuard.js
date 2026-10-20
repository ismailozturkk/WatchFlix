// hooks/usePremiumScreenGuard.js
//
// Premium'a özel BİR EKRANIN kapısı. Giriş noktaları (Hub kartları) kilitliyken
// zaten yükseltme sayfasını açar ve ekrana hiç gitmez; bu hook ikinci kapıdır:
// ekrana başka bir yoldan ulaşılırsa (eski bir gezinme yığını, bildirim, derin
// bağlantı) yükseltme sayfası açılır ve kapanınca/yükseltmeye gidilince ekran
// geri sarılır. Kullanıcı kilitli bir ekranın içinde kalmaz.
//
//   usePremiumScreenGuard("games", navigation);
//
// Yalnız özellik bu planda tamamen KAPALIYSA (limit 0 / erişim yok) devreye
// girer; günlük hakkı biten Premium kullanıcı ekranı görmeye devam eder, oradaki
// eylem kapısı kendi uyarısını verir.
import { useEffect, useRef } from "react";
import { usePremiumGate } from "./usePremiumGate";

export default function usePremiumScreenGuard(featureId, navigation) {
  const gate = usePremiumGate(featureId);
  const locked = !gate.allows(0);
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  useEffect(() => {
    if (!locked) return;
    const leave = () => {
      const nav = navigationRef.current;
      if (nav?.canGoBack?.()) nav.goBack();
    };
    gateRef.current.showUpsell({ onDismiss: leave, onUpgrade: leave });
  }, [locked]);

  return locked;
}
