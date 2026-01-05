import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

const ListStatusContext = createContext();

export const useListStatusContext = () => {
  return useContext(ListStatusContext);
};

export const ListStatusProvider = ({ children }) => {
  const { user } = useAuth();
  const [allLists, setAllLists] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setAllLists(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const docRef = doc(db, "Lists", user.uid);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setAllLists(docSnap.data());
        } else {
          setAllLists(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching lists:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const value = { allLists, loading };

  return (
    <ListStatusContext.Provider value={value}>
      {children}
    </ListStatusContext.Provider>
  );
};
