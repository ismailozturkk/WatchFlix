// services/hiddenPostsService.js
//
// Şikâyet edilen gönderiler şikâyet edenin akışında gizlenir (T3 B15):
// Users/{uid}/hiddenPosts/{postId} = { postId, reason: "report", hiddenAt }.
//
// Neden kullanıcının kendi alanında (cihaz deposu değil): gizleme cihazlar
// arasında geçerli olsun, yeniden kurulumda kaybolmasın. Kural yalnız sahibine
// okuma/yazma verir (firestore.rules → hiddenPosts). Süzme PostsContext'te.

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { trackFirestoreRead, trackFirestoreWrite } from "./usageTrackerService";

const hiddenRef = (uid, postId) => doc(db, "Users", uid, "hiddenPosts", String(postId));

export async function hidePost(uid, postId) {
  if (!uid || !postId) return;
  await setDoc(hiddenRef(uid, postId), {
    postId: String(postId),
    reason: "report",
    hiddenAt: serverTimestamp(),
  });
  trackFirestoreWrite("hiddenPosts", 1);
}

export async function unhidePost(uid, postId) {
  if (!uid || !postId) return;
  await deleteDoc(hiddenRef(uid, postId));
  trackFirestoreWrite("hiddenPosts", 1);
}

/** Gizlenen gönderi kimliklerini dinler; `onChange(Set<string>)`. */
export function subscribeHiddenPosts(uid, onChange) {
  if (!uid) return () => {};
  return onSnapshot(
    collection(db, "Users", uid, "hiddenPosts"),
    (snap) => {
      trackFirestoreRead("hiddenPosts", snap.docChanges().length || 0);
      onChange(new Set(snap.docs.map((d) => d.id)));
    },
    (error) => {
      if (__DEV__) console.warn("[hiddenPosts]", error?.message);
    },
  );
}
