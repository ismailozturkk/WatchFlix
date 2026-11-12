import { useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useUserProfile } from "../context/UserProfileContext";
import { publicStreakFromSeriler } from "../utils/publicStreak";

export default function usePublicStreakSync(seriler) {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile() || {};
  const uid = user?.uid;
  const published = profile?.publicStreak;

  useEffect(() => {
    if (!uid || loading || profile?.uid !== uid || !seriler) return;
    const next = publicStreakFromSeriler(seriler);
    if (JSON.stringify(next) === JSON.stringify(published ?? null)) return;
    updateDoc(doc(db, "Users", uid), { publicStreak: next }).catch((error) => {
      if (__DEV__) console.warn("Public streak sync:", error.message);
    });
  }, [uid, loading, profile?.uid, seriler, published]);
}
