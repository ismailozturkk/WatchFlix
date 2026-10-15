// hooks/useSyncStatus.js
//
// Buluta gitmemiş değişiklik durumu (yerel-öncelikli katman).
//
//   { pending, dead, syncing, lastSyncedAt, lastError, waiting }
//   waiting: "offline" | "auth" | null
//
// `dead` > 0: bulutun reddettiği, yerelde duran işlemler (kural/veri hatası).

import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "../context/AuthContext";
import { getSyncStatus, subscribeSyncStatus } from "../services/userData";

export default function useSyncStatus() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const getSnapshot = useCallback(() => getSyncStatus(uid), [uid]);
  return useSyncExternalStore(subscribeSyncStatus, getSnapshot, getSnapshot);
}
