import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useAppSettings } from "./AppSettingsContext";
import { useAuth } from "./AuthContext";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

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
  const { API_KEY, selectedLanguage, imageQuality } = useAppSettings();
  const POSTER_BASE = `https://image.tmdb.org/t/p/${imageQuality.poster}`;
  const { user } = useAuth();

  // Kullanıcı seçtiği tarih aralığı (gün)
  const [rangeDays, setRangeDays] = useState(60);

  // TMDB etkinlikleri (tüm takvim için gösterim)
  const [movieEvents, setMovieEvents] = useState({});
  const [tvEvents, setTvEvents] = useState({});

  // Kullanıcı verileri (widget için)
  const [noteEvents, setNoteEvents] = useState({}); // from Notes/{uid}
  const [reminderEvents, setReminderEvents] = useState({}); // from Reminders/{uid}

  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const [lastRangeDays, setLastRangeDays] = useState(null);

  /* ── Firebase: Notes dinleyici ── */
  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, "Notes", user.uid);
    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) return;
      const allNotes = snap.data().notes || [];
      const nMap = {};
      allNotes.forEach((n) => {
        if (!n.scheduledDate) return;
        const d = n.scheduledDate;
        if (!nMap[d]) nMap[d] = [];
        nMap[d].push({ ...n, eventType: "note" });
      });
      setNoteEvents(nMap);
    });
    return unsub;
  }, [user]);

  /* ── Firebase: Reminders dinleyici ── */
  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, "Reminders", user.uid);
    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      const rMap = {};

      // Film hatırlatıcıları
      (data.movieReminders || []).forEach((m) => {
        const d = m.releaseDate;
        if (!d) return;
        if (!rMap[d]) rMap[d] = [];
        rMap[d].push({
          id: m.movieId,
          title: m.movieName,
          poster: m.posterPath ? POSTER_BASE + m.posterPath : null,
          type: "movie",
          eventType: "reminder_movie",
          date: d,
        });
      });

      // Dizi hatırlatıcıları (tüm bölümler düzleştirilerek)
      (data.tvReminders || []).forEach((show) => {
        (show.seasons || []).forEach((season) => {
          (season.episodes || []).forEach((ep) => {
            const d = ep.airDate;
            if (!d) return;
            if (!rMap[d]) rMap[d] = [];
            rMap[d].push({
              id: show.showId,
              title: `${show.showName} - Bölüm ${ep.episodeNumber}`,
              poster: season.seasonPosterPath
                ? `https://image.tmdb.org/t/p/${imageQuality.poster}${season.seasonPosterPath}`
                : null,
              type: "tv",
              eventType: "reminder_tv",
              date: d,
            });
          });
        });
      });

      setReminderEvents(rMap);
    });
    return unsub;
  }, [user]);

  /* ── TMDB fetch ── */
  const fetchTmdbEvents = useCallback(
    async (forceDays) => {
      if (!API_KEY) return;
      const days = forceDays ?? rangeDays;

      // Cache: aynı rangeDays ve 1 saat içindeyse tekrar çekme
      if (
        lastFetch &&
        Date.now() - lastFetch < 60 * 60 * 1000 &&
        lastRangeDays === days
      )
        return;

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
