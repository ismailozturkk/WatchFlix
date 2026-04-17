import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export function useListData(userId, listName) {
  const [listItems, setListItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !listName) return;

    const docRef = doc(db, "Lists", userId);

    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setListItems(data[listName] || []);
      } else {
        setListItems([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, listName]);

  return { listItems, loading };
}
