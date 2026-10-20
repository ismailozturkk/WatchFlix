// hooks/useFollowedPeople.js
//
// Takip edilen oyuncu / yönetmenler: depodaki sözlük (Keys.followedPeople) + yazma işlemleri.
// Karar mantığı utils/followedPeople.js'te (saf, testli); burada yalnız depoya bağlama.
//
// YAZMA SON KAYITTAN OKUR (kapanıştaki state'ten değil): arka arkaya iki hızlı dokunuş, ilk
// yazımın sonucunu ezmesin (hooks/useYearlyGoal.js ile aynı kural). Depo senkron olduğu için
// okuma-değiştir-yaz tek turda biter.
//
// CİHAZ-YEREL: buluta yazılmaz; uygulamayı silen / başka cihazdan giren listeyi görmez
// (docs/ozellikler/OYUNCU_TAKIBI.md "Kararlar").

import { useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { Keys, get, set, remove, useStored } from "../services/storage";
import {
  followPerson,
  followedList,
  normalizeFollowed,
  toStoredFollowed,
  unfollowPerson,
} from "../utils/followedPeople";

function write(uid, next) {
  const options = { uid };
  const stored = toStoredFollowed(next);
  return stored === null ? remove(Keys.followedPeople, options) : set(Keys.followedPeople, stored, options);
}

/**
 * @returns {{
 *   followed: Record<string, object>,
 *   people: object[],
 *   count: number,
 *   isFollowing: (id: number|string) => boolean,
 *   follow: (person: object) => "added"|"exists"|"limit"|"invalid"|"failed",
 *   unfollow: (id: number|string) => boolean,
 * }}
 */
export default function useFollowedPeople() {
  const { user } = useAuth() || {};
  const uid = user?.uid || null;
  // `uid` null iken (çıkış anı) kullanıcı kapsamlı okuma `guest` kovasına düşer; boş döner.
  const raw = useStored(Keys.followedPeople, { uid });
  const followed = useMemo(() => normalizeFollowed(raw), [raw]);
  const people = useMemo(() => followedList(followed), [followed]);

  const isFollowing = useCallback((id) => Boolean(followed[String(id)]), [followed]);

  const follow = useCallback(
    (person) => {
      const current = normalizeFollowed(get(Keys.followedPeople, { uid }));
      const { followed: next, status } = followPerson(current, person);
      if (status !== "added") return status;
      return write(uid, next) ? "added" : "failed";
    },
    [uid],
  );

  const unfollow = useCallback(
    (id) => {
      const current = normalizeFollowed(get(Keys.followedPeople, { uid }));
      if (!current[String(id)]) return false;
      return write(uid, unfollowPerson(current, id));
    },
    [uid],
  );

  return { followed, people, count: people.length, isFollowing, follow, unfollow };
}
