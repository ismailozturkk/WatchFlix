import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  useImageQualitySettings,
} from "./AppSettingsContext";
import { useAuth } from "./AuthContext";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { snapshotErrorHandler } from "../utils/firestoreError";

const CalendarContext = createContext();

// Eski kullanım için saklandı (artık aktif değil)
export const RANGE_OPTIONS = [
  { label: "1 Ay", days: 30 },
  { label: "2 Ay", days: 60 },
  { label: "3 Ay", days: 90 },
];

function toDateStr(date) {
  // Yerel tarih bileşenleri: toISOString UTC gösterdiği için UTC+3'te
  // 00:00-03:00 arasında "bugün" bir gün geride kalıyordu (etkinlik
  // anahtarları yerel YYYY-MM-DD formatında tutuluyor).
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const CalendarProvider = ({ children }) => {
  const { getTmdbUrl } = useImageQualitySettings();
  const { user } = useAuth();

  // Kullanıcı verileri
  const [noteEvents,          setNoteEvents]          = useState({});
  const [movieReminderEvents, setMovieReminderEvents] = useState({});
  const [tvReminderEpisodes,  setTvReminderEpisodes]  = useState([]); // flat list of episode docs

  // Tüm hatırlatıcıları tek bir tarih-bazlı map olarak birleştir
  const reminderEvents = useMemo(() => {
    const rMap = {};
    Object.entries(movieReminderEvents).forEach(([d, arr]) => {
      rMap[d] = [...(rMap[d] || []), ...arr];
    });
    tvReminderEpisodes.forEach((ep) => {
      const d = ep.airDate;
      if (!d) return;
      if (!rMap[d]) rMap[d] = [];
      rMap[d].push({
        id:            ep.showId,
        episodeId:     ep.episodeId,
        seasonNumber:  ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        showName:      ep.showName,
        title:         `${ep.showName} - S${ep.seasonNumber}B${ep.episodeNumber}`,
        poster:        ep.seasonPosterPath
                         ? getTmdbUrl(ep.seasonPosterPath, "poster", 200)
                         : (ep.showPosterPath
                             ? getTmdbUrl(ep.showPosterPath, "poster", 200)
                             : null),
        type:          "tv",
        eventType:     "reminder_tv",
        date:          d,
      });
    });
    return rMap;
  }, [movieReminderEvents, tvReminderEpisodes]);

  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  /* ── Firebase: Notes dinleyici (Notes/{uid}/items subcollection) ── */
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "Notes", user.uid, "items"), (snap) => {
      const nMap = {};
      snap.docs.forEach((d) => {
        const n = d.data();
        if (!n.scheduledDate) return;
        if (!nMap[n.scheduledDate]) nMap[n.scheduledDate] = [];
        nMap[n.scheduledDate].push({ ...n, eventType: "note", date: n.scheduledDate });
      });
      setNoteEvents(nMap);
    }, snapshotErrorHandler("Calendar/notes"));
    return unsub;
  }, [user]);

  /* ── Firebase: Reminders dinleyici (subcollections) ── */
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    setIsLoadingEvents(true);

    // Movie reminders subcollection
    const movieUnsub = onSnapshot(
      collection(db, "Reminders", uid, "movies"),
      (snap) => {
        const mMap = {};
        snap.docs.forEach((d) => {
          const m = d.data();
          const date = m.releaseDate;
          if (!date) return;
          if (!mMap[date]) mMap[date] = [];
          mMap[date].push({
            id:        m.movieId,
            title:     m.movieName,
            poster:    m.posterPath ? getTmdbUrl(m.posterPath, "poster", 200) : null,
            type:      "movie",
            eventType: "reminder_movie",
            date,
          });
        });
        setMovieReminderEvents(mMap);
        setIsLoadingEvents(false);
      },
      (err) => {
        snapshotErrorHandler("Calendar/movies")(err);
        setIsLoadingEvents(false);
      },
    );

    // TV show subcollection → dynamic per-show episode subscriptions
    const epUnsubs  = {};
    const epDataMap = {}; // showId → episode[]

    const showsUnsub = onSnapshot(
      collection(db, "Reminders", uid, "tvShows"),
      (showsSnap) => {
        const activeShowIds = new Set(showsSnap.docs.map((d) => d.id));

        // Remove stale episode listeners
        Object.keys(epUnsubs).forEach((sid) => {
          if (!activeShowIds.has(sid)) {
            epUnsubs[sid]();
            delete epUnsubs[sid];
            delete epDataMap[sid];
          }
        });

        if (showsSnap.empty) { setTvReminderEpisodes([]); return; }

        showsSnap.docs.forEach((showDoc) => {
          const sid = showDoc.id;
          if (epUnsubs[sid]) return;
          epUnsubs[sid] = onSnapshot(
            collection(db, "Reminders", uid, "tvShows", sid, "episodes"),
            (epSnap) => {
              epDataMap[sid] = epSnap.docs.map((d) => d.data());
              setTvReminderEpisodes(Object.values(epDataMap).flat());
            },
            snapshotErrorHandler("Calendar/episodes"),
          );
        });
      },
      snapshotErrorHandler("Calendar/tvShows"),
    );

    return () => {
      movieUnsub();
      showsUnsub();
      Object.values(epUnsubs).forEach((u) => u());
    };
  }, [user]);

  /* ── Takvim için markedDates (sadece kullanıcı verileri) ── */
  const markedDates = useMemo(() => {
    const allDates = new Set([
      ...Object.keys(noteEvents),
      ...Object.keys(reminderEvents),
    ]);
    const result = {};
    allDates.forEach((d) => {
      const dots = [];
      if (noteEvents[d]?.length) {
        dots.push({ key: "note", color: "rgb(19, 141, 240)" });
      }
      if (reminderEvents[d]?.some((i) => i.eventType === "reminder_movie")) {
        dots.push({ key: "movie", color: "rgb(255, 124, 37)" });
      }
      if (reminderEvents[d]?.some((i) => i.eventType === "reminder_tv")) {
        dots.push({ key: "tv", color: "rgb(128, 0, 128)" });
      }
      if (dots.length) result[d] = { dots, marked: true };
    });
    return result;
  }, [noteEvents, reminderEvents]);

  /* ── Seçili günün etkinlikleri (sadece kullanıcı verileri) ── */
  const getEventsForDate = useCallback(
    (dateStr) => {
      const notes  = [...(noteEvents[dateStr] || [])];
      const movies = (reminderEvents[dateStr] || []).filter((i) => i.type === "movie");
      const tvs    = (reminderEvents[dateStr] || []).filter((i) => i.type === "tv");
      return { notes, movies, tvs };
    },
    [noteEvents, reminderEvents],
  );

  /* ── Widget: Sadece kullanıcının eklediği verilerden en yakın 3 etkinlik ── */
  const upcomingItems = useMemo(() => {
    const today = toDateStr(new Date());
    const items = [];

    Object.entries(noteEvents).forEach(([d, arr]) => {
      if (d >= today) arr.forEach((n) => items.push({ ...n, date: d }));
    });
    Object.entries(reminderEvents).forEach(([d, arr]) => {
      if (d >= today) arr.forEach((r) => items.push({ ...r, date: d }));
    });

    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  }, [noteEvents, reminderEvents]);

  const refreshEvents = useCallback(() => {
    // Firestore listener'ları zaten canlı; sadece UI feedback için kısa flash
    setIsLoadingEvents(true);
    setTimeout(() => setIsLoadingEvents(false), 300);
  }, []);

  return (
    <CalendarContext.Provider
      value={{
        noteEvents,
        reminderEvents,
        markedDates,
        isLoadingEvents,
        getEventsForDate,
        upcomingItems,
        refreshEvents,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
};

export const useCalendar = () => {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendar must be used within CalendarProvider");
  return ctx;
};
