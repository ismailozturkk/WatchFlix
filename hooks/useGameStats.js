// hooks/useGameStats.js
//
// Oyuncunun oyun istatistik belgesini (SceneGame/{uid}) ekran her odaklandığında
// tazeler. Hub modülü, Oyun Merkezi ve Detay AYNI okumayı kopyalıyordu.
//
// `ready`: ilk okuma bitti mi. Sonraki odaklanmalarda içerik YERİNDE kalır ve
// arkadan tazelenir — eski sürümde her dönüşte iskelet çıkıp kart zıplıyordu.

import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@context/AuthContext";
import { loadGameData } from "@services/sceneGameService";

export default function useGameStats() {
  const { user } = useAuth();
  const [state, setState] = useState({ ready: false, stats: null });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!user?.uid) {
        setState({ ready: true, stats: null });
        return undefined;
      }
      loadGameData(user.uid)
        .then((stats) => {
          if (active) setState({ ready: true, stats });
        })
        .catch(() => {
          if (active) setState((current) => ({ ready: true, stats: current.stats }));
        });
      return () => {
        active = false;
      };
    }, [user?.uid]),
  );

  return state;
}
