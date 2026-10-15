// components/UserDataSyncHost.js
//
// Yerel-öncelikli veri katmanının yaşam döngüsü bağlayıcısı (görsel çıktısı yok).
//
//   giriş            → işçiyi başlat; kopyası olmayan alanları TEK SEFER indir
//   uygulama öne     → bekleyen yazımları hemen dene (+ eksik indirmeyi tamamla)
//   arka plana gider → bekleyen yazımları hemen dene (süreç dondurulmadan önce)
//   bağlantı gelir   → services/userData kendi aboneliğiyle halleder
//
// AuthProvider'ın İÇİNDE olmalı.

import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth } from "../context/AuthContext";
import {
  nudgeUserData,
  retryUserData,
  startUserData,
  stopUserData,
} from "../services/userData";

export default function UserDataSyncHost() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid) return undefined;
    startUserData(uid);
    return () => stopUserData(uid);
  }, [uid]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        nudgeUserData();
        retryUserData();
      } else if (state === "background" || state === "inactive") {
        nudgeUserData();
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}
