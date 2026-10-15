// services/userData/firestoreRemote.js
//
// Yerel-öncelikli katmanın TEK Firestore kapısı. Motor (createDomain) ve işçi
// (syncWorker) Firebase'i import etmez; bu bağdaştırıcıyı alır — böylece Jest'te
// sahte bulutla test edilirler.
//
// Arayüz:
//   fetchCollection(path) → [{ id, data }]     yalnız tek seferlik indirmede
//   fetchDoc(path)        → data | null        yalnız eski şema göçünde
//   commit(ops)           → Promise<void>      tek `writeBatch`, atomik
//
// Okuma/yazma maliyeti `usageTrackerService`e yazılır (Ayarlar > Kullanım).

import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import {
  trackFirestoreDelete,
  trackFirestoreRead,
  trackFirestoreWrite,
} from "../usageTrackerService";

/**
 * Kullanım ekranındaki koleksiyon etiketi: uid içermez, alt koleksiyonu ayırt eder.
 *   Notes/u/items/x                         → "Notes"
 *   Reminders/u/tvShows/s/episodes/e        → "Reminders/episodes"
 */
export function labelOf(path) {
  const parts = String(path).split("/").filter(Boolean);
  const root = parts[0] || "unknown";
  if (root !== "Reminders") return root;
  // koleksiyon adları çift olmayan indekslerdedir: 0=Reminders, 2=movies|tvShows, 4=episodes
  const sub = parts.length > 4 ? parts[4] : parts[2];
  return sub ? `${root}/${sub}` : root;
}

export function createFirestoreRemote() {
  return {
    async fetchCollection(path) {
      const snap = await getDocs(collection(db, path));
      // Boş sorgu da 1 okuma faturalanır.
      trackFirestoreRead(labelOf(`${path}/x`), snap.docs.length || 1);
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    },

    async fetchDoc(path) {
      const snap = await getDoc(doc(db, path));
      trackFirestoreRead(labelOf(path), 1);
      return snap.exists() ? snap.data() : null;
    },

    async commit(ops) {
      const batch = writeBatch(db);
      for (const op of ops) {
        const ref = doc(db, op.path);
        if (op.op === "set") batch.set(ref, op.data);
        else batch.delete(ref);
      }
      await batch.commit();

      // Yalnız başarılı commit sayılır.
      const writes = new Map();
      const deletes = new Map();
      for (const op of ops) {
        const bucket = op.op === "set" ? writes : deletes;
        const label = labelOf(op.path);
        bucket.set(label, (bucket.get(label) || 0) + 1);
      }
      for (const [label, n] of writes) trackFirestoreWrite(label, n);
      for (const [label, n] of deletes) trackFirestoreDelete(label, n);
    },
  };
}
