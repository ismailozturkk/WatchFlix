import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  useApiSettings,
  useImageQualitySettings,
  useLanguageSettings,
} from "./AppSettingsContext";
import { useAuth } from "./AuthContext";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { getCachedValue, setCachedValue, TTL } from "../utils/apiCache";

const CalendarContext = createContext();

const TMDB_BASE = "https://api.themoviedb.org/3";

// TMDB için izin verilen maksimum gün aralığı: isteğe bağlı
export const RANGE_OPTIONS = [
  { label: "1 Ay", days: 30 },
  { label: "2 Ay", days: 60 },
  { label: "3 Ay", days: 90 },
];

function toDateStr(date) {
  return date.toISOString().split("T")[0];
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export const CalendarProvider = ({ children }) => {
  const { API_KEY } = useApiSettings();
  const { selectedLanguage } = useLanguageSettings();
  const { imageQuality } = useImageQualitySettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const { user } = useAuth();

  // Kullanıcı seçtiği tarih aralığı (gün)
  const [rangeDays, setRangeDays] = useState(60);

  // TMDB etkinlikleri (tüm takvim için gösterim)
  const [movieEvents, setMovieEvents] = useState({});
  const [tvEvents, setTvEvents] = useState({});

  // Kullanıcı verileri (widget için)
  const [noteEvents,          setNoteEvents]          = useState({});
  const [movieReminderEvents, setMovieReminderEvents] = useState({});
  const [tvReminderEpisodes,  setTvReminderEpisodes]  = useState([]); // flat list of all episode docs

  // Merge movie + tv reminder events into one date-keyed map
  const reminderEvents = useMemo(() => {
    const rMap = { ...movieReminderEvents };
    tvReminderEpisodes.forEach((ep) => {
      const d = ep.airDate;
      if (!d) return;
      if (!rMap[d]) rMap[d] = [];
      rMap[d].push({
        id:        ep.showId,
        title:     `${ep.showName} - Bölüm ${ep.episodeNumber}`,
        poster: ep.seasonPosterPath ? getTmdbUrl(ep.seasonPosterPath, 'poster', 200) : null,
        type:      "tv",
        eventType: "reminder_tv",
        date:      d,
      });
    });
    return rMap;
  }, [movieReminderEvents, tvReminderEpisodes]);

  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const [lastRangeDays, setLastRangeDays] = useState(null);

  /* ── Firebase: Notes dinleyici (Notes/{uid}/items subcollection) ── */
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "Notes", user.uid, "items"), (snap) => {
      const nMap = {};
      snap.docs.forEach((d) => {
        const n = d.data();
        if (!n.scheduledDate) return;
        if (!nMap[n.scheduledDate]) nMap[n.scheduledDate] = [];
        nMap[n.scheduledDate].push({ ...n, eventType: "note" });
      });
      setNoteEvents(nMap);
    });
    return unsub;
  }, [user]);

  /* ── Firebase: Reminders dinleyici (subcollections) ── */
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

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
            poster:    m.posterPath ? POSTER_BASE + m.posterPath : null,
            type:      "movie",
            eventType: "reminder_movie",
            date,
          });
        });
        setMovieReminderEvents(mMap);
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
          );
        });
      },
    );

    return () => {
      movieUnsub();
      showsUnsub();
      Object.values(epUnsubs).forEach((u) => u());
    };
  }, [user]);

  /* ── TMDB fetch ── */
  const fetchTmdbEvents = useCallback(
    async (forceDays) => {
      if (!API_KEY) return;
      const days = forceDays ?? rangeDays;

      // In-memory guard: same range, within TTL
      if (lastFetch && Date.now() - lastFetch < TTL.CALENDAR && lastRangeDays === days)
        return;

      // Persistent cache: survives app restarts
      const cacheKey = `calendar_tmdb_${selectedLanguage}_${days}`;
      const cached = await getCachedValue(cacheKey, TTL.CALENDAR);
      if (cached) {
        setMovieEvents(cached.movieEvents);
        setTvEvents(cached.tvEvents);
        setLastFetch(Date.now());
        setLastRangeDays(days);
        return;
      }

      setIsLoadingEvents(true);
      const now = new Date();
      const gte = toDateStr(now);
      const lte = toDateStr(addDays(now, days));
      const lang = selectedLanguage === "tr" ? "tr-TR" : "en-US";

      try {
        const headers = {
          Authorization: API_KEY,
          "Content-Type": "application/json",
        };

        // TMDB Discover: max 2 sayfa (~40 sonuç)
        const [movRes1, movRes2, tvRes1, tvRes2] = await Promise.all([
          fetch(
            `${TMDB_BASE}/discover/movie?language=${lang}&sort_by=primary_release_date.asc&primary_release_date.gte=${gte}&primary_release_date.lte=${lte}&page=1`,
            { headers },
          ),
          fetch(
            `${TMDB_BASE}/discover/movie?language=${lang}&sort_by=primary_release_date.asc&primary_release_date.gte=${gte}&primary_release_date.lte=${lte}&page=2`,
            { headers },
          ),
          fetch(
            `${TMDB_BASE}/discover/tv?language=${lang}&sort_by=first_air_date.asc&first_air_date.gte=${gte}&first_air_date.lte=${lte}&page=1`,
            { headers },
          ),
          fetch(
            `${TMDB_BASE}/discover/tv?language=${lang}&sort_by=first_air_date.asc&first_air_date.lte=${lte}&first_air_date.gte=${gte}&page=2`,
            { headers },
          ),
        ]);

        const [md1, md2, td1, td2] = await Promise.all([
          movRes1.json(),
          movRes2.json(),
          tvRes1.json(),
          tvRes2.json(),
        ]);

        // Duplicate ID temizle
        const seenMovieIds = new Set();
        const movies = [...(md1.results || []), ...(md2.results || [])].filter(
          (m) => {
            if (seenMovieIds.has(m.id)) return false;
            seenMovieIds.add(m.id);
            return true;
          },
        );

        const seenTvIds = new Set();
        const tvShows = [...(td1.results || []), ...(td2.results || [])].filter(
          (t) => {
            if (seenTvIds.has(t.id)) return false;
            seenTvIds.add(t.id);
            return true;
          },
        );

        // Tarihe göre gruplandır
        const mMap = {};
        movies.forEach((m) => {
          const d = m.primary_release_date;
          if (!d) return;
          if (!mMap[d]) mMap[d] = [];
          mMap[d].push({
            id: m.id,
            title: m.title,
            poster: m.poster_path ? POSTER_BASE + m.poster_path : null,
            type: "movie",
            eventType: "movie",
            date: d,
            rating: m.vote_average,
          });
        });

        const tMap = {};
        tvShows.forEach((t) => {
          const d = t.first_air_date;
          if (!d) return;
          if (!tMap[d]) tMap[d] = [];
          tMap[d].push({
            id: t.id,
            title: t.name,
            poster: t.poster_path ? POSTER_BASE + t.poster_path : null,
            type: "tv",
            eventType: "tv",
            date: d,
            rating: t.vote_average,
          });
        });

        setMovieEvents(mMap);
        setTvEvents(tMap);
        setLastFetch(Date.now());
        setLastRangeDays(days);
        const cacheKey = `calendar_tmdb_${selectedLanguage}_${days}`;
        setCachedValue(cacheKey, { movieEvents: mMap, tvEvents: tMap });
      } catch (e) {
        console.warn("TMDB fetch error:", e);
      } finally {
        setIsLoadingEvents(false);
      }
    },
    [API_KEY, selectedLanguage, lastFetch, lastRangeDays, rangeDays],
  );

  useEffect(() => {
    fetchTmdbEvents();
  }, [fetchTmdbEvents]);

  /* ── Takvim için markedDates (tüm kaynaklar) ── */
  const markedDates = useMemo(() => {
    const allDates = new Set([
      ...Object.keys(movieEvents),
      ...Object.keys(tvEvents),
      ...Object.keys(noteEvents),
      ...Object.keys(reminderEvents),
    ]);
    const result = {};
    allDates.forEach((d) => {
      const dots = [];
      if (
        noteEvents[d]?.length ||
        reminderEvents[d]?.some((i) => i.eventType === "reminder_note")
      )
        dots.push({ key: "note", color: "rgb(19, 141, 240)" });
      if (
        movieEvents[d]?.length ||
        reminderEvents[d]?.some((i) => i.eventType === "reminder_movie")
      )
        dots.push({ key: "movie", color: "rgb(255, 124, 37)" });
      if (
        tvEvents[d]?.length ||
        reminderEvents[d]?.some((i) => i.eventType === "reminder_tv")
      )
        dots.push({ key: "tv", color: "rgb(128, 0, 128)" });
      result[d] = { dots, marked: true };
    });
    return result;
  }, [movieEvents, tvEvents, noteEvents, reminderEvents]);

  /* ── Seçili günün etkinlikleri ── */
  const getEventsForDate = useCallback(
    (dateStr) => {
      const notes = [...(noteEvents[dateStr] || [])];
      const movies = [
        ...(movieEvents[dateStr] || []),
        ...(reminderEvents[dateStr] || []).filter((i) => i.type === "movie"),
      ];
      const tvs = [
        ...(tvEvents[dateStr] || []),
        ...(reminderEvents[dateStr] || []).filter((i) => i.type === "tv"),
      ];
      return { notes, movies, tvs };
    },
    [noteEvents, movieEvents, tvEvents, reminderEvents],
  );

  /* ── Widget: Sadece kullanıcının eklediği verilerden en yakın 3 etkinlik ── */
  const upcomingItems = useMemo(() => {
    const today = toDateStr(new Date());
    const items = [];

    // Notlar (scheduledDate olan)
    Object.entries(noteEvents).forEach(([d, arr]) => {
      if (d >= today) arr.forEach((n) => items.push({ ...n, date: d }));
    });

    // Kullanıcının hatırlatıcıları (film + dizi)
    Object.entries(reminderEvents).forEach(([d, arr]) => {
      if (d >= today) arr.forEach((r) => items.push({ ...r, date: d }));
    });

    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  }, [noteEvents, reminderEvents]);

  /* ── Aralık değiştirme ── */
  const changeRange = useCallback(
    (days) => {
      setRangeDays(days);
      setLastFetch(null); // cache'i sıfırla, yeniden çeksin
      fetchTmdbEvents(days);
    },
    [fetchTmdbEvents],
  );

  return (
    <CalendarContext.Provider
      value={{
        movieEvents,
        tvEvents,
        noteEvents,
        reminderEvents,
        markedDates,
        isLoadingEvents,
        getEventsForDate,
        upcomingItems,
        rangeDays,
        changeRange,
        refreshEvents: () => {
          setLastFetch(null);
          fetchTmdbEvents();
        },
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
