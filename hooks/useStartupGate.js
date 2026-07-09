// hooks/useStartupGate.js
//
// Açılış yükünü zamana yaymak için basit kapı. İlk render'da false döner;
// etkileşimler bittikten sonra verilen gecikmeyle true olur ve bir daha
// değişmez. Splash kapandıktan hemen sonraki saniyelerde tüm provider'ların
// (feed fetch, istatistik listener'ları, disk taraması...) aynı anda çalışıp
// JS thread'i kilitlemesini önler: kritik olmayan başlangıç işleri bu kapının
// arkasına alınır, her biri farklı gecikmeyle sırayla devreye girer.
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

export default function useStartupGate(delayMs = 0) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return undefined;
    let timer = null;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => setReady(true), delayMs);
    });
    return () => {
      task.cancel?.();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs]);

  return ready;
}
