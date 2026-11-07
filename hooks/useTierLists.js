// hooks/useTierLists.js
//
// Tier list'ler: cihaz-yerel kayıt (Keys.tierLists) + saf çekirdek (utils/tierList.js) bağlaması. Ağ / Firestore yok.
//
// Her yazım SON KAYITTAN okur (depo senkron): kanca birden çok yerde açık olabilir (Eğlence kartı, liste ekranı,
// düzenleyici, sohbet önizlemesi) ve art arda gelen iki dokunuş birbirinin yazımını ezmemeli.
//
//   const { lists, getList, create, update, remove, duplicate, importShare } = useTierLists();
//   update(id, (list, now) => placeMedia(list, key, tierId, null, now));

import { useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { Keys, get, remove as removeStored, set, useStored } from "../services/storage";
import {
  canCreateTierList,
  createTierList,
  deleteTierList,
  duplicateTierList,
  normalizeTierState,
  tierListFromShare,
  toStoredTierState,
  upsertTierList,
} from "../utils/tierList";

const newId = () => `tl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Okuma-değiştir-yaz tek turda. @returns {object} yazılan durum */
function write(uid, update) {
  const options = { uid };
  const current = normalizeTierState(get(Keys.tierLists, options));
  const next = update(current);
  if (next === current) return current;
  const stored = toStoredTierState(next);
  if (stored === null) removeStored(Keys.tierLists, options);
  else set(Keys.tierLists, stored, options);
  return next;
}

export default function useTierLists() {
  const { user } = useAuth() || {};
  const uid = user?.uid || null;
  const raw = useStored(Keys.tierLists, { uid });
  const state = useMemo(() => normalizeTierState(raw), [raw]);

  const getList = useCallback((id) => state.lists.find((list) => list.id === id) || null, [state]);

  /** Yeni tablo; tavan doluysa null. @returns {string|null} kimlik */
  const create = useCallback(
    ({ title, template, labels }) => {
      if (!uid) return null;
      let id = null;
      write(uid, (current) => {
        if (!canCreateTierList(current)) return current;
        const list = createTierList({ id: newId(), title, template, labels, now: Date.now() });
        id = list.id;
        return upsertTierList(current, list);
      });
      return id;
    },
    [uid],
  );

  /**
   * Tabloyu değiştirir. `change(list, now)` yeni tablo ya da (değişiklik yoksa) aynı nesneyi döner.
   * @returns {object|null} güncel tablo
   */
  const update = useCallback(
    (id, change) => {
      if (!uid) return null;
      let result = null;
      write(uid, (current) => {
        const list = current.lists.find((entry) => entry.id === id);
        if (!list) return current;
        const next = change(list, Date.now());
        result = next;
        return next === list ? current : upsertTierList(current, next);
      });
      return result;
    },
    [uid],
  );

  const remove = useCallback((id) => uid && write(uid, (current) => deleteTierList(current, id)), [uid]);

  /** Kopya (başlığa ek); tavan doluysa null. */
  const duplicate = useCallback(
    (id, suffix = "") => {
      if (!uid) return null;
      let copyId = null;
      write(uid, (current) => {
        const list = current.lists.find((entry) => entry.id === id);
        if (!list || !canCreateTierList(current)) return current;
        const copy = duplicateTierList(list, { id: newId(), title: `${list.title}${suffix}`, now: Date.now() });
        copyId = copy.id;
        return upsertTierList(current, copy);
      });
      return copyId;
    },
    [uid],
  );

  /** Sohbetten gelen tablonun kopyası (utils/chatShare tierList gövdesi); tavan doluysa null. */
  const importShare = useCallback(
    (share) => {
      if (!uid || !share) return null;
      let id = null;
      write(uid, (current) => {
        if (!canCreateTierList(current)) return current;
        const list = tierListFromShare(share, { id: newId(), now: Date.now() });
        if (!list) return current;
        id = list.id;
        return upsertTierList(current, list);
      });
      return id;
    },
    [uid],
  );

  return {
    lists: state.lists,
    canCreate: canCreateTierList(state),
    getList,
    create,
    update,
    remove,
    duplicate,
    importShare,
  };
}
