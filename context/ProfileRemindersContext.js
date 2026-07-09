import React, {
  createContext, useContext, useEffect, useState, useMemo, useRef,
} from "react";
import {
  doc, getDoc, collection, onSnapshot, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import {
  isAuthTransitionError,
  snapshotErrorHandler,
} from "../utils/firestoreError";
import * as cacheStore from "../utils/cacheStore";
import { cacheKeys } from "../utils/cacheKeys";
import { shouldPersistInternetData } from "../utils/dataCacheSettings";
import {
  clearReminderWidget,
  syncReminderWidget,
} from "../services/reminderWidgetService";

const ProfileRemindersContext = createContext();
export const useProfileReminders = () => useContext(ProfileRemindersContext);

const buildDateText = (airDate, t) => {
  const diff = new Date(airDate).getTime() - Date.now();
  if (diff < 0) return null;
  const days   = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const rem    = days % 30;
  if (months > 0) return rem > 0 ? `${months} ${t.month} ${rem} ${t.days}` : `${months} ${t.month}`;
  if (days > 0)   return `${days} ${t.days}`;
  return t.today;
};

// Migrate Reminders/{uid} doc arrays → subcollections
const migrateOldReminders = async (uid, oldData) => {
  try {
    const batch = writeBatch(db);

    (oldData.movieReminders || []).forEach((movie) => {
      batch.set(doc(db, "Reminders", uid, "movies", String(movie.movieId)), movie);
    });

    (oldData.tvReminders || []).forEach((show) => {
      batch.set(doc(db, "Reminders", uid, "tvShows", String(show.showId)), {
        showId: show.showId,
        showName: show.showName,
        showPosterPath: show.showPosterPath || "",
      });
      (show.seasons || []).forEach((season) => {
        (season.episodes || []).forEach((ep) => {
          const epId = String(ep.episodeId || `${show.showId}-${season.seasonNumber}-${ep.episodeNumber}`);
          batch.set(
            doc(db, "Reminders", uid, "tvShows", String(show.showId), "episodes", epId),
            {
              ...ep,
              episodeId: epId,
              showId: show.showId,
              showName: show.showName,
              showPosterPath: show.showPosterPath || "",
              seasonNumber: season.seasonNumber,
              seasonPosterPath: season.seasonPosterPath || null,
            },
          );
        });
      });
    });

    await batch.commit();
  } catch (err) {
    console.error("Reminders migration error:", err);
  }
};

// Reconstruct tvReminders shape [ { showId, showName, seasons: [{ seasonNumber, episodes: [] }] } ]
const buildTvReminders = (allEpisodes) => {
  const showMap = new Map();
  allEpisodes.forEach((ep) => {
    if (!showMap.has(ep.showId)) {
      showMap.set(ep.showId, {
        showId: ep.showId,
        showName: ep.showName,
        showPosterPath: ep.showPosterPath || "",
        seasons: new Map(),
      });
    }
    const show = showMap.get(ep.showId);
    if (!show.seasons.has(ep.seasonNumber)) {
      show.seasons.set(ep.seasonNumber, {
        seasonNumber: ep.seasonNumber,
        seasonPosterPath: ep.seasonPosterPath || null,
        episodes: [],
      });
    }
    show.seasons.get(ep.seasonNumber).episodes.push(ep);
  });

  return Array.from(showMap.values()).map((show) => ({
    ...show,
    seasons: Array.from(show.seasons.values()),
  }));
};

export const ProfileRemindersProvider = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid;
  const { t, language } = useLanguage();

  const [movieReminders, setMovieReminders] = useState([]);
  const [allTvEpisodes,  setAllTvEpisodes]  = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [activeTab,      setActiveTab]      = useState("movie");

  // Refs to manage per-show episode subscriptions
  const epUnsubsRef = useRef({});
  const epDataRef   = useRef({}); // showId → episode[]

  useEffect(() => {
    if (!uid) {
      setMovieReminders([]);
      setAllTvEpisodes([]);
      setLoading(false);
      clearReminderWidget();
      return;
    }

    // Offline-first: önce cache'ten seed.
    const cachedMovies = cacheStore.getJSON(...cacheKeys.reminders(uid, "movies"));
    const cachedEpisodes = cacheStore.getJSON(...cacheKeys.reminders(uid, "episodes"));
    if (Array.isArray(cachedMovies)) setMovieReminders(cachedMovies);
    if (Array.isArray(cachedEpisodes)) setAllTvEpisodes(cachedEpisodes);
    if (Array.isArray(cachedMovies) || Array.isArray(cachedEpisodes)) {
      setLoading(false);
    } else {
      setLoading(true);
    }

    // ── Movies subcollection ────────────────────────────────────────────────
    const movieUnsub = onSnapshot(
      collection(db, "Reminders", uid, "movies"),
      async (snap) => {
        if (snap.empty) {
          // Dual read: check old model and migrate if needed
          try {
            const oldDoc = await getDoc(doc(db, "Reminders", uid));
            if (oldDoc.exists()) {
              const d = oldDoc.data();
              if (d.movieReminders?.length || d.tvReminders?.length) {
                await migrateOldReminders(uid, d);
                return; // onSnapshot fires again after migration
              }
            }
          } catch (err) {
            if (!isAuthTransitionError(err) && __DEV__)
              console.warn("Error checking old reminders:", err?.message);
          }
          setMovieReminders([]);
          if (shouldPersistInternetData()) {
            cacheStore.setJSON(...cacheKeys.reminders(uid, "movies"), []);
          }
        } else {
          const movies = snap.docs.map((d) => d.data());
          setMovieReminders(movies);
          if (shouldPersistInternetData()) {
            cacheStore.setJSON(...cacheKeys.reminders(uid, "movies"), movies);
          }
        }
        setLoading(false);
      },
      (err) => {
        if (!isAuthTransitionError(err) && __DEV__)
          console.warn("[Reminders/movies] snapshot error:", err?.message);
        setLoading(false);
      },
    );

    // ── TV shows subcollection → dynamic episode subscriptions ──────────────
    const showsUnsub = onSnapshot(
      collection(db, "Reminders", uid, "tvShows"),
      (showsSnap) => {
        const activeShowIds = new Set(showsSnap.docs.map((d) => d.id));

        // Remove stale episode listeners
        Object.keys(epUnsubsRef.current).forEach((sid) => {
          if (!activeShowIds.has(sid)) {
            epUnsubsRef.current[sid]();
            delete epUnsubsRef.current[sid];
            delete epDataRef.current[sid];
          }
        });

        if (showsSnap.empty) {
          setAllTvEpisodes([]);
          if (shouldPersistInternetData()) {
            cacheStore.setJSON(...cacheKeys.reminders(uid, "episodes"), []);
          }
          return;
        }

        // Subscribe to episodes of new shows
        showsSnap.docs.forEach((showDoc) => {
          const sid = showDoc.id;
          if (epUnsubsRef.current[sid]) return;
          epUnsubsRef.current[sid] = onSnapshot(
            collection(db, "Reminders", uid, "tvShows", sid, "episodes"),
            (epSnap) => {
              epDataRef.current[sid] = epSnap.docs.map((d) => d.data());
              const all = Object.values(epDataRef.current).flat();
              setAllTvEpisodes(all);
              if (shouldPersistInternetData()) {
                cacheStore.setJSON(...cacheKeys.reminders(uid, "episodes"), all);
              }
            },
            snapshotErrorHandler("Reminders/episodes"),
          );
        });
      },
      snapshotErrorHandler("Reminders/tvShows"),
    );

    return () => {
      movieUnsub();
      showsUnsub();
      Object.values(epUnsubsRef.current).forEach((u) => u());
      epUnsubsRef.current = {};
      epDataRef.current   = {};
    };
  }, [uid]);

  const reminders = useMemo(() => ({
    movieReminders,
    tvReminders: buildTvReminders(allTvEpisodes),
  }), [movieReminders, allTvEpisodes]);

  // Android ana ekran widget'ı Firestore'a ikinci bir bağlantı açmaz. Context'in
  // canonical verisinin küçük bir özetini yerel native depoya aktarır; widget
  // buradan çizilir ve uygulama kapalıyken de son senkronize listeyi gösterebilir.
  useEffect(() => {
    if (!uid) return;
    syncReminderWidget(reminders, language);
  }, [uid, reminders, language]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return typeof timestamp === "string" ? timestamp : "Bilinmeyen Tarih";
    return new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric" }).format(date);
  };

  const calculateDateDifference = (airDate) => {
    if (isNaN(new Date(airDate))) return null;
    const text = buildDateText(airDate, t);
    if (text === null) return { text: formatDate(airDate), isRemaining: false };
    const diff  = new Date(airDate).getTime() - Date.now();
    const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
    return { text, days, months: Math.floor(days / 30), isRemaining: true };
  };

  const value = useMemo(() => ({
    reminders, loading, activeTab, setActiveTab,
    formatDate, calculateDateDifference,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [reminders, loading, activeTab, language]);

  return (
    <ProfileRemindersContext.Provider value={value}>
      {children}
    </ProfileRemindersContext.Provider>
  );
};
