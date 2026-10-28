import { deleteField, doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { normalizeSocialLinks } from "../utils/socialLinks";

export const socialLinksDocRef = (uid) => doc(db, "Users", uid, "socialLinks", "links");

export function subscribeSocialLinks(uid, onData, onError) {
  return onSnapshot(socialLinksDocRef(uid), (snap) => onData(snap.exists() ? snap.data().links : null), onError);
}

// Eski kök alanı ve yeni belge aynı işlemde güncellenir. Böylece görünürlük
// daraltıldığında kökte herkese açık bir kopya kalmaz.
export async function saveSocialLinks(uid, links) {
  const rootRef = doc(db, "Users", uid);
  const linksRef = socialLinksDocRef(uid);
  await runTransaction(db, async (tx) => {
    const root = await tx.get(rootRef);
    if (!root.exists()) throw new Error("profile-not-found");
    tx.set(linksRef, { links: normalizeSocialLinks(links), updatedAt: serverTimestamp() });
    tx.update(rootRef, {
      ...(Object.prototype.hasOwnProperty.call(root.data(), "socialLinks") ? { socialLinks: deleteField() } : {}),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function migrateRootSocialLinks(uid) {
  const rootRef = doc(db, "Users", uid);
  const linksRef = socialLinksDocRef(uid);
  await runTransaction(db, async (tx) => {
    const [root, links] = await Promise.all([tx.get(rootRef), tx.get(linksRef)]);
    if (!root.exists() || !Object.prototype.hasOwnProperty.call(root.data(), "socialLinks")) return;
    if (!links.exists()) tx.set(linksRef, { links: normalizeSocialLinks(root.data().socialLinks), updatedAt: serverTimestamp() });
    tx.update(rootRef, { socialLinks: deleteField(), updatedAt: serverTimestamp() });
  });
}
